const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');
function fixture(count=12) {
  let clock=10000, n=0, enabled=true;
  const timers=new Map(),called=[];
  const host={enabled:()=>enabled,now:()=>clock,error:err=>{throw err;},
    setTimeout:(fn,ms)=>{const id=++n;timers.set(id,{fn,at:clock+ms});return id;},
    clearTimeout:id=>timers.delete(id)};
  const indexer=new C.IdleIndexer(host);
  const record={raw:[0,0,400,600],width:400,height:600,quality:'reliable',
    version:C.VERSION,rotation:0,viewerRotation:0};
  const session=new C.Session(count,async (p,rotation,token)=>{
    called.push(p);
    if(token?.cancelled)return null;
    return record;
  });
  const controller={closed:false,dragging:false,lastInput:0,lastPage:2,
    readingDirection:1,session,viewer:{getPageView:()=>({viewport:{rotation:0}})}};
  return {indexer,session,controller,host,called,timers,
    time:t=>{clock=t;},enabled:b=>{enabled=b;},
    async tick(){timers.clear();await indexer.tick();},
    close(){indexer.close();session.close();}};
}
test('idle indexer skips cached run and detects first uncached page',async()=>{
 const f=fixture();
 for(let p=1;p<=5;p++)f.session.cache.set(p,{raw:[0,0,400,600],rotation:0});
 f.indexer.focus(f.controller);
 assert.equal(f.timers.size,1,'one initial warmup timer');
 await f.tick();
 assert.deepEqual(f.called,[6]);
 assert.equal(f.session.cache.has(6),true);
 f.close();
});
test('scrolling and navigating cached pages do not preempt indexing',async()=>{
 const f=fixture(),c=f.controller;
 for(let p=1;p<=5;p++)f.session.cache.set(p,{raw:[0,0,400,600],rotation:0});
 f.indexer.focus(c);await f.tick();
 c.lastPage=3;c.lastInput=10000;f.indexer.onNavigation(c,3);
 f.time(10500);await f.tick();
 assert.deepEqual(f.called,[6,7],'cached page navigation does not clear work');
 f.close();
});
test('visible uncached page preempts active background rendering',async()=>{
 const f=fixture();
 const token={cancelled:false,cancelRender:()=>{cancelled++;}};
 let cancelled=0;
 token.cancel=()=>{token.cancelled=true;cancelled++;};
 f.indexer.target=f.controller;
 f.indexer.token=token;
 f.indexer.onNavigation(f.controller,8);
 assert.ok(token.cancelled);
 assert.equal(cancelled,1);
 f.close();
});
test('background results never mutate page number, scale or position',async()=>{
 const f=fixture();
 const c=f.controller;
 const before=c.lastPage;
 f.indexer.focus(c);
 await f.tick();
 assert.equal(c.lastPage,before);
 assert.equal(f.called[0],3);
 assert.ok(f.session.cache.has(3));
 f.close();
});
test('complete cache starts no additional indexing timer',async()=>{
 const f=fixture(3);
 for(let p=1;p<=3;p++)f.session.cache.set(p,{raw:[0,0,400,600],rotation:0});
 f.indexer.focus(f.controller);await f.tick();
 assert.equal(f.timers.size,0);
 assert.deepEqual(f.called,[]);
 f.close();
});
test('switch active PDF cancels worker token and selects new reader',()=>{
 const f=fixture();const another={...f.controller,lastPage:9};
 f.indexer.focus(f.controller);
 f.indexer.focus(another);
 assert.equal(f.indexer.target,another);
 assert.equal(f.timers.size,1);
 f.close();
});


test('selected PDF gets priority, then waiting open PDF is eligible after selected completes',async()=>{
 const f=fixture(12),a=f.controller,b={...f.controller,lastPage:7,
   session:new C.Session(12,async()=>({raw:[0,0,400,600],rotation:0}))};
 f.host.preferredIndexerController=()=>b;
 f.indexer.focus(a);
 assert.equal(f.indexer.target,null,'inactive A was not scheduled');
 f.indexer.focus(b);
 assert.equal(f.indexer.target,b,'active B owns the sole worker');
 f.indexer.focus(a);
 assert.equal(f.indexer.target,b,'inactive A does not interrupt B');
 // The scheduler now selects the incomplete waiting PDF once B is complete.
 f.host.preferredIndexerController=()=>a;
 f.indexer.focus(a);
 assert.equal(f.indexer.target,a,'waiting PDF A takes the worker without activation');
 f.indexer.stop();
 b.session.close();
 f.close();
});
