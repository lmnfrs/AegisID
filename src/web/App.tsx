import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'

// Dev pages are lazy-loaded so their code (and heavy deps such as DataTables)
// lives in separate chunks and never ships in the main bundle.
const DevIndex = lazy(() => import('./pages/DevIndex').then((m) => ({ default: m.DevIndex })));
const DevShowcase = lazy(() => import('./pages/DevShowcase').then((m) => ({ default: m.DevShowcase })));
const DevEmail = lazy(() => import('./pages/DevEmail').then((m) => ({ default: m.DevEmail })));
const DevWebAuthn = lazy(() => import('./pages/DevWebAuthn').then((m) => ({ default: m.DevWebAuthn })));
const DevTenants = lazy(() => import('./pages/DevTenants').then((m) => ({ default: m.DevTenants })));
const DevUsers = lazy(() => import('./pages/DevUsers').then((m) => ({ default: m.DevUsers })));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true') && (
            // Dev-only index linking to all dev pages
            <Route path="/dev" element={<DevIndex />} />
          )}
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true') && (
            // Dev-only showcase of UI components
            <Route path="/dev/components" element={<DevShowcase />} />
          )}
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true') && (
            // Dev-only email test page
            <Route path="/dev/email" element={<DevEmail />} />
          )}
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true') && (
            // Dev-only passkey register / sign-in test page
            <Route path="/dev/webauthn" element={<DevWebAuthn />} />
          )}
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true') && (
            // Dev-only tenant list and create page
            <Route path="/dev/tenants" element={<DevTenants />} />
          )}
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true') && (
            // Dev-only user list per tenant
            <Route path="/dev/users" element={<DevUsers />} />
          )}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
