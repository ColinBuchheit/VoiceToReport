import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FontScaleContextValue {
  fontScale: number; // multiplier applied to base font sizes
  setFontScale: (scale: number) => void;
  scaled: (base: number) => number; // helper to scale a number inline
}

const DEFAULT_SCALE = 1;
const STORAGE_KEY = 'ui_font_scale_v1';

const FontScaleContext = createContext<FontScaleContextValue | undefined>(undefined);

export const FontScaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontScale, setFontScaleState] = useState<number>(DEFAULT_SCALE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const num = parseFloat(raw);
          if (!isNaN(num) && num >= 0.8 && num <= 1.6) setFontScaleState(num);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const setFontScale = useCallback((scale: number) => {
    const clamped = Math.min(1.6, Math.max(0.8, parseFloat(scale as any)));
    setFontScaleState(clamped);
    AsyncStorage.setItem(STORAGE_KEY, clamped.toString()).catch(() => {});
  }, []);

  const scaled = useCallback((base: number) => Math.round(base * fontScale), [fontScale]);

  const value: FontScaleContextValue = { fontScale, setFontScale, scaled };

  // Always provide context so consumers never mount outside provider (prevents hook errors)
  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
};

export function useFontScale() {
  const ctx = useContext(FontScaleContext);
  if (!ctx) throw new Error('useFontScale must be used within FontScaleProvider');
  return ctx;
}
