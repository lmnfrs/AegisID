import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import OtpInput6 from '../OtpInput6';

// DEMO FOR TESTING ONLY
const MOCK_TOTP_SECRET = 'HXJEDO4OMCJC5ALOVIOVLAODDC3I2DJSLKLDNCCCCSD';
const MOCK_OTPAUTH_URI = `otpauth://totp/AegisID:Silverhand1234@gmail.com?secret=${MOCK_TOTP_SECRET}&issuer=AegisID`;

export default function TotpQrBindStep({ onSuccess }: { onSuccess: () => void }) {
  const [isManualMode, setIsManualMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_TOTP_SECRET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage('Browser does not allow automatic copying. Please select and copy manually.');
    }
  };

  const handleVerifyTotp = async (submittedCode: string) => {
    if (isVerifying || isVerified) return;
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      // TODO: REPLACE THIS MOCK WITH REAL BACKEND API CALL TO VERIFY TOTP CODE ----------------------------------------
      await new Promise((resolve) => setTimeout(resolve, 400));

      if (submittedCode === '123456') {
        setIsVerified(true);
        onSuccess();
        return;
      }

      setCode('');
      setErrorMessage('Invalid 6-digit code. Please check your authenticator app.');
      setFocusSignal((prev) => prev + 1);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="stack" style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
      {!isManualMode ? (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Step 1: Scan this QR code</div>
            <div style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>
              Scan the following QR code with your authenticator app (Google Authenticator, Authy, Duo...).
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: '12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'inline-flex',
            }}
          >
            <QRCodeSVG value={MOCK_OTPAUTH_URI} size={148} level="M" />
          </div>

          <button
            type="button"
            className="btn"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: '13px',
              padding: 0,
              minHeight: 'auto',
            }}
            onClick={() => setIsManualMode(true)}
          >
            Can&apos;t scan the QR code?
          </button>
        </div>
      ) : (
        <div className="stack" style={{ textAlign: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Step 1: Copy and paste the key</div>
            <div style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>
              Copy and paste the following key into your authenticator app.
            </div>
          </div>

          <div
            className="row"
            style={{
              background: 'var(--bg)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              justifyContent: 'center',
              wordBreak: 'break-all',
            }}
          >
            <code style={{ fontFamily: 'var(--mono)', fontSize: '12px' }}>{MOCK_TOTP_SECRET}</code>
          </div>

          <div>
            <button type="button" className="btn" onClick={handleCopySecret}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          <button
            type="button"
            className="btn"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: '13px',
              padding: 0,
              minHeight: 'auto',
            }}
            onClick={() => setIsManualMode(false)}
          >
            Want to scan QR code?
          </button>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', margin: 'var(--space-2) 0' }} />

      <div className="stack" style={{ alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>Step 2: Enter the one-time code</div>
          <div style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>
            Enter the 6-digit verification code generated by the authenticator app.
          </div>
        </div>

        <OtpInput6
          value={code}
          onChange={(nextVal) => {
            setCode(nextVal);
            if (errorMessage) setErrorMessage(null);
          }}
          onComplete={handleVerifyTotp}
          disabled={isVerifying || isVerified}
          hasError={Boolean(errorMessage)}
          focusSignal={focusSignal}
        />

        {isVerifying && (
          <div className="row" style={{ justifyContent: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>
            <span className="spinner" /> Verifying TOTP code...
          </div>
        )}

        {errorMessage && (
          <div className="alert alert--error" style={{ width: '100%', fontSize: '13px' }}>
            {errorMessage}
          </div>
        )}

        {isVerified && (
          <div className="alert alert--success" style={{ width: '100%', fontSize: '13px' }}>
            TOTP code verified successfully! You can now proceed to finish the enrollment process.
          </div>
        )}
      </div>
    </div>
  );
}