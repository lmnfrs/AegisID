import type { ReactNode } from 'react';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';

interface AuthCardShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  tenantSlug?: string;
}

export default function AuthCardShell({
  children,
  title,
  subtitle,
  tenantSlug,
}: AuthCardShellProps) {
  const originHost = typeof window !== 'undefined' ? window.location.host : 'idp.example.local';
  const originDisplay = tenantSlug ? `${originHost}/t/${tenantSlug}` : originHost;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="page"
        style={{
          maxWidth: '460px',
          width: '100%',
          margin: '0 auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingTop: 'var(--space-6)',
          paddingBottom: 'var(--space-8)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 'var(--space-4)',
          }}
        >
          <ThemeToggle />
        </div>

        <div
          className="card stack"
          style={{
            maxWidth: '420px',
            width: '100%',
            margin: '0 auto',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* Origin Trust Badge */}
          <div
            aria-label="Verified identity provider origin"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'var(--info-bg)',
              borderBottom: '1px solid var(--border)',
              color: 'var(--info)',
              fontSize: '12px',
              fontFamily: 'var(--mono)',
              fontWeight: 600,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>{originDisplay}</span>
          </div>

          <div className="stack" style={{ padding: 'var(--space-6)' }}>
            <div style={{ textAlign: 'center' }}>
              <BrandLogo height={38} />
              {title && (
                <h2 style={{ fontSize: '20px', marginTop: 'var(--space-3)' }}>
                  {title}
                </h2>
              )}
              {subtitle && (
                <p
                  style={{
                    color: 'var(--fg-muted)',
                    fontSize: '14px',
                    margin: 'var(--space-1) 0 0',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}