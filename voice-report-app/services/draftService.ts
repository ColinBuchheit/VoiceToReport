// voice-report-app/services/draftService.ts
// Simple AsyncStorage-backed drafts store for unfinished closeout summaries
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloseoutSummary } from '../types/aiAgent';

export interface DraftItem {
  id: string;            // uuid
  timestamp: string;     // ISO string
  workOrder?: string;
  location?: string;
  transcription?: string;
  summary: CloseoutSummary;
}

const STORAGE_KEY = 'email_drafts_v1';
const MAX_DRAFTS = 50;
const RETENTION_MS = 21 * 24 * 60 * 60 * 1000; // 3 weeks

class DraftService {
  private cache: DraftItem[] = [];
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  private async ensureLoaded() {
    if (this.loaded) return;
    if (!this.loadingPromise) {
      this.loadingPromise = (async () => {
        try {
          const json = await AsyncStorage.getItem(STORAGE_KEY);
          if (json) {
            const parsed: DraftItem[] = JSON.parse(json);
            if (Array.isArray(parsed)) {
              this.cache = parsed.filter(e => e && e.id && e.timestamp);
            }
          }
        } catch {
          this.cache = [];
        } finally {
          this.loaded = true;
          const changed = this.prune();
          if (changed) {
            try { await this.persist(); } catch {}
          }
        }
      })();
    }
    await this.loadingPromise;
  }

  private async persist() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {}
  }

  private prune(): boolean {
    const before = this.cache.length;
    const now = Date.now();
    const thr = now - RETENTION_MS;
    this.cache = this.cache.filter(d => {
      const t = new Date(d.timestamp).getTime();
      if (!isFinite(t)) return false;
      return t >= thr;
    });
    // newest first
    this.cache.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (this.cache.length > MAX_DRAFTS) {
      this.cache = this.cache.slice(0, MAX_DRAFTS);
    }
    return this.cache.length !== before;
  }

  async addDraft(draft: Omit<DraftItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) {
    await this.ensureLoaded();
    const id = draft.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = draft.timestamp || new Date().toISOString();
    const item: DraftItem = {
      id,
      timestamp,
      workOrder: draft.workOrder,
      location: draft.location,
      transcription: draft.transcription,
      summary: draft.summary,
    };
    // Upsert by id: replace existing entry if present, else insert at top
    const idx = this.cache.findIndex(d => d.id === id);
    if (idx >= 0) {
      // Remove the old entry and place the updated one at the top
      this.cache.splice(idx, 1);
    }
    this.cache.unshift(item);
    this.prune();
    await this.persist();
    return item;
  }

  async getDrafts(): Promise<DraftItem[]> {
    await this.ensureLoaded();
    const changed = this.prune();
    if (changed) {
      try { await this.persist(); } catch {}
    }
    return [...this.cache];
  }

  async deleteDraft(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const before = this.cache.length;
    this.cache = this.cache.filter(d => d.id !== id);
    const changed = this.cache.length !== before;
    if (changed) await this.persist();
    return changed;
  }

  async clearAll() {
    this.cache = [];
    this.loaded = true;
    await this.persist();
  }
}

const draftService = new DraftService();
export default draftService;
