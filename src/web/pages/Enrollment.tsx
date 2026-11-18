import React, { useState } from 'react';
import EnrollmentWizardShell from '../components/EnrollmentWizardShell';
import MagicLinkVerifier from '../components/enrollment/MagicLinkVerifier';
import PasskeyBindStep from '../components/enrollment/PasskeyBindStep';
import TotpQrBindStep from '../components/enrollment/TotpQrBindStep';

export default function Enrollment() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isNextUnlocked, setIsNextUnlocked] = useState(false);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
      setIsNextUnlocked(false); // Khóa nút Next ở bước tiếp theo cho đến khi hoàn thành
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      setIsNextUnlocked(true); // Nếu quay lại, nút Next luôn mở
    }
  };

  return (
    <EnrollmentWizardShell 
      currentStep={currentStep} 
      onNext={handleNext} 
      onBack={handleBack}
      isNextDisabled={!isNextUnlocked}
    >
      {currentStep === 1 && <MagicLinkVerifier onSuccess={() => setIsNextUnlocked(true)} />}
      {currentStep === 2 && <PasskeyBindStep onSuccess={() => setIsNextUnlocked(true)} />}
      {currentStep === 3 && <TotpQrBindStep onSuccess={() => setIsNextUnlocked(true)} />}
    </EnrollmentWizardShell>
  );
}