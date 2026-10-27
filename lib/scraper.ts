/** Серверный парсер трёх внешних каталогов. PHP API StreamLive здесь не используется. */
import * as cheerio from 'cheerio';

export type SourceId = 'domtv' | 'freedev' | 'web1337';
export type ChannelItem = { id: string; title: string; url: string; thumbnail: string; isLive: boolean; source: SourceId; description?: string };
export type VideoData = { title: string; description: string; videoUrl: string; thumbnail: string; source: SourceId };
const ROOTS: Record<SourceId, string> = {
  domtv: 'https://domtv.blyz.ru',
  freedev: 'https://streamlivetv.freedev.app',
  web1337: 'https://streamliveru.web1337.net',
};
const headers = { 'user-agent': 'Mozilla/5.0 (compatible; StreamLiveCatalog/1.0)', accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' };
const abs = (v: string | undefined, base: string) => { if (!v) return ''; try { return new URL(v, base).toString(); } catch { return ''; } };
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const ignored = /войти|регистрация|политика|контакты|форум|профиль|поддержка|настройки|соглашение/i;

export async function fetchChannels(source: SourceId): Promise<ChannelItem[]> {
  const root = ROOTS[source];
  try {
    const response = await fetch(root, { headers, signal: AbortSignal.timeout(12000), next: { revalidate: 60 } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const $ = cheerio.load(await response.text());
    const out: ChannelItem[] = [], seen = new Set<string>();
    const add = (href: string, titleRaw: string, thumb: string, liveText = '') => {
      const title = clean(titleRaw).replace(/^(смотреть|видео|канал)\s*[:—-]?\s*/i, '');
      if (!href || href === root + '/' || href === root || seen.has(href) || title.length < 2 || title.length > 180 || ignored.test(title)) return;
      if (!/^https?:$/.test(new URL(href).protocol) || new URL(href).hostname !== new URL(root).hostname) return;
      // Отсекаем навигацию: нужны ссылки с картинкой или характерным media URL/контейнером.
      if (!thumb && !/video|channel|watch|stream|live|tv|embed|player|film|movie|\.m3u8/i.test(href)) return;
      seen.add(href); out.push({ id: `${source}-${Buffer.from(href).toString('base64url')}`, title, url: href, thumbnail: thumb, isLive: /live|эфир|прямой эфир|онлайн/i.test(`${title} ${href} ${liveText}`), source });
    };
    $('a[href]').each((_, el) => {
      const a = $(el), href = abs(a.attr('href'), root); if (!href) return;
      const img = a.find('img').first();
      const title = a.attr('title') || img.attr('alt') || a.find('h1,h2,h3,h4,.title,.name,[class*=title],[class*=name]').first().text() || a.text();
      const thumb = abs(img.attr('data-src') || img.attr('data-lazy-src') || img.attr('data-original') || img.attr('src') || a.find('[data-image]').attr('data-image'), root);
      add(href, title, thumb, a.attr('class') || '');
    });
    if (!out.length) $('article,[class*=card],[class*=channel],[class*=video],.item').each((_, el) => {
      const node = $(el), a = node.find('a[href]').first(), img = node.find('img').first();
      add(abs(a.attr('href'), root), node.find('h1,h2,h3,h4,[class*=title],[class*=name]').first().text() || a.text(), abs(img.attr('data-src') || img.attr('data-original') || img.attr('src'), root), node.attr('class') || '');
    });
    return out.slice(0, 120);
  } catch (error) {
    console.error(`[StreamLive scraper] ${source}:`, error);
    return [];
  }
}

export async function fetchVideoData(url: string, source: SourceId): Promise<VideoData> {
  const root = ROOTS[source], parsed = new URL(url), host = new URL(root).hostname;
  if (parsed.protocol !== 'https:' || (parsed.hostname !== host && !parsed.hostname.endsWith(`.${host}`))) throw new Error('URL не принадлежит выбранному источнику');
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(12000), redirect: 'follow' });
  if (!r.ok) throw new Error(`Источник вернул HTTP ${r.status}`);
  const $ = cheerio.load(await r.text());
  const title = clean($('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text() || 'StreamLive');
  const description = clean($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('main p').first().text());
  const thumbnail = abs($('meta[property="og:image"]').attr('content') || $('video[poster]').attr('poster'), url);
  const videoUrl = abs($('video source[src]').first().attr('src') || $('video[src]').first().attr('src') || $('iframe[src]').first().attr('src') || url, url);
  return { title, description, videoUrl, thumbnail, source };
}
