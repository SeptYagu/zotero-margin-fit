/* End-to-end new height-content PAGE mode in disposable Zotero profile. */
const checks=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function assert(v,m){if(!v)throw Error(m);checks.push(m);}
async function until(fn,ms=16000){const start=Date.now();while(Date.now()-start<ms){
 try{if(fn())return true;}catch(e){} await sleep(75);
}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish({passed:false,error:String(e),stack:e.stack}));}
async function finish(r){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),
 {checks,measurements:{},...r});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
function geometry(c){
 const p=c.viewer.currentPageNumber,rec=c.session.cache.get(p);
 const rect=c.viewer.getPageView(p-1).div.getBoundingClientRect();
 const viewport=c.container.getBoundingClientRect(),scale=rect.height/rec.height;
 const box=rec.raw;
 return {p,scale,scaleValue:c.viewer.currentScale,
   paperHeight:rect.height,availableHeight:c.container.clientHeight,
   safeTop:rect.top-viewport.top+Math.max(0,box[1]-16)*scale,
   safeBottom:rect.top-viewport.top+Math.min(rec.height,box[3]+16)*scale,
   paperTop:rect.top-viewport.top,paperBottom:rect.bottom-viewport.top,
   pageCountInDOM:c.viewer.viewer.querySelectorAll('.page').length,
   scrollMode:c.viewer.scrollMode};
}
async function run(){
 let reader;
 try{
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const f=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  f.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
  await (await AddonManager.getInstallForFile(f)).install();
  const pdf=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
  const item=await Zotero.Attachments.importFromFile({file:pdf});
  reader=await Zotero.Reader.open(item.id,{position:{pageIndex:7}});
  assert(await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)), 'controller attached');
  const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
  const original=c.viewer.scrollMode;
  await c.request('height');
  assert(c.heightPageMode && c.viewer.scrollMode===3,'native PDF.js one-page mode entered');
  assert(c.viewer.viewer.querySelectorAll('.page').length===1,'one physical PDF page attached');
  await c.navigateTo(8);
  assert(await until(()=>c.session.cache.has(8)&&c.viewer.currentPageNumber===8),'navigated to page 8');
  const first=geometry(c);
  assert(first.safeTop>=-3&&first.safeBottom<=first.availableHeight+3,'page 8 content bounds visible');
  assert(first.paperHeight>first.availableHeight+40,'paper margins are cropped by viewport');
  const beforeDetections=c.session.metrics.analyzed.length;
  const wheel=new c.win.WheelEvent('wheel',Components.utils.cloneInto({deltaY:120,bubbles:true,cancelable:true,deltaMode:0},c.win));
  c.container.dispatchEvent(wheel);
  assert(await until(()=>c.viewer.currentPageNumber===9),'positive mouse wheel turns exactly one page');
  assert(await until(()=>c.appliedEpoch===c.epoch),'page 9 fit done');
  const second=geometry(c);
  assert(second.safeTop>=-3&&second.safeBottom<=second.availableHeight+3,'page 9 content fitted');
  assert(c.viewer.viewer.querySelectorAll('.page').length===1,'new page only in DOM');
  const settledWrites=c.metrics.writes.length;
  await sleep(800);
  assert(c.metrics.writes.length===settledWrites,'cached page turn does not trigger late recenter/zoom writes');
  c.container.dispatchEvent(new c.win.WheelEvent('wheel',Components.utils.cloneInto({deltaY:-120,bubbles:true,cancelable:true},c.win)));
  assert(await until(()=>c.viewer.currentPageNumber===8),'negative wheel returns one page');
  assert(await until(()=>c.appliedEpoch===c.epoch),'return fit done');
  const third=geometry(c);
  assert(third.safeTop>=-3&&third.safeBottom<=third.availableHeight+3,'returned content fitted');
  c.viewer.currentPageNumber=10;
  assert(await until(()=>c.viewer.currentPageNumber===10 && c.appliedEpoch===c.epoch),'native Zotero page number jump aligns content');
  const native=geometry(c);
  assert(native.safeTop>=-3 && native.safeBottom<=native.availableHeight+3,'native jump content correctly centered');
  const fireTrackpad=delta=>c.container.dispatchEvent(new c.win.WheelEvent('wheel',
    Components.utils.cloneInto({deltaY:delta,bubbles:true,cancelable:true,deltaMode:0},c.win)));
  for(let i=0;i<14;i++)fireTrackpad(12);
  assert(await until(()=>c.viewer.currentPageNumber===11),'trackpad burst turns one page');
  await sleep(170);
  assert(c.viewer.currentPageNumber===11,'trackpad inertia does not cascade several pages');
  await sleep(260);
  for(let i=0;i<7;i++)fireTrackpad(12);
  assert(await until(()=>c.viewer.currentPageNumber===12),'new separated trackpad gesture turns another page');
  await c.navigateTo(1);
  const changedSize=geometry(c);
  assert(changedSize.safeTop>=-3&&changedSize.safeBottom<=changedSize.availableHeight+3,'different-content-height page fitted in one navigation');
  // Real PDF.js scalechanging used to leave the viewer with only one mounted page
  // and no wheel-to-next-page navigation while manual zoom was active.
  c.viewer.currentScaleValue=c.viewer.currentScale*1.15;
  assert(await until(()=>!c.heightPageMode && c.viewer.scrollMode===original),
    'manual zoom exits PAGE mode so remaining PDF pages are scrollable');
  assert(c.viewer.viewer.querySelectorAll('.page').length>1,
    'manual zoom restores multi-page DOM rather than locking the document');
  await c.request('height');
  assert(c.heightPageMode && c.viewer.scrollMode===3,
    'explicit Fit Height can reactivate native page-turn mode after manual zoom');
  await c.request('width');
  assert(c.viewer.scrollMode===original && !c.heightPageMode,'Fit Width restores native continuous scrolling');
  assert(c.viewer.viewer.querySelectorAll('.page').length>1,'continuous page DOM restored');
  reader.close();reader=null;
  const blankPath=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'blank.pdf');
  const blankItem=await Zotero.Attachments.importFromFile({file:blankPath});
  reader=await Zotero.Reader.open(blankItem.id,{position:{pageIndex:0}});
  assert(await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)),
    'blank page controller attached');
  const blankC=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
  await blankC.request('height');
  const blank=geometry(blankC);
  assert(blankC.session.cache.get(1)?.quality==='fallback','blank page chooses conservative full-page bounds');
  assert(blank.scrollMode===3 && blank.pageCountInDOM===1,'blank page uses native PAGE mode');
  assert(blank.safeTop>=-3 && blank.safeBottom<=blank.availableHeight+3,
    'height mode fits whole page when margin detection falls back');
  reader.close();reader=null;
  await finish({passed:true,details:{first,second,third,native,changedSize,blank,beforeDetections,
    afterDetections:c.session.metrics.analyzed.length}});
 }catch(e){try{reader?.close();}catch(_){}
  await finish({passed:false,error:String(e),stack:e.stack});}
}
