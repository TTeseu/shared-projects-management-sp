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
  await getSql()`
    create table if not exists spmsp_state (
      id text primary key,
      companies jsonb not null default '[]'::jsonb,
      projects jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;
  await getSql()`
    insert into spmsp_state (id, companies, projects)
    values ('default', '[]'::jsonb, '[]'::jsonb)
    on conflict (id) do nothing
  `;
  schemaReady = true;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.companies) || !Array.isArray(payload.projects)) {
    const error = new Error("Payload must include companies and projects arrays.");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    await ensureSchema();

    if (req.method === "GET") {
      const rows = await getSql()`
        select companies, projects
        from spmsp_state
        where id = 'default'
        limit 1
      `;
      const state = rows[0] || { companies: [], projects: [] };
      res.status(200).json({
        companies: Array.isArray(state.companies) ? state.companies : [],
        projects: Array.isArray(state.projects) ? state.projects : [],
      });
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      const payload = await readBody(req);
      validatePayload(payload);
      await getSql()`
        insert into spmsp_state (id, companies, projects, updated_at)
        values ('default', ${JSON.stringify(payload.companies)}::jsonb, ${JSON.stringify(payload.projects)}::jsonb, now())
        on conflict (id) do update set
          companies = excluded.companies,
          projects = excluded.projects,
          updated_at = now()
      `;
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, PUT, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Unexpected server error" });
  }
};
