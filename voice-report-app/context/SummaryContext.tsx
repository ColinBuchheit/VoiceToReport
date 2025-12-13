import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { CloseoutSummary } from '../types/aiAgent';

interface SummaryState {
  lastSummary?: CloseoutSummary;
  lastTranscription?: string;
  lastUpdatedAt?: number;
}

interface SummaryContextValue extends SummaryState {
  setSummary: (summary: CloseoutSummary, transcription: string) => void;
  clearSummary: () => void;
}

const SummaryContext = createContext<SummaryContextValue | undefined>(undefined);

export function SummaryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SummaryState>({});

  const setSummary = (summary: CloseoutSummary, transcription: string) => {
    setState({ lastSummary: summary, lastTranscription: transcription, lastUpdatedAt: Date.now() });
  };
  const clearSummary = () => setState({});

  const value = useMemo(() => ({ ...state, setSummary, clearSummary }), [state]);
  return <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>;
}

export function useSummary() {
  const ctx = useContext(SummaryContext);
  if (!ctx) throw new Error('useSummary must be used within a SummaryProvider');
  return ctx;
}
