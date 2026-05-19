# Hướng dẫn Run Code Dành Cho Dev (Cập nhật T5/2026)

Tài liệu này hướng dẫn chi tiết cách để pull code mới nhất và chạy dự án local với kiến trúc Microservices + Event-Driven mới nhất.

## 1) Điều kiện cần có

- **Node.js**: >= 18 (Khuyến nghị dùng nvm để quản lý phiên bản)
- **Package Manager**: pnpm >= 8 (Sử dụng lệnh `npm i -g pnpm`)
- **Docker Desktop**: Phải đang bật để chạy Kafka, Kong Gateway và Zookeeper.
- **Biến môi trường (`.env`)**: Bạn phải có đầy đủ file `.env` cho tất cả các service. Hệ thống đã được mở rộng gồm các service sau:
  - `apps/web-client` (Next.js Frontend)
  - `services/auth-service`
  - `services/course-service`
  - `services/learning-service`
  - `services/community-service`
  - `services/media-service`
  - `services/notification-service`
  - `services/payment-service`
  - `services/ai-service`
- **Môi trường Database**: Sử dụng Neon Database (Postgres serverless) + Upstash (Redis). URLs phải được cấu hình đầy đủ trong các file `.env`.
- **API Keys**: Riêng đối với `ai-service`, bạn cần cung cấp `GEMINI_API_KEY`, `OPENROUTER_API_KEY` hoặc `DEEPSEEK_API_KEY` (tuỳ mô hình bạn cấu hình).

## 2) Lần đầu pull code hoặc khi có thay đổi Database (Migration)

Hãy đảm bảo bạn chạy theo đúng thứ tự sau từ thư mục gốc (root workspace):

```bash
# 1. Cài đặt toàn bộ dependencies trong monorepo
pnpm install

# 2. Khởi động các container Docker (Kong, Kafka, Zookeeper, Redis local nếu có)
pnpm docker:up

# 3. Setup Database (Deploy Migration & Generate Prisma Client cho toàn bộ services)
pnpm setup:db

# 4. (Tuỳ chọn) Seed dữ liệu mẫu nếu DB trống
pnpm seed
```

**Ghi chú quan trọng:**
- Lệnh `pnpm setup:db` sẽ tự động "đánh thức" (warmup) DB Neon (tránh lỗi cold start) trước khi chạy `prisma migrate deploy` và `prisma generate` cho tất cả các service.
- Nếu chạy `pnpm seed`, hệ thống sẽ nạp dữ liệu ban đầu cho `auth-service` và `course-service`. Hãy cẩn thận không chạy seed trên DB Production/Test quan trọng.

## 3) Chạy hệ thống để Code/Dev

Dự án dùng Turborepo nên bạn có thể chạy đồng loạt nhiều service. Các script `dev` đã được tích hợp luồng **tự động kill port** rác trước khi chạy, hạn chế lỗi "Port already in use".

**Chạy toàn bộ Backend Services + Frontend Web (Khuyên dùng):**
```bash
pnpm dev:web
```

**Chạy Full Monorepo (tất cả mọi thứ):**
```bash
pnpm dev
```

**Chạy bản Lite (Giới hạn service để tiết kiệm RAM):**
```bash
pnpm dev:web:lite
```

## 4) Kiểm tra nhanh trạng thái hệ thống

- Kiểm tra tình trạng đồng bộ Migration của toàn bộ các database:
  ```bash
  pnpm prisma:migrate:status:all
  ```
- Kiểm tra lỗi cú pháp/TypeScript toàn dự án:
  ```bash
  pnpm build
  ```
- Chạy unit/integration test:
  ```bash
  pnpm test
  ```

## 5) Bảng lệnh Script thường dùng

- `pnpm setup`: Gom chung lệnh install + docker up + db setup + seed. Chỉ dùng 1 lần duy nhất khi mới clone code.
- `pnpm setup:db`: Cập nhật DB schema sau khi pull code có file migration mới.
- `pnpm docker:up` / `pnpm docker:down`: Khởi động / Tắt Docker Stack (Kong, Kafka). Lệnh có kèm cờ `--remove-orphans` giúp làm sạch môi trường.
- `pnpm docker:health`: Xem các container nào đang sống.
- `pnpm docker:logs`: Đọc log của Gateway Kong hoặc Kafka.

## 6) Lỗi hay gặp & Cách xử lý

1. **Lỗi `Port already in use` hoặc `EADDRINUSE`:**
   - Dù script đã có kill port, đôi khi quyền Administrator trên Windows chặn việc kill. Hãy mở Task Manager và kill các process `node.exe` hoặc chạy cmd as Admin.

2. **Lỗi báo thiếu Prisma Client hoặc Query Engine:**
   - Bạn chưa generate client. Chạy lại: `pnpm prisma:generate:all`.
   - Nếu bị lỗi trên 1 service cụ thể, vào thư mục service đó (vd: `cd services/learning-service`) và chạy `npx prisma generate`.

3. **Lỗi Prisma Migration Status (Drift):**
   - Chạy `pnpm prisma:migrate:status:all`.
   - Nếu có 1 service báo DB out of sync, cd vào service đó, kiểm tra xem bạn có lỡ sửa schema trực tiếp trên DB Neon không. Tránh can thiệp thủ công vào schema DB.

4. **Lỗi "Hệ thống AI không khả dụng" hoặc trả về Quiz JSON lỗi:**
   - Đảm bảo `ai-service` đã load đủ `GEMINI_API_KEY` (hoặc openrouter key).
   - Kiểm tra log `ai-service`, lưu ý giới hạn Rate Limit của tài khoản free-tier.

5. **API Gateway / Kong trả về 404 hoặc CORS:**
   - Nếu bạn vừa thêm endpoint hoặc service mới, bạn phải định nghĩa nó trong file `kong.yml`.
   - Sau khi cập nhật `kong.yml`, cần khởi động lại container Kong: `pnpm docker:down` rồi `pnpm docker:up`.

6. **Neon DB Cold Start (Timeout ban đầu):**
   - Các request đầu tiên sau thời gian dài không dùng có thể chậm do serverless DB cần "thức dậy". Đây là hiện tượng bình thường. Hệ thống có cơ chế retry tự động.
