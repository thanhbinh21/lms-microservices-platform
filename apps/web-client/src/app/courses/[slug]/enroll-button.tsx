'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  enrollCourseAction,
  getCourseReviewsAction,
  getMyCourseReviewAction,
  upsertCourseReviewAction,
  type CourseReviewDto,
  type CourseReviewStatsDto,
  type MyCourseReviewDto,
} from '@/app/actions/student';
import { createOrderAction } from '@/app/actions/payment';
import { Loader2, ShoppingCart, Star, MessageSquare, Filter } from 'lucide-react';
import { useAppSelector } from '@/lib/redux/hooks';
import { useEffect } from 'react';

interface EnrollButtonProps {
  courseId: string;
  isEnrolled: boolean;
  isFree?: boolean;
  price?: number;
}

export function EnrollButton({ courseId, isEnrolled, isFree = true, price = 0 }: EnrollButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(false);
  const [errorStr, setErrorStr] = useState<string>('');

  const handleClick = async () => {
    if (isEnrolled) {
      router.push(`/learn/${courseId}`);
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    setErrorStr('');

    if (isFree) {
      // Khoa hoc free: goi thang course-service enroll.
      const result = await enrollCourseAction(courseId);
      setIsLoading(false);

      if (result.success) {
        router.push(`/learn/${courseId}`);
      } else if (result.code === 401) {
        setErrorStr('Vui lòng đăng nhập để ghi danh!');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setErrorStr(result.message || 'Có lỗi xảy ra');
      }
      return;
    }

    // Khoa hoc tra phi: tao order -> redirect sang VNPay.
    const orderRes = await createOrderAction(courseId);
    setIsLoading(false);

    if (!orderRes.success || !orderRes.data?.payUrl) {
      if (orderRes.code === 401) {
        setErrorStr('Vui lòng đăng nhập để mua khóa học');
        setTimeout(() => router.push('/login'), 1500);
      } else if (orderRes.code === 409) {
        setErrorStr('Bạn đã mua khóa học này trước đó. Đang chuyển hướng...');
        setTimeout(() => router.push(`/learn/${courseId}`), 1500);
      } else {
        setErrorStr(orderRes.message || 'Không thể tạo đơn hàng');
      }
      return;
    }

    // Redirect to VNPay sandbox
    window.location.href = orderRes.data.payUrl;
  };

  if (isEnrolled) {
    return (
      <Button onClick={() => router.push(`/learn/${courseId}`)}>Vào học ngay</Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleClick} disabled={isLoading} className="font-bold px-8 shadow-md">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!isLoading && !isFree && <ShoppingCart className="mr-2 h-4 w-4" />}
        {isFree
          ? 'Đăng ký miễn phí'
          : `Mua khóa học — ${Number(price).toLocaleString('vi-VN')}đ`}
      </Button>
      {errorStr && <p className="text-xs text-red-500 font-semibold">{errorStr}</p>}
    </div>
  );
}

interface CourseReviewPanelProps {
  courseId: string;
  isEnrolled: boolean;
  isCourseCompleted: boolean;
  heading?: string;
}

type SortByType = 'newest' | 'highest' | 'lowest';

const SORT_OPTIONS: Array<{ value: SortByType; label: string }> = [
  { value: 'newest', label: 'Moi nhat' },
  { value: 'highest', label: 'Sao cao nhat' },
  { value: 'lowest', label: 'Sao thap nhat' },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('vi-VN');
}

export function CourseReviewPanel({
  courseId,
  isEnrolled,
  isCourseCompleted,
  heading = 'Danh gia tu hoc vien',
}: CourseReviewPanelProps) {
  const router = useRouter();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [sortBy, setSortBy] = useState<SortByType>('newest');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorStr, setErrorStr] = useState('');
  const [successStr, setSuccessStr] = useState('');
  const [reviews, setReviews] = useState<CourseReviewDto[]>([]);
  const [stats, setStats] = useState<CourseReviewStatsDto>({
    averageRating: 0,
    ratingCount: 0,
    distribution: [
      { rating: 5, count: 0 },
      { rating: 4, count: 0 },
      { rating: 3, count: 0 },
      { rating: 2, count: 0 },
      { rating: 1, count: 0 },
    ],
  });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [myReview, setMyReview] = useState<MyCourseReviewDto | null>(null);

  const loadReviews = async (nextSortBy: SortByType) => {
    setLoading(true);
    const reviewRes = await getCourseReviewsAction(courseId, {
      page: 1,
      limit: 10,
      sortBy: nextSortBy,
    });

    if (!reviewRes.success || !reviewRes.data) {
      setReviews([]);
      setErrorStr(reviewRes.message || 'Khong the tai danh gia');
      setLoading(false);
      return;
    }

    setReviews(reviewRes.data.reviews || []);
    setStats(reviewRes.data.stats);
    setErrorStr('');
    setMyReview(null);

    if (isAuthenticated && isEnrolled) {
      const myReviewRes = await getMyCourseReviewAction(courseId);
      if (myReviewRes.success) {
        const current = myReviewRes.data ?? null;
        setMyReview(current);
        if (current) {
          setRating(current.rating);
          setComment(current.comment || '');
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadReviews(sortBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, sortBy, isAuthenticated, isEnrolled]);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!isEnrolled) {
      setErrorStr('Ban can ghi danh khoa hoc truoc khi danh gia');
      return;
    }

    if (!isCourseCompleted) {
      setErrorStr('Chi duoc danh gia sau khi hoan thanh 100% khoa hoc');
      return;
    }

    if (myReview) {
      setErrorStr('Ban da gui danh gia cho khoa hoc nay');
      return;
    }

    setSubmitting(true);
    setErrorStr('');
    setSuccessStr('');

    const response = await upsertCourseReviewAction(courseId, {
      rating,
      comment,
    });

    setSubmitting(false);

    if (!response.success) {
      if (response.code === 401) {
        setErrorStr('Vui long dang nhap de danh gia');
        setTimeout(() => router.push('/login'), 1200);
        return;
      }
      if (response.code === 409) {
        setErrorStr('Ban da gui danh gia cho khoa hoc nay');
        await loadReviews(sortBy);
        return;
      }
      setErrorStr(response.message || 'Khong the luu danh gia');
      return;
    }

    setSuccessStr('Da luu danh gia cua ban');
    await loadReviews(sortBy);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{heading}</h2>
        <div className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm">
          <Filter className="size-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortByType)}
            className="bg-transparent text-sm font-semibold outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px,1fr]">
        <div className="rounded-2xl border border-white/70 bg-white/75 p-4 space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">Tong quan danh gia</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-amber-500">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0.0'}
            </span>
            <span className="pb-1 text-sm text-muted-foreground">/5</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {stats.ratingCount} danh gia
          </p>

          <div className="space-y-1.5">
            {stats.distribution.map((item) => {
              const percent = stats.ratingCount > 0
                ? Math.round((item.count / stats.ratingCount) * 100)
                : 0;
              return (
                <div key={item.rating} className="flex items-center gap-2 text-xs">
                  <span className="w-8 font-semibold">{item.rating} sao</span>
                  <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-muted-foreground">{item.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {!isEnrolled && (
            <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-muted-foreground">
              Dang ky khoa hoc de mo tinh nang danh gia.
            </div>
          )}

          {isEnrolled && !isCourseCompleted && (
            <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm text-muted-foreground">
              Hoan thanh 100% bai hoc de gui danh gia cho khoa hoc nay.
            </div>
          )}

          {isEnrolled && isCourseCompleted && myReview && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
              <p className="text-sm font-bold text-emerald-700">Ban da gui danh gia</p>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star
                    key={value}
                    className={`size-4 ${
                      value <= myReview.rating
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                {myReview.comment || 'Ban khong de lai binh luan.'}
              </p>
            </div>
          )}

          {isEnrolled && isCourseCompleted && !myReview && (
            <div className="rounded-2xl border border-white/70 bg-white/75 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <p className="text-sm font-bold">Viet danh gia cua ban</p>
              </div>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="p-1"
                  >
                    <Star
                      className={`size-5 ${
                        value <= rating
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Chia se trai nghiem hoc tap cua ban..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{comment.length}/1000</span>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Luu danh gia
                </Button>
              </div>
              {errorStr && <p className="text-xs text-red-500 font-semibold">{errorStr}</p>}
              {successStr && <p className="text-xs text-emerald-600 font-semibold">{successStr}</p>}
            </div>
          )}

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/70 bg-white/75 p-5 text-sm text-muted-foreground">
                Dang tai danh gia...
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-2xl border border-white/70 bg-white/75 p-5 text-sm text-muted-foreground">
                Chua co danh gia nao cho khoa hoc nay.
              </div>
            ) : (
              reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-white/70 bg-white/75 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">{review.author}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(review.updatedAt)}</p>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        className={`size-4 ${
                          value <= review.rating
                            ? 'fill-amber-500 text-amber-500'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>

                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                    {review.comment || 'Nguoi hoc vien nay khong de lai binh luan.'}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
