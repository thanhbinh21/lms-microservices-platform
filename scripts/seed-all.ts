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
const DEMO_PASSWORD = '12345678';
const INSTRUCTOR_SHARE_RATIO = 0.7;
const PLATFORM_FEE_RATIO = 0.3;

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

type SeedAccount = {
  id: string;
  email: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
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

function withSeedConnectionParams(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    // Seed chay nhieu PrismaClient cho nhieu database; gioi han pool de tranh Neon het connection.
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '30');
    return url.toString();
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}connection_limit=1&pool_timeout=30`;
  }
}

const getDbUrl = (service: string) => {
  const envName = `DATABASE_URL_${service.toUpperCase()}`;
  const envFile = path.join(projectRoot, 'services', `${service}-service`, '.env');
  // Try DIRECT_URL first (pooler endpoints often blocked), fall back to DATABASE_URL
  return withSeedConnectionParams(process.env[envName] ||
    readEnvVarFromFile(envFile, 'DIRECT_URL') ||
    readEnvVarFromFile(envFile, 'DATABASE_URL'));
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

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function roundVnd(amount: number) {
  return Math.round(amount);
}

function amountToNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function revenueSplit(amount: number) {
  const netAmount = roundVnd(amount * INSTRUCTOR_SHARE_RATIO);
  return {
    grossAmount: amount,
    netAmount,
    platformFee: roundVnd(amount - netAmount),
    revenueSharePct: INSTRUCTOR_SHARE_RATIO,
    platformFeePct: PLATFORM_FEE_RATIO,
  };
}

function getOptionalModel(client: any, ...names: string[]) {
  for (const name of names) {
    if (client[name]) return client[name];
  }
  return null;
}

function buildDemoPayUrl(txnRef: string) {
  return `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=${txnRef}&vnp_Amount=demo`;
}

// ─── Step 1: Clear Data ───────────────────────────────────────────────────────

async function clearOldData() {
  console.log('\n🗑️  BƯỚC 1: XÓA DỮ LIỆU CŨ TRÊN TOÀN HỆ THỐNG...');

  try {
    // 1. Notification (notification-service)
    const notifModel = getOptionalModel(notificationPrisma, 'notification', 'Notification');
    if (notifModel) await notifModel.deleteMany();

    // 2. Payment (payment-service)
    const paymentOutboxModel = getOptionalModel(paymentPrisma, 'outboxEvent', 'OutboxEvent');
    if (paymentOutboxModel) await paymentOutboxModel.deleteMany();
    const orderEventModel = getOptionalModel(paymentPrisma, 'orderEvent', 'OrderEvent');
    if (orderEventModel) await orderEventModel.deleteMany();
    await paymentPrisma.payout.deleteMany();
    await paymentPrisma.instructorEarning.deleteMany();
    const vnpAuditModel = getOptionalModel(paymentPrisma, 'vNPayAudit', 'VNPayAudit');
    if (vnpAuditModel) await vnpAuditModel.deleteMany();
    await paymentPrisma.order.deleteMany();
    const payoutProfileModel = getOptionalModel(paymentPrisma, 'instructorPayoutProfile', 'InstructorPayoutProfile');
    if (payoutProfileModel) await payoutProfileModel.deleteMany();

    // 3. Community (community-service)
    await communityPrisma.answerUpvote.deleteMany();
    await communityPrisma.questionUpvote.deleteMany();
    await communityPrisma.answer.deleteMany();
    await communityPrisma.question.deleteMany();
    await communityPrisma.communityPost.deleteMany();

    // 4. Learning (learning-service)
    const learningOutboxModel = getOptionalModel(learningPrisma, 'outboxEvent', 'OutboxEvent');
    if (learningOutboxModel) await learningOutboxModel.deleteMany();
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
    const supportReplyModel = getOptionalModel(authPrisma, 'supportTicketReply', 'SupportTicketReply');
    if (supportReplyModel) await supportReplyModel.deleteMany();
    const supportTicketModel = getOptionalModel(authPrisma, 'supportTicket', 'SupportTicket');
    if (supportTicketModel) await supportTicketModel.deleteMany();
    await authPrisma.auditLog.deleteMany();
    await authPrisma.instructorRequest.deleteMany();
    const systemConfigModel = getOptionalModel(authPrisma, 'systemConfig', 'SystemConfig');
    if (systemConfigModel) await systemConfigModel.deleteMany();
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

  const accounts: SeedAccount[] = [
    { id: 'admin-001', email: 'admin@nexedu.vn', name: 'Lê Quản Trị', username: 'admin', role: 'ADMIN' },
    { id: 'inst-001', email: 'instructor@nexedu.vn', name: 'Trần Thị Giảng Viên', username: 'instructor', role: 'INSTRUCTOR' },
    { id: 'inst-002', email: 'instructor2@nexedu.vn', name: 'Nguyễn Văn Hùng', username: 'instructor2', role: 'INSTRUCTOR' },
    { id: 'inst-003', email: 'instructor3@nexedu.vn', name: 'Phạm Minh Đức', username: 'instructor3', role: 'INSTRUCTOR' },
  ];

  for (let i = 1; i <= 20; i++) {
    accounts.push({
      id: `std-${i.toString().padStart(3, '0')}`,
      email: i === 1 ? 'student@nexedu.vn' : i === 2 ? 'student2@nexedu.vn' : `student${i}@gmail.com`,
      name: `Học Viên Số ${i}`,
      username: `student_${i}`,
      role: 'STUDENT'
    });
  }

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

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

  console.log(`✅ Đã tạo ${accounts.length} tài khoản thành công. (Mật khẩu mặc định: ${DEMO_PASSWORD})`);
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
        headline: `Chuyên gia hàng đầu trong lĩnh vực ${inst.id === 'inst-001' ? 'Frontend' : inst.id === 'inst-002' ? 'Backend' : 'Mobile'}`,
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
    keywords: ['next.js', 'app router', 'Next.js Server Actions', 'server component', 'client component', 'cache', 'redis', 'revalidate', 'fullstack'],
    project: 'xay dung trang hoc truc tuyen co danh sach khoa hoc, trang chi tiet, dang nhap, dashboard hoc vien va Server Actions goi BFF.',
    chapters: ['Nen tang App Router', 'Data fetching va Server Actions', 'Auth, cache va deploy'],
  },
  {
    title: 'NodeJS Microservices',
    catIdx: 1,
    price: 1200000,
    level: 'ADVANCED',
    audience: 'backend developer muon tach he thong thanh service doc lap va giao tiep bang API/Kafka.',
    outcomes: ['thiet ke service boundary', 'dung message broker cho async flow', 'xu ly retry va DLQ', 'ap dung CQRS/read model cho truy van nhanh'],
    keywords: ['nodejs', 'microservices', 'express', 'kafka', 'event-driven', 'retry', 'dlq', 'cqrs', 'redis', 'vnpay', 'service boundary', 'observability'],
    project: 'xay dung flow order -> VNPay payment -> Kafka -> enrollment voi idempotency, retry topic, dead letter queue va Redis read model.',
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
    if (student.id === 'std-001' || student.id === 'std-002') continue;

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
      await coursePrisma.enrollmentSignal.create({
        data: {
          userId: student.id,
          courseId: course.id,
          orderId,
        },
      });
      enrollmentCount++;

      // 2. Payment (if not free)
      if (Number(course.price) > 0) {
        const split = revenueSplit(Number(course.price));
        const order = await paymentPrisma.order.create({
          data: {
            id: orderId,
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
            expiresAt: new Date(enrolledAt.getTime() + 15 * 60 * 1000),
          }
        });

        // Earning for instructor
        await paymentPrisma.instructorEarning.create({
          data: {
            orderId: order.id,
            instructorId: course.instructorId,
            courseId: course.id,
            grossAmount: split.grossAmount,
            platformFee: split.platformFee,
            revenueSharePct: split.revenueSharePct,
            platformFeePct: split.platformFeePct,
            netAmount: split.netAmount,
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

function findSeedCourse(courses: any[], title: string) {
  const course = courses.find((item) => item.title === title);
  if (!course) throw new Error(`Missing seed course: ${title}`);
  return course;
}

async function getCourseLessons(courseId: string) {
  return coursePrisma.lesson.findMany({
    where: { chapter: { courseId } },
    orderBy: [{ chapter: { order: 'asc' } }, { order: 'asc' }],
  });
}

async function createOrderHistory(orderId: string, events: Array<{ eventType: string; payload: Record<string, unknown>; traceId: string; occurredAt: Date }>) {
  const orderEventModel = getOptionalModel(paymentPrisma, 'orderEvent', 'OrderEvent');
  if (!orderEventModel) return;

  await orderEventModel.createMany({
    data: events.map((event, index) => ({
      orderId,
      eventType: event.eventType,
      version: index + 1,
      payload: event.payload,
      metadata: { traceId: event.traceId, source: 'seed-all' },
      occurredAt: event.occurredAt,
    })),
  });
}

async function createVnpAudits(params: {
  orderId: string;
  txnRef: string;
  amount: number;
  responseCode: string;
  transactionNo?: string | null;
  traceId: string;
  valid: boolean;
  includeIpn?: boolean;
}) {
  const vnpAuditModel = getOptionalModel(paymentPrisma, 'vNPayAudit', 'VNPayAudit');
  if (!vnpAuditModel) return;

  const basePayload = {
    vnp_TxnRef: params.txnRef,
    vnp_Amount: params.amount * 100,
    vnp_ResponseCode: params.responseCode,
    vnp_TransactionNo: params.transactionNo,
    checksumResult: params.valid,
    amount: params.amount,
    responseCode: params.responseCode,
    transactionNo: params.transactionNo,
    traceId: params.traceId,
  };

  await vnpAuditModel.createMany({
    data: [
      {
        orderId: params.orderId,
        kind: 'RETURN',
        payload: { ...basePayload, callbackType: 'RETURN' },
        signature: params.valid ? `seed-signature-${params.txnRef}` : 'invalid-seed-signature',
        valid: params.valid,
        note: params.valid ? 'Seed VNPay return accepted' : 'Seed VNPay return failed checksum/response',
      },
      ...(params.includeIpn
        ? [{
            orderId: params.orderId,
            kind: 'IPN',
            payload: { ...basePayload, callbackType: 'IPN' },
            signature: `seed-ipn-signature-${params.txnRef}`,
            valid: params.valid,
            note: 'Seed VNPay IPN payload',
          }]
        : []),
    ],
  });
}

async function createPaymentOrder(params: {
  id: string;
  userId: string;
  course: any;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  createdAt: Date;
  paidAt?: Date | null;
  expiresAt?: Date | null;
  failureReason?: string | null;
  responseCode?: string | null;
  transactionNo?: string | null;
  traceId: string;
}) {
  const amount = Number(params.course.price);
  const txnRef = `SEED${params.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;

  const order = await paymentPrisma.order.upsert({
    where: { id: params.id },
    create: {
      id: params.id,
      userId: params.userId,
      courseId: params.course.id,
      instructorId: params.course.instructorId,
      courseTitle: params.course.title,
      amount,
      currency: 'VND',
      status: params.status,
      paymentMethod: 'VNPAY',
      vnpTxnRef: txnRef,
      vnpPayUrl: params.status === 'PENDING' ? buildDemoPayUrl(txnRef) : null,
      vnpTransactionNo: params.transactionNo ?? null,
      vnpBankCode: 'NCB',
      vnpResponseCode: params.responseCode ?? null,
      failureReason: params.failureReason ?? null,
      paidAt: params.paidAt ?? null,
      expiresAt: params.expiresAt ?? null,
      traceId: params.traceId,
      createdAt: params.createdAt,
    },
    update: {
      userId: params.userId,
      courseId: params.course.id,
      instructorId: params.course.instructorId,
      courseTitle: params.course.title,
      amount,
      status: params.status,
      vnpPayUrl: params.status === 'PENDING' ? buildDemoPayUrl(txnRef) : null,
      vnpTransactionNo: params.transactionNo ?? null,
      vnpBankCode: 'NCB',
      vnpResponseCode: params.responseCode ?? null,
      failureReason: params.failureReason ?? null,
      paidAt: params.paidAt ?? null,
      expiresAt: params.expiresAt ?? null,
      traceId: params.traceId,
    },
  });

  const events: Array<{ eventType: string; payload: Record<string, unknown>; traceId: string; occurredAt: Date }> = [
    {
      eventType: 'ORDER_CREATED',
      payload: { orderId: order.id, userId: order.userId, courseId: order.courseId, amount, status: 'PENDING' },
      traceId: params.traceId,
      occurredAt: params.createdAt,
    },
  ];
  if (params.status === 'PENDING') {
    events.push({
      eventType: 'PAYMENT_URL_GENERATED',
      payload: { orderId: order.id, vnpTxnRef: txnRef, expiresAt: params.expiresAt?.toISOString() ?? null },
      traceId: params.traceId,
      occurredAt: params.createdAt,
    });
  }
  if (params.status === 'COMPLETED') {
    events.push(
      {
        eventType: 'VNPAY_CALLBACK_RECEIVED',
        payload: { orderId: order.id, vnpTxnRef: txnRef, responseCode: params.responseCode ?? '00', transactionNo: params.transactionNo, callbackType: 'RETURN' },
        traceId: params.traceId,
        occurredAt: new Date((params.paidAt ?? params.createdAt).getTime() - 2000),
      },
      {
        eventType: 'PAYMENT_VERIFIED',
        payload: { orderId: order.id, vnpTxnRef: txnRef, transactionNo: params.transactionNo, verified: true },
        traceId: params.traceId,
        occurredAt: new Date((params.paidAt ?? params.createdAt).getTime() - 1000),
      },
      {
        eventType: 'ORDER_COMPLETED',
        payload: { orderId: order.id, vnpTxnRef: txnRef, transactionNo: params.transactionNo, paidAt: params.paidAt?.toISOString() },
        traceId: params.traceId,
        occurredAt: params.paidAt ?? params.createdAt,
      },
    );
  }
  if (params.status === 'FAILED' || params.status === 'EXPIRED') {
    events.push(
      {
        eventType: 'VNPAY_CALLBACK_RECEIVED',
        payload: { orderId: order.id, vnpTxnRef: txnRef, responseCode: params.responseCode ?? '24', transactionNo: null, callbackType: 'RETURN' },
        traceId: params.traceId,
        occurredAt: new Date((params.expiresAt ?? params.createdAt).getTime() - 500),
      },
      {
        eventType: params.status === 'FAILED' ? 'ORDER_FAILED' : 'ORDER_EXPIRED',
        payload: { orderId: order.id, reason: params.failureReason, responseCode: params.responseCode },
        traceId: params.traceId,
        occurredAt: params.expiresAt ?? params.createdAt,
      },
    );
  }
  await createOrderHistory(order.id, events);

  await createVnpAudits({
    orderId: order.id,
    txnRef,
    amount,
    responseCode: params.responseCode ?? (params.status === 'COMPLETED' ? '00' : params.status === 'FAILED' ? '24' : '99'),
    transactionNo: params.transactionNo ?? null,
    traceId: params.traceId,
    valid: params.status !== 'FAILED',
    includeIpn: params.status === 'COMPLETED',
  });

  return order;
}

async function createEarningForOrder(order: any, status: 'PENDING' | 'AVAILABLE' | 'WITHDRAWN' = 'AVAILABLE') {
  const split = revenueSplit(amountToNumber(order.amount));
  return paymentPrisma.instructorEarning.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      instructorId: order.instructorId,
      courseId: order.courseId,
      grossAmount: split.grossAmount,
      platformFee: split.platformFee,
      revenueSharePct: split.revenueSharePct,
      platformFeePct: split.platformFeePct,
      netAmount: split.netAmount,
      status,
    },
    update: {
      grossAmount: split.grossAmount,
      platformFee: split.platformFee,
      revenueSharePct: split.revenueSharePct,
      platformFeePct: split.platformFeePct,
      netAmount: split.netAmount,
      status,
    },
  });
}

async function ensureEnrollmentAndProgress(params: {
  student: any;
  course: any;
  orderId: string;
  completed: boolean;
  certificate?: boolean;
}) {
  const enrollment = await learningPrisma.enrollment.upsert({
    where: { userId_courseId: { userId: params.student.id, courseId: params.course.id } },
    create: {
      userId: params.student.id,
      courseId: params.course.id,
      orderId: params.orderId,
      enrolledAt: daysAgo(12),
    },
    update: {
      orderId: params.orderId,
      enrolledAt: daysAgo(12),
    },
  });

  await coursePrisma.enrollmentSignal.upsert({
    where: { orderId: params.orderId },
    create: { userId: params.student.id, courseId: params.course.id, orderId: params.orderId },
    update: { userId: params.student.id, courseId: params.course.id },
  });

  const lessons = await getCourseLessons(params.course.id);
  for (const lesson of lessons) {
    await learningPrisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: params.student.id, lessonId: lesson.id } },
      create: {
        userId: params.student.id,
        lessonId: lesson.id,
        courseId: params.course.id,
        enrollmentId: enrollment.id,
        isCompleted: params.completed,
        lastWatched: params.completed ? lesson.duration : Math.floor(lesson.duration / 2),
      },
      update: {
        enrollmentId: enrollment.id,
        isCompleted: params.completed,
        lastWatched: params.completed ? lesson.duration : Math.floor(lesson.duration / 2),
      },
    });
  }

  if (params.certificate) {
    await learningPrisma.certificate.upsert({
      where: { userId_courseId: { userId: params.student.id, courseId: params.course.id } },
      create: {
        certificateNumber: `CERT-DEMO-${params.student.id}-${params.course.slug}`.slice(0, 80),
        userId: params.student.id,
        courseId: params.course.id,
        enrollmentId: enrollment.id,
        completedAt: daysAgo(1),
      },
      update: {
        enrollmentId: enrollment.id,
        completedAt: daysAgo(1),
      },
    });
  }

  return enrollment;
}

async function completePaidCourseForDemo(student: any, course: any, orderId: string) {
  const paidAt = daysAgo(8);
  const order = await createPaymentOrder({
    id: orderId,
    userId: student.id,
    course,
    status: 'COMPLETED',
    createdAt: daysAgo(9),
    paidAt,
    expiresAt: new Date(paidAt.getTime() + 15 * 60 * 1000),
    responseCode: '00',
    transactionNo: `TRDEMO${orderId.replace(/[^0-9a-zA-Z]/g, '').slice(-10)}`,
    traceId: `trace-${orderId}`,
  });
  await createEarningForOrder(order, 'AVAILABLE');
  await ensureEnrollmentAndProgress({ student, course, orderId: order.id, completed: true, certificate: true });
}

async function seedSystemConfigs(admin: any) {
  console.log('\nBUOC 8: TAO SYSTEM CONFIG DEMO...');
  const configs = [
    { key: 'platform_fee_pct', value: 30, description: 'Phan tram phi nen tang tren moi order thanh cong.' },
    { key: 'instructor_revenue_pct', value: 70, description: 'Phan tram doanh thu giang vien nhan duoc.' },
    { key: 'instructor_share_pct', value: 70, description: 'Alias demo cho ty le chia se doanh thu giang vien.' },
    { key: 'payout_min_amount_vnd', value: 100000, description: 'So tien rut toi thieu cho giang vien.' },
    { key: 'min_payout_amount', value: 100000, description: 'Alias demo cho so tien payout toi thieu.' },
    { key: 'payment_provider', value: 'VNPAY', description: 'Cong thanh toan mac dinh.' },
    { key: 'vnpay_enabled', value: true, description: 'Bat/tat thanh toan VNPay.' },
  ];

  const systemConfigModel = getOptionalModel(authPrisma, 'systemConfig', 'SystemConfig');
  if (!systemConfigModel) return;

  for (const config of configs) {
    await systemConfigModel.upsert({
      where: { key: config.key },
      create: { ...config, updatedBy: admin.id },
      update: { value: config.value, description: config.description, updatedBy: admin.id },
    });
  }
}

async function seedDeterministicLearningAndPayments(students: any[], courses: any[]) {
  console.log('\nBUOC 9: TAO FLOW HOC TAP/THANH TOAN DEMO CO DINH...');
  const student = students.find((item) => item.email === 'student@nexedu.vn');
  const student2 = students.find((item) => item.email === 'student2@nexedu.vn');
  if (!student || !student2) throw new Error('Missing fixed demo students');

  const htmlCourse = findSeedCourse(courses, 'HTML & CSS Co Ban');
  const reactCourse = findSeedCourse(courses, 'ReactJS Pro Mastery');
  const nextCourse = findSeedCourse(courses, 'Next.js 15 Fullstack');
  const nodeCourse = findSeedCourse(courses, 'NodeJS Microservices');
  const kubernetesCourse = findSeedCourse(courses, 'Kubernetes in Practice');
  const deepLearningCourse = findSeedCourse(courses, 'Deep Learning with PyTorch');
  const reactNativeCourse = findSeedCourse(courses, 'React Native Advanced');

  await ensureEnrollmentAndProgress({
    student,
    course: htmlCourse,
    orderId: `FREE-${student.id}-${htmlCourse.id}`,
    completed: true,
    certificate: true,
  });
  await completePaidCourseForDemo(student, reactCourse, 'demo-order-student-react-completed');
  await completePaidCourseForDemo(student, nextCourse, 'demo-order-student-next-completed');
  await completePaidCourseForDemo(student, nodeCourse, 'demo-order-student-node-completed');

  await coursePrisma.review.upsert({
    where: { userId_courseId: { userId: student.id, courseId: htmlCourse.id } },
    create: { userId: student.id, courseId: htmlCourse.id, rating: 5, comment: 'Hoan thanh 100% HTML & CSS Co Ban, chung chi hien thi dung tren dashboard.' },
    update: { rating: 5, comment: 'Hoan thanh 100% HTML & CSS Co Ban, chung chi hien thi dung tren dashboard.' },
  });

  await createPaymentOrder({
    id: 'demo-order-pending-valid',
    userId: student.id,
    course: kubernetesCourse,
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: minutesFromNow(20),
    traceId: 'trace-demo-order-pending-valid',
  });
  await createPaymentOrder({
    id: 'demo-order-pending-expired',
    userId: student.id,
    course: deepLearningCourse,
    status: 'PENDING',
    createdAt: daysAgo(2),
    expiresAt: minutesFromNow(-60),
    traceId: 'trace-demo-order-pending-expired',
  });
  await createPaymentOrder({
    id: 'demo-order-expired',
    userId: student.id,
    course: reactNativeCourse,
    status: 'EXPIRED',
    createdAt: daysAgo(3),
    expiresAt: daysAgo(2),
    failureReason: 'Payment URL expired before payment completion',
    responseCode: '99',
    traceId: 'trace-demo-order-expired',
  });
  await createPaymentOrder({
    id: 'demo-order-failed',
    userId: student.id,
    course: findSeedCourse(courses, 'Tieng Anh cho Developers'),
    status: 'FAILED',
    createdAt: daysAgo(4),
    failureReason: 'VNPay response code 24 - customer cancelled payment',
    responseCode: '24',
    traceId: 'trace-demo-order-failed',
  });

  await ensureEnrollmentAndProgress({
    student: student2,
    course: htmlCourse,
    orderId: `FREE-${student2.id}-${htmlCourse.id}`,
    completed: false,
  });

  console.log('Da tao order COMPLETED/PENDING/EXPIRED/FAILED va progress/chung chi demo.');
}

async function seedPayoutLifecycle(instructors: any[]) {
  console.log('\nBUOC 10: TAO EARNING VA PAYOUT LIFECYCLE...');
  const instructor1 = instructors.find((item) => item.email === 'instructor@nexedu.vn') || instructors[0];
  const instructor2 = instructors.find((item) => item.email === 'instructor2@nexedu.vn') || instructors[1];

  for (const instructor of instructors) {
    await paymentPrisma.instructorPayoutProfile.upsert({
      where: { instructorId: instructor.id },
      create: {
        instructorId: instructor.id,
        bankName: 'VCB',
        bankAccount: `12345678${instructor.id.replace(/\D/g, '').padStart(4, '0')}`,
        bankAccountMasked: '********5678',
        accountHolder: instructor.name.toUpperCase(),
      },
      update: {
        bankName: 'VCB',
        bankAccount: `12345678${instructor.id.replace(/\D/g, '').padStart(4, '0')}`,
        bankAccountMasked: '********5678',
        accountHolder: instructor.name.toUpperCase(),
      },
    });
  }

  const instructor1Earnings = await paymentPrisma.instructorEarning.findMany({
    where: { instructorId: instructor1.id, status: 'AVAILABLE' },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });

  if (instructor1Earnings[0]) {
    await paymentPrisma.instructorEarning.update({ where: { id: instructor1Earnings[0].id }, data: { status: 'PENDING' } });
    await paymentPrisma.payout.create({
      data: {
        instructorId: instructor1.id,
        amount: instructor1Earnings[0].netAmount,
        bankAccountMasked: '********5678',
        status: 'PENDING',
      },
    });
  }
  if (instructor1Earnings[1]) {
    await paymentPrisma.instructorEarning.update({ where: { id: instructor1Earnings[1].id }, data: { status: 'WITHDRAWN' } });
    await paymentPrisma.payout.create({
      data: {
        instructorId: instructor1.id,
        amount: instructor1Earnings[1].netAmount,
        bankAccountMasked: '********5678',
        status: 'PAID',
        adminNote: 'Da chuyen khoan trong demo.',
        processedAt: daysAgo(1),
      },
    });
  }

  await paymentPrisma.payout.create({
    data: {
      instructorId: instructor2.id,
      amount: 100000,
      bankAccountMasked: '********5678',
      status: 'REJECTED',
      adminNote: 'Thong tin ngan hang chua khop voi chu tai khoan.',
      processedAt: daysAgo(2),
    },
  });
}

function instructorRequestData(user: any, status: 'pending' | 'approved' | 'rejected', adminId?: string, reason?: string) {
  return {
    userId: user.id,
    fullName: user.name,
    phone: '0901234567',
    email: user.email,
    dateOfBirth: new Date('1998-01-15'),
    address: 'Thanh pho Ho Chi Minh',
    expertise: 'Lap trinh web va kien truc he thong',
    specialization: 'Fullstack JavaScript',
    experienceYears: status === 'pending' ? 2 : 4,
    currentJob: 'Software Engineer',
    bio: 'Toi muon chia se kinh nghiem thuc chien thong qua cac khoa hoc ngan gon va co bai tap ro rang.',
    github: 'https://github.com/nexedu-demo',
    linkedin: 'https://linkedin.com/in/nexedu-demo',
    website: 'https://nexedu.vn',
    courseTitle: 'Khoa hoc demo kien truc LMS',
    courseCategory: 'Web Backend',
    courseDescription: 'Khoa hoc mau de demo quy trinh xet duyet giang vien.',
    targetStudents: 'Sinh vien IT va lap trinh vien moi di lam.',
    status,
    rejectionReason: reason ?? null,
    reviewedBy: status === 'pending' ? null : adminId ?? null,
    reviewedAt: status === 'pending' ? null : daysAgo(status === 'approved' ? 1 : 2),
  };
}

async function seedInstructorRequests(accounts: any[], admin: any) {
  console.log('\nBUOC 11: TAO DON DANG KY GIANG VIEN...');
  const pendingUser = accounts.find((item) => item.email === 'student2@nexedu.vn');
  const rejectedUser = accounts.find((item) => item.id === 'std-003');
  const approvedUser = accounts.find((item) => item.id === 'inst-003');
  if (!pendingUser || !rejectedUser || !approvedUser) return [];

  const pending = await authPrisma.instructorRequest.create({ data: instructorRequestData(pendingUser, 'pending') });
  const rejected = await authPrisma.instructorRequest.create({
    data: instructorRequestData(rejectedUser, 'rejected', admin.id, 'Can bo sung CV va minh chung kinh nghiem giang day.'),
  });
  const approved = await authPrisma.instructorRequest.create({ data: instructorRequestData(approvedUser, 'approved', admin.id) });
  return [pending, rejected, approved];
}

async function seedQaDemo(students: any[], instructors: any[], courses: any[]) {
  console.log('\nBUOC 12: TAO Q&A THEO KHOA HOC...');
  const student = students.find((item) => item.email === 'student@nexedu.vn') || students[0];
  const student2 = students.find((item) => item.email === 'student2@nexedu.vn') || students[1];
  const instructor1 = instructors.find((item) => item.email === 'instructor@nexedu.vn') || instructors[0];
  const instructor2 = instructors.find((item) => item.email === 'instructor2@nexedu.vn') || instructors[1];
  const course1 = findSeedCourse(courses, 'ReactJS Pro Mastery');
  const course2 = findSeedCourse(courses, 'Next.js 15 Fullstack');
  const [lesson1] = await getCourseLessons(course1.id);
  const [lesson2] = await getCourseLessons(course2.id);

  const unanswered = await communityPrisma.question.create({
    data: {
      courseId: course1.id,
      lessonId: lesson1?.id,
      authorId: student.id,
      title: 'Khi nao nen tach component trong React?',
      content: 'Em muon biet dau la dau hieu nen tach component va truyen props nhu the nao de tranh phuc tap.',
      upvoteCount: 2,
    },
  });
  const answered = await communityPrisma.question.create({
    data: {
      courseId: course1.id,
      lessonId: lesson1?.id,
      authorId: student2.id,
      title: 'useMemo khac useCallback o diem nao?',
      content: 'Hai hook nay deu toi uu render, em nen dung trong truong hop nao?',
      upvoteCount: 4,
    },
  });
  await communityPrisma.answer.create({
    data: {
      questionId: answered.id,
      authorId: instructor1.id,
      content: 'useMemo ghi nho gia tri tinh toan, useCallback ghi nho function reference. Chi dung khi co do luong render hoac prop reference that su gay re-render.',
      upvoteCount: 3,
    },
  });
  const resolved = await communityPrisma.question.create({
    data: {
      courseId: course1.id,
      lessonId: lesson1?.id,
      authorId: student.id,
      title: 'Lam sao xu ly state form nhieu field?',
      content: 'Nen dung useState rieng tung field hay gom thanh object?',
      isResolved: true,
      upvoteCount: 5,
    },
  });
  await communityPrisma.answer.create({
    data: {
      questionId: resolved.id,
      authorId: instructor1.id,
      content: 'Voi form nho co the dung useState tung field. Voi form lon nen gom object hoac dung form library de validation va error state ro rang hon.',
      isAccepted: true,
      upvoteCount: 6,
    },
  });
  const otherInstructorQuestion = await communityPrisma.question.create({
    data: {
      courseId: course2.id,
      lessonId: lesson2?.id,
      authorId: student.id,
      title: 'Server Actions co thay the API route khong?',
      content: 'Trong Next.js App Router, khi nao dung Server Actions va khi nao van nen giu API route?',
      upvoteCount: 1,
    },
  });
  await communityPrisma.answer.create({
    data: {
      questionId: otherInstructorQuestion.id,
      authorId: instructor2.id,
      content: 'Server Actions phu hop form/action noi bo BFF. API route van huu ich khi can public endpoint, webhook hoac client ben ngoai goi truc tiep.',
    },
  });

  return { unanswered, answered, resolved, otherInstructorQuestion };
}

async function seedSupportTickets(admin: any, students: any[]) {
  console.log('\nBUOC 13: TAO SUPPORT TICKET...');
  const student = students.find((item) => item.email === 'student@nexedu.vn') || students[0];
  const student2 = students.find((item) => item.email === 'student2@nexedu.vn') || students[1];

  const open = await authPrisma.supportTicket.create({
    data: {
      userId: student.id,
      subject: 'Toi da thanh toan nhung chua vao hoc duoc',
      description: 'Toi da thanh toan nhung chua vao hoc duoc. Vui long kiem tra don hang va quyen truy cap khoa hoc.',
      category: 'PAYMENT',
      priority: 'HIGH',
      status: 'OPEN',
    },
  });
  const inProgress = await authPrisma.supportTicket.create({
    data: {
      userId: student2.id,
      subject: 'Can ho tro cap nhat thong tin khoa hoc',
      description: 'Em can thay doi khoa hoc dang theo hoc va muon duoc tu van lo trinh phu hop.',
      category: 'COURSE',
      priority: 'NORMAL',
      status: 'IN_PROGRESS',
    },
  });
  await authPrisma.supportTicketReply.create({
    data: {
      ticketId: inProgress.id,
      authorId: admin.id,
      authorRole: 'ADMIN',
      message: 'Admin da tiep nhan va dang kiem tra thong tin khoa hoc cho ban.',
    },
  });
  const closed = await authPrisma.supportTicket.create({
    data: {
      userId: student.id,
      subject: 'Can cap lai chung chi',
      description: 'Toi muon tai lai chung chi hoan thanh khoa HTML & CSS Co Ban.',
      category: 'COURSE',
      priority: 'LOW',
      status: 'CLOSED',
      closedAt: daysAgo(1),
    },
  });
  await authPrisma.supportTicketReply.create({
    data: {
      ticketId: closed.id,
      authorId: admin.id,
      authorRole: 'ADMIN',
      message: 'Chung chi da duoc cap lai trong tab Chung chi cua dashboard.',
    },
  });

  return { open, inProgress, closed };
}

async function createDemoNotification(params: {
  userId: string;
  type: 'PAYMENT_SUCCESS' | 'ENROLLMENT_CREATED' | 'COURSE_COMPLETED' | 'LESSON_COMPLETED' | 'SYSTEM';
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  eventId: string;
  traceId?: string;
  read?: boolean;
}) {
  const notifModel = getOptionalModel(notificationPrisma, 'notification', 'Notification');
  if (!notifModel) return;

  await notifModel.create({
    data: {
      userId: params.userId,
      type: params.type,
      channel: 'IN_APP',
      status: 'SENT',
      title: params.title,
      body: params.body,
      metadata: params.metadata ?? {},
      eventId: params.eventId,
      traceId: params.traceId ?? `trace-${params.eventId}`,
      readAt: params.read ? daysAgo(1) : null,
      sentAt: new Date(),
    },
  });
}

async function seedDlqDemo(students: any[], courses: any[]) {
  console.log('\nBUOC 14: TAO DLQ / FAILED EVENT DEMO...');
  const student2 = students.find((item) => item.email === 'student2@nexedu.vn') || students[1];
  const course = findSeedCourse(courses, 'Tieng Anh cho Developers');
  const orderId = '11111111-1111-4111-8111-111111111111';
  const paidAt = daysAgo(1);
  const order = await createPaymentOrder({
    id: orderId,
    userId: student2.id,
    course,
    status: 'COMPLETED',
    createdAt: daysAgo(1),
    paidAt,
    expiresAt: new Date(paidAt.getTime() + 15 * 60 * 1000),
    responseCode: '00',
    transactionNo: 'TRDLQ000001',
    traceId: 'trace-demo-dlq',
  });
  await createEarningForOrder(order, 'AVAILABLE');

  const payload = {
    event_id: 'demo-dlq-payment-order-completed',
    event_type: 'payment.order.completed',
    timestamp: paidAt.toISOString(),
    trace_id: 'trace-demo-dlq',
    data: {
      order_id: order.id,
      user_id: student2.id,
      course_id: course.id,
      instructor_id: course.instructorId,
      amount: Number(course.price),
      currency: 'VND',
      payment_method: 'vnpay',
      vnp_txn_ref: order.vnpTxnRef,
      vnp_transaction_no: order.vnpTransactionNo || 'TRDLQ000001',
      paid_at: paidAt.toISOString(),
      instructor_share_ratio: INSTRUCTOR_SHARE_RATIO,
      platform_fee_ratio: PLATFORM_FEE_RATIO,
    },
  };

  const failures = Array.from({ length: 8 }, () => 'Learning service temporarily unavailable');
  const failedEvents = await Promise.all(
    failures.map((errorMessage, index) => {
      const suffix = String(index + 1).padStart(2, '0');
      const eventId = index === 0 ? payload.event_id : `${payload.event_id}-${suffix}`;
      const traceId = `trace-demo-dlq-${suffix}`;
      return learningPrisma.failedEvent.create({
        data: {
          topic: 'payment.order.completed',
          eventId,
          traceId,
          originalKey: order.id,
          payload: { ...payload, event_id: eventId, trace_id: traceId },
          errorMessage,
          retryCount: 3,
          status: 'PENDING',
        },
      });
    }),
  );
  return failedEvents[0];
}

async function seedAuditLogs(params: {
  admin: any;
  instructorRequests: any[];
  failedEvent: any;
}) {
  console.log('\nBUOC 15: TAO AUDIT LOG DEMO...');
  const [pendingRequest, rejectedRequest, approvedRequest] = params.instructorRequests;

  await authPrisma.auditLog.createMany({
    data: [
      {
        actorId: params.admin.id,
        actorRole: 'ADMIN',
        action: 'INSTRUCTOR_REQUEST_APPROVED',
        resourceType: 'INSTRUCTOR_REQUEST',
        resourceId: approvedRequest?.id ?? null,
        targetLabel: approvedRequest?.fullName ?? 'Instructor request',
        payload: { requestId: approvedRequest?.id, status: 'approved' },
        traceId: 'trace-seed-approve-instructor',
      },
      {
        actorId: params.admin.id,
        actorRole: 'ADMIN',
        action: 'PAYOUT_REJECTED',
        resourceType: 'PAYOUT',
        resourceId: 'seed-payout-rejected',
        targetLabel: 'instructor2@nexedu.vn',
        payload: { reason: 'Thong tin ngan hang chua khop voi chu tai khoan.' },
        traceId: 'trace-seed-reject-payout',
      },
      {
        actorId: params.admin.id,
        actorRole: 'ADMIN',
        action: 'SYSTEM_CONFIG_UPDATED',
        resourceType: 'SYSTEM_CONFIG',
        resourceId: 'platform_fee_pct',
        targetLabel: 'platform_fee_pct',
        payload: { previousValue: 25, nextValue: 30 },
        traceId: 'trace-seed-system-config',
      },
      {
        actorId: params.admin.id,
        actorRole: 'ADMIN',
        action: 'DLQ_EVENT_RETRIED',
        resourceType: 'FAILED_EVENT',
        resourceId: params.failedEvent.id,
        targetLabel: 'payment.order.completed',
        payload: { retryCount: 2, nextAction: 'retry' },
        traceId: 'trace-seed-dlq-retry',
      },
      {
        actorId: params.admin.id,
        actorRole: 'ADMIN',
        action: 'DLQ_EVENT_RESOLVED',
        resourceType: 'FAILED_EVENT',
        resourceId: params.failedEvent.id,
        targetLabel: 'payment.order.completed',
        payload: { status: 'RESOLVED' },
        traceId: 'trace-seed-dlq-resolve',
      },
      {
        actorId: 'system',
        actorRole: 'SYSTEM',
        action: 'PAYMENT_CALLBACK_PROCESSED',
        resourceType: 'PAYMENT_ORDER',
        resourceId: 'demo-order-student-react-completed',
        targetLabel: 'VNPay RETURN/IPN',
        payload: { responseCode: '00', checksumResult: true },
        traceId: 'trace-demo-order-student-react-completed',
      },
      {
        actorId: params.admin.id,
        actorRole: 'ADMIN',
        action: 'INSTRUCTOR_REQUEST_PENDING_REVIEW',
        resourceType: 'INSTRUCTOR_REQUEST',
        resourceId: pendingRequest?.id ?? null,
        targetLabel: pendingRequest?.fullName ?? 'Pending instructor request',
        payload: { status: 'pending' },
        traceId: 'trace-seed-pending-instructor',
      },
      {
        actorId: params.admin.id,
        actorRole: 'ADMIN',
        action: 'INSTRUCTOR_REQUEST_REJECTED',
        resourceType: 'INSTRUCTOR_REQUEST',
        resourceId: rejectedRequest?.id ?? null,
        targetLabel: rejectedRequest?.fullName ?? 'Rejected instructor request',
        payload: { status: 'rejected', reason: rejectedRequest?.rejectionReason },
        traceId: 'trace-seed-reject-instructor',
      },
    ],
  });
}

async function seedNotifications(params: {
  admin: any;
  instructors: any[];
  students: any[];
  qa: any;
  failedEvent: any;
  instructorRequests: any[];
}) {
  console.log('\nBUOC 16: TAO NOTIFICATION DEMO...');
  const student = params.students.find((item) => item.email === 'student@nexedu.vn') || params.students[0];
  const student2 = params.students.find((item) => item.email === 'student2@nexedu.vn') || params.students[1];
  const instructor1 = params.instructors.find((item) => item.email === 'instructor@nexedu.vn') || params.instructors[0];
  const instructor2 = params.instructors.find((item) => item.email === 'instructor2@nexedu.vn') || params.instructors[1];
  const [pendingRequest] = params.instructorRequests;

  await createDemoNotification({
    userId: student.id,
    type: 'PAYMENT_SUCCESS',
    title: 'Thanh toan thanh cong',
    body: 'Don hang ReactJS Pro Mastery da thanh toan thanh cong qua VNPay.',
    metadata: { orderId: 'demo-order-student-react-completed', route: '/dashboard/orders' },
    eventId: 'seed-student-payment-success',
  });
  await createDemoNotification({
    userId: student.id,
    type: 'ENROLLMENT_CREATED',
    title: 'Ban da duoc ghi danh',
    body: 'Ban da duoc ghi danh vao khoa NodeJS Microservices.',
    metadata: { courseTitle: 'NodeJS Microservices', route: '/dashboard/courses' },
    eventId: 'seed-student-enrollment-created',
    read: true,
  });
  await createDemoNotification({
    userId: student.id,
    type: 'COURSE_COMPLETED',
    title: 'Ban da nhan chung chi',
    body: 'Chung chi HTML & CSS Co Ban da san sang trong dashboard.',
    metadata: { courseTitle: 'HTML & CSS Co Ban', route: '/dashboard/certificates' },
    eventId: 'seed-student-certificate',
  });
  await createDemoNotification({
    userId: student2.id,
    type: 'SYSTEM',
    title: 'Don giang vien dang cho duyet',
    body: 'Ho so dang ky giang vien cua ban dang cho admin xem xet.',
    metadata: { requestId: pendingRequest?.id, route: '/become-instructor' },
    eventId: 'seed-student-instructor-request-pending',
  });

  await createDemoNotification({
    userId: instructor1.id,
    type: 'SYSTEM',
    title: 'Co hoc vien mua khoa hoc',
    body: 'Hoc vien moi da mua ReactJS Pro Mastery.',
    metadata: { orderId: 'demo-order-student-react-completed', route: '/instructor' },
    eventId: 'seed-instructor-sale',
  });
  await createDemoNotification({
    userId: instructor1.id,
    type: 'SYSTEM',
    title: 'Earning moi da duoc ghi nhan',
    body: 'Doanh thu chia se 70% da duoc cong vao so du kha dung.',
    metadata: { route: '/instructor/settings' },
    eventId: 'seed-instructor-earning',
    read: true,
  });
  await createDemoNotification({
    userId: instructor1.id,
    type: 'SYSTEM',
    title: 'Payout da duoc duyet',
    body: 'Mot yeu cau payout cua ban da duoc duyet/thanh toan trong demo.',
    metadata: { route: '/instructor/settings' },
    eventId: 'seed-instructor-payout-approved',
  });
  await createDemoNotification({
    userId: instructor2.id,
    type: 'SYSTEM',
    title: 'Payout bi tu choi',
    body: 'Thong tin ngan hang chua khop voi chu tai khoan.',
    metadata: { route: '/instructor/settings' },
    eventId: 'seed-instructor-payout-rejected',
  });
  await createDemoNotification({
    userId: instructor1.id,
    type: 'SYSTEM',
    title: 'Co cau hoi Q&A moi',
    body: params.qa.unanswered.title,
    metadata: { questionId: params.qa.unanswered.id, route: '/instructor/qa' },
    eventId: 'seed-instructor-qa-new',
  });

  await createDemoNotification({
    userId: params.admin.id,
    type: 'SYSTEM',
    title: 'Co don giang vien moi',
    body: 'Mot hoc vien vua gui don dang ky tro thanh giang vien.',
    metadata: { requestId: pendingRequest?.id, route: '/admin/instructor-requests' },
    eventId: 'seed-admin-instructor-request',
  });
  await createDemoNotification({
    userId: params.admin.id,
    type: 'SYSTEM',
    title: 'Co payout request moi',
    body: 'Giang vien vua tao yeu cau rut tien can xu ly.',
    metadata: { route: '/admin/payouts' },
    eventId: 'seed-admin-payout-request',
    read: true,
  });
  await createDemoNotification({
    userId: params.admin.id,
    type: 'SYSTEM',
    title: 'Co DLQ event can xu ly',
    body: 'payment.order.completed dang loi va can retry/resolve.',
    metadata: { failedEventId: params.failedEvent.id, route: '/admin/dlq' },
    eventId: 'seed-admin-dlq',
  });
}

async function updateCourseAggregates(courses: any[]) {
  console.log('\nBUOC 17: CAP NHAT AGGREGATE COURSE DISCOVERY...');
  for (const course of courses) {
    const [reviews, enrollmentCount] = await Promise.all([
      coursePrisma.review.findMany({ where: { courseId: course.id }, select: { rating: true } }),
      coursePrisma.enrollmentSignal.count({ where: { courseId: course.id } }),
    ]);
    const ratingCount = reviews.length;
    const averageRating = ratingCount > 0
      ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / ratingCount).toFixed(2))
      : 0;

    await coursePrisma.course.update({
      where: { id: course.id },
      data: { ratingCount, averageRating, enrollmentCount },
    });
  }
}

async function warmCourseDiscoveryReadModel() {
  const redisUrl = readEnvVarFromFile(path.join(projectRoot, 'services/course-service/.env'), 'CACHE_REDIS_URL') || process.env.CACHE_REDIS_URL;
  if (!redisUrl) {
    console.log('Bo qua warmup Redis course read model vi chua co CACHE_REDIS_URL.');
    return;
  }

  try {
    const redis = new Redis(redisUrl);
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', 'course:*', 'COUNT', '250');
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length > 0) await redis.del(keys);

    const publishedCourses = await coursePrisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        thumbnail: true,
        price: true,
        level: true,
        status: true,
        categoryId: true,
        instructorId: true,
        totalLessons: true,
        totalDuration: true,
        averageRating: true,
        ratingCount: true,
        enrollmentCount: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const course of publishedCourses) {
      const model = {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        thumbnail: course.thumbnail,
        price: Number(course.price),
        level: course.level,
        status: course.status,
        categoryId: course.categoryId,
        categoryName: course.category?.name ?? null,
        categorySlug: course.category?.slug ?? null,
        instructorId: course.instructorId,
        totalLessons: course.totalLessons,
        totalDuration: course.totalDuration,
        averageRating: course.averageRating,
        ratingCount: course.ratingCount,
        enrollmentCount: course.enrollmentCount,
        createdAt: course.createdAt.toISOString(),
        updatedAt: course.updatedAt.toISOString(),
      };
      await Promise.all([
        redis.set(`course:read:${course.id}`, JSON.stringify(model)),
        redis.sadd('course:filter:status:published', course.id),
        model.categorySlug ? redis.sadd(`course:filter:category:${model.categorySlug}`, course.id) : Promise.resolve(0),
        redis.sadd(`course:filter:level:${model.level}`, course.id),
        redis.zadd('course:sort:newest', Date.parse(model.createdAt), course.id),
        redis.zadd('course:sort:popular', model.enrollmentCount, course.id),
        redis.zadd('course:sort:rating', model.averageRating, course.id),
        redis.zadd('course:sort:price_asc', model.price, course.id),
        redis.zadd('course:sort:price_desc', -model.price, course.id),
      ]);
    }

    await redis.quit();
    console.log(`Da warmup Redis course read model cho ${publishedCourses.length} khoa hoc.`);
  } catch (error) {
    console.warn('Khong the warmup Redis course read model:', error);
  }
}

function printDemoSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('TAI KHOAN DEMO');
  console.table([
    { email: 'admin@nexedu.vn', password: DEMO_PASSWORD, role: 'ADMIN' },
    { email: 'instructor@nexedu.vn', password: DEMO_PASSWORD, role: 'INSTRUCTOR' },
    { email: 'instructor2@nexedu.vn', password: DEMO_PASSWORD, role: 'INSTRUCTOR' },
    { email: 'student@nexedu.vn', password: DEMO_PASSWORD, role: 'STUDENT' },
    { email: 'student2@nexedu.vn', password: DEMO_PASSWORD, role: 'STUDENT' },
  ]);
  console.log('URL DEMO CHINH');
  [
    '/courses',
    '/dashboard',
    '/dashboard/courses',
    '/dashboard/orders',
    '/become-instructor',
    '/instructor',
    '/instructor/settings',
    '/instructor/qa',
    '/admin',
    '/admin/instructor-requests',
    '/admin/revenue',
    '/admin/payouts',
    '/admin/audit-log',
    '/admin/dlq',
  ].forEach((url) => console.log(`- ${url}`));
  console.log('='.repeat(60) + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 NEXEDU SIMULATOR — KHỞI TẠO DỮ LIỆU HOẠT ĐỘNG 1 THÁNG\n');

  try {
    await clearOldData();

    const accounts = await seedAccounts();
    const admin = accounts.find(a => a.role === 'ADMIN');
    const instructors = accounts.filter(a => a.role === 'INSTRUCTOR');
    const students = accounts.filter(a => a.role === 'STUDENT');
    if (!admin) throw new Error('Missing admin account');

    await seedInstructorProfiles(instructors);

    const categoryIds = await seedCategories();

    const courses = await seedCourses(instructors.map(i => i.id), categoryIds);

    await seedCommunityFeed(instructors);

    await seedLearningData(students, courses);
    await seedSystemConfigs(admin);
    await seedDeterministicLearningAndPayments(students, courses);
    await seedPayoutLifecycle(instructors);
    const instructorRequests = await seedInstructorRequests(accounts, admin);
    const qa = await seedQaDemo(students, instructors, courses);
    await seedSupportTickets(admin, students);
    const failedEvent = await seedDlqDemo(students, courses);
    await seedAuditLogs({ admin, instructorRequests, failedEvent });
    await seedNotifications({ admin, instructors, students, qa, failedEvent, instructorRequests });
    await updateCourseAggregates(courses);
    await warmCourseDiscoveryReadModel();

    console.log('\n' + '═'.repeat(60));
    console.log('✨ CHÚC MỪNG! HỆ THỐNG ĐÃ CÓ ĐẦY ĐỦ DỮ LIỆU ĐỂ TEST.');
    console.log('═'.repeat(60) + '\n');
    printDemoSummary();

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
