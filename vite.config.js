import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import serviceWorkerPlugin from './plugins/vite-plugin-service-worker.js';
import swDevKillerPlugin from './plugins/vite-plugin-sw-dev-killer.js';

// `base: './'` makes asset URLs relative, so the same build works at a domain
// root (Vercel, Netlify) and in a sub-folder (GitHub Pages: /<repo>/).
// Routing uses the URL hash, so no server rewrite rules are needed either.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    swDevKillerPlugin(),
    serviceWorkerPlugin({
      swSrc: fileURLToPath(new URL('./src/sw/sw.js', import.meta.url)),
      // Files from public/ that belong to the application shell. The catalogue
      // under public/api/ is deliberately absent: it is runtime-cached on use, so
      // 181 files are not downloaded during install.
      extraPrecache: [
        'offline.html',
        'manifest.webmanifest',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon-180.png',
      ],
    }),
  ],
  server: { port: 5173 },
  preview: { port: 4173 },
});
