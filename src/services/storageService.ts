import { StudyProgram, StudyPreferences, PomodoroLog, BlockedTimeEvent, AttachedTopicFile, Topic } from '../types';
import { initialStudyPrograms, blankStudyPrograms, initialPreferences, initialPomodoroLogs, initialBlockedEvents } from '../data/initialData';

const CURRENT_SCHEMA_VERSION = 2;

const STORAGE_KEYS = {
  PROGRAMS: 'studyflow_programs_v1',
  PREFERENCES: 'studyflow_preferences_v1',
  POMODORO_LOGS: 'studyflow_pomodoro_logs_v1',
  BLOCKED_EVENTS: 'studyflow_blocked_events_v1',
  ACTIVE_PROGRAM_ID: 'studyflow_active_program_id',
  ACTIVE_YEAR_ID: 'studyflow_active_year_id',
  SCHEMA_VERSION: 'studyflow_schema_version_v1',
  PREFS_USER_MODIFIED: 'studyflow_prefs_user_modified_v1',
  HABITS: 'studyflow_user_habits_v1',
  MOODS: 'studyflow_user_moods_v1',
  SMART_GOALS: 'studyflow_smart_goals_v1',
};

const IDB_CONFIG = {
  DB_NAME: 'studyflow_storage_idb_v1',
  STORE_NAME: 'studyflow_kv',
  PROGRAMS_KEY: 'programs_full_v1',
  BLOCKED_EVENTS_KEY: 'blocked_events_full_v1',
  PREFERENCES_KEY: 'preferences_full_v1',
  POMODORO_LOGS_KEY: 'pomodoro_logs_full_v1',
  ACTIVE_SELECTION_KEY: 'active_selection_full_v1',
  SWR_META_KEY: 'swr_cache_meta_v1',
  OFFLINE_MUTATIONS_KEY: 'offline_pending_mutations_v1',
  PRE_UPDATE_BACKUP_KEY: 'pre_update_backup_v1',
};

export function hasMeaningfulUserPrograms(programs: StudyProgram[] | null | undefined): boolean {
  if (!Array.isArray(programs) || programs.length === 0) return false;
  if (programs.length > 1) return true;
  const first = programs[0];
  if (!first) return false;
  if (first.id !== 'prog-custom-1') return true;
  if (first.name && first.name !== 'Mi Plan de Estudios') return true;
  const years = Array.isArray(first.years) ? first.years : [];
  if (years.length > 1) return true;
  return years.some((y) => (Array.isArray(y.subjects) ? y.subjects.length > 0 : false));
}

export function migrateProgramsSchema(programs: StudyProgram[]): StudyProgram[] {
  if (!Array.isArray(programs)) return [];
  return programs.map((prog) => ({
    ...prog,
    years: (Array.isArray(prog.years) ? prog.years : []).map((yr) => ({
      ...yr,
      targetWeeklyHours: yr.targetWeeklyHours ?? 20,
      subjects: (Array.isArray(yr.subjects) ? yr.subjects : []).map((sub) => ({
        ...sub,
        topics: Array.isArray(sub.topics) ? sub.topics : [],
        tasks: Array.isArray(sub.tasks) ? sub.tasks : [],
        exams: Array.isArray(sub.exams) ? sub.exams : [],
        projects: Array.isArray(sub.projects) ? sub.projects : [],
        smartGoals: Array.isArray(sub.smartGoals) ? sub.smartGoals : [],
        cornellNotes: Array.isArray(sub.cornellNotes) ? sub.cornellNotes : [],
        flashcards: Array.isArray(sub.flashcards) ? sub.flashcards : [],
        quizzes: Array.isArray(sub.quizzes) ? sub.quizzes : [],
        feynmanSessions: Array.isArray(sub.feynmanSessions) ? sub.feynmanSessions : [],
        mindmaps: Array.isArray(sub.mindmaps) ? sub.mindmaps : [],
        errorLogs: Array.isArray(sub.errorLogs) ? sub.errorLogs : [],
      })),
    })),
  }));
}

export function migratePreferencesSchema(prefs: Partial<StudyPreferences> | null | undefined): StudyPreferences {
  if (!prefs || typeof prefs !== 'object') {
    return { ...initialPreferences };
  }
  return {
    ...initialPreferences,
    ...prefs,
    availableDays:
      Array.isArray(prefs.availableDays) && prefs.availableDays.length > 0
        ? prefs.availableDays
        : initialPreferences.availableDays,
    hoursPerDay:
      prefs.hoursPerDay && typeof prefs.hoursPerDay === 'object'
        ? { ...initialPreferences.hoursPerDay, ...prefs.hoursPerDay }
        : { ...initialPreferences.hoursPerDay },
    pomodoroConfig: {
      ...initialPreferences.pomodoroConfig,
      ...(prefs.pomodoroConfig || {}),
    },
    weeklyFixedObligations: Array.isArray(prefs.weeklyFixedObligations)
      ? prefs.weeklyFixedObligations
      : initialPreferences.weeklyFixedObligations || [],
    contextualNotificationRules: Array.isArray(prefs.contextualNotificationRules)
      ? prefs.contextualNotificationRules
      : initialPreferences.contextualNotificationRules,
    subjectAllocationStrategy: prefs.subjectAllocationStrategy || 'balanced',
  };
}

interface SwrCacheMeta {
  lastUpdatedAt: string;
  pendingOfflineMutations: number;
}

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
  return Array.isArray(result) && result.length > 0 ? migrateProgramsSchema(result) : null;
}

async function ensureSchemaUpgradedAndBackedUp(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const rawVer = localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
    const prevVer = rawVer ? parseInt(rawVer, 10) : 0;
    if (prevVer >= CURRENT_SCHEMA_VERSION) return;

    // Si existían datos previos de una publicación anterior, crear una instantánea de respaldo en IndexedDB antes de migrar
    const rawPrograms = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
    const rawPrefs = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    const rawBlocked = localStorage.getItem(STORAGE_KEYS.BLOCKED_EVENTS);
    const rawPomodoro = localStorage.getItem(STORAGE_KEYS.POMODORO_LOGS);
    const idbPrograms = await loadKeyFromIndexedDB<StudyProgram[]>(IDB_CONFIG.PROGRAMS_KEY);

    if (rawPrograms || idbPrograms || rawPrefs || rawBlocked) {
      await saveKeyToIndexedDB(IDB_CONFIG.PRE_UPDATE_BACKUP_KEY, {
        backedUpAt: new Date().toISOString(),
        fromSchemaVersion: prevVer,
        toSchemaVersion: CURRENT_SCHEMA_VERSION,
        programs: idbPrograms || (rawPrograms ? JSON.parse(rawPrograms) : null),
        preferences: rawPrefs ? JSON.parse(rawPrefs) : null,
        blockedEvents: rawBlocked ? JSON.parse(rawBlocked) : null,
        pomodoroLogs: rawPomodoro ? JSON.parse(rawPomodoro) : null,
      });
    }
    localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
  } catch {
    // Non-fatal
  }
}

async function touchSwrMetadataInIndexedDB(): Promise<void> {
  try {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const currentMeta = await loadKeyFromIndexedDB<SwrCacheMeta>(IDB_CONFIG.SWR_META_KEY);
    const nextPending = isOffline
      ? (currentMeta?.pendingOfflineMutations || 0) + 1
      : 0;
    await saveKeyToIndexedDB<SwrCacheMeta>(IDB_CONFIG.SWR_META_KEY, {
      lastUpdatedAt: new Date().toISOString(),
      pendingOfflineMutations: nextPending,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow:idb-swr-updated'));
    }
  } catch {
    // Ignore
  }
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
      store.delete(IDB_CONFIG.POMODORO_LOGS_KEY);
      store.delete(IDB_CONFIG.ACTIVE_SELECTION_KEY);
      store.delete(IDB_CONFIG.SWR_META_KEY);
      store.delete(IDB_CONFIG.OFFLINE_MUTATIONS_KEY);
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
  hasPersistedPrograms(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return hasMeaningfulUserPrograms(parsed);
    } catch {
      return false;
    }
  },

  hasPersistedUserPreferences(): boolean {
    try {
      if (localStorage.getItem(STORAGE_KEYS.PREFS_USER_MODIFIED) === '1') return true;
      const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(
        parsed?.updatedAt ||
          (Array.isArray(parsed?.weeklyFixedObligations) && parsed.weeklyFixedObligations.length > 0) ||
          (Array.isArray(parsed?.moodEntries) && parsed.moodEntries.length > 0) ||
          (Array.isArray(parsed?.habits) && parsed.habits.length > 0)
      );
    } catch {
      return false;
    }
  },

  async runSchemaMigrationAndBackup(): Promise<void> {
    await ensureSchemaUpgradedAndBackedUp();
  },

  getPrograms(): StudyProgram[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return migrateProgramsSchema(parsed);
        }
      }
    } catch (e) {
      console.warn('Error loading programs from localStorage', e);
    }
    // No sobrescribir IndexedDB ni localStorage si aún no existían datos: devolver estructura inicial segura
    return migrateProgramsSchema(blankStudyPrograms);
  },

  async hydrateProgramsFromIndexedDB(): Promise<StudyProgram[] | null> {
    await ensureSchemaUpgradedAndBackedUp();
    return await loadProgramsFromIndexedDB();
  },

  async hydrateBlockedEventsFromIndexedDB(): Promise<BlockedTimeEvent[] | null> {
    const res = await loadKeyFromIndexedDB<BlockedTimeEvent[]>(IDB_CONFIG.BLOCKED_EVENTS_KEY);
    return Array.isArray(res) ? res : null;
  },

  async hydratePreferencesFromIndexedDB(): Promise<StudyPreferences | null> {
    const res = await loadKeyFromIndexedDB<StudyPreferences>(IDB_CONFIG.PREFERENCES_KEY);
    return res ? migratePreferencesSchema(res) : null;
  },

  async hydratePomodoroLogsFromIndexedDB(): Promise<PomodoroLog[] | null> {
    const res = await loadKeyFromIndexedDB<PomodoroLog[]>(IDB_CONFIG.POMODORO_LOGS_KEY);
    return Array.isArray(res) && res.length > 0 ? res : null;
  },

  async hydrateActiveSelectionFromIndexedDB(): Promise<{ programId?: string; yearId?: string } | null> {
    return await loadKeyFromIndexedDB<{ programId?: string; yearId?: string }>(
      IDB_CONFIG.ACTIVE_SELECTION_KEY
    );
  },

  async getOfflineCacheStatus(): Promise<{
    lastUpdatedAt: string | null;
    pendingOfflineMutations: number;
  }> {
    const meta = await loadKeyFromIndexedDB<SwrCacheMeta>(IDB_CONFIG.SWR_META_KEY);
    return {
      lastUpdatedAt: meta?.lastUpdatedAt || null,
      pendingOfflineMutations: meta?.pendingOfflineMutations || 0,
    };
  },

  async markOfflineMutationsRevalidated(): Promise<void> {
    await saveKeyToIndexedDB<SwrCacheMeta>(IDB_CONFIG.SWR_META_KEY, {
      lastUpdatedAt: new Date().toISOString(),
      pendingOfflineMutations: 0,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studyflow:idb-swr-updated'));
    }
  },

  resetToBlank(): StudyProgram[] {
    this.savePrograms(blankStudyPrograms, { allowBlankOverwrite: true });
    return migrateProgramsSchema(blankStudyPrograms);
  },

  loadDemoData(): StudyProgram[] {
    this.savePrograms(initialStudyPrograms, { allowBlankOverwrite: true });
    return migrateProgramsSchema(initialStudyPrograms);
  },

  savePrograms(
    programs: StudyProgram[],
    options?: { skipIndexedDB?: boolean; allowBlankOverwrite?: boolean }
  ): void {
    // Protección anti-pérdida: nunca sobrescribir datos reales ya guardados con la plantilla en blanco por error de hidratación
    if (!options?.allowBlankOverwrite && !hasMeaningfulUserPrograms(programs)) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.PROGRAMS);
        if (raw) {
          const existingParsed = JSON.parse(raw);
          if (hasMeaningfulUserPrograms(existingParsed)) {
            return;
          }
        }
      } catch {
        // Ignore
      }
    }

    // 1. Save full uncompacted data in IndexedDB (supports large PDFs & images without 5MB cap)
    if (!options?.skipIndexedDB) {
      void saveProgramsToIndexedDB(programs).then(() => touchSwrMetadataInIndexedDB());
    }
    // 2. Save quota-safe copy in localStorage for instant synchronous startup (Stale-While-Revalidate)
    writeProgramsToLocalStorageSafe(programs);
  },

  getPreferences(): StudyPreferences {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (data) {
        return migratePreferencesSchema(JSON.parse(data));
      }
    } catch (e) {
      console.warn('Error loading preferences', e);
    }
    return { ...initialPreferences };
  },

  savePreferences(
    prefs: StudyPreferences,
    options?: { skipIndexedDB?: boolean; preserveTimestamp?: boolean }
  ): void {
    const nextPrefs: StudyPreferences =
      !options?.skipIndexedDB && !options?.preserveTimestamp
        ? { ...prefs, updatedAt: new Date().toISOString() }
        : prefs;

    if (!options?.skipIndexedDB) {
      try {
        localStorage.setItem(STORAGE_KEYS.PREFS_USER_MODIFIED, '1');
      } catch {
        // Ignore
      }
      void saveKeyToIndexedDB(IDB_CONFIG.PREFERENCES_KEY, nextPrefs).then(() =>
        touchSwrMetadataInIndexedDB()
      );
    }
    safeSetLocalStorageItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(nextPrefs));
  },

  getBlockedEvents(): BlockedTimeEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BLOCKED_EVENTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error loading blocked events', e);
    }
    return initialBlockedEvents;
  },

  saveBlockedEvents(events: BlockedTimeEvent[], options?: { skipIndexedDB?: boolean }): void {
    if (!options?.skipIndexedDB) {
      void saveKeyToIndexedDB(IDB_CONFIG.BLOCKED_EVENTS_KEY, events).then(() =>
        touchSwrMetadataInIndexedDB()
      );
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
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error loading pomodoro logs', e);
    }
    return initialPomodoroLogs;
  },

  savePomodoroLogs(logs: PomodoroLog[], options?: { skipIndexedDB?: boolean }): void {
    if (!options?.skipIndexedDB) {
      void saveKeyToIndexedDB(IDB_CONFIG.POMODORO_LOGS_KEY, logs).then(() =>
        touchSwrMetadataInIndexedDB()
      );
    }
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
    void saveKeyToIndexedDB(IDB_CONFIG.ACTIVE_SELECTION_KEY, { programId, yearId });
  },

  resetAll(): void {
    localStorage.removeItem(STORAGE_KEYS.PROGRAMS);
    localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
    localStorage.removeItem(STORAGE_KEYS.POMODORO_LOGS);
    localStorage.removeItem(STORAGE_KEYS.BLOCKED_EVENTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROGRAM_ID);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_YEAR_ID);
    localStorage.removeItem(STORAGE_KEYS.PREFS_USER_MODIFIED);
    void clearProgramsFromIndexedDB();
  },

  exportJSON(): string {
    let habits: any = null;
    let moods: any = null;
    let smartGoals: any = null;
    try {
      const h = localStorage.getItem(STORAGE_KEYS.HABITS);
      if (h) habits = JSON.parse(h);
      const m = localStorage.getItem(STORAGE_KEYS.MOODS);
      if (m) moods = JSON.parse(m);
      const sg = localStorage.getItem(STORAGE_KEYS.SMART_GOALS);
      if (sg) smartGoals = JSON.parse(sg);
    } catch {
      // Ignore
    }
    const dump = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      programs: this.getPrograms(),
      preferences: this.getPreferences(),
      blockedEvents: this.getBlockedEvents(),
      pomodoroLogs: this.getPomodoroLogs(),
      habits,
      moods,
      smartGoals,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(dump, null, 2);
  },

  importJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.programs && Array.isArray(parsed.programs)) {
        const migratedPrograms = migrateProgramsSchema(parsed.programs);
        this.savePrograms(migratedPrograms, { allowBlankOverwrite: true });
        if (parsed.preferences) this.savePreferences(migratePreferencesSchema(parsed.preferences));
        if (parsed.blockedEvents) this.saveBlockedEvents(parsed.blockedEvents);
        if (parsed.pomodoroLogs) this.savePomodoroLogs(parsed.pomodoroLogs);
        if (parsed.habits) safeSetLocalStorageItem(STORAGE_KEYS.HABITS, JSON.stringify(parsed.habits));
        if (parsed.moods) safeSetLocalStorageItem(STORAGE_KEYS.MOODS, JSON.stringify(parsed.moods));
        if (parsed.smartGoals) safeSetLocalStorageItem(STORAGE_KEYS.SMART_GOALS, JSON.stringify(parsed.smartGoals));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Import failed', e);
      return false;
    }
  },
};

