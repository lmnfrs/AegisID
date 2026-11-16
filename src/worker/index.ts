import { Hono } from "hono";
import type { Bindings } from "./types";
import { devEmail } from "./dev/email";

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

if (showDev) t.route("/api/email", devEmail);

app.route("/", t);

export default app;
