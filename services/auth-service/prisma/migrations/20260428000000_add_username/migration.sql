-- AlterTable: Them username cho User de hien thi va tim kiem trong community
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Backfill: Sinh username tu email prefix cho user da co
UPDATE "users" SET "username" = SPLIT_PART("email", '@', 1) || '_' || LEFT("id"::TEXT, 4) WHERE "username" IS NULL;

-- CreateIndex: Dam bao username la unique
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
