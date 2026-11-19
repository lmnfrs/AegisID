import { useEffect, useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';

interface OtpInput6Props {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  focusSignal?: number;
}

const OTP_LENGTH = 6;

export default function OtpInput6({
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
  focusSignal = 0,
}: OtpInput6Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (focusSignal > 0 && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [focusSignal, disabled]);

  const focusBox = (index: number) => {
    const safeIndex = Math.max(0, Math.min(index, OTP_LENGTH - 1));
    inputRefs.current[safeIndex]?.focus();
  };

  const updateValue = (nextCode: string, nextFocusIndex: number) => {
    onChange(nextCode);
    focusBox(nextFocusIndex);
    if (nextCode.length === OTP_LENGTH) {
      onComplete?.(nextCode);
    }
  };

  // Handle the case when the user types a number or the browser auto-fills 
  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');

    if (onlyDigits.length > 1) {
      const sliced = onlyDigits.slice(0, OTP_LENGTH);
      updateValue(sliced, Math.min(sliced.length, OTP_LENGTH - 1));
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = onlyDigits;
    const nextCode = nextDigits.join('');

    if (onlyDigits) {
      updateValue(nextCode, Math.min(index + 1, OTP_LENGTH - 1));
    } else {
      onChange(nextCode);
    }
  };

  // Handle the case when the user presses Backspace or arrow keys
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        e.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index] = '';
        onChange(nextDigits.join(''));
      } else if (index > 0) {
        e.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        onChange(nextDigits.join(''));
        focusBox(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      focusBox(index + 1);
    }
  };

  // Handle the case when the user pastes a 6-digit string from the Authenticator app
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedDigits = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);

    if (!pastedDigits) return;
    updateValue(pastedDigits, Math.min(pastedDigits.length, OTP_LENGTH - 1));
  };

  return (
    <div
      className="row"
      role="group"
      aria-label="6-digit verification code"
      style={{ gap: 'var(--space-2)', justifyContent: 'center' }}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          aria-invalid={hasError ? 'true' : undefined}
          disabled={disabled}
          className="input"
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          style={{
            width: '44px',
            height: '48px',
            padding: 0,
            textAlign: 'center',
            fontFamily: 'var(--mono)',
            fontSize: '20px',
            fontWeight: 700,
          }}
        />
      ))}
    </div>
  );
}