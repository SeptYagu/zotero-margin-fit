"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
global.MarginFitCore=require("../src/core.js");
const {Controller}=require("../src/runtime.js");
function setup(pad=12){
 const container={scrollLeft:120,clientWidth:100};
 const c={host:{bambooPad:()=>pad},viewer:{spreadMode:0},container,mode:"width",bamboo:null};
 const fitting={width:200,raw:[60,0,120,100]};
 const root={left:0};
 const page=(documentX,rotation=0)=>({viewport:{rotation},div:{
  getBoundingClientRect:()=>({left:documentX-container.scrollLeft})}});
 return {c,container,fitting,root,page,step:(p,docX,navigation=true)=>{
  const result=Controller.prototype.bambooTarget.call(c,p,fitting,page(docX),root,1,1000,777,navigation);
  if(navigation)container.scrollLeft=result.target;
  return result;
 }};
}
test("no anticipatory movement: the current safe scrollLeft is retained",()=>{
 const s=setup();
 s.step(1,80,false);
 const v=s.step(2,80);
 assert.equal(v.target,120);assert.equal(v.force,false);
 assert.deepEqual([s.c.bamboo.lo,s.c.bamboo.hi],[112,128]);
});
test("intersection narrows only on visited pages and moves minimum amount",()=>{
 const s=setup();
 s.step(1,80,false);
 const v=s.step(2,90);
 assert.equal(v.target,122);assert.equal(v.force,true);
 assert.deepEqual([s.c.bamboo.lo,s.c.bamboo.hi],[122,128]);
});
test("first incompatible page starts next group, never restores older anchor",()=>{
 const s=setup();
 s.step(1,80,false);
 s.step(2,90);
 const shifted=s.step(3,140);
 assert.equal(shifted.target,172);
 assert.deepEqual([s.c.bamboo.lo,s.c.bamboo.hi],[172,188]);
 const next=s.step(4,80);
 assert.equal(next.target,128);
 assert.deepEqual([s.c.bamboo.lo,s.c.bamboo.hi],[112,128]);
});
test("backward jump, zoom or viewport change invalidates old group",()=>{
 const s=setup();
 s.step(1,80,false);
 const jump=s.step(4,90);
 assert.deepEqual([s.c.bamboo.lo,s.c.bamboo.hi],[122,138]);
 s.container.clientWidth=120;
 const changed=s.step(5,90);
 assert.ok(changed.target<=s.container.scrollLeft+0.01);
 assert.equal(s.c.bamboo.width,120);
});
test("inactive experiment and native spread leave current original behavior",()=>{
 const s=setup(0);
 const inactive=s.step(1,80);
 assert.equal(inactive.target,777);assert.equal(s.c.bamboo,null);
 s.c.host.bambooPad=()=>12;
 s.c.viewer.spreadMode=1;
 const spread=s.step(2,90);
 assert.equal(spread.target,777);assert.equal(s.c.bamboo,null);
});
