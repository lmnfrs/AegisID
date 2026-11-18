import React, { useState, useEffect } from 'react';

export default function MagicLinkVerifier({ onSuccess }: { onSuccess: () => void }) {
  const [status, setStatus] = useState<'loading' | 'success'>('loading');

  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus('success');
      onSuccess();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onSuccess]);

  if (status === 'loading') {
    return (
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="spinner spinner--lg"></div>
        <p style={{ fontWeight: 600 }}>Verify the validity of the token in the URL...</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <h3 style={{ marginBottom: 'var(--space-4)' }}>Welcome!</h3>
      
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center', width: '100%', maxWidth: '350px' }}>
        <div style={{ width: '40px', height: '40px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          TP
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>Tiana Philips</div>
          <div style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>Silverhand1234@gmail.com</div>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', maxWidth: '400px' }}>
        Hello <b>Tiana Philips</b>, your account is ready for activation. Follow the next steps to complete the setup process.
      </p>
    </div>
  );
}