import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPayout, updatePayout } from './payout.controller';

const prismaMock = vi.hoisted(() => ({
  instructorPayoutProfile: { findUnique: vi.fn() },
  payout: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  instructorEarning: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const auditMock = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({ default: prismaMock }));
vi.mock('../lib/audit', () => auditMock);

function decimal(value: number) {
  return { toNumber: () => value };
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function mockResponse(userId = 'instructor-1', userRole = 'INSTRUCTOR') {
  const res: any = {
    locals: { userId, userRole },
    status: vi.fn(() => res),
    json: vi.fn((body) => body),
  };
  return res;
}

describe('payout controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback({
        instructorEarning: prismaMock.instructorEarning,
        payout: prismaMock.payout,
      }),
    );
  });

  it('khong cho tao payout neu chua co payout profile', async () => {
    prismaMock.instructorPayoutProfile.findUnique.mockResolvedValue(null);
    prismaMock.payout.findFirst.mockResolvedValue(null);
    prismaMock.instructorEarning.aggregate.mockResolvedValue({ _sum: { netAmount: decimal(100_000) } });

    const res = mockResponse();
    await createPayout({ body: { amount: 50_000 }, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(normalizeText(res.json.mock.calls[0][0].message)).toContain('thong tin nhan thanh toan');
  });

  it('khong cho tao payout vuot so du kha dung', async () => {
    prismaMock.instructorPayoutProfile.findUnique.mockResolvedValue({
      instructorId: 'instructor-1',
      bankAccountMasked: '***1234',
    });
    prismaMock.payout.findFirst.mockResolvedValue(null);
    prismaMock.instructorEarning.aggregate.mockResolvedValue({ _sum: { netAmount: decimal(50_000) } });

    const res = mockResponse();
    await createPayout({ body: { amount: 100_000 }, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(normalizeText(res.json.mock.calls[0][0].message)).toContain('vuot qua so du');
  });

  it('khong cho tao payout thu hai khi dang co PENDING', async () => {
    prismaMock.instructorPayoutProfile.findUnique.mockResolvedValue({
      instructorId: 'instructor-1',
      bankAccountMasked: '***1234',
    });
    prismaMock.payout.findFirst.mockResolvedValue({ id: 'payout-pending', status: 'PENDING' });
    prismaMock.instructorEarning.aggregate.mockResolvedValue({ _sum: { netAmount: decimal(100_000) } });

    const res = mockResponse();
    await createPayout({ body: { amount: 50_000 }, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(normalizeText(res.json.mock.calls[0][0].message)).toContain('dang co mot yeu cau');
  });

  it('admin PAID chuyen earning sang WITHDRAWN va ghi audit', async () => {
    const existing = {
      id: 'payout-1',
      instructorId: 'instructor-1',
      amount: decimal(100_000),
      status: 'APPROVED',
      adminNote: null,
    };
    const paid = { ...existing, status: 'PAID', processedAt: new Date() };
    prismaMock.payout.findUnique.mockResolvedValue(existing);
    prismaMock.instructorEarning.findMany.mockResolvedValue([{ id: 'earning-1', netAmount: decimal(100_000) }]);
    prismaMock.payout.update.mockResolvedValue(paid);

    const res = mockResponse('admin-1', 'ADMIN');
    await updatePayout({ params: { id: 'payout-1' }, body: { status: 'PAID' }, headers: {} } as any, res);

    expect(prismaMock.instructorEarning.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['earning-1'] }, status: 'PENDING' }),
        data: { status: 'WITHDRAWN' },
      }),
    );
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'PAYOUT_PAID', resourceId: 'payout-1' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
