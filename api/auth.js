const { OAuth2Client } = require("google-auth-library");
const {
  clearSessionCookie,
  createSessionCookie,
  ensureSchema,
  getSql,
  getUserFromSession,
  readBody,
  requireAdmin,
} = require("./_shared");

function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function publicUser(user) {
  if (!user) return null;
  return {
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLoginAt: user.last_login_at,
  };
}

async function upsertGoogleUser(profile) {
  const adminEmails = getAdminEmails();
  const existingUsers = await getSql()`select count(*)::int as count from spmsp_users`;
  const isFirstUser = Number(existingUsers[0]?.count || 0) === 0;
  const isConfiguredAdmin = adminEmails.includes(profile.email.toLowerCase());
  const role = isFirstUser || isConfiguredAdmin ? "admin" : "user";
  const status = isFirstUser || isConfiguredAdmin ? "approved" : "pending";

  await getSql()`
    insert into spmsp_users (email, name, picture, role, status, last_login_at, updated_at)
    values (${profile.email}, ${profile.name}, ${profile.picture}, ${role}, ${status}, now(), now())
    on conflict (email) do update set
      name = excluded.name,
      picture = excluded.picture,
      role = case
        when spmsp_users.role = 'admin' then 'admin'
        when ${isConfiguredAdmin} then 'admin'
        else spmsp_users.role
      end,
      status = case
        when spmsp_users.status = 'approved' then 'approved'
        when ${isConfiguredAdmin} then 'approved'
        else spmsp_users.status
      end,
      last_login_at = now(),
      updated_at = now()
  `;

  const rows = await getSql()`
    select email, name, picture, role, status, created_at, updated_at, last_login_at
    from spmsp_users
    where email = ${profile.email}
    limit 1
  `;
  return rows[0];
}

async function handleLogin(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: "GOOGLE_CLIENT_ID is not configured." });
    return;
  }

  const body = await readBody(req);
  if (!body.credential) {
    res.status(400).json({ error: "Missing Google credential." });
    return;
  }

  const user = await loginWithCredential(body.credential);
  if (user.status === "approved") {
    res.setHeader("Set-Cookie", createSessionCookie(user));
  }

  res.status(200).json({ user: publicUser(user), approved: user.status === "approved" });
}

async function handleRedirectLogin(req, res) {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      redirectAfterLogin(res, "error");
      return;
    }

    const body = await readBody(req);
    if (!body.credential) {
      redirectAfterLogin(res, "error");
      return;
    }

    const user = await loginWithCredential(body.credential);
    if (user.status === "approved") {
      res.setHeader("Set-Cookie", createSessionCookie(user));
      redirectAfterLogin(res, "approved");
      return;
    }

    redirectAfterLogin(res, "pending");
  } catch (error) {
    console.error("[auth] redirect login failed", error);
    redirectAfterLogin(res, "error");
  }
}

function redirectAfterLogin(res, status) {
  const target = status && status !== "approved" ? `/?auth=${encodeURIComponent(status)}` : "/";
  res.statusCode = 303;
  res.setHeader("Location", target);
  res.end();
}

async function loginWithCredential(credential) {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    const error = new Error("Google account email is not verified.");
    error.statusCode = 401;
    throw error;
  }

  return upsertGoogleUser({
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || "",
  });
}

async function listUsers(req, res) {
  await requireAdmin(req);
  const rows = await getSql()`
    select email, name, picture, role, status, created_at, updated_at, last_login_at
    from spmsp_users
    order by
      case status when 'pending' then 0 when 'approved' then 1 else 2 end,
      created_at desc
  `;
  res.status(200).json({ users: rows.map(publicUser) });
}

async function approveUser(req, res) {
  await requireAdmin(req);
  const body = await readBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  const status = body.status === "rejected" ? "rejected" : "approved";
  const role = body.role === "admin" ? "admin" : "user";
  if (!email) {
    res.status(400).json({ error: "Missing user email." });
    return;
  }
  const rows = await getSql()`
    update spmsp_users
    set status = ${status}, role = ${role}, updated_at = now()
    where lower(email) = ${email}
    returning email, name, picture, role, status, created_at, updated_at, last_login_at
  `;
  if (!rows.length) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.status(200).json({ user: publicUser(rows[0]) });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    await ensureSchema();
    const action = req.query?.action || "session";

    if (req.method === "GET" && action === "config") {
      res.status(200).json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || "",
        authEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
      });
      return;
    }

    if (req.method === "GET" && action === "session") {
      const user = await getUserFromSession(req);
      res.status(200).json({ user: publicUser(user), approved: user?.status === "approved" });
      return;
    }

    if (req.method === "GET" && action === "users") {
      await listUsers(req, res);
      return;
    }

    if (req.method === "POST" && action === "login") {
      await handleLogin(req, res);
      return;
    }

    if (req.method === "POST" && action === "login_redirect") {
      await handleRedirectLogin(req, res);
      return;
    }

    if (req.method === "POST" && action === "logout") {
      res.setHeader("Set-Cookie", clearSessionCookie());
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "POST" && action === "approve") {
      await approveUser(req, res);
      return;
    }

    res.status(404).json({ error: "Not found." });
  } catch (error) {
    if (error.statusCode === 401) res.setHeader("Set-Cookie", clearSessionCookie());
    res.status(error.statusCode || 500).json({ error: error.message || "Unexpected server error" });
  }
};
