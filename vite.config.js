import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3080' } }
  },
  preview: {
    proxy: { '/api': { target: 'http://127.0.0.1:3080' } }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: false,
    sourcemap: false
  }
})
