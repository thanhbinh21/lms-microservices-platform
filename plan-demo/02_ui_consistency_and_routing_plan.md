# Demo-Ready UI Consistency And Routing Plan

## 1. Mục tiêu

Chuẩn hóa UI consistency, role navigation và routing toàn hệ thống để demo không bị đứt bởi header/sidebar/footer link sai, route 404, text mojibake, layout lệch, thiếu loading/empty/error state hoặc accessibility cơ bản.

Plan này là lớp nền P0 vì nó ảnh hưởng mọi role: Guest, Student, Instructor và Admin.

## 2. Phạm vi

- Shared UI: `SharedNavbar`, `SharedFooter`, `NotificationBell`, reusable `EmptyState`, loading/error pages, page headers/breadcrumbs.
- Student navigation: `/dashboard` layout/nav, `/dashboard/courses`, `/dashboard/qa`, `/dashboard/support`, `/dashboard/certificates`.
- Instructor navigation: `(instructor)` layout/sidebar hiện tại và branding “Studio”.
- Admin navigation: `(admin)` layout/sidebar, admin overview cards, admin route labels.
- Public routes: `/`, `/courses`, `/instructors`, `/community`, `/support`, `/help`, `/login`, `/register`, `/profile`.
- Output bắt buộc của phase audit: `plan/demo_ready_route_audit_report.md`.

## 3. Vấn đề hiện tại

- Header role Guest/Student/Instructor/Admin chưa có matrix rõ; dễ thiếu CTA “Quản trị” cho ADMIN hoặc nhầm Dashboard/Studio.
- Public support route phải chốt `/support`; `/help` nếu tồn tại redirect `/support`.
- Instructor route `/instructor` dễ nhầm với `/instructors`; trước demo ưu tiên branding “Studio”, không migrate route lớn nếu rủi ro.
- Admin sidebar còn rủi ro label kỹ thuật như `Audit log`, `DLQ hệ thống`.
- Text UI có nguy cơ mojibake hoặc tiếng Anh kỹ thuật.
- Page title, breadcrumb, container, spacing chưa chắc đồng nhất giữa public, dashboard, Studio, admin.
- Header/sidebar/footer có thể chứa link chết sau nhiều phase refactor.
- Mobile sidebar/drawer có nguy cơ che nội dung hoặc thiếu close/focus handling.
- Icon-only buttons có thể thiếu `aria-label`; modal/form có thể thiếu accessibility state.

## 4. Hướng xử lý đề xuất

### UI/UX

- Định nghĩa role nav matrix làm source of truth cho header/sidebar.
- Chuẩn hóa page frame: title, subtitle, breadcrumb nếu cần, container max width, action area.
- Dùng shared EmptyState/Skeleton/Error pattern.
- Tất cả UI text người dùng thấy phải là tiếng Việt có dấu.

### Routing

- Tạo `plan/demo_ready_route_audit_report.md` trước khi sửa code routing.
- Route audit report phải liệt kê: source link/component, target route, role, status `OK` / `Missing` / `Redirect` / `Protected` / `Needs Fix`, action cần sửa.
- Chia report theo Guest, Student, Instructor, Admin.
- Public support route: `/support`; `/help` redirect `/support`; `/dashboard/support` giữ cho authenticated ticket.
- Studio branding: trước demo có thể giữ `/instructor/*` nhưng UI gọi là Studio; nếu tạo `/studio/*` phải giữ `/instructor/*`.

### Role permission

- Guest nav: Trang chủ, Khóa học, Giảng viên, Cộng đồng, Hỗ trợ, Đăng nhập/Đăng ký.
- Student nav: Dashboard, Khóa học của tôi, Cộng đồng, Q&A, Hỗ trợ, Thông báo, Hồ sơ.
- Instructor nav: Studio, Khóa học, Q&A, Doanh thu, Thông báo, Hồ sơ.
- Admin nav: Quản trị, Người dùng, Khóa học, Giảng viên, Doanh thu, Hệ thống, Thông báo, Hồ sơ.
- UI guard không thay backend guard; protected route vẫn qua Gateway/auth.

### Loading/empty/error state

- Mỗi route demo chính có loading state hoặc skeleton.
- Empty state gồm icon, title, mô tả ngắn, CTA phù hợp.
- Error state có retry, message dễ hiểu và không lộ stack trace.

### Data/API integration

- Không dùng hardcode dữ liệu quan trọng để lấp UI trống.
- Nếu API thiếu dữ liệu, hiển thị empty/fallback có kiểm soát và ghi dependency.
- Server Actions gọi Gateway đúng token, không tự inject header user từ client.

### Notification/toast

- Toast thống nhất tone và tiếng Việt sau action quan trọng.
- Notification bell hiện diện cho role đã login, không hiện cho guest nếu API yêu cầu auth.

### Responsive/mobile

- Header mobile đóng menu khi click link, Escape close nếu là drawer/dialog.
- Sidebar admin/Studio chuyển drawer; content không bị overlay sau khi đóng.
- Table chuyển scroll/card view có chủ đích.

### Accessibility

- Focus-visible rõ cho link/button/input.
- Icon button có `aria-label`.
- Dialog/modal có role, aria-modal, focus trap.
- Active nav có `aria-current="page"`.

## 5. Task breakdown

- [ ] Tạo/cập nhật `plan/demo_ready_route_audit_report.md` với bảng audit theo Guest, Student, Instructor, Admin.
- [ ] Rà `SharedNavbar`: Guest/Student/Instructor/Admin nav, CTA Dashboard/Studio/Quản trị, notification/profile/logout.
- [ ] Chuẩn hóa support routing: `/support` public, `/help` redirect, `/dashboard/support` private.
- [ ] Chuẩn hóa Studio branding: label/header/sidebar gọi “Studio”; route `/instructor/*` vẫn an toàn trước demo.
- [ ] Rà admin sidebar labels: đổi “Audit log”, “DLQ”, “System Config”, “Retry”, “Resolve” sang tiếng Việt dễ hiểu.
- [ ] Crawl header/sidebar/footer/card links bằng route list hiện có; ghi link chết vào audit report.
- [ ] Chuẩn hóa page title/breadcrumb/container cho public, dashboard, Studio, admin.
- [ ] Chuẩn hóa loading/empty/error state cho route demo: `/`, `/courses`, `/instructors`, `/community`, `/support`, `/learn/...`, `/instructor` hoặc `/studio`, `/admin`.
- [ ] Rà mojibake và tiếng Anh kỹ thuật trong UI.
- [ ] Rà responsive mobile/tablet: header menu, sidebar drawer, table/card, form/wizard, learn page.
- [ ] Rà accessibility: focus state, `aria-label`, `aria-current`, dialog/modal, form error.

## 6. Acceptance Criteria

- `plan/demo_ready_route_audit_report.md` tồn tại và có bảng theo Guest, Student, Instructor, Admin.
- Không có link từ header/sidebar/footer dẫn tới 404 trong các role demo.
- Guest nav đúng: Trang chủ, Khóa học, Giảng viên, Cộng đồng, Hỗ trợ, Đăng nhập/Đăng ký.
- Student nav đúng: Dashboard, Khóa học của tôi, Cộng đồng, Q&A, Hỗ trợ, Thông báo, Hồ sơ.
- Instructor nav gọi là Studio; `/instructor/*` không làm demo lỗi.
- Admin nav có Quản trị và các module chính.
- Public support route là `/support`; `/help` redirect `/support`.
- Text UI trong nav/layout/page title là tiếng Việt có dấu, không mojibake.
- Mỗi route demo quan trọng có loading/empty/error state.
- Mobile header/sidebar dùng được ở 375px, tablet và desktop.

## 7. Manual Test Checklist

- [ ] Guest desktop: mở `/`, click từng nav item header/footer; không có 404.
- [ ] Guest mobile 375px: mở menu, click Trang chủ/Khóa học/Giảng viên/Cộng đồng/Hỗ trợ/Đăng nhập/Đăng ký; menu đóng đúng.
- [ ] Mở `/help`; redirect sang `/support`.
- [ ] Student login: header hiển thị Dashboard, Thông báo, Hồ sơ; dashboard nav active đúng.
- [ ] Student click Hỗ trợ; vào `/dashboard/support` từ dashboard hoặc `/support` từ public nav theo ngữ cảnh.
- [ ] Instructor login: header hiển thị Studio; mở Studio sidebar, click các route chính; không lỗi.
- [ ] Admin login: header có “Quản trị”; click vào `/admin`; sidebar labels tiếng Việt dễ hiểu.
- [ ] Admin sidebar click Người dùng, Khóa học, Giảng viên, Doanh thu, Hệ thống, Thông báo; không 404.
- [ ] Dùng keyboard Tab qua header, sidebar, form, dialog; focus state nhìn rõ.
- [ ] Kiểm tra icon buttons: menu, notification, close, mark read, action table có aria-label/title phù hợp.

## 8. Demo Script Impact

Plan này giảm rủi ro lớn nhất trước demo: người trình bày click vào route chết, role không thấy action cần dùng hoặc màn hình có text lỗi. Route audit report tạo checklist rõ để sửa ít nhưng đúng điểm nghẽn.

## 9. Rủi ro & lưu ý

- Route conflict `/help` và `/support`; đã chốt `/support` public.
- Route conflict `/instructor` và `/instructors`; trước demo ưu tiên branding “Studio”, không xóa `/instructor/*`.
- Header role guard có thể stale; backend guard vẫn bắt buộc.
- Một số route tồn tại nhưng data API thiếu; cần empty/error state thay vì hardcode.
- Đổi label admin không được đổi nhầm API path hoặc event name nội bộ.
- Mobile drawer/focus có thể regress nếu chỉ test desktop.
