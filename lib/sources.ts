/**
 * lib/sources.ts — единый реестр зеркал StreamLive.
 * Все три домена поддерживают встраивание (X-Frame-Options не блокирует iframe).
 */

export interface StreamSource {
  /** Уникальный id источника */
  id: string;
  /** Домен зеркала */
  domain: string;
  /** Отображаемое имя */
  label: string;
  /** Короткая подпись для ТВ-панели */
  hint: string;
  /** URL для iframe */
  url: string;
}

export const SOURCES: StreamSource[] = [
  {
    id: 'domtv',
    domain: 'domtv.blyz.ru',
    label: 'DomTV',
    hint: 'Зеркало №1 · blyz.ru',
    url: 'https://domtv.blyz.ru',
  },
  {
    id: 'freedev',
    domain: 'streamlivetv.freedev.app',
    label: 'StreamLive TV',
    hint: 'Зеркало №2 · freedev.app',
    url: 'https://streamlivetv.freedev.app',
  },
  {
    id: 'web1337',
    domain: 'streamliveru.web1337.net',
    label: 'StreamLive RU',
    hint: 'Зеркало №3 · web1337.net',
    url: 'https://streamliveru.web1337.net',
  },
];

export const DEFAULT_SOURCE_ID = SOURCES[0].id;

export function getSourceById(id: string | null | undefined): StreamSource {
  return SOURCES.find((s) => s.id === id) ?? SOURCES[0];
}
