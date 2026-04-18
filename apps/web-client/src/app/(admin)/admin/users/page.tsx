'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, KeyRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
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
    if (res.success) fetchUsers();
  };

  const handleStatusToggle = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
    const label = newStatus === 'BANNED' ? 'Cấm' : 'Kích hoạt';
    setConfirmDialog({
      isOpen: true,
      title: `${label} người dùng`,
      message: `Bạn có chắc muốn ${label.toLowerCase()} người dùng này?`,
      variant: newStatus === 'BANNED' ? 'danger' : 'default',
      onConfirm: async () => {
        const res = await updateAdminUserStatus(userId, newStatus);
        if (res.success) fetchUsers();
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
      title: 'Không thể chỉnh sửa Admin',
      message: 'Không được chỉnh sửa tài khoản có vai trò Admin.',
      variant: 'default',
      onConfirm: () => {},
    });
  };

  const submitPasswordChange = async () => {
    if (!passwordTarget) return;
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu tối thiểu 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setPasswordSaving(true);
    const res = await updateAdminUserPassword(passwordTarget.id, newPassword);
    setPasswordSaving(false);

    if (!res.success) {
      setPasswordError(res.message || 'Đổi mật khẩu thất bại.');
      return;
    }

    setPasswordDialogOpen(false);
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý người dùng</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Xem, tìm kiếm, phân quyền và quản lý trạng thái người dùng.
        </p>
      </div>

      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách người dùng</CardTitle>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên hoặc email..."
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
              <option value="">Tất cả vai trò</option>
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
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
            <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy người dùng nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Tên</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Vai trò</th>
                    <th className="pb-3 pr-4">Trạng thái</th>
                    <th className="pb-3 pr-4">Ngày tạo</th>
                    <th className="pb-3">Hành động</th>
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
                            Đổi MK
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
                            {u.status === 'ACTIVE' ? 'Cấm' : 'Kích hoạt'}
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
                  <h3 className="text-lg font-bold">Đổi mật khẩu</h3>
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
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mật khẩu mới</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Xác nhận mật khẩu</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
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
                Hủy
              </Button>
              <Button onClick={submitPasswordChange} disabled={passwordSaving}>
                {passwordSaving ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
