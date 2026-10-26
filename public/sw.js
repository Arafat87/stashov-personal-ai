/* Stashov service worker: only the Web Share Target POST is intercepted. */
'use strict';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function firstUrl(value) {
  const match = String(value || '').match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : '';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.origin !== self.location.origin || url.pathname !== '/share-target') {
    return;
  }
  event.respondWith((async () => {
    let shared = '';
    try {
      const form = await request.formData();
      shared = String(form.get('url') || '') || firstUrl(form.get('text') || '') || firstUrl(form.get('title') || '');
    } catch (_) {}
    const target = shared
      ? `/?capture=${encodeURIComponent(shared)}`
      : '/?share=empty';
    return Response.redirect(new URL(target, self.location.origin).href, 303);
  })());
});
