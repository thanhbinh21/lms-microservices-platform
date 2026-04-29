/*
  Warnings:

  - Added the required column `instructor_id` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'WITHDRAWN');

-- AlterTable
-- Set placeholder for existing orders (they should be backfilled manually or via a data migration script).
-- All existing orders are from before instructor_id tracking, so mark them as "unknown".
ALTER TABLE "orders" ADD COLUMN     "instructor_id" TEXT NOT NULL DEFAULT 'unknown';

-- CreateTable
CREATE TABLE "instructor_earnings" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "platform_fee" DECIMAL(12,2) NOT NULL DEFAULT 0.30,
    "net_amount" DECIMAL(12,2) NOT NULL,
    "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instructor_earnings_order_id_key" ON "instructor_earnings"("order_id");

-- CreateIndex
CREATE INDEX "instructor_earnings_instructor_id_idx" ON "instructor_earnings"("instructor_id");

-- CreateIndex
CREATE INDEX "instructor_earnings_course_id_idx" ON "instructor_earnings"("course_id");
