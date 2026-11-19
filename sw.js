/* Mes tâches · service worker
 * Garde les fichiers de l'app pour qu'elle s'ouvre même sans Internet.
 * À chaque nouvelle version, changer VERSION : l'app propose alors « Mettre à jour ».
 */
const VERSION = '2.1.1';
const CACHE = `mes-taches-${VERSION}`;
const FICHIERS = [
  './', 'index.html', 'styles.css', 'config.js', 'coffre.js', 'noyau.js', 'stockage.js', 'agenda.js', 'app.js',
  'manifest.webmanifest', 'icone.svg', 'icone-180.png', 'icone-192.png', 'icone-512.png', 'icone-masquable-512.png',
  'polices/public-sans-latin-400-normal.woff2', 'polices/public-sans-latin-600-normal.woff2', 'polices/public-sans-latin-700-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' })))));
});

// La nouvelle version attend que l'utilisateur clique « Mettre à jour » (rien n'est perdu en cours d'édition).
self.addEventListener('message', (e) => { if (e.data === 'activer') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('mes-taches-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // Google : jamais intercepté
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const trouve = await cache.match(e.request, { ignoreSearch: true });
    if (trouve) return trouve;
    try {
      return await fetch(e.request);
    } catch (err) {
      if (e.request.mode === 'navigate') {
        const accueil = await cache.match('index.html');
        if (accueil) return accueil;
      }
      throw err;
    }
  })());
});
