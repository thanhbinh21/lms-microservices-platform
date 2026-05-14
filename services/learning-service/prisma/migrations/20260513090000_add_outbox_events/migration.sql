CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "event_key" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "trace_id" TEXT,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");
CREATE INDEX "outbox_events_status_next_attempt_at_idx" ON "outbox_events"("status", "next_attempt_at");
CREATE INDEX "outbox_events_topic_idx" ON "outbox_events"("topic");

ALTER TABLE "failed_events" ADD COLUMN "event_id" TEXT;
ALTER TABLE "failed_events" ADD COLUMN "trace_id" TEXT;
CREATE UNIQUE INDEX "failed_events_topic_event_id_key" ON "failed_events"("topic", "event_id");
