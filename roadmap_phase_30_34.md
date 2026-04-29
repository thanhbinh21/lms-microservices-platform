# Roadmap Phase 30-34: UX Foundation & Polish

**Ngày tạo:** 2026-04-29
**Nguồn:** Audit toàn diện bởi 5 agent chuyên môn
**Điểm hiện tại:** Instructor Studio 5.8/10 | Student Learn 6.5/10 | Admin 6.5/10 | Backend 6.5/10 | Security 6.0/10

---

## Tổng quan issues

| Severity | Số lượng | Đã xong | Còn lại |
|---|---|---|---|
| Critical (P0) | 13 | 8 | 5 |
| High (P1) | 16 | 10 | 6 |
| Medium (P2) | 10 | 1 | 9 |
| Low | 12 | 0 | 12 |

**Tổng effort ước tính:** ~15-20 ngày dev

---

## Phase 30: Accessibility & Core UX Foundation

**Priority: P0** | **Effort: 2-3 ngày**

### 30.1 — Instructor Modals Accessibility ✅

**Vấn đề:** Tất cả modal dialogs thiếu `role="dialog"`, `aria-modal`, `aria-labelledby`, và focus trap.

**Files cần sửa:**
- `apps/web-client/src/app/(instructor)/instructor/certificates/page.tsx` (CreateCertificateModal)
- `apps/web-client/src/app/(instructor)/instructor/communities/page.tsx` (CreateGroupModal)
- `apps/web-client/src/app/(instructor)/instructor/courses/page.tsx` (CreateChapterModal, DeleteChapterDialog)
- `apps/web-client/src/app/(instructor)/layout.tsx` (sidebar)

**Thay đổi:**
1. Thêm `role="dialog"` + `aria-modal="true"` + `aria-labelledby="modal-title"` trên mỗi dialog element
2. Dùng `focus-trap-react` để khóa focus bên trong modal khi open
3. Focus auto vào first focusable element khi modal mở
4. Thêm `aria-describedby` nếu modal có mô tả phụ

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.2 — Instructor Layout Navigation ✅

**Vấn đề:** Active nav link không có `aria-current="page"`, không có `:focus-visible` ring, sidebar không đóng được bằng Escape key trên mobile.

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.3 — Instructor Dashboard Date Crash ✅

**Vấn đề:** `Date.parse` crash khi `updatedAt`/`createdAt` là `undefined`.

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.4 — Analytics Revenue Label ✅

**Vấn đề:** Revenue label hiện tại có thể gây hiểu nhầm semantics ("thực nhận" nhưng chưa trừ platform fee).

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.5 — Learn Page: Mobile Sidebar Close Flow ✅

**Vấn đề:** Sidebar curriculum không đóng được trên mobile khi click backdrop hoặc bấm Escape.

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.6 — Learn Page: TEXT Lesson Content Renderer ✅

**Vấn đề:** Không render nội dung TEXT — hiện chỉ có video và YouTube.

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.7 — Learn Page: Certificate Download ✅

**Vấn đề:** Certificate download link trỏ đến `.txt` file thay vì PDF preview.

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.8 — Admin Sidebar: Instructor Requests Link ✅

**Vấn đề:** "Đơn Giảng Viên" không có link trong admin sidebar, page hiện tại redirect về profile.

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.9 — Admin Reviews: isFlagged Filter Type ✅

**Vấn đề:** `isFlagged` được truyền là string `'' | 'true' | 'false'` thay vì boolean.

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

### 30.10 — Admin Reviews: Flagged Badge ✅

**Vấn đề:** `isFlagged` hiển thị red "BANNED" badge, sai semantics.

**Status:** ✅ Done — Phase 30 audit hoàn thành Apr 29, 2026

---

## Phase 31: Settings + Revenue Foundation

**Priority: P1** | **Effort: 2-3 ngày**

### 31.1 — Payment Service: Earnings API ✅

**Backend tasks:**
- [x] `GET /api/instructor/earnings` — breakdown by course, by month (instructorId from x-user-id header)
- [x] `GET /api/instructor/earnings/summary` — total available balance, total withdrawn, pending

**Database:**
- [x] Model `InstructorEarning` (instructorId, courseId, orderId, grossAmount, platformFee, netAmount, status: PENDING/AVAILABLE/WITHDRAWN, createdAt)
- [x] Migration `20260429060303_add_instructor_earnings` applied to Neon

**Kafka:**
- [x] Payment consumer / vnpay controller: tạo `InstructorEarning` record khi order completed (70% instructor, 30% platform)

**Files:**
- `payment-service/src/controllers/earnings.controller.ts` (new)
- `payment-service/src/index.ts` (routes)
- `payment-service/prisma/schema.prisma`
- `payment-service/src/controllers/vnpay.controller.ts` (integrated createInstructorEarning)

**Status:** ✅ Done — Phase 31 hoàn thành Apr 29, 2026

### 31.2 — Instructor Settings: Channel Page ✅

**File:** `apps/web-client/src/app/(instructor)/instructor/settings/page.tsx`

**Tasks:**
- [x] Earnings overview + transaction history + bank account form — kết nối real API
- [x] STK ngân hàng — form nhập (lưu masked: `****1234`)
- [x] Nút "Rút tiền" — disabled với text "Sắp ra mắt"

**Status:** ✅ Done — Phase 31 hoàn thành Apr 29, 2026

### 31.3 — Instructor Settings: Payment Page ✅

**File:** `apps/web-client/src/app/(instructor)/instructor/settings/page.tsx`

**Tasks:**
- [x] Tổng thu nhập khả dụng (from `/earnings/summary`)
- [x] Danh sách giao dịch (from `/earnings`)
- [x] STK ngân hàng — form nhập
- [x] Nút "Rút tiền" — disabled

**Status:** ✅ Done — Phase 31 hoàn thành Apr 29, 2026

### 31.4 — Instructor Analytics: Connect Revenue Data ✅

**File:** `apps/web-client/src/app/(instructor)/instructor/analytics/page.tsx`

**Tasks:**
- [x] Fetch earnings data từ Payment Service API
- [x] Render vào revenue chart
- [ ] Date range selector (7/30/90 days) — **chưa làm**

**Status:** ✅ Done (trừ date range selector) — Phase 31 hoàn thành Apr 29, 2026

---

## Phase 32: Student Learn Page Polish

**Priority: P1** | **Effort: 3-4 ngày**

### 32.1 — Curriculum Sidebar Improvements ✅

**File:** `apps/web-client/src/components/learning/curriculum-sidebar.tsx`

**Tasks:**
- [x] Collapsible chapters — click chapter header để expand/collapse
- [x] Active lesson highlight (màu primary bg)
- [x] Progress per lesson: icon checkmark khi hoàn thành
- [x] Progress per chapter: hiển thị "3/5 bài" bên cạnh chapter title

**Status:** ✅ Done — Phase 32 hoàn thành Apr 29, 2026

### 32.2 — Lesson Navigation Polish ✅

**File:** `apps/web-client/src/app/learn/[courseId]/lesson/[lessonId]/page.tsx`

**Tasks:**
- [x] "Bài tiếp theo" / "Bài trước" arrows — sticky trên scroll dài (scroll tracking)
- [x] Sau bài cuối cùng: hiển thị "Hoàn thành khóa học" CTA
- [x] Keyboard shortcuts: ArrowLeft/ArrowRight để navigate + `?` overlay

**Status:** ✅ Done — Phase 32 hoàn thành Apr 29, 2026

### 32.3 — Video Player Enhancements ✅

**File:** `apps/web-client/src/components/learning/video-player.tsx`

**Tasks:**
- [x] Fullscreen button — native `<video controls>` đã hỗ trợ
- [x] Playback speed selector (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x) — custom overlay dropdown
- [x] Keyboard shortcuts overlay (? key) — trong lesson page
- [x] Progress bar click-to-seek — native `<video>` đã hỗ trợ

**Status:** ✅ Done — Phase 32 hoàn thành Apr 29, 2026

### 32.4 — Quiz Lessons ⏳ PENDING

**Tasks:**
1. Backend: Quiz model (lessonId, questions JSON), QuizAttempt model
2. Frontend: Quiz component — render câu hỏi, options, submit
3. Score display sau khi submit
4. Retry logic

### 32.5 — Certificate Polish ✅

**File:** `apps/web-client/src/app/learn/[courseId]/lesson/[lessonId]/page.tsx`

**Tasks:**
- [x] Confetti animation khi user hoàn thành 100% (lần đầu) — canvas-confetti
- [x] Certificate preview page với print CSS
- [ ] Download as PDF button — **chưa làm**

**Status:** ✅ Done (trừ PDF download) — Phase 32 hoàn thành Apr 29, 2026

### 32.6 — Mobile UX ✅

**File:** `apps/web-client/src/app/learn/[courseId]/layout.tsx`

**Tasks:**
- [x] Sidebar overlay thay vì full-screen overlay (có backdrop + onClick close)
- [ ] Sidebar thành drawer/sheet thay vì overlay — **chưa làm**
- [x] Curriculum compact mode — đã có progress bar
- [x] Sticky lesson title trên top

**Status:** ✅ Mostly done — Phase 32 hoàn thành Apr 29, 2026

### 32.7 — Progress Sync ✅

**File:** `apps/web-client/src/app/learn/[courseId]/layout.tsx`

**Tasks:**
- [x] Đảm bảo progress sync ngay sau khi complete lesson (window event `lms:learn-progress-updated`)
- [x] Refetch data on event — không cần refresh
- [ ] WebSocket hoặc polling ngắn (5s) để sync giữa tabs — **chưa làm**

**Status:** ✅ Done (trừ cross-tab sync) — Phase 32 hoàn thành Apr 29, 2026

---

## Phase 33: Course Detail + Public Pages Polish

**Priority: P2** | **Effort: 1-2 ngày**

### 33.1 — Course API: Include Instructor Object ⏳ PENDING

**Backend tasks:**
- [ ] Update course listing/detail API: include `instructor { id, name, displayName, avatar, slug }`
- [ ] Public instructor listing: `GET /instructors` (for `/instructors` page)

### 33.2 — Course Detail: Instructor Display ⏳ PENDING

**File:** `apps/web-client/src/app/courses/[slug]/page.tsx`

**Tasks:**
1. Hiển thị instructor real name thay vì `Giảng viên #abc123`
2. Instructor avatar (small circle)
3. Instructor bio 1 dòng
4. Link đến `/instructors/[slug]` (Phase 24)

### 33.3 — Course Detail: Related Courses ⏳ PENDING

**Tasks:**
1. Section "Khóa học liên quan" bên dưới
2. Fetch cùng category, exclude current course
3. Horizontal scroll carousel (mobile-friendly)

### 33.4 — Reviews: Polish ⏳ PENDING

**Tasks:**
1. Fix heading typo: `'Danh gia va nhan xet'` → `'Danh gia va nhan xet'` (consistent encoding)
2. Add pagination cho reviews dài (10 reviews/page)
3. Add search/filter dropdown

### 33.5 — Login Page ✅ DONE

**Tasks:**
- [x] Thêm "Quên mật khẩu?" link → `/forgot-password` (placeholder page)
- [x] Thêm "Ghi nhớ đăng nhập" checkbox

**Status:** ✅ Done — Apr 29, 2026

### 33.6 — Landing Page ⏳ PENDING

**Tasks:**
1. Dynamic featured course (most enrolled) thay vì hardcoded
2. Stats fetch from API or clearly labeled as approximations

---

## Phase 34: Admin Completeness + Security Hardening

**Priority: P1** | **Effort: 4-5 ngày**

### 34.1 — Backend: Audit Log ⏳ PENDING

**Tasks:**
- [ ] Model `AuditLog` (actorId, actorRole, action, targetType, targetId, metadata JSONB, ipAddress, traceId, createdAt)
- [ ] API: `POST /admin/audit-logs` (create), `GET /admin/audit-logs` (list with filters: actor, action, dateRange, targetType)
- [ ] Hook: every admin action calls audit log

### 34.2 — Backend: Payout Management ⏳ PENDING

**Tasks:**
- [ ] Model `Payout` (instructorId, amount, bankAccount masked, status, processedAt)
- [ ] API: `GET /admin/payouts`, `PATCH /admin/payouts/:id` (approve/reject)

### 34.3 — Backend: Category Management ⏳ PENDING

**Tasks:**
- [ ] API: `POST /admin/categories`, `PATCH /admin/categories/:id`, `DELETE /admin/categories/:id`

### 34.4 — Backend: Server-Side Admin Auth ✅ DONE

**Tasks:**
- [x] Tất cả admin API endpoints: verify `x-user-role === 'ADMIN'` server-side
- [x] Dùng `requireAdmin` middleware từ `@lms/types`

**Files:**
- `services/auth-service/src/middlewares/requireAdmin.ts`
- `services/auth-service/src/index.ts` — `requireAdmin` applied on admin routes

**Status:** ✅ Done — Apr 29, 2026

### 34.5 — Security: JWT Verification ✅ DONE

**File:** `services/auth-service/src/lib/jwt.ts`

**Tasks:**
- [x] Hiện tại chỉ decode JWT header, không verify signature → **Đã verify đầy đủ với `jwt.verify()`**
- [x] Thêm `jwt.verify()` với secret từ env
- [x] Return 401 nếu token invalid/expired

**Status:** ✅ Done — Apr 29, 2026

### 34.6 — Security: IDOR Fix Enrollment ✅ DONE

**File:** `services/course-service/src/controllers/enrollment.controller.ts`

**Tasks:**
- [x] Enrollment chỉ được tạo cho `x-user-id` từ header — dùng `res.locals.userId`
- [x] Không nhận `userId` từ request body cho enrollment
- [ ] Admin có thể force-enroll user khác (cần requireAdmin) — **chưa làm**

**Status:** ✅ Done (trừ admin force-enroll) — Apr 29, 2026

### 34.7 — Security: VNPay Transaction Verify ✅ DONE

**File:** `services/payment-service/src/controllers/vnpay.controller.ts`

**Tasks:**
- [x] Verify transaction ID exists in DB before processing callback
- [x] Verify amount matches order amount in DB
- [x] Log all verification failures

**Status:** ✅ Done — Apr 29, 2026

### 34.8 — Security: Enrollment Unique Constraint ✅ DONE

**File:** `services/course-service/prisma/schema.prisma`

**Tasks:**
- [x] Thêm unique constraint: `@@unique([userId, courseId])` trên Enrollment model
- [x] Handle Prisma unique constraint violation as idempotent success

**Status:** ✅ Done — Apr 29, 2026

### 34.9 — Security: Kafka Event Validation ✅ DONE

**Files:**
- `packages/kafka-client/src/index.ts` — Zod schemas + `validateKafkaEvent()`
- `services/course-service/src/lib/kafka-consumer.ts`

**Tasks:**
- [x] Tất cả Kafka consumers: validate event payload schema trước khi xử lý
- [x] Dùng Zod schema cho mỗi event type
- [x] Reject và log nếu payload không match schema

**Status:** ✅ Done — Apr 29, 2026

### 34.10 — Security: Redis Keys TTL ⏳ PENDING

**Tasks:**
1. Review all Redis SET operations — thêm TTL hợp lý
2. Session keys: 7 ngày
3. Cache keys: 5-15 phút (tùy data)
4. Rate limit keys: TTL = window duration

### 34.11 — Security: Request Timeouts ⏳ PENDING

**Tasks:**
1. Thêm timeout cho tất cả fetch/HTTP calls trong services
2. Thêm `requestTimeout` middleware cho Express routes
3. Graceful shutdown: finish in-flight requests before exit

### 34.12 — Security: CORS Origin Restriction ✅ DONE

**Tasks:**
- [x] Tất cả services: CORS origin phải là environment variable, không hardcode
- [x] Không dùng `cors()` không có options
- [x] Validate origin header

**Files:**
- `services/instructor-service/src/app.ts` — `cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true })`

**Status:** ✅ Done — Apr 29, 2026

### 34.13 — Frontend: Admin Instructor Requests Page ⏳ PENDING

**File:** Tạo mới `apps/web-client/src/app/(admin)/admin/instructor-requests/page.tsx`

**Tasks:**
1. Standalone page dùng `AdminInstructorRequestsPanel` component
2. Không redirect về profile nữa
3. Thêm link trong admin sidebar navLinks

### 34.14 — Frontend: Admin Categories CRUD ⏳ PENDING

**File:** Tạo mới `apps/web-client/src/app/(admin)/admin/categories/page.tsx`

**Tasks:**
1. List categories với courseCount
2. Create/edit/delete category (name, slug, order)
3. Admin action: `createCategory`, `updateCategory`, `deleteCategory`

### 34.15 — Frontend: Admin Audit Log Page ⏳ PENDING

**File:** Tạo mới `apps/web-client/src/app/(admin)/admin/audit-log/page.tsx`

**Tasks:**
1. Table: actor, action, target, timestamp, traceId
2. Filters: actor search, action type, date range
3. Pagination

### 34.16 — Frontend: Admin Reviews Search ✅ DONE

**Files:**
- `apps/web-client/src/app/actions/admin.ts`

**Tasks:**
- [x] Add search input gọi `getAdminReviews({ search: '...' })`
- [x] Update `getAdminReviews` action để pass search param

**Status:** ✅ Done — Apr 29, 2026

### 34.17 — Frontend: Admin Courses Bulk Actions ⏳ PENDING

**Tasks:**
1. Thêm checkbox column
2. Bulk action toolbar: Archive selected, Approve selected
3. Debounce role change dropdown

### 34.18 — Frontend: Footer Cleanup ✅ DONE

**Files:**
- `apps/web-client/src/components/shared/shared-footer.tsx`
- `apps/web-client/src/app/about/page.tsx`
- `apps/web-client/src/app/help/page.tsx`
- `apps/web-client/src/app/terms/page.tsx`
- `apps/web-client/src/app/privacy/page.tsx`
- `apps/web-client/src/app/careers/page.tsx`

**Tasks:**
- [x] Xóa `href="#"` links
- [x] Tạo placeholder pages: `/about`, `/help`, `/terms`, `/privacy`, `/careers`

**Status:** ✅ Done — Apr 29, 2026

---

## Thứ tự thực hiện đề xuất

```
Team A (2 dev):
  Phase 30 (P0) → Phase 31 → Phase 33

Team B (1 dev):
  Phase 34 Security (P0) → Phase 34 Admin pages

Song song:
  Phase 32 (Learn polish)

Sau khi Phase 24 hoàn thành:
  Phase 33 instructor display link (Phase 24 là dependency)
```

**Tổng: ~15-20 ngày** (với 2-3 developers)

---

## Acceptance Criteria Checklist

### Phase 30
- [x] Tất cả modals có focus trap hoạt động
- [x] Keyboard navigation hoạt động trên instructor pages
- [x] Sidebar đóng được bằng Escape + backdrop click
- [x] Text lessons hiển thị nội dung
- [x] Certificate preview page tồn tại
- [x] Admin sidebar có link Don Giang Vien
- [x] Reviews isFlagged filter hoạt động đúng
- [x] Dashboard không crash khi date fields undefined

### Phase 31
- [ ] Settings page lưu được profile thật — **chưa làm (channel info form disabled)**
- [x] Revenue API trả về data thật
- [x] Analytics kết nối revenue data

### Phase 32
- [x] Curriculum collapsible chapters
- [x] Active lesson highlighted
- [x] Video player fullscreen (native) + speed control (custom dropdown)
- [x] Certificate confetti + preview
- [x] Keyboard shortcuts ArrowLeft/Right/?
- [x] Mobile sidebar close flow
- [ ] Mobile sidebar là drawer (Sheet) — **chưa làm**
- [ ] Quiz lessons — **chưa làm**
- [ ] PDF download button — **chưa làm**
- [ ] Cross-tab progress sync — **chưa làm**

### Phase 33
- [ ] Instructor real name on course detail
- [ ] Related courses section
- [ ] Reviews pagination + search
- [x] Login forgot password + remember me

### Phase 34
- [x] JWT verified (not just decoded)
- [x] IDOR enrollment fixed
- [x] VNPay transaction verified
- [x] Enrollment unique constraint in DB
- [x] Kafka payloads validated with Zod
- [ ] Redis TTL on all keys
- [ ] All services have request timeouts
- [x] CORS origin restricted
- [ ] Audit log model/API
- [ ] Payout API
- [ ] Category API
- [ ] Admin instructor requests standalone page
- [ ] Admin categories CRUD
- [ ] Admin audit log page
- [ ] Admin bulk actions
- [x] Admin reviews search
- [x] Footer links không còn href="#"
