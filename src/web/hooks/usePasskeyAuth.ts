import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export type BiometricStatus = 'idle' | 'waiting' | 'verifying_server' | 'success' | 'error';

export function usePasskeyAuth() {
  const [status, setStatus] = useState<BiometricStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const registerNewPasskey = async (nickname: string) => {
    try {
      setStatus('waiting');
      setErrorMessage(null);

      // CF with BE for the exact API endpoint (e.g., /api/v1/enroll/options) + the slug later
      const optionsRes = await fetch('/t/:slug/api/auth/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          username: "Silverhand1234@gmail.com", // Demo user
          displayName: "Tiana Philips"
        }) 
      });

      if (!optionsRes.ok) throw new Error('Failed to fetch registration options from server');
      
      const optionsJSON = await optionsRes.json();
      const attestationResponse = await startRegistration({ optionsJSON });

      setStatus('verifying_server');
      const verifyRes = await fetch('/t/:slug/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...attestationResponse,
          username: "Silverhand1234@gmail.com", // Demo user
          nickname
        })
      });
      
      if (!verifyRes.ok) throw new Error('Passkey registration failed on server');

      setStatus('success');
      return true;
      
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setErrorMessage('You cancelled the operation or it timed out.');
        } else if (err.name === 'InvalidStateError') {
          setErrorMessage('This device already has a registered passkey.');
        } else {
          setErrorMessage('WebAuthn error: ' + err.message);
        }
      }
      return false;
    }
  };

  // Trả về state và hàm để Component sử dụng
  return { status, errorMessage, registerNewPasskey };
}