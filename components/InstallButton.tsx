/**
 * components/InstallButton.tsx — большая кнопка "📲 Установить приложение".
 *
 * - Chromium (Android / Android TV / Desktop): вызывает beforeinstallprompt.
 * - iOS: показывает модальную инструкцию "Поделиться → На экран Домой".
 * - Если PWA уже запущен в standalone — кнопка превращается в бейдж "Установлено".
 */

'use client';

import Link from 'next/link';
import { CheckCircle2, Download, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '@/lib/usePWAInstall';

export default function InstallButton() {
  const { canInstall, isInstalled, platform, install } = usePWAInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex flex-col items-center gap-4">
        <span className="inline-flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-8 py-5 text-xl font-extrabold text-emerald-300 shadow-glow-cyan">
          <CheckCircle2 size={28} aria-hidden />
          Приложение установлено ✓
        </span>
        <Link
          href="/app"
          className="sl-focus sl-focus-pink inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#00f2ea] to-[#fe2c55] px-12 py-6 text-2xl font-black text-black transition hover:brightness-110"
        >
          ▶ Открыть StreamLive
        </Link>
      </div>
    );
  }

  const handleClick = async () => {
    if (canInstall) {
      setBusy(true);
      await install();
      setBusy(false);
      return;
    }
    // iOS / Firefox / ТВ-браузеры без промпта — показываем инструкцию
    setShowIosHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label="Установить StreamLive как приложение"
        className="sl-focus sl-focus-pink group relative inline-flex items-center gap-4 rounded-3xl bg-gradient-to-r from-[#00f2ea] via-[#7dd8ff] to-[#fe2c55] px-12 py-7 text-3xl font-black text-black shadow-[0_0_48px_rgba(0,242,234,0.45)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:text-4xl"
      >
        <Download size={36} strokeWidth={3} aria-hidden className="transition group-hover:-translate-y-1" />
        📲 Установить приложение
        <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-medium text-zinc-400">
          {platform === 'ios'
            ? 'iPhone/iPad: покажем пошаговую инструкцию'
            : platform === 'tv'
              ? 'Android TV: добавим на главный экран'
              : 'Работает офлайн · Без адресной строки браузера'}
        </span>
      </button>

      {/* Модальная инструкция для платформ без beforeinstallprompt */}
      {showIosHelp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Как установить приложение"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="sl-card max-w-xl w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <h3 className="flex items-center gap-3 text-2xl font-black">
                <Smartphone className="text-[#00f2ea]" aria-hidden />
                Ручная установка
              </h3>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                aria-label="Закрыть"
                className="sl-focus rounded-xl border border-white/15 p-3 text-zinc-300 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>
            <ol className="list-decimal space-y-4 pl-6 text-lg leading-relaxed text-zinc-200 marker:text-[#00f2ea] marker:font-bold">
              {platform === 'ios' ? (
                <>
                  <li>
                    Откройте сайт в <b>Safari</b> (не в Chrome — там промпт недоступен).
                  </li>
                  <li>
                    Нажмите кнопку <b>«Поделиться»</b> <span className="inline-block rotate-[-30deg] rounded bg-white/10 px-2">⬆︎</span> внизу экрана.
                  </li>
                  <li>
                    Выберите пункт <b>«На экран Домой»</b> → «Добавить».
                  </li>
                  <li>Иконка StreamLive появится на рабочем столе — запускайте как нативное приложение.</li>
                </>
              ) : (
                <>
                  <li>
                    В меню браузера (⋮ или <ShareIconNote />) выберите{' '}
                    <b>«Добавить на главный экран»</b> / <b>«Установить приложение»</b>.
                  </li>
                  <li>Подтвердите установку — иконка StreamLive появится на рабочем столе.</li>
                  <li>Запускайте: приложение откроется в режиме standalone без интерфейса браузера.</li>
                </>
              )}
            </ol>
            <p className="mt-6 text-sm text-zinc-500">
              Не видите пункта установки? Обновите страницу — браузер должен прислать промпт установки.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ShareIconNote() {
  return <span className="rounded bg-white/10 px-2 py-0.5 text-base">⬆︎ Поделиться</span>;
}
