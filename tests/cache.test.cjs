const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/persistent-cache.js');
const key=['0123456789abcdef','abcdef0123456789'];
const record=(rotation=0)=>({raw:[20,40,180,240],width:200,height:300,rotation,
  viewerRotation:0,quality:'reliable',version:C.VERSION});
function env(fingerprints=key,version=C.VERSION) {
  const disk=new Map();
  const io={makeDirectory:async()=>{},readJSON:async path=>{
    if(!disk.has(path))throw new Error('ENOENT');
    return JSON.parse(JSON.stringify(disk.get(path)));
  },writeJSON:async(path,value)=>{disk.set(path,JSON.parse(JSON.stringify(value)));}};
  const path={profileDir:'fake-profile',join:(...p)=>p.join('/')};
  const timers={setTimeout,clearTimeout};
  return {disk,io,path,timers,make:(fps=fingerprints,ver=version)=>new P.Store({
    io,path,timers,fingerprints:fps,count:12,version:ver})};
}
test('persistent cache stores only validated absolute boxes and reopens across sessions',async()=>{
  const e=env(),w=e.make(),data=new Map([[1,record()],[2,record(90)],
    [3,{raw:[-100,0,1,5],width:200,height:300,rotation:0,viewerRotation:0,quality:'reliable',version:C.VERSION}]]);
  w.schedule(data);await w.flush();
  const read=await e.make().load();
  assert.equal(read.size,2);assert.deepEqual(read.get(1).raw,[20,40,180,240]);
  assert.equal(e.disk.get(w.file).pages[0][1].elapsedMs,undefined);
});
test('fingerprints, revision, page count, and algorithm version are strict',async()=>{
  const e=env(),w=e.make();w.schedule(new Map([[1,record()]]));await w.flush();
  assert.equal((await e.make(['fedcba9876543210']).load()).size,0);
  assert.equal((await e.make(key,C.VERSION+1).load()).size,0);
  assert.equal(P.cacheKey(['../../secret'],12),null);
  assert.equal(P.cacheKey(key,0),null);
  assert.equal(P.validRecord({...record(),raw:[NaN,0,2,3]},C.VERSION),false);
  const bad=e.disk.get(w.file);bad.storageVersion=99;
  assert.equal((await e.make().load()).size,0);
});
test('new view shares saved records and does not render saved L1 pages again',async()=>{
  const e=env(),fresh=[],w=e.make();
  const s=new C.Session(12,async p=>{fresh.push(p);return record();},w);
  await s.l1();assert.equal(fresh.length,6);s.close();await w.writing;
  const again=[],w2=e.make(),s2=new C.Session(12,async p=>{again.push(p);return record();},w2);
  await s2.l1();assert.equal(again.length,0);
  assert.equal(s2.models[1]?.length,4);
  s2.close();
});
test('two readers writing same PDF preserve each other saved page boundaries',async()=>{
  const e=env(),first=e.make(),second=e.make();
  first.schedule(new Map([[1,record()]]));await first.flush();
  second.schedule(new Map([[2,record(90)]]));await second.flush();
  assert.equal((await e.make().load()).size,2);
});
test('strict operator allowlist refuses images, vectors, text with drawing, and unknown codes',()=>{
  const codes={dependency:1,beginText:2,endText:3,setFont:4,moveText:5,
    showText:6,setFillRGBColor:7,constructPath:8,paintImageXObject:9};
  const box=[20,30,170,200];
  assert.equal(C.isTextOnlyOps({fnArray:[7,2,1,4,5,6,3]},codes,box),true);
  for(const extra of [8,9,999])assert.equal(C.isTextOnlyOps({fnArray:[2,4,5,6,3,extra]},codes,box),false);
  assert.equal(C.isTextOnlyOps({fnArray:[2,4,5,6,3]},codes,null),false);
});


test('file size / mtime stamp distinguishes replaced PDF at same fingerprint',async()=>{
  const e=env();
  assert.notEqual(P.cacheKey(key,12,'4096-1791510000000'),P.cacheKey(key,12,'4096-1791510000001'));
  const before=new P.Store({io:e.io,path:e.path,timers:e.timers,fingerprints:key,count:12,version:C.VERSION,fileStamp:'4096-1791510000000'});
  before.schedule(new Map([[1,record()]]));await before.flush();
  const revised=new P.Store({io:e.io,path:e.path,timers:e.timers,fingerprints:key,count:12,version:C.VERSION,fileStamp:'4097-1791510000000'});
  assert.equal((await revised.load()).size,0);
});
