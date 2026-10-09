const {test}=require('node:test');
const assert=require('node:assert/strict');
global.MarginFitCore=require('../src/core.js');
const {Controller}=require('../src/runtime.js');
function setup() {
  const listeners=new Map();
  const emitter={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};
  const container={...emitter,clientWidth:640,clientHeight:800,scrollLeft:0,scrollTop:0,
    getBoundingClientRect:()=>({left:0,right:640,top:0,bottom:800})};
  const vp={scale:4/3,rotation:0,width:800,height:1066.67,clone:()=>({...vp,scale:1,width:600,height:800})};
  const page={viewport:vp,div:{getBoundingClientRect:()=>({left:0,right:800,top:0,bottom:1066.67})}};
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
  const session=new global.MarginFitCore.Session(1,async()=>record);
  const controller=new Controller(view,session,host);
  return {controller,host,viewer,session,record,view,nativeWidth,nativeHeight,stats,errors,
    enable(){enabled=true;},advance(ms){time+=ms;},getStats:()=>lastStats};
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
  assert.ok(Math.abs(f.viewer.currentScale-(624/(316*4/3)))<1e-6);
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
