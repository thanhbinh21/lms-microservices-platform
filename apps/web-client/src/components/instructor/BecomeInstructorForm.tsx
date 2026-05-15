'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  createInstructorRequestAction,
  getMyPendingInstructorRequestAction,
} from '@/app/actions/instructor';
import { useAppSelector } from '@/lib/redux/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusMessage } from '@/components/ui/status-message';
import { toast } from '@/components/ui/toast';

type InstructorRequestForm = {
  fullName: string;
  phone: string;
  expertise: string;
  specialization: string;
  experienceYears: string;
  currentJob: string;
  bio: string;
  courseTitle: string;
  courseCategory: string;
  courseDescription: string;
  targetStudents: string;
  website: string;
  linkedin: string;
  youtube: string;
};

const defaultForm: InstructorRequestForm = {
  fullName: '',
  phone: '',
  expertise: '',
  specialization: '',
  experienceYears: '0',
  currentJob: '',
  bio: '',
  courseTitle: '',
  courseCategory: '',
  courseDescription: '',
  targetStudents: '',
  website: '',
  linkedin: '',
  youtube: '',
};

function optionalUrl(value: string) {
  return value.trim() || undefined;
}

export default function BecomeInstructorForm() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);
  const userEmail = (user as { email?: string } | null)?.email || '';

  const [form, setForm] = useState<InstructorRequestForm>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [existingRequest, setExistingRequest] = useState<{
    status: string;
    createdAt: string;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((current) => ({
      ...current,
      fullName: current.fullName || user?.name || '',
    }));
  }, [user?.name]);

  useEffect(() => {
    async function checkStatus() {
      setIsCheckingStatus(true);
      const res = await getMyPendingInstructorRequestAction();
      if (res.success && res.request) {
        setExistingRequest({
          status: res.request.status,
          createdAt: res.request.createdAt,
        });
      }
      setIsCheckingStatus(false);
    }
    void checkStatus();
  }, []);

  const canShowForm = useMemo(() => {
    if (!existingRequest) return true;
    return existingRequest.status === 'REJECTED' || existingRequest.status === 'rejected';
  }, [existingRequest]);

  const updateField = (field: keyof InstructorRequestForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    if (form.fullName.trim().length < 2) return 'Họ tên cần ít nhất 2 ký tự.';
    if (form.phone.trim().length < 9) return 'Số điện thoại không hợp lệ.';
    if (form.expertise.trim().length < 2) return 'Vui lòng nhập chuyên môn chính.';
    if (!Number.isInteger(Number(form.experienceYears)) || Number(form.experienceYears) < 0) {
      return 'Số năm kinh nghiệm phải là số nguyên không âm.';
    }
    if (form.bio.trim().length < 10) return 'Giới thiệu bản thân cần ít nhất 10 ký tự.';
    if (form.courseTitle.trim().length < 2) return 'Tên khóa học mẫu cần ít nhất 2 ký tự.';
    if (form.courseCategory.trim().length < 2) return 'Danh mục khóa học cần ít nhất 2 ký tự.';
    if (form.courseDescription.trim().length < 10) return 'Mô tả khóa học cần ít nhất 10 ký tự.';
    return '';
  };

  const onSubmit = async () => {
    if (!user) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      toast('error', 'Hồ sơ chưa hợp lệ', validationError);
      return;
    }

    setIsSubmitting(true);
    setError('');

    const result = await createInstructorRequestAction({
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      expertise: form.expertise.trim(),
      specialization: form.specialization.trim() || form.expertise.trim(),
      experienceYears: Number(form.experienceYears),
      currentJob: form.currentJob.trim() || undefined,
      bio: form.bio.trim(),
      courseTitle: form.courseTitle.trim(),
      courseCategory: form.courseCategory.trim(),
      courseDescription: form.courseDescription.trim(),
      targetStudents: form.targetStudents.trim() || undefined,
      email: userEmail || undefined,
      website: optionalUrl(form.website),
      linkedin: optionalUrl(form.linkedin),
      youtube: optionalUrl(form.youtube),
    });

    if (result.success) {
      toast('success', 'Đã gửi hồ sơ giảng viên');
      router.push('/?instructorSubmitted=1');
    } else {
      const message = result.message || 'Không thể gửi hồ sơ. Vui lòng thử lại.';
      setError(message);
      toast('error', 'Gửi hồ sơ thất bại', message);
    }

    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
            <Clock3 className="size-3.5" />
            Đang chờ duyệt
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            Đã duyệt
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
            <AlertCircle className="size-3.5" />
            Đã từ chối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {status}
          </span>
        );
    }
  };

  if (isCheckingStatus) {
    return (
      <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
      <CardHeader className="relative space-y-3 px-6 pb-2 pt-8 text-center sm:px-10 sm:text-left">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Sparkles className="size-6 text-primary" />
          Trở thành Giảng viên
        </CardTitle>
        <CardDescription className="text-base font-medium text-muted-foreground">
          Điền hồ sơ ứng tuyển để đội ngũ quản trị có đủ thông tin đánh giá chuyên môn và ý tưởng khóa học của bạn.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative space-y-6 px-6 pb-6 sm:px-10">
        {existingRequest && (
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span className="font-semibold text-foreground">Hồ sơ gần nhất</span>
              {getStatusBadge(existingRequest.status)}
            </div>
            {existingRequest.status.toUpperCase() === 'PENDING' && (
              <p className="text-sm text-muted-foreground">
                Hồ sơ của bạn đang được xem xét. Bạn sẽ nhận thông báo khi có kết quả.
              </p>
            )}
            {existingRequest.status.toUpperCase() === 'APPROVED' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-emerald-700">
                  Hồ sơ đã được duyệt. Bạn đã có thể vào Studio để tạo khóa học.
                </p>
                <Button onClick={() => router.push('/instructor')} className="w-fit gap-2 font-bold shadow-lg shadow-primary/20">
                  Vào Studio
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            )}
            {existingRequest.status.toUpperCase() === 'REJECTED' && (
              <p className="text-sm text-red-600">
                Hồ sơ trước đó chưa được duyệt. Bạn có thể chỉnh thông tin và gửi lại.
              </p>
            )}
          </div>
        )}

        {canShowForm && (
          <>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              <p className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Quy trình
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  'Gửi hồ sơ ứng tuyển giảng viên.',
                  'Admin xem xét chuyên môn và ý tưởng khóa học.',
                  'Khi được duyệt, bạn sẽ nhận thông báo và vào Studio.',
                  'Tạo và xuất bản khóa học đầu tiên của bạn.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && <StatusMessage type="error" message={error} />}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="instructor-full-name" className="text-sm font-semibold">Họ và tên</label>
                <Input id="instructor-full-name" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-phone" className="text-sm font-semibold">Số điện thoại</label>
                <Input id="instructor-phone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="VD: 0901234567" />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-expertise" className="text-sm font-semibold">Chuyên môn chính</label>
                <Input id="instructor-expertise" value={form.expertise} onChange={(event) => updateField('expertise', event.target.value)} placeholder="VD: Lập trình Frontend" />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-experience" className="text-sm font-semibold">Số năm kinh nghiệm</label>
                <Input id="instructor-experience" type="number" min={0} value={form.experienceYears} onChange={(event) => updateField('experienceYears', event.target.value)} />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-specialization" className="text-sm font-semibold">Lĩnh vực chuyên sâu</label>
                <Input id="instructor-specialization" value={form.specialization} onChange={(event) => updateField('specialization', event.target.value)} placeholder="VD: React, Next.js, UI Architecture" />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-current-job" className="text-sm font-semibold">Công việc hiện tại</label>
                <Input id="instructor-current-job" value={form.currentJob} onChange={(event) => updateField('currentJob', event.target.value)} placeholder="VD: Senior Frontend Engineer" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="instructor-bio" className="text-sm font-semibold">Giới thiệu bản thân</label>
                <Textarea id="instructor-bio" value={form.bio} onChange={(event) => updateField('bio', event.target.value)} placeholder="Nêu kinh nghiệm giảng dạy, dự án đã làm, thế mạnh chuyên môn..." />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-course-title" className="text-sm font-semibold">Tên khóa học dự kiến</label>
                <Input id="instructor-course-title" value={form.courseTitle} onChange={(event) => updateField('courseTitle', event.target.value)} placeholder="VD: Next.js thực chiến" />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-course-category" className="text-sm font-semibold">Danh mục khóa học</label>
                <Input id="instructor-course-category" value={form.courseCategory} onChange={(event) => updateField('courseCategory', event.target.value)} placeholder="VD: Lập trình Web" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="instructor-course-description" className="text-sm font-semibold">Mô tả khóa học</label>
                <Textarea id="instructor-course-description" value={form.courseDescription} onChange={(event) => updateField('courseDescription', event.target.value)} placeholder="Mô tả mục tiêu, nội dung chính và kết quả học viên đạt được..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="instructor-target-students" className="text-sm font-semibold">Đối tượng học viên</label>
                <Input id="instructor-target-students" value={form.targetStudents} onChange={(event) => updateField('targetStudents', event.target.value)} placeholder="VD: Người mới học lập trình, sinh viên CNTT..." />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-website" className="text-sm font-semibold">Website cá nhân</label>
                <Input id="instructor-website" value={form.website} onChange={(event) => updateField('website', event.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <label htmlFor="instructor-linkedin" className="text-sm font-semibold">LinkedIn</label>
                <Input id="instructor-linkedin" value={form.linkedin} onChange={(event) => updateField('linkedin', event.target.value)} placeholder="https://linkedin.com/in/..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="instructor-youtube" className="text-sm font-semibold">YouTube hoặc kênh demo</label>
                <Input id="instructor-youtube" value={form.youtube} onChange={(event) => updateField('youtube', event.target.value)} placeholder="https://..." />
              </div>
            </div>

            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20 md:max-w-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Đang gửi hồ sơ...
                </>
              ) : (
                <>
                  <BookOpen className="mr-2 size-5" />
                  Gửi hồ sơ ứng tuyển
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>

      <CardFooter className="border-t border-white/40 bg-white/30 px-6 py-5 sm:px-10">
        <p className="text-xs font-medium leading-relaxed text-muted-foreground">
          Quy trình duyệt thường mất từ 1-3 ngày làm việc. Bạn sẽ nhận thông báo khi có kết quả.
        </p>
      </CardFooter>
    </Card>
  );
}
