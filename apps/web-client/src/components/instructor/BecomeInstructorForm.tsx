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
import { forceRefreshSessionAction } from '@/app/actions/auth';
import {
  createInstructorRequestAction,
  getMyPendingInstructorRequestAction,
  type InstructorRequestDto,
} from '@/app/actions/instructor';
import { setUser } from '@/lib/redux/authSlice';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
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

function isValidOptionalUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeStatus(status?: string | null) {
  return (status || '').toUpperCase();
}

export default function BecomeInstructorForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [form, setForm] = useState<InstructorRequestForm>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [existingRequest, setExistingRequest] = useState<InstructorRequestDto | null>(null);
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
      if (res.success) {
        setExistingRequest(res.request);
      } else {
        setError(res.message || 'Không thể kiểm tra trạng thái hồ sơ.');
      }
      setIsCheckingStatus(false);
    }
    void checkStatus();
  }, []);

  const canShowForm = useMemo(() => {
    if (!existingRequest) return true;
    return normalizeStatus(existingRequest.status) === 'REJECTED';
  }, [existingRequest]);

  const updateField = (field: keyof InstructorRequestForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    if (form.fullName.trim().length < 2) return 'Họ tên cần ít nhất 2 ký tự.';
    if (form.phone.trim().length < 9) return 'Số điện thoại không hợp lệ.';
    if (form.expertise.trim().length < 2) return 'Vui lòng nhập chuyên môn chính.';
    if (!Number.isInteger(Number(form.experienceYears)) || Number(form.experienceYears) < 0) return 'Số năm kinh nghiệm phải là số nguyên không âm.';
    if (form.bio.trim().length < 10) return 'Giới thiệu bản thân cần ít nhất 10 ký tự.';
    if (form.courseTitle.trim().length < 2) return 'Tên khóa học mẫu cần ít nhất 2 ký tự.';
    if (form.courseCategory.trim().length < 2) return 'Danh mục khóa học cần ít nhất 2 ký tự.';
    if (form.courseDescription.trim().length < 10) return 'Mô tả khóa học cần ít nhất 10 ký tự.';
    if (!isValidOptionalUrl(form.website) || !isValidOptionalUrl(form.linkedin) || !isValidOptionalUrl(form.youtube)) {
      return 'Các liên kết phải bắt đầu bằng http:// hoặc https://.';
    }
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
      website: optionalUrl(form.website),
      linkedin: optionalUrl(form.linkedin),
      youtube: optionalUrl(form.youtube),
    });

    if (result.success) {
      toast('success', 'Đã gửi hồ sơ giảng viên');
      const statusRes = await getMyPendingInstructorRequestAction();
      setExistingRequest(statusRes.request);
    } else {
      const message = result.message || 'Không thể gửi hồ sơ. Vui lòng thử lại.';
      setError(message);
      toast('error', 'Gửi hồ sơ thất bại', message);
    }

    setIsSubmitting(false);
  };

  const enterStudio = async () => {
    const refreshed = await forceRefreshSessionAction();
    if (refreshed.success && refreshed.user && refreshed.accessToken) {
      dispatch(setUser({ user: refreshed.user, accessToken: refreshed.accessToken }));
      router.push('/instructor');
      return;
    }
    toast('error', 'Cần đăng nhập lại', refreshed.message || 'Phiên hiện tại chưa nhận role giảng viên mới.');
    router.push('/login');
  };

  const requestStatus = normalizeStatus(existingRequest?.status);

  if (isCheckingStatus) {
    return (
      <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="mr-2 size-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Đang kiểm tra trạng thái hồ sơ...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
      <CardHeader className="relative space-y-3 px-6 pb-2 pt-8 text-center sm:px-10 sm:text-left">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Sparkles className="size-6 text-primary" />
          Trở thành giảng viên
        </CardTitle>
        <CardDescription className="text-base font-medium text-muted-foreground">
          Điền hồ sơ để đội ngũ quản trị đánh giá chuyên môn, kinh nghiệm và ý tưởng khóa học của bạn.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative space-y-6 px-6 pb-6 sm:px-10">
        {existingRequest && (
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span className="font-semibold text-foreground">Hồ sơ gần nhất</span>
              {requestStatus === 'PENDING' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                  <Clock3 className="size-3.5" /> Đang chờ duyệt
                </span>
              )}
              {requestStatus === 'APPROVED' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="size-3.5" /> Đã duyệt
                </span>
              )}
              {requestStatus === 'REJECTED' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                  <AlertCircle className="size-3.5" /> Đã từ chối
                </span>
              )}
            </div>

            {requestStatus === 'PENDING' && (
              <p className="text-sm text-muted-foreground">
                Hồ sơ của bạn đang được xem xét. Admin sẽ thấy đơn trong trang quản lý và bạn sẽ nhận thông báo khi có kết quả.
              </p>
            )}
            {requestStatus === 'APPROVED' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-emerald-700">
                  Hồ sơ đã được duyệt. Hãy vào Studio để tạo khóa học đầu tiên.
                </p>
                <Button onClick={enterStudio} className="w-fit gap-2 font-bold shadow-lg shadow-primary/20">
                  Vào Instructor Studio
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            )}
            {requestStatus === 'REJECTED' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-700">Hồ sơ trước đó chưa được duyệt. Bạn có thể chỉnh thông tin và gửi lại.</p>
                {existingRequest.rejectionReason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Lý do từ chối: {existingRequest.rejectionReason}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {canShowForm && (
          <>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              <p className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Quy trình xét duyệt
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  'Gửi hồ sơ ứng tuyển giảng viên.',
                  'Admin xem xét chuyên môn và ý tưởng khóa học.',
                  'Khi được duyệt, bạn nhận thông báo và vào Studio.',
                  'Tạo, hoàn thiện và xuất bản khóa học đầu tiên.',
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
              <Field id="instructor-full-name" label="Họ và tên" value={form.fullName} onChange={(value) => updateField('fullName', value)} />
              <Field id="instructor-phone" label="Số điện thoại" value={form.phone} onChange={(value) => updateField('phone', value)} placeholder="VD: 0901234567" />
              <Field id="instructor-expertise" label="Chuyên môn chính" value={form.expertise} onChange={(value) => updateField('expertise', value)} placeholder="VD: Lập trình Frontend" />
              <Field id="instructor-experience" label="Số năm kinh nghiệm" type="number" value={form.experienceYears} onChange={(value) => updateField('experienceYears', value)} />
              <Field id="instructor-specialization" label="Lĩnh vực chuyên sâu" value={form.specialization} onChange={(value) => updateField('specialization', value)} placeholder="VD: React, Next.js, UI Architecture" />
              <Field id="instructor-current-job" label="Công việc hiện tại" value={form.currentJob} onChange={(value) => updateField('currentJob', value)} placeholder="VD: Senior Frontend Engineer" />

              <TextareaField id="instructor-bio" label="Giới thiệu bản thân" value={form.bio} onChange={(value) => updateField('bio', value)} placeholder="Nêu kinh nghiệm giảng dạy, dự án đã làm và thế mạnh chuyên môn." />
              <Field id="instructor-course-title" label="Tên khóa học dự kiến" value={form.courseTitle} onChange={(value) => updateField('courseTitle', value)} placeholder="VD: Next.js thực chiến" />
              <Field id="instructor-course-category" label="Danh mục khóa học" value={form.courseCategory} onChange={(value) => updateField('courseCategory', value)} placeholder="VD: Lập trình Web" />
              <TextareaField id="instructor-course-description" label="Mô tả khóa học" value={form.courseDescription} onChange={(value) => updateField('courseDescription', value)} placeholder="Mô tả mục tiêu, nội dung chính và kết quả học viên đạt được." />
              <Field id="instructor-target-students" label="Đối tượng học viên" value={form.targetStudents} onChange={(value) => updateField('targetStudents', value)} placeholder="VD: Người mới học lập trình, sinh viên CNTT" className="md:col-span-2" />
              <Field id="instructor-website" label="Website cá nhân" value={form.website} onChange={(value) => updateField('website', value)} placeholder="https://..." />
              <Field id="instructor-linkedin" label="LinkedIn" value={form.linkedin} onChange={(value) => updateField('linkedin', value)} placeholder="https://linkedin.com/in/..." />
              <Field id="instructor-youtube" label="YouTube hoặc kênh demo" value={form.youtube} onChange={(value) => updateField('youtube', value)} placeholder="https://..." className="md:col-span-2" />
            </div>

            <Button type="button" onClick={onSubmit} disabled={isSubmitting} className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20 md:max-w-xs">
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

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}
