/* Privileged driver, refuses to run outside its disposable profile. */
const results = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ID = 'marginfit@septyagu.local';
const PREF = 'extensions.marginfit.enabled';
let measurements = {};
function startup() {
  if (!Services.prefs.getBoolPref('marginfit.integrationProfile',false)) return;
  Zotero.uiReadyPromise.then(runTests).catch(error=>finish({passed:false,error:String(error),stack:error.stack}));
}
async function finish(result) {
  await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),
    {version:Zotero.version,checks:results,measurements,...result});
  Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}
function check(condition,message) {
  if (!condition) throw new Error(message);
  results.push(message);
  IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult')+'.progress',{checks:results}).catch(()=>{});
}
async function until(fn,label='condition') {
  for(let i=0;i<200;i++){if(await fn())return;await sleep(100);}
  throw new Error('Timeout: '+label);
}
function control(reader) { return Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView); }
async function open(name,location) {
  const path=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),name);
  const item=await Zotero.Attachments.importFromFile({file:path});
  const reader=await Zotero.Reader.open(item.id,location);
  await until(()=>control(reader),'controller attached');
  return {reader,item,c:control(reader),path};
}
async function runTests() {
  try {
    const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
    const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    file.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
    const installer=await AddonManager.getInstallForFile(file);
    await installer.install();
    const addon=await AddonManager.getAddonByID(ID);
    check(addon?.isActive && addon.isCompatible,'XPI installs on Zotero '+Zotero.version);
    Services.prefs.setBoolPref(PREF,true);
    const started=Date.now();
    const book=await open('asymmetric-book.pdf',{pageIndex:7});
    const {reader,c,item}=book;
    let lastReader=reader;
    const doc=reader._iframeWindow.document;
    await until(()=>c.session.models && c.metrics.writes.some(w=>w.type==='position'),'automatic fitting');
    measurements.firstSmartFitFromImportMs=Date.now()-started;
    measurements.l1DetectionMs=c.session.metrics.l1ElapsedMs;
    check(doc.querySelectorAll('[data-marginfit]').length===2,'Exactly two new controls; native Reset Zoom retained');
    check(doc.getElementById('zoomAuto'),'Original Reset Zoom exists');
    await until(()=>!doc.getElementById('zoomAuto').disabled,'native Reset Zoom enabled');
    check(true,'React enables native Reset Zoom through instance stats callback');
    check(JSON.stringify(c.session.metrics.analyzed.slice(0,6))===JSON.stringify([5,6,11,12,17,18]),'L1 six samples run first without inserting restored current page');
    check(c.metrics.writes[0].page===8,'First fit targets restored page 8');
    await until(()=>c.session.cache.has(8) && c.appliedEpoch>=0,'L2 current page refined');
    const odd=c.session.cache.get(5),even=c.session.cache.get(6);
    check(odd.raw[0]>even.raw[0]+70 && odd.raw[2]>even.raw[2]+70,'Independent left/right detection handles alternating binding margins');
    check(even.raw[1]<150 && even.raw[3]>649,'Four-edge detector includes body and isolated page number');
    check(c.session.metrics.peakConcurrent===1,'L1 and L2 share a single analysis worker');
    measurements.sampleBounds={odd:odd.raw,even:even.raw};
    measurements.detectorMs=[...c.session.cache.values()].map(r=>r.elapsedMs);
    measurements.temporaryRasterBytes=Math.max(...[...c.session.cache.values()].map(r=>r.rasterBytes||0));
    const pdfBefore=await IOUtils.read(await item.getFilePathAsync());
    const scale=c.viewer.currentScale;
    c.viewer.currentScaleValue=scale*0.8;
    await sleep(100);
    doc.getElementById('zoomAuto').click();
    await until(()=>c.viewer.currentScale>scale*0.9,'toolbar smart width');
    check(true,'Native toolbar invokes smart width through PDFView');
    const ireader=reader._internalReader;
    await c.request('height');
    check(c.mode==='height','Added height direction uses detected content height');
    const safeHeight=even.raw[3]-even.raw[1]+16;
    const unit=c.viewer.getPageView(7).viewport.scale/c.viewer.currentScale;
    check(Math.abs(c.viewer.currentScale-(c.container.clientHeight-16)/(safeHeight*unit))<0.03,'Height fitting uses native PDF.js CSS units');
    Services.prefs.setBoolPref(PREF,false);
    ireader.zoomPageWidth();
    check(c.viewer.currentScaleValue==='page-width','Disabled native width restores page-width');
    await until(()=>doc.getElementById('zoomAuto').disabled,'native disabled state restored');
    check(true,'Disabled callback restores native Reset Zoom disabled state');
    ireader.zoomPageHeight();
    check(c.viewer.currentScaleValue==='page-fit','Disabled native height restores page-fit');
    Services.prefs.setBoolPref(PREF,true);
    await until(()=>!c.manual,'re-enabled');
    await c.request('width');
    const baseline=c.metrics.writes.length;
    for(let n=0;n<10;n++) {
      c.container.dispatchEvent(new c.win.WheelEvent('wheel',{deltaY:50,bubbles:true}));
      c.container.scrollTop+=c.viewer.getPageView(c.viewer.currentPageNumber-1).viewport.height+12;
      await sleep(90);
      check(c.metrics.writes.length===baseline,'Continuous scroll '+n+' causes no plugin zoom/position writes');
    }
    await until(()=>c.metrics.writes.length>baseline,'idle refinement after scrolling');
    const once=c.metrics.writes.length;
    await sleep(1000);
    check(c.metrics.writes.length===once,'Plugin own scroll events do not create a fitting loop');
    check(c.page()>=17,'Frozen scrolling crosses ten alternating odd/even pages');
    c.viewer.currentPageNumber=8;
    await until(()=>c.page()===8,'return to page 8');
    await c.request('width');
    const cacheCount=c.session.metrics.analyzed.filter(p=>p===8).length;
    const cachedStarted=Date.now();
    await c.request('height');await c.request('width');
    measurements.twoCachedFitCommandsMs=Date.now()-cachedStarted;
    check(c.session.metrics.analyzed.filter(p=>p===8).length===cacheCount,'Width/height changes reuse exact boundary cache');
    await c.request('height');
    const keyboardBefore=c.metrics.writes.length;
    const keyOptions=new reader._iframeWindow.wrappedJSObject.Object();
    Object.assign(keyOptions,{key:'0',code:'Digit0',keyCode:48,ctrlKey:true,bubbles:true});
    const keyEvent=new reader._iframeWindow.KeyboardEvent('keydown',keyOptions);
    measurements.keyboard={key:keyEvent.key,code:keyEvent.code,ctrlKey:keyEvent.ctrlKey};
    reader._iframeWindow.document.body.dispatchEvent(keyEvent);
    await until(()=>c.mode==='width' && c.metrics.writes.slice(keyboardBefore).some(w=>w.type==='position' && w.explicit),'Ctrl+0 native route');
    check(true,'Ctrl+0 follows native smart-width route and completes positioning');
    const main=Zotero.getMainWindows()[0];
    main.document.getElementById('view-menuitem-zoom-page-height').dispatchEvent(new main.Event('command',{bubbles:true}));
    await until(()=>c.mode==='height','main View menu height');
    main.document.getElementById('view-menuitem-zoom-page-width').dispatchEvent(new main.Event('command',{bubbles:true}));
    await until(()=>c.mode==='width','main View menu width');
    check(true,'Main View menu width/height commands use smart fitting');
    const pdfPage=await c.app.pdfDocument.getPage(8);
    const rawText=await (pdfPage.wrappedJSObject||pdfPage).getTextContent();
    const text=rawText.wrappedJSObject||rawText;
    check(text.items.some(i=>i.str.includes('Body text')),'Native PDF text remains available after fitting');
    await until(()=>c.viewer.getPageView(7).div.querySelector('.textLayer span'),'native text layer');
    const span=[...c.viewer.getPageView(7).div.querySelectorAll('.textLayer span')].find(el=>el.textContent.includes('Body text'));
    const selection=c.win.getSelection(),range=c.win.document.createRange();
    range.selectNodeContents(span);selection.removeAllRanges();selection.addRange(range);
    check(String(selection).includes('Body text'),'Native text-layer selection works after fitting');
    selection.removeAllRanges();
    const annotation=new Zotero.Item('annotation');
    annotation.libraryID=item.libraryID;annotation.parentID=item.id;
    annotation.annotationType='highlight';annotation.annotationText='Body text';
    annotation.annotationComment='MarginFit regression';annotation.annotationColor='#ffd400';
    annotation.annotationPageLabel='8';annotation.annotationSortIndex='00007|000150|00000';
    annotation.annotationPosition=JSON.stringify({pageIndex:7,rects:[[60,610,300,630]]});
    await annotation.saveTx();
    const storedPosition=annotation.annotationPosition;
    await c.request('height');await c.request('width');
    check(annotation.annotationPosition===storedPosition,'Fitting preserves saved highlight PDF coordinates');
    c.viewer.pagesRotation=90;
    await c.request('width');
    check(c.session.cache.get(8).rotation===90,'Manual reader rotation invalidates and remeasures page bounds');
    c.viewer.pagesRotation=0;
    await c.request('width');
    ireader.toggleVerticalSplit(true);
    await until(()=>ireader._secondaryView && Zotero.MarginFit.controllers.has(ireader._secondaryView),'split controller');
    const second=Zotero.MarginFit.controllers.get(ireader._secondaryView);
    await second.session.l1();await sleep(700);
    const primaryScale=c.viewer.currentScale;
    await second.request('height');
    check(second.mode==='height' && c.viewer.currentScale===primaryScale,'Split pane has an independent zoom anchor and direction');
    ireader.disableSplitView();
    await until(()=>second.closed,'split cleanup');
    check(true,'Removing split pane cancels its tasks and restores hooks');
    await c.request('width');
    const detached=await Zotero.Reader.open(item.id,{pageIndex:3},{openInWindow:true,allowDuplicate:true});
    await until(()=>control(detached),'detached controller');
    const dc=control(detached);
    await dc.request('height');
    detached._window.document.getElementById('view-menuitem-zoom-page-width').dispatchEvent(new detached._window.Event('command',{bubbles:true}));
    await until(()=>dc.mode==='width','detached View menu width');
    check(true,'Detached reader window has smart View menu and toolbar');
    detached.close();
    await until(()=>dc.closed,'detached cleanup');
    await c.request('width');
    check(!c.closed,'Closing detached reader keeps original PDF view usable');
    const pdfAfter=await IOUtils.read(await item.getFilePathAsync());
    check(pdfBefore.length===pdfAfter.length && pdfBefore.every((b,i)=>b===pdfAfter[i]),'Reading and fitting leave PDF bytes unchanged');
    const scan=await open('clean-scan.pdf');
    lastReader=scan.reader;
    await until(()=>scan.c.session.cache.has(1),'scan detector');
    const scanBox=scan.c.session.cache.get(1);
    check(scanBox.quality==='reliable' && scanBox.raw[0]<97 && scanBox.raw[0]>90 && scanBox.raw[3]>=678,'Clean scanned page preserves thin isolated page number');
    measurements.scanBounds=scanBox.raw;
    const wide=await open('wide-figure.pdf');
    lastReader=wide.reader;
    await until(()=>wide.c.session.cache.has(1),'wide figure detector');
    await wide.c.request('height');
    check(wide.c.mode==='height' && wide.c.container.scrollWidth>wide.c.container.clientWidth,'Height fit keeps wide content horizontally scrollable');
    const rotation=await open('rotated.pdf');
    lastReader=rotation.reader;
    await until(()=>rotation.c.session.cache.has(1),'rotated page detector');
    check(rotation.c.session.cache.get(1).width===800 && rotation.c.session.cache.get(1).height===600,'Rotated page uses rotated viewport coordinates');
    for(const name of ['blank.pdf','dark-background.pdf']) {
      const f=await open(name);await until(()=>f.c.session.cache.has(1),'fallback detector');
      lastReader=f.reader;
      check(f.c.session.cache.get(1).quality==='fallback',name+' safely falls back');
    }
    const paperPath=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'attention-is-all-you-need.pdf');
    if(await IOUtils.exists(paperPath)) {
      const paper=await open('attention-is-all-you-need.pdf');
      lastReader=paper.reader;
      await until(()=>paper.c.session.cache.has(1),'real paper detection');
      const detected=paper.c.session.cache.get(1);
      check(detected.quality==='reliable','Public arXiv paper with text, formulas and figures detects reliably');
      await paper.c.request('width');await paper.c.request('height');
      measurements.publicPaper={source:'https://arxiv.org/pdf/1706.03762',pages:paper.c.app.pdfDocument.numPages,
        raw:detected.raw,elapsedMs:detected.elapsedMs};
    }
    const finalC=control(lastReader),finalDoc=lastReader._iframeWindow.document;
    const view=finalC.view,wrappedWidth=view.zoomPageWidth,wrappedStats=view._onChangeViewStats;
    await addon.disable();
    await until(()=>!Zotero.MarginFit,'disable cleanup');
    check(!finalDoc.querySelector('.marginfit-toolbar'),'Disable removes toolbar controls and style');
    check(view.zoomPageWidth!==wrappedWidth && view._onChangeViewStats!==wrappedStats,'Disable restores original methods and stats callback');
    view.zoomPageWidth();check(finalC.viewer.currentScaleValue==='page-width','Native width works after disable');
    await addon.enable();
    await until(()=>Zotero.MarginFit?.controllers.size>0,'re-enable discovery');
    check(finalDoc.querySelectorAll('[data-marginfit]').length===2,'Re-enable does not duplicate controls');
    await addon.uninstall();
    check(!Zotero.MarginFit,'Uninstall removes diagnostic reference');
    await finish({passed:true});
  } catch(error) {
    await finish({passed:false,error:String(error),stack:error.stack,
      diagnostics:[...(Zotero.MarginFit?.controllers.values()||[])].map(c=>({
        epoch:c.epoch,lastInput:c.lastInput,now:Date.now(),page:c.lastPage,manual:c.manual,dragging:c.dragging,
        closed:c.closed,metrics:c.metrics,models:c.session.models,cache:[...c.session.cache.entries()]
      })),
      logs:Services.console.getMessageArray().map(m=>m.message).filter(m=>/marginfit|TypeError|ReferenceError/i.test(m)).slice(-20)});
  }
}
