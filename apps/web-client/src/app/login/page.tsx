import Image from 'next/image';
import Link from 'next/link';
import LoginForm from '@/components/auth/LoginForm';
import { ScrollReveal } from '@/components/ui/scroll-reveal';

export default function LoginPage() {
  return (
    <div className="glass-page min-h-screen text-foreground font-sans relative overflow-hidden flex">
      {/* Decorative glass background orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[60%] rounded-full bg-blue-300/15 blur-[120px] pointer-events-none" />

      {/* Left Branding Side (Hidden on Mobile, Visible on LG screens) */}
      <div className="hidden lg:flex w-[55%] relative z-10 flex-col justify-center px-16 xl:px-24">
        <ScrollReveal className="space-y-8">
          <Link href="/" className="flex items-center gap-3 mb-10 inline-flex w-fit hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="NexEdu Logo" width={56} height={56} priority />
            <span className="text-3xl font-bold tracking-tight">NexEdu</span>
          </Link>
          
          <div className="space-y-4">
            <h1 className="text-5xl font-bold leading-tight drop-shadow-sm text-balance">
              Trở Lại Với <span className="text-primary">Hành Trình</span><br />Học Tập Của Bạn
            </h1>
            <p className="text-lg text-muted-foreground font-medium leading-relaxed max-w-lg">
              Đăng nhập để tiếp tục lộ trình học tập được cá nhân hóa, đồng hành cùng mentor chuyên gia và bám sát vào thực tiễn doanh nghiệp.
            </p>
          </div>

          <div className="pt-6 flex flex-col gap-3">
            <div className="flex -space-x-3">
              <span className="inline-flex size-12 items-center justify-center rounded-full border-[3px] border-white bg-green-100 text-sm font-semibold shadow-sm text-green-700">AT</span>
              <span className="inline-flex size-12 items-center justify-center rounded-full border-[3px] border-white bg-blue-100 text-sm font-semibold shadow-sm text-blue-700">HP</span>
              <span className="inline-flex size-12 items-center justify-center rounded-full border-[3px] border-white bg-purple-100 text-sm font-semibold shadow-sm text-purple-700">NL</span>
              <span className="inline-flex size-12 items-center justify-center rounded-full border-[3px] border-white bg-primary/10 text-sm font-bold shadow-sm text-primary">+15k</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground pl-2">
              Chào mừng bạn hòa nhịp cùng hơn 150.000 học viên tại NexEdu Academy.
            </p>
          </div>
        </ScrollReveal>
      </div>

      {/* Right Form Side */}
      <div className="w-full lg:w-[45%] flex items-center justify-center relative z-10 px-4 sm:px-10 py-12">
        {/* Mobile Logo Fallback */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="NexEdu Logo" width={32} height={32} priority />
            <span className="text-xl font-bold tracking-tight">NexEdu</span>
          </Link>
        </div>

        <ScrollReveal delay={150} className="w-full max-w-[420px]">
           <LoginForm />
        </ScrollReveal>
      </div>
    </div>
  );
}
