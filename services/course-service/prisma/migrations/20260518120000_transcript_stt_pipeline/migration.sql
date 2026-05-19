ALTER TABLE "lesson_transcripts"
  ADD COLUMN IF NOT EXISTS "content_kind" TEXT NOT NULL DEFAULT 'VERBATIM_TRANSCRIPT',
  ADD COLUMN IF NOT EXISTS "video_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "job_id" TEXT;

UPDATE "lesson_transcripts"
SET "content_kind" = 'AI_CONTEXT'
WHERE "source_type" = 'AUTO_CONTEXT';

CREATE INDEX IF NOT EXISTS "lesson_transcripts_source_type_status_idx"
  ON "lesson_transcripts"("source_type", "status");

CREATE INDEX IF NOT EXISTS "lesson_transcripts_video_hash_idx"
  ON "lesson_transcripts"("video_hash");

CREATE TABLE IF NOT EXISTS "transcript_jobs" (
  "id" TEXT NOT NULL,
  "lesson_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_url" TEXT,
  "video_hash" TEXT,
  "provider" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "locked_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transcript_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transcript_jobs_status_created_at_idx"
  ON "transcript_jobs"("status", "created_at");

CREATE INDEX IF NOT EXISTS "transcript_jobs_lesson_id_idx"
  ON "transcript_jobs"("lesson_id");

CREATE INDEX IF NOT EXISTS "transcript_jobs_video_hash_idx"
  ON "transcript_jobs"("video_hash");

DO $$
BEGIN
  ALTER TABLE "transcript_jobs"
    ADD CONSTRAINT "transcript_jobs_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
