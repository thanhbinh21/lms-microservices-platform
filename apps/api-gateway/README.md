# API Gateway

Central entry point for all client requests to LMS Microservices.

## Features

- ✅ JWT Authentication & Verification
- ✅ Request Tracing (x-trace-id)
- ✅ Rate Limiting (100 req/min)
- ✅ Security Headers (Helmet)
- ✅ CORS Support
- ✅ Proxy to Microservices
- ✅ User Context Injection (x-user-id, x-user-role)

## Architecture

```
Client → API Gateway (JWT verify) → Microservices
         ├─ /auth       → auth-service:3001
         ├─ /course     → course-service:3002
         ├─ /payment    → payment-service:3003
         ├─ /media      → media-service:3004
         └─ /notification → notification-service:3005
```

## Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update JWT_SECRET (must match auth-service):
```env
JWT_SECRET=your-super-secret-jwt-key
```

3. Install dependencies:
```bash
pnpm install
```

4. Run in development:
```bash
pnpm dev
```

## Public Routes (No Auth Required)

- `POST /auth/login`
- `POST /auth/register`
- `GET /health`

## Protected Routes (JWT Required)

All other routes require `Authorization: Bearer <token>` header.

## Headers Injected to Services

Gateway automatically injects these headers to downstream services:

- `x-user-id`: User ID from JWT
- `x-user-role`: User role (student/instructor/admin)
- `x-trace-id`: Request trace ID for logging

## Rate Limiting

- Default: 100 requests per minute per IP
- Can be configured via `.env`:
  - `RATE_LIMIT_WINDOW_MS=60000`
  - `RATE_LIMIT_MAX_REQUESTS=100`

## Security

- JWT verification happens ONLY at Gateway
- Services trust Gateway headers (no re-verification)
- HTTPS required in production
- Helmet.js for security headers
