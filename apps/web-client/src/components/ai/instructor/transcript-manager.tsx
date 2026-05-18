'use client';

import { useState } from 'react';
import { FileText, Upload, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TranscriptStatus {
  status: string;
  sourceType?: string;
  errorCode?: string;
  errorMessage?: string;
  generatedAt?: string;
  fullText?: string;
  contentLength?: number;
}

interface TranscriptManagerProps {
  lessonId: string;
  currentStatus?: TranscriptStatus;
  onManualSubmit?: (fullText: string) => Promise<void>;
  onRetry?: () => Promise<void>;
  className?: string;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}> = {
  PENDING: {
    label: 'Đang chờ',
    icon: <Clock className="size-4" />,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    description: 'Đang chờ xử lý transcript...',
  },
  PROCESSING: {
    label: 'Đang xử lý',
    icon: <Loader2 className="size-4 animate-spin" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Hệ thống đang tạo transcript tự động.',
  },
  READY: {
    label: 'Sẵn sàng',
    icon: <CheckCircle2 className="size-4" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    description: 'Transcript đã sẵn sàng. AI Chatbot và Quiz đã được bật.',
  },
  FAILED: {
    label: 'Thất bại',
    icon: <XCircle className="size-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Transcript không thể tạo tự động. Vui lòng thử cách khác.',
  },
  NEEDS_MANUAL_TRANSCRIPT: {
    label: 'Cần transcript thủ công',
    icon: <AlertTriangle className="size-4" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    description: 'Video không có phụ đề. Vui lòng bổ sung transcript thủ công.',
  },
  TOO_LARGE: {
    label: 'Video quá lớn',
    icon: <AlertTriangle className="size-4" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    description: 'Video vượt giới hạn (>60 phút hoặc >500MB). Vui lòng chia nhỏ video.',
  },
};

export function TranscriptManager({
  lessonId,
  currentStatus,
  onManualSubmit,
  onRetry,
  className,
}: TranscriptManagerProps) {
  const [manualText, setManualText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const status = currentStatus?.status || 'PENDING';
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['PENDING'];
  const isEditable = status === 'FAILED' || status === 'NEEDS_MANUAL_TRANSCRIPT' || status === 'TOO_LARGE' || !status;

  const handleManualSubmit = async () => {
    if (!manualText.trim() || manualText.trim().length < 100 || submitting) return;
    if (!onManualSubmit) return;

    setSubmitting(true);
    try {
      await onManualSubmit(manualText);
      setSubmitted(true);
      setManualText('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Transcript & AI
          </CardTitle>
          <Badge className={cn('gap-1', config.bgColor, config.color)}>
            {config.icon}
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Transcript preview */}
        {currentStatus?.fullText && (
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Nội dung transcript ({currentStatus.contentLength?.toLocaleString() ?? 0} ký tự)
              </p>
            </div>
            <p className="max-h-32 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
              {currentStatus.fullText.slice(0, 500)}
              {currentStatus.fullText.length > 500 && '...'}
            </p>
          </div>
        )}

        {/* Action buttons for failed/transcript-needed states */}
        {isEditable && status !== 'READY' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRetry()}
              disabled={retrying || !onRetry}
              className="gap-1"
            >
              {retrying ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Thử lại
            </Button>

            <Button variant="outline" size="sm" className="gap-1">
              <Upload className="size-3" />
              Upload subtitle (.srt/.vtt)
            </Button>
          </div>
        )}

        {/* Manual transcript form */}
        {(status === 'NEEDS_MANUAL_TRANSCRIPT' || status === 'FAILED' || status === 'TOO_LARGE' || !status) && (
          <div className="space-y-2">
            <label className="text-xs font-medium">
              Dán transcript thủ công
            </label>
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Dán nội dung transcript vào đây... (tối thiểu 100 ký tự)"
              className="min-h-[120px] text-sm"
            />
            <div className="flex items-center justify-between">
              <p className={cn(
                'text-xs',
                manualText.trim().length < 100 ? 'text-muted-foreground' : 'text-emerald-600',
              )}>
                {manualText.trim().length} / 100 ký tự tối thiểu
              </p>
              <Button
                size="sm"
                onClick={() => void handleManualSubmit()}
                disabled={manualText.trim().length < 100 || submitting || submitted}
              >
                {submitting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : submitted ? (
                  <CheckCircle2 className="size-3" />
                ) : null}
                {submitted ? 'Đã lưu' : 'Lưu transcript'}
              </Button>
            </div>
          </div>
        )}

        {/* Source info */}
        {currentStatus?.sourceType && (
          <p className="text-xs text-muted-foreground">
            Nguồn:{' '}
            <span className="font-medium">
              {currentStatus.sourceType === 'MP4_AUTO' && 'Transcript tự động (MP4)'}
              {currentStatus.sourceType === 'YOUTUBE_AUTO' && 'Transcript YouTube'}
              {currentStatus.sourceType === 'MANUAL' && 'Transcript thủ công'}
              {currentStatus.sourceType === 'SUBTITLE_UPLOAD' && 'Upload phụ đề'}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
