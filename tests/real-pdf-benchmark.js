/* Real-library A/B benchmark. Executes ONLY in a disposable Zotero integration profile.
 * Source PDF files are read via importFromFile (copied into disposable dataDir).
 * Writes results to the ignored .test-harness directory, never to original PDFs.
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const PREF='marginfit.integrationProfile';
const rows=[];
let label='unknown';
let progressPath;
async function until(fn,ms=30000) {
 const deadline=Date.now()+ms;
 while(Date.now()<deadline) {
  try {if(await fn())return true;} catch(_){}
  await sleep(80);
 }
 return false;
}
function ctrl(reader) {return Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView);}
function measures(c){
 const records=[...c.session.cache.entries()].filter(([p,r])=>r && r.version).map(([p,r])=>({
   p, quality:r.quality, rotation:r.rotation, kind:r.boundsKind||null,
   raw:r.raw?Array.from(r.raw):null, widthFitRaw:r.widthFitRaw?Array.from(r.widthFitRaw):null,
   width:r.width,height:r.height,ms:r.elapsedMs||0,fast:!!r.fastPath,reason:r.reason||null
 }));
 const mt=c.session.metrics;
 return {
   analyzed:Array.from(mt.analyzed),uniqueAnalyzed:new Set(mt.analyzed).size,
   detectedElapsedMs:Math.round(records.reduce((s,r)=>s+r.ms,0)),
   cacheHits:mt.cacheHits,peakConcurrent:mt.peakConcurrent,
   prefetchedRenders:mt.prefetchedRenders??null, prefetchHits:mt.prefetchHits??null,
   folioSkipped:mt.folioSkipped??null,folioValidationRenders:mt.folioValidationRenders??null,
   folioEarlyStops:mt.folioEarlyStops??null,
   exactRecords:records
 };
}
async function finish(body) {
 try {await IOUtils.writeJSON(progressPath,{label,rows,...body});}catch(_){}
 Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}
function startup(){
 if (!Services.prefs.getBoolPref(PREF,false)) return;
 Zotero.uiReadyPromise.then(run).catch(async error=>{
  try {await finish({passed:false,error:String(error),stack:error.stack,measurements:{}});}catch(_){}
 });
}
async function run(){
 const errors=[];
 let addon;
 try {
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
  const manifestPath=Services.prefs.getStringPref('marginfit.benchmarkManifest');
  label=Services.prefs.getStringPref('marginfit.benchmarkLabel','unknown');
  progressPath=Services.prefs.getStringPref('marginfit.integrationResult');
  const manifest=await IOUtils.readJSON(manifestPath);
  if(!Array.isArray(manifest.selection)||manifest.selection.length<1)throw Error('empty manifest');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const f=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  f.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
  addon=await AddonManager.getInstallForFile(f);
  await addon.install();
  const installed=await AddonManager.getAddonByID('marginfit@septyagu.local');
  if(!installed?.isActive)throw Error('plugin not installed');
  await until(()=>Zotero.MarginFit,10000);
  for(const entry of manifest.selection) {
    const row={id:entry.id,source:entry.source,kind:entry.kind,pages:entry.pages,
      bytes:entry.bytes,initialPage:Math.min(8,entry.pages),status:'pending'};
    let reader,attached;
    try {
      const tImport=Date.now();
      const item=await Zotero.Attachments.importFromFile({file:entry.path});
      row.importMs=Date.now()-tImport;
      const tOpen=Date.now();
      const page=row.initialPage;
      reader=await Zotero.Reader.open(item.id,{position:{pageIndex:page-1,rects:[[200,390,220,410]]}});
      if(!await until(()=>ctrl(reader),25000))throw Error('controller attach timeout');
      const c=ctrl(reader);attached=c;
      row.attachMs=Date.now()-tOpen;
      // Detection is an objective readiness marker. A correctly fitted cover
      // may need NO zoom or scroll writes; treating that as a 45s failure
      // would bias results against the optimized no-op suppression.
      const firstReady=await until(()=>c.session.cache.has(page),30000);
      row.firstGeometryMs=firstReady ? Date.now()-tOpen : null;
      row.requestedPage=page;
      row.targetPage=c.page();
      row.backgroundSettled=await until(()=>c.prefetchedEpoch===c.epoch,25000);
      if(!row.backgroundSettled)await sleep(300);
      row.initial=measures(c);
      row.initialWallMs=Date.now()-tOpen;
      row.firstFitWrites=c.metrics.writes.length;
      row.firstFitType=c.metrics.writes.length?'applied':'no-op-or-deferred';
      row.initialScale=c.viewer.currentScale;
      row.holdPage=c.userHeldPage;
      row.manual=c.manual;
      row.nav=[];
      for(const next of [page+1,page+2,page+3].filter(n=>n<=entry.pages)){
        const start=Date.now();
        const prev=c.metrics.writes.length;
        c.viewer.currentPageNumber=next;
        const inPage=await until(()=>c.page()===next,8000);
        const measured=await until(()=>c.session.cache.has(next),25000);
        const msToCache=measured?Date.now()-start:null;
        const settled=await until(()=>c.prefetchedEpoch===c.epoch,18000);
        row.nav.push({page:next,visible:inPage,measured,settled,
           msToCache,writes:c.metrics.writes.length-prev,
           latencyMs:Date.now()-start});
      }
      row.final=measures(c);
      row.status='ok';
    }catch(e){
      row.status='error';row.error=String(e);errors.push({id:row.id,error:row.error});
      if(attached)row.final=measures(attached);
    }finally {
      if(reader){try{reader.close();}catch(_){};await sleep(125);}
      rows.push(row);
      try{await IOUtils.writeJSON(progressPath+'.progress',{label,completed:rows.length,total:manifest.selection.length,rows});}catch(_){}
    }
  }
  await finish({passed:true,version:Zotero.version,pluginVersion:installed.version,
    rows,errors,measurements:{completed:rows.length,successes:rows.filter(r=>r.status==='ok').length}});
 }catch(e){await finish({passed:false,error:String(e),stack:e.stack,rows,measurements:{completed:rows.length}});}
}
