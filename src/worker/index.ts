import { Hono } from "hono";

const app = new Hono();
app.get("/healthz", (c) => c.text("ok"));

const t = new Hono().basePath("/t/:slug");
t.get("/api/health", (c) => c.json({ ok: true, tenant: c.req.param("slug") }));

app.route("/", t);
export default app;