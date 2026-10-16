/* Run only inside disposable Zotero integration profile, never user's Zotero profile.
 * Imports one 34-page fixture, exercises actual MarginFit detector + 12/14/16
 * reactive single-page Width runtime, captures actual page CSS viewport overlap.
 */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[],rows=[],errors=[];
async function until(fn,ms=18000){const deadline=Date.now()+ms;
 while(Date.now()<deadline){try{if(fn())return true}catch(_){}await sleep(90)}
 return false;
}
function startup(){if(!Services.prefs.getBoolPref("marginfit.integrationProfile",false))return;
 Zotero.uiReadyPromise.then(run).catch(e=>done(false,e));}
async function done(passed,error){
 try{
  await IOUtils.writeJSON(Services.prefs.getStringPref("marginfit.integrationResult"),{
   passed,checks,rows,errors,error:error&&String(error),stack:error?.stack,
   measurements:{pageRows:rows.length,failures:errors.length}});
 }catch(e){Zotero.logError(e)}
 Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}
async function run(){
 let reader;
 try{
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad("item");
  const {AddonManager}=ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
  const x=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  x.initWithPath(Services.prefs.getStringPref("marginfit.integrationXPI"));
  await(await AddonManager.getInstallForFile(x)).install();
  const pdf=Services.prefs.getStringPref("marginfit.integrationSourcePDF");
  const mapPath=Services.prefs.getStringPref("marginfit.benchmarkManifest");
  const map=await IOUtils.readJSON(mapPath);
  if(map.length!==34)throw Error("expected 34 page map");
  const item=await Zotero.Attachments.importFromFile({file:pdf});
  reader=await Zotero.Reader.open(item.id,{position:{pageIndex:0}});
  if(!await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView),20000))
   throw Error("controller not ready");
  const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
  if(c.session.count!==34)throw Error("34 PDF page count mismatched");
  if(c.host.bambooPad()!==12)throw Error("production bamboo pad not 12");
  checks.push("isolated XPI installed; 34-page fixture opened");
  // Exact plugin detector results, no Poppler text bbox shortcuts.
  const actual=[];
  for(let p=1;p<=34;p++){
    const page=c.viewer.getPageView(p-1);
    const rec=await c.session.visible(p,page.viewport.rotation,()=>true);
    if(!rec){errors.push({page:p,stage:"detector",reason:"missing record"}); actual.push(null);}
    else{
      const extract=b=>b?Array.from(b):null;
      actual.push({page:p,quality:rec.quality,reason:rec.reason||null,raw:extract(rec.raw),
       widthFitRaw:extract(rec.widthFitRaw),width:rec.width,height:rec.height,rotation:rec.rotation,
       boundsKind:rec.boundsKind||null,samplingRate:rec.samplingRate,elapsedMs:rec.elapsedMs||null});
    }
    if(p%6===0)await IOUtils.writeJSON(Services.prefs.getStringPref("marginfit.integrationResult")+".progress",{
      progress:"detected "+p+"/34",collected:actual.length});
  }
  checks.push("all 34 fixture pages passed through actual MarginFit session.visible detector");
  for(const pad of [12]){
    Services.prefs.setIntPref("extensions.marginfit.bambooPad",pad);
    c.bamboo=null;
    c.viewer.currentPageNumber=1;
    await sleep(120);
    c.manual=false; c.userHeldPage=null;
    await c.request("width");await sleep(160);
    for(let p=1;p<=34;p++){
      let rec=c.session.cache.get(p);
      if(!rec){errors.push({pad,page:p,stage:"read",reason:"missing cache"});continue;}
      const page=c.viewer.getPageView(p-1);
      const tok=c.epoch;
      c.viewer.currentPageNumber=p;await sleep(135);
      c.lastPage=p;c.manual=false;c.userHeldPage=null;
      try {
        await c.apply(rec,p,c.epoch,true,false,true);
        // PDF.js may perform native width layout when changing PDF scale; settle one frame.
        await sleep(85);
        const actualPage=c.viewer.getPageView(p-1),root=c.container.getBoundingClientRect(),
          rect=actualPage.div.getBoundingClientRect(),unit=actualPage.viewport.scale;
        const available=[(root.left-rect.left)/unit,
          (root.left+c.container.clientWidth-rect.left)/unit];
        const used=rec.widthFitRaw||rec.raw;
        const meaningful=[Math.max(0,used[0]),Math.min(rec.width,used[2])];
        const protectedBox=[Math.max(0,meaningful[0]-pad),Math.min(rec.width,meaningful[1]+pad)];
        const row={pad,p,sourceCase:map[p-1].caseId,quality:rec.quality,reason:rec.reason||null,
          raw:actual[p-1]?.raw||null,widthFitRaw:actual[p-1]?.widthFitRaw||null,
          viewerScale:c.viewer.currentScale,pdfScale:unit,
          pageWidth:rec.width,viewportPixels:c.container.clientWidth,scrollLeft:c.container.scrollLeft,
          visiblePdfX:available,safeX:protectedBox,visibleContentX:meaningful,
          rawContentFits:available[0]<=rec.raw[0]+.5 && available[1]>=rec.raw[2]-.5,
          chosenSafeFits:available[0]<=protectedBox[0]+.5&&available[1]>=protectedBox[1]-.5,
          bamboo:c.bamboo?{lo:c.bamboo.lo,hi:c.bamboo.hi}:null};
        rows.push(row);
      }catch(e){errors.push({pad,page:p,stage:"position",error:String(e)})}
      if(p%6===0)await IOUtils.writeJSON(Services.prefs.getStringPref("marginfit.integrationResult")+".progress",{
        progress:"width "+pad+" "+p+"/34",records:rows.length,errors:errors.length});
    }
    checks.push("34-page native Width run completed at "+pad+" PDF-unit safety");
  }
  rows.push({summary:"actual detector records",actual});
  await done(errors.length===0);
 }catch(e){try{reader?.close()}catch(_){}await done(false,e)}
}