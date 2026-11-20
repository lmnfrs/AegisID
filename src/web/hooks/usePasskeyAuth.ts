import { useEffect, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

export type BiometricStatus = 'idle' | 'waiting' | 'verifying_server' | 'success' | 'error';

export type AuthErrorKind =
  | 'cancelled'
  | 'not_activated'
  | 'rate_limited'
  | 'security'
  | 'generic'
  | null;

export interface LoginResult {
  ok: boolean;
  username: string;
}

// FLAG: DEMO FOR TEST. REPLACE THIS MOCK WITH REAL BACKEND API CALLS WHEN READY.
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
      { alg: -7, type: 'public-key' },
      { alg: -257, type: 'public-key' },
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

function createMockAuthenticationOptions(): PublicKeyCredentialRequestOptionsJSON {
  return {
    challenge: randomBase64Url(32),
    rpId: window.location.hostname,
    allowCredentials: [],
    userVerification: 'required',
    timeout: 60000,
  };
}

export function usePasskeyAuth() {
  const [status, setStatus] = useState<BiometricStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<AuthErrorKind>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;

    const timerId = window.setInterval(() => {
      setRetryAfterSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [retryAfterSeconds]);

  const resetStatus = () => {
    setStatus('idle');
    setErrorMessage(null);
    setErrorKind(null);
  };

  const registerNewPasskey = async (nickname: string) => {
    try {
      setStatus('waiting');
      setErrorMessage(null);
      setErrorKind(null);

      let optionsJSON: PublicKeyCredentialCreationOptionsJSON;
      let challengeId: string | undefined;

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
        const data = (await optionsRes.json()) as {
          challengeId?: string;
          options?: PublicKeyCredentialCreationOptionsJSON;
        } & Partial<PublicKeyCredentialCreationOptionsJSON>;
        challengeId = data.challengeId;
        optionsJSON = data.options ?? (data as PublicKeyCredentialCreationOptionsJSON);
      }

      const attestationResponse = await startRegistration({ optionsJSON });

      setStatus('verifying_server');

      if (USE_MOCK_WEBAUTHN) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        const verifyRes = await fetch('/t/demo/api/auth/register/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            challengeId,
            response: attestationResponse,
            nickname,
          }),
        });
        if (!verifyRes.ok) {
          throw new Error('Backend did not accept the attestation response. Please try again.');
        }
      }

      setStatus('success');
      return true;
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setErrorKind('cancelled');
          setErrorMessage('You cancelled the Passkey registration or your device does not support it.');
        } else if (err.name === 'InvalidStateError') {
          setErrorKind('generic');
          setErrorMessage('This device already has a registered Passkey.');
        } else if (err.name === 'SecurityError') {
          setErrorKind('security');
          setErrorMessage('Security error: domain name is not valid.');
        } else {
          setErrorKind('generic');
          setErrorMessage('WebAuthn error: ' + err.message);
        }
      } else {
        setErrorKind('generic');
        setErrorMessage('Cannot register Passkey. Please try again.');
      }
      return false;
    }
  };

  const loginWithPasskey = async (usernameOrEmail?: string): Promise<LoginResult | null> => {
    const trimmedUsername = usernameOrEmail?.trim();

    if (retryAfterSeconds > 0) {
      return null;
    }

    try {
      setStatus('waiting');
      setErrorMessage(null);
      setErrorKind(null);

      let optionsJSON: PublicKeyCredentialRequestOptionsJSON;
      let challengeId: string | undefined;

      if (USE_MOCK_WEBAUTHN) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        optionsJSON = createMockAuthenticationOptions();
      } else {
        const optionsRes = await fetch('/t/demo/api/auth/login/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            username: trimmedUsername || undefined,
          }),
        });

        if (optionsRes.status === 429) {
          const retryHeader = Number(optionsRes.headers.get('Retry-After') ?? '30');
          const waitSec = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : 30;
          setRetryAfterSeconds(waitSec);
          setStatus('error');
          setErrorKind('rate_limited');
          setErrorMessage(`Too many sign-in attempts. Please wait ${waitSec} seconds before retrying.`);
          return null;
        }

        if (optionsRes.status === 403) {
          const body = (await optionsRes.json().catch(() => null)) as { code?: string; error?: string } | null;
          if (body?.code === 'PENDING_ENROLLMENT') {
            setStatus('error');
            setErrorKind('not_activated');
            setErrorMessage(
              'Your account has not been activated yet. Please check your email for the first-time enrollment link.',
            );
            return null;
          }
        }

        if (!optionsRes.ok) {
          throw new Error('Failed to fetch sign-in options from server.');
        }

        const data = (await optionsRes.json()) as {
          challengeId?: string;
          options?: PublicKeyCredentialRequestOptionsJSON;
        } & Partial<PublicKeyCredentialRequestOptionsJSON>;
        challengeId = data.challengeId;
        optionsJSON = data.options ?? (data as PublicKeyCredentialRequestOptionsJSON);
      }

      const assertionResponse = await startAuthentication({ optionsJSON });

      setStatus('verifying_server');

      if (USE_MOCK_WEBAUTHN) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        setStatus('success');
        return {
          ok: true,
          username: trimmedUsername || 'Silverhand1234@gmail.com',
        };
      }

      const verifyRes = await fetch('/t/demo/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          challengeId,
          response: assertionResponse,
        }),
      });

      if (!verifyRes.ok) {
        throw new Error('Passkey verification failed. Please try again.');
      }

      const verified = (await verifyRes.json()) as { ok: boolean; username?: string };
      setStatus('success');
      return {
        ok: true,
        username: verified.username || trimmedUsername || 'user',
      };
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setErrorKind('cancelled');
          setErrorMessage(
            'Device verification was cancelled or timed out. Click Retry and complete verification on your device.',
          );
          return null;
        }
        if (err.name === 'SecurityError') {
          setErrorKind('security');
          setErrorMessage('Security error: Origin or RP ID mismatch.');
          return null;
        }
        setErrorKind('generic');
        setErrorMessage('WebAuthn error: ' + err.message);
        return null;
      }

      setErrorKind('generic');
      setErrorMessage('Unable to verify your Passkey. Please try again.');
      return null;
    }
  };

  return {
    status,
    errorMessage,
    errorKind,
    retryAfterSeconds,
    registerNewPasskey,
    loginWithPasskey,
    resetStatus,
  };
}