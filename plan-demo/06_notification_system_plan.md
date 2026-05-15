# Demo-Ready Notification System Plan

## 1. Mục tiêu

Đưa hệ thống thông báo vào trạng thái demo-ready: người dùng luôn thấy phản hồi tức thì bằng toast sau thao tác, notification bell không làm crash navbar, số chưa đọc/đánh dấu đã đọc hoạt động nếu API có, và nội dung tiếng Việt có dấu.

Toast là bắt buộc cho demo. In-app notification triển khai theo event/API hiện có, không fake notification production.

## 2. Phạm vi

- UI: `NotificationBell`, dropdown notification, unread badge, empty/loading/error state, mark one/all as read.
- Toast feedback trong các flow: auth, instructor request, learning, payment, support, Q&A, admin actions.
- Server Actions: `actions/notification.ts` và các action gọi toast trong auth/instructor/learning/payment/support/Q&A/admin.
- Routes liên quan: shared navbar mọi role, `/admin/notifications`, student dashboard, instructor Studio, admin pages.
- Notification service APIs: list my notifications, mark as read, mark all as read, admin history, delivery status email/in-app.
- Email chỉ nằm trong P2 nếu SMTP/email transport đã có và service trả status thật.

## 3. Vấn đề hiện tại

- Notification bell đã có nhưng cần đảm bảo không crash khi API lỗi/chậm.
- Unread count, dropdown, mark read và mark all cần kiểm tra theo API hiện có.
- Toast feedback chưa chắc đồng đều giữa Student, Instructor và Admin.
- Notification type có thể còn hẹp, thiếu instructor request, Q&A answer, payout, support, admin system events.
- Admin notification history cần filter sâu nhưng không phải P0 nếu route demo khác chưa ổn.
- Notification routing metadata có thể default sai role/resource.
- Nội dung thông báo còn nguy cơ mojibake hoặc tiếng Anh kỹ thuật.
- Không được spam notification khi event idempotent bị gọi lại.

## 4. Hướng xử lý đề xuất

### UI/UX

- P0: toast feedback cho mọi action demo chính, bell không crash, dropdown có loading/empty/error, text tiếng Việt.
- P1: in-app notification cho instructor request, Q&A answer, payment/enrollment, payout nếu event/API có.
- P2: email status, admin history filter sâu, notification matrix mở rộng.
- Bell item có title, body, thời gian, read/unread và click route hợp lý.

### Routing

- Metadata notification route theo role/resource: order, course, lesson, question, instructor request, payout, ticket, system event.
- Nếu metadata thiếu, fallback theo role: student `/dashboard/overview`, instructor Studio route hiện hành, admin `/admin`.
- Không hardcode mọi notification về `/dashboard/overview`.

### Role permission

- User chỉ xem notification của mình.
- Admin history chỉ ADMIN truy cập.
- Notification click vẫn qua route guard; không cho xem resource ngoài quyền.

### Loading/empty/error state

- Bell initial loading không block navbar.
- Dropdown empty: “Bạn chưa có thông báo nào”.
- Lỗi tải: “Chưa tải được thông báo” kèm retry.
- Admin history có loading table, empty theo filter và error retry ở P2.

### Data/API integration

- Notification-service là source of truth.
- In-app notification chỉ tạo qua event/API đã có, không tạo record giả trong UI.
- Idempotency dùng `eventId` hoặc key nghiệp vụ để tránh duplicate.
- Email status chỉ hiển thị theo dữ liệu thật: SENT/FAILED/MOCKED/PENDING.

### Notification/toast

- Toast bắt buộc cho feedback tức thì.
- In-app notification dùng cho sự kiện cần lưu lại hoặc cần người dùng xử lý sau.
- Nội dung notification tiếng Việt có action và resource rõ.

### Responsive/mobile

- Bell dropdown không tràn viewport mobile.
- Admin history filter xếp dọc trên mobile ở P2.
- Title/body line-clamp, không vỡ layout với text dài.

### Accessibility

- Bell icon có `aria-label` gồm số chưa đọc.
- Mark read button có label.
- Dropdown điều hướng keyboard được.
- Toast không phải kênh duy nhất cho lỗi form; lỗi field vẫn hiển thị tại form.

## 5. Task breakdown

- [ ] P0 rà `NotificationBell`: không crash khi API lỗi/chậm, loading/empty/error rõ, text tiếng Việt, dropdown không vỡ mobile.
- [ ] P0 rà `actions/notification.ts`: list/mark read/mark all gọi qua Gateway với auth, error handling an toàn.
- [ ] P0 chuẩn hóa toast Student: đăng ký, đăng nhập, gửi hồ sơ giảng viên, gửi câu hỏi, enroll, hoàn thành bài/khóa, nhận chứng chỉ, thanh toán thành công/thất bại.
- [ ] P0 chuẩn hóa toast Instructor: tạo khóa, lưu nháp, publish, upload media, trả lời Q&A, gửi payout.
- [ ] P0 chuẩn hóa toast Admin: approve/reject instructor request, payout update, support reply, system config update, retry/resolve event nếu endpoint có.
- [ ] P1 bổ sung in-app notification cho instructor request approved/rejected, Q&A answer, payment/enrollment, payout nếu backend/event/API hiện có.
- [ ] P1 cập nhật route metadata/fallback theo role để click notification không vào route lỗi.
- [ ] P1 chống spam notification bằng eventId/idempotency key cho payment, enrollment, lesson completion, payout, instructor request.
- [ ] P2 nâng `/admin/notifications`: filter type/status/channel/date, delivery status email/in-app, detail metadata an toàn.
- [ ] P2 mở rộng notification matrix cho support ticket, review, revenue, system event, community moderation nếu service hỗ trợ.

## 6. Acceptance Criteria

- P0: Toast xuất hiện sau action demo chính ở Student, Instructor, Admin.
- P0: Notification bell không crash khi API lỗi/chậm hoặc user chưa có notification.
- P0: Nếu API có, unread count, mark read và mark all hoạt động đúng.
- P0: Text notification/toast là tiếng Việt có dấu, không mojibake.
- P1: In-app notification hoạt động cho instructor request, Q&A answer, payment/enrollment và payout khi event/API có.
- P1: Click notification điều hướng đúng resource hoặc fallback đúng theo role.
- P1: Không duplicate notification khi event lặp/idempotent action gọi lại.
- P2: `/admin/notifications` có filter sâu và delivery status rõ nếu API hỗ trợ.
- Không fake email sent hoặc in-app notification nếu service chưa tạo record thật.

## 7. Manual Test Checklist

- [ ] Login STUDENT, mở header, kiểm tra bell count và dropdown khi chưa có notification.
- [ ] Giả lập notification API lỗi; bell không crash navbar, dropdown có error/retry.
- [ ] Enroll/free hoặc payment demo; kiểm tra toast và notification nếu event hỗ trợ.
- [ ] Hoàn thành lesson; kiểm tra toast, progress và notification nếu service hỗ trợ.
- [ ] Gửi Q&A, instructor trả lời; student nhận toast/notification nếu event hỗ trợ và click tới route đúng.
- [ ] Gửi hồ sơ giảng viên; admin approve/reject; student thấy toast/notification trạng thái nếu event hỗ trợ.
- [ ] Login INSTRUCTOR, tạo draft, publish, upload media fail/success; toast đúng.
- [ ] Login ADMIN, approve/reject request, update payout/config/system event; toast đúng và không báo success giả.
- [ ] Bấm mark one read; count giảm đúng. Bấm mark all; count về 0 nếu API có.
- [ ] Mobile: bell dropdown không tràn viewport.
- [ ] P2: mở `/admin/notifications`, lọc theo channel/status/type nếu API hỗ trợ.

## 8. Demo Script Impact

Toast giúp người demo không phải giải thích “click đã chạy chưa”. In-app notification nối các role với nhau: student gửi hồ sơ, admin duyệt, student nhận kết quả; student hỏi Q&A, instructor trả lời, student được báo. Ưu tiên P0 đảm bảo demo không vỡ dù notification event chưa phủ đủ.

## 9. Rủi ro & lưu ý

- Event coverage phụ thuộc backend/Kafka; không fake notification production.
- Polling quá dày gây tải; giữ interval hợp lý hoặc refresh khi mở dropdown.
- Metadata route sai có thể đưa user vào 404/forbidden; cần fallback theo role.
- Duplicate event từ payment/Kafka/retry có thể tạo spam nếu thiếu idempotency.
- Email transport có thể chưa cấu hình; chỉ hiển thị trạng thái thật.
- Toast không thay thế validation/error state trong form.
- Nội dung notification không leak payload kỹ thuật, token, trace hoặc dữ liệu nhạy cảm.
