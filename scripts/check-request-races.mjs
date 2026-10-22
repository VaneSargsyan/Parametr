import assert from 'node:assert/strict';
import {createRequestsController} from '../src/features/requests/requestsController.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
const a={id:'a',revision:0,status:'new'},b={id:'b',revision:0,status:'new'};
function setup(){
 const lists=[],changes=[];
 const controller=createRequestsController({
  list:filter=>{const call={...deferred(),filter};lists.push(call);return call.promise;},
  change:(row,status)=>{const call={...deferred(),row,status};changes.push(call);return call.promise;},
 });
 const stop=controller.start();
 return{controller,lists,changes,stop};
}
for(const outcome of ['success','conflict','network']){
 for(const action of ['filter','page','reload','select','close','unmount']){
  const h=setup();h.lists[0].resolve({rows:[a,b],count:2});await settle();h.controller.select(a);
  const pending=h.controller.updateStatus('completed');assert.equal(h.controller.getSnapshot().busy,true);
  if(action==='filter' || action==='page'){
   const load=h.controller.updateFilter({page:action==='page'?1:0,status:action==='filter'?'new':'',search:''});
   h.lists.at(-1).resolve({rows:[b],count:1});await load;
  }else if(action==='reload'){
   const load=h.controller.reload();h.lists.at(-1).resolve({rows:[b],count:1});await load;
  }else if(action==='select')h.controller.select(b);
  else if(action==='close')h.controller.close();
  else h.stop();
  const expected=h.controller.getSnapshot();
  if(outcome==='success')h.changes[0].resolve({...a,revision:1,status:'completed'});
  else h.changes[0].reject(new Error(outcome==='conflict'?'inquiry.conflict':'network'));
  await pending;
  assert.strictEqual(h.controller.getSnapshot(),expected,`${action}/${outcome}: late response mutated current view`);
  h.stop();
 }
}
// Old completion must not clear the busy flag of a newer mutation.
{
 const h=setup();h.lists[0].resolve({rows:[a,b],count:2});await settle();h.controller.select(a);
 const old=h.controller.updateStatus('completed');h.controller.select(b);
 const latest=h.controller.updateStatus('in_progress');
 await h.controller.updateStatus('rejected');assert.equal(h.changes.length,2,'Repeated action while busy must not submit');
 h.changes[0].resolve({...a,revision:1,status:'completed'});await old;
 assert.equal(h.controller.getSnapshot().busy,true);assert.equal(h.controller.getSnapshot().selected.id,'b');
 h.changes[1].resolve({...b,revision:1,status:'in_progress'});await latest;
 assert.equal(h.controller.getSnapshot().busy,false);assert.equal(h.controller.getSnapshot().selected.revision,1);h.stop();
}
// Newest list wins; stale errors cannot mask it. Failed reload removes stale rows.
{
 const h=setup();const latest=h.controller.updateFilter({page:0,status:'new',search:'B'});
 h.lists[1].resolve({rows:[b],count:1});await latest;
 const expected=h.controller.getSnapshot();h.lists[0].reject(new Error('old request'));await settle();
 assert.strictEqual(h.controller.getSnapshot(),expected);
 const reload=h.controller.reload();h.lists[2].reject(new Error('offline'));await reload;
 assert.equal(h.controller.getSnapshot().error,'inquiry.unavailable');assert.deepEqual(h.controller.getSnapshot().data.rows,[]);h.stop();
}
// Current conflicts remain visible and do not optimistically overwrite the row.
{
 const h=setup();h.lists[0].resolve({rows:[a],count:1});await settle();h.controller.select(a);
 const pending=h.controller.updateStatus('completed');h.changes[0].reject(new Error('inquiry.conflict'));await pending;
 assert.equal(h.controller.getSnapshot().error,'inquiry.conflict');assert.equal(h.controller.getSnapshot().selected.revision,0);assert.equal(h.controller.getSnapshot().busy,false);h.stop();
}
// Effect stop/start (including Strict Mode) invalidates earlier operations.
{
 const h=setup();h.stop();const stop=h.controller.start();
 h.lists[0].resolve({rows:[a],count:1});await settle();assert.equal(h.controller.getSnapshot().loading,true);
 h.lists[1].resolve({rows:[b],count:1});await settle();assert.equal(h.controller.getSnapshot().data.rows[0].id,'b');stop();
}
console.log('PASS: 18 deferred stale mutation success/error races; latest list wins; old finally cannot clear new busy state; duplicate action suppression; current conflicts; stop/restart cleanup. No network.');
