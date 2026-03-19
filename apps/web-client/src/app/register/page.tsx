import Image from 'next/image';
import Link from 'next/link';
import RegisterForm from '@/components/auth/RegisterForm';
import { ScrollReveal } from '@/components/ui/scroll-reveal';

export default function RegisterPage() {
  return (
    <div className="glass-page min-h-screen text-foreground font-sans relative overflow-hidden flex flex-row-reverse">
      {/* Decorative glass background orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[60%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      {/* Right Branding Side (Hidden on Mobile, Visible on LG screens) */}
      <div className="hidden lg:flex w-[55%] relative z-10 flex-col justify-center px-16 xl:px-24 border-l border-white/50 bg-white/20 backdrop-blur-3xl shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
        <ScrollReveal className="space-y-8">
          <Link href="/" className="flex items-center gap-3 mb-10 inline-flex w-fit hover:opacity-80 transition-opacity">
            <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={80} height={80} priority />
            <span className="text-3xl font-bold tracking-tight">NexEdu</span>
          </Link>
          
          <div className="space-y-4">
            <h1 className="text-5xl font-bold leading-tight drop-shadow-sm text-balance">
              Khởi Đầu Mới Cho <br /><span className="text-primary">Sự Nghiệp</span> Của Bạn
            </h1>
            <p className="text-lg text-muted-foreground font-medium leading-relaxed max-w-lg pb-4">
              Tạo tài khoản học viên để truy cập 500+ khóa học chuẩn quốc tế, chứng chỉ doanh nghiệp và cộng đồng hỗ trợ 24/7.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-2">
            {[
              { title: "Lộ Trình Ưu Việt", desc: "Hệ thống AI gợi ý bài học cá nhân hóa." },
              { title: "Giảng Viên Top 1%", desc: "100+ Chuyên gia đến từ các tập đoàn lớn." },
              { title: "Chứng Chỉ Uy Tín", desc: "Hồ sơ năng lực được doanh nghiệp công nhận." },
              { title: "Cộng Đồng Sôi Nổi", desc: "Tương tác và hỏi đáp bài tập trực tiếp." },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1 border-l-2 border-primary/30 pl-4">
                <span className="font-bold text-foreground">{item.title}</span>
                <span className="text-sm font-medium text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>

      {/* Left Form Side */}
      <div className="w-full lg:w-[45%] flex items-center justify-center relative z-10 px-4 sm:px-10 py-12">
        {/* Mobile Logo Fallback */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/nexedu-logo.svg" alt="NexEdu Logo" width={44} height={44} priority />
            <span className="text-xl font-bold tracking-tight">NexEdu</span>
          </Link>
        </div>

        <ScrollReveal delay={150} className="w-full max-w-[420px]">
           <RegisterForm />
        </ScrollReveal>
      </div>
    </div>
  );
}
