/**
 * lib/useDPadNavigation.ts — эмуляция D-pad навигации с пульта.
 *
 * На Android TV / Smart TV пульт шлёт стрелки (ArrowUp/Down/Left/Right) и Enter.
 * Браузеры ТВ частично сами переводят стрелки в Tab, но для надёжности:
 *  - перехватываем стрелки и перемещаем фокус между интерактивными элементами
 *    по геометрическому принципу (ближайший элемент в направлении нажатия);
 *  - Backspace/Esc — выход из PiP / полноэкранного режима (обрабатывается в UI).
 */

'use client';

import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function center(r: Rect) {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

/**
 * Ищем ближайший фокусируемый элемент в направлении direction от текущего.
 */
function findNext(current: HTMLElement, direction: 'up' | 'down' | 'left' | 'right'): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el !== current && el.offsetParent !== null && !el.hasAttribute('data-dpad-skip'),
  );
  if (all.length === 0) return null;

  const cur = getRect(current);
  const curC = center(cur);

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of all) {
    const r = getRect(el);
    const c = center(r);

    // Элемент должен лежать в нужном полуплоскости
    const inDirection =
      direction === 'up' ? c.cy < cur.y - 4 :
      direction === 'down' ? c.cy > cur.y + cur.h + 4 :
      direction === 'left' ? c.cx < cur.x - 4 :
      c.cx > cur.x + cur.w + 4;

    if (!inDirection) continue;

    const dx = c.cx - curC.cx;
    const dy = c.cy - curC.cy;

    // Основной ход vs перпендикулярное смещение (взвешиваем перпендикуляр ×2)
    const primary = direction === 'up' || direction === 'down' ? Math.abs(dy) : Math.abs(dx);
    const cross = direction === 'up' || direction === 'down' ? Math.abs(dx) : Math.abs(dy);
    const score = primary + cross * 2;

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

export function useDPadNavigation(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };

      // Пропускаем управление внутри iframe (стриминг сам обрабатывает пульт)
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === 'IFRAME') return;

      const direction = dirMap[e.key];
      if (!direction) return;

      // Если фокуса нет вообще — ставим на первый элемент
      if (!active || active === document.body) {
        const first = document.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (first) {
          e.preventDefault();
          first.focus();
        }
        return;
      }

      const next = findNext(active, direction);
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      } else {
        // Нет элемента в этом направлении — предотвращаем скролл страницы стрелками
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
