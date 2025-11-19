import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests to the serverless function during local dev
      '/api': {
        target: 'http://localhost:3000', 
        changeOrigin: true,
      },
    },
  },
});