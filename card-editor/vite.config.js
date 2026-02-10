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
      '127.0.0.1',
      'likewise-bat-warning-dat.trycloudflare.com',
      '5fceac8d4e39.ngrok-free.app'
    ],
  },
});
