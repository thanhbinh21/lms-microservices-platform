# Demo-Ready Admin Operations Plan

## 1. Mục tiêu

Đưa trải nghiệm admin vào trạng thái demo-ready: ADMIN có thể vào khu Quản trị từ header, xử lý hồ sơ giảng viên, xem doanh thu, thông báo, cấu hình, nhật ký hoạt động, sự kiện lỗi hệ thống và community mà không phải tự gõ URL, không gặp route chết và không thấy thuật ngữ kỹ thuật khó hiểu.

Plan này giữ admin là quyền cao nhất nhưng không bypass Gateway auth, không truy cập chéo DB, không merge service và không fake mutation thành công.

## 2. Phạm vi

- Route admin hiện có: `/admin`, `/admin/users`, `/admin/courses`, `/admin/categories`, `/admin/reviews`, `/admin/instructor-requests`, `/admin/instructor-requests/[id]`, `/admin/support`, `/admin/payouts`, `/admin/revenue`, `/admin/notifications`, `/admin/system-config`, `/admin/audit-log`, `/admin/system`.
- Route cần plan thêm: `/admin/community` để quản lý feed community/report nếu community-service có endpoint owner.
- Component/layout có khả năng cần sửa: admin layout/sidebar, shared navbar admin CTA, overview cards, instructor request panel, revenue page, notification history page, system config page, audit log page, system event page, community moderation page.
- Server Actions liên quan: `actions/admin.ts`, `actions/instructor.ts`, `actions/support.ts`, `actions/community.ts`, `actions/notification.ts`.
- API owner service: auth admin/users/audit/support/instructor requests/system config, course admin/categories/courses/reviews, payment admin revenue/payouts, notification admin history, learning admin failed events, community moderation nếu có.

## 3. Vấn đề hiện tại

- Admin cần CTA “Quản trị” trên header trỏ `/admin`; không để admin tự gõ URL.
- Sau login admin cần redirect hợp lý vào `/admin` hoặc hiển thị CTA rõ.
- `/admin/instructor-requests` là nghiệp vụ quan trọng và cần kiểm tra list/detail/approve/reject/empty/loading/error.
- `/admin/revenue` và `/admin/notifications` cần đồng bộ layout, title, cards, table, filter, loading/empty/error.
- `/admin/system-config`, `/admin/audit-log`, `/admin/system` còn rủi ro nhãn kỹ thuật hoặc tiếng Anh.
- Label cần đổi: `Audit log` -> `Nhật ký hoạt động`, `System Config` -> `Cấu hình hệ thống`, `DLQ` -> `Sự kiện lỗi cần xử lý`, `Retry` -> `Thử xử lý lại`, `Resolve` -> `Đánh dấu đã xử lý`.
- Chưa có route admin community để quản lý bài viết, report, ẩn/xóa/khôi phục, audit action.
- Một số admin action có thể chưa có endpoint owner service; không được fake thành công.
- Nếu backend thiếu domain/action, UI phải read-only, empty state hoặc TODO dependency API, không gọi DB chéo.
- Admin cần rà đủ domain: user, course, instructor requests, category, reviews, community, Q&A, orders, revenue, payouts, notifications, support, audit, config, system events.

## 4. Hướng xử lý đề xuất

### UI/UX

- Admin layout dùng ngôn ngữ vận hành dễ hiểu, tránh thuật ngữ backend nếu không cần.
- Dashboard `/admin` ưu tiên pending actions: hồ sơ giảng viên, payout, support ticket, sự kiện lỗi, review/report.
- Revenue dùng KPI cards, chart, date range filter, table đơn hàng/payout nếu API hỗ trợ.
- System pages có mô tả ngắn để admin hiểu nghiệp vụ kỹ thuật.
- Nếu action thiếu API owner, hiển thị read-only state và TODO dependency rõ.

### Routing

- Shared navbar nhận role ADMIN và hiển thị “Quản trị” trỏ `/admin`.
- ADMIN login redirect vào `/admin` hoặc thấy CTA rõ ngay.
- Non-admin không vào được `/admin/*`.
- Bổ sung `/admin/community` trong plan/sidebar chỉ khi có route/page hoặc empty dependency page rõ.

### Role permission

- Backend vẫn guard admin; UI guard chỉ phục vụ UX.
- Admin mutation chỉ implement khi đã có endpoint owner service.
- Admin community management nếu thiếu API thì plan thành dependency, không tự bypass qua DB hoặc internal private call.
- Action nhạy cảm phải có confirmation và audit: approve/reject instructor request, payout, retry/resolve event, update config, hide/delete community post.

### Loading/empty/error state

- Mọi admin route chính có loading skeleton.
- Empty state nói rõ “Chưa có hồ sơ chờ duyệt”, “Chưa có yêu cầu rút tiền”, “Chưa có sự kiện lỗi”.
- Error state phân biệt service unavailable, forbidden, missing endpoint/dependency.

### Data/API integration

- Instructor request dùng auth-service source of truth.
- Revenue/payout dùng payment-service; không tính tiền từ client.
- System event dùng learning-service admin API.
- Notification history dùng notification-service admin API.
- Community moderation chỉ dùng community-service endpoint nếu có; nếu chưa có thì tạo dependency item, không fake action.

### Notification/toast

- Toast cho admin mutation thật: approve/reject request, payout update, config update, retry/resolve event, community moderation nếu có endpoint.
- In-app notification cho user bị ảnh hưởng nếu notification/event đã hỗ trợ.
- Không báo thành công nếu API chưa tồn tại hoặc trả lỗi.

### Responsive/mobile

- Admin sidebar mobile dùng drawer.
- Tables responsive bằng horizontal scroll hoặc card view.
- Filter/date range không vỡ trên tablet.

### Accessibility

- Sidebar có `aria-current`.
- Confirm dialog cho action nhạy cảm có focus trap và mô tả hậu quả.
- Table icon action có label.
- Form reject/config có label và error accessible.

## 5. Task breakdown

- [ ] Cập nhật `SharedNavbar`: role ADMIN hiển thị “Quản trị” trỏ `/admin`; không sửa auth logic ngoài redirect UI cần thiết.
- [ ] Rà admin login redirect: ADMIN vào `/admin` hoặc có CTA rõ; non-admin vào `/admin/*` bị chặn.
- [ ] Nâng `/admin/instructor-requests`: filter pending/approved/rejected, detail, approve/reject, reject reason, toast, audit, notification; chỉ dùng auth-service endpoint.
- [ ] Nâng `/admin/revenue`: KPI doanh thu, platform revenue, instructor revenue, orders, payout, chart, date range; không fake số tiền.
- [ ] Nâng `/admin/notifications`: history, filter type/status/channel, delivery status, empty/loading/error.
- [ ] Việt hóa `/admin/system-config`, `/admin/audit-log`, `/admin/system`: đổi label kỹ thuật sang tiếng Việt dễ hiểu.
- [ ] Bổ sung kế hoạch `/admin/community`: nếu có community-service admin API thì list/search/filter/hide/delete/restore/report/audit; nếu chưa có API thì read-only/empty dependency.
- [ ] Rà admin capability matrix và đánh dấu domain thiếu UI hoặc thiếu API.
- [ ] Với mọi admin mutation, kiểm tra endpoint owner trước; nếu không có endpoint thì không implement action thành công giả.
- [ ] Rà empty/demo data: dùng seed/demo data có kiểm soát hoặc empty state giải thích, không hardcode production.

## 6. Acceptance Criteria

- ADMIN thấy “Quản trị” trên header và click vào `/admin` thành công.
- Login bằng ADMIN không cần tự gõ URL để vào admin dashboard.
- Non-admin không vào được `/admin/*` và không thấy dữ liệu admin.
- `/admin/instructor-requests` list/detail/approve/reject hoạt động qua auth-service; reject bắt buộc lý do.
- `/admin/revenue` có filter date range, KPI và empty/loading/error rõ.
- `/admin/notifications` có lịch sử thông báo, filter type/status/channel và delivery status.
- System pages không còn label kỹ thuật khó hiểu mà không giải thích.
- Không admin action nào báo thành công nếu backend/API chưa hỗ trợ.
- Không truy cập DB chéo hoặc bypass service owner.
- `/admin/community` nếu thiếu API thì hiển thị dependency/TODO, không fake hide/delete/restore thành công.

## 7. Manual Test Checklist

- [ ] Login ADMIN, xác nhận vào `/admin` hoặc thấy nút “Quản trị”.
- [ ] Login STUDENT/INSTRUCTOR, thử mở `/admin`; bị redirect/forbidden.
- [ ] Mở `/admin/instructor-requests`, lọc pending/approved/rejected, mở detail.
- [ ] Approve hồ sơ giảng viên; admin thấy toast, audit log có record, user nhận notification nếu hỗ trợ.
- [ ] Reject không nhập lý do; UI chặn. Nhập lý do; action thành công thật qua API.
- [ ] Mở `/admin/revenue`, đổi date range; KPI/chart/table cập nhật hoặc empty state đúng.
- [ ] Mở `/admin/notifications`, lọc email/in-app, sent/failed/mocked; table không vỡ.
- [ ] Mở `/admin/system-config`, update config demo-safe nếu endpoint có; nếu không có endpoint, UI không báo success giả.
- [ ] Mở `/admin/audit-log`, label hiển thị “Nhật ký hoạt động”.
- [ ] Mở `/admin/system`, retry/resolve sự kiện lỗi nếu learning-service endpoint có; confirm/toast/state đúng.
- [ ] Mở `/admin/community`; nếu thiếu API, thấy read-only/empty dependency thay vì action giả.

## 8. Demo Script Impact

Admin demo trở thành trung tâm vận hành rõ ràng: vào Quản trị, duyệt giảng viên, xem doanh thu, kiểm tra thông báo, xử lý hỗ trợ, xem cộng đồng và xử lý sự kiện lỗi. Quy tắc không fake mutation giúp tránh demo thành công giả nhưng backend không đổi trạng thái.

## 9. Rủi ro & lưu ý

- Admin community có thể thiếu moderation API; không được truy cập DB chéo hoặc fake action.
- Revenue phụ thuộc payment-service; nếu API thiếu breakdown thì UI phải empty/fallback rõ.
- Role guard sai có thể leak admin data; backend guard bắt buộc.
- Retry/resolve sự kiện lỗi có thể tạo duplicate nếu handler không idempotent; cần confirmation và gọi API owner.
- Audit log/notification có thể thiếu event cho một số action; ghi dependency thay vì silently pass.
- Không hiển thị secret, token, raw env hoặc payload nhạy cảm trong system/config/log pages.
