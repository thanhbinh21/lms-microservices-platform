# Huong dan run code sau khi pull

Tai lieu nay dung cho dev pull code moi nhat ve may local.

## 1) Dieu kien can co

- Node.js >= 18
- pnpm >= 8
- Docker Desktop dang bat cho Kafka/Kong/Zookeeper
- Upstash/cloud Redis URL da cau hinh trong `.env`
- Da tao day du `.env` cho cac service

## 2) Lan dau pull ve hoac pull co thay doi DB

Chay theo dung thu tu:

```bash
pnpm install
pnpm docker:up
pnpm setup:db
pnpm seed
```

Ghi chu:
- `pnpm setup:db` se chay `prisma migrate deploy` + `prisma generate` cho tat ca services.
- Neu da co data test quan trong, can xac nhan truoc khi chay `pnpm seed`.

## 3) Chay he thong de dev

Profile day du (khuyen dung):

```bash
pnpm dev:web
```

Profile nhe hon:

```bash
pnpm dev:web:lite
```

Profile full monorepo:

```bash
pnpm dev
```

## 4) Kiem tra nhanh sau khi run

Kiem tra migration status:

```bash
pnpm prisma:migrate:status:all
```

Kiem tra build:

```bash
pnpm build
```

Kiem tra test:

```bash
pnpm test
```

## 5) Script nen dung thuong xuyen

- `pnpm setup`: install + docker up + setup db + seed
- `pnpm setup:db`: deploy migration + generate prisma client
- `pnpm docker:up`: bat Kafka/Kong/Zookeeper, dong thoi go orphan Redis local cu neu con
- `pnpm docker:down`: tat docker stack local
- `pnpm docker:health`: xem trang thai container
- `pnpm docker:logs`: xem log docker stack

## 6) Loi hay gap

1. `Port already in use`:
   - Script `dev`, `dev:web`, `dev:web:lite` da tu clear port truoc khi run.
   - Neu van bi, tat process cu va chay lai.

2. Prisma migration loi:
   - Chay lai `pnpm prisma:migrate:status:all`.
   - Neu service nao loi rieng, vao service do va chay `npx prisma migrate status` de xem chi tiet.

3. Neon cold start lam request dau cham:
   - Day la hanh vi binh thuong voi Neon serverless.
