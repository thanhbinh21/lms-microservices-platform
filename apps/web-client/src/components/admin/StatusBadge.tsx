'use client';

const statusColorMap: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  BANNED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-red-100 text-red-700',
  IGNORED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  DRAFT: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-amber-100 text-amber-700',
  RETRIED: 'bg-blue-100 text-blue-700',
  INSTRUCTOR: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  STUDENT: 'bg-zinc-100 text-zinc-700',
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColorMap[status] || 'bg-zinc-100 text-zinc-700';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${color}`}>
      {status}
    </span>
  );
}
