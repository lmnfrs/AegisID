import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';

export type BiometricStatus = 'idle' | 'waiting' | 'verifying_server' | 'success' | 'error';

// FLAG: DEMO FOR TEST. REPLACE THIS MOCK WITH REAL BACKEND API CALL TO VERIFY TOKEN ----------------------------------------
const USE_MOCK_WEBAUTHN = true;

function randomBase64Url(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createMockRegistrationOptions(): PublicKeyCredentialCreationOptionsJSON {
  return {
    challenge: randomBase64Url(32),
    rp: {
      name: 'AegisID (Demo)',
      id: window.location.hostname,
    },
    user: {
      id: randomBase64Url(16),
      name: 'Silverhand1234@gmail.com',
      displayName: 'Tiana Philips',
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    timeout: 60000,
    attestation: 'none',
    excludeCredentials: [],
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required', 
    },
  };
}

export function usePasskeyAuth() {
  const [status, setStatus] = useState<BiometricStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const registerNewPasskey = async (nickname: string) => {
    try {
      setStatus('waiting');
      setErrorMessage(null);

      // Get registration options from the server
      let optionsJSON: PublicKeyCredentialCreationOptionsJSON;

      if (USE_MOCK_WEBAUTHN) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        optionsJSON = createMockRegistrationOptions();
      } else {
        const optionsRes = await fetch('/t/demo/api/auth/register/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            username: 'Silverhand1234@gmail.com',
            displayName: 'Tiana Philips',
          }),
        });
        if (!optionsRes.ok) throw new Error('Failed to fetch registration options from server');
        optionsJSON = (await optionsRes.json()) as PublicKeyCredentialCreationOptionsJSON;
      }

      // Call the WebAuthn API to create a new credential
      const attestationResponse = await startRegistration({ optionsJSON });

      // Send the attestation response to the server for verification
      setStatus('verifying_server');

      if (USE_MOCK_WEBAUTHN) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        const verifyRes = await fetch('/t/demo/api/auth/register/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            ...attestationResponse,
            username: 'Silverhand1234@gmail.com',
            nickname,
          }),
        });
        if (!verifyRes.ok) throw new Error('Backend did not accept the attestation response. Please try again.');
      }

      setStatus('success');
      return true;
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setErrorMessage('You cancelled the Passkey registration or your device does not support it.');
        } else if (err.name === 'InvalidStateError') {
          setErrorMessage('This device already has a registered Passkey.');
        } else if (err.name === 'SecurityError') {
          setErrorMessage('Security error: domain name is not valid.');
        } else {
          setErrorMessage('WebAuthn error: ' + err.message);
        }
      } else {
        setErrorMessage('Cannot register Passkey. Please try again.');
      }
      return false;
    }
  };

  return { status, errorMessage, registerNewPasskey };
}