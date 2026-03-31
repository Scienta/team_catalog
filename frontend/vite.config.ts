import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/config': 'http://localhost:8080',
      '/sync': 'http://localhost:8080',
      '/check-contracts': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
      '/auth': 'http://localhost:8080',
      '/consultants': 'http://localhost:8080',
      '/test-email': 'http://localhost:8080',
    },
  },
})
