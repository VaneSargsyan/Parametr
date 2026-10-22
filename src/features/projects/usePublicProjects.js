import { useCallback, useEffect, useState } from 'react';
import { projects as legacyProjects } from '../../data/projects';
export function usePublicProjects() {
    const remote = import.meta.env.VITE_PROJECTS_SOURCE === 'supabase';
    const [result,setResult] = useState({ projects: remote ? [] : legacyProjects, loading: remote, error: false });
    const [version,setVersion] = useState(0);
    const retry = useCallback(() => setVersion(value => value + 1),[]);
    useEffect(() => {
        if (!remote) return;
        let cancelled = false;
        let generation = 0;
        const load = async () => {
            const ticket = ++generation;
            try {
                const [{ getPublicSupabaseClient },{ publicProjects }] = await Promise.all([import('../../lib/publicSupabase'),import('./service')]);
                const client = getPublicSupabaseClient(); if (!client) throw new Error('Missing configuration');
                const projects = await publicProjects(client);
                if (!cancelled && ticket === generation) setResult({ projects,loading:false,error:false });
            } catch { if (!cancelled && ticket === generation) setResult({ projects:[],loading:false,error:true }); }
        };
        void load();
        const interval = setInterval(load,240000); // Renew five-minute signed URLs.
        const onFocus = () => void load();
        window.addEventListener('focus',onFocus);
        return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus',onFocus); };
    },[remote,version]);
    return { ...result,retry };
}
