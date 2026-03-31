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
      <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3.5 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300">
        <CheckCircle2 className="w-5 h-5 text-green-700 mr-2" />
        <p className="text-sm font-bold text-green-700">{message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 flex items-start gap-3 animate-in fade-in zoom-in-95 duration-300">
      <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
      <p className="text-sm font-semibold text-destructive">{message}</p>
    </div>
  );
}