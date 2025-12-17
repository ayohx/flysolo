import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load ALL env vars (both from .env files and process.env)
    // The empty string prefix '' means load all, not just VITE_ prefixed
    const env = loadEnv(mode, process.cwd(), '');
    
    // For Netlify: environment variables are in process.env during build
    // Prioritize VITE_* names (what Netlify has), fall back to non-prefixed (local dev)
    const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || env.API_KEY || '';
    const IMAGEN_KEY = process.env.VITE_IMAGEN_API_KEY || env.VITE_IMAGEN_API_KEY || env.IMAGEN_API_KEY || GEMINI_KEY;
    const VEO_KEY = process.env.VITE_VEO_API_KEY || env.VITE_VEO_API_KEY || env.VEO_API_KEY || GEMINI_KEY;
    const VEO_KEY_2 = process.env.VITE_VEO_API_KEY_2 || env.VITE_VEO_API_KEY_2 || env.VEO_API_KEY_2 || VEO_KEY;
    
    console.log('🔑 Build-time env check:', {
      hasGemini: !!GEMINI_KEY,
      hasImagen: !!IMAGEN_KEY,
      hasVeo: !!VEO_KEY,
    });
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(GEMINI_KEY),
        'process.env.IMAGEN_API_KEY': JSON.stringify(IMAGEN_KEY),
        'process.env.VEO_API_KEY': JSON.stringify(VEO_KEY),
        'process.env.VEO_API_KEY_2': JSON.stringify(VEO_KEY_2),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
