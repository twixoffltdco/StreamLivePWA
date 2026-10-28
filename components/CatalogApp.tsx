'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Tv, Search, Heart, Home, Layers, Settings, RefreshCw, Radio, PlayCircle, Clapperboard, MessagesSquare, AlertCircle } from 'lucide-react';
import { SOURCES } from '@/lib/sources';

type ContentKind = 'channel' | 'video' | 'forum' | 'other';
type Item = { id: string; title: string; url: string; playUrl?: string; thumbnail: string; isLive: boolean; source: string; kind?: ContentKind; description?: string };
type Diagnostic = { source: string; url: string; ok: boolean; status?: number; elapsedMs: number; itemCount: number; error?: string; blocked?: boolean };
const sourceNames: Record<string, string> = { freedev: 'Production · StreamLive TV', domtv: 'Зеркало · DomTV', web1337: 'Зеркало · StreamLive RU' };
const kindNames: Record<ContentKind, string> = { channel: 'Канал', video: 'Видео', forum: 'Форум', other: 'Материал' };
const makeId = (item: Item) => btoa(unescape(encodeURIComponent(JSON.stringify({ url: item.url, playUrl: item.playUrl || item.url, source: item.source, title: item.title, thumbnail: item.thumbnail, live: item.isLive, kind: item.kind || 'other' })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

export default function CatalogApp() {
  const [items, setItems] = useState<Item[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('all');
  const [kind, setKind] = useState<'all' | ContentKind>('all');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('home');
  const [favorites, setFavorites] = useState<string[]>([]);

  async function load() {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/catalog', { cache: 'no-store', headers: { accept: 'application/json' } });
      const type = r.headers.get('content-type') || '';
      if (!r.ok) throw new Error(`API приложения вернул HTTP ${r.status}`);
      if (!type.includes('application/json')) throw new Error('Путь /api/catalog не вернул JSON. Для серверного парсера нужен работающий Node.js/Next.js runtime.');
      const j = await r.json();
      if (!Array.isArray(j.items)) throw new Error('API вернул JSON без массива items');
      setItems(j.items);
      setDiagnostics(Array.isArray(j.diagnostics) ? j.diagnostics : []);
      if (!j.items.length) setError('Каталог пуст: сервер не получил распознаваемые карточки. Проверьте результаты каждого источника ниже.');
    } catch (e) {
      setItems([]); setDiagnostics([]);
      setError(`Не удалось загрузить каталог: ${e instanceof Error ? e.message : 'ошибка сети'}`);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void load();
    try { setFavorites(JSON.parse(localStorage.getItem('sl-favs') || '[]')); } catch { /* ignore corrupt local storage */ }
  }, []);

  const visible = useMemo(() => items.filter((i) =>
    (source === 'all' || i.source === source) &&
    (kind === 'all' || (i.kind || 'other') === kind) &&
    (tab !== 'favorites' || favorites.includes(i.id)) &&
    (`${i.title} ${sourceNames[i.source] || ''} ${kindNames[i.kind || 'other']}`).toLowerCase().includes(query.toLowerCase())
  ), [items, source, kind, tab, favorites, query]);

  function toggle(item: Item) {
    const next = favorites.includes(item.id) ? favorites.filter((x) => x !== item.id) : [...favorites, item.id];
    setFavorites(next);
    try { localStorage.setItem('sl-favs', JSON.stringify(next)); } catch { /* storage can be disabled */ }
  }

  return <main className="min-h-screen bg-black pb-24 text-white">
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-4 border-b border-white/10 bg-black/90 px-5 py-4 backdrop-blur md:px-8">
      <Link href="/app" className="sl-focus flex items-center gap-2 rounded-xl"><Tv className="text-[#00f2ea]" size={28}/><span className="text-xl font-black">Stream<span className="sl-gradient-text">Live</span></span></Link>
      <div className="relative min-w-[180px] flex-1"><Search className="absolute left-3 top-3 text-zinc-500" size={18}/><input aria-label="Поиск по каталогу" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Каналы, видео, форум…" className="sl-focus w-full rounded-xl border border-white/10 bg-[#111116] py-2.5 pl-10 pr-3 text-base" tabIndex={0}/></div>
      <button onClick={() => void load()} tabIndex={0} className="sl-focus rounded-xl border border-white/10 bg-[#15151c] p-3" aria-label="Обновить каталог"><RefreshCw size={20} className={loading ? 'animate-spin text-[#00f2ea]' : ''}/></button>
    </header>

    <section className="mx-auto max-w-[1800px] px-4 py-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.24em] text-[#00f2ea]"><Radio size={14}/> Единый каталог</p><h1 className="text-3xl font-black md:text-4xl">{tab === 'favorites' ? 'Избранное' : 'Всё из StreamLive'}</h1><p className="mt-2 text-zinc-400">Общая лента production и зеркал · дубли сохраняются</p></div>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Источник" tabIndex={0} className="sl-focus rounded-xl border border-white/10 bg-[#15151c] px-4 py-3"><option value="all">Все источники</option>{SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      </div>

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Тип контента">
        {([{ id: 'all', label: 'Всё', icon: Layers }, { id: 'channel', label: 'Каналы', icon: Radio }, { id: 'video', label: 'Видео', icon: Clapperboard }, { id: 'forum', label: 'Форум', icon: MessagesSquare }, { id: 'other', label: 'Другое', icon: Tv }] as const).map((x) => <button key={x.id} onClick={() => setKind(x.id)} tabIndex={0} className={`sl-focus inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${kind === x.id ? 'border-[#00f2ea]/60 bg-[#00f2ea]/10 text-[#00f2ea]' : 'border-white/10 bg-[#15151c] text-zinc-300'}`}><x.icon size={16}/>{x.label}</button>)}
      </div>

      {error && <div className="mb-5 rounded-xl border border-[#fe2c55]/30 bg-[#fe2c55]/10 p-4 text-zinc-200">{error}</div>}
      {!loading && diagnostics.length > 0 && <div className="mb-6 rounded-2xl border border-white/10 bg-[#0b0b0f] p-4"><div className="mb-3 flex items-center gap-2 font-bold"><AlertCircle size={17} className="text-[#00f2ea]"/>Статус источников</div><div className="grid gap-2 md:grid-cols-3">{diagnostics.map((d) => <div key={d.source} className="rounded-xl border border-white/10 bg-black/40 p-3"><div className="flex items-center justify-between gap-2"><span className="font-bold">{sourceNames[d.source] || d.source}</span><span className={`text-xs font-bold ${d.ok && d.itemCount > 0 ? 'text-emerald-400' : 'text-amber-300'}`}>{d.itemCount} карточек{d.status ? ` · HTTP ${d.status}` : ''}</span></div>{d.error && <p className="mt-2 break-words text-xs leading-relaxed text-zinc-400">{d.error}</p>}</div>)}</div></div>}

      {loading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">{Array.from({ length: 10 }, (_, i) => <div key={i} className="aspect-video animate-pulse rounded-2xl bg-[#15151c]"/>)}</div> : visible.length === 0 ? <div className="rounded-2xl border border-white/10 bg-[#0b0b0f] px-6 py-16 text-center"><PlayCircle size={42} className="mx-auto mb-4 text-[#00f2ea]"/><h2 className="text-xl font-bold">Ничего не найдено</h2><p className="mt-2 text-zinc-400">Попробуйте другой тип контента, источник или запрос.</p></div> : <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{visible.map((item) => <article key={item.id} className="group relative min-w-0"><Link href={`/app/watch/${makeId(item)}`} tabIndex={0} className="sl-focus block overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0f] transition hover:border-[#00f2ea]/60 hover:shadow-[0_0_24px_rgba(0,242,234,.13)]"><div className="relative aspect-video overflow-hidden bg-[#15151c]">{item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/> : <div className="grid h-full place-items-center"><Tv size={40} className="text-zinc-600"/></div>}{item.isLive && <span className="absolute left-2 top-2 rounded-md bg-[#fe2c55] px-2 py-1 text-[10px] font-black tracking-wider">LIVE</span>}<span className="absolute bottom-2 right-2 rounded-full bg-black/75 p-2"><PlayCircle size={20}/></span></div><div className="p-3"><p className="line-clamp-2 min-h-12 font-bold leading-snug">{item.title}</p><p className="mt-1 truncate text-xs text-zinc-500">{sourceNames[item.source] || item.source} · {kindNames[item.kind || 'other']}</p></div></Link><button onClick={() => toggle(item)} tabIndex={0} aria-label={favorites.includes(item.id) ? 'Убрать из избранного' : 'В избранное'} className="sl-focus absolute right-2 top-2 rounded-full bg-black/75 p-2 text-white hover:text-[#fe2c55]"><Heart size={17} fill={favorites.includes(item.id) ? '#fe2c55' : 'none'} className={favorites.includes(item.id) ? 'text-[#fe2c55]' : ''}/></button></article>)}</div>}
    </section>

    <nav aria-label="Нижнее меню" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#09090c]/95 px-2 py-2 backdrop-blur">{[{ id: 'home', label: 'Главная', icon: Home }, { id: 'categories', label: 'Категории', icon: Layers }, { id: 'favorites', label: 'Избранное', icon: Heart }, { id: 'settings', label: 'Настройки', icon: Settings }].map((x) => <button key={x.id} onClick={() => { setTab(x.id); if (x.id === 'categories') setKind('all'); if (x.id === 'settings') window.location.href = '/'; }} tabIndex={0} className={`sl-focus flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs ${tab === x.id ? 'text-[#00f2ea]' : 'text-zinc-400'}`}><x.icon size={21}/>{x.label}</button>)}</nav>
  </main>;
}
