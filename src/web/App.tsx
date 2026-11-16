import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DevLayout } from './pages/DevLayout';
import { Home } from './pages/Home';
import './App.css'

// Dev pages are lazy-loaded so their code (and heavy deps such as DataTables)
// lives in separate chunks and never ships in the main bundle.
const DevIndex = lazy(() => import('./pages/DevIndex').then((m) => ({ default: m.DevIndex })));
const DevShowcase = lazy(() => import('./pages/DevShowcase').then((m) => ({ default: m.DevShowcase })));
const DevEmail = lazy(() => import('./pages/DevEmail').then((m) => ({ default: m.DevEmail })));
const DevWebAuthn = lazy(() => import('./pages/DevWebAuthn').then((m) => ({ default: m.DevWebAuthn })));
const DevTenants = lazy(() => import('./pages/DevTenants').then((m) => ({ default: m.DevTenants })));
const DevUsers = lazy(() => import('./pages/DevUsers').then((m) => ({ default: m.DevUsers })));

// Single gate for every dev route: dev server, or an explicit VITE_SHOW_DEV=true build.
const showDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {showDev && (
          // Dev shell: one nav bar, every dev page rendered in its Outlet (no full reloads)
          <Route path="/dev" element={<DevLayout />}>
            <Route index element={<DevIndex />} />
            <Route path="components" element={<DevShowcase />} />
            <Route path="email" element={<DevEmail />} />
            <Route path="webauthn" element={<DevWebAuthn />} />
            <Route path="tenants" element={<DevTenants />} />
            <Route path="users" element={<DevUsers />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
