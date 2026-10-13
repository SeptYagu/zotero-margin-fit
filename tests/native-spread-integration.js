const checks=[],details={},sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg)};
async function until(fn,ms=18000){const end=Date.now()+ms;while(Date.now()<end){try{if(fn())return true}catch(_){}await sleep(100)}return false}
function startup(){if(!Services.prefs.getBoolPref("marginfit.integrationProfile",false))return;Zotero.uiReadyPromise.then(run).catch(e=>done(false,e))}
async function done(passed,error){await IOUtils.writeJSON(Services.prefs.getStringPref("marginfit.integrationResult"),{passed,checks,details,error:error&&String(error),stack:error?.stack,measurements:{}});Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit)}
async function run(){try{
 await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad("item");
 const {AddonManager}=ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
 const f=Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);f.initWithPath(Services.prefs.getStringPref("marginfit.integrationXPI"));await (await AddonManager.getInstallForFile(f)).install();
 const fixture=PathUtils.join(Services.prefs.getStringPref("marginfit.integrationFixtures"),"asymmetric-book.pdf");
 const item=await Zotero.Attachments.importFromFile({file:fixture});
 const reader=await Zotero.Reader.open(item.id,{position:{pageIndex:0}});
 assert(await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView)),"Plugin controller attached to native Zotero reader");
 const plugin=Zotero.MarginFit,c=plugin.controllers.get(reader._internalReader._primaryView),v=c.viewer;
 const doc=reader._iframeWindow.document;
 assert(await until(()=>!!doc.querySelector('.marginfit-toolbar [data-marginfit="spread"]')),"New native spread button visible next to fit controls");
 const b=doc.querySelector('.marginfit-toolbar [data-marginfit="spread"]');
 const bar=doc.querySelector('.marginfit-toolbar');
 assert(bar.querySelectorAll('button').length===4,"Toolbar contains Width, Height, Spread and Detect controls");
 let initial=v.spreadMode;
 details.states=[];
 function save(mark){const state={mark,spread:v.spreadMode,label:b.textContent,title:b.title,pressed:b.getAttribute('aria-pressed'),
   spreadGroups:[...v.viewer.querySelectorAll('.spread')].slice(0,3).map(node=>[...node.querySelectorAll('.page')].map(n=>Number(n.dataset.pageNumber)))};
   details.states.push(state);return state;}
 v.spreadMode=0;await sleep(180);plugin.updateButtons();save('single');
 assert(b.textContent==='1' && b.dataset.spreadMode==='0',"Single mode state shown as 1");
 b.click();await sleep(230);save('odd');
 assert(v.spreadMode===1 && b.textContent==='1|2',"First click selects native Odd Spreads");
 assert(details.states.at(-1).spreadGroups[0].join(',')==='1,2',"Odd spreads physically render 1-2 together");
 b.click();await sleep(230);save('even');
 assert(v.spreadMode===2 && b.textContent==='2|3',"Second click selects native Even Spreads");
 assert(details.states.at(-1).spreadGroups[0].join(',')==='1' &&
 details.states.at(-1).spreadGroups[1].join(',')==='2,3',"Even spreads physically render cover alone then 2-3");
 b.click();await sleep(230);save('single-again');
 assert(v.spreadMode===0 && b.dataset.spreadMode==='0',"Third click returns native Single mode");
 v.spreadMode=2;
 assert(await until(()=>b.dataset.spreadMode==='2'),"Native menu changes update button state through PDF.js event bus");
 // Height mode and Detect enabled: native spread group navigation should never
 // reduce the viewer to single-page PAGE layout.
 c.viewer.currentPageNumber=2;await sleep(200);
 await c.request('height');await sleep(250);
 assert(c.mode==='height' && v.scrollMode===0 && v.spreadMode===2,"Height Fit retains full continuous PDF and Even Spreads");
 const initialY=c.container.scrollTop;
 await c.snapToContent(4,2);await sleep(300);
 details.navigation={start:2,end:c.lastPage,scrollTop:c.container.scrollTop,
  mode:v.spreadMode,scrollMode:v.scrollMode,documentPages:v.viewer.querySelectorAll('.page').length};
 assert(c.lastPage===4 && v.spreadMode===2,"Height Fit navigates one complete Even Spread 2-3 to 4-5");
 assert(v.viewer.querySelectorAll('.page').length>10,"Native PDF.js pages remain mounted and continuously scrollable");
 v.currentPageNumber=5;await sleep(160);
 assert(c.page()===4,"Second page of Even Spread still identifies the entire 4-5 group");
 // User changes Zotero's native spread setting while Height Fit is active.
 v.spreadMode=1;await sleep(200);
 assert(b.dataset.spreadMode==='1',"Button reflects external Odd Spreads selection");
 await c.snapToContent(5,3);await sleep(200);
 assert(c.lastPage===5 && v.spreadMode===1,"Height Fit navigates native Odd Spread 3-4 to 5-6");
 // Detect disabled: still update the native button without detection coupling.
 Services.prefs.setBoolPref('extensions.marginfit.enabled',false);await sleep(170);
 assert(!plugin.enabled(),"Detect switched OFF without losing native spread mode");
 b.click();await sleep(160);
 assert(v.spreadMode===2 && b.dataset.spreadMode==='2',"Spread selector works with detection OFF");
 await c.snapToPage(6,4);await sleep(220);
 assert(c.lastPage===6,"Native physical-page height navigation still follows current spread");
 await done(true);
}catch(e){await done(false,e)}}
