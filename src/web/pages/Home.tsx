import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';

const showDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true';

export function Home() {
  return (
    <main className="page home">
      <BrandLogo />
      <p className="home__lead">
        Self-hosted, multi-tenant identity provider with passkey-only sign-in.
      </p>
      <p className="home__note">Early development. Nothing here is ready for production use.</p>
      <p>
        <Link to="/enroll">Enroll</Link>
      </p>
      <p>
        <Link to="/recovery">Recover</Link>
      </p>
      {showDev && (
        <p>
          <Link to="/dev">Dev tools</Link>
        </p>
      )}
    </main>
  );
}
