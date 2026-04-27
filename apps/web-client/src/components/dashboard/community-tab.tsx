import { Card } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Users, Sparkles } from 'lucide-react';

export function CommunityTab() {
  return (
    <ScrollReveal>
      <Card className="glass-panel rounded-2xl border-white/60 py-20 flex flex-col items-center justify-center text-center">
        <div className="size-20 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6 shadow-inner">
          <Users className="size-10" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Cộng đồng học tập</h2>
        <p className="text-muted-foreground text-sm font-medium max-w-md mb-2 leading-relaxed">
          Kết nối với học viên khác, trao đổi kiến thức và cùng nhau phát triển. Tính năng đang được phát triển!
        </p>
        <div className="flex items-center gap-2 mt-4 text-sm font-semibold text-purple-600">
          <Sparkles className="size-4" />
          Sắp ra mắt
        </div>
      </Card>
    </ScrollReveal>
  );
}
