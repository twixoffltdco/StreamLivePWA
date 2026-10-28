import { NextResponse } from 'next/server';
import { fetchVideoData, type SourceId } from '@/lib/scraper';

export const runtime = 'nodejs';
const IDS: SourceId[] = ['freedev', 'domtv', 'web1337'];
export async function GET(req: Request) {
  const u = new URL(req.url), url = u.searchParams.get('url') || '', raw = u.searchParams.get('source') || 'domtv';
  if (!IDS.includes(raw as SourceId)) return NextResponse.json({ ok: false, error: 'Неизвестный источник' }, { status: 400 });
  try { return NextResponse.json({ ok: true, video: await fetchVideoData(url, raw as SourceId) }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Не удалось загрузить видео' }, { status: 400 }); }
}
