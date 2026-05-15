'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

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
  toastListeners.forEach((l) => l(item));
}

const TOAST_DURATION = 4000;

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />;
    case 'error':
      return <XCircle className="size-5 text-red-500 shrink-0" />;
    case 'info':
      return <Info className="size-5 text-blue-500 shrink-0" />;
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
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{item.title}</p>
        {item.message && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{item.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="shrink-0 rounded-lg p-1 hover:bg-black/5 transition-colors text-muted-foreground"
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
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Thông báo"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItemComponent item={t} onRemove={removeToast} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
