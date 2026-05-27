'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2, Save, Upload, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  confirmMediaUploadAction,
  getMyInstructorProfileAction,
  requestMediaUploadAction,
  updateMyInstructorProfileAction,
  type InstructorProfileDto,
} from '@/app/actions/instructor';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}

function validateUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateProfile(params: { displayName: string; slug: string; socialLinks: Record<string, string> }) {
  if (params.displayName.trim().length < 2) return 'Tên hiển thị phải có ít nhất 2 ký tự.';
  if (params.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.slug.trim())) {
    return 'Slug chỉ dùng chữ thường, số và dấu gạch ngang. Ví dụ: nguyen-van-a.';
  }
  const invalidLink = Object.entries(params.socialLinks).find(([, value]) => value.trim() && !validateUrl(value));
  if (invalidLink) return `Liên kết ${invalidLink[0]} phải bắt đầu bằng http:// hoặc https://.`;
  return '';
}

export default function InstructorProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<InstructorProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [slug, setSlug] = useState('');
  const [avatar, setAvatar] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    website: '',
    facebook: '',
    youtube: '',
    twitter: '',
    linkedin: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getMyInstructorProfileAction();
      if (res.success && res.data) {
        setProfile(res.data);
        setDisplayName(res.data.displayName);
        setHeadline(res.data.headline || '');
        setBio(res.data.bio || '');
        setSlug(res.data.slug || '');
        setAvatar(res.data.avatar || '');
        setSocialLinks({
          website: res.data.socialLinks?.website || '',
          facebook: res.data.socialLinks?.facebook || '',
          youtube: res.data.socialLinks?.youtube || '',
          twitter: res.data.socialLinks?.twitter || '',
          linkedin: res.data.socialLinks?.linkedin || '',
        });
      } else {
        setError(res.message || 'Không thể tải hồ sơ giảng viên.');
      }
      setLoading(false);
    }
    void load();
  }, []);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh hợp lệ.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước ảnh tối đa là 5MB.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      const res = await requestMediaUploadAction({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        type: 'IMAGE',
      });

      if (!res.success || !res.data) throw new Error(res.message || 'Không thể lấy URL upload.');

      const { presignedUrl, mediaId } = res.data;
      let uploadRes: Response;
      if (res.data.uploadMethod === 'POST_FORM' && res.data.uploadFields) {
        const formData = new FormData();
        Object.entries(res.data.uploadFields).forEach(([key, value]) => formData.append(key, value));
        formData.append('file', file);
        uploadRes = await fetch(presignedUrl, { method: 'POST', body: formData });
      } else {
        uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
      }

      if (!uploadRes.ok) throw new Error('Upload ảnh thất bại.');

      const confirmRes = await confirmMediaUploadAction(mediaId);
      if (confirmRes.success && confirmRes.data?.url) {
        setAvatar(confirmRes.data.url);
        toast('success', 'Đã upload ảnh đại diện');
      } else {
        throw new Error(confirmRes.message || 'Không thể xác nhận upload.');
      }
    } catch (uploadError) {
      const message = getErrorMessage(uploadError);
      setError(message);
      toast('error', 'Upload ảnh đại diện thất bại', message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const validationMessage = validateProfile({ displayName, slug, socialLinks });
    if (validationMessage) {
      setError(validationMessage);
      toast('error', 'Hồ sơ chưa hợp lệ', validationMessage);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const res = await updateMyInstructorProfileAction({
        displayName: displayName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        slug: slug.trim(),
        avatar: avatar.trim(),
        socialLinks,
      });

      if (!res.success) {
        const message = res.message || 'Có lỗi xảy ra khi lưu hồ sơ.';
        setError(message);
        toast('error', 'Lưu hồ sơ thất bại', message);
        return;
      }

      setSuccess('Đã lưu hồ sơ giảng viên.');
      toast('success', 'Đã lưu hồ sơ giảng viên');
      if (res.data) {
        setProfile(res.data);
        setSlug(res.data.slug);
      }
      router.refresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (saveError) {
      const message = getErrorMessage(saveError);
      setError(message);
      toast('error', 'Lưu hồ sơ thất bại', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="workspace-page flex h-[60vh] items-center justify-center">
        <Loader2 className="mr-2 size-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Đang tải hồ sơ giảng viên...</span>
      </div>
    );
  }

  const previewSlug = slug || profile?.slug || '';

  return (
    <div className="workspace-page">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <UserCircle className="size-3.5" />
            Hồ sơ giảng viên
          </div>
          <h1 className="workspace-page-title">Hồ sơ công khai</h1>
          <p className="workspace-page-description">
            Cập nhật tên hiển thị, mô tả chuyên môn, avatar và liên kết để học viên hiểu rõ bạn là ai.
          </p>
        </div>
        {previewSlug && (
          <Button asChild variant="outline" className="w-full rounded-xl font-semibold md:w-auto">
            <Link href={`/instructors/${previewSlug}`} target="_blank">
              <ExternalLink className="mr-2 size-4" />
              Xem hồ sơ public
            </Link>
          </Button>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6 pb-20">
          {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}

          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCircle className="size-4 text-primary" />
                <CardTitle className="text-base">Thông tin cơ bản</CardTitle>
              </div>
              <CardDescription className="text-xs">Tên và headline sẽ xuất hiện trên trang khóa học và trang hồ sơ public.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  {avatar ? (
                    // Dùng img để preview ngay URL upload tạm thời từ media service.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="Ảnh đại diện giảng viên" className="size-full object-cover" />
                  ) : (
                    <UserCircle className="size-full text-slate-300" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="size-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-700">Ảnh đại diện</p>
                  <p className="text-xs text-muted-foreground">Khuyến nghị ảnh vuông, tối thiểu 256x256px, tối đa 5MB.</p>
                  <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
                  <Button type="button" variant="outline" size="sm" className="mt-2 text-xs font-semibold" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Upload className="mr-2 size-3.5" />}
                    Tải ảnh lên
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Tên hiển thị <span className="text-destructive">*</span></label>
                  <Input placeholder="VD: Nguyễn Văn A" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">Slug hồ sơ</label>
                  <Input placeholder="VD: nguyen-van-a" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} className="rounded-xl" />
                  <p className="text-[11px] text-muted-foreground">Để trống nếu muốn hệ thống tự tạo. Slug chỉ gồm chữ thường, số và dấu gạch ngang.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Headline</label>
                <Input
                  placeholder="VD: Chuyên gia phát triển phần mềm | Giảng viên lập trình"
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Tiểu sử</label>
                <textarea
                  className="min-h-32 w-full rounded-xl border border-input bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Mô tả kinh nghiệm, kỹ năng, phong cách giảng dạy và kết quả học viên có thể kỳ vọng."
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base">Liên kết mạng xã hội</CardTitle>
              <CardDescription className="text-xs">Chỉ nhập các liên kết muốn hiển thị công khai trên hồ sơ.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[
                ['website', 'Website / Portfolio', 'https://example.com'],
                ['facebook', 'Facebook', 'https://facebook.com/...'],
                ['youtube', 'YouTube', 'https://youtube.com/...'],
                ['linkedin', 'LinkedIn', 'https://linkedin.com/in/...'],
                ['twitter', 'X / Twitter', 'https://x.com/...'],
              ].map(([key, label, placeholder]) => (
                <div key={key} className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground">{label}</label>
                  <Input
                    placeholder={placeholder}
                    value={socialLinks[key as keyof typeof socialLinks]}
                    onChange={(event) => setSocialLinks({ ...socialLinks, [key]: event.target.value })}
                    className="rounded-xl"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => router.back()}>
              Hủy
            </Button>
            <Button className="rounded-xl font-bold" onClick={handleSave} disabled={saving || !displayName.trim()}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Lưu hồ sơ
            </Button>
          </div>
        </div>

        <Card className="h-fit rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base">Preview public</CardTitle>
            <CardDescription className="text-xs">Bản xem nhanh để kiểm tra nội dung trước khi lưu.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-center">
              <div className="mx-auto mb-3 size-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {avatar ? (
                  // Dùng img để preview ngay URL upload tạm thời từ media service.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Preview avatar" className="size-full object-cover" />
                ) : (
                  <UserCircle className="size-full text-slate-300" />
                )}
              </div>
              <p className="text-base font-bold">{displayName || 'Tên giảng viên'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{headline || 'Headline chuyên môn sẽ hiển thị tại đây.'}</p>
              <p className="mt-3 line-clamp-5 text-xs leading-relaxed text-muted-foreground">{bio || 'Tiểu sử giúp học viên hiểu kinh nghiệm và phong cách giảng dạy của bạn.'}</p>
              <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground">
                /instructors/{previewSlug || 'slug-tu-dong'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
