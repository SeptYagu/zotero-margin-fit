const {test}=require('node:test');
const assert=require('node:assert/strict');
global.MarginFitCore=require('../src/core.js');
const {Controller}=require('../src/runtime.js');
function setup(count=1) {
  const listeners=new Map();
  const emitter={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};
  const container={...emitter,clientWidth:640,clientHeight:800,scrollLeft:0,scrollTop:0,
    getBoundingClientRect:()=>({left:0,right:640,top:0,bottom:800})};
  const vp={scale:4/3,rotation:0,width:800,height:1066.67,clone:()=>({...vp,scale:1,width:600,height:800})};
  const page={viewport:vp,div:{getBoundingClientRect:()=>({left:-container.scrollLeft,right:600*vp.scale-container.scrollLeft,
    top:-container.scrollTop,bottom:800*vp.scale-container.scrollTop})}};
  const viewer={container,currentScale:1,currentPageNumber:1,getPageView:()=>page,
    _getVisiblePages:()=>({views:[{id:1,view:page}]})};
  Object.defineProperty(viewer,'currentScaleValue',{set(value){viewer.currentScale=value;page.viewport.scale=value*4/3;}});
  const bus={on(){},off(){}};
  const win={...emitter,Object,PDFViewerApplication:{pdfViewer:viewer,eventBus:bus}};
  const nativeWidth=()=>{viewer.native='width';},nativeHeight=()=>{viewer.native='height';};
  let lastStats;
  const stats=data=>{lastStats=data;};
  const view={_iframeWindow:win,zoomPageWidth:nativeWidth,zoomPageHeight:nativeHeight,
    _onChangeViewStats:stats,_updateViewStats(){this._onChangeViewStats({canZoomReset:false});}};
  let time=1000,enabled=false;
  const errors=[];
  const host={mode:()=> 'width',setMode(){},enabled:()=>enabled,now:()=>time,
    setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:clearTimeout,status(){},error:e=>errors.push(e)};
  const record={raw:[100,150,400,650],width:600,height:800,rotation:0,quality:'reliable'};
  const session=new global.MarginFitCore.Session(count,async()=>record);
  const controller=new Controller(view,session,host);
  return {controller,host,viewer,session,record,view,nativeWidth,nativeHeight,stats,errors,
    enable(value=true){enabled=value;session.setEnabled(value);},advance(ms){time+=ms;},getStats:()=>lastStats};
}
test('original native width/height pass through when disabled; stats and methods restore',()=>{
  const f=setup();f.view.zoomPageWidth();assert.equal(f.viewer.native,'width');
  f.view.zoomPageHeight();assert.equal(f.viewer.native,'height');
  assert.equal(f.getStats().canZoomReset,false);
  f.enable();f.view._updateViewStats();assert.equal(f.getStats().canZoomReset,true);
  f.controller.close();assert.equal(f.view.zoomPageWidth,f.nativeWidth);assert.equal(f.view.zoomPageHeight,f.nativeHeight);
  assert.equal(f.view._onChangeViewStats,f.stats);assert.equal(f.getStats().canZoomReset,false);
});
test('native PDF.js units fit the real 96/72 CSS conversion and asymmetric offset',async()=>{
  const f=setup();f.enable();
  await f.controller.apply(f.record,1,0,true);
  assert.ok(Math.abs(f.viewer.currentScale-(624/(332*4/3)))<1e-6);
  assert.ok(f.viewer.container.scrollLeft>0);
  assert.equal(f.controller.metrics.writes.length,2);f.controller.close();
});
test('no automatic scale or position writes before 500ms or after a newer input epoch',async()=>{
  const f=setup();f.enable();
  await f.controller.apply(f.record,1,0);
  assert.equal(f.controller.metrics.writes.length,0);
  f.advance(500);f.controller.input();
  await f.controller.apply(f.record,1,0);
  assert.equal(f.controller.metrics.writes.length,0);f.controller.close();
});
test('idle auto fitting preserves a reading coordinate and writes once without a helper failure',async()=>{
  const f=setup();f.enable();f.advance(500);
  await f.controller.apply(f.record,1,0);
  assert.equal(f.controller.metrics.writes.length,2);
  assert.equal(f.errors.length,0);f.controller.close();
});
test('closing or switching off during an async explicit request discards the late result',async()=>{
  const f=setup();f.enable();let release;
  f.session.detect=()=>new Promise(r=>{release=r;});
  const pending=f.controller.request('width');
  await new Promise(r=>setTimeout(r,0));f.controller.close();release(f.record);
  await pending;assert.equal(f.controller.metrics.writes.length,0);
});
test('initial width fitting retains a restored PDF coordinate instead of aligning the content top',async()=>{
  const f=setup();f.enable();f.viewer.container.scrollTop=200;
  const before=(200+400)/f.viewer.getPageView(0).viewport.scale;
  await f.controller.apply(f.record,1,0,false,true);
  const after=(f.viewer.container.scrollTop+400)/f.viewer.getPageView(0).viewport.scale;
  assert.ok(Math.abs(after-before)<1e-6);f.controller.close();
});
test('idle width fitting does not assign scrollTop when scale stays unchanged, including page margins',async()=>{
  const f=setup();f.enable();f.advance(500);
  f.viewer.currentScaleValue=624/(332*4/3);f.controller.anchor=f.viewer.currentScale;
  let top=25,writes=0;
  Object.defineProperty(f.viewer.container,'scrollTop',{get:()=>top,set(v){top=v;writes++;}});
  await f.controller.apply(f.record,1,0);
  assert.equal(writes,0);assert.equal(top,25);f.controller.close();
});
test('necessary idle zoom preserves the reading coordinate without clamping it to the content box',async()=>{
  const f=setup();f.enable();f.advance(500);
  f.record.raw=[100,400,400,700];
  f.viewer.container.scrollTop=10;
  const before=(10+400)/f.viewer.getPageView(0).viewport.scale;
  await f.controller.apply(f.record,1,0);
  const after=(f.viewer.container.scrollTop+400)/f.viewer.getPageView(0).viewport.scale;
  assert.ok(f.viewer.currentScale>1);assert.ok(Math.abs(after-before)<1e-6);f.controller.close();
});
test('idle height fitting retains vertical position instead of centering the page again',async()=>{
  const f=setup();f.enable();f.advance(500);f.controller.mode='height';
  f.viewer.currentScaleValue=784/(532*4/3);f.controller.anchor=f.viewer.currentScale;
  f.viewer.container.scrollTop=45;
  await f.controller.apply(f.record,1,0);
  assert.equal(f.viewer.container.scrollTop,45);f.controller.close();
});
test('a viewport center in the inter-page gap defers automatic fitting without snapping to content',async()=>{
  const f=setup();f.enable();f.advance(500);
  const page=f.viewer.getPageView(0);
  page.div.getBoundingClientRect=()=>({left:0,right:800,top:-660,bottom:390});
  f.viewer.container.scrollTop=660;
  await f.controller.apply(f.record,1,0);
  assert.equal(f.viewer.currentScale,1);assert.equal(f.viewer.container.scrollTop,660);
  assert.equal(f.controller.metrics.writes.length,0);f.controller.close();
});
test('explicit fitting still warms missing neighbors after idle without another view adjustment',async()=>{
  const f=setup(24);f.enable();f.viewer.currentPageNumber=8;
  f.viewer._getVisiblePages=()=>({views:[{id:8,view:f.viewer.getPageView(7)}]});
  await f.session.l1();f.session.metrics.analyzed.length=0;
  await f.controller.request('width');const writes=f.controller.metrics.writes.length;
  f.advance(500);await f.controller.refine();
  assert.deepEqual(f.session.metrics.analyzed,[8,9,10,7]);
  assert.equal(f.controller.metrics.writes.length,writes);f.controller.close();
});
test('switching detection off finishes only the in-flight L1 page and resumes from cache on enable',async()=>{
  const f=setup(24);let release,started=[];
  f.session.detect=async p=>{started.push(p);if(started.length===1)await new Promise(r=>release=r);return f.record;};
  f.enable();const pending=f.controller.begin();
  await new Promise(r=>setTimeout(r,0));f.enable(false);f.controller.toggle();release();await pending;
  assert.deepEqual(started,[5]);assert.equal(f.session.models,null);
  assert.equal(f.session.cache.has(5),true);
  f.enable();f.session.setEnabled(true);await f.session.l1();
  assert.deepEqual(started,[5,6,11,12,17,18]);f.controller.close();
});

test('scroll bursts coalesce expensive visible-page geometry reads',async()=>{
  const f=setup();f.enable();
  let calls=0;
  const original=f.controller.page.bind(f.controller);
  f.controller.page=(...args)=>{calls++;return original(...args);};
  for(let i=0;i<80;i++) f.controller.input();
  assert.equal(calls,0,'no synchronous geometry read per input');
  await new Promise(r=>setTimeout(r,115));
  assert.ok(calls<=2,'coalesced geometry read once per burst');
  f.controller.close();
});
test('OFF scroll path does not inspect visible-page geometry',async()=>{
  const f=setup();
  let calls=0;
  f.controller.page=()=>{calls++;return 1;};
  for(let i=0;i<50;i++) f.controller.input();
  await new Promise(r=>setTimeout(r,90));
  assert.equal(calls,0);
  f.controller.close();
});

test('trailing scroll debounce avoids page geometry during continuous input',()=>{
 const f=setup();f.enable();
 // Virtual clock avoids host scheduling delays making synthetic input look idle.
 let now=0,nextId=0;
 const timers=new Map();
 f.host.setTimeout=(fn,ms)=>{
   const id=++nextId;timers.set(id,{at:now+ms,fn});return id;
 };
 f.host.clearTimeout=id=>timers.delete(id);
 const advance=ms=>{
   const end=now+ms;
   while(true){
     const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
     if(!next||next[1].at>end)break;
     now=next[1].at;timers.delete(next[0]);next[1].fn();
   }
   now=end;
 };
 let calls=0;
 const old=f.controller.page.bind(f.controller);
 f.controller.page=(...args)=>{calls++;return old(...args)};
 for(let n=0;n<12;n++) {
   f.controller.input();
   advance(19);
   assert.equal(calls,0,'no geometry reads while input continues');
 }
 advance(180);
 assert.equal(calls,1,'one primary-page read once input stops');
 f.controller.close();
});
