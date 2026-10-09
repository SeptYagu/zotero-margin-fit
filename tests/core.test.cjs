const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const record = (raw=[20,40,120,180],rotation=0) => ({raw,width:200,height:220,rotation,quality:'reliable',version:1});
test('L1 samples exactly three adjacent odd/even pairs and deduplicates short documents',()=>{
  assert.deepEqual(C.samples(24),[5,6,11,12,17,18]);
  assert.deepEqual(C.samples(1),[1]);
  assert.deepEqual(C.samples(2),[1,2]);
});
test('L2 priority uses physical page numbers and clamps at each end',()=>{
  assert.deepEqual(C.neighbors(8,24),[8,9,10,11,7,6,5]);
  assert.deepEqual(C.neighbors(1,2),[1,2]);
});
test('L1 conservative parity unions retain alternating asymmetric binding margins',()=>{
  const cache=new Map([[1,record([20,40,120,180])],[2,record([80,30,180,200])],[3,record([25,45,125,185])]]);
  const models=C.parityModels(cache,[1,2,3]);
  assert.deepEqual(C.prediction(models,5,200,220,0).raw,[20,40,125,185]);
  C.prediction(models,6,200,220,0).raw.forEach((n,i)=>assert.ok(Math.abs(n-[80,30,180,200][i])<1e-8));
});
test('fixed safety is applied once to a copy and clamped at physical page edges',()=>{
  const raw=[3,40,198,180];
  assert.deepEqual(C.safeBox(raw,200,220),[0,24,200,196]);
  assert.deepEqual(raw,[3,40,198,180]);
});
test('L3 compares cumulative ideal changes to the last actually applied anchor',()=>{
  let actual=1,anchor=1;
  const outputs=[];
  for(const target of [1,1.04,1.08,1.12]) {
    const r=record([0,0,84,200]); // 16-unit safety yields width 100
    const decision=C.scaleDecision(r,'width',{width:100*target,height:220},actual,anchor);
    if(decision.change) anchor=actual=decision.scale;
    outputs.push(actual);
  }
  assert.deepEqual(outputs,[1,1,1.08,1.08]);
});
test('dead zone yields to safety, explicit commands, and height axis',()=>{
  const r=record();
  const vp={width:132,height:172};
  assert.equal(C.scaleDecision(r,'width',vp,1.02,1.02).scale,1);
  assert.equal(C.scaleDecision(r,'width',{width:120,height:156},1,1,true).change,true);
  assert.equal(C.scaleDecision(r,'height',{width:40,height:344},1,1).scale,2);
});
test('primary page chooses visible area and keeps the previous page on a close tie',()=>{
  assert.equal(C.primaryPage([{id:2,area:100},{id:3,area:98}],3,1),3);
  assert.equal(C.primaryPage([{id:2,area:100},{id:3,area:50}],3,1),2);
});
test('text bounding includes footnotes and page numbers with rotated glyphs',()=>{
  const content={styles:{f:{ascent:0.8,descent:-0.2}},items:[
    {str:'Body',fontName:'f',width:60,transform:[10,0,0,10,30,100]},
    {str:'1',fontName:'f',width:5,transform:[5,0,0,5,130,10]}
  ]};
  const b=C.textBox(content,{transform:[1,0,0,-1,0,220],scale:1,width:200,height:220});
  assert.deepEqual(b,[30,112,135,211]);
  const rotated=C.textBox(content,{transform:[0,1,1,0,0,0],scale:1,width:220,height:200});
  assert.deepEqual(rotated,[9,30,108,135]);
});
test('raster detector keeps a single thin page-number pixel and fails safe on dark/blank pages',()=>{
  const data=new Uint8ClampedArray(10*10*4).fill(255);
  const i=(8*10+7)*4; data[i]=data[i+1]=data[i+2]=10;
  assert.deepEqual(C.inkBox({data,width:10,height:10}).box,[6,7,9,10]);
  data[0]=0;
  assert.equal(C.inkBox({data,width:10,height:10}).reason,'background');
  data.fill(255);
  assert.equal(C.inkBox({data,width:10,height:10}).reason,'blank');
});
test('serial queue enforces full L1 before any current-page detection and uses cache',async()=>{
  const analyzed=[]; let active=0,peak=0;
  const session=new C.Session(24,async p=>{
    active++; peak=Math.max(peak,active); analyzed.push(p);
    await new Promise(r=>setTimeout(r,1)); active--; return record();
  });
  const local=session.local(8,0,()=>true,()=>{});
  await Promise.all([local,session.l1()]);
  assert.equal(peak,1);
  assert.deepEqual(analyzed,[5,6,11,12,17,18,8,9,10,7]);
  assert.equal(session.cache.size,10);
  await session.local(8,0,()=>true,()=>{});
  assert.equal(analyzed.length,10);
});
test('stale queue work is dropped while the in-flight result can be safely cached',async()=>{
  const session=new C.Session(24,async()=>record());
  await session.l1();
  let valid=true,callback=0;
  session.detect=async()=>{valid=false;return record();};
  await session.local(8,0,()=>valid,()=>callback++);
  assert.equal(callback,0); assert.equal(session.cache.has(8),true); assert.equal(session.cache.has(9),false);
});
test('rotation invalidates exact-page cache without applying padding twice',async()=>{
  const session=new C.Session(1,async(p,r)=>record(undefined,r||0));
  await session.l1();
  await session.serial(()=>session.read(1,90));
  assert.equal(session.cache.get(1).rotation,90);
  assert.deepEqual(session.metrics.analyzed,[1,1]);
});
test('reversible hooks restore inherited methods and own descriptors exactly',()=>{
  const fn=()=>3,proto={fn},obj=Object.create(proto);
  const undo=C.hook(obj,'fn',()=>4);
  assert.equal(obj.fn(),4);undo(); assert.equal(obj.fn,fn);assert.equal(Object.hasOwn(obj,'fn'),false);
  Object.defineProperty(obj,'fn',{configurable:true,writable:false,value:fn});
  const descriptor=Object.getOwnPropertyDescriptor(obj,'fn');
  const restore=C.hook(obj,'fn',()=>5);restore();
  assert.deepEqual(Object.getOwnPropertyDescriptor(obj,'fn'),descriptor);
});
test('restoration does not overwrite another extension installed after ours',()=>{
  const obj={fn:()=>1};const undo=C.hook(obj,'fn',()=>2);const later=()=>3;obj.fn=later;undo();assert.equal(obj.fn,later);
});

test('L1 waits for scrolling activity before starting the next PDF render',async()=>{
  const analyzed=[];
  let firstStarted,release;
  const started=new Promise(r=>firstStarted=r);
  const block=new Promise(r=>release=r);
  const session=new C.Session(24,async p=>{
    analyzed.push(p);
    if(analyzed.length===1){firstStarted();await block;}
    return record();
  });
  const work=session.l1();
  await started;
  session.noteActivity();
  release();
  await new Promise(r=>setTimeout(r,110));
  assert.deepEqual(analyzed,[5]);
  await work;
  assert.deepEqual(analyzed,[5,6,11,12,17,18]);
  session.close();
});

test('explicit Fit unblocks L1 idle cooldown without changing sample order',async()=>{
  const started=Date.now(), analyzed=[];
  const session=new C.Session(24,async p=>{analyzed.push(p);return record();});
  session.noteActivity();
  const pending=session.l1();
  await new Promise(r=>setTimeout(r,20));
  session.allowExplicitRequest();
  await pending;
  assert.ok(Date.now()-started<400,'explicit user action must not wait for full scroll cooldown');
  assert.deepEqual(analyzed,[5,6,11,12,17,18]);
  session.close();
});
