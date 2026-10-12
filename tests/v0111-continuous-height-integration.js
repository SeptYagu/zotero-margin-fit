/* Zotero 10 isolated full-document continuous content-height regression. */
const checks=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function check(value,message){if(!value)throw Error(message);checks.push(message);}
async function until(fn,ms=20000){const stop=Date.now()+ms;
 while(Date.now()<stop){try{if(fn())return true;}catch(_){}await sleep(75);}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish(false,e));}
async function finish(passed,error=null){await IOUtils.writeJSON(
 Services.prefs.getStringPref('marginfit.integrationResult'),
 {passed,checks,error:error&&String(error),stack:error?.stack,measurements:{},details});
 Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
const details={};
async function run(){let reader=null;
 try{
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const x=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  x.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
  await (await AddonManager.getInstallForFile(x)).install();
  const file=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
  const item=await Zotero.Attachments.importFromFile({file});
  reader=await Zotero.Reader.open(item.id,{position:{pageIndex:7}});
  const controller=()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView);
  check(await until(()=>controller()?.session.cache.size),'real Zotero reader mounted');
  const c=controller(),v=c.viewer,container=c.container;
  const original=v.scrollMode;
  details.before={mode:original,pageCount:v.pagesCount,scrollHeight:container.scrollHeight,clientHeight:container.clientHeight};
  check(v.pagesCount>12,'PDF.js retains real document page count');
  v.currentPageNumber=8;
  check(await until(()=>v.currentPageNumber===8),'native page jump works');
  await c.request('height');
  check(c.mode==='height','content-aware Fit Height selected');
  check(v.scrollMode===0,'Fit Height uses native continuous vertical scrolling');
  check(v.viewer.querySelectorAll('.page').length>1,'DOM contains multiple pages, not PAGE mode');
  check(container.scrollHeight>container.clientHeight*3,'scrollbar covers entire PDF');
  check(await until(()=>c.session.cache.has(8)),'content boundaries detected for visible page');
  const record=c.session.cache.get(8);
  const pr=v.getPageView(7).div.getBoundingClientRect(),vr=container.getBoundingClientRect();
  const scale=pr.height/record.height;
  const top=pr.top-vr.top+Math.max(0,record.raw[1]-16)*scale;
  const bottom=pr.top-vr.top+Math.min(record.height,record.raw[3]+16)*scale;
  details.fitted={heightScale:v.currentScale,boundTop:top,boundBottom:bottom,viewportHeight:container.clientHeight,
   scrollbarHeight:container.scrollHeight,pagesInDOM:v.viewer.querySelectorAll('.page').length};
  check(top>=-20 && bottom<=container.clientHeight+20,'detected content height fits viewport');
  const start=container.scrollTop;
  container.scrollTop=start+Math.max(150,container.clientHeight*.45);
  check(container.scrollTop>start+40,'one native scroll movement advances within continuous document');
  const target=v.getPageView(8).div;
  v.currentPageNumber=9;
  check(await until(()=>v.currentPageNumber===9),'native page number jump reaches next page');
  check(v.scrollMode===0 && container.scrollHeight>container.clientHeight*3,'jump does not collapse scrollbar');
  const wheel=new c.win.WheelEvent('wheel',Components.utils.cloneInto(
   {deltaY:130,deltaMode:0,bubbles:true,cancelable:true},c.win));
  check(container.dispatchEvent(wheel) && !wheel.defaultPrevented,'wheel remains native, not captured for custom turns');
  const key=new c.win.KeyboardEvent('keydown',Components.utils.cloneInto(
   {key:'PageDown',bubbles:true,cancelable:true},c.win));
  check(c.win.dispatchEvent(key)&&!key.defaultPrevented,'Page Down remains native, not captured');
  c.viewer.currentScaleValue=c.viewer.currentScale*1.07;
  check(await until(()=>c.manual),'manual zoom recognized');
  check(v.scrollMode===0 && container.scrollHeight>container.clientHeight*3,
   'manual zoom keeps full PDF scrollable');
  await c.request('height');
  check(v.scrollMode===0,'repeated Height Fit still preserves full document');
  await c.request('width');
  check(v.scrollMode===0,'Fit Width preserves continuous document');
  v.scrollMode=3; // emulate the single-page layout retained by the previous release
  check(v.viewer.querySelectorAll('.page').length===1,'old PAGE mode can reduce document DOM to one page');
  await c.request('height');
  check(v.scrollMode===0 && v.viewer.querySelectorAll('.page').length>1,
   'Fit Height recovers the whole PDF from an old PAGE-mode reader');
  reader.close();reader=null;await finish(true);
 }catch(error){try{reader?.close();}catch(_){}await finish(false,error);}
}
