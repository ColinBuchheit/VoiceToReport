// voice-report-app/hooks/useAutoSave.ts
import { useEffect, useRef, useState } from 'react';
import draftService from '../services/draftService';
import { CloseoutSummary } from '../types/aiAgent';

interface AutoSaveOptions {
  draftId?: string;
  workOrder?: string;
  location?: string;
  transcription?: string;
  enabled?: boolean;
  interval?: number; // milliseconds
  // Track which screen the user was on when the draft was saved
  currentRoute?: 'Home' | 'Transcript' | 'Summary';
  // Optional checklist progress to persist with draft
  checklist?: Record<string, boolean>;
}

export function useAutoSave(
  data: CloseoutSummary,
  options: AutoSaveOptions
) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mark dirty when data changes
  useEffect(() => {
    setIsDirty(true);
    // Reset debounce on data change
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [data]);

  // Auto-save with debounce
  useEffect(() => {
    if (!options?.enabled || !isDirty) return;

    const wait = options.interval ?? 30000; // default 30s
    timeoutRef.current = setTimeout(async () => {
      try {
        await draftService.addDraft({
          id: options.draftId,
          workOrder: options.workOrder,
          location: options.location,
          transcription: options.transcription,
          summary: data,
          lastSavedRoute: options.currentRoute,
          checklist: options.checklist,
        });
        setLastSaved(new Date());
        setIsDirty(false);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, wait);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [data, isDirty, options?.draftId, options?.workOrder, options?.location, options?.transcription, options?.enabled, options?.interval]);

  const saveNow = async () => {
    try {
      const draft = await draftService.addDraft({
        id: options.draftId,
        workOrder: options.workOrder,
        location: options.location,
        transcription: options.transcription,
        summary: data,
        lastSavedRoute: options.currentRoute,
        checklist: options.checklist,
      });
      setLastSaved(new Date());
      setIsDirty(false);
      return draft;
    } catch (error) {
      console.error('Manual save failed:', error);
      throw error;
    }
  };

  return { lastSaved, isDirty, saveNow };
}

export default useAutoSave;
