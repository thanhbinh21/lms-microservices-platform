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
Infra: Docker (Kafka/Zookeeper/Kong), Upstash Redis, Turborepo  
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
1. `auth_db` - Authentication, User Management, Instructor Requests
2. `course_db` - Course, Chapter, Lesson, Category, Review, Instructor Profile, Certificate Templates
3. `learning_db` - Enrollment, Lesson Progress, Certificate, Failed Events
4. `community_db` - Global Community Feed Posts, Course Q&A (Questions/Answers, Upvotes)
5. `payment_db` - Orders, Transactions, VNPay Audit
6. `media_db` - Media URLs, Presigned Links
7. `notification_db` - Email Queue, Notification Logs

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
- [x] **Phase 1:** Setup Monorepo (Turborepo), Docker Compose (Kafka/Zookeeper) + Neon Serverless PostgreSQL. ✅ Completed: Jan 21, 2026
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
- [x] **Phase 9.2:** Frontend Cleanup — SharedNavbar/Footer, `/courses/[slug]` route, Phase 7.5 (edit/delete chapter/lesson), ErrorBoundary, loading.tsx, mobile menu, active sidebar. ✅ Completed: Mar 31, 2026 (Updated hotfix: thumbnail upload + curriculum UX/status messaging + sample data seed; Apr 21, 2026: wizard Viet hoa co dau, chapter auto numbering, lesson edit + paid-price gate, media/content per lesson, publish redirect public view; Apr 28, 2026: Cloudinary image upload cho community/profile, thumbnail course auto-save ngay sau upload, instructor studio tab navigation ro rang hon)
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
- [x] **Hotfix:** Kong auth public route allowlist + strip-path fix cho `/auth/login`. done - 2026-05-14
- [x] **Hotfix:** Refresh token rotation race fix (P2025) trong auth-service. done - 2026-05-14
- [x] **Hotfix:** Seed script Prisma import path sync (prisma-v2 -> prisma). done - 2026-05-14
- [x] **Hotfix:** Restore protected API auth after audit (JWT nbf claim + middleware fallback decode payload khi x-user-id chua duoc inject). done - 2026-05-14
- [x] **Hotfix:** Community page khong con treo loading khi user chua co group kha dung. done - 2026-05-14
- [x] **Hotfix:** Admin dashboard stat card empty href guard. done - 2026-05-15 - by BINH
- [x] **Hotfix:** Next.js image allowlist for picsum host (seed thumbnails). done - 2026-05-18 - by BINH
- [x] **Hotfix:** AI Gemini quota rate-limit handling (quiz/chat). done - 2026-05-19 - by BINH
- [x] **Hotfix:** AI provider failover (DeepSeek -> Groq -> OpenRouter). done - 2026-05-19 - by BINH
- [x] **Hotfix:** AI service dev build fix (generateText no-provider guard). done - 2026-05-19 - by BINH
- [x] **Hotfix:** Transcript worker ESM import fix (course-service). done - 2026-05-19 - by BINH
- [x] **Hotfix:** Course-service Prisma ESM import fix (load-env). done - 2026-05-19 - by BINH
- [x] **Hotfix:** Course-service Prisma ESM import fix (generated client). done - 2026-05-19 - by BINH
- [x] **Hotfix:** Course-service Prisma import aligns with generated client (dev worker). done - 2026-05-19 - by BINH
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

### Phase 20: Deployment & Production Hardening
- [ ] **Phase 20:** Dockerize all services, docker-compose.prod.yml, CI/CD (GitHub Actions), Nginx + SSL, monitoring, backup strategy.

### Phase 21-22: Performance & Security Hardening
- [x] **Phase 21:** Performance & Caching Optimization — Khắc phục Neon cold-start bằng `withRetry`, tích hợp Upstash Redis caching (cache-aside cho course/category), tối ưu Prisma query (composite indexes, selective fields), Next.js `unstable_cache` & `revalidateTag` cho Server Actions. ✅ Completed: Apr 22, 2026
- [ ] **Phase 22:** Security Hardening — API rate limiting chuẩn hóa, input sanitization chống XSS, audit log cho admin actions, health check dashboard tổng hợp.
- [ ] **Phase 23:** Testing & Quality Gate — Unit tests cho business logic core (enrollment, payment verify, Kafka handlers), integration tests cho payment flow E2E, API contract tests (Zod schema → validation), CI pipeline (lint + test truoc merge).

### Phase 24-29: Growth & Polish (New — 2026-04-29)

Chi tiết: Xem `plan/roadmap_phase_24_29.md`

- [x] **Phase 24:** Instructor Channel System — Model `InstructorProfile` (displayName, headline, bio, avatar, slug, socialLinks), API CRUD profile, public instructor listing (`/instructors`) + public profile page (`/instructors/[slug]`), `/instructor/profile` page thay the placeholder settings. ~3-4 ngày. done - 2026-05-10 
- [x] **Phase 25:** Global Q&A System — Thay the course community groups bang global Q&A. Model Question/Answer (title, content, courseId, lessonId, isResolved, upvotes), API CRUD + upvote + accept-answer, frontend `/dashboard/qa` + `/qa/[id]`, migrate/archive existing community data. ~3-4 ngày. done - 2026-05-10 
- [x] **Phase 26:** Community Verify Badge — Cap nhat UI community/Q&A: them icon verify xanh (CheckCircle2) cho author co role INSTRUCTOR, link to instructor profile. Co the merge voi Phase 25. ~0.5 ngày. done - 2026-05-10 
- [x] **Phase 27:** Instructor Revenue Display — Model `InstructorEarning` (instructorId, courseId, amount, revenueShare, status), payment consumer tao earning khi order completed, API earnings breakdown, update instructor analytics + settings payment page hien thi doanh thu. Payout withdrawal sang phase sau. ~2-3 ngày. done - 2026-05-10 
- [x] **Phase 28:** Instructor UX Audit — Phan tich chuyen sac UX trang `/learn/[courseId]`, instructor dashboard, course management wizard. Output: bao cao chi tiet voi cac de xuat cai tien uu tien theo impact/effort. ~1-2 ngày. done - 2026-05-10 
- [x] **Phase 29:** Full Admin Dashboard — Bo sung: `/admin/payouts` (approve/reject payout), `/admin/revenue` (platform revenue analytics + chart), `/admin/audit-log` (audit trail cho admin actions), `/admin/notifications` (notification history), `/admin/categories` (CRUD danh muc), `/admin/settings` (system config). ~4-5 ngày. done - 2026-05-10 

### Phase 30-34: UX Foundation & Polish (Audit 2026-04-29)

Chi tiet: Xem `plan/roadmap_phase_30_34.md`

- [x] **Phase 30:** Accessibility & Core UX Foundation — Fix P0 accessibility (modals: `role="dialog"` + `aria-modal` + focus trap; sidebar: `aria-current` + `:focus-visible` ring + Escape key; learn sidebar: mobile close flow; lesson TEXT content renderer; certificate PDF preview thay .txt; analytics: fix revenue label + date range selector; settings: implement real data hoac remove placeholder). Fix P0 crash: `Date.parse` null safety khi `updatedAt`/`createdAt` undefined. Fix P0 admin: them "Don Giang Vien" vao sidebar, fix `isFlagged` filter (boolean thay vi string), fix FLAGGED badge (amber thay vi red BANNED). ✅ Completed: Apr 29, 2026
- [x] **Phase 31:** Settings + Revenue Foundation — Payment Service API (`GET /api/instructor/earnings` + `GET /api/instructor/earnings/summary`), instructor earning creation on payment completion, settings page "Kenh cua toi" functional with earnings display + bank account form + transaction history + withdrawal placeholder. ✅ Completed: Apr 29, 2026
- [x] **Phase 32:** Student Learn Page Polish — Collapsible chapters + active lesson highlight + progress per lesson (already done), sticky lesson navigation on scroll, keyboard shortcuts (ArrowLeft/Right/?), video playback speed selector (0.5x-2x), confetti on first certificate completion. ✅ Completed: Apr 29, 2026
- [x] **Phase 33:** Course Detail + Public Pages Polish — Course API tra ve `instructor` object day du (name, bio, avatar, slug); hien thi instructor real name thay vi `Giang vien #abc123`; instructor avatar + bio + profile link; related courses section; reviews: fix typo heading + add pagination + add text search; login: them forgot password + remember me (done); landing page: dynamic featured course thay vi hardcoded. Footer pages: `/about`, `/help`, `/terms`, `/privacy`, `/careers` placeholders created. ~1-2 ngay. done - 2026-05-10 - by BINH
- [x] **Phase 34:** Admin Completeness + Security Hardening
  - Backend: Audit log model + API endpoint, payout management API, category management API, server-side admin auth verification.
  - Frontend: `/admin/instructor-requests` standalone page (done), `/admin/categories` CRUD, `/admin/audit-log`, reviews search + isFlagged fix (done), courses bulk actions, footer links cleanup (done).
  - Security: JWT verification in auth middleware (done — verifyToken already full), IDOR fix enrollment (done — uses x-user-id header), VNPay transaction ID verify tu DB (done), enrollment unique constraint (done — schema), Kafka event payload validation with Zod schemas (done), Redis keys TTL, request timeouts, graceful shutdown all services, CORS origin restriction (done — env-based).
  ~4-5 ngay. done - 2026-05-10 - by BINH

- [x] **Phase 35:** Option A Microservices Refactor — Loai bo "God Service" pattern tu course-service. Tach learning-service (Enrollment/Progress/Certificate/DLQ) va community-service (Community/Q&A) thanh service rieng biet. Merge instructor-service vao auth-service. Cap nhat Kong routes, course-service internal API, Kafka consumers, frontend Server Actions. Chi tiet: `service_architecture_analysis.md` + `plan/refactor_option_a_plan.md`. done - 2026-05-12 - by AI AGENT
- [x] **Phase 35.1:** Internal service auth hardening - chuan hoa guard createRequireInternal, bat buoc x-internal-secret cho toan bo /internal/*, cap nhat internal HTTP clients va env validation lien quan. done - 2026-05-13 - by AI AGENT
- [x] **Phase 35.2 (Audit Phase 1):** Kong JWT boundary hardening - tach luong public/protected bang route policy, bat JWT verify tren protected routes, remove header spoofing tu client (x-user-*), va inject lai user context sau xac thuc tai Gateway. done - 2026-05-13 - by AI AGENT
- [x] **Phase 35.3 (Audit Phase 2):** Kafka reliability hardening - transactional outbox cho payment/enrollment, manual commit sau success/retry/DLQ handoff, enrollment retry topics, DLQ processor persist failed events, remove unconsumed catalog status producer. done - 2026-05-13 - by AI AGENT (DB migration deploy/recover done 2026-05-14; live Kafka smoke test pending runtime)
- [x] **Phase 35.4 (Audit Phase 3):** Service boundary cleanup - community-service them local enrollment permission read model (`learning.enrollment.created` consumer), uu tien read model local cho enrollment gate va giu fallback internal check sang learning-service de tranh hard dependency runtime. done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.5 (Audit Phase 4):** Cache consistency hardening - bo sung cache invalidation matrix cho course/category/review mutations trong course-service va dong bo Next.js `revalidateTag('courses'/'categories')` o admin + instructor Server Actions. done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.6 (Audit Phase 5 - Batch A):** Shared middleware + dead code cleanup - xoa helper khong con su dung (`publishEnrollmentCreatedEvent`, `createInstructorEarningFromCompletedOrder`), thay community route-local auth guard bang `createRequireAuth`, va chuan hoa auth-service source middleware folder ve `src/middleware`. done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.7 (Audit Phase 5 - Batch B):** Prisma generated-client convention sync - chuan hoa output path `src/generated/prisma` cho `auth/course/payment`, cap nhat import lien quan, xoa stale `prisma-v2` folders va xac nhan build pass cac service anh huong. done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.8 (Audit Ops DX):** Refresh runbook sau audit + cleanup root scripts - viet lai `RUNCODE_AFTER_PULL_CODE.md` theo workflow hien tai, va toi gian `package.json` scripts (giu nhom run/build/test/migrate/docker/seed can thiet cho dev pull code). done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.9:** P0 role UX & business logic - them support ticket auth-service, hoan thien instructor payout request/payment admin flow, chuyen admin DLQ sang learning-service, va polish UI admin/instructor support lien quan. done - 2026-05-14 - by AI AGENT

- [x] **Phase P2:** Instructor Studio & Revenue Experience — Fix mojibake instructor layout + course wizard, add loading.tsx for 6 instructor routes, implement pure-SVG earnings bar chart (6-month history from real InstructorEarning data). done - 2026-05-15 - by AI AGENT
- [x] **Phase P3:** Admin Operations, Governance & Observability — Fix mojibake/ASCII text in system-config + audit-log pages, add loading.tsx for all 6 admin routes, enhance admin overview with real-time stats from DLQ (pending count), support tickets (open/in-progress), and payouts (pending). All sensitive actions fully audited via auth-service. done - 2026-05-15 - by AI AGENT
- [x] **Phase DX:** Prisma Neon setup hardening - root Prisma CLI, per-service migrate retry, Neon warmup, and pooled/direct env examples. done - 2026-05-15 - by AI AGENT
- [x] **Phase DX:** Remove local Redis runtime - Docker stack chi con Kafka/Zookeeper/Kong, Redis dung Upstash/cloud qua env. done - 2026-05-15 - by AI AGENT
- [x] **Hotfix Demo P0:** Chuan hoa support route (`/support` + `/help` redirect), fallback notification role-aware, bo sung admin reject ly do bat buoc, va them `/admin/community` read-only dependency route. done - 2026-05-15 - by AI AGENT
- [x] **Hotfix Demo P1:** Sua 404 cho `/become-instructor` va `/admin/instructor-requests` (route qua Kong `/auth/*`), nang cap `/admin/community` thanh dashboard co thong ke + filter/read-only feed, va dong bo UI admin pages (`instructor-requests`, `revenue`, `notifications`, sidebar labels). done - 2026-05-15 - by AI AGENT
- [x] **Hotfix Demo P2:** Dong bo frame layout Admin/Instructor va chuan hoa thong bao UI (Toast + Notification Bell) voi fallback role-aware, loading/empty/error state nhat quan. done - 2026-05-15 - by AI AGENT

### Phase 9.13: DX Hardening ✅ COMPLETED
- [x] **Phase 9.13:** DX Hardening — `pnpm run setup` bootstrap (install + docker:up + setup:db + seed), `.nvmrc` node version pin, Prisma orchestration vao turbo pipeline. ✅ Completed: Apr 27, 2026

### Phase UI: UI/UX Refactor ✅ COMPLETED
- [x] **Phase UI-1:** SharedNavbar & Header Refactor — Gom Profile/Dashboard/Studio/Logout vao User Dropdown Menu, bo greeting text khoi navbar, di chuyen CTA "Dang ky GV" vao dropdown hoac banner, them NotificationBell vao mobile menu, responsive breakpoints chuan. ✅ Completed: Apr 27, 2026
- [x] **Phase UI-2:** Design System Consolidation — Tao them CSS utility classes cho cac pattern lap lai (`.glass-card`, `.gradient-hero`, semantic color vars). Chuan hoa border-radius (chi dung `rounded-lg/xl/2xl`), icon sizes (`size-4/5/6`). Di chuyen tat ca hardcoded stats (500+, 150k, 12.000) ra constants hoac fetch tu API. ✅ Completed: Apr 27, 2026
- [x] **Phase UI-3:** Component Decomposition — Tach `dashboard/page.tsx` (653 dong) thanh OverviewTab/MyCoursesTab/CertificatesTab/CommunityTab. Tao reusable `CourseCard`, `StatCard`, `EmptyState`. Tach components >300 dong. ✅ Completed: Apr 27, 2026

### Phase C: Community Feature ✅ COMPLETED
- [x] **Phase C-1:** Community Backend — Model CommunityGroup/CommunityMember/CommunityPost trong course_db. Auto-join via Kafka event `learning.enrollment.created`. API CRUD: listGroups, listPosts (cursor pagination), createPost/reply, joinGroup. Kong route `/community/*`. ✅ Completed: Apr 27, 2026 (done - 2026-04-27 - by BINH)
- [x] **Phase C-2:** Community Frontend — `/dashboard/community` list nhom da tham gia, `/community/[groupId]` feed bai viet + form dang bai + reply, `/learn/[courseId]` sidebar tab "Thao luan" link toi community group. Thay the placeholder "Sap ra mat". ✅ Completed: Apr 27, 2026 (done - 2026-04-27 - by BINH)
- [x] **Phase C-3:** Community Refactor — Phân tách nhóm Public (Admin quản lý) và Private (Instructor). Bổ sung trường `username` auto-gen từ email để làm định danh duy nhất. Cập nhật display name bằng real data qua Internal API `/internal/users/batch`. Cập nhật giao diện tiếng Việt có dấu. ✅ Completed: 2026-04-28 (done - 2026-04-28 - by BINH) (Apr 28, 2026: community post/reply upload image truc tiep qua Cloudinary thay cho URL prompt)

### Phase AI: AI Features â³ PENDING
- [x] **AI Feature 1/2 integration hardening:** chuan hoa `ai-service` workspace/build, Kong route `/ai`, course transcript schema + migration deploy, AI chat/quiz Server Actions dung auth helper, lesson quiz modal, final quiz certificate gate strict qua learning-service, va fix regression curriculum response cho learning-service. done - 2026-05-18 - by AI AGENT
- [x] **Hotfix AI test readiness:** instructor giu du dashboard hoc vien + Studio, sua mojibake Studio pages, va relax Kafka user_id validation cho seed id dang `inst-002`. done - 2026-05-18 - by AI AGENT
- [x] **Hotfix:** Khong tu dong redirect /learn sang /dashboard/courses khi learn data loi hoac khoa hoc chua co bai hoc. done - 2026-05-18 - by BINH
- [x] **Hotfix:** Internal curriculum khong bat buoc chapter publish neu co lesson publish (sua learn page khoa hoc moi). done - 2026-05-18 - by BINH
- [x] **Hotfix:** AI best-effort transcript/context - auto upsert lesson transcript tu metadata khi tao/cap nhat video, relax quiz/chat context gate, va mo duoc AI Chat tu learn bottom bar. done - 2026-05-18 - by AI AGENT
- [x] **Hotfix:** AI service dev runtime load `.env` truc tiep de VS Code task `dev:ai-service` khong crash thieu env va chat khong bao `AI_SERVICE_UNAVAILABLE`. done - 2026-05-18 - by AI AGENT
- [x] **Phase AI Transcript Pipeline:** Tach MANUAL/SUBTITLE_UPLOAD/AUTO_STT/AUTO_CONTEXT, them transcript_jobs DB queue + worker FFmpeg/faster-whisper, endpoint best AI context, backfill lesson hien co, va AI chat/quiz dung fallback context de moi khoa hoc co the dung AI. done - 2026-05-18 - by AI AGENT
- [x] **AI Transcript Runtime Enablement:** Kich hoat worker rieng, cap nhat runtime checklist, va ghi nhan backfill/verification. done - 2026-05-18 - by BINH
- [x] **AI Transcript API Providers:** Bo bat buoc cai FFmpeg/Python local bang provider API `auto`/Gemini/Deepgram/OpenAI cho worker AUTO_STT, giu faster-whisper lam fallback tuy chon. done - 2026-05-19 - by AI AGENT
- [x] **AI Transcript Embedded Worker:** Course-service tu khoi dong transcript worker khi service chay, khong can terminal worker rieng sau khi upload video; co `TRANSCRIPT_WORKER_ENABLED` de tat/tach worker. done - 2026-05-19 - by AI AGENT
- [x] **AI Keyword Context Mode:** Tat mac dinh AUTO_STT de tranh ton quota, chuyen AI chat/quiz sang mo rong kien thuc tu title/mo ta/course/chapter/lesson content va tu khoa do course-service rut trich. done - 2026-05-19 - by AI AGENT
- [x] **AI Seed Context Data:** Cap nhat `scripts/seed-all.ts` de moi khoa hoc seed co mo ta, chuong, bai hoc va AUTO_CONTEXT day du cho AI chat/quiz, khong phu thuoc video/transcript. done - 2026-05-19 - by AI AGENT
- [x] **AI Availability Hotfix:** Bo khoa cung transcript/status gate, AI chat/quiz fallback ve AUTO_CONTEXT tu course/lesson metadata, cap nhat UI khong con thong bao 50% transcript, va backfill lai context hien co. done - 2026-05-19 - by AI AGENT
- [ ] **Phase AI-1:** AI Chatbot Production — AI Service (Express :3007), `ai_db` Neon schema, Kong route `/ai/*`, Redis rate limit (30 msg/user/giờ), Redis cache (course context 5 phút, response 15 phút), Gemini 2.0 Flash (primary) + Flash-Lite (fallback), SSE streaming. Conversation memory: full messages + semantic summary sau mỗi 10 messages. Chat API: conversation CRUD, message SSE, cursor pagination, prompt injection detection, PII redaction. Frontend: ChatWidget + ChatPanel + useChat hook. Context loader: gọi `GET /internal/courses/:id/full-context` từ Course Service. Plan chi tiết: `plan/ai_phase1_chatbot_production.md`. ~6 ngày.
- [ ] **Phase AI-3:** AI Course Outline + Post Suggestions — Course Outline Generator: gợi ý chapters + lessons từ tiêu đề/mô tả/trình độ, cached 24h, chỉ dành cho Instructor. Post Suggestions: AI cải thiện bài community/Q&A (tiêu đề, format markdown, hashtag), cached 1h. Cả 2 tích hợp trên AI Service (Phase AI-1). Plan chi tiết: `plan/ai_phase3_outline_post_suggest.md`. ~3 ngày.
- [ ] **Phase AI-4:** AI-Powered Semantic Search — Nâng cấp search từ ILIKE thành hybrid search: keyword (30%) + semantic vector (70%) + RRF merge. pgvector extension trên Neon course_db, Gemini text-embedding-004, embedding stored per course, seed script re-embed existing. Graceful fallback về ILIKE khi AI Service down. Plan chi tiết: `plan/ai_phase4_semantic_search.md`. ~4 ngày.

---



## 6. Ghi Chú Quan Trọng (Decisions & Assumptions)

### Architecture & Database
*   **Data Aggregation:** Không dùng JOIN giữa các DB. Frontend sẽ gọi song song các API (Auth, Course) và gộp dữ liệu tại Server Actions.
*   **Prisma Singleton:** Implemented Global Variable pattern trong `packages/db-prisma` để ngăn "too many connections" khi Next.js HMR reload code.
*   **Neon Cold Start:** Database sẽ auto-pause sau 5 phút idle. Request đầu tiên sau khi ngủ sẽ chậm hơn (~2-3s).
*   **Instructor Channel:** Mỗi instructor có 1 `InstructorProfile` (slug unique, displayName, headline, bio, avatar, socialLinks). Public listing at `/instructors`.
*   **Revenue Share:** Instructor nhận 70% mỗi order thành công, platform giữ 30%. Số % này là system config (admin có thể thay đổi từ `/admin/settings`).
*   **Q&A vs Community:** Community la feed chung toan he thong cho user da dang nhap, khong con group/nhom/community theo khoa hoc. Q&A la kenh hoi dap rieng theo courseId: student phai enrolled, instructor chi quan tri khoa hoc cua minh, admin quan tri toan bo.
*   **Microservices Layout (Phase 35):** 7 services — auth (3101), course (3002), learning (3006), community (3007), payment (3003), media (3004), notification (3005). Learning và community tách ra khỏi course-service để đảm bảo Single Responsibility Principle. InstructorRequest merge vào auth-service. Kafka consumer cho enrollment chạy tại learning-service thay vì course-service.
*   **Internal API Pattern:** Các service gọi nhau qua `/internal/*` endpoints (không qua Kong Gateway), xác thực bằng `x-internal-call: true` header. Course-service cung cấp `/internal/courses/:id` và `/internal/lessons/:id`. Learning-service cung cấp `/internal/enrollment/check` và `/internal/courses/:courseId/completion`.

### Environment & Validation
*   **T3 Env Pattern:** Package `env-validator` sử dụng Zod để validate `.env` ngay lúc runtime. App sẽ crash với error message rõ ràng nếu thiếu biến.
*   **Gateway Unification:** Đã gỡ bỏ hoàn toàn `api-gateway` (Node), chỉ sử dụng Kong làm API Gateway trung tâm. 
*   **Media Provider Strategy:** Cloudinary Free la provider mac dinh cho image/video URL, local storage la fallback cho local development; S3/VideoCipher khong con la huong uu tien.

### Frontend Conventions (Next.js App Router)
*   **Server Actions for API Calls:** All API calls from Next.js to Microservices are done via Server Actions (`actions/`) using the internal `GATEWAY_URL`.
*   **Client vs Server Components:** Limit `"use client"` as much as possible, mostly used for simple state hooks or highly interactive elements. Do not pass complex API functionality directly down tree.




### 2026-05-14 - Community Global Feed Refactor
- [x] Refactor `/community` thanh feed chung toan he thong, xoa legacy community group/member/group post schema, va chuyen Q&A thanh course-specific. done 2026-05-14


### 2026-05-15 - UI Hotfix Admin And Instructor Request
- [x] Restore become-instructor application form, clamp admin community feed limit to 50, and repair Vietnamese UI text in admin/become-instructor scope. done 2026-05-15

### 2026-05-19 - Fix AI Chatbot & Quiz Features
- [x] Fix CORS preflight block for AI chat SSE streaming (Kong pre-function allow OPTIONS). done 2026-05-19
- [x] Fix OpenRouter model name (openrouter/free → meta-llama/llama-3.1-8b-instruct:free). done 2026-05-19
- [x] Fix stale closure bug in chat widget onDone callback. done 2026-05-19
- [x] Add exposed_headers for X-RateLimit-* in Kong CORS config. done 2026-05-19
- [x] Fix chat Unauthorized: add cookie JWT decoding fallback in require-auth middleware. done 2026-05-19
- [x] Fix quiz fallback: return error instead of meaningless static questions, add retry + validation in generateQuizWithLLM. done 2026-05-19

### 2026-05-23 - CQRS Course Discovery
- [x] CQRS Course Discovery Redis read model + Kafka catalog events + fallback Prisma listing + warmup script. done 2026-05-23

### 2026-05-23 - Payment Event Sourcing
- [x] Payment Order Event Sourcing dual-write, admin event history API, order event backfill, and fold/projection verification. done 2026-05-23

### 2026-05-27 - Order History UX Unification
- [x] Chuan hoa lich su don hang ve route `/dashboard/orders`, dung chung component dashboard va redirect VNPay return ve man hinh nay. done 2026-05-27

### 2026-05-27 - VNPay Continue Payment Expiry Fix
- [x] Khong tai su dung VNPay URL het han; them continue payment API expire order cu, verify lai gia va tao order/URL moi co khoa chong double click. done 2026-05-27

### 2026-05-27 - Notification Neon Connection Retry
- [x] Them retry cho notification-service khi Prisma gap P1017/connection drop tren Neon serverless. done 2026-05-27

### 2026-05-27 - Payment And Revenue Flow Audit
- [x] Audit va harden flow VNPay/enrollment/earning/payout: instructor role guard, idempotent earning notification, payout audit log, admin/instructor payout notification, va internal admins/notification endpoints. done 2026-05-27

### 2026-05-27 - Admin Dashboard Operations UX Refactor
- [x] Nhom lai sidebar admin theo nghiep vu, them alias `/admin/settings` va `/admin/dlq`, refactor system config thanh setting co label/validation/default, va bo sung confirm/loading/toast cho cac flow admin nhay cam. done 2026-05-27

### 2026-05-27 - Instructor Studio Operations UX Refactor
- [x] Nhom lai sidebar Instructor theo flow giang vien, refactor overview/courses/course create/Q&A/analytics/profile/payment, sua mojibake instructor scope, them confirm publish/payout va harden validation payout profile. done 2026-05-27

### 2026-05-27 - Endgame Demo Seed Expansion
- [x] Mo rong `scripts/seed-all.ts` cho demo kien truc cuoi ky: payment lifecycle, retry payment, VNPay audit, earning/payout, instructor request, Q&A, support ticket, notification, audit log, DLQ, certificate deterministic, course discovery Redis warmup va AI context keywords. done 2026-05-27
- [x] Hotfix seed Neon pool timeout: ep Prisma seed URL dung `connection_limit=1&pool_timeout=30` de tranh P2024 khi seed nhieu service DB cung luc. done 2026-05-27
- [x] AI final quiz/chat context hardening: rut gon context ve metadata course/chapter/lesson, parse JSON an toan, retry prompt ngan hon, UTF-8 headers, demo fallback quiz co dieu kien, va redirect lesson URL cu sau reseed. done 2026-05-27
- [x] AI chat conversation scoping fix: list conversation theo courseId va reset selected conversation khi doi course/lesson de tranh gui lesson sai khoa hoc. done 2026-05-27
