import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, PlayCircle, ShieldCheck, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';

const featuredCourses = [
  {
    id: 'course-nextjs',
    title: 'Lộ Trình Fullstack Next.js Và Tailwind CSS',
    category: 'Web Development',
    lessons: 45,
    students: 1200,
    price: '1.299.000đ',
    rating: '4.8',
  },
  {
    id: 'course-python-data',
    title: 'Phân Tích Dữ Liệu Với Python Nâng Cao',
    category: 'Data Science',
    lessons: 60,
    students: 950,
    price: '1.550.000đ',
    rating: '4.9',
  },
  {
    id: 'course-digital-marketing',
    title: 'Digital Marketing: Từ Tư Duy Đến Thực Chiến',
    category: 'Marketing',
    lessons: 32,
    students: 2100,
    price: '990.000đ',
    rating: '4.7',
  },
];

const highlights = [
  {
    id: 'personal-path',
    title: 'Lộ Trình Cá Nhân Hóa',
    description:
      'AI gợi ý lộ trình phù hợp theo mục tiêu, trình độ và quỹ thời gian học của bạn.',
    icon: Sparkles,
  },
  {
    id: 'trusted-certificate',
    title: 'Chứng Chỉ Giá Trị',
    description:
      'Chứng chỉ hoàn thành được thiết kế theo tiêu chuẩn doanh nghiệp và dễ đưa vào hồ sơ nghề nghiệp.',
    icon: ShieldCheck,
  },
  {
    id: 'quality-community',
    title: 'Cộng Đồng Học Tập',
    description:
      'Thảo luận cùng mentor và học viên cùng lĩnh vực để tăng tốc độ phát triển kỹ năng.',
    icon: Users,
  },
];

export default function Home() {
  return (
    <div className="glass-page min-h-screen text-foreground font-sans relative overflow-hidden">
      {/* Decorative background orbs for glass refraction */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-blue-400/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[30%] rounded-full bg-indigo-300/15 blur-[120px] pointer-events-none" />
      
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/50 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo NexEdu" width={32} height={32} priority />
            <span className="text-base font-semibold tracking-tight">NexEdu</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#kham-pha" className="hover:text-primary transition-colors">Khám phá</a>
            <a href="#khoa-hoc" className="hover:text-primary transition-colors">Khóa học</a>
            <a href="#cong-dong" className="hover:text-primary transition-colors">Cộng đồng</a>
            <a href="#ho-tro" className="hover:text-primary transition-colors">Hỗ trợ</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/login">Đăng nhập</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Đăng ký</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section id="kham-pha" className="relative overflow-hidden px-4 py-16 md:px-6 md:py-20">
          <div className="hero-glow pointer-events-none absolute inset-0" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
            <ScrollReveal className="space-y-8">
              <span className="inline-flex rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur-md">
                Nền tảng học tập thế hệ mới
              </span>

              <div className="space-y-4">
                <h1 className="text-balance text-4xl font-semibold leading-tight md:text-6xl">
                  Nâng Tầm Tri Thức Với
                  <span className="text-primary"> Trải Nghiệm </span>
                  Học Tập Tương Lai
                </h1>
                <p className="max-w-xl text-sm text-muted-foreground md:text-base">
                  NexEdu cung cấp hành trình học tập cá nhân hóa cho từng mục tiêu nghề nghiệp. Khám phá kho nội dung
                  thực chiến cùng cộng đồng học viên và mentor chất lượng.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/20">
                  <Link href="/register">
                    Bắt đầu ngay
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2 bg-white/60">
                  <Link href="/login">
                    <PlayCircle className="size-4" />
                    Xem demo
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground md:text-sm">
                <div className="flex -space-x-2">
                  <span className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold shadow-sm">
                    AT
                  </span>
                  <span className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold shadow-sm">
                    HP
                  </span>
                  <span className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold shadow-sm">
                    NL
                  </span>
                </div>
                <p>Hơn 12.000 học viên đã bắt đầu hành trình cùng NexEdu</p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <Card className="glass-panel mx-auto w-full max-w-lg rounded-2xl p-2 border-primary/10">
                <CardHeader className="pb-4 p-2">
                  <div className="aspect-16/10 w-full rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))] border border-white/60 shadow-inner" />
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Phổ biến nhất
                  </span>
                  <CardTitle className="text-xl leading-snug">Kỹ Thuật Thiết Kế UI/UX Nâng Cao</CardTitle>
                  <div className="flex items-center justify-between text-xs text-muted-foreground md:text-sm">
                    <p>Lê Minh Tôn, Senior Product Designer</p>
                    <p className="font-bold text-primary">4.9</p>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </section>

        <section className="border-y border-primary/10 bg-white/70 px-4 py-12 backdrop-blur-md md:px-6 relative z-10 shadow-[0_4px_30px_rgba(0,0,0,0.02)]">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { value: '500+', label: 'Khóa học' },
              { value: '150k', label: 'Học viên' },
              { value: '98%', label: 'Hài lòng' },
              { value: '200+', label: 'Chuyên gia' },
            ].map((item, idx) => (
              <ScrollReveal key={item.label} delay={idx * 100} className="text-center">
                <p className="text-4xl font-bold text-primary drop-shadow-sm">{item.value}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mt-2">{item.label}</p>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section id="khoa-hoc" className="mx-auto w-full max-w-6xl space-y-8 px-4 py-16 md:px-6 relative">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold md:text-3xl">
              Khám Phá Các <span className="text-primary">Khóa Học Nổi Bật</span>
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Chương trình được cập nhật theo xu hướng nghề nghiệp, tập trung vào kỹ năng ứng dụng thực tế.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.map((course, index) => (
              <ScrollReveal key={course.id} delay={index * 150} className="h-full">
                <Card className="glass-panel group rounded-3xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 border-white/60 h-full flex flex-col">
                  <CardHeader className="p-2">
                    <div className="relative aspect-video overflow-hidden rounded-2xl bg-[linear-gradient(120deg,hsl(var(--primary)/0.08),hsl(var(--primary)/0.02))] border border-white/50">
                      <span className="absolute right-3 top-3 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-bold text-primary shadow-sm border border-primary/10">
                        {course.category}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6 pt-4 pb-0 flex-1">
                    <p className="line-clamp-2 text-lg font-bold leading-tight">{course.title}</p>
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span>{course.lessons} bài học</span>
                      <span>{course.students} học viên</span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-2xl font-bold text-primary">{course.price}</p>
                      <p className="text-sm font-bold text-muted-foreground">{course.rating} / 5</p>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-6 mt-auto pb-6 px-6">
                    <Button asChild variant={index === 0 ? 'default' : 'outline'} className="w-full shadow-sm rounded-xl">
                      <Link href="/register">Xem chi tiết</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </ScrollReveal>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 bg-white/50 backdrop-blur-sm border-primary/20 hover:bg-white">
              <Link href="/register">Xem tất cả khóa học</Link>
            </Button>
          </div>
        </section>

        <section id="cong-dong" className="bg-primary/5 px-4 py-20 backdrop-blur-sm md:px-6 border-y border-primary/10 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-400/10 blur-[100px] pointer-events-none" />
          <div className="mx-auto w-full max-w-6xl space-y-12 relative z-10">
            <ScrollReveal className="space-y-4 text-center">
              <h2 className="text-3xl font-bold md:text-4xl shadow-sm inline-block text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/80 pb-1">
                Tại Sao Nên Chọn <span className="text-primary">NexEdu</span>?
              </h2>
              <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
                Môi trường học tập cân bằng giữa lộ trình rõ ràng, cộng đồng chất lượng và kỹ năng thực chiến.
              </p>
            </ScrollReveal>

            <div className="grid gap-6 md:grid-cols-3">
              {highlights.map((item, idx) => (
                <ScrollReveal key={item.id} delay={idx * 150} className="h-full">
                  <Card className="glass-panel rounded-3xl border-white/60 hover:shadow-2xl hover:shadow-primary/15 transition-all duration-500 hover:-translate-y-2 h-full">
                    <CardContent className="space-y-6 p-8">
                      <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-inner border border-white/50">
                        <item.icon className="size-8 stroke-[1.5]" />
                      </div>
                      <h3 className="text-xl font-bold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <ScrollReveal>
          <section className="px-4 py-20 md:px-6 relative z-10" id="ho-tro">
            <div className="mx-auto grid w-full max-w-6xl gap-8 rounded-[3rem] border border-white/40 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.85))] p-8 text-white shadow-2xl shadow-primary/30 md:grid-cols-2 md:p-16 overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none" />
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-900/30 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
              
              <div className="space-y-6 relative z-10">
                <h2 className="text-4xl font-bold leading-tight drop-shadow-md">Sẵn Sàng Kiến Tạo<br/>Tương Lai Của Bạn?</h2>
                <p className="text-base text-white/90 max-w-md">
                  Tham gia cộng đồng hơn 150.000 học viên đang phát triển kỹ năng mỗi ngày tại NexEdu.
                </p>
                <div className="flex flex-wrap gap-4 pt-6">
                  <Button asChild variant="secondary" size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-8 shadow-xl">
                    <Link href="/register">Đăng ký miễn phí</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="rounded-full px-8 border-white/40 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 hover:text-white">
                    <Link href="/login">Liên hệ tư vấn</Link>
                  </Button>
                </div>
              </div>

              <div className="relative hidden items-center justify-center md:flex z-10">
                <Card className="relative w-80 rotate-2 rounded-3xl border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl text-white">
                  <CardContent className="space-y-4 p-8">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center border border-white/30 mb-6">
                      <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-2xl font-bold">Nhóm học tập<br/>chất lượng cao</p>
                    <p className="text-sm text-white/80 leading-relaxed">
                      Kết nối mentor và học viên theo từng mục tiêu nghề nghiệp cụ thể và bám sát thực tế thị trường.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </main>

      <footer className="border-t border-primary/10 bg-white/80 backdrop-blur-xl px-4 py-16 md:px-6 relative z-10">
        <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-4">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Logo NexEdu" width={32} height={32} />
              <p className="text-xl font-bold">NexEdu Academy</p>
            </div>
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              Nền tảng học tập linh hoạt, giúp định hình năng lực nghề nghiệp bằng trải nghiệm học tập thực tế và bám sát doanh nghiệp.
            </p>
          </div>

          <div>
            <p className="mb-4 text-base font-bold text-foreground">Về NexEdu</p>
            <ul className="space-y-3 text-sm text-muted-foreground font-medium">
              <li><Link href="#" className="hover:text-primary transition-colors">Giới thiệu</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Đội ngũ chuyên gia</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Tuyển dụng</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-4 text-base font-bold text-foreground">Hỗ trợ</p>
            <ul className="space-y-3 text-sm text-muted-foreground font-medium">
              <li><Link href="#" className="hover:text-primary transition-colors">Trung tâm trợ giúp</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Liên hệ tư vấn</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Điều khoản sử dụng</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mx-auto w-full max-w-6xl mt-16 pt-8 border-t border-primary/10 flex flex-col md:flex-row items-center justify-between text-xs font-medium text-muted-foreground">
          <p>© 2026 NexEdu Academy. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="#" className="hover:text-primary transition-colors">Chính sách bảo mật</Link>
            <Link href="#" className="hover:text-primary transition-colors">Cookie</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
