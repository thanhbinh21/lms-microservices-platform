-- Phase 25 + archive plan:
-- - Add global Q&A entities
-- - Soft-archive legacy community data

ALTER TABLE "community_groups"
ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "community_posts"
ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "questions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "course_id" TEXT,
  "lesson_id" TEXT,
  "is_resolved" BOOLEAN NOT NULL DEFAULT false,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "upvote_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "answers" (
  "id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "is_accepted" BOOLEAN NOT NULL DEFAULT false,
  "upvote_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "question_upvotes" (
  "id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "question_upvotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "answer_upvotes" (
  "id" TEXT NOT NULL,
  "answer_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "answer_upvotes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "questions_user_id_idx" ON "questions"("user_id");
CREATE INDEX IF NOT EXISTS "questions_course_id_idx" ON "questions"("course_id");
CREATE INDEX IF NOT EXISTS "questions_is_resolved_idx" ON "questions"("is_resolved");
CREATE INDEX IF NOT EXISTS "questions_created_at_idx" ON "questions"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "answers_question_id_idx" ON "answers"("question_id");
CREATE INDEX IF NOT EXISTS "answers_user_id_idx" ON "answers"("user_id");
CREATE INDEX IF NOT EXISTS "answers_is_accepted_idx" ON "answers"("is_accepted");

CREATE UNIQUE INDEX IF NOT EXISTS "question_upvotes_question_id_user_id_key"
ON "question_upvotes"("question_id", "user_id");
CREATE INDEX IF NOT EXISTS "question_upvotes_user_id_idx" ON "question_upvotes"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "answer_upvotes_answer_id_user_id_key"
ON "answer_upvotes"("answer_id", "user_id");
CREATE INDEX IF NOT EXISTS "answer_upvotes_user_id_idx" ON "answer_upvotes"("user_id");

DO $$
BEGIN
  ALTER TABLE "questions"
    ADD CONSTRAINT "questions_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "answers"
    ADD CONSTRAINT "answers_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "question_upvotes"
    ADD CONSTRAINT "question_upvotes_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "answer_upvotes"
    ADD CONSTRAINT "answer_upvotes_answer_id_fkey"
    FOREIGN KEY ("answer_id") REFERENCES "answers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Soft archive all legacy community data so migration is reversible and auditable.
UPDATE "community_groups" SET "is_archived" = true WHERE "is_archived" = false;
UPDATE "community_posts" SET "is_archived" = true WHERE "is_archived" = false;
