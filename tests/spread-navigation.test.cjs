const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');

test('native Zotero odd spreads group 1-2, 3-4 and have correct turns',()=>{
  for(const [page,start] of [[1,1],[2,1],[3,3],[4,3],[5,5],[6,5]])
    assert.equal(C.spreadStart(page,1),start);
  for(const [page,next] of [[1,3],[2,3],[3,5],[4,5],[5,5],[6,5]])
    assert.equal(C.spreadStep(page,6,1,1),next);
  for(const [page,prev] of [[1,1],[2,1],[3,1],[4,1],[5,3],[6,3]])
    assert.equal(C.spreadStep(page,6,1,-1),prev);
});
test('native Zotero even spreads group lone cover 1, then 2-3, 4-5',()=>{
  for(const [page,start] of [[1,1],[2,2],[3,2],[4,4],[5,4],[6,6],[7,6]])
    assert.equal(C.spreadStart(page,2),start);
  for(const [page,next] of [[1,2],[2,4],[3,4],[4,6],[5,6],[6,6],[7,6]])
    assert.equal(C.spreadStep(page,7,2,1),next);
  for(const [page,prev] of [[1,1],[2,1],[3,1],[4,2],[5,2],[6,4],[7,4]])
    assert.equal(C.spreadStep(page,7,2,-1),prev);
});
test('single-page, last odd-page and first page stop on correct boundaries',()=>{
  for(const [page,next,prev] of [[1,2,1],[2,3,1],[3,4,2],[4,5,3],[5,5,4]]){
    assert.equal(C.spreadStep(page,5,0,1),next);
    assert.equal(C.spreadStep(page,5,0,-1),prev);
  }
  assert.equal(C.spreadStep(5,5,1,1),5);
  assert.equal(C.spreadStep(5,5,2,1),4);
  assert.equal(C.spreadStep(1,1,2,1),1);
});
