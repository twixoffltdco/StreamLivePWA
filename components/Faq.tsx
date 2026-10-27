/**
 * components/Faq.tsx — аккордеон FAQ (открывается по Enter/клику, дружит с D-pad).
 */

'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

export default function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="sl-card overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="sl-focus flex w-full items-center justify-between gap-6 px-7 py-6 text-left text-xl font-bold sm:text-2xl"
            >
              <span className={isOpen ? 'text-[#00f2ea]' : ''}>{item.q}</span>
              <ChevronDown
                size={28}
                aria-hidden
                className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#fe2c55]' : 'text-zinc-500'}`}
              />
            </button>
            {isOpen && (
              <div className="border-t border-white/10 px-7 py-6 text-lg leading-relaxed text-zinc-300 [&_b]:text-white">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
