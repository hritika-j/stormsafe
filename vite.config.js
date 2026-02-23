import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/claude': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api/mta-alerts': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api/path': {
        target: 'https://www.panynj.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/path/, '')
      }
    }
  }
})
