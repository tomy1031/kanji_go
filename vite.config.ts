import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/kanji_go/',
  plugins: [
    react(),
    VitePWA({
      // Service worker auto-updates in the background and reloads seamlessly,
      // so users always get the latest version with no manual steps.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/kanji_go/',
        name: 'Kanji Go!',
        short_name: 'Kanji Go',
        description: 'Learn Japanese Kanji through Pokemon-style battles',
        lang: 'ja',
        start_url: '/kanji_go/',
        scope: '/kanji_go/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        categories: ['games', 'education'],
        icons: [
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + small stroke data + icons for instant offline
        // launch. Large media (backgrounds/monsters/music) is runtime-cached.
        globPatterns: [
          '**/*.{js,css,html,woff2}',
          'kanji-data/**/*.json',
          'icon-*.png',
          'maskable-*.png',
          'apple-touch-icon.png',
          'favicon.png',
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'kanjigo-images',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'audio',
            handler: 'CacheFirst',
            options: {
              cacheName: 'kanjigo-audio',
              rangeRequests: true,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
