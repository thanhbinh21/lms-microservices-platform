'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, KeyRound, Search, UserCog, X } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import {
  getAdminUsers,
  updateAdminUserPassword,
  updateAdminUserRole,
  updateAdminUserStatus,
} from '@/app/actions/admin';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    variant: 'danger' | 'default';
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getAdminUsers({
      page,
      limit: 10,
      search: search || undefined,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
    });
    if (result.success && result.data) {
      setUsers(result.data.users);
      setPagination(result.data.pagination);
    } else {
      setError(result.message || 'Không thể tải danh sách người dùng.');
    }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const summary = useMemo(() => {
    const active = users.filter((user) => user.status === 'ACTIVE').length;
    const instructors = users.filter((user) => user.role === 'INSTRUCTOR').length;
    const banned = users.filter((user) => user.status === 'BANNED').length;
    return { active, instructors, banned };
  }, [users]);

  function showCannotEditAdmin() {
    setConfirmDialog({
      isOpen: true,
      title: 'Không thể chỉnh sửa Admin',
      message: 'Không được chỉnh sửa tài khoản có vai trò Admin từ màn hình này.',
      variant: 'default',
      onConfirm: () => undefined,
    });
  }

  function handleRoleChange(userId: string, currentRole: string, nextRole: string) {
    if (currentRole === nextRole) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Cập nhật vai trò người dùng',
      message: `Bạn có chắc muốn đổi vai trò người dùng này từ ${currentRole} sang ${nextRole}? Thao tác này ảnh hưởng trực tiếp đến quyền truy cập.`,
      variant: nextRole === 'ADMIN' ? 'danger' : 'default',
      confirmLabel: 'Đổi vai trò',
      onConfirm: async () => {
        setActionLoading(true);
        const result = await updateAdminUserRole(userId, nextRole);
        setActionLoading(false);
        if (result.success) {
          toast('success', 'Đã cập nhật vai trò người dùng', 'Thao tác đã được ghi audit log.');
          await fetchUsers();
          return;
        }
        toast('error', 'Cập nhật vai trò thất bại', result.message || 'Vui lòng thử lại.');
      },
    });
  }

  function handleStatusToggle(userId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
    const label = nextStatus === 'BANNED' ? 'Cấm' : 'Kích hoạt';
    setConfirmDialog({
      isOpen: true,
      title: `${label} người dùng`,
      message: `Bạn có chắc muốn ${label.toLowerCase()} người dùng này? Tài khoản có thể bị thu hồi phiên đăng nhập theo policy backend.`,
      variant: nextStatus === 'BANNED' ? 'danger' : 'default',
      confirmLabel: label,
      onConfirm: async () => {
        setActionLoading(true);
        const result = await updateAdminUserStatus(userId, nextStatus);
        setActionLoading(false);
        if (result.success) {
          toast('success', 'Đã cập nhật trạng thái người dùng', 'Thao tác đã được ghi audit log.');
          await fetchUsers();
          return;
        }
        toast('error', 'Cập nhật trạng thái thất bại', result.message || 'Vui lòng thử lại.');
      },
    });
  }

  function openPasswordDialog(user: { id: string; email: string }) {
    setPasswordTarget({ id: user.id, email: user.email });
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordDialogOpen(true);
  }

  async function submitPasswordChange() {
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
    const result = await updateAdminUserPassword(passwordTarget.id, newPassword);
    setPasswordSaving(false);

    if (!result.success) {
      setPasswordError(result.message || 'Đổi mật khẩu thất bại.');
      toast('error', 'Đổi mật khẩu thất bại', result.message || 'Vui lòng thử lại.');
      return;
    }

    setPasswordDialogOpen(false);
    toast('success', 'Đã đổi mật khẩu người dùng', 'Thao tác đã được ghi audit log.');
  }

  return (
    <div className="workspace-page space-y-6">
      <AdminPageHeader
        eyebrow={
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <UserCog className="size-3.5" />
            Người dùng
          </div>
        }
        title="Quản lý người dùng"
        description="Tìm kiếm, phân quyền, khóa hoặc kích hoạt tài khoản. Các thao tác nhạy cảm đều yêu cầu xác nhận."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Tổng kết quả" value={pagination?.total ?? users.length} hint="Theo bộ lọc hiện tại" />
        <AdminStatCard label="Đang hoạt động" value={loading ? '...' : summary.active} hint="Trong trang hiện tại" tone="success" />
        <AdminStatCard label="Giảng viên" value={loading ? '...' : summary.instructors} hint="Trong trang hiện tại" />
        <AdminStatCard label="Bị cấm" value={loading ? '...' : summary.banned} hint="Cần theo dõi" tone={summary.banned > 0 ? 'danger' : 'default'} />
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}

      <Card className="glass-panel rounded-xl border-white/60">
        <CardHeader>
          <CardTitle className="text-lg">Danh sách người dùng</CardTitle>
          <CardDescription>Lọc theo tên, email, vai trò hoặc trạng thái tài khoản.</CardDescription>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Tìm theo tên hoặc email..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="">Tất cả vai trò</option>
              <option value="STUDENT">Học viên</option>
              <option value="INSTRUCTOR">Giảng viên</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="BANNED">Bị cấm</option>
              <option value="SUSPENDED">Tạm khóa</option>
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
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/60 bg-white/40 p-8 text-center text-sm text-muted-foreground">
              Không tìm thấy người dùng phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4">Người dùng</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Vai trò</th>
                    <th className="pb-3 pr-4">Trạng thái</th>
                    <th className="pb-3 pr-4">Ngày tạo</th>
                    <th className="pb-3">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                      <td className="py-3 pr-4 font-medium">{user.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{user.email}</td>
                      <td className="py-3 pr-4"><StatusBadge status={user.role} /></td>
                      <td className="py-3 pr-4"><StatusBadge status={user.status} /></td>
                      <td className="py-3 pr-4 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={user.role}
                            onChange={(event) => (user.role === 'ADMIN' ? showCannotEditAdmin() : handleRoleChange(user.id, user.role, event.target.value))}
                            disabled={user.role === 'ADMIN' || actionLoading}
                          >
                            <option value="STUDENT">Học viên</option>
                            <option value="INSTRUCTOR">Giảng viên</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => (user.role === 'ADMIN' ? showCannotEditAdmin() : openPasswordDialog({ id: user.id, email: user.email }))}
                            disabled={user.role === 'ADMIN' || actionLoading}
                          >
                            <KeyRound className="size-3.5" />
                            Đổi mật khẩu
                          </Button>
                          <Button
                            variant={user.status === 'ACTIVE' ? 'destructive' : 'default'}
                            size="sm"
                            className="text-xs"
                            onClick={() => (user.role === 'ADMIN' ? showCannotEditAdmin() : handleStatusToggle(user.id, user.status))}
                            disabled={user.role === 'ADMIN' || actionLoading}
                          >
                            {user.status === 'ACTIVE' ? 'Cấm' : 'Kích hoạt'}
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
        onClose={() => setConfirmDialog((previous) => ({ ...previous, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        loading={actionLoading}
      />

      {passwordDialogOpen && passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => (!passwordSaving ? setPasswordDialogOpen(false) : null)}>
          <div className="w-full max-w-md rounded-xl border border-white/60 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
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
              <button onClick={() => (!passwordSaving ? setPasswordDialogOpen(false) : null)} className="rounded-lg p-1 hover:bg-zinc-100" aria-label="Đóng">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="admin-new-password" className="mb-1 block text-xs font-semibold text-muted-foreground">Mật khẩu mới</label>
                <Input id="admin-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Tối thiểu 8 ký tự" />
              </div>
              <div>
                <label htmlFor="admin-confirm-password" className="mb-1 block text-xs font-semibold text-muted-foreground">Xác nhận mật khẩu</label>
                <Input id="admin-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" />
              </div>
              {passwordError && <p className="text-sm font-medium text-red-600">{passwordError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={passwordSaving}>Hủy</Button>
              <Button onClick={submitPasswordChange} disabled={passwordSaving}>{passwordSaving ? 'Đang lưu...' : 'Lưu'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
