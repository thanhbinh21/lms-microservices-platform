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

Dự án được chia thành 20 giai đoạn (Phases) theo chuẩn "Vertical Slice Architecture".

### Phase 1-4: Foundation (Nền tảng) ✅ COMPLETED
- [x] **Phase 1:** Setup Monorepo (Turborepo), Docker Compose (Kafka, Redis) + Neon Serverless PostgreSQL. ✅ Completed: Jan 21, 2026
- [x] **Phase 2:** Setup API Gateway (Kong DB-less) & Shared Packages (Logger, Types, Env Validator). ✅ Completed: Jan 21, 2026
- [x] **Phase 3:** Build **Auth Service** (Login, Register, JWT pair, Session Redis, Refresh Token rotation). ✅ Completed: Jan 25, 2026
- [x] **Phase 4:** Build Frontend Base (Next.js 15, Shadcn UI, Redux, Login/Register Forms, Be Vietnam Pro font). ✅ Completed: Jan 25, 2026 ✅ **VERIFIED: Production-Ready**

### Phase 5-8: Core LMS & Media ✅ COMPLETED 
- [x] **Phase 5:** Build **Course Service DB** & CRUD API (Course, Chapter, Lesson, Enrollment models). ✅ Completed: Feb 28, 2026
- [x] **Phase 6:** Build **Media Service** (Presigned URL upload, YouTube external, local storage provider). ✅ Completed: Feb 28, 2026
- [x] **Phase 6.1:** Code Audit & Production Hardening (Security fixes, Vietnamese comments, optimizations). ✅ Completed: Mar 01, 2026
- [x] **Phase 7:** Frontend Instructor UI (7.1-7.4, 7.6-7.7 completed). ✅ Completed: Mar 31, 2026
- [x] **Phase 8:** Frontend Public UI (8.1-8.4 completed). ✅ Completed: Mar 23, 2026

### Phase 9: Optimization & Technical Debt 🔧
- [ ] **Phase 9.1:** Backend Cleanup — Gỡ Node Gateway (chỉ dùng Kong), Prisma migrations (sourceType, category, lastLoginAt), fix N+1, graceful shutdown.
- [ ] **Phase 9.2:** Frontend Cleanup — SharedNavbar/Footer, `/courses/[slug]` route, Phase 7.5 (edit/delete chapter/lesson), ErrorBoundary, loading.tsx, mobile menu, active sidebar.
- [ ] **Phase 9.3:** DX Improvements — `pnpm run setup` bootstrap, turbo pipeline cho Prisma, `.nvmrc`, cleanup test files, nâng cấp 2 agent files.

### Phase 10-13: Commerce & Payments (VNPay + Kafka)
- [ ] **Phase 10:** Build **Payment Service DB** & Order CRUD (Order, Transaction, VNPayAudit models, price verification).
- [ ] **Phase 11:** Tích hợp **VNPay** (Create URL, IPN Webhook, Return URL, checksum, JSONB audit).
- [ ] **Phase 12:** Kafka Producer — Upgrade `@lms/kafka-client` (typed events, retry, DLQ), Payment publish `payment.order.completed`.
- [ ] **Phase 13:** Kafka Consumer — Enrollment idempotent + Retry mechanism + DLQ admin + **Rating/Review model & API**.

### Phase 14-16: Learning Experience
- [ ] **Phase 14:** Student Learning UI — `/learn/[courseId]` layout, LessonProgress model, video player, progress tracking, Review UI.
- [ ] **Phase 15:** **Notification Service** — Kafka consumer, Nodemailer (dev) + Resend (prod), email templates, notification bell UI.
- [ ] **Phase 16:** Student Dashboard — `/dashboard` real data, "Khoá học của tôi", progress cards, learning streak.

### Phase 17-19: Advanced Features
- [ ] **Phase 17:** Search, Filter & Category System — Full-text search, category model, filter sidebar, sort options.
- [ ] **Phase 18:** Instructor Analytics Dashboard — Revenue charts, KPI cards, top courses table, enrollment trends.
- [ ] **Phase 19:** **Admin Dashboard** — `apps/admin-dashboard` (Vite + React), user/course/order/review management, DLQ monitor.

### Phase 20: Deployment & Production Hardening 🚀
- [ ] **Phase 20:** Dockerize all services, docker-compose.prod.yml, CI/CD (GitHub Actions), Nginx + SSL, monitoring, backup strategy.

---

## 6. Ghi Chú Quan Trọng (Decisions & Assumptions)

### Architecture & Database
*   **Data Aggregation:** Không dùng JOIN giữa các DB. Frontend sẽ gọi song song các API (Auth, Course) và gộp dữ liệu tại Server Actions.
*   **Prisma Singleton:** Implemented Global Variable pattern trong `packages/db-prisma` để ngăn "too many connections" khi Next.js HMR reload code.
*   **Neon Cold Start:** Database sẽ auto-pause sau 5 phút idle. Request đầu tiên sau khi ngủ sẽ chậm hơn (~2-3s).

### Environment & Validation
*   **T3 Env Pattern:** Package `env-validator` sử dụng Zod để validate `.env` ngay lúc runtime. App sẽ crash với error message rõ ràng nếu thiếu biến.
*   **Gateway Unification:** Đã gỡ bỏ hoàn toàn `api-gateway` (Node), chỉ sử dụng Kong làm API Gateway trung tâm. 

### Frontend Conventions (Next.js App Router)
*   **Server Actions for API Calls:** All API calls from Next.js to Microservices are done via Server Actions (`actions/`) using the internal `GATEWAY_URL`.
*   **Client vs Server Components:** Limit `"use client"` as much as possible, mostly used for simple state hooks or highly interactive elements. Do not pass complex API functionality directly down tree.