-- CreateTable
CREATE TABLE "instructor_profiles" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "avatar" TEXT,
    "social_links" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instructor_profiles_instructor_id_key" ON "instructor_profiles"("instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_profiles_slug_key" ON "instructor_profiles"("slug");

-- CreateIndex
CREATE INDEX "instructor_profiles_slug_idx" ON "instructor_profiles"("slug");
