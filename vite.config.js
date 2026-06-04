import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy to WordPress at XAMPP (D:\xampp\htdocs\rodeo-performance-network)
      // Rewrite so path becomes /rodeo-performance-network/wp-json/... on the server
      '/wp-json': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wp-json/, '/rodeo-performance-network/wp-json'),
      },
    },
    port: 5174,
    strictPort: true, // This prevents Vite from jumping to another port if 5174 is busy
  },
})
