import { createDecipheriv, createHash } from 'node:crypto';
import type { SourceId } from './scraper';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 StreamLivePWA/1.2';
const TIMEOUT_MS = 9000;
const challengeCookieCache = new Map<string, { cookie: string; expiresAt: number }>();
const insecureTlsHosts = new Set(['domtv.blyz.ru', 'streamlivetv.freedev.app', 'streamliveru.web1337.net']);

export type SourcePage = { html: string; finalUrl: string; status: number };

function aesCookie(html: string): string | null {
  const m = html.match(/toNumbers\(["']([0-9a-f]+)["']\)\s*,\s*b\s*=\s*toNumbers\(["']([0-9a-f]+)["']\)\s*,\s*c\s*=\s*toNumbers\(["']([0-9a-f]+)["']\)/i);
  if (!m) return null;
  try {
    const key = Buffer.from(m[1], 'hex');
    const iv = Buffer.from(m[2], 'hex');
    const encrypted = Buffer.from(m[3], 'hex');
    if (key.length !== 16 || iv.length !== 16 || encrypted.length % 16 !== 0) return null;
    const decipher = createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('hex');
  } catch {
    return null;
  }
}

function powCookie(html: string): string | null {
  const seed = html.match(/seed\s*=\s*["']([0-9a-f]+)["']/i)?.[1];
  if (!seed) return null;
  const zeros = html.match(/startsWith\(["'](0+)["']\)/i)?.[1].length ?? 4;
  const target = '0'.repeat(Math.min(zeros, 6));
  for (let nonce = 0; nonce < 5_000_000; nonce++) {
    const hash = createHash('sha256').update(`${seed}${nonce}`).digest('hex');
    if (hash.startsWith(target)) return `${seed}:${nonce}`;
  }
  return null;
}

function challengeType(html: string): 'aes' | 'pow' | 'none' {
  if (/slowAES\.decrypt|src=["']\/aes\.js/i.test(html)) return 'aes';
  if (/ddos_pow|crypto\.subtle\.digest/i.test(html)) return 'pow';
  return 'none';
}

let insecureDispatcher: { close: () => Promise<void> } | null = null;

async function request(url: string, cookie: string): Promise<Response> {
  const init = {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'ru-RU,ru;q=0.9,en;q=0.7',
      ...(cookie ? { cookie } : {}),
    },
    redirect: 'manual' as RequestRedirect,
    cache: 'no-store' as RequestCache,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  try {
    return await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
    const detail = `${message} ${cause instanceof Error ? cause.message : ''}`;
    const isTls = /certificate|cert_|ssl|tls|unable to verify|self.signed/i.test(detail);
    const host = new URL(url).hostname;
    // Scoped fallback for the project's three known mirrors only. It is used only
    // when the upstream certificate itself fails; all other TLS requests stay strict.
    if (!isTls || !insecureTlsHosts.has(host)) throw error;
    try {
      if (!insecureDispatcher) {
        const { Agent } = await import('undici');
        insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
      }
      return await fetch(url, { ...init, dispatcher: insecureDispatcher } as RequestInit & { dispatcher: unknown });
    } catch {
      throw error;
    }
  }
}

/** Fetches a real page from one configured source, handling its short JS cookie/PoW challenge. */
export async function fetchSourcePage(url: string, source: SourceId): Promise<SourcePage> {
  let currentUrl = url;
  const origin = new URL(url).origin;
  let cookie = (challengeCookieCache.get(origin)?.expiresAt ?? 0) > Date.now() ? challengeCookieCache.get(origin)!.cookie : '';
  for (let step = 0; step < 6; step++) {
    const response = await request(currentUrl, cookie);
    const html = await response.text();
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const next = new URL(location, currentUrl);
        const currentHost = new URL(url).hostname;
        if (next.hostname !== currentHost && !next.hostname.endsWith(`.${currentHost}`) && !currentHost.endsWith(`.${next.hostname}`)) {
          throw new Error(`Источник перенаправил на посторонний домен: ${next.hostname}`);
        }
        currentUrl = next.toString();
        continue;
      }
    }

    const challenge = challengeType(html);
    if (challenge === 'aes') {
      const value = aesCookie(html);
      if (!value) throw new Error(`Не удалось обработать AES-проверку источника ${source}`);
      cookie = [cookie.split('; ').filter((part) => !part.startsWith('__test=')).join('; '), `__test=${value}`].filter(Boolean).join('; ');
      challengeCookieCache.set(origin, { cookie, expiresAt: Date.now() + 20 * 60 * 1000 });
      const target = html.match(/location\.href\s*=\s*["']([^"']+)["']/i)?.[1];
      if (target) {
        const next = new URL(target, currentUrl);
        const currentHost = new URL(url).hostname;
        if (next.hostname !== currentHost && !next.hostname.endsWith(`.${currentHost}`) && !currentHost.endsWith(`.${next.hostname}`)) throw new Error(`Проверка источника перенаправила на посторонний домен: ${next.hostname}`);
        currentUrl = next.toString();
      }
      continue;
    }
    if (challenge === 'pow') {
      const value = powCookie(html);
      if (!value) throw new Error(`Не удалось обработать PoW-проверку источника ${source}`);
      cookie = [cookie.split('; ').filter((part) => !part.startsWith('ddos_pow=')).join('; '), `ddos_pow=${value}`].filter(Boolean).join('; ');
      challengeCookieCache.set(origin, { cookie, expiresAt: Date.now() + 20 * 60 * 1000 });
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} от ${currentUrl}`);
    return { html, finalUrl: response.url || currentUrl, status: response.status };
  }
  throw new Error(`Источник ${source}: превышено число шагов проверки/редиректа`);
}
