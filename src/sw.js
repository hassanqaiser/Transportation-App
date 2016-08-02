var staticCacheName = 'transApp-static-v1';
var allCaches = [
  staticCacheName
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      return cache.addAll([
        '/',
        'index.html',
        'favicon.ico',
        'scripts/app-4c071228aa.js',
        'scripts/vendor-6435bbb57c.js',
        'styles/app-bc891c8092.css',
        'styles/vendor-a2eee1e9a0.css'
      ]);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      console.log(cacheNames);

      return Promise.all(
        cacheNames.filter(function(cacheName) {

          return cacheName.startsWith('transApp-static-') && !allCaches.includes(cacheName);

        }).map(function(cacheName) {

          console.log(cacheName);
          return caches.delete(cacheName);

        })

      );

    })
  );
});

self.addEventListener('fetch', function(event) {
  if(event.request.method === "GET"){
    var requestUrl = new URL(event.request.url);
    event.respondWith(
      caches.match(event.request).then(function(response) {
        if (response) {
          return response;
        }

        var fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(function(response) {

            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            var responseToCache = response.clone();

            caches.open(staticCacheName).then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
  }

});
