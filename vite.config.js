import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Nidoo', short_name: 'Nidoo', lang: 'fr',
        description: 'La marketplace des mamans et bébés en RDC',
        theme_color: '#1F5C63', background_color: '#EEF5F3',
        display: 'standalone', start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [{
          urlPattern: ({ url, request }) => request.method === 'GET' && /\/rest\/v1\/(products|stores|ads_banner)/.test(url.pathname),
          handler: 'NetworkFirst',
          options: { cacheName: 'nidoo-api', networkTimeoutSeconds: 4, expiration: { maxEntries: 80, maxAgeSeconds: 86400 } }
        }, {
          urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/'),
          handler: 'CacheFirst',
          options: { cacheName: 'nidoo-images', expiration: { maxEntries: 120, maxAgeSeconds: 2592000 } }
        }]
      }
    })
  ]
})
