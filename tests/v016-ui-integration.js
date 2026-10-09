/* Standalone isolated Zotero reader toolbar regression. */
const checks=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(c,m)=>{if(!c)throw Error(m);checks.push(m);};
async function finish(r){await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),{checks,measurements:r.measurements||{},...r});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);}
function startup(){if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;Zotero.uiReadyPromise.then(run).catch(e=>finish({passed:false,error:String(e),stack:e.stack}));}
async function until(f,label){for(let i=0;i<200;i++){if(await f())return;await sleep(100);}throw Error('Timeout '+label);}
async function run(){let measurements={};try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
 const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
 const file=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
 file.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
 await (await AddonManager.getInstallForFile(file)).install();
 const filename=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
 const item=await Zotero.Attachments.importFromFile({file:filename});
 const reader=await Zotero.Reader.open(item.id);
 await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView),'controller');
 const plugin=Zotero.MarginFit,doc=reader._iframeWindow.document,win=reader._iframeWindow;
 const zoom=doc.getElementById('zoomAuto'),plus=doc.getElementById('zoomIn');
 await until(()=>doc.querySelector('.marginfit-toolbar')?.isConnected&&zoom,'toolbar');
 const bar=doc.querySelector('.marginfit-toolbar'),height=bar.querySelector('[data-marginfit="height"]'),detect=bar.querySelector('[data-marginfit="detect"]');
 const nativeParent=zoom.parentNode;
 ok(bar.parentNode===nativeParent,'buttons share native zoom container');
 ok(bar.previousElementSibling===zoom,'buttons follow Reset Zoom');
 const color=n=>win.getComputedStyle(n).color;
 measurements.colors={native:color(plus),height:color(height),detect:color(detect)};
 ok(color(plus)===color(height)&&color(height)===color(detect),'same foreground as native zoom');
 ok(height.getAttribute('aria-pressed')==='false','height initially unselected');
 ok(detect.getAttribute('aria-pressed')==='true','detect selected when enabled');
 ok(win.getComputedStyle(detect).boxShadow!=='none','detect selected has visible ring');
 height.click();await until(()=>height.getAttribute('aria-pressed')==='true','height mode selected');
 ok(win.getComputedStyle(height).boxShadow!=='none','height selected has visible ring');
 const count=doc.querySelectorAll('.marginfit-toolbar').length;
 plugin.toolbar({reader,doc,append:node=>doc.querySelector('.section')?.append(node)});
 ok(doc.querySelectorAll('.marginfit-toolbar').length===count,'repeat callback no duplicate');
 ok(bar.parentNode===nativeParent&&bar.previousElementSibling===zoom,'callback does not reposition right');
 const alternate=doc.querySelector('.section');
 ok(!!alternate&&alternate!==nativeParent,'right toolbar section exists');
 alternate.append(bar);ok(bar.parentNode===alternate,'misplacement simulated');
 plugin.discover();ok(bar.parentNode===nativeParent&&bar.previousElementSibling===zoom,'discovery repairs misplaced controls');
 const c=plugin.controllers.get(reader._internalReader._primaryView);
 await c.request('width');
 await until(()=>c.metrics.lastHorizontalFit,'horizontal layout metrics');
 const m=c.metrics.lastHorizontalFit;measurements.lastHorizontalFit=m;
 ok(Number.isFinite(m.leftMargin)&&Number.isFinite(m.rightMargin)&&Number.isFinite(m.delta),'left/right visible space measurable');
 detect.click();await until(()=>detect.getAttribute('aria-pressed')==='false','detect OFF');
 ok(win.getComputedStyle(detect).boxShadow==='none','OFF selection ring cleared');
 ok(bar.parentNode===nativeParent,'preference update preserves native positioning');
 await finish({passed:true,measurements});
 }catch(e){await finish({passed:false,error:String(e),stack:e.stack,measurements});}}
