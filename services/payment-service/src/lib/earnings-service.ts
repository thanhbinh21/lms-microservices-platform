import prisma from '../lib/prisma';
import { logger } from '@lms/logger';
import { calculateRevenueSplit } from './revenue-share';
import type { Decimal } from '@prisma/client/runtime/library';

export async function createInstructorEarning(
  orderId: string,
  instructorId: string,
  courseId: string,
  grossAmount: Decimal | number,
): Promise<void> {
  const split = calculateRevenueSplit(grossAmount);

  await prisma.instructorEarning.upsert({
    where: { orderId },
    create: {
      orderId,
      instructorId,
      courseId,
      grossAmount: split.gross,
      platformFee: split.platformFee,
      netAmount: split.netAmount,
      revenueSharePct: split.revenueSharePct,
      platformFeePct: split.platformFeePct,
      status: 'AVAILABLE',
    },
    update: {},
  });
}

export async function createInstructorEarningFromCompletedOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      instructorId: true,
      courseId: true,
      amount: true,
    },
  });

  if (!order || order.status !== 'COMPLETED') {
    logger.warn({ orderId }, 'Skip earning creation: order not completed or missing');
    return;
  }

  await createInstructorEarning(order.id, order.instructorId, order.courseId, order.amount);
}
