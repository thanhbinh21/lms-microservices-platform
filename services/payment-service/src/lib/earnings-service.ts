/**
 * Instructor Earning Service — Payment Service
 * Tao InstructorEarning record khi order duoc danh gia thanh cong.
 * Chay dong bo trong cung transaction voi order update.
 */
import prisma from '../lib/prisma';
import type { Decimal } from '@prisma/client/runtime/library';

const REVENUE_SHARE = 0.70; // Giang vien nhan 70%

export async function createInstructorEarning(
  orderId: string,
  instructorId: string,
  courseId: string,
  grossAmount: Decimal | number,
): Promise<void> {
  const gross = typeof grossAmount === 'number' ? grossAmount : grossAmount.toNumber();
  const platformFee = gross * (1 - REVENUE_SHARE);
  const netAmount = gross * REVENUE_SHARE;

  await prisma.instructorEarning.create({
    data: {
      orderId,
      instructorId,
      courseId,
      grossAmount: gross,
      platformFee,
      netAmount,
      status: 'AVAILABLE',
    },
  });
}
