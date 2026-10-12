/* Isolated Zotero 10: use its own PDFWorker.rotatePages on a disposable imported PDF. */
const checks=[],result={};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const check=(v,message)=>{checks.push({message,passed:!!v});if(!v)throw Error(message);};
const until=async(fn,limit=25000)=>{const untilTime=Date.now()+limit;while(Date.now()<untilTime){try{if(fn())return true;}catch(_){}await sleep(100);}return false;};
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish(false,e));}
async function finish(passed,error=null){
 await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),
  {passed,checks,details:result,error:error&&String(error),stack:error?.stack,measurements:{}});
 Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}
async function run(){
 let reader=null;
 try{
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const xpi=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  xpi.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
  await (await AddonManager.getInstallForFile(xpi)).install();
  check(!!Zotero.MarginFit,'new plugin installed in throwaway Zotero profile');
  const tmp=PathUtils.join(PathUtils.profileDir,'marginfit-append-check.jsonl');
  await IOUtils.writeUTF8(tmp,'first'+String.fromCharCode(10),{mode:'appendOrCreate'});
  await IOUtils.writeUTF8(tmp,'second'+String.fromCharCode(10),{mode:'appendOrCreate'});
  check((await IOUtils.readUTF8(tmp))==='first'+String.fromCharCode(10)+'second'+String.fromCharCode(10),
   'real Zotero IOUtils appendOrCreate works');
  await IOUtils.remove(tmp);
  const path=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'rotated.pdf');
  const item=await Zotero.Attachments.importFromFile({file:path});
  const local=await item.getFilePathAsync();
  reader=await Zotero.Reader.open(item.id,{position:{pageIndex:0}});
  const controller=()=>Zotero.MarginFit.controllers.get(reader._internalReader?._primaryView);
  check(await until(()=>controller()?.session.cache.has(1)),'fixture opened and analyzed');
  const before=controller(),beforeData=await IOUtils.read(local);
  result.before={path:local,bytes:beforeData.length,
   fingerprints:[...before.app.pdfDocument.fingerprints],
   rotation:before.viewer.getPageView(0).viewport.rotation,
   storeFile:before.session.store.file};
  const status=await Zotero.PDFWorker.rotatePages(item.id,[0],90,true);
  result.workerStatus=String(status);
  const afterData=await IOUtils.read(local);
  let changedBytes=beforeData.length!==afterData.length;
  if(!changedBytes)for(let i=0;i<beforeData.length;i++)if(beforeData[i]!==afterData[i]){changedBytes=true;break;}
  result.fileChanged=changedBytes;
  result.afterFileBytes=afterData.length;
  check(changedBytes,'actual Zotero PDFWorker.rotatePages modifies PDF bytes on disk');
  await reader.reload();
  check(await until(()=>controller()?.app.pdfDocument && controller()?.session.cache.has(1)),
   'reader reloaded after Zotero persisted rotation');
  const after=controller();
  result.after={fingerprints:[...after.app.pdfDocument.fingerprints],
   rotation:after.viewer.getPageView(0).viewport.rotation,
   storeFile:after.session.store.file};
  result.fingerprintChanged=JSON.stringify(result.before.fingerprints)!==
    JSON.stringify(result.after.fingerprints);
  result.cacheKeyChanged=result.before.storeFile!==result.after.storeFile;
  result.rotationChanged=result.before.rotation!==result.after.rotation;
  check(result.rotationChanged,'saved page rotation changes PDF.js page geometry');
  reader.close();reader=null;
  await finish(true);
 }catch(error){try{reader?.close();}catch(_){}await finish(false,error);}
}
