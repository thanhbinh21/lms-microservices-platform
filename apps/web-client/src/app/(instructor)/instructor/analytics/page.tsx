'use client';

import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, BarChart3, Sparkles, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getInstructorEarningsSummaryAction, getInstructorEarningsAction, type InstructorEarningsSummary, type InstructorEarningDto } from '@/app/actions/instructor';

interface ChartBar {
  label: string;
  value: number;
}

function SimpleBarChart({ data, maxValue }: { data: ChartBar[]; maxValue: number }) {
  if (data.length === 0 || maxValue === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl bg-gradient-to-br from-primary/5 to-transparent text-sm font-medium text-muted-foreground">
        ChÆ°a cÃ³ dá»¯ liá»‡u doanh thu
      </div>
    );
  }

  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((bar, i) => {
        const heightPct = maxValue > 0 ? Math.max((bar.value / maxValue) * 100, bar.value > 0 ? 8 : 0) : 0;
        const isHighest = bar.value === maxValue && bar.value > 0;
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center gap-1">
            <div className="w-full">
              <div
                className={`w-full rounded-t-md transition-all ${isHighest ? 'bg-amber-400' : 'bg-primary/70 hover:bg-primary'}`}
                style={{ height: `${heightPct}%`, minHeight: bar.value > 0 ? '4px' : '0' }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {bar.value.toLocaleString('vi-VN')}Ä‘
              </div>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground">{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function InstructorAnalyticsPage() {
  const [summary, setSummary] = useState<InstructorEarningsSummary | null>(null);
  const [earnings, setEarnings] = useState<InstructorEarningDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEarnings() {
      const [summaryRes, earningsRes] = await Promise.all([
        getInstructorEarningsSummaryAction(),
        getInstructorEarningsAction(),
      ]);
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
      if (earningsRes.success && earningsRes.data) setEarnings(earningsRes.data);
      setLoading(false);
    }
    void loadEarnings();
  }, []);

  const chartData = useMemo(() => {
    const now = new Date();
    const months: ChartBar[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' });
      months.push({ label, value: 0 });
    }

    for (const earning of earnings) {
      const d = new Date(earning.createdAt);
      const monthDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthDiff >= 0 && monthDiff < 6) {
        const idx = 5 - monthDiff;
        if (idx >= 0 && idx < months.length) {
          months[idx].value += earning.netAmount;
        }
      }
    }

    return months;
  }, [earnings]);

  const maxValue = useMemo(() => Math.max(...chartData.map((b) => b.value), 0), [chartData]);

  const totalEarned = summary?.totalEarned ?? 0;
  const availableBalance = summary?.availableBalance ?? 0;

  const isLoading = loading;

  return (
    <div className="workspace-page">
      {/* Page header */}
      <div className="workspace-page-header">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          NexEdu Studio
        </div>
        <h1 className="workspace-page-title">PhÃ¢n tÃ­ch</h1>
        <p className="workspace-page-description">
          Theo dÃµi doanh thu, lÆ°á»£t xem vÃ  tÄƒng trÆ°á»Ÿng há»c viÃªn.
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Thu nháº­p kháº£ dá»¥ng',
            value: isLoading ? '...' : (availableBalance > 0 ? availableBalance.toLocaleString('vi-VN') + ' Ä‘' : '0 Ä‘'),
            note: 'CÃ³ thá»ƒ rÃºt ngay',
            icon: Wallet,
            highlight: availableBalance > 0,
          },
          {
            label: 'Tá»•ng thu nháº­p',
            value: isLoading ? '...' : (totalEarned > 0 ? totalEarned.toLocaleString('vi-VN') + ' Ä‘' : '0 Ä‘'),
            note: 'Sau khi trá»« phÃ­ 30%',
            icon: TrendingUp,
          },
          {
            label: 'ÄÆ¡n hÃ ng',
            value: isLoading ? '...' : (summary?.totalOrders ?? 0).toLocaleString('vi-VN'),
            note: 'ÄÆ¡n Ä‘Ã£ hoÃ n táº¥t',
            icon: BarChart3,
          },
        ].map((row) => (
          <Card
            key={row.label}
            className={`rounded-2xl border-white/60 bg-white/50 backdrop-blur-md ${row.highlight ? 'border-amber-200/60' : ''}`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-[11px] font-bold uppercase tracking-[0.15em]">{row.label}</CardDescription>
              <div className={`flex size-8 items-center justify-center rounded-lg ${row.highlight ? 'bg-amber-100 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                <row.icon className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{row.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{row.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="rounded-2xl border-white/60 bg-white/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base">Doanh thu 6 thÃ¡ng gáº§n nháº¥t</CardTitle>
          <CardDescription className="text-xs">
            {earnings.length > 0
              ? `Dá»±a trÃªn ${earnings.length} giao dá»‹ch Ä‘Ã£ hoÃ n táº¥t. ÄÃ£ trá»« phÃ­ platform 30%.`
              : 'ChÆ°a cÃ³ giao dá»‹ch nÃ o Ä‘Æ°á»£c ghi nháº­n.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-44 items-center justify-center">
              <div className="text-sm text-muted-foreground animate-pulse">Äang táº£i biá»ƒu Ä‘á»“...</div>
            </div>
          ) : (
            <SimpleBarChart data={chartData} maxValue={maxValue} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}


