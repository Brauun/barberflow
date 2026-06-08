import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true,
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (
            id.includes('@hookform') ||
            id.includes('react-hook-form') ||
            id.includes('zod')
          ) {
            return 'forms'
          }

          if (id.includes('@tanstack')) {
            return 'query'
          }

          if (id.includes('@supabase')) {
            return 'supabase'
          }

          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react-router-dom')
          ) {
            return 'react'
          }

          return 'vendor'
        },
      },
    },
  },

  plugins: [react(), tailwindcss()],
})