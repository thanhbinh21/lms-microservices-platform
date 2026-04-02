#!/usr/bin/env node
/**
 * Windows: prisma generate đôi khi EPERM khi rename query_engine (file bị khóa bởi dev server/antivirus).
 * Chạy từ thư mục package (postinstall cwd = package đó). Retry; trên Windows nếu vẫn lỗi thì exit 0
 * để không làm fail cả pnpm install — sau đó chạy: pnpm prisma:generate trong từng service.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serviceRoot = process.cwd();
const pkgLabel = process.env.npm_package_name || path.basename(serviceRoot);
const engineDll = path.join(serviceRoot, 'src', 'generated', 'prisma', 'query_engine-windows.dll.node');

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function tryUnlinkEngineDll() {
  if (process.platform !== 'win32') return;
  try {
    if (fs.existsSync(engineDll)) fs.unlinkSync(engineDll);
  } catch {
    // ignore
  }
}

function runGenerate() {
  return spawnSync('npx', ['prisma', 'generate'], {
    cwd: serviceRoot,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
}

const maxAttempts = 3;
let result = runGenerate();

for (let attempt = 1; attempt < maxAttempts && result.status !== 0; attempt += 1) {
  console.warn(`[${pkgLabel}] prisma generate (lần ${attempt}) thất bại — thử lại sau 2s...`);
  sleepSync(2000);
  tryUnlinkEngineDll();
  result = runGenerate();
}

if (result.status === 0) {
  process.exit(0);
}

console.error(`[${pkgLabel}] prisma generate thất bại sau ${maxAttempts} lần.`);

if (process.platform === 'win32') {
  console.warn(
    '\nGợi ý: Tắt dev server / turbo, đóng process Node đang giữ Prisma engine.',
    `Trong thư mục package này chạy lại: pnpm prisma:generate  (${pkgLabel})\n`,
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
