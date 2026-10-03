import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
    }),
  ],
})