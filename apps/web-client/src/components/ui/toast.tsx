'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

let toastListeners: ((toast: ToastItem) => void)[] = [];

export function toast(type: ToastType, title: string, message?: string) {
  const item: ToastItem = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
  };
  toastListeners.forEach((listener) => listener(item));
}

const TOAST_DURATION = 4000;

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />;
    case 'error':
      return <XCircle className="size-5 shrink-0 text-red-500" />;
    case 'info':
      return <Info className="size-5 shrink-0 text-blue-500" />;
  }
}

function ToastItemComponent({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(item.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [item.id, onRemove]);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg animate-in slide-in-from-top-2 fade-in duration-300 ${
        item.type === 'success'
          ? 'border-emerald-200 bg-emerald-50'
          : item.type === 'error'
            ? 'border-red-200 bg-red-50'
            : 'border-blue-200 bg-blue-50'
      }`}
    >
      <ToastIcon type={item.type} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        {item.message && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-black/5"
        aria-label="Đóng thông báo"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const listener = (item: ToastItem) => {
      setToasts((prev) => [...prev.slice(-4), item]);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((current) => current !== listener);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toastItem) => toastItem.id !== id));
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Thông báo"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toastItem) => (
        <div key={toastItem.id} className="pointer-events-auto">
          <ToastItemComponent item={toastItem} onRemove={removeToast} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
