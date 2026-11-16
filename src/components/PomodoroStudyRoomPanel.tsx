import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  Users,
  Plus,
  LogIn,
  Copy,
  Check,
  LogOut,
  Power,
  Send,
  Globe,
  Lock,
  Radio,
  Sparkles,
  BookOpen,
  UserCheck,
  X,
} from 'lucide-react';
import {
  PomodoroRoom,
  PomodoroRoomParticipant,
  PomodoroRoomNote,
  PomodoroPhaseMode,
  createPomodoroRoom,
  joinPomodoroRoom,
  leavePomodoroRoom,
  closePomodoroRoom,
  sendRoomNote,
  updateParticipantStatus,
  subscribeToPublicRooms,
  deriveSafeDisplayName,
} from '../services/pomodoroRoomService';

interface PomodoroStudyRoomPanelProps {
  currentUser: User | null;
  onOpenAuthModal?: () => void;
  activeRoom: PomodoroRoom | null;
  participants: PomodoroRoomParticipant[];
  messages: PomodoroRoomNote[];
  isRoomHost: boolean;
  currentMode: PomodoroPhaseMode;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  defaultSubjectLabel?: string;
  defaultTaskLabel?: string;
  roomError: string | null;
  onClearRoomError: () => void;
  onRoomJoined: (room: PomodoroRoom) => void;
  onRoomExited: () => void;
  onClosePanel: () => void;
}

export const PomodoroStudyRoomPanel: React.FC<PomodoroStudyRoomPanelProps> = ({
  currentUser,
  onOpenAuthModal,
  activeRoom,
  participants,
  messages,
  isRoomHost,
  currentMode,
  focusMinutes,
  shortBreakMinutes,
  longBreakMinutes,
  defaultSubjectLabel,
  defaultTaskLabel,
  roomError,
  onClearRoomError,
  onRoomJoined,
  onRoomExited,
  onClosePanel,
}) => {
  const [roomNameDraft, setRoomNameDraft] = useState<string>('Sala de Enfoque Conjunto');
  const [roomSubjectDraft, setRoomSubjectDraft] = useState<string>(defaultSubjectLabel || '');
  const [isPublicDraft, setIsPublicDraft] = useState<boolean>(true);
  const [displayNameDraft, setDisplayNameDraft] = useState<string>(() =>
    deriveSafeDisplayName(currentUser?.displayName, currentUser?.email)
  );
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [publicRooms, setPublicRooms] = useState<PomodoroRoom[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const [myTaskDraft, setMyTaskDraft] = useState<string>(defaultTaskLabel || '');
  const [noteInput, setNoteInput] = useState<string>('');

  useEffect(() => {
    if (currentUser) {
      setDisplayNameDraft((prev) =>
        prev && prev !== 'Estudiante'
          ? prev
          : deriveSafeDisplayName(currentUser.displayName, currentUser.email)
      );
    }
  }, [currentUser]);

  useEffect(() => {
    if (!activeRoom && defaultSubjectLabel && !roomSubjectDraft) {
      setRoomSubjectDraft(defaultSubjectLabel);
    }
  }, [defaultSubjectLabel, activeRoom, roomSubjectDraft]);

  useEffect(() => {
    if (defaultTaskLabel) {
      setMyTaskDraft(defaultTaskLabel);
    }
  }, [defaultTaskLabel]);

  // Listen to open public rooms while logged in and not yet inside a room
  useEffect(() => {
    if (!currentUser || activeRoom) {
      setPublicRooms([]);
      return;
    }
    const unsub = subscribeToPublicRooms(
      (rooms) => setPublicRooms(rooms),
      () => setPublicRooms([])
    );
    return () => unsub();
  }, [currentUser, activeRoom]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearRoomError();
    setIsSubmitting(true);
    try {
      const created = await createPomodoroRoom({
        name: roomNameDraft.trim() || 'Sala de Estudio',
        subjectLabel: roomSubjectDraft.trim() || defaultSubjectLabel || 'Estudio libre',
        isPublic: isPublicDraft,
        focusMinutes,
        shortBreakMinutes,
        longBreakMinutes,
        mode: currentMode,
        displayName: displayNameDraft,
        currentTask: myTaskDraft || defaultTaskLabel || 'Enfoque conjunto',
      });
      onRoomJoined(created);
    } catch (err: any) {
      setLocalError(err?.message || 'No se pudo crear la sala virtual.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinByCode = async (codeToJoin: string) => {
    setLocalError(null);
    onClearRoomError();
    if (!codeToJoin.trim()) {
      setLocalError('Introduce el código de la sala (por ejemplo, STF-4K9A).');
      return;
    }
    setIsSubmitting(true);
    try {
      const joined = await joinPomodoroRoom({
        roomCode: codeToJoin,
        displayName: displayNameDraft,
        currentTask: myTaskDraft || defaultTaskLabel || 'Estudio general',
      });
      setJoinCodeInput('');
      onRoomJoined(joined);
    } catch (err: any) {
      setLocalError(err?.message || 'No se pudo acceder a la sala.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!activeRoom) return;
    try {
      await navigator.clipboard.writeText(activeRoom.id);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleLeaveOrClose = async () => {
    if (!activeRoom || !currentUser) {
      onRoomExited();
      return;
    }
    setIsSubmitting(true);
    try {
      if (isRoomHost) {
        await closePomodoroRoom(activeRoom.id);
      } else {
        await leavePomodoroRoom(activeRoom.id, currentUser.uid);
      }
      onRoomExited();
    } catch (err: any) {
      setLocalError(err?.message || 'No se pudo cerrar o abandonar la sala.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveOnlyAsHost = async () => {
    if (!activeRoom || !currentUser) return;
    setIsSubmitting(true);
    try {
      await leavePomodoroRoom(activeRoom.id, currentUser.uid);
      onRoomExited();
    } catch {
      onRoomExited();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveMyTask = async () => {
    if (!activeRoom || !currentUser) return;
    await updateParticipantStatus(activeRoom.id, currentUser.uid, {
      currentTask: myTaskDraft || 'Estudio general',
    });
  };

  const handleSendNote = async (textToSend: string, kind: 'message' | 'cheer' = 'message') => {
    if (!activeRoom || !currentUser) return;
    const clean = textToSend.trim();
    if (!clean) return;
    const senderName = deriveSafeDisplayName(
      displayNameDraft || currentUser.displayName,
      currentUser.email
    );
    if (kind === 'message') setNoteInput('');
    await sendRoomNote({
      roomId: activeRoom.id,
      authorName: senderName,
      text: clean,
      kind,
    });
  };

  const displayError = localError || roomError;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-sm p-5 sm:p-6 space-y-5 animate-in fade-in duration-200">
      {/* Cabecera de la sección */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-xs shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {activeRoom ? activeRoom.name : 'Salas Virtuales de Estudio Sincronizadas'}
              </h4>
              {activeRoom && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>En vivo · {participants.length} conectados</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeRoom
                ? isRoomHost
                  ? 'Eres el anfitrión: iniciar, pausar o cambiar de fase sincroniza el reloj de todos en la sala.'
                  : `Tu reloj está sincronizado en tiempo real con ${activeRoom.hostName}.`
                : 'Opcional: crea o únete a una sala para estudiar simultáneamente con el mismo cronómetro.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeRoom && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-mono-numbers font-bold transition-colors cursor-pointer"
              title="Copiar código para invitar a otros estudiantes"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedCode ? '¡Código copiado!' : activeRoom.id}</span>
            </button>
          )}

          {!activeRoom && (
            <button
              type="button"
              onClick={onClosePanel}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cerrar panel de salas grupales"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {displayError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <span>{displayError}</span>
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              onClearRoomError();
            }}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Caso 1: Usuario no autenticado */}
      {!currentUser ? (
        <div className="p-6 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h5 className="text-sm font-bold text-slate-900 dark:text-white">
              Inicia sesión para crear o unirte a una sala compartida
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Las salas sincronizan el cronómetro Pomodoro, los participantes conectados y su progreso en tiempo real entre distintos dispositivos mediante tu cuenta de StudyFlow.
            </p>
          </div>
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>Iniciar sesión</span>
            </button>
          )}
        </div>
      ) : !activeRoom ? (
        /* Caso 2: Lobby — Crear sala o Unirse a una existente */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Crear sala */}
          <form
            onSubmit={handleCreateRoom}
            className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Crear Nueva Sala</span>
              </h5>
              <span className="text-[11px] font-mono-numbers text-slate-500">
                Ritmo {focusMinutes}/{shortBreakMinutes}/{longBreakMinutes}m
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nombre de la sala
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={roomNameDraft}
                  onChange={(e) => setRoomNameDraft(e.target.value)}
                  placeholder="Ej. Repaso Final"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tu nombre visible
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={displayNameDraft}
                  onChange={(e) => setDisplayNameDraft(e.target.value)}
                  placeholder="Tu nombre o alias"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Temática u objetivo
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={roomSubjectDraft}
                  onChange={(e) => setRoomSubjectDraft(e.target.value)}
                  placeholder="Ej. Oposiciones / Física"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Privacidad
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIsPublicDraft(true)}
                    className={`py-1 px-2 rounded-lg font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                      isPublicDraft
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    <span>Abierta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublicDraft(false)}
                    className={`py-1 px-2 rounded-lg font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                      !isPublicDraft
                        ? 'bg-slate-800 dark:bg-slate-700 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Código</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creando sala...' : 'Crear Sala y Generar Código'}</span>
            </button>
          </form>

          {/* Unirse por código o a salas abiertas */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-blue-600" />
                <span>Unirse con Código de Sala</span>
              </h5>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={24}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="Ej. STF-4K9A"
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono-numbers font-bold uppercase tracking-wider text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleJoinByCode(joinCodeInput)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-extrabold cursor-pointer shrink-0"
                >
                  Unirse
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Salas abiertas activas ({publicRooms.length})</span>
                </span>
              </div>

              {publicRooms.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-3 text-center">
                  No hay salas públicas activas ahora mismo. Crea la primera o introduce un código privado.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                  {publicRooms.map((r) => (
                    <div
                      key={r.id}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {r.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 font-mono-numbers">
                          <span>{r.hostName}</span>
                          <span>·</span>
                          <span>{r.subjectLabel}</span>
                          <span>·</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {r.focusMinutes}/{r.shortBreakMinutes}m
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleJoinByCode(r.id)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Entrar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Caso 3: Sala Activa Sincronizada */
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Lista de participantes en vivo */}
            <div className="lg:col-span-7 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Estudiando juntos ({participants.length})</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                  {activeRoom.subjectLabel} · Ciclo #{activeRoom.cycleCount + 1}
                </span>
              </div>

              {/* Mi tarea actual visible para el grupo */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={120}
                    value={myTaskDraft}
                    onChange={(e) => setMyTaskDraft(e.target.value)}
                    onBlur={handleSaveMyTask}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveMyTask();
                      }
                    }}
                    placeholder="¿Qué asignatura o tema estás estudiando ahora?"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveMyTask}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                >
                  Actualizar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5">
                {participants.map((p) => {
                  const isSelf = p.userId === currentUser.uid;
                  const isParticipantHost = p.userId === activeRoom.hostUid;
                  const initial = (p.displayName || 'E').charAt(0).toUpperCase();

                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                        isSelf
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/35 border-indigo-200 dark:border-indigo-800'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white truncate">
                          <span className="truncate">
                            {p.displayName}
                            {isSelf ? ' (Tú)' : ''}
                          </span>
                          {isParticipantHost && (
                            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                              · Anfitrión
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {p.currentTask || 'Estudio general'}
                        </div>
                      </div>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          activeRoom.isRunning
                            ? activeRoom.mode === 'focus'
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-emerald-500'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                        title={
                          activeRoom.isRunning
                            ? activeRoom.mode === 'focus'
                              ? 'En bloque de enfoque'
                              : 'En descanso'
                            : 'En espera'
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Muro rápido de ánimos / check-ins */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Ánimos y Check-ins</span>
                </span>
                <div className="flex items-center gap-1">
                  {[
                    { label: '🔥 ¡Vamos!', text: '🔥 ¡A por este bloque!' },
                    { label: '🎯 Meta', text: '🎯 Meta del bloque lista' },
                    { label: '☕ Pausa', text: '☕ Hora de descansar' },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleSendNote(chip.text, 'cheer')}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-[10px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 max-h-36 min-h-[96px] overflow-y-auto space-y-1.5 pr-0.5">
                {messages.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-6">
                    Envía un saludo breve o comparte qué meta vas a completar en este bloque.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] ${
                        msg.kind === 'cheer'
                          ? 'bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200/70 dark:border-amber-800/50 text-amber-950 dark:text-amber-200'
                          : 'bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className="font-bold text-indigo-700 dark:text-indigo-400 mr-1.5">
                        {msg.authorName}:
                      </span>
                      <span>{msg.text}</span>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendNote(noteInput, 'message');
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  maxLength={240}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Mensaje breve al grupo..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!noteInput.trim()}
                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white cursor-pointer"
                  title="Enviar mensaje"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>

          {/* Pie de sala con controles de salida */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Comparte el código <strong className="font-mono-numbers text-indigo-600 dark:text-indigo-400">{activeRoom.id}</strong> para estudiar juntos.
            </span>
            <div className="flex items-center gap-2">
              {isRoomHost && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleLeaveOnlyAsHost}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Salir sin cerrar</span>
                </button>
              )}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleLeaveOrClose}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer ${
                  isRoomHost
                    ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {isRoomHost ? <Power className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                <span>{isRoomHost ? 'Cerrar sala para todos' : 'Salir de la sala'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
