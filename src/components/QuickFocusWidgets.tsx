import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Flame,
  Coffee,
  Brain,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Timer,
  Check,
  Headphones,
  FastForward,
  Sliders,
  Target,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Subject, PomodoroLog, StudyPreferences } from '../types';
import { notificationService } from '../services/notificationService';
import {
  ambientAudioService,
  AMBIENT_SOUND_OPTIONS,
  AmbientSoundType,
} from '../services/ambientAudioService';

export interface QuickFocusPreset {
  id: string;
  name: string;
  badge: string;
  focusMinutes: number;
  breakMinutes: number;
  description: string;
  icon: 'zap' | 'flame' | 'brain' | 'sparkles' | 'target';
}

const DEFAULT_PRESETS: QuickFocusPreset[] = [
  {
    id: 'express-10',
    name: 'Repaso Express',
    badge: '10 / 2m',
    focusMinutes: 10,
    breakMinutes: 2,
    description: 'Flashcards o lectura rápida',
    icon: 'zap',
  },
  {
    id: 'sprint-15',
    name: 'Sprint Ágil',
    badge: '15 / 3m',
    focusMinutes: 15,
    breakMinutes: 3,
    description: 'Ejercicios cortos o inicio rápido',
    icon: 'sparkles',
  },
  {
    id: 'classic-25',
    name: 'Pomodoro Clásico',
    badge: '25 / 5m',
    focusMinutes: 25,
    breakMinutes: 5,
    description: 'Ciclo tradicional equilibrado',
    icon: 'flame',
  },
  {
    id: 'deep-52',
    name: 'Flujo Profundo',
    badge: '52 / 17m',
    focusMinutes: 52,
    breakMinutes: 17,
    description: 'Estudio intenso y apuntes',
    icon: 'brain',
  },
  {
    id: 'exam-90',
    name: 'Bloque Intensivo',
    badge: '90 / 20m',
    focusMinutes: 90,
    breakMinutes: 20,
    description: 'Simulacro o práctica completa',
    icon: 'target',
  },
];

interface QuickFocusWidgetsProps {
  subjects: Subject[];
  preferences?: StudyPreferences;
  pomodoroLogs?: PomodoroLog[];
  onSessionComplete?: (log: PomodoroLog) => void;
  onOpenFullPomodoro: (subjectId: string, topicId?: string) => void;
}

export const QuickFocusWidgets: React.FC<QuickFocusWidgetsProps> = ({
  subjects,
  preferences,
  pomodoroLogs = [],
  onSessionComplete,
  onOpenFullPomodoro,
}) => {
  const userFocusDefault = preferences?.pomodoroConfig?.focusMinutes || 25;
  const initialPreset =
    DEFAULT_PRESETS.find((p) => p.focusMinutes === userFocusDefault) || DEFAULT_PRESETS[2];

  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPreset.id);
  const [focusMinutes, setFocusMinutes] = useState<number>(initialPreset.focusMinutes);
  const [breakMinutes, setBreakMinutes] = useState<number>(initialPreset.breakMinutes);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(initialPreset.focusMinutes * 60);
  const [totalCycleSeconds, setTotalCycleSeconds] = useState<number>(
    initialPreset.focusMinutes * 60
  );
  const [isActive, setIsActive] = useState<boolean>(false);
  const [autoStartNextCycle, setAutoStartNextCycle] = useState<boolean>(false);
  const [completedCyclesInStreak, setCompletedCyclesInStreak] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>('none');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [justCompletedMessage, setJustCompletedMessage] = useState<string | null>(null);
  const [showExtraOptions, setShowExtraOptions] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (subjects.length > 0 && !subjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0].id);
      setSelectedTopicId('');
    }
  }, [subjects, selectedSubjectId]);

  useEffect(() => {
    if (isActive && mode === 'focus' && ambientSound !== 'none') {
      ambientAudioService.play(ambientSound);
    } else {
      ambientAudioService.stop();
    }
    return () => {
      ambientAudioService.stop();
    };
  }, [isActive, mode, ambientSound]);

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
  const currentTopic = currentSubject?.topics.find((t) => t.id === selectedTopicId);

  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.1);
    } catch {
      // Ignore autoplay errors
    }
  };

  useEffect(() => {
    if (isActive && timeLeftSeconds > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeftSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (isActive && timeLeftSeconds === 0) {
      playChime();
      const shouldNotifyBreaks = preferences?.notifyPomodoroBreaks ?? true;

      if (mode === 'focus') {
        const completedMins = Math.max(1, Math.round(totalCycleSeconds / 60));
        if (shouldNotifyBreaks) {
          notificationService.notifyPomodoro('focus', currentTopic?.title);
        }

        if (onSessionComplete && currentSubject) {
          onSessionComplete({
            id: `qf-pomo-${Date.now()}`,
            subjectId: currentSubject.id,
            subjectName: currentSubject.name,
            topicTitle: currentTopic?.title || 'Estudio general',
            date: new Date().toISOString().split('T')[0],
            durationMinutes: completedMins,
            timestamp: new Date().toISOString(),
          });
        }

        setCompletedCyclesInStreak((prev) => prev + 1);
        setJustCompletedMessage(
          `¡+${completedMins} min registrados en ${currentSubject?.name || 'tu estudio'}!`
        );
        window.setTimeout(() => setJustCompletedMessage(null), 5000);

        setMode('break');
        setTotalCycleSeconds(breakMinutes * 60);
        setTimeLeftSeconds(breakMinutes * 60);
        setIsActive(autoStartNextCycle);
      } else {
        if (shouldNotifyBreaks) {
          notificationService.notifyPomodoro('shortBreak', currentTopic?.title);
        }
        setJustCompletedMessage('¡Descanso terminado! Listo para enfocar.');
        window.setTimeout(() => setJustCompletedMessage(null), 4000);

        setMode('focus');
        setTotalCycleSeconds(focusMinutes * 60);
        setTimeLeftSeconds(focusMinutes * 60);
        setIsActive(autoStartNextCycle);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    isActive,
    timeLeftSeconds,
    mode,
    totalCycleSeconds,
    focusMinutes,
    breakMinutes,
    selectedSubjectId,
    currentSubject,
    currentTopic,
    onSessionComplete,
    preferences?.notifyPomodoroBreaks,
    autoStartNextCycle,
  ]);

  const handleSelectAndStartPreset = (preset: QuickFocusPreset, autoStart: boolean = true) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedPresetId(preset.id);
    setFocusMinutes(preset.focusMinutes);
    setBreakMinutes(preset.breakMinutes);
    setMode('focus');
    const newTotalSeconds = preset.focusMinutes * 60;
    setTotalCycleSeconds(newTotalSeconds);
    setTimeLeftSeconds(newTotalSeconds);
    setIsActive(autoStart);
    setJustCompletedMessage(null);
  };

  const handleAdjustMinutes = (deltaMinutes: number) => {
    const deltaSeconds = deltaMinutes * 60;
    setTimeLeftSeconds((prev) => Math.max(60, Math.min(180 * 60, prev + deltaSeconds)));
    setTotalCycleSeconds((prevTotal) => {
      const nextTotal = Math.max(60, Math.min(180 * 60, prevTotal + deltaSeconds));
      return Math.max(nextTotal, timeLeftSeconds + deltaSeconds);
    });
    if (mode === 'focus') {
      setFocusMinutes((prev) => Math.max(1, Math.min(180, prev + deltaMinutes)));
    } else {
      setBreakMinutes((prev) => Math.max(1, Math.min(60, prev + deltaMinutes)));
    }
    setSelectedPresetId('custom');
  };

  const handleSetExactMinutes = (newMinutes: number) => {
    const clamped = Math.max(1, Math.min(180, newMinutes));
    const newSeconds = clamped * 60;
    if (mode === 'focus') {
      setFocusMinutes(clamped);
    } else {
      setBreakMinutes(clamped);
    }
    setTotalCycleSeconds(newSeconds);
    setTimeLeftSeconds(newSeconds);
    setSelectedPresetId('custom');
  };

  const handleReset = () => {
    setIsActive(false);
    const targetMins = mode === 'focus' ? focusMinutes : breakMinutes;
    setTotalCycleSeconds(targetMins * 60);
    setTimeLeftSeconds(targetMins * 60);
  };

  const handleSwitchMode = (targetMode: 'focus' | 'break') => {
    setIsActive(false);
    setMode(targetMode);
    const targetMins = targetMode === 'focus' ? focusMinutes : breakMinutes;
    setTotalCycleSeconds(targetMins * 60);
    setTimeLeftSeconds(targetMins * 60);
  };

  const handleFinishEarlyAndLog = () => {
    if (mode !== 'focus') {
      handleSwitchMode('focus');
      return;
    }
    const elapsedSeconds = Math.max(0, totalCycleSeconds - timeLeftSeconds);
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    setIsActive(false);
    playChime();

    if (onSessionComplete && currentSubject) {
      onSessionComplete({
        id: `qf-pomo-${Date.now()}`,
        subjectId: currentSubject.id,
        subjectName: currentSubject.name,
        topicTitle: currentTopic?.title || 'Estudio general',
        date: new Date().toISOString().split('T')[0],
        durationMinutes: elapsedMinutes,
        timestamp: new Date().toISOString(),
      });
    }

    setCompletedCyclesInStreak((prev) => prev + 1);
    setJustCompletedMessage(`¡Sesión registrada (+${elapsedMinutes} min)!`);
    window.setTimeout(() => setJustCompletedMessage(null), 4500);

    setTotalCycleSeconds(focusMinutes * 60);
    setTimeLeftSeconds(focusMinutes * 60);
  };

  const displayMinutes = Math.floor(timeLeftSeconds / 60);
  const displaySeconds = timeLeftSeconds % 60;
  const formattedTime = `${String(displayMinutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}`;
  const dynamicRemainingMinutesCeiling = Math.ceil(timeLeftSeconds / 60);
  const elapsedSecondsInSession = Math.max(0, totalCycleSeconds - timeLeftSeconds);
  const elapsedMinutesInSession = Math.floor(elapsedSecondsInSession / 60);
  const progressPercentage =
    totalCycleSeconds > 0
      ? Math.min(100, Math.max(0, (elapsedSecondsInSession / totalCycleSeconds) * 100))
      : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = pomodoroLogs.filter(
    (l) => l.date === todayStr || (l.timestamp && l.timestamp.startsWith(todayStr))
  );
  const loggedTodayMinutes = todayLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const liveTodayMinutes = loggedTodayMinutes + (mode === 'focus' ? elapsedMinutesInSession : 0);

  return (
    <div
      id="quick-focus-widgets-panel"
      className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 shadow-2xs ring-1 ring-slate-900/5 dark:ring-white/10 space-y-6"
    >
      {/* Minimal Header Bar (no bottom border) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Timer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold tracking-tight text-slate-900 dark:text-white text-sm">
            Enfoque Rápido Pomodoro
          </h3>
          <span aria-hidden="true">·</span>
          <span className="font-mono-numbers">
            Hoy: <strong className="font-semibold text-slate-800 dark:text-slate-200">{liveTodayMinutes} min</strong>
          </span>
          {completedCyclesInStreak > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono-numbers">
                {completedCyclesInStreak} {completedCyclesInStreak === 1 ? 'ciclo' : 'ciclos'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowExtraOptions((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <span>Opciones</span>
            {showExtraOptions ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenFullPomodoro(selectedSubjectId, selectedTopicId || undefined)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Abrir modo Pomodoro a pantalla completa"
          >
            <span>Modo Enfoque</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {justCompletedMessage && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{justCompletedMessage}</span>
        </div>
      )}

      {/* Main Unified Control Row: Clock + Dynamic Minute Adjuster + Subject + Play/Pause */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* 1. Digital Timer & Mode Switch (4 cols) */}
        <div className="lg:col-span-4 flex items-center gap-4">
          <div className="text-3xl font-semibold font-mono-numbers tracking-tight text-slate-900 dark:text-white min-w-[92px]">
            {formattedTime}
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center bg-slate-100/80 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => handleSwitchMode('focus')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  mode === 'focus'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                Foco ({focusMinutes}m)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('break')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  mode === 'break'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                Pausa ({breakMinutes}m)
              </button>
            </div>
            <div className="text-xs font-mono-numbers text-slate-400">
              {dynamicRemainingMinutesCeiling} min restantes
            </div>
          </div>
        </div>

        {/* 2. Dynamic Minute Adjuster Slider & Borderless Quick +/- Buttons (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Ajustar minutos
            </span>
            <div className="flex items-center gap-1 font-mono-numbers text-xs">
              <button
                type="button"
                onClick={() => handleAdjustMinutes(-5)}
                disabled={timeLeftSeconds <= 300}
                className="px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
              >
                -5m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(-1)}
                disabled={timeLeftSeconds <= 60}
                className="px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
              >
                -1m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(1)}
                className="px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium cursor-pointer transition-colors"
              >
                +1m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(5)}
                className="px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium cursor-pointer transition-colors"
              >
                +5m
              </button>
            </div>
          </div>

          <input
            type="range"
            min={1}
            max={mode === 'focus' ? 120 : 45}
            value={dynamicRemainingMinutesCeiling}
            onChange={(e) => handleSetExactMinutes(parseInt(e.target.value, 10) || 25)}
            className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
            title="Desliza para regular los minutos del contador"
          />
        </div>

        {/* 3. Subject Selector + Primary Play/Pause Action (4 cols) */}
        <div className="lg:col-span-4 flex items-center gap-2">
          {subjects.length > 0 && (
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedTopicId('');
              }}
              className="flex-1 min-w-0 text-xs font-medium bg-slate-50 dark:bg-slate-800/80 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 ring-1 ring-slate-900/5 dark:ring-white/10 focus:outline-none"
              title="Asignatura activa"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsActive((prev) => !prev)}
            className={`px-4 py-2 rounded-xl font-semibold text-xs text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              isActive
                ? 'bg-amber-500 hover:bg-amber-600'
                : mode === 'focus'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{timeLeftSeconds < totalCycleSeconds ? 'Reanudar' : 'Iniciar'}</span>
              </>
            )}
          </button>

          {mode === 'focus' && timeLeftSeconds < totalCycleSeconds && (
            <button
              type="button"
              onClick={handleFinishEarlyAndLog}
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer transition-colors"
              title="Finalizar ahora y registrar minutos estudiados"
            >
              <Check className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            title="Reiniciar contador"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: 5 Preconfigured Cycles Strip (Borderless tonal tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {DEFAULT_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          const isRunningThis = isSelected && isActive;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (isRunningThis) {
                  setIsActive(false);
                } else {
                  handleSelectAndStartPreset(preset, true);
                }
              }}
              className={`p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/30 dark:ring-blue-400/30'
                  : 'bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                  {preset.name}
                </span>
                <span className="text-xs font-mono-numbers font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                  {preset.badge}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 mt-1 text-xs text-slate-400 dark:text-slate-500">
                <span className="truncate">{preset.description}</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium shrink-0">
                  {isRunningThis ? '⏸' : '▶'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Collapsible Extra Options (Specific Topic, Ambient Sound, Auto-cycle, Sound Chime) */}
      {showExtraOptions && (
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Tema específico (opcional)
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 ring-1 ring-slate-900/10 dark:ring-white/10 focus:outline-none"
            >
              <option value="">General de la asignatura</option>
              {currentSubject?.topics.map((t, idx) => (
                <option key={t.id} value={t.id}>
                  T{idx + 1}: {t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Sonido ambiente de concentración
            </label>
            <select
              value={ambientSound}
              onChange={(e) => setAmbientSound(e.target.value as AmbientSoundType)}
              className="w-full bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 ring-1 ring-slate-900/10 dark:ring-white/10 focus:outline-none"
            >
              {AMBIENT_SOUND_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setAutoStartNextCycle((prev) => !prev)}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors cursor-pointer ${
                autoStartNextCycle
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 ring-1 ring-slate-900/10 dark:ring-white/10'
              }`}
            >
              Auto-ciclo: {autoStartNextCycle ? 'Activado' : 'Desactivado'}
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-slate-900/10 dark:ring-white/10 cursor-pointer"
              title={soundEnabled ? 'Sonido al finalizar activo' : 'Silenciado'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode(mode === 'focus' ? 'break' : 'focus')}
              className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 ring-1 ring-slate-900/10 dark:ring-white/10 cursor-pointer"
              title="Saltar fase (Foco ↔ Pausa)"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
