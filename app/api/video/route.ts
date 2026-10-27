import { NextResponse } from 'next/server';
import { fetchVideoData, type SourceId } from '@/lib/scraper';
export async function GET(req: Request) {
  const u = new URL(req.url), url = u.searchParams.get('url') || '', source = (u.searchParams.get('source') || 'streamlive') as SourceId;
  try { return NextResponse.json({ ok: true, video: await fetchVideoData(url, source) }); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Не удалось загрузить видео' }, { status: 400 }); }
}
