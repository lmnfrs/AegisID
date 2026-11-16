import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';

const pages = [
  { path: '/dev/components', title: 'Components', desc: 'UI component showcase.' },
  { path: '/dev/tenants', title: 'Tenants', desc: 'List and create tenants.' },
  { path: '/dev/webauthn', title: 'Passkey test', desc: 'Register and sign in with a passkey.' },
  { path: '/dev/email', title: 'Email test', desc: 'Send a test email.' },
];

export function DevIndex() {
  return (
    <main>
      <Card title="Dev pages" desc="Development-only tools. Not available in production builds.">
        <ul>
          {pages.map((p) => (
            <li key={p.path}>
              <Link to={p.path}>{p.title}</Link> — {p.desc}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
