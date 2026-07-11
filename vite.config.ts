import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
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
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB for large backgrounds
        dontCacheBustURLsMatching: /\.(png|jpg|jpeg|svg|webp|woff|woff2|csv|mp3|ogg|wav)$/,
        // Precache only the app shell + data (JS/CSS/HTML/CSV + kanji stroke
        // JSON ≈ a few MB). Heavy media (500+ monster PNGs, backgrounds, music
        // ≈ 200MB) is intentionally NOT precached — it is cached on demand by
        // the runtimeCaching rules below, keeping first load/install light.
        globPatterns: ['**/*.{js,css,html,csv}', 'kanji-data/**/*.json'],
        // Exclude files that are in includeAssets to avoid conflicts
        globIgnores: ['**/icon-*.png', '**/apple-touch-icon.png', '**/favicon.ico', '**/masked-icon.svg'],
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
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: ({ url }) => /\.(mp3|ogg|wav)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
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
