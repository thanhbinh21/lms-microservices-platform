'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';

type StatusMessageProps = {
  type: 'error' | 'success';
  message: string;
};

export function StatusMessage({ type, message }: StatusMessageProps) {
  if (!message) return null;

  if (type === 'success') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3.5 text-primary shadow-sm animate-in fade-in zoom-in-95 duration-300">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <p className="text-sm font-semibold">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5 text-destructive shadow-sm animate-in fade-in zoom-in-95 duration-300">
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      <p className="text-sm font-semibold text-destructive">{message}</p>
    </div>
  );
}