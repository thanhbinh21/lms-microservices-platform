# Demo-Ready Student Experience Plan

## 1. Mục tiêu

Đưa trải nghiệm học viên vào trạng thái demo-ready: người xem có thể đi từ trang chủ, khám phá khóa học, xem giảng viên, tham gia cộng đồng, gửi hỗ trợ, gửi hồ sơ giảng viên, đặt câu hỏi và học bài mà không gặp route lỗi, UI chết, text sai ngôn ngữ hoặc action không có phản hồi.

Trọng tâm là luồng học thật của STUDENT, đặc biệt `/learn/[courseId]/lesson/[lessonId]`, đồng thời giữ đúng kiến trúc microservices, Gateway auth, enrollment idempotent và payment price verification hiện có.

## 2. Phạm vi

- Public routes: `/`, `/courses`, `/courses/[slug]`, `/instructors`, `/instructors/[slug]`, `/community`, `/support`, `/help`, `/become-instructor`.
- Student routes: `/dashboard`, `/dashboard/courses`, `/dashboard/qa`, `/dashboard/support`, `/dashboard/certificates`, `/learn/[courseId]`, `/learn/[courseId]/lesson/[lessonId]`, `/qa/[questionId]`.
- Chốt route hỗ trợ: `/support` là public support route trước demo.
- `/help` nếu còn tồn tại thì redirect sang `/support`, không duy trì hai nội dung hỗ trợ public khác nhau.
- `/dashboard/support` giữ riêng cho user đã đăng nhập xem, gửi và theo dõi ticket cá nhân.
- Components có khả năng cần sửa: `SharedNavbar`, `SharedFooter`, `BecomeInstructorForm`, `NotificationBell`, `CourseGrid`, `SearchBar`, `SortDropdown`, `FilterSidebar`, `curriculum-sidebar`, `lesson-navigation`, `video-player`, `course-qa-section`, `empty-state`.
- Server Actions liên quan: `actions/discovery.ts`, `actions/instructor.ts`, `actions/community.ts`, `actions/learning.ts`, `actions/qa.ts`, `actions/support.ts`, `actions/notification.ts`.

## 3. Vấn đề hiện tại

- Trang `/` còn nguy cơ hardcode nội dung và số liệu marketing không nguồn; không được để số ảo như `500+`, `150k` nếu không có API/seed rõ.
- Trang chủ cần thể hiện rõ LMS: khóa học nổi bật, danh mục, giảng viên nổi bật, lợi ích học viên, CTA đăng ký, khám phá khóa học, trở thành giảng viên.
- `/instructors` cần search/filter/sort để học viên tìm giảng viên theo tên, chuyên môn, headline, số khóa học, rating, số học viên, mới nhất.
- `/community` cần rõ là feed cộng đồng toàn hệ thống, tách khỏi Q&A theo khóa học.
- Header/footer hiện không được trỏ về anchor hoặc route hỗ trợ lỗi; tất cả CTA hỗ trợ public phải về `/support`.
- `/become-instructor` phải dùng flow gửi hồ sơ `InstructorRequest` cho admin duyệt, không tự nâng role trực tiếp.
- Lỗi `Unauthorized - missing x-user-id header` có thể xuất hiện nếu Server Action gọi protected API thiếu token hoặc đi vòng ngoài Gateway.
- `/dashboard/qa` chưa đủ rõ “Đặt câu hỏi” hỏi theo khóa học/bài học hay cộng đồng.
- `/learn/[courseId]/lesson/[lessonId]` có nguy cơ thiếu state khi lesson không có video/content, chưa enrolled, lesson không tồn tại hoặc API chậm.
- Text UI còn nguy cơ mojibake hoặc tiếng Anh kỹ thuật; student UI phải là tiếng Việt có dấu.
- Loading/empty/error/success state chưa đồng đều giữa public pages, dashboard, Q&A, support và learn page.

## 4. Hướng xử lý đề xuất

### UI/UX

- Thiết kế `/` theo hướng LMS thực dụng: hero rõ, khóa học nổi bật từ API, danh mục, giảng viên nổi bật, lợi ích học viên và CTA chính/phụ.
- Không hiển thị số liệu tăng trưởng nếu không có API hoặc seed/demo data có kiểm soát.
- Chuẩn hóa page title, breadcrumb, container width, spacing và CTA cho student pages.
- `/learn/[courseId]/lesson/[lessonId]` ưu tiên nội dung học, sidebar curriculum, active lesson, progress, navigation trước/sau và CTA hoàn thành.

### Routing

- Public support route chính là `/support`.
- `/help` redirect sang `/support`; header/footer không trỏ `/help` trực tiếp nếu không cần.
- `/dashboard/support` chỉ dùng sau đăng nhập cho ticket cá nhân.
- `/become-instructor` phân nhánh guest/student/instructor/admin rõ ràng.
- `/dashboard/qa` mở form/modal có chọn khóa học/bài học đã enroll hoặc điều hướng tới lesson trước khi hỏi.

### Role permission

- Guest ở `/become-instructor`: chỉ thấy yêu cầu đăng nhập, không gọi protected API.
- Student: gửi hồ sơ `InstructorRequest`, xem trạng thái pending/rejected/approved.
- Instructor: không gửi lại hồ sơ, thấy CTA sang Studio.
- Admin: không dùng student flow, điều hướng về `/admin/instructor-requests` nếu cần xử lý.
- Learn/Q&A giữ enrollment gate: chỉ học viên đã enroll mới xem paid lesson hoặc hỏi trong khóa học.

### Loading/empty/error state

- Skeleton cho `/`, `/instructors`, `/community`, `/support`, `/dashboard/qa`, `/learn/...`.
- Empty state theo ngữ cảnh: chưa có khóa học, giảng viên, bài viết, câu hỏi, ticket, lesson.
- Error state phân biệt 401, 403, 404, 503 để demo không rơi vào màn hình lỗi chung.

### Data/API integration

- Course/instructor/category data lấy từ API qua Server Actions; fallback chỉ là seed/demo data có kiểm soát.
- Community dùng community-service feed toàn hệ thống; Q&A dùng community-service Q&A theo course/lesson.
- Support dùng auth-service support ticket; không tạo mock ticket production trong UI.
- Progress/certificate dùng learning-service; không tính progress từ client nếu API là source of truth.

### Notification/toast

- Toast bắt buộc cho gửi hồ sơ giảng viên, gửi ticket, gửi câu hỏi, reply, complete lesson, enroll/payment.
- In-app notification cho sự kiện quan trọng nếu service/event đã hỗ trợ: câu trả lời mới, course completed, certificate issued, payment success/failure.
- Nội dung tiếng Việt có dấu, nêu rõ kết quả và bước tiếp theo.

### Responsive/mobile

- `/learn/...` mobile dùng curriculum drawer/collapsible, không che video/content.
- `/community` và `/instructors` dùng filter drawer trên mobile.
- CTA quan trọng không bị đẩy khỏi viewport hoặc chồng nội dung.

### Accessibility

- Icon button có `aria-label`.
- Form support, hồ sơ giảng viên, Q&A có label và field error accessible.
- Modal đặt câu hỏi có role dialog, focus trap, Escape close.

## 5. Task breakdown

- [ ] Rà `/` và home components: thay hardcode quan trọng bằng API/seed có kiểm soát, bổ sung khóa học, danh mục, giảng viên, CTA; không sửa business logic course/enrollment.
- [ ] Chuẩn hóa support routing: tạo/dùng `/support`, redirect `/help` sang `/support`, cập nhật `SharedNavbar` và `SharedFooter`; giữ `/dashboard/support` cho ticket cá nhân.
- [ ] Nâng `/instructors` và `actions/instructor.ts`: search theo tên/chuyên môn/headline, filter danh mục nếu API hỗ trợ, sort theo course/rating/student/newest; không fake rating.
- [ ] Nâng `/community` và `actions/community.ts`: composer, list, reply, reaction, latest/popular filter, badge instructor/admin, empty/loading/error; không nhập nhằng với Q&A.
- [ ] Sửa `/become-instructor` và `BecomeInstructorForm`: dùng `createInstructorRequestAction`, `getMyPendingInstructorRequestAction`, hiển thị trạng thái hồ sơ; loại bỏ CTA nâng role trực tiếp.
- [ ] Làm rõ `/dashboard/qa`: nút “Đặt câu hỏi” mở form chọn khóa học/bài học đã enroll hoặc điều hướng tới lesson context.
- [ ] Nâng `/learn/[courseId]/lesson/[lessonId]`: video/content fallback, curriculum sidebar, active lesson, progress, previous/next, complete button, tabs nội dung/tài nguyên/Q&A/ghi chú nếu API có.
- [ ] Bổ sung toast/notification cho student actions quan trọng; không spam khi action idempotent gọi lại.
- [ ] Rà text student UI: sửa mojibake, bỏ tiếng Anh kỹ thuật, dùng tiếng Việt có dấu.

## 6. Acceptance Criteria

- Header/footer không dẫn tới 404 khi click Hỗ trợ; public support route là `/support`.
- `/help` redirect sang `/support` nếu route còn tồn tại.
- `/dashboard/support` vẫn hoạt động cho user đã đăng nhập xem/gửi ticket cá nhân.
- `/` không còn số liệu marketing không nguồn; data dùng API hoặc seed/demo data có kiểm soát.
- `/instructors` có search/filter/sort, loading skeleton, empty state và mobile layout dùng được.
- `/community` thể hiện rõ feed cộng đồng toàn hệ thống.
- `/become-instructor` không tự nâng role trực tiếp; guest được yêu cầu đăng nhập, student gửi hồ sơ, instructor được dẫn sang Studio.
- `/dashboard/qa` giải thích rõ ngữ cảnh câu hỏi và không cho gửi thiếu course/lesson khi bắt buộc.
- `/learn/[courseId]/lesson/[lessonId]` không chết khi thiếu video/content, lesson không tồn tại, chưa có quyền học hoặc API chậm.
- Text student UI là tiếng Việt có dấu, không mojibake ở route demo.

## 7. Manual Test Checklist

- [ ] Guest mở `/`, click Khóa học, Giảng viên, Cộng đồng, Hỗ trợ, Đăng nhập, Đăng ký; tất cả route render hợp lệ.
- [ ] Guest mở `/help`; được redirect sang `/support`.
- [ ] Guest mở `/support`; thấy FAQ/form hoặc CTA đăng nhập để theo dõi ticket.
- [ ] Student login, mở `/dashboard/support`, tạo ticket và xem lịch sử ticket cá nhân.
- [ ] Guest mở `/become-instructor`; thấy yêu cầu đăng nhập, không có Unauthorized.
- [ ] Student mở `/become-instructor`, gửi hồ sơ; thấy toast thành công và trạng thái chờ duyệt.
- [ ] Student đã gửi hồ sơ mở lại `/become-instructor`; thấy pending/rejected/approved đúng.
- [ ] Instructor mở `/become-instructor`; thấy CTA sang Studio, không gửi lại hồ sơ.
- [ ] Student mở `/instructors`, search/sort/filter; kết quả và empty state đúng.
- [ ] Student mở `/community`, đăng bài/reply/reaction nếu có; instructor/admin badge đúng.
- [ ] Student chưa enroll mở paid lesson; thấy error/CTA phù hợp, không xem nội dung bị khóa.
- [ ] Student đã enroll mở `/learn/[courseId]/lesson/[lessonId]`, chuyển bài, đánh dấu hoàn thành, reload; progress vẫn đúng.
- [ ] Mobile 375px: `/learn/...`, `/community`, `/instructors`, `/support` không chồng text/action.

## 8. Demo Script Impact

Demo student có câu chuyện liền mạch: vào trang chủ, tìm khóa học, xem giảng viên, tham gia cộng đồng, gửi hỗ trợ, gửi hồ sơ giảng viên, học bài, đặt câu hỏi, hoàn thành lesson và nhận phản hồi. Chốt `/support` giúp tránh lỗi route hỗ trợ ngay trong header/footer.

## 9. Rủi ro & lưu ý

- Route conflict giữa `/help`, `/support`, `/dashboard/support`; đã chốt `/support` public và `/dashboard/support` private.
- API thiếu rating/student count có thể làm filter/sort không chính xác; UI phải disable hoặc giải thích thay vì fake số.
- Role guard sai ở `/become-instructor` có thể cho student tự nâng role; bắt buộc dùng hồ sơ admin duyệt.
- Server Actions thiếu Authorization sẽ tái hiện lỗi thiếu `x-user-id`; mọi protected call phải qua Gateway với token.
- Community và Q&A dễ nhập nhằng; community là feed chung, Q&A là hỏi đáp theo course/lesson.
- Hardcode fallback chỉ dùng khi có seed/demo data kiểm soát, không nhúng dữ liệu giả production.
