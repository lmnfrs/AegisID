import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EnrollmentWizardShell from '../components/EnrollmentWizardShell';
import MagicLinkVerifier from '../components/enrollment/MagicLinkVerifier';
import PasskeyBindStep from '../components/enrollment/PasskeyBindStep';
import TotpQrBindStep from '../components/enrollment/TotpQrBindStep';

export default function Enrollment() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isNextUnlocked, setIsNextUnlocked] = useState(false);

  const handleStepSuccess = useCallback(() => {
    setIsNextUnlocked(true);
  }, []);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
      setIsNextUnlocked(false);
    } else {
      navigate('/login', { replace: true, state: { enrollmentSuccess: true } });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      setIsNextUnlocked(true);
    }
  };

  return (
    <EnrollmentWizardShell
      currentStep={currentStep}
      onNext={handleNext}
      onBack={handleBack}
      isNextDisabled={!isNextUnlocked}
    >
      {currentStep === 1 && <MagicLinkVerifier onSuccess={handleStepSuccess} />}
      {currentStep === 2 && <PasskeyBindStep onSuccess={handleStepSuccess} />}
      {currentStep === 3 && <TotpQrBindStep onSuccess={handleStepSuccess} />}
    </EnrollmentWizardShell>
  );
}