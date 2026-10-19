import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Données mises en cache pour la consultation hors connexion : lectures (GET) de l'API uniquement,
// hors connexion/authentification et hors fichiers générés (PDF, exports Excel), qui n'ont de sens
// qu'à jour et pèseraient lourd dans le stockage du téléphone.
function lectureApiMiseEnCache({ url, request }: { url: URL; request: Request }): boolean {
  return (
    request.method === 'GET' &&
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth') &&
    !/\/pdf$|export-excel|\/journal/.test(url.pathname)
  );
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'icone.svg'],
      manifest: {
        name: 'RH AMP Holding',
        short_name: 'RH AMP',
        description: 'Gestion des ressources humaines AMP Holding',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#c2410c',
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Ouverture de l'application sans réseau : toute navigation retombe sur index.html (routage React).
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: lectureApiMiseEnCache,
            // Réseau d'abord (données à jour) ; au-delà de 8 s ou sans réseau, dernière réponse connue.
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rh-amp-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
