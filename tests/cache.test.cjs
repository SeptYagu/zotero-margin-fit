const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/persistent-cache.js');
const fps=['0123456789abcdef','abcdef0123456789'];
const rec=(rotation=0)=>({raw:[20,40,180,240],width:200,height:300,rotation,
  viewerRotation:0,quality:'reliable',version:C.VERSION});
function env(key=fps,version=P.ALGORITHM_VERSION,count=12) {
  const disk=new Map();
  const io={makeDirectory:async()=>{},readJSON:async path=>{
    if(!disk.has(path))throw new Error('ENOENT');
    return JSON.parse(JSON.stringify(disk.get(path)));
  },writeJSON:async(path,value)=>{disk.set(path,JSON.parse(JSON.stringify(value)));},
  getChildren:async dir=>[...disk.keys()].filter(path=>path.startsWith(dir+'/'))};
  const path={profileDir:'fake-profile',join:(...p)=>p.join('/')};
  const timers={setTimeout,clearTimeout};
  return {disk,io,path,timers,make:(k=key,v=version,n=count)=>new P.Store({
    io,path,timers,fingerprints:k,count:n,version:v})};
}
test('minimal persistent pages contain only four coordinates and reopen',async()=>{
  const e=env(),w=e.make();
  w.schedule(new Map([[1,rec()],[2,rec(90)],
    [3,{...rec(),raw:[-100,0,1,5]}]]));
  await w.flush();
  const saved=e.disk.get(w.file);
  assert.deepEqual(Object.keys(saved),['algorithmVersion','key','numPages','pages']);
  assert.equal(saved.algorithmVersion,1);
  assert.deepEqual(saved.pages,{'1':[20,40,180,240],'2':[20,40,180,240]});
  assert.equal((await e.make().load()).size,2);
});
test('far-out footer stays excluded from Width Fit after reopening using only four coordinates',async()=>{
  const e=env(), store=e.make();
  const original={...rec(),raw:[5,20,195,270],widthFitRaw:[60,20,180,270]};
  store.schedulePage(7,original);
  await store.flush();
  assert.deepEqual(e.disk.get(store.file).pages['7'],[60,20,180,270]);
  assert.equal(e.disk.get(store.file).pages['7'].length,4);
  const reopened=(await e.make().load()).get(7);
  assert.deepEqual(reopened.raw,[60,20,180,270],
    'X comes from main text; Y retains the page-number vertical extent');
  assert.equal(C.scaleDecision(original,'width',{width:300,height:360},1,1,true).scale,
    C.scaleDecision({...original,raw:reopened.raw,widthFitRaw:undefined},'width',
      {width:300,height:360},1,1,true).scale);
  const hydrated={...rec(),raw:reopened.raw};
  assert.deepEqual(C.scaleDecision(hydrated,'height',{width:300,height:360},1,1,true).safe.slice(1,4).filter((_,i)=>i!==1),
    [Math.max(0,20-C.SAFETY),Math.min(300,270+C.SAFETY)]);
});
test('invalid or height-altering body exceptions cannot corrupt four-coordinate cache',async()=>{
  const e=env(),a=e.make(),base={...rec(),raw:[10,20,190,270]};
  a.schedulePage(1,{...base,widthFitRaw:[60,30,170,260]});
  a.schedulePage(2,{...base,widthFitRaw:[5,20,170,270]});
  a.schedulePage(3,{...base,widthFitRaw:[60,20,170,270]});
  await a.flush();
  assert.deepEqual(e.disk.get(a.file).pages,{
    '1':[10,20,190,270],'2':[10,20,190,270],'3':[60,20,170,270]});
});
test('different plugin versions reuse same algorithm cache; approved compatibility bump invalidates',async()=>{
  const e=env(),a=e.make();
  a.schedulePage(1,rec());await a.flush();
  assert.equal((await e.make().load()).size,1);
  assert.equal((await e.make(fps,2).load()).size,0);
  assert.notEqual(P.cacheKey(['fedcba9876543210'],12),a.key);
  assert.equal(P.cacheKey(['../../secret'],12),null);
  assert.equal(P.cacheKey(fps,0),null);
  assert.equal(P.validBox([NaN,0,2,3]),false);
  assert.equal(P.validBox([20,40,210,240],200,300),false);
});
test('mtime, filename, path changes do not affect fingerprint cache identity',async()=>{
  const e=env(),a=e.make();
  assert.equal(P.cacheKey(fps,12,'1-100'),P.cacheKey(fps,12,'1-200'));
  a.schedulePage(1,rec());await a.flush();
  const b=new P.Store({io:e.io,path:e.path,timers:e.timers,fingerprints:fps,count:12,
    fileStamp:'99999-00001'});
  assert.equal(a.file,b.file);assert.equal((await b.load()).size,1);
  assert.equal((await e.make(fps,1,13).load()).size,0);
});
test('successful full-page fallback persisted, renderer exceptions not persisted',async()=>{
  const e=env(),a=e.make();
  a.schedulePage(1,{...rec(),raw:[0,0,200,300],quality:'fallback',reason:'background'});
  a.schedulePage(2,{...rec(),raw:[0,0,200,300],quality:'fallback',reason:'render-failed'});
  await a.flush();
  assert.deepEqual(e.disk.get(a.file).pages,{'1':[0,0,200,300]});
  assert.deepEqual((await e.make().load()).get(1).raw,[0,0,200,300]);
});
test('legacy v0.1.7 stamped key migrates without reanalysis',async()=>{
  const e=env(),a=e.make();
  const legacyKey=a.key+'-4096-1791510000000';
  const legacyFile=e.path.join(a.directory,legacyKey+'.json');
  const fallback={...rec(),raw:[0,0,200,300],quality:'fallback'};
  const saved={storageVersion:3,algorithmVersion:5,key:legacyKey,numPages:12,
    pages:[[1,{...rec(),widthFitRaw:[55,40,170,240]}],
      [2,{...rec(),raw:[NaN,0,1,2]}],[3,fallback]]};
  // JSON would write NaN as null, simulating bad/corrupt persisted entry.
  e.disk.set(legacyFile,JSON.parse(JSON.stringify(saved)));
  const loaded=await a.load();
  assert.deepEqual([...loaded.keys()],[1]);
  await a.flush();
  assert.deepEqual(e.disk.get(a.file).pages,{'1':[55,40,170,240]});
  assert.equal((await e.make().load()).size,1);
});
test('cache with newer algorithm version remains unchanged under old plugin',async()=>{
  const e=env(),a=e.make();
  const higher={algorithmVersion:2,key:a.key,numPages:12,pages:{'1':[20,40,180,240]}};
  e.disk.set(a.file,higher);
  assert.equal((await a.load()).size,0);
  a.schedulePage(2,rec());await a.flush();
  assert.deepEqual(e.disk.get(a.file),higher);
});
test('fresh session reuses hydrated boxes without calling detector on cached samples',async()=>{
  const e=env(),fresh=[],w=e.make();
  const s=new C.Session(12,async p=>{fresh.push(p);return rec();},w);
  await s.l1();assert.equal(fresh.length,6);s.close();await w.writing;
  const again=[],w2=e.make(),s2=new C.Session(12,async p=>{again.push(p);return rec();},w2,
    (p,r)=>({...rec(),raw:r.raw}));
  await s2.l1();
  assert.equal(again.length,0);
  assert.equal(s2.models[1]?.length,4);
  s2.close();
});
test('same-document parallel writers merge pages without clobber',async()=>{
  const e=env(),a=e.make(),b=e.make();
  a.schedulePage(1,rec());b.schedulePage(2,rec(90));
  await Promise.all([a.flush(),b.flush()]);
  assert.equal((await e.make().load()).size,2);
});
test('batch writer defers small writes and flushes by ten new pages',async()=>{
  const e=env(fps,1,100);
  const a=e.make(),old=a.pack.bind(a);
  let writes=0;a.pack=x=>{writes++;return old(x);};
  for(let p=1;p<=9;p++)a.schedulePage(p,rec());
  assert.equal(writes,0);
  assert.equal(a.dirty.size,9);
  a.schedulePage(10,rec());
  await a.writing;
  assert.equal(writes,1);
  assert.equal((await a.load()).size,10);
  a.schedulePage(42,rec());
  await a.close();
  assert.equal((await a.load()).size,11);
});
test('book-wide cache does not evict pages after 3000',async()=>{
  const e=env(fps,1,3105),a=e.make();
  for(let p=1;p<=3105;p++)a.schedulePage(p,rec());
  await a.flush();await a.writing;
  const all=await a.load();
  assert.equal(all.size,3105);
  assert.ok(all.has(1)&&all.has(3105));
});
test('unsorted page-key insertion is valid and supports direct page lookup',async()=>{
  const e=env(fps,1,100),a=e.make();
  for(const p of [20,26,3,24])a.schedulePage(p,{...rec(),raw:[p,40,180,240]});
  await a.flush();
  assert.deepEqual((await e.make().load()).get(26).raw,[26,40,180,240]);
  assert.deepEqual(Object.keys(e.disk.get(a.file).pages),['3','20','24','26']);
});
test('strict operator allowlist refuses graphics and unknown paint ops',()=>{
  const codes={dependency:1,beginText:2,endText:3,setFont:4,moveText:5,
    showText:6,setFillRGBColor:7,constructPath:8,paintImageXObject:9};
  const box=[20,30,170,200];
  assert.equal(C.isTextOnlyOps({fnArray:[7,2,1,4,5,6,3]},codes,box),true);
  for(const extra of [8,9,999])assert.equal(C.isTextOnlyOps({fnArray:[2,4,5,6,3,extra]},codes,box),false);
});
