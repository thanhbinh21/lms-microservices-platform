import { SlidersHorizontal } from 'lucide-react';
import { PublicPageHeader, PublicPageShell } from '@/components/shared/public-page';

export default function InstructorsLoading() {
  return (
    <PublicPageShell mainClassName="space-y-8 py-10">
      <PublicPageHeader
        centered
        eyebrow="Giảng viên"
        title={<><span className="text-primary">Chuyên gia</span> đồng hành cùng bạn</>}
        description="Khám phá hồ sơ giảng viên, chuyên môn và các khóa học đang được giảng dạy trên NexEdu."
      />

      {/* Placeholder bộ lọc */}
      <div className="glass-panel flex flex-col gap-3 rounded-2xl border-white/70 p-4 lg:flex-row lg:items-center lg:justify-between animate-pulse">
        <div className="h-11 bg-gray-200/60 dark:bg-gray-800/60 rounded-xl flex-1 lg:max-w-lg" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-10 w-24 bg-gray-200/60 dark:bg-gray-800/60 rounded-xl" />
          <div className="h-10 w-32 bg-gray-200/60 dark:bg-gray-800/60 rounded-xl" />
          <div className="h-10 w-20 bg-gray-200/60 dark:bg-gray-800/60 rounded-xl" />
        </div>
      </div>

      {/* Grid skeleton profiles */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="glass-panel h-[380px] rounded-2xl border-white/70 p-6 flex flex-col justify-between animate-pulse">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Avatar placeholder */}
              <div className="size-24 rounded-full bg-gray-200/60 dark:bg-gray-800/60 border-4 border-white" />
              
              {/* Name placeholder */}
              <div className="h-5 w-32 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg" />
              
              {/* Headline placeholder */}
              <div className="h-4 w-40 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg" />
              
              {/* Bio placeholder */}
              <div className="space-y-2 w-full">
                <div className="h-3 w-full bg-gray-200/60 dark:bg-gray-800/60 rounded-lg" />
                <div className="h-3 w-5/6 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg mx-auto" />
                <div className="h-3 w-4/5 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg mx-auto" />
              </div>
            </div>

            {/* Footer metrics & CTA placeholders */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 border-t border-white/60 pt-4">
                <div className="space-y-2">
                  <div className="h-5 w-8 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg mx-auto" />
                  <div className="h-3 w-12 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg mx-auto" />
                </div>
                <div className="space-y-2">
                  <div className="h-5 w-8 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg mx-auto" />
                  <div className="h-3 w-12 bg-gray-200/60 dark:bg-gray-800/60 rounded-lg mx-auto" />
                </div>
              </div>
              
              <div className="h-10 w-full bg-gray-200/60 dark:bg-gray-800/60 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </PublicPageShell>
  );
}
