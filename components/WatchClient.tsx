'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Heart, Share2, PictureInPicture2, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';

type Mirror = { source: string; url: string; playUrl?: string };
type WatchItem = { title: string; url: string; playUrl?: string; source?: string; thumbnail?: string; live?: boolean; kind?: string; mirrors?: Mirror[] };

function decodeItem(id: string): WatchItem | null {
  try {
    const base64 = id.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as WatchItem;
    if (!decoded || typeof decoded !== 'object' || typeof decoded.title !== 'string' || typeof decoded.url !== 'string') return null;
    const validMirrors = Array.isArray(decoded.mirrors) ? decoded.mirrors.filter((m): m is Mirror => !!m && typeof m.url === 'string' && typeof m.source === 'string') : [];
    return { ...decoded, mirrors: validMirrors };
  } catch {
    return null;
  }
}

function safeUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch { return ''; }
}

const sourceLabels: Record<string, string> = { freedev: 'Production', domtv: 'DomTV', web1337: 'StreamLive RU' };

export default function WatchClient({ id }: { id: string }) {
  const [item, setItem] = useState<WatchItem | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [liked, setLiked] = useState(false);
  const [mirrorIndex, setMirrorIndex] = useState(0);

  useEffect(() => {
    const decoded = decodeItem(id);
    setItem(decoded);
    setDecodeFailed(!decoded);
    setMirrorIndex(0);
  }, [id]);

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: item?.title || 'StreamLive', url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch { /* sharing cancelled or unavailable */ }
  }

  async function pip() {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    try {
      if (video && document.pictureInPictureEnabled) await video.requestPictureInPicture();
      else alert('PiP доступен, если источник предоставляет HTML5 video и браузер поддерживает эту функцию.');
    } catch { /* PiP unavailable for this source */ }
  }

  const mirrors = item ? (item.mirrors?.length ? item.mirrors : [{ source: item.source || 'freedev', url: item.url, playUrl: item.playUrl || item.url }]) : [];
  const activeMirror = mirrors[Math.min(mirrorIndex, Math.max(0, mirrors.length - 1))];
  const playUrl = safeUrl(activeMirror?.playUrl || item?.playUrl || activeMirror?.url || item?.url);
  const sourceUrl = safeUrl(activeMirror?.url || item?.url);

  if (decodeFailed) return (
    <main className="grid min-h-screen place-items-center bg-black p-6 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#101015] p-6 text-center">
        <AlertCircle className="mx-auto mb-3 text-[#fe2c55]" size={34} />
        <h1 className="text-xl font-black">Не удалось открыть этот материал</h1>
        <p className="mt-2 text-sm text-zinc-400">Ссылка могла быть обрезана или устареть. Вернись в каталог и открой карточку ещё раз.</p>
        <Link href="/app" className="sl-focus mt-5 inline-flex rounded-xl bg-[#00f2ea] px-5 py-3 font-bold text-black">Назад в каталог</Link>
      </section>
    </main>
  );

  if (!item) return <main className="grid min-h-screen place-items-center bg-black text-[#00f2ea]"><div className="flex items-center gap-3"><RefreshCw className="animate-spin"/>Загружаем плеер…</div></main>;

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="flex items-center gap-4 px-4 py-4 md:px-8">
        <Link href="/app" className="sl-focus rounded-xl border border-white/10 bg-[#15151c] p-3" aria-label="Назад"><ArrowLeft /></Link>
        <div className="min-w-0"><h1 className="truncate text-lg font-black md:text-2xl">{item.title || 'Просмотр'}</h1><p className="text-xs text-zinc-500">Источник · {sourceLabels[activeMirror?.source || item.source || ''] || activeMirror?.source || item.source || 'Неизвестен'}</p></div>
      </header>
      <section className="mx-auto max-w-7xl px-3 md:px-8">
        <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[#08080a]">
          {playUrl ? <iframe key={`${activeMirror?.source || item.source}:${playUrl}`} src={playUrl} title={item.title || 'StreamLive player'} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full border-0" /> : <div className="grid h-full place-items-center p-6 text-center"><div><AlertCircle className="mx-auto mb-3 text-[#fe2c55]" size={32}/><p className="font-bold">У источника нет ссылки для воспроизведения</p><p className="mt-2 text-sm text-zinc-400">Попробуй другое зеркало или открой страницу источника.</p></div></div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div><h2 className="text-xl font-bold">{item.title || 'Просмотр'}</h2><p className="mt-1 text-sm text-zinc-400">Воспроизведение предоставляется выбранным источником.</p></div>
          <div className="flex flex-wrap gap-2">
            {mirrors.length > 1 && <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#15151c] px-3 py-2 text-sm"><span className="text-zinc-400">Источник</span><select aria-label="Источник воспроизведения" value={Math.min(mirrorIndex, mirrors.length - 1)} onChange={(e) => setMirrorIndex(Number(e.target.value))} className="bg-transparent text-white outline-none">{mirrors.map((m, index) => <option key={`${m.source}-${m.url}-${index}`} value={index}>{sourceLabels[m.source] || m.source}</option>)}</select></label>}
            <button onClick={() => setLiked(!liked)} className="sl-focus flex items-center gap-2 rounded-xl border border-white/10 bg-[#15151c] px-4 py-3"><Heart size={18} className={liked ? 'text-[#fe2c55]' : ''} fill={liked ? '#fe2c55' : 'none'}/>Нравится</button>
            <button onClick={share} className="sl-focus flex items-center gap-2 rounded-xl border border-white/10 bg-[#15151c] px-4 py-3"><Share2 size={18}/>Поделиться</button>
            <button onClick={pip} className="sl-focus flex items-center gap-2 rounded-xl border border-white/10 bg-[#15151c] px-4 py-3"><PictureInPicture2 size={18}/>PiP</button>
            {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="sl-focus flex items-center gap-2 rounded-xl border border-white/10 bg-[#15151c] px-4 py-3"><ExternalLink size={18}/>Источник</a>}
          </div>
        </div>
      </section>
    </main>
  );
}
