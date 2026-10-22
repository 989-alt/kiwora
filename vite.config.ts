/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages serves under /kiwora/ (npm run build:pages); everywhere else the app sits at the root.
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // public/manifest.webmanifest is served as-is
      workbox: {
        // Fonts are self-hosted (@fontsource): only the .woff2 files (every browser with a service worker reads them).
        globPatterns: ['**/*.{js,css,html,woff2,png,webp,json,webmanifest}'],
        // The shared stand-in picture (1 MB) is never shown once every species has its own art.
        globIgnores: ['**/plants/standin.png'],
        // Art is .webp (<= 1024 px); the largest files (backgrounds, stand-in .png) stay well under this.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/ui/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}', 'tests/sim/**/*.test.{ts,tsx}'],
  },
})
