import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FormField } from '../components/ui/FormField';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';

type Result =
  | { kind: 'success'; messageId: string }
  | { kind: 'error'; message: string };

export function DevEmail() {
  const [slug, setSlug] = useState('demo');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function sendTest() {
    setIsSending(true);
    setResult(null);
    try {
      const res = await fetch(`/t/${encodeURIComponent(slug)}/api/email/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), name: name.trim() }),
      });
      const body = (await res.json()) as { ok: boolean; messageId?: string; error?: string };
      if (res.ok && body.ok && body.messageId) {
        setResult({ kind: 'success', messageId: body.messageId });
      } else {
        setResult({ kind: 'error', message: body.error ?? `HTTP ${res.status}` });
      }
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Request failed' });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main>
      <Card title="Email test" desc="Sends the test message via POST /t/:slug/api/email/test.">
        <FormField label="Tenant slug">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Sender name" hint="Shown with aegis@lmnfrs.org. Blank uses AegisID.">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="AegisID"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="To" hint="Sent from aegis@lmnfrs.org.">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          )}
        </FormField>
        <Button variant="primary" isLoading={isSending} onClick={sendTest}>
          Send test email
        </Button>
        {result?.kind === 'success' && (
          <Alert variant="success" title="Sent">
            Message ID: {result.messageId}
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
