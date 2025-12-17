import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load from .env files (local development)
    const envFromFile = loadEnv(mode, '.', '');
    
    // For Netlify/production: also check system environment variables
    // Netlify sets env vars in process.env during build
    const getEnv = (key: string) => {
      return envFromFile[key] || process.env[key] || '';
    };
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Main Gemini API key for text/analysis
        // Supports: API_KEY, GEMINI_API_KEY, or VITE_GEMINI_API_KEY
        'process.env.API_KEY': JSON.stringify(
          getEnv('VITE_GEMINI_API_KEY') || getEnv('GEMINI_API_KEY') || getEnv('API_KEY')
        ),
        // Imagen API key for image generation
        'process.env.IMAGEN_API_KEY': JSON.stringify(
          getEnv('VITE_IMAGEN_API_KEY') || getEnv('IMAGEN_API_KEY') || getEnv('API_KEY')
        ),
        // VEO API keys for video generation (primary and backup)
        'process.env.VEO_API_KEY': JSON.stringify(
          getEnv('VITE_VEO_API_KEY') || getEnv('VEO_API_KEY') || getEnv('API_KEY')
        ),
        'process.env.VEO_API_KEY_2': JSON.stringify(
          getEnv('VITE_VEO_API_KEY_2') || getEnv('VEO_API_KEY_2') || getEnv('VEO_API_KEY') || getEnv('API_KEY')
        ),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
