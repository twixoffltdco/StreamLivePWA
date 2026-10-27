import type { Metadata } from 'next';
import WatchClient from '@/components/WatchClient';
export const metadata: Metadata = { title: 'Просмотр — StreamLive' };
export default function WatchPage({params}:{params:{id:string}}){ return <WatchClient id={params.id}/> }
