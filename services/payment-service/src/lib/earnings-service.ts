import prisma from '../lib/prisma.js';
import { calculateRevenueSplit } from './revenue-share.js';
import type { Decimal } from '@prisma/client/runtime/library';
import { createInternalNotification } from './auth-client.js';
import { writeAuditLog } from './audit.js';
import { Prisma } from '../generated/prisma/index.js';

export async function createInstructorEarning(
  orderId: string,
  instructorId: string,
  courseId: string,
  grossAmount: Decimal | number,
): Promise<void> {
  const split = calculateRevenueSplit(grossAmount);

  const existing = await prisma.instructorEarning.findUnique({
    where: { orderId },
    select: { id: true },
  });
  if (existing) return;

  let earning;
  try {
    earning = await prisma.instructorEarning.create({
      data: {
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
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return;
    }
    throw err;
  }

  await Promise.all([
    writeAuditLog({
      actorId: 'system',
      actorRole: 'SYSTEM',
      action: 'INSTRUCTOR_EARNING_CREATED',
      resourceType: 'INSTRUCTOR_EARNING',
      resourceId: earning.id,
      targetLabel: instructorId,
      payload: {
        orderId,
        courseId,
        grossAmount: split.gross.toString(),
        netAmount: split.netAmount.toString(),
        platformFee: split.platformFee.toString(),
      },
    }),
    createInternalNotification({
      userId: instructorId,
      title: 'Ban co doanh thu moi',
      body: 'Mot khoa hoc cua ban vua duoc mua. Doanh thu da duoc ghi vao so du kha dung.',
      eventId: `earning:${orderId}`,
      metadata: { orderId, courseId, route: '/instructor/settings' },
    }),
  ]);
}
