import { Hono } from "hono";
import { devEmail } from "./dev/email";
import { auth } from "./dev/webauthn";
import { devTenants } from "./dev/tenants";
import { devToken } from "./dev/token";

const app = new Hono<{ Bindings: Env }>();

app.get("/healthz", (c) => c.text("ok"));

const t = new Hono<{ Bindings: Env }>()
  .basePath("/t/:slug");

t.get("/api/v1/health", (c) =>
  c.json({
    ok: true,
    tenant: c.req.param("slug"),
  })
);

// Dev-only: same gate as the /dev/email page in src/web/App.tsx.
const showDev =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === "true";

if (showDev) t.route("/api/v1/email", devEmail);
if (showDev) t.route("/api/v1/auth", auth);

if (showDev) app.route("/api/v1/dev/tenants", devTenants);
if (showDev) app.route("/api/v1/dev/token", devToken);

app.route("/", t);

export default app;
