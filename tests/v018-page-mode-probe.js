/* v0.1.8 feasibility probe: exercises the native PDF.js page mode and existing
 * content-height fit inside a disposable Zotero integration profile.
 * Does NOT install a new paging feature or modify a production profile. */
const checks=[];
function assert(ok,message){if(!ok)throw Error('page-mode-probe: '+message);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<180;i++){try{if(fn())return true;}catch(_){}await sleep(100);}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish({passed:false,error:String(e),stack:e.stack}));}
async function finish(result){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),{checks,measurements:{},...result});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
async function run(){
  try{
   await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
   const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
   const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
   file.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
   await (await AddonManager.getInstallForFile(file)).install();
   const path=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
   const item=await Zotero.Attachments.importFromFile({file:path});
   const reader=await Zotero.Reader.open(item.id,{position:{pageIndex:7,rects:[[200,390,220,410]]}});
   if(!await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)))throw Error('controller not ready');
   const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
   const viewer=c.viewer;
   const orig=viewer.scrollMode;
   checks.push({phase:'before',scrollMode:orig,currentPageNumber:viewer.currentPageNumber,
       pageDivCount:viewer.viewer?.querySelectorAll?.('.page')?.length||0,
       scrollHeight:c.container.scrollHeight,containerHeight:c.container.clientHeight,
       spreadMode:viewer.spreadMode,hasEnsure:typeof viewer._ensurePageViewVisible,
       getScrollModeDescriptor:(()=>{let p=viewer;while(p&&!Object.getOwnPropertyDescriptor(p,'scrollMode'))p=Object.getPrototypeOf(p);return !!p;})()});
   viewer.scrollMode=3;
   await sleep(240);
   assert(viewer.scrollMode===3,'embedded PDF.js must support ScrollMode.PAGE=3');
   assert(viewer.viewer.querySelectorAll('.page').length===1,'only current PDF page should be in viewer DOM');
   checks.push({phase:'set-page-scroll',scrollMode:viewer.scrollMode,currentPageNumber:viewer.currentPageNumber,
       pageDivCount:viewer.viewer?.querySelectorAll?.('.page')?.length||0,
       scrollHeight:c.container.scrollHeight,containerHeight:c.container.clientHeight,
       spreadMode:viewer.spreadMode});
   await c.request('height');
   const bounds=c.session.cache.get(viewer.currentPageNumber);
   const page=c.viewer.getPageView(viewer.currentPageNumber-1);
   const rect=page.div.getBoundingClientRect();
   const view=c.container.getBoundingClientRect();
   assert(bounds?.quality==='reliable','test fixture has reliable content bounds');
   const cssPerPt=rect.height/bounds.height;
   const safeTop=rect.top-view.top+(bounds.raw[1]-16)*cssPerPt;
   const safeBottom=rect.top-view.top+(bounds.raw[3]+16)*cssPerPt;
   assert(safeTop>=-2&&safeBottom<=view.height+2,'protected content fits while paper edges are outside viewport');
   assert(rect.height>view.height+40,'the physical page must exceed the viewport to demonstrate crop-by-scroll');
   checks.push({phase:'fit-content-height',currentPageNumber:viewer.currentPageNumber,scrollMode:viewer.scrollMode,
     pageHeight:rect.height,viewportHeight:view.height,record:bounds?.raw,
     safeTop,safeBottom,
     rectTop:rect.top-view.top,rectBottom:rect.bottom-view.top,
     scrollTop:c.container.scrollTop});
   viewer.currentPageNumber=9;
   await sleep(250);
   assert(viewer.currentPageNumber===9,'page selection changes to page 9');
   assert(viewer.viewer.querySelectorAll('.page').length===1,'page turn keeps a single page element');
   checks.push({phase:'navigate-next',scrollMode:viewer.scrollMode,currentPageNumber:viewer.currentPageNumber,
       pageDivCount:viewer.viewer?.querySelectorAll?.('.page')?.length||0,
       scrollHeight:c.container.scrollHeight,containerHeight:c.container.clientHeight});
   viewer.scrollMode=orig;
   await sleep(120);
   assert(viewer.scrollMode===orig,'previous scroll mode restored');
   assert(viewer.viewer.querySelectorAll('.page').length>1,'continuous PDF layout restored');
   await finish({passed:true});
  }catch(e){await finish({passed:false,error:String(e),stack:e.stack});}
}
