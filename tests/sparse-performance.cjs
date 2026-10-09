"use strict";
// Deterministic in-process scan-only comparison; not an end-to-end Zotero CPU claim.
const {performance}=require("node:perf_hooks");
const C=require("../src/core.js");
const W=600,H=800;
function scene(type) {
 const d=new Uint8ClampedArray(W*H*4).fill(255);
 const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){
  const o=(j*W+i)*4;d[o]=d[o+1]=d[o+2]=5;
 }};
 if(type==="text")for(let y=110;y<655;y+=16)rect(112,y,340,8);
 if(type==="score"){
  for(let y=110;y<245;y+=18)rect(115,y,330,8);
  for(let y=300;y<625;y+=10)rect(115,y,343,1);
  rect(35,753,15,12);rect(238,752,95,12);
 }
 if(type==="dense")rect(1,1,W-2,H-2);
 return {width:W,height:H,data:d};
}
const cycles=65;
function benchmark(f,im) {
 for(let i=0;i<15;i++)f(im);
 const start=performance.now();
 for(let i=0;i<cycles;i++)f(im);
 return +(performance.now()-start).toFixed(2);
}
for(const name of ["text","score","blank","dense"]){
 const im=scene(name);
 const full=C.inkBox(im),s=C.sparseInkBox(im);
 const oldMs=benchmark(C.inkBox,im),sparseMs=benchmark(C.sparseInkBox,im);
 console.log(JSON.stringify({scene:name,iterations:cycles,fullMs:oldMs,
  sparseMs,speedup:+(oldMs/sparseMs).toFixed(2),
  visited:s.visited??0,visitedFraction:s.visited?+(s.visited/(W*H)).toFixed(3):0,
  fullQuality:full.quality,sparseQuality:s.quality,
  bodyReason:C.sparseBodyWidth(s,W,H).reason}));
}
