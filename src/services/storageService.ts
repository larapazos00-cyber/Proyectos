import { StudyProgram, StudyPreferences, PomodoroLog, BlockedTimeEvent, AttachedTopicFile, Topic } from '../types';
import { initialStudyPrograms, blankStudyPrograms, initialPreferences, initialPomodoroLogs, initialBlockedEvents } from '../data/initialData';

const STORAGE_KEYS = {
  PROGRAMS: 'studyflow_programs_v1',
  PREFERENCES: 'studyflow_preferences_v1',
  POMODORO_LOGS: 'studyflow_pomodoro_logs_v1',
  BLOCKED_EVENTS: 'studyflow_blocked_events_v1',
  ACTIVE_PROGRAM_ID: 'studyflow_active_program_id',
  ACTIVE_YEAR_ID: 'studyflow_active_year_id',
};

const IDB_CONFIG = {
  DB_NAME: 'studyflow_storage_idb_v1',
  STORE_NAME: 'studyflow_kv',
  PROGRAMS_KEY: 'programs_full_v1',
  BLOCKED_EVENTS_KEY: 'blocked_events_full_v1',
  PREFERENCES_KEY: 'preferences_full_v1',
};

// Base64 inline data regex for stripping heavy embedded data URLs (images, PDFs, audio, etc.) when compacting for localStorage and Firestore
const INLINE_BASE64_IMG_REGEX = /data:[a-zA-Z0-9.+/-]+;base64,[A-Za-z0-9+/=\s]{512,}/g;

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_CONFIG.DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_CONFIG.STORE_NAME)) {
          db.createObjectStore(IDB_CONFIG.STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveKeyToIndexedDB<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openIndexedDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
      store.put(data, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore IDB errors silently
  }
}

async function loadKeyFromIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openIndexedDB();
    if (!db) return null;
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        const result = req.result;
        resolve(result !== undefined && result !== null ? (result as T) : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function saveProgramsToIndexedDB(programs: StudyProgram[]): Promise<void> {
  await saveKeyToIndexedDB(IDB_CONFIG.PROGRAMS_KEY, programs);
}

async function loadProgramsFromIndexedDB(): Promise<StudyProgram[] | null> {
  const result = await loadKeyFromIndexedDB<StudyProgram[]>(IDB_CONFIG.PROGRAMS_KEY);
  return Array.isArray(result) && result.length > 0 ? result : null;
}

async function clearProgramsFromIndexedDB(): Promise<void> {
  try {
    const db = await openIndexedDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_CONFIG.STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_CONFIG.STORE_NAME);
      store.delete(IDB_CONFIG.PROGRAMS_KEY);
      store.delete(IDB_CONFIG.BLOCKED_EVENTS_KEY);
      store.delete(IDB_CONFIG.PREFERENCES_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore
  }
}

/**
 * Multi-tier compaction of StudyProgram[] so it always fits within browser ~5MB localStorage quota
 * and Firestore's 1 MiB document size limit while preserving academic structure, topics, attached PDFs, flashcards, exams, tasks, and notes.
 * Full uncompacted data (including high-res base64 images) is stored in IndexedDB.
 */
export function compactProgramsForLocalStorage(
  programs: StudyProgram[],
  tier: 1 | 2 | 3 | 4 | 5
): StudyProgram[] {
  const compactAttachedFile = (file: AttachedTopicFile): AttachedTopicFile => {
    const next: AttachedTopicFile = { ...file };
    delete (next as any).base64Data;
    delete (next as any).dataUrl;
    delete (next as any).pageImages;
    delete (next as any).fileDataUrl;

    // Tier 1+: Drop redundant rawExtractedText when content is already present
    if (next.content && next.rawExtractedText) {
      delete next.rawExtractedText;
    }
    if (next.content) {
      next.content = next.content.replace(INLINE_BASE64_IMG_REGEX, '');
    }
    if (next.rawExtractedText) {
      next.rawExtractedText = next.rawExtractedText.replace(INLINE_BASE64_IMG_REGEX, '');
    }
    // Strip heavy inline base64 images from richHtmlContent in localStorage/Firestore
    if (next.richHtmlContent) {
      if (next.richHtmlContent === next.content) {
        delete next.richHtmlContent;
      } else {
        next.richHtmlContent = next.richHtmlContent.replace(INLINE_BASE64_IMG_REGEX, '');
      }
    }
    // In Tier 1, omit oversized >20KB base64 images so PDF text & metadata fit cleanly
    if (next.extractedImages && next.extractedImages.length > 0) {
      const maxImgLen = tier === 1 ? 20_000 : tier === 2 ? 2_048 : 0;
      next.extractedImages =
        maxImgLen > 0
          ? next.extractedImages.filter((img) => !img.dataUrl || img.dataUrl.length <= maxImgLen)
          : [];
    }

    if (tier >= 2) {
      delete next.richHtmlContent;
      const MAX_DOC_CHARS_T2 = 60_000;
      if (next.content && next.content.length > MAX_DOC_CHARS_T2) {
        next.content = next.content.slice(0, MAX_DOC_CHARS_T2);
      }
    }

    if (tier >= 3) {
      const MAX_DOC_CHARS_T3 = 15_000;
      if (next.content && next.content.length > MAX_DOC_CHARS_T3) {
        next.content = next.content.slice(0, MAX_DOC_CHARS_T3);
      }
    }

    if (tier >= 4) {
      next.content = next.content ? next.content.slice(0, 3_000) : '';
      delete next.richHtmlContent;
      delete next.rawExtractedText;
      delete next.extractedImages;
    }

    if (tier >= 5) {
      next.content = next.content ? next.content.slice(0, 800) : '';
      if (next.summary && next.summary.length > 500) {
        next.summary = next.summary.slice(0, 500);
      }
      if (next.keyPoints && next.keyPoints.length > 12) {
        next.keyPoints = next.keyPoints.slice(0, 12);
      }
    }

    return next;
  };

  const compactTopic = (topic: Topic): Topic => {
    const next: Topic = { ...topic };

    if (next.notes) {
      next.notes = next.notes.replace(INLINE_BASE64_IMG_REGEX, '');
    }
    if (next.generalNotes) {
      next.generalNotes = next.generalNotes.replace(INLINE_BASE64_IMG_REGEX, '');
    }

    // Avoid storing duplicate copies of notes in both notes and generalNotes when identical
    if (next.richGeneralNotes) {
      if (next.richGeneralNotes === next.generalNotes || next.richGeneralNotes === next.notes) {
        delete next.richGeneralNotes;
      } else {
        next.richGeneralNotes = next.richGeneralNotes.replace(INLINE_BASE64_IMG_REGEX, '');
      }
    }

    if (next.generalImages && next.generalImages.length > 0) {
      const maxImgLen = tier === 1 ? 20_000 : tier === 2 ? 2_048 : 0;
      next.generalImages =
        maxImgLen > 0
          ? next.generalImages.filter((img) => !img.dataUrl || img.dataUrl.length <= maxImgLen)
          : [];
    }

    if (tier >= 2) {
      delete next.richGeneralNotes;
      const MAX_NOTE_CHARS_T2 = 60_000;
      if (next.generalNotes && next.generalNotes.length > MAX_NOTE_CHARS_T2) {
        next.generalNotes = next.generalNotes.slice(0, MAX_NOTE_CHARS_T2);
      }
      if (next.notes && next.notes.length > MAX_NOTE_CHARS_T2) {
        next.notes = next.notes.slice(0, MAX_NOTE_CHARS_T2);
      }
    }

    if (tier >= 3) {
      const MAX_NOTE_CHARS_T3 = 15_000;
      if (next.generalNotes && next.generalNotes.length > MAX_NOTE_CHARS_T3) {
        next.generalNotes = next.generalNotes.slice(0, MAX_NOTE_CHARS_T3);
      }
      if (next.notes && next.notes.length > MAX_NOTE_CHARS_T3) {
        next.notes = next.notes.slice(0, MAX_NOTE_CHARS_T3);
      }
    }

    if (tier >= 4) {
      delete next.richGeneralNotes;
      delete next.generalImages;
      if (next.generalNotes && next.generalNotes.length > 3_000) {
        next.generalNotes = next.generalNotes.slice(0, 3_000);
      }
      if (next.notes && next.notes.length > 3_000) {
        next.notes = next.notes.slice(0, 3_000);
      }
    }

    if (tier >= 5) {
      if (next.generalNotes && next.generalNotes.length > 800) {
        next.generalNotes = next.generalNotes.slice(0, 800);
      }
      if (next.notes && next.notes.length > 800) {
        next.notes = next.notes.slice(0, 800);
      }
      if (next.reviewsHistory && next.reviewsHistory.length > 20) {
        next.reviewsHistory = next.reviewsHistory.slice(-20);
      }
    }

    if (next.attachedFiles && next.attachedFiles.length > 0) {
      next.attachedFiles = next.attachedFiles.map(compactAttachedFile);
    }

    return next;
  };

  return programs.map((program) => ({
    ...program,
    years: (program.years || []).map((year) => ({
      ...year,
      subjects: (year.subjects || []).map((subject) => ({
        ...subject,
        topics: (subject.topics || []).map(compactTopic),
        cornellNotes: (subject.cornellNotes || []).map((cn) => {
          const cleanedNotes = cn.notes ? cn.notes.replace(INLINE_BASE64_IMG_REGEX, '') : '';
          const maxLen = tier >= 5 ? 1_200 : tier >= 4 ? 4_000 : tier >= 3 ? 12_000 : 60_000;
          return {
            ...cn,
            notes: cleanedNotes.length > maxLen ? cleanedNotes.slice(0, maxLen) : cleanedNotes,
          };
        }),
        quizzes:
          tier >= 4 && Array.isArray(subject.quizzes) && subject.quizzes.length > 15
            ? subject.quizzes.slice(-15)
            : subject.quizzes || [],
        feynmanSessions:
          tier >= 4 && Array.isArray(subject.feynmanSessions) && subject.feynmanSessions.length > 10
            ? subject.feynmanSessions.slice(-10)
            : subject.feynmanSessions || [],
      })),
    })),
  }));
}

function writeProgramsToLocalStorageSafe(programs: StudyProgram[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  // Keep previous raw value in case all tiers fail
  const previousRaw = localStorage.getItem(STORAGE_KEYS.PROGRAMS);

  // Always run Tier 1 deduplication for localStorage and cap localStorage copy at ~3.2MB
  // so there is always plenty of room for blockedEvents, preferences, and pomodoroLogs
  const tiers: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
  for (const tier of tiers) {
    try {
      const compacted = compactProgramsForLocalStorage(programs, tier);
      const compactedJson = JSON.stringify(compacted);
      if (tier < 4 && compactedJson.length > 3_200_000) {
        continue;
      }
      localStorage.removeItem(STORAGE_KEYS.PROGRAMS);
      localStorage.setItem(STORAGE_KEYS.PROGRAMS, compactedJson);
      return;
    } catch {
      // Continue to next compaction tier
    }
  }

  // If all tiers failed, restore previous value if possible so storage isn't left empty
  if (previousRaw) {
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRAMS, previousRaw);
    } catch {
      // Ignore
    }
  }
}

function safeSetLocalStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Free up space by compacting stored programs progressively (Tier 3 -> Tier 4), then retry without losing existing value
    for (const tier of [3, 4] as Array<3 | 4>) {
      try {
        const rawPrograms = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
        if (rawPrograms && rawPrograms.length > 100_000) {
          const parsedPrograms = JSON.parse(rawPrograms) as StudyProgram[];
          const compacted = compactProgramsForLocalStorage(parsedPrograms, tier);
          localStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(compacted));
        }
        localStorage.setItem(key, value);
        return;
      } catch {
        // Try next tier
      }
    }
  }
}

export const storageService = {
  getPrograms(): StudyProgram[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Error loading programs from localStorage', e);
    }
    // Default fallback en blanco para que cada usuario comience con sus propios datos personalizados
    this.savePrograms(blankStudyPrograms, { skipIndexedDB: true });
    return blankStudyPrograms;
  },

  async hydrateProgramsFromIndexedDB(): Promise<StudyProgram[] | null> {
    return await loadProgramsFromIndexedDB();
  },

  async hydrateBlockedEventsFromIndexedDB(): Promise<BlockedTimeEvent[] | null> {
    const res = await loadKeyFromIndexedDB<BlockedTimeEvent[]>(IDB_CONFIG.BLOCKED_EVENTS_KEY);
    return Array.isArray(res) ? res : null;
  },

  async hydratePreferencesFromIndexedDB(): Promise<StudyPreferences | null> {
    return await loadKeyFromIndexedDB<StudyPreferences>(IDB_CONFIG.PREFERENCES_KEY);
  },

  resetToBlank(): StudyProgram[] {
    this.savePrograms(blankStudyPrograms);
    return blankStudyPrograms;
  },

  loadDemoData(): StudyProgram[] {
    this.savePrograms(initialStudyPrograms);
    return initialStudyPrograms;
  },

  savePrograms(programs: StudyProgram[], options?: { skipIndexedDB?: boolean }): void {
    // 1. Save full uncompacted data in IndexedDB (supports large PDFs & images without 5MB cap)
    if (!options?.skipIndexedDB) {
      void saveProgramsToIndexedDB(programs);
    }
    // 2. Save quota-safe copy in localStorage for instant synchronous startup
    writeProgramsToLocalStorageSafe(programs);
  },

  getPreferences(): StudyPreferences {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Error loading preferences', e);
    }
    this.savePreferences(initialPreferences, { skipIndexedDB: true });
    return initialPreferences;
  },

  savePreferences(prefs: StudyPreferences, options?: { skipIndexedDB?: boolean }): void {
    if (!options?.skipIndexedDB) {
      void saveKeyToIndexedDB(IDB_CONFIG.PREFERENCES_KEY, prefs);
    }
    safeSetLocalStorageItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
  },

  getBlockedEvents(): BlockedTimeEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BLOCKED_EVENTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Error loading blocked events', e);
    }
    this.saveBlockedEvents(initialBlockedEvents, { skipIndexedDB: true });
    return initialBlockedEvents;
  },

  saveBlockedEvents(events: BlockedTimeEvent[], options?: { skipIndexedDB?: boolean }): void {
    if (!options?.skipIndexedDB) {
      void saveKeyToIndexedDB(IDB_CONFIG.BLOCKED_EVENTS_KEY, events);
    }
    safeSetLocalStorageItem(STORAGE_KEYS.BLOCKED_EVENTS, JSON.stringify(events));
  },

  addBlockedEvent(event: BlockedTimeEvent): void {
    const current = this.getBlockedEvents();
    const updated = [event, ...current];
    this.saveBlockedEvents(updated);
  },

  deleteBlockedEvent(id: string): void {
    const current = this.getBlockedEvents();
    const updated = current.filter((e) => e.id !== id);
    this.saveBlockedEvents(updated);
  },

  getPomodoroLogs(): PomodoroLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.POMODORO_LOGS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Error loading pomodoro logs', e);
    }
    this.savePomodoroLogs(initialPomodoroLogs);
    return initialPomodoroLogs;
  },

  savePomodoroLogs(logs: PomodoroLog[]): void {
    // Keep at most the most recent 2,000 logs in localStorage to avoid unbounded growth
    const trimmedLogs = logs.length > 2000 ? logs.slice(0, 2000) : logs;
    safeSetLocalStorageItem(STORAGE_KEYS.POMODORO_LOGS, JSON.stringify(trimmedLogs));
  },

  addPomodoroLog(log: PomodoroLog): void {
    const current = this.getPomodoroLogs();
    const updated = [log, ...current];
    this.savePomodoroLogs(updated);

    // Update streak if needed
    const prefs = this.getPreferences();
    const today = new Date().toISOString().split('T')[0];
    if (prefs.lastStudyDate !== today) {
      const lastDate = new Date(prefs.lastStudyDate);
      const currDate = new Date(today);
      const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) {
        prefs.streakDays += 1;
      } else if (diffDays > 1) {
        prefs.streakDays = 1;
      }
      prefs.lastStudyDate = today;
      this.savePreferences(prefs);
    }
  },

  getActiveSelection(): { programId?: string; yearId?: string } {
    return {
      programId: localStorage.getItem(STORAGE_KEYS.ACTIVE_PROGRAM_ID) || undefined,
      yearId: localStorage.getItem(STORAGE_KEYS.ACTIVE_YEAR_ID) || undefined,
    };
  },

  setActiveSelection(programId: string, yearId: string): void {
    safeSetLocalStorageItem(STORAGE_KEYS.ACTIVE_PROGRAM_ID, programId);
    safeSetLocalStorageItem(STORAGE_KEYS.ACTIVE_YEAR_ID, yearId);
  },

  resetAll(): void {
    localStorage.removeItem(STORAGE_KEYS.PROGRAMS);
    localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
    localStorage.removeItem(STORAGE_KEYS.POMODORO_LOGS);
    localStorage.removeItem(STORAGE_KEYS.BLOCKED_EVENTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROGRAM_ID);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_YEAR_ID);
    void clearProgramsFromIndexedDB();
  },

  exportJSON(): string {
    const dump = {
      programs: this.getPrograms(),
      preferences: this.getPreferences(),
      blockedEvents: this.getBlockedEvents(),
      pomodoroLogs: this.getPomodoroLogs(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(dump, null, 2);
  },

  importJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.programs && Array.isArray(parsed.programs)) {
        this.savePrograms(parsed.programs);
        if (parsed.preferences) this.savePreferences(parsed.preferences);
        if (parsed.blockedEvents) this.saveBlockedEvents(parsed.blockedEvents);
        if (parsed.pomodoroLogs) this.savePomodoroLogs(parsed.pomodoroLogs);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Import failed', e);
      return false;
    }
  },
};

