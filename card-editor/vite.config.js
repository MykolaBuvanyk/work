import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['fabric'],
  },
  server: {
    allowedHosts: ['2b0edf83ed45.ngrok-free.app'],
  },
})
