import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  Trophy,
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  Play,
  Target,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PomodoroLog, StudyPreferences } from '../types';

export interface StreakMilestone {
  days: number;
  title: string;
  subtitle: string;
  badgeColor: string;
  ringColor: string;
}

const STREAK_MILESTONES: StreakMilestone[] = [
  {
    days: 3,
    title: 'Chispa de Constancia',
    subtitle: '3 días seguidos estudiando',
    badgeColor: 'from-amber-400 to-orange-500',
    ringColor: 'text-amber-500',
  },
  {
    days: 7,
    title: 'Hábito Semanal',
    subtitle: '1 semana completa sin fallar',
    badgeColor: 'from-orange-500 to-red-500',
    ringColor: 'text-orange-500',
  },
  {
    days: 14,
    title: 'Disciplina de Acero',
    subtitle: '2 semanas de foco continuo',
    badgeColor: 'from-rose-500 to-purple-600',
    ringColor: 'text-rose-500',
  },
  {
    days: 30,
    title: 'Maestro del Mes',
    subtitle: '30 días de excelencia académica',
    badgeColor: 'from-purple-600 to-indigo-600',
    ringColor: 'text-purple-600',
  },
  {
    days: 60,
    title: 'Élite Imparable',
    subtitle: '60 días de estudio sostenido',
    badgeColor: 'from-indigo-600 to-blue-600',
    ringColor: 'text-indigo-600',
  },
  {
    days: 100,
    title: 'Leyenda Académica',
    subtitle: '100 días de racha histórica',
    badgeColor: 'from-emerald-500 to-teal-600',
    ringColor: 'text-emerald-500',
  },
];

interface DashboardStudyStreakCardProps {
  streakDays: number;
  todayMinutes: number;
  todayTopicsCount: number;
  pomodoroLogs: PomodoroLog[];
  preferences?: StudyPreferences;
  onStartPomodoro: () => void;
  onQuickLogMinutes?: (minutes: number) => void;
  onOpenStreakModal?: () => void;
}

export const DashboardStudyStreakCard: React.FC<DashboardStudyStreakCardProps> = ({
  streakDays,
  todayMinutes,
  todayTopicsCount,
  pomodoroLogs = [],
  onStartPomodoro,
  onQuickLogMinutes,
  onOpenStreakModal,
}) => {
  const [isCelebratingMilestone, setIsCelebratingMilestone] = useState(false);
  const [selectedPreviewMilestone, setSelectedPreviewMilestone] = useState<number | null>(null);

  // Minutos mínimos recomendados al día para mantener la racha activa (1 Pomodoro = 25 min o 1 tema completado)
  const minDailyMinutesToMaintain = 25;
  const isTodayStreakSecured =
    todayMinutes >= minDailyMinutesToMaintain || todayTopicsCount >= 1;
  const remainingMinutesToSecureToday = Math.max(
    0,
    minDailyMinutesToMaintain - todayMinutes
  );
  const todayMaintenancePct = isTodayStreakSecured
    ? 100
    : Math.min(99, Math.round((todayMinutes / minDailyMinutesToMaintain) * 100));

  // Hito actual alcanzado y próximo hito objetivo
  const { currentMilestone, nextMilestone, milestoneProgressPct, daysToNextMilestone } =
    useMemo(() => {
      const achieved = [...STREAK_MILESTONES]
        .reverse()
        .find((m) => streakDays >= m.days) || null;
      const upcoming =
        STREAK_MILESTONES.find((m) => streakDays < m.days) ||
        STREAK_MILESTONES[STREAK_MILESTONES.length - 1];

      const prevDays = achieved ? achieved.days : 0;
      const span = Math.max(1, upcoming.days - prevDays);
      const progressed = Math.max(0, streakDays - prevDays);
      const pct =
        streakDays >= upcoming.days
          ? 100
          : Math.min(100, Math.max(5, Math.round((progressed / span) * 100)));

      return {
        currentMilestone: achieved,
        nextMilestone: upcoming,
        milestoneProgressPct: pct,
        daysToNextMilestone: Math.max(0, upcoming.days - streakDays),
      };
    }, [streakDays]);

  // Últimos 7 días de actividad para mostrar la cadena visual de racha
  const last7DaysChain = useMemo(() => {
    const dayLetters = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const now = new Date();
    const result: Array<{
      dateStr: string;
      label: string;
      active: boolean;
      isToday: boolean;
      minutes: number;
    }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dStr = `${y}-${m}-${day}`;
      const isToday = i === 0;

      const loggedMins = pomodoroLogs
        .filter((l) => l.date === dStr)
        .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

      const isActiveByStreak = i < streakDays && (i > 0 || isTodayStreakSecured || streakDays > 0);

      result.push({
        dateStr: dStr,
        label: isToday ? 'Hoy' : dayLetters[d.getDay()],
        active: loggedMins > 0 || isActiveByStreak,
        isToday,
        minutes: isToday ? Math.max(loggedMins, todayMinutes) : loggedMins,
      });
    }
    return result;
  }, [pomodoroLogs, streakDays, isTodayStreakSecured, todayMinutes]);

  const triggerMilestoneCelebration = (milestoneDays?: number) => {
    if (milestoneDays) {
      setSelectedPreviewMilestone(milestoneDays);
    }
    setIsCelebratingMilestone(true);
    try {
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.65 },
      });
    } catch {
      // Fallback silencioso si canvas-confetti no está disponible en el entorno
    }
    setTimeout(() => {
      setIsCelebratingMilestone(false);
    }, 2800);
  };

  // Si el usuario está exactamente en un día de hito (3, 7, 14, 30, 60, 100), activar pulso de hito
  const isExactMilestoneDay = STREAK_MILESTONES.some((m) => m.days === streakDays);

  useEffect(() => {
    if (isExactMilestoneDay && isTodayStreakSecured) {
      setIsCelebratingMilestone(true);
      const timer = setTimeout(() => setIsCelebratingMilestone(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isExactMilestoneDay, isTodayStreakSecured]);

  const activeDisplayedMilestone =
    STREAK_MILESTONES.find((m) => m.days === selectedPreviewMilestone) ||
    currentMilestone ||
    nextMilestone;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 shadow-2xs flex flex-col justify-between space-y-4">
      {/* Animated Milestone Celebration Overlay Glow */}
      {isCelebratingMilestone && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-400/15 via-orange-500/15 to-rose-500/15 animate-pulse z-0" />
      )}

      {/* 1. Top Header: Current Streak Counter + Animated Flame + Milestone Badge */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          {/* Animated Flame & Ring */}
          <button
            type="button"
            onClick={() => triggerMilestoneCelebration(activeDisplayedMilestone.days)}
            className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${
              activeDisplayedMilestone.badgeColor
            } text-white flex items-center justify-center shadow-md cursor-pointer transition-transform duration-300 ${
              isCelebratingMilestone ? 'scale-110 ring-4 ring-amber-300/60' : 'hover:scale-105'
            }`}
            title="Haz clic para celebrar tu hito de racha"
          >
            <Flame
              className={`w-7 h-7 fill-white text-white transition-transform ${
                isCelebratingMilestone ? 'animate-bounce' : 'animate-pulse'
              }`}
            />
            {isExactMilestoneDay && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-white text-amber-700 font-black text-[9px] shadow-xs border border-amber-200">
                ¡HITO!
              </span>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                Racha de Estudio Diaria
              </span>
              {isTodayStreakSecured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Racha de hoy asegurada</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                  <Clock className="w-3 h-3" />
                  <span>Faltan {remainingMinutesToSecureToday}m hoy</span>
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl sm:text-4xl font-black font-mono-numbers text-slate-900 dark:text-white tracking-tight">
                {streakDays}
              </span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {streakDays === 1 ? 'día consecutivo' : 'días consecutivos'}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {currentMilestone ? (
                <>
                  Nivel actual:{' '}
                  <strong className="text-amber-700 dark:text-amber-400">
                    {currentMilestone.title} ({currentMilestone.days}d)
                  </strong>
                </>
              ) : (
                'Completa tu sesión diaria para desbloquear el primer hito de 3 días.'
              )}
            </p>
          </div>
        </div>

        {/* Celebrate / Medals CTA */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => triggerMilestoneCelebration(activeDisplayedMilestone.days)}
            className="px-2.5 py-1.5 rounded-xl bg-amber-100/90 hover:bg-amber-200/80 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all"
            title="Activar animación de hito de racha"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Animar Hito</span>
          </button>

          {onOpenStreakModal && (
            <button
              type="button"
              onClick={onOpenStreakModal}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Logros</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive Milestone Badges Track (with Milestone Animation) */}
      <div className="relative z-10 space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span>
              Próximo hito: <strong>{nextMilestone.title}</strong> ({nextMilestone.days} días)
            </span>
          </span>
          <span className="font-mono-numbers text-[11px] font-bold text-amber-700 dark:text-amber-400">
            {daysToNextMilestone === 0
              ? '¡Hito alcanzado!'
              : `Faltan ${daysToNextMilestone} ${daysToNextMilestone === 1 ? 'día' : 'días'} (${milestoneProgressPct}%)`}
          </span>
        </div>

        {/* Progress Bar to Next Milestone */}
        <div className="w-full bg-amber-100/80 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 h-full rounded-full transition-all duration-700"
            style={{ width: `${milestoneProgressPct}%` }}
          />
        </div>

        {/* Milestone Pills Row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
          {STREAK_MILESTONES.map((m) => {
            const isUnlocked = streakDays >= m.days;
            const isNext = nextMilestone.days === m.days && !isUnlocked;
            const isHighlighted =
              isCelebratingMilestone && activeDisplayedMilestone.days === m.days;

            return (
              <button
                key={m.days}
                type="button"
                onClick={() => triggerMilestoneCelebration(m.days)}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isHighlighted
                    ? 'bg-amber-500 text-white border-amber-600 scale-105 shadow-sm animate-bounce'
                    : isUnlocked
                    ? 'bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white'
                    : isNext
                    ? 'bg-white dark:bg-slate-800/90 border-amber-400 dark:border-amber-600 border-dashed text-slate-800 dark:text-slate-200'
                    : 'bg-white/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-400'
                }`}
                title={`${m.title}: ${m.subtitle}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono-numbers">{m.days}d</span>
                  {isUnlocked ? (
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        isHighlighted ? 'text-white' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                  ) : isNext ? (
                    <Target className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  ) : (
                    <Flame className="w-3 h-3 opacity-40" />
                  )}
                </div>
                <span className="text-[10px] font-bold truncate block mt-1">{m.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Summary of Next Goal to Maintain Streak Today + 7-Day Visual Chain */}
      <div className="relative z-10 p-3.5 rounded-2xl bg-white/90 dark:bg-slate-800/70 border border-amber-200/70 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            <span>
              {isTodayStreakSecured
                ? `¡Racha mantenida hoy! Suma ${daysToNextMilestone}d más para "${nextMilestone.title}"`
                : `Próxima meta para mantener tu racha hoy: estudia ${remainingMinutesToSecureToday} min más`}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isTodayStreakSecured
              ? `Has registrado ${todayMinutes} min y ${todayTopicsCount} ${
                  todayTopicsCount === 1 ? 'tema' : 'temas'
                } hoy. Tu llama está protegida hasta mañana.`
              : `Meta mínima diaria de mantenimiento: ${minDailyMinutesToMaintain} min (1 Pomodoro) o 1 tema completado (${todayMaintenancePct}% completado hoy).`}
          </p>

          {/* 7-Day Mini Chain */}
          <div className="flex items-center gap-1.5 pt-1">
            {last7DaysChain.map((d) => (
              <div
                key={d.dateStr}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
                  d.active
                    ? 'bg-amber-500/15 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300'
                    : d.isToday
                    ? 'bg-slate-100 dark:bg-slate-900 border-amber-400 border-dashed text-slate-700 dark:text-slate-300'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400'
                }`}
                title={`${d.dateStr}: ${d.minutes} min`}
              >
                <Flame
                  className={`w-2.5 h-2.5 ${
                    d.active ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                  }`}
                />
                <span>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons to Maintain Streak right away */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {!isTodayStreakSecured && onQuickLogMinutes && (
            <button
              type="button"
              onClick={() => {
                onQuickLogMinutes(remainingMinutesToSecureToday || 25);
                triggerMilestoneCelebration();
              }}
              className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 text-xs font-bold transition-colors cursor-pointer"
              title="Registrar sesión rápida para asegurar la racha de hoy"
            >
              +{remainingMinutesToSecureToday || 25}m hoy
            </button>
          )}
          <button
            type="button"
            onClick={onStartPomodoro}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isTodayStreakSecured ? 'Sumar Pomodoro' : 'Mantener Racha'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
