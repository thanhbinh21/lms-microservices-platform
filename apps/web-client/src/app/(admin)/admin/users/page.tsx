'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, KeyRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import {
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  updateAdminUserPassword,
} from '@/app/actions/admin';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'default';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await getAdminUsers({
      page,
      limit: 10,
      search: search || undefined,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
    });
    if (res.success && res.data) {
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await updateAdminUserRole(userId, newRole);
    if (res.success) {
      toast('success', 'Đã cập nhật vai trò người dùng');
      fetchUsers();
      return;
    }
    toast('error', 'Cập nhật vai trò thất bại', res.message || 'Vui lòng thử lại.');
  };

  const handleStatusToggle = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
    const label = newStatus === 'BANNED' ? 'Cáº¥m' : 'KÃ­ch hoáº¡t';
    setConfirmDialog({
      isOpen: true,
      title: `${label} ngÆ°á»i dÃ¹ng`,
      message: `Báº¡n cÃ³ cháº¯c muá»‘n ${label.toLowerCase()} ngÆ°á»i dÃ¹ng nÃ y?`,
      variant: newStatus === 'BANNED' ? 'danger' : 'default',
      onConfirm: async () => {
        const res = await updateAdminUserStatus(userId, newStatus);
        if (res.success) {
          toast('success', 'Đã cập nhật trạng thái người dùng');
          fetchUsers();
          return;
        }
        toast('error', 'Cập nhật trạng thái thất bại', res.message || 'Vui lòng thử lại.');
      },
    });
  };

  const openPasswordDialog = (user: { id: string; email: string }) => {
    setPasswordTarget({ id: user.id, email: user.email });
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordDialogOpen(true);
  };

  const showCannotEditAdmin = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'KhÃ´ng thá»ƒ chá»‰nh sá»­a Admin',
      message: 'KhÃ´ng Ä‘Æ°á»£c chá»‰nh sá»­a tÃ i khoáº£n cÃ³ vai trÃ² Admin.',
      variant: 'default',
      onConfirm: () => {},
    });
  };

  const submitPasswordChange = async () => {
    if (!passwordTarget) return;
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('Máº­t kháº©u tá»‘i thiá»ƒu 8 kÃ½ tá»±.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Máº­t kháº©u xÃ¡c nháº­n khÃ´ng khá»›p.');
      return;
    }

    setPasswordSaving(true);
    const res = await updateAdminUserPassword(passwordTarget.id, newPassword);
    setPasswordSaving(false);

    if (!res.success) {
      setPasswordError(res.message || 'Äá»•i máº­t kháº©u tháº¥t báº¡i.');
      toast('error', 'Đổi mật khẩu thất bại', res.message || 'Vui lòng thử lại.');
      return;
    }

    setPasswordDialogOpen(false);
    toast('success', 'Đã đổi mật khẩu người dùng');
  };

  return (
    <div className="workspace-page">
      <div className="workspace-page-header">
        <h1 className="workspace-page-title">Quáº£n lÃ½ ngÆ°á»i dÃ¹ng</h1>
        <p className="workspace-page-description">
          Xem, tÃ¬m kiáº¿m, phÃ¢n quyá»n vÃ  quáº£n lÃ½ tráº¡ng thÃ¡i ngÆ°á»i dÃ¹ng.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">Danh sÃ¡ch ngÆ°á»i dÃ¹ng</CardTitle>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="TÃ¬m theo tÃªn hoáº·c email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Táº¥t cáº£ vai trÃ²</option>
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Táº¥t cáº£ tráº¡ng thÃ¡i</option>
              <option value="ACTIVE">Active</option>
              <option value="BANNED">Banned</option>
              <option value="SUSPENDED">Suspended</option>
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
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng nÃ o.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">TÃªn</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Vai trÃ²</th>
                    <th className="pb-3 pr-4">Tráº¡ng thÃ¡i</th>
                    <th className="pb-3 pr-4">NgÃ y táº¡o</th>
                    <th className="pb-3">HÃ nh Ä‘á»™ng</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4 font-medium">{u.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={u.role} />
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {u.role === 'ADMIN' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={showCannotEditAdmin}
                            >
                              Admin
                            </Button>
                          ) : null}
                          <select
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={u.role === 'ADMIN'}
                          >
                            <option value="STUDENT">Student</option>
                            <option value="INSTRUCTOR">Instructor</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() =>
                              u.role === 'ADMIN'
                                ? showCannotEditAdmin()
                                : openPasswordDialog({ id: u.id, email: u.email })
                            }
                            disabled={u.role === 'ADMIN'}
                          >
                            <KeyRound className="mr-1 size-4" />
                            Äá»•i MK
                          </Button>
                          <Button
                            variant={u.status === 'ACTIVE' ? 'destructive' : 'default'}
                            size="sm"
                            className="text-xs"
                            onClick={() =>
                              u.role === 'ADMIN' ? showCannotEditAdmin() : handleStatusToggle(u.id, u.status)
                            }
                            disabled={u.role === 'ADMIN'}
                          >
                            {u.status === 'ACTIVE' ? 'Cáº¥m' : 'KÃ­ch hoáº¡t'}
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

      {passwordDialogOpen && passwordTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => {
            if (!passwordSaving) setPasswordDialogOpen(false);
          }}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-white/60 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-zinc-100">
                  <KeyRound className="size-5 text-zinc-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Äá»•i máº­t kháº©u</h3>
                  <p className="text-xs text-muted-foreground">{passwordTarget.email}</p>
                </div>
              </div>
              <button
                onClick={() => (!passwordSaving ? setPasswordDialogOpen(false) : null)}
                className="rounded-lg p-1 hover:bg-zinc-100"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Máº­t kháº©u má»›i</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tá»‘i thiá»ƒu 8 kÃ½ tá»±"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">XÃ¡c nháº­n máº­t kháº©u</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nháº­p láº¡i máº­t kháº©u"
                />
              </div>
              {passwordError && (
                <p className="text-sm font-medium text-red-600">{passwordError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setPasswordDialogOpen(false)}
                disabled={passwordSaving}
              >
                Há»§y
              </Button>
              <Button onClick={submitPasswordChange} disabled={passwordSaving}>
                {passwordSaving ? 'Äang lÆ°u...' : 'LÆ°u'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


