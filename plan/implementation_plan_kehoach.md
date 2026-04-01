# LMS Microservices Platform — Finalized Roadmap Phase 9–20

## Quyết định đã xác nhận
1. ✅ **Gateway**: Giữ Kong, gỡ Node API Gateway (`apps/api-gateway`)
2. ✅ **Admin Dashboard**: Tạo riêng `apps/admin-dashboard` (Vite + React)
3. ✅ **Phase 9**: Chia nhỏ thành 9.1, 9.2, 9.3
4. ✅ **Email**: Nodemailer (dev) + Resend (prod)
5. ✅ **Rating/Review**: Thêm vào các phase phù hợp

---

## ROADMAP CHÍNH THỨC: PHASE 9–20

### Phase 9: Optimization & Technical Debt 🔧
> Chia nhỏ thành 3 sub-phase

#### Phase 9.1: Backend Cleanup & Gateway Unification
- [ ] **Gỡ `apps/api-gateway/`** — chỉ dùng Kong (Docker)
- [ ] Cập nhật `docker-compose.yml`, `kong.yml`, `turbo.json` cho phù hợp
- [ ] Cập nhật `project_structure.md` — gỡ Node gateway reference
- [ ] Prisma migration: thêm `sourceType` column vào `Lesson` model
- [ ] Prisma migration: thêm `category` field vào `Course` model
- [ ] Prisma migration: thêm `lastLoginAt` vào `User` model
- [ ] Fix `getCourseByIdAction` N+1 → thêm endpoint `GET /api/courses/:id` (by ID, ko by slug)
- [ ] Thêm graceful shutdown cho media-service
- [ ] Fix `NEXT_PUBLIC_GATEWAY_URL` → dùng `GATEWAY_URL` (server-only) trong server actions

#### Phase 9.2: Frontend Cleanup & Missing Features
- [ ] Tách `SharedNavbar` component (dùng chung cho Landing, Courses, Public pages)
- [ ] Tách `SharedFooter` component
- [ ] Tạo `/courses/[slug]` route riêng (Phase 8.5 — move detail/player logic ra page riêng)
- [ ] **Phase 7.5**: Edit/Delete chapter & lesson UI trên Instructor Curriculum
- [ ] Thêm `ErrorBoundary` component
- [ ] Thêm `loading.tsx` cho các route segments chính
- [ ] Tách instructor sidebar thành client component riêng, layout giữ server component
- [ ] Active link highlighting cho instructor sidebar
- [ ] Mobile responsive menu (hamburger)
- [ ] Landing page: fetch featured courses từ API thay vì hardcode

#### Phase 9.3: DX Improvements
- [ ] Tạo script `pnpm run setup` — 1 lệnh bootstrap toàn bộ (install → docker up → prisma migrate → seed)
- [ ] Thêm `turbo.json` pipeline cho `prisma:generate`, `prisma:migrate`
- [ ] Thêm `.nvmrc` (pin Node 18+)
- [ ] Cleanup: gỡ các file test thừa (`flow-result.json`, `.flow-test.mjs`, `port-check.txt`)
- [ ] Cập nhật `project_overview.md` roadmap chính thức
- [ ] Nâng cấp 2 agent files (`pipeline.agent.md` + `lms-ui-pipeline-agent.md`)

---

### Phase 10: Payment Service DB & Order Flow 💳
- [ ] **[NEW]** `services/payment-service/` (Express + Prisma + Zod)
- [ ] Prisma schema: `Order`, `Transaction`, `VNPayAudit` (JSONB)
- [ ] `payment_db` trên Neon Serverless
- [ ] Endpoints:
  - `POST /api/orders` — Tạo order (verify price từ Course Service API)
  - `GET /api/orders/:id` — Chi tiết order
  - `GET /api/orders/user` — Danh sách orders của user
- [ ] Order states: `PENDING → PAID → FAILED → REFUNDED`
- [ ] Kong config: thêm payment-service route
- [ ] Shared types: thêm payment-related types
- [ ] **Frontend**: Nút "Mua khóa học" trên `/courses/[slug]`, trang checkout cơ bản

---

### Phase 11: VNPay Integration 💰
- [ ] `POST /api/payment/vnpay/create-url` — Tạo VNPay payment URL
- [ ] `GET /api/payment/vnpay/ipn` — IPN Webhook handler (public, no auth)
- [ ] `GET /api/payment/vnpay/return` — Return URL handler
- [ ] Checksum validation (sort params alphabetically → HMAC-SHA512)
- [ ] Lưu raw VNPay response vào JSONB audit column
- [ ] Idempotent order update (prevent double payment)
- [ ] **Frontend**: Redirect sang VNPay sandbox, return page hiển thị kết quả
- [ ] Order history page cho user

---

### Phase 12: Kafka Producer (Payment Events) 📤
- [ ] Upgrade `@lms/kafka-client` package:
  - Typed event interfaces (`PaymentCompletedEvent`, `EnrollmentCreatedEvent`)
  - Retry logic với exponential backoff
  - DLQ support
  - Connection health check
- [ ] Payment Service → Kafka producer: topic `payment.order.completed`
- [ ] Event schema: `{ orderId, userId, courseId, amount, paidAt }`
- [ ] Dead Letter Queue handling

---

### Phase 13: Kafka Consumer (Enrollment) + Rating 📥
- [ ] Course Service → Kafka consumer: `payment.order.completed`
- [ ] Create `Enrollment` record (idempotent by `orderId` unique)
- [ ] Retry mechanism: `retry-5s` → `retry-1m` → `system.dead-letter`
- [ ] DLQ admin endpoint để xem/retry failed messages
- [ ] **Rating/Review model**:
  ```prisma
  model Review {
    id        String   @id @default(uuid())
    userId    String   @map("user_id")
    courseId   String   @map("course_id")
    rating    Int      // 1-5
    comment   String?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    @@unique([userId, courseId])
    @@index([courseId])
    @@map("reviews")
  }
  ```
- [ ] Endpoints: `POST /api/reviews`, `GET /api/courses/:id/reviews`
- [ ] Chỉ cho phép review khi đã enrolled
- [ ] **Frontend**: After payment → auto redirect learning page, "Khóa học của tôi" hiển thị enrolled courses

---

### Phase 14: Student Learning UI 📚
- [ ] **Layout**: `/learn/[courseId]` — Sidebar curriculum + Video player + Progress bar
- [ ] `LessonProgress` model:
  ```prisma
  model LessonProgress {
    id             String    @id @default(uuid())
    userId         String    @map("user_id")
    lessonId       String    @map("lesson_id")
    courseId        String    @map("course_id")
    isCompleted    Boolean   @default(false)
    watchedSeconds Int       @default(0)
    completedAt    DateTime?
    updatedAt      DateTime  @updatedAt
    @@unique([userId, lessonId])
    @@index([userId, courseId])
    @@map("lesson_progress")
  }
  ```
- [ ] Endpoints:
  - `POST /api/progress/:lessonId` — Update watch progress
  - `GET /api/progress/course/:courseId` — Get course progress
  - `POST /api/progress/:lessonId/complete` — Mark completed
- [ ] Video player (YouTube iframe + HTML5 `<video>`)
- [ ] Sidebar curriculum với ✓ completed indicators
- [ ] Auto-track watch time (heartbeat mỗi 30s)
- [ ] Next/Prev lesson navigation
- [ ] **Review UI**: Form đánh giá + hiển thị reviews trên course detail
- [ ] Average rating badge trên course cards

---

### Phase 15: Notification Service 📧
- [ ] **[NEW]** `services/notification-service/` (Express + Prisma + Kafka consumer)
- [ ] `notification_db` trên Neon
- [ ] Prisma schema: `NotificationLog`, `EmailQueue`
- [ ] Kafka consumer topics:
  - `payment.order.completed` → Email xác nhận đơn hàng
  - `enrollment.created` → Email chào mừng khóa học
  - `course.published` → (future) thông báo khóa học mới cho followers
- [ ] Email: **Nodemailer** (dev/local, dùng Ethereal fake SMTP) + **Resend** (prod)
- [ ] Email templates: Handlebars/EJS
- [ ] Kong config: thêm notification-service route
- [ ] **Frontend**: Notification bell icon, dropdown list, in-app toast

---

### Phase 16: Student Dashboard & My Courses 🏠
- [ ] **Layout**: `/dashboard` — Welcome banner + Stats cards + Continue learning + Recommended
- [ ] Backend:
  - `GET /api/enrollments/my-courses` — Enrolled courses với progress %
  - `GET /api/dashboard/stats` — Aggregated statistics (hours, completed, certs, streak)
- [ ] **Frontend**:
  - Student dashboard (real data, replace mock dashboard.ts)
  - "Khoá học của tôi" page (`/my-courses`)
  - Course progress cards
  - "Tiếp tục học" quick access buttons
  - Learning streak counter

---

### Phase 17: Search, Filter & Category System 🔍
- [ ] `Category` model + `CourseCategory` join table (many-to-many)
- [ ] Full-text search: `GET /api/courses/search?q=...&category=...&level=...&priceMin=...&priceMax=...`
- [ ] PostgreSQL `tsvector` + `tsquery` (Vietnamese full-text)
- [ ] Sort options: newest, popular (enrollments), rating, price
- [ ] **Frontend**:
  - Search bar functional (debounced API call)
  - Filter sidebar/drawer (category, level, price range slider)
  - Sort dropdown
  - Pagination hoặc infinite scroll
  - Search results page `/courses/search`

---

### Phase 18: Instructor Analytics Dashboard 📊
- [ ] **Layout**: `/instructor/analytics` — Revenue chart + Stats cards + Top courses table
- [ ] Backend:
  - `GET /api/instructor/analytics` — Revenue, enrollment count, avg rating
  - `GET /api/instructor/analytics/revenue?period=monthly|weekly`
  - Aggregate queries: enrollments × payment amounts
- [ ] **Frontend**:
  - Chart: Recharts hoặc Chart.js (revenue over time)
  - KPI cards (total revenue, total students, avg rating, this month)
  - Top performing courses table
  - Student enrollment trends graph

---

### Phase 19: Admin Dashboard 🛡️
- [ ] **[NEW]** `apps/admin-dashboard/` (Vite + React + TanStack Router)
- [ ] Separate SPA, gọi API qua Kong Gateway
- [ ] **Layout**: Sidebar + Content area
- [ ] Pages:
  - Dashboard overview (system stats)
  - User management (list, search, ban/unban, change role)
  - Course moderation (approve/reject pending courses)
  - Order management (list, refund)
  - Review moderation (approve/reject/hide reviews)
  - DLQ monitor (failed Kafka messages)
  - System health (services status)
- [ ] Backend endpoints:
  - `GET/PUT /api/admin/users/:id` — User CRUD
  - `GET/PUT /api/admin/courses/:id/approve` — Course moderation
  - `GET /api/admin/orders` — Order list
  - `GET /api/admin/reviews` — Review moderation
  - `GET /api/admin/dlq` — Dead Letter Queue viewer
- [ ] Kong config: admin routes require `admin` role

---

### Phase 20: Deployment & Production Hardening 🚀
- [ ] **Dockerfiles** cho từng service (multi-stage: build → slim runtime)
- [ ] `docker-compose.prod.yml` — full orchestration
- [ ] Environment management: `.env.staging`, `.env.production`
- [ ] **Security hardening**:
  - CORS production whitelist (no `*`)
  - Rate limiting tăng cho production
  - CSP headers cho Next.js
  - Audit log table (JSONB) cho admin actions
- [ ] **Next.js production**:
  - Standalone output mode
  - SEO meta tags toàn bộ public pages
  - Image optimization + code splitting
  - Sitemap + robots.txt
- [ ] **CI/CD** (GitHub Actions):
  - Pipeline: Lint → Type check → Test → Build → Docker push → Deploy
  - Separate staging/production workflows
- [ ] Docker registry (ghcr.io)
- [ ] Nginx reverse proxy + SSL (Let's Encrypt)
- [ ] Health check monitoring dashboard
- [ ] Neon database backup strategy
- [ ] README.md final update — deployment guide

---

## AGENT UPGRADES (Phase 9.3)

### pipeline.agent.md — Nội dung nâng cấp
- Thêm STEP 0.5: Dependency Check (shared packages built? Docker up?)
- Thêm STEP 1.5: Schema Validation (Prisma migration pending?)
- Code Patterns: Controller structure, Error handling, Middleware, ApiResponse
- Testing Checklist: happy path + validation + auth + not found + forbidden
- Performance Rules: No N+1, use $transaction, use select
- Security Rules: Zod validate, rate limit sensitive, audit admin actions
- Kafka Rules: Event schema, idempotency, DLQ handling

### lms-ui-pipeline-agent.md — Nội dung nâng cấp
- Thêm STEP 0C: Route Planning (App Router placement, layout wrapping)
- STEP 1 mở rộng: Component Audit (reuse existing vs create new)
- Layout Spec bắt buộc: breakpoints, mobile/desktop layout, sidebar spec
- Server Action Conventions: callApi wrapper, error format
- State Management Rules: Server vs Client component decision tree
- Accessibility mở rộng: keyboard nav, screen reader, contrast, focus
- Performance: next/image, dynamic imports, Suspense, loading.tsx

---

## Timeline tổng quan

| Phase | Tên | Ưu tiên |
|---|---|---|
| **9.1** | Backend Cleanup & Gateway | 🔴 |
| **9.2** | Frontend Cleanup & Missing Features | 🔴 |
| **9.3** | DX Improvements + Agent Upgrades | 🟡 |
| **10** | Payment Service DB & Orders | 🔴 |
| **11** | VNPay Integration | 🔴 |
| **12** | Kafka Producer | 🔴 |
| **13** | Kafka Consumer + Rating | 🔴 |
| **14** | Student Learning UI + Review UI | 🟡 |
| **15** | Notification Service | 🟡 |
| **16** | Student Dashboard | 🟡 |
| **17** | Search & Filter | 🟢 |
| **18** | Instructor Analytics | 🟢 |
| **19** | Admin Dashboard (Vite app) | 🟢 |
| **20** | Deployment & Production | 🔴 (cuối) |
