import { NextResponse } from 'next/server';
import { fetchChannels, type SourceId } from '@/lib/scraper';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url); const selected = searchParams.get('source');
  const sources: SourceId[] = selected && ['domtv','freedev','web1337','streamlive'].includes(selected) ? [selected as SourceId] : ['streamlive','domtv','freedev','web1337'];
  const results = await Promise.all(sources.map(async source => ({ source, items: await fetchChannels(source) })));
  return NextResponse.json({ ok: true, sources: results, items: results.flatMap(x => x.items) }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
}
