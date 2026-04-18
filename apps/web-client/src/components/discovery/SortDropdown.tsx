'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpDown,
  ChevronDown,
  Check,
  Clock,
  Flame,
  Star,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất', icon: Clock },
  { value: 'popular', label: 'Phổ biến nhất', icon: Flame },
  { value: 'rating', label: 'Đánh giá cao', icon: Star },
  { value: 'price_asc', label: 'Giá tăng dần', icon: TrendingUp },
  { value: 'price_desc', label: 'Giá giảm dần', icon: TrendingDown },
] as const;

export function SortDropdown() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('sortBy') || 'newest';
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOpt = SORT_OPTIONS.find((o) => o.value === current) || SORT_OPTIONS[0];

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const select = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'newest') {
      params.delete('sortBy');
    } else {
      params.set('sortBy', value);
    }
    params.delete('page');
    router.push(`/courses?${params.toString()}`);
    setOpen(false);
  };

  const SelectedIcon = selectedOpt.icon;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all border ${
          open
            ? 'border-primary/50 ring-2 ring-primary/20 bg-white shadow-lg shadow-primary/5'
            : 'border-white/80 bg-white/60 backdrop-blur-md hover:border-primary/30 hover:bg-white/90'
        }`}
      >
        <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
        <SelectedIcon className="w-3.5 h-3.5 opacity-60 shrink-0" />
        <span>{selectedOpt.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-white/80 bg-white shadow-2xl shadow-black/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-1.5">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = current === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => select(opt.value)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted/70 text-foreground'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'opacity-50'}`}
                  />
                  <span className="flex-1 text-left">{opt.label}</span>
                  {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
