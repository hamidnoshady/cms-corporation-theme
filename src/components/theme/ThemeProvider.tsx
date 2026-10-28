'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
export type ThemePref = 'light' | 'dark' | 'system';
type Context = { theme: ThemePref; setTheme: (value: ThemePref) => void };
const ThemeContext = createContext<Context | null>(null);
const subscribe = (callback: () => void) => {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
};
export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemePref;
  children: React.ReactNode;
}) {
  const [theme, updateTheme] = useState(initialTheme);
  const systemDark = useSyncExternalStore(
    subscribe,
    () => matchMedia('(prefers-color-scheme: dark)').matches,
    () => false,
  );
  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && systemDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [theme, systemDark]);
  function setTheme(value: ThemePref) {
    updateTheme(value);
    document.cookie = `apex-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('Missing ThemeProvider');
  return context;
}
