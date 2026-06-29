import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'

function versionServiceWorker(): Plugin {
  let resolvedConfig: ResolvedConfig

  return {
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config
    },
    async closeBundle() {
      const serviceWorkerPath = resolve(
        resolvedConfig.root,
        resolvedConfig.build.outDir,
        'sw.js',
      )
      const buildId = (
        process.env.CF_PAGES_COMMIT_SHA ??
        process.env.GITHUB_SHA ??
        Date.now().toString(36)
      ).slice(0, 16)
      const serviceWorker = await readFile(serviceWorkerPath, 'utf8')

      await writeFile(
        serviceWorkerPath,
        serviceWorker.replaceAll('__BW_BUILD_ID__', buildId),
        'utf8',
      )
    },
    name: 'bw-barber-service-worker-version',
  }
}

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

  plugins: [react(), tailwindcss(), versionServiceWorker()],
})
