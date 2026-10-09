const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');
const P=require('../src/persistent-cache.js');
const viewport={width:600,height:800,scale:1,transform:[1,0,0,-1,0,800]};
function pageContent(number, year=false, extra=false){
 const items=[
  {str:'Main body',fontName:'F',width:140,transform:[12,0,0,12,80,650]},
  {str:'Footnote body',fontName:'F',width:120,transform:[10,0,0,10,80,350]},
  {str:String(year?'2026':number),fontName:'F',width:12,transform:[9,0,0,9,280,33]}];
 if(extra)items.push({str:'Editorial footnote',fontName:'F',width:120,transform:[9,0,0,9,80,29]});
 return {items,styles:{F:{ascent:.8,descent:-.2}}};
}
function record(p,year=false,extra=false){
 const r=C.textAndFolio(pageContent(p,year,extra),viewport);
 return {raw:r.all,width:600,height:800,rotation:0,viewerRotation:0,quality:'reliable',
   version:C.VERSION,fastPath:true,folio:r.folio};
}
test('page number candidate retains original bbox and isolates body area',()=>{
 const r=record(5);
 assert.ok(r.folio);
 assert.equal(r.folio.ordinal,5);
 assert.equal(r.folio.edge,'bottom');
 assert.ok(r.raw[3]>r.folio.body[3]+100);
});
test('true page-number sequence across L1 identifies only matching folios',()=>{
 const pages=C.samples(24),cache=new Map(pages.map(p=>[p,record(p)]));
 const pattern=C.folioPattern(pages,cache);
 assert.equal(pattern.offset,0);assert.equal(pattern.edge,'bottom');
 const full=record(8),short=C.fitPageRecord(full,pattern,8);
 assert.equal(short.folioExcluded,true);
 assert.deepEqual(short.fullRaw,full.raw);
 assert.ok(short.raw[3]<full.raw[3]);
 assert.deepEqual(C.fitPageRecord(record(8,true),pattern,8).raw,record(8,true).raw);
});
test('unchanging footer year and live footnote must not become folios',()=>{
 const pages=C.samples(24);
 assert.equal(C.folioPattern(pages,new Map(pages.map(p=>[p,record(p,true)]))),null);
 assert.equal(record(5,false,true).folio,null);
});
test('unproven pattern and mixed graphic pages always retain full content bounds',()=>{
 const original=record(8);
 assert.strictEqual(C.fitPageRecord(original,null,8),original);
 const sample=C.samples(24);
 const cache=new Map(sample.map(p=>[p,record(p)]));
 const pattern=C.folioPattern(sample,cache);
 const mixed={...original,fastPath:false};
 assert.strictEqual(C.fitPageRecord(mixed,pattern,8),mixed);
});
test('persistent cache validates and preserves only numeric folio metadata',async()=>{
 const disk=new Map();
 const io={readJSON:async key=>{if(!disk.has(key))throw Error('not found');return disk.get(key);},
  writeJSON:async(key,val)=>{disk.set(key,JSON.parse(JSON.stringify(val)));},
  makeDirectory:async()=>{}};
 const path={profileDir:'zotero-test',join:(...p)=>p.join('/')};
 const timers={setTimeout,clearTimeout};
 const make=()=>new P.Store({io,path,timers,count:24,version:C.VERSION,
  fingerprints:['1234567890abcdef']});
 const s=make(),source=record(7);s.schedule(new Map([[7,source]]));await s.flush();
 const rec=(await make().load()).get(7);
 assert.deepEqual(rec.folio,source.folio);
 assert.equal(rec.fastPath,true);
 const corrupt=disk.get(s.file);
 corrupt.pages[0][1].folio.body=[-1,2,3,4];
 assert.equal((await make().load()).size,0);
});
