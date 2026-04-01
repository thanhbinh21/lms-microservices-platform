# Phase 9.1 - BFF Pattern (Next.js)

## 1. Muc tieu thay doi
Chuan hoa vai tro BFF de web-client chi giao tiep voi Kong Gateway va khong goi truc tiep microservice tu client component.

## 2. Pham vi anh huong
- apps/web-client/src/app/actions/auth.ts
- apps/web-client/src/app/actions/instructor.ts
- apps/web-client/src/app/actions/dashboard.ts
- kong.yml

## 3. Quyet dinh ky thuat
- BFF dat tai Server Actions cua Next.js App Router.
- Mọi API call di qua GATEWAY_URL (mac dinh http://localhost:8000).
- JWT duoc xu ly o Gateway, service backend tin cay header x-user-id va x-user-role do Kong inject.
- Khong de client component chua logic giao tiep service de tranh ro ri token va tranh lap logic auth.

## 4. Luong du lieu
1. Browser goi action tu web-client.
2. Server Action goi Kong Gateway.
3. Kong route den auth-service, course-service, media-service.
4. Server Action tra du lieu da chuan hoa ve UI.

## 5. Huong dan ap dung/migrate
- Khi them endpoint moi, uu tien tao ham action trong apps/web-client/src/app/actions.
- Khong fetch truc tiep den service URL tu client component.
- Dam bao response map theo ApiResponse de thong nhat xu ly loi tren UI.

## 6. Rui ro va rollback
Rui ro:
- Neu action va route Kong khong dong bo, request se 404/502.

Rollback:
- Rollback route moi tren Kong va rollback action o web-client theo commit gan nhat.
- Giu nguyen cau truc action hien tai, chi bo sung tung buoc nho de de truy vet.
