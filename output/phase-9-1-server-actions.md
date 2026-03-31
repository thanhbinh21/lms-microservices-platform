# Phase 9.1 - Server Actions Convention

## 1. Muc tieu thay doi
Dinh nghia quy tac viet Server Actions de dam bao bao mat, de bao tri, va dong nhat voi kien truc BFF.

## 2. Pham vi anh huong
- apps/web-client/src/app/actions/auth.ts
- apps/web-client/src/app/actions/instructor.ts
- apps/web-client/src/app/actions/dashboard.ts

## 3. Quyet dinh ky thuat
- Moi file action phai bat dau bang 'use server'.
- Action la diem vao duy nhat cho API call tu UI.
- Action phai xu ly token/cookie o server, khong expose token sang client.
- Action phai normalize ket qua tra ve de UI de xu ly (success, code, message, data).

## 4. Rule thuc thi
1. Dat helper callApi dung chung de tranh lap code.
2. Tach ro action can auth va action public.
3. Su dung cache control no-store cho du lieu nhay cam hoac can realtime.
4. Revalidate path sau cac thao tac mutation.
5. Log va xu ly loi theo huong an toan, khong lam lo thong tin noi bo.

## 5. Huong dan mo rong
- Khi them action moi:
  1. Xac dinh endpoint qua Kong.
  2. Xac dinh yeu cau auth.
  3. Tao DTO type ro rang.
  4. Viet test scenario happy path + invalid input + unauthorized.

## 6. Rui ro va rollback
Rui ro:
- Viet action khong dong nhat co the gay leak token hoac loi state UI.

Rollback:
- Quay lai helper callApi truoc do va bo action moi neu chua on dinh.
- Revalidate lai cac route bi anh huong sau rollback.
