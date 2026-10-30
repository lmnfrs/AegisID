import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react'
import './App.css'

import { DevShowcase } from './pages/DevShowcase';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {import.meta.env.DEV && (
           // 3. Thay <div> bằng Component <DevShowcase />
          <Route path="/dev/components" element={<DevShowcase />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
