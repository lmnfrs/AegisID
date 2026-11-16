import { Hono } from "hono";

// DEV-ONLY tenant list and create. Mounted under /api/dev/tenants by src/worker/index.ts.
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
