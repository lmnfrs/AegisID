import { useEffect, useState } from 'react';
import { Alert, Button, Card, FormField, Input, Spinner } from '../components/ui';
import BrandLogo from '../components/BrandLogo';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const COLOR_TOKENS = [
  '--bg', '--surface', '--fg', '--fg-muted', '--border',
  '--accent', '--accent-fg', '--accent-hover',
  '--danger', '--danger-bg', '--success', '--success-bg',
  '--warning', '--warning-bg', '--info', '--info-bg',
  '--focus',
] as const;

export function DevShowcase() {
  const { isDark } = useTheme();
  const [tokens, setTokens] = useState<{name: string, value: string}[]>([]);

  useEffect(() => {
    // Re-read computed values after the DOM has applied the theme change
    requestAnimationFrame(() => {
      const styles = getComputedStyle(document.documentElement);
      setTokens(
        COLOR_TOKENS.map(name => ({
          name,
          value: styles.getPropertyValue(name).trim(),
        })),
      );
    });
  }, [isDark]);  

  return (
    <div className="page">
      <header className="top" style={{ gap: 'var(--space-4)' }}>
        <BrandLogo />        
        <ThemeToggle />
      </header>

      <section>
        <h2>Tokens</h2>
        <div className="swatches">
          {tokens.map(t => (
            <div className="sw" key={t.name}>
              <i style={{ '--v': `var(${t.name})` } as React.CSSProperties} />
              <code>{t.name}<br/>{t.value}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Button</h2>
        <div className="stack">
          <div>
            <div className="label">Variants</div>
            <div className="row">
              <Button variant="primary">Sign in with passkey</Button>
              <Button variant="secondary">Cancel</Button>
              <Button variant="danger">Revoke passkey</Button>
            </div>
          </div>
          <div>
            <div className="label">States</div>
            <div className="row">
              <Button variant="primary" isLoading>Verifying</Button>
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="secondary" disabled>Disabled</Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Input and FormField</h2>
        <div className="grid">
          <FormField label="Work email" hint="Use the address your organization has on file.">
            {(props) => <Input type="email" placeholder="name@company.com" autoComplete="email" {...props} />}
          </FormField>
          
          <FormField label="Authenticator code" error="Enter all 6 digits.">
            {(props) => <Input inputMode="numeric" defaultValue="12345" {...props} />}
          </FormField>
          
          <FormField label="Tenant">
            {(props) => <Input defaultValue="acme-corp" disabled {...props} />}
          </FormField>
        </div>
      </section>

      <section>
        <h2>Alert</h2>
        <div className="stack">
          <Alert variant="info" title="Check your email">We sent a sign-in link. It expires in 10 minutes.</Alert>
          <Alert variant="success" title="Passkey added">You can now sign in with this device.</Alert>
          <Alert variant="error" title="Link expired or already used">Request a new link to continue.</Alert>
        </div>
      </section>

      <section>
        <h2>Spinner</h2>
        <div className="row">
          <Spinner size="lg" />
          <Spinner />
        </div>
      </section>

      <section>
        <h2>Card (composed: sign in)</h2>
        <Card title="Sign in" desc="Use your passkey to continue to Acme Wiki." className="signin">
          <div className="stack">
            <Alert variant="error">Sign-in failed. Try again or use account recovery.</Alert>
            <FormField label="Work email">
              {(props) => <Input type="email" autoComplete="username webauthn" {...props} />}
            </FormField>
            <Button variant="primary" isBlock>Sign in with passkey</Button>
            <Button variant="secondary" isBlock>Lost your passkey?</Button>
          </div>
        </Card>
      </section>
    </div>
  );
}