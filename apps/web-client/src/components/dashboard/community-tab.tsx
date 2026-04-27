'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import {
  getMyCommunityGroupsAction,
  joinCommunityGroupAction,
  type CommunityGroupDto,
} from '@/app/actions/community';
import { Users, MessageSquare, ArrowRight, Loader2, Globe, Lock } from 'lucide-react';

function formatLevel(level: CommunityGroupDto['course'] extends null ? never : NonNullable<CommunityGroupDto['course']>['level']) {
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

function GroupCard({
  group,
  isJoined,
  onJoin,
  joining,
}: {
  group: CommunityGroupDto;
  isJoined: boolean;
  onJoin?: () => void;
  joining?: boolean;
}) {
  const isPublic = group.type === 'PUBLIC';

  return (
    <Card className="glass-panel rounded-2xl border-white/60 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isPublic ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                <Globe className="size-3" />
                Công khai
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                <Lock className="size-3" />
                Riêng tư
              </span>
            )}
            {group.course && (
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                {formatLevel(group.course.level)}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-800">{group.name}</h3>
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}
          {group.course && (
            <p className="text-sm text-muted-foreground">{group.course.title}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {group.memberCount} thành viên
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {group.postCount} bài viết
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {group.course && (
            <Link href={`/courses/${group.course.slug}`}>
              <Button variant="outline" className="rounded-xl">
                Xem khóa học
              </Button>
            </Link>
          )}
          {isJoined ? (
            <Link href={`/community/${group.id}`}>
              <Button className="gap-2 rounded-xl">
                Vào thảo luận
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          ) : (
            <Button
              className="gap-2 rounded-xl"
              onClick={onJoin}
              disabled={joining}
            >
              {joining ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Tham gia
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function CommunityTab() {
  const [joinedGroups, setJoinedGroups] = useState<CommunityGroupDto[]>([]);
  const [publicGroups, setPublicGroups] = useState<CommunityGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);

    const result = await getMyCommunityGroupsAction();
    if (!result.success || !result.data) {
      setError(result.message || 'Không thể tải danh sách nhóm');
      setLoading(false);
      return;
    }

    setJoinedGroups(result.data.joinedGroups);
    setPublicGroups(result.data.publicGroups);
    setLoading(false);
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  const handleJoinPublicGroup = async (groupId: string) => {
    setJoiningGroupId(groupId);
    const result = await joinCommunityGroupAction(groupId);
    setJoiningGroupId(null);

    if (result.success) {
      // Reload danh sach
      await loadGroups();
    } else {
      setError(result.message || 'Không thể tham gia nhóm');
    }
  };

  if (loading) {
    return (
      <Card className="glass-panel rounded-2xl border-white/60 px-6 py-10">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang tải cộng đồng...
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

  const hasNoGroups = joinedGroups.length === 0 && publicGroups.length === 0;

  if (hasNoGroups) {
    return (
      <ScrollReveal>
        <Card className="glass-panel rounded-2xl border-white/60 flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="size-8" />
          </div>
          <h2 className="text-xl font-bold">Chưa có nhóm cộng đồng nào</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Khi bạn ghi danh khóa học, hệ thống sẽ tự động thêm bạn vào nhóm thảo luận
            của khóa học đó. Các nhóm công khai sẽ xuất hiện ở đây khi quản trị viên tạo.
          </p>
        </Card>
      </ScrollReveal>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nhom da tham gia */}
      {joinedGroups.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-700">
            Nhóm đã tham gia ({joinedGroups.length})
          </h3>
          <div className="space-y-4">
            {joinedGroups.map((group, idx) => (
              <ScrollReveal key={group.id} delay={idx * 0.04}>
                <GroupCard group={group} isJoined />
              </ScrollReveal>
            ))}
          </div>
        </div>
      )}

      {/* Nhom cong khai chua tham gia */}
      {publicGroups.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-700">
            Nhóm công khai ({publicGroups.length})
          </h3>
          <div className="space-y-4">
            {publicGroups.map((group, idx) => (
              <ScrollReveal key={group.id} delay={idx * 0.04}>
                <GroupCard
                  group={group}
                  isJoined={false}
                  onJoin={() => handleJoinPublicGroup(group.id)}
                  joining={joiningGroupId === group.id}
                />
              </ScrollReveal>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
