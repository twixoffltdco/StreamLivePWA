import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SOURCES = [
  { id: 'domtv', url: 'https://domtv.blyz.ru/' },
  { id: 'freedev', url: 'https://streamlivetv.freedev.app/' },
  { id: 'web1337', url: 'https://streamliveru.web1337.net/' },
] as const;

export async function GET() {
  const results = await Promise.all(SOURCES.map(async (source) => {
    const started = Date.now();
    try {
      const response = await fetch(source.url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const html = await response.text();
      const $ = cheerio.load(html);
      const anchors = $('a[href]').toArray().map((el) => {
        const a = $(el);
        const img = a.find('img').first();
        return {
          title: (a.attr('title') || img.attr('alt') || a.find('h1,h2,h3,h4,[class*=title],[class*=name]').first().text() || a.text()).replace(/\s+/g, ' ').trim().slice(0, 160),
          href: a.attr('href') || '',
          image: img.attr('data-src') || img.attr('data-lazy-src') || img.attr('data-original') || img.attr('src') || '',
          className: (a.attr('class') || '').slice(0, 120),
        };
      }).filter((x) => x.title || x.href).slice(0, 30);
      const title = $('title').first().text().replace(/\s+/g, ' ').trim();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const challenge = /cloudflare|checking your browser|just a moment|captcha|enable javascript|access denied|temporarily blocked|security check/i.test(`${title} ${bodyText.slice(0, 3000)}`);
      return {
        id: source.id,
        requestedUrl: source.url,
        finalUrl: response.url,
        httpStatus: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        elapsedMs: Date.now() - started,
        htmlLength: html.length,
        title,
        bodyTextSample: bodyText.slice(0, 500),
        counts: { anchors: $('a[href]').length, images: $('img').length, videos: $('video').length, iframes: $('iframe').length, articles: $('article').length, cards: $('[class*=card],[class*=channel],[class*=video],.item').length, scripts: $('script').length },
        looksLikeBlockOrChallenge: challenge,
        sampleLinks: anchors,
        htmlStart: html.slice(0, 500),
      };
    } catch (e) {
      return {
        id: source.id,
        requestedUrl: source.url,
        elapsedMs: Date.now() - started,
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      };
    }
  }));
  return NextResponse.json({ checkedAt: new Date().toISOString(), runtime: 'Layero Node.js server', results }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
