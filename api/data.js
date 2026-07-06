const { ensureSchema, getSql, readBody, requireApprovedUser } = require("./_shared");

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.companies) || !Array.isArray(payload.projects)) {
    const error = new Error("Payload must include companies and projects arrays.");
    error.statusCode = 400;
    throw error;
  }
  if (payload.checklists !== undefined && (!payload.checklists || typeof payload.checklists !== "object" || Array.isArray(payload.checklists))) {
    const error = new Error("Payload checklists must be an object.");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    await ensureSchema();
    await requireApprovedUser(req);

    if (req.method === "GET") {
      const rows = await getSql()`
        select companies, projects, checklists
        from spmsp_state
        where id = 'default'
        limit 1
      `;
      const state = rows[0] || { companies: [], projects: [], checklists: {} };
      res.status(200).json({
        companies: Array.isArray(state.companies) ? state.companies : [],
        projects: Array.isArray(state.projects) ? state.projects : [],
        checklists: state.checklists && typeof state.checklists === "object" && !Array.isArray(state.checklists) ? state.checklists : {},
      });
      return;
    }

    if (req.method === "PUT" || req.method === "POST") {
      const payload = await readBody(req);
      validatePayload(payload);
      await getSql()`
        insert into spmsp_state (id, companies, projects, checklists, updated_at)
        values ('default', ${JSON.stringify(payload.companies)}::jsonb, ${JSON.stringify(payload.projects)}::jsonb, ${JSON.stringify(payload.checklists || {})}::jsonb, now())
        on conflict (id) do update set
          companies = excluded.companies,
          projects = excluded.projects,
          checklists = excluded.checklists,
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
