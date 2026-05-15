# Demo-Ready Instructor Studio Plan

## 1. Mục tiêu

Đưa trải nghiệm giảng viên vào trạng thái demo-ready: instructor có thể vào Studio, xem tổng quan, quản lý khóa học, tạo khóa học, xử lý nội dung/media, xem phân tích, trả lời Q&A và gửi yêu cầu rút tiền mà không bị kẹt ở step, route mơ hồ hoặc thiếu phản hồi.

Route branding trước demo là “Studio”. Ưu tiên đổi label/header/sidebar và nội dung UI thành Studio; không bắt buộc migrate route vật lý lớn nếu rủi ro cao.

## 2. Phạm vi

- Route hiện tại: `/instructor`, `/instructor/courses`, `/instructor/courses/create`, `/instructor/courses/[courseId]`, `/instructor/courses/[courseId]/detail`, `/instructor/courses/[courseId]/curriculum`, `/instructor/analytics`, `/instructor/qa`, `/instructor/settings`, `/instructor/profile`, `/instructor/certificates`.
- Route mục tiêu nếu đủ thời gian: `/studio`, `/studio/courses`, `/studio/courses/create`, `/studio/analytics`, `/studio/qa`, `/studio/revenue`.
- Nếu tạo `/studio/*`, bắt buộc giữ backward compatibility cho `/instructor/*`.
- Nếu không đủ thời gian trước demo, giữ route vật lý `/instructor/*` nhưng toàn bộ UI gọi là “Studio”.
- Components có khả năng cần sửa: instructor layout/sidebar, `SharedNavbar`, `QaNavItem`, course wizard, course cards/table, curriculum editor, lesson editor, media upload controls, analytics cards/charts, payout panel, certificate template UI.
- Server Actions liên quan: `actions/instructor.ts`, `actions/qa.ts`, `actions/notification.ts`.

## 3. Vấn đề hiện tại

- `/instructor` là Studio giảng viên nhưng dễ nhầm với `/instructors` là danh sách giảng viên public.
- Header/action đang dùng “Studio” nhưng route vẫn là `/instructor`; cần chốt cách gọi trước demo.
- Migrate route vật lý sang `/studio/*` có thể gây route regression nếu làm gấp.
- Cần rà toàn bộ link cũ `/instructor/*` trước khi đổi route để tránh notification metadata/link cũ chết.
- Trang tổng quan Studio cần rõ số khóa học, khóa đã xuất bản, học viên mới, tổng học viên, đơn hàng, doanh thu, payout, Q&A chưa trả lời và thông báo quan trọng.
- `/instructor/courses` cần search, filter status/category, sort theo mới nhất/học viên/doanh thu/rating và action rõ.
- `/instructor/courses/create` dễ kẹt ở category, certificate template, media upload, validation hoặc publish.
- Nếu instructor muốn chọn danh mục chưa có, UI cần tạo/gửi đề xuất/hướng dẫn rõ.
- Nếu certificate template chưa có, cần mẫu mặc định, tạo template hoặc cho phép bỏ qua có giải thích.
- Analytics/revenue có nguy cơ empty hoặc số liệu 0 khó hiểu; cần empty state demo-friendly.
- Q&A instructor cần filter unanswered/resolved/course và CTA trả lời nhanh.

## 4. Hướng xử lý đề xuất

### UI/UX

- Dùng “Studio” nhất quán trong header, sidebar, title, breadcrumb, button và empty state.
- P0 trước demo: đổi label/header/sidebar thành Studio, không nhất thiết đổi route vật lý.
- Studio overview dùng KPI cards, chart nhẹ và danh sách việc cần làm.
- Course management dùng card/table với thumbnail, title, status, price, students, revenue, updatedAt.
- Course wizard chia step: Thông tin cơ bản, Nội dung, Giá và chứng chỉ, Xem lại và xuất bản.

### Routing

- Phương án an toàn trước demo: giữ `/instructor/*`, đổi toàn bộ UI text thành “Studio”.
- Phương án nếu còn thời gian: tạo `/studio/*` làm alias/route chính và redirect `/instructor/*` sang `/studio/*`.
- Không xóa `/instructor/*` trước demo.
- Cập nhật shared navbar, sidebar, CTA từ `/become-instructor`, dashboard và notification metadata theo lựa chọn route.

### Role permission

- Chỉ role INSTRUCTOR vào Studio; STUDENT redirect dashboard hoặc trang đăng ký giảng viên; ADMIN về `/admin`.
- Instructor chỉ xem/sửa khóa học, Q&A, earnings, payout của mình.
- Không dùng UI để bypass course ownership hoặc payout validation.

### Loading/empty/error state

- Skeleton cho overview, courses, create/edit, analytics, Q&A, settings/payout, certificates.
- Empty state cho instructor mới: chưa có khóa học, doanh thu, Q&A, payout, certificate template.
- Error state có retry khi API unavailable, không render trang trắng.

### Data/API integration

- Dùng publish guard API nếu đã có; UI checklist chỉ phản ánh rule backend.
- Media upload đi qua media-service, hiển thị pending/success/fail/retry.
- Category/certificate template lấy từ course-service; nếu thiếu API đề xuất category thì UI hiển thị dependency rõ.
- Analytics/revenue lấy từ payment/course/community services qua Server Actions, gọi song song khi có thể.

### Notification/toast

- Toast cho tạo khóa, lưu nháp, autosave, upload media, publish, tạo chapter/lesson, trả lời Q&A, lưu payout profile, gửi payout.
- In-app notification cho học viên mới, câu hỏi mới, review mới, doanh thu mới nếu notification service đã hỗ trợ.

### Responsive/mobile

- Sidebar Studio chuyển drawer trên mobile.
- Course wizard stepper không vỡ layout.
- Course table có responsive card view hoặc columns ẩn có chủ đích.

### Accessibility

- Wizard stepper có `aria-current`.
- Upload button, icon actions, menu actions có label.
- Confirm publish/archive/delete có dialog accessible.

## 5. Task breakdown

- [ ] P0 đổi branding UI thành “Studio” trong `SharedNavbar`, instructor layout/sidebar, page title, breadcrumb, CTA; không migrate route vật lý nếu chưa đủ thời gian.
- [ ] Rà link `/instructor/*`: đảm bảo không có link chết và active state đúng khi vẫn dùng route hiện tại.
- [ ] Nếu đủ thời gian, tạo alias/redirect `/studio/*` và giữ backward compatibility `/instructor/*`; không xóa route cũ trước demo.
- [ ] Nâng Studio overview: KPI cards, chart/timeline đơn giản, Q&A chưa trả lời, thông báo quan trọng; không fake doanh thu.
- [ ] Nâng `/instructor/courses` hoặc `/studio/courses`: search, filter status/category, sort, card/table rõ, action xem/sửa/publish/archive/analytics.
- [ ] Nâng course create wizard: step rõ, validation từng step, lưu nháp, xem trước, giữ dữ liệu khi chuyển step.
- [ ] Xử lý category: nếu instructor được tạo category thì dùng endpoint hiện có; nếu admin-only thì hiển thị “Gửi đề xuất danh mục” hoặc hướng dẫn chờ admin.
- [ ] Xử lý certificate template: chọn mẫu mặc định, tạo template nếu API có, hoặc cho phép bỏ qua có giải thích.
- [ ] Nâng media upload state: progress/pending/success/fail/retry; không bypass media-service.
- [ ] Nâng analytics, Q&A và payout: empty state rõ, toast sau mutation, disable reason khi chưa đủ điều kiện.
- [ ] Rà text Studio: tiếng Việt có dấu, bỏ mojibake, đổi label kỹ thuật sang từ dễ hiểu.

## 6. Acceptance Criteria

- Header/sidebar/page title của INSTRUCTOR gọi khu này là “Studio”.
- Trước demo, `/instructor/*` vẫn không 404.
- Nếu có `/studio/*`, `/instructor/*` redirect hoặc compatibility đầy đủ.
- Instructor mới thấy empty state và CTA tạo khóa học.
- Instructor có khóa học có thể tìm, lọc, sort và mở action chính.
- Wizard tạo khóa học không kẹt khi thiếu category/certificate template/media.
- Publish button chỉ enabled khi publish guard pass hoặc checklist còn thiếu hiển thị rõ.
- Upload thumbnail/video có trạng thái rõ và lỗi upload không làm mất dữ liệu form.
- Analytics/revenue/payout không hiển thị số giả; nếu không có data thì empty state demo-friendly.
- Không sửa logic thanh toán/enrollment trong phạm vi này.

## 7. Manual Test Checklist

- [ ] Login INSTRUCTOR mới, click “Studio” từ header; vào đúng overview và thấy empty state tạo khóa học.
- [ ] Mở `/instructor`, `/instructor/courses`, `/instructor/courses/create`; không 404.
- [ ] Nếu có `/studio`, mở `/studio` và `/studio/courses`; xác nhận compatibility với `/instructor/*`.
- [ ] Tạo draft course, chuyển qua lại các step; dữ liệu không mất.
- [ ] Publish khi thiếu thumbnail/chapter/lesson/price; checklist nêu rõ thiếu gì.
- [ ] Upload thumbnail thành công/thất bại; toast và trạng thái UI đúng.
- [ ] Chọn danh mục khi danh sách rỗng; UI có tạo/gửi đề xuất/hướng dẫn, không stuck.
- [ ] Chọn certificate template khi chưa có mẫu; UI có mẫu mặc định hoặc hướng dẫn rõ.
- [ ] Mở Q&A, lọc unanswered, trả lời câu hỏi; toast đúng.
- [ ] Mở revenue/payout, nhập amount hợp lệ/không hợp lệ; thấy disable reason hoặc toast lỗi rõ.

## 8. Demo Script Impact

Demo role giảng viên sẽ mạch lạc: student được duyệt thành instructor, vào Studio, tạo khóa, upload nội dung, publish, xem Q&A, xem doanh thu và gửi payout. Việc ưu tiên branding “Studio” trước giúp giảm nhầm lẫn với `/instructors` mà không tạo rủi ro route migration lớn sát demo.

## 9. Rủi ro & lưu ý

- Route conflict `/instructor` và `/instructors`; trước demo không xóa `/instructor/*`.
- Migrate sang `/studio/*` quá gấp có thể làm chết metadata notification và link cũ.
- Publish checklist chỉ ở UI là không đủ; UI phải dùng hoặc phản ánh backend guard.
- API thiếu category proposal/certificate template default có thể khiến wizard kẹt; cần fallback UX rõ.
- Upload media phụ thuộc media-service/Cloudinary; error state phải giữ draft data.
- Không sửa business logic payment/enrollment/payout accounting ngoài scope UI/UX và Server Action glue cần thiết.
