import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Main Gemini API key for text/analysis (supports both API_KEY and GEMINI_API_KEY)
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        // Imagen API key for image generation (optional - falls back to main key)
        'process.env.IMAGEN_API_KEY': JSON.stringify(env.IMAGEN_API_KEY),
        // VEO API keys for video generation (primary and backup)
        'process.env.VEO_API_KEY': JSON.stringify(env.VEO_API_KEY),
        'process.env.VEO_API_KEY_2': JSON.stringify(env.VEO_API_KEY_2),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
