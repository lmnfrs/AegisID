import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { Alert, Button, Card, FormField, Input, Select } from '../../components/ui';
import { loadTenants } from '../../lib/tenants';
import type { Tenant } from '../../lib/tenants';
import { decodeToken } from '../../lib/jwt';

type Result =
  | { kind: 'success'; title: string; message: string; token?: string; expiresAt?: number }
  | { kind: 'error'; message: string };

type ApiBody = {
  ok?: boolean;
  error?: string;
  challengeId?: string;
  options?: unknown;
  credentialId?: string;
  username?: string;
  token?: string;
  expiresAt?: number;
};

async function post(path: string, payload: unknown): Promise<ApiBody> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as ApiBody;
  if (!res.ok || body.ok === false) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body;
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError') {
      return 'The passkey prompt was cancelled or timed out.';
    }
    return err.message;
  }
  return 'Request failed';
}

export function DevWebAuthn() {
  const [slug, setSlug] = useState('');
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<'register' | 'login' | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const decoded = result?.kind === 'success' && result.token ? decodeToken(result.token) : null;
  const mounted = useRef(false);

  useEffect(() => {
    // Tracks mount state so async tenant loads don't set state after unmount.
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

  const base = `/t/${encodeURIComponent(slug)}/api/v1/auth`;

  async function register() {
    setBusy('register');
    setResult(null);
    try {
      const opts = await post(`${base}/register/options`, { username: username.trim() });
      const attestation = await startRegistration({
        optionsJSON: opts.options as PublicKeyCredentialCreationOptionsJSON,
      });
      const done = await post(`${base}/register/verify`, {
        challengeId: opts.challengeId,
        response: attestation,
      });
      setResult({
        kind: 'success',
        title: 'Registered',
        message: `Credential ID: ${done.credentialId ?? ''}`,
      });
    } catch (err) {
      setResult({ kind: 'error', message: describeError(err) });
    } finally {
      setBusy(null);
    }
  }

  async function signIn() {
    setBusy('login');
    setResult(null);
    try {
      const name = username.trim();
      const opts = await post(`${base}/login/options`, name ? { username: name } : {});
      const assertion = await startAuthentication({
        optionsJSON: opts.options as PublicKeyCredentialRequestOptionsJSON,
      });
      const done = await post(`${base}/login/verify`, {
        challengeId: opts.challengeId,
        response: assertion,
      });
      setResult({
        kind: 'success',
        title: 'Signed in',
        message: `Username: ${done.username ?? ''}`,
        token: done.token,
        expiresAt: done.expiresAt,
      });
    } catch (err) {
      setResult({ kind: 'error', message: describeError(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <Card
        title="Passkey test"
        desc="Registers and uses a passkey via /t/:slug/api/v1/auth. Credentials are stored in the local D1 database."
      >
        <FormField label="Tenant slug">
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
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
        <FormField label="Username" hint="Required to register. Leave blank to sign in with any saved passkey.">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="alice"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </FormField>
        <Button variant="primary" isLoading={busy === 'register'} disabled={!slug} onClick={register}>
          Register passkey
        </Button>
        <Button variant="primary" isLoading={busy === 'login'} disabled={!slug} onClick={signIn}>
          Sign in with passkey
        </Button>
        {result?.kind === 'success' && (
          <Alert variant="success" title={result.title}>
            {result.message}
            {result.token && (
              <>
                <br />
                Expires: {result.expiresAt ? new Date(result.expiresAt).toLocaleString() : ''}
                <textarea className="input" readOnly rows={5} value={result.token} style={{ fontFamily: 'var(--mono)' }} />
                {decoded && (
                  <>
                    <strong>Header</strong>
                    <pre style={{ fontFamily: 'var(--mono)' }}>{JSON.stringify(decoded.header, null, 2)}</pre>
                    <strong>Payload</strong>
                    <pre style={{ fontFamily: 'var(--mono)' }}>{JSON.stringify(decoded.payload, null, 2)}</pre>
                  </>
                )}
              </>
            )}
          </Alert>
        )}
        {result?.kind === 'error' && (
          <Alert variant="error" title="Failed">
            {result.message}
          </Alert>
        )}
      </Card>
    </div>
  );
}
