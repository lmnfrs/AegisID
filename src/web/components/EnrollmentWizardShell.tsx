import ThemeToggle from './ThemeToggle';
import BrandLogo from './BrandLogo';

interface Props {
  currentStep: number;
  children: React.ReactNode;
  onNext: () => void;
  onBack: () => void;
  isNextDisabled: boolean;
}

export default function EnrollmentWizardShell({ currentStep, children, onNext, onBack, isNextDisabled }: Props) {    
    const steps = [
        "1. Identity Verification",
        "2. Passkey Registration",
        "3. Set up TOTP"
    ];

    return (
        <div className="page" style={{ maxWidth: '700px' }}>
            <header className="top" style={{ gap: 'var(--space-4)' }}>
                <ThemeToggle />
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

                <BrandLogo/>

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
                    {currentStep === 3 ? 'Finish' : 'Next >'}
                </button>
                </div>
            </div>
        </div>
    );
}