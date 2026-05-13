'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { getQaCountAction } from '@/app/actions/qa';

export function QaNavItem() {
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    void loadCount();
  }, []);

  const loadCount = async () => {
    const res = await getQaCountAction();
    if (res.success && res.data) {
      setCount(res.data.unansweredCount);
    }
  };

  return (
    <Link href="/instructor/qa">
      <div
        className="relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all hover:border-white/30 hover:bg-white/30"
      >
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/5">
          <MessageSquare className="size-4" />
          {mounted && count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold">Q&A</span>
          <span className="mt-0.5 block text-[11px] font-normal leading-tight text-muted-foreground">Trả lời câu hỏi học viên</span>
        </span>
      </div>
    </Link>
  );
}
