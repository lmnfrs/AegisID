import { useState } from 'react';
import { Alert, Button, Card, FormField, Input } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { DataTableColumns, DataTableOptions } from '../../components/DataTable';
import { invalidateTenants, loadTenants } from '../../lib/tenants';
import type { Tenant } from '../../lib/tenants';

type Result =
  | { kind: 'success'; slug: string }
  | { kind: 'error'; message: string };

type CreateBody = { ok?: boolean; error?: string; tenant?: Tenant };

const tenantColumns: DataTableColumns = [
  { data: 'slug' },
  { data: 'name' },
  { data: 'id' },
  { data: 'createdAt', render: (value: number) => new Date(value).toLocaleString() },
];

const tenantOptions: DataTableOptions = {
  language: { emptyTable: 'No tenants yet.' },
};

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
    <div>
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
        {tenants !== null && (
          <DataTable data={tenants} columns={tenantColumns} options={tenantOptions} className="display">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Name</th>
                <th>ID</th>
                <th>Created</th>
              </tr>
            </thead>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
