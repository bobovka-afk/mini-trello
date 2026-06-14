import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { applyPixelThemeToDocument, type AppThemeMode } from './pixelThemeTokens';

const THEME_KEY = 'questflow_theme';
const THEME_KEY_LEGACY = 'mini_trello_theme';
const THEME_CHANGE_EVENT = 'questflow-theme-change';

function notifyThemeChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

function subscribeTheme(onStoreChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
}

function readIsDarkFromDocument(): boolean {
  return document.documentElement.classList.contains('theme-dark');
}

/** Subscribes to theme toggles anywhere in the app (reads `theme-dark` on `<html>`). */
export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribeTheme, readIsDarkFromDocument, () => false);
}

function migrateLegacyThemeKey() {
  try {
    if (!localStorage.getItem(THEME_KEY) && localStorage.getItem(THEME_KEY_LEGACY)) {
      localStorage.setItem(THEME_KEY, localStorage.getItem(THEME_KEY_LEGACY)!);
      localStorage.removeItem(THEME_KEY_LEGACY);
    }
  } catch {
    /* ignore */
  }
}
migrateLegacyThemeKey();

function readInitialTheme(): AppThemeMode {
  try {
    const fromStorage = localStorage.getItem(THEME_KEY);
    if (fromStorage === 'light' || fromStorage === 'dark') return fromStorage;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function useAppTheme() {
  const [theme, setTheme] = useState<AppThemeMode>(() => {
    const initial = readInitialTheme();
    applyPixelThemeToDocument(initial);
    return initial;
  });

  useEffect(() => {
    applyPixelThemeToDocument(theme);
    notifyThemeChange();
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' };
}
