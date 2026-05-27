import Link from 'next/link';
import { AlertCircle, UserCircle, GraduationCap, Star } from 'lucide-react';
import { listInstructorsAction } from '@/app/actions/instructor';
import { Button } from '@/components/ui/button';
import { PublicPageHeader, PublicPageShell, PublicState } from '@/components/shared/public-page';
import { InstructorAvatar } from '@/components/shared/instructor-avatar';
import { InstructorFilters } from '@/components/shared/instructor-filters';

export default async function InstructorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const q = params.q || '';
  const sortBy = params.sortBy || 'newest';

  const result = await listInstructorsAction(page, 20, q, sortBy);
  const items = result.success && result.data ? result.data.items : [];

  return (
    <PublicPageShell mainClassName="space-y-8 py-10">
      <PublicPageHeader
        centered
        eyebrow="Giảng viên"
        title={<><span className="text-primary">Chuyên gia</span> đồng hành cùng bạn</>}
        description="Khám phá hồ sơ giảng viên, chuyên môn và các khóa học đang được giảng dạy trên NexEdu."
      />

      {/* Bộ lọc tìm kiếm và sắp xếp - Client Component quản lý trạng thái URL */}
      <InstructorFilters initialQ={q} initialSortBy={sortBy} />

      {q ? (
        <p className="text-sm font-medium text-muted-foreground">
          Kết quả tìm kiếm cho <span className="font-bold text-foreground">&ldquo;{q}&rdquo;</span>
        </p>
      ) : null}

      {/* TRẠNG THÁI 1: Lỗi gọi API kết nối hệ thống */}
      {!result.success ? (
        <div className="glass-panel rounded-2xl border-red-200/50 bg-red-50/10 p-10 text-center max-w-md mx-auto space-y-4">
          <div className="mx-auto size-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Không thể tải danh sách giảng viên</h2>
          <p className="text-sm text-muted-foreground">
            {result.message || 'Đã xảy ra sự cố kết nối tới máy chủ. Vui lòng tải lại hoặc thử lại sau.'}
          </p>
          <Button asChild className="rounded-xl font-semibold shadow-md shadow-primary/10">
            <Link href="/instructors">Thử lại</Link>
          </Button>
        </div>
      ) : null}

      {/* TRẠNG THÁI 2: Không có dữ liệu giảng viên */}
      {result.success && items.length === 0 ? (
        <PublicState
          icon={UserCircle}
          title={q ? 'Không tìm thấy giảng viên phù hợp' : 'Chưa có giảng viên công khai'}
          description={q ? 'Thử tìm bằng tên khác hoặc bỏ bộ lọc tìm kiếm.' : 'Bạn có thể trở thành giảng viên đầu tiên và xây dựng khóa học trên NexEdu.'}
          action={
            <Button asChild className="rounded-xl font-semibold">
              <Link href="/become-instructor">
                <GraduationCap className="mr-2 size-4" />
                Trở thành giảng viên
              </Link>
            </Button>
          }
        />
      ) : null}

      {/* TRẠNG THÁI 3: Hiển thị danh sách giảng viên thành công */}
      {result.success && items.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((instructor) => (
            <Link key={instructor.id} href={`/instructors/${instructor.slug}`} className="group">
              <article className="glass-panel glass-card-hover h-full rounded-2xl border-white/70 p-6 flex flex-col justify-between">
                <div className="flex flex-col items-center text-center">
                  {/* Sử dụng InstructorAvatar Client Component để chống crash lỗi ảnh */}
                  <div className="relative size-24 overflow-hidden rounded-full border-4 border-white bg-white shadow-sm flex items-center justify-center">
                    <InstructorAvatar
                      src={instructor.avatar}
                      alt={instructor.displayName}
                      className="size-full object-cover"
                      fallbackClassName="size-full text-primary/30"
                    />
                  </div>
                  <h2 className="mt-4 line-clamp-1 text-lg font-bold transition-colors group-hover:text-primary">{instructor.displayName}</h2>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs font-bold text-primary tracking-wide uppercase">
                    {instructor.headline || 'Giảng viên NexEdu'}
                  </p>
                  
                  {/* Phần giới thiệu ngắn - bio */}
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground/80 min-h-[3rem] text-justify leading-relaxed">
                    {instructor.bio || 'Chưa có thông tin giới thiệu chi tiết.'}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="grid grid-cols-2 gap-3 border-t border-white/60 pt-4 text-center">
                    <div>
                      <p className="text-lg font-extrabold">{instructor.courseCount}</p>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Khóa học</p>
                    </div>
                    <div>
                      <p className="inline-flex items-center justify-center gap-1 text-lg font-extrabold text-amber-600">
                        <Star className="size-4 fill-current" />
                        {instructor.averageRating.toFixed(1)}
                      </p>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Đánh giá</p>
                    </div>
                  </div>
                  
                  {/* Nút Xem hồ sơ kích hoạt hiệu ứng hover cùng Card */}
                  <div className="mt-5 w-full">
                    <Button
                      variant="outline"
                      className="w-full h-10 rounded-xl text-xs font-bold tracking-wide transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary shadow-sm"
                    >
                      Xem hồ sơ
                    </Button>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : null}
    </PublicPageShell>
  );
}
