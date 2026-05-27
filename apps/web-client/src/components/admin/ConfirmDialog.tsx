'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  loadingLabel?: string;
  loading?: boolean;
  variant?: 'danger' | 'default';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  loadingLabel = 'Đang xử lý...',
  loading = false,
  variant = 'default',
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const busy = loading || pending;

  useEffect(() => {
    if (!isOpen || busy) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (!busy && event.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-white/60 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {variant === 'danger' && (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
            )}
            <h3 className="text-lg font-bold">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            disabled={busy}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setPending(false);
              }
            }}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {loadingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
