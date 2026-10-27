// next.config.js — конфигурация Next.js + PWA (Service Worker + Precache)
// next-pwa генерирует sw.js в public/ при production-сборке.
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,          // автоматически регистрирует service worker
  skipWaiting: true,       // мгновенное активация нового SW
  disable: process.env.NODE_ENV === 'development', // в dev — отключено
  // Важно: next-pwa@5.6.0 принимает только часть опций на верхнем уровне
  // (dest, register, skipWaiting, cacheOnFrontEndNav, reloadOnOnline и т.д.).
  // Всё остальное через "...workbox" прокидывается напрямую в GenerateSW
  // workbox-webpack-plugin, который валидирует свои поля и падает на
  // неизвестных ('buildExts' / 'aggressiveFrontEndNavCaching' не поддерживаются).
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  disableDevLogs: true,
  // Стриминговые домены НЕ кешируем (iframe-контент всегда живой),
  // кешируем только own-origin статические ресурсы.
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Для деплоя статики на Tatnet / Onrender / Layer0 можно включить:
  // output: 'export',
  reactStrictMode: true,
  images: {
    unoptimized: true, // iframe-ориентированное приложение: remote images не нужны
  },
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
      {
        // Разрешаем встраивание ourselves (на случай, если зеркало откроет нас во фрейме)
        source: '/(.*)',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
