import Image from 'next/image';
import Link from 'next/link';

export function SharedFooter() {
  return (
    <footer className="border-t border-primary/10 bg-white/80 backdrop-blur-xl px-4 py-16 md:px-6 relative z-10">
      <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-4">
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center gap-3">
            <Image src="/nexedu-logo.svg" alt="Logo NexEdu" width={44} height={44} />
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
  );
}
