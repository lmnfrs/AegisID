import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Spinner } from '../ui';

const showDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true';

const SSO_SESSION_KEY = 'aegis_demo_sso_user';
const PENDING_AUTHORIZE_KEY = 'aegis_pending_authorize_query';

type AuthorizeState = 'checking_session' | 'consent' | 'approving' | 'approved' | 'denied';

interface ScopeDescriptor {
  id: string;
  label: string;
  description: string;
}

const SCOPE_MAP: Record<string, ScopeDescriptor> = {
  openid: {
    id: 'openid',
    label: 'Identity Verification (openid)',
    description: 'Verify your unique account identifier across this organization.',
  },
  profile: {
    id: 'profile',
    label: 'Basic Profile (profile)',
    description: 'Access your display name and assigned organization role.',
  },
  email: {
    id: 'email',
    label: 'Email Address (email)',
    description: 'View the verified email address associated with your account.',
  },
};

function parseScopes(rawScope: string): ScopeDescriptor[] {
  const tokens = rawScope
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(tokens.length > 0 ? tokens : ['openid', 'profile', 'email']));

  return unique.map(
    (scope) =>
      SCOPE_MAP[scope] ?? {
        id: scope,
        label: scope,
        description: `Access requested scope "${scope}".`,
      },
  );
}

function generateMockAuthCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function OidcConsentBanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const hasExplicitOidcQuery = searchParams.has('client_id');
  const clientId = searchParams.get('client_id') || 'sample-rp-web';
  const appName = searchParams.get('app_name') || (clientId === 'sample-rp-web' ? 'Sample App RP' : clientId);
  const redirectUri = searchParams.get('redirect_uri') || 'http://localhost:5174/callback';
  const stateParam = searchParams.get('state') || 'demo_state_token';
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256';
  const requestedScopes = parseScopes(searchParams.get('scope') || 'openid profile email');

  const [viewState, setViewState] = useState<AuthorizeState>('checking_session');
  const [signedInUser, setSignedInUser] = useState<string>('Silverhand1234@gmail.com');
  const [redirectPreviewUrl, setRedirectPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const existingUser = sessionStorage.getItem(SSO_SESSION_KEY);

      // If an RP sent real OIDC params and the user has no SSO session, save query & redirect to /login
      if (!existingUser && hasExplicitOidcQuery) {
        const queryString = searchParams.toString();
        sessionStorage.setItem(PENDING_AUTHORIZE_KEY, queryString ? `?${queryString}` : '');
        navigate('/login', { replace: true, state: { returnToAuthorize: true } });
        return;
      }

      if (existingUser) {
        setSignedInUser(existingUser);
      }
      setViewState('consent');
    }, 650);

    return () => window.clearTimeout(timerId);
  }, [hasExplicitOidcQuery, navigate, searchParams]);

  const handleApprove = () => {
    setViewState('approving');

    window.setTimeout(() => {
      const code = generateMockAuthCode();
      try {
        const target = new URL(redirectUri);
        target.searchParams.set('code', code);
        if (stateParam) target.searchParams.set('state', stateParam);
        setRedirectPreviewUrl(target.toString());
      } catch {
        setRedirectPreviewUrl(`${redirectUri}?code=${code}&state=${encodeURIComponent(stateParam)}`);
      }
      setViewState('approved');
    }, 500);
  };

  const handleDeny = () => {
    try {
      const target = new URL(redirectUri);
      target.searchParams.set('error', 'access_denied');
      if (stateParam) target.searchParams.set('state', stateParam);
      setRedirectPreviewUrl(target.toString());
    } catch {
      setRedirectPreviewUrl(`${redirectUri}?error=access_denied`);
    }
    setViewState('denied');
  };

  const handleSwitchAccount = () => {
    sessionStorage.removeItem(SSO_SESSION_KEY);
    const queryString = searchParams.toString();
    if (queryString) {
      sessionStorage.setItem(PENDING_AUTHORIZE_KEY, `?${queryString}`);
    }
    navigate('/login', { replace: true, state: { returnToAuthorize: true } });
  };

  if (viewState === 'checking_session') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="stack"
        style={{ alignItems: 'center', textAlign: 'center', padding: 'var(--space-6) 0' }}
      >
        <Spinner size="lg" />
        <div>
          <div style={{ fontWeight: 600 }}>Checking active SSO session...</div>
          <div style={{ fontSize: '13px', color: 'var(--fg-muted)', marginTop: 'var(--space-1)' }}>
            Verifying your identity before redirecting to {appName}.
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'approved') {
    return (
      <div className="stack">
        <Alert variant="success" title="Authorization approved">
          Authorization code issued for <b>{appName}</b>.
        </Alert>

        <div
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            fontSize: '12px',
            fontFamily: 'var(--mono)',
            wordBreak: 'break-all',
            color: 'var(--fg-muted)',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: 'var(--space-1)' }}>
            Redirect target:
          </div>
          {redirectPreviewUrl}
        </div>

        <Button
          type="button"
          variant="primary"
          isBlock
          onClick={() => {
            if (redirectPreviewUrl) {
              window.location.assign(redirectPreviewUrl);
            }
          }}
        >
          Continue to {appName}
        </Button>

        <Button type="button" variant="secondary" isBlock onClick={() => setViewState('consent')}>
          Back to consent screen
        </Button>
      </div>
    );
  }

  if (viewState === 'denied') {
    return (
      <div className="stack">
        <Alert variant="warning" title="Authorization cancelled">
          You chose not to share your account information with <b>{appName}</b>. No authorization code was issued.
        </Alert>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Button type="button" variant="secondary" isBlock onClick={() => setViewState('consent')}>
            Review request again
          </Button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '14px' }}>
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Return to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {/* RpAppIdentityHeader */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          AegisID
        </div>
        <span aria-hidden="true" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '18px' }}>
          →
        </span>
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius)',
            background: 'var(--accent)',
            color: 'var(--btn-f)',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {appName}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: '17px' }}>{appName} wants to access your account</h3>
        <p style={{ color: 'var(--fg-muted)', fontSize: '13px', margin: 'var(--space-1) 0 0' }}>
          Signed in as <strong style={{ color: 'var(--fg)' }}>{signedInUser}</strong>
        </p>
      </div>

      {/* RequestedScopeList */}
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--bg)',
          padding: 'var(--space-4)',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--fg-muted)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Permissions requested
        </div>

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          {requestedScopes.map((scope) => (
            <li
              key={scope.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                textAlign: 'left',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--info-bg)',
                  color: 'var(--info)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                ✓
              </span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{scope.label}</div>
                <div style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>{scope.description}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          fontSize: '12px',
          color: 'var(--fg-muted)',
          textAlign: 'center',
          wordBreak: 'break-all',
        }}
      >
        You will be redirected to <code style={{ fontFamily: 'var(--mono)' }}>{redirectUri}</code>
        {codeChallenge ? ` (PKCE ${codeChallengeMethod})` : ''}.
      </div>

      {/* ApproveRedirectBtn */}
      <div className="stack" style={{ gap: 'var(--space-2)' }}>
        <Button
          type="button"
          variant="primary"
          isBlock
          isLoading={viewState === 'approving'}
          onClick={handleApprove}
        >
          {viewState === 'approving' ? 'Redirecting...' : 'Allow'}
        </Button>

        <Button
          type="button"
          variant="secondary"
          isBlock
          disabled={viewState === 'approving'}
          onClick={handleDeny}
        >
          Cancel
        </Button>
      </div>

      <div style={{ textAlign: 'center', fontSize: '13px' }}>
        <button
          type="button"
          onClick={handleSwitchAccount}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            padding: 0,
          }}
        >
          Use a different account
        </button>
      </div>

      {showDev && (
        <div
          style={{
            borderTop: '1px dashed var(--border)',
            paddingTop: 'var(--space-3)',
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <button
            type="button"
            className="btn"
            style={{ minHeight: '28px', padding: '0 8px', fontSize: '12px' }}
            onClick={() => setViewState('checking_session')}
          >
            [Dev] Replay Silent Check
          </button>
        </div>
      )}
    </div>
  );
}