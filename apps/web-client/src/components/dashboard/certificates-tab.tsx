import { Card } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { Award, Sparkles } from 'lucide-react';

export function CertificatesTab() {
  return (
    <ScrollReveal>
      <Card className="glass-panel rounded-2xl border-white/60 py-20 flex flex-col items-center justify-center text-center">
        <div className="size-20 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6 shadow-inner">
          <Award className="size-10" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Chứng chỉ đạt được</h2>
        <p className="text-muted-foreground text-sm font-medium max-w-md mb-2 leading-relaxed">
          Tính năng chứng chỉ sẽ sớm được triển khai. Hoàn thành các khóa học để nhận chứng chỉ xác nhận năng lực!
        </p>
        <div className="flex items-center gap-2 mt-4 text-sm font-semibold text-amber-600">
          <Sparkles className="size-4" />
          Sắp ra mắt
        </div>
      </Card>
    </ScrollReveal>
  );
}
