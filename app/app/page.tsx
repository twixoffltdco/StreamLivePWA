import type { Metadata } from 'next';
import CatalogApp from '@/components/CatalogApp';
export const metadata: Metadata = { title: 'StreamLive — каталог', description: 'Единый нативный каталог каналов и видео StreamLive для телефона, планшета и ТВ.' };
export default function AppPage(){ return <CatalogApp/> }
