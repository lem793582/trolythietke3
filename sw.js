// Tên của bộ nhớ cache - Tăng phiên bản để buộc cập nhật
const CACHE_NAME = 'hotro-pmtl-cache-v2';

// QUAN TRỌNG: Chỉ liệt kê những tệp thực sự tồn tại trên máy chủ của BẠN.
// Vì trang của bạn tải CSS/JS từ CDN, chúng ta chỉ cần lưu các tệp HTML cốt lõi.
const urlsToCache = [
  '/',             // Trang chính
  '/index.html',   // Thường là trang chính, nên có cả hai
  '/manifest.json',// Tệp manifest của ứng dụng
  // Các icon đã được sửa đường dẫn
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png'
  // KHÔNG thêm các link CDN như của tailwindcss vào đây.
  // KHÔNG thêm các đường dẫn không tồn tại như '/styles/main.css'.
];

// Sự kiện 'install': được kích hoạt khi service worker được cài đặt
self.addEventListener('install', event => {
  // Đợi cho đến khi các tệp được cache xong
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching assets');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        // Ghi lại lỗi cụ thể nếu quá trình cache thất bại
        console.error('Failed to cache assets during install:', error);
      })
  );
});

// Sự kiện 'fetch': được kích hoạt mỗi khi có yêu cầu mạng
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Nếu có trong cache, trả về từ cache
        if (response) {
          return response;
        }
        // Nếu không, thực hiện yêu cầu mạng thực sự
        return fetch(event.request);
      })
  );
});

// Sự kiện 'activate': được kích hoạt để dọn dẹp các cache cũ
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME]; // Chỉ giữ lại cache phiên bản hiện tại
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
