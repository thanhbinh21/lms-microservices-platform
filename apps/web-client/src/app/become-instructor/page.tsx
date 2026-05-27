import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SharedNavbar } from '@/components/shared/shared-navbar';
import { SharedFooter } from '@/components/shared/shared-footer';
import BecomeInstructorForm from '@/components/instructor/BecomeInstructorForm';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Button } from '@/components/ui/button';

export default function BecomeInstructorPage() {
  return (
    <div className="glass-page relative min-h-screen overflow-hidden font-sans text-foreground">
      <SharedNavbar />

      <main className="relative z-10">
        <section className="relative overflow-hidden px-4 pb-12 pt-8 md:px-8 md:pb-16 md:pt-10">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-4">
                  <Button asChild variant="ghost" className="w-fit gap-2 rounded-full px-0 font-semibold text-muted-foreground hover:text-primary">
                    <Link href="/">
                      <ArrowLeft className="size-4" />
                      Về trang chủ
                    </Link>
                  </Button>
                  <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur-md">
                    Chương trình Educator NexEdu
                  </span>
                  <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
                    Trở thành <span className="text-primary">giảng viên</span> trên NexEdu
                  </h1>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                    Chia sẻ chuyên môn, xây dựng khóa học chất lượng và đồng hành cùng học viên. Gửi hồ sơ để admin xét duyệt trước khi bạn vào Instructor Studio.
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <BecomeInstructorForm />
            </ScrollReveal>
          </div>
        </section>
      </main>

      <SharedFooter />
    </div>
  );
}
