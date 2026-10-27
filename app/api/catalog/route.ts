import { NextResponse } from 'next/server';
import { fetchChannels, type SourceId } from '@/lib/scraper';
export const dynamic = 'force-dynamic';
export const revalidate = 60;
const IDS: SourceId[] = ['domtv', 'freedev', 'web1337'];
export async function GET(req: Request) {
  const selected = new URL(req.url).searchParams.get('source');
  const sources = selected && IDS.includes(selected as SourceId) ? [selected as SourceId] : IDS;
  const results = await Promise.all(sources.map(async source => ({ source, items: await fetchChannels(source) })));
  return NextResponse.json({ ok: true, sources: results, items: results.flatMap(x => x.items) }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
