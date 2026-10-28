/**
 * StreamLive forum aggregator for production + both mirrors.
 * Every category/thread id is scoped to its origin (prod-12, reserve-12,
 * mirror3-12). Identically numbered topics on different mirrors remain separate.
 */
import { unstable_cache } from 'next/cache';
import * as cheerio from 'cheerio';
import { SOURCE_BASES, type SourceOrigin } from './config';
import { fetchWithChallenge } from './challenge';
import { parseMeta } from './parse';
import type { ForumThread, ForumThreadList, ForumThreadSummary } from './types';
import { persistForumEntries } from './cache';

export class ForumSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForumSourceError';
  }
}

type SourceStep = { base: string; origin: SourceOrigin };
type ScopedId = { origin: SourceOrigin | null; numericId: string };

function scopedId(origin: SourceOrigin, id: string): string {
  return `${origin}-${id}`;
}
function parseScopedId(value: string): ScopedId | null {
  const match = value.match(/^(prod|reserve|mirror3)[-_](\d+)$/i);
  if (match) return { origin: match[1].toLowerCase() as SourceOrigin, numericId: match[2] };
  const numeric = value.match(/^(\d+)$/);
  return numeric ? { origin: null, numericId: numeric[1] } : null;
}
function sourceForOrigin(origin: SourceOrigin): SourceStep {
  return SOURCE_BASES.find((source) => source.origin === origin) ?? SOURCE_BASES[0];
}
function resolveOnSource(href: string, base: string): string {
  const absolute = new URL(href, base);
  const isMirror = SOURCE_BASES.some((source) => new URL(source.base).hostname.toLowerCase() === absolute.hostname.toLowerCase());
  if (!isMirror) return absolute.toString();
  const source = new URL(base);
  return `${source.origin}${absolute.pathname}${absolute.search}${absolute.hash}`;
}
function idFromHref(href: string): string | null {
  const match = href.match(/(?:forum_category|forum_thread|forum)\.php\?[^#]*\bid=(\d+)/i)
    || href.match(/\/forum\/(?:category|thread|cat)?\/?(\d+)/i)
    || href.match(/[?&]id=(\d+)/i);
  return match?.[1] ?? null;
}
function titleForLink($: cheerio.CheerioAPI, el: any): string {
  let title = $(el).text().replace(/\s+/g, ' ').trim();
  if (!title || title.length < 2) {
    title = $(el).closest('tr, li, .card, .category, article, .thread')
      .find('h1, h2, h3, h4, .title, strong').first().text().replace(/\s+/g, ' ').trim();
  }
  return title;
}

/** Parse categories from one mirror. Source host is retained in href and id. */
function parseForumCategoriesHtml(html: string, base: string, origin: SourceOrigin): ForumThreadSummary[] {
  const $ = cheerio.load(html);
  const out: ForumThreadSummary[] = [];
  const seenExact = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const isCategory = /forum_category\.php/i.test(href)
      || /\/forum\/(?:category|cat)\//i.test(href)
      || /forum\.php\?[^#]*\bid=\d+/i.test(href);
    if (!isCategory) return;
    const rawId = idFromHref(href);
    const title = titleForLink($, el);
    if (!rawId || title.length < 2) return;
    try {
      const absolute = resolveOnSource(href, base);
      if (seenExact.has(absolute)) return;
      seenExact.add(absolute);
      out.push({ id: scopedId(origin, rawId), title, href: absolute, origin });
    } catch {
      // Ignore malformed links from the source HTML.
    }
  });
  return out;
}

function parseCategoryThreadsHtml(html: string, base: string, origin: SourceOrigin): ForumThreadSummary[] {
  const $ = cheerio.load(html);
  const out: ForumThreadSummary[] = [];
  const seenExact = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const isThread = /forum_thread\.php/i.test(href)
      || /\/forum\/thread\//i.test(href)
      || (/forum\.php\?[^#]*\bid=\d+/i.test(href) && !/forum_category/i.test(href));
    if (!isThread) return;
    const rawId = idFromHref(href);
    const title = titleForLink($, el);
    if (!rawId || title.length < 3) return;
    try {
      const absolute = resolveOnSource(href, base);
      if (seenExact.has(absolute)) return;
      seenExact.add(absolute);
      out.push({ id: scopedId(origin, rawId), title, href: absolute, origin });
    } catch {
      // Ignore malformed links from the source HTML.
    }
  });
  return out;
}

async function fetchFromSource(source: SourceStep, pathname: string) {
  const { html, finalUrl } = await fetchWithChallenge(`${source.base}${pathname}`);
  return { html, finalUrl, origin: source.origin, base: source.base };
}

async function scrapeForumList(): Promise<ForumThreadList> {
  const candidates = ['/forum.php', '/forum', '/forum_whats_new.php'];
  const allCategories: ForumThreadSummary[] = [];
  const originsHit: SourceOrigin[] = [];
  const errors: string[] = [];

  // Query every mirror, not just the first live one.
  for (const source of SOURCE_BASES) {
    let gotCategories = false;
    for (const path of candidates) {
      try {
        const { html } = await fetchFromSource(source, path);
        const categories = parseForumCategoriesHtml(html, source.base, source.origin);
        if (categories.length > 0) {
          allCategories.push(...categories);
          if (!originsHit.includes(source.origin)) originsHit.push(source.origin);
          void persistForumEntries(categories.map((category) => ({
            id: category.id,
            title: category.title,
            href: category.href,
            kind: 'category' as const,
          })));
          gotCategories = true;
          break; // one useful category page per mirror is enough
        }
      } catch (error) {
        errors.push(`${source.origin} ${path}: ${(error as Error).message}`);
      }
    }
    if (!gotCategories) console.warn(`[forum] ${source.origin}: no categories parsed`);
  }

  // Do not merge by numeric id/title: same category on another mirror must remain visible.
  if (allCategories.length > 0) {
    return {
      threads: allCategories,
      origin: originsHit.length > 1 ? 'all' : (originsHit[0] ?? 'prod'),
      allFailed: false,
    };
  }
  return {
    threads: [],
    origin: 'all',
    allFailed: true,
    error: errors[errors.length - 1] || 'Ни одно зеркало не вернуло категории форума.',
  };
}

export const fetchForumList: () => Promise<ForumThreadList> = unstable_cache(
  scrapeForumList,
  ['streamlive-forum-list-all-mirrors-v3'],
  { revalidate: false, tags: ['streamlive-forum'] },
);

async function scrapeForumThread(id: string): Promise<ForumThread | null> {
  const parsed = parseScopedId(id);
  if (!parsed) return null;
  const sources = parsed.origin ? [sourceForOrigin(parsed.origin)] : SOURCE_BASES;
  const paths = [
    `/forum_thread.php?id=${parsed.numericId}`,
    `/forum.php?thread=${parsed.numericId}`,
  ];

  for (const source of sources) {
    for (const path of paths) {
      try {
        const { html, finalUrl } = await fetchFromSource(source, path);
        const meta = parseMeta(html);
        let image = meta.image;
        if (image) image = resolveOnSource(image, source.base);
        const $ = cheerio.load(html);
        $('script, style, noscript, iframe, object, embed, form, nav, footer, header, link').remove();

        const postNodes = $('.post, .post-body, .postbody, .forum-post, .message, .comment, article');
        let postsHtml = '';
        let plainText = '';
        if (postNodes.length > 0) {
          const chunks: string[] = [];
          postNodes.each((_, el) => chunks.push($.html(el) ?? ''));
          postsHtml = chunks.join('\n').trim();
          plainText = postNodes.text().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        } else {
          const body = $('main, .content, #content, body').first();
          body.find('img[src]').each((_, el) => {
            const src = $(el).attr('src') ?? '';
            try { $(el).attr('src', new URL(src, source.base).toString()); }
            catch { $(el).removeAttr('src'); }
          });
          body.find('a[href^="javascript:"]').removeAttr('href');
          body.find('*').each((_, el) => {
            const attrs = (el as unknown as { attribs?: Record<string, string> }).attribs ?? {};
            for (const name of Object.keys(attrs)) if (/^on/i.test(name)) $(el).removeAttr(name);
          });
          postsHtml = (body.html() ?? '').trim();
          plainText = body.text().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        }
        if (!meta.title || (plainText.length < 10 && postsHtml.length < 20)) continue;

        const scoped = scopedId(source.origin, parsed.numericId);
        const sourceUrl = finalUrl || `${source.base}${path}`;
        void persistForumEntries([{ id: scoped, title: meta.title, href: sourceUrl, kind: 'thread' }]);
        return {
          id: scoped,
          title: meta.title,
          description: meta.description,
          image,
          postsHtml,
          plainText,
          sourceUrl,
          origin: source.origin,
          cachedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.warn(`[forum] ${source.origin} ${path}:`, (error as Error).message);
      }
    }
  }
  return null;
}

export const fetchForumThread: (id: string) => Promise<ForumThread | null> = unstable_cache(
  scrapeForumThread,
  ['streamlive-forum-thread-source-scoped-v3'],
  { revalidate: false, tags: ['streamlive-forum'] },
);

export async function fetchCategoryThreads(categoryId: string): Promise<ForumThreadList> {
  const parsed = parseScopedId(categoryId);
  if (!parsed) return { threads: [], origin: 'all', allFailed: true, error: 'Некорректный ID категории.' };
  const sources = parsed.origin ? [sourceForOrigin(parsed.origin)] : SOURCE_BASES;
  const errors: string[] = [];
  for (const source of sources) {
    try {
      const { html } = await fetchFromSource(source, `/forum_category.php?id=${parsed.numericId}`);
      const threads = parseCategoryThreadsHtml(html, source.base, source.origin);
      if (threads.length > 0) {
        void persistForumEntries(threads.map((thread) => ({
          id: thread.id,
          title: thread.title,
          href: thread.href,
          kind: 'thread' as const,
        })));
        return { threads, origin: source.origin, allFailed: false };
      }
    } catch (error) {
      errors.push(`${source.origin}: ${(error as Error).message}`);
    }
  }
  return { threads: [], origin: parsed.origin ?? 'all', allFailed: true, error: errors[errors.length - 1] || 'В категории нет тем.' };
}

/** Search only the local archive; no additional mirror requests. */
export async function searchForumLocal(query: string, limit = 30) {
  const { searchForumArchive } = await import('./cache');
  return searchForumArchive(query, limit);
}
