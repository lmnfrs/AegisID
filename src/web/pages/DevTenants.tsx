import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FormField } from '../components/ui/FormField';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { invalidateTenants, loadTenants } from '../lib/tenants';
import type { Tenant } from '../lib/tenants';

type Result =
  | { kind: 'success'; slug: string }
  | { kind: 'error'; message: string };

type CreateBody = { ok?: boolean; error?: string; tenant?: Tenant };

export function DevTenants() {
  // null means the list is hidden until the user asks for it.
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function fetchList() {
    setListLoading(true);
    setListError(null);
    try {
      setTenants(await loadTenants());
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setListLoading(false);
    }
  }

  function refreshList() {
    invalidateTenants();
    return fetchList();
  }

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
        invalidateTenants();
        if (tenants !== null) await fetchList();
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
        <Button
          variant="primary"
          isLoading={listLoading}
          onClick={tenants === null ? fetchList : refreshList}
        >
          {tenants === null ? 'Show tenants' : 'Refresh'}
        </Button>
        {listError && (
          <Alert variant="error" title="Could not load tenants">
            {listError}
          </Alert>
        )}
        {tenants !== null && !listError && tenants.length === 0 && (
          <p className="card__desc">No tenants yet.</p>
        )}
        {tenants !== null && tenants.length > 0 && (
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
