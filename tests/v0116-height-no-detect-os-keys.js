/* OS-keyboard-input probe; disposable Zotero profile only, external SendInput after ready marker. */
const checks=[],events=[],samples=[],pageCommands=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=18000){const stop=Date.now()+ms;while(Date.now()<stop){try{if(fn())return true}catch(_){}await sleep(80)}return false;}
const result=Services.prefs.getStringPref('marginfit.integrationResult');
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish(false,e));}
async function finish(passed,error){await IOUtils.writeJSON(result,
 {passed,checks,details:{events,samples,pageCommands},error:error&&String(error),stack:error?.stack,measurements:{}});
 Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
async function run(){let reader;try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
 const x=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
 x.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
 await (await AddonManager.getInstallForFile(x)).install();
 const path=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
 const item=await Zotero.Attachments.importFromFile({file:path});
 reader=await Zotero.Reader.open(item.id,{position:{pageIndex:7}});
 if(!await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)))throw Error('controller attach');
 const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
 if(!await until(()=>c.session.cache.has(8)))throw Error('PDF bounds');
 const originalSnap=c.snapToPage.bind(c);
 c.snapToPage=(page,previous)=>{pageCommands.push({page,previous,time:Date.now(),source:'MarginFit.snapToPage'});return originalSnap(page,previous)};
 c.viewer.currentPageNumber=8;
 if(!await until(()=>c.page()===8,10000))throw Error('position page 8');
 await c.request('height');
 if(!await until(()=>c.mode==='height'&&c.appliedEpoch===c.epoch))throw Error('Height fit');
 Services.prefs.setBoolPref('extensions.marginfit.enabled',false);
 if(!await until(()=>!Zotero.MarginFit.enabled(),6000))throw Error('detect disabled');
 c.view.zoomPageHeight();
 if(c.mode!=='height')throw Error('height mode must survive detect disable');

 const main=Zotero.getMainWindows()[0];
 for(const [src,node] of [['main',main],['mainDoc',main.document],['iframeDoc',c.win.document]]){
  node.addEventListener('keydown',e=>events.push({src,key:e.key,trusted:e.isTrusted,time:Date.now(),
   defaultPrevented:e.defaultPrevented,target:e.target?.tagName}),true);
 }
 c.win.addEventListener('keydown',e=>events.push({src:'iframe',key:e.key,trusted:e.isTrusted,time:Date.now(),
   defaultPrevented:e.defaultPrevented,target:e.target?.tagName}),true);
 c.container.addEventListener('keydown',e=>events.push({key:e.key,trusted:e.isTrusted,time:Date.now(),
   defaultPrevented:e.defaultPrevented,target:e.target?.tagName,from:'container'}),true);
 function snapshot(){return {at:Date.now(),page:c.page(),viewerPage:c.viewer.currentPageNumber,
   lastPage:c.lastPage,top:c.container.scrollTop,scale:c.viewer.currentScale,
   scrollMode:c.viewer.scrollMode,focus:c.win.document.hasFocus(),mainFocus:Zotero.getMainWindows()[0].document.hasFocus()};}
 samples.push({mark:'ready',...snapshot()});
 c.container.focus?.();
 await IOUtils.writeJSON(result+'.ready',{ready:true,state:snapshot(),winTitle:Zotero.getMainWindows()[0].document.title});
 for(let i=0;i<92;i++){await sleep(180);samples.push(snapshot());}
 const pressed=events.filter(e=>['PageDown','PageUp','ArrowDown'].includes(e.key));
 if(pageCommands.length!==2 || pageCommands[0].page!==9 || pageCommands[1].page!==8)
   throw Error('Real OS PageDown/PageUp must invoke exactly 8 -> 9 -> 8 physical-page steps without detection');
 checks.push('OS PageDown/PageUp invoke exactly one neighboring content-page step each');
 checks.push('OS keyboard events delivered: '+pressed.length);
 checks.push('MarginFit native-page command invocations: '+pageCommands.length);
 if(c.viewer.scrollMode!==0)throw Error('PDF not continuous after PageDown/PageUp');
 checks.push('All reader DOM pages preserved: '+(c.viewer.viewer.querySelectorAll('.page').length>1));
 checks.push('Initial page: '+samples[0].page+' last sampled page: '+samples.at(-1).page);
 await finish(true);
}catch(e){try{reader?.close()}catch(_){}await finish(false,e);}
}
