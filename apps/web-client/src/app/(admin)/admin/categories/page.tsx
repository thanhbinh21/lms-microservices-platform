'use client';

import { useEffect, useState } from 'react';
import { Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  createAdminCategoryAction,
  deleteAdminCategoryAction,
  getAdminCategoriesAction,
  updateAdminCategoryAction,
  type AdminCategoryDto,
} from '@/app/actions/admin';

interface FormState {
  name: string;
  slug: string;
  order: string;
}

const EMPTY_FORM: FormState = { name: '', slug: '', order: '0' };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'default';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'default' });

  const fetchCategories = async () => {
    setLoading(true);
    const res = await getAdminCategoriesAction();
    if (res.success && res.data) {
      setCategories(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchCategories();
  }, []);

  const filtered = categories.filter((category) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [category.name, category.slug].some((value) => value.toLowerCase().includes(needle));
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleEdit = (category: AdminCategoryDto) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      order: String(category.order ?? 0),
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      order: Number(form.order) || 0,
    };

    const res = editingId
      ? await updateAdminCategoryAction(editingId, payload)
      : await createAdminCategoryAction(payload);

    setSaving(false);
    if (res.success) {
      await fetchCategories();
      resetForm();
    }
  };

  const handleDelete = (category: AdminCategoryDto) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa danh mục',
      message: `Bạn có chắc muốn xóa danh mục "${category.name}"? Hành động này chỉ thực hiện khi danh mục chưa có khóa học.`,
      variant: 'danger',
      onConfirm: async () => {
        const res = await deleteAdminCategoryAction(category.id);
        if (res.success) {
          await fetchCategories();
          if (editingId === category.id) resetForm();
        }
      },
    });
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý danh mục</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Tạo, cập nhật và xóa danh mục khóa học để giữ hệ thống discovery đồng bộ.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm danh mục..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? 'Cập nhật danh mục' : 'Tạo danh mục'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tên</label>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="De trong de tu sinh"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thứ tự</label>
              <Input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) => setForm((prev) => ({ ...prev, order: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="flex-1 gap-2 font-bold" disabled={saving || !form.name.trim()} onClick={handleSubmit}>
                <Plus className="size-4" />
                {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo mới'}
              </Button>
              {editingId && (
                <Button variant="outline" className="font-bold" onClick={resetForm}>
                  Hủy
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg">Danh sách danh mục</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy danh mục nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3 pr-4">Tên</th>
                      <th className="pb-3 pr-4">Slug</th>
                      <th className="pb-3 pr-4">Thứ tự</th>
                      <th className="pb-3 pr-4">Khóa học</th>
                      <th className="pb-3">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((category) => (
                      <tr key={category.id} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <td className="py-3 pr-4 font-medium">{category.name}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{category.slug}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{category.order}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{category.courseCount ?? 0}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => handleEdit(category)}>
                              <Edit3 className="size-3" />
                              Sửa
                            </Button>
                            <Button variant="destructive" size="sm" className="gap-2 text-xs" onClick={() => handleDelete(category)}>
                              <Trash2 className="size-3" />
                              Xóa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
