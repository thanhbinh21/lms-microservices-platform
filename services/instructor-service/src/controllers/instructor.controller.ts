import type { Request, Response } from 'express';
import {
  approveRequest,
  createInstructorRequest,
  type CreateInstructorRequestPayload,
  getAllRequests,
  getPendingRequestByUserId,
  getRequestById,
  getRequestStats,
  rejectRequest,
} from '../services/instructor.service';
import { errorResponse, successResponse } from '../utils/apiResponse';

function httpErrorCode(error: unknown): number {
  const c = error && typeof error === 'object' && 'statusCode' in error ? (error as { statusCode?: number }).statusCode : undefined;
  return typeof c === 'number' && c >= 400 && c < 600 ? c : 500;
}

export async function createRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
  try {
    const payload = req.body as Record<string, unknown>;
    const requiredFields = [
      'fullName',
      'phone',
      'expertise',
      'experienceYears',
      'bio',
      'courseTitle',
      'courseCategory',
      'courseDescription',
    ] as const;

    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        return errorResponse(res, `Missing field: ${field}`, 400, traceId);
      }
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 401, traceId);
    }

    const result = await createInstructorRequest(
      payload as unknown as CreateInstructorRequestPayload,
      req.user,
      token,
    );
    return successResponse(res, 'Instructor request submitted successfully', result, 201, traceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit instructor request';
    return errorResponse(res, message, httpErrorCode(error), traceId);
  }
}

export async function getMyRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 401, traceId);
    }
    const request = await getPendingRequestByUserId(req.user.userId);
    return successResponse(res, 'OK', { request }, 200, traceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch request';
    return errorResponse(res, message, 500, traceId);
  }
}

export async function getStats(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
  try {
    const data = await getRequestStats();
    return successResponse(res, 'OK', data, 200, traceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats';
    return errorResponse(res, message, 500, traceId);
  }
}

export async function getRequests(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
  try {
    const data = await getAllRequests();
    return successResponse(res, 'Fetched instructor requests successfully', data, 200, traceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch requests';
    return errorResponse(res, message, 500, traceId);
  }
}

export async function getRequest(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
  try {
    const data = await getRequestById(req.params.id as string);
    if (!data) {
      return errorResponse(res, 'Instructor request not found', 404, traceId);
    }
    return successResponse(res, 'Fetched instructor request successfully', data, 200, traceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch request';
    return errorResponse(res, message, 500, traceId);
  }
}

export async function approve(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 401, traceId);
    }

    const data = await approveRequest(req.params.id as string, req.user);
    return successResponse(res, 'Instructor request approved', data, 200, traceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to approve request';
    return errorResponse(res, message, httpErrorCode(error), traceId);
  }
}

export async function reject(req: Request, res: Response): Promise<Response | void> {
  const traceId = (req.headers['x-trace-id'] as string | undefined) || null;
  try {
    const data = await rejectRequest(req.params.id as string);
    return successResponse(res, 'Instructor request rejected', data, 200, traceId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reject request';
    return errorResponse(res, message, httpErrorCode(error), traceId);
  }
}
