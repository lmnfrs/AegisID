// Server-side Turnstile check: browser -> this Worker -> Siteverify.
// Fails closed: any missing config, network error or mismatch returns false.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

// TURNSTILE_HOSTNAMES is a comma-separated allowlist. An entry "*.example.org"
// matches exactly one DNS label in front of example.org (same rule as
// expectedOrigin() in dev/webauthn.ts).
function hostnameAllowed(hostname: string, allowlist: string): boolean {
  const entries = allowlist
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const host = hostname.toLowerCase();
  return entries.some((entry) => {
    if (!entry.startsWith("*.")) return host === entry;
    const suffix = entry.slice(1); // ".example.org"
    if (!host.endsWith(suffix)) return false;
    const label = host.slice(0, -suffix.length);
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
  });
}

export async function verifyTurnstile(
  env: Env,
  token: unknown,
  expectedAction: string,
  remoteIp: string | undefined,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  const allowlist = env.TURNSTILE_HOSTNAMES ?? "";
  if (
    typeof secret !== "string" ||
    secret.length === 0 ||
    allowlist.trim().length === 0 ||
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 2048
  ) {
    return false;
  }

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);

  let result: SiteverifyResult;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    result = await res.json<SiteverifyResult>();
  } catch {
    return false;
  }

  return (
    result.success === true &&
    result.action === expectedAction &&
    typeof result.hostname === "string" &&
    hostnameAllowed(result.hostname, allowlist)
  );
}
