/* Profile-local cache for compact, validated PDF boundary records. No PDF bytes stored. */
"use strict";
var MarginFitPersistentCache = (() => {
  const STORAGE_VERSION = 1;
  const MAX_RECORDS = 3000;
  const validNumber = x => typeof x === "number" && Number.isFinite(x);
  function validRecord(r, version) {
    return !!r && r.version === version && ["reliable","fallback"].includes(r.quality) &&
      validNumber(r.width) && r.width > 0 && validNumber(r.height) && r.height > 0 &&
      [0,90,180,270].includes(r.rotation) && [0,90,180,270].includes(r.viewerRotation) &&
      Array.isArray(r.raw) && r.raw.length === 4 && r.raw.every(validNumber) &&
      r.raw[0] >= 0 && r.raw[1] >= 0 && r.raw[2] > r.raw[0] && r.raw[3] > r.raw[1] &&
      r.raw[2] <= r.width + 0.01 && r.raw[3] <= r.height + 0.01;
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
      this.pending=null;this.timer=null;this.writing=Promise.resolve();
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
        pages.push([p,{raw:[...raw],width,height,rotation,viewerRotation,quality,version}]);
      }
      return {storageVersion:STORAGE_VERSION,algorithmVersion:this.version,
        key:this.key,numPages:this.count,pages};
    }

    schedule(cache) {
      if(!this.file)return;
      this.pending=this.pack(cache);
      if(this.timer)this.timers.clearTimeout(this.timer);
      this.timer=this.timers.setTimeout(()=>{this.timer=null;this.flush().catch(()=>{});},1200);
    }
    async flush() {
      if(this.timer){this.timers.clearTimeout(this.timer);this.timer=null;}
      const payload=this.pending;
      if(!payload || !this.file)return this.writing;
      this.pending=null;
      this.writing=this.writing.catch(()=>{}).then(async()=>{
        await this.io.makeDirectory(this.directory,{createAncestors:true});
        // Merge other concurrent reader instances' records instead of dropping them.
        let prior;
        try{prior=this.unpack(await this.io.readJSON(this.file));}catch(_){prior=new Map();}
        for(const [p,r] of payload.pages)prior.set(p,r);
        await this.io.writeJSON(this.file,this.pack(prior));
      });
      return this.writing;
    }
    close(cache) {
      if(this.pending)this.pending=this.pack(cache);
      return this.flush().catch(()=>{});
    }
  }
  return {STORAGE_VERSION,MAX_RECORDS,validRecord,cacheKey,Store};
})();
if(typeof module !== "undefined")module.exports=MarginFitPersistentCache;
