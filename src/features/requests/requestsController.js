// One owner for list/selection/mutation state, with independently invalidated
// asynchronous generations. A stale operation may finish on the server but may
// never replace the current view, errors, or busy state.
export function createRequestsController({ list, change }) {
    let state={filter:{page:0,status:'',search:''},data:{rows:[],count:0},loading:true,error:null,selected:null,busy:false};
    let active=false;
    let listGeneration=0;
    let mutationGeneration=0;
    const listeners=new Set();
    const publish=patch=>{state={...state,...patch};listeners.forEach(listener=>listener());};
    const load=async filter=>{
        const generation=++listGeneration;
        mutationGeneration++;
        publish({filter:{...filter},loading:true,error:null,selected:null,busy:false});
        try {
            const data=await list({...filter});
            if(active && generation===listGeneration)publish({data,loading:false});
        } catch {
            if(active && generation===listGeneration)publish({error:'inquiry.unavailable',loading:false,data:{rows:[],count:0}});
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
            mutationGeneration++;publish({selected,busy:false,error:null});
        },
        close(){mutationGeneration++;publish({selected:null,busy:false,error:null});},
        async updateStatus(status){
            if(!active || !state.selected || state.busy)return;
            const selected=state.selected;
            const filter=state.filter;
            const generation=++mutationGeneration;
            const current=()=>active && generation===mutationGeneration;
            publish({busy:true,error:null});
            try {
                const row=await change(selected,status);
                if(!current())return;
                const data=filter.status && row.status!==filter.status
                    ? {rows:state.data.rows.filter(item=>item.id!==row.id),count:Math.max(0,state.data.count-1)}
                    : {...state.data,rows:state.data.rows.map(item=>item.id===row.id?row:item)};
                publish({selected:row,data});
            } catch(error){
                if(current())publish({error:error.message==='inquiry.conflict'?'inquiry.conflict':'inquiry.unavailable'});
            } finally {
                if(current())publish({busy:false});
            }
        },
    };
}
