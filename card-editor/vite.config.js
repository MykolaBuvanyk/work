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
    allowedHosts: ['f8c5d7e65196.ngrok-free.app'],
  },
});
