# Kong Gateway Setup Guide

## Overview

Kong Gateway là API Gateway chính cho LMS Microservices Platform. Kong chạy trong Docker container (DB-less mode) với declarative configuration.

## Architecture

```
Client → Kong Gateway (port 8000)
         ├─ JWT Verification (Kong Plugin)
         ├─ Rate Limiting (100 req/min)
         ├─ Request Tracing (x-trace-id)
         └─ Proxy to Services
              ├─ /auth       → localhost:3001
              ├─ /course     → localhost:3002
              ├─ /payment    → localhost:3003
              ├─ /media      → localhost:3004
              └─ /notification → localhost:3005
```

## Configuration Files

- **kong.yml**: Declarative configuration (services, routes, plugins)
- **docker-compose.yml**: Kong container definition

## Setup Steps

### 1. Start Kong Gateway

```bash
docker-compose up -d kong
```

### 2. Verify Kong is Running

```bash
curl http://localhost:8001/status
```

Expected response:
```json
{
  "database": {
    "reachable": true
  },
  "server": {
    "connections_accepted": 1,
    "total_requests": 1
  }
}
```

### 3. Test Health Endpoint

```bash
curl http://localhost:8000/auth/health
```

## Kong Plugins Used

### 1. **JWT Plugin** (Protected Routes)
- Validates JWT tokens
- Extracts user claims
- Applied to: /course, /payment, /media, /notification

### 2. **Rate Limiting Plugin**
- Limit: 100 requests per minute
- Policy: Local (in-memory)
- Applied to: All routes

### 3. **Request Transformer Plugin**
- Injects headers: x-user-id, x-user-role
- Services trust these headers (no re-verification)

### 4. **Correlation ID Plugin**
- Generates x-trace-id for request tracing
- Echoes to response headers

### 5. **CORS Plugin**
- Allows cross-origin requests
- Exposes x-trace-id header

## Public Routes (No JWT Required)

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/health`

## Protected Routes (JWT Required)

All other routes require `Authorization: Bearer <token>` header.

## Request Flow

1. **Client sends request** → Kong Gateway (port 8000)
2. **Kong applies plugins**:
   - Generate x-trace-id (if not present)
   - Check rate limit
   - Verify JWT (for protected routes)
   - Extract user claims → inject x-user-id, x-user-role
3. **Kong proxies** → Microservice (localhost:300X)
4. **Service processes** request (trusts x-user-id header)
5. **Kong returns** response to client

## Configuration Updates

To update Kong configuration:

1. Edit `kong.yml`
2. Restart Kong:
```bash
docker-compose restart kong
```

Kong will reload declarative config automatically.

## Admin API (Port 8001)

### View All Services
```bash
curl http://localhost:8001/services
```

### View All Routes
```bash
curl http://localhost:8001/routes
```

### View All Plugins
```bash
curl http://localhost:8001/plugins
```

## Troubleshooting

### Kong container won't start
```bash
docker-compose logs kong
```

### JWT verification fails
- Ensure JWT_SECRET matches between auth-service and Kong JWT plugin
- Check JWT token format and expiration

### Service unreachable
- Verify microservice is running on correct port
- Check `host.docker.internal` resolves correctly (Windows/Mac)
- On Linux, use `host.docker.internal` or `172.17.0.1`

## Security Notes

- Kong runs in DB-less mode (no database required)
- Configuration stored in `kong.yml` (version controlled)
- JWT verification happens ONCE at gateway
- Services trust Kong-injected headers
- Rate limiting protects against abuse
- CORS configured for web clients

## Production Recommendations

1. Use Kong DB mode with PostgreSQL for dynamic config
2. Enable HTTPS/TLS
3. Use Kong Manager (Enterprise) for GUI
4. Implement API key authentication for public APIs
5. Add request/response logging
6. Enable Prometheus metrics
7. Use Kong Ingress Controller for Kubernetes
