import { useTheme } from '../context/ThemeContext';
import type { ThemeMode } from '../context/ThemeContext';

const MODES: ThemeMode[] = ['auto', 'light', 'dark'];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme" role="group" aria-label="Theme switcher">
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setTheme(mode)}
          aria-pressed={theme === mode}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );
}