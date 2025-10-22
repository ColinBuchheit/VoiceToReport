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
  // Optional signal to force recomputing dirty state after an external save
  externalSaveSignal?: number;
}

export function useAutoSave(
  data: CloseoutSummary,
  options: AutoSaveOptions
) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const normalizeStr = (v?: any) => ((v ?? '') as string).toString().trim();
  const summariesEqual = (a?: CloseoutSummary, b?: CloseoutSummary) => {
    const ak = Object.keys(a || {});
    const bk = Object.keys(b || {});
    const keys = Array.from(new Set([...ak, ...bk]));
    for (const k of keys) {
      if (normalizeStr((a as any)?.[k]) !== normalizeStr((b as any)?.[k])) return false;
    }
    return true;
  };
  const equalChecklist = (a?: Record<string, boolean>, b?: Record<string, boolean>) => {
    const ak = Object.keys(a || {});
    const bk = Object.keys(b || {});
    if (ak.length !== bk.length) return false;
    for (const k of ak) { if (!!(a as any)[k] !== !!(b as any)[k]) return false; }
    return true;
  };

  // Compute dirtiness by comparing against saved draft (or empty baseline)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = normalizeStr(options?.transcription);
        const anyChecklist = Object.values(options?.checklist || {}).some(Boolean);
        if (!options?.draftId) {
          const anySummary = Object.values(data || {}).some(v => normalizeStr(v) !== '');
          const dirty = anySummary || text.length > 0 || anyChecklist;
          if (!cancelled) setIsDirty(dirty);
          return;
        }
        const saved = await draftService.getDraftById(options.draftId);
        if (!saved) {
          const anySummary = Object.values(data || {}).some(v => normalizeStr(v) !== '');
          const dirty = anySummary || text.length > 0 || anyChecklist;
          if (!cancelled) setIsDirty(dirty);
          return;
        }
        const sameSummary = summariesEqual(saved.summary as any, data);
        const sameText = normalizeStr(saved.transcription) === text;
        const sameChecklist = equalChecklist(saved.checklist, options?.checklist);
        if (!cancelled) setIsDirty(!(sameSummary && sameText && sameChecklist));
      } catch (e) {
        if (!cancelled) setIsDirty(true);
      }
    })();
    return () => { cancelled = true; };
    // Re-evaluate when inputs that affect dirtiness change
  }, [options?.draftId, options?.transcription, options?.checklist, options?.externalSaveSignal, data]);

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
