# Hướng Dẫn Chạy Dự Án Sau Khi `git pull`

Khi có thành viên khác đẩy code mới (đặc biệt là có thay đổi về database schema, package mới, hoặc kiến trúc cache), bạn hãy làm theo các bước sau để đảm bảo hệ thống chạy mượt mà, không gặp lỗi xung đột:

### Bước 1: Cập nhật thư viện (Bắt buộc)
Do chúng ta vừa tách thêm package `@lms/cache` và `@lms/db-prisma`, bạn cần cài đặt lại toàn bộ dependencies ở thư mục gốc:
```bash
pnpm install
```

### Bước 2: Đồng bộ Database Schema (Bắt buộc nếu có thay đổi DB)
Chúng ta vừa thêm các **Composite Indexes** trên Neon Postgres để tối ưu hiệu năng. Bạn cần đồng bộ schema mới nhất xuống database của bạn (nếu dùng chung một database Dev trên Neon thì có thể bỏ qua, nhưng tốt nhất cứ chạy để an toàn):
```bash
pnpm db:sync
```
*(Lệnh này tự động gọi `prisma db push` và `prisma generate` cho tất cả các microservices).*

### Bước 3: Đảm bảo Docker Containers Đang Chạy (Bắt buộc)
Hệ thống hiện tại cần **Redis** (cho Session) và **Kafka / Zookeeper** (cho Event-driven). Chạy lệnh sau để khởi động chúng (nếu chưa chạy):
```bash
pnpm docker:up
```

### Bước 4: Khởi động hệ thống
Bạn có thể khởi động hệ thống bằng lệnh dev quen thuộc. Lệnh này đã tự động bao gồm việc kill các port bị kẹt và xóa cache lock của Next.js:
```bash
pnpm dev:web
```
Hoặc nếu máy yếu, có thể dùng bản rút gọn (chỉ chạy core services):
```bash
pnpm dev:web:lite
```

---

### 🛑 Các Lưu Ý Quan Trọng Gần Đây
1. **Lỗi Prisma "Closed"**: Nếu bạn thấy log `prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }` xuất hiện thoáng qua, đừng lo lắng. Đây là cơ chế **Cold-start của Neon Postgres**. Hệ thống đã được bọc `withRetry` (Tự động thử lại) nên request vẫn sẽ thành công!
2. **Next.js Caching**: Nếu bạn thấy giao diện không cập nhật sau khi sửa code Frontend liên quan đến fetch data, hãy thử dừng server và chạy lại lệnh `pnpm dev:web` (để xóa cache). Hệ thống hiện tại đang sử dụng Next.js `unstable_cache` và Redis Cache.
