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
Media Storage: Cloudinary (Free tier) + local fallback  
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
- [x] **Phase 6:** Build **Media Service** (Presigned URL upload, YouTube external, local storage provider). ✅ Completed: Feb 28, 2026 (Legacy media provider setup; se chuan hoa Cloudinary o Phase 9.8)
- [x] **Phase 6.1:** Code Audit & Production Hardening (Security fixes, Vietnamese comments, optimizations). ✅ Completed: Mar 01, 2026
- [x] **Phase 7:** Frontend Instructor UI (7.1-7.4, 7.6-7.7 completed). ✅ Completed: Mar 31, 2026 (Legacy register role selector se duoc thay the boi luong Become Educator o Phase 9.4-9.6)
- [x] **Phase 8:** Frontend Public UI (8.1-8.4 completed). ✅ Completed: Mar 23, 2026

### Phase 9: Optimization & Technical Debt 🔧
- [x] **Phase 9.1:** Backend Cleanup — Gỡ Node Gateway (chỉ dùng Kong), Prisma migrations (sourceType, category, lastLoginAt), fix N+1, graceful shutdown. ✅ Completed: Mar 31, 2026
- [x] **Phase 9.2:** Frontend Cleanup — SharedNavbar/Footer, `/courses/[slug]` route, Phase 7.5 (edit/delete chapter/lesson), ErrorBoundary, loading.tsx, mobile menu, active sidebar. ✅ Completed: Mar 31, 2026 (Updated hotfix: thumbnail upload + curriculum UX/status messaging + sample data seed)
- [ ] **Phase 9.3:** DX Improvements — `pnpm run setup` bootstrap, turbo pipeline cho Prisma, `.nvmrc`, cleanup test files.
  - Progress (Apr 18, 2026): Da bo sung root scripts `prisma:generate:all`, `prisma:migrate:deploy:all`, `prisma:migrate:status:all`, `prisma:push:all`, `setup:db`; cap nhat `dev:web` chay du stack can cho upload (web-client + auth/course/instructor/media + shared packages) va them `dev:web:lite` cho nhu cau chi web auth/course.
- [ ] **Phase 9.4:** Auth Role Policy Refactor — Register luon tao role STUDENT, bo role input tu client, cap nhat validation + response contract.
- [ ] **Phase 9.5:** Become Educator Backend Flow — Them endpoint `/auth/become-educator`, audit nang cap role, xu ly refresh/session de dong bo role moi.
- [ ] **Phase 9.6:** Become Educator Frontend UX — Bo role selector o Register, them CTA Become Educator (Profile/Dashboard), cap nhat role state va instructor redirect.
- [x] **Phase 9.7:** System Seed Content — Admin he thong tao/quan ly bo khoa hoc mau (co bai free) de hoc vien trai nghiem truoc khi giang vien upload khoa hoc that. ✅ Completed: Apr 04, 2026
- [x] **Phase 9.8:** Media Provider Unification — Chuyen media upload/delivery sang Cloudinary Free, giu local storage fallback cho dev/test, ngung dung S3/VideoCipher trong flow chinh. ✅ Completed: Apr 18, 2026
  - Hotfix (Apr 18, 2026): Route local upload/download duoc tach khoi provider dang active de tranh crash `storage.getAbsolutePath is not a function` khi service dang chay Cloudinary.
- [x] **Phase 9.9:** Authentication Standardization - Removed duplicated JWT decodings in `course-service` and `instructor-service`. Both now correctly rely on Kong API Gateway for `x-user-id` and `x-user-role`. ✅ Completed: Apr 04, 2026
- [x] **Phase 9.10:** Resolving Race Conditions - Fixed auth token `restoreSessionAction` race condition that was triggering endless refreshes when switching tabs. ✅ Completed: Apr 04, 2026
- [x] **Phase 9.11:** Sync Application Defaults - Resolved mismatch validations for user registrations and centralized password policies. Upsert logic for seed commands to safely mutate data without blowing up primary keys. ✅ Completed: Apr 04, 2026

### Phase 10-12: Learning Experience
- [ ] **Phase 10:** Student Learning UI — `/learn/[courseId]` layout, LessonProgress model, video player, progress tracking, Review UI. (Uu tien trien khai truoc block Commerce & Payments de hoc vien xem video free som)
- [ ] **Phase 11:** **Notification Service** — Kafka consumer, Nodemailer (dev) + Resend (prod), email templates, notification bell UI.
- [ ] **Phase 12:** Student Dashboard — `/dashboard` real data, "Khoá học của tôi", progress cards, learning streak, va trang thai Become Educator.

### Phase 13-16: Commerce & Payments (VNPay + Kafka)
- [ ] **Phase 13:** Build **Payment Service DB** & Order CRUD (Order, Transaction, VNPayAudit models, price verification). (Sau khi hoc vien da co free-learning flow o Phase 10-12)
- [ ] **Phase 14:** Tích hợp **VNPay** (Create URL, IPN Webhook, Return URL, checksum, JSONB audit).
- [ ] **Phase 15:** Kafka Producer — Upgrade `@lms/kafka-client` (typed events, retry, DLQ), Payment publish `payment.order.completed`.
- [ ] **Phase 16:** Kafka Consumer — Enrollment idempotent + Retry mechanism + DLQ admin + **Rating/Review model & API**.

### Phase 17-19: Advanced Features
- [ ] **Phase 17:** Search, Filter & Category System — Full-text search, category model, filter sidebar, sort options.
- [ ] **Phase 18:** Instructor Analytics Dashboard — Revenue charts, KPI cards, top courses table, enrollment trends (phu thuoc role upgrade flow Phase 9.4-9.6 va sau khi block Commerce & Payments on dinh).
- [ ] **Phase 19:** **Admin Dashboard** — `apps/admin-dashboard` (Vite + React), user/course/order/review management, DLQ monitor, role governance view.

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
*   **Media Provider Strategy:** Cloudinary Free la provider mac dinh cho image/video URL, local storage la fallback cho local development; S3/VideoCipher khong con la huong uu tien.

### Frontend Conventions (Next.js App Router)
*   **Server Actions for API Calls:** All API calls from Next.js to Microservices are done via Server Actions (`actions/`) using the internal `GATEWAY_URL`.
*   **Client vs Server Components:** Limit `"use client"` as much as possible, mostly used for simple state hooks or highly interactive elements. Do not pass complex API functionality directly down tree.

## 7. Ke hoach chinh sua role dang ky va Become Educator

Trang thai roadmap lien quan:
- Phase 9.4: Auth Role Policy Refactor
- Phase 9.5: Become Educator Backend Flow
- Phase 9.6: Become Educator Frontend UX
- Phase 9.7: System Seed Content (Admin-managed sample courses)
- Phase 9.8: Media Provider Unification (Cloudinary Free)

### 7.1 Muc tieu nghiep vu
- Tat ca tai khoan moi dang ky se mac dinh role la STUDENT.
- Bo chon role tai man hinh dang ky de tranh nham luong va gian lan role.
- User can action "Become Educator" de nang cap role sau khi dap ung dieu kien.
- Chi user da duoc nang cap INSTRUCTOR moi co quyen tao va upload khoa hoc.

### 7.2 Acceptance Criteria
- Dang ky moi khong truyen role tu client; auth-service luon tao user role STUDENT.
- UI Register khong con field chon role.
- Dashboard/Profile co CTA "Become Educator" cho user role STUDENT.
- API Become Educator cap nhat role INSTRUCTOR va ghi nhan audit thong tin nang cap.
- Truoc khi co giang vien upload khoa hoc that, he thong phai co bo khoa hoc mau do admin them, trong do co lesson free de hoc vien xem.
- Sau khi nang cap thanh cong, user co the truy cap khu vuc giang vien va tao khoa hoc.
- Neu role chua du, route/endpoint instructor tra ve 403 nhu hien tai.

### 7.3 Pham vi code du kien
- services/auth-service
  - register controller: bo nhan role tu request, role mac dinh STUDENT.
  - them endpoint become-educator (controller + validate + service).
  - bo sung co che audit nang cap role (truong note hoac bang audit rieng neu can).
- apps/web-client
  - register form: bo UI role selector, chi con thong tin co ban.
  - profile/dashboard: them action/button Become Educator.
  - instructor gating: giu nguyen guard role INSTRUCTOR/ADMIN.
  - server actions auth/instructor: bo sung goi API nang cap role va dong bo auth state.

### 7.4 De xuat API
- POST /auth/become-educator
  - Header: Authorization bearer token (qua Gateway)
  - Input: co the de rong hoac them motivation/profile fields o phase sau
  - Output: ApiResponse<User> voi role da cap nhat INSTRUCTOR

### 7.5 Rui ro va giam thieu
- Rui ro stale token sau khi doi role:
  - Giam thieu: refresh token ngay sau khi upgrade role hoac bat buoc login lai.
- Rui ro user da co session tab cu:
  - Giam thieu: middleware/guard kiem tra role moi o moi request nhay cam.
- Rui ro nang cap role khong co audit:
  - Giam thieu: luu thoi diem, actor id, trace_id cho action Become Educator.

### 7.6 Ke hoach trien khai theo pipeline
1. BA
   - Chot rule role mac dinh STUDENT va policy nang cap INSTRUCTOR.
   - Chot UX vi tri CTA Become Educator (Profile va Dashboard).
2. DEV
   - Cap nhat auth-service register + them endpoint become-educator.
   - Cap nhat web-client register/profile/dashboard + server actions.
   - Dam bao instructor route va API van dung role guard hien tai.
  - Them seed/admin flow cho sample courses va danh dau lesson free de phuc vu Learning Experience som.
  - Chuan hoa media upload flow sang Cloudinary Free va cap nhat env/config tuong ung.
3. QC
   - Test happy path: register STUDENT -> become educator -> tao khoa hoc thanh cong.
   - Test negative: STUDENT chua upgrade truy cap instructor bi 403.
   - Test regression: login/register cu, refresh token, redirect guard.
