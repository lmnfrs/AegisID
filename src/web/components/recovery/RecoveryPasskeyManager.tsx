import { useEffect, useState } from 'react';
import { usePasskeyAuth } from '../../hooks/usePasskeyAuth';
import BrandLogo from '../BrandLogo';

export default function RecoveryPasskeyManager({ onFinish }: { onFinish: () => void }) {
  const { status, errorMessage, registerNewPasskey } = usePasskeyAuth();
  const [deviceName, setDeviceName] = useState('Unknown Device');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (ua.includes('Mac OS')) setDeviceName('MacBook / iMac');
    else if (ua.includes('Windows')) setDeviceName('Windows PC');
    else if (ua.includes('iPhone')) setDeviceName('iPhone');
    else if (ua.includes('Android')) setDeviceName('Android Device');
  }, []);

  const handleRecover = async () => {
    // 1. Call backend API to revoke all old passkeys for the user
    const isSuccess = await registerNewPasskey(`${deviceName} (Recovered)`);

    if (isSuccess) {
      window.setTimeout(() => {
        onFinish();
      }, 1500);
    }
  };

  const isBusy = status === 'waiting' || status === 'verifying_server';

  return (
    <div className="card stack" style={{ maxWidth: '420px', width: '100%', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <BrandLogo />
        <h3 style={{ marginTop: 'var(--space-2)' }}>Recover your Passkey</h3>
      </div>

      <div style={{ textAlign: 'left', fontSize: '13px', color: 'var(--fg-muted)' }}>
        <p style={{ margin: '0 0 var(--space-2)' }}>
          To ensure system security, we will <b>delete all your lost passkeys</b> before creating a new one.
        </p>
        <p style={{ margin: 0 }}>
          Please confirm that the device you intend to use (<b>{deviceName}</b>) belongs to you and is protected by a secure authentication method.
        </p>
      </div>

      {errorMessage && (
        <div className="alert alert--error" style={{ textAlign: 'left', fontSize: '13px' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ marginTop: 'var(--space-2)' }}>
        {(status === 'idle' || status === 'error') && (
          <button type="button" className="btn btn--primary btn--block" onClick={handleRecover}>
            Delete lost Passkeys &amp; Add new Passkey
          </button>
        )}

        {isBusy && (
          <button type="button" className="btn btn--primary btn--block" disabled aria-busy="true">
            <span className="spinner" />
            {status === 'waiting' ? 'Waiting for Verification...' : 'Revoking old passkeys & saving...'}
          </button>
        )}

        {status === 'success' && (
          <div className="stack">
            <div className="alert alert--success" style={{ textAlign: 'left', fontSize: '13px' }}>
              New Passkey has been successfully registered! You can now use it to log in.
            </div>
            <button type="button" className="btn btn--primary btn--block" onClick={onFinish}>
              Return to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}