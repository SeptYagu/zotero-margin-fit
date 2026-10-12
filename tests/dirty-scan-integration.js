/* Isolated Zotero diagnostic on a user-selected irregular scanned PDF. */
const checks=[],rows=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
async function until(fn,label){for(let k=0;k<180;k++){if(await fn())return;await sleep(100);}throw Error('Timeout '+label);}
async function finish(r){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),{checks,rows,measurements:{},...r});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;Zotero.uiReadyPromise.then(run).catch(e=>finish({passed:false,error:String(e),stack:e.stack}));}
async function run(){let reader;
 try{
  const pdfPath=Services.prefs.getStringPref('marginfit.integrationSourcePDF','');
  assert(pdfPath && await IOUtils.exists(pdfPath),'source scanned PDF supplied and readable');
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  file.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
  await (await AddonManager.getInstallForFile(file)).install();
  const item=await Zotero.Attachments.importFromFile({file:pdfPath});
  reader=await Zotero.Reader.open(item.id);
  await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView),'controller');
  const plugin=Zotero.MarginFit,c=plugin.controllers.get(reader._internalReader._primaryView);
  await c.session.ready;
  const sizes=new Set();
  for(let p=1;p<=c.session.count;p++){
   const page=c.viewer.getPageView(p-1);
   sizes.add(Math.round(page.width||page.viewport.width)+':'+Math.round(page.height||page.viewport.height));
   const record=await c.session.visible(p,page.viewport.rotation,()=>true);
   if(!record)throw Error('Missing page '+p);
   rows.push({p,width:record.width,height:record.height,quality:record.quality,
     reason:record.reason,raw:record.raw,widthFitRaw:record.widthFitRaw,
     rasterBytes:record.rasterBytes,ms:record.elapsedMs});
  }
  assert(sizes.size>1,'real file contains mixed physical page sizes');
  assert(rows.length===19,'all 19 scanned pages diagnosed');
  assert(rows.every(r=>r.quality==='reliable'),'no dark scan-edge fallback across all 19 pages');
  assert(rows[0].raw[0]>20&&rows[0].raw[2]<540,
    'page 1 black header and distant right edge streak do not force near-full-paper fitting');
  assert(rows[1].raw[0]>100&&rows[1].raw[2]<760,
    'larger page 2 uses its own non-contaminated fitting rectangle');
  const doc=reader._iframeWindow.document;
  const before=doc.querySelectorAll('.marginfit-toolbar').length;
  const bar=doc.querySelector('.marginfit-toolbar');
  assert(before===1,'one toolbar before injected duplicate');
  const duplicate=bar.cloneNode(true);bar.parentNode.append(duplicate);
  assert(doc.querySelectorAll('.marginfit-toolbar').length===2,'duplicate toolbar reproduced');
  plugin.toolbar({reader,doc});plugin.discover();
  assert(doc.querySelectorAll('.marginfit-toolbar').length===1,'duplicate toolbar removed on rediscovery');
  await finish({passed:true,details:{sizes:[...sizes],counts:{fallback:rows.filter(r=>r.quality==='fallback').length,
    reliable:rows.filter(r=>r.quality==='reliable').length},initialToolbarCount:before}});
 }catch(e){await finish({passed:false,error:String(e),stack:e.stack});}
}
