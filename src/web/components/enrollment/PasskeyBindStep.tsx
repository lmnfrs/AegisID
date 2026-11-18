import React, { useState, useEffect } from 'react';
import { usePasskeyAuth } from '../../hooks/usePasskeyAuth';

export default function PasskeyBindStep({ onSuccess }: { onSuccess: () => void }) {
  const { status, errorMessage, registerNewPasskey } = usePasskeyAuth();
  const [deviceName, setDeviceName] = useState('Unknown Device');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (ua.includes('Mac OS')) setDeviceName('MacBook / iMac');
    else if (ua.includes('Windows')) setDeviceName('Windows PC');
    else if (ua.includes('iPhone')) setDeviceName('iPhone');
    else if (ua.includes('Android')) setDeviceName('Android Device');
  }, []);

  const handleCreatePasskey = async () => {
    const isSuccess = await registerNewPasskey(deviceName);
    
    if (isSuccess) {
      setTimeout(() => {
        onSuccess(); 
      }, 1500);
    }
  };

  return (
    <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p>Current device: <p style={{ fontWeight: 600 }}>{deviceName}</p></p>

        {errorMessage && (
            <div className="alert alert--error" style={{ marginBottom: 'var(--space-4)', fontSize: '13px' }}>
            {errorMessage}
            </div>
        )}

        <div style={{ marginTop: 'var(--space-4)' }}>
            {status === 'idle' || status === 'error' ? (
            <button className="btn btn--primary" onClick={handleCreatePasskey}>
                Create Passkey for this device
            </button>
            ) : null}

            {(status === 'waiting' || status === 'verifying_server') && (
            <button className="btn btn--primary" disabled>
                <div className="spinner" style={{ marginRight: '8px' }}></div>
                {status === 'waiting' ? 'Waiting for Verification...' : 'Saving to server...'}
            </button>
            )}

            {status === 'success' && (
            <button className="btn" style={{ background: 'var(--success)', color: 'white', borderColor: 'var(--success)', cursor: 'default' }}>
                ✓ Passkey created
            </button>
            )}
        </div>
    </div>
  );
}