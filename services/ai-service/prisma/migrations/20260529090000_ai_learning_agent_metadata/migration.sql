ALTER TABLE "ai_messages"
  ADD COLUMN IF NOT EXISTS "sources" JSONB,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "ai_quiz_sessions"
  ADD COLUMN IF NOT EXISTS "context_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "blueprint" JSONB,
  ADD COLUMN IF NOT EXISTS "quality_report" JSONB;
