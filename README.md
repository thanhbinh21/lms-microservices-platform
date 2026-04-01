# LMS Microservices Platform

Event-Driven Learning Management System built with Microservices Architecture

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Services](#services)
- [Getting Started](#getting-started)
- [Quick Start (Verified)](#quick-start-verified)
- [Database Setup](#database-setup)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Key Decisions](#key-decisions)

## Overview

Production-ready Learning Management System (LMS) designed for online course management and delivery.

### Core Features

- **Course Management**: Create, manage, and organize courses with drag-and-drop curriculum builder
- **Payment Integration**: VNPay payment gateway for secure course enrollment
- **Event-Driven Architecture**: Kafka-based event streaming for reliable asynchronous processing
- **Learning Progress Tracking**: Monitor student progress and course completion
- **Media Management**: Video hosting with presigned uploads (local + S3 provider)
- **Notification System**: Email notifications for enrollment, completion, and important events

### Architecture Characteristics

- Microservices architecture with database-per-service pattern
- Event-driven communication using Apache Kafka with retry and Dead Letter Queue
- BFF (Backend for Frontend) pattern with Next.js Server Actions
- API Gateway for centralized authentication and routing
- Serverless PostgreSQL databases with Neon (auto-pause for cost efficiency)

## Tech Stack

### Frontend
- **Next.js 16**: React framework with App Router and Server Actions
- **Shadcn UI**: Component library built on Radix UI
- **TailwindCSS**: Utility-first CSS framework
- **Redux Toolkit**: State management
- **TypeScript**: Type safety and developer experience

### Backend
- **Node.js 18+**: JavaScript runtime
- **Express**: Lightweight HTTP framework
- **TypeScript 5.3+**: Strongly typed JavaScript
- **Prisma**: Next-generation ORM for PostgreSQL
- **Zod**: Runtime schema validation

### Infrastructure
- **PostgreSQL**: Relational database via Neon Serverless
- **Apache Kafka**: Distributed event streaming platform
- **Redis**: In-memory data store for sessions and caching
- **Kong Gateway**: Declarative API Gateway (DB-less mode)
- **Docker**: Containerization for local development
- **Turborepo**: High-performance monorepo build system

### Payment & External Services
- **VNPay**: Vietnam payment gateway integration
- **AWS S3**: Optional media storage backend

## Architecture

### Architectural Principles

1. **Microservices**: Independent, deployable services with clear boundaries
2. **Database per Service**: Each service owns its database schema and data
3. **Event-Driven Communication**: Asynchronous messaging via Apache Kafka
4. **BFF Pattern**: Next.js Server Actions aggregate data from multiple services
5. **API Gateway**: Kong handles authentication, rate limiting, and routing
6. **Stateless Services**: Session state managed by Redis, not application servers

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│              Next.js 16 (Frontend + BFF)            │
│                    Port: 3000                       │
│   - Student UI (Dashboard, Learning, Courses)      │
│   - Instructor UI (Curriculum Builder)             │
│   - Server Actions (Data Aggregation) 
                                    │
└─────────────────────┬───────────────────────────────┘
                      │
                      │ HTTP Requests
                      ▼
┌─────────────────────────────────────────────────────┐
│              Kong API Gateway                       │
│                    Port: 8000                       │
│   - JWT Verification                               │
│   - Rate Limiting (100 req/min)                    │
│   - CORS Handling                                  │
│   - Header Injection (x-user-id, x-user-role)     │
└──────┬──────────┬──────────┬──────────┬────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Auth    │ │ Course   │ │ Payment  │ │  Media   │
│ Service  │ │ Service  │ │ Service  │ │ Service  │
│  :3101   │ │  :3002   │ │  :3003   │ │  :3004   │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │
     ▼            ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ auth_db  │ │course_db │ │payment_db│ │ media_db │
│  (Neon)  │ │  (Neon)  │ │  (Neon)  │ │  (Neon)  │
└──────────┘ └──────────┘ └────┬─────┘ └──────────┘
                                │
                                │ Publish Events
                                ▼
                       ┌─────────────────┐
                       │  Apache Kafka 
                       │  (Event Bus)    │
                       │  Topics:        │
                       │  - Orders       │
                       │  - Enrollments  │
                       │  - Notifications│
                       └────────┬────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             ┌─────────────┐        ┌──────────────┐
             │   Course    │        │Notification  │
             │   Worker    │        │Service :3005 │
             │ (Consumer)  │        │  + Worker    │
             └─────────────┘        └──────────────┘
```

### Authentication Flow

Kong Gateway acts as the single point of authentication:

1. Client submits credentials to `/auth/login` via Kong Gateway
2. Kong forwards request to Auth Service
3. Auth Service verifies credentials against `auth_db`
4. Auth Service creates session in Redis (TTL: 7 days)
5. Auth Service returns Access Token (15 minutes) and Refresh Token (7 days)
6. Client includes Access Token in subsequent requests (Authorization: Bearer header)
7. Kong verifies JWT signature and expiry
8. Kong injects headers (`x-user-id`, `x-user-role`, `x-trace-id`) to downstream services
9. Downstream services trust Gateway headers without re-verification

**Security Note**: Services MUST NOT re-verify JWT. This ensures single responsibility and prevents duplicate crypto operations.

### Payment & Enrollment Flow

End-to-end payment processing with idempotent enrollment:

1. Student initiates payment via Payment Service
2. Payment Service verifies course price from Course Service (prevents client-side tampering)
3. Payment Service creates order record in `payment_db` with status `PENDING`
4. Payment Service redirects student to VNPay payment URL
5. Student completes payment on VNPay portal
6. VNPay sends IPN (Instant Payment Notification) callback to Payment Service
7. Payment Service validates VNPay signature and checksum
8. Payment Service stores complete VNPay response in JSONB field (audit compliance)
9. Payment Service updates order status to `COMPLETED`
10. Payment Service publishes `payment.order.completed` event to Kafka
11. Course Worker consumes event and creates enrollment (idempotent check by order ID)
12. On failure: Retry mechanism (5s delay, then 1m, then 5m) before moving to Dead Letter Queue
13. Notification Service consumes enrollment event and sends confirmation email

**Anti-Tampering**: Payment Service MUST fetch price from Course Service, never trust client-submitted price.

### Data Aggregation Pattern

Services do NOT perform cross-database joins. Frontend aggregates data via parallel API calls:

```typescript
// Example: apps/web-client/src/app/actions/dashboard.ts
export async function getStudentDashboard(userId: string) {
  // Parallel fetch from multiple services
  const [userProfile, enrolledCourses, notifications] = await Promise.all([
    fetch(`${GATEWAY_URL}/auth/users/${userId}`),
    fetch(`${GATEWAY_URL}/course/enrollments?userId=${userId}`),
    fetch(`${GATEWAY_URL}/notification/recent?userId=${userId}`)
  ]);
  
  // Aggregate and return merged data
  return {
    user: userProfile.data,
    courses: enrolledCourses.data,
    notifications: notifications.data
  };
}
```

This pattern maintains service independence while providing rich UI experiences.

## Project Structure

```
olms-microservices/
├── apps/
│   └── web-client/               # Next.js 16 Frontend
│       ├── src/
│       │   ├── app/              # App Router pages
│       │   │   ├── login/        # Login page
│       │   │   ├── register/     # Registration page
│       │   │   ├── dashboard/    # Student dashboard
│       │   │   └── actions/      # Server Actions (BFF layer)
│       │   ├── components/
│       │   │   ├── auth/         # Auth-related components
│       │   │   └── ui/           # Shadcn UI components
│       │   └── lib/
│       │       ├── redux/        # Redux store and slices
│       │       └── schemas/      # Zod validation schemas
│       └── public/               # Static assets
│
├── services/
│   ├── auth-service/             # Authentication & JWT (Port 3101 in Kong route)
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # User, Session, RefreshToken models
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── controllers/
│   │       │   ├── register.controller.ts
│   │       │   ├── login.controller.ts
│   │       │   ├── refresh.controller.ts
│   │       │   └── logout.controller.ts
│   │       └── lib/
│   │           ├── jwt.ts        # JWT signing/verification
│   │           ├── redis.ts      # Redis session management
│   │           └── prisma.ts     # Prisma client singleton
│   │
│   ├── course-service/           # Course CRUD & Curriculum (Port 3002)
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Course, Chapter, Lesson, Enrollment models
│   │   └── src/
│   │       ├── controllers/
│   │       │   ├── course.controller.ts
│   │       │   ├── chapter.controller.ts
│   │       │   └── lesson.controller.ts
│   │       └── middleware/
│   │           └── require-auth.ts
│   │
│   ├── media-service/            # Media URLs (Port 3004)
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Media model
│   │   └── src/
│   │       ├── controllers/
│   │       │   ├── upload.controller.ts
│   │       │   └── media.controller.ts
│   │       └── storage/
│   │           ├── s3.storage.ts         # AWS S3 implementation
│   │           └── local.storage.ts      # Local storage for dev
│   │
│   ├── payment-service/          # VNPay Integration (Port 3003) - Phase 9-10
│   │   └── (To be implemented)
│   │
│   └── notification-service/     # Email Worker (Port 3005) - Phase 14
│       └── (To be implemented)
│
├── packages/                     # Shared libraries
│   ├── db-prisma/                # Prisma singleton utility
│   │   └── src/index.ts          # Prevents "too many connections" error
│   │
│   ├── kafka-client/             # Kafka producer/consumer wrappers
│   │   └── src/index.ts          # Standardized Kafka client
│   │
│   ├── logger/                   # Pino logger with trace_id
│   │   └── src/index.ts          # Structured logging utility
│   │
│   ├── types/                    # Shared TypeScript interfaces
│   │   └── src/index.ts          # ApiResponse, User, etc.
│   │
│   └── env-validator/            # Zod environment validation
│       └── src/index.ts          # T3 Env pattern implementation
│
├── docker-compose.yml            # Kafka, Zookeeper, Redis, Kong
├── kong.yml                      # Kong declarative config
├── turbo.json                    # Turborepo pipeline config
├── pnpm-workspace.yaml           # PNPM workspace definition
├── tsconfig.json                 # Root TypeScript config
├── READMECODE.md                 # Development roadmap and rules
└── project_structure.md          # Architecture documentation
```

### Directory Responsibilities

- **apps/**: Frontend applications
- **services/**: Backend microservices (each with independent database)
- **packages/**: Shared libraries used across multiple services

## Services

### Auth Service (COMPLETED - Phase 3)

**Port**: 3101 (via Kong route in current workspace)  
**Database**: `auth_db` (Neon PostgreSQL)  
**Status**: Production Ready

**Responsibilities:**
- User registration with bcrypt password hashing (10 rounds)
- JWT-based authentication (Access Token + Refresh Token)
- Redis session management (7-day TTL)
- Token refresh and rotation
- User logout and session invalidation

**API Endpoints:**
- `POST /register` - Create new user account
- `POST /login` - Authenticate user and issue tokens
- `POST /refresh` - Refresh access token using refresh token
- `POST /logout` - Invalidate session and refresh token

**Database Models:**
- `User`: id, email, password (hashed), name, role, sourceType, lastLoginAt, createdAt, updatedAt
- `Session`: id, userId, refreshToken, expiresAt, createdAt
- `RefreshToken`: id, token (hashed), userId, expiresAt, isActive

**Security Features:**
- Bcrypt hashing with 10 salt rounds
- JWT with 15-minute access token expiry
- Refresh token rotation on use
- Redis-backed session storage for fast revocation

---

### Course Service (COMPLETED - Phase 5)

**Port**: 3002  
**Database**: `course_db` (Neon PostgreSQL)  
**Status**: Production Ready

**Responsibilities:**
- Course CRUD operations (Create, Read, Update, Delete)
- Curriculum management (Chapters and Lessons)
- Course enrollment tracking
- Instructor course ownership
- Course pricing and metadata

**API Endpoints (service paths):**
- `GET /api/courses` - List public courses
- `GET /api/courses/:slug` - Get course details by slug
- `GET /api/instructor/courses` - List instructor courses (auth)
- `POST /api/courses` - Create course (Instructor/Admin)
- `PUT /api/courses/:id` - Update course (Instructor/Admin)
- `DELETE /api/courses/:id` - Delete course (Instructor/Admin)
- `POST /api/courses/:courseId/chapters` - Add chapter
- `POST /api/courses/:courseId/chapters/:chapterId/lessons` - Add lesson

**Database Models:**
- `Course`: id, title, description, price, instructorId, status, createdAt
- `Chapter`: id, courseId, title, position, createdAt
- `Lesson`: id, chapterId, title, videoUrl, duration, position, createdAt
- `Enrollment`: id, courseId, userId, enrolledAt, progress, completedAt

**Authorization:**
- Instructors can create and manage their own courses
- Students can view published courses
- Admin can manage all courses

---

### Media Service (COMPLETED - Phase 6)

**Port**: 3004  
**Database**: `media_db` (Neon PostgreSQL)  
**Status**: Production Ready

**Responsibilities:**
- Generate presigned upload requests
- Track media metadata (size, type, duration)
- Support storage backends (local, S3)
- Media access control and cleanup

**API Endpoints (service paths):**
- `POST /api/upload/presigned` - Request upload target
- `POST /api/upload/complete` - Confirm uploaded asset
- `POST /api/upload/external` - Register external media
- `GET /api/media/:id` - Get media metadata
- `DELETE /api/media/:id` - Delete media (Instructor/Admin)

**Database Models:**
- `MediaAsset`: id, lessonId, courseId, storageProvider, storageKey, mimeType, size, uploaderId, status

**Storage Backends:**
- Local Storage: Development environment
- AWS S3: Optional external storage

**Security:**
- Presigned URLs expire after 1 hour
- Only enrolled students can access course videos
- Instructors can only delete their own media

---

### Payment Service (PLANNED - Phase 9-10)

**Port**: 3003  
**Database**: `payment_db` (Neon PostgreSQL)  
**Status**: Not Implemented

**Planned Features:**
- VNPay payment gateway integration
- Order management and tracking
- Transaction audit logs (JSONB for full VNPay response)
- Kafka event publishing on payment completion
- Refund handling

**Planned Endpoints:**
- `POST /orders` - Create new order
- `GET /orders/:id` - Get order details
- `POST /vnpay/create-payment-url` - Generate VNPay URL
- `POST /vnpay/ipn` - Handle VNPay callback (webhook)
- `POST /vnpay/return` - Handle user return from VNPay

---

### Notification Service (PLANNED - Phase 14)

**Port**: 3005  
**Database**: `notification_db` (Neon PostgreSQL)  
**Status**: Not Implemented

**Planned Features:**
- Kafka consumer for enrollment events
- Email queue processing
- Notification history and status tracking
- Template-based email rendering
- Retry mechanism for failed sends

## Getting Started

### Prerequisites

- **Node.js** >= 18.0
- **pnpm** >= 8.0 (Package manager)
- **Docker** and Docker Compose
- **Neon Account** (for PostgreSQL databases)
- **Git** for version control

## Quick Start (Verified)

This is the shortest verified flow for this workspace state.

1. Install dependencies
```bash
pnpm install
```

2. Prepare env files
```bash
cp .env.example .env
cp services/auth-service/.env.example services/auth-service/.env
cp services/course-service/.env.example services/course-service/.env
cp services/media-service/.env.example services/media-service/.env
```

3. Create web client env file manually at `apps/web-client/.env.local`
```env
GATEWAY_URL=http://localhost:8000
NEXT_PUBLIC_AUTH_PREFIX=/auth
```

4. Align auth service port with Kong route
```env
# services/auth-service/.env
PORT=3101
```

5. Start infra, migrate DB, run dev
```bash
pnpm run docker:up
cd services/auth-service && pnpm prisma:migrate && pnpm prisma:generate
cd ../course-service && pnpm prisma:migrate && pnpm prisma:generate
cd ../media-service && pnpm prisma:migrate && pnpm prisma:generate
cd ../../
pnpm dev
```

### Installation Steps

#### 1. Clone Repository

```bash
git clone <repository-url>
cd olms-microservices
```

#### 2. Install Dependencies

```bash
pnpm install
```

This installs all dependencies for apps, services, and packages.

#### 3. Setup Environment Variables

Create `.env` files for each service:

```bash
# Root .env (shared infrastructure)
cp .env.example .env
# Edit: KAFKA_BROKER, REDIS_URL, etc.

# Auth Service
cp services/auth-service/.env.example services/auth-service/.env
# Edit: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, REDIS_URL, PORT=3101

# Course Service
cp services/course-service/.env.example services/course-service/.env
# Edit: DATABASE_URL, PORT=3002

# Media Service
cp services/media-service/.env.example services/media-service/.env
# Edit: DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, PORT=3004

# Web Client (create manually)
# apps/web-client/.env.local
# GATEWAY_URL=http://localhost:8000
# NEXT_PUBLIC_AUTH_PREFIX=/auth
```

**Critical Configuration:**
- `JWT_SECRET` must match between Kong Gateway and Auth Service
- All `DATABASE_URL` values must point to Neon PostgreSQL instances
- `REDIS_URL` must point to Redis instance (local or cloud)

#### 4. Start Infrastructure Services

```bash
# Start Kafka, Zookeeper, Redis, Kong Gateway
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Check logs if needed
docker-compose logs -f kafka
docker-compose logs -f kong
```

Expected containers:
- `kafka` (Port 9092)
- `zookeeper` (Port 2181)
- `redis` (Port 6379)
- `kong` (Port 8000)

#### 5. Run Database Migrations

For each service with a database:

```bash
# Auth Service
cd services/auth-service
pnpm prisma:migrate
pnpm prisma:generate

# Course Service
cd ../course-service
pnpm prisma:migrate
pnpm prisma:generate

# Media Service
cd ../media-service
pnpm prisma:migrate
pnpm prisma:generate
```

#### 6. Start Development Servers

From the root directory:

```bash
# Start all services and apps concurrently
pnpm dev
```

Or start individually:

```bash
# Auth Service only
cd services/auth-service
pnpm dev

# Web Client only
cd apps/web-client
pnpm dev
```

#### 7. Verify Installation

- Web Client: http://localhost:3000
- Kong Gateway: http://localhost:8000
- Auth Service: http://localhost:3101/health
- Course Service: http://localhost:3002/health
- Media Service: http://localhost:3004/health

## Database Setup

### Why Neon Serverless?

**Cost Efficiency:**
- Auto-pause after 5 minutes of inactivity
- Zero resource consumption when idle
- Free tier: 0.5GB per database

**Development Benefits:**
- No Docker overhead (saves ~400MB RAM per database)
- Instant connection pooling
- SSL by default

**Trade-offs:**
- Cold start latency (2-3 seconds after auto-pause)
- Requires internet connection

### Required Databases

Create 5 separate databases on Neon:

1. **auth_db**: User accounts, sessions, refresh tokens
2. **course_db**: Courses, chapters, lessons, enrollments
3. **payment_db**: Orders, transactions, VNPay audit logs
4. **media_db**: Media metadata, storage keys
5. **notification_db**: Email queue, notification history

### Setup Instructions

1. Create account at [Neon.tech](https://neon.tech)
2. Create 5 separate projects (one per database)
3. Copy connection string for each database
4. Paste into respective service `.env` file:

```env
# Example connection string
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/auth_db?sslmode=require"
```

**Important**: Always include `?sslmode=require` at the end of connection strings.

### Migration Management

Each service manages its own migrations:

```bash
# Create new migration
cd services/auth-service
pnpm prisma migrate dev --name add_email_verified_field

# Apply migrations in production
pnpm prisma migrate deploy

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset

# Prisma Studio (database GUI)
pnpm prisma studio
```

## API Documentation

### Standard Response Format

All APIs return a consistent JSON structure:

```typescript
interface ApiResponse<T> {
  success: boolean;      // true if request succeeded
  code: number;          // HTTP status code (200, 400, 500, etc.)
  message: string;       // Human-readable message
  data: T | null;        // Response payload (null on error)
  trace_id: string;      // Request trace ID for debugging
}
```

**Success Example:**

```json
{
  "success": true,
  "code": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "user_123",
      "email": "student@example.com",
      "role": "STUDENT"
    }
  },
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Example:**

```json
{
  "success": false,
  "code": 401,
  "message": "Invalid credentials",
  "data": null,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Gateway Headers

Kong Gateway injects these headers to all downstream services:

```
x-user-id: <user_id>          # Authenticated user ID
x-user-role: <role>           # User role (student, instructor, admin)
x-trace-id: <uuid>            # Request trace ID
```

**Rule**: Services MUST trust these headers. Do NOT re-verify JWT in services.

### Authentication Endpoints

All auth endpoints are prefixed with `/auth`:

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "role": "STUDENT"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "SecurePass123!"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGci..."
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "eyJhbGci..."
}
```

### Course Endpoints

All course endpoints are prefixed with `/course`:

#### List Courses
```http
GET /course/api/courses?page=1&limit=10
Authorization: Bearer <access_token>
```

#### Get Course Details
```http
GET /course/api/courses/:slug
Authorization: Bearer <access_token>
```

#### Create Course (Instructor only)
```http
POST /course/api/courses
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Introduction to TypeScript",
  "description": "Learn TypeScript from scratch",
  "price": 299000,
  "status": "draft"
}
```

### Error Codes

- `200` OK - Request succeeded
- `201` Created - Resource created successfully
- `400` Bad Request - Invalid input data
- `401` Unauthorized - Missing or invalid token
- `403` Forbidden - Insufficient permissions
- `404` Not Found - Resource does not exist
- `409` Conflict - Resource already exists
- `500` Internal Server Error - Server-side error

## Development

### Project Commands

**Install dependencies:**
```bash
pnpm install
```

**Start all services:**
```bash
pnpm dev
```

**Build all services:**
```bash
pnpm build
```

**Run tests:**
```bash
pnpm test
```

**Lint code:**
```bash
pnpm lint
```

**Run integration smoke tests:**
```bash
pnpm run test:integration
```

**Docker helpers:**
```bash
pnpm run docker:up
pnpm run docker:down
pnpm run docker:health
```

### Service-Specific Commands

Each service supports these commands:

```bash
cd services/auth-service

# Development mode with hot reload
pnpm dev

# Build TypeScript to JavaScript
pnpm build

# Run production build
pnpm start

# Prisma commands
pnpm prisma:migrate       # Run migrations
pnpm prisma:generate      # Generate Prisma Client
pnpm prisma:studio        # Open Prisma Studio GUI
```

### Docker Commands

**Start infrastructure:**
```bash
docker-compose up -d
```

**Stop infrastructure:**
```bash
docker-compose down
```

**View logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f kafka
docker-compose logs -f redis
docker-compose logs -f kong
```

**Restart service:**
```bash
docker-compose restart kafka
```

**Clean volumes (WARNING: deletes data):**
```bash
docker-compose down -v
```

### Database Management

**Open Prisma Studio:**
```bash
cd services/auth-service
pnpm prisma studio
# Opens GUI at http://localhost:5555
```

**Create migration:**
```bash
pnpm prisma migrate dev --name descriptive_migration_name
```

**Apply migrations:**
```bash
pnpm prisma migrate deploy
```

**Reset database (WARNING: deletes all data):**
```bash
pnpm prisma migrate reset
```

**Generate Prisma Client:**
```bash
pnpm prisma generate
```

### Debugging

**Enable debug logging:**

Set environment variable in service `.env`:
```env
LOG_LEVEL=debug
```

**View request traces:**

All API responses include `trace_id`. Search logs by trace ID:
```bash
docker-compose logs | grep "550e8400-e29b-41d4-a716-446655440000"
```

**Inspect Redis sessions:**
```bash
docker exec -it redis redis-cli
> KEYS session:*
> GET session:user_123
```

**Check Kafka topics:**
```bash
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list
docker exec -it kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic payment.order.completed --from-beginning
```

## Deployment

### Environment Configuration

**Production checklist:**

- [ ] Change `JWT_SECRET` to cryptographically random string (min 32 chars)
- [ ] Change `JWT_REFRESH_SECRET` to different random string
- [ ] Update `DATABASE_URL` to production Neon instances
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to frontend domain
- [ ] Update VNPay credentials (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`)
- [ ] Configure AWS S3 credentials for production bucket
- [ ] Set Redis URL to production instance
- [ ] Configure Kafka broker URLs

**Generate secure secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Build Docker Images

Each service can be containerized:

```bash
# Build Auth Service
docker build -t lms-auth-service:latest -f services/auth-service/Dockerfile .

# Build Course Service
docker build -t lms-course-service:latest -f services/course-service/Dockerfile .

# Build Web Client
docker build -t lms-web-client:latest -f apps/web-client/Dockerfile .
```

### Health Checks

Every service exposes `/health` endpoint:

```bash
curl http://localhost:3001/health
# Response: {"status":"ok","timestamp":"2026-03-08T10:30:00.000Z"}
```

Use health checks for:
- Load balancer configuration
- Kubernetes liveness/readiness probes
- Monitoring systems

### Database Migrations in Production

**DO NOT use `prisma migrate dev` in production.**

Use `prisma migrate deploy` instead:

```bash
cd services/auth-service
pnpm prisma migrate deploy
```

This applies pending migrations without creating new ones.

### Monitoring

**Recommended tools:**
- **Logs**: Datadog, Loggly, or ELK Stack
- **APM**: New Relic, Datadog APM
- **Errors**: Sentry
- **Metrics**: Prometheus + Grafana

**Key metrics to monitor:**
- Request latency (p50, p95, p99)
- Error rate by service
- Database connection pool usage
- Kafka consumer lag
- Redis memory usage

## Roadmap

### Phase 1-4: Foundation (COMPLETED)

- [x] **Phase 1**: Setup Monorepo (Turborepo), Docker Compose, Neon PostgreSQL (Jan 21, 2026)
- [x] **Phase 2**: Setup API Gateway (Kong) & Shared Packages (Logger, Types) (Jan 21, 2026)
- [x] **Phase 3**: Build Auth Service (Login, Register, JWT, Session Redis) (Jan 25, 2026)
- [x] **Phase 4**: Build Frontend Base (Next.js, Shadcn UI, Redux, Login/Register) (Jan 25, 2026)

### Phase 5-9: Core LMS & Media (IN PROGRESS)

- [x] **Phase 5**: Build Course Service DB & CRUD API (Feb 28, 2026)
- [x] **Phase 6**: Build Media Service (Presigned upload flow) (Feb 28, 2026)
- [x] **Phase 6.1**: Code Audit & Production Hardening (Mar 1, 2026)
- [ ] **Phase 7**: Frontend Instructor UI (Drag & Drop Curriculum Builder)
- [ ] **Phase 8**: Frontend Public UI (Course Listing, Detail with BFF Aggregation)
- [ ] **Phase 9**: Build Payment Service DB (Orders & Audit Transactions Table)

### Phase 10-12: Commerce & Payments (PLANNED)

- [ ] **Phase 10**: Integrate VNPay (Create Payment URL & IPN Webhook)
- [ ] **Phase 11**: Kafka Setup (Producer: `payment.order.completed`)
- [ ] **Phase 12**: Kafka Consumer (Enrollment Logic in Course Service + Retry Mechanism)

### Phase 13-15: Learning & Polish (PLANNED)

- [ ] **Phase 13**: Learning UI (Video Player, Progress Tracking API)
- [ ] **Phase 14**: Notification Service (Email Worker consuming Kafka events)
- [ ] **Phase 15**: Deployment & Audit (Dockerize, Audit Logs Check)

## Key Decisions

### Architecture & Database

**No Cross-Service Database Joins:**  
Services maintain complete data autonomy. Frontend performs data aggregation via parallel API calls to multiple services.

**Prisma Singleton Pattern:**  
Implemented in `packages/db-prisma` to prevent "too many connections" error during Next.js HMR (Hot Module Replacement) in development.

**Neon Auto-Pause:**  
Databases auto-pause after 5 minutes of inactivity. First request after pause incurs 2-3 second cold start latency.

### Security & Authentication

**JWT Architecture:**
- Access Token: 15 minutes expiry (short-lived for security)
- Refresh Token: 7 days expiry (stored in database + Redis)
- Token rotation on refresh (prevents replay attacks)

**Gateway-Only JWT Verification:**  
Kong Gateway is the sole JWT verifier. Services trust injected headers (`x-user-id`, `x-user-role`) without re-verification. This prevents duplicate crypto operations and enforces single responsibility.

**Password Security:**  
Bcrypt hashing with 10 salt rounds. Passwords never logged or stored in plaintext.

**Session Management:**  
Redis stores session cache with 7-day TTL. Automatic cleanup on logout or token expiry.

### Payments & Events

**VNPay Checksum Requirement:**  
Parameters must be sorted alphabetically before hashing to prevent "Invalid Checksum" errors during IPN validation.

**Price Verification:**  
Payment Service MUST fetch course price from Course Service via API. Never trust client-submitted prices to prevent price tampering.

**Audit Logging:**  
Complete VNPay response stored in JSONB field for regulatory compliance and dispute resolution.

**Kafka Retry Pattern:**  
Failed message processing retries with exponential backoff (5s, 1m, 5m) before moving to Dead Letter Queue for manual review.

**Idempotent Enrollment:**  
Course Worker checks order ID before creating enrollment to prevent duplicate enrollments from duplicate Kafka messages.

### Environment & Configuration

**T3 Env Pattern:**  
Package `env-validator` uses Zod to validate environment variables at runtime. Application crashes with clear error if required variables are missing.

**Environment File Locations:**
- Root `.env`: Shared infrastructure (Kafka, Redis)
- `services/<service>/.env`: Service-specific config
- `apps/web-client/.env.local`: Next.js config for server actions (`GATEWAY_URL`) and optional public prefix (`NEXT_PUBLIC_AUTH_PREFIX`)

**Restart Required:**  
Changing `.env` files requires service restart for changes to take effect.

**JWT_SECRET Synchronization:**  
JWT_SECRET must match between Kong Gateway and Auth Service. Mismatch causes token verification failures.

### Development Workflow

**.dockerignore Configuration:**  
Excludes `node_modules`, `.git`, `.env` to keep Docker build context lightweight.

**IP Whitelisting:**  
Neon allows connections from any IP by default. Docker containers require internet access to connect to Neon.

**Monorepo Benefits:**
- Shared packages prevent code duplication
- Turborepo parallelizes builds
- Single `pnpm install` for entire project
- Consistent TypeScript configuration

---

**Last Updated**: April 1, 2026  
**Project Status**: Auth/Course/Media services and web-client are active; Payment/Notification remain planned.  
**License**: MIT
