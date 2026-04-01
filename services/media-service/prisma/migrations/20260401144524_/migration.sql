-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "type" "MediaType" NOT NULL DEFAULT 'VIDEO',
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploader_id" TEXT NOT NULL,
    "course_id" TEXT,
    "lesson_id" TEXT,
    "url" TEXT,
    "presigned_url" TEXT,
    "presigned_exp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_uploader_id_idx" ON "media_assets"("uploader_id");

-- CreateIndex
CREATE INDEX "media_assets_course_id_idx" ON "media_assets"("course_id");

-- CreateIndex
CREATE INDEX "media_assets_lesson_id_idx" ON "media_assets"("lesson_id");

-- CreateIndex
CREATE INDEX "media_assets_status_idx" ON "media_assets"("status");
