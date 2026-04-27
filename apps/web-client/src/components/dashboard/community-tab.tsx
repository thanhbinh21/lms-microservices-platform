'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { getMyCommunityGroupsAction, type CommunityGroupDto } from '@/app/actions/community';
import { Users, MessageSquare, ArrowRight, Loader2 } from 'lucide-react';

function formatLevel(level: CommunityGroupDto['course']['level']) {
  switch (level) {
    case 'BEGINNER':
      return 'Cơ bản';
    case 'INTERMEDIATE':
      return 'Trung cấp';
    case 'ADVANCED':
      return 'Nâng cao';
    default:
      return level;
  }
}

export function CommunityTab() {
  const [groups, setGroups] = useState<CommunityGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGroups = async () => {
      setLoading(true);
      setError(null);

      const result = await getMyCommunityGroupsAction();
      if (!result.success || !result.data) {
        setError(result.message || 'Khong the tai danh sach nhom');
        setLoading(false);
        return;
      }

      setGroups(result.data.groups);
      setLoading(false);
    };

    void loadGroups();
  }, []);

  if (loading) {
    return (
      <Card className="glass-panel rounded-2xl border-white/60 px-6 py-10">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Dang tai cong dong...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-panel rounded-2xl border-white/60 px-6 py-8">
        <p className="text-sm font-medium text-rose-600">{error}</p>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <ScrollReveal>
        <Card className="glass-panel rounded-2xl border-white/60 py-16 flex flex-col items-center justify-center text-center">
          <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="size-8" />
          </div>
          <h2 className="text-xl font-bold">Ban chua tham gia nhom nao</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Khi ban ghi danh khoa hoc, he thong se tu dong them ban vao nhom thao luan cua khoa hoc do.
          </p>
        </Card>
      </ScrollReveal>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group, idx) => (
        <ScrollReveal key={group.id} delay={idx * 0.04}>
          <Card className="glass-panel rounded-2xl border-white/60 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {formatLevel(group.course.level)}
                </p>
                <h3 className="text-lg font-bold text-slate-800">{group.name}</h3>
                <p className="text-sm text-muted-foreground">{group.course.title}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    {group.memberCount} thanh vien
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3.5" />
                    {group.postCount} bai viet
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link href={`/courses/${group.course.slug}`}>
                  <Button variant="outline" className="rounded-xl">
                    Xem khoa hoc
                  </Button>
                </Link>
                <Link href={`/community/${group.id}`}>
                  <Button className="rounded-xl gap-2">
                    Vao thao luan
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </ScrollReveal>
      ))}
    </div>
  );
}
