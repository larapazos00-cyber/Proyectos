import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
  disableNetwork,
  setLogLevel,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { compactProgramsForLocalStorage } from './storageService';

// Silence internal @firebase/firestore WebChannel backoff console.error spam when free-tier daily quota is reached
try {
  setLogLevel('silent');
} catch {
  // ignore
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

// CRITICAL: getFirestore with database ID
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const QUOTA_EXHAUSTED_STORAGE_KEY = 'studyflow_firestore_quota_exhausted_utc_date';
let quotaCircuitTripped = false;
let lastSavedPayloadDigest = '';
const lastSavedChunkDigests = new Map<number, string>();

function getTodayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isFirestoreQuotaExhausted(): boolean {
  if (quotaCircuitTripped) return true;
  try {
    const storedDate = localStorage.getItem(QUOTA_EXHAUSTED_STORAGE_KEY);
    if (storedDate === getTodayUtcDateString()) {
      quotaCircuitTripped = true;
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

function markFirestoreQuotaExhausted(): void {
  quotaCircuitTripped = true;
  try {
    localStorage.setItem(QUOTA_EXHAUSTED_STORAGE_KEY, getTodayUtcDateString());
  } catch {
    // ignore storage errors
  }
  disableNetwork(db).catch(() => {});
}

function isQuotaExhaustedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code || '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  );
}

/**
 * Wraps a Firestore write promise with a timeout so that if the SDK enters
 * exponential backoff due to daily free-tier write quota exhaustion, we trip
 * the local circuit breaker and disable network retries immediately.
 */
async function executeWriteWithQuotaGuard<T>(writePromise: Promise<T>, timeoutMs = 6000): Promise<T | null> {
  if (isFirestoreQuotaExhausted()) {
    return null;
  }
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      writePromise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          markFirestoreQuotaExhausted();
          resolve(null);
        }, timeoutMs);
      }),
    ]);
    return result;
  } catch (error) {
    if (isQuotaExhaustedError(error)) {
      markFirestoreQuotaExhausted();
      return null;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function fastStringDigest(str: string): string {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${str.length}:${(h2 >>> 0).toString(16)}:${(h1 >>> 0).toString(16)}`;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isQuotaExhaustedError(error)) {
    markFirestoreQuotaExhausted();
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  if (isFirestoreQuotaExhausted()) {
    disableNetwork(db).catch(() => {});
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (isQuotaExhaustedError(error)) {
      markFirestoreQuotaExhausted();
      return;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing:', error.message);
    }
  }
}

// Firestore user study data storage helper
export interface UserCloudState {
  programs: any[];
  preferences: any;
  pomodoroLogs: any[];
  blockedEvents: any[];
}

const BASE64_BLOB_REGEX = /data:[a-zA-Z0-9.+/-]+;base64,[A-Za-z0-9+/=\s]{512,}/g;
const utf8Encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function getUtf8ByteLength(str: string): number {
  if (!str) return 0;
  if (utf8Encoder) {
    return utf8Encoder.encode(str).length;
  }
  return str.length * 2;
}

/**
 * Estimates the internal Firestore document storage size in bytes, accounting for
 * UTF-8 string bytes, map key repetition, and per-field / per-map / per-array metadata overhead.
 */
function estimateFirestoreBytes(value: any): number {
  if (value === null || value === undefined) return 8;
  const t = typeof value;
  if (t === 'boolean' || t === 'number') return 8;
  if (t === 'string') return getUtf8ByteLength(value) + 2;
  if (Array.isArray(value)) {
    let sum = 16;
    for (let i = 0; i < value.length; i++) {
      sum += estimateFirestoreBytes(value[i]) + 8;
    }
    return sum;
  }
  if (t === 'object') {
    let sum = 32;
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        sum += getUtf8ByteLength(k) + 16 + estimateFirestoreBytes(v);
      }
    }
    return sum;
  }
  return 8;
}

export async function fetchUserStudyData(userId: string): Promise<UserCloudState | null> {
  if (isFirestoreQuotaExhausted()) {
    return null;
  }
  const path = `users/${userId}/studyData/main`;
  try {
    const docRef = doc(db, 'users', userId, 'studyData', 'main');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      let loadedPrograms: any[] = Array.isArray(data.programs) ? data.programs : [];

      const chunkCount = typeof data.chunkCount === 'number' ? data.chunkCount : 0;
      if (chunkCount > 0 && chunkCount <= 40) {
        try {
          const chunkDocs = await Promise.all(
            Array.from({ length: chunkCount }, (_, i) =>
              getDoc(doc(db, 'users', userId, 'studyData', `chunk_${i}`))
            )
          );
          if (chunkDocs.every((d) => d.exists() && typeof d.data()?.dataChunk === 'string')) {
            const joinedJson = chunkDocs.map((d) => d.data()!.dataChunk as string).join('');
            const parsedPrograms = JSON.parse(joinedJson);
            if (Array.isArray(parsedPrograms) && parsedPrograms.length > 0) {
              loadedPrograms = parsedPrograms;
            }
          }
        } catch (chunkErr) {
          console.warn('Could not reassemble studyData chunks, using main programs fallback:', chunkErr);
        }
      }

      return {
        programs: loadedPrograms,
        preferences: data.preferences || null,
        pomodoroLogs: data.pomodoroLogs || [],
        blockedEvents: data.blockedEvents || [],
      };
    }
    return null;
  } catch (error) {
    if (isQuotaExhaustedError(error)) {
      markFirestoreQuotaExhausted();
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

function sanitizeForFirestore(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string') {
    return value.length > 512 ? value.replace(BASE64_BLOB_REGEX, '') : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item));
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      result[key] = sanitizeForFirestore(val);
    }
  }
  return result;
}

const MAX_SAFE_FIRESTORE_DOC_BYTES = 450_000; // Strictly under half of Firestore's 1,048,576 byte limit
const CHUNK_CHAR_SIZE = 240_000;

async function writeProgramsChunks(
  userId: string,
  programsToChunk: any[],
  nowIso: string
): Promise<number> {
  if (isFirestoreQuotaExhausted()) return 0;

  let jsonStr = JSON.stringify(programsToChunk);
  if (getUtf8ByteLength(jsonStr) > 2_400_000) {
    jsonStr = JSON.stringify(compactProgramsForLocalStorage(programsToChunk, 2));
  }
  const chunks: string[] = [];
  for (let offset = 0; offset < jsonStr.length; offset += CHUNK_CHAR_SIZE) {
    chunks.push(jsonStr.slice(offset, offset + CHUNK_CHAR_SIZE));
  }

  for (let idx = 0; idx < chunks.length; idx++) {
    if (isFirestoreQuotaExhausted()) break;
    const chunkData = chunks[idx];
    const digest = fastStringDigest(chunkData);
    // Only write chunks whose content has actually changed to conserve daily write quota
    if (lastSavedChunkDigests.get(idx) === digest) {
      continue;
    }
    const res = await executeWriteWithQuotaGuard(
      setDoc(doc(db, 'users', userId, 'studyData', `chunk_${idx}`), {
        id: `chunk_${idx}`,
        userId,
        chunkIndex: idx,
        dataChunk: chunkData,
        updatedAt: nowIso,
      })
    );
    if (res !== null || !isFirestoreQuotaExhausted()) {
      lastSavedChunkDigests.set(idx, digest);
    }
  }
  return chunks.length;
}

export async function saveUserStudyData(userId: string, state: UserCloudState): Promise<void> {
  if (isFirestoreQuotaExhausted()) {
    return;
  }

  const path = `users/${userId}/studyData/main`;
  const docRef = doc(db, 'users', userId, 'studyData', 'main');
  const nowIso = new Date().toISOString();

  const rawPrograms = Array.isArray(state.programs) ? state.programs : [];
  const tier1Programs = sanitizeForFirestore(compactProgramsForLocalStorage(rawPrograms, 1));
  const safePreferences = sanitizeForFirestore(state.preferences || null);
  const safePomodoroLogs = sanitizeForFirestore(
    Array.isArray(state.pomodoroLogs) ? state.pomodoroLogs.slice(0, 400) : []
  );
  const safeBlockedEvents = sanitizeForFirestore(
    Array.isArray(state.blockedEvents) ? state.blockedEvents.slice(0, 500) : []
  );

  // Deduplicate identical consecutive saves to avoid burning Firestore daily write units
  const stateDigest = fastStringDigest(
    JSON.stringify({
      u: userId,
      p: tier1Programs,
      pr: safePreferences,
      pl: safePomodoroLogs,
      be: safeBlockedEvents,
    })
  );
  if (stateDigest === lastSavedPayloadDigest) {
    return;
  }

  try {
    let inlinePrograms = tier1Programs;
    let chunkCount = 0;

    const buildMainPayload = (progs: any[], chunksCount: number) => ({
      id: 'main',
      userId,
      chunkCount: chunksCount,
      programs: progs,
      preferences: safePreferences,
      pomodoroLogs: safePomodoroLogs,
      blockedEvents: safeBlockedEvents,
      updatedAt: nowIso,
    });

    let candidatePayload = buildMainPayload(inlinePrograms, 0);
    let estimatedBytes = estimateFirestoreBytes(candidatePayload);

    if (estimatedBytes > MAX_SAFE_FIRESTORE_DOC_BYTES) {
      // Save full lossless Tier-1 programs in chunk documents (chunk_0, chunk_1, ...)
      chunkCount = await writeProgramsChunks(userId, tier1Programs, nowIso);
      if (isFirestoreQuotaExhausted()) return;

      // Progressively compact the inline copy in main until it is strictly <= 450 KB
      for (const tier of [2, 3, 4, 5] as const) {
        inlinePrograms = sanitizeForFirestore(compactProgramsForLocalStorage(rawPrograms, tier));
        candidatePayload = buildMainPayload(inlinePrograms, chunkCount);
        estimatedBytes = estimateFirestoreBytes(candidatePayload);
        if (estimatedBytes <= MAX_SAFE_FIRESTORE_DOC_BYTES) {
          break;
        }
      }

      // If even Tier 5 exceeds 450 KB, keep programs empty in main because chunk_0..N holds the full data
      if (estimatedBytes > MAX_SAFE_FIRESTORE_DOC_BYTES) {
        candidatePayload = buildMainPayload([], chunkCount);
      }
    }

    try {
      await executeWriteWithQuotaGuard(setDoc(docRef, candidatePayload));
      if (!isFirestoreQuotaExhausted()) {
        lastSavedPayloadDigest = stateDigest;
      }
    } catch (writeErr: any) {
      if (isQuotaExhaustedError(writeErr)) {
        markFirestoreQuotaExhausted();
        return;
      }
      const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
      if (msg.includes('exceeds the maximum allowed size') || msg.includes('too large')) {
        if (chunkCount === 0) {
          chunkCount = await writeProgramsChunks(userId, tier1Programs, nowIso);
        }
        if (isFirestoreQuotaExhausted()) return;
        const minimalPayload = {
          id: 'main',
          userId,
          chunkCount,
          programs: [],
          preferences: safePreferences,
          pomodoroLogs: safePomodoroLogs.slice(0, 150),
          blockedEvents: safeBlockedEvents.slice(0, 250),
          updatedAt: nowIso,
        };
        await executeWriteWithQuotaGuard(setDoc(docRef, minimalPayload));
        if (!isFirestoreQuotaExhausted()) {
          lastSavedPayloadDigest = stateDigest;
        }
      } else {
        throw writeErr;
      }
    }
  } catch (error) {
    if (isQuotaExhaustedError(error)) {
      markFirestoreQuotaExhausted();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncUserProfile(user: User): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  const path = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await executeWriteWithQuotaGuard(
      setDoc(
        userDocRef,
        {
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'Estudiante',
          updatedAt: new Date().toISOString(),
          createdAt: user.metadata.creationTime || new Date().toISOString(),
        },
        { merge: true }
      )
    );
  } catch (error) {
    if (isQuotaExhaustedError(error)) {
      markFirestoreQuotaExhausted();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
};
