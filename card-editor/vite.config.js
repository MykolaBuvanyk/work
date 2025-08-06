import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['fabric'],
  },
  server: {
    allowedHosts: ['305dce6666b4.ngrok-free.app'],
  },
})
