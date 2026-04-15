/**
 * Seed Script: Tạo 3 tài khoản mặc định cho hệ thống LMS
 * 
 * Chạy: npx tsx scripts/seed-accounts.ts
 * 
 * Tài khoản được tạo:
 *   1. student@nexedu.vn   / Student@123   (STUDENT)
 *   2. instructor@nexedu.vn / Instructor@123 (INSTRUCTOR)
 *   3. admin@nexedu.vn     / Admin@123     (ADMIN)
 */

import { PrismaClient } from '../services/auth-service/src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 10;

// Kết nối trực tiếp DB auth-service
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_AUTH ||
        'postgresql://neondb_owner:npg_n4ym7HYRqAVD@ep-odd-dew-a1dd5hjf-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    },
  },
});

interface SeedAccount {
  email: string;
  password: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
}

const SEED_ACCOUNTS: SeedAccount[] = [
  {
    email: 'student@nexedu.vn',
    password: 'Student@123',
    name: 'Nguyễn Văn Học Viên',
    role: 'STUDENT',
  },
  {
    email: 'instructor@nexedu.vn',
    password: 'Instructor@123',
    name: 'Trần Thị Giảng Viên',
    role: 'INSTRUCTOR',
  },
  {
    email: 'admin@nexedu.vn',
    password: 'Admin@123',
    name: 'Lê Văn Admin',
    role: 'ADMIN',
  },
];

async function seedAccounts() {
  console.log('🌱 Bắt đầu tạo tài khoản mẫu...\n');

  for (const account of SEED_ACCOUNTS) {
    try {
      // Kiểm tra đã tồn tại chưa
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
      });

      if (existing) {
        // Cập nhật role nếu cần (đảm bảo role đúng)
        if (existing.role !== account.role) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { role: account.role },
          });
          console.log(`  ✏️  [${account.role}] ${account.email} — đã cập nhật role`);
        } else {
          console.log(`  ⏭️  [${account.role}] ${account.email} — đã tồn tại, bỏ qua`);
        }
        continue;
      }

      // Mã hóa mật khẩu
      const hashedPassword = await bcrypt.hash(account.password, BCRYPT_SALT_ROUNDS);

      // Tạo user
      const user = await prisma.user.create({
        data: {
          email: account.email,
          password: hashedPassword,
          name: account.name,
          role: account.role,
          sourceType: 'CREDENTIALS',
        },
      });

      console.log(`  ✅ [${account.role}] ${account.email} — ID: ${user.id}`);
    } catch (error) {
      console.error(`  ❌ [${account.role}] ${account.email} — Lỗi:`, error);
    }
  }

  console.log('\n📋 Thông tin đăng nhập:');
  console.log('─'.repeat(60));
  for (const account of SEED_ACCOUNTS) {
    console.log(`  ${account.role.padEnd(12)} | ${account.email.padEnd(25)} | ${account.password}`);
  }
  console.log('─'.repeat(60));
}

async function main() {
  try {
    await seedAccounts();
  } catch (error) {
    console.error('❌ Seed accounts thất bại:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n✨ Hoàn tất seed accounts!');
  }
}

main();
