'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { updateLessonProgressAction, completeLessonAction } from '@/app/actions/learning';
import { CheckCircle2, Loader2 } from 'lucide-react';
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
  onComplete?: () => void;
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
  const trackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [canComplete, setCanComplete] = useState(false);
  const [completing, setCompleting] = useState(false);

  const syncProgress = useCallback(async () => {
    try {
      await updateLessonProgressAction(lessonId, {
        watchedDuration: Math.floor(watchedRef.current),
        lastPosition: Math.floor(positionRef.current),
      });
    } catch { /* non-critical */ }
  }, [lessonId]);

  useEffect(() => {
    const timer = setInterval(syncProgress, TRACK_INTERVAL_MS);
    trackTimerRef.current = timer;
    return () => {
      clearInterval(timer);
      syncProgress();
    };
  }, [syncProgress]);

  useEffect(() => {
    setIsCompleted(initialCompleted);
    setCanComplete(false);
    watchedRef.current = 0;
    positionRef.current = lastPosition;
  }, [lessonId, initialCompleted, lastPosition]);

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
        onComplete?.();
      }
    } finally {
      setCompleting(false);
    }
  };

  const youtubeId = sourceType === 'YOUTUBE' ? extractYoutubeId(videoUrl) : null;

  return (
    <div className="space-y-4">
      {/* Video container — cinema ratio */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-2xl shadow-black/30">
        <div className="relative aspect-video w-full">
          {sourceType === 'YOUTUBE' && youtubeId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1${lastPosition > 0 ? `&start=${Math.floor(lastPosition)}` : ''}`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video bài học"
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
      </div>

      {/* Complete button */}
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
            Hoàn thành bài học
          </Button>
        </div>
      )}

      {isCompleted && (
        <div className={cn(
          'flex items-center gap-2 rounded-xl border border-emerald-200/50 bg-emerald-50/60 px-4 py-3',
          'text-sm font-semibold text-emerald-700 backdrop-blur-sm',
        )}>
          <CheckCircle2 className="size-5 text-emerald-500" />
          Bạn đã hoàn thành bài học này
        </div>
      )}
    </div>
  );
}
