/** Серверный парсер каталогов. Используется только для публичных страниц; плеер открывает URL в контексте источника. */
import * as cheerio from 'cheerio';

export type SourceId = 'domtv' | 'freedev' | 'web1337' | 'streamlive';
export type ChannelItem = { id: string; title: string; url: string; thumbnail: string; isLive: boolean; source: SourceId; description?: string };
export type VideoData = { title: string; description: string; videoUrl: string; thumbnail: string; source: SourceId };
const ROOTS: Record<Exclude<SourceId, 'streamlive'>, string> = {
  domtv: 'https://domtv.blyz.ru', freedev: 'https://streamlivetv.freedev.app', web1337: 'https://streamliveru.web1337.net',
};
const SITE_URL = (process.env.STREAMLIVE_SITE_URL || 'https://streamlive.tatnet.app').replace(/\/$/, '');
const headers = { 'user-agent': 'StreamLiveApp/1.0 (+catalog; contact site administrator)', accept: 'text/html,application/json;q=0.9,*/*;q=0.8' };
const abs = (v: string | undefined, base: string) => { if (!v) return ''; try { return new URL(v, base).toString(); } catch { return ''; } };
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export async function fetchChannels(source: SourceId): Promise<ChannelItem[]> {
  if (source === 'streamlive') {
    // Собственный PHP-скрипт уже предоставляет отфильтрованный каталог с учётом статусов модерации.
    try {
      const r = await fetch(`${SITE_URL}/api/native_home.php`, { headers, next: { revalidate: 30 } });
      if (r.ok) {
        const j = await r.json();
        const videos: ChannelItem[] = (j.videos || []).map((v: any) => ({ id: `sl-video-${v.id}`, title: clean(String(v.title || 'Видео')), url: `${SITE_URL}/embed_video.php?slug=${encodeURIComponent(v.slug || v.id)}`, thumbnail: abs(v.thumbnail_url, SITE_URL), isLive: false, source: 'streamlive', description: '' }));
        const channels: ChannelItem[] = (j.channels || []).map((c: any) => ({ id: `sl-channel-${c.id}`, title: clean(String(c.title || 'Канал')), url: `${SITE_URL}/embed.php?slug=${encodeURIComponent(c.slug || c.id)}&cinema=0`, thumbnail: abs(c.thumbnail_url, SITE_URL), isLive: true, source: 'streamlive', description: '' }));
        return [...channels, ...videos];
      }
    } catch { /* показываем остальные источники, если PHP временно недоступен */ }
    return [];
  }
  const root = ROOTS[source];
  try {
    const response = await fetch(root, { headers, signal: AbortSignal.timeout(10000), next: { revalidate: 60 } });
    if (!response.ok) return [];
    const html = await response.text(); const $ = cheerio.load(html); const out: ChannelItem[] = []; const seen = new Set<string>();
    // Универсальные селекторы для карточек, видео, каналов и ссылок с постерами.
    $('a[href]').each((_, el) => {
      const a = $(el); const href = abs(a.attr('href'), root); if (!href || href === root || seen.has(href)) return;
      const img = a.find('img').first(); const title = clean(a.attr('title') || img.attr('alt') || a.find('h1,h2,h3,h4,.title,.name,[class*=title],[class*=name]').first().text() || a.text());
      const thumb = abs(img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || a.find('[style*=background]').attr('data-image'), root);
      const mediaPath = /video|channel|watch|stream|live|tv|embed|player|film|movie|\.m3u8/i.test(href) || !!img.length;
      if (!mediaPath || title.length < 2 || title.length > 180 || /войти|регистрация|политика|контакты|форум|профиль|поддержка/i.test(title)) return;
      seen.add(href); out.push({ id: `${source}-${Buffer.from(href).toString('base64url')}`, title, url: href, thumbnail: thumb, isLive: /live|эфир|прямой эфир/i.test(`${title} ${href}`), source });
    });
    // Fallback для сайтов, где каталог размечен как карточки без <a> с изображением.
    if (!out.length) $('article, [class*=card], [class*=channel], [class*=video], .item').each((_, el) => {
      const node = $(el), a = node.find('a[href]').first(), href = abs(a.attr('href'), root); const title = clean(node.find('h1,h2,h3,h4,[class*=title],[class*=name]').first().text() || a.text()); const img = node.find('img').first();
      if (href && title.length > 1 && !seen.has(href)) { seen.add(href); out.push({ id: `${source}-${Buffer.from(href).toString('base64url')}`, title, url: href, thumbnail: abs(img.attr('data-src') || img.attr('src'), root), isLive: /live|эфир/i.test(title), source }); }
    });
    return out.slice(0, 100);
  } catch { return []; }
}

export async function fetchVideoData(url: string, source: SourceId): Promise<VideoData> {
  const allowed = source === 'streamlive' ? new URL(SITE_URL).hostname : new URL(ROOTS[source]).hostname;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || (parsed.hostname !== allowed && !parsed.hostname.endsWith(`.${allowed}`))) throw new Error('Источник не разрешён');
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000), redirect: 'follow' });
  if (!r.ok) throw new Error(`Источник вернул ${r.status}`);
  const $ = cheerio.load(await r.text());
  const title = clean($('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text() || 'StreamLive');
  const description = clean($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || $('p').first().text());
  const thumbnail = abs($('meta[property="og:image"]').attr('content') || $('video[poster]').attr('poster'), url);
  const videoUrl = abs($('video source[src]').first().attr('src') || $('video[src]').first().attr('src') || $('iframe[src]').first().attr('src') || url, url);
  return { title, description, videoUrl, thumbnail, source };
}
