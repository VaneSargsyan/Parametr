import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';
import { jsx,jsxs,Fragment } from 'react/jsx-runtime';
import { createServicesController } from '../src/features/services/servicesController.js';
import { newService,serviceIconKeys,serviceStatuses,isCoreService } from '../src/features/services/model.js';
let row;
let role='admin';
const coreRow={...newService('construction'),status:'published',id:'existing-service',revision:3,title_hy:'Կառուցապատում',title_en:'Construction',title_ru:'Строительство'};
let selectedController;
let changes=0;
let hooks;
const mount=()=>({values:[],index:0,effects:[]});
const state=initial=>{
 const index=hooks.index++;
 if(!(index in hooks.values))hooks.values[index]=typeof initial==='function'?initial():initial;
 return [hooks.values[index],value=>{hooks.values[index]=value;}];
};
const translated=key=>`${language}:${key}`;
let language='hy';
const context={
 useState:state,
 useRef:initial=>state({current:initial})[0],
 useEffect:effect=>{
  const index=hooks.index++;
  if(!(index in hooks.values)){hooks.values[index]=true;hooks.effects.push(effect);}
 },
 useSyncExternalStore:(_subscribe,getSnapshot)=>getSnapshot(),
 useTranslation:()=>({t:translated,i18n:{resolvedLanguage:language}}),
 useAdminAuth:()=>({state:{role}}),
 createServicesController:dependencies=>{selectedController=createServicesController(dependencies);return selectedController;},
 listServices:async()=>({rows:[row],count:1}),
 changeService:async()=>{changes++;throw new Error('Unexpected write');},
 servicesEnabled:()=>true,
 newService,serviceIconKeys,serviceStatuses,isCoreService,styles:{},_jsx:jsx,_jsxs:jsxs,_Fragment:Fragment,
};
const transformed=await transformWithOxc(fs.readFileSync('src/features/services/ServicesAdmin.jsx','utf8'),'ServicesAdmin.jsx');
vm.runInNewContext(transformed.code.replace(/^import .*;\n/gm,'').replace('export default function ServicesAdmin','function ServicesAdmin')+'\nglobalThis.Admin=ServicesAdmin;',context);
const descendants=node=>!node || typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(descendants)];
for(language of ['hy','en','ru'])for(role of ['admin','editor'])for(const core of [true,false]){
 row=core?coreRow:{...coreRow,service_key:'engineering',status:'draft'};
 const root=mount();hooks=root;
 context.Admin();
 const cleanups=root.effects.map(effect=>effect());
 await new Promise(resolve=>setTimeout(resolve,0));
 const render=()=>{hooks=root;root.index=0;return context.Admin();};
 let tree=render();
 const create=descendants(tree).find(node=>node.type==='button' && node.props.children===translated('sm.create'));
 assert.equal(Boolean(create),role==='admin');
 const edit=descendants(tree).find(node=>node.type==='button' && node.props.children===translated('sm.edit'));
 assert(edit,'Existing service must have an Edit button');
 edit.props.onClick();
 assert.equal(selectedController.getSnapshot().selected.id,row.id);
 tree=render();
 const nodes=descendants(tree);
 const editor=nodes.find(node=>typeof node.type==='function' && node.props.row?.id===row.id);
 assert(editor,'Edit must conditionally render the selected service editor');
 assert(nodes.indexOf(editor)<nodes.findIndex(node=>node.type==='table'),'Editor must precede the list');
 const editorHooks=mount();hooks=editorHooks;
 const form=editor.type(editor.props);
 assert.equal(form.type,'form');assert.equal(form.props['aria-label'],translated('sm.edit'));
 assert.equal(form.props.tabIndex,-1);
 assert(descendants(form).some(node=>node.type==='input' && node.props.value===row.title_hy));
 assert(descendants(form).some(node=>node.type==='input' && node.props.value===row.title_en));
 assert(descendants(form).some(node=>node.type==='input' && node.props.value===row.title_ru));
 assert.equal(descendants(form).some(node=>node.type==='button' && node.props.children===translated('sm.actions.archived')),role==='admin' && !core);
 const events=[];
 form.props.ref.current={focus:options=>events.push(['focus',options.preventScroll]),scrollIntoView:options=>events.push(['scroll',options.block])};
 editorHooks.effects.forEach(effect=>effect());
 assert.deepEqual(events,[['focus',true],['scroll','start']]);
 const close=nodes.find(node=>node.type==='button' && node.props.children===translated('inquiry.close'));
 close.props.onClick();assert.equal(selectedController.getSnapshot().selected,null);
 assert(!descendants(render()).some(node=>typeof node.type==='function' && node.props.row));
 edit.props.onClick();assert.equal(selectedController.getSnapshot().selected.id,row.id);
 if(create){
  create.props.onClick();const draft=selectedController.getSnapshot().selected;assert.equal(draft.id,undefined);assert.equal(draft.service_key,'');assert.equal(draft.status,'draft');
 }
 cleanups.forEach(cleanup=>cleanup?.());
}
assert.equal(changes,0,'Opening and closing an editor must not write data');
console.log('PASS: actual HY/EN/RU Edit handlers select existing services, render populated editors before the list, focus/scroll on mount, and close/reopen without writes (hook/DOM doubles).');
