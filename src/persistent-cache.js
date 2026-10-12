/* Profile-local cache: one four-coordinate box per evaluated PDF page. */
"use strict";
var MarginFitPersistentCache = (() => {
  // Independent from plugin/package versions; increase ONLY after user approval.
  const ALGORITHM_VERSION = 1;
  const LEGACY_STORAGE_VERSION = 3;
  const LEGACY_ALGORITHM_VERSION = 5; // v0.1.7 geometry, not comparable with v1
  const BATCH_PAGES = 10;
  const FLUSH_MS = 10000;
  const WRITE_QUEUE = new Map();
  const finite = n => typeof n === "number" && Number.isFinite(n);
  function validBox(box, width = Infinity, height = Infinity) {
    return Array.isArray(box) && box.length === 4 && box.every(finite) &&
      box[0] >= 0 && box[1] >= 0 && box[2] > box[0] && box[3] > box[1] &&
      box[2] <= width + .01 && box[3] <= height + .01;
  }
  // The persistent rectangle is axis-specific: X fits the supported body
  // while Y still spans every visible item, including far-out page numbers.
  // Thus a single four-number array preserves the Width Fit exception without
  // discarding full vertical ink geometry or adding a second cached rectangle.
  function fitBox(record) {
    const raw = Array.isArray(record) ? record : record?.raw;
    if (!validBox(raw, record?.width, record?.height)) return raw;
    const body = record?.widthFitRaw;
    if (validBox(body, record.width, record.height) &&
        body[0] >= raw[0] && body[2] <= raw[2] &&
        Math.abs(body[1]-raw[1]) < .01 && Math.abs(body[3]-raw[3]) < .01)
      return [body[0], raw[1], body[2], raw[3]];
    return raw;
  }
  function cacheKey(fingerprints, count) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 100000 ||
        !fingerprints || typeof fingerprints.length !== "number") return null;
    const parts = Array.from(fingerprints).filter(x => x != null);
    if (parts.length < 1 || parts.length > 2 ||
        parts.some(x => typeof x !== "string" || !/^[a-f0-9]{16,64}$/i.test(x))) return null;
    return parts.map(x => x.toLowerCase()).join("-") + "-" + count;
  }
  class Store {
    constructor({ io, path, timers, fingerprints, count, version = ALGORITHM_VERSION }) {
      this.io = io; this.path = path; this.timers = timers; this.count = count;
      this.version = version; this.key = cacheKey(fingerprints, count);
      this.directory = path.join(path.profileDir, "marginfit-boundaries");
      this.file = this.key ? path.join(this.directory, this.key + ".json") : null;
      this.dirty = new Map(); this.timer = null; this.writing = Promise.resolve();
      this.readOnly = false;
    }
    unpack(payload) {
      const result = new Map();
      if (!payload || payload.algorithmVersion !== this.version ||
          !payload.pages || Array.isArray(payload.pages) ||
          typeof payload.pages !== "object") return result;
      // A file must belong to this PDF; this is additional to its fingerprint-based filename.
      if (payload.key !== this.key || payload.numPages !== this.count) return result;
      for (const [key, box] of Object.entries(payload.pages)) {
        const p = Number(key);
        if (String(p) === key && Number.isSafeInteger(p) && p >= 1 && p <= this.count &&
            validBox(box)) result.set(p, {raw:[...box], quality:"reliable"});
      }
      return result;
    }
    unpackLegacy(payload) {
      const result = new Map();
      if (payload?.storageVersion !== LEGACY_STORAGE_VERSION ||
          payload.algorithmVersion !== LEGACY_ALGORITHM_VERSION ||
          payload.numPages !== this.count || !Array.isArray(payload.pages)) return result;
      // The legacy key may end with -size-mtime, which must not invalidate v1.
      if (payload.key !== this.key && !new RegExp("^" + this.key + "-[0-9]+-[0-9]+$").test(payload.key)) return result;
      for (const entry of payload.pages) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [p, r] = entry;
        if (!Number.isSafeInteger(p) || p < 1 || p > this.count ||
            !finite(r?.width) || !finite(r?.height) ||
            !validBox(r.raw, r.width, r.height)) continue;
        // Legacy errors were persisted as fallback without a reason field.
        // Cannot tell deliberate whole-page fallback from render failure: retry only these.
        if (r.quality !== "reliable") continue;
        // v0.1.7 did not separate scanner-bed streaks from real page ink.
        // Migrate ordinary clean pages without rendering, but re-evaluate only
        // raster pages whose cached boundary touches the physical paper rim.
        // Otherwise this fix would be invisible on the user's old cached PDFs.
        const rim=Math.max(8,Math.min(r.width,r.height)*.025);
        if (r.fastPath !== true && (r.raw[0]<rim || r.raw[1]<rim ||
            r.raw[2]>r.width-rim || r.raw[3]>r.height-rim)) continue;
        result.set(p, {raw:[...fitBox(r)], quality:"reliable"});
      }
      return result;
    }
    async load() {
      if (!this.file) return new Map();
      try {
        const saved = await this.io.readJSON(this.file);
        if (saved?.key === this.key && saved?.algorithmVersion > this.version &&
            saved?.storageVersion == null) {
          this.readOnly = true; // do not overwrite a cache made by a newer plugin
          return new Map();
        }
        if (saved?.algorithmVersion === this.version && saved?.storageVersion == null)
          return this.unpack(saved);
        const migrated = this.unpackLegacy(saved);
        if (migrated.size) { this.schedule(migrated); return migrated; }
      } catch (_) { /* no current-format file */ }
      // One-time legacy migration; never enumerate directories during ordinary cache hits.
      if (typeof this.io.getChildren !== "function") return new Map();
      try {
        const children = await this.io.getChildren(this.directory);
        const files = children.filter(f => typeof f === "string" &&
          (f === this.file || (f.startsWith(this.path.join(this.directory, this.key + "-")) &&
            /-[0-9]+-[0-9]+\.json$/.test(f))));
        for (const file of files) {
          try {
            const migrated = this.unpackLegacy(await this.io.readJSON(file));
            if (!migrated.size) continue;
            this.schedule(migrated);
            return migrated;
          } catch (_) { /* try next legacy candidate */ }
        }
      } catch (_) { /* no legacy directory */ }
      return new Map();
    }
    pack(cache) {
      const pages = {};
      for (const [p, r] of cache) {
        const box = fitBox(r);
        if (Number.isSafeInteger(p) && p >= 1 && p <= this.count &&
            validBox(box) && r?.reason !== "render-failed" && r?.reason !== "invalid-input")
          pages[p] = [...box];
      }
      return {algorithmVersion:this.version,key:this.key,numPages:this.count,pages};
    }
    schedulePage(p, r) {
      const box = fitBox(r);
      if (this.readOnly || !this.file || !Number.isSafeInteger(p) || p < 1 || p > this.count ||
          !validBox(box) || r?.reason === "render-failed" || r?.reason === "invalid-input") return;
      this.dirty.set(p, [...box]);
      if (this.dirty.size >= BATCH_PAGES) { this.flush().catch(()=>{}); return; }
      if (!this.timer) this.timer = this.timers.setTimeout(() => {
        this.timer = null; this.flush().catch(()=>{});
      }, FLUSH_MS);
    }
    schedule(cache) {
      if (!this.file || this.readOnly) return;
      for (const [p, r] of cache) this.schedulePage(p,r);
    }
    async flush() {
      if (this.timer) { this.timers.clearTimeout(this.timer); this.timer = null; }
      if (this.readOnly || !this.file || !this.dirty.size) return this.writing;
      const changed = new Map(this.dirty); this.dirty.clear();
      const previous = WRITE_QUEUE.get(this.file) || Promise.resolve();
      const task = previous.catch(()=>{}).then(async () => {
        await this.io.makeDirectory(this.directory,{createAncestors:true});
        let prior = new Map();
        try {
          const saved = await this.io.readJSON(this.file);
          if (saved?.algorithmVersion > this.version && saved?.storageVersion == null) {
            this.readOnly = true;
            return; // another instance produced a future cache; never overwrite it
          }
          prior = this.unpack(saved);
        } catch (_) { /* first write */ }
        for (const [p, raw] of changed) prior.set(p, {raw,quality:"reliable"});
        await this.io.writeJSON(this.file,this.pack(prior));
      });
      WRITE_QUEUE.set(this.file,task);
      task.finally(()=>{if(WRITE_QUEUE.get(this.file)===task)WRITE_QUEUE.delete(this.file);}).catch(()=>{});
      this.writing = task;
      return task;
    }
    close() { return this.flush().catch(()=>{}); }
  }
  return {ALGORITHM_VERSION,BATCH_PAGES,FLUSH_MS,validBox,cacheKey,Store};
})();
if (typeof module !== "undefined") module.exports = MarginFitPersistentCache;
