const crypto = require("node:crypto");
const { neon } = require("@neondatabase/serverless");

let sql;
let schemaReady = false;

function getSql() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("DATABASE_URL is not configured.");
    error.statusCode = 500;
    throw error;
  }
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

async function ensureSchema() {
  if (schemaReady) return;
  const db = getSql();
  await ignoreConcurrentSchemaCreate(() => db`
      create table if not exists spmsp_state (
        id text primary key,
        companies jsonb not null default '[]'::jsonb,
        projects jsonb not null default '[]'::jsonb,
        updated_at timestamptz not null default now()
      )
    `);
  await db`
    insert into spmsp_state (id, companies, projects)
    values ('default', '[]'::jsonb, '[]'::jsonb)
    on conflict (id) do nothing
  `;
  await ignoreConcurrentSchemaCreate(() => db`
      create table if not exists spmsp_users (
        email text primary key,
        name text not null,
        picture text,
        role text not null default 'user',
        status text not null default 'pending',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        last_login_at timestamptz
      )
    `);
  schemaReady = true;
}

async function ignoreConcurrentSchemaCreate(operation) {
  try {
    await operation();
  } catch (error) {
    if (error.code === "23505" || String(error.message || "").includes("pg_type_typname_nsp_index")) return;
    throw error;
  }
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.DATABASE_URL || "spmsp-local-session-secret";
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function createSessionCookie(user) {
  const payload = base64url(
    JSON.stringify({
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      exp: Date.now() + 1000 * 60 * 60 * 12,
    })
  );
  const token = `${payload}.${sign(payload)}`;
  return serializeCookie("spmsp_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

function clearSessionCookie() {
  return serializeCookie("spmsp_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function readSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.spmsp_session;
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (signature !== sign(payload)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

async function getUserFromSession(req) {
  const session = readSession(req);
  if (!session?.email) return null;
  await ensureSchema();
  const rows = await getSql()`
    select email, name, picture, role, status, created_at, updated_at, last_login_at
    from spmsp_users
    where email = ${session.email}
    limit 1
  `;
  return rows[0] || null;
}

async function requireApprovedUser(req) {
  const user = await getUserFromSession(req);
  if (!user || user.status !== "approved") {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
  return user;
}

async function requireAdmin(req) {
  const user = await requireApprovedUser(req);
  if (user.role !== "admin") {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }
  return user;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

module.exports = {
  clearSessionCookie,
  createSessionCookie,
  ensureSchema,
  getSql,
  getUserFromSession,
  readBody,
  requireAdmin,
  requireApprovedUser,
};
