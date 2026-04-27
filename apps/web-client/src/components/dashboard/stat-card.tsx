import { Card, CardContent } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  delay?: number;
}

export function StatCard({ label, value, icon: Icon, colorClass, bgClass, delay = 0 }: StatCardProps) {
  return (
    <ScrollReveal delay={delay}>
      <Card className="glass-panel rounded-2xl border-white/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 pointer-events-none">
        <CardContent className="p-6 flex items-center gap-4">
          <div className={`size-14 rounded-xl ${bgClass} ${colorClass} flex items-center justify-center shrink-0 shadow-inner`}>
            <Icon className="size-6 stroke-[2]" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
          </div>
        </CardContent>
      </Card>
    </ScrollReveal>
  );
}
