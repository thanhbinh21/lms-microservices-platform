-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('VNPAY');

-- CreateEnum
CREATE TYPE "AuditKind" AS ENUM ('CREATE_URL', 'RETURN', 'IPN');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "course_title" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'VNPAY',
    "vnp_txn_ref" TEXT NOT NULL,
    "vnp_pay_url" TEXT,
    "vnp_transaction_no" TEXT,
    "vnp_bank_code" TEXT,
    "vnp_response_code" TEXT,
    "failure_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "trace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vnpay_audits" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "kind" "AuditKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vnpay_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_vnp_txn_ref_key" ON "orders"("vnp_txn_ref");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_course_id_idx" ON "orders"("course_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "vnpay_audits_order_id_idx" ON "vnpay_audits"("order_id");

-- CreateIndex
CREATE INDEX "vnpay_audits_kind_idx" ON "vnpay_audits"("kind");

-- AddForeignKey
ALTER TABLE "vnpay_audits" ADD CONSTRAINT "vnpay_audits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
