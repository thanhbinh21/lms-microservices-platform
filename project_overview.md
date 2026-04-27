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

Dự án được chia thành nhiều giai đoạn (Phases) theo chuẩn "Vertical Slice Architecture".

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

### Phase 9: Optimization & Technical Debt ✅ COMPLETED (core)
- [x] **Phase 9.1:** Backend Cleanup — Gỡ Node Gateway (chỉ dùng Kong), Prisma migrations (sourceType, category, lastLoginAt), fix N+1, graceful shutdown. ✅ Completed: Mar 31, 2026
- [x] **Phase 9.2:** Frontend Cleanup — SharedNavbar/Footer, `/courses/[slug]` route, Phase 7.5 (edit/delete chapter/lesson), ErrorBoundary, loading.tsx, mobile menu, active sidebar. ✅ Completed: Mar 31, 2026 (Updated hotfix: thumbnail upload + curriculum UX/status messaging + sample data seed; Apr 21, 2026: wizard Viet hoa co dau, chapter auto numbering, lesson edit + paid-price gate, media/content per lesson, publish redirect public view)
- [x] **Phase 9.3:** DX Improvements (partial) — Root scripts prisma:generate:all, prisma:migrate:deploy:all, prisma:push:all, setup:db, dev:web/dev:web:lite. ✅ Completed: Apr 18, 2026
  - Pending items chuyen sang Phase 9.13: `pnpm run setup`, `.nvmrc`, turbo pipeline cho Prisma, cleanup test files.
- [x] **Phase 9.4:** Auth Role Policy Refactor — Register luon tao role STUDENT (hardcode trong register.controller.ts), bo role input tu client, registerSchema chi nhan email/password/name. ✅ Completed: Apr 18, 2026
- [x] **Phase 9.5:** Become Educator Backend Flow — update-role.controller.ts voi Zod validation, Prisma update, audit logging. ✅ Completed: Apr 18, 2026
  - Ghi chu ky thuat: Endpoint hien tai la generic `PATCH /users/role` (nhan userId + role). Xem Phase 9.14 de refactor thanh `/become-educator` chuyen biet.
- [x] **Phase 9.6:** Become Educator Frontend UX — Trang `/become-instructor` voi BecomeInstructorForm, SharedNavbar/Footer, ScrollReveal. Register form khong con role selector. ✅ Completed: Apr 18, 2026
- [x] **Phase 9.7:** System Seed Content — Admin he thong tao/quan ly bo khoa hoc mau (co bai free) de hoc vien trai nghiem truoc khi giang vien upload khoa hoc that. ✅ Completed: Apr 04, 2026
- [x] **Phase 9.8:** Media Provider Unification — Chuyen media upload/delivery sang Cloudinary Free, giu local storage fallback cho dev/test, ngung dung S3/VideoCipher trong flow chinh. ✅ Completed: Apr 18, 2026
  - Hotfix (Apr 18, 2026): Route local upload/download duoc tach khoi provider dang active de tranh crash `storage.getAbsolutePath is not a function` khi service dang chay Cloudinary.
- [x] **Phase 9.9:** Authentication Standardization - Removed duplicated JWT decodings in `course-service` and `instructor-service`. Both now correctly rely on Kong API Gateway for `x-user-id` and `x-user-role`. ✅ Completed: Apr 04, 2026
- [x] **Phase 9.10:** Resolving Race Conditions - Fixed auth token `restoreSessionAction` race condition that was triggering endless refreshes when switching tabs. ✅ Completed: Apr 04, 2026
- [x] **Phase 9.11:** Sync Application Defaults - Resolved mismatch validations for user registrations and centralized password policies. Upsert logic for seed commands to safely mutate data without blowing up primary keys. ✅ Completed: Apr 04, 2026
- [x] **Phase 9.12:** Runtime Stability Optimization - Hardening local dev runtime cho luong upload va Server Actions (bo sung preflight clear ports/lock, tach profile `dev:web`/`dev:web:lite`, xu ly fallback 503 khi upstream tam thoi khong reachable, fix local media route khi provider cloudinary dang active). ✅ Completed: Apr 18, 2026
- [ ] **Phase 9.13:** DX Hardening — `pnpm run setup` bootstrap (install + docker:up + setup:db + seed), `.nvmrc` node version pin, Prisma orchestration vao turbo pipeline, cleanup test files.
- [x] **Phase 9.14:** Become Educator Security Refactor (Audit Phase 9.5). ✅ Completed: Apr 21, 2026
  - Van de: `PATCH /users/role` hien tai la generic endpoint, nhan `userId` + `role` tu request body — bat ky ai co access deu co the nang cap role bat ky user khac thanh ADMIN.
  - Endpoint khong kiem tra x-user-id tu Gateway, khong co auth middleware guard.
  - Khac phuc: Tao endpoint chuyen biet `POST /become-educator` chi cho phep user tu nang cap chinh minh len INSTRUCTOR (khong nhan userId tu body, lay tu x-user-id header). Giu `PATCH /users/role` cho admin-only (them requireAdmin middleware).
  - Them audit trail: luu thoi diem, actor id, trace_id, previous role.
  - Refresh token/session sau khi doi role de frontned nhan role moi.
- [x] **Phase 9.15:** Route & Middleware Consolidation (Audit Phase 5, 10) ✅ Completed: Apr 22, 2026
  - Van de 1: course-service co route trung lap — `/api/courses/:courseId/progress` duoc dang ky 2 lan (line 77 va line 117 trong index.ts). Express se match route dau tien, route thu 2 khong bao gio duoc goi.
  - Van de 2: Duplicate enrollment logic — `enrollCourse` (enrollment.controller.ts) va `enrollFree` (learning.controller.ts) lam cung viec voi logic gan nhu giong het. Can gop lai thanh 1 flow duy nhat.
  - Van de 3: requireAuth middleware bi duplicate giua services (course, payment, notification, instructor). Can tach thanh shared package `@lms/middleware` hoac gop vao `@lms/types`.
  - Update (Apr 21, 2026): Da tach middleware `requireAdmin` thanh shared factory `createRequireAdmin()` trong `@lms/types` va auth-service da import lai tu package chung.
  - Hotfix (Apr 21, 2026): Khoi phuc syntax hop le trong `course.controller.ts` sau merge do dang, sua them typing o `internal.controller.ts` de `@lms/course-service` build lai on dinh.
  - Hotfix (Apr 21, 2026): Web-client chu dong xoa auth cookies khi `/refresh` tra ve 401/403 de chan vong lap refresh token hong; course-service map loi Prisma init/connect thanh 503 de frontend phan biet ro DB tam thoi unavailable.
  - Hotfix (Apr 26, 2026): auth-service giam log nhieu khi refresh token cu/sai chu ky (`invalid signature`) va uu tien kiem tra token ton tai trong DB truoc khi verify chu ky de tranh spam log luc mo trang dang nhap.
  - Van de 4: instructor-service dung CORS `cors()` khong co origin restriction (app.ts line 10), khac voi cac service khac dung `CORS_ORIGIN`.
- [x] **Phase 9.16:** API Response & Error Handling Standardization (Audit tat ca services) ✅ Completed: Apr 22, 2026
  - Van de 1: Nhieu controller dung `ApiResponse<any>` thay vi typed response (login, register, admin). Can ep kieu cu the de tranh leak du lieu.
  - Van de 2: learning.controller va progress.controller tra ve `{ success, code, message }` khong co `trace_id` va `data` field trong mot so error path — vi pham ApiResponse<T> contract.
  - Van de 3: instructor-service dung rieng helper `errorResponse/successResponse` (utils/apiResponse.ts) khong dong nhat voi cac service khac dung truc tiep `ApiResponse<T>`.
  - Khac phuc: Khoi tao `createSuccessResponse` / `createErrorResponse` package chung trong `@lms/types` va ap dung khap noi nham loai bo `any`.
- [x] **Phase 9.17:** Expired Token & Stale Session Cleanup ✅ Completed: Apr 22, 2026
  - Van de: Refresh tokens het han chi bi xoa khi user refresh lai (passive cleanup). Khong co CRON/job xoa token cu — bang refreshToken se lon dan theo thoi gian.
  - Khac phuc: Them scheduled job (node-cron hoac Prisma script) de xoa refreshToken.expiresAt < now() dinh ky (moi ngay).
  - Bo sung: Xoa session Redis cua user khi bi ban/suspend boi admin (hien tai ban user khong revoke session, user van co token hop le cho den khi het han).

### Phase 10-12: Learning Experience ✅ COMPLETED (core)
- [x] **Phase 10:** Student Learning UI — `/learn/[courseId]` layout (8KB), lesson sub-route, LessonProgress model (upsert), video player, progress tracking (getCourseProgress, updateLessonProgress, completeLesson), free enrollment (enrollFree voi idempotency + price guard + transaction), getMyCourses. ✅ Completed: Apr 18, 2026
  - Review UI chuyen sang Phase 10.1.
  - Hotfix (Apr 26, 2026): Sua dong bo API update progress lesson (`PUT /api/student/lessons/:lessonId/progress`) va bo sung fallback payload de khong mat tien do khi FE gui du lieu cu; nang UX trang lesson (hien tien do xem, CTA hoan thanh ro hon, ho tro danh dau hoan thanh cho bai YouTube).
  - Hotfix (Apr 26, 2026): Learn layout lang nghe su kien cap nhat tien do de dong bo sidebar/progress ngay sau khi complete lesson; cai thien LessonNavigation de can bo cuc khi thieu prev/next va them action sau bai cuoi (hoan thanh khoa, xem chung chi, danh gia).
- [x] **Phase 11:** **Notification Service** (partial) — Kafka consumers (payment.order.completed + learning.enrollment.created), idempotent notification (upsert by eventId), CRUD API (listMyNotifications + markAsRead + markAllAsRead), cursor-based pagination, Kong Gateway route. ✅ Completed: Apr 18, 2026
  - Email transport (Nodemailer/Resend) va notification bell UI chuyen sang Phase 11.1. Status hien dang la MOCKED.
- [x] **Phase 12:** Student Dashboard — `/dashboard` (37KB) voi tabs overview/my-courses/certificates/community/orders, progress cards voi progressPercent + completedLessons, course filter (all/in-progress/completed), sort (recent/progress), getMyEnrollmentsAction, CTA Become Educator. ✅ Completed: Apr 18, 2026
  - Hotfix (Apr 26, 2026): Trien khai chung chi that trong course-service (model Certificate + auto issue khi hoc vien hoan thanh 100% + API `/api/student/certificates`), thay the luong dashboard certificates gia lap bang du lieu chung chi thuc te.

### Phase 10.1-11.1: Learning Experience — Remaining Items
- [x] **Phase 10.1:** Rating & Review System — Prisma model Review (courseId, userId, rating 1-5, comment), CRUD API (createReview/listReviews/getReviewStats + getMyReview), 1 user = 1 review/course (unique constraint), course aggregate (avgRating, reviewCount), frontend review form + review list tren `/courses/[slug]` va `/learn/[courseId]`. ✅ Completed: Apr 26, 2026
  - Hotfix (Apr 26, 2026): Chi cho phep tao review 1 lan sau khi hoc vien hoan thanh 100% khoa hoc; bo review panel khoi trang hoc video, giu review o trang chi tiet khoa hoc.
- [x] **Phase 11.1:** Direct SMTP Email Transport & Notification UI — Tích hợp hệ thống gửi email thực tế trực tiếp qua giao thức SMTP (sử dụng tài khoản thật như Gmail App Password), không phụ thuộc vào dịch vụ trung gian (như Resend/SendGrid). Xây dựng Email Templates bằng HTML (welcome, payment success, enrollment). Tích hợp Notification Bell UI trên SharedNavbar (huy hiệu số lượng chưa đọc, dropdown danh sách, tương tác đánh dấu đã đọc). [2026-04-22]

### Phase 13-16: Commerce & Payments (VNPay + Kafka) ✅ COMPLETED
- [x] **Phase 13:** Payment Service DB & Order CRUD — Order model, VNPayAudit model (JSONB audit), createOrder (price verify tu course-service via /internal/courses/:id), getOrder (owner check), getMyOrders, idempotency (existingPending order + alreadyPaid guard). ✅ Completed: Apr 18, 2026
- [x] **Phase 14:** Tich hop VNPay — buildPayUrl, handleVNPayReturn (checksum verify + dev fallback), handleVNPayIPN (idempotent: check COMPLETED, amount verify, 97/01/04/02 response codes), JSONB audit per callback. Frontend: /payment/vnpay-return voi PaymentPoller component. ✅ Completed: Apr 18, 2026
- [x] **Phase 15:** Kafka Producer — @lms/kafka-client upgraded: KafkaEventEnvelope<T> typed envelope, PaymentOrderCompletedEvent + EnrollmentCreatedEvent typed events, TopicEventMap type mapping, publishEvent<T> generic helper, RetryPolicy + consumeWithRetry retry wrapper, PAYMENT_ORDER_COMPLETED_RETRY default policy (5s → 1m → DLQ). ✅ Completed: Apr 18, 2026
- [x] **Phase 16:** Kafka Consumer & DLQ — course-service Kafka consumer (payment.order.completed → enrollment, idempotent by orderId, transaction create enrollment + increment enrollmentCount, publish enrollment.created downstream). DLQ admin API (listFailedEvents, getFailedEventStats, retryFailedEvent, resolveFailedEvent). ✅ Completed: Apr 18, 2026
  - Rating/Review model chuyen sang Phase 10.1.

### Phase 17: Search, Filter & Category System 🔧 IN PROGRESS
- [x] **Phase 17a:** Category System Backend — Category model (name, slug, order), listCategories (voi courseCount), createCategory (admin-only), seed:categories script. ✅ Completed: Apr 18, 2026
- [x] **Phase 17b:** Course Discovery API — listCourses endpoint voi search (title/description ILIKE), filter (category, level, minPrice/maxPrice, minRating), sort (newest/popular/rating/price_asc/price_desc), pagination, price aggregate, category sidebar data. ✅ Completed: Apr 18, 2026
- [ ] **Phase 17c:** Frontend Search & Filter UI — `/courses` page voi search bar, filter sidebar (category/level/price range/rating), sort dropdown, responsive grid layout, URL sync (query params).

### Phase 18-19: Analytics & Admin Dashboard ✅ COMPLETED
- [x] **Phase 18:** Instructor Analytics Dashboard — Revenue charts, KPI cards, top courses table, enrollment trends. Hien tai chi co placeholder page voi du lieu = 0. Can backend analytics API (revenue aggregate tu payment-service, enrollment trends tu course-service). ✅ Completed: Apr 27, 2026
- [x] **Phase 19:** Admin Dashboard (tích hợp trong web-client thay vì tách Vite app) — `(admin)/admin/` voi dashboard overview (user/course stats), users management, courses management, reviews management, system DLQ monitor (list/retry/resolve failed events). ✅ Completed: Apr 26, 2026

### Phase 20: Deployment & Production Hardening 🚀
- [ ] **Phase 20:** Dockerize all services, docker-compose.prod.yml, CI/CD (GitHub Actions), Nginx + SSL, monitoring, backup strategy.

### Phase 21-22: Performance & Security Hardening
- [x] **Phase 21:** Performance & Caching Optimization — Khắc phục Neon cold-start bằng `withRetry`, tích hợp Upstash Redis caching (cache-aside cho course/category), tối ưu Prisma query (composite indexes, selective fields), Next.js `unstable_cache` & `revalidateTag` cho Server Actions. ✅ Completed: Apr 22, 2026
- [ ] **Phase 22:** Security Hardening — API rate limiting chuẩn hóa, input sanitization chống XSS, audit log cho admin actions, health check dashboard tổng hợp.
- [ ] **Phase 23:** Testing & Quality Gate — Unit tests cho business logic core (enrollment, payment verify, Kafka handlers), integration tests cho payment flow E2E, API contract tests (Zod schema → validation), CI pipeline (lint + test truoc merge).

### Phase 9.13: DX Hardening ✅ COMPLETED
- [x] **Phase 9.13:** DX Hardening — `pnpm run setup` bootstrap (install + docker:up + setup:db + seed), `.nvmrc` node version pin, Prisma orchestration vao turbo pipeline. ✅ Completed: Apr 27, 2026

### Phase UI: UI/UX Refactor ⏳ PENDING
- [x] **Phase UI-1:** SharedNavbar & Header Refactor — Gom Profile/Dashboard/Studio/Logout vao User Dropdown Menu, bo greeting text khoi navbar, di chuyen CTA "Dang ky GV" vao dropdown hoac banner, them NotificationBell vao mobile menu, responsive breakpoints chuan. ✅ Completed: Apr 27, 2026
- [ ] **Phase UI-2:** Design System Consolidation — Tao them CSS utility classes cho cac pattern lap lai (`.glass-card`, `.gradient-hero`, semantic color vars). Chuan hoa border-radius (chi dung `rounded-lg/xl/2xl`), icon sizes (`size-4/5/6`). Di chuyen tat ca hardcoded stats (500+, 150k, 12.000) ra constants hoac fetch tu API.
- [ ] **Phase UI-3:** Component Decomposition — Tach `dashboard/page.tsx` (653 dong) thanh OverviewTab/MyCoursesTab/CertificatesTab/CommunityTab. Tao reusable `CourseCard`, `StatCard`, `EmptyState`. Tach components >300 dong.

### Phase C: Community Feature ⏳ PENDING
- [ ] **Phase C-1:** Community Backend — Model CommunityGroup/CommunityMember/CommunityPost trong course_db. Auto-join via Kafka event `learning.enrollment.created`. API CRUD: listGroups, listPosts (cursor pagination), createPost/reply, joinGroup. Kong route `/community/*`.
- [ ] **Phase C-2:** Community Frontend — `/dashboard/community` list nhom da tham gia, `/community/[groupId]` feed bai viet + form dang bai + reply, `/learn/[courseId]` sidebar tab "Thao luan" link toi community group. Thay the placeholder "Sap ra mat".

### Phase AI: AI Features ⏳ PENDING (Setup)
- [ ] **Phase AI-1:** AI Course Recommendation — Goi y khoa hoc dua tren learning history, enrollment patterns, rating. Dung Gemini API. Can: ai-service, Gemini API key, Kong route `/ai/*`.
- [ ] **Phase AI-2:** AI Learning Assistant / Chatbot — Tro ly hoc tap AI cho student, hoi dap noi dung bai hoc, tom tat, giai thich. Can: ChatSession model, Gemini API, WebSocket hoac SSE.
- [ ] **Phase AI-3:** AI Content Generation for Instructors — Ho tro instructor tao quiz, tom tat bai, outline khoa hoc. Can: Gemini API, instructor UI integration.
- [ ] **Phase AI-4:** AI-Powered Semantic Search — Nang cap search tu ILIKE thanh semantic search (vector embeddings). Can: pgvector extension tren Neon, Gemini embedding model.
- [ ] **Phase AI-5:** AI Auto-Grading & Feedback — Cham bai tu dong, feedback ca nhan hoa. Can: Quiz/Assignment model (chua co), Gemini API.

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


