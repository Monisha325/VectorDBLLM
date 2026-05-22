import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/search':    { target: 'http://localhost:8080', changeOrigin: true },
      '/insert':    { target: 'http://localhost:8080', changeOrigin: true },
      '/delete':    { target: 'http://localhost:8080', changeOrigin: true },
      '/items':     { target: 'http://localhost:8080', changeOrigin: true },
      '/benchmark': { target: 'http://localhost:8080', changeOrigin: true },
      '/hnsw-info': { target: 'http://localhost:8080', changeOrigin: true },
      '/stats':     { target: 'http://localhost:8080', changeOrigin: true },
      '/doc':       { target: 'http://localhost:8080', changeOrigin: true },
      '/status':    { target: 'http://localhost:8080', changeOrigin: true },
    }
  }
})
