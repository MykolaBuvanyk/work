import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['fabric'],
  },
  server: {
    allowedHosts: ['f1fd96d60e13.ngrok-free.app'],
  },
})
