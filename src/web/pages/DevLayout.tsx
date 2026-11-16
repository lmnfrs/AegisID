import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { devPages } from './devPages';

// Shared shell for every dev page: one persistent nav bar, pages render in <Outlet />.
export function DevLayout() {
  return (
    <>
      <header className="dev-nav">
        <nav aria-label="Dev pages">
          <NavLink to="/dev" end>Dev</NavLink>
          {devPages.map((p) => (
            <NavLink key={p.path} to={p.path}>{p.title}</NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
