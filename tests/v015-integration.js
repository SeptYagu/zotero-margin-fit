/* 0.1.4 dedicated fast-path and disk-cache end-to-end checks. */
const checks=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
function startup(){
 if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish({passed:false,error:String(e),stack:e.stack}));
}
async function finish(result){
 await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),
  {version:Zotero.version,checks,measurements:{},...result});
 Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}
async function until(fn,label) {
 for(let i=0;i<250;i++){if(await fn())return;await sleep(90);}
 throw Error('Timeout '+label);
}
async function open(name,item){
 if(!item){const path=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),name);
   item=await Zotero.Attachments.importFromFile({file:path});}
 const reader=await Zotero.Reader.open(item.id);
 await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView),'controller');
 return {item,reader,c:Zotero.MarginFit.controllers.get(reader._internalReader._primaryView)};
}
async function run(){
 let saved;
 try{
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  file.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
  await (await AddonManager.getInstallForFile(file)).install();
  const plugin=Zotero.MarginFit;
  assert(plugin.cacheModule,'cache module installed');
  assert(plugin.cacheIO,'profile cache IO interfaces available');

  const pure=await open('pure-text.pdf');
  await until(()=>pure.c.session.models,'pure L1');
  const p=await pure.c.session.serial(()=>pure.c.session.read(1,0));
  assert(p?.quality==='reliable','pure text provides reliable bounds');
  assert(p.fastPath===true && p.rasterBytes===0,'text-only PDF skips offscreen raster');
  const vector=await open('wide-figure.pdf');
  await until(()=>vector.c.session.cache.has(1),'vector L1');
  assert(!vector.c.session.cache.get(1).fastPath,'vector page still rasters to keep graphic');
  const scan=await open('clean-scan.pdf');
  await until(()=>scan.c.session.cache.has(1),'scan L1');
  assert(!scan.c.session.cache.get(1).fastPath,'scan page still rasters');
  const paperPath=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'attention-is-all-you-need.pdf');
  if(await IOUtils.exists(paperPath)){
   const paper=await open('attention-is-all-you-need.pdf');
   const measured=await paper.c.session.serial(()=>paper.c.session.read(1,0));
   assert(!measured.fastPath,'real paper with vector figures must raster');
  }

  const numbered=await open('pure-folio.pdf');
  await until(()=>numbered.c.session.models,'folio L1');
  assert(!!numbered.c.session.folioPattern,'L1 recognizes repeated numbered footer without extra scans');
  const nr=await numbered.c.session.serial(()=>numbered.c.session.read(8,0));
  assert(nr.folio && nr.folio.body[3]<nr.raw[3],
    'high-confidence folio has a separately preserved body fitting box');
  const folioTarget=numbered.c.page();
  const folioExact=await numbered.c.session.serial(()=>numbered.c.session.read(folioTarget,0));
  assert(folioExact.folio?.ordinal===folioTarget,'current page folio is exact and matches sequence');
  await numbered.c.request('height');
  const folioScale=numbered.c.viewer.currentScale;
  const folioModel=numbered.c.session.folioPattern;
  numbered.c.session.folioPattern=null;
  await numbered.c.request('height');
  const fullScale=numbered.c.viewer.currentScale;
  assert(folioScale>fullScale*1.1,
    'actual native PDF.js Fit Height is tighter when page number is excluded');
  numbered.c.session.folioPattern=folioModel;
  const years=await open('edge-year.pdf');
  await until(()=>years.c.session.models,'constant year L1');
  assert(years.c.session.folioPattern===null,'constant footer year is not excluded');
  const book=await open('asymmetric-book.pdf');
  await until(()=>book.c.session.models,'book L1');
  assert(book.c.session.metrics.analyzed.length>=6,'first open detects L1');
  const store=book.c.session.store;
  assert(!!store?.file,'disk store has fingerprint path');
  await store.flush();
  assert(await IOUtils.exists(store.file),'absolute bound cache saved on disk');
  saved={file:store.file,initialSamples:book.c.session.metrics.analyzed.length,
    fingerprint:Array.from(book.c.app.pdfDocument.fingerprints, x => x == null ? null : String(x)),
    readerItemID:book.reader._itemID ?? book.reader.itemID ?? null,
    attachmentID:book.item.id};
  book.reader.close();
  await until(()=>book.c.closed,'reader disposed');
  const again=await open('asymmetric-book.pdf',book.item);
  await until(()=>again.c.session.models,'reopen L1');
  assert(again.c.session.metrics.analyzed.length===0,'reopen uses cached L1 without re-render');
  assert(again.c.session.metrics.cacheHits>=6,'reopen records L1 cache hits');
  assert(again.c.session.cache.get(5)?.raw[0]>again.c.session.cache.get(6)?.raw[0],'parity geometry retained');
  saved.reopenAnalyzed=again.c.session.metrics.analyzed.length;
  saved.reopenCacheHits=again.c.session.metrics.cacheHits;
  await finish({passed:true,details:saved});
 }catch(e){await finish({passed:false,error:String(e),stack:e.stack,details:saved});}
}
