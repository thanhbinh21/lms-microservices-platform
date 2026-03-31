# Phase 9.1 - Prisma Migration (Auth Service)

## 1. Muc tieu thay doi
Bo sung metadata nguon tao tai khoan va thong tin lan dang nhap gan nhat de phuc vu audit, phan tich hanh vi dang nhap, va mo rong kieu dang nhap trong tuong lai.

## 2. Pham vi anh huong
- services/auth-service/prisma/schema.prisma
- services/auth-service/prisma/migrations/20260331123000_phase_9_1_auth_fields/migration.sql
- services/auth-service/src/controllers/register.controller.ts

## 3. Quyet dinh ky thuat
- Them truong `sourceType` tren model User voi default `CREDENTIALS` de giu tuong thich nguoc voi du lieu cu.
- Dung migration SQL theo huong non-destructive (`ADD COLUMN IF NOT EXISTS`) de giam rui ro khi re-run.
- Dong bo register flow de user moi luon co `sourceType` ro rang, tranh du lieu null/khong dong nhat.

## 4. Chi tiet migration
SQL migration da ap dung:
- ADD COLUMN `source_type` TEXT NOT NULL DEFAULT 'CREDENTIALS'
- ADD COLUMN `last_login_at` TIMESTAMP(3)

## 5. Huong dan ap dung tren moi truong co san du lieu
Do DB da ton tai schema truoc do, can baseline lich su migration truoc khi deploy migration moi:

1. Baseline migration dau tien:
   - pnpm --filter auth-service exec prisma migrate resolve --applied 20260125000000_init
2. Deploy migration moi:
   - pnpm --filter auth-service exec prisma migrate deploy

## 6. Ket qua thuc thi
- Migration `20260331123000_phase_9_1_auth_fields` da duoc apply thanh cong.
- Build auth-service pass sau khi regenerate Prisma Client.

## 7. Rui ro va rollback
Rui ro:
- Baseline sai migration id co the lam lech migration history.

Rollback de xuat:
- Tao migration rollback rieng (khong reset schema) neu can xoa truong moi.
- Khong su dung `migrate reset` tren moi truong co du lieu production.
