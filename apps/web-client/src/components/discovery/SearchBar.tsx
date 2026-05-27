'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') || '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setValue(searchParams.get('q') || ''), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const pushSearch = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const normalized = query.trim();
      if (normalized) params.set('q', normalized);
      else params.delete('q');
      params.delete('page');
      router.push(`/courses?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => pushSearch(nextValue), 450);
  };

  return (
    <div className="flex w-full max-w-2xl items-center rounded-2xl border border-white/80 bg-white/70 p-2 shadow-xl shadow-primary/5 backdrop-blur-md focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
      <Search className="ml-2 size-5 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (timerRef.current) clearTimeout(timerRef.current);
            pushSearch(value);
          }
        }}
        placeholder="Tìm khóa học, kỹ năng hoặc công nghệ..."
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-medium outline-none placeholder:text-muted-foreground"
        aria-label="Tìm kiếm khóa học"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-xl"
          aria-label="Xóa từ khóa"
          onClick={() => {
            setValue('');
            pushSearch('');
          }}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
