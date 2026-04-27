/**
 * Seed Script Tổng Hợp: Tạo dữ liệu mẫu cho hệ thống LMS
 * 
 * Chạy: npx tsx scripts/seed-all.ts
 * 
 * Thực hiện:
 *   1. Xóa toàn bộ dữ liệu mẫu cũ (Clear Data)
 *   2. Tạo tài khoản: 1 Admin, 1 Instructor, 2 Students
 *   3. Tạo danh mục (Categories)
 *   4. Tạo khóa học mẫu (10 khóa: 7 free, 3 paid) kèm private groups
 *   5. Tạo public community group & bài post mẫu của học viên
 */

import { PrismaClient as CoursePrisma, Prisma } from '../services/course-service/src/generated/prisma/index.js';
import { PrismaClient as AuthPrisma } from '../services/auth-service/src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BCRYPT_SALT_ROUNDS = 10;

function readEnvVarFromFile(filePath: string, variableName: string): string | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalized = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;
    const equalIndex = normalized.indexOf('=');

    if (equalIndex === -1) {
      continue;
    }

    const key = normalized.slice(0, equalIndex).trim();
    if (key !== variableName) {
      continue;
    }

    let value = normalized.slice(equalIndex + 1).trim();
    const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
    const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
    if (hasDoubleQuotes || hasSingleQuotes) {
      value = value.slice(1, -1);
    }

    return value;
  }

  return undefined;
}

const projectRoot = path.resolve(__dirname, '..');

const authDbUrl =
  process.env.DATABASE_URL_AUTH ||
  process.env.AUTH_DATABASE_URL ||
  readEnvVarFromFile(
    path.join(projectRoot, 'services', 'auth-service', '.env'),
    'DATABASE_URL',
  );

const courseDbUrl =
  process.env.DATABASE_URL_COURSE ||
  process.env.COURSE_DATABASE_URL ||
  readEnvVarFromFile(
    path.join(projectRoot, 'services', 'course-service', '.env'),
    'DATABASE_URL',
  );

if (!authDbUrl || !courseDbUrl) {
  const missing = [
    !authDbUrl ? 'auth-service DATABASE_URL' : null,
    !courseDbUrl ? 'course-service DATABASE_URL' : null,
  ]
    .filter(Boolean)
    .join(', ');

  throw new Error(
    `Missing database URL for seed script (${missing}). Set DATABASE_URL_AUTH/DATABASE_URL_COURSE or configure services/*/.env.`,
  );
}

// ─── Database Connections ─────────────────────────────────────────────────────

const authPrisma = new AuthPrisma({
  datasources: {
    db: {
      url: authDbUrl,
    },
  },
});

const coursePrisma = new CoursePrisma({
  datasources: {
    db: {
      url: courseDbUrl,
    },
  },
});

// ─── Clear Data ───────────────────────────────────────────────────────────────

async function clearOldData() {
  console.log('══════════════════════════════════════════════════');
  console.log('  🗑️  BƯỚC 1: XÓA DỮ LIỆU CŨ');
  console.log('══════════════════════════════════════════════════\n');

  try {
    // Delete Community
    await coursePrisma.communityPost.deleteMany();
    await coursePrisma.communityMember.deleteMany();
    await coursePrisma.communityGroup.deleteMany();
    console.log('  ✅ Đã xóa toàn bộ Community (Groups, Members, Posts)');

    // Delete Courses Data first (Child to Parent)
    await coursePrisma.lesson.deleteMany();
    console.log('  ✅ Đã xóa toàn bộ Lessons');
    
    await coursePrisma.chapter.deleteMany();
    console.log('  ✅ Đã xóa toàn bộ Chapters');
    
    await coursePrisma.course.deleteMany();
    console.log('  ✅ Đã xóa toàn bộ Courses');

    await coursePrisma.category.deleteMany();
    console.log('  ✅ Đã xóa toàn bộ Categories');

    // Delete Auth Data
    await authPrisma.user.deleteMany();
    console.log('  ✅ Đã xóa toàn bộ Users');

    // Flush Redis Cache
    const redisUrl = 
      readEnvVarFromFile(path.join(__dirname, '../services/course-service/.env'), 'CACHE_REDIS_URL') || 
      process.env.CACHE_REDIS_URL;
    if (redisUrl) {
      const redis = new Redis(redisUrl);
      await redis.flushall();
      await redis.quit();
      console.log('  ✅ Đã dọn dẹp Redis Cache toàn hệ thống');
    }
    
    console.log('\n  Hoàn tất dọn dẹp dữ liệu cũ!\n');
  } catch (error) {
    console.error('  ❌ Lỗi khi xóa dữ liệu:', error);
    throw error;
  }
}

// ─── Seed Accounts ────────────────────────────────────────────────────────────

interface SeedAccount {
  email: string;
  password: string;
  name: string;
  username: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  key: string;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  { key: 'ADMIN', email: 'admin@nexedu.vn', password: 'Admin@123', name: 'Lê Văn Admin', username: 'admin_nexedu', role: 'ADMIN' },
  { key: 'INSTRUCTOR', email: 'instructor@nexedu.vn', password: 'Instructor@123', name: 'Trần Thị Giảng Viên', username: 'gv_tran', role: 'INSTRUCTOR' },
  { key: 'STUDENT_1', email: 'student1@nexedu.vn', password: 'Student@123', name: 'Học Viên Số 1', username: 'hocvien_1', role: 'STUDENT' },
  { key: 'STUDENT_2', email: 'student2@nexedu.vn', password: 'Student@123', name: 'Học Viên Số 2', username: 'hocvien_2', role: 'STUDENT' },
];

async function seedAccounts(): Promise<Map<string, string>> {
  console.log('══════════════════════════════════════════════════');
  console.log('  📋 BƯỚC 2: TẠO TÀI KHOẢN MẪU');
  console.log('══════════════════════════════════════════════════\n');

  const userIdMap = new Map<string, string>(); // key -> userId

  for (const account of SEED_ACCOUNTS) {
    try {
      const hashedPassword = await bcrypt.hash(account.password, BCRYPT_SALT_ROUNDS);

      const user = await authPrisma.user.create({
        data: {
          email: account.email,
          password: hashedPassword,
          name: account.name,
          username: account.username,
          role: account.role,
          sourceType: 'CREDENTIALS',
        },
      });

      console.log(`  ✅ [${account.role.padEnd(12)}] ${account.email} — ID: ${user.id}`);
      userIdMap.set(account.key, user.id);
    } catch (error) {
      console.error(`  ❌ Lỗi khi tạo ${account.email}:`, error);
    }
  }

  console.log('\n  📋 Thông tin đăng nhập:');
  console.log('  ' + '─'.repeat(80));
  for (const account of SEED_ACCOUNTS) {
    console.log(`    ${account.role.padEnd(12)} | ${account.email.padEnd(25)} | Pass: ${account.password}`);
  }
  console.log('  ' + '─'.repeat(80) + '\n');

  return userIdMap;
}

// ─── Seed Categories ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Web Frontend', slug: 'web-frontend', order: 1 },
  { name: 'Web Backend', slug: 'web-backend', order: 2 },
  { name: 'Mobile', slug: 'mobile', order: 3 },
  { name: 'DevOps', slug: 'devops', order: 4 },
  { name: 'Trí Tuệ Nhân Tạo (AI)', slug: 'ai-ml', order: 5 },
  { name: 'Soft Skills', slug: 'soft-skills', order: 6 },
];

async function seedCategories(): Promise<Map<string, string>> {
  console.log('══════════════════════════════════════════════════');
  console.log('  🏷️  BƯỚC 3: TẠO DANH MỤC');
  console.log('══════════════════════════════════════════════════\n');

  const categoryIdMap = new Map<string, string>();

  for (const cat of CATEGORIES) {
    try {
      const category = await coursePrisma.category.create({
        data: cat,
      });
      console.log(`  ✅ ${cat.name}`);
      categoryIdMap.set(cat.slug, category.id);
    } catch (error) {
      console.error(`  ❌ Lỗi tạo danh mục ${cat.name}:`, error);
    }
  }
  
  console.log('');
  return categoryIdMap;
}

// ─── Seed Courses ─────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const COURSES_DATA = [
  // 3 KHÓA TRẢ PHÍ
  { title: 'ReactJS Pro Mastery', cat: 'web-frontend', price: 500000 },
  { title: 'NodeJS Microservices Architecture', cat: 'web-backend', price: 1000000 },
  { title: 'Xây dựng trợ lý AI với GPT-4 & n8n', cat: 'ai-ml', price: 800000 },
  // 7 KHÓA MIỄN PHÍ
  { title: 'HTML & CSS Cơ Bản', cat: 'web-frontend', price: 0 },
  { title: 'JavaScript Dành Cho Người Mới', cat: 'web-frontend', price: 0 },
  { title: 'Nhập Môn Lập Trình Python', cat: 'web-backend', price: 0 },
  { title: 'Git & GitHub Fundamentals', cat: 'devops', price: 0 },
  { title: 'Nhập môn SQL và Database', cat: 'web-backend', price: 0 },
  { title: 'React Native Basics', cat: 'mobile', price: 0 },
  { title: 'Kỹ Năng Viết CV & Phỏng Vấn IT', cat: 'soft-skills', price: 0 },
];

async function seedCoursesAndPrivateGroups(userIdMap: Map<string, string>, categoryIdMap: Map<string, string>) {
  console.log('══════════════════════════════════════════════════');
  console.log('  📚 BƯỚC 4: TẠO 10 KHÓA HỌC & PRIVATE GROUPS');
  console.log('══════════════════════════════════════════════════\n');

  const instructorId = userIdMap.get('INSTRUCTOR');
  if (!instructorId) throw new Error("Missing INSTRUCTOR ID");

  for (const item of COURSES_DATA) {
    const slug = generateSlug(item.title);
    const categoryId = categoryIdMap.get(item.cat);

    // Random số bài học từ 2-5 cho 1 chương duy nhất
    const lessonCount = Math.floor(Math.random() * 4) + 2; 

    try {
      // 1. Tạo Khóa Học
      const course = await coursePrisma.course.create({
        data: {
          title: item.title,
          slug,
          description: `Mô tả ngắn cho khóa học ${item.title}. Khóa học này cung cấp kiến thức nền tảng và nâng cao...`,
          thumbnail: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          price: item.price,
          level: 'BEGINNER',
          status: 'PUBLISHED',
          categoryId,
          instructorId,
          totalLessons: lessonCount,
          totalDuration: lessonCount * 600,
        },
      });

      // 2. Tạo Chapter & Lessons
      const chapter = await coursePrisma.chapter.create({
        data: {
          title: 'Chương 1: Bắt đầu',
          order: 1,
          isPublished: true,
          courseId: course.id,
        },
      });

      for (let i = 1; i <= lessonCount; i++) {
        await coursePrisma.lesson.create({
          data: {
            title: `Bài ${i}: Nội dung cơ bản ${i}`,
            order: i,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            sourceType: 'YOUTUBE',
            content: 'Nội dung chi tiết bài học...',
            duration: 600,
            isPublished: true,
            isFree: i === 1, // Bài đầu tiên luôn free
            chapterId: chapter.id,
          },
        });
      }

      // 3. Tạo Private Community Group
      const groupSlug = `community-${slug}-${course.id.slice(0, 8)}`;
      const group = await coursePrisma.communityGroup.create({
        data: {
          type: 'COURSE_PRIVATE',
          name: `Thảo luận: ${item.title}`,
          slug: groupSlug,
          description: `Nhóm kín dành riêng cho học viên khóa ${item.title}`,
          courseId: course.id,
          ownerId: instructorId,
          memberCount: 1, // Instructor
        }
      });

      // Thêm Instructor vào nhóm Private
      await coursePrisma.communityMember.create({
        data: {
          groupId: group.id,
          userId: instructorId,
        }
      });

      const priceLabel = item.price === 0 ? 'Miễn phí' : `${item.price / 1000}k`;
      console.log(`  ✅ Khóa học: ${item.title} (${priceLabel}) — ${lessonCount} bài học`);
      console.log(`     └─ Nhóm Private: ${group.name}`);

    } catch (error) {
      console.error(`  ❌ Lỗi tạo khóa học "${item.title}":`, error);
    }
  }
  console.log('');
}

// ─── Seed Public Community & Posts ────────────────────────────────────────────

async function seedPublicCommunityAndPosts(userIdMap: Map<string, string>) {
  console.log('══════════════════════════════════════════════════');
  console.log('  🌐 BƯỚC 5: TẠO PUBLIC COMMUNITY & BÀI VIẾT');
  console.log('══════════════════════════════════════════════════\n');

  const adminId = userIdMap.get('ADMIN');
  const student1Id = userIdMap.get('STUDENT_1');
  const student2Id = userIdMap.get('STUDENT_2');
  const instructorId = userIdMap.get('INSTRUCTOR');

  if (!adminId || !student1Id || !student2Id || !instructorId) {
    throw new Error("Missing Users for Community Seeding");
  }

  try {
    // 1. Tạo Public Group (Owner: Admin)
    const publicGroup = await coursePrisma.communityGroup.create({
      data: {
        type: 'PUBLIC',
        name: 'Cộng đồng Học Lập Trình Chung',
        slug: 'cong-dong-hoc-lap-trinh-chung',
        description: 'Nơi giao lưu, hỏi đáp và chia sẻ kinh nghiệm học tập cho tất cả mọi người.',
        ownerId: adminId,
        memberCount: 4, // Admin, GV, HV 1, HV 2
      }
    });

    // 2. Add members
    await coursePrisma.communityMember.createMany({
      data: [
        { groupId: publicGroup.id, userId: adminId },
        { groupId: publicGroup.id, userId: instructorId },
        { groupId: publicGroup.id, userId: student1Id },
        { groupId: publicGroup.id, userId: student2Id },
      ]
    });

    // 3. Tạo bài Post 1 (Student 1)
    const post1 = await coursePrisma.communityPost.create({
      data: {
        groupId: publicGroup.id,
        authorId: student1Id,
        content: 'Chào mọi người, mình mới bắt đầu học lập trình web. Mọi người cho mình hỏi nên bắt đầu từ HTML CSS hay học thẳng JS luôn ạ?',
      }
    });

    // 4. Tạo Reply cho Post 1 (Student 2)
    await coursePrisma.communityPost.create({
      data: {
        groupId: publicGroup.id,
        authorId: student2Id,
        parentId: post1.id, // Trả lời bài post 1
        content: 'Bạn nên nắm vững HTML và CSS trước để quen với cách trình duyệt hiển thị nhé. Xong rồi qua JS sẽ dễ hình dung DOM hơn.',
      }
    });

    // 5. Tạo bài Post 2 (Student 2)
    await coursePrisma.communityPost.create({
      data: {
        groupId: publicGroup.id,
        authorId: student2Id,
        content: 'Có ai đang học khóa "Xây dựng trợ lý AI với GPT-4 & n8n" của cô Trần Thị Giảng Viên không? Cho mình xin review với ạ!',
      }
    });

    // Update Post Count
    await coursePrisma.communityGroup.update({
      where: { id: publicGroup.id },
      data: { postCount: 3 }
    });

    console.log(`  ✅ Đã tạo Public Group: "${publicGroup.name}"`);
    console.log(`  ✅ Đã tạo 2 bài viết và 1 phản hồi từ Học viên.`);
    
  } catch (error) {
    console.error(`  ❌ Lỗi tạo Public Community:`, error);
  }
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 LMS SEED DATA — Bắt đầu tạo dữ liệu mẫu\n');

  try {
    // Bước 1: Xóa dữ liệu cũ
    await clearOldData();

    // Bước 2: Tạo tài khoản
    const userIdMap = await seedAccounts();

    // Bước 3: Tạo danh mục
    const categoryIdMap = await seedCategories();

    // Bước 4: Tạo khóa học (10 khóa: 7 free, 3 paid) + Nhóm Private
    await seedCoursesAndPrivateGroups(userIdMap, categoryIdMap);

    // Bước 5: Tạo Public Community + Bài viết mẫu
    await seedPublicCommunityAndPosts(userIdMap);

    console.log('══════════════════════════════════════════════════');
    console.log('  ✨ HOÀN TẤT TẤT CẢ SEED DATA!');
    console.log('══════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Seed thất bại:', error);
    process.exit(1);
  } finally {
    await authPrisma.$disconnect();
    await coursePrisma.$disconnect();
  }
}

main();
