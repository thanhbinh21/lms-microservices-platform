'use client';

import { useEffect, useState } from 'react';
import {
  Users, Plus, Pencil, Trash2, X, Loader2, CheckCircle2,
  BookOpen, Settings, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusMessage } from '@/components/ui/status-message';
import {
  getInstructorCommunityGroupsAction,
  createInstructorCommunityGroupAction,
  updateInstructorCommunityGroupAction,
  getInstructorCoursesAction,
  assignCommunityGroupToCourseAction,
  type InstructorCommunityGroupDto,
  type CourseDto,
} from '@/app/actions/instructor';

interface GroupWithCourse extends InstructorCommunityGroupDto {
  linkedCourse?: { id: string; title: string; slug: string } | null;
}

export default function InstructorCommunitiesPage() {
  const [groups, setGroups] = useState<GroupWithCourse[]>([]);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');

  // Modal: 'create' | 'edit' | 'assign' | null
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'assign' | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithCourse | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCourseId, setFormCourseId] = useState('');

  const setStatus = (type: 'success' | 'error', message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

  const fetchGroups = async () => {
    const result = await getInstructorCommunityGroupsAction();
    if (!result.success || !result.data) {
      setGroups([]);
      return;
    }
    const raw: InstructorCommunityGroupDto[] = result.data;
    setGroups(raw.map((g) => ({
      ...g,
      linkedCourse: g.course ?? null,
    })));
  };

  const fetchCourses = async () => {
    const result = await getInstructorCoursesAction();
    if (result.success && result.data) {
      setCourses(result.data);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchGroups(), fetchCourses()]);
      setLoading(false);
    };
    void load();
  }, []);

  const openCreateModal = () => {
    setFormName('');
    setFormDescription('');
    setModalMode('create');
    setSelectedGroup(null);
  };

  const openEditModal = (group: GroupWithCourse) => {
    setFormName(group.name);
    setFormDescription(group.description || '');
    setModalMode('edit');
    setSelectedGroup(group);
  };

  const openAssignModal = (group: GroupWithCourse) => {
    setFormCourseId(group.courseId || '');
    setModalMode('assign');
    setSelectedGroup(group);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedGroup(null);
    setFormName('');
    setFormDescription('');
    setFormCourseId('');
  };

  const handleCreate = async () => {
    if (!formName.trim() || formName.trim().length < 2) {
      setStatus('error', 'Tên nhóm cần ít nhất 2 ký tự.');
      return;
    }
    setSubmitting(true);
    const result = await createInstructorCommunityGroupAction({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setStatus('success', 'Đã tạo nhóm cộng đồng thành công.');
      await fetchGroups();
      closeModal();
    } else {
      setStatus('error', result.message || 'Không thể tạo nhóm.');
    }
  };

  const handleUpdate = async () => {
    if (!selectedGroup) return;
    if (!formName.trim() || formName.trim().length < 2) {
      setStatus('error', 'Tên nhóm cần ít nhất 2 ký tự.');
      return;
    }
    setSubmitting(true);
    const result = await updateInstructorCommunityGroupAction(selectedGroup.id, {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      setStatus('success', 'Đã cập nhật nhóm thành công.');
      await fetchGroups();
      closeModal();
    } else {
      setStatus('error', result.message || 'Không thể cập nhật nhóm.');
    }
  };

  const handleAssign = async () => {
    if (!selectedGroup) return;
    setSubmitting(true);
    const result = await assignCommunityGroupToCourseAction(selectedGroup.id, formCourseId || null);
    setSubmitting(false);

    if (result.success) {
      setStatus('success', 'Đã cập nhật liên kết nhóm.');
      await fetchGroups();
      closeModal();
    } else {
      setStatus('error', result.message || 'Không thể cập nhật liên kết.');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-6xl px-8 py-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Nhóm cộng đồng</h1>
                <p className="text-sm text-muted-foreground font-medium">Quản lý nhóm cộng đồng cho khóa học của bạn.</p>
              </div>
            </div>
            <Button onClick={openCreateModal} className="rounded-xl font-bold gap-2 shadow-md px-6">
              <Plus className="size-4" />
              Tạo nhóm mới
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-8 py-6 space-y-4">
        {statusMessage && (
          <div><StatusMessage type={statusType} message={statusMessage} /></div>
        )}

        {groups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center shadow-sm">
            <Users className="mx-auto mb-4 size-14 text-slate-300" />
            <h3 className="text-xl font-bold">Chưa có nhóm cộng đồng nào</h3>
            <p className="text-muted-foreground mt-2 mb-6 font-medium">
              Tạo nhóm đầu tiên để học viên có thể tham gia thảo luận khi đăng ký khóa học.
            </p>
            <Button onClick={openCreateModal} className="rounded-xl font-bold gap-2 shadow-md px-6">
              <Plus className="size-4" />
              Tạo nhóm cộng đồng đầu tiên
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id} className="rounded-2xl border-white/60 bg-white/70 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 to-transparent px-6 py-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-lg text-slate-800 truncate">{group.name}</h3>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          group.type === 'PUBLIC' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {group.type === 'PUBLIC' ? 'Công khai' : 'Riêng tư'}
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{group.memberCount}</p>
                      <p className="text-xs text-muted-foreground font-semibold">Thành viên</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-bold text-primary">{group.postCount}</p>
                      <p className="text-xs text-muted-foreground font-semibold">Bài viết</p>
                    </div>
                  </div>

                  {/* Linked course */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Khóa học liên kết</p>
                    {group.courseId ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="size-4 shrink-0 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-700 truncate">{group.linkedCourse?.title || 'Khóa học'}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="size-8 text-slate-500" onClick={() => openAssignModal(group)} title="Đổi khóa học liên kết">
                            <Settings className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-slate-500" asChild title="Xem trên cửa hàng">
                            <a href={`/courses/${group.linkedCourse?.slug || group.courseId}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500 italic">Chưa liên kết khóa học</p>
                        <Button size="sm" variant="outline" onClick={() => openAssignModal(group)} className="rounded-lg font-semibold h-8 text-xs gap-1.5">
                          <Plus className="size-3" /> Liên kết
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1 rounded-xl font-semibold gap-1.5 h-10" onClick={() => openEditModal(group)}>
                      <Pencil className="size-4" /> Chỉnh sửa
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-xl font-semibold gap-1.5 h-10" onClick={() => openAssignModal(group)}>
                      <Settings className="size-4" /> Liên kết khóa học
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {modalMode === 'create' ? 'Tạo nhóm cộng đồng mới' :
                 modalMode === 'edit' ? 'Chỉnh sửa nhóm cộng đồng' :
                 'Liên kết nhóm với khóa học'}
              </h3>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              {modalMode !== 'assign' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Tên nhóm</label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)}
                      placeholder="VD: Cộng đồng React Việt Nam"
                      className="h-12 rounded-xl text-base"
                      onKeyDown={(e) => { if (e.key === 'Enter' && modalMode === 'create') void handleCreate(); }}
                      autoFocus />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">Mô tả (tùy chọn)</label>
                    <textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                      value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Mô tả ngắn về nhóm cộng đồng..." />
                  </div>
                </>
              )}

              {modalMode === 'assign' && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Chọn khóa học</label>
                  <select className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={formCourseId} onChange={(e) => setFormCourseId(e.target.value)}>
                    <option value="">Không liên kết khóa học nào</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Nhóm sẽ được gắn vào khóa học đã chọn. Học viên đăng ký khóa học sẽ tự động được thêm vào nhóm.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={closeModal} className="rounded-xl font-bold">Hủy</Button>
                <Button
                  onClick={
                    modalMode === 'create' ? () => void handleCreate() :
                    modalMode === 'edit' ? () => void handleUpdate() :
                    () => void handleAssign()
                  }
                  disabled={submitting}
                  className="rounded-xl font-bold gap-2"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {modalMode === 'create' ? 'Tạo nhóm' : modalMode === 'edit' ? 'Lưu thay đổi' : 'Cập nhật liên kết'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
