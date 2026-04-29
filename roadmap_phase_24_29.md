# Roadmap Bổ Sung — Các Phase Mới

> Phân tích từ 6 vấn đề được nêu (2026-04-29) + câu trả lời của user.

**Tóm tắt câu trả lời:**
- Q&A: Global Q&A toàn hệ thống (q1a)
- Role badge: Icon verify xanh cho giảng viên (q2b)
- Payout: Tạm thời chỉ hiển thị doanh thu (q3c)
- Admin: Chi tiết đầy đủ (q4a)
- Admin count: 1-2 người (q5a)
- Learn page UX: Cần phân tích để đề xuất (q6b)

---

## PHASE MỚI GỢI Ý

### Phase 24: Instructor Channel System

**Mục tiêu:** Giảng viên có thể thiết lập kênh cá nhân, học viên có thể xem toàn bộ khóa học của giảng viên qua profile.

**Backend (Course Service):**
- [x] Model `InstructorProfile` trong `course_db`: `instructorId` (unique, FK User), `slug` (unique), `displayName`, `headline`, `bio`, `avatar`, `socialLinks` (JSON), `customSlug`
- [x] API: `GET /api/instructors` — list all instructors (public, với courseCount, rating)
- [x] API: `GET /api/instructors/:slug` — public profile (với courses published, stats)
- [x] API: `GET /api/instructors/:slug/courses` — courses by instructor (paginated, filterable)
- [x] API: `PUT /api/instructors/profile` — update own profile (auth, instructor only)

**Frontend:**
- [x] `/instructor/profile` — trang cấu hình kênh (thay thế placeholder settings page)
  - Avatar upload (Cloudinary)
  - Display name, headline, bio
  - Custom slug (kiểm tra unique, auto-generate từ name nếu trống)
  - Social links (website, facebook, youtube, etc.)
- [x] `/instructors` — trang danh sách giảng viên (public)
  - Grid instructor cards (avatar, name, headline, courseCount, avgRating)
  - Search by name
  - Sort by name/courses/popularity
- [x] `/instructors/[slug]` — trang profile công khai giảng viên
  - Banner + avatar + headline + bio + social links
  - Tab "Khóa học" — danh sách khóa học đã xuất bản
  - Tab "Giới thiệu" — bio đầy đủ
- [x] Update `instructor/layout.tsx` nav: đổi label "Kênh" thành "Kênh của tôi" link tới `/instructor/profile`
- [x] Update SharedNavbar: thêm link "Giảng viên" trên header navigation

**Acceptance Criteria:**
- Giảng viên có thể cập nhật thông tin kênh và nhận URL profile công khai
- Học viên có thể tìm và xem toàn bộ khóa học của bất kỳ giảng viên nào
- Slug là duy nhất, có thể tùy chỉnh hoặc auto-gen

**Rủi ro:**
- Slug uniqueness khi user đổi tên — cần redirect 301 từ slug cũ
- Performance khi instructor có 100+ courses — cần pagination

---

### Phase 25: Global Q&A System

**Mục tiêu:** Thay thế course community groups bằng 1 trang Q&A global toàn hệ thống.

**Backend (Course Service):**
- [ ] Model `Question` trong `course_db`: `id`, `userId`, `title`, `content`, `courseId` (nullable, optional — gắn Q&A vào khóa học cụ thể nếu cần), `lessonId` (nullable), `isResolved` (default false), `viewCount`, upvoteCount, createdAt, updatedAt
- [ ] Model `Answer`: `id`, `questionId`, `userId`, `content`, `isAccepted` (default false), upvoteCount, createdAt, updatedAt
- [ ] Model `QuestionUpvote` / `AnswerUpvote` (unique constraint user+question/answer)
- [ ] API: `POST /api/questions` — create question (auth)
- [ ] API: `GET /api/questions` — list questions (public, paginated, filter by courseId?search, sort by recent/popular/unanswered)
- [ ] API: `GET /api/questions/:id` — question detail + answers
- [ ] API: `PATCH /api/questions/:id` — update question (owner only)
- [ ] API: `DELETE /api/questions/:id` — delete question (owner or admin)
- [ ] API: `POST /api/questions/:id/answers` — create answer
- [ ] API: `PATCH /api/answers/:id` — update/delete answer (owner only)
- [ ] API: `POST /api/questions/:id/accept-answer/:answerId` — accept answer (question owner only)
- [ ] API: `POST /api/questions/:id/upvote` — upvote question
- [ ] API: `POST /api/answers/:id/upvote` — upvote answer

**Frontend:**
- [ ] `/dashboard/qa` — trang Q&A toàn hệ thống (thay thế community tab trên dashboard)
  - Filter: Tất cả / Chưa trả lời / Đã giải quyết
  - Filter theo khóa học (dropdown)
  - Sort: Mới nhất / Nhiều lượt xem / Nhiều upvote
  - Search bar (tìm theo title)
  - Pagination
  - Button "Đặt câu hỏi" → modal
- [ ] `/qa/[questionId]` — trang chi tiết câu hỏi
  - Question content + metadata (author, course, timestamp, view count)
  - Answer list (sorted: accepted first, then by upvotes)
  - Answer form
  - Upvote button
  - "Chấp nhận câu trả lời" cho owner
- [ ] Migration: Xóa auto-join community group flow (Kafka event `learning.enrollment.created` không còn tạo community membership)
- [ ] Migration: Option — migrate existing community posts sang Questions hoặc archive

**Acceptance Criteria:**
- User có thể đặt câu hỏi, được giải đáp bởi cộng đồng
- Giảng viên có verify badge trên câu trả lời
- Câu hỏi có thể gắn khóa học cụ thể (optional)

**Rủi ro:**
- Migration dữ liệu community cũ — cần quyết định archive hay convert
- Q&A spam — cần rate limit hoặc approval flow

---

### Phase 26: Community UI Enhancement (Verify Badge)

**Mục tiêu:** Cập nhật UI community để phân biệt rõ giảng viên vs học viên bằng verify badge.

**Frontend (chỉ update UI, không thay đổi logic):**
- [ ] Update community post/feed UI: thêm verify badge (icon xanh) cho author có role INSTRUCTOR
- [ ] Badge design: Icon `CheckCircle2` màu xanh dương (`text-blue-500`) bên cạnh tên giảng viên
- [ ] Cập nhật instructor profile link trên community — click vào tên giảng viên → `/instructors/[slug]`
- [ ] Nếu Phase 25 chưa xong: update existing community posts/comments để hiển thị badge

**Lưu ý:** Nếu Phase 25 (Global Q&A) được làm trước, Phase 26 có thể merge vào Phase 25 vì Q&A cũng cần verify badge.

---

### Phase 27: Instructor Revenue Display

**Mục tiêu:** Hiển thị doanh thu chính xác cho giảng viên. Chưa có payout withdrawal — chỉ hiển thị.

**Backend (Payment Service):**
- [ ] Model `InstructorEarning` trong `payment_db`: `id`, `instructorId`, `courseId`, `orderId`, `amount` (số tiền giảng viên nhận = order amount × revenue share %), `revenueShare` (default 70%), `status` (PENDING | AVAILABLE | WITHDRAWN), createdAt
- [ ] Model `InstructorPayout` trong `payment_db`: `id`, `instructorId`, `amount`, `status` (PENDING | APPROVED | REJECTED | PAID), `bankAccount` (masked), `adminNote`, `paidAt`, createdAt
- [ ] API: `GET /payment/api/instructor/earnings` — earnings breakdown (total, by course, by month)
- [ ] API: `GET /payment/api/instructor/earnings/summary` — total available balance
- [ ] Backend: Khi `payment.order.completed` event được consume → tạo `InstructorEarning` record với revenue share (trừ platform fee)
- [ ] Revenue share logic: instructor nhận 70% (configurable), platform 30%

**Frontend:**
- [ ] Update `instructor/analytics/page.tsx` — kết nối real revenue data từ `GET /payment/api/instructor/earnings/summary`
- [ ] Update `instructor/settings/page.tsx` — trang "Thanh toán" với:
  - Tổng thu nhập khả dụng
  - Danh sách giao dịch (earnings breakdown)
  - Nút "Rút tiền" (placeholder — disabled, text "Tính năng rút tiền sẽ sớm ra mắt")
  - Thông tin tài khoản ngân hàng (form nhập STK — lưu encrypted, chỉ hiển thị 4 số cuối)

**Acceptance Criteria:**
- Giảng viên thấy đúng doanh thu = tổng order thành công × 70%
- Revenue hiển thị trên trang analytics + settings
- Không có payout thực — chỉ hiển thị

**Rủi ro:**
- Revenue share có thể thay đổi — cần config động, không hardcode
- Instructor có thể có nhiều courses — breakdown by course cần rõ ràng

---

### Phase 28: Instructor Studio UX Audit

**Mục tiêu:** Phân tích sâu UX trang học khóa học (`/learn/[courseId]`) và các trang instructor khác, đề xuất cải tiến cụ thể.

**Các trang cần audit:**
- `/learn/[courseId]` — trang học chính
- `/instructor` — dashboard tổng quan
- `/instructor/courses` — danh sách khóa học
- `/instructor/courses/[id]` — tạo/sửa khóa học wizard

**Output:**
- Báo cáo UX audit (markdown) ghi rõ:
  - Các điểm friction cụ thể (dựa trên heuristic evaluation)
  - Mobile responsiveness issues
  - Accessibility gaps
  - Performance concerns (bundle size, loading states)
  - Đề xuất cải tiến ưu tiên theo impact/effort

**Đặc biệt chú ý:**
- Navigation flow giữa các lesson — có liền mạch không?
- Lesson completion UX — có rõ ràng không?
- Sidebar curriculum — có dễ navigate không trên mobile?
- Certificate CTA — có hiển thị đúng thời điểm?
- Video player UX — có responsive không?

---

### Phase 29: Full Admin Dashboard

**Mục tiêu:** Bổ sung các trang và tính năng Admin còn thiếu theo yêu cầu chi tiết.

**Backend:**
- [ ] Payment Service: API `GET /payment/api/admin/payouts` — list all payout requests (paginated, filter by status/instructor)
- [ ] Payment Service: API `POST /payment/api/admin/payouts/:id/approve` — approve payout (admin)
- [ ] Payment Service: API `POST /payment/api/admin/payouts/:id/reject` — reject payout
- [ ] Payment Service: API `GET /payment/api/admin/revenue` — platform revenue analytics
- [ ] Auth Service: API `GET /auth/api/admin/audit-logs` — list audit logs (admin actions: role changes, user bans, course approvals)
- [ ] Auth Service: Model `AuditLog` trong `auth_db`: `id`, `adminId`, `action`, `targetUserId`, `targetType`, `oldValue`, `newValue`, `ip`, `createdAt`
- [ ] Course Service: API `POST /api/admin/courses/:id/approve` — approve/reject course (nếu cần approval flow)
- [ ] Course Service: API `POST /api/admin/categories` — create category
- [ ] Course Service: API `PATCH /api/admin/categories/:id` — update category
- [ ] Course Service: API `DELETE /api/admin/categories/:id` — delete category
- [ ] Notification Service: API `GET /notification/api/admin/logs` — list notification history
- [ ] System Config: model `SystemConfig` trong `auth_db` (key-value store cho config)

**Frontend:**
- [ ] `/admin/payouts` — Quản lý payout
  - List payout requests (trạng thái, instructor, amount, bank account masked, date)
  - Filter: PENDING / APPROVED / REJECTED / PAID
  - Actions: Approve / Reject cho PENDING requests
  - Detail modal: xem đầy đủ thông tin payout
- [ ] `/admin/revenue` — Doanh thu nền tảng
  - Tổng doanh thu platform
  - Breakdown: revenue share instructor vs platform
  - Monthly revenue chart (biểu đồ)
  - Top courses by revenue
  - Top instructors by revenue
- [ ] `/admin/audit-log` — Nhật ký hành động admin
  - List audit logs (admin, action, target, timestamp)
  - Filter by action type, admin, date range
  - Export audit log (CSV)
- [ ] `/admin/notifications` — Quản lý notification
  - List notification history (sent to who, what, when)
  - Filter by type, user, date
  - (Không cần gửi notification từ admin — chỉ xem log)
- [ ] `/admin/categories` — Quản lý danh mục
  - CRUD categories (name, slug, order)
  - Reorder categories (drag & drop hoặc order number)
- [ ] `/admin/settings` — Cấu hình hệ thống
  - Revenue share percentage (platform vs instructor)
  - Site name, contact email
  - VNPay config (readonly — hiển thị trạng thái)
  - System maintenance mode toggle

**Acceptance Criteria:**
- Admin có thể approve/reject payout requests (dù payout chưa thực sự chuyển tiền)
- Admin thấy được doanh thu tổng quan của nền tảng
- Mọi hành động nhạy cảm (đổi role, cấm user, approve course) đều được log
- System config có thể thay đổi được từ admin panel

**Rủi ro:**
- Audit log growth — cần partition hoặc archive old logs
- System config changes có thể break hệ thống — cần validation cẩn thận

---

## THỨ TỰ THỰC HIỆN ĐỀ XUẤT

```
Phase 24 (Instructor Channel)    ──┐
                                   ├─ Independent, nên làm song song
Phase 26 (Community Verify Badge) ─┘
        │
        ▼
Phase 25 (Global Q&A)  ←── Cần Phase 24 (verify badge trên answers)
        │
        ▼
Phase 27 (Instructor Revenue) ←── Phụ thuộc: payment consumer tạo InstructorEarning
        │
        ▼
Phase 28 (Instructor UX Audit) ←── Có thể làm song song với Phase 27
        │
        ▼
Phase 29 (Full Admin Dashboard) ←── Cần Phase 27 (payout API) + audit logging
```

---

## SƠ BỘ ƯỚC TÍNH THỜI GIAN

| Phase | Mô tả | Ước tính |
|-------|--------|---------|
| Phase 24 | Instructor Channel System | 3-4 ngày |
| Phase 25 | Global Q&A System | 3-4 ngày |
| Phase 26 | Community Verify Badge | 0.5 ngày (merge vào Phase 25 nếu cùng lúc) |
| Phase 27 | Instructor Revenue Display | 2-3 ngày |
| Phase 28 | Instructor UX Audit | 1-2 ngày (audit + đề xuất; implement separate) |
| Phase 29 | Full Admin Dashboard | 4-5 ngày |

**Tổng: ~14-18 ngày** (nếu 1 người, làm tuần tự)
**Nếu 2 người song song: ~8-10 ngày**

---

## LƯU Ý QUAN TRỌNG

1. **Phase 25 (Global Q&A) thay thế course community groups** — Kafka event `learning.enrollment.created` hiện tại auto-join community group. Cần migration plan để:
   - Không break existing enrolled users
   - Convert hoặc archive existing community posts
   - Đề xuất: Soft-archive existing community data (đánh dấu `isArchived = true` thay vì xóa)

2. **Phase 27 (Revenue) cần migration** — Thêm bảng `InstructorEarning` và chạy script tính lại earnings từ existing orders (backfill data).

3. **Phase 28 (UX Audit) là nghiên cứu trước** — Báo cáo audit sẽ là input cho các phase cải tiến UX tiếp theo, không phải implement.

4. **Phase 29 (Admin) cần AuditLog model** — Nên thêm Prisma middleware tự động log các action nhạy cảm thay vì log thủ công ở mỗi controller.
