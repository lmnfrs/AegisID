import { useState } from 'react';
import OtpInput6 from '../OtpInput6';
import BrandLogo from '../BrandLogo';

const MAX_TOTP_ATTEMPTS = 5;

export default function TotpChallengeInput({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(MAX_TOTP_ATTEMPTS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [showAdminHelp, setShowAdminHelp] = useState(false);

  const handleVerifyCode = async (submittedCode: string) => {
    if (isLocked || isVerifying) return;
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      // FLAG: REPLACE THIS MOCK WITH REAL BACKEND API CALL TO VERIFY TOTP CODE ----------------------------------------
      await new Promise((resolve) => setTimeout(resolve, 400));

      const isMockValid = submittedCode === '123456';

      if (isMockValid) {
        onSuccess();
        return;
      }

      const nextAttempts = remainingAttempts - 1;
      setRemainingAttempts(nextAttempts);
      setCode(''); 

      if (nextAttempts <= 0) {
        setIsLocked(true);
        setErrorMessage(
          'You have exceeded the maximum number of attempts. Please contact your administrator for assistance.'
        );
      } else {
        setErrorMessage(
          `Invalid TOTP code. You have ${nextAttempts}/${MAX_TOTP_ATTEMPTS} attempts remaining.`
        );
        setFocusSignal((prev) => prev + 1);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="card stack" style={{ maxWidth: '420px', width: '100%', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <BrandLogo />
        <h3 style={{ marginTop: 'var(--space-2)' }}>Enter your TOTP code</h3>
        <p className="field__hint" style={{ marginTop: 'var(--space-1)' }}>
          Enter 6-digit code in your Authenticator application
        </p>
      </div>

      <div style={{ margin: 'var(--space-4) 0' }}>
        <OtpInput6
          value={code}
          onChange={(nextVal) => {
            setCode(nextVal);
            if (errorMessage) setErrorMessage(null);
          }}
          onComplete={handleVerifyCode}
          disabled={isLocked || isVerifying}
          hasError={Boolean(errorMessage)}
          focusSignal={focusSignal}
        />
      </div>

      {isVerifying && (
        <div className="row" style={{ justifyContent: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>
          <span className="spinner" /> Verifying TOTP code...
        </div>
      )}

      {errorMessage && (
        <div className="alert alert--error" style={{ textAlign: 'left', fontSize: '13px' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ fontSize: '13px', color: 'var(--fg-muted)', marginTop: 'var(--space-2)' }}>
        Lost your TOTP?{' '}
        <button
            type="button"
            onClick={() => setShowAdminHelp((prev) => !prev)}
            style={{
            color: 'var(--info)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            font: 'inherit',
            textDecoration: 'underline',
            }}
        >
            Sent request to Admin
        </button>
        </div>

        {showAdminHelp && (
        <div className="alert alert--info" style={{ textAlign: 'left', fontSize: '13px' }}>
            If you have lost access to your TOTP device, please contact your system administrator to reset your TOTP settings. They will assist you in regaining access to your account.
        </div>
        )}
    </div>
  );
}