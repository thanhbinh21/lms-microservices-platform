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
import {
  buildAutoContextText,
  buildAutoContextTranscriptId,
  computeContentHash,
  computeVideoHash,
} from '../services/course-service/src/lib/transcript-context';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BCRYPT_SALT_ROUNDS = 10;

const CATEGORY_SEEDS = [
  { name: 'Web Frontend', slug: 'web-frontend', order: 1 },
  { name: 'Web Backend', slug: 'web-backend', order: 2 },
  { name: 'Mobile Development', slug: 'mobile', order: 3 },
  { name: 'DevOps & Cloud', slug: 'devops', order: 4 },
  { name: 'AI & Data Science', slug: 'ai-ml', order: 5 },
  { name: 'Soft Skills', slug: 'soft-skills', order: 6 },
] as const;

type CourseSeed = {
  title: string;
  catIdx: number;
  price: number;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  audience: string;
  outcomes: string[];
  keywords: string[];
  project: string;
  chapters: string[];
};

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
    await coursePrisma.transcriptJob.deleteMany();
    await coursePrisma.lessonTranscript.deleteMany();
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

  const categoryIds: string[] = [];
  for (const cat of CATEGORY_SEEDS) {
    const c = await coursePrisma.category.create({ data: cat });
    categoryIds.push(c.id);
  }
  console.log('✅ Đã tạo 6 danh mục.');
  return categoryIds;
}

// ─── Step 5: Courses & Curriculum ─────────────────────────────────────────────

const COURSE_SEEDS: CourseSeed[] = [
  {
    title: 'ReactJS Pro Mastery',
    catIdx: 0,
    price: 599000,
    level: 'ADVANCED',
    audience: 'frontend developer da biet HTML, CSS, JavaScript va muon xay dung ung dung React lon, de bao tri.',
    outcomes: ['thiet ke component tree ro rang', 'quan ly state voi hooks va context', 'toi uu render bang memoization', 'viet form, validation va data fetching an toan'],
    keywords: ['react', 'jsx', 'component', 'hooks', 'state', 'props', 'context', 'performance', 'frontend architecture'],
    project: 'xay dung dashboard quan ly khoa hoc co bang du lieu, filter, modal form va optimistic UI.',
    chapters: ['Tu duy component va JSX', 'Hooks, state va data flow', 'Toi uu hieu nang va kien truc frontend'],
  },
  {
    title: 'Next.js 15 Fullstack',
    catIdx: 0,
    price: 799000,
    level: 'INTERMEDIATE',
    audience: 'lap trinh vien muon lam san pham fullstack bang App Router, Server Actions va API routes.',
    outcomes: ['phan biet server component va client component', 'xu ly form voi server action', 'cache va revalidate du lieu', 'bao ve route can dang nhap'],
    keywords: ['next.js', 'app router', 'server actions', 'server component', 'client component', 'cache', 'revalidate', 'fullstack'],
    project: 'xay dung trang hoc truc tuyen co danh sach khoa hoc, trang chi tiet, dang nhap va dashboard hoc vien.',
    chapters: ['Nen tang App Router', 'Data fetching va Server Actions', 'Auth, cache va deploy'],
  },
  {
    title: 'NodeJS Microservices',
    catIdx: 1,
    price: 1200000,
    level: 'ADVANCED',
    audience: 'backend developer muon tach he thong thanh service doc lap va giao tiep bang API/Kafka.',
    outcomes: ['thiet ke service boundary', 'dung message broker cho async flow', 'xu ly retry va DLQ', 'quan sat log, trace va health check'],
    keywords: ['nodejs', 'microservices', 'express', 'kafka', 'event-driven', 'retry', 'dlq', 'service boundary', 'observability'],
    project: 'xay dung flow order -> payment -> enrollment voi idempotency, retry topic va dead letter queue.',
    chapters: ['Tu monolith den microservices', 'Giao tiep dong bo va bat dong bo', 'Reliability, retry va observability'],
  },
  {
    title: 'Go Lang for Backend',
    catIdx: 1,
    price: 850000,
    level: 'BEGINNER',
    audience: 'nguoi moi hoc Go nhung da co kien thuc lap trinh co ban va muon viet API backend.',
    outcomes: ['nam cu phap Go can thiet', 'viet REST API voi net/http', 'xu ly goroutine va channel co kiem soat', 'ket noi database va test handler'],
    keywords: ['golang', 'go', 'backend', 'goroutine', 'channel', 'rest api', 'struct', 'interface', 'database'],
    project: 'xay dung API quan ly task co CRUD, middleware log request va ket noi PostgreSQL.',
    chapters: ['Cu phap Go cho backend', 'HTTP server va middleware', 'Concurrency va database'],
  },
  {
    title: 'Flutter App Essentials',
    catIdx: 2,
    price: 450000,
    level: 'BEGINNER',
    audience: 'nguoi moi bat dau mobile development va muon tao ung dung Android/iOS bang mot codebase.',
    outcomes: ['hieu widget tree', 'tao layout responsive', 'quan ly state don gian', 'goi API va hien thi loading/error state'],
    keywords: ['flutter', 'dart', 'widget', 'stateful', 'stateless', 'layout', 'navigation', 'mobile ui', 'api'],
    project: 'xay dung app ghi chu co danh sach, form tao moi, man hinh chi tiet va luu local.',
    chapters: ['Dart va widget tree', 'Layout, navigation va form', 'State va API trong mobile app'],
  },
  {
    title: 'React Native Advanced',
    catIdx: 2,
    price: 990000,
    level: 'ADVANCED',
    audience: 'developer da biet React Native va muon nang cap app mobile production.',
    outcomes: ['toi uu list dai', 'xu ly navigation phuc tap', 'dong bo offline-first', 'debug performance va memory'],
    keywords: ['react native', 'mobile performance', 'navigation', 'flatlist', 'offline-first', 'native module', 'debugging'],
    project: 'xay dung app ban hang mobile co cart, auth, offline cache va push notification mau.',
    chapters: ['Kien truc app React Native', 'Performance va offline data', 'Native integration va release'],
  },
  {
    title: 'Docker for Beginners',
    catIdx: 3,
    price: 0,
    level: 'BEGINNER',
    audience: 'lap trinh vien muon dong goi ung dung va chay moi truong dev on dinh bang container.',
    outcomes: ['viet Dockerfile co layer hop ly', 'dung docker compose cho multi-service', 'quan ly volume va network', 'debug container bi loi'],
    keywords: ['docker', 'container', 'image', 'dockerfile', 'compose', 'volume', 'network', 'environment variables'],
    project: 'dong goi ung dung Node.js + PostgreSQL + Redis bang docker compose cho local development.',
    chapters: ['Container va image', 'Dockerfile thuc chien', 'Docker Compose cho he thong nhieu service'],
  },
  {
    title: 'Kubernetes in Practice',
    catIdx: 3,
    price: 1500000,
    level: 'ADVANCED',
    audience: 'developer/DevOps da biet Docker va muon van hanh ung dung tren Kubernetes.',
    outcomes: ['hieu pod, deployment, service va ingress', 'quan ly config/secret', 'rolling update va rollback', 'giam sat health check'],
    keywords: ['kubernetes', 'pod', 'deployment', 'service', 'ingress', 'configmap', 'secret', 'helm', 'autoscaling'],
    project: 'deploy he thong microservices co API gateway, backend, database secret va health probe.',
    chapters: ['Kubernetes primitives', 'Networking, config va secret', 'Deployment strategy va monitoring'],
  },
  {
    title: 'Python for Data Science',
    catIdx: 4,
    price: 0,
    level: 'BEGINNER',
    audience: 'nguoi moi vao data science can nen tang Python, pandas va truc quan hoa du lieu.',
    outcomes: ['lam sach du lieu bang pandas', 'phan tich thong ke co ban', 've bieu do de trinh bay insight', 'chuan bi dataset cho machine learning'],
    keywords: ['python', 'data science', 'pandas', 'numpy', 'matplotlib', 'data cleaning', 'eda', 'statistics'],
    project: 'phan tich tap du lieu ban hang, tim san pham ban chay, xu huong doanh thu va nhom khach hang.',
    chapters: ['Python cho phan tich du lieu', 'Pandas va exploratory data analysis', 'Truc quan hoa va insight'],
  },
  {
    title: 'Deep Learning with PyTorch',
    catIdx: 4,
    price: 2500000,
    level: 'ADVANCED',
    audience: 'nguoi da biet Python/ML co ban va muon huan luyen neural network bang PyTorch.',
    outcomes: ['hieu tensor va autograd', 'xay dung training loop', 'danh gia overfitting/underfitting', 'luu va load model de inference'],
    keywords: ['deep learning', 'pytorch', 'tensor', 'autograd', 'neural network', 'training loop', 'cnn', 'optimization'],
    project: 'train model phan loai anh don gian, theo doi loss/accuracy va export model inference.',
    chapters: ['Tensor, autograd va module', 'Training loop va optimization', 'Computer vision va deployment co ban'],
  },
  {
    title: 'HTML & CSS Co Ban',
    catIdx: 0,
    price: 0,
    level: 'BEGINNER',
    audience: 'nguoi moi bat dau web development can nen tang ve semantic HTML va CSS layout.',
    outcomes: ['viet HTML semantic', 'dung CSS selector va box model', 'xay dung layout flex/grid', 'lam giao dien responsive co ban'],
    keywords: ['html', 'css', 'semantic', 'box model', 'flexbox', 'grid', 'responsive', 'accessibility'],
    project: 'xay dung landing page khoa hoc co header, section noi dung, card khoa hoc va footer responsive.',
    chapters: ['HTML semantic va accessibility', 'CSS core va box model', 'Layout responsive voi Flexbox/Grid'],
  },
  {
    title: 'JavaScript Fundamentals',
    catIdx: 0,
    price: 0,
    level: 'BEGINNER',
    audience: 'nguoi moi hoc lap trinh web can JavaScript vung de hoc React/Node ve sau.',
    outcomes: ['hieu bien, function va scope', 'lam viec voi array/object', 'xu ly DOM event', 'hieu promise va async/await'],
    keywords: ['javascript', 'variable', 'function', 'scope', 'array', 'object', 'dom', 'event', 'promise', 'async await'],
    project: 'xay dung todo app co filter, local storage, validation va goi API mau.',
    chapters: ['Cu phap va tu duy JavaScript', 'DOM, event va browser API', 'Async JavaScript va fetch API'],
  },
  {
    title: 'Git & GitHub Workflow',
    catIdx: 3,
    price: 0,
    level: 'BEGINNER',
    audience: 'hoc vien can lam viec nhom voi Git, branch, pull request va review code.',
    outcomes: ['hieu commit history', 'tao branch va merge', 'xu ly conflict', 'lam pull request va code review co quy trinh'],
    keywords: ['git', 'github', 'commit', 'branch', 'merge', 'rebase', 'pull request', 'code review', 'conflict'],
    project: 'mo phong workflow team: tao feature branch, sua conflict, mo PR va viet checklist review.',
    chapters: ['Git local co ban', 'Branching va conflict', 'GitHub pull request workflow'],
  },
  {
    title: 'Ky nang Viet CV IT',
    catIdx: 5,
    price: 0,
    level: 'BEGINNER',
    audience: 'sinh vien IT va fresher can CV ro rang, dung trong tam va phu hop vi tri ung tuyen.',
    outcomes: ['viet summary ngan gon', 'mo ta project bang ket qua', 'chon keyword theo JD', 'tranh loi CV pho bien'],
    keywords: ['cv it', 'resume', 'portfolio', 'project description', 'ats keyword', 'job description', 'interview'],
    project: 'viet lai CV fresher frontend/backend voi 2 project, tech stack va thanh tuu do luong duoc.',
    chapters: ['Cau truc CV IT', 'Mo ta project va kinh nghiem', 'Toi uu CV theo job description'],
  },
  {
    title: 'Tieng Anh cho Developers',
    catIdx: 5,
    price: 299000,
    level: 'INTERMEDIATE',
    audience: 'developer muon doc tai lieu, trao doi task va tham gia phong van bang tieng Anh.',
    outcomes: ['doc docs nhanh hon', 'viet comment/PR ro rang', 'trao doi bug va requirement', 'tra loi phong van ky thuat co cau truc'],
    keywords: ['technical english', 'documentation', 'pull request', 'bug report', 'requirement', 'standup', 'interview'],
    project: 'viet bug report, PR description va cau tra loi phong van cho mot tinh huong backend/frontend.',
    chapters: ['Tu vung ky thuat cot loi', 'Viet docs, bug report va PR', 'Giao tiep trong meeting va interview'],
  },
];

const LESSON_PATTERNS = [
  'Nen tang va ly do can hoc',
  'Khái niệm cốt lõi và ví dụ thực tế',
  'Thực hành áp dụng vào dự án',
];

function buildCourseDescription(seed: CourseSeed): string {
  return [
    `${seed.title} la khoa hoc ${seed.level.toLowerCase()} danh cho ${seed.audience}`,
    `Sau khoa hoc, hoc vien co the ${seed.outcomes.join(', ')}.`,
    `Noi dung tap trung vao cac chu de: ${seed.keywords.join(', ')}.`,
    `Du an cuoi khoa: ${seed.project}`,
  ].join(' ');
}

function buildLessonContent(seed: CourseSeed, chapterTitle: string, lessonTitle: string, lessonOrder: number): string {
  const focus = seed.keywords.slice((lessonOrder - 1) * 3, (lessonOrder - 1) * 3 + 5);
  const focusText = focus.length > 0 ? focus.join(', ') : seed.keywords.slice(0, 5).join(', ');

  return [
    `Bai hoc "${lessonTitle}" thuoc chuong "${chapterTitle}" cua khoa "${seed.title}".`,
    `Muc tieu chinh la giup hoc vien nam duoc ${focusText} va biet cach ap dung vao cong viec thuc te.`,
    `Giang vien se giai thich boi canh van de, cac thuat ngu quan trong, loi ich khi ap dung dung cach va cac loi sai thuong gap khi moi hoc.`,
    `Hoc vien nen tu dat cau hoi: khi nao dung ky thuat nay, dau la dau vao/dau ra, dieu gi can kiem tra, va rui ro nao can tranh trong du an production.`,
    `Vi du thuc hanh gan voi du an: ${seed.project}`,
    `Sau bai hoc, hoc vien co the tu tom tat khái niệm, giai thich bang ngon ngu cua minh, so sanh voi cach lam thay the va tao mot checklist nho de ap dung.`,
    `Tu khoa nen nho: ${seed.keywords.join(', ')}.`,
  ].join('\n\n');
}

async function createAutoContextForSeedLesson(params: {
  lesson: {
    id: string;
    title: string;
    content: string | null;
    videoUrl: string | null;
    sourceType: string;
    duration: number | null;
  };
  chapterTitle: string;
  courseTitle: string;
  courseDescription: string;
  courseLevel: string;
  courseCategory: string;
}) {
  const contextInput = {
    id: params.lesson.id,
    title: params.lesson.title,
    content: params.lesson.content,
    videoUrl: params.lesson.videoUrl,
    sourceType: params.lesson.sourceType,
    duration: params.lesson.duration,
    chapterTitle: params.chapterTitle,
    courseTitle: params.courseTitle,
    courseDescription: params.courseDescription,
    courseLevel: params.courseLevel,
    courseCategory: params.courseCategory,
  };
  const fullText = buildAutoContextText(contextInput);

  await coursePrisma.lessonTranscript.upsert({
    where: { id: buildAutoContextTranscriptId(params.lesson.id) },
    create: {
      id: buildAutoContextTranscriptId(params.lesson.id),
      lessonId: params.lesson.id,
      sourceType: 'AUTO_CONTEXT',
      contentKind: 'AI_CONTEXT',
      provider: 'seed-all',
      language: 'vi',
      status: 'READY',
      fullText,
      durationSec: params.lesson.duration ?? null,
      contentHash: computeContentHash(fullText),
      videoHash: computeVideoHash(contextInput),
      generatedAt: new Date(),
    },
    update: {
      sourceType: 'AUTO_CONTEXT',
      contentKind: 'AI_CONTEXT',
      provider: 'seed-all',
      language: 'vi',
      status: 'READY',
      fullText,
      durationSec: params.lesson.duration ?? null,
      contentHash: computeContentHash(fullText),
      videoHash: computeVideoHash(contextInput),
      errorCode: null,
      errorMessage: null,
      generatedAt: new Date(),
    },
  });
}

async function seedCourses(instructorIds: string[], categoryIds: string[]) {
  console.log('\n📚 BƯỚC 5: TẠO 15 KHÓA HỌC & CHƯƠNG TRÌNH HỌC...');

  const lessonVideoUrls = [
    'https://youtu.be/GDVNkenmIHU?si=S-C-B0StdUQo9leN',
    'https://youtu.be/bl2m9eXfm_A?si=V7Zqivtc6Cozy31y',
    'https://youtu.be/oPVTQEP_5B0?si=Zq0AebEFY-_8NDpv',
  ];

  const courses: any[] = [];
  for (let i = 0; i < COURSE_SEEDS.length; i++) {
    const item = COURSE_SEEDS[i];
    const instId = instructorIds[i % instructorIds.length];
    const catId = categoryIds[item.catIdx];
    const categoryName = CATEGORY_SEEDS[item.catIdx].name;
    const slug = generateSlug(item.title);
    const description = buildCourseDescription(item);

    const course = await coursePrisma.course.create({
      data: {
        title: item.title,
        slug,
        description,
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
    for (let c = 1; c <= item.chapters.length; c++) {
      const chapterTitle = `Chương ${c}: ${item.chapters[c - 1]}`;
      const chapter = await coursePrisma.chapter.create({
        data: {
          title: chapterTitle,
          order: c,
          isPublished: true,
          courseId: course.id,
        }
      });

      for (let l = 1; l <= LESSON_PATTERNS.length; l++) {
        const duration = randomInt(480, 1080);
        const urlIndex = (totalLessons + l - 1) % lessonVideoUrls.length;
        const lessonTitle = `Bài ${l}: ${LESSON_PATTERNS[l - 1]}`;
        const content = buildLessonContent(item, chapterTitle, lessonTitle, l);
        const lesson = await coursePrisma.lesson.create({
          data: {
            title: lessonTitle,
            order: l,
            videoUrl: lessonVideoUrls[urlIndex],
            sourceType: 'YOUTUBE',
            content,
            duration,
            isPublished: true,
            isFree: c === 1 && l === 1,
            chapterId: chapter.id,
          }
        });

        await createAutoContextForSeedLesson({
          lesson,
          chapterTitle,
          courseTitle: course.title,
          courseDescription: description,
          courseLevel: item.level,
          courseCategory: categoryName,
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
