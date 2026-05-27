import Image from 'next/image';
import Link from 'next/link';

const footerGroups = [
  {
    title: 'NexEdu',
    links: [
      { label: 'Giới thiệu', href: '/about' },
      { label: 'Khóa học', href: '/courses' },
      { label: 'Giảng viên', href: '/instructors' },
    ],
  },
  {
    title: 'Cộng đồng',
    links: [
      { label: 'Feed học tập', href: '/community' },
      { label: 'Trở thành giảng viên', href: '/become-instructor' },
      { label: 'Tuyển dụng', href: '/careers' },
    ],
  },
  {
    title: 'Hỗ trợ',
    links: [
      { label: 'Trung tâm hỗ trợ', href: '/support' },
      { label: 'Điều khoản sử dụng', href: '/terms' },
      { label: 'Chính sách bảo mật', href: '/privacy' },
    ],
  },
];

export function SharedFooter() {
  return (
    <footer className="glass-panel relative z-10 border-t border-white/55 px-4 py-12 md:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Image src="/nexedu-logo.svg" alt="Logo NexEdu" width={44} height={44} />
            <p className="text-lg font-bold">NexEdu Academy</p>
          </div>
          <p className="max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
            Nền tảng học tập trực tuyến giúp học viên phát triển kỹ năng nghề nghiệp qua khóa học thực chiến,
            mentor chất lượng và cộng đồng học tập tích cực.
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-4 text-sm font-bold text-foreground">{group.title}</p>
            <ul className="space-y-3 text-sm font-medium text-muted-foreground">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-6xl flex-col items-center justify-between gap-3 border-t border-primary/10 pt-6 text-xs font-medium text-muted-foreground md:flex-row">
        <p>© 2026 NexEdu Academy. All rights reserved.</p>
        <div className="flex gap-5">
          <Link href="/privacy" className="hover:text-primary">Bảo mật</Link>
          <Link href="/terms" className="hover:text-primary">Điều khoản</Link>
        </div>
      </div>
    </footer>
  );
}
