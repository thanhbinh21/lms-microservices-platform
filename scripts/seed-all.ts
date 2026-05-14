/**
 * Seed Script Tổng Hợp: Mô phỏng dữ liệu hệ thống hoạt động 1 tháng
 *
 * Chạy: pnpm seed
 *
 * Thực hiện:
 *   1. Xóa toàn bộ dữ liệu mẫu cũ trên 6 databases
 *   2. Tạo tài khoản: 1 Admin, 3 Instructors, 20 Students
 *   3. Tạo hồ sơ giảng viên (Instructor Profiles)
 *   4. Tạo danh mục (Categories)
 *   5. Tạo 15 khóa học mẫu (đa dạng chuyên mục, giá cả, cấp độ)
 *   6. Tạo Enrollment, LessonProgress, Certificate (learning-service)
 *   7. Tạo Enrollments & Thanh toán (Orders)
 *   8. Tao Community Feed Posts (community-service)
 *   9. Tạo Thông báo (Notifications)
 */

import { PrismaClient as CoursePrisma } from '../services/course-service/src/generated/prisma/index.js';
import { PrismaClient as AuthPrisma } from '../services/auth-service/src/generated/prisma/index.js';
import { PrismaClient as PaymentPrisma } from '../services/payment-service/src/generated/prisma/index.js';
import { PrismaClient as NotificationPrisma } from '../services/notification-service/src/generated/prisma/index.js';
import { PrismaClient as LearningPrisma } from '../services/learning-service/src/generated/prisma/index.js';
import { PrismaClient as CommunityPrisma } from '../services/community-service/src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BCRYPT_SALT_ROUNDS = 10;

function readEnvVarFromFile(filePath: string, variableName: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    const equalIndex = normalized.indexOf('=');
    if (equalIndex === -1) continue;
    const key = normalized.slice(0, equalIndex).trim();
    if (key !== variableName) continue;
    let value = normalized.slice(equalIndex + 1).trim();
    const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
    const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
    if (hasDoubleQuotes || hasSingleQuotes) value = value.slice(1, -1);
    return value;
  }
  return undefined;
}

const projectRoot = path.resolve(__dirname, '..');

const getDbUrl = (service: string) => {
  const envName = `DATABASE_URL_${service.toUpperCase()}`;
  const envFile = path.join(projectRoot, 'services', `${service}-service`, '.env');
  // Try DIRECT_URL first (pooler endpoints often blocked), fall back to DATABASE_URL
  return process.env[envName] ||
    readEnvVarFromFile(envFile, 'DIRECT_URL') ||
    readEnvVarFromFile(envFile, 'DATABASE_URL');
};

const authDbUrl = getDbUrl('auth');
const courseDbUrl = getDbUrl('course');
const paymentDbUrl = getDbUrl('payment');
const notificationDbUrl = getDbUrl('notification');
const learningDbUrl = getDbUrl('learning');
const communityDbUrl = getDbUrl('community');

if (!authDbUrl || !courseDbUrl || !paymentDbUrl || !notificationDbUrl) {
  throw new Error('Missing database URLs. Ensure all services have .env files with DATABASE_URL.');
}

// ─── Database Connections ─────────────────────────────────────────────────────
// Use DIRECT_URL (non-pooler) for seed to avoid connection issues

const authPrisma = new AuthPrisma({ datasources: { db: { url: authDbUrl } } });
const coursePrisma = new CoursePrisma({ datasources: { db: { url: courseDbUrl } } });
const paymentPrisma = new PaymentPrisma({ datasources: { db: { url: paymentDbUrl } } });
const notificationPrisma = new NotificationPrisma({ datasources: { db: { url: notificationDbUrl } } });
const learningPrisma = new LearningPrisma({ datasources: { db: { url: learningDbUrl || courseDbUrl } } });
const communityPrisma = new CommunityPrisma({ datasources: { db: { url: communityDbUrl || courseDbUrl } } });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// ─── Step 1: Clear Data ───────────────────────────────────────────────────────

async function clearOldData() {
  console.log('\n🗑️  BƯỚC 1: XÓA DỮ LIỆU CŨ TRÊN TOÀN HỆ THỐNG...');

  try {
    // 1. Notification (notification-service)
    const notifModel = (notificationPrisma as any).notification || (notificationPrisma as any).Notification;
    if (notifModel) await notifModel.deleteMany();

    // 2. Payment (payment-service)
    await paymentPrisma.payout.deleteMany();
    await paymentPrisma.instructorEarning.deleteMany();
    const vnpAuditModel = (paymentPrisma as any).vNPayAudit || (paymentPrisma as any).VNPayAudit;
    if (vnpAuditModel) await vnpAuditModel.deleteMany();
    await paymentPrisma.order.deleteMany();
    const payoutProfileModel = (paymentPrisma as any).instructorPayoutProfile || (paymentPrisma as any).InstructorPayoutProfile;
    if (payoutProfileModel) await payoutProfileModel.deleteMany();

    // 3. Community (community-service)
    await communityPrisma.answerUpvote.deleteMany();
    await communityPrisma.questionUpvote.deleteMany();
    await communityPrisma.answer.deleteMany();
    await communityPrisma.question.deleteMany();
    await communityPrisma.communityPost.deleteMany();

    // 4. Learning (learning-service)
    await learningPrisma.lessonProgress.deleteMany();
    await learningPrisma.certificate.deleteMany();
    await learningPrisma.enrollment.deleteMany();
    await learningPrisma.failedEvent.deleteMany();

    // 5. Course (course-service)
    await coursePrisma.review.deleteMany();
    await coursePrisma.enrollmentSignal.deleteMany();
    await coursePrisma.courseCertificateTemplate.deleteMany();
    await coursePrisma.certificateTemplate.deleteMany();
    await coursePrisma.lesson.deleteMany();
    await coursePrisma.chapter.deleteMany();
    await coursePrisma.course.deleteMany();
    await coursePrisma.category.deleteMany();
    await coursePrisma.instructorProfile.deleteMany();
    await coursePrisma.failedEvent.deleteMany();

    // 6. Auth (auth-service)
    await authPrisma.refreshToken.deleteMany();
    await authPrisma.auditLog.deleteMany();
    await authPrisma.instructorRequest.deleteMany();
    await authPrisma.user.deleteMany();

    // 7. Redis
    const redisUrl = readEnvVarFromFile(path.join(projectRoot, 'services/course-service/.env'), 'CACHE_REDIS_URL') || process.env.CACHE_REDIS_URL;
    if (redisUrl) {
      const redis = new Redis(redisUrl);
      await redis.flushall();
      await redis.quit();
    }

    console.log('✅ Đã dọn dẹp sạch sẽ 6 cơ sở dữ liệu và Redis Cache.');
  } catch (error) {
    console.error('❌ Lỗi khi xóa dữ liệu:', error);
    throw error;
  }
}

// ─── Step 2: Seed Accounts ────────────────────────────────────────────────────

async function seedAccounts() {
  console.log('\n👥 BƯỚC 2: TẠO TÀI KHOẢN (ADMIN, 3 INSTRUCTORS, 20 STUDENTS)...');

  const accounts = [
    { id: 'admin-001', email: 'admin@nexedu.vn', name: 'Lê Quản Trị', username: 'admin', role: 'ADMIN' },
    { id: 'inst-001', email: 'tran.giangvien@nexedu.vn', name: 'Trần Thị Giảng Viên', username: 'gv_tran', role: 'INSTRUCTOR' },
    { id: 'inst-002', email: 'nguyen.hung@nexedu.vn', name: 'Nguyễn Văn Hùng', username: 'gv_hung', role: 'INSTRUCTOR' },
    { id: 'inst-003', email: 'pham.duc@nexedu.vn', name: 'Phạm Minh Đức', username: 'gv_duc', role: 'INSTRUCTOR' },
  ];

  for (let i = 1; i <= 20; i++) {
    accounts.push({
      id: `std-${i.toString().padStart(3, '0')}`,
      email: `student${i}@gmail.com`,
      name: `Học Viên Số ${i}`,
      username: `student_${i}`,
      role: 'STUDENT'
    });
  }

  const hashedPassword = await bcrypt.hash('12345678', BCRYPT_SALT_ROUNDS);

  const userIds: string[] = [];
  for (const acc of accounts) {
    const user = await authPrisma.user.create({
      data: {
        id: acc.id,
        email: acc.email,
        password: hashedPassword,
        name: acc.name,
        username: acc.username,
        role: acc.role as any,
        sourceType: 'CREDENTIALS',
      }
    });
    userIds.push(user.id);
  }

  console.log(`✅ Đã tạo ${accounts.length} tài khoản thành công. (Mật khẩu mặc định: 12345678)`);
  return accounts;
}

// ─── Step 3: Instructor Profiles ──────────────────────────────────────────────

async function seedInstructorProfiles(instructors: any[]) {
  console.log('\n🎨 BƯỚC 3: TẠO HỒ SƠ GIẢNG VIÊN...');

  for (const inst of instructors) {
    await coursePrisma.instructorProfile.create({
      data: {
        instructorId: inst.id,
        slug: inst.username,
        displayName: inst.name,
        headline: `Chuyên gia hàng đầu trong lĩnh vực ${inst.username.includes('tran') ? 'Frontend' : inst.username.includes('hung') ? 'Backend' : 'Mobile'}`,
        bio: `Với hơn 10 năm kinh nghiệm làm việc tại các tập đoàn công nghệ lớn, tôi mong muốn chia sẻ kiến thức thực chiến đến cộng đồng.`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${inst.username}`,
        socialLinks: { website: 'https://nexedu.vn', youtube: 'https://youtube.com/@nexedu' }
      }
    });
  }
  console.log('✅ Đã tạo hồ sơ cho 3 giảng viên.');
}

// ─── Step 4: Categories ───────────────────────────────────────────────────────

async function seedCategories() {
  console.log('\n🏷️  BƯỚC 4: TẠO DANH MỤC...');

  const categories = [
    { name: 'Web Frontend', slug: 'web-frontend', order: 1 },
    { name: 'Web Backend', slug: 'web-backend', order: 2 },
    { name: 'Mobile Development', slug: 'mobile', order: 3 },
    { name: 'DevOps & Cloud', slug: 'devops', order: 4 },
    { name: 'AI & Data Science', slug: 'ai-ml', order: 5 },
    { name: 'Soft Skills', slug: 'soft-skills', order: 6 },
  ];

  const categoryIds: string[] = [];
  for (const cat of categories) {
    const c = await coursePrisma.category.create({ data: cat });
    categoryIds.push(c.id);
  }
  console.log('✅ Đã tạo 6 danh mục.');
  return categoryIds;
}

// ─── Step 5: Courses & Curriculum ─────────────────────────────────────────────

async function seedCourses(instructorIds: string[], categoryIds: string[]) {
  console.log('\n📚 BƯỚC 5: TẠO 15 KHÓA HỌC & CHƯƠNG TRÌNH HỌC...');

  const courseTitles = [
    { title: 'ReactJS Pro Mastery', catIdx: 0, price: 599000, level: 'ADVANCED' },
    { title: 'Next.js 15 Fullstack', catIdx: 0, price: 799000, level: 'INTERMEDIATE' },
    { title: 'NodeJS Microservices', catIdx: 1, price: 1200000, level: 'ADVANCED' },
    { title: 'Go Lang for Backend', catIdx: 1, price: 850000, level: 'BEGINNER' },
    { title: 'Flutter App Essentials', catIdx: 2, price: 450000, level: 'BEGINNER' },
    { title: 'React Native Advanced', catIdx: 2, price: 990000, level: 'ADVANCED' },
    { title: 'Docker for Beginners', catIdx: 3, price: 0, level: 'BEGINNER' },
    { title: 'Kubernetes in Practice', catIdx: 3, price: 1500000, level: 'ADVANCED' },
    { title: 'Python for Data Science', catIdx: 4, price: 0, level: 'BEGINNER' },
    { title: 'Deep Learning with PyTorch', catIdx: 4, price: 2500000, level: 'ADVANCED' },
    { title: 'HTML & CSS Cơ Bản', catIdx: 0, price: 0, level: 'BEGINNER' },
    { title: 'JavaScript Fundamentals', catIdx: 0, price: 0, level: 'BEGINNER' },
    { title: 'Git & GitHub Workflow', catIdx: 3, price: 0, level: 'BEGINNER' },
    { title: 'Kỹ năng Viết CV IT', catIdx: 5, price: 0, level: 'BEGINNER' },
    { title: 'Tiếng Anh cho Developers', catIdx: 5, price: 299000, level: 'INTERMEDIATE' },
  ];

  const courses: any[] = [];
  for (let i = 0; i < courseTitles.length; i++) {
    const item = courseTitles[i];
    const instId = instructorIds[i % instructorIds.length];
    const catId = categoryIds[item.catIdx];
    const slug = generateSlug(item.title);

    const course = await coursePrisma.course.create({
      data: {
        title: item.title,
        slug,
        description: `Khóa học chuyên sâu về ${item.title}. Bạn sẽ được học từ lý thuyết đến thực hành dự án thực tế.`,
        thumbnail: `https://picsum.photos/seed/${slug}/800/450`,
        price: item.price,
        level: item.level as any,
        status: 'PUBLISHED',
        categoryId: catId,
        instructorId: instId,
      }
    });

    // Create Chapters & Lessons
    let totalLessons = 0;
    let totalDuration = 0;
    const chapterCount = randomInt(2, 4);
    for (let c = 1; c <= chapterCount; c++) {
      const chapter = await coursePrisma.chapter.create({
        data: {
          title: `Chương ${c}: Nội dung cốt lõi ${c}`,
          order: c,
          isPublished: true,
          courseId: course.id,
        }
      });

      const lessonCount = randomInt(3, 6);
      for (let l = 1; l <= lessonCount; l++) {
        const duration = randomInt(300, 1200);
        await coursePrisma.lesson.create({
          data: {
            title: `Bài ${l}: Kiến thức quan trọng ${l}`,
            order: l,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            sourceType: 'YOUTUBE',
            content: 'Đây là nội dung chi tiết của bài học. Học viên cần chú ý ghi chép và thực hành theo hướng dẫn.',
            duration,
            isPublished: true,
            isFree: c === 1 && l === 1,
            chapterId: chapter.id,
          }
        });
        totalLessons++;
        totalDuration += duration;
      }
    }

    // Update course totals
    await coursePrisma.course.update({
      where: { id: course.id },
      data: { totalLessons, totalDuration }
    });

    courses.push({ ...course, totalLessons });
    console.log(`  ✅ [${item.price === 0 ? 'FREE' : 'PAID'}] ${item.title} — ${totalLessons} bài học.`);
  }
  return courses;
}

// Step 6: Global Community Feed (community-service)

async function seedCommunityFeed(instructors: any[]) {
  console.log('\nBUOC 6: TAO COMMUNITY FEED...');

  const author = instructors[0];
  if (!author) return;

  const welcomePost = await communityPrisma.communityPost.create({
    data: {
      authorId: author.id,
      content: 'Chao mung moi nguoi den voi cong dong chung cua Zync. Day la noi moi user trong he thong co the chia se kinh nghiem hoc tap, dat chu de thao luan va ket noi voi nhau.',
      likeCount: randomInt(5, 20),
    },
  });

  await communityPrisma.communityPost.create({
    data: {
      authorId: author.id,
      parentId: welcomePost.id,
      content: 'Hay giu trao doi van minh va tap trung vao viec hoc tap.',
      likeCount: randomInt(1, 5),
    },
  });

  await communityPrisma.communityPost.update({
    where: { id: welcomePost.id },
    data: { replyCount: 1 },
  });

  await communityPrisma.communityPost.create({
    data: {
      authorId: author.id,
      content: 'Ban dang hoc ky nang gi tuan nay? Chia se muc tieu de cung nhau theo doi tien do nhe.',
      likeCount: randomInt(2, 8),
    },
  });

  console.log('Da tao bai viet mau cho community feed.');
}
// Step 7: Enrollments, Learning Progress & Certificates ────────────────────

async function seedLearningData(students: any[], courses: any[]) {
  console.log('\n🚀 BƯỚC 7: TẠO ENROLLMENTS, TIẾN ĐỘ HỌC TẬP & CHỨNG CHỈ...');

  let enrollmentCount = 0;
  let certificateCount = 0;

  for (const student of students) {
    if (student.role !== 'STUDENT') continue;

    const myCourses = courses.sort(() => 0.5 - Math.random()).slice(0, randomInt(4, 8));

    for (const course of myCourses) {
      const enrolledAt = randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());
      const orderId = `seed-order-${student.id}-${course.id}`;

      // 1. Enrollment (learning-service)
      const enrollment = await learningPrisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          orderId,
          enrolledAt,
        }
      });
      enrollmentCount++;

      // 2. Payment (if not free)
      if (Number(course.price) > 0) {
        const order = await paymentPrisma.order.create({
          data: {
            userId: student.id,
            courseId: course.id,
            instructorId: course.instructorId,
            courseTitle: course.title,
            amount: course.price,
            status: 'COMPLETED',
            paymentMethod: 'VNPAY',
            vnpTxnRef: `VNP${Date.now()}${randomInt(1000, 9999)}`,
            vnpTransactionNo: `TR${randomInt(100000, 999999)}`,
            paidAt: enrolledAt,
          }
        });

        // Earning for instructor
        const netAmount = Number(course.price) * 0.7;
        await paymentPrisma.instructorEarning.create({
          data: {
            orderId: order.id,
            instructorId: course.instructorId,
            courseId: course.id,
            grossAmount: course.price,
            netAmount,
            status: 'AVAILABLE'
          }
        });
      }

      // 3. Lesson Progress
      const lessons = await coursePrisma.lesson.findMany({
        where: { chapter: { courseId: course.id } }
      });

      const completedRatio = Math.random();
      const completedCount = Math.floor(lessons.length * completedRatio);

      for (let i = 0; i < lessons.length; i++) {
        const isCompleted = i < completedCount;
        await learningPrisma.lessonProgress.create({
          data: {
            userId: student.id,
            lessonId: lessons[i].id,
            courseId: course.id,
            enrollmentId: enrollment.id,
            isCompleted,
            lastWatched: isCompleted ? lessons[i].duration : randomInt(0, lessons[i].duration),
          }
        });
      }

      // 4. Review (if completed > 50%)
      if (completedRatio > 0.5) {
        await coursePrisma.review.create({
          data: {
            userId: student.id,
            courseId: course.id,
            rating: randomInt(4, 5),
            comment: completedRatio === 1 ? 'Khóa học tuyệt vời, kiến thức rất thực tế!' : 'Nội dung hay, giảng viên nhiệt tình.',
          }
        });
      }

      // 5. Certificate (if completed 100%)
      if (completedRatio >= 1) {
        await learningPrisma.certificate.create({
          data: {
            certificateNumber: `CERT-${student.id.split('-')[1]}-${course.id.split('-')[0]}`,
            userId: student.id,
            courseId: course.id,
            enrollmentId: enrollment.id,
            completedAt: enrolledAt,
          }
        });
        certificateCount++;
      }
    }

    // 6. Notifications
    const notifModel = (notificationPrisma as any).notification || (notificationPrisma as any).Notification;
    if (notifModel) {
      await notifModel.createMany({
        data: [
          {
            userId: student.id,
            type: 'SYSTEM',
            title: 'Chào mừng bạn!',
            body: 'Chào mừng bạn đã gia nhập NexEdu. Hãy bắt đầu hành trình học tập ngay hôm nay.',
            status: 'SENT'
          },
          {
            userId: student.id,
            type: 'ENROLLMENT_CREATED',
            title: 'Đăng ký thành công',
            body: `Bạn đã được ghi danh vào ${myCourses.length} khóa học mới.`,
            status: 'SENT'
          }
        ]
      });
    }
  }

  console.log(`✅ Đã tạo ${enrollmentCount} lượt đăng ký.`);
  console.log(`✅ Đã mô phỏng tiến độ học tập cho tất cả học viên.`);
  console.log(`✅ Đã cấp ${certificateCount} chứng chỉ.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 NEXEDU SIMULATOR — KHỞI TẠO DỮ LIỆU HOẠT ĐỘNG 1 THÁNG\n');

  try {
    await clearOldData();

    const accounts = await seedAccounts();
    const instructors = accounts.filter(a => a.role === 'INSTRUCTOR');
    const students = accounts.filter(a => a.role === 'STUDENT');

    await seedInstructorProfiles(instructors);

    const categoryIds = await seedCategories();

    const courses = await seedCourses(instructors.map(i => i.id), categoryIds);

    await seedCommunityFeed(instructors);

    await seedLearningData(students, courses);

    console.log('\n' + '═'.repeat(60));
    console.log('✨ CHÚC MỪNG! HỆ THỐNG ĐÃ CÓ ĐẦY ĐỦ DỮ LIỆU ĐỂ TEST.');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Seed thất bại:', error);
    process.exit(1);
  } finally {
    await authPrisma.$disconnect();
    await coursePrisma.$disconnect();
    await paymentPrisma.$disconnect();
    await notificationPrisma.$disconnect();
    await learningPrisma.$disconnect();
    await communityPrisma.$disconnect();
  }
}

main();
