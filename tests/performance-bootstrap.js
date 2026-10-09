/* Independent Zotero performance experiment, disposable profile only. */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const phases=[],checks=[],tick=()=>Date.now();
const perfPath=Services.prefs.getStringPref('marginfit.integrationResult').replace('result.json','perf-phase.json');
const PREF='extensions.marginfit.enabled';
const mark=async(phase,meta={})=>IOUtils.writeJSON(perfPath,{phase,at:Date.now(),...meta});
async function until(fn,label) {
  for(let i=0;i<300;i++){if(await fn())return;await sleep(80);}
  throw Error('Timeout '+label);
}
function startup(){
  if(!Services.prefs.getBoolPref('marginfit.integrationProfile',false))return;
  Zotero.uiReadyPromise.then(run).catch(e=>finish({passed:false,error:String(e),stack:e.stack}));
}
async function finish(report){
  await IOUtils.writeJSON(Services.prefs.getStringPref('marginfit.integrationResult'),{
    version:Zotero.version,checks,measurements:{phases},...report});
  await mark('done');
  Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
}
async function run(){
  try{
    await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
    const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
    const f=Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
    f.initWithPath(Services.prefs.getStringPref('marginfit.integrationXPI'));
    const installer=await AddonManager.getInstallForFile(f);await installer.install();
    Services.prefs.setBoolPref(PREF,true);
    const source=PathUtils.join(Services.prefs.getStringPref('marginfit.integrationFixtures'),'asymmetric-book.pdf');
    const item=await Zotero.Attachments.importFromFile({file:source});
    const reader=await Zotero.Reader.open(item.id,{position:{pageIndex:7,rects:[[200,390,220,410]]}});
    await until(()=>Zotero.MarginFit?.controllers.get(reader._internalReader?._primaryView),'attach');
    const c=Zotero.MarginFit.controllers.get(reader._internalReader._primaryView);
    await until(()=>c.session.models&&c.session.cache.has(8),'L1 L2');
    await sleep(900);
    const smartScale=c.viewer.currentScale;
    Services.prefs.setBoolPref(PREF,false);
    reader._internalReader.zoomPageWidth();
    await sleep(300);
    const nativeScale=c.viewer.currentScale;
    const values={calls:0,ms:0,pageCalls:0,pageMs:0,detected:0,detectorMs:0};
    const input=c.input.bind(c),page=c.page.bind(c),detect=c.session.detect.bind(c.session);
    c.input=(...args)=>{const s=tick();values.calls++;const result=input(...args);values.ms+=tick()-s;return result;};
    c.page=(...args)=>{const s=tick();values.pageCalls++;const result=page(...args);values.pageMs+=tick()-s;return result;};
    c.session.detect=async(...args)=>{const s=tick();values.detected++;const v=await detect(...args);values.detectorMs+=tick()-s;return v;};
    const scenarios=[
      ['off-native',false,nativeScale],['on-native',true,nativeScale],
      ['off-smart',false,smartScale],['on-smart',true,smartScale],
      ['on-native-repeat',true,nativeScale],['off-native-repeat',false,nativeScale]
    ];
    for(const [label,enabled,scale] of scenarios){
      Services.prefs.setBoolPref(PREF,enabled);
      await sleep(240);
      c.viewer.currentScaleValue=scale;
      c.manual=true;
      c.cancelTimer();
      await sleep(650);
      const box=c.container,max=Math.max(0,box.scrollHeight-box.clientHeight);
      box.scrollTop=Math.min(max,Math.round(max*0.12));
      await sleep(150);
      const initial={...values},start=tick();
      await mark(label,{enabled,scale,max});
      for(let i=0;i<140;i++){
        box.dispatchEvent(new c.win.WheelEvent('wheel',{deltaY:50,bubbles:true}));
        box.scrollTop=Math.round(max*(0.12+0.74*(i/140)));
        await sleep(18);
      }
      phases.push({label,enabled,scale,elapsedMs:tick()-start,steps:140,
        inputCalls:values.calls-initial.calls,inputMs:values.ms-initial.ms,
        pageCalls:values.pageCalls-initial.pageCalls,pageMs:values.pageMs-initial.pageMs,
        detected:values.detected-initial.detected,detectorMs:values.detectorMs-initial.detectorMs,
        scrollMax:max});
      checks.push(label);
      await mark('gap',{last:label});await sleep(400);
    }
    await finish({passed:true,smartScale,nativeScale});
  }catch(error){await finish({passed:false,error:String(error),stack:error.stack});}
}
