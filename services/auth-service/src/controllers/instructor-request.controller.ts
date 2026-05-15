import { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@lms/logger';
import type { ApiResponse } from '@lms/types';
import prisma from '../lib/prisma.js';
import { writeAuditLog } from '../lib/audit.js';
import axios from 'axios';

// Schema validate payload tao don
const createRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự'),
  phone: z.string().trim().min(9, 'Số điện thoại không hợp lệ'),
  expertise: z.string().trim().min(2),
  specialization: z.string().trim().optional(),
  experienceYears: z.coerce.number().int().min(0),
  bio: z.string().trim().min(10, 'Giới thiệu tối thiểu 10 ký tự'),
  courseTitle: z.string().trim().min(2),
  courseCategory: z.string().trim().min(2),
  courseDescription: z.string().trim().min(10),
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
  reason: z.string().trim().min(10, 'Ly do tu choi toi thieu 10 ky tu'),
});

function getMediaServiceUrl(): string {
  return (process.env.MEDIA_SERVICE_URL || 'http://localhost:3004').replace(/\/$/, '');
}

// Upload URL qua media-service neu can (fallback giua nguyen URL neu loi)
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
    // Fallback: giu nguyen URL neu upload that bai
  }
  return fieldValue;
}

/** POST /instructor/request — Hoc vien nop don xin tro thanh giang vien */
export async function createInstructorRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const validated = createRequestSchema.parse(req.body);

    // Kiem tra don dang pending de tranh trung lap
    const existingPending = await prisma.instructorRequest.findFirst({
      where: { userId, status: 'pending' },
    });
    if (existingPending) {
      const response: ApiResponse<null> = {
        success: false,
        code: 409,
        message: 'Bạn đã có hồ sơ đang chờ duyệt. Vui lòng đợi kết quả trước khi gửi lại.',
        data: null,
        trace_id: traceId,
      };
      return res.status(409).json(response);
    }

    // Upload media neu co
    const cvFile = await uploadMediaIfProvided(validated.cvFile);
    const certificateFile = await uploadMediaIfProvided(validated.certificateFile);
    const identityCard = await uploadMediaIfProvided(validated.identityCard);
    const avatar = await uploadMediaIfProvided(validated.avatar);

    const request = await prisma.instructorRequest.create({
      data: {
        userId,
        fullName: validated.fullName,
        phone: validated.phone,
        email: validated.email || '',
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
      },
    });

    const response: ApiResponse<typeof request> = {
      success: true,
      code: 201,
      message: 'Hồ sơ đăng ký giảng viên đã được gửi thành công',
      data: request,
      trace_id: traceId,
    };
    return res.status(201).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0]?.message || 'Dữ liệu không hợp lệ',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }
    logger.error({ err, userId, traceId }, 'createInstructorRequest that bai');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Lỗi hệ thống khi gửi hồ sơ',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** GET /instructor/my-request — Hoc vien xem don cua minh */
export async function getMyInstructorRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const userId = res.locals.userId as string;

  try {
    const request = await prisma.instructorRequest.findFirst({
      where: { userId, status: 'pending' },
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
    logger.error({ err, userId, traceId }, 'getMyInstructorRequest that bai');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Lỗi hệ thống',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** GET /admin/instructor/requests — Admin xem tat ca don */
export async function listInstructorRequests(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const status = (req.query.status as string) || undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

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
    logger.error({ err, traceId }, 'listInstructorRequests that bai');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Lỗi hệ thống',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** GET /admin/instructor/requests/stats — Thong ke so don */
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
    logger.error({ err, traceId }, 'getInstructorRequestStats that bai');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Lỗi hệ thống',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** GET /admin/instructor/requests/:id — Xem chi tiet 1 don */
export async function getInstructorRequestById(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';

  try {
    const request = await prisma.instructorRequest.findUnique({ where: { id: req.params.id } });
    if (!request) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Không tìm thấy đơn đăng ký',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof request> = {
      success: true,
      code: 200,
      message: 'OK',
      data: request,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'getInstructorRequestById that bai');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Lỗi hệ thống',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** PUT /admin/instructor/approve/:id — Admin duyet don va nang cap role */
export async function approveInstructorRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const adminId = res.locals.userId as string;

  try {
    const found = await prisma.instructorRequest.findUnique({ where: { id: req.params.id } });
    if (!found) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Không tìm thấy đơn đăng ký',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }
    if (found.status !== 'pending') {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Đơn này đã được xử lý',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    // Nang cap role INSTRUCTOR + cap nhat trang thai don trong transaction
    const [request] = await prisma.$transaction([
      prisma.instructorRequest.update({
        where: { id: req.params.id },
        data: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() },
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

    const response: ApiResponse<typeof request> = {
      success: true,
      code: 200,
      message: 'Đơn đăng ký đã được duyệt. Tài khoản đã được nâng cấp lên INSTRUCTOR.',
      data: request,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    logger.error({ err, traceId }, 'approveInstructorRequest that bai');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Lỗi hệ thống khi duyệt đơn',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}

/** PUT /admin/instructor/reject/:id — Admin tu choi don */
export async function rejectInstructorRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string) || '';
  const adminId = res.locals.userId as string;

  try {
    const validated = rejectRequestSchema.parse(req.body);
    const found = await prisma.instructorRequest.findUnique({ where: { id: req.params.id } });
    if (!found) {
      const response: ApiResponse<null> = {
        success: false,
        code: 404,
        message: 'Không tìm thấy đơn đăng ký',
        data: null,
        trace_id: traceId,
      };
      return res.status(404).json(response);
    }
    if (found.status !== 'pending') {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: 'Đơn này đã được xử lý',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }

    const request = await prisma.instructorRequest.update({
      where: { id: req.params.id },
      data: { status: 'rejected', reviewedBy: adminId, reviewedAt: new Date() },
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

    const response: ApiResponse<typeof request> = {
      success: true,
      code: 200,
      message: 'Đã từ chối đơn đăng ký',
      data: request,
      trace_id: traceId,
    };
    return res.status(200).json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const response: ApiResponse<null> = {
        success: false,
        code: 400,
        message: err.errors[0]?.message || 'Du lieu khong hop le',
        data: null,
        trace_id: traceId,
      };
      return res.status(400).json(response);
    }
    logger.error({ err, traceId }, 'rejectInstructorRequest that bai');
    const response: ApiResponse<null> = {
      success: false,
      code: 500,
      message: 'Lỗi hệ thống khi từ chối đơn',
      data: null,
      trace_id: traceId,
    };
    return res.status(500).json(response);
  }
}
