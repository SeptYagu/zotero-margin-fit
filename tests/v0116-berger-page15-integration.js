const checks=[],rows=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=20000){const t=Date.now()+ms;while(Date.now()<t){try{if(fn())return true}catch(_){}await sleep(100)}return false}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;Zotero.uiReadyPromise.then(run).catch(e=>done(false,e))}
async function done(passed,error){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),{passed,checks,rows,error:error&&String(error),stack:error?.stack,measurements:{}});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit)}
async function run(){try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
 const x=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);x.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));await (await AddonManager.getInstallForFile(x)).install();
 const path=Services.prefs.getStringPref('marginfit.integrationSourcePDF');
 const item=await Zotero.Attachments.importFromFile({file:path});
 const reader=await Zotero.Reader.open(item.id,{position:{pageIndex:13}});
 if(!await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)))throw Error('controller');
 const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
 c.viewer.currentPageNumber=14;await sleep(300);await c.request('width');await sleep(700);
 const rec=await c.session.visible(15,c.viewer.getPageView(14).viewport.rotation,()=>true);
 function snap(mark){
   const p=c.viewer.getPageView(14),r=p.div.getBoundingClientRect(),root=c.container.getBoundingClientRect();
   const unit=p.viewport.scale/c.viewer.currentScale;
   const scale=c.viewer.currentScale*unit;
   const safe=[rec.raw[0]-16,rec.raw[1]-16,rec.raw[2]+16,rec.raw[3]+16];
   const L=r.left-root.left+safe[0]*scale,R=root.left+c.container.clientWidth-r.left-safe[2]*scale;
   rows.push({mark,mode:c.mode,viewerPage:c.viewer.currentPageNumber,page:c.page(),
    cLastPage:c.lastPage,manual:c.manual,held:c.userHeldPage,epoch:c.epoch,appliedEpoch:c.appliedEpoch,
    scrollLeft:c.container.scrollLeft,scale:c.viewer.currentScale,
    left:L,right:R,delta:L-R,lastHorizontalFit:c.metrics.lastHorizontalFit,
    writes:c.metrics.writes.slice(-6)});
 }
 snap('on page14 initial width');
 c.viewer.currentPageNumber=15; await sleep(1500);
 snap('navigate page 15 via native viewer.currentPageNumber');
 if(Math.abs(rows.at(-1).delta)>3)
   throw Error('Berger p15 was not centered automatically on crossing from page 14');
 if(c.metrics.lastHorizontalFit?.page!==15)
   throw Error('Width Fit did not update page 15 geometry after turning the page');
 checks.push('Berger p15 automatic native page-turn width centering delta <= 3 CSS px');
 const adjusted=c.container.scrollLeft+31;
 c.container.scrollLeft=adjusted;
 c.input(true);await sleep(950);
 snap('manual in-page horizontal movement retained');
 if(Math.abs(c.container.scrollLeft-adjusted)>2)
   throw Error('in-page user movement was overwritten by automatic recenter');
 checks.push('Manual horizontal movement within page 15 is respected');
 await c.request('width');await sleep(400);
 snap('after explicit width refit');
 if(Math.abs(rows.at(-1).delta)>3)throw Error('explicit p15 width recenter failed');
 checks.push('Explicit Fit Width recenters again after manual movement');
 await c.request('height');await sleep(430);
 const record=c.session.cache.get(15);
 const safe=[Math.max(0,record.raw[0]-16),Math.max(0,record.raw[1]-8),
   Math.min(record.width,record.raw[2]+16),Math.min(record.height,record.raw[3]+8)];
 const unit=c.viewer.getPageView(14).viewport.scale/c.viewer.currentScale;
 const scaleExpected=Math.min(5,Math.max(.1,(c.container.clientHeight-16)/unit/(safe[3]-safe[1])));
 rows.push({mark:'height safe-bounds',page:15,raw:record.raw,safe,
   topGutter:safe[1],bottomGutter:record.height-safe[3],scaleExpected,scaleActual:c.viewer.currentScale});
 if(Math.abs(scaleExpected-c.viewer.currentScale)>0.012)
    throw Error('Height Fit did not use 8-unit top/bottom safety margin');
 checks.push('Fit Height preserves 8 PDF-unit top/bottom padding, 16 horizontally');
 await done(true);
}catch(e){await done(false,e)}}
