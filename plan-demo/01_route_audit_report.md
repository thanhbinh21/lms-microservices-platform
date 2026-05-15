# Demo-Ready Route Audit Report

> Status values: `OK`, `Missing`, `Redirect`, `Protected`, `Needs Fix`.
> Má»¥c tiÃªu: dÃ¹ng lÃ m checklist trÆ°á»›c khi sá»­a code routing/UI. KhÃ´ng pháº£i káº¿t quáº£ test cuá»‘i cÃ¹ng.

## Guest

| Source link/component | Target route | Role | Status | Action cáº§n sá»­a |
| --- | --- | --- | --- | --- |
| `SharedNavbar` logo | `/` | Guest | OK | Smoke test render trang chá»§. |
| `SharedNavbar` nav â€œKhÃ³a há»câ€ | `/courses` | Guest | OK | Smoke test search/list course. |
| `SharedNavbar` nav â€œGiáº£ng viÃªnâ€ | `/instructors` | Guest | OK | Smoke test public instructor listing. |
| `SharedNavbar` nav â€œCá»™ng Ä‘á»“ngâ€ | `/community` | Guest | OK | XÃ¡c nháº­n feed public/protected behavior rÃµ. |
| `SharedNavbar` nav â€œHá»— trá»£â€ | `/support` | Guest | OK | Da chuyen link public support ve `/support`. |
| Legacy footer/header help link | `/help` | Guest | Redirect | Redirect `/help` sang `/support`. |
| Auth CTA â€œÄÄƒng nháº­pâ€ | `/login` | Guest | OK | Smoke test form render. |
| Auth CTA â€œÄÄƒng kÃ½â€ | `/register` | Guest | OK | Smoke test form render. |
| CTA â€œTrá»Ÿ thÃ nh giáº£ng viÃªnâ€ | `/become-instructor` | Guest | Protected | Guest tháº¥y yÃªu cáº§u Ä‘Äƒng nháº­p, khÃ´ng gá»i protected API. |

## Student

| Source link/component | Target route | Role | Status | Action cáº§n sá»­a |
| --- | --- | --- | --- | --- |
| Header CTA â€œDashboardâ€ | `/dashboard` | Student | Protected | Smoke test redirect náº¿u chÆ°a login vÃ  render náº¿u login. |
| Dashboard nav â€œKhÃ³a há»c cá»§a tÃ´iâ€ | `/dashboard/courses` | Student | Protected | Kiá»ƒm tra empty/loading/error. |
| Dashboard nav â€œQ&Aâ€ | `/dashboard/qa` | Student | Protected | LÃ m rÃµ form chá»n course/lesson. |
| Dashboard nav â€œHá»— trá»£â€ | `/dashboard/support` | Student | Protected | Giá»¯ ticket cÃ¡ nhÃ¢n, khÃ´ng thay báº±ng `/support`. |
| Dashboard nav â€œChá»©ng chá»‰â€ | `/dashboard/certificates` | Student | Protected | Smoke test empty/certificate list. |
| Public support nav | `/support` | Student | OK | DÃ¹ng cho FAQ/contact public. |
| Become instructor CTA | `/become-instructor` | Student | Protected | DÃ¹ng `InstructorRequest`, khÃ´ng tá»± nÃ¢ng role. |
| Course card â€œHá»c tiáº¿pâ€ | `/learn/[courseId]` | Student | Protected | Kiá»ƒm tra enrollment gate. |
| Lesson navigation | `/learn/[courseId]/lesson/[lessonId]` | Student | Protected | P0 khÃ´ng crash khi thiáº¿u video/content. |
| Q&A detail link | `/qa/[questionId]` | Student | Protected | Kiá»ƒm tra quyá»n xem theo course/enrollment. |
| Notification item fallback | `/dashboard` | Student | OK | Fallback theo role: student `/dashboard`, instructor `/instructor`, admin `/admin`. |

## Instructor

| Source link/component | Target route | Role | Status | Action cáº§n sá»­a |
| --- | --- | --- | --- | --- |
| Header CTA â€œStudioâ€ | `/instructor` | Instructor | Protected | Giá»¯ route an toÃ n; UI gá»i lÃ  Studio. |
| Optional Studio alias | `/studio` | Instructor | Missing | Chá»‰ táº¡o náº¿u Ä‘á»§ thá»i gian; giá»¯ redirect `/instructor`. |
| Studio sidebar â€œTá»•ng quanâ€ | `/instructor` | Instructor | Protected | Label â€œStudio/Tá»•ng quanâ€, smoke test active state. |
| Studio sidebar â€œKhÃ³a há»câ€ | `/instructor/courses` | Instructor | Protected | Search/filter/sort/empty state. |
| Course create CTA | `/instructor/courses/create` | Instructor | Protected | Wizard khÃ´ng káº¹t category/certificate/media. |
| Course detail | `/instructor/courses/[courseId]/detail` | Instructor | Protected | Kiá»ƒm tra ownership vÃ  publish guard. |
| Course curriculum | `/instructor/courses/[courseId]/curriculum` | Instructor | Protected | Kiá»ƒm tra lesson/chapter editor. |
| Studio sidebar â€œQ&Aâ€ | `/instructor/qa` | Instructor | Protected | Filter unanswered/resolved/course. |
| Studio sidebar â€œPhÃ¢n tÃ­châ€ | `/instructor/analytics` | Instructor | Protected | Empty state náº¿u chÆ°a cÃ³ data. |
| Studio sidebar â€œThanh toÃ¡nâ€ | `/instructor/settings` | Instructor | Protected | Payout disable reason rÃµ. |
| Studio sidebar â€œKÃªnh cá»§a tÃ´iâ€ | `/instructor/profile` | Instructor | Protected | Profile public channel. |
| Notification item fallback | `/instructor` | Instructor | OK | Fallback da role-aware, tuong thich route hien tai. |

## Admin

| Source link/component | Target route | Role | Status | Action cáº§n sá»­a |
| --- | --- | --- | --- | --- |
| Header CTA â€œQuáº£n trá»‹â€ | `/admin` | Admin | OK | Da bo sung CTA cho ADMIN o desktop va mobile. |
| Admin sidebar â€œTá»•ng quanâ€ | `/admin` | Admin | Protected | Smoke test overview. |
| Admin sidebar â€œNgÆ°á»i dÃ¹ngâ€ | `/admin/users` | Admin | Protected | Kiá»ƒm tra non-admin forbidden. |
| Admin sidebar â€œKhÃ³a há»câ€ | `/admin/courses` | Admin | Protected | Smoke test table/action state. |
| Admin sidebar â€œDanh má»¥câ€ | `/admin/categories` | Admin | Protected | KhÃ´ng fake mutation náº¿u API lá»—i. |
| Admin sidebar â€œÄÃ¡nh giÃ¡â€ | `/admin/reviews` | Admin | Protected | Smoke test filter/action state. |
| Admin sidebar â€œÄÆ¡n giáº£ng viÃªnâ€ | `/admin/instructor-requests` | Admin | Protected | P0 approve/reject flow. |
| Instructor request detail | `/admin/instructor-requests/[id]` | Admin | Protected | Detail, approve/reject, reject reason. |
| Admin sidebar â€œHá»— trá»£â€ | `/admin/support` | Admin | Protected | Ticket list/reply. |
| Admin sidebar â€œRÃºt tiá»nâ€ | `/admin/payouts` | Admin | Protected | Mutation chá»‰ khi payment endpoint cÃ³. |
| Admin sidebar â€œDoanh thuâ€ | `/admin/revenue` | Admin | Protected | Date range + empty/loading/error. |
| Admin sidebar â€œLá»‹ch sá»­ thÃ´ng bÃ¡oâ€ | `/admin/notifications` | Admin | Protected | P2 filter sÃ¢u náº¿u API há»— trá»£. |
| Admin sidebar â€œCáº¥u hÃ¬nh há»‡ thá»‘ngâ€ | `/admin/system-config` | Admin | Protected | Viá»‡t hÃ³a label, khÃ´ng leak secret. |
| Admin sidebar â€œNháº­t kÃ½ hoáº¡t Ä‘á»™ngâ€ | `/admin/audit-log` | Admin | Protected | Äá»•i label tá»« `Audit log`. |
| Admin sidebar â€œSá»± kiá»‡n lá»—i cáº§n xá»­ lÃ½â€ | `/admin/system` | Admin | Protected | Äá»•i label tá»« `DLQ`, action qua learning-service. |
| Planned admin community | `/admin/community` | Admin | Protected | Da co route read-only/dependency, khong co mutation gia. |

