import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  optimizeDeps: {
    include: ['fabric'],
  },
  server: {
    allowedHosts: ['4576a41395b0.ngrok-free.app'],
  },
})
