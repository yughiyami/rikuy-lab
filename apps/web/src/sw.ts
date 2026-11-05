/// <reference lib="webworker" />
/**
 * Service worker (vite-plugin-pwa, injectManifest). Owned by F1.
 * - Precaches the whole build (group "base") so the shell opens offline after one online visit.
 * - Other groups (clase, gestos, senales) are loaded on request with a message from the page.
 * - /api and /ws always go to the network. A new version waits until the page asks for it.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { separarPorGrupo, type EntradaPrecache, type GrupoDePrecache } from './platform/pwa/grupos.ts';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: EntradaPrecache[] };

const grupos = separarPorGrupo(self.__WB_MANIFEST);

cleanupOutdatedCaches();
// Query strings (display.html?sala=ABC) must not miss the precached page.
precacheAndRoute(grupos.base, { ignoreURLParametersMatching: [/.*/] });

// Hash routing: every navigation is the app shell, except the legacy pages that are real files.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/\/(clasico|display|control|panel)\.html$/, /\/api\//, /\/ws$/, /^\/pitch(\/|$)/],
  }),
);

const cacheDeGrupo = (g: GrupoDePrecache) => `rikuy-${g}`;
const urlsOpcionales = new Set(
  (['clase', 'gestos', 'senales'] as const).flatMap((g) => grupos[g].map((e) => new URL(e.url, self.registration.scope).pathname)),
);
registerRoute(({ url }) => urlsOpcionales.has(url.pathname), new CacheFirst({ cacheName: 'rikuy-opcional' }));

self.addEventListener('message', (evento) => {
  const datos = evento.data as { type?: string; grupo?: GrupoDePrecache } | undefined;
  if (datos?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }
  if (datos?.type === 'PRECACHE_GRUPO' && datos.grupo && datos.grupo !== 'base') {
    const grupo = datos.grupo;
    evento.waitUntil(
      caches.open(cacheDeGrupo(grupo)).then((cache) => cache.addAll(grupos[grupo].map((e) => new URL(e.url, self.registration.scope).href))),
    );
  }
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});
