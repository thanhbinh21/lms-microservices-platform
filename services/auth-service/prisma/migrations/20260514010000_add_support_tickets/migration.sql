CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketCategory" AS ENUM ('PAYMENT', 'COURSE', 'ACCOUNT', 'SYSTEM', 'OTHER');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TABLE "support_tickets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "SupportTicketCategory" NOT NULL DEFAULT 'OTHER',
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "closed_at" TIMESTAMP(3),

  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_ticket_replies" (
  "id" TEXT NOT NULL,
  "ticket_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "author_role" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_ticket_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at" DESC);
CREATE INDEX "support_ticket_replies_ticket_id_idx" ON "support_ticket_replies"("ticket_id");
CREATE INDEX "support_ticket_replies_author_id_idx" ON "support_ticket_replies"("author_id");
CREATE INDEX "support_ticket_replies_created_at_idx" ON "support_ticket_replies"("created_at" DESC);

ALTER TABLE "support_ticket_replies"
  ADD CONSTRAINT "support_ticket_replies_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
