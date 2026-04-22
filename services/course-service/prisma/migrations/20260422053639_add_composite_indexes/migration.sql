-- CreateIndex
CREATE INDEX "courses_status_category_id_idx" ON "courses"("status", "category_id");

-- CreateIndex
CREATE INDEX "courses_status_level_idx" ON "courses"("status", "level");

-- CreateIndex
CREATE INDEX "courses_status_created_at_idx" ON "courses"("status", "created_at" DESC);
