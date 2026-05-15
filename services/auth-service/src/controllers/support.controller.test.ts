import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSupportTicket,
  getSupportTicket,
  listAdminSupportTickets,
  replySupportTicket,
  updateAdminSupportTicket,
} from './support.controller';

const prismaMock = vi.hoisted(() => ({
  supportTicket: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  supportTicketReply: {
    create: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const auditMock = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ default: prismaMock }));
vi.mock('../lib/audit.js', () => auditMock);
vi.mock('@lms/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    userId: 'user-1',
    subject: 'Can ho tro thanh toan',
    description: 'Toi can kiem tra giao dich vua thanh toan',
    category: 'PAYMENT',
    status: 'OPEN',
    priority: 'NORMAL',
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    replies: [],
    ...overrides,
  };
}

function mockResponse(userId = 'user-1', userRole = 'STUDENT') {
  const res: any = {
    locals: { userId, userRole },
    status: vi.fn(() => res),
    json: vi.fn((body) => body),
  };
  return res;
}

describe('support controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Hoc vien', email: 'student@example.com', role: 'STUDENT' },
      { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' },
    ]);
    prismaMock.$transaction.mockImplementation(async (operations: any[]) => Promise.all(operations));
  });

  it('user tao va xem ticket cua minh', async () => {
    const created = ticket();
    prismaMock.supportTicket.create.mockResolvedValue(created);
    prismaMock.supportTicket.findUnique.mockResolvedValue(created);

    const createRes = mockResponse();
    await createSupportTicket(
      {
        body: {
          subject: 'Can ho tro thanh toan',
          description: 'Toi can kiem tra giao dich vua thanh toan',
          category: 'PAYMENT',
        },
        headers: {},
      } as any,
      createRes,
    );

    const getRes = mockResponse();
    await getSupportTicket({ params: { id: 'ticket-1' }, headers: {} } as any, getRes);

    expect(createRes.status).toHaveBeenCalledWith(201);
    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes.json.mock.calls[0][0].data.id).toBe('ticket-1');
  });

  it('user khong xem duoc ticket cua nguoi khac', async () => {
    prismaMock.supportTicket.findUnique.mockResolvedValue(ticket({ userId: 'other-user' }));

    const res = mockResponse('user-1', 'STUDENT');
    await getSupportTicket({ params: { id: 'ticket-1' }, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('admin list, update va reply ticket', async () => {
    const existing = ticket();
    const updated = ticket({ status: 'IN_PROGRESS' });
    prismaMock.supportTicket.findMany.mockResolvedValue([existing]);
    prismaMock.supportTicket.count.mockResolvedValue(1);
    prismaMock.supportTicket.findUnique.mockResolvedValue(existing);
    prismaMock.supportTicket.update.mockResolvedValue(updated);
    prismaMock.supportTicketReply.create.mockResolvedValue({ id: 'reply-1', ticketId: 'ticket-1' });

    const listRes = mockResponse('admin-1', 'ADMIN');
    await listAdminSupportTickets({ query: {}, headers: {} } as any, listRes);

    const updateRes = mockResponse('admin-1', 'ADMIN');
    await updateAdminSupportTicket(
      { params: { id: 'ticket-1' }, body: { status: 'IN_PROGRESS' }, headers: {} } as any,
      updateRes,
    );

    const replyRes = mockResponse('admin-1', 'ADMIN');
    await replySupportTicket(
      { params: { id: 'ticket-1' }, body: { message: 'Admin dang kiem tra' }, headers: {} } as any,
      replyRes,
    );

    expect(listRes.status).toHaveBeenCalledWith(200);
    expect(updateRes.status).toHaveBeenCalledWith(200);
    expect(replyRes.status).toHaveBeenCalledWith(201);
    expect(auditMock.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'SUPPORT_TICKET_REPLIED' }),
    );
  });
});
