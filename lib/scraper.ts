/**
 * StreamLive PWA: серверный сборщик единой ленты.
 * Каждый элемент сохраняет свой источник. Одинаковые материалы на разных
 * зеркалах намеренно не объединяются и не удаляются.
 */
import * as cheerio from 'cheerio';

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
};
export type SourceCatalogResult = { source: SourceId; items: CatalogItem[]; diagnostic: SourceDiagnostic };

export const SOURCE_ROOTS: Record<SourceId, string> = {
  domtv: 'https://domtv.blyz.ru',
  freedev: 'https://streamlivetv.freedev.app',
  web1337: 'https://streamliveru.web1337.net',
};
const headers = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 StreamLivePWA/1.1',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'ru-RU,ru;q=0.9,en;q=0.7',
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
  try {
    const response = await fetch(root, {
      headers,
      signal: AbortSignal.timeout(14000),
      redirect: 'follow',
      cache: 'no-store',
    });
    const html = await response.text();
    const elapsedMs = Date.now() - started;
    if (!response.ok) {
      return { source, items: [], diagnostic: { source, url: root, ok: false, status: response.status, elapsedMs, itemCount: 0, error: `Источник вернул HTTP ${response.status}`, blocked: looksBlocked(html, response.status) } };
    }
    if (looksBlocked(html, response.status)) {
      return { source, items: [], diagnostic: { source, url: root, ok: false, status: response.status, elapsedMs, itemCount: 0, error: 'Источник вернул страницу проверки браузера вместо каталога. Нужен разрешённый API/доступ источника.', blocked: true } };
    }

    const $ = cheerio.load(html);
    const found: CatalogItem[] = [];
    const seenWithinSource = new Set<string>();
    const add = (hrefRaw: string | undefined, titleRaw: string, thumbRaw: string | undefined, contextRaw = '', descriptionRaw = '') => {
      const href = abs(hrefRaw, root);
      const title = clean(titleRaw).replace(/^(смотреть|видео|канал|форум)\s*[:—-]?\s*/i, '');
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
        id: makeId(source, href), title, url: href, thumbnail: thumb,
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
      add(href, title, thumb, `${a.attr('class') || ''} ${contextNode.attr('class') || ''}`, description);
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
      const href = abs($(el).attr('href'), root);
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
        const pageResponse = await fetch(pageUrl, { headers, signal: AbortSignal.timeout(7000), redirect: 'follow', cache: 'no-store' });
        if (!pageResponse.ok) return;
        const pageHtml = await pageResponse.text();
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
    return {
      source, items,
      diagnostic: {
        source, url: response.url || root, ok: true, status: response.status, elapsedMs: elapsed,
        itemCount: items.length,
        ...(items.length ? {} : { error: `Страница доступна (HTTP ${response.status}), но распознаваемые карточки не найдены; HTML может быть пустым или отрисовываться JavaScript-кодом.` }),
      },
    };
  } catch (error) {
    const elapsedMs = Date.now() - started;
    const cause = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
    const causeText = cause instanceof Error ? `; причина: ${cause.message}` : '';
    const message = error instanceof Error ? `${error.name}: ${error.message}${causeText}` : 'Неизвестная ошибка запроса';
    console.error(`[StreamLive PWA scraper] ${source}: ${message}`);
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
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000), redirect: 'follow', cache: 'no-store' });
  const html = await r.text();
  if (!r.ok) throw new Error(`Источник вернул HTTP ${r.status}`);
  if (looksBlocked(html, r.status)) throw new Error('Источник вернул страницу проверки браузера вместо страницы контента');
  const $ = cheerio.load(html);
  const title = clean($('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text() || 'StreamLive');
  const description = clean($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('main p').first().text());
  const thumbnail = abs($('meta[property="og:image"]').attr('content') || $('video[poster]').attr('poster'), url);
  const videoUrl = abs($('video source[src]').first().attr('src') || $('video[src]').first().attr('src') || $('iframe[src]').first().attr('src') || url, url);
  return { title, description, videoUrl, thumbnail, source };
}
