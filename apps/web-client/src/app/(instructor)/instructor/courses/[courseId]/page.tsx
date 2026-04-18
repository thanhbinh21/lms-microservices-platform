'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Image as ImageIcon, List, Settings, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import {
  getCourseByIdAction,
  updateCourseAction,
  publishCourseAction,
  requestCourseThumbnailUploadAction,
  confirmLessonUploadAction,
  type CourseDto,
} from '@/app/actions/instructor';
import { StatusMessage } from '@/components/ui/status-message';

export default function CourseSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<CourseDto | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [thumbnail, setThumbnail] = useState('');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [statusMessage, setStatusMessage] = useState('');

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatusType(type);
    setStatusMessage(message);
  };

  useEffect(() => {
    const fetchCourse = async () => {
      const courseId = String(params.courseId);
      const result = await getCourseByIdAction(courseId);
      if (result.success && result.data) {
        setCourse(result.data);
        setTitle(result.data.title);
        setDescription(result.data.description || '');
        setPrice(String(result.data.price));
        setThumbnail(result.data.thumbnail || '');
      }
      setLoading(false);
    };

    fetchCourse();
  }, [params.courseId]);
  
  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage('');

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      showStatus('error', 'Giá bán phải là số lớn hơn hoặc bằng 0.');
      setIsSaving(false);
      return;
    }

    const payload: Partial<CourseDto> = {
      title: title.trim(),
      description: description.trim(),
      price: parsedPrice,
    };

    if (thumbnail.trim()) {
      payload.thumbnail = thumbnail.trim();
    }

    const courseId = String(params.courseId);
    const result = await updateCourseAction(courseId, payload);

    if (!result.success) {
      showStatus('error', result.message || 'Không lưu được thay đổi.');
      setIsSaving(false);
      return;
    }

    if (result.data) {
      setCourse(result.data);
      setTitle(result.data.title);
      setDescription(result.data.description || '');
      setPrice(String(result.data.price));
      setThumbnail(result.data.thumbnail || thumbnail);
    }

    showStatus('success', 'Đã lưu thay đổi khóa học.');
    setIsSaving(false);
  };

  const uploadThumbnail = async (file?: File | null) => {
    if (!file) return;

    const courseId = String(params.courseId);
    setIsUploadingThumbnail(true);
    setStatusMessage('');

    try {
      const presigned = await requestCourseThumbnailUploadAction({
        filename: file.name,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
        courseId,
      });

      if (!presigned.success || !presigned.data) {
        showStatus('error', presigned.message || 'Không tạo được phiên upload ảnh bìa.');
        return;
      }

      if (presigned.data.uploadMethod === 'POST_FORM' && presigned.data.uploadFields) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(presigned.data.uploadFields)) {
          formData.append(key, value);
        }
        formData.append('file', file);

        const uploadResponse = await fetch(presigned.data.presignedUrl, {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) {
          showStatus('error', 'Upload ảnh bìa thất bại.');
          return;
        }
      } else if (presigned.data.presignedUrl.includes('/api/upload/local/')) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadResponse = await fetch(presigned.data.presignedUrl, {
          method: 'PUT',
          body: formData,
        });
        if (!uploadResponse.ok) {
          showStatus('error', 'Upload ảnh bìa thất bại.');
          return;
        }
      } else {
        const uploadResponse = await fetch(presigned.data.presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadResponse.ok) {
          showStatus('error', 'Upload ảnh bìa thất bại.');
          return;
        }
      }

      const confirmed = await confirmLessonUploadAction(presigned.data.mediaId);
      if (!confirmed.success || !confirmed.data?.url) {
        showStatus('error', confirmed.message || 'Không xác nhận được upload ảnh bìa.');
        return;
      }

      setThumbnail(confirmed.data.url);
      showStatus('success', 'Đã upload ảnh bìa. Nhấn "Lưu thay đổi" để cập nhật khóa học.');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setStatusMessage('');
    const courseId = String(params.courseId);

    const result = await publishCourseAction(courseId, thumbnail.trim() || undefined);

    if (!result.success) {
      showStatus('error', result.message || 'Không thể xuất bản khóa học.');
      setIsPublishing(false);
      return;
    }

    setCourse((prev) => (prev ? { ...prev, status: 'PUBLISHED', thumbnail: result.data?.thumbnail ?? prev.thumbnail } : prev));
    setIsPublishing(false);
    showStatus('success', 'Đã xuất bản khóa học thành công.');
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground">Đang tải dữ liệu khóa học...</div>;
  }

  if (!course) {
    return <div className="p-8 text-muted-foreground">Không tìm thấy khóa học.</div>;
  }

  return (
    <div className="p-8">
      <Link href="/instructor/courses" className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit">
        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại danh sách
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thiết lập khóa học</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Hoàn thiện thông tin cơ bản trước khi xuất bản.</p>
        </div>
        <div className="flex gap-4">
           <Button variant="outline" className="rounded-xl font-bold shadow-sm" onClick={() => router.push(`/instructor/courses/${params.courseId}/curriculum`)}>
             <List className="w-4 h-4 mr-2" /> Soạn giáo trình
           </Button>
           <Button className="rounded-xl shadow-md font-bold px-8" onClick={handleSave} disabled={isSaving}>
             {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
           </Button>
        </div>
      </div>

      <div className="mb-6">
        <StatusMessage type={statusType} message={statusMessage} />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Tên & Mô tả */}
          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="size-5" /> Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                 <label className="text-sm font-bold">Tiêu đề khóa học</label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 rounded-xl bg-white/70" />
              </div>
              <div className="space-y-2">
                 <label className="text-sm font-bold">Mô tả khóa học</label>
                 <textarea 
                   className="w-full min-h-30 p-4 rounded-xl bg-white/70 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                   placeholder="Nhập mô tả chi tiết..."
                   value={description}
                   onChange={(event) => setDescription(event.target.value)}
                 />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md shadow-sm">
             <CardHeader>
              <CardTitle>Cấu hình giá bán</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-w-sm">
                 <label className="text-sm font-bold">Giá bán hiện tại (VNĐ)</label>
                  <Input type="number" value={price} onChange={(event) => setPrice(event.target.value)} className="h-12 rounded-xl bg-white/70 font-bold text-lg text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cột phải: Thumbnail & Status */}
        <div className="space-y-8">
          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md shadow-sm">
            <CardHeader>
              <CardTitle>Ảnh bìa (Thumbnail)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="aspect-video rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center text-slate-500">
                {thumbnail.trim() ? (
                  <img
                    src={thumbnail}
                    alt="thumbnail preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                    <span className="text-sm font-bold">Upload ảnh bìa tỷ lệ 16:9</span>
                  </div>
                )}
              </div>
              <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary">
                <UploadCloud className="mr-2 size-4" /> {isUploadingThumbnail ? 'Đang upload...' : 'Chọn ảnh bìa để tải lên'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploadingThumbnail}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    uploadThumbnail(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md shadow-sm">
            <CardHeader>
              <CardTitle>Trạng thái hiển thị</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-200">
                  <p className="font-bold text-sm text-slate-600">{course.status || 'DRAFT'} {(course.status || 'DRAFT') === 'DRAFT' ? '(Bản nháp)' : ''}</p>
                 <p className="text-xs text-slate-500 mt-1">
                   {(course.status || 'DRAFT') === 'PUBLISHED'
                     ? 'Khóa học đang hiển thị với học viên.'
                     : 'Khóa học hiện đang ẩn với học viên.'}
                 </p>
              </div>
              <Button
                className="w-full rounded-xl shadow-md font-bold"
                variant="default"
                onClick={handlePublish}
                disabled={isPublishing || isUploadingThumbnail || (course.status || 'DRAFT') === 'PUBLISHED'}
              >
                 {isPublishing ? 'Đang xuất bản...' : (course.status || 'DRAFT') === 'PUBLISHED' ? 'Đã xuất bản' : 'Xuất bản Khóa học'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
