import assert from 'node:assert/strict';
import { createServicesController } from '../src/features/services/servicesController.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const makeRows=(count,status='published')=>Array.from({length:count},(_,i)=>({id:`service-${i}`,service_key:`service-${i}`,status,revision:0,sort_order:i,title_hy:'Համապատասխան',title_en:'Matching',title_ru:'Совпадение'}));
const matches=(row,filter)=>(!filter.status || row.status===filter.status) && (!filter.search || ['hy','en','ru'].some(language=>row[`title_${language}`].toLowerCase().includes(filter.search.toLowerCase())));
async function fixture(rows,filter={page:0,status:'published',search:''}){
 let data=rows.map(row=>({...row}));
 const calls=[];
 const read=async next=>{
  calls.push({...next});
  const filtered=data.filter(row=>matches(row,next)).sort((a,b)=>a.sort_order-b.sort_order || a.service_key.localeCompare(b.service_key));
  return {rows:filtered.slice(next.page*10,next.page*10+10).map(row=>({...row})),count:filtered.length};
 };
 let load=read;
 const controller=createServicesController({list:next=>load(next),change:async(row,action)=>{
  const saved={...row,...action.patch,revision:(row.revision??0)+1};
  data=[...data.filter(item=>item.id!==saved.id),saved];
  return saved;
 }});
 const stop=controller.start();await tick();await controller.updateFilter(filter);
 return {controller,calls,stop,read,setLoad:next=>{load=next;}};
}
function checkPage(f,expectedCount,expectedIds,page=0){
 const state=f.controller.getSnapshot();
 assert.equal(state.data.count,expectedCount);
 assert.equal(state.filter.page,page);
 assert.deepEqual(state.data.rows.map(row=>row.id),expectedIds);
 assert.equal(new Set(state.data.rows.map(row=>row.id)).size,state.data.rows.length);
 assert.equal(state.busy,false);
}
for(const [from,to] of [['published','archived'],['published','draft'],['draft','published']]){
 const f=await fixture(makeRows(11,from),{page:0,status:from,search:''});
 try{
  const row=f.controller.getSnapshot().data.rows[0];const reads=f.calls.length;
  f.controller.select(row);await f.controller.updateStatus({patch:{status:to}});
  checkPage(f,10,makeRows(11).slice(1).map(row=>row.id));
  assert.equal(f.calls.length,reads+1,'11-to-10 removal must refill the first page');
  assert.equal(f.controller.getSnapshot().selected.id,row.id,'Refresh must preserve the selected editor');
 }finally{f.stop();}
}
for(const [language,search] of [['hy','Համապատասխան'],['en','Matching'],['ru','Совпадение']]){
 const f=await fixture(makeRows(11),{page:0,status:'published',search});
 try{
  f.controller.select(f.controller.getSnapshot().data.rows[0]);
  await f.controller.updateStatus({patch:{[`title_${language}`]:'Other'}});
  checkPage(f,10,makeRows(11).slice(1).map(row=>row.id));
 }finally{f.stop();}
}
for(const [count,page,expectedPage] of [[11,1,0],[21,2,1],[20,1,1],[1,0,0]]){
 const f=await fixture(makeRows(count),{page,status:'published',search:''});
 try{
  const row=f.controller.getSnapshot().data.rows[0];
  f.controller.select(row);await f.controller.updateStatus({patch:{status:'archived'}});
  const remaining=makeRows(count).filter(item=>item.id!==row.id);
  checkPage(f,count-1,remaining.slice(expectedPage*10,expectedPage*10+10).map(item=>item.id),expectedPage);
 }finally{f.stop();}
}
{
 const f=await fixture(makeRows(11));
 try{
  const row=f.controller.getSnapshot().data.rows[0];f.controller.select(row);
  await f.controller.updateStatus({patch:{status:'archived'}});
  await f.controller.updateStatus({patch:{status:'published'}});
  checkPage(f,11,makeRows(10).map(item=>item.id));
 }finally{f.stop();}
}
for(const [count,page] of [[9,0],[10,0],[20,1]]){
 const f=await fixture(makeRows(count),{page,status:'published',search:''});
 try{
  const newRow={...makeRows(1,'draft')[0],id:'new',service_key:'new',sort_order:0};
  f.controller.create(newRow);await f.controller.updateStatus({patch:{status:'published'}});
  const expected=[newRow,...makeRows(count)].slice(page*10,page*10+10).map(row=>row.id);
  checkPage(f,count+1,expected,page);
 }finally{f.stop();}
}
{
 const f=await fixture(makeRows(11));
 try{
  const row=f.controller.getSnapshot().data.rows[0];f.controller.select(row);
  await f.controller.updateStatus({patch:{sort_order:999}});
  checkPage(f,11,makeRows(11).slice(1).map(item=>item.id));
 }finally{f.stop();}
}
{
 const f=await fixture(makeRows(1));
 try{
  f.controller.select(f.controller.getSnapshot().data.rows[0]);
  await f.controller.updateStatus({patch:{status:'archived'}});checkPage(f,0,[]);
  await f.controller.updateStatus({patch:{status:'published'}});checkPage(f,1,['service-0']);
 }finally{f.stop();}
}
for(const operation of ['close','filter','stop'])for(const fails of [false,true]){
 const f=await fixture(makeRows(11));
 try{
  let settle;
  const pending=new Promise((resolve,reject)=>{settle=()=>fails?reject(new Error('Stale refresh failure')):resolve({rows:[],count:0});});
  f.setLoad(()=>pending);
  f.controller.select(f.controller.getSnapshot().data.rows[0]);
  const mutation=f.controller.updateStatus({patch:{status:'archived'}});
  await tick();
  if(operation==='close'){f.controller.close();f.controller.create({...makeRows(1,'draft')[0],id:'new-editor'});}
  if(operation==='filter'){f.setLoad(f.read);await f.controller.updateFilter({page:0,status:'archived',search:''});}
  if(operation==='stop')f.stop();
  const before=f.controller.getSnapshot();
  settle();await mutation;
  assert.equal(f.controller.getSnapshot(),before,'Stale page refresh must not overwrite a newer editor/filter/lifecycle');
 }finally{f.stop();}
}
{
 const f=await fixture(makeRows(11));
 try{
  f.setLoad(async()=>{throw new Error('Network failure');});
  f.controller.select(f.controller.getSnapshot().data.rows[0]);
  await f.controller.updateStatus({patch:{status:'archived'}});
  assert.equal(f.controller.getSnapshot().busy,false);
  assert.equal(f.controller.getSnapshot().error,'sm.unavailable');
  f.setLoad(f.read);await f.controller.reload();
  checkPage(f,10,makeRows(11).slice(1).map(row=>row.id));
 }finally{f.stop();}
}
console.log('PASS: filtered Services 11-to-10 refill, archive/unpublish/publish, HY/EN/RU search removal, last-page clamping, empty lists, insertion ordering, stale refresh isolation and failed-refresh recovery.');
