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
        ? { title: 'LÆ°u trá»¯ khÃ³a há»c', verb: 'lÆ°u trá»¯', variant: 'danger' as const, confirmLabel: 'LÆ°u trá»¯' }
        : flow === 'reopen'
          ? { title: 'Má»Ÿ láº¡i khÃ³a há»c', verb: 'má»Ÿ láº¡i', variant: 'default' as const, confirmLabel: 'Má»Ÿ láº¡i' }
          : { title: 'Duyá»‡t xuáº¥t báº£n khÃ³a há»c', verb: 'duyá»‡t xuáº¥t báº£n', variant: 'default' as const, confirmLabel: 'Duyá»‡t' };

    setConfirmDialog({
      isOpen: true,
      title: meta.title,
      message: `Báº¡n cÃ³ cháº¯c muá»‘n ${meta.verb} khÃ³a há»c "${courseTitle}"?`,
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
      title: nextStatus === 'PUBLISHED' ? 'Duyá»‡t nhiá»u khÃ³a há»c' : 'LÆ°u trá»¯ nhiá»u khÃ³a há»c',
      message: `Báº¡n cÃ³ cháº¯c muá»‘n ${actionLabel} ${selectedCourseIds.length} khÃ³a há»c Ä‘Ã£ chá»n?`,
      variant: nextStatus === 'ARCHIVED' ? 'danger' : 'default',
      confirmLabel: nextStatus === 'ARCHIVED' ? 'LÆ°u trá»¯' : 'Duyá»‡t',
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
    if (!price || price === 0) return 'Miá»…n phÃ­';
    return `${price.toLocaleString('vi-VN')} Ä‘`;
  }

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <h1 className="workspace-page-title">Quáº£n lÃ½ khÃ³a há»c</h1>
        <p className="workspace-page-description">
          Duyá»‡t, kiá»ƒm duyá»‡t vÃ  quáº£n lÃ½ tráº¡ng thÃ¡i táº¥t cáº£ khÃ³a há»c trÃªn há»‡ thá»‘ng.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg">Danh sÃ¡ch khÃ³a há»c</CardTitle>
            {selectedCourseIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">ÄÃ£ chá»n {selectedCourseIds.length}</span>
                <Button size="sm" variant="outline" className="text-xs" disabled={bulkLoading} onClick={() => handleBulkAction('PUBLISHED', 'duyá»‡t')}>
                  Duyá»‡t Ä‘Ã£ chá»n
                </Button>
                <Button size="sm" variant="destructive" className="text-xs" disabled={bulkLoading} onClick={() => handleBulkAction('ARCHIVED', 'lÆ°u trá»¯')}>
                  LÆ°u trá»¯ Ä‘Ã£ chá»n
                </Button>
                <Button size="sm" variant="ghost" className="text-xs" onClick={clearSelection}>
                  Bá» chá»n
                </Button>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="TÃ¬m theo tÃªn khÃ³a há»c..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
              <option value="DRAFT">Báº£n nhÃ¡p</option>
              <option value="PUBLISHED">ÄÃ£ xuáº¥t báº£n</option>
              <option value="ARCHIVED">ÄÃ£ lÆ°u trá»¯</option>
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
            <p className="py-8 text-center text-sm text-muted-foreground">KhÃ´ng tÃ¬m tháº¥y khÃ³a há»c nÃ o.</p>
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
                        aria-label="Chá»n táº¥t cáº£ khÃ³a há»c"
                      />
                    </th>
                    <th className="pb-3 pr-4">TiÃªu Ä‘á»</th>
                    <th className="pb-3 pr-4">Danh má»¥c</th>
                    <th className="pb-3 pr-4">Tráº¡ng thÃ¡i</th>
                    <th className="pb-3 pr-4">GiÃ¡</th>
                    <th className="pb-3 pr-4">Ghi danh</th>
                    <th className="pb-3 pr-4">NgÃ y táº¡o</th>
                    <th className="pb-3">HÃ nh Ä‘á»™ng</th>
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
                          aria-label={`Chá»n khÃ³a há»c ${course.title}`}
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
                              Duyá»‡t
                            </Button>
                          )}
                          {course.status === 'ARCHIVED' && (
                            <Button size="sm" className="text-xs" onClick={() => handleStatusChange(course.id, 'PUBLISHED', course.title, 'reopen')}>
                              Má»Ÿ láº¡i
                            </Button>
                          )}
                          {course.status !== 'ARCHIVED' && (
                            <Button variant="destructive" size="sm" className="text-xs" onClick={() => handleStatusChange(course.id, 'ARCHIVED', course.title, 'archive')}>
                              LÆ°u trá»¯
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
                Trang {pagination.page} / {pagination.totalPages} ({pagination.total} káº¿t quáº£)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  <ChevronLeft className="size-4" /> TrÆ°á»›c
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


