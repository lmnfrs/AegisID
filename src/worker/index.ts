import { Hono } from "hono";

type Bindings = {
  EMAIL: {
    send(message: {
      to: string;
      from: string;
      subject: string;
      html?: string;
      text?: string;
    }): Promise<{ messageId: string }>;
  };
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/healthz", (c) => c.text("ok"));

const t = new Hono<{ Bindings: Bindings }>()
  .basePath("/t/:slug");

t.get("/api/health", (c) =>
  c.json({
    ok: true,
    tenant: c.req.param("slug"),
  })
);

// Dev-only: same gate as the /dev/email page in src/web/App.tsx.
const showDev =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === "true";

if (showDev) t.post("/api/email/test", async (c) => {
  const slug = c.req.param("slug");

  // TODO: Require authenticated admin access.
  // Do not expose this endpoint publicly.

  if (!/^[a-z0-9-]{1,63}$/.test(slug)) {
    return c.json({ ok: false, error: "Invalid tenant slug" }, 400);
  }

  // Sender address is fixed; recipient and display name come from the request body.
  const body = await c.req
    .json<{ to?: unknown; name?: unknown }>()
    .catch(() => ({} as { to?: unknown; name?: unknown }));

  // Single plain address only: no display name, lists, quotes or whitespace.
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (to.length > 254 || !/^[^\s@,;<>()[\]\\":]+@[^\s@,;<>()[\]\\":]+\.[^\s@,;<>()[\]\\":]+$/.test(to)) {
    return c.json({ ok: false, error: "A single valid recipient 'to' is required" }, 400);
  }

  // Display name: allowlist (letters, digits, space, . ' _ -), max 64 chars.
  // Anything else is dropped, so no header-special characters reach `from`.
  const name =
    (typeof body.name === "string" ? body.name : "")
      .replace(/[^\p{L}\p{N} .'_-]/gu, "")
      .trim()
      .slice(0, 64) || "AegisID";
  const from = `${name} <aegis@lmnfrs.org>`;

  try {
    const result = await c.env.EMAIL.send({
      to,
      from,
      subject: `Welcome to ${slug}!`,
      html: "<h1>Welcome!</h1><p>Thanks for signing up.</p>",
      text: "Welcome! Thanks for signing up.",
    });

    return c.json({
      ok: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Email sending failed:", error);

    return c.json(
      { ok: false, error: "Email sending failed" },
      500
    );
  }
});

app.route("/", t);

export default app;
