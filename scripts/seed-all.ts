/**
 * Seed Script Tổng Hợp: Tạo dữ liệu mẫu cho hệ thống LMS
 * 
 * Chạy: npx tsx scripts/seed-all.ts
 * 
 * Thực hiện:
 *   1. Tạo 3 tài khoản (Student, Instructor, Admin)
 *   2. Tạo 3 khóa học mẫu với chapters và lessons
 */

import { PrismaClient as CoursePrisma } from '../services/course-service/src/generated/prisma/index.js';
import { PrismaClient as AuthPrisma } from '../services/auth-service/src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 10;

// ─── Database Connections ─────────────────────────────────────────────────────

const authPrisma = new AuthPrisma({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_AUTH ||
        'postgresql://neondb_owner:npg_n4ym7HYRqAVD@ep-odd-dew-a1dd5hjf-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    },
  },
});

const coursePrisma = new CoursePrisma({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_COURSE ||
        'postgresql://neondb_owner:npg_fCcLVwM3USQ0@ep-nameless-star-a1z0mm2l-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    },
  },
});

// ─── Seed Accounts ────────────────────────────────────────────────────────────

interface SeedAccount {
  email: string;
  password: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
}

const SEED_ACCOUNTS: SeedAccount[] = [
  { email: 'student@nexedu.vn', password: 'Student@123', name: 'Nguyễn Văn Học Viên', role: 'STUDENT' },
  { email: 'instructor@nexedu.vn', password: 'Instructor@123', name: 'Trần Thị Giảng Viên', role: 'INSTRUCTOR' },
  { email: 'admin@nexedu.vn', password: 'Admin@123', name: 'Lê Văn Admin', role: 'ADMIN' },
];

async function seedAccounts(): Promise<Map<string, string>> {
  console.log('══════════════════════════════════════════════════');
  console.log('  📋 BƯỚC 1: TẠO TÀI KHOẢN MẪU');
  console.log('══════════════════════════════════════════════════\n');

  const userIdMap = new Map<string, string>(); // role -> userId

  for (const account of SEED_ACCOUNTS) {
    try {
      const existing = await authPrisma.user.findUnique({
        where: { email: account.email },
      });

      if (existing) {
        if (existing.role !== account.role) {
          await authPrisma.user.update({
            where: { id: existing.id },
            data: { role: account.role },
          });
          console.log(`  ✏️  [${account.role.padEnd(12)}] ${account.email} — cập nhật role`);
        } else {
          console.log(`  ⏭️  [${account.role.padEnd(12)}] ${account.email} — đã tồn tại`);
        }
        userIdMap.set(account.role, existing.id);
        continue;
      }

      const hashedPassword = await bcrypt.hash(account.password, BCRYPT_SALT_ROUNDS);

      const user = await authPrisma.user.create({
        data: {
          email: account.email,
          password: hashedPassword,
          name: account.name,
          role: account.role,
          sourceType: 'CREDENTIALS',
        },
      });

      console.log(`  ✅ [${account.role.padEnd(12)}] ${account.email} — ID: ${user.id}`);
      userIdMap.set(account.role, user.id);
    } catch (error) {
      console.error(`  ❌ [${account.role}] ${account.email} — Lỗi:`, error);
    }
  }

  console.log('\n  📋 Thông tin đăng nhập:');
  console.log('  ' + '─'.repeat(60));
  for (const account of SEED_ACCOUNTS) {
    console.log(`    ${account.role.padEnd(12)} | ${account.email.padEnd(25)} | ${account.password}`);
  }
  console.log('  ' + '─'.repeat(60));

  return userIdMap;
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

interface SeedLesson {
  title: string;
  order: number;
  videoUrl: string;
  content: string;
  isFree: boolean;
}

interface SeedChapter {
  title: string;
  order: number;
  lessons: SeedLesson[];
}

interface SeedCourse {
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  price: number;
  chapters: SeedChapter[];
}

const SEED_COURSES: SeedCourse[] = [
  {
    title: '5 Nền Tảng Cơ Bản Dành Cho Người Dùng AI',
    description: 'Hiểu và sử dụng AI hiệu quả không chỉ là chạy theo công cụ. Khóa học này giúp bạn nắm vững 5 nền tảng cơ bản về AI để tăng năng suất làm việc.',
    category: 'Trí Tuệ Nhân Tạo (AI)',
    thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/sample_ai_course.jpg',
    price: 0,
    chapters: [
      {
        title: 'Chương 1: Cách viết Prompt hiệu quả',
        order: 1,
        lessons: [
          {
            title: 'Bài 1: Tư duy đúng về Prompt và Framework TCREI',
            order: 1,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'Học viết prompt không phải là áp dụng dập khuôn mà là để hiểu cách mô hình AI hoạt động. Tìm hiểu Framework TCREI của Google bao gồm: Task, Roleplay, Context, Reference, và Evaluate & Iteration.',
            isFree: true,
          },
        ],
      },
      {
        title: 'Chương 2: Phân loại và ứng dụng công cụ AI',
        order: 2,
        lessons: [
          {
            title: 'Bài 2: 3 nhóm công cụ AI cơ bản',
            order: 1,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'Phân loại các công cụ AI: Nhóm suy luận tổng quát (ChatGPT, Claude, Gemini), Nhóm nghiên cứu chính xác (Perplexity, NotebookLM, Consensus), và Nhóm chuyên biệt (Midjourney, Eleven Labs).',
            isFree: false,
          },
        ],
      },
      {
        title: 'Chương 3: Automation, Open Source & Vibe Coding',
        order: 3,
        lessons: [
          {
            title: 'Bài 3: Tự động hóa và AI mã nguồn mở',
            order: 1,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'Sử dụng workflow tự động hóa (Make, n8n) kết hợp AI Agent. Hiểu về Open Source AI để bảo mật dữ liệu, tiết kiệm chi phí và khám phá khái niệm Vibe Coding giúp người không chuyên lập trình vẫn tạo ra ứng dụng.',
            isFree: false,
          },
        ],
      },
    ],
  },
  {
    title: 'Xác Thực API Chuyên Sâu Cùng JWT',
    description: 'Nắm vững tiêu chuẩn JSON Web Token (JWT) trong xác thực và truyền dữ liệu an toàn bên trong hệ thống API.',
    category: 'Backend Development',
    thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/sample_jwt_course.jpg',
    price: 250000,
    chapters: [
      {
        title: 'Chương 1: Tổng quan về JSON Web Token',
        order: 1,
        lessons: [
          {
            title: 'Bài 1: JWT là gì và cách hoạt động?',
            order: 1,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'JWT là một tiêu chuẩn mã hóa dữ liệu giống như \'chìa khóa\' cấp cho người dùng sau khi đăng nhập để truy cập tài nguyên server mà không cần nhập lại mật khẩu.',
            isFree: true,
          },
          {
            title: 'Bài 2: Cấu trúc 3 phần của JWT',
            order: 2,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'Tìm hiểu về Header, Payload (chứa dữ liệu người dùng) và Signature (đảm bảo token không bị giả mạo).',
            isFree: false,
          },
        ],
      },
      {
        title: 'Chương 2: Đánh giá và thực tiễn triển khai',
        order: 2,
        lessons: [
          {
            title: 'Bài 3: Ưu, nhược điểm và khi nào nên dùng JWT',
            order: 1,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'Ưu điểm của JWT là stateless (không cần lưu session trên server), dễ tích hợp đa nền tảng. Nhược điểm là khó thu hồi, cần kết hợp cơ chế refresh token và blacklist.',
            isFree: false,
          },
        ],
      },
    ],
  },
  {
    title: 'Tự Động Hóa Với n8n: Xây Dựng Đội Quân 6 AI Agents',
    description: 'Hướng dẫn thực hành xây dựng đội quân trợ lý thông minh trên n8n, giúp tự động hóa hơn 200 tasks mỗi ngày từ email, lịch hẹn đến tìm kiếm content.',
    category: 'Automation',
    thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/sample_n8n_course.jpg',
    price: 500000,
    chapters: [
      {
        title: 'Chương 1: Thiết lập hệ thống cốt lõi',
        order: 1,
        lessons: [
          {
            title: 'Bài 1: Giới thiệu AI Swarm & Telegram Trigger',
            order: 1,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'Khái niệm AI Swarm (chuyên môn hóa từng AI Agent). Cách cài đặt bộ não điều khiển với GPT-4o-mini và khởi tạo giao tiếp thông qua Telegram Bot.',
            isFree: true,
          },
        ],
      },
      {
        title: 'Chương 2: Xây dựng các AI Agent chuyên môn',
        order: 2,
        lessons: [
          {
            title: 'Bài 2: Email, Calendar & Contact Agent',
            order: 1,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'Cấu hình Email Agent phụ trách thư tín, Calendar Agent quản lý sự kiện và Contact Agent lưu trữ cơ sở dữ liệu danh bạ bằng Airtable.',
            isFree: false,
          },
          {
            title: 'Bài 3: Web Agent & YouTube Agent',
            order: 2,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            content: 'Thiết lập Web Agent (dùng Tavily, Perplexity) để tra cứu thông tin chuyên sâu và YouTube Agent (dùng Apify) để phân tích trending video.',
            isFree: false,
          },
        ],
      },
    ],
  },
];

async function seedCourses(userIdMap: Map<string, string>) {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  📚 BƯỚC 2: TẠO KHÓA HỌC MẪU');
  console.log('══════════════════════════════════════════════════\n');

  // Uu tien dung instructor ID, sau do admin, cuoi cung la system
  const instructorId =
    userIdMap.get('INSTRUCTOR') ||
    userIdMap.get('ADMIN') ||
    'system-instructor-00000000';

  console.log(`  📝 Instructor ID: ${instructorId}\n`);

  for (const courseData of SEED_COURSES) {
    const slug = generateSlug(courseData.title);

    try {
      const existing = await coursePrisma.course.findFirst({
        where: { slug: { startsWith: slug } },
      });

      if (existing) {
        console.log(`  ⏭️  "${courseData.title}" — đã tồn tại, bỏ qua`);
        continue;
      }

      const totalLessons = courseData.chapters.reduce(
        (acc, ch) => acc + ch.lessons.length,
        0,
      );

      const course = await coursePrisma.course.create({
        data: {
          title: courseData.title,
          slug,
          description: courseData.description,
          thumbnail: courseData.thumbnailUrl,
          price: courseData.price,
          level: 'BEGINNER',
          status: 'PUBLISHED',
          category: courseData.category,
          instructorId,
          totalLessons,
          totalDuration: totalLessons * 600,
        },
      });

      const priceLabel = courseData.price === 0
        ? '🆓 Miễn phí'
        : `💰 ${courseData.price.toLocaleString('vi-VN')}đ`;
      console.log(`  ✅ "${course.title}" (${priceLabel})`);

      for (const chapterData of courseData.chapters) {
        const chapter = await coursePrisma.chapter.create({
          data: {
            title: chapterData.title,
            order: chapterData.order,
            isPublished: true,
            courseId: course.id,
          },
        });

        console.log(`    📁 ${chapterData.title}`);

        for (const lessonData of chapterData.lessons) {
          const sourceType = lessonData.videoUrl.includes('youtube.com') || lessonData.videoUrl.includes('youtu.be')
            ? 'YOUTUBE'
            : 'UPLOAD';

          await coursePrisma.lesson.create({
            data: {
              title: lessonData.title,
              order: lessonData.order,
              videoUrl: lessonData.videoUrl,
              sourceType,
              content: lessonData.content,
              duration: 600,
              isPublished: true,
              isFree: lessonData.isFree,
              chapterId: chapter.id,
            },
          });

          const freeLabel = lessonData.isFree ? '🆓' : '🔒';
          console.log(`      ${freeLabel} ${lessonData.title}`);
        }
      }

      console.log('');
    } catch (error) {
      console.error(`  ❌ Lỗi tạo "${courseData.title}":`, error);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 LMS SEED DATA — Bắt đầu tạo dữ liệu mẫu\n');

  try {
    // Bước 1: Tạo tài khoản
    const userIdMap = await seedAccounts();

    // Bước 2: Tạo khóa học
    await seedCourses(userIdMap);

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
