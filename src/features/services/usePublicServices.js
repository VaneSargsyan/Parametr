import { useEffect,useState,useCallback } from 'react';
import { services } from '../../data/services';
import { servicesEnabled,publishedServices } from './service';
import { readSupabaseConfig } from '../../lib/supabaseConfig';
let version=0;
const listeners=new Set();
export const refreshServices=()=>{version++;listeners.forEach(fn=>fn(version));};
export function usePublicServices(){
    const remote=servicesEnabled();
    const [ticket,setTicket]=useState(version);
    const [state,setState]=useState({services:remote?[]:services,loading:remote,error:false});
    const retry=useCallback(()=>refreshServices(),[]);
    useEffect(()=>{listeners.add(setTicket);return()=>listeners.delete(setTicket);},[]);
    useEffect(()=>{
        if(!remote)return;
        let active=true;
        const load=async()=>{
            await Promise.resolve();
            if(!active)return;
            setState({services:[],loading:true,error:false});
            try{
                if(readSupabaseConfig(import.meta.env)?.url!=='https://uewihgsxrcjieghtkhjs.supabase.co')throw new Error();
                const {getPublicSupabaseClient}=await import('../../lib/publicSupabase');
                const client=getPublicSupabaseClient();if(!client)throw new Error();
                const rows=await publishedServices(client);
                if(active)setState({services:rows,loading:false,error:false});
            }catch{if(active)setState({services:[],loading:false,error:true});}
        };
        void load();return()=>{active=false;};
    },[remote,ticket]);
    return {...state,retry};
}
