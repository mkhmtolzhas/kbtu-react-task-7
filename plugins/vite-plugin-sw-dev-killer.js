/**
 * The development server has no service worker on purpose: there is no precache
 * manifest before a build, and a caching worker fights HMR in ways that look like
 * impossible bugs.
 *
 * But a worker installed earlier by `vite preview` on the same host and port
 * would survive and keep serving a stale build. So in dev `/sw.js` answers with a
 * worker whose only job is to delete itself and this app's caches, and to reload
 * the pages it controlled.
 */
export default function swDevKillerPlugin() {
  return {
    name: 'fleetdesk:sw-dev-killer',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use('/sw.js', (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript');
        response.setHeader('Cache-Control', 'no-store');
        response.end([
          "self.addEventListener('install', () => self.skipWaiting());",
          "self.addEventListener('activate', (event) => event.waitUntil((async () => {",
          '  await self.registration.unregister();',
          "  for (const key of await caches.keys()) if (key.startsWith('fleetdesk-')) await caches.delete(key);",
          '  for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);',
          '})()));',
        ].join('\n'));
      });
    },
  };
}
