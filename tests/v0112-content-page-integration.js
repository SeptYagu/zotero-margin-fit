/* Zotero 10 isolated fine scrolling + content-page navigation regression. */
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
function geometryPage(c,p){
 const rec=c.session.cache.get(p),page=c.viewer.getPageView(p-1);
 const r=page.div.getBoundingClientRect(),v=c.container.getBoundingClientRect();
 const scale=r.height/rec.height;
 return {page:p,contentMiddle:r.top-v.top+(rec.raw[1]+rec.raw[3])*scale/2,
   scrollTop:c.container.scrollTop};
}
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
  // PageDown is tested below as an explicit one-content-page jump.
  c.viewer.currentScaleValue=c.viewer.currentScale*1.07;
  check(await until(()=>c.manual),'manual zoom recognized');
  check(v.scrollMode===0 && container.scrollHeight>container.clientHeight*3,
   'manual zoom keeps full PDF scrollable');
  await c.request('height');
  check(v.scrollMode===0,'repeated Height Fit still preserves full document');
  await c.request('width');
  check(v.scrollMode===0,'Fit Width preserves continuous document');
  // The entire PDF remains scrollable; paging keys land on the next page's content.
  await c.request('height');
  check(c.mode==='height','content-aware Height mode restored before page-key testing');
  const beforeKey=c.page();
  check(beforeKey>=1 && beforeKey<v.pagesCount,'there is a page available ahead');
  await c.snapToContent(beforeKey+1,beforeKey);
  check(await until(()=>c.lastPage===beforeKey+1 && c.session.cache.has(beforeKey+1)),
    'content-page step selects exactly the next page');
  const landing=geometryPage(c,beforeKey+1);
  details.keyLanding=landing;
  check(Math.abs(landing.contentMiddle-container.clientHeight/2)<25,
    'next page content is centered without PAGE mode');
  check(v.scrollMode===0 && v.viewer.querySelectorAll('.page').length>1,
    'content-page step leaves full PDF intact');
  await c.snapToContent(beforeKey,c.page());
  check(await until(()=>c.lastPage===beforeKey),
    'one previous-page step returns to previous content page');
  // Ordinary user scroll inside a page remains untouched, but crossing into
  // the following physical page lands on that page's ink center.
  const currentTop=container.scrollTop;
  container.scrollTop=currentTop+23;
  c.input(true);
  await sleep(320);
  check(Math.abs(container.scrollTop-(currentTop+23))<5,
    'free 23px scroll within page is preserved, not snapped back');
  const next=c.lastPage+1;
  const pageRect=v.getPageView(next-1).div.getBoundingClientRect();
  container.scrollTop+=pageRect.top-container.getBoundingClientRect().top+20;
  c.input(true);
  check(await until(()=>c.lastPage===next && c.session.cache.has(next)),
    'user scroll crossing into next page selects that page');
  const scrollLanding=geometryPage(c,next);
  details.scrollLanding=scrollLanding;
  check(Math.abs(scrollLanding.contentMiddle-container.clientHeight/2)<25,
    'cross-page scroll lands at next page content center');
  v.scrollMode=3; // emulate the single-page layout retained by the previous release
  check(v.viewer.querySelectorAll('.page').length===1,'old PAGE mode can reduce document DOM to one page');
  await c.request('height');
  check(v.scrollMode===0 && v.viewer.querySelectorAll('.page').length>1,
   'Fit Height recovers the whole PDF from an old PAGE-mode reader');
  reader.close();reader=null;await finish(true);
 }catch(error){try{reader?.close();}catch(_){}await finish(false,error);}
}

