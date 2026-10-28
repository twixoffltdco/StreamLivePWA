/** Shared StreamLive types. Source-specific URLs are preserved so mirrors never get mixed. */
export type ContentKind = 'channel' | 'video';
export type SourceOrigin = 'prod' | 'reserve' | 'mirror3';

export interface StreamContent {
  id: string;
  title: string;
  description: string;
  image: string | null;
  sourceUrl: string;
  embedUrl: string;
  kind: ContentKind;
  origin: SourceOrigin;
  cachedAt: string;
}

export interface FeedResult {
  items: StreamContent[];
  allFailed: boolean;
  error?: string;
}

export interface ForumThreadSummary {
  /** Scoped id, e.g. prod-12 / reserve-12, so equal IDs on different mirrors remain separate. */
  id: string;
  title: string;
  href: string;
  origin: SourceOrigin;
}

export interface ForumThreadList {
  threads: ForumThreadSummary[];
  origin: SourceOrigin | 'all';
  allFailed: boolean;
  error?: string;
}

export interface ForumThread {
  id: string;
  title: string;
  description: string;
  image: string | null;
  postsHtml: string;
  plainText: string;
  sourceUrl: string;
  origin: SourceOrigin;
  cachedAt: string;
}
