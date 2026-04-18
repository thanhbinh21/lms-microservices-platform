'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') || '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(searchParams.get('q') || '');
  }, [searchParams]);

  const pushSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q.trim()) {
        params.set('q', q.trim());
      } else {
        params.delete('q');
      }
      params.delete('page');
      router.push(`/courses?${params.toString()}`);
    },
    [router, searchParams],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => pushSearch(next), 400);
  };

  const handleClear = () => {
    setValue('');
    pushSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current);
      pushSearch(value);
    }
  };

  return (
    <div className="w-full max-w-2xl flex items-center bg-white/60 backdrop-blur-md border border-white/80 rounded-full p-2 shadow-xl shadow-primary/5 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all">
      <Search className="w-5 h-5 text-muted-foreground ml-3 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Tìm kiếm khoá học (VD: React, Node.js, Kubernetes...)"
        className="flex-1 bg-transparent border-none outline-none px-4 text-base font-medium placeholder:text-muted-foreground"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="p-2 hover:bg-muted rounded-full transition-colors mr-1"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
