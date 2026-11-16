export type Tenant = { id: string; slug: string; name: string; createdAt: number };

type ListBody = { tenants?: Tenant[]; error?: string };

// Dev-only client cache so pages don't query D1 on load; cleared after a tenant is created.
let cached: Promise<Tenant[]> | null = null;

export function loadTenants(): Promise<Tenant[]> {
  if (cached) return cached;
  const request = fetch('/api/dev/tenants').then(async (res) => {
    const body = (await res.json().catch(() => ({}))) as ListBody;
    if (!res.ok || !body.tenants) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body.tenants;
  });
  cached = request;
  request.catch(() => {
    if (cached === request) cached = null;
  });
  return request;
}

export function invalidateTenants(): void {
  cached = null;
}
