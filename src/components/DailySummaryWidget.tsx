import React, { useState } from 'react';
import {
  Clock,
  Target,
  CheckCircle2,
  Plus,
  Minus,
  Settings,
  Play,
  BookOpen,
  PlusCircle,
  X,
} from 'lucide-react';
import { PomodoroLog, Subject, StudyPreferences } from '../types';

interface DailySummaryWidgetProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  preferences?: StudyPreferences;
  streakDays?: number;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  onOpenPreferences?: () => void;
  onLogStudySession?: (log: PomodoroLog) => void;
  onStartPomodoro?: (subjectId?: string) => void;
  onSelectSubject?: (subjectId: string) => void;
}

export const DailySummaryWidget: React.FC<DailySummaryWidgetProps> = ({
  subjects,
  pomodoroLogs = [],
  preferences,
  streakDays = 0,
  onUpdatePreferences,
  onOpenPreferences,
  onLogStudySession,
  onStartPomodoro,
  onSelectSubject,
}) => {
  const [showManualLogForm, setShowManualLogForm] = useState(false);
  const [manualSubjectId, setManualSubjectId] = useState<string>(subjects[0]?.id || '');
  const [manualMinutes, setManualMinutes] = useState<number>(30);
  const [manualNote, setManualNote] = useState<string>('');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentDayOfWeek = now.getDay();

  const formattedToday = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  const todayLogs = pomodoroLogs.filter((log) => {
    if (!log) return false;
    if (log.date === todayStr) return true;
    if (log.timestamp && log.timestamp.startsWith(todayStr)) return true;
    return false;
  });

  const studiedMinutesToday = todayLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
  const studiedHoursWhole = Math.floor(studiedMinutesToday / 60);
  const studiedMinutesRemainder = studiedMinutesToday % 60;
  const studiedDisplayDecimal = Math.round((studiedMinutesToday / 60) * 10) / 10;

  const configuredDailyGoalHours =
    preferences?.dailyGoalHours ??
    preferences?.hoursPerDay?.[currentDayOfWeek] ??
    3;

  const targetMinutes = Math.max(15, Math.round(configuredDailyGoalHours * 60));
  const targetHoursWhole = Math.floor(targetMinutes / 60);
  const targetMinutesRemainder = targetMinutes % 60;

  const rawPercentage = targetMinutes > 0 ? Math.round((studiedMinutesToday / targetMinutes) * 100) : 0;
  const clampedPercentage = Math.min(100, Math.max(0, rawPercentage));
  const isGoalReached = studiedMinutesToday >= targetMinutes && targetMinutes > 0;

  const remainingMinutes = Math.max(0, targetMinutes - studiedMinutesToday);
  const remainingHoursWhole = Math.floor(remainingMinutes / 60);
  const remainingMinutesRemainder = remainingMinutes % 60;

  // Breakdown by subject today
  const subjectBreakdownMap = new Map<
    string,
    { subjectId: string; subjectName: string; color: string; minutes: number; sessions: number }
  >();

  todayLogs.forEach((log) => {
    const matchedSub = subjects.find((s) => s.id === log.subjectId);
    const key = log.subjectId || log.subjectName || 'general';
    const existing = subjectBreakdownMap.get(key);
    if (existing) {
      existing.minutes += log.durationMinutes || 0;
      existing.sessions += 1;
    } else {
      subjectBreakdownMap.set(key, {
        subjectId: log.subjectId,
        subjectName: matchedSub?.name || log.subjectName || 'Estudio General',
        color: matchedSub?.color || '#3b82f6',
        minutes: log.durationMinutes || 0,
        sessions: 1,
      });
    }
  });

  const subjectBreakdown = Array.from(subjectBreakdownMap.values()).sort(
    (a, b) => b.minutes - a.minutes
  );

  const handleAdjustDailyGoal = (deltaHours: number) => {
    if (!preferences || !onUpdatePreferences) return;
    const nextGoal = Math.max(
      0.5,
      Math.min(14, Math.round((configuredDailyGoalHours + deltaHours) * 2) / 2)
    );
    onUpdatePreferences({
      ...preferences,
      dailyGoalHours: nextGoal,
      hoursPerDay: {
        ...(preferences.hoursPerDay || {}),
        [currentDayOfWeek]: nextGoal,
      },
    });
  };

  const handleManualLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLogStudySession || manualMinutes <= 0) return;

    const targetSub = subjects.find((s) => s.id === manualSubjectId) || subjects[0];
    const newLog: PomodoroLog = {
      id: `manual_log_${Date.now()}`,
      subjectId: targetSub?.id || 'general',
      subjectName: targetSub?.name || 'Estudio del Curso',
      topicTitle: manualNote.trim() || 'Registro manual',
      durationMinutes: manualMinutes,
      date: todayStr,
      timestamp: new Date().toISOString(),
    };

    onLogStudySession(newLog);
    setManualNote('');
    setShowManualLogForm(false);
  };

  const ringSize = 96;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  const formatHoursMinutes = (h: number, m: number) => {
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  return (
    <section
      aria-label="Resumen Diario de Estudio"
      className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 shadow-2xs ring-1 ring-slate-900/5 dark:ring-white/10 space-y-6"
    >
      {/* Minimal Header Row (no bottom border) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <h3 className="font-semibold tracking-tight text-slate-900 dark:text-white text-sm">
            Resumen Diario
          </h3>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{formattedToday}</span>
          {streakDays > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono-numbers text-amber-600 dark:text-amber-400 font-medium">
                🔥 {streakDays} {streakDays === 1 ? 'día racha' : 'días racha'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onLogStudySession && (
            <button
              type="button"
              onClick={() => setShowManualLogForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Registrar tiempo</span>
            </button>
          )}

          {onOpenPreferences && (
            <button
              type="button"
              onClick={onOpenPreferences}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Configurar meta diaria en Preferencias"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Meta</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Manual Study Time Logger (borderless tonal surface) */}
      {showManualLogForm && (
        <form
          onSubmit={handleManualLogSubmit}
          className="p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Asignatura
            </label>
            <select
              value={manualSubjectId}
              onChange={(e) => setManualSubjectId(e.target.value)}
              className="w-full text-xs bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 ring-1 ring-slate-900/10 dark:ring-white/10 focus:outline-none"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
              {subjects.length === 0 && <option value="general">Estudio General</option>}
            </select>
          </div>

          <div className="w-32">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Duración
            </label>
            <select
              value={manualMinutes}
              onChange={(e) => setManualMinutes(Number(e.target.value))}
              className="w-full text-xs bg-white dark:bg-slate-900 rounded-lg px-3 py-2 font-mono-numbers font-medium text-slate-800 dark:text-slate-100 ring-1 ring-slate-900/10 dark:ring-white/10 focus:outline-none"
            >
              <option value={15}>15 min</option>
              <option value={25}>25 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1h 00m</option>
              <option value={90}>1h 30m</option>
              <option value={120}>2h 00m</option>
              <option value={180}>3h 00m</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Nota (opcional)
            </label>
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Ej. Apuntes, ejercicios..."
              className="w-full text-xs bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 ring-1 ring-slate-900/10 dark:ring-white/10 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setShowManualLogForm(false)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Progress Ring + Studied Hours vs Daily Goal */}
        <div className="lg:col-span-7 flex flex-col sm:flex-row items-center gap-6">
          <div
            className="relative shrink-0 flex items-center justify-center"
            style={{ width: ringSize, height: ringSize }}
          >
            <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${ringSize} ${ringSize}`}>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-slate-100 dark:text-slate-800"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`transition-all duration-500 ${
                  isGoalReached
                    ? 'text-emerald-500'
                    : rawPercentage >= 50
                    ? 'text-blue-600 dark:text-blue-500'
                    : 'text-amber-500'
                }`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-lg font-semibold font-mono-numbers text-slate-900 dark:text-white leading-none">
                {rawPercentage}%
              </span>
              <span className="text-xs font-mono-numbers text-slate-400 dark:text-slate-500 mt-0.5">
                {studiedDisplayDecimal}h/{configuredDailyGoalHours}h
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Estudiado hoy frente a tu meta diaria
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-semibold tracking-tight font-mono-numbers text-slate-900 dark:text-white">
                    {formatHoursMinutes(studiedHoursWhole, studiedMinutesRemainder)}
                  </span>
                  <span className="text-sm text-slate-400 font-mono-numbers">
                    / {formatHoursMinutes(targetHoursWhole, targetMinutesRemainder)}
                  </span>
                </div>
              </div>

              {/* Borderless Quick +/- 0.5h Daily Goal Adjuster */}
              {onUpdatePreferences && preferences && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Meta:</span>
                  <button
                    type="button"
                    onClick={() => handleAdjustDailyGoal(-0.5)}
                    className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    title="Reducir meta diaria en 0.5h"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono-numbers font-semibold text-slate-800 dark:text-slate-200 min-w-[32px] text-center">
                    {configuredDailyGoalHours}h
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustDailyGoal(0.5)}
                    className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    title="Aumentar meta diaria en 0.5h"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Linear Progress Bar */}
            <div className="space-y-2">
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isGoalReached
                      ? 'bg-emerald-500'
                      : rawPercentage >= 50
                      ? 'bg-blue-600'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${clampedPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {isGoalReached ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ¡Meta diaria superada!
                    </span>
                  ) : (
                    <>
                      Restan{' '}
                      <strong className="font-mono-numbers font-semibold text-slate-800 dark:text-slate-200">
                        {formatHoursMinutes(remainingHoursWhole, remainingMinutesRemainder)}
                      </strong>{' '}
                      para tu objetivo de hoy
                    </>
                  )}
                </span>
                <span className="font-mono-numbers">
                  {todayLogs.length} {todayLogs.length === 1 ? 'sesión' : 'sesiones'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Subject Breakdown Today */}
        <div className="lg:col-span-5 lg:border-l lg:border-slate-100 dark:lg:border-slate-800/70 lg:pl-8">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Materias estudiadas hoy
            </span>
            {onStartPomodoro && (
              <button
                type="button"
                onClick={() => onStartPomodoro(subjects[0]?.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Enfocar ahora</span>
              </button>
            )}
          </div>

          {subjectBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-2 leading-relaxed">
              Sin sesiones registradas hoy. Inicia un ciclo abajo o usa «Registrar tiempo».
            </p>
          ) : (
            <div className="divide-y divide-slate-100/80 dark:divide-slate-800/60 max-h-28 overflow-y-auto pr-1">
              {subjectBreakdown.map((item) => {
                const itemHours = Math.floor(item.minutes / 60);
                const itemRemMins = item.minutes % 60;
                return (
                  <div
                    key={item.subjectId + item.subjectName}
                    onClick={() =>
                      item.subjectId && onSelectSubject && onSelectSubject(item.subjectId)
                    }
                    className="py-2 px-2 rounded-lg hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-2 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                        {item.subjectName}
                      </span>
                    </div>
                    <span className="font-mono-numbers font-medium text-slate-600 dark:text-slate-300 shrink-0">
                      {formatHoursMinutes(itemHours, itemRemMins)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
