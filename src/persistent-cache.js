/* Profile-local cache for compact, validated PDF boundary records. No PDF bytes stored. */
"use strict";
var MarginFitPersistentCache = (() => {
  const STORAGE_VERSION = 2; // P1-C adds validated folio metadata for pure-text pages.
  const MAX_RECORDS = 3000;
  // One in-process queue per cache file: parallel Zotero reader instances merge safely.
  const WRITE_QUEUE = new Map();
  const validNumber = x => typeof x === "number" && Number.isFinite(x);
  function validBox(box,width,height) {
    return Array.isArray(box) && box.length===4 && box.every(validNumber) &&
      box[0]>=0 && box[1]>=0 && box[2]>box[0] && box[3]>box[1] &&
      box[2]<=width+.01 && box[3]<=height+.01;
  }
  function validFolio(f,r) {
    return f && r.fastPath===true && r.quality==='reliable' &&
      Number.isSafeInteger(f.ordinal) && f.ordinal>=0 && f.ordinal<=9999 &&
      (f.edge==='top'||f.edge==='bottom') &&
      validBox(f.box,r.width,r.height) && validBox(f.body,r.width,r.height);
  }
  function validRecord(r, version) {
    return !!r && r.version === version && ["reliable","fallback"].includes(r.quality) &&
      validNumber(r.width) && r.width > 0 && validNumber(r.height) && r.height > 0 &&
      [0,90,180,270].includes(r.rotation) && [0,90,180,270].includes(r.viewerRotation) &&
      Array.isArray(r.raw) && r.raw.length === 4 && r.raw.every(validNumber) &&
      r.raw[0] >= 0 && r.raw[1] >= 0 && r.raw[2] > r.raw[0] && r.raw[3] > r.raw[1] &&
      r.raw[2] <= r.width + 0.01 && r.raw[3] <= r.height + 0.01 &&
      (r.folio == null || validFolio(r.folio,r));
  }
  function cacheKey(fingerprints, count, fileStamp = null) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 100000 ||
      !fingerprints || typeof fingerprints.length !== "number") return null;
    const parts = Array.from(fingerprints).filter(x => x != null);
    if (!parts.length || parts.length > 2 ||
      parts.some(x => typeof x !== "string" || !/^[a-f0-9]{16,64}$/i.test(x))) return null;
    const base = parts.map(x => x.toLowerCase()).join("-") + "-" + count;
    return (typeof fileStamp === 'string' && /^\d{1,16}-\d{1,16}$/.test(fileStamp))
      ? base + '-' + fileStamp : base;
  }
  class Store {
    constructor({ io, path, timers, fingerprints, count, version, fileStamp = null }) {
      this.io=io;this.path=path;this.timers=timers;this.count=count;this.version=version;
      this.key=cacheKey(fingerprints,count,fileStamp);
      this.directory=path.join(path.profileDir,"marginfit-boundaries");
      this.file=this.key ? path.join(this.directory,this.key+".json") : null;
      this.dirty=new Map();this.timer=null;this.writing=Promise.resolve();
    }
    unpack(payload) {
      const result=new Map();
      if (!payload || payload.storageVersion !== STORAGE_VERSION ||
        payload.algorithmVersion !== this.version || payload.key !== this.key ||
        payload.numPages !== this.count || !Array.isArray(payload.pages) ||
        payload.pages.length > MAX_RECORDS) return result;
      for(const [p,r] of payload.pages) {
        if(Number.isSafeInteger(p) && p>=1 && p<=this.count && validRecord(r,this.version))
          result.set(p,r);
      }
      return result;
    }
    async load() {
      if(!this.file) return new Map();
      try {return this.unpack(await this.io.readJSON(this.file));}
      catch (_) {return new Map();}
    }
    pack(cache) {
      const pages=[];
      for(const [p,r] of cache) if(pages.length < MAX_RECORDS &&
        Number.isSafeInteger(p) && p>=1 && p<=this.count && validRecord(r,this.version)) {
        const {raw,width,height,rotation,viewerRotation,quality,version}=r;
        const summary={raw:[...raw],width,height,rotation,viewerRotation,quality,version};
        if(r.fastPath===true)summary.fastPath=true;
        if(r.fastPath===true && r.folio)summary.folio={...r.folio,box:[...r.folio.box],body:[...r.folio.body]};
        pages.push([p,summary]);
      }
      return {storageVersion:STORAGE_VERSION,algorithmVersion:this.version,
        key:this.key,numPages:this.count,pages};
    }

    schedulePage(p, record) {
      if(!this.file || !Number.isSafeInteger(p) || p<1 || p>this.count ||
        !validRecord(record,this.version)) return;
      // Constant work per new page. The full snapshot is built only on flush.
      this.dirty.set(p,record);
      this.armWrite();
    }
    // Compatibility helper for callers importing an existing map (not the hot path).
    schedule(cache) {
      if(!this.file)return;
      for(const [p,r] of cache) if(Number.isSafeInteger(p) && p>=1 && p<=this.count &&
        validRecord(r,this.version)) this.dirty.set(p,r);
      this.armWrite();
    }
    armWrite() {
      if(this.timer)this.timers.clearTimeout(this.timer);
      this.timer=this.timers.setTimeout(()=>{this.timer=null;this.flush().catch(()=>{});},1200);
    }
    async flush() {
      if(this.timer){this.timers.clearTimeout(this.timer);this.timer=null;}
      if(!this.dirty.size || !this.file) return this.writing;
      const changed=new Map(this.dirty);
      this.dirty.clear();
      const previous=WRITE_QUEUE.get(this.file)||Promise.resolve();
      // Queue the read/merge/write transaction after all other reader instances.
      const task=previous.catch(()=>{}).then(async()=>{
        await this.io.makeDirectory(this.directory,{createAncestors:true});
        let prior;
        try{prior=this.unpack(await this.io.readJSON(this.file));}catch(_){prior=new Map();}
        for(const [p,r] of changed) {
          prior.delete(p); // refresh insertion order for the bounded recent-page cache
          prior.set(p,r);
        }
        const recent=prior.size>MAX_RECORDS
          ?new Map([...prior].slice(-MAX_RECORDS)):prior;
        await this.io.writeJSON(this.file,this.pack(recent));
      });
      WRITE_QUEUE.set(this.file,task);
      task.finally(()=>{if(WRITE_QUEUE.get(this.file)===task)WRITE_QUEUE.delete(this.file);}).catch(()=>{});
      this.writing=task;
      return task;
    }
    close() {return this.flush().catch(()=>{});}
  }
  return {STORAGE_VERSION,MAX_RECORDS,validRecord,cacheKey,Store};
})();
if(typeof module !== "undefined")module.exports=MarginFitPersistentCache;
