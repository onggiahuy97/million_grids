import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/ws': {
        target: 'ws://10.0.0.241:8080',
        ws: true,
      },
    },
  },
})
