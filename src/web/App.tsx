import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'

import { DevShowcase } from './pages/DevShowcase';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true') && (
           // Dev-only showcase of UI components
          <Route path="/dev/components" element={<DevShowcase />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
