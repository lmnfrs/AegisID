import React, { useEffect, useState } from 'react';
import LogoLight from '../assets/LogoLight.png';
import LogoDark from '../assets/LogoDark.png';

interface Props {
  currentStep: number;
  children: React.ReactNode;
  onNext: () => void;
  onBack: () => void;
  isNextDisabled: boolean;
}

export default function EnrollmentWizardShell({ currentStep, children, onNext, onBack, isNextDisabled }: Props) {
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

    const steps = [
        "1. Identity Verification",
        "2. Passkey Registration",
        "3. Set up TOTP"
    ];

    return (
        <div className="page" style={{ maxWidth: '700px' }}>
            <header className="top" style={{ gap: 'var(--space-4)' }}>
                <div className="theme" role="group" aria-label="Theme preview">
                {(['auto', 'light', 'dark'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTheme(t)} aria-pressed={theme === t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
                </div>
            </header>
            
            <div className="card stack" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>                
                {/* Progress Bar */}
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
                {steps.map((label, index) => {
                    const stepNum = index + 1;
                    const isActive = currentStep === stepNum;
                    const isPassed = currentStep > stepNum;
                    
                    return (
                    <div 
                        key={stepNum} 
                        style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius)',
                        background: isActive || isPassed ? 'var(--accent)' : 'var(--bg)',
                        color: isActive || isPassed ? 'var(--accent-fg)' : 'var(--fg-muted)',
                        fontSize: '13px',
                        fontWeight: 600,
                        margin: '0 var(--space-1)'
                        }}
                    >
                        {label}
                    </div>
                    );
                })}
                </div>

                <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                <img 
                    src={isDark ? LogoDark : LogoLight} 
                    alt="AegisID Logo" 
                    style={{ height: '36px', objectFit: 'contain' }} 
                    />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {children}
                </div>

                <div className="row" style={{ justifyContent: 'space-between', marginTop: 'var(--space-8)' }}>
                <button 
                    className="btn" 
                    onClick={onBack} 
                    disabled={currentStep === 1}
                >
                    &lt; Back
                </button>
                
                <button 
                    className="btn btn--primary" 
                    onClick={onNext} 
                    disabled={isNextDisabled}
                >
                    Next &gt;
                </button>
                </div>
            </div>
        </div>
    );
}