import request from 'supertest';
import { describe, expect, it } from 'vitest';

const gatewayUrl = process.env.GATEWAY_BASE_URL || 'http://localhost:3000';
const authServiceUrl = process.env.AUTH_SERVICE_BASE_URL || 'http://localhost:3101';
const courseServiceUrl = process.env.COURSE_SERVICE_BASE_URL || 'http://localhost:3002';
const mediaServiceUrl = process.env.MEDIA_SERVICE_BASE_URL || 'http://localhost:3004';

describe('Phase 1-7 smoke tests', () => {
  it('gateway health should return ApiResponse success', async () => {
    const response = await request(gatewayUrl).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('auth service health should return ApiResponse success', async () => {
    const response = await request(authServiceUrl).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('course service health should return ApiResponse success', async () => {
    const response = await request(courseServiceUrl).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('media service health should return ApiResponse success', async () => {
    const response = await request(mediaServiceUrl).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('gateway should block protected course route without token', async () => {
    const response = await request(gatewayUrl).get('/course/api/instructor/courses');
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
