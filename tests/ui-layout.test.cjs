"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
global.MarginFitCore=require("../src/core.js");
const {Plugin}=require("../src/runtime.js");
test("toolbar placement follows native Reset Zoom and synchronizes native theme color",()=>{
 const left={},right={};
 const native={style:{},color:"rgba(255, 255, 255, 0.55)"};
 const zoom={parentNode:left,after(bar){bar.parentNode=left;bar.previousElementSibling=zoom;bar.isConnected=true;}};
 const bar={parentNode:right,previousElementSibling:null,isConnected:true,style:{color:""}};
 const doc={getElementById(id){return id==="zoomAuto"?zoom:id==="zoomIn"?native:null;},defaultView:{getComputedStyle(x){return {color:x.color};}}};
 const place=Plugin.prototype.positionToolbar;
 assert.equal(place.call({},doc,bar,()=>{throw Error("Do not append on right");}),true);
 assert.equal(bar.parentNode,left);
 assert.equal(bar.previousElementSibling,zoom);
 assert.equal(bar.style.color,native.color);
 // A subsequent render callback must not relocate or duplicate.
 assert.equal(place.call({},doc,bar),true);
 native.color="rgba(0, 0, 0, 0.65)";
 place.call({},doc,bar);
 assert.equal(bar.style.color,native.color);
});
test("toolbar append is temporary only when zoom group is not mounted",()=>{
 const bar={isConnected:false,style:{color:""}};
 const doc={getElementById(){return null;}};
 let appended=0;
 assert.equal(Plugin.prototype.positionToolbar.call({},doc,bar,()=>{appended++;bar.isConnected=true;}),true);
 assert.equal(appended,1);
});
test("uncertain-margin tooltip describes known fallback cause without changing default text",()=>{
 const fake={enabled:()=>true};
 const title=Plugin.prototype.detectTitle.call(fake,true,"background");
 assert.ok(title.startsWith("Detect Margins: On — Uncertain page boundaries"));
 assert.ok(title.includes(" / 识别边界：开启 — 无法可靠识别"));
 assert.ok(title.includes("dark/nonwhite page edges"));
});
