/* Isolated Zotero idle indexer integration test. */
const checks=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jsonlCache(file) {
 const [header,...rows]=(await IOUtils.readUTF8(file)).trimEnd().split(String.fromCharCode(10))
  .map(line=>JSON.parse(line));
 return {...header,pages:Object.fromEntries(rows.map(([p,...box])=>[p,box]))};
}
function assert(v,m){if(!v)throw Error(m);checks.push(m);}
async function until(fn,timeout=19000){const deadline=Date.now()+timeout;
 while(Date.now()<deadline){try{if(fn())return true;}catch(_){ }await sleep(110);}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>finish({passed:false,error:String(e),stack:e.stack}));}
async function finish(data){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),
 {checks,measurements:{},...data});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
async function run(){
 let reader;
 try{
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const xpi=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  xpi.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
  await (await AddonManager.getInstallForFile(xpi)).install();
  const path=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
  const item=await Zotero.Attachments.importFromFile({file:path});
  reader=await Zotero.Reader.open(item.id,{position:{pageIndex:7}});
  assert(await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)), 'controller attached');
  const plugin=Zotero.MarginFit,c=plugin.controllers.get(reader._internalReader._primaryView);
  assert(await until(()=>c.session.cache.has(8)), 'foreground page detected');
  const startPage=c.viewer.currentPageNumber;
  assert(await until(()=>c.session.cache.has(7)&&c.session.cache.has(9)), 'neighbors preloaded');
  const initial=Array.from(c.session.cache.keys());
  const positionWrites=c.metrics.writes.length;
  assert(await until(()=>c.session.cache.size>initial.length,19000), 'idle worker indexed additional page without user turning');
  assert(c.viewer.currentPageNumber===startPage,'idle worker did not change displayed page');
  assert(c.metrics.writes.length===positionWrites,'idle worker did not change zoom/scroll');
  assert(plugin.indexer.completed>0,'one cooperative background worker ran');
  const indexed=Array.from(c.session.cache.keys()).sort((a,b)=>a-b);
  const storeFile=c.session.store.file;
  await c.session.store.flush();
  const data=await jsonlCache(storeFile);
  assert(data.algorithmVersion===1,'independent algorithmVersion 1 persisted');
  assert(Object.values(data.pages).every(b=>Array.isArray(b)&&b.length===4),'persisted page records contain only four coords');
  const currentPage=startPage;
  // A cached page change should not cancel indexing.
  c.viewer.currentPageNumber=9;
  await sleep(150);
  assert(c.session.cache.has(9),'navigate to cached neighbor');
  reader.close(); reader=null;
  await finish({passed:true,details:{startPage,currentPage,indexed,
   cachePageCount:Object.keys(data.pages).length,backgroundCompleted:plugin.indexer.completed}});
 }catch(e){try{reader?.close();}catch(_){}
   await finish({passed:false,error:String(e),stack:e.stack});}
}
