import { Hono } from "hono";

// DEV-ONLY tenant list and create. Mounted under /api/v1/dev/tenants by src/worker/index.ts.
// No authentication: real tenant administration needs admin auth.
export const devTenants = new Hono<{ Bindings: Env }>();

const SLUG_PATTERN = /^[a-z0-9-]{1,63}$/;

type TenantRow = { id: string; slug: string; name: string; created_at: number };

function toTenant(row: TenantRow) {
  return { id: row.id, slug: row.slug, name: row.name, createdAt: row.created_at };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

devTenants.get("/", async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare("SELECT id, slug, name, created_at FROM tenants ORDER BY slug")
      .all<TenantRow>();
    return c.json({ tenants: results.map(toTenant) });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});

type UserRow = {
  id: string;
  username: string;
  created_at: number;
  credential_count: number;
  last_used_at: number | null;
};

// Lists users of one tenant. Never returns user_handle or public_key.
devTenants.get("/:slug/users", async (c) => {
  const slug = c.req.param("slug");
  if (!SLUG_PATTERN.test(slug)) return c.json({ ok: false, error: "Invalid tenant slug" }, 400);

  try {
    const tenant = await c.env.DB
      .prepare("SELECT id FROM tenants WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (!tenant) return c.json({ ok: false, error: "Unknown tenant" }, 404);

    const { results } = await c.env.DB
      .prepare(
        "SELECT u.id, u.username, u.created_at, " +
          "COUNT(c.id) AS credential_count, MAX(c.last_used_at) AS last_used_at " +
          "FROM users u " +
          "LEFT JOIN credentials c ON c.tenant_id = u.tenant_id AND c.user_id = u.id " +
          "WHERE u.tenant_id = ? " +
          "GROUP BY u.id " +
          "ORDER BY u.username",
      )
      .bind(tenant.id)
      .all<UserRow>();

    return c.json({
      users: results.map((row) => ({
        id: row.id,
        username: row.username,
        createdAt: row.created_at,
        credentialCount: row.credential_count,
        lastUsedAt: row.last_used_at ?? null,
      })),
    });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});

devTenants.post("/", async (c) => {
  const input = (await c.req.json<{ slug?: unknown; name?: unknown }>().catch(() => null)) ?? {};

  const slug = typeof input.slug === "string" ? input.slug : "";
  if (!SLUG_PATTERN.test(slug)) return c.json({ ok: false, error: "Invalid tenant slug" }, 400);

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 1 || name.length > 100) {
    return c.json({ ok: false, error: "name must be 1-100 characters" }, 400);
  }

  try {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const result = await c.env.DB
      .prepare(
        "INSERT INTO tenants (id, slug, name, created_at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (slug) DO NOTHING",
      )
      .bind(id, slug, name, createdAt)
      .run();
    if (result.meta.changes === 0) {
      return c.json({ ok: false, error: "Slug already exists" }, 409);
    }
    return c.json({ ok: true, tenant: { id, slug, name, createdAt } }, 201);
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});
