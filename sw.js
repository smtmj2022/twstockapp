// 定義快取版本與靜態資源清單
const CACHE_NAME = 'tw-stock-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// Service Worker 安裝事件：將靜態資源寫入快取
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 使用 force-cache 確保不載入舊快取
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // 強制啟用新的 Service Worker
});

// Service Worker 啟用事件：清理舊的快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // 刪除非目前版本的舊快取
          }
        })
      );
    })
  );
  self.clients.claim(); // 取得頁面控制權
});

// 攔截 Fetch 請求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 【關鍵要求】攔截 fetch 請求時，必須放行對「twse.com.tw」或「股票 API」的請求，讓股價更新資料一律走即時網路
  if (url.hostname.includes('twse.com.tw') || url.pathname.includes('getStockInfo.jsp')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 快取優先 (Cache-First) 策略，適用於 HTML、JSON 配置文件、圖標、Tailwind CSS CDN 及 Google Fonts 等
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // 命中快取，直接返回
      }

      // 未命中快取，向網路發送請求，並動態將資源寫入快取中
      return fetch(event.request).then((networkResponse) => {
        // 僅快取成功的 GET 請求
        if (!networkResponse || networkResponse.status !== 200 || event.request.method !== 'GET') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch((err) => {
        console.error('Fetch 失敗，且無快取資源可用:', err);
      });
    })
  );
});
