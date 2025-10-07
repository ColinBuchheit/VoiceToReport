// voice-report-app/services/emailHistoryService.ts
// Provides a lightweight, in-memory + persistent (AsyncStorage) email history cache
// so that EmailHistorySidebar and other components can consume a stable API.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EmailSummary {
  work_completed?: string;
  issues_found?: string;
  recommendations?: string;
  [key: string]: any; // Allow additional dynamic fields
}

export interface EmailHistoryItem {
  id: string; // uuid
  timestamp: string; // ISO string
  recipients: string[];
  workOrder?: string;
  technicianName?: string;
  transcription?: string; // raw transcription text (optional, used when selecting history)
  summary: EmailSummary;
  rawBody?: string;
}

const STORAGE_KEY = 'email_history_v1';
const MAX_HISTORY = 100; // keep the last 100 emails

class EmailHistoryService {
  private cache: EmailHistoryItem[] = [];
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  private async ensureLoaded() {
    if (this.loaded) return;
    if (!this.loadingPromise) {
      this.loadingPromise = (async () => {
        try {
          const json = await AsyncStorage.getItem(STORAGE_KEY);
          if (json) {
            const parsed: EmailHistoryItem[] = JSON.parse(json);
            if (Array.isArray(parsed)) {
              // Basic validation
              this.cache = parsed.filter(e => e && e.id && e.timestamp);
            }
          }
        } catch (err) {
          console.warn('Failed to load email history:', err);
          this.cache = [];
        } finally {
          this.loaded = true;
        }
      })();
    }
    await this.loadingPromise;
  }

  private async persist() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch (err) {
      console.warn('Failed to persist email history:', err);
    }
  }

  async addEmail(entry: Omit<EmailHistoryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) {
    await this.ensureLoaded();
    const item: EmailHistoryItem = {
      id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      recipients: entry.recipients || [],
      workOrder: entry.workOrder,
      technicianName: entry.technicianName,
      transcription: entry.transcription, // persist original transcription if provided
      summary: entry.summary || {},
      rawBody: entry.rawBody,
    };
    // Add newest at top
    this.cache.unshift(item);
    if (this.cache.length > MAX_HISTORY) {
      this.cache = this.cache.slice(0, MAX_HISTORY);
    }
    await this.persist();
    return item;
  }

  async getEmailHistory(): Promise<EmailHistoryItem[]> {
    await this.ensureLoaded();
    return [...this.cache];
  }

  async deleteEmail(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const originalLength = this.cache.length;
    this.cache = this.cache.filter(item => item.id !== id);
    if (this.cache.length !== originalLength) {
      await this.persist();
      return true;
    }
    return false;
  }

  async restoreEmail(item: EmailHistoryItem, index?: number): Promise<void> {
    await this.ensureLoaded();
    // Avoid duplicate IDs
    if (this.cache.find(e => e.id === item.id)) return;
    if (index !== undefined && index >= 0 && index <= this.cache.length) {
      this.cache.splice(index, 0, item);
    } else {
      this.cache.unshift(item);
    }
    await this.persist();
  }

  async clear() {
    this.cache = [];
    this.loaded = true;
    await this.persist();
  }
}

const emailHistoryService = new EmailHistoryService();
export default emailHistoryService;
