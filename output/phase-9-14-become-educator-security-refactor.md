# Phase 9.14 - Become Educator Security Refactor

## Muc tieu thay doi
- Loai bo rui ro privilege escalation tai endpoint doi role generic.
- Tach luong tu nang cap role cua user sang endpoint chuyen biet, chi cho phep STUDENT -> INSTRUCTOR.
- Giu endpoint doi role generic cho admin va bo sung guard bat buoc.
- Dong bo lai session/token sau khi upgrade role de frontend nhan role moi ngay lap tuc.

## Pham vi file/code bi anh huong
- services/auth-service/src/controllers/become-educator.controller.ts
- services/auth-service/src/middlewares/requireAdmin.ts
- services/auth-service/src/middleware/require-admin.ts
- packages/types/src/index.ts
- services/auth-service/src/index.ts
- services/auth-service/prisma/schema.prisma
- services/auth-service/prisma/migrations/20260421000000_add_became_instructor_at/migration.sql
- services/instructor-service/src/services/instructor.service.ts
- services/instructor-service/src/controllers/instructor.controller.ts
- apps/web-client/src/app/actions/auth.ts
- apps/web-client/src/components/instructor/BecomeInstructorForm.tsx
- apps/web-client/src/app/become-instructor/page.tsx
- project_overview.md

## Quyet dinh ky thuat quan trong va ly do
- Tao endpoint moi POST /become-educator trong auth-service:
  - Lay actorId tu header x-user-id (Gateway/Kong inject).
  - Khong doc userId tu body de tranh user nang role cho tai khoan khac.
  - Chi cho phep role hien tai la STUDENT.
- Them middleware requireAdmin tai auth-service:
  - Check x-user-role == ADMIN.
  - Reuse duoc qua import tu services khac ve sau.
- Protect PATCH /users/role:
  - Them requireAdmin vao route de endpoint generic khong con public.
- Audit trail cho become-educator:
  - Persist timestamp vao users.became_instructor_at.
  - Log audit event bang @lms/logger voi actorId, previousRole, newRole, traceId, timestamp.
- Rotate token/session khi doi role:
  - Revoke refresh token cu (deleteMany theo userId).
  - Tao cap token moi theo role INSTRUCTOR.
  - Tra accessToken trong ApiResponse va tra refresh token moi qua response header x-refresh-token de Server Action cap nhat cookie.
- Regression guard cho luong approve instructor request:
  - instructor-service khi goi auth-service /users/role da forward x-user-id + x-user-role de tuong thich voi requireAdmin moi.
- Addendum shared middleware (Apr 21, 2026):
  - Tach logic requireAdmin thanh factory createRequireAdmin() trong @lms/types de cac service co the tai su dung.
  - auth-service middleware local chi con import factory va export middleware cu the.

## Truoc va sau thay doi
- Truoc:
  - PATCH /users/role nhan userId + role tu body, khong auth guard.
  - User bat ky co the goi endpoint de nang role account khac.
  - Frontend become instructor di theo flow request moderation.
- Sau:
  - POST /become-educator la flow chuyen biet cho self-upgrade.
  - PATCH /users/role bi khoa boi requireAdmin.
  - Frontend become-instructor goi thang becomeEducatorAction, update Redux auth state, redirect /instructor.

## Huong dan migrate/deploy
1. Chay migration cho auth-service:
   - pnpm --filter @lms/auth-service prisma migrate deploy
2. Generate lai Prisma client auth-service:
   - pnpm --filter @lms/auth-service prisma generate
3. Deploy auth-service, instructor-service, web-client.
4. Dam bao Kong route /auth da cho phep POST (hien co) va request headers x-user-id/x-user-role duoc forward.

## Demo luong du lieu end-to-end
1. User dang nhap role STUDENT.
2. Frontend goi becomeEducatorAction.
3. Server Action goi POST /auth/become-educator qua Gateway kem x-user-id/x-user-role.
4. Auth-service:
   - Validate role hien tai.
   - Update role -> INSTRUCTOR.
   - Ghi became_instructor_at.
   - Revoke refresh token cu va tao token moi.
   - Return ApiResponse { user, accessToken } + header x-refresh-token.
5. Server Action cap nhat auth cookies + Redux state.
6. UI redirect sang /instructor.
