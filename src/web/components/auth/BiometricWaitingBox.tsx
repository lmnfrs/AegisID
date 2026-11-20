import { Spinner } from '../ui';

interface BiometricWaitingBoxProps {
  phase: 'waiting' | 'verifying_server';
}

export default function BiometricWaitingBox({ phase }: BiometricWaitingBoxProps) {
  const message =
    phase === 'waiting'
      ? 'Waiting for Touch ID, Face ID, or device PIN verification...'
      : 'Verifying your passkey with the server...';

  const hint =
    phase === 'waiting'
      ? 'Check your browser or operating system prompt to complete sign-in.'
      : 'This will only take a moment.';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        background: 'var(--info-bg)',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Spinner size="lg" />
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--info)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
          <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
          <path d="M2 12a10 10 0 0 1 18-6" />
          <path d="M2 16h.01" />
          <path d="M21.8 16c.2-2 .131-5.354 0-6" />
          <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
          <path d="M8.65 22c.21-.66.45-1.32.57-2" />
          <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
        </svg>
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fg)' }}>{message}</div>
        <div style={{ fontSize: '13px', color: 'var(--fg-muted)', marginTop: 'var(--space-1)' }}>
          {hint}
        </div>
      </div>
    </div>
  );
}