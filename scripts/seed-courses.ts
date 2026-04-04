/**
 * Seed Script: Tạo 3 khóa học mẫu mặc định cho hệ thống LMS
 * 
 * Chạy: npx tsx scripts/seed-courses.ts
 * 
 * Khóa học:
 *   1. 5 Nền Tảng Cơ Bản Dành Cho Người Dùng AI (Free)
 *   2. Xác Thực API Chuyên Sâu Cùng JWT (250,000đ)
 *   3. Tự Động Hóa Với n8n: Xây Dựng Đội Quân 6 AI Agents (500,000đ)
 * 
 * Lưu ý: Script tạo courses với instructorId = 'system' (không thuộc giáo viên nào).
 *         Nếu có tài khoản instructor@nexedu.vn, sẽ dùng ID của tài khoản đó.
 */

import { PrismaClient as CoursePrisma } from '../services/course-service/src/generated/prisma/index.js';
import { PrismaClient as AuthPrisma } from '../services/auth-service/src/generated/prisma/index.js';

// Kết nối course DB
const coursePrisma = new CoursePrisma({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_COURSE ||
        'postgresql://neondb_owner:npg_fCcLVwM3USQ0@ep-nameless-star-a1z0mm2l-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    },
  },
});

// Kết nối auth DB để lấy instructor ID
const authPrisma = new AuthPrisma({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_AUTH ||
        'postgresql://neondb_owner:npg_n4ym7HYRqAVD@ep-odd-dew-a1dd5hjf-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    },
  },
});

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
  type: 'VIDEO';
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
  // ─── Khóa học 1: AI Cơ Bản ──────────────────────────────────────────────────
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
            type: 'VIDEO',
            videoUrl: 'https://youtu.be/sAIu0VXja7k?si=L7OAnSaScxAqpCcF',
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
            type: 'VIDEO',
            videoUrl: 'https://youtu.be/sAIu0VXja7k?si=L7OAnSaScxAqpCcF',
            content: 'Phân loại các công cụ AI: Nhóm suy luận tổng quát (ChatGPT, Claude, Gemini), Nhóm nghiên cứu chính xác (Perplexity, NotebookLM, Consensus), và Nhóm chuyên biệt (Midjourney, Eleven Labs).',
            isFree: true,
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
            type: 'VIDEO',
            videoUrl: 'https://youtu.be/sAIu0VXja7k?si=L7OAnSaScxAqpCcF',
            content: 'Sử dụng workflow tự động hóa (Make, n8n) kết hợp AI Agent. Hiểu về Open Source AI để bảo mật dữ liệu, tiết kiệm chi phí và khám phá khái niệm Vibe Coding giúp người không chuyên lập trình vẫn tạo ra ứng dụng.',
            isFree: true,
          },
        ],
      },
    ],
  },

  // ─── Khóa học 2: JWT ────────────────────────────────────────────────────────
  {
    title: 'Xác Thực API Chuyên Sâu Cùng JWT',
    description: 'Nắm vững tiêu chuẩn JSON Web Token (JWT) trong xác thực và truyền dữ liệu an toàn bên trong hệ thống API.',
    category: 'Backend Development',
    thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/sample_jwt_course.jpg',
    price: 0,
    chapters: [
      {
        title: 'Chương 1: Tổng quan về JSON Web Token',
        order: 1,
        lessons: [
          {
            title: 'Bài 1: JWT là gì và cách hoạt động?',
            order: 1,
            type: 'VIDEO',
            videoUrl: 'https://www.youtube.com/watch?v=ty9OGLdNDuw&t=515s',
            content: 'JWT là một tiêu chuẩn mã hóa dữ liệu giống như \'chìa khóa\' cấp cho người dùng sau khi đăng nhập để truy cập tài nguyên server mà không cần nhập lại mật khẩu.',
            isFree: true,
          },
          {
            title: 'Bài 2: Cấu trúc 3 phần của JWT',
            order: 2,
            type: 'VIDEO',
            videoUrl: 'https://www.youtube.com/watch?v=ty9OGLdNDuw&t=515s',
            content: 'Tìm hiểu về Header, Payload (chứa dữ liệu người dùng) và Signature (đảm bảo token không bị giả mạo).',
            isFree: true,
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
            type: 'VIDEO',
            videoUrl: 'https://www.youtube.com/watch?v=ty9OGLdNDuw&t=515s',
            content: 'Ưu điểm của JWT là stateless (không cần lưu session trên server), dễ tích hợp đa nền tảng. Nhược điểm là khó thu hồi, cần kết hợp cơ chế refresh token và blacklist.',
            isFree: true,
          },
        ],
      },
    ],
  },

  // ─── Khóa học 3: n8n AI Agents ──────────────────────────────────────────────
  {
    title: 'Tự Động Hóa Với n8n: Xây Dựng Đội Quân 6 AI Agents',
    description: 'Hướng dẫn thực hành xây dựng đội quân trợ lý thông minh trên n8n, giúp tự động hóa hơn 200 tasks mỗi ngày từ email, lịch hẹn đến tìm kiếm content.',
    category: 'Automation',
    thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/sample_n8n_course.jpg',
    price: 0,
    chapters: [
      {
        title: 'Chương 1: Thiết lập hệ thống cốt lõi',
        order: 1,
        lessons: [
          {
            title: 'Bài 1: Giới thiệu AI Swarm & Telegram Trigger',
            order: 1,
            type: 'VIDEO',
            videoUrl: 'https://youtu.be/DT0rZ3kFDfc?si=hV7tzN6ZcA2MGoV7',
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
            type: 'VIDEO',
            videoUrl: 'https://youtu.be/DT0rZ3kFDfc?si=hV7tzN6ZcA2MGoV7',
            content: 'Cấu hình Email Agent phụ trách thư tín, Calendar Agent quản lý sự kiện và Contact Agent lưu trữ cơ sở dữ liệu danh bạ bằng Airtable.',
            isFree: true,
          },
          {
            title: 'Bài 3: Web Agent & YouTube Agent',
            order: 2,
            type: 'VIDEO',
            videoUrl: 'https://youtu.be/DT0rZ3kFDfc?si=hV7tzN6ZcA2MGoV7',
            content: 'Thiết lập Web Agent (dùng Tavily, Perplexity) để tra cứu thông tin chuyên sâu và YouTube Agent (dùng Apify) để phân tích trending video.',
            isFree: true,
          },
        ],
      },
    ],
  },
];

async function getInstructorId(): Promise<string> {
  try {
    // Tìm tài khoản instructor trong auth DB
    const instructor = await authPrisma.user.findFirst({
      where: { role: 'INSTRUCTOR' },
      select: { id: true },
    });

    if (instructor) {
      console.log(`  📝 Sử dụng instructor ID từ auth DB: ${instructor.id}`);
      return instructor.id;
    }

    // Nếu có admin, dùng admin
    const admin = await authPrisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admin) {
      console.log(`  📝 Sử dụng admin ID làm instructor: ${admin.id}`);
      return admin.id;
    }
  } catch (error) {
    console.warn('  ⚠️  Không kết nối được auth DB, dùng ID hệ thống');
  }

  // Fallback: dùng ID cố định cho system content
  console.log('  📝 Sử dụng system instructor ID');
  return 'system-instructor-00000000';
}

async function seedCourses() {
  console.log('🌱 Bắt đầu tạo khóa học mẫu...\n');

  const instructorId = await getInstructorId();

  for (const courseData of SEED_COURSES) {
    const slug = generateSlug(courseData.title);

    try {
      // 1. Upsert Course
      const course = await coursePrisma.course.upsert({
        where: { slug },
        update: {
          title: courseData.title,
          description: courseData.description,
          thumbnail: courseData.thumbnailUrl,
          price: courseData.price,
          category: courseData.category,
          status: 'PUBLISHED',
        },
        create: {
          title: courseData.title,
          slug,
          description: courseData.description,
          thumbnail: courseData.thumbnailUrl,
          price: courseData.price,
          level: 'BEGINNER',
          status: 'PUBLISHED',
          category: courseData.category,
          instructorId,
          totalLessons: courseData.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0),
          totalDuration: courseData.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0) * 600,
        },
      });

      console.log(`  ✅ Khóa học: "${course.title}" (${courseData.price === 0 ? 'Miễn phí' : courseData.price.toLocaleString('vi-VN') + 'đ'})`);

      // 2. Xử lý Chapters và Lessons
      for (const chapterData of courseData.chapters) {
        let chapter = await coursePrisma.chapter.findFirst({
          where: { title: chapterData.title, courseId: course.id },
        });

        if (chapter) {
          chapter = await coursePrisma.chapter.update({
            where: { id: chapter.id },
            data: { order: chapterData.order, isPublished: true },
          });
        } else {
          chapter = await coursePrisma.chapter.create({
            data: {
              title: chapterData.title,
              order: chapterData.order,
              isPublished: true,
              courseId: course.id,
            },
          });
        }

        console.log(`    📁 ${chapterData.title}`);

        for (const lessonData of chapterData.lessons) {
          const sourceType = lessonData.videoUrl.includes('youtube.com') || lessonData.videoUrl.includes('youtu.be')
            ? 'YOUTUBE'
            : 'UPLOAD';

          const existingLesson = await coursePrisma.lesson.findFirst({
            where: { title: lessonData.title, chapterId: chapter.id },
          });

          if (existingLesson) {
            await coursePrisma.lesson.update({
              where: { id: existingLesson.id },
              data: {
                videoUrl: lessonData.videoUrl,
                sourceType,
                content: lessonData.content,
                isFree: lessonData.isFree,
                isPublished: true,
              },
            });
          } else {
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
          }

          const freeLabel = lessonData.isFree ? '🆓' : '🔒';
          console.log(`      ${freeLabel} ${lessonData.title} (Updated)`);
        }
      }

      console.log('');
    } catch (error) {
      console.error(`  ❌ Lỗi tạo "${courseData.title}":`, error);
    }
  }
}

async function main() {
  try {
    await seedCourses();
  } catch (error) {
    console.error('❌ Seed courses thất bại:', error);
    process.exit(1);
  } finally {
    await coursePrisma.$disconnect();
    await authPrisma.$disconnect();
    console.log('✨ Hoàn tất seed courses!');
  }
}

main();
