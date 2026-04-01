# LMS Microservices Platform — Full Audit & Roadmap

## Mục tiêu
1. Kiểm tra toàn bộ 8 Phase đã hoàn thành → đề xuất tối ưu
2. Lập kế hoạch Phase 9–20 chi tiết (ưu tiên local-first, deploy cuối)
3. Nâng cấp 2 agent (pipeline.agent.md + lms-ui-pipeline-agent.md)

---

## PHẦN A: AUDIT 8 PHASE ĐÃ HOÀN THÀNH

### Phase 1: Monorepo Setup ✅
**Đánh giá: 8/10 — Tốt**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Turborepo monorepo | ✅ OK | `turbo.json` cấu hình đúng |
| pnpm workspaces | ✅ OK | `pnpm-workspace.yaml` khai báo apps/services/packages |
| Docker Compose (Kafka, Redis, Kong) | ✅ OK | Healthcheck đầy đủ |
| Neon Serverless PostgreSQL | ✅ OK | Tiết kiệm RAM local |

> [!TIP]
> **Đề xuất tối ưu:**
> - Thêm `turbo.json` pipeline cho `prisma:generate` và `prisma:migrate` để chạy tự động trước `dev`
> - Thêm script `pnpm run setup` 1 lệnh bootstrap toàn bộ project (install → docker up → prisma migrate → seed)
> - Thêm `.nvmrc` hoặc `volta` pin Node version

---

### Phase 2: API Gateway & Shared Packages ✅
**Đánh giá: 7/10 — Cần cải thiện**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Kong Gateway (DB-less) | ✅ OK | `kong.yml` declarative config |
| Node API Gateway (proxy) | ⚠️ DUỆ SONG | Có cả Kong (Docker) VÀ Node Gateway — dư thừa |
| Shared logger (@lms/logger) | ✅ OK | Pino-based |
| Shared types (@lms/types) | ✅ OK | `ApiResponse<T>` chuẩn |
| Env validator (@lms/env-validator) | ✅ OK | Zod-based |

> [!WARNING]
> **Vấn đề nghiêm trọng:**
> 1. **Duplicate Gateway**: Dự án có KÉP gateway — Kong (Docker) VÀ `apps/api-gateway` (Node proxy). Cần chọn 1 và loại bỏ cái còn lại. Hiện web-client gọi qua `localhost:8000` (Kong) nhưng Kong route đến services. Node gateway ở port 3100 có vẻ không được sử dụng thực tế.
> 2. **Gateway proxy code lặp**: `apps/api-gateway/src/index.ts` có 5 block `createProxyMiddleware` gần giống nhau → nên dùng factory function.
> 3. **`(req as any).user`**: Type assertion unsafe trong gateway middleware.

> [!TIP]
> **Đề xuất tối ưu (gộp vào Phase 9.5):**
> - Xác định chính thức: dùng Kong HOẶC Node gateway. Nếu Kong → gỡ `apps/api-gateway`. Nếu Node → gỡ Kong khỏi docker-compose.
> - Tạo factory `createServiceProxy(serviceName, targetUrl)` để DRY.
> - Thêm request/response logging middleware tại gateway.

---

### Phase 3: Auth Service ✅
**Đánh giá: 8.5/10 — Tốt**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Register (bcrypt + Zod) | ✅ OK | Salt rounds 10 |
| Login (JWT pair) | ✅ OK | Access 15min + Refresh 7d |
| Refresh token rotation | ✅ OK | DB + Redis session |
| Logout (clear session) | ✅ OK | Redis + DB cleanup |
| Graceful shutdown | ✅ OK | SIGINT + SIGTERM |

> [!TIP]
> **Đề xuất tối ưu:**
> - **Thiếu cleanup job**: Refresh tokens hết hạn vẫn tồn tại trong DB → cần cron job hoặc Prisma scheduled task.
> - **Thiếu brute-force protection**: Không có rate limit riêng cho `/login` endpoint (chỉ có global rate limit ở Kong 100/min).
> - **Thiếu `sourceType` column cho Lesson**: Lesson model dùng `inferSourceType(videoUrl)` runtime thay vì lưu vào DB → thiếu single source of truth.
> - Nên thêm `lastLoginAt` field vào User model cho audit.

---

### Phase 4: Frontend Base (Next.js + Shadcn + Redux) ✅
**Đánh giá: 7.5/10 — Khá, cần refactor**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Next.js 15 App Router | ✅ OK | Đúng cấu trúc |
| Shadcn UI components | ✅ OK | Button, Card, Input, Form, Label |
| Redux Toolkit (auth) | ✅ OK | `authSlice` + StoreProvider |
| Auth session bootstrap | ✅ OK | Cookie-based, auto refresh |
| Be Vietnam Pro font | ✅ OK | Vietnamese typography |
| Glassmorphism design | ✅ OK | `glass-panel`, `glass-page` |

> [!WARNING]
> **Vấn đề cần sửa:**
> 1. **`NEXT_PUBLIC_GATEWAY_URL` dùng trong server action**: Biến `NEXT_PUBLIC_*` bị expose ra client. Server actions nên dùng biến không có prefix `NEXT_PUBLIC_`.
> 2. **Header duplicate**: Landing page (`page.tsx`) và Courses page (`courses/page.tsx`) COPY PASTE header navbar → cần tách thành shared component.
> 3. **Landing page featured courses hardcode**: Dùng mock data thay vì API → nên fetch real data hoặc tách thành component riêng.
> 4. **Thiếu ErrorBoundary**: Không có React Error Boundary cho toàn app.
> 5. **Thiếu Loading UI**: Chưa có `loading.tsx` cho route segments.

---

### Phase 5: Course Service DB & CRUD ✅
**Đánh giá: 8.5/10 — Tốt**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Prisma schema (Course, Chapter, Lesson, Enrollment) | ✅ OK | Designed for Kafka Phase 12 |
| CRUD + Zod validation | ✅ OK | Robust |
| Publish validation | ✅ OK | Require thumbnail + chapters + lessons + video |
| Slug generation | ✅ OK | Unique slug with collision handling |
| Pagination | ✅ OK | Page + limit with bounds |
| Ownership check | ✅ OK | Admin bypass supported |

> [!TIP]
> **Đề xuất tối ưu:**
> - **`totalLessons` denormalization risk**: Dùng `increment/decrement` nhưng nếu delete/create fail giữa chừng → desync. Nên dùng `count()` aggregate + cron sync.
> - **Thiếu `sourceType` column trong Lesson**: Hiện dùng `inferSourceType()` runtime → nên thêm column vào schema.
> - Thiếu `category` / `tags` cho course → cần cho filter/search ở frontend.
> - `getCourseByIdAction` ở frontend gọi `getInstructorCoursesAction()` rồi filter client-side → **N+1 anti-pattern**, nên gọi API trực tiếp.

---

### Phase 6: Media Service ✅
**Đánh giá: 8/10 — Tốt**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Presigned upload flow | ✅ OK | Local + S3-ready |
| External media (YouTube) | ✅ OK | URL validation |
| Upload confirmation | ✅ OK | PENDING → UPLOADED lifecycle |
| Local storage provider | ✅ OK | Dev-friendly |
| MIME type validation | ✅ OK | Per media type |
| File size limit (100MB) | ✅ OK | Multer + Zod |

> [!TIP]
> **Đề xuất tối ưu:**
> - **Thiếu cleanup expired PENDING**: MediaAsset PENDING quá 24h không confirm → nên có scheduled cleanup.
> - **Thiếu thumbnail generation**: Upload video nhưng không auto-generate thumbnail.
> - Media service không có graceful shutdown handler (so với auth-service có).

---

### Phase 7: Frontend Instructor UI ✅ (7.1–7.7 done, 7.5 pending)
**Đánh giá: 7/10 — Cần bổ sung**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Protected instructor layout | ✅ OK | Role guard + sidebar |
| Course list (real data) | ✅ OK | API integrated |
| Create course form | ✅ OK | Tạo + redirect |
| Curriculum editor | ✅ OK | Chapter + lesson CRUD |
| Video upload (presigned) | ✅ OK | Local + S3 ready |
| YouTube URL attach | ✅ OK | Validation + playback |
| Publish validation UI | ✅ OK | Thumbnail + content check |
| Session bootstrap | ✅ OK | Cookie/refresh recovery |
| Edit/Delete chapter/lesson UI | ❌ Missing | Phase 7.5 chưa hoàn thành |

> [!WARNING]
> **Vấn đề:**
> 1. **Phase 7.5 chưa làm**: Edit/delete chapter & lesson trên UI chưa có.
> 2. **Instructor layout dùng `'use client'` cho toàn bộ layout**: Nên tách sidebar thành client component riêng, giữ layout là server component.
> 3. **Thiếu active link highlight**: Sidebar nav links không có active state indicator.
> 4. **Mobile responsive**: Sidebar `hidden md:flex` → mobile không có navigation.

---

### Phase 8: Frontend Public UI ✅ (8.1–8.4 done, 8.5 pending)
**Đánh giá: 7.5/10 — Khá tốt, cần tách route**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Landing page (glassmorphism) | ✅ OK | Đẹp, animations |
| Course listing (real API) | ✅ OK | Paginated |
| Course detail + free preview | ✅ OK | YouTube + local video |
| Playback endpoint (enrollment check) | ✅ OK | FREE/PAID logic |
| Trang chi tiết tách route | ❌ Missing | 8.5 chưa làm |

> [!WARNING]
> **Vấn đề:**
> 1. **Phase 8.5**: Course detail hiện tại là inline section trong `/courses` page → cần tách thành `/courses/[slug]` route riêng.
> 2. **Courses page quá dài (397 dòng)**: Chứa cả list + detail + video player → vi phạm Single Responsibility.
> 3. **Search/Filter chưa hoạt động**: UI buttons có nhưng chức năng chưa implement.
> 4. **`_count.enrollments` trả về 0**: Enrollment chưa có data (chờ Phase 12).

---

## PHẦN B: TỔNG HỢP TỐI ƯU CẦN LÀM

> [!IMPORTANT]
> Các tối ưu dưới đây sẽ được gộp vào **Phase 9** (Optimization & Debt) trước khi tiến tới Payment Service.

### Backend Optimization
- [ ] Chọn 1 gateway (Kong hoặc Node) → loại bỏ cái dư
- [ ] Thêm `sourceType` column vào `Lesson` model (Prisma migration)
- [ ] Thêm cleanup job cho expired refresh tokens
- [ ] Thêm cleanup job cho expired PENDING media assets
- [ ] Fix `getCourseByIdAction` N+1 → gọi API by ID trực tiếp
- [ ] Thêm `lastLoginAt` cho User model
- [ ] Thêm `category` cho Course model (prep for search/filter)
- [ ] Gateway proxy factory function (DRY)
- [ ] Graceful shutdown cho media-service
- [ ] `totalLessons`/`totalDuration` periodic sync job

### Frontend Optimization
- [ ] Tách shared Navbar component (Landing + Courses + Public pages)
- [ ] Tách `/courses/[slug]` route riêng (Phase 8.5)
- [ ] Hoàn thành Phase 7.5: Edit/Delete chapter & lesson UI
- [ ] Thêm ErrorBoundary + `loading.tsx` cho route segments
- [ ] Fix `NEXT_PUBLIC_GATEWAY_URL` → dùng server-only env var cho server actions
- [ ] Tách instructor sidebar thành client component riêng
- [ ] Add active link highlighting cho instructor sidebar
- [ ] Mobile responsive menu (hamburger menu)
- [ ] Landing page: fetch featured courses từ API thay vì hardcode

---

## PHẦN C: ROADMAP PHASE 9–20

### Phase 9: Optimization & Technical Debt 🔧
**Mục tiêu**: Sửa tất cả vấn đề từ audit + hoàn thành 7.5 & 8.5

#### 9.1 Backend Cleanup
- Chọn và chuẩn hóa gateway (khuyến nghị giữ Kong, gỡ Node gateway)
- Prisma migration: thêm `sourceType`, `category`, `lastLoginAt`
- Tạo cleanup cron cho refresh tokens + pending media
- Fix N+1 `getCourseByIdAction`
- factory function cho gateway proxy (nếu giữ Node)

#### 9.2 Frontend Cleanup
- Tách SharedNavbar component
- Tạo `/courses/[slug]` route (move detail logic)
- Phase 7.5: Edit/Delete UI cho chapter & lesson
- ErrorBoundary + loading.tsx
- Fix env var naming
- Mobile responsive menu

#### 9.3 DX Improvements
- `pnpm run setup` one-command bootstrap
- `turbo.json` pipeline cho prisma tasks
- `.nvmrc` pin Node 18+

---

### Phase 10: Payment Service DB & Order Flow 💳
**Mục tiêu**: Xây dựng Payment Service với database, order CRUD

#### Backend
- **[NEW]** `services/payment-service/`
  - Prisma schema: `Order`, `Transaction`, `VNPayAudit` (JSONB)
  - Endpoints: `POST /api/orders` (create order), `GET /api/orders/:id`, `GET /api/orders/user` (list user orders)
  - Order states: `PENDING → PAID → FAILED → REFUNDED`
  - **Price verification**: Gọi Course Service API để verify price trước khi tạo order
  - Zod validation cho tất cả input

#### Frontend
- Trang "Thanh toán" cơ bản (hiển thị order summary)
- Nút "Mua khóa học" trên course detail page

---

### Phase 11: VNPay Integration 💰
**Mục tiêu**: Tích hợp thanh toán VNPay

#### Backend
- `POST /api/payment/vnpay/create-url` — Tạo VNPay payment URL
- `GET /api/payment/vnpay/ipn` — IPN Webhook handler
- `GET /api/payment/vnpay/return` — Return URL handler
- Checksum validation (sort params alphabetically)
- Lưu raw VNPay response vào JSONB audit column
- Idempotent order update (prevent double payment)

#### Frontend
- Redirect user sang VNPay sandbox
- Return page: hiển thị kết quả thanh toán
- Order history page

---

### Phase 12: Kafka Producer (Payment Events) 📤
**Mục tiêu**: Payment Service publish event khi order completed

#### Backend
- Upgrade `@lms/kafka-client` package:
  - Thêm typed event interfaces
  - Thêm retry logic
  - Thêm DLQ support
- Payment Service → Kafka producer: `payment.order.completed`
- Event schema: `{ orderId, userId, courseId, amount, paidAt }`

---

### Phase 13: Kafka Consumer (Enrollment) 📥
**Mục tiêu**: Course Service consume payment events → create enrollment

#### Backend
- Course Service → Kafka consumer: `payment.order.completed`
- Create `Enrollment` record (idempotent by orderId unique)
- Retry mechanism: `retry-5s` → `retry-1m` → `system.dead-letter`
- DLQ handler/admin endpoint

#### Frontend
- After payment success → auto redirect đến learning page
- "Khóa học của tôi" section hiển thị enrolled courses

---

### Phase 14: Student Learning UI 📚
**Mục tiêu**: Giao diện học tập chính cho học viên

#### Layout Web: Learning Page (`/learn/[courseId]`)
```
┌─────────────────────────────────────────────────────────┐
│  Navbar (compact)                                        │
├──────────────────────┬──────────────────────────────────┤
│                      │                                   │
│  Sidebar             │  Video Player Area                │
│  ┌────────────────┐  │  ┌───────────────────────────┐   │
│  │ Chapter 1      │  │  │                           │   │
│  │  • Lesson 1 ✓  │  │  │     YouTube / HTML5       │   │
│  │  • Lesson 2 ▶  │  │  │     Video Player          │   │
│  │  • Lesson 3    │  │  │                           │   │
│  ├────────────────┤  │  └───────────────────────────┘   │
│  │ Chapter 2      │  │                                   │
│  │  • Lesson 4    │  │  Lesson Title                     │
│  │  • Lesson 5    │  │  Description / Notes              │
│  └────────────────┘  │                                   │
│                      │  ┌──────────┐ ┌─────────┐        │
│  Progress: 40%       │  │  Prev    │ │  Next   │        │
│  ████████░░░░░░      │  └──────────┘ └─────────┘        │
│                      │                                   │
└──────────────────────┴──────────────────────────────────┘
```

#### Backend
- **[NEW]** `LessonProgress` model in course_db:
  ```prisma
  model LessonProgress {
    id         String   @id @default(uuid())
    userId     String   @map("user_id")
    lessonId   String   @map("lesson_id")
    courseId    String   @map("course_id")
    isCompleted Boolean @default(false)
    watchedSeconds Int  @default(0)
    completedAt DateTime?
    updatedAt  DateTime @updatedAt
    @@unique([userId, lessonId])
  }
  ```
- Endpoints:
  - `POST /api/progress/:lessonId` — Update watch progress
  - `GET /api/progress/course/:courseId` — Get course progress
  - `POST /api/progress/:lessonId/complete` — Mark completed

#### Frontend
- Video player component (YouTube iframe + HTML5 `<video>`)
- Sidebar curriculum với progress indicators
- Auto-track watch time (heartbeat mỗi 30s)
- Next/Prev lesson navigation
- Course completion certificate (simple)

---

### Phase 15: Notification Service 📧
**Mục tiêu**: Email notification via Kafka events

#### Backend
- **[NEW]** `services/notification-service/`
  - Prisma schema: `NotificationLog`, `EmailQueue`
  - Kafka consumer: listen to multiple topics
    - `payment.order.completed` → Email xác nhận đơn hàng
    - `enrollment.created` → Email chào mừng khóa học
    - `course.published` → Email thông báo khóa học mới
  - Email provider: Nodemailer (dev) / Resend (prod)
  - Template engine: Handlebars/EJS

#### Frontend
- Notification bell icon trên navbar
- Notification dropdown list
- In-app notification (toast)

---

### Phase 16: Student Dashboard & My Courses 🏠
**Mục tiêu**: Trang dashboard chính cho học viên

#### Layout Web: Student Dashboard (`/dashboard`)
```
┌───────────────────────────────────────────────────────────┐
│  Navbar (authenticated)           [Bell] [Avatar] [Menu]  │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Welcome back, [Name]!                                    │
│                                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Courses │ │  Hours  │ │ Certs   │ │ Streak  │       │
│  │    5    │ │   42    │ │    3    │ │  12d    │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                           │
│  Continue Learning                                        │
│  ┌──────────────────┐ ┌──────────────────┐               │
│  │ Course A         │ │ Course B         │               │
│  │ Progress: 65%    │ │ Progress: 30%    │               │
│  │ [Continue →]     │ │ [Continue →]     │               │
│  └──────────────────┘ └──────────────────┘               │
│                                                           │
│  Recommended Courses                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ Card     │ │ Card     │ │ Card     │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

#### Backend
- `GET /api/enrollments/my-courses` — List enrolled courses with progress
- `GET /api/dashboard/stats` — Aggregated statistics

#### Frontend
- Student dashboard page (real data)
- "Khoá học của tôi" page
- Course progress cards
- "Tiếp tục học" quick access

---

### Phase 17: Search, Filter & Category System 🔍
**Mục tiêu**: Tìm kiếm và lọc khóa học

#### Backend
- Thêm `Category` model + course-category relation
- Full-text search endpoint: `GET /api/courses/search?q=...&category=...&level=...&price_min=...&price_max=...`
- PostgreSQL `tsvector` + `tsquery` cho Vietnamese search
- Sort by: newest, popular, rating, price

#### Frontend
- Search bar functional (debounced)
- Filter sidebar (category, level, price range)
- Sort dropdown
- Infinite scroll / pagination

---

### Phase 18: Instructor Analytics Dashboard 📊
**Mục tiêu**: Dashboard phân tích cho giảng viên

#### Layout Web: Instructor Analytics (`/instructor/analytics`)
```
┌──────────────────────────────────────────────────────────┐
│  Studio Sidebar  │  Analytics Dashboard                   │
│                  │                                         │
│                  │  ┌──────────┐ ┌──────────┐            │
│                  │  │ Revenue  │ │ Students │            │
│                  │  │ 5.2M VND │ │    340   │            │
│                  │  └──────────┘ └──────────┘            │
│                  │                                         │
│                  │  ┌───────────────────────────────┐     │
│                  │  │  Revenue Chart (Line/Bar)     │     │
│                  │  │  [Monthly view]                │     │
│                  │  └───────────────────────────────┘     │
│                  │                                         │
│                  │  Top Courses Table                      │
│                  │  ┌─────┬──────┬────────┬────────┐     │
│                  │  │Name │Views │Revenue │Rating  │     │
│                  │  └─────┴──────┴────────┴────────┘     │
│                  │                                         │
└──────────────────┴────────────────────────────────────────┘
```

#### Backend
- `GET /api/instructor/analytics` — Revenue, enrollment count, ratings
- `GET /api/instructor/analytics/revenue?period=monthly`
- Aggregate queries on enrollment + payment data

#### Frontend
- Chart library (Recharts or Chart.js)
- Revenue overview cards
- Top performing courses table
- Student enrollment trends

---

### Phase 19: Admin Dashboard & Review System 🛡️
**Mục tiêu**: Admin quản lý hệ thống + Course review/rating

#### Layout Web: Admin Dashboard (`/admin`)
```
┌──────────────────────────────────────────────────────────┐
│  Admin Sidebar   │  System Overview                       │
│  ┌────────────┐  │                                        │
│  │ Dashboard  │  │  Stats Cards                           │
│  │ Users      │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ Courses    │  │  │Users│ │Crses│ │Revnue│ │Ordrs│   │
│  │ Orders     │  │  └─────┘ └─────┘ └─────┘ └─────┘   │
│  │ Reports    │  │                                        │
│  │ Settings   │  │  User Management Table                 │
│  └────────────┘  │  ┌──────┬──────┬──────┬──────────┐   │
│                  │  │Email │Role  │Status│Actions    │   │
│                  │  └──────┴──────┴──────┴──────────┘   │
│                  │                                        │
│                  │  Course Moderation Queue                │
│                  │  ┌──────┬──────┬──────┬──────────┐   │
│                  │  │Title │Instr │Status│Approve   │   │
│                  │  └──────┴──────┴──────┴──────────┘   │
│                  │                                        │
└──────────────────┴────────────────────────────────────────┘
```

#### Backend
- Admin endpoints: list/ban users, approve/reject courses
- Course review/rating model:
  ```prisma
  model Review {
    id        String @id @default(uuid())
    userId    String
    courseId   String
    rating    Int    // 1-5
    comment   String?
    createdAt DateTime @default(now())
    @@unique([userId, courseId])
  }
  ```
- `GET /api/admin/users`, `PUT /api/admin/users/:id/role`
- `GET /api/admin/courses/pending`, `PUT /api/admin/courses/:id/approve`

#### Frontend
- **[NEW]** `apps/admin-dashboard` (có thể dùng Vite + React hoặc route group trong web-client)
- User management CRUD
- Course moderation workflow
- System-wide statistics
- Course review listing & moderation

---

### Phase 20: Deployment & Production Hardening 🚀
**Mục tiêu**: Dockerize toàn bộ + deploy

#### Backend
- Dockerfile cho từng service (multi-stage build)
- `docker-compose.prod.yml` cho production
- Environment management (staging/production)
- Health check endpoints chuẩn hóa
- CORS production whitelist
- Rate limiting production config
- Audit log table (JSONB)

#### Frontend
- Next.js production build + standalone mode
- SEO meta tags cho tất cả public pages
- Performance: Image optimization, code splitting
- CSP headers

#### DevOps
- CI/CD pipeline (GitHub Actions)
  - Lint → Test → Build → Deploy
- Docker registry (ghcr.io hoặc Docker Hub)
- Nginx reverse proxy cho production
- SSL certificates (Let's Encrypt)
- Monitoring: health check dashboard
- Backup strategy cho Neon databases

---

## PHẦN D: NÂNG CẤP AGENTS

### D.1: pipeline.agent.md — Logic Pipeline Agent

Cần nâng cấp từ 43 dòng hiện tại lên agent toàn diện hơn:

**Thêm mới:**
1. **STEP 0.5 - DEPENDENCY CHECK**: Trước khi code, kiểm tra shared packages đã build chưa, Docker services đã chạy chưa.
2. **STEP 1.5 - SCHEMA VALIDATION**: Validate Prisma schema trước khi code (kiểm tra migration pending).
3. **CODE PATTERNS**: Define explicit patterns cho:
   - Controller structure (Zod validate → business logic → Prisma → response)
   - Error handling (try/catch → handlePrismaError)
   - Middleware composition (`requireRole` spread pattern)
   - API response format (luôn dùng `ApiResponse<T>`)
4. **TESTING CHECKLIST**: Bắt buộc test scenarios:
   - Happy path + validation error + auth error + not found + forbidden
5. **PERFORMANCE RULES**:
   - No N+1 queries
   - Use `$transaction` for multiple writes
   - Use `select` thay vì full object khi không cần
6. **SECURITY RULES mở rộng**:
   - Never trust client input (always Zod validate)
   - Rate limit sensitive endpoints
   - Audit logging cho admin actions

### D.2: lms-ui-pipeline-agent.md — UI Pipeline Agent

Cần nâng cấp từ 124 dòng hiện tại:

**Thêm mới:**
1. **STEP 0C - ROUTE PLANNING**: Trước khi code UI, xác định:
   - Route sẽ đặt ở đâu trong App Router
   - Layout nào wrap route này
   - Có cần route group `(group)` không
2. **STEP 1 mở rộng - COMPONENT AUDIT**:
   - Kiểm tra component nào đã tồn tại có thể reuse
   - Định nghĩa rõ: tái sử dụng existing VS tạo mới
   - Liệt kê exact Shadcn components sẽ install (nếu chưa có)
3. **LAYOUT SPEC**: Cho mỗi page mới, phải tạo:
   ```
   ## Layout Specification
   - Breakpoints: mobile (< 768) / tablet (768-1024) / desktop (> 1024)
   - Mobile layout: [mô tả]
   - Desktop layout: [mô tả với grid cols]
   - Có sidebar không: [yes/no, width, collapsible?]
   ```
4. **SERVER ACTION CONVENTIONS**:
   - File đặt tại `app/actions/[domain].ts`
   - Helper `callApi<T>()` wrapper cho mọi gateway call
   - Error handling: phải trả `{ success, message, data }` consistent
5. **STATE MANAGEMENT RULES**:
   - Server Component by default
   - Client Component chỉ khi có: `useState`, `useEffect`, `onClick`, `onChange`
   - Redux chỉ cho global state (auth). Local state dùng React state.
6. **ACCESSIBILITY CHECKLIST mở rộng**:
   - Keyboard navigation (tab order)
   - Screen reader labels (aria-label)
   - Color contrast (WCAG AA)
   - Focus indicators
7. **PERFORMANCE RULES**:
   - Image: luôn dùng `next/image` với `width/height`
   - Dynamic imports cho heavy components
   - `Suspense` + `loading.tsx` cho async routes

---

## PHẦN E: TỔNG QUAN TIMELINE

| Phase | Tên | Ưu tiên | Loại |
|---|---|---|---|
| **9** | Optimization & Technical Debt | 🔴 Cao | Refactor |
| **10** | Payment Service DB & Orders | 🔴 Cao | Backend |
| **11** | VNPay Integration | 🔴 Cao | Backend |
| **12** | Kafka Producer (Payment Events) | 🔴 Cao | Backend |
| **13** | Kafka Consumer (Enrollment) | 🔴 Cao | Backend + Frontend |
| **14** | Student Learning UI | 🟡 Trung bình | Frontend + Backend |
| **15** | Notification Service | 🟡 Trung bình | Backend |
| **16** | Student Dashboard & My Courses | 🟡 Trung bình | Frontend |
| **17** | Search, Filter & Categories | 🟢 Thấp | Full-stack |
| **18** | Instructor Analytics | 🟢 Thấp | Full-stack |
| **19** | Admin Dashboard & Reviews | 🟢 Thấp | Full-stack |
| **20** | Deployment & Production | 🔴 Cao (cuối) | DevOps |

---

## Open Questions

> [!IMPORTANT]
> 1. **Gateway**: Bạn muốn giữ **Kong** (Docker) hay **Node API Gateway**? Khuyến nghị giữ Kong vì đã cấu hình JWT + rate limit.
> 2. **Admin Dashboard**: Tạo riêng `apps/admin-dashboard` (Vite + React) hay dùng route group `(admin)` trong `web-client`?
> 3. **Phase 9 scope**: Làm tất cả optimization một lần hay chia nhỏ (9.1, 9.2, 9.3)?
> 4. **Email provider**: Dùng Nodemailer (dev) + Resend (prod) hay provider khác (SendGrid, Mailgun)?
> 5. **Có muốn thêm tính năng Rating/Review cho Phase nào?** (Hiện đề xuất Phase 19 cùng Admin)

## Verification Plan

### Automated Tests
- Chạy `pnpm build` để verify không có lỗi compile
- Integration tests cho Payment Service (Phase 10)
- E2E flow test: Register → Login → Browse → Pay → Enroll → Learn

### Manual Verification
- Test full auth flow qua browser
- Test VNPay sandbox payment
- Test video playback (YouTube + local)
- Verify Kafka event flow (payment → enrollment)
