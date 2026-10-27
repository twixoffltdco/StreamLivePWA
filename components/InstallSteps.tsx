/**
 * components/InstallSteps.tsx — подробная инструкция добавления ярлыка
 * на главный экран для Android TV, iPhone и десктопа.
 */

'use client';

import { Tv, Smartphone, MonitorSmartphone, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

type Tab = 'tv' | 'ios' | 'desktop';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'tv', label: 'Android TV / Google TV', icon: <Tv size={24} aria-hidden /> },
  { id: 'ios', label: 'iPhone / iPad', icon: <Smartphone size={24} aria-hidden /> },
  { id: 'desktop', label: 'ПК / Ноутбук', icon: <MonitorSmartphone size={24} aria-hidden /> },
];

const STEPS: Record<Tab, { title: string; details: string }[]> = {
  tv: [
    {
      title: 'Откройте браузер на телевизоре',
      details:
        'На Android TV / Google TV откройте «Интернет-браузер» (или Chrome/CX Explorer) и перейдите на адрес этого лендинга.',
    },
    {
      title: 'Перейдите в меню браузера',
      details:
        'С пульта нажмите кнопку «Меню» (≡ или ⋮) в верхней панели браузера либо кнопку с тремя точками на экране.',
    },
    {
      title: 'Выберите «Добавить на главный экран»',
      details:
        'Пункт может называться «Установить приложение», «Add to Home screen» или «Send to Remote». Подтвердите выбор кнопкой OK на пульте.',
    },
    {
      title: 'Запустите с главного экрана',
      details:
        'Иконка StreamLive появится в ряду приложений ТВ рядом с Netflix и IPTV-плеерами. Приложение стартует в standalone-режиме — без адресной строки, как нативное.',
    },
  ],
  ios: [
    {
      title: 'Откройте сайт в Safari',
      details:
        'Важно: только Safari поддерживает установку PWA на iOS. В Chrome/Firefox на iPhone пункт «На экран Домой» отсутствует.',
    },
    {
      title: 'Нажмите «Поделиться»',
      details: 'Кнопка ⬆︎ находится в нижней панели Safari (рядом с адресной строкой).',
    },
    {
      title: 'Прокрутите до «На экран Домой»',
      details:
        'В списке действий прокрутите вниз и выберите «Добавить на экран „Домой“» (Add to Home Screen), затем «Добавить».',
    },
    {
      title: 'Готово — запускайте как приложение',
      details:
        'На рабочем столе появится иконка StreamLive. При запуске интерфейс браузера скрыт, работает PiP и полноэкранный режим.',
    },
  ],
  desktop: [
    {
      title: 'Откройте сайт в Chrome / Edge / Яндекс.Браузере',
      details: 'Brave и Opera тоже поддерживают установку PWA.',
    },
    {
      title: 'Нажмите иконку установки в адресной строке',
      details:
        'Справа в адресной строке появится значок монитора со стрелкой ⤓ («Установить это приложение»). Либо используйте меню ⋮ → «Приложения» → «Установить этот сайт как приложение». Ещё проще — большая кнопка «📲 Установить приложение» выше.',
    },
    {
      title: 'Подтвердите установку',
      details:
        'Приложение откроется в отдельном окне без вкладок и адресной строки, а его иконка появится на рабочем столе и в меню «Пуск».',
    },
  ],
};

export default function InstallSteps() {
  const [tab, setTab] = useState<Tab>('tv');

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Переключатель платформ */}
      <div role="tablist" aria-label="Платформа" className="mb-8 flex flex-wrap justify-center gap-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            data-active={tab === t.id ? 'true' : 'false'}
            className="sl-source-btn inline-flex items-center gap-2"
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Шаги */}
      <ol className="space-y-5">
        {STEPS[tab].map((step, i) => (
          <li key={`${tab}-${i}`} className="sl-card flex gap-5 p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#00f2ea] to-[#fe2c55] text-xl font-black text-black">
              {i + 1}
            </span>
            <div>
              <h4 className="mb-1 flex items-center gap-2 text-xl font-extrabold">
                <CheckCircle2 size={22} className="text-[#00f2ea]" aria-hidden />
                {step.title}
              </h4>
              <p className="text-lg leading-relaxed text-zinc-400">{step.details}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
