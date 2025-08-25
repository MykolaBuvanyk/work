import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['fabric'],
  },
  server: {
    allowedHosts: ['491a598e4f8b.ngrok-free.app'],
  },
})
