import type { MiddlewareHandler } from "hono";

// Rate limits a route by tenant slug + client IP using the AUTH_LIMITER binding.
// Counts are per Cloudflare location and eventually consistent, so this is
// approximate abuse control, not an exact quota. See docs/adr/0005-rate-limiting.md.
//
// Fails open: if the limiter binding throws, the request goes through and the
// error is logged, so a limiter outage cannot lock everyone out of sign-in.
// Path generic is `any` so the middleware fits any route literal; the slug is read at runtime.
// oxlint-disable-next-line typescript/no-explicit-any
export const authRateLimit: MiddlewareHandler<{ Bindings: Env }, any> = async (c, next) => {
  const slug = c.req.param("slug") ?? "";
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  try {
    const { success } = await c.env.AUTH_LIMITER.limit({ key: `${slug}:${ip}` });
    if (!success) {
      c.header("Retry-After", "60");
      return c.json({ ok: false, error: "Too many requests" }, 429);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "rate limiter failed, allowing request",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
  await next();
};
