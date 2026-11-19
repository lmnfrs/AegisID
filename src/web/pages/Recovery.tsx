import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RecoveryRestrictedShell from '../components/RecoveryRestrictedShell';
import RecoveryEmailForm from '../components/recovery/RecoveryEmailForm';
import TotpChallengeInput from '../components/recovery/TotpChallengeInput';
import RecoveryPasskeyManager from '../components/recovery/RecoveryPasskeyManager';

type RecoveryStep = 'EMAIL' | 'TOTP' | 'PASSKEY';

export default function Recovery() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<RecoveryStep>('EMAIL');
  const [expiredNotice, setExpiredNotice] = useState(false);

  const handleSessionExpired = useCallback(() => {
    setExpiredNotice(true);
    setCurrentStep('EMAIL');
  }, []);

  const handleFinish = () => {
    navigate('/login', { replace: true });
  };

  return (
    <RecoveryRestrictedShell
      showRestrictedBanner={currentStep === 'PASSKEY'}
      onSessionExpired={handleSessionExpired}
    >
      {expiredNotice && currentStep === 'EMAIL' && (
        <div
          className="alert alert--error"
          style={{ maxWidth: '420px', width: '100%', margin: '0 auto var(--space-4)', fontSize: '13px' }}
        >
            Your recovery session has expired. Please start the recovery process again.
        </div>
      )}

      {currentStep === 'EMAIL' && (
        <RecoveryEmailForm
          onSimulateMailClick={() => {
            setExpiredNotice(false);
            setCurrentStep('TOTP');
          }}
        />
      )}

      {currentStep === 'TOTP' && (
        <TotpChallengeInput onSuccess={() => setCurrentStep('PASSKEY')} />
      )}

      {currentStep === 'PASSKEY' && (
        <RecoveryPasskeyManager onFinish={handleFinish} />
      )}
    </RecoveryRestrictedShell>
  );
}