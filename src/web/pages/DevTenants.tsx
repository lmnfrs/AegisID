import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FormField } from '../components/ui/FormField';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';

type Tenant = { id: string; slug: string; name: string; createdAt: number };

type Result =
  | { kind: 'success'; slug: string }
  | { kind: 'error'; message: string };

type ListBody = { tenants?: Tenant[]; error?: string };
type CreateBody = { ok?: boolean; error?: string; tenant?: Tenant };

async function fetchTenants(): Promise<Tenant[]> {
  const res = await fetch('/api/dev/tenants');
  const body = (await res.json().catch(() => ({}))) as ListBody;
  if (!res.ok || !body.tenants) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.tenants;
}

export function DevTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTenants(await fetchTenants());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Request failed');
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchTenants().then(
      (list) => {
        if (ignore) return;
        setTenants(list);
        setLoadError(null);
      },
      (err: unknown) => {
        if (!ignore) setLoadError(err instanceof Error ? err.message : 'Request failed');
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  async function createTenant() {
    setIsCreating(true);
    setResult(null);
    try {
      const res = await fetch('/api/dev/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim(), name: name.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as CreateBody;
      if (res.ok && body.ok && body.tenant) {
        setResult({ kind: 'success', slug: body.tenant.slug });
        setSlug('');
        setName('');
        await refresh();
      } else {
        setResult({ kind: 'error', message: body.error ?? `HTTP ${res.status}` });
      }
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Request failed' });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main>
      <Card title="Tenants" desc="Create tenants for the passkey test page via /api/dev/tenants.">
        <FormField label="Slug" hint="Lowercase letters, digits and hyphens. Up to 63 characters.">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="acme"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Name" hint="1-100 characters.">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </FormField>
        <Button variant="primary" isLoading={isCreating} onClick={createTenant}>
          Create tenant
        </Button>
        {result?.kind === 'success' && (
          <Alert variant="success" title="Created">
            Tenant {result.slug} created.
          </Alert>
        )}
        {result?.kind === 'error' && (
          <Alert variant="error" title="Failed">
            {result.message}
          </Alert>
        )}
      </Card>

      <Card title="Existing tenants">
        {loadError && (
          <Alert variant="error" title="Could not load tenants">
            {loadError}
          </Alert>
        )}
        {!loadError && tenants.length === 0 && <p className="card__desc">No tenants yet.</p>}
        {tenants.length > 0 && (
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {tenants.map((tenant) => (
              <li key={tenant.id}>
                <div className="row">
                  <strong>{tenant.slug}</strong>
                  <span>{tenant.name}</span>
                </div>
                <div className="label">{tenant.id}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
