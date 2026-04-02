const {
  createInstructorRequest,
  getAllRequests,
  getRequestById,
  getPendingRequestByUserId,
  getRequestStats,
  approveRequest,
  rejectRequest,
} = require('../services/instructor.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

function httpErrorCode(error) {
  const c = error?.statusCode;
  return typeof c === 'number' && c >= 400 && c < 600 ? c : 500;
}

async function createRequest(req, res) {
  const traceId = req.headers['x-trace-id'] || null;
  try {
    const payload = req.body;
    const requiredFields = [
      'fullName',
      'phone',
      'expertise',
      'experienceYears',
      'bio',
      'courseTitle',
      'courseCategory',
      'courseDescription',
    ];

    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        return errorResponse(res, `Missing field: ${field}`, 400, traceId);
      }
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    const result = await createInstructorRequest(payload, req.user, token);
    return successResponse(res, 'Instructor request submitted successfully', result, 201, traceId);
  } catch (error) {
    return errorResponse(
      res,
      error.message || 'Failed to submit instructor request',
      httpErrorCode(error),
      traceId,
    );
  }
}

async function getMyRequest(req, res) {
  const traceId = req.headers['x-trace-id'] || null;
  try {
    const request = await getPendingRequestByUserId(req.user.userId);
    return successResponse(res, 'OK', { request }, 200, traceId);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to fetch request', 500, traceId);
  }
}

async function getStats(req, res) {
  const traceId = req.headers['x-trace-id'] || null;
  try {
    const data = await getRequestStats();
    return successResponse(res, 'OK', data, 200, traceId);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to fetch stats', 500, traceId);
  }
}

async function getRequests(req, res) {
  const traceId = req.headers['x-trace-id'] || null;
  try {
    const data = await getAllRequests();
    return successResponse(res, 'Fetched instructor requests successfully', data, 200, traceId);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to fetch requests', 500, traceId);
  }
}

async function getRequest(req, res) {
  const traceId = req.headers['x-trace-id'] || null;
  try {
    const data = await getRequestById(req.params.id);
    if (!data) {
      return errorResponse(res, 'Instructor request not found', 404, traceId);
    }
    return successResponse(res, 'Fetched instructor request successfully', data, 200, traceId);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to fetch request', 500, traceId);
  }
}

async function approve(req, res) {
  const traceId = req.headers['x-trace-id'] || null;
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    const data = await approveRequest(req.params.id, token);
    return successResponse(res, 'Instructor request approved', data, 200, traceId);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to approve request', httpErrorCode(error), traceId);
  }
}

async function reject(req, res) {
  const traceId = req.headers['x-trace-id'] || null;
  try {
    const data = await rejectRequest(req.params.id);
    return successResponse(res, 'Instructor request rejected', data, 200, traceId);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to reject request', httpErrorCode(error), traceId);
  }
}

module.exports = {
  createRequest,
  getMyRequest,
  getStats,
  getRequests,
  getRequest,
  approve,
  reject,
};
