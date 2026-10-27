/**
 * app/app/page.tsx — интерфейс нативного приложения (start_url из manifest).
 * Открывается после установки PWA (или по ссылке "Открыть приложение").
 */

import type { Metadata } from 'next';
import AppPlayer from '@/components/AppPlayer';

export const metadata: Metadata = {
  title: 'StreamLive TV — смотреть',
  description:
    'Просмотр domtv.blyz.ru, streamlivetv.freedev.app и streamliveru.web1337.net в нативном PWA-интерфейсе с управлением с пульта.',
};

export default function AppPage() {
  return <AppPlayer />;
}
