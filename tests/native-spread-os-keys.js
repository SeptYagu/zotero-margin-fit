/* Native OS keyboard test protocol: ONLY disposable Zotero test instance. */
const checks=[],commands=[],samples=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=20000){let t=Date.now()+ms;while(Date.now()<t){try{if(await fn())return true}catch(e){}await sleep(90)}return false}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;Zotero.uiReadyPromise.then(run).catch(e=>done(false,e))}
async function done(passed,error){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),{passed,checks,details:{commands,samples},error:error&&String(error),stack:error?.stack,measurements:{}});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit)}
async function run(){try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
 const f=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);f.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));await (await AddonManager.getInstallForFile(f)).install();
 const path=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
 const item=await Zotero.Attachments.importFromFile({file:path});
 const reader=await Zotero.Reader.open(item.id,{position:{pageIndex:2}});
 if(!await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)))throw Error('controller');
 const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView),v=c.viewer;
 const original=c.snapToContent.bind(c);
 c.snapToContent=(to,from)=>{commands.push({to,from,mode:v.spreadMode,at:Date.now()});return original(to,from)};
 await c.request('height');await sleep(270);
 function state(){return {page:c.page(),last:c.lastPage,current:v.currentPageNumber,spread:v.spreadMode,scrollTop:c.container.scrollTop,scrollMode:v.scrollMode}};
 const result=Services.prefs.getStringPref('marginfit.integrationResult');
 for(const [mode,start,forward,backward] of [[1,3,5,3],[2,2,4,2]]){
   v.spreadMode=mode;v.currentPageNumber=start;await sleep(330);
   await c.request('height');await sleep(240);
   c.container.focus?.();
   if(c.page()!==start)throw Error('Not ready at native spread start '+start+' :'+c.page());
   samples.push({mark:'start',...state()});
   await IOUtils.writeJSON(result+'.ready',{ready:true,mode,start,state:state()});
   // OS driver performs PageDown then PageUp for this phase.
   if(!await until(async()=>{const x=await IOUtils.readJSON(result+'.done').catch(()=>null);return x?.mode===mode},22000))
     throw Error('External OS key driver not complete in spread mode '+mode);
   samples.push({mark:'after',...state()});
   const actual=commands.filter(z=>z.mode===mode && Number.isInteger(z.from));
   if(actual.length!==2 || actual[0].from!==start || actual[0].to!==forward ||
      actual[1].from!==forward || actual[1].to!==backward)
     throw Error('Unexpected native commands '+JSON.stringify({mode,actual}));
   checks.push('OS PageDown/PageUp '+start+' -> '+forward+' -> '+backward+' in native spread mode '+mode);
 }
 await done(true);
}catch(e){await done(false,e)}}
