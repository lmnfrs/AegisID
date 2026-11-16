import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, FormField, Select } from '../components/ui';
import { DataTable } from '../components/DataTable';
import type { DataTableColumns, DataTableOptions } from '../components/DataTable';
import { loadTenants } from '../lib/tenants';
import type { Tenant } from '../lib/tenants';

type UserRow = {
  id: string;
  username: string;
  createdAt: number;
  credentialCount: number;
  lastUsedAt: number | null;
};

type UsersBody = { ok?: boolean; error?: string; users?: UserRow[] };

const userColumns: DataTableColumns = [
  { data: 'username' },
  { data: 'id' },
  { data: 'credentialCount' },
  {
    data: 'lastUsedAt',
    render: (value: number | null) => (value === null ? 'Never' : new Date(value).toLocaleString()),
  },
  { data: 'createdAt', render: (value: number) => new Date(value).toLocaleString() },
];

const userOptions: DataTableOptions = {
  language: { emptyTable: 'No users in this tenant.' },
};

export function DevUsers() {
  const [slug, setSlug] = useState('');
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  // null means the table is hidden until the user asks for it.
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const mounted = useRef(false);
  // Incremented on every tenant change so a slow response for a previous tenant is ignored.
  const requestSeq = useRef(0);

  useEffect(() => {
    // Tracks mount state so async loads don't set state after unmount.
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Runs on focus/pointer down of the tenant Select, not on page load.
  function ensureTenants() {
    if (tenants !== null || tenantsLoading) return;
    setTenantsLoading(true);
    setTenantsError(null);
    loadTenants()
      .then((list) => {
        if (mounted.current) setTenants(list);
      })
      .catch((err: unknown) => {
        if (mounted.current) setTenantsError(err instanceof Error ? err.message : 'Request failed');
      })
      .finally(() => {
        if (mounted.current) setTenantsLoading(false);
      });
  }

  function changeTenant(next: string) {
    requestSeq.current += 1;
    setSlug(next);
    setUsers(null);
    setUsersError(null);
    setUsersLoading(false);
  }

  async function showUsers() {
    const seq = ++requestSeq.current;
    setUsersLoading(true);
    setUsersError(null);
    setUsers(null);
    try {
      const res = await fetch(`/api/dev/tenants/${encodeURIComponent(slug)}/users`);
      const body = (await res.json().catch(() => ({}))) as UsersBody;
      if (!res.ok || !Array.isArray(body.users)) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      if (mounted.current && seq === requestSeq.current) setUsers(body.users);
    } catch (err) {
      if (mounted.current && seq === requestSeq.current) {
        setUsersError(err instanceof Error ? err.message : 'Request failed');
      }
    } finally {
      if (mounted.current && seq === requestSeq.current) setUsersLoading(false);
    }
  }

  return (
    <div>
      <Card title="Users" desc="Lists users and passkey counts per tenant via /api/dev/tenants/:slug/users.">
        <FormField label="Tenant slug">
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={slug}
              onChange={(e) => changeTenant(e.target.value)}
              onFocus={ensureTenants}
              onPointerDown={ensureTenants}
              disabled={tenants?.length === 0}
            >
              <option value="">Choose tenant…</option>
              {tenantsLoading && <option disabled>Loading…</option>}
              {(tenants ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.slug}>
                  {`${tenant.slug} — ${tenant.name}`}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {tenantsError && (
          <Alert variant="error" title="Could not load tenants">
            {tenantsError}
          </Alert>
        )}
        {tenants?.length === 0 && (
          <Alert variant="info" title="No tenants yet">
            Create one on the <Link to="/dev/tenants">tenants page</Link> first.
          </Alert>
        )}
        <Button variant="primary" isLoading={usersLoading} disabled={!slug} onClick={showUsers}>
          Show users
        </Button>
        {usersError && (
          <Alert variant="error" title="Could not load users">
            {usersError}
          </Alert>
        )}
        {users !== null && (
          <DataTable data={users} columns={userColumns} options={userOptions} className="display">
            <thead>
              <tr>
                <th>Username</th>
                <th>User ID</th>
                <th>Passkeys</th>
                <th>Last used</th>
                <th>Created</th>
              </tr>
            </thead>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
