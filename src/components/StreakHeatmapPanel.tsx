import React, { useState, useMemo } from 'react';
import {
  Flame,
  Trophy,
  Calendar,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  TrendingUp,
  Info,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { PomodoroLog, StudyPreferences } from '../types';

interface StreakHeatmapPanelProps {
  pomodoroLogs: PomodoroLog[];
  streakDays: number;
  preferences?: StudyPreferences;
  onSelectForPomodoro?: (subjectId?: string) => void;
  onOpenStreakModal?: () => void;
}

// Format local Date object to YYYY-MM-DD string
function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Add days to date
function addDays(d: Date, days: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
}

const MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const StreakHeatmapPanel: React.FC<StreakHeatmapPanelProps> = ({
  pomodoroLogs = [],
  streakDays = 0,
  preferences,
  onSelectForPomodoro,
  onOpenStreakModal,
}) => {
  const [timeWindow, setTimeWindow] = useState<'3m' | '6m'>('6m');
  const [hoveredDay, setHoveredDay] = useState<{
    dateStr: string;
    minutes: number;
    sessionsCount: number;
    subjects: string[];
  } | null>(null);

  // Map of date string YYYY-MM-DD -> daily stats
  const dailyDataMap = useMemo(() => {
    const map = new Map<
      string,
      { minutes: number; count: number; subjects: Set<string>; topics: Set<string> }
    >();

    // 1. Fill from actual pomodoroLogs
    pomodoroLogs.forEach((log) => {
      if (!log.date) return;
      const existing = map.get(log.date) || {
        minutes: 0,
        count: 0,
        subjects: new Set<string>(),
        topics: new Set<string>(),
      };
      existing.minutes += log.durationMinutes || 0;
      existing.count += 1;
      if (log.subjectName) existing.subjects.add(log.subjectName);
      if (log.topicTitle) existing.topics.add(log.topicTitle);
      map.set(log.date, existing);
    });

    // 2. Ensure current streak consecutive days are reflected in the map
    const today = new Date();
    if (streakDays > 0) {
      for (let i = 0; i < streakDays; i++) {
        const d = addDays(today, -i);
        const dStr = toLocalDateStr(d);
        if (!map.has(dStr)) {
          map.set(dStr, {
            minutes: 45, // default session representation
            count: 1,
            subjects: new Set<string>(['Sesión de estudio']),
            topics: new Set<string>(),
          });
        }
      }
    }

    return map;
  }, [pomodoroLogs, streakDays]);

  // Compute historic stats: Best streak, total study days, total minutes
  const stats = useMemo(() => {
    const activeDates = Array.from(dailyDataMap.keys())
      .filter((dateStr) => (dailyDataMap.get(dateStr)?.minutes || 0) > 0)
      .sort();

    let maxStreak = streakDays || 0;
    let currentStreakCounter = 0;
    let prevTimestamp: number | null = null;

    activeDates.forEach((dateStr) => {
      const parts = dateStr.split('-').map(Number);
      const currD = new Date(parts[0], parts[1] - 1, parts[2]).getTime();

      if (prevTimestamp === null) {
        currentStreakCounter = 1;
      } else {
        const diffDays = Math.round((currD - prevTimestamp) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          currentStreakCounter += 1;
        } else if (diffDays > 1) {
          currentStreakCounter = 1;
        }
      }
      prevTimestamp = currD;
      if (currentStreakCounter > maxStreak) {
        maxStreak = currentStreakCounter;
      }
    });

    let totalMinutes = 0;
    let totalSessions = 0;
    dailyDataMap.forEach((v) => {
      totalMinutes += v.minutes;
      totalSessions += v.count;
    });

    const activeDaysCount = activeDates.length;
    const avgMinutesPerActiveDay =
      activeDaysCount > 0 ? Math.round(totalMinutes / activeDaysCount) : 0;

    return {
      bestStreak: Math.max(streakDays, maxStreak),
      activeDaysCount,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalSessions,
      avgMinutesPerActiveDay,
    };
  }, [dailyDataMap, streakDays]);

  // Construct weekly columns for the heatmap
  // Monday-based weeks.
  const { weeks, monthLabels } = useMemo(() => {
    const numWeeks = timeWindow === '3m' ? 14 : 24;
    const today = new Date();
    const todayStr = toLocalDateStr(today);

    // End date should be Sunday of the current week to have a clean rectangular grid
    const todayDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday
    // In Monday=0 to Sunday=6 system:
    const dayIndexMonday = (todayDayOfWeek + 6) % 7;
    const daysUntilSunday = 6 - dayIndexMonday;
    const gridEnd = addDays(today, daysUntilSunday);

    const totalDays = numWeeks * 7;
    const gridStart = addDays(gridEnd, -(totalDays - 1));

    const weeksList: Array<
      Array<{
        dateStr: string;
        date: Date;
        minutes: number;
        sessionsCount: number;
        subjects: string[];
        isFuture: boolean;
        isToday: boolean;
      }>
    > = [];

    const months: Array<{ label: string; colIndex: number }> = [];
    let lastMonth = -1;

    let currentDayPointer = new Date(gridStart);

    for (let w = 0; w < numWeeks; w++) {
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const dStr = toLocalDateStr(currentDayPointer);
        const m = currentDayPointer.getMonth();

        // Register month header if month changed and it's around mid-week
        if (m !== lastMonth && d === 0) {
          months.push({ label: MONTH_NAMES[m], colIndex: w });
          lastMonth = m;
        }

        const isToday = dStr === todayStr;
        const isFuture = currentDayPointer > today;
        const dayRecord = dailyDataMap.get(dStr);

        weekDays.push({
          dateStr: dStr,
          date: new Date(currentDayPointer),
          minutes: isFuture ? 0 : dayRecord?.minutes || 0,
          sessionsCount: isFuture ? 0 : dayRecord?.count || 0,
          subjects: dayRecord ? Array.from(dayRecord.subjects) : [],
          isFuture,
          isToday,
        });

        currentDayPointer = addDays(currentDayPointer, 1);
      }
      weeksList.push(weekDays);
    }

    return { weeks: weeksList, monthLabels: months };
  }, [timeWindow, dailyDataMap]);

  // Color intensity mapping based on study minutes
  const getCellColor = (minutes: number, isFuture: boolean, isToday: boolean) => {
    if (isFuture) {
      return 'bg-slate-100/50 dark:bg-slate-800/20 border-transparent';
    }
    if (minutes === 0) {
      return isToday
        ? 'bg-slate-100 dark:bg-slate-800 border-dashed border-amber-400 dark:border-amber-500'
        : 'bg-slate-100 dark:bg-slate-800/70 border-transparent hover:border-slate-300 dark:hover:border-slate-600';
    }
    if (minutes < 30) {
      return 'bg-amber-200 dark:bg-amber-900/60 border-amber-300 dark:border-amber-800/80 hover:brightness-105';
    }
    if (minutes < 60) {
      return 'bg-amber-400 dark:bg-amber-600/90 border-amber-500 dark:border-amber-600 hover:brightness-105';
    }
    if (minutes < 120) {
      return 'bg-orange-500 dark:bg-orange-500 border-orange-600 hover:brightness-105';
    }
    return 'bg-red-600 dark:bg-red-500 border-red-700 hover:brightness-105 shadow-2xs';
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5 transition-all">
      {/* Top Header & Metric Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-2xs">
              <Flame className="w-4 h-4 fill-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Historial de Rachas y Constancia</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mapa de calor con tus sesiones y regularidad de estudio diario
              </p>
            </div>
          </div>
        </div>

        {/* Time Window Switcher & Action */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTimeWindow('3m')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                timeWindow === '3m'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              3 Meses
            </button>
            <button
              type="button"
              onClick={() => setTimeWindow('6m')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                timeWindow === '6m'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              6 Meses
            </button>
          </div>

          {onOpenStreakModal && (
            <button
              type="button"
              onClick={onOpenStreakModal}
              className="px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Ver reglas y medallas de racha"
            >
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>Medallas</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Essential Constancy KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Racha Actual */}
        <div
          onClick={onOpenStreakModal}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 dark:border-amber-900/40 cursor-pointer hover:border-amber-300 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-medium">Racha Actual</span>
            <Flame className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono-numbers">
              {streakDays}
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {streakDays === 1 ? 'día' : 'días'}
            </span>
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium block mt-0.5">
            {streakDays > 0 ? '🔥 ¡En llamas!' : 'Inicia hoy con 1 sesión'}
          </span>
        </div>

        {/* Card 2: Mejor Racha Histórica */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-medium">Récord Histórico</span>
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono-numbers">
              {stats.bestStreak}
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              días consecutivos
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
            Tu pico de constancia
          </span>
        </div>

        {/* Card 3: Días de Estudio Totales */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-medium">Días Activos</span>
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono-numbers">
              {stats.activeDaysCount}
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              jornadas con estudio
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
            {stats.totalSessions} sesiones registradas
          </span>
        </div>

        {/* Card 4: Promedio por Día Activo */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-medium">Tiempo Total</span>
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono-numbers">
              {stats.totalHours}
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">horas</span>
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium block mt-0.5">
            Promedio: {stats.avgMinutesPerActiveDay} min/día activo
          </span>
        </div>
      </div>

      {/* The Activity Heatmap Grid */}
      <div className="space-y-2">
        <div className="overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
          <div className="min-w-[620px] inline-block">
            {/* Month labels row */}
            <div className="flex text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 pl-6">
              {weeks.map((_, colIdx) => {
                const monthEntry = monthLabels.find((m) => m.colIndex === colIdx);
                return (
                  <div key={colIdx} className="w-3.5 mr-1 text-center shrink-0">
                    {monthEntry ? monthEntry.label : ''}
                  </div>
                );
              })}
            </div>

            {/* Grid with Day of week labels on left + 7 rows */}
            <div className="flex gap-1.5">
              {/* Day Labels (L, M, X, J, V, S, D) */}
              <div className="flex flex-col justify-between py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 w-4 select-none shrink-0">
                {DAY_LABELS.map((label, idx) => (
                  <span
                    key={idx}
                    className={`h-3.5 leading-3.5 text-center ${
                      idx % 2 === 0 ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>

              {/* Weekly columns of 7 days */}
              <div className="flex gap-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1 shrink-0">
                    {week.map((day) => {
                      const colorClass = getCellColor(day.minutes, day.isFuture, day.isToday);
                      return (
                        <div
                          key={day.dateStr}
                          onMouseEnter={() => {
                            if (!day.isFuture) {
                              setHoveredDay({
                                dateStr: day.dateStr,
                                minutes: day.minutes,
                                sessionsCount: day.sessionsCount,
                                subjects: day.subjects,
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`w-3.5 h-3.5 rounded-[4px] border transition-transform cursor-pointer ${colorClass} ${
                            day.isToday ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''
                          } hover:scale-125`}
                          title={`${day.dateStr}: ${
                            day.isFuture
                              ? 'Fecha futura'
                              : day.minutes > 0
                              ? `${day.minutes} min estudiados (${day.sessionsCount} sesiones)`
                              : 'Sin sesiones registradas'
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Heatmap Footer: Hover Info Tooltip & Intensity Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
          {/* Dynamic Day Detail or Default Tip */}
          <div className="min-h-[22px] flex items-center gap-2">
            {hoveredDay ? (
              <div className="flex items-center gap-2 animate-fadeIn text-slate-800 dark:text-slate-200 font-medium">
                <span className="font-mono-numbers font-bold text-slate-900 dark:text-white">
                  {hoveredDay.dateStr}:
                </span>
                {hoveredDay.minutes > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                    <Flame className="w-3.5 h-3.5 fill-amber-500" />
                    {hoveredDay.minutes} min estudiados ({hoveredDay.sessionsCount}{' '}
                    {hoveredDay.sessionsCount === 1 ? 'sesión' : 'sesiones'})
                    {hoveredDay.subjects.length > 0 && (
                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                        · {hoveredDay.subjects.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">
                    Día sin actividad de estudio registrada
                  </span>
                )}
              </div>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <Info className="w-3.5 h-3.5" />
                Pasa el cursor sobre un cuadro para ver los minutos y asignaturas de ese día
              </span>
            )}
          </div>

          {/* Color Scale Legend */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400">Menos</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-[3px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
              <span className="w-3 h-3 rounded-[3px] bg-amber-200 dark:bg-amber-900/60" />
              <span className="w-3 h-3 rounded-[3px] bg-amber-400 dark:bg-amber-600" />
              <span className="w-3 h-3 rounded-[3px] bg-orange-500 dark:bg-orange-500" />
              <span className="w-3 h-3 rounded-[3px] bg-red-600 dark:bg-red-500" />
            </div>
            <span className="text-[11px] text-slate-400">Más (2h+)</span>
          </div>
        </div>
      </div>

      {/* Bottom Motivation Call to Action */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <span className="font-bold text-slate-900 dark:text-white">
              {streakDays > 0
                ? `¡Llevas ${streakDays} ${streakDays === 1 ? 'día consecutivo' : 'días consecutivos'} de estudio!`
                : '¿Listo para arrancar tu racha hoy?'}
            </span>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              Un único bloque de Pomodoro de 25 minutos es suficiente para mantener tu llama encendida.
            </p>
          </div>
        </div>

        {onSelectForPomodoro && (
          <button
            type="button"
            onClick={() => onSelectForPomodoro()}
            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-2xs hover:scale-102"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Estudiar con Pomodoro</span>
          </button>
        )}
      </div>
    </div>
  );
};
