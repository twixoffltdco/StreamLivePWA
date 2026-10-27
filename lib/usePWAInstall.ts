/**
 * lib/usePWAInstall.ts — хук управления установкой PWA.
 *
 * Логика:
 * 1. Слушаем `beforeinstallprompt` (Chromium: Android, Android TV, Chrome OS, Desktop).
 *    Событие отменяем (preventDefault), чтобы браузер не показывал свой баннер,
 *    и сохраняем промпт для вызова по кнопке "📲 Установить приложение".
 * 2. Если событие недоступно (iOS Safari / Firefox) — возвращаем флаг платформы,
 *    чтобы UI показал инструкцию "Добавить на экран «Домой»" вручную.
 * 3. Отслеживаем `appinstalled` и режим запуска (standalone) через matchMedia.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

/** Типизация события beforeinstallprompt (пока вне стандарта TS DOM) */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallPlatform = 'android' | 'ios' | 'tv' | 'desktop' | 'other';

export interface PWAInstallState {
  /** Доступен нативный промпт установки (Chromium) */
  canInstall: boolean;
  /** Приложение уже установлено / запущено в standalone */
  isInstalled: boolean;
  /** Пользователь уже принял или отклонил установку */
  installOutcome: 'accepted' | 'dismissed' | null;
  /** Платформа для показа нужной инструкции */
  platform: InstallPlatform;
  /** Вызвать системный диалог установки */
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari использует кастомный флаг navigator.standalone
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || iosStandalone;
}

function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  // Android TV / Google TV / SmartTV-браузеры
  if (/android tv|googletv|smart-tv|smarttv|tizen|web0s|bravia|atv|crkey/.test(ua)) return 'tv';
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/android/.test(ua)) return 'android';
  if (/windows|macintosh|linux|x11/.test(ua)) return 'desktop';
  return 'other';
}

export function usePWAInstall(): PWAInstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [outcome, setOutcome] = useState<'accepted' | 'dismissed' | null>(null);
  const [platform, setPlatform] = useState<InstallPlatform>('other');

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsInstalled(detectStandalone());

    const onBeforeInstall = (e: Event) => {
      // Не даём браузеру показать собственный баннер — управляем сами
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferred(null);
      setIsInstalled(true);
      setOutcome('accepted');
    };

    const onDisplayModeChange = (e: MediaQueryListEvent) => setIsInstalled(e.matches);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable';
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setOutcome(choice.outcome);
      if (choice.outcome === 'accepted') {
        // appinstalled сработает позже; промпт одноразовый
        setDeferred(null);
      }
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferred]);

  return {
    canInstall: deferred !== null,
    isInstalled,
    installOutcome: outcome,
    platform,
    install,
  };
}
