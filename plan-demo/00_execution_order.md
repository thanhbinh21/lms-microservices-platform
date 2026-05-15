# Demo-Ready Execution Order

## 1. Mục tiêu

Chốt thứ tự triển khai trước demo để giảm rủi ro route lỗi, Unauthorized, UI chết và action báo thành công giả. Tài liệu này điều phối 5 plan demo-ready hiện có, chưa phải code implementation.

## 2. P0/P1/P2 Priority Trước Demo

### P0 - Bắt buộc trước demo

- Route/header/sidebar/footer không có 404 cho Guest, Student, Instructor, Admin.
- Public support route là `/support`; `/help` redirect `/support`; `/dashboard/support` giữ cho ticket cá nhân.
- Admin có CTA “Quản trị” vào `/admin`.
- Instructor UI gọi là “Studio”; `/instructor/*` vẫn không lỗi.
- `/become-instructor` dùng hồ sơ `InstructorRequest`, không tự nâng role.
- `/learn/[courseId]/lesson/[lessonId]` không chết khi thiếu video/content, chưa enroll, lesson không tồn tại hoặc API chậm.
- Toast feedback cho action demo chính.
- Notification bell không crash navbar.
- Text demo chính là tiếng Việt có dấu, không mojibake.

### P1 - Nên làm để demo thuyết phục

- `/instructors` có search/filter/sort và empty/loading state.
- `/community` rõ feed toàn hệ thống, có composer/reply/reaction nếu API hỗ trợ.
- Studio course wizard không kẹt category/certificate/media/publish guard.
- `/admin/instructor-requests` list/detail/approve/reject end-to-end.
- Admin revenue/notifications/system pages có layout và empty/error state rõ.
- In-app notification cho instructor request, Q&A answer, payment/enrollment, payout nếu event/API có.

### P2 - Làm nếu còn thời gian

- Alias route `/studio/*` đầy đủ, kèm redirect `/instructor/*`.
- `/admin/community` moderation nếu community-service có endpoint owner.
- Admin notification history filter sâu.
- Email delivery status và notification matrix mở rộng.
- Responsive polish sâu cho table/card/wizard.
- Accessibility audit chi tiết ngoài route demo chính.

## 3. Thứ tự Implement Khuyến Nghị

1. `demo_ready_ui_consistency_and_routing_plan.md`
   - Tạo/cập nhật `demo_ready_route_audit_report.md`.
   - Sửa route/link P0: `/support`, `/help`, admin CTA, Studio branding.

2. `demo_ready_student_experience_plan.md`
   - Ưu tiên `/become-instructor`, `/learn/[courseId]/lesson/[lessonId]`, `/support`, `/dashboard/support`.

3. `demo_ready_instructor_studio_plan.md`
   - Ưu tiên branding Studio và course wizard stability.
   - Không migrate route vật lý lớn nếu sát demo.

4. `demo_ready_admin_operations_plan.md`
   - Ưu tiên `/admin/instructor-requests`, admin CTA, revenue/notifications/system empty state.
   - Chỉ implement mutation có endpoint owner service.

5. `demo_ready_notification_system_plan.md`
   - P0 toast và bell stability làm song song với các plan trên.
   - P1/P2 in-app/email làm sau khi action chính ổn.

## 4. Demo Script Smoke Test

### Guest

- Mở `/`.
- Click Khóa học, Giảng viên, Cộng đồng, Hỗ trợ.
- Mở `/help`, xác nhận redirect `/support`.
- Click Đăng nhập, Đăng ký.
- Mở `/become-instructor`, thấy yêu cầu đăng nhập, không Unauthorized.

### Student

- Login STUDENT.
- Mở `/dashboard`, `/dashboard/courses`, `/dashboard/qa`, `/dashboard/support`.
- Tạo support ticket cá nhân.
- Mở `/become-instructor`, gửi hồ sơ, thấy trạng thái chờ duyệt.
- Mở course đã enroll, vào `/learn/[courseId]/lesson/[lessonId]`, hoàn thành bài.
- Đặt câu hỏi Q&A theo khóa/bài.
- Kiểm tra toast và notification bell không crash.

### Instructor

- Login INSTRUCTOR.
- Click Studio từ header.
- Mở overview, courses, create course, Q&A, analytics/revenue, profile/settings.
- Tạo draft course, upload thumbnail/video demo, thử publish guard.
- Trả lời một Q&A.
- Gửi payout nếu đủ điều kiện hoặc thấy disable reason rõ.

### Admin

- Login ADMIN.
- Click Quản trị từ header.
- Mở `/admin/instructor-requests`, approve/reject một hồ sơ.
- Mở revenue, notifications, support, payouts, system, audit log.
- Retry/resolve system event nếu endpoint có.
- Mở community moderation nếu route/API có; nếu chưa có, thấy dependency/read-only state.

## 5. Route Bắt Buộc Không Được Lỗi Trước Demo

- `/`
- `/courses`
- `/courses/[slug]`
- `/instructors`
- `/instructors/[slug]`
- `/community`
- `/support`
- `/help` redirect `/support`
- `/login`
- `/register`
- `/profile`
- `/become-instructor`
- `/dashboard`
- `/dashboard/courses`
- `/dashboard/qa`
- `/dashboard/support`
- `/dashboard/certificates`
- `/learn/[courseId]`
- `/learn/[courseId]/lesson/[lessonId]`
- `/qa/[questionId]`
- `/instructor`
- `/instructor/courses`
- `/instructor/courses/create`
- `/instructor/qa`
- `/instructor/analytics`
- `/instructor/settings`
- `/instructor/profile`
- `/admin`
- `/admin/users`
- `/admin/courses`
- `/admin/categories`
- `/admin/reviews`
- `/admin/instructor-requests`
- `/admin/revenue`
- `/admin/notifications`
- `/admin/support`
- `/admin/payouts`
- `/admin/system-config`
- `/admin/audit-log`
- `/admin/system`

## 6. Việc Không Nên Làm Trước Demo Vì Rủi Ro Cao

- Không xóa `/instructor/*` hoặc migrate toàn bộ sang `/studio/*` nếu chưa có redirect và route audit đủ.
- Không fake admin mutation thành công khi backend/API chưa hỗ trợ.
- Không truy cập DB chéo từ frontend hoặc service khác để lấp UI.
- Không bypass Kong auth hoặc tự inject `x-user-id` từ client.
- Không sửa business logic payment/enrollment/payout nếu không liên quan trực tiếp tới UI demo.
- Không thêm major dependency hoặc thay đổi framework.
- Không nhúng hardcode production data để tạo cảm giác có dữ liệu.
- Không mở rộng email notification nếu SMTP/service chưa ổn định.
- Không làm redesign lớn toàn bộ visual system sát demo.
- Không thay đổi Kafka topic/event contract nếu không có test đủ.

## 7. Final Acceptance Checklist Trước Khi Demo

- [ ] Route audit report đã cập nhật và không còn P0 `Missing`/`Needs Fix`.
- [ ] Guest click toàn bộ header/footer không 404.
- [ ] Student học bài end-to-end không crash.
- [ ] Student gửi hồ sơ giảng viên đúng flow admin duyệt.
- [ ] Instructor vào Studio và tạo/publish draft không bị kẹt UI.
- [ ] Admin vào `/admin` từ header và duyệt hồ sơ giảng viên được.
- [ ] Toast xuất hiện sau action demo chính.
- [ ] Notification bell không crash khi API lỗi/chậm/empty.
- [ ] Text demo chính tiếng Việt có dấu, không mojibake.
- [ ] Mobile 375px không chồng layout ở header, learn page, Studio, admin.
- [ ] Không action nào báo success giả khi API chưa hỗ trợ.
- [ ] Không có thay đổi business logic payment/enrollment ngoài phạm vi được duyệt.
