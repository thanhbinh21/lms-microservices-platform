# LMS Lightsail Deploy & Service Operations Runbook

> Mục đích: ghi lại các bước deploy production/demo trên AWS Lightsail và các câu lệnh hay dùng để kiểm tra, tương tác, debug các service trong hệ thống LMS microservices.

---

## 1. Thông tin server hiện tại

| Thành phần | Giá trị |
|---|---|
| VPS | AWS Lightsail Ubuntu |
| Public IP | `18.136.243.253` |
| Web domain | `https://lms.thanhbinh.qzz.io` |
| API domain | `https://api.thanhbinh.qzz.io` |
| Reverse proxy | Caddy |
| API Gateway | Kong |
| Container runtime | Docker + Docker Compose |
| Package manager | Node.js 20 + pnpm 8.15.0 |
| Repo path trên VPS | `~/olms-microservices` |

---

## 2. Các file deploy chính

| File | Mục đích |
|---|---|
| `.env.production` | Env thật trên VPS, không commit |
| `.env.production.example` | Mẫu env production, được commit |
| `docker-compose.yml` | Compose base |
| `docker-compose.production.yml` | Override production |
| `Dockerfile.service` | Dockerfile dùng chung cho service |
| `kong.yml` | Kong config source |
| `kong.production.yml` | Kong config render ra từ env, không nên sửa tay lâu dài |
| `scripts/render-kong-production.sh` | Render Kong production |
| `scripts/deploy-lightsail.sh` | Script deploy Lightsail |
| `PLAN_Demo.md` | Runbook demo kỹ thuật |

---

## 3. Lệnh Docker Compose chuẩn

Dùng nguyên format này để tránh nhầm compose file:

```bash
cd ~/olms-microservices
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml <command>
```

Ví dụ:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
```

---

## 4. Kiểm tra trạng thái container

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
```

Kỳ vọng:

```text
kafka                  healthy
zookeeper              healthy
kong                   healthy
auth-service           healthy
course-service         healthy
learning-service       healthy
payment-service        healthy
media-service          healthy
notification-service   healthy
community-service      healthy
ai-service             healthy
web-client             Up
```

Lưu ý: `web-client` có thể chỉ hiện `Up`, không có `healthy`, vì chưa có healthcheck riêng.

---

## 5. Kiểm tra public health endpoints

```bash
curl -I https://lms.thanhbinh.qzz.io

curl -i https://api.thanhbinh.qzz.io/auth/readyz
curl -i https://api.thanhbinh.qzz.io/course/readyz
curl -i https://api.thanhbinh.qzz.io/learning/readyz
curl -i https://api.thanhbinh.qzz.io/payment/readyz
curl -i https://api.thanhbinh.qzz.io/media/readyz
curl -i https://api.thanhbinh.qzz.io/notification/readyz
curl -i https://api.thanhbinh.qzz.io/community/readyz
curl -i https://api.thanhbinh.qzz.io/ai/readyz
```

Kỳ vọng: tất cả API trả `200`.

---

## 6. Deploy/pull code mới

### 6.1. Pull code từ GitHub

```bash
cd ~/olms-microservices
git pull origin main
```

### 6.2. Render lại Kong config

```bash
set -a
source .env.production
set +a

bash scripts/render-kong-production.sh
```

### 6.3. Kiểm tra compose config

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml config --quiet
```

Nếu không in gì ra là pass.

### 6.4. Deploy toàn bộ hệ thống

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

### 6.5. Deploy riêng một service

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d --build payment-service
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d --build --force-recreate web-client
```

---

## 7. Restart service

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml restart <service-name>
```

Ví dụ:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml restart kong
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml restart payment-service
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml restart learning-service
```

---

## 8. Xem logs

### 8.1. Logs toàn bộ hệ thống

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=100
```

### 8.2. Logs riêng service

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=100 payment-service
```

### 8.3. Follow log realtime

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs -f payment-service
```

### 8.4. Xem log trong khoảng thời gian gần đây

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --since=10m payment-service
```

### 8.5. Lọc lỗi mới

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --since=10m | grep -iE "error|failed|exception|panic|ECONNREFUSED|EAI_AGAIN|timeout"
```

---

## 9. Kiểm tra Kafka consumers

### 9.1. Learning consumers

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=150 learning-service | grep -iE "consumer running|joined|DLQ processor running"
```

Cần thấy:

```text
learning-service.enrollment-creator.payment.order.completed
learning-service.enrollment-creator.payment.order.completed.retry-5s
learning-service.enrollment-creator.payment.order.completed.retry-1m
learning-service.dlq-processor
[learning-service] Kafka consumer running
[learning-service] DLQ processor running
```

### 9.2. Payment consumers

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=150 payment-service | grep -iE "consumer running|joined|payment.order.completed"
```

Cần thấy:

```text
payment-service.earnings-writer.payment.order.completed
payment-service.earnings-writer.payment.order.completed.retry-5s
payment-service.earnings-writer.payment.order.completed.retry-1m
Payment earnings consumer running
```

---

## 10. Kiểm tra flow VNPay/payment

### 10.1. Follow payment log khi test

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs -f --since=2m payment-service
```

Khi thanh toán thành công cần thấy:

```text
Order ready
vnpay.return.valid
payment.order.completed
outbox.created
outbox.published
```

### 10.2. Lọc payment events

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --since=20m payment-service | grep -iE "Order ready|vnpay.return.valid|payment.order.completed|outbox.created|outbox.published|courseId|userId"
```

### 10.3. Kiểm tra VNPay IPN route

```bash
curl -i "https://api.thanhbinh.qzz.io/payment/api/vnpay-ipn"
```

Kết quả gọi tay có thể là:

```json
{"RspCode":"97","Message":"Checksum failed"}
```

Điều này bình thường vì gọi tay không có chữ ký VNPay hợp lệ. Quan trọng là route không bị `404`, `401`, `502`.

---

## 11. Kiểm tra Learning enrollment sau payment

### 11.1. Follow learning log

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs -f --since=2m learning-service
```

Sau khi payment publish event cần thấy:

```text
Consuming payment.order.completed
Enrollment created
learning.enrollment.created
```

### 11.2. Lọc enrollment event

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --since=20m learning-service | grep -iE "payment.order.completed|enroll|enrollment|created|already|failed|error|courseId|userId"
```

---

## 12. Kiểm tra AI Chatbox

### 12.1. Health AI route

```bash
curl -i https://api.thanhbinh.qzz.io/ai/readyz
```

### 12.2. Cookie production cần đúng

Sau khi login, cookie `accessToken` phải có:

```text
Domain: .thanhbinh.qzz.io
SameSite: None
Secure: true
Path: /
```

Nếu AI bị `401 Unauthorized`, kiểm tra browser request tới:

```text
https://api.thanhbinh.qzz.io/ai/api/chat/...
```

Request Headers cần có:

```text
Cookie: accessToken=...
```

Nếu cookie vẫn là host-only:

```text
Domain: lms.thanhbinh.qzz.io
SameSite: Lax
```

thì cần clear cookie, đăng nhập lại, hoặc rebuild `web-client`.

### 12.3. Kiểm tra env trong web-client container

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml exec web-client printenv | grep AUTH_COOKIE_DOMAIN
```

Kỳ vọng:

```text
AUTH_COOKIE_DOMAIN=.thanhbinh.qzz.io
```

---

## 13. Kiểm tra Caddy

```bash
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 100 --no-pager
sudo systemctl reload caddy
```

---

## 14. Kiểm tra Kong

### 14.1. Restart Kong

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml restart kong
```

### 14.2. Logs Kong

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=100 kong
```

### 14.3. Render Kong production

```bash
set -a
source .env.production
set +a

bash scripts/render-kong-production.sh
```

### 14.4. Kiểm tra AI route trong Kong config

```bash
grep -nA90 -B5 "name: ai-service" kong.production.yml
```

Lưu ý: AI route nên giữ:

```yaml
strip_path: true
```

Không dùng `strip_path: false` cho AI nếu source route đang theo kiểu `/ai/api/chat/...` qua gateway.

---

## 15. Prisma commands

### 15.1. Generate Prisma từng service

```bash
pnpm --filter @lms/auth-service run prisma:generate
pnpm --filter @lms/course-service run prisma:generate
pnpm --filter @lms/learning-service run prisma:generate
pnpm --filter @lms/community-service run prisma:generate
pnpm --filter @lms/payment-service run prisma:generate
pnpm --filter @lms/media-service run prisma:generate
pnpm --filter @lms/notification-service run prisma:generate
pnpm --filter @lms/ai-service run prisma:generate
```

### 15.2. Migrate deploy từng service

```bash
pnpm --filter @lms/auth-service run prisma:migrate:deploy
pnpm --filter @lms/course-service run prisma:migrate:deploy
pnpm --filter @lms/learning-service run prisma:migrate:deploy
pnpm --filter @lms/community-service run prisma:migrate:deploy
pnpm --filter @lms/payment-service run prisma:migrate:deploy
pnpm --filter @lms/media-service run prisma:migrate:deploy
pnpm --filter @lms/notification-service run prisma:migrate:deploy
pnpm --filter @lms/ai-service run prisma:migrate:deploy
```

---

## 16. Git commands khi có hotfix

### 16.1. Local commit/push

```bash
git status
git add .
git commit -m "fix: stabilize production demo flows"
git push origin main
```

### 16.2. VPS pull/redeploy

```bash
cd ~/olms-microservices
git pull origin main

docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d --build <service-name>
```

### 16.3. Tạo tag bản ổn định

```bash
git tag public-demo-v1
git push origin public-demo-v1
```

---

## 17. Các lỗi đã gặp và cách xử lý

### 17.1. AI Chatbox `no Route matched with those values`

Nguyên nhân:

```text
Frontend gọi API domain nhưng cookie accessToken không gửi sang subdomain api.
Cookie bị host-only tại lms.thanhbinh.qzz.io.
```

Fix:

```text
AUTH_COOKIE_DOMAIN=.thanhbinh.qzz.io
SameSite=None
Secure=true
Clear cookie cũ
Login lại
Rebuild web-client
```

Lệnh kiểm tra:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml exec web-client printenv | grep AUTH_COOKIE_DOMAIN
```

### 17.2. VNPay thanh toán thành công nhưng order vẫn PENDING

Nguyên nhân:

```text
vnpay-return chỉ validate callback nhưng chưa update order.
```

Fix đã áp dụng:

```text
vnpay-return valid=true + code=00 + transactionStatus=00
=> PENDING -> COMPLETED
=> outbox.created
=> outbox.published
```

Log mong muốn:

```text
vnpay.return.valid
payment.order.completed
outbox.created
outbox.published
```

### 17.3. Thanh toán xong nhưng chưa vào học được

Nguyên nhân:

```text
Learning Service Kafka consumer fail lúc startup vì Kafka chưa ready.
Payment publish event nhưng Learning chưa consume nên enrollment chưa tạo.
```

Fix tạm:

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml restart learning-service
```

Cần sửa bền vững:

```text
Learning/Payment Kafka consumers phải retry background khi Kafka chưa ready.
```

### 17.4. Community QA lỗi `courseId must not be null`

Log:

```text
qaCount failed
Argument courseId must not be null
```

Đánh giá:

```text
Không làm sập community-service.
readyz vẫn 200.
Không blocker nếu chưa demo QA.
```

Fix cần làm:

```text
Validate courseId trước khi query Prisma.
Không truyền courseId:null vào where.
Nếu thiếu courseId thì trả 400 hoặc bỏ filter tùy thiết kế route.
```

---

## 18. Checklist chốt server public-ready

### 18.1. Docker services

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
```

Yêu cầu:

```text
Các backend service healthy.
Kafka/Zookeeper/Kong healthy.
Web-client Up.
```

### 18.2. Public health

```bash
curl -I https://lms.thanhbinh.qzz.io
curl -i https://api.thanhbinh.qzz.io/auth/readyz
curl -i https://api.thanhbinh.qzz.io/course/readyz
curl -i https://api.thanhbinh.qzz.io/learning/readyz
curl -i https://api.thanhbinh.qzz.io/payment/readyz
curl -i https://api.thanhbinh.qzz.io/media/readyz
curl -i https://api.thanhbinh.qzz.io/notification/readyz
curl -i https://api.thanhbinh.qzz.io/community/readyz
curl -i https://api.thanhbinh.qzz.io/ai/readyz
```

### 18.3. Consumer check

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=150 learning-service | grep -iE "consumer running|joined|DLQ processor running"

docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail=150 payment-service | grep -iE "consumer running|joined|payment.order.completed"
```

### 18.4. Error check

```bash
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --since=10m | grep -iE "error|failed|exception|panic|ECONNREFUSED|EAI_AGAIN|timeout"
```

---

## 19. Trạng thái chốt hiện tại

```text
Core LMS: PASS
Deploy Lightsail: PASS
Caddy HTTPS: PASS
Kong Gateway: PASS
Docker services: PASS
AI Chatbox: PASS
VNPay sandbox payment: PASS
Payment PENDING -> COMPLETED: PASS
Payment outbox: PASS
Kafka payment.order.completed: PASS
Learning enrollment: PASS
Course access after payment: PASS
Community health: PASS
QA route: có bug courseId null, không blocker nếu chưa demo QA
```

---

## 20. Backlog kỹ thuật nên sửa sớm

1. `learning-service` Kafka consumer retry background khi Kafka chưa ready.
2. `payment-service` Kafka consumer retry background khi Kafka chưa ready.
3. Fix `community-service` QA count `courseId null`.
4. Thêm healthcheck cho `web-client`.
5. Thêm script smoke test tự động cho public endpoints.
6. Chốt `public-demo-v1` tag trên GitHub.
