const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/persistent-cache.js');
const fps=['0123456789abcdef','abcdef0123456789'];
const rec=(rotation=0)=>({raw:[20,40,180,240],width:200,height:300,
  rotation,viewerRotation:0,quality:'reliable',version:C.VERSION});
function env(count=12){
 const disk=new Map(),calls={writes:[],reads:0},fault={write:0,read:0};
 const io={
  makeDirectory:async()=>{},
  exists:async f=>disk.has(f),
  readUTF8:async f=>{calls.reads++;if(fault.read-- >0)throw Error('transient read failure');
    if(!disk.has(f))throw Error('ENOENT');return disk.get(f);},
  writeUTF8:async(f,value,{mode}={})=>{
    calls.writes.push({mode,bytes:Buffer.byteLength(value)});
    if(fault.write-- >0)throw Error('transient write failure');
    if(mode==='create' && disk.has(f))throw Error('already exists');
    disk.set(f,(mode==='appendOrCreate'?(disk.get(f)||''):'')+value);
  }
 };
 const path={profileDir:'fake-profile',join:(...a)=>a.join('/')};
 const timers={setTimeout,clearTimeout};
 return {disk,io,calls,fault,path,timers,make:(keys=fps,version=1,n=count)=>
  new P.Store({io,path,timers,fingerprints:keys,count:n,version})};
}
test('writes document header then minimal four-coordinate lines, reopens',async()=>{
 const e=env(),w=e.make();w.schedulePage(2,rec());w.schedulePage(1,rec(90));
 await w.flush();assert.ok(w.file.endsWith('.jsonl'));
 const lines=e.disk.get(w.file).trimEnd().split('\n');
 assert.deepEqual(JSON.parse(lines[0]),{algorithmVersion:1,key:w.key,numPages:12});
 assert.deepEqual(JSON.parse(lines[1]),[2,20,40,180,240]);
 assert.deepEqual(JSON.parse(lines[2]),[1,20,40,180,240]);
 assert.equal((await e.make().load()).size,2);
 assert.deepEqual(e.calls.writes.map(x=>x.mode),['create']);
});
test('append does not reread or rewrite existing entries every batch',async()=>{
 const e=env(),a=e.make();
 a.schedulePage(1,rec());await a.flush();
 const reads=e.calls.reads;a.schedulePage(2,rec());await a.flush();
 assert.equal(e.calls.reads,reads);
 assert.deepEqual(e.calls.writes.map(x=>x.mode),['create','appendOrCreate']);
 assert.equal((await e.make().load()).size,2);
});
test('far-out folio keeps original width and full height after reopening',async()=>{
 const e=env(),a=e.make();a.schedulePage(7,{...rec(),raw:[5,20,195,270],
  widthFitRaw:[60,20,180,270]});await a.flush();
 assert.deepEqual((await e.make().load()).get(7).raw,[60,20,180,270]);
});
test('invalid or height-changing body exceptions cannot change persistence',async()=>{
 const e=env(),a=e.make(),base={...rec(),raw:[10,20,190,270]};
 for(const [p,b] of [[1,[60,30,170,260]],[2,[5,20,170,270]],[3,[60,20,170,270]]])
  a.schedulePage(p,{...base,widthFitRaw:b});
 await a.flush();assert.deepEqual([...((await e.make().load()).values())].map(r=>r.raw),
  [[10,20,190,270],[10,20,190,270],[60,20,170,270]]);
});
test('incompatible version does not overwrite newer file',async()=>{
 const e=env(),a=e.make();a.schedulePage(1,rec());await a.flush();
 const old=e.disk.get(a.file);const newer=e.make(fps,2);
 assert.equal((await newer.load()).size,0);assert.equal(newer.readOnly,true);
 newer.schedulePage(2,rec());await newer.flush();assert.equal(e.disk.get(a.file),old);
});
test('path, mtime and filename never affect cache key; old JSON is ignored',async()=>{
 const e=env(),a=e.make();e.disk.set(a.file.replace('.jsonl','.json'),'OLD');
 assert.equal((await a.load()).size,0);a.schedulePage(1,rec());await a.flush();
 assert.equal((await e.make().load()).size,1);
 assert.equal(P.cacheKey(fps,12,'mtime-1'),P.cacheKey(fps,12,'mtime-2'));
 assert.notEqual(P.cacheKey(fps,12),P.cacheKey(fps,13));
 assert.equal(P.cacheKey(['../../secret'],12),null);
});
test('two separate store instances append to same file without clobber',async()=>{
 const e=env(),a=e.make(),b=e.make();a.schedulePage(1,rec());b.schedulePage(2,rec());
 await Promise.all([a.flush(),b.flush()]);assert.equal((await e.make().load()).size,2);
});
test('newer page record wins on reopen; unordered keys work',async()=>{
 const e=env(100),a=e.make();for(const p of [20,26,3,24])a.schedulePage(p,rec());
 await a.flush();a.schedulePage(26,{...rec(),raw:[25,40,180,240]});await a.flush();
 const b=await e.make().load();assert.deepEqual(b.get(26).raw,[25,40,180,240]);
 assert.equal(b.size,4);
});
test('interrupted final line is ignored; subsequent appends recover without rewrite',async()=>{
 const e=env(),a=e.make();a.schedulePage(1,rec());await a.flush();
 e.disk.set(a.file,e.disk.get(a.file)+'[2,20,40');const b=e.make();
 assert.equal((await b.load()).size,1);
 b.schedulePage(3,rec());await b.flush();const saved=await e.make().load();
 assert.equal(saved.size,2);assert.ok(saved.has(3));
});
test('failed first write stays pending until the next successful flush',async()=>{
 const e=env(),a=e.make();e.fault.write=1;a.schedulePage(1,rec());
 await assert.rejects(a.flush());assert.equal(a.dirty.size,1);
 e.fault.write=0;await a.flush();assert.equal((await e.make().load()).size,1);
});
test('unreadable existing file cannot be overwritten by a write',async()=>{
 const e=env(),a=e.make();a.schedulePage(1,rec());await a.flush();
 const before=e.disk.get(a.file),b=e.make();e.fault.read=1;
 assert.equal((await b.load()).size,0);assert.equal(b.readOnly,true);
 b.schedulePage(2,rec());await b.flush();assert.equal(e.disk.get(a.file),before);
});
test('delayed write flushes ten new pages and close flushes remainder',async()=>{
 const e=env(100),a=e.make();
 for(let p=1;p<10;p++)a.schedulePage(p,rec());assert.equal(e.calls.writes.length,0);
 a.schedulePage(10,rec());await a.writing;assert.equal(e.calls.writes.length,1);
 a.schedulePage(42,rec());await a.close();assert.equal((await e.make().load()).size,11);
});
test('fallback pages persist and genuine render failures do not',async()=>{
 const e=env(),a=e.make();a.schedulePage(1,{...rec(),raw:[0,0,200,300],reason:'blank',quality:'fallback'});
 a.schedulePage(2,{...rec(),raw:[0,0,200,300],reason:'render-failed',quality:'fallback'});
 await a.flush();const b=await e.make().load();assert.ok(b.has(1));assert.ok(!b.has(2));
});
test('more than 3000 pages without eviction',async()=>{
 const e=env(3105),a=e.make();for(let p=1;p<=3105;p++)a.schedulePage(p,rec());
 await a.flush();await a.writing;const b=await e.make().load();
 assert.equal(b.size,3105);assert.ok(b.has(1)&&b.has(3105));
});
test('cache restore skips existing page detector after reopening',async()=>{
 const e=env(),a=e.make();a.schedulePage(3,rec());await a.flush();let called=0;
 const b=e.make(),s=new C.Session(12,async()=>{called++;return rec();},b,(p,r)=>({...rec(),raw:r.raw}));
 await s.visible(3,0);assert.equal(called,0);s.close();
});
