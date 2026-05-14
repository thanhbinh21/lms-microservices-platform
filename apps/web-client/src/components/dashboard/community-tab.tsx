'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { MessageSquare, ArrowRight, Users, ThumbsUp } from 'lucide-react';

export function CommunityTab() {
  return (
    <ScrollReveal>
      <Card className="glass-panel rounded-2xl border-white/60 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="size-7" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Cộng đồng toàn hệ thống</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Không còn nhóm riêng theo khóa học. Tất cả học viên, giảng viên và quản trị viên tương tác trong một feed chung để chia sẻ kinh nghiệm, đặt chủ đề thảo luận và bình luận công khai.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1"><Users className="size-3.5" /> Mọi user đã đăng nhập</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1"><ThumbsUp className="size-3.5" /> Bài viết, bình luận, lượt thích</span>
            </div>
          </div>
          <Link href="/community">
            <Button className="gap-2 rounded-xl px-5">
              Vào cộng đồng
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </ScrollReveal>
  );
}
