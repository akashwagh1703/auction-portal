import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
  },
  build: {
    // Enable source maps for production debugging
    sourcemap: false,
    // Minify CSS
    cssMinify: true,
    // Chunk size warning limit (in kB)
    chunkSizeWarningLimit: 1000,
    // Rollup options for optimization
    rollupOptions: {
      output: {
        // Manual chunks for better caching (function for Vite v8 compatibility)
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor'
            }
            if (id.includes('lucide-react') || id.includes('react-hot-toast')) {
              return 'ui-vendor'
            }
            if (id.includes('axios') || id.includes('laravel-echo') || id.includes('pusher')) {
              return 'api-vendor'
            }
            if (id.includes('xlsx')) {
              return 'utils-vendor'
            }
          }
        },
        // Asset naming
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'axios'],
    },
  },
})
