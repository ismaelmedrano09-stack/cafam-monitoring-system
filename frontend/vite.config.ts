import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const apiUrl = process.env.VITE_API_URL || 'http://localhost:4000/api';
const escapedApiUrl = apiUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: new RegExp(`^${escapedApiUrl}/(dashboard|sensors|alarms)`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cafam-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5
            }
          }
        ]
      },
      manifest: {
        name: 'Cafam Telemetría',
        short_name: 'Cafam',
        description: 'Monitoreo de temperatura y humedad — Clínicas Cafam',
        theme_color: '#0b4f8a',
        background_color: '#f4f8fb',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        categories: ['medical', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' }
        ]
      }
    })
  ],
  server: { port: 5173 }
});
