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
 const bar=doc.querySelector('.marginfit-toolbar'),width=bar.querySelector('[data-marginfit="width"]'),height=bar.querySelector('[data-marginfit="height"]'),detect=bar.querySelector('[data-marginfit="detect"]');
 const nativeParent=zoom.parentNode;
 ok(bar.parentNode===nativeParent,'buttons share native zoom container');
 ok(bar.previousElementSibling===zoom,'buttons follow Reset Zoom');
 const color=n=>win.getComputedStyle(n).color;
 measurements.colors={native:color(plus),height:color(height),detect:color(detect)};
 ok(color(plus)===color(width)&&color(width)===color(height)&&color(height)===color(detect),'same foreground as native zoom');
 ok(height.getAttribute('aria-pressed')==='false','height initially unselected');
 ok(width.getAttribute('aria-pressed')==='true','Fit Width initially selected');
 ok(win.getComputedStyle(width).boxShadow!=='none','Fit Width selected has a visible ring');
 ok(win.getComputedStyle(zoom).display==='none','original native Reset Zoom is hidden');
 ok(detect.getAttribute('aria-pressed')==='true','detect selected when enabled');
 ok(win.getComputedStyle(detect).boxShadow!=='none','detect selected has visible ring');
 height.click();await until(()=>height.getAttribute('aria-pressed')==='true','height mode selected');
 await until(()=>{const c=plugin.controllers.get(reader._internalReader._primaryView);
   return c?.appliedEpoch===c?.epoch;},'height fit settled before subsequent toolbar assertions');
 ok(win.getComputedStyle(height).boxShadow!=='none','height selected has visible ring');
 ok(width.getAttribute('aria-pressed')==='false','width deselected by height');
 const controller=plugin.controllers.get(reader._internalReader._primaryView);
 const originalScale=controller.viewer.currentScale,originalY=controller.container.scrollTop;
 height.click();
 await until(()=>plugin.mode()==='off'&&height.getAttribute('aria-pressed')==='false',
   'second height click deactivates automatic fit');
 ok(width.getAttribute('aria-pressed')==='false','both width and height are off');
 ok(Math.abs(controller.viewer.currentScale-originalScale)<.001,
   'turning height off preserves current scale');
 ok(Math.abs(controller.container.scrollTop-originalY)<2,
   'turning height off preserves scroll position');
 height.click();
 await until(()=>plugin.mode()==='height','third height click reactivates');
 width.click();
 await until(()=>plugin.mode()==='width','dedicated width switches from Height');
 ok(width.getAttribute('aria-pressed')==='true','width shows active state');
 ok(height.getAttribute('aria-pressed')==='false','height is mutually exclusive');
 width.click();
 await until(()=>plugin.mode()==='off','second width click switches fit off');
 ok(width.getAttribute('aria-pressed')==='false','width selection clears');
 height.click();
 await until(()=>plugin.mode()==='height','height reactivated after both-off');
 const count=doc.querySelectorAll('.marginfit-toolbar').length;
 plugin.toolbar({reader,doc,append:node=>doc.querySelector('.section')?.append(node)});
 ok(doc.querySelectorAll('.marginfit-toolbar').length===count,'repeat callback no duplicate');
 ok(bar.parentNode===nativeParent&&bar.previousElementSibling===zoom,'callback does not reposition right');
 const alternate=doc.createElement('div');
 alternate.className='marginfit-ui-test-target';
 nativeParent.parentNode.append(alternate);
 alternate.append(bar);ok(bar.parentNode===alternate,'misplacement simulated');
 plugin.discover();ok(bar.parentNode===nativeParent&&bar.previousElementSibling===zoom,'discovery repairs misplaced controls');
 alternate.remove();
 const c=plugin.controllers.get(reader._internalReader._primaryView);
 await c.request('width');
 await until(()=>c.metrics.lastHorizontalFit,'horizontal layout metrics');
 const m=c.metrics.lastHorizontalFit;measurements.lastHorizontalFit=m;
 ok(Number.isFinite(m.leftMargin)&&Number.isFinite(m.rightMargin)&&Number.isFinite(m.delta),'left/right visible space measurable');
 ok(Math.abs(m.delta)<2,'standard Width Fit centers inside actual scrollable area within 2 CSS pixels');
 ok(m.viewportRectWidth>=m.viewportClientWidth,'scrollbar excluded from centering diagnostics');
 plugin.status(c.view,'background');
 ok(detect.title.includes('dark/nonwhite page edges'),'fallback explains detected page class');
 plugin.updateButtons();
 ok(detect.title.includes('dark/nonwhite page edges'),'fallback explanation survives toolbar update');
 plugin.status(c.view,null);
 detect.click();await until(()=>detect.getAttribute('aria-pressed')==='false','detect OFF');
 ok(win.getComputedStyle(detect).boxShadow==='none','OFF selection ring cleared');
 ok(bar.parentNode===nativeParent,'preference update preserves native positioning');
 // Replaced Width/Height controls remain usable when margin recognition is disabled.
 // Width is already active from the horizontal-fit check above: first click turns it off.
 width.click();await until(()=>plugin.mode()==='off','Fit Width toggles OFF with detection disabled');
 width.click();
 await until(()=>plugin.mode()==='width'&&width.getAttribute('aria-pressed')==='true',
   'Fit Width uses native PDF fit when detection is OFF');
 height.click();
 await until(()=>plugin.mode()==='height'&&height.getAttribute('aria-pressed')==='true',
   'Fit Height uses native PDF fit when detection is OFF');
 height.click();
 await until(()=>plugin.mode()==='off','native-fit mode can be switched off');
 ok(win.getComputedStyle(zoom).display==='none','native Reset Zoom remains hidden when detection is OFF');
 // Master Detect Margins is independent of the fit-mode pair.
 detect.click();await until(()=>plugin.enabled(),'detect enabled again');
 height.click();await until(()=>plugin.mode()==='height','height mode enabled for persistence check');
 height.click();await until(()=>plugin.mode()==='off','both fit modes turned off');
 const writes=c.metrics.writes.length;
 const keepScale=c.viewer.currentScale,keepTop=c.container.scrollTop;
 await sleep(900);
 ok(c.metrics.writes.length===writes,'no delayed automatic fit after switch OFF');
 ok(c.viewer.currentScale===keepScale && Math.abs(c.container.scrollTop-keepTop)<2,
   'fit OFF preserves the visible reader after idle');
 const other=await Zotero.Attachments.importFromFile({file:filename});
 const reader2=await Zotero.Reader.open(other.id);
 await until(()=>plugin.controllers.get(reader2._internalReader?._primaryView),'second document controller');
 const c2=plugin.controllers.get(reader2._internalReader._primaryView);
 ok(c2.mode==='off','fit OFF persists for newly opened PDFs');
 await sleep(800);
 ok(c2.metrics.writes.length===0,'new PDF stays unmodified when both modes OFF');
 height.click();await until(()=>c2.mode==='height','mode change propagates to other PDF reader');
 height.click();await until(()=>c2.mode==='off','turning off propagates to other PDF reader');
 plugin.stop();
 ok(win.getComputedStyle(zoom).display!=='none','native Reset Zoom restores on plugin shutdown');
 await finish({passed:true,measurements});
 }catch(e){await finish({passed:false,error:String(e),stack:e.stack,measurements});}}
