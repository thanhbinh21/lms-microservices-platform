import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { writeAuditLog } from '../lib/audit.js';
import axios from 'axios';

const createRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự'),
  phone: z.string().trim().min(9, 'Số điện thoại không hợp lệ'),
  expertise: z.string().trim().min(2, 'Chuyên môn là bắt buộc'),
  specialization: z.string().trim().optional(),
  experienceYears: z.coerce.number().int().min(0, 'Số năm kinh nghiệm không hợp lệ'),
  bio: z.string().trim().min(10, 'Giới thiệu tối thiểu 10 ký tự'),
  courseTitle: z.string().trim().min(2, 'Tên khóa học dự kiến là bắt buộc'),
  courseCategory: z.string().trim().min(2, 'Danh mục khóa học là bắt buộc'),
  courseDescription: z.string().trim().min(10, 'Mô tả khóa học tối thiểu 10 ký tự'),
  email: z.string().email().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  currentJob: z.string().optional(),
  github: z.string().url().optional().or(z.literal('')),
  linkedin: z.string().url().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  youtube: z.string().url().optional().or(z.literal('')),
  cvFile: z.string().optional(),
  certificateFile: z.string().optional(),
  identityCard: z.string().optional(),
  avatar: z.string().optional(),
  targetStudents: z.string().optional(),
});

const rejectRequestSchema = z.object({
  reason: z.string().trim().min(10, 'Lý do từ chối tối thiểu 10 ký tự'),
});

const listQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function getMediaServiceUrl(): string {
  return (process.env.MEDIA_SERVICE_URL || 'http://localhost:3004').replace(/\/$/, '');
}

function getNotificationServiceUrl(): string {
  return (process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005').replace(/\/$/, '');
}

function apiError(res: Response, code: number, message: string, traceId: string): Response {
  const response: ApiResponse<null> = { success: false, code, message, data: null, trace_id: traceId };
  return res.status(code).json(response);
}

async function uploadMediaIfProvided(fieldValue: string | undefined): Promise<string | null> {
  if (!fieldValue) return null;
  const base = getMediaServiceUrl();
  if (!base) return fieldValue;

  try {
    const response = await axios.post<{ success?: boolean; data?: { url?: string } }>(
      `${base}/api/upload/external`,
      { sourceUrl: fieldValue },
      { timeout: 10_000 },
    );
    if (response.data?.success) {
      return response.data?.data?.url || fieldValue;
    }
  } catch {
    // Fallback: giu nguyen URL neu media-service tam thoi loi.
  }
  return fieldValue;
}

async function createInternalNotification(input: {
  userId: string;
  title: string;
  body: string;
  eventId: string;
  metadata?: Record<string, unknown>;
  traceId: string;
}): Promise<void> {
  try {
    await axios.post(
      `${getNotificationServiceUrl()}/internal/notifications`,
      {
        userId: input.userId,
        type: 'SYSTEM',
        title: input.title,
        body: input.body,
        eventId: input.eventId,
        metadata: input.metadata || {},
      },
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'x-internal-call': 'auth-service',
          'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET || '',
          'x-trace-id': input.traceId,
        },
      },
    );
  } catch {
    // Notification la side effect, khong duoc lam hong flow chinh.
  }
}

async function notifyAdminsAboutInstructorRequest(requestId: string, fullName: string, traceId: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
    take: 100,
  });

  await Promise.all(
    admins.map((admin) =>
      createInternalNotification({
        userId: admin.id,
        title: 'Có hồ sơ giảng viên mới',
        body: `${fullName} vừa gửi hồ sơ đăng ký giảng viên cần xem xét.`,
        eventId: `instructor-request-created:${requestId}:${admin.id}`,
        metadata: { requestId, route: `/admin/instructor-requests/${requestId}` },
        traceId,
      }),
    ),
  );
}

export async function createInstructorRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const validated = createRequestSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) return apiError(res, 401, 'Không tìm thấy người dùng đăng nhập', traceId);
    if (user.role === 'INSTRUCTOR' || user.role === 'ADMIN') {
      return apiError(res, 400, 'Tài khoản hiện tại không cần gửi hồ sơ giảng viên', traceId);
    }

    const existingPending = await prisma.instructorRequest.findFirst({
      where: { userId, status: 'pending' },
    });
    if (existingPending) {
      return apiError(res, 409, 'Bạn đã có hồ sơ đang chờ duyệt. Vui lòng đợi kết quả trước khi gửi lại.', traceId);
    }

    const [cvFile, certificateFile, identityCard, avatar] = await Promise.all([
      uploadMediaIfProvided(validated.cvFile),
      uploadMediaIfProvided(validated.certificateFile),
      uploadMediaIfProvided(validated.identityCard),
      uploadMediaIfProvided(validated.avatar),
    ]);

    const request = await prisma.instructorRequest.create({
      data: {
        userId,
        fullName: validated.fullName,
        phone: validated.phone,
        email: user.email,
        dateOfBirth: validated.dateOfBirth ? new Date(validated.dateOfBirth) : null,
        address: validated.address || null,
        expertise: validated.expertise,
        specialization: validated.specialization || validated.expertise,
        experienceYears: validated.experienceYears,
        currentJob: validated.currentJob || null,
        bio: validated.bio,
        github: validated.github || null,
        linkedin: validated.linkedin || null,
        website: validated.website || null,
        youtube: validated.youtube || null,
        cvFile,
        certificateFile,
        identityCard,
        avatar,
        courseTitle: validated.courseTitle,
        courseCategory: validated.courseCategory,
        courseDescription: validated.courseDescription,
        targetStudents: validated.targetStudents || null,
        status: 'pending',
        rejectionReason: null,
      },
    });

    await writeAuditLog({
      actorId: userId,
      actorRole: 'STUDENT',
      action: 'INSTRUCTOR_REQUEST_CREATED',
      resourceType: 'INSTRUCTOR_REQUEST',
      resourceId: request.id,
      targetLabel: request.fullName,
      payload: { expertise: request.expertise, courseTitle: request.courseTitle },
      traceId,
    });
    await notifyAdminsAboutInstructorRequest(request.id, request.fullName, traceId);

    const response: ApiResponse<typeof request> = {
      success: true,
      code: 201,
      message: 'Hồ sơ đăng ký giảng viên đã được gửi thành công',
      data: request,
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) return apiError(res, 400, err.errors[0]?.message || 'Dữ liệu không hợp lệ', traceId);
    logger.error({ err, userId, traceId }, 'createInstructorRequest failed');
    return apiError(res, 500, 'Lỗi hệ thống khi gửi hồ sơ', traceId);
  }
}

export async function getMyInstructorRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const request = await prisma.instructorRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const response: ApiResponse<{ request: typeof request }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { request },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, userId, traceId }, 'getMyInstructorRequest failed');
    return apiError(res, 500, 'Lỗi hệ thống', traceId);
  }
}

export async function listInstructorRequests(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return apiError(res, 400, parsed.error.issues[0]?.message || 'Query không hợp lệ', traceId);

  try {
    const { status, page, limit } = parsed.data;
    const where = status ? { status } : {};
    const [requests, total] = await Promise.all([
      prisma.instructorRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.instructorRequest.count({ where }),
    ]);

    const response: ApiResponse<{ requests: typeof requests; total: number; page: number; totalPages: number }> = {
      success: true,
      code: 200,
      message: 'Danh sách đơn đăng ký giảng viên',
      data: { requests, total, page, totalPages: Math.ceil(total / limit) },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'listInstructorRequests failed');
    return apiError(res, 500, 'Lỗi hệ thống', traceId);
  }
}

export async function getInstructorRequestStats(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.instructorRequest.count(),
      prisma.instructorRequest.count({ where: { status: 'pending' } }),
      prisma.instructorRequest.count({ where: { status: 'approved' } }),
      prisma.instructorRequest.count({ where: { status: 'rejected' } }),
    ]);

    const response: ApiResponse<{ total: number; pending: number; approved: number; rejected: number }> = {
      success: true,
      code: 200,
      message: 'OK',
      data: { total, pending, approved, rejected },
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'getInstructorRequestStats failed');
    return apiError(res, 500, 'Lỗi hệ thống', traceId);
  }
}

export async function getInstructorRequestById(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const request = await prisma.instructorRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return apiError(res, 404, 'Không tìm thấy đơn đăng ký', traceId);

    const response: ApiResponse<typeof request> = {
      success: true,
      code: 200,
      message: 'OK',
      data: request,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'getInstructorRequestById failed');
    return apiError(res, 500, 'Lỗi hệ thống', traceId);
  }
}

export async function approveInstructorRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const adminId = res.locals.userId as string;

  try {
    const found = await prisma.instructorRequest.findUnique({ where: { id: req.params.id } });
    if (!found) return apiError(res, 404, 'Không tìm thấy đơn đăng ký', traceId);
    if (found.status !== 'pending') return apiError(res, 400, 'Đơn này đã được xử lý', traceId);

    const [request] = await prisma.$transaction([
      prisma.instructorRequest.update({
        where: { id: req.params.id },
        data: { status: 'approved', rejectionReason: null, reviewedBy: adminId, reviewedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: found.userId },
        data: { role: 'INSTRUCTOR', becameInstructorAt: new Date() },
      }),
    ]);

    await writeAuditLog({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'INSTRUCTOR_REQUEST_APPROVED',
      resourceType: 'INSTRUCTOR_REQUEST',
      resourceId: req.params.id,
      targetLabel: found.fullName,
      payload: { userId: found.userId },
      traceId,
    });
    await createInternalNotification({
      userId: found.userId,
      title: 'Hồ sơ giảng viên đã được duyệt',
      body: 'Tài khoản của bạn đã được nâng quyền giảng viên. Hãy vào Instructor Studio để tạo khóa học đầu tiên.',
      eventId: `instructor-request-approved:${request.id}`,
      metadata: { requestId: request.id, route: '/become-instructor' },
      traceId,
    });

    const response: ApiResponse<typeof request> = {
      success: true,
      code: 200,
      message: 'Đơn đăng ký đã được duyệt. Tài khoản đã được nâng cấp lên INSTRUCTOR.',
      data: request,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'approveInstructorRequest failed');
    return apiError(res, 500, 'Lỗi hệ thống khi duyệt đơn', traceId);
  }
}

export async function rejectInstructorRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const adminId = res.locals.userId as string;

  try {
    const validated = rejectRequestSchema.parse(req.body);
    const found = await prisma.instructorRequest.findUnique({ where: { id: req.params.id } });
    if (!found) return apiError(res, 404, 'Không tìm thấy đơn đăng ký', traceId);
    if (found.status !== 'pending') return apiError(res, 400, 'Đơn này đã được xử lý', traceId);

    const request = await prisma.instructorRequest.update({
      where: { id: req.params.id },
      data: { status: 'rejected', rejectionReason: validated.reason, reviewedBy: adminId, reviewedAt: new Date() },
    });

    await writeAuditLog({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'INSTRUCTOR_REQUEST_REJECTED',
      resourceType: 'INSTRUCTOR_REQUEST',
      resourceId: req.params.id,
      targetLabel: found.fullName,
      payload: { userId: found.userId, reason: validated.reason },
      traceId,
    });
    await createInternalNotification({
      userId: found.userId,
      title: 'Hồ sơ giảng viên bị từ chối',
      body: validated.reason,
      eventId: `instructor-request-rejected:${request.id}`,
      metadata: { requestId: request.id, reason: validated.reason, route: '/become-instructor' },
      traceId,
    });

    const response: ApiResponse<typeof request> = {
      success: true,
      code: 200,
      message: 'Đã từ chối đơn đăng ký',
      data: request,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) return apiError(res, 400, err.errors[0]?.message || 'Dữ liệu không hợp lệ', traceId);
    logger.error({ err, traceId }, 'rejectInstructorRequest failed');
    return apiError(res, 500, 'Lỗi hệ thống khi từ chối đơn', traceId);
  }
}
