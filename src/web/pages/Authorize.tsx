import { useParams } from 'react-router-dom';
import AuthCardShell from '../components/AuthCardShell';
import OidcConsentBanner from '../components/auth/OidcConsentBanner';

export default function Authorize() {
  const { slug } = useParams();

  return (
    <AuthCardShell
      title="Authorize Application"
      subtitle="Review the permissions requested before continuing."
      tenantSlug={slug}
    >
      <OidcConsentBanner />
    </AuthCardShell>
  );
}