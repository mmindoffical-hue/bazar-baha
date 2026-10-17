import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: 'Bazar Baha',
          short_name: 'Bazar Baha',
          description: 'Türkmenistanda haryt bahalary',
          lang: 'tk',
          theme_color: '#f7f8f4',
          background_color: '#f7f8f4',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/bazar-baha.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-map-tiles',
                expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: /\/storage\/v1\/object\/public\/product-photos\/.+-t\.jpg(?:\?.*)?$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'product-thumbnails',
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: /\/storage\/v1\/object\/public\/product-photos\/(?![^?]*-t\.jpg(?:\?.*)?$)[^?]+\.jpg(?:\?.*)?$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'product-photos',
                expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
    ],
  }
})
