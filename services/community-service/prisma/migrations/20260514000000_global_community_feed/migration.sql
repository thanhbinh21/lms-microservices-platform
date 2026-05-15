-- Refactor community thanh feed toan he thong.
-- Chu truong nghiep vu: xoa sach du lieu community group/post/member cu.

DROP TABLE IF EXISTS "community_posts" CASCADE;
DROP TABLE IF EXISTS "community_members" CASCADE;
DROP TABLE IF EXISTS "community_groups" CASCADE;
DROP TABLE IF EXISTS "course_enrollment_permissions" CASCADE;
DROP TYPE IF EXISTS "GroupType" CASCADE;

CREATE TABLE "community_posts" (
  "id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "image_url" TEXT,
  "parent_id" TEXT,
  "like_count" INTEGER NOT NULL DEFAULT 0,
  "liked_by_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reply_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_posts_parent_id_created_at_idx" ON "community_posts"("parent_id", "created_at");
CREATE INDEX "community_posts_created_at_idx" ON "community_posts"("created_at" DESC);
CREATE INDEX "community_posts_author_id_idx" ON "community_posts"("author_id");

ALTER TABLE "community_posts"
  ADD CONSTRAINT "community_posts_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "question_upvotes"
WHERE "question_id" IN (SELECT "id" FROM "questions" WHERE "course_id" IS NULL);
DELETE FROM "answer_upvotes"
WHERE "answer_id" IN (
  SELECT "answers"."id"
  FROM "answers"
  INNER JOIN "questions" ON "questions"."id" = "answers"."question_id"
  WHERE "questions"."course_id" IS NULL
);
DELETE FROM "answers"
WHERE "question_id" IN (SELECT "id" FROM "questions" WHERE "course_id" IS NULL);
DELETE FROM "questions" WHERE "course_id" IS NULL;

ALTER TABLE "questions" ALTER COLUMN "course_id" SET NOT NULL;
