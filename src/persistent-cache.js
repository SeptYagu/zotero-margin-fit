/* Append-only, profile-local PDF boundaries; each page stores four coordinates. */
"use strict";
var MarginFitPersistentCache = (() => {
  // Cache compatibility is independent of plugin releases.
  const ALGORITHM_VERSION = 1;
  const BATCH_PAGES = 10, FLUSH_MS = 10000, WRITE_QUEUE = new Map();
  const finite = n => typeof n === "number" && Number.isFinite(n);
  function validBox(b, w = Infinity, h = Infinity) {
    return Array.isArray(b) && b.length === 4 && b.every(finite) &&
      b[0] >= 0 && b[1] >= 0 && b[2] > b[0] && b[3] > b[1] &&
      b[2] <= w + .01 && b[3] <= h + .01;
  }
  function fitBox(record) {
    const raw = Array.isArray(record) ? record : record?.raw;
    if (!validBox(raw, record?.width, record?.height)) return raw;
    const body = record?.widthFitRaw;
    // Preserve the far-away folio Width Fit exception, but never lose Y ink.
    return validBox(body,record.width,record.height) &&
      body[0] >= raw[0] && body[2] <= raw[2] &&
      Math.abs(body[1]-raw[1]) < .01 && Math.abs(body[3]-raw[3]) < .01
      ? [body[0],raw[1],body[2],raw[3]] : raw;
  }
  function cacheKey(fingerprints, count) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 100000 ||
        !fingerprints || typeof fingerprints.length !== "number") return null;
    const a = Array.from(fingerprints).filter(x => x != null);
    if (a.length < 1 || a.length > 2 ||
        a.some(x => typeof x !== "string" || !/^[a-f0-9]{16,64}$/i.test(x))) return null;
    return a.map(x=>x.toLowerCase()).join("-") + "-" + count;
  }
  class Store {
    constructor({io,path,timers,fingerprints,count,version=ALGORITHM_VERSION}) {
      this.io=io;this.path=path;this.timers=timers;this.count=count;
      this.version=version;this.key=cacheKey(fingerprints,count);
      this.directory=path.join(path.profileDir,"marginfit-boundaries");
      this.file=this.key ? path.join(this.directory,this.key+".jsonl") : null;
      this.dirty=new Map();this.timer=null;this.writing=Promise.resolve();
      this.initialized=false;this.separator="";this.readOnly=false;
    }
    header() { return {algorithmVersion:this.version,key:this.key,numPages:this.count}; }
    async load() {
      if (!this.file || this.readOnly) return new Map();
      try {
        if (!await this.io.exists(this.file)) {this.initialized=false;return new Map();}
        const content=await this.io.readUTF8(this.file);
        const lines=content.split("\n"), header=JSON.parse(lines[0]);
        if (header.algorithmVersion!==this.version || header.key!==this.key ||
            header.numPages!==this.count) {this.readOnly=true;return new Map();}
        const result=new Map();
        // A line without a terminating newline may have been interrupted: ignore it.
        const last=content.endsWith("\n") ? lines.length-1 : lines.length-1;
        for(let i=1;i<last;i++) {
          try {
            const row=JSON.parse(lines[i].trim());
            if (Array.isArray(row) && row.length===5 && Number.isSafeInteger(row[0]) &&
                row[0]>=1 && row[0]<=this.count && validBox(row.slice(1)))
              result.set(row[0],{raw:row.slice(1),quality:"reliable"});
          } catch (_) { /* invalid/interrupted line, subsequent complete lines remain valid */ }
        }
        this.separator=content.endsWith("\n") ? "" : "\n";
        this.initialized=true;
        return result;
      } catch (_) {
        // Not-found was handled above. Never overwrite an unreadable existing file.
        this.readOnly=true;
        return new Map();
      }
    }
    armTimer() {
      if (!this.timer) this.timer=this.timers.setTimeout(()=>{
        this.timer=null;this.flush().catch(()=>{});
      },FLUSH_MS);
    }
    schedulePage(p,r) {
      const box=fitBox(r);
      if (this.readOnly || !this.file || !Number.isSafeInteger(p) ||
          p<1 || p>this.count || !validBox(box) ||
          r?.reason==="render-failed" || r?.reason==="invalid-input") return;
      this.dirty.set(p,[...box]);
      if(this.dirty.size>=BATCH_PAGES) this.flush().catch(()=>{});
      else this.armTimer();
    }
    schedule(cache) { if(cache) for(const [p,r] of cache) this.schedulePage(p,r); }
    async flush() {
      if(this.timer){this.timers.clearTimeout(this.timer);this.timer=null;}
      if(this.readOnly || !this.file || !this.dirty.size) return this.writing;
      const changed=new Map(this.dirty);this.dirty.clear();
      const previous=WRITE_QUEUE.get(this.file)||Promise.resolve();
      const task=previous.catch(()=>{}).then(async()=>{
        await this.io.makeDirectory(this.directory,{createAncestors:true});
        if(!this.initialized) await this.load(); // one validation, not one read per append
        if(this.readOnly) return;
        const lines=Array.from(changed,([p,b])=>JSON.stringify([p,...b])+"\n").join("");
        if(!this.initialized) {
          await this.io.writeUTF8(this.file,JSON.stringify(this.header())+"\n"+lines,{mode:"create"});
          this.initialized=true;
        } else {
          await this.io.writeUTF8(this.file,this.separator+lines,{mode:"appendOrCreate"});
          this.separator="";
        }
      }).catch(error=>{
        // Reinspect the tail after an interrupted append before the next attempt.
        this.initialized=false;
        if(!this.readOnly) {
          for(const [p,b] of changed) if(!this.dirty.has(p)) this.dirty.set(p,b);
          this.armTimer();
        }
        throw error;
      });
      WRITE_QUEUE.set(this.file,task);
      task.finally(()=>{if(WRITE_QUEUE.get(this.file)===task) WRITE_QUEUE.delete(this.file);}).catch(()=>{});
      this.writing=task;
      return task;
    }
    close(){return this.flush().catch(()=>{});}
  }
  return {ALGORITHM_VERSION,BATCH_PAGES,FLUSH_MS,validBox,fitBox,cacheKey,Store};
})();
if(typeof module!=="undefined")module.exports=MarginFitPersistentCache;
