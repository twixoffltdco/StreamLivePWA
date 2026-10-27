/**
 * components/AppPlayer.tsx — главный интерфейс приложения (route /app).
 *
 * Верхняя панель: 3 кнопки-переключателя зеркал + PiP + Fullscreen.
 * Основная область: iframe выбранного домена.
 * PiP: нативный Document Picture-in-Picture API, при недоступности —
 *      имитация (плавающий iframe в углу экрана).
 * Fullscreen: нативный Fullscreen API.
 * D-pad: useDPadNavigation + :focus-visible стили из globals.css.
 */

'use client';

import {
  Maximize2,
  Minimize2,
  Pip,
  RefreshCw,
  Tv,
  X,
  ExternalLink,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DEFAULT_SOURCE_ID, SOURCES, getSourceById } from '@/lib/sources';
import { useDPadNavigation } from '@/lib/useDPadNavigation';
import { usePWAInstall } from '@/lib/usePWAInstall';

const STORAGE_KEY = 'streamlive:source';

declare global {
  interface Window {
    /** Document Picture-in-Picture API (Chrome 116+) */
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
      window: Window | null;
      close(): void;
    };
  }
}

export default function AppPlayer() {
  const [sourceId, setSourceId] = useState<string>(DEFAULT_SOURCE_ID);
  const [iframeKey, setIframeKey] = useState(0); // для принудительного reload
  const [pipFloating, setPipFloating] = useState(false); // режим "имитации PiP"
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const mainFrameRef = useRef<HTMLIFrameElement>(null);

  const { isInstalled, platform } = usePWAInstall();

  // Восстановление последнего выбранного зеркала
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSourceId(getSourceById(saved).id);
    } catch {
      /* private mode */
    }
  }, []);

  const selectSource = useCallback((id: string) => {
    setSourceId(id);
    setLoading(true);
    setIframeKey((k) => k + 1);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* noop */
    }
  }, []);

  // ---------- Fullscreen API ----------
  const toggleFullscreen = useCallback(async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* TV-браузеры могут не поддерживать — тихо игнорируем */
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ---------- Picture-in-Picture ----------
  const togglePip = useCallback(async () => {
    // 1. Попытка нативного Document Picture-in-Picture (Chrome 116+)
    if (window.documentPictureInPicture && !window.documentPictureInPicture.window) {
      try {
        const frame = mainFrameRef.current;
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 480,
          height: 270,
        });
        // Переносим iframe со стримом в PiP-окно
        pipWin.document.body.style.cssText = 'margin:0;background:#000;display:grid;place-items:center';
        if (frame) {
          const clone = frame.cloneNode(true) as HTMLIFrameElement;
          clone.style.cssText = 'width:100%;height:100%;border:0';
          pipWin.document.body.appendChild(clone);
        }
        pipWin.addEventListener('pagehide', () => setPipFloating(false));
        return;
      } catch {
        /* fallthrough к имитации */
      }
    }
    // 2. Имитация: плавающий iframe в углу экрана
    setPipFloating((v) => !v);
  }, []);

  // Закрытие PiP/полноэкрана кнопкой Back пульта (Backspace на Android TV)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Escape') {
        if (pipFloating) {
          setPipFloating(false);
          e.preventDefault();
        } else if (document.fullscreenElement) {
          void document.exitFullscreen();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pipFloating]);

  // D-pad навигация по кнопкам панели (в iframe стрелки уходят контенту)
  useDPadNavigation(true);

  const source = getSourceById(sourceId);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-black">
      {/* ================= ВЕРХНЯЯ ПАНЕЛЬ ================= */}
      <header className="z-30 flex items-center gap-3 border-b border-white/10 bg-[#0b0b0f]/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          href="/"
          aria-label="Домашняя страница StreamLive"
          className="sl-focus mr-1 hidden items-center gap-2 rounded-xl px-3 py-2 text-lg font-black sm:flex"
        >
          <Tv className="text-[#00f2ea]" size={26} aria-hidden />
          <span className="sl-gradient-text">StreamLive</span>
        </Link>

        {/* Выбор источника — 3 кнопки-переключателя */}
        <nav aria-label="Источник трансляции" className="flex flex-1 flex-wrap items-center gap-2 sm:gap-3">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectSource(s.id)}
              data-active={sourceId === s.id ? 'true' : 'false'}
              className="sl-source-btn flex items-center gap-2"
              aria-pressed={sourceId === s.id}
              title={s.url}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  sourceId === s.id ? 'bg-black/70' : 'bg-[#fe2c55] animate-live'
                }`}
                aria-hidden
              />
              <span className="flex flex-col items-start leading-tight">
                <span>{s.label}</span>
                <span
                  className={`hidden text-xs font-medium md:block ${
                    sourceId === s.id ? 'text-black/70' : 'text-zinc-500'
                  }`}
                >
                  {s.domain}
                </span>
              </span>
            </button>
          ))}
        </nav>

        {/* Управление просмотром */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setIframeKey((k) => k + 1);
            }}
            aria-label="Обновить страницу источника"
            className="sl-focus rounded-xl border border-white/15 bg-[#15151c] p-3 text-zinc-200 hover:border-[#00f2ea]/60"
          >
            <RefreshCw size={22} aria-hidden className={loading ? 'animate-spin text-[#00f2ea]' : ''} />
          </button>

          <button
            type="button"
            onClick={togglePip}
            aria-label={pipFloating ? 'Выключить Picture-in-Picture' : 'Включить Picture-in-Picture'}
            aria-pressed={pipFloating}
            className="sl-focus sl-focus-pink rounded-xl border border-white/15 bg-[#15151c] p-3 text-zinc-200 hover:border-[#fe2c55]/60"
          >
            <Pip size={22} aria-hidden />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'}
            className="sl-focus rounded-xl border border-white/15 bg-[#15151c] p-3 text-zinc-200 hover:border-[#00f2ea]/60"
          >
            {isFullscreen ? <Minimize2 size={22} aria-hidden /> : <Maximize2 size={22} aria-hidden />}
          </button>
        </div>
      </header>

      {/* ================= СЦЕНА / IFRAME ================= */}
      <section
        ref={stageRef}
        className="relative flex-1 bg-black"
        aria-label={`Трансляция с ${source.domain}`}
      >
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black">
            <div className="flex flex-col items-center gap-4">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/10 border-t-[#00f2ea]" />
              <p className="text-lg font-bold text-zinc-300">
                Подключаемся к <span className="text-[#00f2ea]">{source.domain}</span>…
              </p>
            </div>
          </div>
        )}

        <iframe
          key={`${sourceId}-${iframeKey}`}
          ref={mainFrameRef}
          src={source.url}
          title={`StreamLive — ${source.label}`}
          onLoad={() => setLoading(false)}
          allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          className="h-full w-full border-0 bg-black"
        />

        {/* Плашка LIVE + источник */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-xl bg-black/70 px-4 py-2 backdrop-blur">
          <span className="flex items-center gap-2 font-black uppercase tracking-widest text-[#fe2c55]">
            <span className="h-3 w-3 animate-live rounded-full bg-[#fe2c55]" aria-hidden /> Live
          </span>
          <span className="text-base font-semibold text-zinc-300">{source.domain}</span>
        </div>

        {!isInstalled && platform !== 'tv' && (
          <Link
            href="/"
            className="sl-focus absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl bg-black/70 px-4 py-2 text-sm font-bold text-[#00f2ea] backdrop-blur hover:text-white"
          >
            <ExternalLink size={18} aria-hidden /> Как установить?
          </Link>
        )}
      </section>

      {/* ================= PiP: плавающий iframe (имитация) ================= */}
      {pipFloating && (
        <aside className="sl-pip-floating" role="dialog" aria-label="Picture-in-Picture окно">
          <iframe
            src={source.url}
            title={`StreamLive PiP — ${source.label}`}
            allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="h-full w-full border-0 bg-black"
          />
          <button
            type="button"
            onClick={() => setPipFloating(false)}
            aria-label="Закрыть Picture-in-Picture"
            className="sl-focus sl-focus-pink absolute left-2 top-2 rounded-lg bg-black/80 p-2 text-white hover:text-[#fe2c55]"
          >
            <X size={18} aria-hidden />
          </button>
          <span className="pointer-events-none absolute bottom-1 right-2 rounded bg-black/70 px-2 py-0.5 text-xs font-bold text-[#00f2ea]">
            PiP · {source.label}
          </span>
        </aside>
      )}
    </main>
  );
}
