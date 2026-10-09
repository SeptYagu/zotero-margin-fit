const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
function legacy(content,viewport){
 let box=null;
 for(const item of content.items||[]){
  if(!item.str?.trim()||!item.transform)continue;
  const t=C.multiply(viewport.transform,item.transform);
  const length=Math.hypot(t[0],t[1]),h=Math.hypot(t[2],t[3]);
  if(!length||!h)continue;
  const style=content.styles?.[item.fontName]||{};
  const ascent=Number.isFinite(style.ascent)?style.ascent:1;
  const descent=Number.isFinite(style.descent)?style.descent:-0.3;
  const ux=t[0]/length,uy=t[1]/length,vx=t[2]/h,vy=t[3]/h;
  const advance=Math.abs(item.width*viewport.scale);
  const points=[];
  for(const x of [0,advance])for(const y of [descent*h,ascent*h])
    points.push([t[4]+ux*x+vx*y,t[5]+uy*x+vy*y]);
  box=C.union(box,[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),
    Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]);
 }
 return box && [C.clamp(box[0],0,viewport.width),C.clamp(box[1],0,viewport.height),
  C.clamp(box[2],0,viewport.width),C.clamp(box[3],0,viewport.height)];
}
test('10,000 deterministic randomized font transforms preserve legacy bounds',()=>{
 let state=0x53724a;const rnd=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
 const viewportRotations=[[1,0,0,-1,0,800],[0,1,1,0,0,0],[-1,0,0,1,600,0],[0,-1,-1,0,800,600]];
 for(let trial=0;trial<10000;trial++){
  const rotation=trial%4;
  const vp={scale:0.5+rnd()*2,transform:viewportRotations[rotation],width:rotation%2?800:600,height:rotation%2?600:800};
  const entries=[];
  for(let j=0,n=1+(trial%7);j<n;j++){
   const angle=rnd()*Math.PI*2,stretch=0.01+rnd()*40,skew=(rnd()-0.5)*10;
   entries.push({str:(trial%23===0 && j===0)?'':'Ab',fontName:'F',width:rnd()*300,
    transform:[Math.cos(angle)*stretch,Math.sin(angle)*stretch,
      skew-Math.sin(angle)*stretch,Math.cos(angle)*stretch,-100+rnd()*900,-100+rnd()*1100]});
  }
  const content={items:entries,styles:{F:{ascent:0.6+rnd(),descent:-rnd()*0.5}}};
  const a=legacy(content,vp),b=C.textBox(content,vp);
  if(a===null||b===null){assert.equal(a,b);continue}
  for(let k=0;k<4;k++)assert.ok(Math.abs(a[k]-b[k])<=1e-6,JSON.stringify({trial,k,a,b}));
 }
});
test('single-pass callback observes every eligible text rectangle without changing union',()=>{
 const content={items:[{str:'hello',fontName:'F',width:20,transform:[12,0,0,12,70,200]},
   {str:'23',fontName:'F',width:10,transform:[12,0,0,12,310,760]}],styles:{F:{ascent:.8,descent:-.2}}};
 const vp={transform:[1,0,0,-1,0,800],scale:1,width:600,height:800};
 const hits=[];const a=C.textBox(content,vp, (item,l,t,r,b)=>hits.push({text:item.str,rect:[l,t,r,b]}));
 assert.deepEqual(a,C.textBox(content,vp));assert.equal(hits.length,2);
 assert.ok(hits.every(h=>h.rect.every(Number.isFinite)));
});
