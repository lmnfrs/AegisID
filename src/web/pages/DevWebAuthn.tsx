import { useEffect, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { FormField } from '../components/ui/FormField';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';

type Tenant = { id: string; slug: string; name: string };

type Result =
  | { kind: 'success'; title: string; message: string }
  | { kind: 'error'; message: string };

type ApiBody = {
  ok?: boolean;
  error?: string;
  challengeId?: string;
  options?: unknown;
  credentialId?: string;
  username?: string;
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
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<'register' | 'login' | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch('/api/dev/tenants')
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { tenants?: Tenant[]; error?: string };
        if (!res.ok || !body.tenants) throw new Error(body.error ?? `HTTP ${res.status}`);
        return body.tenants;
      })
      .then((list) => {
        if (ignore) return;
        setTenants(list);
        setSlug((current) => current || list[0]?.slug || '');
      })
      .catch((err: unknown) => {
        if (!ignore) setTenantsError(err instanceof Error ? err.message : 'Request failed');
      });
    return () => {
      ignore = true;
    };
  }, []);

  const base = `/t/${encodeURIComponent(slug)}/api/auth`;

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
      });
    } catch (err) {
      setResult({ kind: 'error', message: describeError(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <Card
        title="Passkey test"
        desc="Registers and uses a passkey via /t/:slug/api/auth. Credentials are stored in the local D1 database."
      >
        <FormField label="Tenant slug">
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!tenants || tenants.length === 0}
            >
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
            Create one on the <a href="/dev/tenants">tenants page</a> first.
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
          </Alert>
        )}
        {result?.kind === 'error' && (
          <Alert variant="error" title="Failed">
            {result.message}
          </Alert>
        )}
      </Card>
    </main>
  );
}
