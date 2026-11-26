import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, FormField, Select } from '../../components/ui';
import { loadTenants } from '../../lib/tenants';
import type { Tenant } from '../../lib/tenants';

type UserRow = { id: string; username: string };
type UsersBody = { ok?: boolean; error?: string; users?: UserRow[] };

type IssuedToken = { token: string; expiresAt: number; username: string; userId: string };
type IssueBody = {
  ok?: boolean;
  error?: string;
  token?: string;
  expiresAt?: number;
  username?: string;
  userId?: string;
};

type VerifyBody = { ok?: boolean; error?: string; claims?: Record<string, unknown> };
type VerifyResult = { ok: true; claims: Record<string, unknown> } | { ok: false; error: string };

// Decodes one base64url JWT segment into JSON. Throws on malformed input.
function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Shows the header and payload only. The signature is never decoded or trusted here.
function decodeToken(token: string): { header: unknown; payload: unknown } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return { header: decodeSegment(parts[0]), payload: decodeSegment(parts[1]) };
  } catch {
    return null;
  }
}

export function DevToken() {
  const [slug, setSlug] = useState('');
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  // null means the user list is hidden until the user asks for it.
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const mounted = useRef(false);
  // Incremented on every tenant change so a slow response for a previous tenant is ignored.
  const requestSeq = useRef(0);
  const decoded = useMemo(() => (issued ? decodeToken(issued.token) : null), [issued]);

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

  function clearIssued() {
    setIssued(null);
    setIssueError(null);
    setCopied(false);
    setCopyError(null);
    setVerifyResult(null);
  }

  function changeTenant(next: string) {
    requestSeq.current += 1;
    setSlug(next);
    setUsers(null);
    setUsersError(null);
    setUsersLoading(false);
    setUserId('');
    clearIssued();
  }

  async function loadUsers() {
    const seq = ++requestSeq.current;
    setUsersLoading(true);
    setUsersError(null);
    setUsers(null);
    setUserId('');
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

  async function issueToken() {
    const seq = requestSeq.current;
    setIssuing(true);
    setIssueError(null);
    clearIssued();
    try {
      const res = await fetch('/api/dev/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, userId }),
      });
      const body = (await res.json().catch(() => ({}))) as IssueBody;
      if (
        !res.ok ||
        !body.ok ||
        typeof body.token !== 'string' ||
        typeof body.expiresAt !== 'number' ||
        typeof body.username !== 'string' ||
        typeof body.userId !== 'string'
      ) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      if (mounted.current && seq === requestSeq.current) {
        setIssued({
          token: body.token,
          expiresAt: body.expiresAt,
          username: body.username,
          userId: body.userId,
        });
      }
    } catch (err) {
      if (mounted.current && seq === requestSeq.current) {
        setIssueError(err instanceof Error ? err.message : 'Request failed');
      }
    } finally {
      if (mounted.current) setIssuing(false);
    }
  }

  async function copyToken() {
    if (!issued) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(issued.token);
      if (mounted.current) setCopied(true);
    } catch (err) {
      if (mounted.current) setCopyError(err instanceof Error ? err.message : 'Copy failed');
    }
  }

  async function verifyToken() {
    if (!issued) return;
    const seq = requestSeq.current;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/dev/token/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, token: issued.token }),
      });
      const body = (await res.json().catch(() => ({}))) as VerifyBody;
      if (!mounted.current || seq !== requestSeq.current) return;
      if (body.ok && body.claims) {
        setVerifyResult({ ok: true, claims: body.claims });
      } else {
        setVerifyResult({ ok: false, error: body.error ?? `HTTP ${res.status}` });
      }
    } catch (err) {
      if (mounted.current && seq === requestSeq.current) {
        setVerifyResult({ ok: false, error: err instanceof Error ? err.message : 'Request failed' });
      }
    } finally {
      if (mounted.current) setVerifying(false);
    }
  }

  return (
    <div>
      <Card
        title="Access token"
        desc="Issues an ES256 JWT access token (60 minutes) for a user via /api/dev/token. Dev only."
      >
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
        <Button variant="secondary" isLoading={usersLoading} disabled={!slug} onClick={loadUsers}>
          Load users
        </Button>
        {usersError && (
          <Alert variant="error" title="Could not load users">
            {usersError}
          </Alert>
        )}
        {users?.length === 0 && (
          <Alert variant="info" title="No users yet">
            This tenant has no users. Register one on the <Link to="/dev/webauthn">passkey test</Link> page.
          </Alert>
        )}
        {users !== null && users.length > 0 && (
          <FormField label="User">
            {(fieldProps) => (
              <Select {...fieldProps} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Choose user…</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {`${user.username} — ${user.id}`}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
        {users !== null && users.length > 0 && (
          <Button variant="primary" isLoading={issuing} disabled={!userId} onClick={issueToken}>
            Issue token
          </Button>
        )}
        {issueError && (
          <Alert variant="error" title="Could not issue token">
            {issueError}
          </Alert>
        )}
      </Card>

      {issued && (
        <Card title="Token" desc="Signed with the ES256 key in JWT_PRIVATE_JWK. Not an OIDC token.">
          <p>
            <strong>Username:</strong> {issued.username}
          </p>
          <p>
            <strong>User ID:</strong> <code>{issued.userId}</code>
          </p>
          <p>
            <strong>Expires:</strong> {new Date(issued.expiresAt).toLocaleString()}
          </p>
          <FormField label="Access token">
            {(fieldProps) => (
              <textarea
                {...fieldProps}
                className="input"
                readOnly
                rows={5}
                value={issued.token}
                style={{ fontFamily: 'var(--mono)' }}
              />
            )}
          </FormField>
          <Button variant="secondary" onClick={copyToken}>
            {copied ? 'Copied' : 'Copy token'}
          </Button>
          {copyError && (
            <Alert variant="error" title="Could not copy">
              {copyError}
            </Alert>
          )}
          {decoded ? (
            <>
              <p>
                <strong>Header</strong>
              </p>
              <pre style={{ fontFamily: 'var(--mono)' }}>{JSON.stringify(decoded.header, null, 2)}</pre>
              <p>
                <strong>Payload</strong>
              </p>
              <pre style={{ fontFamily: 'var(--mono)' }}>{JSON.stringify(decoded.payload, null, 2)}</pre>
            </>
          ) : (
            <Alert variant="warning" title="Could not decode token">
              The token header or payload is not valid base64url JSON.
            </Alert>
          )}
          <Button variant="primary" isLoading={verifying} onClick={verifyToken}>
            Verify token
          </Button>
          {verifyResult &&
            (verifyResult.ok ? (
              <Alert variant="success" title="Token verified">
                <pre style={{ fontFamily: 'var(--mono)' }}>{JSON.stringify(verifyResult.claims, null, 2)}</pre>
              </Alert>
            ) : (
              <Alert variant="error" title="Verification failed">
                {verifyResult.error}
              </Alert>
            ))}
        </Card>
      )}
    </div>
  );
}
