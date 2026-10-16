/* Inspect actual ink extents for Height Fit in Zotero native spreads. */
const checks=[],details={cases:[]},sleep=ms=>new Promise(r=>setTimeout(r,ms));
function assert(ok,message){if(!ok)throw Error(message);checks.push(message);}
async function until(fn,ms=18000){const end=Date.now()+ms;while(Date.now()<end){try{if(fn())return true;}catch(_){}await sleep(80);}return false;}
function startup(){if(!Services.prefs.getBoolPref("marginfit.integrationProfile",false))return;
  Zotero.uiReadyPromise.then(run).catch(e=>done(false,e));}
async function done(passed,error){
  await IOUtils.writeJSON(Services.prefs.getStringPref("marginfit.integrationResult"),
    {passed,checks,details,error:error&&String(error),stack:error?.stack,measurements:{}});
  Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}
async function run(){let reader;
 try{
  await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad("item");
  const {AddonManager}=ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
  const x=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  x.initWithPath(Services.prefs.getStringPref("marginfit.integrationXPI"));
  await (await AddonManager.getInstallForFile(x)).install();
  const fixture=PathUtils.join(Services.prefs.getStringPref("marginfit.integrationFixtures"),"asymmetric-book.pdf");
  const item=await Zotero.Attachments.importFromFile({file:fixture});
  reader=await Zotero.Reader.open(item.id,{position:{pageIndex:1}});
  assert(await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)),
    "real reader with MarginFit attached");
  const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
  const v=c.viewer,root=c.container;
  assert(Zotero.MarginFit.enabled(),"Detect Margins enabled");
  for(const [mode,page] of [[0,8],[1,1],[1,5],[2,2],[2,4],[2,1]]){
    v.spreadMode=mode;v.currentPageNumber=page;
    await sleep(180);
    const count=mode&&page<v.pagesCount&&
      (mode===1?page%2===1:page%2===0)?2:1;
    for(let n=page;n<page+count;n++){
      const pv=v.getPageView(n-1);
      await c.session.visible(n,pv.viewport.rotation,()=>true);
    }
    await c.request("height");
    // Native page-number changes can lag when the spread layout is reflowing.
    // Explicitly fit the requested test page instead of measuring the old view.
    const scalesBefore=c.metrics.writes.filter(x=>x.type==="scale").length;
    await c.apply(c.session.cache.get(page),page,c.epoch,true);
    const scalesAfter=c.metrics.writes.filter(x=>x.type==="scale").length;
    assert(scalesAfter-scalesBefore<=1,"at most one zoom per explicit Height fit "+mode+":"+page);
    await sleep(180);
    const box=c.spreadContent(page,c.session.cache.get(page));
    const viewport=root.getBoundingClientRect();
    const edges={left:box.left-viewport.left,
      right:viewport.left+root.clientWidth-box.right,
      top:box.top-viewport.top,bottom:viewport.top+root.clientHeight-box.bottom};
    details.cases.push({mode,page,scale:v.currentScale,edges,box,clientWidth:root.clientWidth,
      clientHeight:root.clientHeight,scrollLeft:root.scrollLeft,scrollTop:root.scrollTop,
      scrollWidth:root.scrollWidth,offsetWidth:root.offsetWidth,offsetHeight:root.offsetHeight,
      viewerWidth:v.viewer.getBoundingClientRect().width,viewerScrollWidth:v.viewer.scrollWidth,
      fullWidths:[v.getPageView(0).viewport.width,v.getPageView(1).viewport.width],
      cssGap:c.win.getComputedStyle(v.viewer.querySelector('.spread')||v.viewer).gap,
      cssPadding:c.win.getComputedStyle(v.viewer).padding});
    assert(Object.values(edges).every(Number.isFinite),"finite spread geometry "+mode+":"+page);
    assert(Object.values(edges).every(v=>v>=-5),"all content sides visible "+mode+":"+page+
      " "+JSON.stringify(edges));
  }
  reader.close();reader=null;
  await done(true);
 }catch(e){try{reader?.close();}catch(_){}await done(false,e);}
}
