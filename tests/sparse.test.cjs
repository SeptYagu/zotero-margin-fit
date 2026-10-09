"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const C=require("../src/core.js");
function image(w=600,h=800){
  const d=new Uint8ClampedArray(w*h*4);d.fill(255);
  const plot=(x,y,r=0)=>{
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(x+dx<0||y+dy<0||x+dx>=w||y+dy>=h)continue;
      const i=((y+dy)*w+x+dx)*4;d[i]=d[i+1]=d[i+2]=0;
    }
  };
  const rect=(x,y,ww,hh)=>{for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++)plot(i,j)};
  return {width:w,height:h,data:d,plot,rect};
}
test("sparse diagonal rows visit about a quarter, report estimated not verified",()=>{
  const im=image();im.rect(120,110,330,500);
  const s=C.sparseInkBox(im),full=C.inkBox(im);
  assert.equal(s.quality,"estimated");assert.ok(s.visited/(600*800)>.245&&s.visited/(600*800)<.255);
  assert.ok(s.box.every((n,i)=>Math.abs(n-full.box[i])<=4));
  assert.equal(s.inkByRow.length,800);
});
test("long horizontal and vertical hairlines are detected with slanted phase",()=>{
  const im=image(127,111);
  for(let x=15;x<120;x++)im.plot(x,45);
  for(let y=7;y<103;y++)im.plot(64,y);
  const s=C.sparseInkBox(im);
  assert.equal(s.quality,"estimated");
  assert.ok(s.box[0]<=16&&s.box[2]>=119);
  assert.ok(s.box[1]<=7&&s.box[3]>=102);
});
test("phase switching breaks constant diagonal alias, but does not assert perfect coverage",()=>{
  const im=image(128,128);
  for(let y=4;y<125;y++)im.plot(y+2,y);
  const s=C.sparseInkBox(im,4,16);
  assert.equal(s.quality,"estimated");
  assert.ok(s.hits>=10);
});
test("blank, dark corner, dense page fail conservatively",()=>{
  const blank=image(90,100);
  assert.equal(C.sparseInkBox(blank).quality,"fallback");
  blank.plot(0,0);
  assert.equal(C.sparseInkBox(blank).reason,"background");
  const dense=image(90,100);dense.rect(1,1,88,98);
  assert.equal(C.sparseInkBox(dense).reason,"dense-background");
});
test("stride=3 and odd width keep requested sampling density",()=>{
  const im=image(101,105);im.rect(25,20,60,60);
  const s=C.sparseInkBox(im,3,16);
  assert.equal(s.stride,3);
  assert.ok(s.visited/(101*105)>.32&&s.visited/(101*105)<.35);
});
module.exports={image};
