import { useParams } from 'react-router-dom';
import AuthCardShell from '../components/AuthCardShell';
import PasskeyLoginCard from '../components/auth/PasskeyLoginCard';

export default function Login() {
  const { slug } = useParams();

  return (
    <AuthCardShell
      title="Sign in with Passkey"
      subtitle="Passwordless sign-in using your device biometrics or security key."
      tenantSlug={slug}
    >
      <PasskeyLoginCard />
    </AuthCardShell>
  );
}