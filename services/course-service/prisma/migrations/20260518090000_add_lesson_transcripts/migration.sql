CREATE TABLE IF NOT EXISTS "lesson_transcripts" (
  "id" TEXT NOT NULL,
  "lesson_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "provider" TEXT,
  "language" TEXT NOT NULL DEFAULT 'vi',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "full_text" TEXT,
  "segments" JSONB,
  "duration_sec" INTEGER,
  "file_size_mb" INTEGER,
  "confidence" DOUBLE PRECISION,
  "content_hash" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "generated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_transcripts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lesson_transcripts_lesson_id_idx" ON "lesson_transcripts"("lesson_id");
CREATE INDEX IF NOT EXISTS "lesson_transcripts_status_idx" ON "lesson_transcripts"("status");

DO $$
BEGIN
  ALTER TABLE "lesson_transcripts"
    ADD CONSTRAINT "lesson_transcripts_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
