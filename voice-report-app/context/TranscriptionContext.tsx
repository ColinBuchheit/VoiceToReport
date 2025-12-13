import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TranscriptionContextValue {
  transcription: string;
  setTranscription: (value: string) => void;
}

const TranscriptionContext = createContext<TranscriptionContextValue | undefined>(undefined);

export function TranscriptionProvider({ children }: { children: ReactNode }) {
  const [transcription, setTranscription] = useState<string>('');

  return (
    <TranscriptionContext.Provider value={{ transcription, setTranscription }}>
      {children}
    </TranscriptionContext.Provider>
  );
}

export function useTranscription() {
  const ctx = useContext(TranscriptionContext);
  if (!ctx) throw new Error('useTranscription must be used within a TranscriptionProvider');
  return ctx;
}
