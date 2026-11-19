import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const RECOVERY_TIMEOUT_SECONDS = 600; 

interface Props {
  children: ReactNode;
  showRestrictedBanner?: boolean;
  onSessionExpired?: () => void;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function RecoveryRestrictedShell({
  children,
  showRestrictedBanner = false,
  onSessionExpired,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(RECOVERY_TIMEOUT_SECONDS);

  useEffect(() => {
    if (!showRestrictedBanner) {
      setSecondsLeft(RECOVERY_TIMEOUT_SECONDS);
      return;
    }

    const timerId = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [showRestrictedBanner]);

  useEffect(() => {
    if (showRestrictedBanner && secondsLeft === 0) {
      onSessionExpired?.();
    }
  }, [showRestrictedBanner, secondsLeft, onSessionExpired]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {showRestrictedBanner && (
        <div
          role="status"
          aria-live="polite"
          style={{
            background: '#fffbeb',
            borderBottom: '1px solid #fcd34d',
            color: '#92400e',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <span style={{ textAlign: 'center' }}>
            <b>Time limit recovery session:</b> Only allowed to register new Passkey and revoke old Passkeys, no access to the application.
          </span>
          <span
            style={{
              background: secondsLeft <= 60 ? 'var(--danger)' : '#d97706',
              color: '#ffffff',
              padding: '4px 12px',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--mono)',
              fontWeight: 700,
            }}
          >
            {formatCountdown(secondsLeft)}
          </span>
        </div>
      )}

      <div
        className="page"
        style={{
          maxWidth: '500px',
          width: '100%',
          margin: '0 auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}