import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, FormField, Input } from '../ui';
import { usePasskeyAuth } from '../../hooks/usePasskeyAuth';
import type { AuthErrorKind } from '../../hooks/usePasskeyAuth';
import BiometricWaitingBox from './BiometricWaitingBox';

const showDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true';

const SSO_SESSION_KEY = 'aegis_demo_sso_user';
const PENDING_AUTHORIZE_KEY = 'aegis_pending_authorize_query';

interface LoginLocationState {
  enrollmentSuccess?: boolean;
  recoverySuccess?: boolean;
  returnToAuthorize?: boolean;
}

export default function PasskeyLoginCard() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as LoginLocationState | null) ?? null;

  const {
    status,
    errorMessage,
    errorKind,
    retryAfterSeconds,
    loginWithPasskey,
    resetStatus,
  } = usePasskeyAuth();

  const [username, setUsername] = useState('');
  const [devErrorOverride, setDevErrorOverride] = useState<{
    kind: AuthErrorKind;
    message: string;
  } | null>(null);
  const [devCooldown, setDevCooldown] = useState(0);

  useEffect(() => {
    if (devCooldown <= 0) return;
    const timerId = window.setInterval(() => {
      setDevCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [devCooldown]);

  const activeCooldown = Math.max(retryAfterSeconds, devCooldown);
  const activeErrorKind = devErrorOverride?.kind ?? errorKind;
  const activeErrorMessage = devErrorOverride?.message ?? errorMessage;
  const isWaiting = status === 'waiting' || status === 'verifying_server';

  const completeLoginRedirect = (signedInUser: string) => {
    sessionStorage.setItem(SSO_SESSION_KEY, signedInUser);

    const pendingAuthorizeQuery = sessionStorage.getItem(PENDING_AUTHORIZE_KEY);
    if (pendingAuthorizeQuery) {
      sessionStorage.removeItem(PENDING_AUTHORIZE_KEY);
      navigate(`/authorize${pendingAuthorizeQuery}`, { replace: true });
      return;
    }

    navigate('/authorize', { replace: true });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDevErrorOverride(null);

    const result = await loginWithPasskey(username);
    if (result?.ok) {
      completeLoginRedirect(result.username);
    }
  };

  const isWebAuthnSupported =
    typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';

  return (
    <div className="stack">
      {!isWebAuthnSupported && (
        <Alert variant="error" title="Browser not supported">
          This browser does not support WebAuthn Passkeys, or the page is not served over HTTPS / localhost.
        </Alert>
      )}

      {locationState?.enrollmentSuccess && (
        <Alert variant="success" title="Account activated">
          Your Passkey and TOTP recovery setup is complete. Sign in with your new Passkey below.
        </Alert>
      )}

      {locationState?.recoverySuccess && (
        <Alert variant="success" title="Recovery complete">
          Your recovery session has closed. Sign in again using your newly registered Passkey.
        </Alert>
      )}

      {locationState?.returnToAuthorize && (
        <Alert variant="info" title="Sign-in required">
          Authenticate with your Passkey to continue authorizing the requesting application.
        </Alert>
      )}

      {activeErrorMessage && activeErrorKind === 'cancelled' && (
        <Alert variant="warning" title="Verification cancelled">
          {activeErrorMessage}
        </Alert>
      )}

      {activeErrorMessage && activeErrorKind === 'not_activated' && (
        <Alert variant="warning" title="Account not activated">
          {activeErrorMessage}
        </Alert>
      )}

      {activeErrorMessage && activeErrorKind === 'rate_limited' && (
        <Alert variant="error" title="Too many requests">
          {activeCooldown > 0
            ? `Too many sign-in attempts. Please wait ${activeCooldown}s before trying again.`
            : activeErrorMessage}
        </Alert>
      )}

      {activeErrorMessage &&
        activeErrorKind !== 'cancelled' &&
        activeErrorKind !== 'not_activated' &&
        activeErrorKind !== 'rate_limited' && (
          <Alert variant="error" title="Sign-in failed">
            {activeErrorMessage}
          </Alert>
        )}

      <form onSubmit={handleSubmit} className="stack">
        <FormField
          label="Username or Email"
          hint="Optional if your browser suggests a saved Passkey."
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="text"
              placeholder="you@organization.com"
              autoComplete="username webauthn"
              value={username}
              disabled={isWaiting || !isWebAuthnSupported}
              onChange={(e) => {
                setUsername(e.target.value);
                if (status === 'error' || devErrorOverride) {
                  resetStatus();
                  setDevErrorOverride(null);
                }
              }}
            />
          )}
        </FormField>

        {isWaiting ? (
          <BiometricWaitingBox phase={status} />
        ) : (
          <Button
            type="submit"
            variant="primary"
            isBlock
            disabled={!isWebAuthnSupported || activeCooldown > 0}
          >
            {activeCooldown > 0
              ? `Please try again in ${activeCooldown}s`
              : activeErrorKind === 'cancelled'
                ? 'Retry with Passkey'
                : 'Continue with Passkey'}
          </Button>
        )}
      </form>

      {/* RecoveryLinkFooter */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 'var(--space-4)',
          textAlign: 'center',
          fontSize: '14px',
          color: 'var(--fg-muted)',
        }}
      >
        <span>Can&apos;t sign in? </span>
        <Link to="/recovery" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          Recover your account
        </Link>
      </div>

      {/* Dev-only state tester (matches teammate's pattern in RecoveryEmailForm) */}
      {showDev && (
        <div
          style={{
            borderTop: '1px dashed var(--border)',
            paddingTop: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            fontSize: '12px',
            color: 'var(--fg-muted)',
          }}
        >
          <span style={{ fontWeight: 600 }}>[Dev Only] Simulate states:</span>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn"
              style={{ minHeight: '28px', padding: '0 8px', fontSize: '12px' }}
              onClick={() => completeLoginRedirect(username.trim() || 'Silverhand1234@gmail.com')}
            >
              Simulate SSO Login
            </button>
            <button
              type="button"
              className="btn"
              style={{ minHeight: '28px', padding: '0 8px', fontSize: '12px' }}
              onClick={() =>
                setDevErrorOverride({
                  kind: 'cancelled',
                  message:
                    'Device verification was cancelled or timed out. Click Retry and complete verification on your device.',
                })
              }
            >
              NotAllowedError
            </button>
            <button
              type="button"
              className="btn"
              style={{ minHeight: '28px', padding: '0 8px', fontSize: '12px' }}
              onClick={() =>
                setDevErrorOverride({
                  kind: 'not_activated',
                  message:
                    'Your account has not been activated yet. Please check your email for the first-time enrollment link.',
                })
              }
            >
              Not Activated
            </button>
            <button
              type="button"
              className="btn"
              style={{ minHeight: '28px', padding: '0 8px', fontSize: '12px' }}
              onClick={() => {
                setDevCooldown(15);
                setDevErrorOverride({
                  kind: 'rate_limited',
                  message: 'Too many sign-in attempts. Please wait before retrying.',
                });
              }}
            >
              429 Limit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}