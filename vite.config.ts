import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const supabaseUrl = loadEnv(mode, '.', 'VITE_').VITE_SUPABASE_URL
  const supabaseOrigin = supabaseUrl?.match(/^https?:\/\/[^/]+/)?.[0] ?? null

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
              urlPattern: ({ url }) => String(url).startsWith('https://tile.openstreetmap.org/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-map-tiles',
                expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ url }) =>
                /\/storage\/v1\/object\/public\/product-photos\/.+-t\.jpg(?:\?.*)?$/.test(String(url)),
              handler: 'CacheFirst',
              options: {
                cacheName: 'product-thumbnails',
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ url }) =>
                (!supabaseOrigin || String(url).startsWith(`${supabaseOrigin}/`)) &&
                /\/(?:auth|rest|storage|functions|realtime)\/v1\//.test(String(url)),
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
  }
})