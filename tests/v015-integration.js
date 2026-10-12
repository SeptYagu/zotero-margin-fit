/* 0.1.4 dedicated fast-path and disk-cache end-to-end checks. */
const checks=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jsonlCache(file) {
 const [header,...rows]=(await IOUtils.readUTF8(file)).trimEnd().split(String.fromCharCode(10))
  .map(line=>JSON.parse(line));
 return {...header,pages:Object.fromEntries(rows.map(([p,...box])=>[p,box]))};
}
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
  await until(()=>pure.c.session.cache.has(1),'pure text current-page detection');
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
  await until(()=>numbered.c.session.folioPattern,'adaptive folio validation');
  assert(!!numbered.c.session.folioPattern && numbered.c.session.metrics.folioEarlyStops>=1,
    'adaptive folio sampling confirms four matching pages then stops early');
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
  assert(Math.abs(folioScale/fullScale-1)<.05, // viewport layout and scrollbars can change
    'v0.1.6 retains the numbered footer in native Height Fit: '+folioScale+' vs '+fullScale);
  numbered.c.session.folioPattern=folioModel;
  await numbered.c.session.store.flush();
  const numberedDisk=await jsonlCache(numbered.c.session.store.file);
  const numberedBox=numberedDisk.pages[String(folioTarget)];
  assert(Array.isArray(numberedBox) && numberedBox.length===4 &&
    Math.abs(numberedBox[0]-folioExact.folio.body[0])<.01 &&
    Math.abs(numberedBox[2]-folioExact.folio.body[2])<.01 &&
    Math.abs(numberedBox[1]-folioExact.raw[1])<.01 &&
    Math.abs(numberedBox[3]-folioExact.raw[3])<.01,
    'verified pure-text folio exclusion also persists body width and full height');
  const synthetic=await open('mixed-folio-score.pdf');
  // Without a current folio candidate, distant score pages are no longer
  // eagerly rendered; request this specific page for its independent geometry test.
  const mr=await synthetic.c.session.serial(()=>synthetic.c.session.read(5,0));
  assert(mr.boundsKind==='estimated' && mr.samplingRate<=.255,
    'music-theory surrogate uses one-in-four diagonal sampling');
  assert(mr.widthFitRaw && mr.widthFitRaw[0]>mr.raw[0]+25 &&
    mr.widthFitRaw[3]===mr.raw[3],
    'mixed page removes isolated left footer from width only, preserves chapter/footer height');
  synthetic.c.viewer.currentPageNumber=5;
  await until(()=>synthetic.c.page()===5,'visible synthetic page 5');
  // Native pagechanging/scroll events must finish before comparing two explicit fits.
  await sleep(500);
  await synthetic.c.request('width');
  const widthScale=synthetic.c.viewer.currentScale;
  const backup=mr.widthFitRaw;
  delete mr.widthFitRaw;
  await synthetic.c.request('width');
  assert(widthScale>synthetic.c.viewer.currentScale*1.08,
    'true Zotero width fit enlarges staff body after excluding isolated left folio');
  mr.widthFitRaw=backup;
  await synthetic.c.session.store.flush();
  const bodyCache=await jsonlCache(synthetic.c.session.store.file);
  const optimized=bodyCache.pages['5'];
  assert(Array.isArray(optimized) && optimized.length===4 &&
    Math.abs(optimized[0]-backup[0])<.01 && Math.abs(optimized[2]-backup[2])<.01 &&
    Math.abs(optimized[1]-mr.raw[1])<.01 && Math.abs(optimized[3]-mr.raw[3])<.01,
    'special Width Fit saves body X plus complete page-height Y as four coordinates');
  synthetic.reader.close();
  await until(()=>synthetic.c.closed,'synthetic reader disposed');
  const reopenedScore=await open('mixed-folio-score.pdf');
  await reopenedScore.c.session.ready;
  assert(reopenedScore.c.session.cache.get(5)?.raw?.[0]===optimized[0],
    'reopened score hydrates the previously excluded far-left page number');
  reopenedScore.c.viewer.currentPageNumber=5;
  await until(()=>reopenedScore.c.page()===5,'reopened score visible page');
  await sleep(500);
  await reopenedScore.c.request('width');
  assert(Math.abs(reopenedScore.c.viewer.currentScale/widthScale-1)<.015,
    'reopened Width Fit preserves original staff-body enlargement without rerendering');
  const years=await open('edge-year.pdf');
  await until(()=>years.c.prefetchedEpoch===years.c.epoch,'constant year validated or skipped');
  assert(years.c.session.folioPattern===null,'constant footer year is not excluded');
  const book=await open('asymmetric-book.pdf');
  await until(()=>book.c.prefetchedEpoch===book.c.epoch,'book immediate-neighbor prefetch');
  assert(book.c.session.metrics.folioSkipped>=1 &&
    [5,6,11,12,17,18].every(p=>!book.c.session.cache.has(p)),
    'graphic book detects nearby pages but skips all distant L1 samples');
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
  await until(()=>again.c.prefetchedEpoch===again.c.epoch,'reopen immediate-neighbor cache');
  assert([1,2].every(p=>!again.c.session.metrics.analyzed.includes(p)),
    'reopen reuses persisted current and adjacent page boundaries');
  assert(again.c.session.metrics.cacheHits>=2,'reopen records current and neighbor cache hits');
  assert(again.c.session.cache.get(1)?.raw && again.c.session.cache.get(2)?.raw,
    'current and neighbor geometry retained');
  saved.reopenAnalyzed=again.c.session.metrics.analyzed.length;
  saved.reopenCacheHits=again.c.session.metrics.cacheHits;
  await finish({passed:true,details:saved});
 }catch(e){await finish({passed:false,error:String(e),stack:e.stack,details:saved});}
}
