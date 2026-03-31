'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Image as ImageIcon, List, Settings } from 'lucide-react';
import Link from 'next/link';
import { getCourseByIdAction, updateCourseAction, type CourseDto } from '@/app/actions/instructor';

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
    const courseId = String(params.courseId);
    await updateCourseAction(courseId, {
      title,
      description,
      price: Number(price),
      thumbnail: thumbnail.trim() || null,
    });
    setIsSaving(false);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    const courseId = String(params.courseId);

    const result = await updateCourseAction(courseId, {
      title,
      description,
      price: Number(price),
      thumbnail: thumbnail.trim() || null,
      status: 'PUBLISHED',
    });

    if (!result.success) {
      window.alert(result.message);
      setIsPublishing(false);
      return;
    }

    setCourse((prev) => (prev ? { ...prev, status: 'PUBLISHED' } : prev));
    setIsPublishing(false);
    window.alert('Da xuat ban khoa hoc thanh cong');
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
              <div className="aspect-video rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500">
                <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                <span className="text-sm font-bold">Dán URL ảnh bìa (16:9)</span>
              </div>
              <Input
                value={thumbnail}
                onChange={(event) => setThumbnail(event.target.value)}
                className="h-11 rounded-xl bg-white/70"
                placeholder="https://..."
              />
              {thumbnail.trim() && (
                <img
                  src={thumbnail}
                  alt="thumbnail preview"
                  className="w-full aspect-video rounded-xl object-cover border border-slate-200"
                />
              )}
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
                disabled={isPublishing || (course.status || 'DRAFT') === 'PUBLISHED'}
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
