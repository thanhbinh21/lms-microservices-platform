'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { getAdminCourses, updateAdminCourseStatus } from '@/app/actions/admin';

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'default';
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const res = await getAdminCourses({
      page,
      limit: 10,
      search: search || undefined,
      status: statusFilter || undefined,
    });
    if (res.success && res.data) {
      setCourses(res.data.courses);
      setPagination(res.data.pagination);
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleStatusChange = (
    courseId: string,
    newStatus: string,
    courseTitle: string,
    flow: 'approve' | 'archive' | 'reopen' = newStatus === 'ARCHIVED' ? 'archive' : 'approve',
  ) => {
    const meta =
      flow === 'archive'
        ? { title: 'Lưu trữ khóa học', messageVerb: 'lưu trữ', variant: 'danger' as const, confirmLabel: 'Lưu trữ' }
        : flow === 'reopen'
          ? {
              title: 'Mở lại khóa học',
              messageVerb: 'đưa trở lại trạng thái Xuất bản (đã lưu trữ trước đó)',
              variant: 'default' as const,
              confirmLabel: 'Mở lại',
            }
          : {
              title: 'Duyệt xuất bản khóa học',
              messageVerb: 'duyệt xuất bản',
              variant: 'default' as const,
              confirmLabel: 'Duyệt',
            };

    setConfirmDialog({
      isOpen: true,
      title: meta.title,
      message: `Bạn có chắc muốn ${meta.messageVerb} khóa học "${courseTitle}"?`,
      variant: meta.variant,
      confirmLabel: meta.confirmLabel,
      onConfirm: async () => {
        const res = await updateAdminCourseStatus(courseId, newStatus);
        if (res.success) fetchCourses();
      },
    });
  };

  const formatPrice = (price: number | null | undefined) => {
    if (!price || price === 0) return 'Miễn phí';
    return price.toLocaleString('vi-VN') + ' ₫';
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý khóa học</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Duyệt, kiểm duyệt và quản lý trạng thái tất cả khóa học trên hệ thống.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách khóa học</CardTitle>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên khóa học..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy khóa học nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Tiêu đề</th>
                    <th className="pb-3 pr-4">Danh mục</th>
                    <th className="pb-3 pr-4">Trạng thái</th>
                    <th className="pb-3 pr-4">Giá</th>
                    <th className="pb-3 pr-4">Ghi danh</th>
                    <th className="pb-3 pr-4">Ngày tạo</th>
                    <th className="pb-3">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="max-w-50 truncate py-3 pr-4 font-medium">{c.title}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{c.category || '—'}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={c.status || 'DRAFT'} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatPrice(c.price)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{c._count?.enrollments ?? c.enrollmentCount ?? 0}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {c.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              className="text-xs"
                              onClick={() => handleStatusChange(c.id, 'PUBLISHED', c.title, 'approve')}
                            >
                              Duyệt
                            </Button>
                          )}
                          {c.status === 'ARCHIVED' && (
                            <Button
                              size="sm"
                              className="text-xs"
                              onClick={() => handleStatusChange(c.id, 'PUBLISHED', c.title, 'reopen')}
                            >
                              Mở lại
                            </Button>
                          )}
                          {c.status !== 'ARCHIVED' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleStatusChange(c.id, 'ARCHIVED', c.title, 'archive')}
                            >
                              Lưu trữ
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {pagination.page} / {pagination.totalPages} ({pagination.total} kết quả)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" /> Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
      />
    </div>
  );
}
