import type { Decimal } from '@prisma/client/runtime/library';

const DEFAULT_REVENUE_SHARE = 0.7;

function toSafeRatio(raw: string | undefined): number {
  if (!raw) return DEFAULT_REVENUE_SHARE;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) return DEFAULT_REVENUE_SHARE;
  return parsed;
}

export function getInstructorRevenueShareRatio(): number {
  return toSafeRatio(process.env.PAYMENT_INSTRUCTOR_SHARE_RATIO);
}

export function calculateRevenueSplit(
  grossAmount: Decimal | number,
  shareRatio = getInstructorRevenueShareRatio(),
): { gross: number; netAmount: number; platformFee: number; revenueSharePct: number; platformFeePct: number } {
  const gross = typeof grossAmount === 'number' ? grossAmount : grossAmount.toNumber();
  const revenueSharePct = Number(shareRatio.toFixed(4));
  const platformFeePct = Number((1 - revenueSharePct).toFixed(4));
  const netAmount = Number((gross * revenueSharePct).toFixed(2));
  const platformFee = Number((gross - netAmount).toFixed(2));
  return { gross, netAmount, platformFee, revenueSharePct, platformFeePct };
}
