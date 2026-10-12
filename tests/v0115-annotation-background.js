const checks=[],details={};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=21000){const t=Date.now()+ms;while(Date.now()<t){try{if(fn())return true}catch(_){}await sleep(100)}return false;}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;Zotero.uiReadyPromise.then(run).catch(e=>finish(false,e));}
async function finish(passed,error){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),{passed,checks,details,error:error&&String(error),stack:error?.stack,measurements:{}});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
async function run(){try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
 const x=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
 x.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));await (await AddonManager.getInstallForFile(x)).install();
 const path=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'display-only-annotation.pdf');
 const a=await Zotero.Attachments.importFromFile({file:path});
 const b=await Zotero.Attachments.importFromFile({file:PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'clean-scan.pdf')});
 const r1=await Zotero.Reader.open(a.id,{position:{pageIndex:0}});
 if(!await until(()=>Zotero.MarginFit?.controllers.get(r1._internalReader?._primaryView)))throw Error('A controller');
 const plugin=Zotero.MarginFit,c=plugin.controllers.get(r1._internalReader._primaryView);
 if(!await until(()=>c.session.cache.has(1)))throw Error('visible annotation detection');
 const visible=c.session.cache.get(1);
 details.visible={raw:visible.raw,quality:visible.quality};
 const r2=await Zotero.Reader.open(b.id,{position:{pageIndex:0}});
 if(!await until(()=>plugin.controllers.get(r2._internalReader?._primaryView)))throw Error('B controller');
 const page=c.app.pdfDocument.getPage(1), vp=c.viewer.getPageView(0).viewport;
 const source=(await page)?.wrappedJSObject;
 const annotations=(await source.getAnnotations({intent:'display'}))?.wrappedJSObject;
 details.annotationCount=annotations?.length;details.annotationRect=annotations?.[0]?.rect;
 if(!annotations?.length)throw Error('missing expected display annotation');
 c.session.cache.delete(1);
 const result=await c.session.read(1,vp.rotation,{cancelled:false});
 details.background={raw:result?.raw,quality:result?.quality,reason:result?.reason};
 if(!result||result.quality!=='reliable')throw Error('annotated background page must have reliable bounds');
 const raw=result.raw,ref=visible.raw;
 // Compare two detector outputs in the SAME PDF.js viewport coordinates.
 // PDF annotation rect itself is in PDF user-space, not viewport top-left.
 if(!(raw[0]<=ref[0]+3&&raw[1]<=ref[1]+3&&raw[2]>=ref[2]-3&&raw[3]>=ref[3]-3))
  throw Error('print-intent background bounds failed to include display-only annotation');
 checks.push('Background Print PDF.js bound encompasses display-only annotation appearance');
 if(!(raw[0]>0&&raw[2]<vp.width&&raw[1]>0&&raw[3]<vp.height))
  throw Error('annotation lost accurate crop; full-page fallback instead of detection');
 checks.push('Background annotated bounds remain precise instead of full-page fallback');
 await finish(true);
}catch(e){await finish(false,e);}}
