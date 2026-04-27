-- CreateTable
CREATE TABLE "community_groups" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_groups_course_id_key" ON "community_groups"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_groups_slug_key" ON "community_groups"("slug");

-- CreateIndex
CREATE INDEX "community_groups_created_at_idx" ON "community_groups"("created_at" DESC);

-- CreateIndex
CREATE INDEX "community_members_user_id_idx" ON "community_members"("user_id");

-- CreateIndex
CREATE INDEX "community_members_group_id_idx" ON "community_members"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_members_group_id_user_id_key" ON "community_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "community_posts_group_id_created_at_idx" ON "community_posts"("group_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "community_posts_parent_id_idx" ON "community_posts"("parent_id");

-- CreateIndex
CREATE INDEX "community_posts_author_id_idx" ON "community_posts"("author_id");

-- AddForeignKey
ALTER TABLE "community_groups" ADD CONSTRAINT "community_groups_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "community_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "community_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
