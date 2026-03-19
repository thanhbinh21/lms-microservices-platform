# Project Structure - INTERNAL ARCHITECTURE GUIDE




## Monorepo Layout

/lms-platform
├── apps
│   ├── web-client          # Next.js 15 (Student + Instructor UI)
│   ├── admin-dashboard    # React/Vite (Admin)
│   ├── api-gateway        # Nginx/Kong or Node Proxy
│
├── services
│   ├── auth-service
│   ├── course-service
│   ├── payment-service
│   ├── media-service
│   ├── notification-service
│
├── packages
│   ├── db-prisma
│   ├── kafka-client
│   ├── logger
│   ├── ui
│
├── docker-compose.yml

## Infrastructure

### Local Services (Docker Compose)
- Kafka + Zookeeper (Event-Driven Architecture)
- Redis (Session/Cache)

### Serverless Services (Neon)
- PostgreSQL Databases (5 separate instances)
  - auth_db
  - course_db
  - payment_db
  - media_db
  - notification_db

**Benefits:**
- Auto-pause after 5 min idle → 0 resource usage
- ~400MB RAM saved on local machine
- Free tier: 0.5GB per database

## Data Flow

Client → API Gateway  
Gateway → Microservices  
Microservices → Neon PostgreSQL (serverless)
Payment → Kafka → Course/Notification  

## BFF Pattern

Next.js Server Actions:
- getStudentDashboard()
- fetch multiple services in parallel
- merge data before returning to UI

## Kafka Topics

- payment.order.completed
- payment.order.completed.retry-5s
- payment.order.completed.retry-1m
- system.dead-letter

## Database Rules

- Each service owns its own DB (Neon serverless)
- No cross-service DB access
- Use API or Kafka only
- Connection pooling via Neon (built-in)

## Security Rules

- JWT only verified at Gateway
- Rate limit: 100 req/min
- VNPay checksum required
- Use JSONB audit logs
- DB connections use SSL (sslmode=require)