'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'default';
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

  const clearSelection = () => setSelectedCourseIds([]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    const result = await getAdminCourses({
      page,
      limit: 10,
      search: search || undefined,
      status: statusFilter || undefined,
    });
    if (result.success && result.data) {
      setCourses(result.data.courses);
      setPagination(result.data.pagination);
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    clearSelection();
  }, [page, search, statusFilter]);

  function toggleCourseSelection(courseId: string) {
    setSelectedCourseIds((current) =>
      current.includes(courseId) ? current.filter((id) => id !== courseId) : [...current, courseId],
    );
  }

  function toggleSelectAll() {
    if (selectedCourseIds.length === courses.length) {
      clearSelection();
      return;
    }
    setSelectedCourseIds(courses.map((course) => course.id));
  }

  function handleStatusChange(
    courseId: string,
    nextStatus: string,
    courseTitle: string,
    flow: 'approve' | 'archive' | 'reopen' = nextStatus === 'ARCHIVED' ? 'archive' : 'approve',
  ) {
    const meta =
      flow === 'archive'
        ? { title: 'Lưu trữ khóa học', verb: 'lưu trữ', variant: 'danger' as const, confirmLabel: 'Lưu trữ' }
        : flow === 'reopen'
          ? { title: 'Mở lại khóa học', verb: 'mở lại', variant: 'default' as const, confirmLabel: 'Mở lại' }
          : { title: 'Duyệt xuất bản khóa học', verb: 'duyệt xuất bản', variant: 'default' as const, confirmLabel: 'Duyệt' };

    setConfirmDialog({
      isOpen: true,
      title: meta.title,
      message: `Bạn có chắc muốn ${meta.verb} khóa học "${courseTitle}"?`,
      variant: meta.variant,
      confirmLabel: meta.confirmLabel,
      onConfirm: async () => {
        const result = await updateAdminCourseStatus(courseId, nextStatus);
        if (result.success) void fetchCourses();
      },
    });
  }

  function handleBulkAction(nextStatus: 'PUBLISHED' | 'ARCHIVED', actionLabel: string) {
    if (selectedCourseIds.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: nextStatus === 'PUBLISHED' ? 'Duyệt nhiều khóa học' : 'Lưu trữ nhiều khóa học',
      message: `Bạn có chắc muốn ${actionLabel} ${selectedCourseIds.length} khóa học đã chọn?`,
      variant: nextStatus === 'ARCHIVED' ? 'danger' : 'default',
      confirmLabel: nextStatus === 'ARCHIVED' ? 'Lưu trữ' : 'Duyệt',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          await Promise.all(selectedCourseIds.map((courseId) => updateAdminCourseStatus(courseId, nextStatus)));
          clearSelection();
          await fetchCourses();
        } finally {
          setBulkLoading(false);
        }
      },
    });
  }

  function formatPrice(price: number | null | undefined) {
    if (!price || price === 0) return 'Miễn phí';
    return `${price.toLocaleString('vi-VN')} đ`;
  }

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <h1 className="workspace-page-title">Quản lý khóa học</h1>
        <p className="workspace-page-description">
          Duyệt, kiểm duyệt và quản lý trạng thái tất cả khóa học trên hệ thống.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg">Danh sách khóa học</CardTitle>
            {selectedCourseIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Đã chọn {selectedCourseIds.length}</span>
                <Button size="sm" variant="outline" className="text-xs" disabled={bulkLoading} onClick={() => handleBulkAction('PUBLISHED', 'duyệt')}>
                  Duyệt đã chọn
                </Button>
                <Button size="sm" variant="destructive" className="text-xs" disabled={bulkLoading} onClick={() => handleBulkAction('ARCHIVED', 'lưu trữ')}>
                  Lưu trữ đã chọn
                </Button>
                <Button size="sm" variant="ghost" className="text-xs" onClick={clearSelection}>
                  Bỏ chọn
                </Button>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Tìm theo tên khóa học..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="PUBLISHED">Đã xuất bản</option>
              <option value="ARCHIVED">Đã lưu trữ</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy khóa học nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">
                      <input
                        type="checkbox"
                        checked={courses.length > 0 && selectedCourseIds.length === courses.length}
                        onChange={toggleSelectAll}
                        aria-label="Chọn tất cả khóa học"
                      />
                    </th>
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
                  {courses.map((course) => (
                    <tr key={course.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4 align-top">
                        <input
                          type="checkbox"
                          checked={selectedCourseIds.includes(course.id)}
                          onChange={() => toggleCourseSelection(course.id)}
                          aria-label={`Chọn khóa học ${course.title}`}
                        />
                      </td>
                      <td className="max-w-50 truncate py-3 pr-4 font-medium">{course.title}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{typeof course.category === 'string' ? course.category : course.category?.name ?? '-'}</td>
                      <td className="py-3 pr-4"><StatusBadge status={course.status || 'DRAFT'} /></td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatPrice(course.price)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{course._count?.enrollments ?? course.enrollmentCount ?? 0}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{new Date(course.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {course.status === 'DRAFT' && (
                            <Button size="sm" className="text-xs" onClick={() => handleStatusChange(course.id, 'PUBLISHED', course.title, 'approve')}>
                              Duyệt
                            </Button>
                          )}
                          {course.status === 'ARCHIVED' && (
                            <Button size="sm" className="text-xs" onClick={() => handleStatusChange(course.id, 'PUBLISHED', course.title, 'reopen')}>
                              Mở lại
                            </Button>
                          )}
                          {course.status !== 'ARCHIVED' && (
                            <Button variant="destructive" size="sm" className="text-xs" onClick={() => handleStatusChange(course.id, 'ARCHIVED', course.title, 'archive')}>
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
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  <ChevronLeft className="size-4" /> Trước
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
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
        onConfirm={async () => {
          await confirmDialog.onConfirm();
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
      />
    </div>
  );
}


