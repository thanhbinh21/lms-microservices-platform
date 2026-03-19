const web = "http://localhost:3006";
const gw = "http://localhost:3000";
const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0,14);
const email = `e2e_${ts}@nexedu.local`;
const password = "Password@123";
const name = "E2E User";

const status = async (u) => { try { const r = await fetch(u); return r.status; } catch { return "ERR"; } };

const run = async () => {
  const landing = await status(`${web}/`);
  const registerPage = await status(`${web}/register`);
  const loginPage = await status(`${web}/login`);
  const dashboardPage = await status(`${web}/dashboard`);

  const regRes = await fetch(`${gw}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name, role: "STUDENT" })
  });
  const reg = await regRes.json();

  const loginRes = await fetch(`${gw}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const login = await loginRes.json();

  const token = login?.data?.accessToken || "";
  let protectedStatus = "ERR";
  try {
    const pr = await fetch(`${gw}/course/api/instructor/courses`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    protectedStatus = pr.status;
  } catch {}

  console.log(JSON.stringify({
    landing,
    registerPage,
    loginPage,
    dashboardPage,
    register: { success: reg.success, code: reg.code, email },
    login: { success: login.success, code: login.code, role: login?.data?.user?.role },
    protectedStatus
  }, null, 2));
};

run().catch((e) => { console.error(e); process.exit(1); });
