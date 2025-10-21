import React, { createContext, useContext, useMemo, useState, ReactNode, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextValue {
  showReportProgressBar: boolean;
  setShowReportProgressBar: (v: boolean) => void;
  showBottomBarBackground: boolean;
  setShowBottomBarBackground: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Storage keys
  const KEY_PROGRESS = 'ui_show_report_progress_v1';
  const KEY_BOTTOM_BAR_BG = 'ui_show_bottom_bar_bg_v1';

  // Defaults off
  const [showReportProgressBar, setShowReportProgressBarState] = useState<boolean>(false);
  const [showBottomBarBackground, setShowBottomBarBackgroundState] = useState<boolean>(false);

  // Load persisted settings once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [p, b] = await Promise.all([
          AsyncStorage.getItem(KEY_PROGRESS),
          AsyncStorage.getItem(KEY_BOTTOM_BAR_BG),
        ]);
        if (!mounted) return;
        if (p === 'true') setShowReportProgressBarState(true);
        if (p === 'false') setShowReportProgressBarState(false);
        if (b === 'true') setShowBottomBarBackgroundState(true);
        if (b === 'false') setShowBottomBarBackgroundState(false);
      } catch {
        // ignore persistence errors; defaults remain off
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Setter wrappers that persist
  const setShowReportProgressBar = useCallback((v: boolean) => {
    setShowReportProgressBarState(v);
    AsyncStorage.setItem(KEY_PROGRESS, String(v)).catch(() => {});
  }, []);

  const setShowBottomBarBackground = useCallback((v: boolean) => {
    setShowBottomBarBackgroundState(v);
    AsyncStorage.setItem(KEY_BOTTOM_BAR_BG, String(v)).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    showReportProgressBar,
    setShowReportProgressBar,
    showBottomBarBackground,
    setShowBottomBarBackground,
  }), [showReportProgressBar, showBottomBarBackground, setShowReportProgressBar, setShowBottomBarBackground]);

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
