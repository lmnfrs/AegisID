import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ExpiredLinkView from '../ExpiredLinkView';

interface EnrolledUser {
  displayName: string;
  email: string;
  initials: string;
}

type VerifyStatus = 'loading' | 'success' | 'expired';

export default function MagicLinkVerifier({ onSuccess }: { onSuccess: () => void }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [user, setUser] = useState<EnrolledUser | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const verifyToken = async () => {
      setStatus('loading');

      if (!token || token === 'expired') {
        setStatus('expired');
        return;
      }

      // FLAG: DEMO FOR TEST. REPLACE THIS MOCK WITH REAL BACKEND API CALL TO VERIFY TOKEN ----------------------------------------
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (isCancelled) return;

      setUser({
        displayName: 'Tiana Philips',
        email: 'Silverhand1234@gmail.com',
        initials: 'TP',
      });
      setStatus('success');
      onSuccess();
    };

    void verifyToken();

    return () => {
      isCancelled = true;
    };
  }, [token, onSuccess]);

  if (status === 'loading') {
    return (
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="spinner spinner--lg" />
        <p style={{ fontWeight: 600 }}>Verify the validity of the token in the URL...</p>
      </div>
    );
  }

  if (status === 'expired' || !user) {
    return <ExpiredLinkView purpose="enroll" />;
  }

  return (
    <div className="stack" style={{ alignItems: 'center' }}>
      <h3 style={{ marginBottom: 'var(--space-4)' }}>Welcome!</h3>

      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-4)',
          display: 'flex',
          gap: 'var(--space-4)',
          alignItems: 'center',
          width: '100%',
          maxWidth: '350px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            background: 'var(--info-bg)',
            color: 'var(--info)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {user.initials}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>{user.displayName}</div>
          <div style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>{user.email}</div>
        </div>
      </div>

      <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', maxWidth: '400px' }}>
        Hello <b>{user.displayName}</b>, your account is ready for activation. Follow the next steps to complete the setup process.
      </p>
    </div>
  );
}