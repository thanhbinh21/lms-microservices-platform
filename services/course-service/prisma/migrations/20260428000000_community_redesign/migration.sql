-- CreateEnum: Loai nhom cong dong
CREATE TYPE "CommunityGroupType" AS ENUM ('PUBLIC', 'COURSE_PRIVATE');

-- AlterTable: Them type, owner_id, cho phep courseId null
ALTER TABLE "community_groups" ADD COLUMN "type" "CommunityGroupType" NOT NULL DEFAULT 'COURSE_PRIVATE';
ALTER TABLE "community_groups" ADD COLUMN "owner_id" TEXT NOT NULL DEFAULT '';

-- Backfill owner_id tu instructor cua khoa hoc lien ket
UPDATE "community_groups" g
SET "owner_id" = c."instructor_id"
FROM "courses" c
WHERE g."course_id" = c."id";

-- Bo constraint unique cu tren course_id (1:1) de cho phep nhieu group type khac
-- Prisma truoc do tao unique index khi dung @unique tren field
DROP INDEX IF EXISTS "community_groups_course_id_key";

-- Cho phep course_id null (cho public groups)
ALTER TABLE "community_groups" ALTER COLUMN "course_id" DROP NOT NULL;

-- Tao unique index moi chi ap dung khi course_id != null (moi course chi 1 private group)
CREATE UNIQUE INDEX "community_groups_course_id_unique" ON "community_groups"("course_id");

-- CreateIndex: Tim nhanh theo type va owner
CREATE INDEX "community_groups_type_idx" ON "community_groups"("type");
CREATE INDEX "community_groups_owner_id_idx" ON "community_groups"("owner_id");
