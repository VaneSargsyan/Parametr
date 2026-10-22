export function createServicesController({ list, change }) {
    let state={filter:{page:0,status:'',search:''},data:{rows:[],count:0},loading:true,error:null,selected:null,busy:false,success:false};
    let active=false;
    let listGeneration=0;
    let mutationGeneration=0;
    const listeners=new Set();
    const publish=patch=>{state={...state,...patch};listeners.forEach(listener=>listener());};
    const load=async filter=>{
        const generation=++listGeneration;
        mutationGeneration++;
        publish({filter:{...filter},loading:true,error:null,selected:null,busy:false,success:false});
        try {
            const data=await list({...filter});
            if(active && generation===listGeneration)publish({data,loading:false});
        } catch {
            if(active && generation===listGeneration)publish({error:'sm.unavailable',loading:false,data:{rows:[],count:0}});
        }
    };
    return {
        getSnapshot:()=>state,
        subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},
        start(){active=true;void load(state.filter);return()=>{active=false;listGeneration++;mutationGeneration++;};},
        reload(){if(active)return load(state.filter);},
        updateFilter(filter){if(active)return load(filter);},
        select(row){
            if(!active || state.loading)return;
            const selected=state.data.rows.find(item=>item.id===row.id);
            if(!selected)return;
            mutationGeneration++;publish({selected,busy:false,error:null,success:false});
        },
        create(row){if(!active)return;mutationGeneration++;publish({selected:row,busy:false,error:null,success:false});},
        close(){mutationGeneration++;publish({selected:null,busy:false,error:null,success:false});},
        async updateStatus(status){
            if(!active || !state.selected || state.busy)return;
            const selected=state.selected;
            const filter=state.filter;
            const generation=++mutationGeneration;
            const current=()=>active && generation===mutationGeneration;
            publish({busy:true,error:null,success:false});
            try {
                const row=await change(selected,status);
                if(!current())return;
                const previousCount=state.data.count;
                const present=state.data.rows.some(item=>item.id===row.id);
                const search=filter.search.trim().slice(0,120).replace(/[^\p{L}\p{N} .-]/gu,'').toLowerCase();
                const matches=(!filter.status || row.status===filter.status) && (!search || ['hy','en','ru'].some(language=>(row[`title_${language}`]||'').toLowerCase().includes(search)));
                const rows=state.data.rows.filter(item=>item.id!==row.id);
                if(matches)rows.push(row);
                const data={rows,count:Math.max(0,state.data.count-Number(present)+Number(matches))};
                data.rows.sort((a,b)=>a.sort_order-b.sort_order || a.service_key.localeCompare(b.service_key));
                data.rows=data.rows.slice(0,10);
                publish({selected:row,data,success:true});
                if(previousCount>10 || data.count>10 || filter.page>0){
                    const nextFilter={...filter,page:Math.min(filter.page,Math.max(0,Math.ceil(data.count/10)-1))};
                    const refreshed=await list(nextFilter);
                    if(current())publish({data:refreshed,filter:nextFilter});
                }
            } catch(error){
                if(current())publish({error:['sm.conflict','sm.denied','sm.invalid','sm.duplicate'].includes(error.message)?error.message:'sm.unavailable'});
            } finally {
                if(current())publish({busy:false});
            }
        },
    };
}
