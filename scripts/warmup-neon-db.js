const fs = require("fs");
const path = require("path");

let PgClient;
try {
  PgClient = require("pg").Client;
} catch {
  PgClient = null;
}

const ROOT_DIR = path.resolve(__dirname, "..");
const SERVICES_DIR = path.join(ROOT_DIR, "services");
const CONNECT_TIMEOUT_MS = 30000;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }

  return values;
}

function hasPrismaSchema(serviceDir) {
  return fs.existsSync(path.join(serviceDir, "prisma", "schema.prisma"));
}

function getServiceDirs() {
  if (!fs.existsSync(SERVICES_DIR)) {
    return [];
  }

  return fs
    .readdirSync(SERVICES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SERVICES_DIR, entry.name))
    .filter(hasPrismaSchema);
}

function maskText(value) {
  if (!value) {
    return "unknown";
  }

  if (value.length <= 6) {
    return `${value.slice(0, 1)}***`;
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function maskHost(hostname) {
  if (!hostname) {
    return "unknown";
  }

  const parts = hostname.split(".");
  if (parts.length < 3) {
    return maskText(hostname);
  }

  return `${maskText(parts[0])}.${parts.slice(1).join(".")}`;
}

function getMaskedTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    return {
      host: maskHost(url.hostname),
      database: maskText(url.pathname.replace(/^\//, "")),
    };
  } catch {
    return {
      host: "invalid",
      database: "invalid",
    };
  }
}

function createPgConfig(connectionString) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode) {
    url.searchParams.delete("sslmode");
  }

  return {
    connectionString: url.toString(),
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: CONNECT_TIMEOUT_MS,
    ssl: sslMode ? { rejectUnauthorized: false } : undefined,
  };
}

async function warmupService(serviceDir) {
  const serviceName = path.basename(serviceDir);
  const env = parseEnvFile(path.join(serviceDir, ".env"));
  const variableName = env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL";
  const connectionString = env[variableName];

  if (!connectionString) {
    console.log(`[warmup:db] ${serviceName} skipped: missing DATABASE_URL/DIRECT_URL`);
    return;
  }

  const target = getMaskedTarget(connectionString);
  console.log(
    `[warmup:db] ${serviceName} ${variableName} host=${target.host} db=${target.database}`,
  );

  const client = new PgClient(createPgConfig(connectionString));

  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log(`[warmup:db] ${serviceName} ready`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  if (!PgClient) {
    console.warn("[warmup:db] warning: package pg is not installed; run pnpm install");
    return;
  }

  const serviceDirs = getServiceDirs();

  for (const serviceDir of serviceDirs) {
    try {
      await warmupService(serviceDir);
    } catch (error) {
      // Warmup chi giam cold start; migrate retry van la buoc quyet dinh.
      console.warn(`[warmup:db] ${path.basename(serviceDir)} warning: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.warn(`[warmup:db] warning: ${error.message}`);
});
