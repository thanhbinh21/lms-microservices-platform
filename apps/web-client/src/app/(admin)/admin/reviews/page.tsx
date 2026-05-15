'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Flag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { getAdminReviews, flagAdminReview, deleteAdminReview } from '@/app/actions/admin';

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? 'opacity-100' : 'opacity-25'}>
          â˜…
        </span>
      ))}
    </span>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [flagFilter, setFlagFilter] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'default';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const res = await getAdminReviews({
      page,
      limit: 10,
      isFlagged: flagFilter === 'true' ? true : flagFilter === 'false' ? false : undefined,
    });
    if (res.success && res.data) {
      setReviews(res.data.reviews);
      setPagination(res.data.pagination);
    }
    setLoading(false);
  }, [page, flagFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    setPage(1);
  }, [flagFilter]);

  const handleToggleFlag = async (reviewId: string, currentFlagged: boolean) => {
    const res = await flagAdminReview(reviewId, !currentFlagged);
    if (res.success) fetchReviews();
  };

  const handleDelete = (reviewId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'XÃ³a Ä‘Ã¡nh giÃ¡',
      message: 'Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a Ä‘Ã¡nh giÃ¡ nÃ y? HÃ nh Ä‘á»™ng khÃ´ng thá»ƒ hoÃ n tÃ¡c.',
      variant: 'danger',
      onConfirm: async () => {
        const res = await deleteAdminReview(reviewId);
        if (res.success) fetchReviews();
      },
    });
  };

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <h1 className="workspace-page-title">Quáº£n lÃ½ Ä‘Ã¡nh giÃ¡</h1>
        <p className="workspace-page-description">
          Kiá»ƒm duyá»‡t, gáº¯n cá» vÃ  xÃ³a cÃ¡c Ä‘Ã¡nh giÃ¡ vi pháº¡m.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">Danh sÃ¡ch Ä‘Ã¡nh giÃ¡</CardTitle>
          <div className="mt-4">
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value)}
            >
              <option value="">Táº¥t cáº£</option>
              <option value="true">ÄÃ£ gáº¯n cá»</option>
              <option value="false">ChÆ°a gáº¯n cá»</option>
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
          ) : reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">KhÃ´ng tÃ¬m tháº¥y Ä‘Ã¡nh giÃ¡ nÃ o.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">KhÃ³a há»c</th>
                    <th className="pb-3 pr-4">NgÆ°á»i Ä‘Ã¡nh giÃ¡</th>
                    <th className="pb-3 pr-4">Äiá»ƒm</th>
                    <th className="pb-3 pr-4">Ná»™i dung</th>
                    <th className="pb-3 pr-4">Gáº¯n cá»</th>
                    <th className="pb-3 pr-4">NgÃ y</th>
                    <th className="pb-3">HÃ nh Ä‘á»™ng</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="max-w-[160px] truncate py-3 pr-4 font-medium">
                        {r.course?.title || r.courseTitle || 'â€”'}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {r.user?.name || r.userName || 'â€”'}
                      </td>
                      <td className="py-3 pr-4">
                        <StarRating rating={r.rating} />
                      </td>
                      <td className="max-w-[200px] truncate py-3 pr-4 text-muted-foreground">
                        {r.comment || 'â€”'}
                      </td>
                      <td className="py-3 pr-4">
                        {r.isFlagged ? (
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
                            Gáº¯n cá»
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">â€”</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant={r.isFlagged ? 'outline' : 'secondary'}
                            size="sm"
                            className="text-xs"
                            onClick={() => handleToggleFlag(r.id, r.isFlagged)}
                          >
                            <Flag className="size-3" />
                            {r.isFlagged ? 'Bá» cá»' : 'Gáº¯n cá»'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleDelete(r.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" /> TrÆ°á»›c
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
      />
    </div>
  );
}


