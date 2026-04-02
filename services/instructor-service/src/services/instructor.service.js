const axios = require('axios');
const prisma = require('../utils/prisma');
const { getAuthServiceBaseUrl } = require('../utils/resolveAuthServiceUrl');

async function uploadMediaIfProvided(fieldValue, token) {
  if (!fieldValue) return null;

  try {
    const response = await axios.post(
      `${process.env.MEDIA_SERVICE_URL}/api/upload/external`,
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
  } catch (_error) {
    return fieldValue;
  }

  return fieldValue;
}

async function getPendingRequestByUserId(userId) {
  return prisma.instructorRequest.findFirst({
    where: { userId, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
}

async function createInstructorRequest(payload, user, token) {
  const existingPending = await getPendingRequestByUserId(user.userId);
  if (existingPending) {
    const err = new Error('Bạn đã có hồ sơ đang chờ duyệt. Vui lòng đợi kết quả trước khi gửi lại.');
    err.statusCode = 409;
    throw err;
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

async function getAllRequests() {
  return prisma.instructorRequest.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

async function getRequestById(id) {
  return prisma.instructorRequest.findUnique({
    where: { id },
  });
}

async function getRequestStats() {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.instructorRequest.count(),
    prisma.instructorRequest.count({ where: { status: 'pending' } }),
    prisma.instructorRequest.count({ where: { status: 'approved' } }),
    prisma.instructorRequest.count({ where: { status: 'rejected' } }),
  ]);
  return { total, pending, approved, rejected };
}

async function approveRequest(id, token) {
  const found = await prisma.instructorRequest.findUnique({ where: { id } });
  if (!found) {
    const err = new Error('Không tìm thấy đơn đăng ký');
    err.statusCode = 404;
    throw err;
  }
  if (found.status !== 'pending') {
    const err = new Error('Đơn này đã được xử lý');
    err.statusCode = 400;
    throw err;
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

async function rejectRequest(id) {
  const found = await prisma.instructorRequest.findUnique({ where: { id } });
  if (!found) {
    const err = new Error('Không tìm thấy đơn đăng ký');
    err.statusCode = 404;
    throw err;
  }
  if (found.status !== 'pending') {
    const err = new Error('Đơn này đã được xử lý');
    err.statusCode = 400;
    throw err;
  }

  return prisma.instructorRequest.update({
    where: { id },
    data: { status: 'rejected' },
  });
}

module.exports = {
  createInstructorRequest,
  getAllRequests,
  getRequestById,
  getPendingRequestByUserId,
  getRequestStats,
  approveRequest,
  rejectRequest,
};
