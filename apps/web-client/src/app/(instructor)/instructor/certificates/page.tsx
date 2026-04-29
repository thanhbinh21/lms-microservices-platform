'use client';

import { useEffect, useState } from 'react';
import {
  Award, Plus, Pencil, Trash2, X, Loader2, CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { FocusTrap } from 'focus-trap-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';
import {
  getInstructorCertificateTemplatesAction,
  createInstructorCertificateTemplateAction,
  updateInstructorCertificateTemplateAction,
  deleteInstructorCertificateTemplateAction,
  type CertificateTemplateDto,
} from '@/app/actions/instructor';

export default function InstructorCertificatesPage() {
  const [templates, setTemplates] = useState<CertificateTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');

  // Modal: 'create' | 'edit' | null
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplateDto | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  const setStatus = (type: 'success' | 'error', message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

  const fetchTemplates = async () => {
    const result = await getInstructorCertificateTemplatesAction();
    if (result.success && result.data) {
      setTemplates(result.data);
    } else {
      setTemplates([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchTemplates();
      setLoading(false);
    };
    void load();
  }, []);

  const openCreateModal = () => {
    setFormName('');
    setFormDescription('');
    setModalMode('create');
    setSelectedTemplate(null);
  };

  const openEditModal = (template: CertificateTemplateDto) => {
    setFormName(template.name);
    setFormDescription(template.description || '');
    setModalMode('edit');
    setSelectedTemplate(template);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedTemplate(null);
    setFormName('');
    setFormDescription('');
  };

  const handleCreate = async () => {
    if (!formName.trim() || formName.trim().length < 2) {
      setStatus('error', 'Tên mẫu chứng chỉ cần ít nhất 2 ký tự.');
      return;
    }
    setSubmitting(true);
    const result = await createInstructorCertificateTemplateAction({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setStatus('success', 'Đã tạo mẫu chứng chỉ thành công.');
      await fetchTemplates();
      closeModal();
    } else {
      setStatus('error', result.message || 'Không thể tạo mẫu chứng chỉ.');
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;
    if (!formName.trim() || formName.trim().length < 2) {
      setStatus('error', 'Tên mẫu chứng chỉ cần ít nhất 2 ký tự.');
      return;
    }
    setSubmitting(true);
    const result = await updateInstructorCertificateTemplateAction(selectedTemplate.id, {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setStatus('success', 'Đã cập nhật mẫu chứng chỉ thành công.');
      await fetchTemplates();
      closeModal();
    } else {
      setStatus('error', result.message || 'Không thể cập nhật mẫu chứng chỉ.');
    }
  };

  const handleDelete = async (templateId: string) => {
    setDeletingId(templateId);
    const result = await deleteInstructorCertificateTemplateAction(templateId);
    setDeletingId('');

    if (result.success) {
      setStatus('success', 'Đã xóa mẫu chứng chỉ.');
      await fetchTemplates();
      setConfirmDeleteId('');
    } else {
      setStatus('error', result.message || 'Không thể xóa mẫu chứng chỉ.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" />
            NexEdu Studio
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Chứng chỉ</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Tạo và quản lý mẫu chứng chỉ cho học viên hoàn thành khóa học.
          </p>
        </div>
        <Button onClick={openCreateModal} className="rounded-xl font-bold shadow-md md:w-auto w-full">
          <Plus className="mr-2 size-4" />
          Tạo mẫu mới
        </Button>
      </div>

      {statusMessage && (
        <div className="mb-6"><StatusMessage type={statusType} message={statusMessage} /></div>
      )}

      {/* Content */}
      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-white/30 py-16 text-center">
            <Award className="mx-auto mb-4 size-12 text-muted-foreground/40" />
            <h3 className="text-lg font-bold">Chưa có mẫu chứng chỉ nào</h3>
            <p className="text-muted-foreground mt-2 mb-6 text-sm font-medium">
              Tạo mẫu chứng chỉ đầu tiên và gắn vào khóa học để học viên nhận được khi hoàn thành.
            </p>
            <Button onClick={openCreateModal} className="rounded-xl font-bold shadow-md">
              <Plus className="mr-2 size-4" />
              Tạo mẫu chứng chỉ đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md shadow-sm overflow-hidden">
                <div className="relative bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 border-b border-amber-200/50">
                  <div className="rounded-xl border-2 border-amber-300/60 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <Award className="size-5 text-amber-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Chứng nhận</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent my-2" />
                    <p className="text-center text-xs font-semibold text-slate-700 line-clamp-2 leading-relaxed">
                      {template.name}
                    </p>
                    {template.description && (
                      <p className="mt-1 text-center text-[10px] text-slate-500 line-clamp-1">{template.description}</p>
                    )}
                  </div>
                </div>

                <CardContent className="p-5 space-y-3">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{template.name}</h3>
                    {template.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1 rounded-xl font-semibold gap-1.5 h-9 text-xs" onClick={() => openEditModal(template)}>
                      <Pencil className="size-3.5" /> Sửa
                    </Button>
                    {confirmDeleteId === template.id ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => void handleDelete(template.id)}
                          disabled={deletingId === template.id} className="rounded-xl font-bold h-9 text-xs">
                          {deletingId === template.id ? <Loader2 className="size-3.5 animate-spin" /> : 'Xóa'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId('')} className="rounded-xl font-semibold h-9 text-xs">Hủy</Button>
                      </>
                    ) : (
                      <Button variant="outline" className="rounded-xl font-semibold gap-1.5 h-9 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setConfirmDeleteId(template.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="presentation">
          <FocusTrap>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-cert-title"
              aria-describedby="modal-cert-desc"
              className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 id="modal-cert-title" className="text-lg font-bold">
                  {modalMode === 'create' ? 'Tạo mẫu chứng chỉ mới' : 'Chỉnh sửa mẫu chứng chỉ'}
                </h3>
                <button onClick={closeModal} aria-label="Đóng" className="text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1">
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="cert-name" className="mb-1.5 block text-sm font-semibold">Tên mẫu chứng chỉ</label>
                  <Input id="cert-name" value={formName} onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Chứng nhận hoàn thành khóa học"
                    className="h-12 rounded-xl text-base"
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
                    autoFocus />
                </div>
                <div>
                  <label htmlFor="cert-desc" className="mb-1.5 block text-sm font-semibold">Mô tả (tùy chọn)</label>
                  <textarea id="cert-desc" className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Mô tả ngắn về chứng chỉ này..." />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={closeModal} className="rounded-xl font-bold">Hủy</Button>
                  <Button
                    onClick={modalMode === 'create' ? () => void handleCreate() : () => void handleUpdate()}
                    disabled={submitting}
                    className="rounded-xl font-bold gap-2"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    {modalMode === 'create' ? 'Tạo mẫu' : 'Lưu thay đổi'}
                  </Button>
                </div>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  );
}
