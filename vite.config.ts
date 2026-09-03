import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon-180.png', 'icon-192x192.png', 'icon-512x512.png'],
      manifest: {
        id: '/kanji_go/',
        name: 'Kanji Go!',
        short_name: 'Kanji Go',
        description: 'Learn Japanese Kanji through Pokemon-style battles',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/kanji_go/',
        start_url: '/kanji_go/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for large backgrounds
        dontCacheBustURLsMatching: /\.(png|jpg|jpeg|svg|webp|woff|woff2|csv|mp3|ogg|wav)$/,
        // Precache the app shell plus the stroke data the game actually needs
        // (pruned from 3,775 files/11MB down to the 618 kanji in the game, so
        // the all-or-nothing SW install is small enough to reliably succeed).
        // Art and music are cached on demand by the runtime rules below and can
        // be fetched in full from the in-game "offline preparation" button.
        globPatterns: ['**/*.{js,css,html}', 'kanji-data/**/*.json'],
        globIgnores: ['**/icon-*.png', '**/apple-touch-icon*.png'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/kanji_go/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.csv'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'csv-data-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: ({ url }) => /\.(png|jpg|jpeg|svg|webp)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 700, // covers all monster art + backgrounds
                maxAgeSeconds: 60 * 60 * 24 * 365, // a year: offline play must survive
                purgeOnQuotaError: true
              }
            }
          },
          {
            urlPattern: ({ url }) => /\.(mp3|ogg|wav)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              // Media elements request byte ranges (HTTP 206). Without this the
              // cache could never store a single track and BGM re-streamed
              // every session and was silent offline.
              rangeRequests: true,
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
                purgeOnQuotaError: true
              }
            }
          },
          {
            // Cache kanji stroke data from jsdelivr CDN
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('hanzi-writer-data'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kanji-data-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              }
            }
          },
          {
            // Cache kanji stroke data from GitHub raw
            urlPattern: ({ url }) => url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('hanzi-writer-data'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kanji-data-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              }
            }
          }
        ]
      }
    })
  ],
  base: '/kanji_go/',
})
