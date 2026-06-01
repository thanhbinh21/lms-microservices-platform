# AWS Lightsail Demo Deployment Runbook

## 1. Yeu Cau Truoc Khi Deploy

Muc tieu cua runbook nay la deploy LMS len mot AWS Lightsail VPS theo mo hinh
production-like de demo. Khong co observability stack, Kubernetes hoac CI/CD.

Khuyen nghi:

- Ubuntu 22.04 LTS hoac 24.04 LTS.
- Toi thieu de demo on dinh: `4 vCPU`, `8 GB RAM`, `80 GB SSD`.
- Neu build image truc tiep tren VPS, `8 GB RAM` la muc nen dung. `4 GB RAM` de
  het bo nho khi build web va cac service cung luc.
- Tao Static IP va gan vao instance truoc khi cau hinh DNS.
- Domain da quan ly tren Cloudflare.
- Tai khoan da san sang: Neon, Upstash Redis, Cloudinary, VNPay sandbox va it
  nhat mot AI provider.

Mo Lightsail firewall:

| Port | Protocol | Nguon | Muc dich |
| --- | --- | --- | --- |
| `22` | TCP | IP quan tri cua ban | SSH |
| `80` | TCP | Internet | HTTP redirect va ACME challenge |
| `443` | TCP | Internet | HTTPS |

Khong mo `3000`, `8000`, `8001`, `9092`, `2181` hoac port backend. Compose chi
bind web va Kong proxy vao loopback cua VPS.

Tai lieu tham khao:

- [Tao Lightsail Linux instance](https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-create-linux-instance-virtual-private-server.html)
- [Tao Lightsail Static IP](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html)
- [Sua Lightsail firewall](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-editing-firewall-rules.html)

## 2. Cai Dat Server

SSH vao VPS, sau do cai Docker Engine va Compose plugin theo huong dan Ubuntu
chinh thuc cua Docker:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git gnupg

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
```

Nguon: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

Host can Node.js de chay `pnpm install`, Prisma migrate va generate truoc khi
build image:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
node --version
pnpm --version
```

Clone repo:

```bash
git clone <REPOSITORY_URL> olms-microservices
cd olms-microservices
cp .env.production.example .env.production

for service in auth course payment media notification learning community ai; do
  cp "services/${service}-service/.env.example" "services/${service}-service/.env"
done
```

Chi chay vong `cp` tren VPS moi. Khong ghi de file `.env` dang co secret.

## 3. Cau Hinh Domain

Tao hai DNS record `A` tren Cloudflare cung tro ve Lightsail Static IP:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `lms` | `<LIGHTSAIL_STATIC_IP>` |
| `A` | `api` | `<LIGHTSAIL_STATIC_IP>` |

Vi du:

- Web public URL: `https://lms.example.com`
- Gateway public URL: `https://api.example.com`

Huong dan Cloudflare: [Create DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/).

Dung Caddy tren host de cap SSL va reverse proxy. Day la package host, khong phai
container moi trong Compose:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Sua `/etc/caddy/Caddyfile`:

```caddyfile
lms.example.com {
  reverse_proxy 127.0.0.1:3000
}

api.example.com {
  reverse_proxy 127.0.0.1:8000
}
```

Reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Caddy tu dong xin va renew certificate khi DNS va firewall dung. Tham khao:
[Automatic HTTPS](https://caddyserver.com/docs/automatic-https) va
[`reverse_proxy`](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Neu dung Nginx thay Caddy, reverse proxy cung hai loopback endpoint tren va cau
hinh Let's Encrypt rieng. Khong public Kong Admin API.

## 4. Cau Hinh Env Production/Demo

Khong commit `.env.production`, `kong.production.yml` hoac bat ky
`services/*/.env` nao. Khong dung secret dev khi VPS public. Tao secret moi:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

### 4.1 Env Chung Cho Compose

Sua `.env.production`:

```dotenv
APP_ORIGIN=https://lms.example.com
PUBLIC_GATEWAY_URL=https://api.example.com
KONG_JWT_SECRET=<random-secret-min-32-characters>
INTERNAL_SERVICE_SECRET=<random-shared-internal-secret>

REDIS_URL=rediss://default:<password>@<upstash-host>:6379
CACHE_REDIS_URL=rediss://default:<password>@<upstash-host>:6379

LOG_LEVEL=info
INTERNAL_HTTP_TIMEOUT_MS=2000
COURSE_CIRCUIT_FAILURE_THRESHOLD=3
COURSE_CIRCUIT_RESET_MS=10000

FAULT_INJECTION_ENABLED=false
COURSE_FAULT_DELAY_MS=0
DEMO_NOTIFICATION_FAIL_ATTEMPTS=0
```

Neu secret hoac URL co ky tu dac biet cua shell, boc gia tri bang dau nhay don.

Canh bao: `FAULT_INJECTION_ENABLED` va `DEMO_NOTIFICATION_FAIL_ATTEMPTS` phai tat
mac dinh. Chi bat tam thoi trong luc demo.

### 4.2 Neon Database URL

Trong moi `services/<name>-service/.env`, dien hai bien cua Neon:

```dotenv
DATABASE_URL=postgresql://<user>:<password>@<pooler-host>/<db>?sslmode=require
DIRECT_URL=postgresql://<user>:<password>@<direct-host>/<db>?sslmode=require
```

Can dien cho 8 service: `auth`, `course`, `learning`, `community`, `payment`,
`media`, `notification`, `ai`. Moi service dung database rieng.

### 4.3 JWT Va Internal Secret

Compose override secret chung cho container tu `.env.production`. De file service
nhat quan khi chay CLI local, dien cung gia tri:

```dotenv
# services/auth-service/.env
JWT_SECRET=<same-as-KONG_JWT_SECRET>
INTERNAL_SERVICE_SECRET=<same-shared-internal-secret>
```

Dien `INTERNAL_SERVICE_SECRET` giong nhau trong cac file service con lai.

### 4.4 Kafka

Khong sua Kafka URL production trong file service. Compose override:

```dotenv
KAFKA_BROKER=kafka:29092
```

Kafka va Zookeeper chi nam trong Docker network. Khong mo firewall port Kafka.

### 4.5 Redis/Upstash

`.env.production` da override Redis cho auth, course, media va ai service:

```dotenv
REDIS_URL=rediss://default:<password>@<upstash-host>:6379
CACHE_REDIS_URL=rediss://default:<password>@<upstash-host>:6379
```

### 4.6 Cloudinary

Sua `services/media-service/.env`:

```dotenv
STORAGE_PROVIDER=cloudinary
CLOUDINARY_URL=cloudinary://<api-key>:<api-secret>@<cloud-name>
```

### 4.7 VNPay Sandbox

Sua `services/payment-service/.env`:

```dotenv
VNPAY_TMN_CODE=<sandbox-tmn-code>
VNPAY_HASH_SECRET=<sandbox-hash-secret>
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
```

Compose tu tao hai callback URL public tu domain:

```text
https://lms.example.com/payment/vnpay-return
https://api.example.com/payment/api/vnpay-ipn
```

### 4.8 AI Provider

Sua `services/ai-service/.env`. Dien it nhat mot provider:

```dotenv
AI_PROVIDER_ORDER=openrouter,groq,deepseek
OPENROUTER_API_KEY=<openrouter-key>
OPENROUTER_MODEL=openai/gpt-4o-mini
GROQ_API_KEY=<optional-groq-key>
DEEPSEEK_API_KEY=<optional-deepseek-key>
```

### 4.9 SMTP/Notification

Sua `services/notification-service/.env`:

```dotenv
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
SMTP_FROM=LMS Platform <noreply@example.com>
```

SMTP co the bo trong demo ky thuat; service se log thay vi gui email that.

## 5. Deploy Command

Script da gom install dependency, render Kong production, migrate, generate,
build image, start container va `ps`:

```bash
bash scripts/deploy-lightsail.sh
```

Neu can chay tung buoc de debug:

```bash
set -a
source .env.production
set +a

bash scripts/render-kong-production.sh
corepack enable
pnpm install --frozen-lockfile
pnpm prisma:migrate:deploy:all
pnpm prisma:generate:all
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml ps
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml logs -f
```

`kong.production.yml` duoc render tu `kong.yml`, doi upstream local thanh Docker
DNS, thay JWT secret va thay CORS origin. File render duoc `.gitignore`.

Chi tren database demo, co the seed mot lan sau migrate:

```bash
pnpm seed
```

`pnpm seed` xoa du lieu demo cu. Khong chay tren database can giu du lieu.

## 6. Smoke Test Sau Deploy

Dat helper:

```bash
export API=https://api.example.com
export WEB=https://lms.example.com
export COMPOSE="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml"
```

Kiem tra web, Gateway va health qua Kong:

```bash
curl -fsSI "$WEB"
curl -fsS "$API/auth/readyz"
curl -fsS "$API/course/readyz"
curl -fsS "$API/learning/readyz"
curl -fsS "$API/payment/readyz"
curl -fsS "$API/media/readyz"
curl -fsS "$API/notification/readyz"
curl -fsS "$API/community/readyz"
curl -fsS "$API/ai/readyz"
```

Kiem tra container va Kafka:

```bash
$COMPOSE ps
$COMPOSE ps kafka
docker exec lms-kafka kafka-topics --bootstrap-server localhost:29092 --list
```

Chay K6 smoke tu laptop hoac VPS da cai K6:

```bash
k6 run -e BASE_URL="$API" tests/k6/smoke.js
```

## 7. Demo Flow Sau Deploy

Dat helper:

```bash
export API=https://api.example.com
export COMPOSE="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml"
export TOKEN=<student-access-token>
export COURSE_ID=<published-paid-course-uuid>
```

Lay token bang UI `https://lms.example.com/login` hoac:

```bash
curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"<demo-student-email>","password":"<demo-password>"}'
```

### 7.1 Rate Limit Bang K6

Lenh:

```bash
k6 run -e BASE_URL="$API" tests/k6/rate-limit-auth.js
```

API: `GET /auth/health`.

Expected: request dau tra `200`; request vuot limit theo IP tra `429` voi message
`Too many requests`. Xem response K6 va Kong access log:

```bash
$COMPOSE logs -f kong
```

Khoi phuc: cho het cua so 1 phut truoc demo tiep theo.

### 7.2 Service Down Nhung He Thong Khong Sap Toan Bo

Lenh va API:

```bash
$COMPOSE stop course-service
curl -i "$API/course/api/courses"
curl -i "$API/auth/readyz"
curl -i "$API/payment/readyz"
```

Expected: course upstream loi, nhung Auth va Payment health van `200`.

Log:

```bash
$COMPOSE logs --tail=100 kong course-service payment-service
```

Khoi phuc:

```bash
$COMPOSE start course-service
curl -fsS "$API/course/readyz"
```

### 7.3 Timeout Va Circuit Breaker

Bat delay chi cho internal API cua Course:

```bash
FAULT_INJECTION_ENABLED=true COURSE_FAULT_DELAY_MS=5000 \
  docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --force-recreate course-service
```

Goi it nhat 4 lan API tao order:

```bash
for i in 1 2 3 4; do
  curl -i -X POST "$API/payment/api/orders" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"courseId\":\"$COURSE_ID\"}"
done
```

Expected: 3 request dau timeout khoang 2 giay; request sau fail-fast. Log Payment co
`circuit.open` va `circuit.reject`.

Log:

```bash
$COMPOSE logs -f payment-service
```

Khoi phuc:

```bash
FAULT_INJECTION_ENABLED=false COURSE_FAULT_DELAY_MS=0 \
  docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --force-recreate course-service
sleep 11
curl -i -X POST "$API/payment/api/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"courseId\":\"$COURSE_ID\"}"
```

Expected recovery log: `circuit.half_open`, sau do `circuit.close`.

### 7.4 Outbox Giu Event Khi Kafka Loi

Dung VNPay sandbox UI de hoan tat mot order moi trong luc Kafka down:

```bash
$COMPOSE stop kafka
$COMPOSE logs -f payment-service
```

API callback duoc goi boi VNPay: `GET /payment/api/vnpay-ipn`.

Query Neon `payment_db`:

```sql
select id, topic, status, retry_count, next_attempt_at, last_error, published_at
from outbox_events
order by created_at desc
limit 10;
```

Expected: order da complete, event `payment.order.completed` van `PENDING`, log co
`outbox.publish_failed`.

Khoi phuc:

```bash
$COMPOSE start kafka
$COMPOSE logs -f payment-service learning-service
```

Expected: log `outbox.published`, enrollment duoc tao idempotent va outbox thanh
`PUBLISHED`.

### 7.5 Retry Notification Khi Loi Tam Thoi

Bat fault notification:

```bash
DEMO_NOTIFICATION_FAIL_ATTEMPTS=1 \
  docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --force-recreate notification-service
$COMPOSE logs -f notification-service
```

Hoan tat mot VNPay sandbox order moi. API callback:
`GET /payment/api/vnpay-ipn`.

Expected: lan dau co `Demo transient email failure`, sau do co `kafka.retry` voi
topic `payment.order.completed.retry-5s`; lan retry tiep theo thanh cong.

Khoi phuc:

```bash
DEMO_NOTIFICATION_FAIL_ATTEMPTS=0 \
  docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --force-recreate notification-service
```

### 7.6 DLQ Khi Payload Sai Schema

Produce event co envelope hop le nhung payload sai UUID:

```bash
printf '%s\n' \
'{"event_id":"demo-bad-payment-001","event_type":"payment.order.completed","timestamp":"2026-06-01T00:00:00.000Z","trace_id":"demo-dlq","data":{"order_id":"invalid","user_id":"demo-user","course_id":"invalid","instructor_id":"demo-instructor","amount":1,"currency":"VND","payment_method":"vnpay","vnp_txn_ref":"demo","vnp_transaction_no":"demo","paid_at":"2026-06-01T00:00:00.000Z"}}' |
docker exec -i lms-kafka kafka-console-producer \
  --bootstrap-server localhost:29092 \
  --topic payment.order.completed
```

API admin de xem sau khi login admin:
`GET /learning/api/admin/dlq` hoac UI `https://lms.example.com/admin/dlq`.

Expected sau khoang 70 giay: log `kafka.retry` cho `retry-5s`, `retry-1m`, sau
do `kafka.dlq` va `[learning-service] DLQ event persisted`.

Log:

```bash
$COMPOSE logs -f learning-service notification-service
```

Khoi phuc: khong can restart. Resolve event tren UI admin sau khi chup ket qua.

### 7.7 Recovery

Lenh:

```bash
$COMPOSE start kafka course-service
curl -fsS "$API/course/readyz"
curl -fsS "$API/payment/readyz"
$COMPOSE logs --tail=200 payment-service learning-service notification-service
```

Expected: health quay lai `200`, breaker dong lai sau request thanh cong, Payment
outbox drain ve `PUBLISHED`, consumer tiep tuc xu ly event moi.

Cuoi demo, dam bao fault flag da tat:

```bash
grep -E '^(FAULT_INJECTION_ENABLED|COURSE_FAULT_DELAY_MS|DEMO_NOTIFICATION_FAIL_ATTEMPTS)=' .env.production
```

## 8. Rollback Don Gian

Xem trang thai va log:

```bash
$COMPOSE ps
$COMPOSE logs --tail=300
$COMPOSE logs --tail=300 payment-service course-service kong
```

Restart mot service:

```bash
$COMPOSE restart payment-service
```

Rollback code:

```bash
cp .env.production ".env.production.backup.$(date +%Y%m%d-%H%M%S)"
git fetch --all --tags
git checkout <known-good-tag-or-commit>
set -a
source .env.production
set +a
bash scripts/render-kong-production.sh
$COMPOSE up -d --build
```

Khoi phuc env neu can:

```bash
cp <env-backup-file> .env.production
```

Dung toan bo container:

```bash
$COMPOSE down
```

Khong them `-v` khi down neu muon giu Kafka/Zookeeper volume demo.

## 9. Checklist Truoc Khi Bat Dau Deploy

- [ ] Code da commit sach.
- [ ] `.env.production` da dien du va khong bi track boi Git.
- [ ] `services/*/.env` da dien Neon va provider can thiet.
- [ ] Domain Cloudflare da tro ve Lightsail Static IP.
- [ ] Lightsail firewall da mo `22`, `80`, `443`.
- [ ] Neon migration san sang.
- [ ] `pnpm prisma:migrate:status:all` khong bao loi.
- [ ] Docker build pass.
- [ ] Smoke test pass local.
- [ ] `FAULT_INJECTION_ENABLED=false`.
- [ ] `COURSE_FAULT_DELAY_MS=0`.
- [ ] `DEMO_NOTIFICATION_FAIL_ATTEMPTS=0`.
- [ ] Port `8001`, `9092`, `2181` va backend khong public.
