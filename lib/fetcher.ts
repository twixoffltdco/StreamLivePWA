/**
 * StreamLive multi-mirror fetcher.
 * Important: links are collected from every mirror, and a card is parsed from
 * the exact URL it came from. IDs are hashes of full URLs, so same-title items
 * on production/reserve/mirror3 remain separate cards (duplicates are kept).
 */
import { createHash } from 'crypto';
import {
  FEED_LIMIT,
  FEED_REFRESH_SEC,
  MAX_NEW_SCRAPE_PER_RUN,
  SCRAPE_DELAY_MS,
  SOURCE_BASES,
  type SourceOrigin,
} from './config';
import { fetchWithChallenge } from './challenge';
import { extractContentLinks, extractVideoLinks, mapToEmbed, parseMeta } from './parse';
import {
  contentId,
  foreverCachePage,
  getArchivedIdSet,
  getArchivedItems,
  getMemoryFeed,
  persistToArchive,
  searchForumArchive,
  setMemoryFeed,
} from './cache';
import type { ForumArchiveEntry } from './cache';
import type { FeedResult, StreamContent } from './types';

function originForUrl(url: string): SourceOrigin {
  const host = new URL(url).hostname.toLowerCase();
  const found = SOURCE_BASES.find((s) => new URL(s.base).hostname.toLowerCase() === host);
  return found?.origin ?? 'prod';
}

/** Keep links discovered on a mirror on that same mirror, even if HTML hard-codes the production host. */
function rebaseMirrorUrl(value: string, currentBase: string): string {
  try {
    const parsed = new URL(value, currentBase);
    const knownMirror = SOURCE_BASES.some((source) => new URL(source.base).hostname.toLowerCase() === parsed.hostname.toLowerCase());
    if (!knownMirror) return parsed.toString();
    const base = new URL(currentBase);
    return `${base.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read all mirrors. We only suppress the exact same URL repeated by a page;
 * the same channel on another domain is a different URL and is intentionally kept.
 */
async function collectLinksFromAllMirrors(
  pathnames: string[],
  extract: (html: string, base: string) => string[],
): Promise<{ links: string[]; originsHit: SourceOrigin[] }> {
  const links: string[] = [];
  const exactUrls = new Set<string>();
  const originsHit: SourceOrigin[] = [];

  for (const { base, origin } of SOURCE_BASES) {
    let mirrorProducedLinks = false;
    for (const pathname of pathnames) {
      try {
        const { html } = await fetchWithChallenge(`${base}${pathname}`);
        if (!originsHit.includes(origin)) originsHit.push(origin);
        const found = extract(html, base).map((url) => rebaseMirrorUrl(url, base));
        for (const url of found) {
          // Exact URL repeats are the same listing entry. Different mirror hosts are never collapsed.
          if (!exactUrls.has(url)) {
            exactUrls.add(url);
            links.push(url);
          }
        }
        if (found.length > 0) {
          mirrorProducedLinks = true;
          break; // one usable listing page is enough for this mirror
        }
      } catch (e) {
        console.warn(`[fetcher] ${origin} ${pathname}:`, (e as Error).message);
      }
    }
    if (!mirrorProducedLinks) {
      console.warn(`[fetcher] ${origin}: listing paths returned no content links`);
    }
  }
  return { links, originsHit };
}

/** Parse metadata from the same mirror as the card URL. Never silently borrow another mirror's HTML. */
async function scrapeContentFromSource(sourceUrl: string): Promise<StreamContent> {
  const { html } = await fetchWithChallenge(sourceUrl);
  const meta = parseMeta(html);
  if (!meta.title) throw new Error(`Нет <title> у источника ${sourceUrl}`);
  const origin = originForUrl(sourceUrl);
  let image = meta.image;
  if (image) image = rebaseMirrorUrl(image, sourceUrl);
  return {
    id: contentId(sourceUrl),
    title: meta.title,
    description: meta.description || 'Без описания — смотрите в плеере.',
    image,
    sourceUrl,
    embedUrl: mapToEmbed(sourceUrl),
    kind: /video\.php|embed_video\.php/i.test(new URL(sourceUrl).pathname) ? 'video' : 'channel',
    origin,
    cachedAt: new Date().toISOString(),
  };
}
const scrapeContentCached = foreverCachePage(scrapeContentFromSource);

/** Round-robin new cards across mirrors so a busy production source cannot starve reserves. */
async function scrapeNewOnly(
  links: string[],
  knownIds: Set<string>,
  maxNew = MAX_NEW_SCRAPE_PER_RUN,
  archivedById: Map<string, StreamContent> = new Map(),
): Promise<StreamContent[]> {
  const queues = new Map<string, string[]>();
  for (const url of links) {
    const id = contentId(url);
    if (knownIds.has(id)) {
      const old = archivedById.get(id);
      // Previous builds sometimes stored metadata fetched from another mirror.
      // Refresh only those mismatched entries instead of re-fetching the whole archive.
      if (!old || old.origin === originForUrl(url)) continue;
    }
    const host = new URL(url).hostname.toLowerCase();
    const queue = queues.get(host) ?? [];
    if (!queue.includes(url)) queue.push(url);
    queues.set(host, queue);
  }

  const selected: string[] = [];
  const hosts = Array.from(queues.keys());
  while (selected.length < maxNew && hosts.some((host) => (queues.get(host)?.length ?? 0) > 0)) {
    for (const host of hosts) {
      if (selected.length >= maxNew) break;
      const next = queues.get(host)?.shift();
      if (next) selected.push(next);
    }
  }

  const out: StreamContent[] = [];
  for (let i = 0; i < selected.length; i++) {
    const url = selected[i];
    try {
      const item = await scrapeContentCached(url);
      out.push(item);
      knownIds.add(item.id);
    } catch (e) {
      console.warn(`[fetcher] source-specific parse failed ${url}:`, (e as Error).message);
    }
    if (i < selected.length - 1) await sleep(SCRAPE_DELAY_MS);
  }
  return out;
}

/** Merge by exact URL ID only. Different mirrors have different IDs, so duplicates stay visible. */
function mergeById(primary: StreamContent[], secondary: StreamContent[]): StreamContent[] {
  const map = new Map<string, StreamContent>();
  for (const item of secondary) map.set(item.id, item);
  for (const item of primary) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
}

async function loadMergedFeed(paths: string[], extract: (html: string, base: string) => string[], limit: number, onlyVideos: boolean): Promise<FeedResult> {
  const archivedAll = await getArchivedItems(10_000);
  const archived = onlyVideos ? archivedAll.filter((item) => item.kind === 'video') : archivedAll;
  const known = await getArchivedIdSet();
  try {
    const { links, originsHit } = await collectLinksFromAllMirrors(paths, extract);
    console.info(`[fetcher] ${onlyVideos ? 'videos' : 'channels'} mirrors:`, originsHit.join(', '), 'links:', links.length);
    const knownLimit = known.size === 0 ? Math.max(FEED_LIMIT, MAX_NEW_SCRAPE_PER_RUN * SOURCE_BASES.length) : MAX_NEW_SCRAPE_PER_RUN;
    const archivedById = new Map(archivedAll.map((item) => [item.id, item]));
    const newly = await scrapeNewOnly(links, known, knownLimit, archivedById);
    if (newly.length) await persistToArchive(newly);

    const refreshedArchive = await getArchivedItems(10_000);
    const linkedItems = links.map((url) => byUrl.get(contentId(url))).filter((item): item is StreamContent => !!item);
    const relevantArchive = onlyVideos ? refreshedArchive.filter((item) => item.kind === 'video') : refreshedArchive;
    // Keep archived cards too, including items temporarily absent from a mirror's index.
    const merged = mergeById(linkedItems, mergeById(newly, relevantArchive));
    const filtered = onlyVideos ? merged.filter((item) => item.kind === 'video') : merged.filter((item) => item.kind !== 'video');
    if (filtered.length) {
      const result = filtered.slice(0, limit);
      if (!onlyVideos) setMemoryFeed(result);
      await persistToArchive(result);
      return { items: result, allFailed: false };
    }
  } catch (e) {
    console.warn(`[fetcher] ${onlyVideos ? 'video' : 'channel'} refresh failed; using archive:`, (e as Error).message);
  }
  if (archived.length) {
    const result = archived.slice(0, limit);
    if (!onlyVideos) setMemoryFeed(result);
    return { items: result, allFailed: false };
  }
  return { items: [], allFailed: true, error: onlyVideos ? 'Видео не найдены: источники недоступны или каталог пуст.' : 'Каналы не найдены: источники недоступны или каталог пуст.' };
}

export async function fetchFeed(limit = FEED_LIMIT): Promise<FeedResult> {
  const memory = getMemoryFeed(FEED_REFRESH_SEC);
  if (memory?.length) return { items: memory.filter((item) => item.kind !== 'video').slice(0, limit), allFailed: false };
  return loadMergedFeed(['/', '/catalog', '/channels', '/index.php'], extractContentLinks, limit, false);
}

export async function fetchVideosFeed(limit = FEED_LIMIT): Promise<FeedResult> {
  return loadMergedFeed(
    ['/videos.php', '/videos', '/'],
    (html, base) => [...extractVideoLinks(html, base)],
    limit,
    true,
  );
}

export type SearchResult = {
  channels: StreamContent[];
  videos: StreamContent[];
  forum: ForumArchiveEntry[];
};

/** Search the local archive so search does not hammer the mirrors. */
export async function searchAll(query: string, limit = FEED_LIMIT): Promise<SearchResult> {
  const raw = query.trim();
  if (!raw) return { channels: [], videos: [], forum: [] };
  const lower = raw.toLowerCase();
  const tokens = lower.split(/[\s,.;:+\-_/]+/).filter((token) => token.length >= 2);
  const matches = (item: StreamContent) => {
    const hay = `${item.title} ${item.description} ${item.sourceUrl}`.toLowerCase();
    return hay.includes(lower) || (tokens.length > 0 && tokens.every((token) => hay.includes(token)));
  };
  const archived = await getArchivedItems(10_000);
  const channels = archived.filter((item) => item.kind !== 'video' && matches(item)).slice(0, limit);
  const videos = archived.filter((item) => item.kind === 'video' && matches(item)).slice(0, limit);
  const forum = await searchForumArchive(raw, limit);
  return { channels, videos, forum };
}

export async function searchFeed(query: string, limit = FEED_LIMIT): Promise<FeedResult> {
  const result = await searchAll(query, limit);
  return { items: [...result.channels, ...result.videos].slice(0, limit), allFailed: false };
}

export function hashKey(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}
