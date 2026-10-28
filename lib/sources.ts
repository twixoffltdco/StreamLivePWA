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
    id: 'freedev',
    domain: 'streamlivetv.freedev.app',
    label: 'Production · StreamLive TV',
    hint: 'Основной production · freedev.app',
    url: 'https://streamlivetv.freedev.app',
  },
  {
    id: 'domtv',
    domain: 'domtv.blyz.ru',
    label: 'Зеркало · DomTV',
    hint: 'Резервное зеркало · blyz.ru',
    url: 'https://domtv.blyz.ru',
  },
  {
    id: 'web1337',
    domain: 'streamliveru.web1337.net',
    label: 'Зеркало · StreamLive RU',
    hint: 'Зеркало №3 · web1337.net',
    url: 'https://streamliveru.web1337.net',
  },
];

export const DEFAULT_SOURCE_ID = 'freedev';

export function getSourceById(id: string | null | undefined): StreamSource {
  return SOURCES.find((s) => s.id === id) ?? SOURCES[0];
}
