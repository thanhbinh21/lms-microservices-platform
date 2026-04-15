/*
  Warnings:

  - You are about to drop the column `enrollment_type` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `completed_at` on the `lesson_progress` table. All the data in the column will be lost.
  - You are about to drop the column `course_id` on the `lesson_progress` table. All the data in the column will be lost.
  - You are about to drop the column `last_position` on the `lesson_progress` table. All the data in the column will be lost.
  - You are about to drop the column `watched_duration` on the `lesson_progress` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "lesson_progress_user_id_course_id_idx";

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

-- CreateIndex
CREATE INDEX "lesson_progress_user_id_idx" ON "lesson_progress"("user_id");

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
