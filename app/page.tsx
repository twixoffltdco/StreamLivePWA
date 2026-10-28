/**
 * app/page.tsx — лендинг StreamLive PWA.
 * Zoomer 2026: чёрный фон, неон #00f2ea / #fe2c55, крупные шрифты, D-pad friendly.
 */

import Link from 'next/link';
import {
  Tv,
  Smartphone,
  PictureInPicture2,
  Maximize,
  Gamepad2,
  WifiOff,
  ArrowRight,
  Radio,
} from 'lucide-react';
import InstallButton from '@/components/InstallButton';
import Faq from '@/components/Faq';
import InstallSteps from '@/components/InstallSteps';
import { SOURCES } from '@/lib/sources';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-zinc-100">
      {/* Неоновый градиентный фон */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60% 40% at 15% 0%, rgba(0,242,234,0.22) 0%, transparent 60%), radial-gradient(55% 45% at 90% 15%, rgba(254,44,85,0.20) 0%, transparent 60%)',
        }}
      />

      {/* ================= HEADER ================= */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="sl-focus flex items-center gap-3 rounded-xl">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#00f2ea] to-[#fe2c55]">
            <Tv size={24} className="text-black" aria-hidden />
          </span>
          <span className="text-2xl font-black tracking-tight">
            Stream<span className="sl-gradient-text">Live</span>
          </span>
        </Link>
        <nav aria-label="Навигация" className="flex items-center gap-3">
          <Link
            href="/app"
            className="sl-focus hidden rounded-xl border border-white/15 bg-[#15151c] px-5 py-3 text-base font-bold text-zinc-200 hover:border-[#00f2ea]/60 sm:block"
          >
            ▶ Открыть приложение
          </Link>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-16 text-center sm:pt-24">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00f2ea]/40 bg-[#00f2ea]/10 px-5 py-2 text-sm font-bold uppercase tracking-widest text-[#00f2ea]">
          <Radio size={16} className="animate-live" aria-hidden /> Open Source · PWA · Smart TV Ready
        </p>

        <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
          StreamLive{' '}
          <span className="sl-gradient-text">PWA</span>
        </h1>

        <p className="mt-8 max-w-3xl text-xl leading-relaxed text-zinc-300 sm:text-2xl">
          PWA-каталог для{' '}
          <b className="text-white">domtv.blyz.ru</b>,{' '}
          <b className="text-white">streamlivetv.freedev.app</b> и{' '}
          <b className="text-white">streamliveru.web1337.net</b>.
        </p>

        <p className="mt-4 max-w-2xl text-lg text-zinc-400">
          Устанавливается как обычное приложение с иконкой на рабочем столе ТВ или телефона.
          Без адресной строки браузера. Управление стрелками пульта. PiP и полный экран.
        </p>

        {/* Кнопка установки */}
        <div className="mt-20 mb-10">
          <InstallButton />
        </div>

        <Link
          href="/app"
          className="sl-focus mt-10 inline-flex items-center gap-2 text-lg font-bold text-[#00f2ea] underline-offset-8 hover:underline"
        >
         Не устанавливать — смотреть в браузере <ArrowRight size={20} aria-hidden />
        </Link>
      </section>

      {/* ================= FEATURES ================= */}
      <section aria-labelledby="features-title" className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <h2 id="features-title" className="mb-12 text-center text-4xl font-black sm:text-5xl">
          Одна лента. <span className="sl-gradient-text">Три источника.</span>
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Gamepad2 className="text-[#00f2ea]" size={32} aria-hidden />}
            title="Управление с пульта (D-pad)"
            text="Все элементы получают яркую неоновую обводку при фокусе со стрелок пульта. Навигация — геометрическая, как в Android TV Launcher."
          />
          <FeatureCard
            icon={<Smartphone className="text-[#fe2c55]" size={32} aria-hidden />}
            title="Иконка на рабочем столе"
            text="beforeinstallprompt + manifest standalone: приложение ставится в один тап на Android, Android TV и десктопном Chrome."
          />
          <FeatureCard
            icon={<PictureInPicture2 className="text-[#00f2ea]" size={32} aria-hidden />}
            title="Picture-in-Picture"
            text="Document Picture-in-Picture API (Chrome 116+), а если недоступно — плавающее окно поверх интерфейса. Работает на любом зеркале."
          />
          <FeatureCard
            icon={<Maximize className="text-[#fe2c55]" size={32} aria-hidden />}
            title="Полноэкранный режим"
            text="Fullscreen API из коробки: картинка на весь телевизор без рамок, панелей и системных элементов."
          />
          <FeatureCard
            icon={<WifiOff className="text-[#00f2ea]" size={32} aria-hidden />}
            title="Service Worker & офлайн-оболочка"
            text="next-pwa кеширует интерфейс. Даже при проблемах с сетью вы увидите приложение и сможете выбрать рабочее зеркало."
          />
          <FeatureCard
            icon={<Radio className="text-[#fe2c55]" size={32} aria-hidden />}
            title="Три зеркала в один клик"
            text="Переключение между доменами — верхней панелью. Выбранное зеркало запоминается локально. Никаких баз данных — 100% клиент."
          />
        </div>
      </section>

      {/* ================= ЗЕРКАЛА ================= */}
      <section aria-labelledby="mirrors-title" className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <h2 id="mirrors-title" className="mb-10 text-center text-4xl font-black">
          Поддерживаемые <span className="sl-gradient-text">зеркала</span>
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {SOURCES.map((s, i) => (
            <li key={s.id} className="sl-card p-6 text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">{s.hint}</p>
              <p className="mt-2 break-all text-lg font-black text-[#00f2ea]">{s.domain}</p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="sl-focus mt-4 inline-block rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-zinc-300 hover:border-[#00f2ea]/60"
              >
                Проверить ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* ================= ИНСТРУКЦИЯ ================= */}
      <section aria-labelledby="howto-title" className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <h2 id="howto-title" className="mb-4 text-center text-4xl font-black sm:text-5xl">
          Как добавить <span className="sl-gradient-text">ярлык на главный экран</span>
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-lg text-zinc-400">
          Пошаговая инструкция для телевизора, iPhone и компьютера. Выберите платформу ниже.
        </p>
        <InstallSteps />
      </section>

      {/* ================= FAQ ================= */}
      <section aria-labelledby="faq-title" className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <h2 id="faq-title" className="mb-12 text-center text-4xl font-black sm:text-5xl">
          Частые <span className="sl-gradient-text">вопросы</span>
        </h2>
        <Faq
          items={[
            {
              q: 'Как установить на Android TV?',
              a: (
                <>
                  Откройте этот сайт в браузере телевизора (Android TV / Google TV). В меню браузера
                  выберите <b>«Добавить на главный экран»</b> или <b>«Установить приложение»</b> —
                  пункт появляется после первого визита, когда браузер зарегистрирует Service Worker.
                  Иконка StreamLive появится в ряду приложений ТВ рядом с Netflix. При запуске
                  приложение открывается в режиме <b>standalone</b>: без адресной строки, как нативное.
                  Все кнопки управляются стрелками пульта. Альтернатива: <b>AFTVnews Downloader</b>
                  или Shortcut Maker для Android TV — они создают нативный ярлык для любого URL.
                </>
              ),
            },
            {
              q: 'Как установить на iPhone?',
              a: (
                <>
                  На iOS установка PWA работает только через <b>Safari</b>. Откройте сайт, нажмите
                  кнопку <b>«Поделиться»</b> (⬆︎) в нижней панели и выберите{' '}
                  <b>«На экран „Домой“»</b>. Появится иконка StreamLive — при запуске интерфейс
                  браузера скрыт (<b>apple-web-app-capable</b>), доступен полноэкранный режим и PiP.
                  Firefox/Chrome на iPhone, к сожалению, такой возможности не дают — это ограничение Apple.
                </>
              ),
            },
            {
              q: 'Что такое Picture-in-Picture?',
              a: (
                <>
                  <b>Picture-in-Picture (PiP)</b> — режим «картинка в картинке»: трансляция продолжает
                  играть в маленьком плавающем окне поверх других приложений или страниц. StreamLive
                  использует современный <b>Document Picture-in-Picture API</b> (Chrome 116+) — настоящее
                  отдельное окно поверх всех. Если браузер его не поддерживает, включается режим-имитация:
                  плеер превращается в плавающий фрейм в углу экрана. Нажмите кнопку <b>PiP</b> в верхней
                  панели приложения <b>/app</b>, чтобы проверить.
                </>
              ),
            },
            {
              q: 'Нужен ли аккаунт или база данных?',
              a: (
                <>
                  Нет. Приложение полностью клиентское: никаких серверных баз, регистраций и cookies-трекинга.
                  Выбранное зеркало хранится в <b>localStorage</b>, интерфейс — в кеше Service Worker.
                  Это гарантирует 100% стабильность и отсутствие потерь данных: сломать сервер, который
                  не существует, невозможно.
                </>
              ),
            },
            {
              q: 'Почему три домена, а не один?',
              a: (
                <>
                  Стриминговые сервисы живут по нескольким зеркалам: одно может тормозить, другое —
                  уходить на профилактику. StreamLive держит все три (<b>domtv.blyz.ru</b>,{' '}
                  <b>streamlivetv.freedev.app</b>, <b>streamliveru.web1337.net</b>) на панели — переключение
                  происходит за один клик пульта, без перезапуска приложения.
                </>
              ),
            },
            {
              q: 'Это легально? Это open source?',
              a: (
                <>
                  Проект распространяется под лицензией <b>MIT</b> и является лишь оболочкой (PWA-клиентом),
                  которая отображает уже публично доступные сайты через iframe. Мы не хостим и не передаём
                  контент. Весь код открыт — форкайте, собирайте и деплойте своё зеркало оболочки.
                </>
              ),
            },
          ]}
        />
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="relative z-10 border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-center">
          <p className="text-lg font-bold">
            StreamLive PWA <span className="text-zinc-500">· MIT License · 2026</span>
          </p>
          <p className="max-w-2xl text-sm text-zinc-500">
            StreamLive PWA · Next.js 14 · TypeScript · Tailwind CSS. Для серверного каталога требуется хостинг с Node.js/Next.js runtime.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="sl-card p-7 transition hover:border-[#00f2ea]/40">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5">{icon}</div>
      <h3 className="mb-2 text-2xl font-extrabold">{title}</h3>
      <p className="text-lg leading-relaxed text-zinc-400">{text}</p>
    </article>
  );
}
