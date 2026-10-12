/* Native regression: active PDF first, then all other OPEN PDFs fully indexed. */
const checks=[],timeline=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=20000){const end=Date.now()+ms;while(Date.now()<end){try{if(fn())return true}catch(_){}await sleep(110)}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;Zotero.uiReadyPromise.then(run).catch(e=>finish(false,e))}
async function finish(passed,error){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),{passed,checks,details:{timeline},error:error&&String(error),stack:error?.stack,measurements:{}});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
async function run(){try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
 const x=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);x.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));await (await AddonManager.getInstallForFile(x)).install();
 Services.prefs.setStringPref('extensions.marginfit.mode','off');
 const base=Services.prefs.getStringPref('marginfit.integrationFixtures');
 const a=await Zotero.Attachments.importFromFile({file:PathUtils.join(base,'asymmetric-book.pdf')});
 const b=await Zotero.Attachments.importFromFile({file:PathUtils.join(base,'clean-scan.pdf')});
 const r1=await Zotero.Reader.open(a.id,{position:{pageIndex:7}});
 if(!await until(()=>Zotero.MarginFit?.controllers.get(r1._internalReader?._primaryView)))throw Error('A controller');
 const plugin=Zotero.MarginFit,c1=plugin.controllers.get(r1._internalReader._primaryView);
 if(c1.mode!=='off')throw Error('A must start in fit OFF mode');
 const r2=await Zotero.Reader.open(b.id,{position:{pageIndex:0}});
 if(!await until(()=>plugin.controllers.get(r2._internalReader?._primaryView)))throw Error('B controller');
 const c2=plugin.controllers.get(r2._internalReader._primaryView);
 if(c2.mode!=='off')throw Error('B must also keep fit OFF mode');
 const originalZoom=c2.viewer.currentScale,originalTop=c2.container.scrollTop;
 const tabs=Zotero.getMainWindows()[0].Zotero_Tabs;
 function state(name){const target=plugin.indexer.target;
  const z={name,time:Date.now(),selected:tabs.selectedID,tabA:r1.tabID,tabB:r2.tabID,
   target:target===c1?'A':target===c2?'B':target?'unknown':'none',busy:plugin.indexer.busy,
   completed:plugin.indexer.completed,cachedA:c1.session.cache.size,totalA:c1.session.count,
   cachedB:c2.session.cache.size,totalB:c2.session.count,
   activeA:c1.session.metrics.active,activeB:c2.session.metrics.active};
  timeline.push(z);return z;}
 state('B opened');
 if(!await until(()=>c2.session.cache.size===c2.session.count,18000))throw Error('B did not finish');
 state('B complete');checks.push('Foreground selected B indexed completely');
 if(!await until(()=>plugin.indexer.target===c1,9000))throw Error('Did not schedule waiting inactive PDF A');
 checks.push('Single worker transferred to inactive open PDF A after B completed');
 const before=c1.session.cache.size;
 if(!await until(()=>c1.session.cache.size>before,25000)){state('A stalled');
  throw Error('Inactive PDF A did not gain indexed pages in 25 seconds');}
 state('A progressed');checks.push('Inactive open PDF A page was actually detected in background');
 checks.push('All-open indexing works when Width/Height fitting is OFF');
 if(c2.metrics.writes.length || Math.abs(c2.viewer.currentScale-originalZoom)>.001 ||
   Math.abs(c2.container.scrollTop-originalTop)>2)
    throw Error('Automatic fitting modified the PDF while fit OFF');
 checks.push('Fit OFF leaves scale and reading position untouched');
 Services.prefs.setBoolPref('extensions.marginfit.enabled',false);
 if(!await until(()=>plugin.indexer.target===null,5000))
    throw Error('Disabling Detect Margins did not stop indexing');
 checks.push('Only Detect Margins OFF stops background recognition');
 await finish(true);
}catch(e){await finish(false,e)}}
