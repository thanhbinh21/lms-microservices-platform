'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { updateLessonProgressAction, completeLessonAction } from '@/app/actions/learning';
import { CheckCircle2, Loader2, CircleDashed, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TRACK_INTERVAL_MS = 15_000;
const COMPLETION_THRESHOLD = 0.8;

interface VideoPlayerProps {
  lessonId: string;
  videoUrl: string;
  sourceType: 'UPLOAD' | 'YOUTUBE';
  duration: number;
  lastPosition: number;
  isCompleted: boolean;
  onComplete?: (payload?: {
    courseCompleted?: boolean;
    certificateNumber?: string | null;
  }) => void;
}

function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1);
    return parsed.searchParams.get('v');
  } catch {
    return null;
  }
}

export function VideoPlayer({
  lessonId,
  videoUrl,
  sourceType,
  duration,
  lastPosition,
  isCompleted: initialCompleted,
  onComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchedRef = useRef(0);
  const positionRef = useRef(lastPosition);
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [canComplete, setCanComplete] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const syncProgress = useCallback(async () => {
    if (sourceType === 'YOUTUBE') return;
    try {
      await updateLessonProgressAction(lessonId, {
        watchedDuration: Math.floor(watchedRef.current),
        lastPosition: Math.floor(positionRef.current),
      });
    } catch {
      // non-critical
    }
  }, [lessonId, sourceType]);

  useEffect(() => {
    const timer = setInterval(syncProgress, TRACK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      void syncProgress();
    };
  }, [syncProgress]);

  useEffect(() => {
    setIsCompleted(initialCompleted);
    setCanComplete(sourceType === 'YOUTUBE');
    watchedRef.current = 0;
    positionRef.current = lastPosition;
    setCompletionMessage('');
  }, [lessonId, initialCompleted, lastPosition, sourceType]);

  // Apply playback speed to video element
  useEffect(() => {
    const el = videoRef.current;
    if (el && sourceType !== 'YOUTUBE') {
      el.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, sourceType]);

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;

    positionRef.current = el.currentTime;
    watchedRef.current = Math.max(watchedRef.current, el.currentTime);

    if (!isCompleted && duration > 0 && watchedRef.current >= duration * COMPLETION_THRESHOLD) {
      setCanComplete(true);
    }
  };

  const handleVideoLoaded = () => {
    const el = videoRef.current;
    if (el && lastPosition > 0) {
      el.currentTime = lastPosition;
    }
  };

  const handleComplete = async () => {
    if (isCompleted || completing) return;

    setCompleting(true);
    try {
      const res = await completeLessonAction(lessonId);
      if (res.success) {
        setIsCompleted(true);

        if (res.data?.certificate) {
          setCompletionMessage('Chuc mung! Ban da duoc cap chung chi cho khoa hoc nay.');
        } else if (res.data?.courseCompleted) {
          setCompletionMessage('Ban da hoan thanh khoa hoc.');
        } else {
          setCompletionMessage('Ban da hoan thanh bai hoc nay.');
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lms:learn-progress-updated'));
        }

        onComplete?.({
          courseCompleted: res.data?.courseCompleted ?? false,
          certificateNumber: res.data?.certificate?.certificateNumber ?? null,
        });
      }
    } finally {
      setCompleting(false);
    }
  };

  const youtubeId = sourceType === 'YOUTUBE' ? extractYoutubeId(videoUrl) : null;
  const watchedPercent = duration > 0
    ? Math.min(100, Math.round((watchedRef.current / duration) * 100))
    : 0;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-2xl shadow-black/30">
        <div className="relative aspect-video w-full">
          {sourceType === 'YOUTUBE' && youtubeId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1${lastPosition > 0 ? `&start=${Math.floor(lastPosition)}` : ''}`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video bai hoc"
            />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 h-full w-full bg-black"
              controls
              controlsList="nodownload"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleVideoLoaded}
            />
          )}
        </div>

        {sourceType !== 'YOUTUBE' && (
          <div className="absolute bottom-3 right-3 z-10">
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="rounded-lg border border-white/30 bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm focus:border-white/60 focus:outline-none"
              title="Toc do phat"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={1.75}>1.75x</option>
              <option value={2}>2x</option>
            </select>
          </div>
        )}
      </div>

      {!isCompleted && sourceType !== 'YOUTUBE' && duration > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1">
              <CircleDashed className="size-3.5" />
              Tien do xem video
            </span>
            <span>{watchedPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${watchedPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Nut hoan thanh mo sau khi ban xem toi thieu 80% video.
          </p>
        </div>
      )}

      {!isCompleted && sourceType === 'YOUTUBE' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <p className="inline-flex items-center gap-1 font-semibold">
            <Youtube className="size-3.5" />
            Bai hoc YouTube khong the track chinh xac thoi luong xem.
          </p>
          <p className="mt-1">Sau khi hoc xong, bam nut ben duoi de danh dau hoan thanh bai hoc.</p>
        </div>
      )}

      {!isCompleted && (canComplete || duration === 0) && (
        <div className="animate-fade-up">
          <Button
            onClick={handleComplete}
            disabled={completing}
            className="w-full gap-2 rounded-xl bg-emerald-600 py-6 text-base font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500"
          >
            {completing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
            Danh dau hoan thanh bai hoc
          </Button>
        </div>
      )}

      {isCompleted && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border border-emerald-200/50 bg-emerald-50/60 px-4 py-3',
            'text-sm font-semibold text-emerald-700 backdrop-blur-sm',
          )}
        >
          <CheckCircle2 className="size-5 text-emerald-500" />
          {completionMessage || 'Ban da hoan thanh bai hoc nay'}
        </div>
      )}
    </div>
  );
}
