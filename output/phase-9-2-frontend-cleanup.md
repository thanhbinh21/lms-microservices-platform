# Phase 9.2 - Frontend Cleanup (Web Client)

## 1. Muc tieu thay doi
Hoan tat cleanup Frontend theo roadmap Phase 9.2 de tang tinh dong nhat UI, nang cao kha nang su dung tren mobile, va bo sung route chi tiet khoa hoc public.

## 2. Pham vi file/code bi anh huong
- apps/web-client/src/components/shared/shared-navbar.tsx
- apps/web-client/src/components/shared/shared-footer.tsx
- apps/web-client/src/app/page.tsx
- apps/web-client/src/app/courses/page.tsx
- apps/web-client/src/app/courses/[slug]/page.tsx
- apps/web-client/src/app/courses/[slug]/loading.tsx
- apps/web-client/src/app/courses/[slug]/error.tsx
- apps/web-client/src/app/loading.tsx
- apps/web-client/src/app/error.tsx
- apps/web-client/src/app/(instructor)/loading.tsx
- apps/web-client/src/app/(instructor)/error.tsx
- apps/web-client/src/app/(instructor)/layout.tsx
- apps/web-client/src/app/actions/instructor.ts
- apps/web-client/src/app/(instructor)/instructor/courses/[courseId]/page.tsx
- apps/web-client/src/app/(instructor)/instructor/courses/[courseId]/curriculum/page.tsx
- project_overview.md

## 3. Quyet dinh ky thuat quan trong va ly do
- Tach SharedNavbar/SharedFooter ra component dung chung cho trang public de giam lap code va de bao tri.
- Tao route `/courses/[slug]` theo App Router de ho tro deep-link cho trang chi tiet khoa hoc.
- Bo sung Error Boundary va loading theo segment (`app/`, `(instructor)`, `courses/[slug]`) de xu ly trang thai loi/tai du lieu ro rang hon.
- Refactor instructor layout bo sung:
  - Active sidebar theo `usePathname` de nguoi dung xac dinh vi tri hien tai.
  - Mobile menu drawer de su dung duoc tren man hinh nho.
- Hoan thien CRUD curriculum cho Phase 7.5:
  - Them server actions cho `updateChapter`, `deleteChapter`, `deleteLesson`.
  - Noi action vao UI editor curriculum (button Sua/Xoa chapter, Xoa lesson).

## 4. Huong dan migrate/deploy
Khong co migration DB cho Phase 9.2.

Buoc xac nhan truoc deploy frontend:
1. Build web-client:
   - `pnpm --filter web-client build`
2. Kiem tra route da duoc tao:
   - `/courses/[slug]`
3. Kiem tra nhanh UX:
   - Public Navbar/Footer dung chung tren `/` va `/courses`
   - Sidebar instructor co active state va mobile drawer
   - Curriculum co the sua/xoa chapter, xoa lesson

## 5. Demo luong du lieu end-to-end
1. User truy cap `/courses`.
2. Tu card khoa hoc, user mo trang `/courses/[slug]`.
3. Route slug goi `getPublicCourseDetailAction` qua Kong va render giao trinh.
4. Instructor vao `/instructor/courses/[courseId]/curriculum`:
   - Sua/Xoa chapter va xoa lesson qua server actions.
   - UI cap nhat state ngay sau response API thanh cong.

## 6. Truoc va sau khi thay doi
Truoc:
- Header/Footer bi lap lai o nhieu page.
- Chua co route chi tiet khoa hoc theo slug.
- Layout instructor chua co active sidebar va mobile menu.
- Curriculum chua noi day du action edit/delete chapter/lesson.
- Chua co loading.tsx/error.tsx theo segment.

Sau:
- SharedNavbar/Footer duoc tai su dung.
- Co route `/courses/[slug]` hoat dong.
- Instructor UX tot hon tren desktop/mobile.
- Curriculum CRUD day du hon cho use-case giang vien.
- Co fallback loading/error ro rang cho cac segment quan trong.

## 7. Ket qua kiem thu
- Da build thanh cong: `pnpm --filter web-client build`
- Next.js route manifest xac nhan co:
  - `/courses/[slug]`
  - `/instructor/courses/[courseId]/curriculum`

## 8. Hotfix bo sung - tao khoa hoc that bai
Van de:
- Trang `/instructor/courses/create` co the that bai im lang khi access token het han, vi instructor action chua co co che refresh token tu dong.

Xu ly:
- Bo sung refresh token flow trong `apps/web-client/src/app/actions/instructor.ts`:
   - Thu lay `accessToken` tu cookie.
   - Neu thieu/401, goi `/auth/refresh` de lay token moi va retry request.
- Bo sung hien thi thong bao loi tren UI create course (`apps/web-client/src/app/(instructor)/instructor/courses/create/page.tsx`) de nguoi dung biet ro nguyen nhan that bai.

Ket qua:
- Flow tao khoa hoc o trang create khong con bi fail im lang.
- Build web-client van pass sau hotfix.

## 9. Hotfix bo sung - loi gateway `No mandatory 'kid' in claims`
Van de:
- Khi tao khoa hoc, request qua Kong bi chan voi loi `No mandatory 'kid' in claims`.
- Nguyen nhan la JWT plugin tren route `course-service` dang bat buoc claim `kid`, trong khi token tu auth-service khong phat hanh claim nay.
- Sau khi bo jwt plugin, request-transformer tiep tuc loi do template header dung cu phap sai voi key co dau `-`.

Xu ly:
- Cap nhat Kong route cho `course-service`:
   - Bo plugin `jwt` cau hinh sai claim `kid`.
   - Sua template request-transformer sang bracket notation:
      - `x-user-id:$(headers['x-user-id'])`
      - `x-user-role:$(headers['x-user-role'])`
- Cap nhat BFF action trong `apps/web-client/src/app/actions/instructor.ts`:
   - Decode access token de trich `userId`, `role`.
   - Gui kem header `x-user-id`, `x-user-role` cho request can auth.
   - Neu gap 401 thi refresh token va retry request.

Ket qua:
- Da test tao khoa hoc thanh cong qua Kong (HTTP 201, `Course created successfully`).
- Khong con thong bao `No mandatory 'kid' in claims` tren UI create course.

## 10. Hotfix bo sung - hoan thien UX course settings/curriculum va du lieu demo
Van de:
- Trang settings chua ho tro upload thumbnail truc tiep, phai dan URL thu cong.
- Trang curriculum de gay nham lan khi giang vien chua biet "chon bai hoc muc tieu" truoc khi gan YouTube.
- Nhieu thao tac van dung `window.alert`, trai nghiem khong dong nhat.
- Can 1 course mau day du de test nhanh end-to-end flow giang vien.

Xu ly:
- Cap nhat `apps/web-client/src/app/actions/instructor.ts`:
   - Them action `requestCourseThumbnailUploadAction` de xin presigned URL voi `type: IMAGE`.
- Cap nhat `apps/web-client/src/app/(instructor)/instructor/courses/[courseId]/page.tsx`:
   - Bo sung nut upload thumbnail, upload qua presigned URL, xac nhan upload va auto dien URL thumbnail.
   - Thay thong bao `alert` bang `StatusMessage` cho save/publish/upload.
- Cap nhat `apps/web-client/src/app/(instructor)/instructor/courses/[courseId]/curriculum/page.tsx`:
   - Thay toan bo `alert` quan trong bang `StatusMessage`.
   - Bo sung helper text lam ro luong "chon bai hoc muc tieu".
   - Tu dong chon bai hoc vua tao de giang vien co the upload/gian YouTube ngay.
- Seed du lieu mau trong `course_db` (idempotent):
   - Instructor: `7af8100e-a1a8-488a-8466-596d44986dcb`
   - Slug khoa hoc: `khoa-hoc-mau-day-du-phase-9-2`
   - 2 chapter, 3 lesson, gan YouTube URL:
      - `https://www.youtube.com/watch?v=jDsgGt9pV94&list=RDjDsgGt9pV94&start_radio=1`

Ket qua:
- Giang vien co the upload thumbnail ngay tren trang settings thay vi nhap tay URL.
- Luong thao tac curriculum ro rang hon, giam loi thao tac sai bai hoc.
- Thong bao loi/thanh cong dong nhat theo UI component.
- Co du lieu mau day du de QA regression nhanh cho flow tao/chinh sua khoa hoc.
- Build xac nhan pass: `pnpm --filter web-client build`.

## 11. Chuan hoa status UI toan he thong
Muc tieu:
- Kiem tra he thong da co component thong bao status dung chung chua.
- Chuan hoa cac thong bao trang thai theo design token thay vi thong bao native roi rac.

Xu ly:
- Xac nhan component dung chung da ton tai: `apps/web-client/src/components/ui/status-message.tsx`.
- Cap nhat style `StatusMessage` theo token he thong:
   - Success: su dung `primary` tone (`bg-primary/10`, `border-primary/25`, `text-primary`).
   - Error: su dung `destructive` tone (`bg-destructive/10`, `border-destructive/25`, `text-destructive`).
- Cap nhat `apps/web-client/src/app/(instructor)/instructor/courses/create/page.tsx` de su dung `StatusMessage` thay cho `<p className="text-destructive">` thu cong.
- Loai bo alert native con sot lai trong curriculum upload center, thay bang `showStatus(...)`.

Ket qua audit:
- Da khong con `window.alert` trong `apps/web-client/src/**`.
- Cac man hinh dang su dung `StatusMessage`: login, register, course settings, curriculum, create course.
- Van con `window.confirm/window.prompt` trong curriculum editor cho cac thao tac xac nhan/chinh sua nhanh; day la scope UI interaction va co the tiep tuc chuyen sang Dialog cua Shadcn o buoc tiep theo.

Kiem thu:
- `pnpm --filter web-client build` pass sau khi chuan hoa status UI.

## 12. Dong bo UI theo design-tokens
Muc tieu:
- Dong bo hieu ung giao dien tren cac layout dung chung de tang do nhat quan va trai nghiem visual.

Xu ly:
- Cap nhat `apps/web-client/src/app/globals.css` theo token `glassmorphism-heavy`:
   - Tang cuong nen `glass-page` voi gradient + grid overlay.
   - Chuan hoa `glass-panel` theo cac gia tri da dinh nghia trong token (background, blur+saturate, border, shadow, shine overlay).
   - Them `glass-navbar` utility va typography utility (`token-page-title`, `token-section-title`, `token-body`).
- Cap nhat `apps/web-client/src/components/shared/shared-navbar.tsx`:
   - Dung `glass-navbar` cho thanh dieu huong.
   - Mobile menu dung `glass-panel` de dong bo mat kinh.
- Cap nhat `apps/web-client/src/components/shared/shared-footer.tsx`:
   - Chuyen footer sang `glass-panel`, can chinh spacing/typography theo token.
- Cap nhat `apps/web-client/src/app/(instructor)/layout.tsx`:
   - Dung `glass-page` + `glass-navbar` + `glass-panel` cho shell giang vien.

Ket qua:
- Header/footer/layout giang vien dong nhat cung 1 he visual token.
- Hieu ung blur, border, shadow va nen duoc chuan hoa o tang dung chung thay vi style roi rac.
- Build xac nhan pass: `pnpm --filter web-client build`.
