/**
 * Seed Script Tổng Hợp: Mô phỏng dữ liệu hệ thống hoạt động 1 tháng
 * 
 * Chạy: npx tsx scripts/seed-all.ts
 * 
 * Thực hiện:
 *   1. Xóa toàn bộ dữ liệu mẫu cũ (Clear Data) trên 4 databases (Auth, Course, Payment, Notification)
 *   2. Tạo tài khoản: 1 Admin, 3 Instructors, 20 Students
 *   3. Tạo hồ sơ giảng viên (Instructor Profiles)
 *   4. Tạo danh mục (Categories)
 *   5. Tạo 15 khóa học mẫu (đa dạng chuyên mục, giá cả, cấp độ)
 *   6. Tạo 100+ Lượt đăng ký (Enrollments) & Thanh toán (Orders)
 *   7. Tạo Tiến độ học tập (Learning Progress) — mô phỏng học viên đang học
 *   8. Tạo Đánh giá (Reviews) & Chứng chỉ (Certificates)
 *   9. Tạo Thông báo (Notifications) cho toàn bộ user
 *   10. Tạo Hoạt động Cộng đồng (Community Posts & Replies)
 */

import { PrismaClient as CoursePrisma } from '../services/course-service/src/generated/prisma-v2/index.js';
import { PrismaClient as AuthPrisma } from '../services/auth-service/src/generated/prisma-v2/index.js';
import { PrismaClient as PaymentPrisma } from '../services/payment-service/src/generated/prisma-v2/index.js';
import { PrismaClient as NotificationPrisma } from '../services/notification-service/src/generated/prisma/index.js';
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
  return process.env[envName] || 
         readEnvVarFromFile(path.join(projectRoot, 'services', `${service}-service`, '.env'), 'DATABASE_URL');
};

const authDbUrl = getDbUrl('auth');
const courseDbUrl = getDbUrl('course');
const paymentDbUrl = getDbUrl('payment');
const notificationDbUrl = getDbUrl('notification');

if (!authDbUrl || !courseDbUrl || !paymentDbUrl || !notificationDbUrl) {
  throw new Error('Missing database URLs. Ensure all services have .env files with DATABASE_URL.');
}

// ─── Database Connections ─────────────────────────────────────────────────────

const authPrisma = new AuthPrisma({ datasources: { db: { url: authDbUrl } } });
const coursePrisma = new CoursePrisma({ datasources: { db: { url: courseDbUrl } } });
const paymentPrisma = new PaymentPrisma({ datasources: { db: { url: paymentDbUrl } } });
const notificationPrisma = new NotificationPrisma({ datasources: { db: { url: notificationDbUrl } } });

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
    // 1. Notification
    const notifModel = (notificationPrisma as any).notification || (notificationPrisma as any).Notification;
    if (notifModel) await notifModel.deleteMany();
    
    // 2. Payment
    await paymentPrisma.payout.deleteMany();
    await paymentPrisma.instructorEarning.deleteMany();
    const vnpAuditModel = (paymentPrisma as any).vNPayAudit || (paymentPrisma as any).VNPayAudit;
    if (vnpAuditModel) await vnpAuditModel.deleteMany();
    await paymentPrisma.order.deleteMany();
    const payoutProfileModel = (paymentPrisma as any).instructorPayoutProfile || (paymentPrisma as any).InstructorPayoutProfile;
    if (payoutProfileModel) await payoutProfileModel.deleteMany();

    // 3. Course
    await coursePrisma.answerUpvote.deleteMany();
    await coursePrisma.questionUpvote.deleteMany();
    await coursePrisma.answer.deleteMany();
    await coursePrisma.question.deleteMany();
    await coursePrisma.communityPost.deleteMany();
    await coursePrisma.communityMember.deleteMany();
    await coursePrisma.communityGroup.deleteMany();
    await coursePrisma.certificate.deleteMany();
    await coursePrisma.review.deleteMany();
    await coursePrisma.lessonProgress.deleteMany();
    await coursePrisma.enrollment.deleteMany();
    await coursePrisma.lesson.deleteMany();
    await coursePrisma.chapter.deleteMany();
    await coursePrisma.course.deleteMany();
    await coursePrisma.category.deleteMany();
    await coursePrisma.instructorProfile.deleteMany();

    // 4. Auth
    await authPrisma.user.deleteMany();

    // 5. Redis
    const redisUrl = readEnvVarFromFile(path.join(projectRoot, 'services/course-service/.env'), 'CACHE_REDIS_URL') || process.env.CACHE_REDIS_URL;
    if (redisUrl) {
      const redis = new Redis(redisUrl);
      await redis.flushall();
      await redis.quit();
    }
    
    console.log('✅ Đã dọn dẹp sạch sẽ 4 cơ sở dữ liệu và Redis Cache.');
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

  const hashedPassword = await bcrypt.hash('123456', BCRYPT_SALT_ROUNDS);
  
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
  
  console.log(`✅ Đã tạo ${accounts.length} tài khoản thành công. (Mật khẩu mặc định: 123456)`);
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
        await coursePrisma.lesson.create({
          data: {
            title: `Bài ${l}: Kiến thức quan trọng ${l}`,
            order: l,
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            sourceType: 'YOUTUBE',
            content: 'Đây là nội dung chi tiết của bài học. Học viên cần chú ý ghi chép và thực hành theo hướng dẫn.',
            duration: randomInt(300, 1200),
            isPublished: true,
            isFree: c === 1 && l === 1,
            chapterId: chapter.id,
          }
        });
        totalLessons++;
      }
    }

    // Update totals
    const updatedCourse = await coursePrisma.course.update({
      where: { id: course.id },
      data: { totalLessons, totalDuration: totalLessons * 600 }
    });
    
    // Create Community Group
    await coursePrisma.communityGroup.create({
      data: {
        type: 'COURSE_PRIVATE',
        name: `Thảo luận: ${item.title}`,
        slug: `group-${slug}`,
        courseId: course.id,
        ownerId: instId,
        memberCount: 1,
      }
    });
    await coursePrisma.communityMember.create({
      data: {
        groupId: (await coursePrisma.communityGroup.findUnique({ where: { slug: `group-${slug}` } }))!.id,
        userId: instId
      }
    });

    courses.push(updatedCourse);
    console.log(`  ✅ [${item.price === 0 ? 'FREE' : 'PAID'}] ${item.title} — ${totalLessons} bài học.`);
  }
  return courses;
}

// ─── Step 6: Enrollments & Simulated Activity ─────────────────────────────────

async function seedActivity(students: any[], courses: any[]) {
  console.log('\n🚀 BƯỚC 6: MÔ PHỎNG HOẠT ĐỘNG (ENROLLMENTS, PROGRESS, REVIEWS, PAYMENTS)...');
  
  let enrollmentCount = 0;
  let orderCount = 0;

  for (const student of students) {
    if (student.role !== 'STUDENT') continue;

    // Each student enrolls in 4-8 random courses
    const myCourses = courses.sort(() => 0.5 - Math.random()).slice(0, randomInt(4, 8));

    for (const course of myCourses) {
      // 1. Enrollment
      const enrollment = await coursePrisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          orderId: `seed-order-${student.id}-${course.id}`,
          enrolledAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date())
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
            paidAt: enrollment.enrolledAt,
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
            netAmount: netAmount,
            status: 'AVAILABLE'
          }
        });
        orderCount++;
      }

      // 3. Learning Progress (mô phỏng hoàn thành 10-100% bài học)
      const lessons = await coursePrisma.lesson.findMany({
        where: { chapter: { courseId: course.id } }
      });
      
      const completedRatio = Math.random(); // 0 to 1
      const completedCount = Math.floor(lessons.length * completedRatio);
      
      for (let i = 0; i < lessons.length; i++) {
        const isCompleted = i < completedCount;
        await coursePrisma.lessonProgress.create({
          data: {
            userId: student.id,
            lessonId: lessons[i].id,
            isCompleted,
            lastWatched: isCompleted ? lessons[i].duration : randomInt(0, lessons[i].duration),
          }
        });
      }

      // 4. Review (nếu học xong > 50%)
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

      // 5. Certificate (nếu học xong 100%)
      if (completedRatio >= 1) {
        await coursePrisma.certificate.create({
          data: {
            certificateNumber: `CERT-${student.id.split('-')[1]}-${course.id.split('-')[0]}`,
            userId: student.id,
            courseId: course.id,
            enrollmentId: enrollment.id,
            completedAt: new Date(),
          }
        });
      }
    }

    // 6. Notifications for student
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
  console.log(`✅ Đã tạo ${orderCount} đơn hàng thành công.`);
  console.log(`✅ Đã mô phỏng tiến độ học tập, đánh giá và cấp chứng chỉ.`);
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
    
    await seedActivity(students, courses);

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
  }
}

main();
