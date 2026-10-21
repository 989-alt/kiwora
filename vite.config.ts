/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // public/manifest.webmanifest is served as-is
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,webp,json,webmanifest}'],
        // Art is still large .png placeholders (up to ~1.7 MB) until the .webp set lands.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Google Fonts (Jua, Gowun Dodum): cached after the first online load.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
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
