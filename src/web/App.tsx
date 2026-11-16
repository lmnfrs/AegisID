import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'

import { DevShowcase } from './pages/DevShowcase';
import { DevEmail } from './pages/DevEmail';
import { DevWebAuthn } from './pages/DevWebAuthn';
import { DevTenants } from './pages/DevTenants';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
      </Routes>
    </BrowserRouter>
  );
}
