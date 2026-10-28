'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function WatchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[StreamLive watch page]', error); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-black p-6 text-white"><section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#101015] p-6 text-center"><AlertTriangle className="mx-auto mb-3 text-[#fe2c55]" size={36}/><h1 className="text-xl font-black">Не удалось загрузить страницу просмотра</h1><p className="mt-2 text-sm text-zinc-400">Ошибка интерфейса не должна оставлять белый экран. Попробуй перезагрузить страницу или вернуться в каталог.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={() => reset()} className="sl-focus inline-flex items-center gap-2 rounded-xl bg-[#00f2ea] px-5 py-3 font-bold text-black"><RefreshCw size={17}/>Повторить</button><Link href="/app" className="sl-focus rounded-xl border border-white/15 px-5 py-3 font-bold">Назад в каталог</Link></div>{error.digest && <p className="mt-4 text-xs text-zinc-600">Код ошибки: {error.digest}</p>}</section></main>;
}
