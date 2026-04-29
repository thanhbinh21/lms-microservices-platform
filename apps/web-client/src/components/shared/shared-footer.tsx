import Image from 'next/image';
import Link from 'next/link';

export function SharedFooter() {
  return (
    <footer className="glass-panel relative z-10 border-t border-white/55 px-4 py-16 md:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-4">
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center gap-3">
            <Image src="/nexedu-logo.svg" alt="Logo NexEdu" width={44} height={44} />
            <p className="token-section-title">NexEdu Academy</p>
          </div>
          <p className="token-body max-w-md leading-relaxed">
            Nền tảng học tập linh hoạt, giúp định hình năng lực nghề nghiệp bằng trải nghiệm học tập thực tế và bám sát doanh nghiệp.
          </p>
        </div>

        <div>
          <p className="mb-4 text-base font-medium text-foreground">Về NexEdu</p>
          <ul className="space-y-3 text-sm text-muted-foreground font-medium">
            <li><Link href="/about" className="hover:text-primary transition-colors">Giới thiệu</Link></li>
            <li><Link href="/instructors" className="hover:text-primary transition-colors">Đội ngũ chuyên gia</Link></li>
            <li><Link href="/careers" className="hover:text-primary transition-colors">Tuyển dụng</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-4 text-base font-medium text-foreground">Hỗ trợ</p>
          <ul className="space-y-3 text-sm text-muted-foreground font-medium">
            <li><Link href="/help" className="hover:text-primary transition-colors">Trung tâm trợ giúp</Link></li>
            <li><Link href="/help" className="hover:text-primary transition-colors">Liên hệ tư vấn</Link></li>
            <li><Link href="/terms" className="hover:text-primary transition-colors">Điều khoản sử dụng</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-16 flex w-full max-w-6xl flex-col items-center justify-between border-t border-primary/10 pt-8 text-xs font-medium text-muted-foreground md:flex-row">
        <p>© 2026 NexEdu Academy. All rights reserved.</p>
        <div className="mt-4 flex gap-6 md:mt-0">
          <Link href="/privacy" className="hover:text-primary transition-colors">Chính sách bảo mật</Link>
          <Link href="#" className="hover:text-primary transition-colors">Cookie</Link>
        </div>
      </div>
    </footer>
  );
}
