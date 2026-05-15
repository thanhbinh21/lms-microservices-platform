'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { getAdminPayoutsAction, updateAdminPayoutAction, type AdminPayoutDto } from '@/app/actions/admin';

export default function AdminPayoutsPage() {
  const [items, setItems] = useState<AdminPayoutDto[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [instructorFilter, setInstructorFilter] = useState('');
  const [note, setNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'default';
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

  async function fetchPayouts() {
    setLoading(true);
    const result = await getAdminPayoutsAction({
      page,
      limit: 10,
      status: statusFilter || undefined,
      instructorId: instructorFilter.trim() || undefined,
    });
    if (result.success && result.data) {
      setItems(result.data.items);
      setPagination(result.data.pagination);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchPayouts();
  }, [page, statusFilter, instructorFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, instructorFilter]);

  function handleUpdate(payout: AdminPayoutDto, nextStatus: 'APPROVED' | 'REJECTED' | 'PAID') {
    if (nextStatus === 'REJECTED' && !note.trim()) {
      setConfirmDialog({
        isOpen: true,
        title: 'Thiáº¿u ghi chÃº tá»« chá»‘i',
        message: 'Vui lÃ²ng nháº­p ghi chÃº admin trÆ°á»›c khi tá»« chá»‘i yÃªu cáº§u rÃºt tiá»n.',
        variant: 'danger',
        confirmLabel: 'ÄÃ£ hiá»ƒu',
        onConfirm: () => undefined,
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: nextStatus === 'REJECTED' ? 'Tá»« chá»‘i yÃªu cáº§u rÃºt tiá»n' : nextStatus === 'PAID' ? 'ÄÃ¡nh dáº¥u Ä‘Ã£ chi tráº£' : 'Duyá»‡t yÃªu cáº§u rÃºt tiá»n',
      message: `Báº¡n cÃ³ cháº¯c muá»‘n chuyá»ƒn yÃªu cáº§u nÃ y sang tráº¡ng thÃ¡i ${nextStatus}?`,
      variant: nextStatus === 'REJECTED' ? 'danger' : 'default',
      confirmLabel: nextStatus === 'REJECTED' ? 'Tá»« chá»‘i' : 'XÃ¡c nháº­n',
      onConfirm: async () => {
        setActionLoading(true);
        const result = await updateAdminPayoutAction(payout.id, nextStatus, note.trim() || undefined);
        setActionLoading(false);
        if (result.success) {
          setNote('');
          await fetchPayouts();
        }
      },
    });
  }

  const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} Ä‘`;

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <h1 className="workspace-page-title">Quáº£n lÃ½ rÃºt tiá»n</h1>
        <p className="workspace-page-description">
          Duyá»‡t, tá»« chá»‘i hoáº·c xÃ¡c nháº­n Ä‘Ã£ chi tráº£ cÃ¡c yÃªu cáº§u rÃºt tiá»n cá»§a giáº£ng viÃªn.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg">Danh sÃ¡ch yÃªu cáº§u rÃºt tiá»n</CardTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Lá»c theo instructorId" className="pl-9" value={instructorFilter} onChange={(event) => setInstructorFilter(event.target.value)} />
              </div>
              <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
                <option value="PENDING">Chá» xá»­ lÃ½</option>
                <option value="APPROVED">ÄÃ£ duyá»‡t</option>
                <option value="REJECTED">Tá»« chá»‘i</option>
                <option value="PAID">ÄÃ£ chi tráº£</option>
              </select>
              <Input placeholder="Ghi chÃº admin khi tá»« chá»‘i" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Äang táº£i yÃªu cáº§u rÃºt tiá»n...
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ChÆ°a cÃ³ yÃªu cáº§u rÃºt tiá»n nÃ o.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Giáº£ng viÃªn</th>
                    <th className="pb-3 pr-4">Sá»‘ tiá»n</th>
                    <th className="pb-3 pr-4">TÃ i khoáº£n</th>
                    <th className="pb-3 pr-4">Tráº¡ng thÃ¡i</th>
                    <th className="pb-3 pr-4">Xá»­ lÃ½</th>
                    <th className="pb-3">NgÃ y táº¡o</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((payout) => (
                    <tr key={payout.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <p className="font-medium">{payout.instructorName || payout.instructorId}</p>
                          <p className="text-xs text-muted-foreground">{payout.instructorEmail || payout.instructorId}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-semibold">{formatMoney(payout.amount)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{payout.bankAccountMasked}</td>
                      <td className="py-3 pr-4"><StatusBadge status={payout.status} /></td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {payout.status === 'PENDING' && (
                            <>
                              <Button size="sm" className="gap-2 text-xs" disabled={actionLoading} onClick={() => handleUpdate(payout, 'APPROVED')}>
                                <CheckCircle2 className="size-3" />
                                Duyá»‡t
                              </Button>
                              <Button size="sm" variant="destructive" className="gap-2 text-xs" disabled={actionLoading} onClick={() => handleUpdate(payout, 'REJECTED')}>
                                <XCircle className="size-3" />
                                Tá»« chá»‘i
                              </Button>
                            </>
                          )}
                          {payout.status === 'APPROVED' && (
                            <Button size="sm" variant="outline" className="text-xs" disabled={actionLoading} onClick={() => handleUpdate(payout, 'PAID')}>
                              ÄÃ¡nh dáº¥u Ä‘Ã£ chi tráº£
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-3 text-muted-foreground">{new Date(payout.createdAt).toLocaleString('vi-VN')}</td>
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
                  TrÆ°á»›c
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
                  Sau
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


