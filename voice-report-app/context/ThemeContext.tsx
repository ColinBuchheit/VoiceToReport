import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentContrast: string;
  hint: string;
  overlay: string;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
  isDark: boolean;
}

const STORAGE_KEY = 'ui_theme_mode_v1';

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FA',
  border: '#E5E7EB',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  accent: '#FF6B35',
  accentContrast: '#FFFFFF',
  hint: '#6B7280',
  overlay: 'rgba(0,0,0,0.5)',
};

const darkColors: ThemeColors = {
  background: '#101214',
  surface: '#1B1F23',
  surfaceAlt: '#24292F',
  border: '#30363D',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  accent: '#FF6B35',
  accentContrast: '#FFFFFF',
  hint: '#A1A1AA',
  overlay: 'rgba(0,0,0,0.6)',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemPreference = Appearance.getColorScheme?.() === 'dark' ? 'dark' : 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>(systemPreference as 'light' | 'dark');

  useEffect(() => {
    const sub = Appearance.addChangeListener?.(({ colorScheme }) => {
      if (colorScheme) setSystemMode(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => {
      // RN 0.81 addChangeListener returns remove() or nothing depending on platform
      // @ts-ignore
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const resolvedMode: 'light' | 'dark' = mode === 'system' ? systemMode : mode;
  const colors = resolvedMode === 'dark' ? darkColors : lightColors;

  const value: ThemeContextValue = {
    mode,
    resolvedMode,
    colors,
    setMode,
    isDark: resolvedMode === 'dark',
  };

  // Always render provider so dark devices (Android/Samsung) don't flash light theme before async load finishes.
  // 'loaded' is retained in case future logic wants to gate persistence-dependent UI.

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: 'light' as ThemeMode,
      resolvedMode: 'light' as const,
      colors: lightColors,
      setMode: () => {},
      isDark: false,
    };
  }
  return ctx;
}
