# LMS Microservices Platform - INTERNAL DEVELOPMENT GUIDE


> **Git Status**: This file is gitignored (`.gitignore`)  
> **Public Documentation**: See [README.md](README.md) instead

---

## Overview
Event-Driven Learning Management System using Microservices Architecture.

Supports:
- Course Management
- Payment (VNPay)
- Kafka-based Enrollment
- Learning Progress
- Notification Service

## Tech Stack
Frontend: Next.js 15 (App Router, Server Actions, Shadcn UI)  
Backend: Node.js (Express/Fastify), TypeScript  
Database: PostgreSQL via Neon Serverless (Database-per-Service)  
Message Broker: Apache Kafka  
Payment: VNPay  
Infra: Docker (Kafka/Redis/Kong), Turborepo  
API Gateway: Kong Gateway (Declarative, DB-less mode)  

## Architecture Principles
- Microservices
- Database per Service
- Event-Driven (Kafka)
- BFF Pattern (Next.js Server Actions)
- API Gateway handles JWT
- Services trust Gateway headers

## Key Rules
- API Gateway verifies JWT, injects x-user-id, x-user-role
- Services do NOT re-verify token
- Payment price must be verified from Course Service
- VNPay response must be stored in JSONB for audit
- Kafka must use Retry + DLQ
- Enrollment must be idempotent

## API Standards
All APIs return:

```ts
interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  trace_id: string;
}
```

## 4. Database Setup (Neon Serverless)

### Why Neon Serverless?
- Auto-pause after 5min idle → 0 cost, 0 resource usage
- ~400MB RAM saved on local machine
- Free tier: 0.5GB per database
- No Docker overhead for local development

### Required Databases:
1. `auth_db` - Authentication & User Management
2. `course_db` - Course, Curriculum, Lessons
3. `payment_db` - Orders, Transactions, VNPay Audit
4. `media_db` - Media URLs, Presigned Links
5. `notification_db` - Email Queue, Notification Logs

### Setup Steps:
1. Create account at [Neon.tech](https://neon.tech)
2. Create 5 separate databases (projects)
3. Copy connection strings to `.env` files:

```env
# services/auth-service/.env
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/auth_db?sslmode=require"

# services/course-service/.env
DATABASE_URL="postgresql://user:pass@ep-yyy.neon.tech/course_db?sslmode=require"

# ... (same for payment, media, notification)
```

4. Run Prisma migrations:
```bash
cd services/auth-service
pnpm prisma migrate dev
```

## 5. Roadmap Dự Án (Tiến độ thực hiện)

Dự án được chia thành 15 giai đoạn (Phases) theo chuẩn "Vertical Slice Architecture".

### Phase 1-4: Foundation (Nền tảng) ✅ COMPLETED
- [x] **Phase 1:** Setup Monorepo (Turborepo), Docker Compose (Kafka, Redis) + Neon Serverless PostgreSQL [5]. ✅ Completed: Jan 21, 2026
- [x] **Phase 2:** Setup API Gateway (Kong) & Shared Packages (Logger, Types) [5]. ✅ Completed: Jan 21, 2026
- [x] **Phase 3:** Build **Auth Service** (Login, Register, JWT, Session Redis) [5]. ✅ Completed: Jan 25, 2026
- [x] **Phase 4:** Build Frontend Base (Next.js 16, Shadcn UI, Redux, Login/Register Forms) [6]. ✅ Completed: Jan 25, 2026 ✅ **VERIFIED: Production-Ready**

### Phase 5-9: Core LMS & Media
- [x] **Phase 5:** Build **Course Service DB** & CRUD API [6]. ✅ Completed: Feb 28, 2026
- [x] **Phase 6:** Build **Media Service** (API Presigned URL S3/VideoCipher) [6]. ✅ Completed: Feb 28, 2026
- [x] **Phase 6.1:** Code Audit & Production Hardening (Security fixes, Vietnamese comments, optimizations) ✅ Completed: Mar 01, 2026
- [ ] **Phase 7:** Frontend Instructor UI (Drag & Drop Curriculum) [7].
  - QA update: Smoke test build on Mar 19, 2026 found role enum mismatch in instructor layout and multiple instructor/dashboard screens still using mock data.
  - QC fix update: Aligned integration smoke test auth health target from port 3001 to 3101; `pnpm test:integration` now passes 5/5 on Mar 19, 2026.
- [ ] **Phase 8:** Frontend Public UI (Course Listing, Detail with BFF Aggregation) [7].
  - Progress update: Completed public landing page NexEdu UI (intro page) on Mar 19, 2026.
  - Progress update: Applied white-theme glassmorphism + Be Vietnam Pro typography for landing page on Mar 19, 2026.
  - QC update: Flow test on Mar 19, 2026 shows Landing/Register/Login/Dashboard pages return 200, but register via Gateway timeout on /auth/register and login API fails with Prisma P2002 (duplicate refresh token) in auth-service.
  - QC fix update: Resolved /auth/register timeout via Gateway by rehydrating proxy request body and fixed refresh token duplication by adding unique jwtid for refresh tokens; retest via Gateway register/login successful on Mar 19, 2026.
- [ ] **Phase 9:** Build **Payment Service DB** (Orders & Audit Transactions Table) [8].

### Phase 10-12: Commerce & Payments (VNPay)
- [ ] **Phase 10:** Tích hợp **VNPay** (API Create URL & IPN Webhook) [8].
- [ ] **Phase 11:** Kafka Setup (Producer: `payment.order.completed`) [8].
- [ ] **Phase 12:** Kafka Consumer (Enrollment Logic in Course Service + Retry Mechanism) [8].

### Phase 13-15: Learning & Polish
- [ ] **Phase 13:** Learning UI (Video Player, Progress Tracking API) [9].
- [ ] **Phase 14:** **Notification Service** (Email Worker consuming Kafka events) [9].
- [ ] **Phase 15:** Deployment & Audit (Dockerize, Audit Logs Check) [9].

---

## 6. Ghi Chú Quan Trọng (Decisions & Assumptions)

### Architecture & Database
*   **Data Aggregation:** Không dùng JOIN giữa các DB. Frontend sẽ gọi song song các API (Auth, Course) và gộp dữ liệu tại Server Actions [10].
*   **Prisma Singleton:** Implemented Global Variable pattern trong `packages/db-prisma` để ngăn "too many connections" khi Next.js HMR reload code [Phase 3]. ✅
*   **Neon Cold Start:** Database sẽ auto-pause sau 5 phút idle. Request đầu tiên sau khi ngủ sẽ chậm hơn (~2-3s).

### Environment & Validation
*   **T3 Env Pattern:** Package `env-validator` sử dụng Zod để validate `.env` ngay lúc runtime. App sẽ crash với error message rõ ràng nếu thiếu biến [Phase 3]. ✅
*   **Restart Required:** Khi thay đổi `.env` (JWT_SECRET, DATABASE_URL), phải restart server để thay đổi có hiệu lực.
*   **Environment File Locations:** 
    - Root `.env`: Shared infrastructure config (Kafka, Redis, all DB URLs)
    - `services/auth-service/.env`: Auth-specific config (DATABASE_URL, JWT_SECRET, PORT)
    - `apps/web-client/.env.local`: Frontend config (NEXT_PUBLIC_GATEWAY_URL)
    - ⚠️ **Critical:** JWT_SECRET must match between Gateway and Auth Service
*   **Env Sync Update (Mar 19, 2026):** Da dong bo file `.env` cho Gateway/Auth/Course/Media/Web client, sua typo bien root env va dong nhat JWT cho Gateway + Auth de chay local.
*   **Port Override (Mar 19, 2026):** Auth Service doi PORT tu 3001 sang 3101 de tranh xung dot cong; Gateway da cap nhat AUTH_SERVICE_URL tuong ung.
*   **Runtime Verification (Mar 19, 2026):** Da run full stack voi Docker infra + service/web local, health check Gateway/Auth/Course/Media va web page deu tra 200.

### Docker & Deployment
*   **.dockerignore:** Đã exclude `node_modules`, `.git`, `.env` để tránh build context quá nặng [Phase 3]. ✅
*   **IP Whitelisting:** Neon cho phép truy cập từ mọi IP. Docker container cần internet để connect tới Neon.

### Security & Tokens
*   **JWT Architecture:** Access Token (15min) + Refresh Token (7 days). Refresh token stored in PostgreSQL + Session cached in Redis.
*   **Session Redis:** TTL 7 days, automatically cleanup on logout hoặc token expiry.
*   **Password Hashing:** Bcrypt với salt rounds = 10.

### Payments & Events
*   **VNPay Checksum:** Phải sắp xếp tham số theo bảng chữ cái trước khi hash để tránh lỗi `Invalid Checksum` [11].
*   **Kafka DLQ:** Nếu xử lý đơn hàng thất bại 3 lần, message sẽ chuyển vào Dead Letter Queue để admin xử lý.