import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  auth,
  handleFirestoreError,
  isFirestoreQuotaExhausted,
  OperationType,
} from './firebase';

export type PomodoroPhaseMode = 'focus' | 'shortBreak' | 'longBreak';
export type ParticipantFocusState = 'studying' | 'break' | 'ready';

export interface PomodoroRoom {
  id: string;
  name: string;
  subjectLabel: string;
  hostUid: string;
  hostName: string;
  isPublic: boolean;
  mode: PomodoroPhaseMode;
  isRunning: boolean;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  pausedRemainingSeconds: number;
  targetEndTimeMs: number;
  cycleCount: number;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroRoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  currentTask: string;
  focusState: ParticipantFocusState;
  joinedAt: string;
  lastActiveAt: string;
}

export interface PomodoroRoomNote {
  id: string;
  roomId: string;
  userId: string;
  authorName: string;
  text: string;
  kind: 'message' | 'cheer';
  createdAt: string;
}

// Validation limits aligned strictly with firebase-blueprint.json & firestore.rules
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;
const MAX_ROOM_NAME_LEN = 80;
const MAX_SUBJECT_LABEL_LEN = 100;
const MAX_DISPLAY_NAME_LEN = 80;
const MAX_TASK_LEN = 120;
const MAX_MESSAGE_LEN = 240;

const clampStr = (val: string | undefined, maxLen: number, fallback = ''): string => {
  const cleaned = String(val ?? fallback).trim();
  if (!cleaned) return fallback.slice(0, maxLen);
  return cleaned.slice(0, maxLen);
};

const clampNum = (val: number, min: number, max: number): number => {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
};

export function normalizeRoomCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 64);
}

export function isValidRoomCode(code: string): boolean {
  return ROOM_ID_PATTERN.test(code);
}

export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `STF-${suffix}`;
}

export function deriveSafeDisplayName(
  customName?: string | null,
  email?: string | null
): string {
  if (customName && customName.trim().length > 0) {
    return clampStr(customName, MAX_DISPLAY_NAME_LEN, 'Estudiante');
  }
  if (email && email.includes('@')) {
    return clampStr(email.split('@')[0], MAX_DISPLAY_NAME_LEN, 'Estudiante');
  }
  return 'Estudiante';
}

export async function createPomodoroRoom(params: {
  name: string;
  subjectLabel?: string;
  isPublic: boolean;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  mode: PomodoroPhaseMode;
  displayName?: string;
  currentTask?: string;
}): Promise<PomodoroRoom> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión para crear una sala de estudio sincronizada.');
  }
  if (isFirestoreQuotaExhausted()) {
    throw new Error('La cuota diaria de sincronización en la nube se ha agotado temporalmente.');
  }

  let roomId = generateRoomCode();
  const roomRefCandidate = doc(db, 'pomodoroRooms', roomId);
  try {
    const existingSnap = await getDoc(roomRefCandidate);
    if (existingSnap.exists()) {
      roomId = generateRoomCode();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `pomodoroRooms/${roomId}`);
  }

  const nowIso = new Date().toISOString();
  const focusMins = clampNum(params.focusMinutes, 1, 180);
  const shortMins = clampNum(params.shortBreakMinutes, 1, 60);
  const longMins = clampNum(params.longBreakMinutes, 1, 90);
  const initialRemaining =
    params.mode === 'focus'
      ? focusMins * 60
      : params.mode === 'shortBreak'
      ? shortMins * 60
      : longMins * 60;

  const hostName = deriveSafeDisplayName(
    params.displayName || user.displayName,
    user.email
  );

  const roomDoc: PomodoroRoom = {
    id: roomId,
    name: clampStr(params.name, MAX_ROOM_NAME_LEN, 'Sala de Estudio Grupal'),
    subjectLabel: clampStr(params.subjectLabel, MAX_SUBJECT_LABEL_LEN, 'Estudio libre'),
    hostUid: user.uid,
    hostName,
    isPublic: Boolean(params.isPublic),
    mode: params.mode,
    isRunning: false,
    focusMinutes: focusMins,
    shortBreakMinutes: shortMins,
    longBreakMinutes: longMins,
    pausedRemainingSeconds: initialRemaining,
    targetEndTimeMs: 0,
    cycleCount: 0,
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const roomPath = `pomodoroRooms/${roomId}`;
  try {
    await setDoc(doc(db, 'pomodoroRooms', roomId), roomDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, roomPath);
  }

  const participantDoc: PomodoroRoomParticipant = {
    id: user.uid,
    roomId,
    userId: user.uid,
    displayName: hostName,
    currentTask: clampStr(params.currentTask, MAX_TASK_LEN, 'Enfoque conjunto'),
    focusState: 'ready',
    joinedAt: nowIso,
    lastActiveAt: nowIso,
  };

  const participantPath = `pomodoroRooms/${roomId}/participants/${user.uid}`;
  try {
    await setDoc(doc(db, 'pomodoroRooms', roomId, 'participants', user.uid), participantDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, participantPath);
  }

  return roomDoc;
}

export async function joinPomodoroRoom(params: {
  roomCode: string;
  displayName?: string;
  currentTask?: string;
}): Promise<PomodoroRoom> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión para unirte a una sala de estudio.');
  }
  if (isFirestoreQuotaExhausted()) {
    throw new Error('La cuota diaria de sincronización en la nube se ha agotado temporalmente.');
  }

  const roomId = normalizeRoomCode(params.roomCode);
  if (!isValidRoomCode(roomId)) {
    throw new Error('Código de sala no válido. Usa un código como STF-4K9A.');
  }

  const roomPath = `pomodoroRooms/${roomId}`;
  let snap;
  try {
    snap = await getDoc(doc(db, 'pomodoroRooms', roomId));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, roomPath);
  }

  if (!snap || !snap.exists()) {
    throw new Error(`No existe ninguna sala con el código "${roomId}".`);
  }

  const roomData = snap.data() as PomodoroRoom;
  if (roomData.status !== 'active') {
    throw new Error(`La sala "${roomData.name}" ya ha finalizado.`);
  }

  const nowIso = new Date().toISOString();
  const safeName = deriveSafeDisplayName(
    params.displayName || user.displayName,
    user.email
  );
  const participantState: ParticipantFocusState = roomData.isRunning
    ? roomData.mode === 'focus'
      ? 'studying'
      : 'break'
    : 'ready';

  const participantDoc: PomodoroRoomParticipant = {
    id: user.uid,
    roomId,
    userId: user.uid,
    displayName: safeName,
    currentTask: clampStr(params.currentTask, MAX_TASK_LEN, 'Estudio general'),
    focusState: participantState,
    joinedAt: nowIso,
    lastActiveAt: nowIso,
  };

  const participantPath = `pomodoroRooms/${roomId}/participants/${user.uid}`;
  try {
    await setDoc(doc(db, 'pomodoroRooms', roomId, 'participants', user.uid), participantDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, participantPath);
  }

  return roomData;
}

export async function syncRoomTimerState(
  roomId: string,
  state: {
    mode: PomodoroPhaseMode;
    isRunning: boolean;
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    pausedRemainingSeconds: number;
    targetEndTimeMs: number;
    cycleCount: number;
  }
): Promise<void> {
  if (!auth.currentUser || isFirestoreQuotaExhausted()) return;
  const path = `pomodoroRooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'pomodoroRooms', roomId), {
      mode: state.mode,
      isRunning: Boolean(state.isRunning),
      focusMinutes: clampNum(state.focusMinutes, 1, 180),
      shortBreakMinutes: clampNum(state.shortBreakMinutes, 1, 60),
      longBreakMinutes: clampNum(state.longBreakMinutes, 1, 90),
      pausedRemainingSeconds: clampNum(state.pausedRemainingSeconds, 0, 10800),
      targetEndTimeMs: Math.max(0, Math.round(state.targetEndTimeMs)),
      cycleCount: clampNum(state.cycleCount, 0, 500),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateParticipantStatus(
  roomId: string,
  userId: string,
  patch: {
    displayName?: string;
    currentTask?: string;
    focusState?: ParticipantFocusState;
  }
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== userId || isFirestoreQuotaExhausted()) return;
  const path = `pomodoroRooms/${roomId}/participants/${userId}`;
  const updatePayload: Record<string, any> = {
    lastActiveAt: new Date().toISOString(),
  };
  if (patch.displayName !== undefined) {
    updatePayload.displayName = clampStr(patch.displayName, MAX_DISPLAY_NAME_LEN, 'Estudiante');
  }
  if (patch.currentTask !== undefined) {
    updatePayload.currentTask = clampStr(patch.currentTask, MAX_TASK_LEN, 'Estudio general');
  }
  if (patch.focusState !== undefined) {
    updatePayload.focusState = patch.focusState;
  }
  try {
    await updateDoc(doc(db, 'pomodoroRooms', roomId, 'participants', userId), updatePayload);
  } catch (err) {
    // Ignore not-found during leave races; surface permission issues
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('No document to update') || msg.includes('not-found')) return;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function leavePomodoroRoom(roomId: string, userId: string): Promise<void> {
  if (!auth.currentUser || isFirestoreQuotaExhausted()) return;
  const path = `pomodoroRooms/${roomId}/participants/${userId}`;
  try {
    await deleteDoc(doc(db, 'pomodoroRooms', roomId, 'participants', userId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not-found')) return;
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function closePomodoroRoom(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || isFirestoreQuotaExhausted()) return;
  const path = `pomodoroRooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'pomodoroRooms', roomId), {
      status: 'closed',
      isRunning: false,
      targetEndTimeMs: 0,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function sendRoomNote(params: {
  roomId: string;
  authorName: string;
  text: string;
  kind?: 'message' | 'cheer';
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || isFirestoreQuotaExhausted()) return;
  const cleanText = clampStr(params.text, MAX_MESSAGE_LEN);
  if (!cleanText) return;

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const noteDoc: PomodoroRoomNote = {
    id: messageId,
    roomId: params.roomId,
    userId: user.uid,
    authorName: clampStr(params.authorName, MAX_DISPLAY_NAME_LEN, 'Estudiante'),
    text: cleanText,
    kind: params.kind || 'message',
    createdAt: new Date().toISOString(),
  };

  const path = `pomodoroRooms/${params.roomId}/messages/${messageId}`;
  try {
    await setDoc(doc(db, 'pomodoroRooms', params.roomId, 'messages', messageId), noteDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeToPublicRooms(
  onUpdate: (rooms: PomodoroRoom[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (isFirestoreQuotaExhausted() || !auth.currentUser) {
    onUpdate([]);
    return () => {};
  }

  const path = 'pomodoroRooms';
  const q = query(
    collection(db, 'pomodoroRooms'),
    where('status', '==', 'active'),
    where('isPublic', '==', true),
    limit(15)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const rooms = snapshot.docs
        .map((d) => d.data() as PomodoroRoom)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      onUpdate(rooms);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedErr: any) {
        onError?.(wrappedErr);
      }
    }
  );
}

export function subscribeToRoom(
  roomId: string,
  onUpdate: (room: PomodoroRoom | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (isFirestoreQuotaExhausted() || !auth.currentUser) {
    return () => {};
  }

  const path = `pomodoroRooms/${roomId}`;
  return onSnapshot(
    doc(db, 'pomodoroRooms', roomId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(snapshot.data() as PomodoroRoom);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrappedErr: any) {
        onError?.(wrappedErr);
      }
    }
  );
}

export function subscribeToRoomParticipants(
  roomId: string,
  onUpdate: (participants: PomodoroRoomParticipant[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (isFirestoreQuotaExhausted() || !auth.currentUser) {
    return () => {};
  }

  const path = `pomodoroRooms/${roomId}/participants`;
  const q = query(
    collection(db, 'pomodoroRooms', roomId, 'participants'),
    where('roomId', '==', roomId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const cutoffMs = Date.now() - 3 * 60 * 60 * 1000; // Filtrar presencias inactivas >3h
      const list = snapshot.docs
        .map((d) => d.data() as PomodoroRoomParticipant)
        .filter((p) => {
          const t = Date.parse(p.lastActiveAt || p.joinedAt || '');
          return Number.isNaN(t) || t >= cutoffMs;
        })
        .sort((a, b) => (a.joinedAt || '').localeCompare(b.joinedAt || ''));
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedErr: any) {
        onError?.(wrappedErr);
      }
    }
  );
}

export function subscribeToRoomMessages(
  roomId: string,
  onUpdate: (messages: PomodoroRoomNote[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (isFirestoreQuotaExhausted() || !auth.currentUser) {
    return () => {};
  }

  const path = `pomodoroRooms/${roomId}/messages`;
  const q = query(
    collection(db, 'pomodoroRooms', roomId, 'messages'),
    where('roomId', '==', roomId),
    limit(40)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as PomodoroRoomNote)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      onUpdate(list.slice(-30));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedErr: any) {
        onError?.(wrappedErr);
      }
    }
  );
}
