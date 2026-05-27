import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface AdminStatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}

const toneClass = {
  default: 'border-white/60 bg-white/50',
  warning: 'border-amber-200 bg-amber-50/30',
  danger: 'border-red-200 bg-red-50/30',
  success: 'border-emerald-200 bg-emerald-50/30',
};

const iconClass = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  success: 'bg-emerald-100 text-emerald-700',
};

export function AdminStatCard({ label, value, hint, icon, tone = 'default' }: AdminStatCardProps) {
  return (
    <Card className={`rounded-xl shadow-sm ${toneClass[tone]}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClass[tone]}`}>{icon}</div>}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
