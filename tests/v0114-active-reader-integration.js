const checks=[],state=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=18000){let end=Date.now()+ms;while(Date.now()<end){try{if(fn())return true}catch(_){}await sleep(100)}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;Zotero.uiReadyPromise.then(run).catch(e=>finish(false,e));}
async function finish(passed,error){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),
 {passed,checks,details:{state},error:error&&String(error),stack:error?.stack,measurements:{}});
 Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
async function run(){let a,b;try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
 const x=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
 x.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
 await (await AddonManager.getInstallForFile(x)).install();
 const base=Services.prefs.getStringPref('marginfit.integrationFixtures');
 const p1=await Zotero.Attachments.importFromFile({file:PathUtils.join(base,'asymmetric-book.pdf')});
 const p2=await Zotero.Attachments.importFromFile({file:PathUtils.join(base,'asymmetric-book-pause.pdf')});
 a=await Zotero.Reader.open(p1.id,{position:{pageIndex:7}});
 if(!await until(()=>Zotero.MarginFit?.controllers.get(a._internalReader?._primaryView)))throw Error('controller1');
 b=await Zotero.Reader.open(p2.id,{position:{pageIndex:11}});
 if(!await until(()=>Zotero.MarginFit?.controllers.get(b._internalReader?._primaryView)))throw Error('controller2');
 const plugin=Zotero.MarginFit;
 const c1=plugin.controllers.get(a._internalReader._primaryView),c2=plugin.controllers.get(b._internalReader._primaryView);
 const main=Zotero.getMainWindows()[0], tabs=main.Zotero_Tabs;
 const tabA=tabs._tabs.find(t=>t.data?.itemID===p1.id)?.id,tabB=tabs._tabs.find(t=>t.data?.itemID===p2.id)?.id;
 function snapshot(name){const t=plugin.indexer.target;
   state.push({name,tabSelected:tabs?.selectedID,tabIds:tabs?._tabs?.map(z=>({id:z.id,type:z.type,data:z.data})),
    aTab:tabA,bTab:tabB,aItem:a.itemID,bItem:b.itemID,
    aReaderKeys:Object.keys(a).filter(k=>/item|tab|id|window/i.test(k)).slice(0,25),
    selectedReader:Zotero.Reader._readers?.map(r=>({tab:r._tabID,item:r._itemID,
      hasFocus:r._iframeWindow?.document?.hasFocus?.()})),
    foregroundDoc:main.document.hasFocus(),aDoc:a._iframeWindow.document.hasFocus(),
    bDoc:b._iframeWindow.document.hasFocus(),
    indexTarget:t===c1?'A':t===c2?'B':t?'other':'none',
    preferred:(()=>{const p=plugin.preferredIndexerController();return p===c1?'A':p===c2?'B':p?'other':'none'})(),
    cModes:[c1.mode,c2.mode],cClosed:[c1.closed,c2.closed],
    tabID:[a.tabID,b.tabID],
    firstCached:c1.session.cache.size,secondCached:c2.session.cache.size,
    completed:plugin.indexer.completed,busy:plugin.indexer.busy,
    timer:!!plugin.indexer.timer,paused:[c1.session.paused,c2.session.paused],
    lastInput:[c1.lastInput,c2.lastInput],now:Date.now()});}
 await sleep(2000);snapshot('after B open');
 if(tabs?.select)await tabs.select(tabA);
 await sleep(1800);snapshot('after select A');
 if(tabs?.select)await tabs.select(tabB);
 await sleep(1800);snapshot('after select B again');
 await sleep(2500);snapshot('after idle B');
 const result=()=>plugin.indexer.target;
 const selectedB=tabs.selectedID===tabB;
 if(!selectedB || result()!==c2)throw Error('active B must be current background target');
 checks.push('Active B retains exclusive background worker after tab return');
 const cachedA=c1.session.cache.size,cachedB=c2.session.cache.size;
 if(!await until(()=>c2.session.cache.size>=cachedB+2,12000))throw Error('B did not continue idle indexing');
 if(c1.session.cache.size!==cachedA)throw Error('non-active PDF A got background work before B complete');
 checks.push('Active B indexes new pages while inactive A remains unchanged');
 if(!await until(()=>c2.session.cache.size===c2.session.count,55000))
   throw Error('B did not complete entire document within 55s');
 snapshot('B fully indexed');
 checks.push('Current active PDF B fully indexed first');
 if(!await until(()=>plugin.indexer.target===null,7000))
   throw Error('indexer did not stop after the selected PDF completed');
 await sleep(1600);
 if(c1.session.cache.size!==cachedA)
   throw Error('worker illegally indexed the hidden PDF A');
 snapshot('B complete: idle worker stopped');
 checks.push('After active PDF B completes, no hidden PDF is rendered');
 await tabs.select(tabA);
 if(!await until(()=>plugin.indexer.target===c1,6000))
   throw Error('indexer did not switch to newly active PDF A');
 if(!await until(()=>c1.session.cache.size>cachedA,12000))
   throw Error('newly selected PDF A did not resume indexing');
 snapshot('A resumed after reactivation');
 checks.push('Selecting PDF A resumes its one-worker indexing');
 await finish(true);
}catch(e){await finish(false,e);}
}
