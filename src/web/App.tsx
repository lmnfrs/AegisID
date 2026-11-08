import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'

import { DevShowcase } from './pages/DevShowcase';
import { DevEmail } from './pages/DevEmail';

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
      </Routes>
    </BrowserRouter>
  );
}
