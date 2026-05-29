# Production-Readiness Plan cho LMS Microservices

## Tóm Tắt

Mục tiêu production/demo: **Docker VPS baseline**, Kong DB-less làm API Gateway, Neon database-per-service, Kafka event-driven, Redis cloud/Upstash, observability bằng **Grafana OSS: Prometheus + Loki + Tempo + OpenTelemetry**.

Giả định chốt:
- Không chuyển sang Kubernetes ở bản production-readiness đầu tiên.
- Giữ chuẩn `ApiResponse<T>` hiện có, chỉ thêm optional `error` metadata để frontend xử lý lỗi tốt hơn.
- Tận dụng phần đã có: Kong rate limit/correlation-id, Kafka retry/DLQ wrapper, payment/learning outbox, Redis cache fallback.
- Ưu tiên demo kỹ thuật rõ ràng hơn mở rộng chức năng LMS.

## Phần 1: Hiện Trạng Cần Kiểm Tra

| Hạng mục | Hiện trạng repo | Việc cần kiểm tra/hoàn thiện |
|---|---|---|
| Gateway | `kong.yml` đã có JWT, rate-limiting `policy: local`, correlation-id | Thêm timeout/retry, expose đủ rate-limit headers, chuẩn hóa 502/503 JSON |
| Health check | Services có `/health`, đa số chỉ trả OK | Tách `/livez`, `/readyz`, `/health`; readiness kiểm tra DB/Kafka/Redis dependency |
| Timeout | Có `fetchWithTimeout` rải rác | Gom thành shared HTTP client, áp dụng mọi internal call |
| Circuit breaker | Chưa thấy breaker dùng chung | Thêm `@lms/resilience` hoặc shared helper dùng `opossum` |
| Outbox | Payment/Learning đã có `outbox_events` | Bổ sung field demo rõ hơn: `aggregate_id`, `aggregate_type`, `event_type`, `processed_at`, `error_message` |
| Retry/DLQ | `@lms/kafka-client` có retry 5s/1m và `system.dead-letter` | Tăng thành 3 retry, validation lỗi phải throw để vào DLQ, notification email phải await/throw |
| Notification | Consumer đang catch email error async sau khi handler trả về | Sửa để transient email failure kích hoạt retry thật |
| Redis | Cache package fallback tốt; Auth Redis session cache skip nếu mất Redis | Readiness phải báo degraded; auth vẫn dùng DB refresh token làm fallback |
| Frontend | `callApi` đã normalize lỗi network thành 503 | Thêm timeout, retry-after handling, degraded banner, cache fallback cho catalog |
| Observability | Pino logs có `traceId`; chưa có metrics/tracing stack | Thêm `/metrics`, OTel trace, Loki shipping, Grafana dashboard |
| Load test | Chưa thấy K6 scripts | Thêm `tests/k6/*.js`, thresholds, report template |

## Phần 2: Kiến Trúc Production-Ready Đề Xuất

```text
Browser
  -> Next.js BFF / Server Actions
  -> Kong Gateway: JWT, rate limit, timeout, correlation-id
  -> Microservices: Auth, Course, Learning, Payment, Media, Notification, AI
  -> DB riêng từng service: Neon PostgreSQL
  -> Kafka: event topics + retry topics + system.dead-letter
  -> Redis: cache/rate-limit/session best-effort
  -> Observability: Prometheus + Loki + Tempo + Grafana
```

### Chuẩn response lỗi

Giữ `ApiResponse<T>` và thêm `error` optional:

```json
{
  "success": false,
  "code": 503,
  "message": "Course Service is temporarily unavailable. Please try again later.",
  "data": null,
  "trace_id": "8b93f0d0-7d5d-4a8c-9b89-6f0f5e4c5a10",
  "error": {
    "type": "SERVICE_UNAVAILABLE",
    "service": "course-service",
    "retryable": true,
    "retry_after_seconds": 30
  }
}
```

### Ma trận fault isolation theo service

| Service down | Ảnh hưởng | Không được ảnh hưởng | Fallback/response |
|---|---|---|---|
| Auth | Login/register/refresh/logout lỗi | Course public, dashboard public, health | `503 AUTH_UNAVAILABLE`; frontend chuyển login form sang degraded |
| Course | Catalog/detail/curriculum lỗi | Auth, profile, orders, notifications | Public catalog dùng stale BFF cache nếu có, nếu không `503 COURSE_UNAVAILABLE` |
| Learning | Learn/progress/certificate lỗi | Login, catalog, payment create order | `503 LEARNING_UNAVAILABLE`; không crash dashboard, chỉ block tab học tập |
| Payment | Create order/VNPay/order history lỗi | Login, course view, learning nếu đã enrolled | `503 PAYMENT_UNAVAILABLE`; CTA thanh toán disabled |
| Notification | Email/bell lỗi | Payment/enrollment vẫn commit | Kafka retry; UI hiện “Thông báo tạm gián đoạn” |
| AI | Chat/quiz lỗi hoặc quota | Learn video/progress không lỗi | `503 AI_UNAVAILABLE` hoặc `429 AI_RATE_LIMITED`; fallback text |
| Kafka | Event async không publish | HTTP business commit không rollback nếu có outbox | Outbox giữ `PENDING`; readiness degraded; admin thấy backlog |
| Redis cache | Cache/rate-limit distributed yếu | Service không crash | Fallback DB/memory; log `cache_degraded` |
| Neon DB của 1 service | Service đó not-ready | Service khác vẫn chạy | `/readyz` fail riêng service; Kong/BFF trả 503 rõ ràng |

## Phần 3: Kỹ Thuật Cần Implement

| Kỹ thuật | Mức | Vị trí | Công nghệ/config | Demo/expected | Rủi ro nếu thiếu |
|---|---|---|---|---|---|
| Health/liveness/readiness | Bắt buộc | `services/*/src/index.ts`, Kong routes | `/livez` không check deps; `/readyz` check DB/Kafka/Redis | Stop DB/Kafka thấy readiness degraded | Không biết service chết hay dependency lỗi |
| Gateway timeout | Bắt buộc | `kong.yml` | `connect_timeout: 2000`, `read_timeout: 5000`, `write_timeout: 5000`, `retries: 0` | Service treo không làm request treo lâu | User chờ vô hạn, thread bị giữ |
| Internal HTTP timeout | Bắt buộc | Shared HTTP client | `AbortController`, default 2s internal, 10s AI/provider | Course chậm -> Payment fail nhanh | Cascading failure |
| Circuit breaker | Bắt buộc | Payment->Course, AI->Course/Learning, Community->Learning, Notification->Auth | `opossum`, threshold 50%, volume 5, reset 10s | Fail-fast sau nhiều lỗi, half-open khi service phục hồi | Service lỗi kéo sập service gọi |
| Rate limiting | Bắt buộc | Kong + Auth/AI middleware | Kong cho perimeter; Redis sliding window cho Auth/AI nhạy cảm | 100 req đầu OK, vượt trả 429 | Brute-force, quota burn, overload |
| Outbox | Bắt buộc | Payment/Learning | Transaction DB + outbox row trong cùng transaction | Kafka down vẫn không mất event | Payment thành công nhưng mất enrollment event |
| Retry | Bắt buộc | Consumer wrapper | Retry topics 5s/30s/1m, exponential backoff | Fail tạm thời lần 1-2 rồi thành công | Lỗi tạm thời thành mất nghiệp vụ |
| DLQ | Bắt buộc | Kafka + Learning admin DLQ | `system.dead-letter`, persist `failed_events` | Payload sai vào DLQ, admin inspect/replay | Message lỗi kẹt consumer hoặc mất dấu |
| Observability | Bắt buộc | All services | Pino JSON, `prom-client`, OTel, Loki/Tempo/Grafana | Dashboard thấy 429, circuit open, retry, DLQ | Không chứng minh được kỹ thuật |
| Load testing | Bắt buộc trước deploy | `tests/k6` | K6 smoke/load/stress/spike/soak | Có p95/error rate/throughput report | Không biết bottleneck |
| Stale cache catalog | Nên làm | Web BFF + Redis/Next cache | Cache public courses/detail 5 phút | Course down vẫn có dữ liệu cũ | Demo fault isolation kém thuyết phục |
| Kubernetes manifests | Sau | Infra | Deployment/Service/Ingress/HPA | Không cần cho Docker VPS v1 | Tăng scope không cần thiết |

### Rate limit config đề xuất

Gateway là lớp chính. Service-level chỉ dùng cho endpoint nhạy cảm như login, refresh, AI chat.

```yaml
# kong.yml - auth-public-route
- name: rate-limiting
  config:
    minute: 100
    limit_by: ip
    policy: local
    fault_tolerant: true
    hide_client_headers: false
    error_code: 429
    error_message: "Too many requests. Please try again later."
```

Nếu chạy nhiều Kong instance, đổi sang Redis:

```yaml
policy: redis
redis_host: ${KONG_RATE_LIMIT_REDIS_HOST}
redis_port: 6379
redis_password: ${KONG_RATE_LIMIT_REDIS_PASSWORD}
redis_ssl: true
redis_ssl_verify: false
```

CORS expose thêm:

```yaml
exposed_headers:
  - x-trace-id
  - X-RateLimit-Limit
  - X-RateLimit-Remaining
  - X-RateLimit-Reset
  - X-RateLimit-Limit-Minute
  - X-RateLimit-Remaining-Minute
  - Retry-After
```

### Circuit breaker config mẫu

```ts
const breakerOptions = {
  timeout: 2000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  rollingCountTimeout: 30000,
  rollingCountBuckets: 10,
  volumeThreshold: 5,
};
```

Log mẫu:

```json
{"level":"warn","service":"payment-service","event":"circuit.open","target":"course-service","trace_id":"demo-001","failure_rate":0.6}
{"level":"info","service":"payment-service","event":"circuit.half_open","target":"course-service","trace_id":"demo-001"}
{"level":"info","service":"payment-service","event":"circuit.close","target":"course-service","trace_id":"demo-001"}
```

### Outbox target schema

Áp dụng cho `payment-service` và `learning-service`, giữ field cũ để backward-compatible nhưng thêm field demo rõ ràng:

```prisma
model OutboxEvent {
  id            String   @id @default(uuid())
  aggregateId   String   @map("aggregate_id")
  aggregateType String   @map("aggregate_type")
  eventType     String   @map("event_type")
  topic         String
  eventKey      String?  @map("event_key")
  dedupeKey     String   @unique @map("dedupe_key")
  payload       Json     @db.JsonB
  status        OutboxStatus @default(PENDING)
  retryCount    Int      @default(0) @map("retry_count")
  nextAttemptAt DateTime @default(now()) @map("next_attempt_at")
  processedAt   DateTime? @map("processed_at")
  errorMessage  String?  @map("error_message") @db.Text
  traceId       String?  @map("trace_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
}
```

Flow outbox:

```text
VNPay callback OK
  -> Payment DB transaction
     -> update orders COMPLETED
     -> insert order_events
     -> upsert outbox_events(PENDING, dedupe_key=payment.order.completed:{orderId})
  -> HTTP response success
  -> outbox worker poll
  -> publish Kafka payment.order.completed
  -> mark outbox PUBLISHED
  -> Learning consumer creates Enrollment idempotently
  -> Learning outbox publishes learning.enrollment.created
```

### K6 rate limit script mẫu

```js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 200,
  iterations: 200,
  thresholds: {
    checks: ['rate>0.99'],
    http_req_duration: ['p(95)<1000']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  const res = http.get(`${BASE_URL}/auth/health`);
  check(res, {
    'status is 200 or 429': r => r.status === 200 || r.status === 429,
    '429 has clear message': r => r.status !== 429 || r.body.includes('Too many requests')
  });
}
```

Expected:
- Khoảng 100 response `200`.
- Khoảng 100 response `429`.
- Header có rate-limit info hoặc Kong native `X-RateLimit-Remaining-Minute`.

## Phần 4: Roadmap Triển Khai

| Phase | Task cụ thể | File/module chính | Tiêu chí hoàn thành | Test/demo |
|---|---|---|---|---|
| 1. Fault isolation + health + timeout | Thêm `/livez`, `/readyz`, `/health`; chuẩn hóa error response; thêm Kong timeout; shared `fetchWithTimeout` | `services/*/src/index.ts`, `kong.yml`, `apps/web-client/src/lib/api-client.ts` | Service down trả 503 JSON, service khác vẫn OK | Tắt course-service, gọi auth/profile/payment vẫn chạy |
| 2. Rate limit + circuit breaker | Chuẩn Kong rate limit; expose headers; thêm breaker cho internal clients | `kong.yml`, `services/*/src/lib/*client.ts`, shared resilience package | 429 rõ ràng; breaker open/half-open/close có log | K6 200 req; Course chậm -> Payment fail-fast |
| 3. Outbox + Retry + DLQ | Migrate outbox fields; tăng retry 3 lần; validation lỗi throw; notification await email; demo fault env | `packages/kafka-client`, payment/learning outbox, notification consumer | Kafka down không mất event; retry/DLQ chạy thật | Stop Kafka, thanh toán, bật Kafka, event publish lại |
| 4. Observability | `/metrics`, structured log chuẩn, OTel trace, docker compose observability | all services, infra compose | Grafana có dashboard HTTP/Kafka/outbox/DLQ | Nhìn thấy 429, retry, DLQ, circuit open |
| 5. Load testing + report | Thêm K6 smoke/load/stress/spike/soak; report template | `tests/k6`, `output/production-readiness-report.md` | Có p95, error rate, throughput, bottleneck | Chạy K6 và chụp Grafana |
| 6. Production deployment checklist | Dockerfile/services compose prod, env validation, backup, rollback runbook | Docker/infra scripts/env examples | `docker compose up -d` production-like chạy ổn | Restart từng service, kiểm tra readiness |

### Load test matrix

| Test | VU | Duration | API | Threshold | Expected |
|---|---:|---:|---|---|---|
| Smoke | 1-5 | 1m | login, courses, course detail | p95 < 800ms, error < 1% | Xác nhận hệ thống sống |
| Load | 50 | 10m | mix user flow | p95 non-AI < 1200ms, AI first token < 3s | 20-50 rps trên VPS demo |
| Stress | 50 -> 200 | 15m | courses/order/login | p95 < 2000ms, error < 5% | Tìm ngưỡng bắt đầu lỗi |
| Spike | 0 -> 300 -> 0 | 3m | auth/course | 429 không tính là lỗi bất thường | Rate limit bảo vệ hệ thống |
| Soak | 30 | 60-120m | read-heavy + progress | memory không tăng liên tục | Phát hiện leak/pool exhaustion |

Bottleneck cần đọc:
- CPU/RAM: Docker stats hoặc Grafana node exporter.
- DB pool: Prisma `P2024`, `P1001`, `P1017`, p95 query.
- Redis: cache hit ratio, Redis latency, fallback count.
- Kafka: consumer lag, retry topic depth, DLQ count.
- Network: Kong upstream latency, timeout count.
- Slow query: Prisma log duration > 500ms.

## Phần 5: Kịch Bản Demo Cuối

| Demo | Mục tiêu | Chuẩn bị/lệnh | API gọi | Expected | Log/dashboard cần nhìn | Giải thích |
|---|---|---|---|---|---|---|
| 1. Rate limit | Chứng minh gateway chặn overload | `k6 run tests/k6/rate-limit-auth.js` | `GET /auth/health` hoặc `POST /auth/login` | 100 OK, còn lại 429 | Kong access log, `rate_limit_blocked_total` | Gateway bảo vệ service trước khi request vào backend |
| 2. Service down | Fault isolation | Dev: kill port 3002. Prod: `docker compose stop course-service` | `/course/api/courses`, `/auth/health`, `/payment/api/orders/my` | Course 503, auth/payment còn chạy | Kong upstream 503, frontend degraded banner | Microservice lỗi chỉ ảnh hưởng bounded context |
| 3. Circuit breaker | Fail-fast khi upstream chậm | Bật `FAULT_INJECTION_ENABLED=true`, Course delay 5s | `POST /payment/api/orders` | Vài request timeout, sau đó fail-fast 503 | `circuit.open`, `circuit.half_open`, p95 giảm | Tránh request treo và cascading failure |
| 4. Outbox | Không mất event khi Kafka down | `docker stop lms-kafka`, thanh toán demo, bật lại Kafka | VNPay callback / payment complete | Outbox PENDING rồi PUBLISHED | DB `outbox_events`, Kafka consumer log | DB transaction giữ business state + event |
| 5. Retry | Lỗi tạm thời xử lý lại | `DEMO_NOTIFICATION_FAIL_ATTEMPTS=2` | Publish `payment.order.completed` | Retry lần 1/2, lần 3 SENT | `kafka_retry_total`, notification log | Consumer throw lỗi tạm thời, retry topic xử lý lại |
| 6. DLQ | Payload sai không làm kẹt consumer | Produce event sai schema vào Kafka | `payment.order.completed` bad JSON/schema | Sau retry, vào `system.dead-letter` và `failed_events` | Admin `/admin/dlq`, `kafka_dlq_total` | Lỗi vĩnh viễn được cô lập để inspect/replay |
| 7. Recovery | Service sống lại tự phục hồi | Start lại course/kafka/redis | Gọi lại API cũ | Breaker close, readiness OK, outbox drain | Dashboard chuyển đỏ -> xanh | Hệ thống tự phục hồi theo dependency state |

Lệnh Kafka inspect mẫu:

```bash
docker exec -it lms-kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic system.dead-letter --from-beginning --max-messages 5
```

Query outbox mẫu:

```sql
select id, aggregate_type, event_type, status, retry_count, processed_at, error_message
from outbox_events
order by created_at desc
limit 10;
```

## Phần 6: Checklist Trước Production

| Nhóm | Checklist |
|---|---|
| Security | JWT secret production; Kong strip `x-user-*`; internal endpoints bắt `x-internal-secret`; CORS đúng domain; helmet bật; admin actions audit |
| Rate limit | Kong auth/course/payment/AI routes có limit; AI/Auth có service-level Redis limiter; 429 có message/header rõ |
| Timeout | Kong timeout; internal HTTP timeout; AI/provider timeout; frontend Server Actions timeout |
| Circuit breaker | Áp dụng mọi cross-service HTTP call; có fallback/cache; có metrics/log state |
| Retry | Retry 3 lần với backoff; chỉ retry lỗi tạm thời; validation/business permanent vào DLQ |
| DLQ | Topic `system.dead-letter`; persist `failed_events`; admin inspect/retry/resolve; replay có audit |
| Health | `/livez`, `/readyz`, `/health`; Docker healthcheck dùng readiness; Kong health route allowlist |
| Logging | JSON logs; `service`, `trace_id`, `user_id`, `event_id`, `target_service`, latency, error_code |
| Monitoring | Prometheus metrics; Loki logs; Tempo traces; Grafana dashboard HTTP/Kafka/DB/Redis/outbox/DLQ |
| Backup DB | Neon PITR/backup; migration deploy tested; rollback migration plan |
| Env vars | `.env.production` đủ DB/Kafka/Redis/VNPay/SMTP/AI/Internal secret; không dùng dev JWT secret trong `kong.yml` |
| Docker VPS | Production compose có service containers, restart policy, resource limits, healthchecks, log rotation |
| Load test | Smoke/load/stress/spike/soak pass; report có p95/error/throughput/bottleneck |
| Rollback | Image tags versioned; rollback command; DB backward-compatible; feature flags cho fault/demo code disabled production |
| Demo safety | `FAULT_INJECTION_ENABLED=false` mặc định production; demo env riêng; không dùng real payment key khi fault test |
