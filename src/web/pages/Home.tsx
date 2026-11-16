import { Link } from 'react-router-dom';
import LogoLight from '../assets/LogoLight.png';
import LogoDark from '../assets/LogoDark.png';

const showDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true';

export function Home() {
  return (
    <main className="page home">
      <picture>
        <source srcSet={LogoDark} media="(prefers-color-scheme: dark)" />
        <img src={LogoLight} alt="AegisID" className="home__logo" />
      </picture>
      <h1>AegisID</h1>
      <p className="home__lead">
        Self-hosted, multi-tenant identity provider with passkey-only sign-in.
      </p>
      <p className="home__note">Early development. Nothing here is ready for production use.</p>
      {showDev && (
        <p>
          <Link to="/dev">Dev tools</Link>
        </p>
      )}
    </main>
  );
}
