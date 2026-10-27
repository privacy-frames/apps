/// <reference lib="webworker" />

const notebookWorker = self as unknown as ServiceWorkerGlobalScope;

notebookWorker.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open('notebook-v1')
      .then((cache) =>
        cache.addAll(['./', 'app.js', 'app.css', 'article.json', 'cover.svg']),
      ),
  );
});

notebookWorker.addEventListener('activate', (event) => {
  event.waitUntil(notebookWorker.clients.claim());
});

notebookWorker.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  );
});
