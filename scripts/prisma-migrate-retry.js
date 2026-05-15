const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 7000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getServiceName() {
  const packageJsonPath = path.join(process.cwd(), "package.json");

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson.name || path.basename(process.cwd());
  } catch {
    return path.basename(process.cwd());
  }
}

function getChildEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => value !== undefined && !key.startsWith("="),
    ),
  );
}

function runPrismaMigrate() {
  const pnpmExecPath = process.env.npm_execpath;
  const command = pnpmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "pnpm.cmd"
      : "pnpm";
  const args = pnpmExecPath
    ? [pnpmExecPath, "exec", "prisma", "migrate", "deploy"]
    : ["exec", "prisma", "migrate", "deploy"];

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: getChildEnv(),
      stdio: "inherit",
    });

    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", (error) => {
      console.error(`[prisma:migrate] Failed to start pnpm: ${error.message}`);
      resolve(1);
    });
  });
}

async function main() {
  const serviceName = getServiceName();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    console.log(
      `[prisma:migrate] ${serviceName} attempt ${attempt}/${MAX_ATTEMPTS}`,
    );

    const exitCode = await runPrismaMigrate();
    if (exitCode === 0) {
      console.log(`[prisma:migrate] ${serviceName} completed`);
      process.exit(0);
    }

    console.error(`[prisma:migrate] ${serviceName} failed with code ${exitCode}`);

    if (attempt < MAX_ATTEMPTS) {
      console.log(`[prisma:migrate] ${serviceName} retrying in 7s`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  console.error(`[prisma:migrate] ${serviceName} failed after ${MAX_ATTEMPTS} attempts`);
  process.exit(1);
}

main().catch((error) => {
  console.error(`[prisma:migrate] Unexpected error: ${error.message}`);
  process.exit(1);
});
