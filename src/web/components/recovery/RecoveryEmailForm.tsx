import React, { useState } from 'react';
import { Alert } from '../ui';
import BrandLogo from '../BrandLogo';

export default function RecoveryEmailForm({ onSimulateMailClick }: { onSimulateMailClick: () => void }) {
  const [status, setStatus] = useState<'idle' | 'submitted'>('idle');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('submitted');
  };

  return (
    <div className="card stack" style={{ maxWidth: '420px', width: '100%', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <BrandLogo />
        <h3 style={{ marginTop: 'var(--space-2)' }}>Self-service Recovery</h3>
      </div>

      <Alert variant="warning" title="Please enter your email address.">
        If the email address is valid and belongs to the organization, a recovery link, valid for 10 minutes, will be sent to you. Please check your inbox for instructions and to complete the recovery steps.
      </Alert>

      {status === 'idle' ? (
        <form onSubmit={handleSubmit} className="stack">
          <div className="field" style={{ textAlign: 'left' }}>
            <label className="field__label" style={{ color: 'var(--accent)', fontSize: '12px' }}>Email</label>
            <input 
              type="email" 
              className="input" 
              style={{ borderColor: 'var(--accent)' }} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block">
            Send recover request
          </button>
        </form>
      ) : (
        <div className="stack">
          <button className="btn btn--block" disabled style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            Check your mail
          </button>
          
          {/* Temporary button for testing purposes to simulate clicking the email link */}
          {/* {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true') && ( */}
            <button
                type="button"
                onClick={onSimulateMailClick}
                style={{
                marginTop: 'var(--space-4)',
                fontSize: '12px',
                color: 'var(--info)',
                textDecoration: 'underline',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                }}
            >
                [Dev Only] Click here to simulate opening email link
            </button>
            {/* )} */}
        </div>
      )}
    </div>
  );
}