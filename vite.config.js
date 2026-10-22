import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { isUnsafeBrowserKey } from './src/lib/supabaseConfig.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  if (Object.values(env).some(isUnsafeBrowserKey)) {
    throw new Error('A privileged Supabase key was placed in a VITE_ variable. Remove it and rotate it if previously exposed.');
  }
  if (env.VITE_PROJECTS_SOURCE && !['local','supabase'].includes(env.VITE_PROJECTS_SOURCE)) throw new Error('VITE_PROJECTS_SOURCE must be local or supabase');
  return { plugins: [react(), svgr()] };
});
