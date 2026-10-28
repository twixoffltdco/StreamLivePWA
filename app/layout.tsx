import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'StreamLive PWA — единый каталог каналов, видео и форума',
  description:
    'StreamLive PWA объединяет каналы, видео и материалы с domtv.blyz.ru, streamlivetv.freedev.app и streamliveru.web1337.net. Установка на телефон, планшет и совместимые ТВ-устройства.',
  manifest: '/manifest.json',
  applicationName: 'StreamLive PWA',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StreamLive',
    startupImage: '/icons/icon-512.svg',
  },
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#000000',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/icon-192.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-black font-display text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
