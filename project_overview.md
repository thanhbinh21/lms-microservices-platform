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
- Auto-pause after 5min idle Ã¢â€ â€™ 0 cost, 0 resource usage
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

## 5. Roadmap DÃ¡Â»Â± ÃƒÂn (TiÃ¡ÂºÂ¿n Ã„â€˜Ã¡Â»â„¢ thÃ¡Â»Â±c hiÃ¡Â»â€¡n)

DÃ¡Â»Â± ÃƒÂ¡n Ã„â€˜Ã†Â°Ã¡Â»Â£c chia thÃƒÂ nh nhiÃ¡Â»Âu giai Ã„â€˜oÃ¡ÂºÂ¡n (Phases) theo chuÃ¡ÂºÂ©n "Vertical Slice Architecture".

### Phase 1-4: Foundation (NÃ¡Â»Ân tÃ¡ÂºÂ£ng) Ã¢Å“â€¦ COMPLETED
- [x] **Phase 1:** Setup Monorepo (Turborepo), Docker Compose (Kafka/Zookeeper) + Neon Serverless PostgreSQL. Ã¢Å“â€¦ Completed: Jan 21, 2026
- [x] **Phase 2:** Setup API Gateway (Kong DB-less) & Shared Packages (Logger, Types, Env Validator). Ã¢Å“â€¦ Completed: Jan 21, 2026
- [x] **Phase 3:** Build **Auth Service** (Login, Register, JWT pair, Session Redis, Refresh Token rotation). Ã¢Å“â€¦ Completed: Jan 25, 2026
- [x] **Phase 4:** Build Frontend Base (Next.js 15, Shadcn UI, Redux, Login/Register Forms, Be Vietnam Pro font). Ã¢Å“â€¦ Completed: Jan 25, 2026 Ã¢Å“â€¦ **VERIFIED: Production-Ready**

### Phase 5-8: Core LMS & Media Ã¢Å“â€¦ COMPLETED
- [x] **Phase 5:** Build **Course Service DB** & CRUD API (Course, Chapter, Lesson, Enrollment models). Ã¢Å“â€¦ Completed: Feb 28, 2026
- [x] **Phase 6:** Build **Media Service** (Presigned URL upload, YouTube external, local storage provider). Ã¢Å“â€¦ Completed: Feb 28, 2026 (Legacy media provider setup; se chuan hoa Cloudinary o Phase 9.8)
- [x] **Phase 6.1:** Code Audit & Production Hardening (Security fixes, Vietnamese comments, optimizations). Ã¢Å“â€¦ Completed: Mar 01, 2026
- [x] **Phase 7:** Frontend Instructor UI (7.1-7.4, 7.6-7.7 completed). Ã¢Å“â€¦ Completed: Mar 31, 2026 (Legacy register role selector se duoc thay the boi luong Become Educator o Phase 9.4-9.6)
- [x] **Phase 8:** Frontend Public UI (8.1-8.4 completed). Ã¢Å“â€¦ Completed: Mar 23, 2026

### Phase 9: Optimization & Technical Debt Ã¢Å“â€¦ COMPLETED (core)
- [x] **Phase 9.1:** Backend Cleanup Ã¢â‚¬â€ GÃ¡Â»Â¡ Node Gateway (chÃ¡Â»â€° dÃƒÂ¹ng Kong), Prisma migrations (sourceType, category, lastLoginAt), fix N+1, graceful shutdown. Ã¢Å“â€¦ Completed: Mar 31, 2026
- [x] **Phase 9.2:** Frontend Cleanup Ã¢â‚¬â€ SharedNavbar/Footer, `/courses/[slug]` route, Phase 7.5 (edit/delete chapter/lesson), ErrorBoundary, loading.tsx, mobile menu, active sidebar. Ã¢Å“â€¦ Completed: Mar 31, 2026 (Updated hotfix: thumbnail upload + curriculum UX/status messaging + sample data seed; Apr 21, 2026: wizard Viet hoa co dau, chapter auto numbering, lesson edit + paid-price gate, media/content per lesson, publish redirect public view; Apr 28, 2026: Cloudinary image upload cho community/profile, thumbnail course auto-save ngay sau upload, instructor studio tab navigation ro rang hon)
- [x] **Phase 9.3:** DX Improvements (partial) Ã¢â‚¬â€ Root scripts prisma:generate:all, prisma:migrate:deploy:all, prisma:push:all, setup:db, dev:web/dev:web:lite. Ã¢Å“â€¦ Completed: Apr 18, 2026
  - Pending items chuyen sang Phase 9.13: `pnpm run setup`, `.nvmrc`, turbo pipeline cho Prisma, cleanup test files.
- [x] **Phase 9.4:** Auth Role Policy Refactor Ã¢â‚¬â€ Register luon tao role STUDENT (hardcode trong register.controller.ts), bo role input tu client, registerSchema chi nhan email/password/name. Ã¢Å“â€¦ Completed: Apr 18, 2026
- [x] **Phase 9.5:** Become Educator Backend Flow Ã¢â‚¬â€ update-role.controller.ts voi Zod validation, Prisma update, audit logging. Ã¢Å“â€¦ Completed: Apr 18, 2026
  - Ghi chu ky thuat: Endpoint hien tai la generic `PATCH /users/role` (nhan userId + role). Xem Phase 9.14 de refactor thanh `/become-educator` chuyen biet.
- [x] **Phase 9.6:** Become Educator Frontend UX Ã¢â‚¬â€ Trang `/become-instructor` voi BecomeInstructorForm, SharedNavbar/Footer, ScrollReveal. Register form khong con role selector. Ã¢Å“â€¦ Completed: Apr 18, 2026
- [x] **Phase 9.7:** System Seed Content Ã¢â‚¬â€ Admin he thong tao/quan ly bo khoa hoc mau (co bai free) de hoc vien trai nghiem truoc khi giang vien upload khoa hoc that. Ã¢Å“â€¦ Completed: Apr 04, 2026
- [x] **Phase 9.8:** Media Provider Unification Ã¢â‚¬â€ Chuyen media upload/delivery sang Cloudinary Free, giu local storage fallback cho dev/test, ngung dung S3/VideoCipher trong flow chinh. Ã¢Å“â€¦ Completed: Apr 18, 2026
  - Hotfix (Apr 18, 2026): Route local upload/download duoc tach khoi provider dang active de tranh crash `storage.getAbsolutePath is not a function` khi service dang chay Cloudinary.
- [x] **Phase 9.9:** Authentication Standardization - Removed duplicated JWT decodings in `course-service` and `instructor-service`. Both now correctly rely on Kong API Gateway for `x-user-id` and `x-user-role`. Ã¢Å“â€¦ Completed: Apr 04, 2026
- [x] **Phase 9.10:** Resolving Race Conditions - Fixed auth token `restoreSessionAction` race condition that was triggering endless refreshes when switching tabs. Ã¢Å“â€¦ Completed: Apr 04, 2026
- [x] **Phase 9.11:** Sync Application Defaults - Resolved mismatch validations for user registrations and centralized password policies. Upsert logic for seed commands to safely mutate data without blowing up primary keys. Ã¢Å“â€¦ Completed: Apr 04, 2026
- [x] **Phase 9.12:** Runtime Stability Optimization - Hardening local dev runtime cho luong upload va Server Actions (bo sung preflight clear ports/lock, tach profile `dev:web`/`dev:web:lite`, xu ly fallback 503 khi upstream tam thoi khong reachable, fix local media route khi provider cloudinary dang active). Ã¢Å“â€¦ Completed: Apr 18, 2026
- [x] **Hotfix:** Kong auth public route allowlist + strip-path fix cho `/auth/login`. done - 2026-05-14
- [x] **Hotfix:** Refresh token rotation race fix (P2025) trong auth-service. done - 2026-05-14
- [x] **Hotfix:** Seed script Prisma import path sync (prisma-v2 -> prisma). done - 2026-05-14
- [x] **Hotfix:** Restore protected API auth after audit (JWT nbf claim + middleware fallback decode payload khi x-user-id chua duoc inject). done - 2026-05-14
- [x] **Hotfix:** Community page khong con treo loading khi user chua co group kha dung. done - 2026-05-14
- [x] **Hotfix:** Admin dashboard stat card empty href guard. done - 2026-05-15 - by BINH
- [ ] **Phase 9.13:** DX Hardening Ã¢â‚¬â€ `pnpm run setup` bootstrap (install + docker:up + setup:db + seed), `.nvmrc` node version pin, Prisma orchestration vao turbo pipeline, cleanup test files.
- [x] **Phase 9.14:** Become Educator Security Refactor (Audit Phase 9.5). Ã¢Å“â€¦ Completed: Apr 21, 2026
  - Van de: `PATCH /users/role` hien tai la generic endpoint, nhan `userId` + `role` tu request body Ã¢â‚¬â€ bat ky ai co access deu co the nang cap role bat ky user khac thanh ADMIN.
  - Endpoint khong kiem tra x-user-id tu Gateway, khong co auth middleware guard.
  - Khac phuc: Tao endpoint chuyen biet `POST /become-educator` chi cho phep user tu nang cap chinh minh len INSTRUCTOR (khong nhan userId tu body, lay tu x-user-id header). Giu `PATCH /users/role` cho admin-only (them requireAdmin middleware).
  - Them audit trail: luu thoi diem, actor id, trace_id, previous role.
  - Refresh token/session sau khi doi role de frontned nhan role moi.
- [x] **Phase 9.15:** Route & Middleware Consolidation (Audit Phase 5, 10) Ã¢Å“â€¦ Completed: Apr 22, 2026
  - Van de 1: course-service co route trung lap Ã¢â‚¬â€ `/api/courses/:courseId/progress` duoc dang ky 2 lan (line 77 va line 117 trong index.ts). Express se match route dau tien, route thu 2 khong bao gio duoc goi.
  - Van de 2: Duplicate enrollment logic Ã¢â‚¬â€ `enrollCourse` (enrollment.controller.ts) va `enrollFree` (learning.controller.ts) lam cung viec voi logic gan nhu giong het. Can gop lai thanh 1 flow duy nhat.
  - Van de 3: requireAuth middleware bi duplicate giua services (course, payment, notification, instructor). Can tach thanh shared package `@lms/middleware` hoac gop vao `@lms/types`.
  - Update (Apr 21, 2026): Da tach middleware `requireAdmin` thanh shared factory `createRequireAdmin()` trong `@lms/types` va auth-service da import lai tu package chung.
  - Hotfix (Apr 21, 2026): Khoi phuc syntax hop le trong `course.controller.ts` sau merge do dang, sua them typing o `internal.controller.ts` de `@lms/course-service` build lai on dinh.
  - Hotfix (Apr 21, 2026): Web-client chu dong xoa auth cookies khi `/refresh` tra ve 401/403 de chan vong lap refresh token hong; course-service map loi Prisma init/connect thanh 503 de frontend phan biet ro DB tam thoi unavailable.
  - Hotfix (Apr 26, 2026): auth-service giam log nhieu khi refresh token cu/sai chu ky (`invalid signature`) va uu tien kiem tra token ton tai trong DB truoc khi verify chu ky de tranh spam log luc mo trang dang nhap.
  - Van de 4: instructor-service dung CORS `cors()` khong co origin restriction (app.ts line 10), khac voi cac service khac dung `CORS_ORIGIN`.
- [x] **Phase 9.16:** API Response & Error Handling Standardization (Audit tat ca services) Ã¢Å“â€¦ Completed: Apr 22, 2026
  - Van de 1: Nhieu controller dung `ApiResponse<any>` thay vi typed response (login, register, admin). Can ep kieu cu the de tranh leak du lieu.
  - Van de 2: learning.controller va progress.controller tra ve `{ success, code, message }` khong co `trace_id` va `data` field trong mot so error path Ã¢â‚¬â€ vi pham ApiResponse<T> contract.
  - Van de 3: instructor-service dung rieng helper `errorResponse/successResponse` (utils/apiResponse.ts) khong dong nhat voi cac service khac dung truc tiep `ApiResponse<T>`.
  - Khac phuc: Khoi tao `createSuccessResponse` / `createErrorResponse` package chung trong `@lms/types` va ap dung khap noi nham loai bo `any`.
- [x] **Phase 9.17:** Expired Token & Stale Session Cleanup Ã¢Å“â€¦ Completed: Apr 22, 2026
  - Van de: Refresh tokens het han chi bi xoa khi user refresh lai (passive cleanup). Khong co CRON/job xoa token cu Ã¢â‚¬â€ bang refreshToken se lon dan theo thoi gian.
  - Khac phuc: Them scheduled job (node-cron hoac Prisma script) de xoa refreshToken.expiresAt < now() dinh ky (moi ngay).
  - Bo sung: Xoa session Redis cua user khi bi ban/suspend boi admin (hien tai ban user khong revoke session, user van co token hop le cho den khi het han).

### Phase 10-12: Learning Experience Ã¢Å“â€¦ COMPLETED (core)
- [x] **Phase 10:** Student Learning UI Ã¢â‚¬â€ `/learn/[courseId]` layout (8KB), lesson sub-route, LessonProgress model (upsert), video player, progress tracking (getCourseProgress, updateLessonProgress, completeLesson), free enrollment (enrollFree voi idempotency + price guard + transaction), getMyCourses. Ã¢Å“â€¦ Completed: Apr 18, 2026
  - Review UI chuyen sang Phase 10.1.
  - Hotfix (Apr 26, 2026): Sua dong bo API update progress lesson (`PUT /api/student/lessons/:lessonId/progress`) va bo sung fallback payload de khong mat tien do khi FE gui du lieu cu; nang UX trang lesson (hien tien do xem, CTA hoan thanh ro hon, ho tro danh dau hoan thanh cho bai YouTube).
  - Hotfix (Apr 26, 2026): Learn layout lang nghe su kien cap nhat tien do de dong bo sidebar/progress ngay sau khi complete lesson; cai thien LessonNavigation de can bo cuc khi thieu prev/next va them action sau bai cuoi (hoan thanh khoa, xem chung chi, danh gia).
- [x] **Phase 11:** **Notification Service** (partial) Ã¢â‚¬â€ Kafka consumers (payment.order.completed + learning.enrollment.created), idempotent notification (upsert by eventId), CRUD API (listMyNotifications + markAsRead + markAllAsRead), cursor-based pagination, Kong Gateway route. Ã¢Å“â€¦ Completed: Apr 18, 2026
  - Email transport (Nodemailer/Resend) va notification bell UI chuyen sang Phase 11.1. Status hien dang la MOCKED.
- [x] **Phase 12:** Student Dashboard Ã¢â‚¬â€ `/dashboard` (37KB) voi tabs overview/my-courses/certificates/community/orders, progress cards voi progressPercent + completedLessons, course filter (all/in-progress/completed), sort (recent/progress), getMyEnrollmentsAction, CTA Become Educator. Ã¢Å“â€¦ Completed: Apr 18, 2026
  - Hotfix (Apr 26, 2026): Trien khai chung chi that trong course-service (model Certificate + auto issue khi hoc vien hoan thanh 100% + API `/api/student/certificates`), thay the luong dashboard certificates gia lap bang du lieu chung chi thuc te.

### Phase 10.1-11.1: Learning Experience Ã¢â‚¬â€ Remaining Items
- [x] **Phase 10.1:** Rating & Review System Ã¢â‚¬â€ Prisma model Review (courseId, userId, rating 1-5, comment), CRUD API (createReview/listReviews/getReviewStats + getMyReview), 1 user = 1 review/course (unique constraint), course aggregate (avgRating, reviewCount), frontend review form + review list tren `/courses/[slug]` va `/learn/[courseId]`. Ã¢Å“â€¦ Completed: Apr 26, 2026
  - Hotfix (Apr 26, 2026): Chi cho phep tao review 1 lan sau khi hoc vien hoan thanh 100% khoa hoc; bo review panel khoi trang hoc video, giu review o trang chi tiet khoa hoc.
- [x] **Phase 11.1:** Direct SMTP Email Transport & Notification UI Ã¢â‚¬â€ TÃƒÂ­ch hÃ¡Â»Â£p hÃ¡Â»â€¡ thÃ¡Â»â€˜ng gÃ¡Â»Â­i email thÃ¡Â»Â±c tÃ¡ÂºÂ¿ trÃ¡Â»Â±c tiÃ¡ÂºÂ¿p qua giao thÃ¡Â»Â©c SMTP (sÃ¡Â»Â­ dÃ¡Â»Â¥ng tÃƒÂ i khoÃ¡ÂºÂ£n thÃ¡ÂºÂ­t nhÃ†Â° Gmail App Password), khÃƒÂ´ng phÃ¡Â»Â¥ thuÃ¡Â»â„¢c vÃƒÂ o dÃ¡Â»â€¹ch vÃ¡Â»Â¥ trung gian (nhÃ†Â° Resend/SendGrid). XÃƒÂ¢y dÃ¡Â»Â±ng Email Templates bÃ¡ÂºÂ±ng HTML (welcome, payment success, enrollment). TÃƒÂ­ch hÃ¡Â»Â£p Notification Bell UI trÃƒÂªn SharedNavbar (huy hiÃ¡Â»â€¡u sÃ¡Â»â€˜ lÃ†Â°Ã¡Â»Â£ng chÃ†Â°a Ã„â€˜Ã¡Â»Âc, dropdown danh sÃƒÂ¡ch, tÃ†Â°Ã†Â¡ng tÃƒÂ¡c Ã„â€˜ÃƒÂ¡nh dÃ¡ÂºÂ¥u Ã„â€˜ÃƒÂ£ Ã„â€˜Ã¡Â»Âc). [2026-04-22]

### Phase 13-16: Commerce & Payments (VNPay + Kafka) Ã¢Å“â€¦ COMPLETED
- [x] **Phase 13:** Payment Service DB & Order CRUD Ã¢â‚¬â€ Order model, VNPayAudit model (JSONB audit), createOrder (price verify tu course-service via /internal/courses/:id), getOrder (owner check), getMyOrders, idempotency (existingPending order + alreadyPaid guard). Ã¢Å“â€¦ Completed: Apr 18, 2026
- [x] **Phase 14:** Tich hop VNPay Ã¢â‚¬â€ buildPayUrl, handleVNPayReturn (checksum verify + dev fallback), handleVNPayIPN (idempotent: check COMPLETED, amount verify, 97/01/04/02 response codes), JSONB audit per callback. Frontend: /payment/vnpay-return voi PaymentPoller component. Ã¢Å“â€¦ Completed: Apr 18, 2026
- [x] **Phase 15:** Kafka Producer Ã¢â‚¬â€ @lms/kafka-client upgraded: KafkaEventEnvelope<T> typed envelope, PaymentOrderCompletedEvent + EnrollmentCreatedEvent typed events, TopicEventMap type mapping, publishEvent<T> generic helper, RetryPolicy + consumeWithRetry retry wrapper, PAYMENT_ORDER_COMPLETED_RETRY default policy (5s Ã¢â€ â€™ 1m Ã¢â€ â€™ DLQ). Ã¢Å“â€¦ Completed: Apr 18, 2026
- [x] **Phase 16:** Kafka Consumer & DLQ Ã¢â‚¬â€ course-service Kafka consumer (payment.order.completed Ã¢â€ â€™ enrollment, idempotent by orderId, transaction create enrollment + increment enrollmentCount, publish enrollment.created downstream). DLQ admin API (listFailedEvents, getFailedEventStats, retryFailedEvent, resolveFailedEvent). Ã¢Å“â€¦ Completed: Apr 18, 2026
  - Rating/Review model chuyen sang Phase 10.1.

### Phase 17: Search, Filter & Category System Ã°Å¸â€Â§ IN PROGRESS
- [x] **Phase 17a:** Category System Backend Ã¢â‚¬â€ Category model (name, slug, order), listCategories (voi courseCount), createCategory (admin-only), seed:categories script. Ã¢Å“â€¦ Completed: Apr 18, 2026
- [x] **Phase 17b:** Course Discovery API Ã¢â‚¬â€ listCourses endpoint voi search (title/description ILIKE), filter (category, level, minPrice/maxPrice, minRating), sort (newest/popular/rating/price_asc/price_desc), pagination, price aggregate, category sidebar data. Ã¢Å“â€¦ Completed: Apr 18, 2026
- [ ] **Phase 17c:** Frontend Search & Filter UI Ã¢â‚¬â€ `/courses` page voi search bar, filter sidebar (category/level/price range/rating), sort dropdown, responsive grid layout, URL sync (query params).

### Phase 18-19: Analytics & Admin Dashboard Ã¢Å“â€¦ COMPLETED
- [x] **Phase 18:** Instructor Analytics Dashboard Ã¢â‚¬â€ Revenue charts, KPI cards, top courses table, enrollment trends. Hien tai chi co placeholder page voi du lieu = 0. Can backend analytics API (revenue aggregate tu payment-service, enrollment trends tu course-service). Ã¢Å“â€¦ Completed: Apr 27, 2026
- [x] **Phase 19:** Admin Dashboard (tÃƒÂ­ch hÃ¡Â»Â£p trong web-client thay vÃƒÂ¬ tÃƒÂ¡ch Vite app) Ã¢â‚¬â€ `(admin)/admin/` voi dashboard overview (user/course stats), users management, courses management, reviews management, system DLQ monitor (list/retry/resolve failed events). Ã¢Å“â€¦ Completed: Apr 26, 2026

### Phase 20: Deployment & Production Hardening Ã°Å¸Å¡â‚¬
- [ ] **Phase 20:** Dockerize all services, docker-compose.prod.yml, CI/CD (GitHub Actions), Nginx + SSL, monitoring, backup strategy.

### Phase 21-22: Performance & Security Hardening
- [x] **Phase 21:** Performance & Caching Optimization Ã¢â‚¬â€ KhÃ¡ÂºÂ¯c phÃ¡Â»Â¥c Neon cold-start bÃ¡ÂºÂ±ng `withRetry`, tÃƒÂ­ch hÃ¡Â»Â£p Upstash Redis caching (cache-aside cho course/category), tÃ¡Â»â€˜i Ã†Â°u Prisma query (composite indexes, selective fields), Next.js `unstable_cache` & `revalidateTag` cho Server Actions. Ã¢Å“â€¦ Completed: Apr 22, 2026
- [ ] **Phase 22:** Security Hardening Ã¢â‚¬â€ API rate limiting chuÃ¡ÂºÂ©n hÃƒÂ³a, input sanitization chÃ¡Â»â€˜ng XSS, audit log cho admin actions, health check dashboard tÃ¡Â»â€¢ng hÃ¡Â»Â£p.
- [ ] **Phase 23:** Testing & Quality Gate Ã¢â‚¬â€ Unit tests cho business logic core (enrollment, payment verify, Kafka handlers), integration tests cho payment flow E2E, API contract tests (Zod schema Ã¢â€ â€™ validation), CI pipeline (lint + test truoc merge).

### Phase 24-29: Growth & Polish (New Ã¢â‚¬â€ 2026-04-29)

Chi tiÃ¡ÂºÂ¿t: Xem `plan/roadmap_phase_24_29.md`

- [x] **Phase 24:** Instructor Channel System Ã¢â‚¬â€ Model `InstructorProfile` (displayName, headline, bio, avatar, slug, socialLinks), API CRUD profile, public instructor listing (`/instructors`) + public profile page (`/instructors/[slug]`), `/instructor/profile` page thay the placeholder settings. ~3-4 ngÃƒÂ y. done - 2026-05-10 
- [x] **Phase 25:** Global Q&A System Ã¢â‚¬â€ Thay the course community groups bang global Q&A. Model Question/Answer (title, content, courseId, lessonId, isResolved, upvotes), API CRUD + upvote + accept-answer, frontend `/dashboard/qa` + `/qa/[id]`, migrate/archive existing community data. ~3-4 ngÃƒÂ y. done - 2026-05-10 
- [x] **Phase 26:** Community Verify Badge Ã¢â‚¬â€ Cap nhat UI community/Q&A: them icon verify xanh (CheckCircle2) cho author co role INSTRUCTOR, link to instructor profile. Co the merge voi Phase 25. ~0.5 ngÃƒÂ y. done - 2026-05-10 
- [x] **Phase 27:** Instructor Revenue Display Ã¢â‚¬â€ Model `InstructorEarning` (instructorId, courseId, amount, revenueShare, status), payment consumer tao earning khi order completed, API earnings breakdown, update instructor analytics + settings payment page hien thi doanh thu. Payout withdrawal sang phase sau. ~2-3 ngÃƒÂ y. done - 2026-05-10 
- [x] **Phase 28:** Instructor UX Audit Ã¢â‚¬â€ Phan tich chuyen sac UX trang `/learn/[courseId]`, instructor dashboard, course management wizard. Output: bao cao chi tiet voi cac de xuat cai tien uu tien theo impact/effort. ~1-2 ngÃƒÂ y. done - 2026-05-10 
- [x] **Phase 29:** Full Admin Dashboard Ã¢â‚¬â€ Bo sung: `/admin/payouts` (approve/reject payout), `/admin/revenue` (platform revenue analytics + chart), `/admin/audit-log` (audit trail cho admin actions), `/admin/notifications` (notification history), `/admin/categories` (CRUD danh muc), `/admin/settings` (system config). ~4-5 ngÃƒÂ y. done - 2026-05-10 

### Phase 30-34: UX Foundation & Polish (Audit 2026-04-29)

Chi tiet: Xem `plan/roadmap_phase_30_34.md`

- [x] **Phase 30:** Accessibility & Core UX Foundation Ã¢â‚¬â€ Fix P0 accessibility (modals: `role="dialog"` + `aria-modal` + focus trap; sidebar: `aria-current` + `:focus-visible` ring + Escape key; learn sidebar: mobile close flow; lesson TEXT content renderer; certificate PDF preview thay .txt; analytics: fix revenue label + date range selector; settings: implement real data hoac remove placeholder). Fix P0 crash: `Date.parse` null safety khi `updatedAt`/`createdAt` undefined. Fix P0 admin: them "Don Giang Vien" vao sidebar, fix `isFlagged` filter (boolean thay vi string), fix FLAGGED badge (amber thay vi red BANNED). Ã¢Å“â€¦ Completed: Apr 29, 2026
- [x] **Phase 31:** Settings + Revenue Foundation Ã¢â‚¬â€ Payment Service API (`GET /api/instructor/earnings` + `GET /api/instructor/earnings/summary`), instructor earning creation on payment completion, settings page "Kenh cua toi" functional with earnings display + bank account form + transaction history + withdrawal placeholder. Ã¢Å“â€¦ Completed: Apr 29, 2026
- [x] **Phase 32:** Student Learn Page Polish Ã¢â‚¬â€ Collapsible chapters + active lesson highlight + progress per lesson (already done), sticky lesson navigation on scroll, keyboard shortcuts (ArrowLeft/Right/?), video playback speed selector (0.5x-2x), confetti on first certificate completion. Ã¢Å“â€¦ Completed: Apr 29, 2026
- [x] **Phase 33:** Course Detail + Public Pages Polish Ã¢â‚¬â€ Course API tra ve `instructor` object day du (name, bio, avatar, slug); hien thi instructor real name thay vi `Giang vien #abc123`; instructor avatar + bio + profile link; related courses section; reviews: fix typo heading + add pagination + add text search; login: them forgot password + remember me (done); landing page: dynamic featured course thay vi hardcoded. Footer pages: `/about`, `/help`, `/terms`, `/privacy`, `/careers` placeholders created. ~1-2 ngay. done - 2026-05-10 - by BINH
- [x] **Phase 34:** Admin Completeness + Security Hardening
  - Backend: Audit log model + API endpoint, payout management API, category management API, server-side admin auth verification.
  - Frontend: `/admin/instructor-requests` standalone page (done), `/admin/categories` CRUD, `/admin/audit-log`, reviews search + isFlagged fix (done), courses bulk actions, footer links cleanup (done).
  - Security: JWT verification in auth middleware (done Ã¢â‚¬â€ verifyToken already full), IDOR fix enrollment (done Ã¢â‚¬â€ uses x-user-id header), VNPay transaction ID verify tu DB (done), enrollment unique constraint (done Ã¢â‚¬â€ schema), Kafka event payload validation with Zod schemas (done), Redis keys TTL, request timeouts, graceful shutdown all services, CORS origin restriction (done Ã¢â‚¬â€ env-based).
  ~4-5 ngay. done - 2026-05-10 - by BINH

- [x] **Phase 35:** Option A Microservices Refactor Ã¢â‚¬â€ Loai bo "God Service" pattern tu course-service. Tach learning-service (Enrollment/Progress/Certificate/DLQ) va community-service (Community/Q&A) thanh service rieng biet. Merge instructor-service vao auth-service. Cap nhat Kong routes, course-service internal API, Kafka consumers, frontend Server Actions. Chi tiet: `service_architecture_analysis.md` + `plan/refactor_option_a_plan.md`. done - 2026-05-12 - by AI AGENT
- [x] **Phase 35.1:** Internal service auth hardening - chuan hoa guard createRequireInternal, bat buoc x-internal-secret cho toan bo /internal/*, cap nhat internal HTTP clients va env validation lien quan. done - 2026-05-13 - by AI AGENT
- [x] **Phase 35.2 (Audit Phase 1):** Kong JWT boundary hardening - tach luong public/protected bang route policy, bat JWT verify tren protected routes, remove header spoofing tu client (x-user-*), va inject lai user context sau xac thuc tai Gateway. done - 2026-05-13 - by AI AGENT
- [x] **Phase 35.3 (Audit Phase 2):** Kafka reliability hardening - transactional outbox cho payment/enrollment, manual commit sau success/retry/DLQ handoff, enrollment retry topics, DLQ processor persist failed events, remove unconsumed catalog status producer. done - 2026-05-13 - by AI AGENT (DB migration deploy/recover done 2026-05-14; live Kafka smoke test pending runtime)
- [x] **Phase 35.4 (Audit Phase 3):** Service boundary cleanup - community-service them local enrollment permission read model (`learning.enrollment.created` consumer), uu tien read model local cho enrollment gate va giu fallback internal check sang learning-service de tranh hard dependency runtime. done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.5 (Audit Phase 4):** Cache consistency hardening - bo sung cache invalidation matrix cho course/category/review mutations trong course-service va dong bo Next.js `revalidateTag('courses'/'categories')` o admin + instructor Server Actions. done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.6 (Audit Phase 5 - Batch A):** Shared middleware + dead code cleanup - xoa helper khong con su dung (`publishEnrollmentCreatedEvent`, `createInstructorEarningFromCompletedOrder`), thay community route-local auth guard bang `createRequireAuth`, va chuan hoa auth-service source middleware folder ve `src/middleware`. done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.7 (Audit Phase 5 - Batch B):** Prisma generated-client convention sync - chuan hoa output path `src/generated/prisma` cho `auth/course/payment`, cap nhat import lien quan, xoa stale `prisma-v2` folders va xac nhan build pass cac service anh huong. done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.8 (Audit Ops DX):** Refresh runbook sau audit + cleanup root scripts - viet lai `RUNCODE_AFTER_PULL_CODE.md` theo workflow hien tai, va toi gian `package.json` scripts (giu nhom run/build/test/migrate/docker/seed can thiet cho dev pull code). done - 2026-05-14 - by AI AGENT
- [x] **Phase 35.9:** P0 role UX & business logic - them support ticket auth-service, hoan thien instructor payout request/payment admin flow, chuyen admin DLQ sang learning-service, va polish UI admin/instructor support lien quan. done - 2026-05-14 - by AI AGENT

- [x] **Phase P2:** Instructor Studio & Revenue Experience â€” Fix mojibake instructor layout + course wizard, add loading.tsx for 6 instructor routes, implement pure-SVG earnings bar chart (6-month history from real InstructorEarning data). done - 2026-05-15 - by AI AGENT
- [x] **Phase P3:** Admin Operations, Governance & Observability â€” Fix mojibake/ASCII text in system-config + audit-log pages, add loading.tsx for all 6 admin routes, enhance admin overview with real-time stats from DLQ (pending count), support tickets (open/in-progress), and payouts (pending). All sensitive actions fully audited via auth-service. done - 2026-05-15 - by AI AGENT
- [x] **Phase DX:** Prisma Neon setup hardening - root Prisma CLI, per-service migrate retry, Neon warmup, and pooled/direct env examples. done - 2026-05-15 - by AI AGENT
- [x] **Phase DX:** Remove local Redis runtime - Docker stack chi con Kafka/Zookeeper/Kong, Redis dung Upstash/cloud qua env. done - 2026-05-15 - by AI AGENT
- [x] **Hotfix Demo P0:** Chuan hoa support route (`/support` + `/help` redirect), fallback notification role-aware, bo sung admin reject ly do bat buoc, va them `/admin/community` read-only dependency route. done - 2026-05-15 - by AI AGENT
- [x] **Hotfix Demo P1:** Sua 404 cho `/become-instructor` va `/admin/instructor-requests` (route qua Kong `/auth/*`), nang cap `/admin/community` thanh dashboard co thong ke + filter/read-only feed, va dong bo UI admin pages (`instructor-requests`, `revenue`, `notifications`, sidebar labels). done - 2026-05-15 - by AI AGENT
- [x] **Hotfix Demo P2:** Dong bo frame layout Admin/Instructor va chuan hoa thong bao UI (Toast + Notification Bell) voi fallback role-aware, loading/empty/error state nhat quan. done - 2026-05-15 - by AI AGENT

### Phase 9.13: DX Hardening Ã¢Å“â€¦ COMPLETED
- [x] **Phase 9.13:** DX Hardening Ã¢â‚¬â€ `pnpm run setup` bootstrap (install + docker:up + setup:db + seed), `.nvmrc` node version pin, Prisma orchestration vao turbo pipeline. Ã¢Å“â€¦ Completed: Apr 27, 2026

### Phase UI: UI/UX Refactor Ã¢Å“â€¦ COMPLETED
- [x] **Phase UI-1:** SharedNavbar & Header Refactor Ã¢â‚¬â€ Gom Profile/Dashboard/Studio/Logout vao User Dropdown Menu, bo greeting text khoi navbar, di chuyen CTA "Dang ky GV" vao dropdown hoac banner, them NotificationBell vao mobile menu, responsive breakpoints chuan. Ã¢Å“â€¦ Completed: Apr 27, 2026
- [x] **Phase UI-2:** Design System Consolidation Ã¢â‚¬â€ Tao them CSS utility classes cho cac pattern lap lai (`.glass-card`, `.gradient-hero`, semantic color vars). Chuan hoa border-radius (chi dung `rounded-lg/xl/2xl`), icon sizes (`size-4/5/6`). Di chuyen tat ca hardcoded stats (500+, 150k, 12.000) ra constants hoac fetch tu API. Ã¢Å“â€¦ Completed: Apr 27, 2026
- [x] **Phase UI-3:** Component Decomposition Ã¢â‚¬â€ Tach `dashboard/page.tsx` (653 dong) thanh OverviewTab/MyCoursesTab/CertificatesTab/CommunityTab. Tao reusable `CourseCard`, `StatCard`, `EmptyState`. Tach components >300 dong. Ã¢Å“â€¦ Completed: Apr 27, 2026

### Phase C: Community Feature Ã¢Å“â€¦ COMPLETED
- [x] **Phase C-1:** Community Backend Ã¢â‚¬â€ Model CommunityGroup/CommunityMember/CommunityPost trong course_db. Auto-join via Kafka event `learning.enrollment.created`. API CRUD: listGroups, listPosts (cursor pagination), createPost/reply, joinGroup. Kong route `/community/*`. Ã¢Å“â€¦ Completed: Apr 27, 2026 (done - 2026-04-27 - by BINH)
- [x] **Phase C-2:** Community Frontend Ã¢â‚¬â€ `/dashboard/community` list nhom da tham gia, `/community/[groupId]` feed bai viet + form dang bai + reply, `/learn/[courseId]` sidebar tab "Thao luan" link toi community group. Thay the placeholder "Sap ra mat". Ã¢Å“â€¦ Completed: Apr 27, 2026 (done - 2026-04-27 - by BINH)
- [x] **Phase C-3:** Community Refactor Ã¢â‚¬â€ PhÃƒÂ¢n tÃƒÂ¡ch nhÃƒÂ³m Public (Admin quÃ¡ÂºÂ£n lÃƒÂ½) vÃƒÂ  Private (Instructor). BÃ¡Â»â€¢ sung trÃ†Â°Ã¡Â»Âng `username` auto-gen tÃ¡Â»Â« email Ã„â€˜Ã¡Â»Æ’ lÃƒÂ m Ã„â€˜Ã¡Â»â€¹nh danh duy nhÃ¡ÂºÂ¥t. CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t display name bÃ¡ÂºÂ±ng real data qua Internal API `/internal/users/batch`. CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t giao diÃ¡Â»â€¡n tiÃ¡ÂºÂ¿ng ViÃ¡Â»â€¡t cÃƒÂ³ dÃ¡ÂºÂ¥u. Ã¢Å“â€¦ Completed: 2026-04-28 (done - 2026-04-28 - by BINH) (Apr 28, 2026: community post/reply upload image truc tiep qua Cloudinary thay cho URL prompt)

### Phase AI: AI Features Ã¢ÂÂ³ PENDING
- [ ] **Phase AI-1:** AI Chatbot Production Ã¢â‚¬â€ AI Service (Express :3007), `ai_db` Neon schema, Kong route `/ai/*`, Redis rate limit (30 msg/user/giÃ¡Â»Â), Redis cache (course context 5 phÃƒÂºt, response 15 phÃƒÂºt), Gemini 2.0 Flash (primary) + Flash-Lite (fallback), SSE streaming. Conversation memory: full messages + semantic summary sau mÃ¡Â»â€”i 10 messages. Chat API: conversation CRUD, message SSE, cursor pagination, prompt injection detection, PII redaction. Frontend: ChatWidget + ChatPanel + useChat hook. Context loader: gÃ¡Â»Âi `GET /internal/courses/:id/full-context` tÃ¡Â»Â« Course Service. Plan chi tiÃ¡ÂºÂ¿t: `plan/ai_phase1_chatbot_production.md`. ~6 ngÃƒÂ y.
- [ ] **Phase AI-3:** AI Course Outline + Post Suggestions Ã¢â‚¬â€ Course Outline Generator: gÃ¡Â»Â£i ÃƒÂ½ chapters + lessons tÃ¡Â»Â« tiÃƒÂªu Ã„â€˜Ã¡Â»Â/mÃƒÂ´ tÃ¡ÂºÂ£/trÃƒÂ¬nh Ã„â€˜Ã¡Â»â„¢, cached 24h, chÃ¡Â»â€° dÃƒÂ nh cho Instructor. Post Suggestions: AI cÃ¡ÂºÂ£i thiÃ¡Â»â€¡n bÃƒÂ i community/Q&A (tiÃƒÂªu Ã„â€˜Ã¡Â»Â, format markdown, hashtag), cached 1h. CÃ¡ÂºÂ£ 2 tÃƒÂ­ch hÃ¡Â»Â£p trÃƒÂªn AI Service (Phase AI-1). Plan chi tiÃ¡ÂºÂ¿t: `plan/ai_phase3_outline_post_suggest.md`. ~3 ngÃƒÂ y.
- [ ] **Phase AI-4:** AI-Powered Semantic Search Ã¢â‚¬â€ NÃƒÂ¢ng cÃ¡ÂºÂ¥p search tÃ¡Â»Â« ILIKE thÃƒÂ nh hybrid search: keyword (30%) + semantic vector (70%) + RRF merge. pgvector extension trÃƒÂªn Neon course_db, Gemini text-embedding-004, embedding stored per course, seed script re-embed existing. Graceful fallback vÃ¡Â»Â ILIKE khi AI Service down. Plan chi tiÃ¡ÂºÂ¿t: `plan/ai_phase4_semantic_search.md`. ~4 ngÃƒÂ y.

---



## 6. Ghi ChÃƒÂº Quan TrÃ¡Â»Âng (Decisions & Assumptions)

### Architecture & Database
*   **Data Aggregation:** KhÃƒÂ´ng dÃƒÂ¹ng JOIN giÃ¡Â»Â¯a cÃƒÂ¡c DB. Frontend sÃ¡ÂºÂ½ gÃ¡Â»Âi song song cÃƒÂ¡c API (Auth, Course) vÃƒÂ  gÃ¡Â»â„¢p dÃ¡Â»Â¯ liÃ¡Â»â€¡u tÃ¡ÂºÂ¡i Server Actions.
*   **Prisma Singleton:** Implemented Global Variable pattern trong `packages/db-prisma` Ã„â€˜Ã¡Â»Æ’ ngÃ„Æ’n "too many connections" khi Next.js HMR reload code.
*   **Neon Cold Start:** Database sÃ¡ÂºÂ½ auto-pause sau 5 phÃƒÂºt idle. Request Ã„â€˜Ã¡ÂºÂ§u tiÃƒÂªn sau khi ngÃ¡Â»Â§ sÃ¡ÂºÂ½ chÃ¡ÂºÂ­m hÃ†Â¡n (~2-3s).
*   **Instructor Channel:** MÃ¡Â»â€”i instructor cÃƒÂ³ 1 `InstructorProfile` (slug unique, displayName, headline, bio, avatar, socialLinks). Public listing at `/instructors`.
*   **Revenue Share:** Instructor nhÃ¡ÂºÂ­n 70% mÃ¡Â»â€”i order thÃƒÂ nh cÃƒÂ´ng, platform giÃ¡Â»Â¯ 30%. SÃ¡Â»â€˜ % nÃƒÂ y lÃƒÂ  system config (admin cÃƒÂ³ thÃ¡Â»Æ’ thay Ã„â€˜Ã¡Â»â€¢i tÃ¡Â»Â« `/admin/settings`).
*   **Q&A vs Community:** Community la feed chung toan he thong cho user da dang nhap, khong con group/nhom/community theo khoa hoc. Q&A la kenh hoi dap rieng theo courseId: student phai enrolled, instructor chi quan tri khoa hoc cua minh, admin quan tri toan bo.
*   **Microservices Layout (Phase 35):** 7 services Ã¢â‚¬â€ auth (3101), course (3002), learning (3006), community (3007), payment (3003), media (3004), notification (3005). Learning vÃƒÂ  community tÃƒÂ¡ch ra khÃ¡Â»Âi course-service Ã„â€˜Ã¡Â»Æ’ Ã„â€˜Ã¡ÂºÂ£m bÃ¡ÂºÂ£o Single Responsibility Principle. InstructorRequest merge vÃƒÂ o auth-service. Kafka consumer cho enrollment chÃ¡ÂºÂ¡y tÃ¡ÂºÂ¡i learning-service thay vÃƒÂ¬ course-service.
*   **Internal API Pattern:** CÃƒÂ¡c service gÃ¡Â»Âi nhau qua `/internal/*` endpoints (khÃƒÂ´ng qua Kong Gateway), xÃƒÂ¡c thÃ¡Â»Â±c bÃ¡ÂºÂ±ng `x-internal-call: true` header. Course-service cung cÃ¡ÂºÂ¥p `/internal/courses/:id` vÃƒÂ  `/internal/lessons/:id`. Learning-service cung cÃ¡ÂºÂ¥p `/internal/enrollment/check` vÃƒÂ  `/internal/courses/:courseId/completion`.

### Environment & Validation
*   **T3 Env Pattern:** Package `env-validator` sÃ¡Â»Â­ dÃ¡Â»Â¥ng Zod Ã„â€˜Ã¡Â»Æ’ validate `.env` ngay lÃƒÂºc runtime. App sÃ¡ÂºÂ½ crash vÃ¡Â»â€ºi error message rÃƒÂµ rÃƒÂ ng nÃ¡ÂºÂ¿u thiÃ¡ÂºÂ¿u biÃ¡ÂºÂ¿n.
*   **Gateway Unification:** Ã„ÂÃƒÂ£ gÃ¡Â»Â¡ bÃ¡Â»Â hoÃƒÂ n toÃƒÂ n `api-gateway` (Node), chÃ¡Â»â€° sÃ¡Â»Â­ dÃ¡Â»Â¥ng Kong lÃƒÂ m API Gateway trung tÃƒÂ¢m. 
*   **Media Provider Strategy:** Cloudinary Free la provider mac dinh cho image/video URL, local storage la fallback cho local development; S3/VideoCipher khong con la huong uu tien.

### Frontend Conventions (Next.js App Router)
*   **Server Actions for API Calls:** All API calls from Next.js to Microservices are done via Server Actions (`actions/`) using the internal `GATEWAY_URL`.
*   **Client vs Server Components:** Limit `"use client"` as much as possible, mostly used for simple state hooks or highly interactive elements. Do not pass complex API functionality directly down tree.




### 2026-05-14 - Community Global Feed Refactor
- [x] Refactor `/community` thanh feed chung toan he thong, xoa legacy community group/member/group post schema, va chuyen Q&A thanh course-specific. done 2026-05-14


### 2026-05-15 - UI Hotfix Admin And Instructor Request
- [x] Restore become-instructor application form, clamp admin community feed limit to 50, and repair Vietnamese UI text in admin/become-instructor scope. done 2026-05-15

