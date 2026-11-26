import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DevLayout } from './pages/dev/DevLayout';
import { devPages } from './pages/dev/devPages';
import { Home } from './pages/Home';
import './App.css';
import Enrollment from './pages/Enrollment';
import Recovery from './pages/Recovery';
import Login from './pages/Login';
import Authorize from './pages/Authorize';
import { ThemeProvider } from './context/ThemeContext';

const DevIndex = lazy(() => import('./pages/dev/DevIndex').then((m) => ({ default: m.DevIndex })));

// Single gate for every dev route: dev server, or an explicit VITE_SHOW_DEV=true build.
const showDev = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV === 'true';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/authorize" element={<Authorize />} />
          <Route path="/t/:slug/login" element={<Login />} />
          <Route path="/t/:slug/authorize" element={<Authorize />} />
          <Route path="/enroll" element={<Enrollment />} />
          <Route path="/recovery" element={<Recovery />} />
          {showDev && (
            // Dev shell: one nav bar, every dev page rendered in its Outlet (no full reloads)
            <Route path="/dev" element={<DevLayout />}>
              <Route index element={<DevIndex />} />
              {devPages.map(({ path, Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
