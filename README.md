# 📺 StreamLive Native Web App

**Первое нативное PWA-приложение для стриминга с трёх зеркал — на телевизор, телефон и компьютер — без установки APK, без браузерных панелей, с управлением с пульта.**

[![License: MIT](https://img.shields.io/badge/License-MIT-fe2c55.svg)](LICENSE)
[![Next.js 14](https://img.shields.io/badge/Next.js-14%20App%20Router-00f2ea)](https://nextjs.org)
[![PWA Ready](https://img.shields.io/badge/PWA-Standalone-00f2ea)](#-pwa--установка-как-нативное-приложение)
[![TV Optimized](https://img.shields.io/badge/UI-TV%20D--pad%20Ready-fe2c55)](#-tv-оптимизированный-ui)

---

## 💡 Концепция

Это **не просто сайт**. Это PWA-оболочка, которая:

1. **Устанавливается как отдельное нативное приложение** — с иконкой на рабочем столе ТВ или телефона (через `beforeinstallprompt` + Web App Manifest).
2. **Убирает интерфейс браузера** — режим `display: standalone`: нет адресной строки, вкладок и панелей. Выглядит и ведёт себя как TV-приложение.
3. **Даёт удобный пульт-управляемый интерфейс** — все элементы подсвечиваются неоновой обводкой при фокусе со стрелок D-pad, навигация геометрическая (как в Android TV Launcher).
4. **Объединяет три зеркала** в одном плеере с переключением в один клик пульта:

   | # | Домен | Кнопка в интерфейсе |
   |---|-------|---------------------|
   | 1 | `domtv.blyz.ru` | DomTV |
   | 2 | `streamlivetv.freedev.app` | StreamLive TV |
   | 3 | `streamliveru.web1337.net` | StreamLive RU |

5. **Работает на 100% клиенте.** Никаких серверных баз данных, аккаунтов и API. Выбранное зеркало хранится в `localStorage`, оболочка — в кеше Service Worker. Сломать сервер, которого не существует, невозможно — отсюда 100% стабильность и нулевые потери данных.

### Что умеет приложение (`/app`)

- 🔀 **Переключатель трёх источников** в верхней панели;
- 🖼 **Picture-in-Picture**: сначала пробуем нативный **Document Picture-in-Picture API** (Chrome 116+), при недоступности включается **режим-имитация** — плавающий фрейм в углу экрана (работает везде);
- ⛶ **Fullscreen API** — картинка на весь телевизор;
- ↻ **Reload источника** и индикатор «LIVE»;
- 🎮 **D-pad navigation**: стрелки пульта перемещают фокус между кнопками по ближайшему соседу, `Enter` = ОК, `Backspace/Esc` = выход из PiP/полного экрана;
- 📴 **Офлайн-оболочка**: next-pwa / Workbox кеширует UI, поэтому даже при аварии сети открывается само приложение с выбором рабочего зеркала.

---



---

## 🧱 Технологии

- **Next.js 14 (App Router)** — файловая маршрутизация, `/` лендинг, `/app` плеер;
- **next-pwa (Workbox)** — автогенерация `sw.js`, precache ассетов, standalone-офлайн;
- **TypeScript** — строгая типизация (`strict: true`);
- **Tailwind CSS** — дизайн-система на CSS-переменных;
- **Lucide React** — иконки.

Палитра «Zoomer 2026»: фон `#000000`, акценты `#00f2ea` (cyan) и `#fe2c55` (pink). Базовый кегль увеличен до 18–21px для чтения с дивана.

---

## 🚀 Быстрый старт

```bash
git clone https://github.com/streamlive/streamlive-native-web-app.git
cd streamlive-native-web-app
npm install
npm run dev        # http://localhost:3000
```

Продакшен-сборка (генерирует service worker и регистрирует его):

```bash
npm run build
npm start
```

> ⚠️ В development-режиме (`next dev`) Service Worker **отключён** (стандартное поведение next-pwa). Проверяйте установку PWA только на production-сборке по **HTTPS** (или localhost).

---

## 📲 PWA: установка как «нативное» приложение

Манифест — [`public/manifest.json`](public/manifest.json):

```json
{
  "name": "StreamLive TV",
  "short_name": "StreamLive",
  "start_url": "/app",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000"
}
```

- **Android / Android TV / Desktop Chrome, Edge, Opera, Яндекс.** — большая кнопка **«📲 Установить приложение»** вызывает `BeforeInstallPromptEvent.prompt()`. После установки приложение запускается из иконки в standalone-режиме.
- **iPhone / iPad** — Safari → «Поделиться» → «На экран „Домой“» (на лендинге есть пошаговая инструкция и автоопределение платформы).
- Иконки — SVG-заглушки `public/icons/icon-192.svg` / `icon-512.svg` (+ maskable). Для Google Play/TV можно перегенерировать в PNG через любой конвертер.

---

## 🎮 TV-оптимизированный UI

Ключевой файл — [`styles/globals.css`](styles/globals.css):

```css
button:focus-visible,
a:focus-visible,
[tabindex]:focus-visible {
  outline: 3px solid #00f2ea;   /* яркая обводка — видно с дивана */
  outline-offset: 4px;
  transform: scale(1.05);       /* лёгкое увеличение выбранного элемента */
  box-shadow: 0 0 28px rgba(0, 242, 234, 0.55);
}
```

- Используем **`:focus-visible`** — кольцо появляется только при навигации с пульта/клавиатуры и не мешает мышью/тачем;
- Геометрический D-pad-движок [`lib/useDPadNavigation.ts`](lib/useDPadNavigation.ts) сам ищет ближайший элемент в направлении стрелки;
- Крупные шрифты (base 18–21px), высокий контраст, `aria-*` атрибуты, поддержка `prefers-reduced-motion`.

---

## ☁️ Деплой

Приложение статическое/классический Next.js — **проблем с деплоем не будет нигде**. Нужен лишь HTTPS (требование PWA).

### Tatnet.ru (статический хостинг)

```bash
# в next.config.js раскомментируйте: output: 'export'
npm run build          # затем npx next export → папка out/
# залейте содержимое out/ по FTP/SFTP в корень сайта Tatnet
```

Manifest, `sw.js` и иконки лежат в `out/` — всё работает как обычный статический сайт.

### Render.com (Onrender)

1. New → **Web Service** → подключите GitHub-репозиторий;
2. Runtime: **Node**, Build command: `npm install && npm run build`, Start command: `npm start`;
3. Render автоматически выдаёт HTTPS-домен → PWA устанавливается сразу.

### Layer0

```bash
npm i -g @layer0/cli
layer0 init --nextjs
layer0 deploy
```

Layer0 проксирует Next.js-сервер и добавляет свой CDN; next-pwa продолжает обслуживать `sw.js`.

### Vercel (для справки)

```bash
npx vercel --prod
```

---

## 🗂 Структура репозитория

```
├── app/
│   ├── layout.tsx          # Metadata: manifest, appleWebApp, theme-color
│   ├── page.tsx            # Лендинг: hero, кнопка установки, зеркала, инструкция, FAQ
│   └── app/
│       └── page.tsx        # Страница приложения (start_url="/app")
├── components/
│   ├── AppPlayer.tsx       # Верхняя панель + iframe + PiP + Fullscreen
│   ├── InstallButton.tsx   # beforeinstallprompt + iOS-инструкция
│   ├── InstallSteps.tsx    # Пошаговые табы: Android TV / iPhone / ПК
│   └── Faq.tsx             # Аккордеон FAQ (D-pad friendly)
├── lib/
│   ├── sources.ts          # Реестр трёх зеркал
│   ├── usePWAInstall.ts    # Хук установки PWA + определение платформы
│   └── useDPadNavigation.ts# Геометрическая навигация стрелками пульта
├── public/
│   ├── manifest.json       # Standalone-манифест
│   └── icons/              # SVG-иконки 192/512/maskable
├── styles/globals.css      # :focus-visible TV-стили, палитра, PiP-оверлей
├── next.config.js          # withPWA (Workbox) + headers
└── tailwind.config.js
```

---

## ❓ FAQ (коротко)

- **Как установить на Android TV?** Меню браузера → «Добавить на главный экран». Подробности — на лендинге.
- **Как установить на iPhone?** Safari → Поделиться → На экран «Домой».
- **Что такое Picture-in-Picture?** Окно «картинка в картинке» поверх всего. Мы используем Document PiP API, а где его нет — плавающий фрейм-имитацию.
- **Нужна ли база данных?** Нет. Всё на клиенте: localStorage + Service Worker cache.

---

## 🤝 Вклад

Форкните, создайте PR. Идеи приветствуются: новые зеркала (реестр в `lib/sources.ts` — одна строка), темплейты под Samsung Tizen / LG webOS, интеграция с пультами HDMI-CEC.

1. `npm install && npm run dev`
2. Добавьте зеркало в `SOURCES` или улучшите D-pad-движок;
3. Откройте Pull Request с описанием и (если меняли UI) скриншотом.

## ⚖️ Лицензия

[MIT](LICENSE) © 2026 StreamLive Community

> Проект — открытая **оболочка** для уже публично доступных сайтов. Мы не хостим и не передаём контент; ответственность за использование зеркалов лежит на пользователе.
