'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Clock3, Loader2, ShieldCheck,
  Sparkles, ArrowRight, AlertCircle, FileText, BookOpen,
} from 'lucide-react';
import {
  createInstructorRequestAction,
  getMyPendingInstructorRequestAction,
} from '@/app/actions/instructor';
import { useAppSelector } from '@/lib/redux/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusMessage } from '@/components/ui/status-message';
import { toast } from '@/components/ui/toast';

export default function BecomeInstructorForm() {
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [existingRequest, setExistingRequest] = useState<{
    status: string;
    createdAt: string;
  } | null>(null);
  const [error, setError] = useState('');

  // Check existing request status on mount
  useEffect(() => {
    async function checkStatus() {
      setIsCheckingStatus(true);
      const res = await getMyPendingInstructorRequestAction();
      if (res.success && res.request) {
        setExistingRequest({
          status: res.request.status,
          createdAt: res.request.createdAt,
        });
      }
      setIsCheckingStatus(false);
    }
    void checkStatus();
  }, []);

  const onSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setError('');

    const result = await createInstructorRequestAction({
      fullName: user.name || '',
      phone: '',
      expertise: '',
      experienceYears: 0,
      bio: '',
      courseTitle: '',
      courseCategory: '',
      courseDescription: '',
    });

    if (result.success) {
      toast('success', 'ÄÃ£ gá»­i há»“ sÆ¡ giáº£ng viÃªn');
      router.push('/?instructorSubmitted=1');
    } else {
      setError(result.message || 'KhÃ´ng thá»ƒ gá»­i há»“ sÆ¡. Vui lÃ²ng thá»­ láº¡i.');
      toast('error', 'Gá»­i há»“ sÆ¡ tháº¥t báº¡i', result.message || 'Vui lÃ²ng thá»­ láº¡i.');
    }

    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
            <Clock3 className="size-3.5" />
            Äang chá» duyá»‡t
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            ÄÃ£ duyá»‡t
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
            <AlertCircle className="size-3.5" />
            ÄÃ£ tá»« chá»‘i
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {status}
          </span>
        );
    }
  };

  if (isCheckingStatus) {
    return (
      <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel relative w-full overflow-hidden rounded-3xl border-white/60 shadow-2xl shadow-primary/10">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

      <CardHeader className="relative space-y-3 px-6 pb-2 pt-8 text-center sm:px-10 sm:text-left">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Sparkles className="size-6 text-primary" />
          Trá»Ÿ thÃ nh Giáº£ng viÃªn
        </CardTitle>
        <CardDescription className="text-base font-medium text-muted-foreground">
          Gá»­i há»“ sÆ¡ Ä‘á»ƒ trá»Ÿ thÃ nh giáº£ng viÃªn NexEdu. Admin sáº½ xem xÃ©t vÃ  pháº£n há»“i.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative space-y-5 px-6 pb-2 sm:px-10">
        {/* Existing request status */}
        {existingRequest ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span className="font-semibold text-foreground">Há»“ sÆ¡ Ä‘Ã£ gá»­i</span>
              {getStatusBadge(existingRequest.status)}
            </div>
            {existingRequest.status === 'PENDING' && (
              <p className="text-sm text-muted-foreground">
                Há»“ sÆ¡ cá»§a báº¡n Ä‘ang Ä‘Æ°á»£c xem xÃ©t. Báº¡n sáº½ nháº­n thÃ´ng bÃ¡o khi cÃ³ káº¿t quáº£.
              </p>
            )}
            {existingRequest.status === 'APPROVED' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-emerald-700">
                  Há»“ sÆ¡ Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t. Báº¡n Ä‘Ã£ trá»Ÿ thÃ nh giáº£ng viÃªn!
                </p>
                <Button
                  onClick={() => router.push('/instructor')}
                  className="w-fit gap-2 font-bold shadow-lg shadow-primary/20"
                >
                  VÃ o Studio
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            )}
            {existingRequest.status === 'REJECTED' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-red-600">
                  Há»“ sÆ¡ khÃ´ng Ä‘Æ°á»£c duyá»‡t. Vui lÃ²ng gá»­i láº¡i vá»›i thÃ´ng tin Ä‘áº§y Ä‘á»§ hÆ¡n.
                </p>
                <Button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="w-fit gap-2 font-bold shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Äang gá»­i láº¡i...
                    </>
                  ) : (
                    <>
                      Gá»­i láº¡i há»“ sÆ¡
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              <p className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Quy trÃ¬nh
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                  Gá»­i há»“ sÆ¡ á»©ng tuyá»ƒn giáº£ng viÃªn.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                  Admin xem xÃ©t vÃ  pháº£n há»“i trong thá»i gian sá»›m nháº¥t.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                  Khi Ä‘Æ°á»£c duyá»‡t, báº¡n sáº½ nháº­n thÃ´ng bÃ¡o vÃ  cÃ³ thá»ƒ vÃ o Studio.
                </li>
                <li className="flex items-start gap-2">
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-green-600" />
                  Táº¡o vÃ  xuáº¥t báº£n khÃ³a há»c Ä‘áº§u tiÃªn cá»§a báº¡n.
                </li>
              </ul>
            </div>

            {error && <StatusMessage type="error" message={error} />}
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/30 md:max-w-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Äang gá»­i há»“ sÆ¡...
                </>
              ) : (
                'Gá»­i há»“ sÆ¡ á»©ng tuyá»ƒn'
              )}
            </Button>
          </>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-white/40 bg-white/30 px-6 py-5 text-center sm:px-10 sm:text-left">
        <p className="text-xs font-medium leading-relaxed text-muted-foreground">
          Quy trÃ¬nh duyá»‡t thÆ°á»ng máº¥t tá»« 1-3 ngÃ y lÃ m viá»‡c. Báº¡n sáº½ nháº­n thÃ´ng bÃ¡o khi cÃ³ káº¿t quáº£.
        </p>
      </CardFooter>
    </Card>
  );
}
