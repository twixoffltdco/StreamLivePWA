import { NextResponse } from 'next/server';
import { fetchSourceCatalog, type SourceId } from '@/lib/scraper';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const IDS: SourceId[] = ['freedev', 'domtv', 'web1337'];

export async function GET(req: Request) {
  const selected = new URL(req.url).searchParams.get('source');
  const sources = selected && IDS.includes(selected as SourceId) ? [selected as SourceId] : IDS;
  // Parallel requests keep one slow mirror from delaying sequentially fetched sources.
  const results = await Promise.all(sources.map((source) => fetchSourceCatalog(source)));
  const items = results.flatMap((result) => result.items); // Do not deduplicate across mirrors.
  const failedSources = results.filter((result) => !result.diagnostic.ok || result.items.length === 0).length;
  return NextResponse.json({
    ok: items.length > 0,
    items,
    sources: results.map(({ source, items: sourceItems, diagnostic }) => ({ source, count: sourceItems.length, diagnostic })),
    diagnostics: results.map((result) => result.diagnostic),
    meta: { requestedSources: sources.length, successfulSources: results.length - failedSources, totalItems: items.length, duplicatesAcrossSourcesPreserved: true },
  }, {
    status: 200,
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
