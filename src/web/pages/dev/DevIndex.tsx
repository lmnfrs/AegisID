import { Link } from 'react-router-dom';
import { Card } from '../../components/ui';
import { devPages } from './devPages';

export function DevIndex() {
  return (
    <div>
      <Card title="Dev pages" desc="Development-only tools. Not available in production builds.">
        <ul>
          {devPages.map((p) => (
            <li key={p.path}>
              <Link to={p.path}>{p.title}</Link> — {p.desc}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
