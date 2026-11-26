import { Hono } from "hono";
import { DASHBOARD_AUDIENCE, signAccessToken, verifyAccessToken } from "../jwt";

// DEV-ONLY access token issue and verify. No authentication. Mounted under /api/dev/token by src/worker/index.ts.
export const devToken = new Hono<{ Bindings: Env }>();

const SLUG_PATTERN = /^[a-z0-9-]{1,63}$/;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

devToken.post("/", async (c) => {
  const input = (await c.req.json<{ slug?: unknown; userId?: unknown }>().catch(() => null)) ?? {};

  const slug = typeof input.slug === "string" ? input.slug : "";
  if (!SLUG_PATTERN.test(slug)) return c.json({ ok: false, error: "Invalid tenant slug" }, 400);

  const userId = typeof input.userId === "string" ? input.userId : "";
  if (userId.length < 1) return c.json({ ok: false, error: "userId is required" }, 400);

  try {
    const tenant = await c.env.DB
      .prepare("SELECT id FROM tenants WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (!tenant) return c.json({ ok: false, error: "Unknown tenant" }, 404);

    const user = await c.env.DB
      .prepare("SELECT id, username FROM users WHERE tenant_id = ? AND id = ?")
      .bind(tenant.id, userId)
      .first<{ id: string; username: string }>();
    if (!user) return c.json({ ok: false, error: "Unknown user" }, 404);

    const issuer = `${new URL(c.req.url).origin}/t/${slug}`;
    const { token, expiresAt } = await signAccessToken(c.env, {
      issuer,
      audience: DASHBOARD_AUDIENCE,
      userId: user.id,
      username: user.username,
    });

    return c.json({ ok: true, token, expiresAt, username: user.username, userId: user.id });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});

devToken.post("/verify", async (c) => {
  const input = (await c.req.json<{ slug?: unknown; token?: unknown }>().catch(() => null)) ?? {};

  const slug = typeof input.slug === "string" ? input.slug : "";
  if (!SLUG_PATTERN.test(slug)) return c.json({ ok: false, error: "Invalid tenant slug" }, 400);

  const token = typeof input.token === "string" ? input.token : "";
  if (token.length < 1) return c.json({ ok: false, error: "token is required" }, 400);

  try {
    const issuer = `${new URL(c.req.url).origin}/t/${slug}`;
    const result = await verifyAccessToken(c.env, token, { issuer, audience: DASHBOARD_AUDIENCE });
    if (!result.ok) return c.json({ ok: false, error: result.error }, 400);
    return c.json({ ok: true, claims: result.claims });
  } catch (error) {
    return c.json({ ok: false, error: errorMessage(error) }, 500);
  }
});
