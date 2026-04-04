import axios from 'axios';
import type { InstructorRequest } from '../generated/prisma';
import { prisma } from '../utils/prisma';
import { getAuthServiceBaseUrl } from '../utils/resolveAuthServiceUrl';

export interface AuthUserContext {
  userId: string;
  role: string;
  email?: string;
}

export interface CreateInstructorRequestPayload {
  fullName: string;
  phone: string;
  email?: string;
  expertise: string;
  specialization?: string;
  experienceYears: number;
  bio: string;
  courseTitle: string;
  courseCategory: string;
  courseDescription: string;
  dateOfBirth?: string;
  address?: string;
  currentJob?: string;
  github?: string;
  linkedin?: string;
  website?: string;
  youtube?: string;
  cvFile?: string;
  certificateFile?: string;
  identityCard?: string;
  avatar?: string;
  targetStudents?: string;
}

function throwHttp(statusCode: number, message: string): never {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  throw err;
}

async function uploadMediaIfProvided(fieldValue: string | undefined, token: string): Promise<string | null> {
  if (!fieldValue) return null;

  const base = process.env.MEDIA_SERVICE_URL?.replace(/\/$/, '');
  if (!base) return fieldValue;

  try {
    const response = await axios.post<{ success?: boolean; data?: { url?: string } }>(
      `${base}/api/upload/external`,
      { sourceUrl: fieldValue },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.data?.success) {
      return response.data?.data?.url || fieldValue;
    }
  } catch {
    return fieldValue;
  }

  return fieldValue;
}

export async function getPendingRequestByUserId(userId: string): Promise<InstructorRequest | null> {
  return prisma.instructorRequest.findFirst({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createInstructorRequest(
  payload: CreateInstructorRequestPayload,
  user: AuthUserContext,
  token: string,
): Promise<InstructorRequest> {
  const existingPending = await getPendingRequestByUserId(user.userId);
  if (existingPending) {
    throwHttp(
      409,
      'Bạn đã có hồ sơ đang chờ duyệt. Vui lòng đợi kết quả trước khi gửi lại.',
    );
  }

  const cvFile = await uploadMediaIfProvided(payload.cvFile, token);
  const certificateFile = await uploadMediaIfProvided(payload.certificateFile, token);
  const identityCard = await uploadMediaIfProvided(payload.identityCard, token);
  const avatar = await uploadMediaIfProvided(payload.avatar, token);

  return prisma.instructorRequest.create({
    data: {
      userId: user.userId,
      fullName: payload.fullName,
      phone: payload.phone,
      email: user.email || payload.email || '',
      dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
      address: payload.address || null,
      expertise: payload.expertise,
      specialization: payload.specialization || payload.expertise,
      experienceYears: payload.experienceYears,
      currentJob: payload.currentJob || null,
      bio: payload.bio,
      github: payload.github || null,
      linkedin: payload.linkedin || null,
      website: payload.website || null,
      youtube: payload.youtube || null,
      cvFile,
      certificateFile,
      identityCard,
      avatar,
      courseTitle: payload.courseTitle,
      courseCategory: payload.courseCategory,
      courseDescription: payload.courseDescription,
      targetStudents: payload.targetStudents || null,
      status: 'pending',
    },
  });
}

export async function getAllRequests(): Promise<InstructorRequest[]> {
  return prisma.instructorRequest.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getRequestById(id: string): Promise<InstructorRequest | null> {
  return prisma.instructorRequest.findUnique({
    where: { id },
  });
}

export async function getRequestStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}> {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.instructorRequest.count(),
    prisma.instructorRequest.count({ where: { status: 'pending' } }),
    prisma.instructorRequest.count({ where: { status: 'approved' } }),
    prisma.instructorRequest.count({ where: { status: 'rejected' } }),
  ]);
  return { total, pending, approved, rejected };
}

export async function approveRequest(id: string, token: string): Promise<InstructorRequest> {
  const found = await prisma.instructorRequest.findUnique({ where: { id } });
  if (!found) {
    throwHttp(404, 'Không tìm thấy đơn đăng ký');
  }
  if (found.status !== 'pending') {
    throwHttp(400, 'Đơn này đã được xử lý');
  }

  const request = await prisma.instructorRequest.update({
    where: { id },
    data: { status: 'approved' },
  });

  await axios.patch(
    `${getAuthServiceBaseUrl()}/users/role`,
    {
      userId: request.userId,
      role: 'INSTRUCTOR',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return request;
}

export async function rejectRequest(id: string): Promise<InstructorRequest> {
  const found = await prisma.instructorRequest.findUnique({ where: { id } });
  if (!found) {
    throwHttp(404, 'Không tìm thấy đơn đăng ký');
  }
  if (found.status !== 'pending') {
    throwHttp(400, 'Đơn này đã được xử lý');
  }

  return prisma.instructorRequest.update({
    where: { id },
    data: { status: 'rejected' },
  });
}
