import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { FormField } from '../components/ui/FormField';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import LogoLight from '../assets/LogoLight.png';
import LogoDark from '../assets/LogoDark.png';

export function DevShowcase() {
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [tokens, setTokens] = useState<{name: string, value: string}[]>([]);
  
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      let activeIsDark = false;

      if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
        activeIsDark = true;
      } else if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
        activeIsDark = false;
      } else {
        root.removeAttribute('data-theme');
        activeIsDark = mediaQuery.matches;
      }

      setIsDark(activeIsDark);

      const names = ['--bg','--surface','--fg','--fg-muted','--border','--accent','--danger','--success','--info'];
      const cs = getComputedStyle(root);
      setTokens(names.map(n => ({ name: n, value: cs.getPropertyValue(n).trim() })));
    };

    updateTheme();

    const handleChange = () => {
      if (theme === 'auto') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <main className="page">
      <header className="top" style={{ gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>    
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center' }}>
            <img 
              src={isDark ? LogoDark : LogoLight} 
              alt="AegisID Logo" 
              style={{ height: '36px', objectFit: 'contain' }} 
            />
          </div>
        
        </div>
        
        <div className="theme" role="group" aria-label="Theme preview">
          {(['auto', 'light', 'dark'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTheme(t)} aria-pressed={theme === t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
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
    </main>
  );
}