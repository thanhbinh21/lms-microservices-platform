# Demo-ready Production Deployment Plan

## Muc Tieu

Deploy LMS microservices len VPS theo mo hinh production-like de demo resilience va Kafka reliability. Day khong phai full production platform.

Pham vi giu lai:
- Docker Compose cho VPS: Kafka, Zookeeper, Kong, web-client va cac service hien co.
- `/health`, `/livez`, `/readyz` toi thieu cho tung service.
- Kong rate limit, correlation id va upstream timeout.
- Timeout + circuit breaker toi thieu cho `payment-service -> course-service`.
- Transactional outbox da co cho `payment.order.completed` va `learning.enrollment.created`.
- Kafka retry `5s -> 1m -> DLQ`, log console va DLQ persistence.
- Hai K6 script co ban: smoke va rate limit.

Khong nam trong scope:
- Prometheus, Loki, Tempo, OpenTelemetry, Grafana.
- Kubernetes, CI/CD phuc tap, distributed tracing, dashboard monitoring.
- Them container monitoring hoac package observability.

## Kien Truc Demo

```text
Browser -> web-client -> Kong :8000
                       -> auth-service :3101
                       -> course-service :3002
                       -> payment-service :3003
                       -> media-service :3004
                       -> notification-service :3005
                       -> learning-service :3006
                       -> community-service :3007
                       -> ai-service :3008

payment-service -> course-service
payment-service DB -> outbox -> Kafka -> learning-service -> outbox -> Kafka
Kafka failure -> retry topic -> system.dead-letter -> learning-service failed_events
```

Database van la Neon database-per-service. Redis van la cloud/Upstash neu service can dung cache. VPS khong them PostgreSQL, Redis hay monitoring container.

## Chay Local

Yeu cau:
- Dien du `.env` cho cac service va `apps/web-client/.env`.
- Docker Desktop dang chay.
- Cai K6 neu can demo rate limit.

Chay infra va app local:

```powershell
pnpm install
pnpm docker:up
pnpm setup:db
pnpm dev:web
```

Kiem tra nhanh:

```powershell
curl.exe http://localhost:8000/auth/readyz
curl.exe http://localhost:8000/course/readyz
k6 run tests/k6/smoke.js
```

Sau khi test local, dung cac process app bang `Ctrl+C` va kiem tra port truoc khi chay lai.

## Deploy VPS Toi Gian

Tren VPS Linux, dien `.env.production` va `services/*/.env` theo
`LIGHTSAIL_DEPLOY_RUNBOOK.md`, sau do:

```bash
git pull
bash scripts/deploy-lightsail.sh
export COMPOSE="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml"
```

Kiem tra:

```bash
curl http://localhost:8000/auth/readyz
curl http://localhost:8000/course/readyz
curl http://localhost:8000/payment/readyz
$COMPOSE logs -f payment-service learning-service notification-service
```

Rollback app:

```bash
git checkout <known-good-tag>
set -a && source .env.production && set +a
bash scripts/render-kong-production.sh
$COMPOSE up -d --build
```

## Demo 1 - Kong Rate Limit Bang K6

```bash
k6 run -e BASE_URL=http://localhost:8000 tests/k6/rate-limit-auth.js
```

Expected:
- Khoang 100 request dau tra `200`.
- Request vuot nguong theo IP tra `429`.
- Kong response co rate-limit header va message ro rang.

## Demo 2 - Service Down Khong Lam Sap Toan He Thong

```bash
$COMPOSE stop course-service
curl -i http://localhost:8000/course/api/courses
curl -i http://localhost:8000/auth/readyz
curl -i http://localhost:8000/payment/readyz
```

Expected:
- Course API loi do upstream down.
- Auth va Payment van tra `200`.

Recovery:

```bash
$COMPOSE start course-service
```

## Demo 3 - Timeout Va Circuit Breaker

Bat delay chi cho internal route cua Course Service:

```bash
FAULT_INJECTION_ENABLED=true COURSE_FAULT_DELAY_MS=5000 \
$COMPOSE up -d --force-recreate course-service
```

Gui lap lai request tao order hop le den Payment Service. Sau 3 lan timeout, cac request tiep theo fail-fast. Xem log:

```bash
$COMPOSE logs -f payment-service
```

Expected log:
- `circuit.open`
- `circuit.reject`
- Sau khi tat delay va cho khoang 10 giay: `circuit.half_open`, roi `circuit.close`.

Tat delay:

```bash
FAULT_INJECTION_ENABLED=false COURSE_FAULT_DELAY_MS=0 \
$COMPOSE up -d --force-recreate course-service
```

## Demo 4 - Outbox Giu Event Khi Kafka Loi

Dung VNPay sandbox hoac flow payment demo hien co de hoan tat mot order trong luc Kafka down:

```bash
$COMPOSE stop kafka
```

Query `payment_db`:

```sql
select id, topic, status, retry_count, next_attempt_at, last_error, published_at
from outbox_events
order by created_at desc
limit 10;
```

Expected:
- Order da complete.
- Outbox event `payment.order.completed` van con `PENDING`.
- Log Payment co `outbox.publish_failed`.

Recovery:

```bash
$COMPOSE start kafka
$COMPOSE logs -f payment-service learning-service
```

Expected:
- Outbox chuyen sang `PUBLISHED`.
- Learning consumer tao enrollment idempotent.

## Demo 5 - Retry Khi Consumer Loi Tam Thoi

Bat fault demo cua Notification Service va hoan tat mot payment moi:

```bash
DEMO_NOTIFICATION_FAIL_ATTEMPTS=1 \
$COMPOSE up -d --force-recreate notification-service
$COMPOSE logs -f notification-service
```

Expected:
- Lan dau log `Demo transient email failure`.
- Kafka log `kafka.retry` voi topic `payment.order.completed.retry-5s`.
- Lan retry sau gui email thanh cong.

Tat fault:

```bash
DEMO_NOTIFICATION_FAIL_ATTEMPTS=0 \
$COMPOSE up -d --force-recreate notification-service
```

## Demo 6 - DLQ Khi Event Loi Vinh Vien

Produce event co envelope hop le nhung payload sai schema:

```bash
printf '%s\n' '{"event_id":"demo-bad-payment-001","event_type":"payment.order.completed","timestamp":"2026-06-01T00:00:00.000Z","trace_id":"demo-dlq","data":{"order_id":"invalid","user_id":"demo-user","course_id":"invalid","instructor_id":"demo-instructor","amount":1,"currency":"VND","payment_method":"vnpay","vnp_txn_ref":"demo","vnp_transaction_no":"demo","paid_at":"2026-06-01T00:00:00.000Z"}}' |
docker exec -i lms-kafka kafka-console-producer --bootstrap-server localhost:29092 --topic payment.order.completed
```

Local Docker dung `localhost:9092`; compose production VPS dung `localhost:29092`
ben trong container Kafka.

Expected sau chuoi retry khoang 70 giay:
- Log `kafka.retry` cho `retry-5s`, sau do `retry-1m`.
- Log `kafka.dlq`.
- Learning DLQ processor log `DLQ event persisted`.
- Admin UI `/admin/dlq` thay event loi.

## Demo 7 - Recovery

```bash
$COMPOSE start kafka course-service
curl http://localhost:8000/course/readyz
curl http://localhost:8000/payment/readyz
```

Expected:
- Health endpoint quay lai `200`.
- Breaker dong lai sau request thanh cong.
- Payment outbox drain ve `PUBLISHED`.
- Consumer tiep tuc xu ly event moi.

## Checklist Truoc Khi Demo

- [ ] `.env.production` va `services/*/.env` VPS dung domain, Neon, Upstash, VNPay sandbox va secret rieng.
- [ ] `FAULT_INJECTION_ENABLED=false` va `DEMO_NOTIFICATION_FAIL_ATTEMPTS=0` truoc/sau demo.
- [ ] `docker compose ... ps` cho thay cac container can thiet dang up.
- [ ] Chay `k6 run tests/k6/smoke.js`.
- [ ] Mo ba log stream: `payment-service`, `learning-service`, `notification-service`.
- [ ] Co quyen query `payment_db.outbox_events` va mo admin `/admin/dlq`.
