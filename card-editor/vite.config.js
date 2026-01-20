import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  optimizeDeps: {
    include: ['fabric'],
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      'talk-identifies-changing-angela.trycloudflare.com',
    ],
  },
});
