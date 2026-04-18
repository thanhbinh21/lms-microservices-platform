/*
  Warnings:

  - You are about to drop the column `category` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `enrollment_type` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `completed_at` on the `lesson_progress` table. All the data in the column will be lost.
  - You are about to drop the column `course_id` on the `lesson_progress` table. All the data in the column will be lost.
  - You are about to drop the column `last_position` on the `lesson_progress` table. All the data in the column will be lost.
  - You are about to drop the column `watched_duration` on the `lesson_progress` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FailedEventStatus" AS ENUM ('PENDING', 'RETRIED', 'RESOLVED', 'IGNORED');

-- DropIndex
DROP INDEX "lesson_progress_user_id_course_id_idx";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "category",
ADD COLUMN     "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "enrollment_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "enrollment_type";

-- AlterTable
ALTER TABLE "lesson_progress" DROP COLUMN "completed_at",
DROP COLUMN "course_id",
DROP COLUMN "last_position",
DROP COLUMN "watched_duration",
ADD COLUMN     "last_watched" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "content" TEXT;

-- DropEnum
DROP TYPE "EnrollmentType";

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_events" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "original_key" TEXT,
    "payload" JSONB NOT NULL,
    "error_message" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "status" "FailedEventStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retried_at" TIMESTAMP(3),

    CONSTRAINT "failed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "reviews_course_id_idx" ON "reviews"("course_id");

-- CreateIndex
CREATE INDEX "reviews_is_flagged_idx" ON "reviews"("is_flagged");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_user_id_course_id_key" ON "reviews"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "failed_events_status_idx" ON "failed_events"("status");

-- CreateIndex
CREATE INDEX "failed_events_topic_idx" ON "failed_events"("topic");

-- CreateIndex
CREATE INDEX "courses_category_id_idx" ON "courses"("category_id");

-- CreateIndex
CREATE INDEX "courses_average_rating_enrollment_count_idx" ON "courses"("average_rating" DESC, "enrollment_count" DESC);

-- CreateIndex
CREATE INDEX "courses_price_idx" ON "courses"("price");

-- CreateIndex
CREATE INDEX "courses_created_at_idx" ON "courses"("created_at" DESC);

-- CreateIndex
CREATE INDEX "lesson_progress_user_id_idx" ON "lesson_progress"("user_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
