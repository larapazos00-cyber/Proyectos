import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'sw-push-handlers.js',
        ],
        manifest: {
          id: '/',
          name: 'StudyFlow · Planificador Inteligente de Estudio',
          short_name: 'StudyFlow',
          description:
            'Organizador integral de estudios con planificación adaptativa, repetición espaciada, Active Recall, método Cornell y soporte Offline completo.',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15 MiB para soportar bundles completos (PDF.js, Mermaid, D3, Recharts)
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          importScripts: ['/sw-push-handlers.js'],
          runtimeCaching: [
            {
              // Recursos estáticos de la aplicación (JS, CSS, Web Workers) con Stale-While-Revalidate
              urlPattern: ({ request, url }) =>
                !url.pathname.startsWith('/@') &&
                !url.pathname.startsWith('/src/') &&
                !url.pathname.startsWith('/node_modules/') &&
                (request.destination === 'script' ||
                  request.destination === 'style' ||
                  request.destination === 'worker'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'studyflow-static-resources-swr-v2',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Imágenes, iconos e ilustraciones locales/remotas con Stale-While-Revalidate
              urlPattern: ({ request, url }) =>
                !url.pathname.startsWith('/@') &&
                (request.destination === 'image' ||
                  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname)),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'studyflow-images-assets-swr-v2',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 60, // 60 días
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Hojas de estilo y fuentes de Google Fonts con Stale-While-Revalidate
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'studyflow-google-fonts-swr-v2',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Documentos HTML, Manifiesto y metadatos locales con NetworkFirst para que cada republicación cargue al instante sin perder acceso offline
              urlPattern: ({ request, sameOrigin, url }) =>
                sameOrigin &&
                !url.pathname.startsWith('/api/') &&
                !url.pathname.startsWith('/@') &&
                (request.mode === 'navigate' ||
                  request.destination === 'document' ||
                  request.destination === 'manifest'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'studyflow-app-shell-nf-v3',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 14, // 14 días
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
      {
        name: 'suppress-vite-hmr-websocket-error',
        transform(code, id) {
          if (id.includes('vite/dist/client/client.mjs')) {
            return code
              .replace(
                'let isConnected = !invokeableTransport.connect;',
                'let isConnected = true;'
              )
              .replace(
                /throw new SendBeforeConnectError\([^)]*\)/g,
                'return'
              )
              .replace(
                /const createWebSocketModuleRunnerTransport = \(options\) => \{[\s\S]*?return \{[\s\S]*?\};\n\};/,
                'const createWebSocketModuleRunnerTransport = () => ({ connect() {}, disconnect() {}, send() {} });'
              );
          }
          if (id.includes('pwa-entry-point-loaded')) {
            return code.replace(
              /import\.meta\.hot\.send\([^)]*\);?/g,
              '/* dev-ready skipped when HMR disabled */'
            );
          }
          return null;
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
