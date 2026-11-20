import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = 'aegisid-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'auto' || saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Skip if localStorage is not accessible (e.g., in private mode)
  }
  return 'auto';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [isDark, setIsDark] = useState<boolean>(false);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Skip if localStorage is not accessible (e.g., in private mode)
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
        setIsDark(true);
      } else if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
        setIsDark(false);
      } else {
        root.removeAttribute('data-theme');
        setIsDark(mediaQuery.matches);
      }
    };

    applyTheme();

    const handleSystemChange = () => {
      if (theme === 'auto') applyTheme();
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside a <ThemeProvider>');
  }
  return ctx;
}