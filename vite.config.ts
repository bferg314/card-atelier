import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Listen on all interfaces so phones and other machines on the network can preview the dev site.
  server: { host: true, port: 5173, strictPort: false },
  preview: { host: true, port: 5173 },
})
