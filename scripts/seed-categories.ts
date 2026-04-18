/**
 * Seed Script: Tao cac danh muc (Category) mac dinh cho he thong LMS
 *
 * Chay: npx tsx scripts/seed-categories.ts
 */

import { PrismaClient as CoursePrisma } from '../services/course-service/src/generated/prisma/index.js';

const coursePrisma = new CoursePrisma({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL_COURSE ||
        process.env.DATABASE_URL ||
        'postgresql://neondb_owner:npg_ChRI1PZd4qAD@ep-wandering-grass-a19dywim-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    },
  },
});

const CATEGORIES = [
  { name: 'Web Frontend', slug: 'web-frontend', order: 1 },
  { name: 'Web Backend', slug: 'web-backend', order: 2 },
  { name: 'Mobile', slug: 'mobile', order: 3 },
  { name: 'DevOps', slug: 'devops', order: 4 },
  { name: 'System Design', slug: 'system-design', order: 5 },
  { name: 'Data Science', slug: 'data-science', order: 6 },
  { name: 'AI / Machine Learning', slug: 'ai-ml', order: 7 },
  { name: 'Database', slug: 'database', order: 8 },
  { name: 'Security', slug: 'security', order: 9 },
  { name: 'Automation', slug: 'automation', order: 10 },
  { name: 'Soft Skills', slug: 'soft-skills', order: 11 },
];

const CATEGORY_MAP: Record<string, string> = {
  'Trí Tuệ Nhân Tạo (AI)': 'ai-ml',
  'Backend Development': 'web-backend',
  Automation: 'automation',
};

async function seedCategories() {
  console.log('🌱 Seeding categories...\n');

  for (const cat of CATEGORIES) {
    await coursePrisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, order: cat.order },
      create: cat,
    });
    console.log(`  ✅ ${cat.name} (${cat.slug})`);
  }

  console.log('\n🔗 Linking existing courses to categories...\n');

  const courses = await coursePrisma.course.findMany({
    select: { id: true, title: true, categoryId: true },
  });

  // Legacy courses stored category as a plain string in a now-removed column.
  // After migration the column is gone, so we match by title keywords instead.
  for (const course of courses) {
    if (course.categoryId) continue;

    let matchedSlug: string | null = null;

    const titleLower = course.title.toLowerCase();
    if (titleLower.includes('ai') || titleLower.includes('trí tuệ nhân tạo')) {
      matchedSlug = 'ai-ml';
    } else if (
      titleLower.includes('jwt') ||
      titleLower.includes('api') ||
      titleLower.includes('backend')
    ) {
      matchedSlug = 'web-backend';
    } else if (titleLower.includes('n8n') || titleLower.includes('tự động')) {
      matchedSlug = 'automation';
    } else if (titleLower.includes('react') || titleLower.includes('frontend')) {
      matchedSlug = 'web-frontend';
    }

    if (matchedSlug) {
      const category = await coursePrisma.category.findUnique({ where: { slug: matchedSlug } });
      if (category) {
        await coursePrisma.course.update({
          where: { id: course.id },
          data: { categoryId: category.id },
        });
        console.log(`  🔗 "${course.title}" → ${category.name}`);
      }
    }
  }
}

async function main() {
  try {
    await seedCategories();
  } catch (error) {
    console.error('❌ Seed categories failed:', error);
    process.exit(1);
  } finally {
    await coursePrisma.$disconnect();
    console.log('\n✨ Done!');
  }
}

main();
