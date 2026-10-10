'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_THEME, type Theme } from './shared';

interface Ctx {
  theme: Theme;
  resolved: 'light';
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<Ctx>({ theme: DEFAULT_THEME, resolved: 'light', setTheme: () => {} });

const LS_KEY = 'akaashi-pulse.theme';

function resolveTheme(_t: Theme): 'light' {
  return 'light';
}

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved = resolveTheme(t);
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add('theme-light');
  root.setAttribute('data-theme', resolved);
}

export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [resolved, setResolved] = useState<'light'>('light');

  useEffect(() => {
    try {
      localStorage.removeItem(LS_KEY);
      setThemeState('light');
      setResolved('light');
      applyTheme('light');
    } catch {
      setThemeState('light');
      setResolved('light');
      applyTheme('light');
    }
  }, []);

  const setTheme = useCallback((_t: Theme) => {
    setThemeState('light');
    setResolved('light');
    applyTheme('light');
  }, []);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
