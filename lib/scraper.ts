/**
 * StreamLive PWA: серверный сборщик единой ленты.
 * Каждый элемент сохраняет свой источник. Одинаковые материалы на разных
 * зеркалах намеренно не объединяются и не удаляются.
 */
import * as cheerio from 'cheerio';
import { promises as fs } from 'node:fs';
import { fetchSourcePage } from './source-fetch';

export type SourceId = 'domtv' | 'freedev' | 'web1337';
export type ContentKind = 'channel' | 'video' | 'forum' | 'other';
export type CatalogItem = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  isLive: boolean;
  source: SourceId;
  kind: ContentKind;
  description?: string;
  playUrl?: string;
};
export type ChannelItem = CatalogItem;
export type VideoData = { title: string; description: string; videoUrl: string; thumbnail: string; source: SourceId };
export type SourceDiagnostic = {
  source: SourceId;
  url: string;
  ok: boolean;
  status?: number;
  elapsedMs: number;
  itemCount: number;
  error?: string;
  blocked?: boolean;
  cached?: boolean;
};
export type SourceCatalogResult = { source: SourceId; items: CatalogItem[]; diagnostic: SourceDiagnostic };

const CATALOG_ARCHIVE_PATH = '/tmp/streamlive-pwa-catalog.json';
const FRESH_CACHE_MS = 60 * 1000;
const sourceCache = new Map<SourceId, { items: CatalogItem[]; savedAt: number }>();
let archiveLoadPromise: Promise<void> | null = null;
let archiveWritePromise: Promise<void> = Promise.resolve();

async function loadCatalogArchive(): Promise<void> {
  if (!archiveLoadPromise) {
    archiveLoadPromise = fs.readFile(CATALOG_ARCHIVE_PATH, 'utf8').then((raw) => {
      const parsed = JSON.parse(raw) as Record<string, { items?: CatalogItem[]; savedAt?: number }>;
      for (const id of ['domtv', 'freedev', 'web1337'] as SourceId[]) {
        const entry = parsed[id];
        if (entry && Array.isArray(entry.items) && entry.items.length) {
          sourceCache.set(id, { items: entry.items, savedAt: Number(entry.savedAt) || 0 });
        }
      }
    }).catch(() => undefined);
  }
  await archiveLoadPromise;
}

async function saveCatalogArchive(): Promise<void> {
  archiveWritePromise = archiveWritePromise.then(async () => {
    const data: Record<string, { items: CatalogItem[]; savedAt: number }> = {};
    for (const [id, entry] of sourceCache) data[id] = entry;
    try { await fs.writeFile(CATALOG_ARCHIVE_PATH, JSON.stringify(data), 'utf8'); }
    catch (error) { console.warn('[StreamLive PWA cache] archive write failed:', error instanceof Error ? error.message : error); }
  });
  await archiveWritePromise;
}

export const SOURCE_ROOTS: Record<SourceId, string> = {
  domtv: 'https://domtv.blyz.ru',
  freedev: 'https://streamlivetv.freedev.app',
  web1337: 'https://streamliveru.web1337.net',
};

const abs = (v: string | undefined, base: string) => {
  if (!v) return '';
  try { return new URL(v, base).toString(); } catch { return ''; }
};
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const ignored = /^(войти|вход|регистрация|политика|контакты|профиль|поддержка|настройки|соглашение|главная|home|menu|меню|поиск|search|rss|назад|вперёд|далее|предыдущая)$/i;
const challengePattern = /slowAES|__test=|cf-chl-|challenge-platform|just a moment|checking your browser|enable javascript and cookies|ddos-guard|проверка браузера/i;

function classify(title: string, href: string, context: string): ContentKind {
  const s = `${title} ${href} ${context}`.toLowerCase();
  if (/forum|форум|topic|thread|discussion|community|обсужден|тема|сообщени|категори[яи] форума/.test(s)) return 'forum';
  if (/video|videos|clip|film|movie|ролик|видео|фильм|запис[ьи] эфира/.test(s)) return 'video';
  if (/channel|tv-channel|stream|live| эфир|эфир|канал|телеканал|онлайн|watch|player|embed|\.m3u8/.test(s)) return 'channel';
  return 'other';
}

function toPlayUrl(rawUrl: string, kind: ContentKind): string {
  try {
    const u = new URL(rawUrl);
    const slug = u.searchParams.get('slug') || u.pathname.match(/\/(?:channel|channel-pc|video|embed|watch|embed_video)\/([^/?#]+)/i)?.[1];
    if (!slug) {
      if (kind === 'channel' && /\/(?:channel|channel-pc)\.php$/i.test(u.pathname)) {
        u.pathname = '/embed.php'; u.searchParams.set('cinema', '0'); return u.toString();
      }
      if (kind === 'video' && /\/video\.php$/i.test(u.pathname)) {
        u.pathname = '/embed_video.php'; return u.toString();
      }
      return rawUrl;
    }
    if (kind === 'video') return `${u.origin}/embed_video.php?slug=${encodeURIComponent(slug)}`;
    if (kind === 'channel') return `${u.origin}/embed.php?slug=${encodeURIComponent(slug)}&cinema=0`;
    return rawUrl;
  } catch { return rawUrl; }
}

function looksBlocked(html: string, status: number): boolean {
  return status === 403 || status === 429 || challengePattern.test(html.slice(0, 12000));
}

function makeId(source: SourceId, href: string): string {
  // URL-safe deterministic id. Source is part of the id, so mirrors stay separate.
  const encoded = Buffer.from(href).toString('base64url').slice(0, 180);
  return `${source}-${encoded}`;
}

export async function fetchSourceCatalog(source: SourceId): Promise<SourceCatalogResult> {
  const root = SOURCE_ROOTS[source];
  const started = Date.now();
  await loadCatalogArchive();
  const cached = sourceCache.get(source);
  if (cached && Date.now() - cached.savedAt < FRESH_CACHE_MS) {
    return { source, items: cached.items, diagnostic: { source, url: root, ok: true, elapsedMs: 0, itemCount: cached.items.length, cached: true } };
  }
  try {
    const response = await fetchSourcePage(root, source);
    const html = response.html;
    const baseUrl = response.finalUrl || root;
    const elapsedMs = Date.now() - started;
    if (looksBlocked(html, response.status)) {
      if (cached?.items.length) {
        return { source, items: cached.items, diagnostic: { source, url: response.finalUrl, ok: false, status: response.status, elapsedMs, itemCount: cached.items.length, cached: true, error: 'Источник снова вернул проверочную страницу; показан последний сохранённый каталог.', blocked: true } };
      }
      return { source, items: [], diagnostic: { source, url: response.finalUrl, ok: false, status: response.status, elapsedMs, itemCount: 0, error: 'Источник по-прежнему возвращает проверочную страницу вместо каталога.', blocked: true } };
    }

    const $ = cheerio.load(html);
    const found: CatalogItem[] = [];
    const seenWithinSource = new Set<string>();
    const add = (hrefRaw: string | undefined, titleRaw: string, thumbRaw: string | undefined, contextRaw = '', descriptionRaw = '') => {
      const href = abs(hrefRaw, root);
      const urlTitle = (() => { try { const u = new URL(href); return u.searchParams.get('slug') || u.pathname.split('/').filter(Boolean).pop()?.replace(/\.php$/i, '').replace(/[-_]+/g, ' ' ) || ''; } catch { return ''; } })();
      const fromText = clean(titleRaw).replace(/^(смотреть|видео|канал|форум)\s*[:—-]?\s*/i, '');
      const title = fromText || clean(urlTitle);
      if (!href || !title || title.length < 2 || title.length > 180 || ignored.test(title)) return;
      let parsed: URL;
      try { parsed = new URL(href); } catch { return; }
      const rootHost = new URL(root).hostname;
      if (!['http:', 'https:'].includes(parsed.protocol) || (parsed.hostname !== rootHost && !parsed.hostname.endsWith(`.${rootHost}`))) return;
      if (parsed.pathname.match(/\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|pdf)$/i)) return;
      const thumb = abs(thumbRaw, root);
      const context = clean(contextRaw).slice(0, 500);
      const kind = classify(title, href, context);
      const hasCardContext = /card|item|channel|video|film|forum|topic|post|article|entry|tile|catalog|media/i.test(context);
      const mediaLikeUrl = /channel|watch|stream|live|tv|embed|player|film|movie|video|forum|topic|thread|discussion|\.m3u8/i.test(`${parsed.pathname}${parsed.search}`);
      // Keep cards with a thumbnail, recognizable content URL, or a content-card wrapper.
      if (!thumb && !mediaLikeUrl && !hasCardContext) return;
      if (seenWithinSource.has(href)) return;
      seenWithinSource.add(href);
      found.push({
        id: makeId(source, href), title, url: href, playUrl: toPlayUrl(href, kind), thumbnail: thumb,
        isLive: /live|прямой эфир|эфир|онлайн/i.test(`${title} ${href} ${context}`),
        source, kind, description: clean(descriptionRaw).slice(0, 500) || undefined,
      });
    };

    // Main selector pass. Keep the original source URL on each card.
    $('a[href]').each((_, el) => {
      const a = $(el);
      const href = a.attr('href');
      if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return;
      const img = a.find('img').first();
      const wrapper = a.closest('article,[class*=card],[class*=item],[class*=channel],[class*=video],[class*=forum],[class*=topic],[class*=post],[class*=tile],[class*=entry]').first();
      const contextNode = wrapper.length ? wrapper : a;
      const title = a.attr('title') || img.attr('alt') || contextNode.find('h1,h2,h3,h4,[class*=title],[class*=name]').first().text() || a.text();
      const thumb = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('data-original') || img.attr('data-image') || img.attr('src') || contextNode.find('[data-image]').first().attr('data-image');
      const description = contextNode.find('p,[class*=description],[class*=summary],[class*=excerpt]').first().text();
      add(abs(href, baseUrl), title, abs(thumb, baseUrl), `${a.attr('class') || ''} ${contextNode.attr('class') || ''}`, description);
    });

    // Fallback for sites whose title link is nested separately from the image.
    if (!found.length) {
      $('article,[class*=card],[class*=channel],[class*=video],[class*=forum],[class*=topic],[class*=post],.item').each((_, el) => {
        const node = $(el), a = node.find('a[href]').first(), img = node.find('img').first();
        add(a.attr('href'), node.find('h1,h2,h3,h4,[class*=title],[class*=name]').first().text() || a.attr('title') || a.text(), img.attr('data-src') || img.attr('data-original') || img.attr('src'), node.attr('class') || '', node.find('p').first().text());
      });
    }

    // Crawl a small number of same-origin section pages linked from the homepage.
    // This lets the unified feed include separate video/forum/category sections,
    // not only cards rendered on the root page. The crawl is deliberately bounded.
    const sectionUrls = new Set<string>();
    $('a[href]').each((_, el) => {
      if (sectionUrls.size >= 6) return;
      const href = abs($(el).attr('href'), baseUrl);
      if (!href || href === root || href === `${root}/`) return;
      try {
        const parsed = new URL(href);
        if (parsed.hostname !== new URL(root).hostname) return;
        if (!/(forum|video|channel|catalog|category|categories|archive|program|tv|topic|thread|community|фильм|видео|форум|канал)/i.test(`${parsed.pathname} ${parsed.search}`)) return;
        if (parsed.pathname.match(/\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|pdf)$/i)) return;
        sectionUrls.add(parsed.toString());
      } catch { /* ignore malformed URL */ }
    });
    await Promise.all([...sectionUrls].map(async (pageUrl) => {
      try {
        const pageResponse = await fetchSourcePage(pageUrl, source);
        const pageHtml = pageResponse.html;
        if (looksBlocked(pageHtml, pageResponse.status)) return;
        const page = cheerio.load(pageHtml);
        page('a[href]').each((_, el) => {
          const a = page(el), hrefRaw = a.attr('href');
          if (!hrefRaw || hrefRaw.startsWith('#') || /^javascript:/i.test(hrefRaw)) return;
          const img = a.find('img').first();
          const wrapper = a.closest('article,[class*=card],[class*=item],[class*=channel],[class*=video],[class*=forum],[class*=topic],[class*=post],[class*=tile],[class*=entry]').first();
          const contextNode = wrapper.length ? wrapper : a;
          const title = a.attr('title') || img.attr('alt') || contextNode.find('h1,h2,h3,h4,[class*=title],[class*=name]').first().text() || a.text();
          const thumbRaw = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('data-original') || img.attr('data-image') || img.attr('src') || contextNode.find('[data-image]').first().attr('data-image');
          const description = contextNode.find('p,[class*=description],[class*=summary],[class*=excerpt]').first().text();
          add(abs(hrefRaw, pageUrl), title, abs(thumbRaw, pageUrl), `${a.attr('class') || ''} ${contextNode.attr('class') || ''} ${new URL(pageUrl).pathname}`, description);
        });
        if (!found.length) {
          page('article,[class*=card],[class*=channel],[class*=video],[class*=forum],[class*=topic],[class*=post],.item').each((_, el) => {
            const node = page(el), a = node.find('a[href]').first(), img = node.find('img').first();
            add(abs(a.attr('href'), pageUrl), node.find('h1,h2,h3,h4,[class*=title],[class*=name]').first().text() || a.attr('title') || a.text(), abs(img.attr('data-src') || img.attr('data-original') || img.attr('src'), pageUrl), `${node.attr('class') || ''} ${new URL(pageUrl).pathname}`, node.find('p').first().text());
          });
        }
      } catch (error) {
        console.warn(`[StreamLive PWA scraper] section page failed (${source}):`, error instanceof Error ? error.message : error);
      }
    }));

    const items = found.slice(0, 250);
    const elapsed = Date.now() - started;
    if (items.length) {
      sourceCache.set(source, { items, savedAt: Date.now() });
      await saveCatalogArchive();
      return {
        source, items,
        diagnostic: { source, url: response.finalUrl || root, ok: true, status: response.status, elapsedMs: elapsed, itemCount: items.length },
      };
    }
    if (cached?.items.length) {
      return {
        source, items: cached.items,
        diagnostic: { source, url: response.finalUrl || root, ok: false, status: response.status, elapsedMs: elapsed, itemCount: cached.items.length, cached: true, error: 'Источник ответил, но карточки не распознаны; показан последний сохранённый каталог.' },
      };
    }
    return {
      source, items: [],
      diagnostic: { source, url: response.finalUrl || root, ok: true, status: response.status, elapsedMs: elapsed, itemCount: 0, error: 'Страница доступна, но карточки не распознаны. Проверьте HTML главной страницы и разделов.' },
    };
  } catch (error) {
    const elapsedMs = Date.now() - started;
    const cause = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
    const causeText = cause instanceof Error ? `; причина: ${cause.message}` : '';
    const message = error instanceof Error ? `${error.name}: ${error.message}${causeText}` : 'Неизвестная ошибка запроса';
    console.error(`[StreamLive PWA scraper] ${source}: ${message}`);
    const stale = sourceCache.get(source);
    if (stale?.items.length) {
      return { source, items: stale.items, diagnostic: { source, url: root, ok: false, elapsedMs, itemCount: stale.items.length, cached: true, error: `Источник временно недоступен; показан последний сохранённый каталог. ${message}` } };
    }
    return { source, items: [], diagnostic: { source, url: root, ok: false, elapsedMs, itemCount: 0, error: message } };
  }
}

/** Совместимый экспорт для существующих вызовов. */
export async function fetchChannels(source: SourceId): Promise<ChannelItem[]> {
  return (await fetchSourceCatalog(source)).items;
}

export async function fetchVideoData(url: string, source: SourceId): Promise<VideoData> {
  const root = SOURCE_ROOTS[source], parsed = new URL(url), host = new URL(root).hostname;
  if (parsed.protocol !== 'https:' || (parsed.hostname !== host && !parsed.hostname.endsWith(`.${host}`))) throw new Error('URL не принадлежит выбранному источнику');
  const r = await fetchSourcePage(url, source);
  const html = r.html;
  if (looksBlocked(html, r.status)) throw new Error('Источник вернул страницу проверки браузера вместо страницы контента');
  const $ = cheerio.load(html);
  const title = clean($('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text() || 'StreamLive');
  const description = clean($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('main p').first().text());
  const thumbnail = abs($('meta[property="og:image"]').attr('content') || $('video[poster]').attr('poster'), url);
  const kind = classify(title, url, html.slice(0, 12000));
  const videoUrl = abs($('video source[src]').first().attr('src') || $('video[src]').first().attr('src') || $('iframe[src]').first().attr('src') || toPlayUrl(url, kind), url);
  return { title, description, videoUrl, thumbnail, source };
}
