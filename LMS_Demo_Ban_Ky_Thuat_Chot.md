# LMS Demo Kịch Bản Kỹ Thuật — Bản đã chốt

> Mục tiêu: demo các kỹ thuật kiến trúc quan trọng trên server Lightsail đã deploy, tập trung vào 4 nhóm: chịu tải/rate limit, fault isolation, outbox-retry-DLQ, CQRS.

---

## Thông tin môi trường demo

| Thành phần | Giá trị |
|---|---|
| Web | `https://lms.thanhbinh.qzz.io` |
| API | `https://api.thanhbinh.qzz.io` |
| VPS | AWS Lightsail |
| Repo path | `~/olms-microservices` |
| Gateway | Kong |
| Reverse proxy | Caddy |
| Runtime | Docker Compose |

Lệnh compose chuẩn:

```bash
cd ~/olms-microservices
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml <command>
```

---

# Demo 1 — Chịu tải cùng lúc + Rate Limit

## Mục tiêu

Chứng minh hệ thống có khả năng nhận nhiều request cùng lúc và Kong Gateway có thể chặn request vượt ngưỡng bằng `429 Too Many Requests`.

## 1.1. Test bình thường với K6

```bash
cd ~/olms-microservices
k6 run -e BASE_URL=https://api.thanhbinh.qzz.io tests/k6/rate-limit-auth.js
```

Kết quả đã chốt:

```text
200 VUs
200 requests
100 request thành công
100 request bị rate limit
checks passed 100%
p95 ≈ 823ms
```

Cách nói:

```text
Em dùng K6 mô phỏng 200 request đồng thời vào API thông qua Kong Gateway.
Một phần request được xử lý thành công, phần vượt ngưỡng bị chặn bằng HTTP 429.
Điều này chứng minh hệ thống có lớp bảo vệ ở Gateway, không để toàn bộ request spam đi thẳng vào backend.
```

Nếu bị hỏi vì sao `http_req_failed = 50%`:

```text
Trong K6, các response không phải 2xx như 429 sẽ bị tính là failed.
Nhưng trong bài test rate limit, 429 là kết quả mong muốn.
Script kiểm tra status phải là 200 hoặc 429 và toàn bộ check đều pass.
```

## 1.2. Demo tăng ngưỡng rate limit

Mục tiêu: chứng minh rate limit có thể cấu hình được ở Gateway.

Ví dụ:

```text
Ban đầu:
150 request vào
rate limit = 100
=> khoảng 100 request thành công
=> khoảng 50 request bị 429

Sau khi tăng:
150 request vào
rate limit = 120
=> khoảng 120 request thành công
=> khoảng 30 request bị 429
```

Tìm cấu hình rate limit:

```bash
grep -Rni "rate-limiting\|minute:\|second:\|limit_by" kong.yml kong.production.yml
```

Sửa source:

```bash
nano kong.yml
```

Ví dụ đổi:

```yaml
minute: 100
```

thành:

```yaml
minute: 120
```

Render lại Kong production:

```bash
set -a
source .env.production
set +a
bash scripts/render-kong-production.sh
```

Restart Kong:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml restart kong
```

Test lại với 150 request:

```bash
k6 run -e BASE_URL=https://api.thanhbinh.qzz.io -e REQUESTS=150 tests/k6/rate-limit-auth.js
```

Nếu script chưa hỗ trợ `REQUESTS`, sửa nhanh:

```bash
nano tests/k6/rate-limit-auth.js
```

Đổi:

```js
iterations: 200,
vus: 200,
```

thành:

```js
iterations: 150,
vus: 150,
```

Cách nói:

```text
Em tăng ngưỡng rate limit trên Kong từ 100 lên 120.
Cùng một lượng request đầu vào là 150, số request thành công sẽ tăng lên khoảng 120.
Điều này chứng minh giới hạn request nằm ở cấu hình Gateway, có thể điều chỉnh theo năng lực server.
```

---

# Demo 2 — Tắt Community Service, hệ thống không sập

## Mục tiêu

Chứng minh microservices có fault isolation:

```text
Tắt Community Service
=> chức năng cộng đồng/Q&A lỗi
=> Auth, Course, Payment, Learning, AI vẫn hoạt động
```

## 2.1. Kiểm tra trước khi tắt

```bash
cd ~/olms-microservices
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
```

Kiểm tra Community đang sống:

```bash
curl -i https://api.thanhbinh.qzz.io/community/readyz
```

Kiểm tra service chính:

```bash
curl -i https://api.thanhbinh.qzz.io/auth/readyz
curl -i https://api.thanhbinh.qzz.io/course/readyz
curl -i https://api.thanhbinh.qzz.io/payment/readyz
curl -i https://api.thanhbinh.qzz.io/learning/readyz
curl -i https://api.thanhbinh.qzz.io/ai/readyz
```

Kỳ vọng: tất cả trả `200`.

## 2.2. Tắt Community Service

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml stop community-service
```

Kiểm tra trạng thái:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps community-service
```

## 2.3. Kiểm tra Community bị lỗi

```bash
curl -i https://api.thanhbinh.qzz.io/community/readyz
```

Kỳ vọng:

```text
502 Bad Gateway
503 Service Unavailable
timeout
```

Tùy Kong/Caddy phản hồi.

## 2.4. Kiểm tra service khác vẫn chạy

```bash
curl -i https://api.thanhbinh.qzz.io/auth/readyz
curl -i https://api.thanhbinh.qzz.io/course/readyz
curl -i https://api.thanhbinh.qzz.io/payment/readyz
curl -i https://api.thanhbinh.qzz.io/learning/readyz
curl -i https://api.thanhbinh.qzz.io/ai/readyz
```

Kỳ vọng: các service này vẫn `200`.

## 2.5. Demo trên UI

```text
- Vào trang cộng đồng/Q&A: lỗi hoặc không tải được dữ liệu.
- Vào login/course/payment/AI: vẫn hoạt động bình thường.
```

## 2.6. Khôi phục Community Service

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml start community-service
sleep 10
curl -i https://api.thanhbinh.qzz.io/community/readyz
```

Kỳ vọng: `/community/readyz` trở lại `200`.

Cách nói:

```text
Em tắt riêng Community Service để mô phỏng một service bị down.
Khi đó route community không dùng được, nhưng các service khác như Auth, Course, Payment, Learning và AI vẫn trả 200.
Điều này chứng minh hệ thống có fault isolation, một service lỗi không làm sập toàn bộ hệ thống.
Khi start lại Community Service, chức năng cộng đồng phục hồi.
```

Nếu bị hỏi vì sao làm được:

```text
Vì mỗi service chạy trong container riêng, có process và database riêng.
Gateway chỉ route đến service tương ứng.
Khi Community down, request tới community lỗi, nhưng request tới Auth, Payment, Learning, AI vẫn đi đến container khác nên không bị ảnh hưởng.
```

Nếu bị hỏi có mất dữ liệu không:

```text
Không mất dữ liệu vì tắt container chỉ dừng process service.
Database vẫn nằm riêng ở Neon/Postgres.
Khi service start lại, nó kết nối lại DB và tiếp tục hoạt động.
```

---

# Demo 3 — Outbox → Retry → DLQ

## Mục tiêu

Chứng minh event-driven flow có độ tin cậy bằng fault injection thật:

```text
Kafka down:
Payment vẫn hoàn tất order và lưu outbox trong PostgreSQL.
Khi Kafka phục hồi, outbox worker publish lại event.

Learning Service down:
Kafka giữ backlog.
Khi Learning Service phục hồi, consumer tiếp tục tạo Enrollment.

Consumer xử lý lỗi:
Event đi qua retry-5s → retry-1m → DLQ.
DLQ processor lưu failed event để Admin retry hoặc resolve.
```

Chỉ xem log của flow thành công là chưa đủ để chứng minh cơ chế chịu lỗi.

## 3.1. Chuẩn bị helper và kiểm tra ban đầu

```bash
cd ~/olms-microservices

export API=https://api.thanhbinh.qzz.io
export COMPOSE="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml"

$COMPOSE ps kafka payment-service learning-service notification-service
curl -fsS "$API/payment/readyz"
curl -fsS "$API/learning/readyz"
curl -fsS "$API/notification/readyz"
```

Kiểm tra Kafka topic:

```bash
docker exec lms-kafka \
  kafka-topics \
  --bootstrap-server localhost:29092 \
  --list |
  grep -E '^(payment.order.completed|payment.order.completed.retry-5s|payment.order.completed.retry-1m|system.dead-letter)$'
```

Kỳ vọng:

```text
payment.order.completed
payment.order.completed.retry-5s
payment.order.completed.retry-1m
system.dead-letter
```

Kiểm tra worker và consumer đã chạy:

```bash
$COMPOSE logs --tail=250 payment-service learning-service |
  grep -iE "outbox worker started|Kafka consumer running|DLQ processor running"
```

Lưu ý: mỗi kịch bản bên dưới phải dùng một order sandbox mới. Nếu order đã hoàn tất
thì idempotency sẽ bỏ qua xử lý lặp lại.

## 3.2. Kafka down: chứng minh Transactional Outbox

Mở terminal A để theo dõi Payment và Learning:

```bash
$COMPOSE logs -f --since=1m payment-service learning-service |
  grep --line-buffered -iE "payment.order.completed|outbox.created|outbox.published|outbox.publish_failed|outbox.worker_tick_failed|kafka.producer.reconnect_scheduled|Enrollment created"
```

Dừng riêng Kafka. Không cần dừng Zookeeper:

```bash
$COMPOSE stop kafka
$COMPOSE ps kafka
```

Thao tác trên UI:

```text
1. Đăng nhập student.
2. Chọn một khóa học trả phí chưa mua.
3. Tạo order.
4. Thanh toán bằng VNPay sandbox.
5. Quay về lịch sử đơn hàng.
```

Kỳ vọng:

```text
Order vẫn chuyển sang COMPLETED.
Log Payment có payment.order.completed và outbox.created.
Chưa có outbox.published vì Kafka đang down.
Learning chưa thể tạo Enrollment.
```

Kiểm tra outbox mới nhất trực tiếp từ `payment_db`:

```bash
$COMPOSE exec payment-service \
  pnpm --filter @lms/payment-service exec node --input-type=module -e '
    import { PrismaClient } from "./dist/generated/prisma/index.js";
    const db = new PrismaClient();
    const rows = await db.outboxEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, topic: true, status: true, retryCount: true,
        nextAttemptAt: true, lastError: true, publishedAt: true
      }
    });
    console.table(rows);
    await db.$disconnect();
  '
```

Kỳ vọng outbox mới nhất:

```text
topic  = payment.order.completed
status = PENDING hoặc FAILED
```

`PENDING` là trạng thái thường thấy khi Kafka chỉ down trong thời gian ngắn.
Nếu số lần thử đã chạm `OUTBOX_MAX_ATTEMPTS`, status chuyển sang `FAILED` nhưng
worker vẫn tiếp tục xét lại theo backoff để tự phục hồi khi Kafka sống lại.

Khôi phục Kafka và đợi broker sẵn sàng:

```bash
$COMPOSE start kafka

until docker exec lms-kafka \
  kafka-topics \
  --bootstrap-server localhost:29092 \
  --list >/dev/null 2>&1; do
  sleep 2
done

sleep 8
```

Kiểm tra log:

```bash
$COMPOSE logs --tail=250 payment-service learning-service |
  grep -iE "outbox.published|Consuming payment.order.completed|Enrollment created"
```

Kỳ vọng:

```text
kafka.producer.reconnect_scheduled
outbox.published
Consuming payment.order.completed
Enrollment created
```

Chạy lại lệnh kiểm tra `payment_db`. Kỳ vọng outbox đổi thành:

```text
status = PUBLISHED
publishedAt có giá trị
```

Cách nói:

```text
Em dừng Kafka trước khi hoàn tất thanh toán.
Payment Service vẫn update order và ghi outbox event trong cùng transaction PostgreSQL.
Khi Kafka hoạt động lại, outbox worker tự tạo producer mới và publish event còn PENDING/FAILED.
Learning consume event và tạo Enrollment. Vì vậy Kafka lỗi tạm thời không làm mất event thanh toán.
```

## 3.3. Learning down: chứng minh Kafka giữ backlog

Phần này chứng minh durable queue. Đây không phải Retry/DLQ vì consumer bị dừng,
không phải consumer nhận event rồi xử lý lỗi.

Dừng Learning Service:

```bash
$COMPOSE stop learning-service
$COMPOSE ps learning-service
```

Thao tác trên UI bằng một student hoặc khóa học khác:

```text
1. Chọn một khóa học trả phí chưa mua.
2. Hoàn tất một payment VNPay sandbox mới.
3. Kiểm tra lịch sử đơn hàng: order đã COMPLETED.
```

Kiểm tra Payment đã publish event trong lúc Learning đang down:

```bash
$COMPOSE logs --tail=200 payment-service |
  grep -iE "payment.order.completed|outbox.created|outbox.published"
```

Khôi phục Learning:

```bash
$COMPOSE start learning-service

until curl -fsS "$API/learning/readyz" >/dev/null; do
  sleep 2
done

sleep 8

$COMPOSE logs --tail=250 learning-service |
  grep -iE "Kafka consumer running|Consuming payment.order.completed|Enrollment created"
```

Kỳ vọng:

```text
Learning start lại.
Consumer đọc event còn tồn tại trong Kafka.
Enrollment được tạo sau khi service phục hồi.
```

Cách nói:

```text
Khi Learning Service down, Payment vẫn publish event lên Kafka.
Kafka giữ backlog cho consumer group của Learning.
Khi Learning start lại, consumer tiếp tục đọc event và tạo Enrollment.
Đây là khả năng phục hồi của queue, khác với Retry/DLQ.
```

## 3.4. Consumer lỗi: chứng minh Retry → DLQ

Notification Service có fault flag dành cho demo. Đặt fail `3` lần để cả ba lần
xử lý `main → retry-5s → retry-1m` đều lỗi, sau đó event được đưa vào DLQ.

Bật fault injection:

```bash
DEMO_NOTIFICATION_FAIL_ATTEMPTS=3 \
  docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --force-recreate notification-service

until curl -fsS "$API/notification/readyz" >/dev/null; do
  sleep 2
done
```

Mở terminal A để theo dõi chuỗi retry:

```bash
$COMPOSE logs -f --since=1m notification-service learning-service |
  grep --line-buffered -iE "Demo transient email failure|kafka.retry|kafka.dlq|DLQ event persisted"
```

Trên UI, hoàn tất thêm một payment VNPay sandbox mới. Chờ khoảng `70` giây.

Kỳ vọng theo thứ tự:

```text
Demo transient email failure attempt 1
kafka.retry → payment.order.completed.retry-5s
Demo transient email failure attempt 2
kafka.retry → payment.order.completed.retry-1m
Demo transient email failure attempt 3
kafka.dlq → system.dead-letter
[learning-service] DLQ event persisted
```

Kiểm tra failed event trực tiếp từ `learning_db`:

```bash
$COMPOSE exec learning-service \
  pnpm --filter @lms/learning-service exec node --input-type=module -e '
    import { PrismaClient } from "./dist/generated/prisma/index.js";
    const db = new PrismaClient();
    const rows = await db.failedEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, topic: true, eventId: true, retryCount: true,
        status: true, errorMessage: true, createdAt: true
      }
    });
    console.table(rows);
    await db.$disconnect();
  '
```

Kỳ vọng failed event mới nhất:

```text
topic      = payment.order.completed
retryCount = 2
status     = PENDING
```

Xem trên UI:

```text
https://lms.thanhbinh.qzz.io/admin/dlq
```

## 3.5. Khôi phục và retry event từ Admin

Tắt fault injection:

```bash
DEMO_NOTIFICATION_FAIL_ATTEMPTS=0 \
  docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --force-recreate notification-service

until curl -fsS "$API/notification/readyz" >/dev/null; do
  sleep 2
done
```

Mở log:

```bash
$COMPOSE logs -f --since=1m notification-service learning-service |
  grep --line-buffered -iE "Email Payment Success sent|Enrollment already exists|Admin retried failed event"
```

Trên UI Admin:

```text
1. Vào /admin/dlq.
2. Chọn event vừa tạo.
3. Bấm Retry.
4. Kiểm tra trạng thái chuyển sang RETRIED.
5. Nếu đã xác nhận xử lý xong, bấm Resolve.
```

Kỳ vọng:

```text
Notification xử lý lại event thành công.
Learning nhận event lặp lại nhưng bỏ qua vì Enrollment.orderId là unique.
Không tạo Enrollment trùng.
```

Cách nói:

```text
Retry và DLQ bảo vệ phía consumer.
Event lỗi tạm thời được thử lại theo hai mốc 5 giây và 1 phút.
Nếu vẫn lỗi, event được tách sang DLQ để không chặn queue chính.
Admin có thể retry sau khi nguyên nhân lỗi đã được khắc phục.
Consumer Learning xử lý idempotent nên replay không tạo Enrollment trùng.
```

## 3.6. Checklist khôi phục sau Demo 3

```bash
$COMPOSE start kafka learning-service notification-service

curl -fsS "$API/payment/readyz"
curl -fsS "$API/learning/readyz"
curl -fsS "$API/notification/readyz"

$COMPOSE ps kafka payment-service learning-service notification-service

grep -E '^DEMO_NOTIFICATION_FAIL_ATTEMPTS=' .env.production || true
```

Kỳ vọng: các container hoạt động bình thường. Nếu `.env.production` có khai báo
`DEMO_NOTIFICATION_FAIL_ATTEMPTS`, giá trị phải là `0`.

---

# Demo 4 — CQRS Course Discovery: PostgreSQL → Kafka → Redis Read Model

## Mục tiêu

Chứng minh luồng ghi và luồng đọc danh sách khóa học được tách riêng:

```text
Write side:
Instructor/Admin cập nhật khóa học
→ Course Service ghi PostgreSQL
→ phát event course.catalog.* lên Kafka

Read side:
Course Service consumer nhận event
→ cập nhật Redis read model
→ GET /course/api/courses ưu tiên đọc Redis để trả danh sách nhanh
```

Redis chỉ là read model phục vụ truy vấn. PostgreSQL vẫn là nguồn dữ liệu chính.
Nếu Redis chưa sẵn sàng hoặc truy vấn có tìm kiếm text, API fallback về Prisma/PostgreSQL.
Read model đồng bộ theo event nên có eventual consistency; script warmup dùng để dựng lại projection khi cần.

## 4.1. Chuẩn bị helper

```bash
cd ~/olms-microservices

export API=https://api.thanhbinh.qzz.io
export COMPOSE="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml"
```

Kiểm tra Course Service đang sẵn sàng:

```bash
curl -fsS "$API/course/readyz"
```

Kỳ vọng: HTTP `200`.

## 4.2. Kiểm tra Kafka topic cho Course Catalog

```bash
docker exec lms-kafka \
  kafka-topics \
  --bootstrap-server localhost:29092 \
  --list |
  grep '^course.catalog'
```

Kỳ vọng có các topic:

```text
course.catalog.published
course.catalog.updated
course.catalog.archived
course.catalog.deleted
course.catalog.review-changed
course.catalog.retry-5s
course.catalog.retry-1m
```

Kiểm tra consumer cập nhật Redis read model đã chạy:

```bash
$COMPOSE logs --tail=300 course-service |
  grep -E "Course read model consumer running|Cache Redis|Read model consumer"
```

Kỳ vọng thấy log `Course read model consumer running`.

## 4.3. Warmup Redis read model từ PostgreSQL

Lệnh này chỉ xóa các key Redis có prefix `course:*`, sau đó dựng lại projection từ
các khóa học `PUBLISHED` trong PostgreSQL. Lệnh không xóa dữ liệu database.

```bash
$COMPOSE exec course-service \
  pnpm --filter @lms/course-service read-model:warmup
```

Kỳ vọng:

```text
[course-service] Course read model warmup completed
```

Log sẽ hiển thị thêm số lượng khóa học đã đưa vào read model.

## 4.4. Kiểm tra Redis read model

Đếm số khóa học published và số phần tử trong index sắp xếp mới nhất:

```bash
$COMPOSE exec course-service \
  pnpm --filter @lms/cache exec node --input-type=module -e '
    import { createClient } from "redis";
    const client = createClient({ url: process.env.CACHE_REDIS_URL });
    await client.connect();
    console.log("published_courses=" + await client.sCard("course:filter:status:published"));
    console.log("newest_index=" + await client.zCard("course:sort:newest"));
    await client.quit();
  '
```

Kỳ vọng:

```text
published_courses=<số lớn hơn 0>
newest_index=<cùng số lượng published course>
```

Liệt kê một số key projection:

```bash
$COMPOSE exec course-service \
  pnpm --filter @lms/cache exec node --input-type=module -e '
    import { createClient } from "redis";
    const client = createClient({ url: process.env.CACHE_REDIS_URL });
    await client.connect();
    let count = 0;
    for await (const key of client.scanIterator({ MATCH: "course:read:*", COUNT: 100 })) {
      console.log(key);
      if (++count >= 5) break;
    }
    await client.quit();
  '
```

## 4.5. Gọi API Course Discovery

Gọi API danh sách khóa học ba lần và đo thời gian phản hồi:

```bash
for i in 1 2 3; do
  curl -fsS \
    -o /dev/null \
    -w "request_$i http=%{http_code} total=%{time_total}s\n" \
    "$API/course/api/courses?sortBy=newest&page=1&limit=12"
done
```

Xem dữ liệu trả về:

```bash
curl -fsS "$API/course/api/courses?sortBy=newest&page=1&limit=3" |
  python3 -m json.tool |
  sed -n '1,120p'
```

Kỳ vọng:

```text
HTTP 200
data.courses có danh sách khóa học
data.total là tổng số khóa học published
```

## 4.6. Demo đồng bộ khi khóa học thay đổi

Mở terminal theo dõi log:

```bash
$COMPOSE logs -f --since=1m course-service |
  grep --line-buffered -E "course.catalog|Kafka typed event published|Read model consumer"
```

Trên UI:

```text
1. Đăng nhập Instructor hoặc Admin.
2. Mở một khóa học đã publish.
3. Sửa mô tả khóa học và lưu.
4. Ghi lại UUID của khóa học từ URL.
```

Kỳ vọng terminal xuất hiện event:

```text
course.catalog.updated
Kafka typed event published
```

Kiểm tra snapshot Redis của đúng khóa học vừa sửa:

```bash
export COURSE_ID=<uuid-khoa-hoc-vua-sua>

$COMPOSE exec -e COURSE_ID="$COURSE_ID" course-service \
  pnpm --filter @lms/cache exec node --input-type=module -e '
    import { createClient } from "redis";
    const client = createClient({ url: process.env.CACHE_REDIS_URL });
    await client.connect();
    const snapshot = await client.get(`course:read:${process.env.COURSE_ID}`);
    console.log(snapshot ?? "snapshot_not_found");
    await client.quit();
  '
```

Kỳ vọng JSON snapshot chứa mô tả mới. Điều này chứng minh event đã cập nhật read model.

## 4.7. Chứng minh có fallback về PostgreSQL

Redis index hiện chưa xử lý full-text search. Khi truyền `q`, Course Service chủ động
fallback về Prisma/PostgreSQL để giữ kết quả chính xác:

```bash
curl -fsS \
  -o /dev/null \
  -w "search_fallback http=%{http_code} total=%{time_total}s\n" \
  "$API/course/api/courses?q=node&page=1&limit=12"
```

Kỳ vọng: HTTP `200`.

Cách nói:

```text
CQRS rõ nhất trong hệ thống nằm ở Course Discovery.
PostgreSQL là write model và nguồn dữ liệu chính.
Khi khóa học thay đổi, Course Service phát event course.catalog.* qua Kafka.
Consumer cập nhật Redis read model để endpoint danh sách khóa học đọc nhanh hơn.
Nếu Redis lỗi hoặc query cần full-text search, hệ thống fallback về PostgreSQL nên
chức năng vẫn hoạt động, chỉ có thể chậm hơn.
```

---

# Thứ tự demo khuyến nghị

```text
1. Demo 1: Chịu tải + rate limit
2. Demo 1.2: Tăng ngưỡng rate limit
3. Demo 2: Tắt Community Service, hệ thống không sập
4. Demo 3.2: Tắt Kafka để chứng minh Transactional Outbox
5. Demo 3.3: Tắt Learning để chứng minh Kafka giữ backlog
6. Demo 3.4: Buộc Notification lỗi để chứng minh Retry → DLQ
7. Demo 3.5: Khôi phục Notification và retry event từ Admin
8. Demo 4: CQRS Course Discovery qua PostgreSQL → Kafka → Redis read model
```

---

# Checklist trước khi demo

```bash
cd ~/olms-microservices

docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps

curl -I https://lms.thanhbinh.qzz.io
curl -i https://api.thanhbinh.qzz.io/auth/readyz
curl -i https://api.thanhbinh.qzz.io/payment/readyz
curl -i https://api.thanhbinh.qzz.io/learning/readyz
curl -i https://api.thanhbinh.qzz.io/ai/readyz

docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=150 learning-service | grep -iE "consumer running|joined|DLQ processor running"

docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=150 payment-service | grep -iE "consumer running|joined|payment.order.completed"
```

Nếu tất cả pass thì bắt đầu demo.

---

# Câu trả lời nhanh khi bị hỏi

## Chịu tải được bao nhiêu?

```text
Hiện tại em demo cơ chế chịu tải và bảo vệ hệ thống bằng rate limit. Con số tải tối đa chính xác cần benchmark riêng theo CPU, RAM, DB connection và latency. Với demo hiện tại, hệ thống xử lý 200 request đồng thời, Gateway chặn phần vượt ngưỡng bằng 429 thay vì để backend sập.
```

## Vì sao tắt Community mà hệ thống không sập?

```text
Vì mỗi service chạy trong container riêng và Gateway route độc lập. Community down chỉ ảnh hưởng route community, không ảnh hưởng Auth, Payment, Learning, AI.
```

## Outbox khác Retry/DLQ thế nào?

```text
Outbox bảo vệ phía producer, đảm bảo event cần phát không bị mất.
Retry/DLQ bảo vệ phía consumer, đảm bảo event lỗi được thử lại hoặc lưu vào hàng chờ lỗi để xử lý sau.
```

## CQRS nằm ở đâu?

```text
Ví dụ rõ nhất là Course Discovery. PostgreSQL là write model và nguồn dữ liệu chính của khóa học. Khi khóa học thay đổi, Course Service phát event course.catalog.* qua Kafka. Consumer cập nhật Redis read model để API danh sách khóa học truy vấn nhanh hơn. Nếu Redis lỗi hoặc query cần full-text search, API fallback về Prisma/PostgreSQL.
```
