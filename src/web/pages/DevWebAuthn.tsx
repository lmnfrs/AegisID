import { useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FormField } from '../components/ui/FormField';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';

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
  const [slug, setSlug] = useState('demo');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<'register' | 'login' | null>(null);
  const [result, setResult] = useState<Result | null>(null);

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
        desc="Registers and uses a passkey via /t/:slug/api/auth. Credentials are kept in Worker memory only and are lost on restart."
      >
        <FormField label="Tenant slug">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          )}
        </FormField>
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
        <Button variant="primary" isLoading={busy === 'register'} onClick={register}>
          Register passkey
        </Button>
        <Button variant="primary" isLoading={busy === 'login'} onClick={signIn}>
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
