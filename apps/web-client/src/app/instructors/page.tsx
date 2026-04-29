import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import { listInstructorsAction } from '@/app/actions/instructor';
import { UserCircle, Search } from 'lucide-react';
import Link from 'next/link';

export default async function InstructorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const q = params.q || '';
  const sortBy = params.sortBy || 'name';

  const result = await listInstructorsAction(page, 20, q, sortBy);
  const items = result.success && result.data ? result.data.items : [];
  
  return (
    <div className="glass-page min-h-screen text-foreground pb-24 relative overflow-hidden">
      <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] left-[-10%] w-[35%] h-[40%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      <SharedNavbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-12 md:px-8 relative z-10 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Đội ngũ giảng viên</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Khám phá các khóa học chất lượng từ những chuyên gia hàng đầu trong ngành.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-3xl bg-white/40">
            <UserCircle className="size-12 text-slate-300 mb-4" />
            <p className="text-lg font-medium text-slate-600">Không tìm thấy giảng viên nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map(instructor => (
              <Link key={instructor.id} href={`/instructors/${instructor.slug}`}>
                <div className="group rounded-3xl border border-white/60 bg-white/60 p-6 backdrop-blur-md transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative size-24 overflow-hidden rounded-full border border-slate-100 bg-slate-50">
                      {instructor.avatar ? (
                         // eslint-disable-next-line @next/next/no-img-element
                        <img src={instructor.avatar} alt={instructor.displayName} className="size-full object-cover transition-transform group-hover:scale-110" />
                      ) : (
                        <UserCircle className="size-full text-slate-300" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{instructor.displayName}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{instructor.headline || 'Giảng viên NexEdu'}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-semibold text-slate-600 pt-2 border-t w-full justify-center">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-slate-900">{instructor.courseCount}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Khóa học</span>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-emerald-600">{instructor.averageRating.toFixed(1)}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Đánh giá</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <SharedFooter />
    </div>
  );
}
