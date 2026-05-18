CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "lesson_id" TEXT,
  "title" TEXT NOT NULL DEFAULT 'Cuoc tro chuyen moi',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "token_count" INTEGER,
  "is_error" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_conversation_summaries" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "summary_text" TEXT NOT NULL,
  "message_index" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_conversation_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_quiz_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "lesson_id" TEXT,
  "quiz_type" TEXT NOT NULL DEFAULT 'LESSON',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "questions_hash" TEXT NOT NULL,
  "questions_client" JSONB NOT NULL,
  "correct_data" JSONB NOT NULL,
  "score" INTEGER,
  "total_questions" INTEGER NOT NULL,
  "correct_answers" INTEGER,
  "submitted_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_quiz_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_user_id_course_id_idx" ON "ai_conversations"("user_id", "course_id");
CREATE INDEX IF NOT EXISTS "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_conversation_summaries_conversation_id_key"
ON "ai_conversation_summaries"("conversation_id");
CREATE INDEX IF NOT EXISTS "ai_quiz_sessions_user_id_idx" ON "ai_quiz_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "ai_quiz_sessions_lesson_id_idx" ON "ai_quiz_sessions"("lesson_id");
CREATE INDEX IF NOT EXISTS "ai_quiz_sessions_user_id_course_id_quiz_type_status_idx"
ON "ai_quiz_sessions"("user_id", "course_id", "quiz_type", "status");

DO $$
BEGIN
  ALTER TABLE "ai_messages"
    ADD CONSTRAINT "ai_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
