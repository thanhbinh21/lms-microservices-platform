'use client';

const statusColorMap: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  PAID: 'bg-cyan-100 text-cyan-700',
  BANNED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-red-100 text-red-700',
  IGNORED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  DRAFT: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-amber-100 text-amber-700',
  RETRIED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  OPEN: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-zinc-100 text-zinc-700',
  INSTRUCTOR: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-violet-100 text-violet-700',
  STUDENT: 'bg-zinc-100 text-zinc-700',
};

const statusLabelMap: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  BANNED: 'Bị cấm',
  SUSPENDED: 'Tạm khóa',
  STUDENT: 'Học viên',
  INSTRUCTOR: 'Giảng viên',
  ADMIN: 'Admin',
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Lưu trữ',
  PENDING: 'Chờ xử lý',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  PAID: 'Đã chi trả',
  RETRIED: 'Đã thử lại',
  RESOLVED: 'Đã xử lý',
  IGNORED: 'Bỏ qua',
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  CLOSED: 'Đã đóng',
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase();
  const color = statusColorMap[normalized] || 'bg-zinc-100 text-zinc-700';
  const label = statusLabelMap[normalized] || status || '-';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}
