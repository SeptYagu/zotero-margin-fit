/* Confirm real Zotero IOUtils can discover and migrate v0.1.7 stamped cache. */
const checks=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function check(v,m){if(!v)throw Error(m);checks.push(m);}
async function until(fn,ms=15000){const end=Date.now()+ms;
 while(Date.now()<end){try{if(fn())return true;}catch(_){}
 await sleep(100);}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish({passed:false,error:String(e),stack:e.stack}));}
async function finish(r){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),
 {checks,measurements:{},...r});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
async function run(){
 let reader;
 try{
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const x=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  x.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
  await (await AddonManager.getInstallForFile(x)).install();
  const file=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
  const item=await Zotero.Attachments.importFromFile({file});
  reader=await Zotero.Reader.open(item.id);
  check(await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)),'controller ready');
  const plugin=Zotero.MarginFit,c=plugin.controllers.get(reader._internalReader._primaryView);
  check(await until(()=>c.session.cache.has(1)),'visible page detected');
  const rec=c.session.cache.get(1),store=c.session.store,io=plugin.cacheIO.IOUtils;
  const fingerprints=Array.from(c.app.pdfDocument.fingerprints);
  check(typeof io.getChildren==='function','real Zotero IOUtils supports getChildren');
  plugin.indexer.stop(c);
  await store.flush();reader.close();reader=null;await sleep(200);
  await io.remove(store.file);
  const legacyKey=store.key+'-4096-1791510000000';
  const legacyFile=plugin.cacheIO.PathUtils.join(store.directory,legacyKey+'.json');
  const saved={storageVersion:3,algorithmVersion:5,key:legacyKey,numPages:store.count,
    pages:[[1,{raw:rec.raw,width:rec.width,height:rec.height,rotation:rec.rotation,
      viewerRotation:rec.viewerRotation,quality:'reliable',version:5}]]};
  await io.writeJSON(legacyFile,saved);
  const replacement=new plugin.cacheModule.Store({io,path:plugin.cacheIO.PathUtils,timers:plugin.timers,
    fingerprints,count:store.count});
  const imported=await replacement.load();
  check(imported.has(1),'stamped legacy cache located by fingerprint and count');
  check(JSON.stringify(imported.get(1).raw)===JSON.stringify(rec.raw),'legacy ink rectangle reused exactly');
  await replacement.flush();
  const modern=await io.readJSON(replacement.file);
  check(modern.algorithmVersion===1&&modern.pages['1'].length===4,'legacy converted to independent v1 four-coord format');
  await finish({passed:true,details:{legacyFile,modernFile:replacement.file,raw:imported.get(1).raw}});
 }catch(e){try{reader?.close();}catch(_){}
 await finish({passed:false,error:String(e),stack:e.stack});}
}
