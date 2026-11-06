import React, { useState, useMemo } from 'react';
import {
  Flame,
  Award,
  Calendar,
  Sparkles,
  Trophy,
  Clock,
  CheckCircle2,
  Filter,
  Info,
  ChevronRight,
  Target,
} from 'lucide-react';
import { PomodoroLog, StudyPreferences, Subject } from '../types';

interface AnnualStudyHeatmapProps {
  pomodoroLogs: PomodoroLog[];
  preferences: StudyPreferences;
  subjects?: Subject[];
}

interface DayHeatmapData {
  dateStr: string; // YYYY-MM-DD
  dateObj: Date;
  dayOfWeek: number; // 0 = Dom, 1 = Lun, ..., 6 = Sáb
  totalMinutes: number;
  totalHours: number;
  sessionsCount: number;
  targetHours: number;
  isStudyDayScheduled: boolean;
  metTarget: boolean;
  pctOfTarget: number;
  subjectMinutes: Record<string, number>;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
}

const MONTH_NAMES_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const DAY_NAMES_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const AnnualStudyHeatmap: React.FC<AnnualStudyHeatmapProps> = ({
  pomodoroLogs,
  preferences,
  subjects = [],
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [hoveredDay, setHoveredDay] = useState<DayHeatmapData | null>(null);

  // Generate 52 weeks back from today (ending on the next Saturday to make a full 7-day grid)
  const heatmapData = useMemo(() => {
    const today = new Date();
    // Normalize to end of today
    today.setHours(23, 59, 59, 999);

    // Filter logs if subject filter is active
    const filteredLogs = selectedSubjectId === 'all'
      ? pomodoroLogs
      : pomodoroLogs.filter((l) => l.subjectId === selectedSubjectId || l.subjectName === selectedSubjectId);

    // Map date -> { totalMinutes, sessionsCount, subjectMinutes }
    const logMap: Record<
      string,
      { totalMinutes: number; sessionsCount: number; subjects: Record<string, number> }
    > = {};

    filteredLogs.forEach((log) => {
      if (!log.date) return;
      if (!logMap[log.date]) {
        logMap[log.date] = { totalMinutes: 0, sessionsCount: 0, subjects: {} };
      }
      logMap[log.date].totalMinutes += log.durationMinutes;
      logMap[log.date].sessionsCount += 1;
      const sName = log.subjectName || 'General';
      logMap[log.date].subjects[sName] =
        (logMap[log.date].subjects[sName] || 0) + log.durationMinutes;
    });

    // We want 52 full weeks (364 days + current partial week)
    // Find the ending date: next Saturday (or today if today is Saturday)
    const endDayOfWeek = today.getDay(); // 0 Dom, 6 Sab
    const daysUntilSaturday = (6 - endDayOfWeek + 7) % 7;
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysUntilSaturday);

    // Total 53 weeks * 7 days = 371 days
    const totalDays = 53 * 7;
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - totalDays + 1);

    const days: DayHeatmapData[] = [];
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayOfWeek = curr.getDay();

      const logInfo = logMap[dateStr] || { totalMinutes: 0, sessionsCount: 0, subjects: {} };
      const totalMinutes = logInfo.totalMinutes;
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
      const sessionsCount = logInfo.sessionsCount;

      const isScheduled = preferences.availableDays?.includes(dayOfWeek) ?? (dayOfWeek >= 1 && dayOfWeek <= 5);
      const configuredDailyGoal = preferences.hoursPerDay?.[dayOfWeek] ?? preferences.dailyGoalHours ?? 3.0;
      const targetHours = isScheduled ? configuredDailyGoal : 0;

      const metTarget = targetHours > 0
        ? totalHours >= targetHours
        : totalHours >= (preferences.dailyGoalHours ?? 2.0);

      const pctOfTarget = targetHours > 0
        ? Math.round((totalHours / targetHours) * 100)
        : totalHours > 0
        ? 100
        : 0;

      // Intensity level:
      // 0: 0h
      // 1: >0h and <50% target
      // 2: 50% to 99% target
      // 3: 100% to 149% target (MET TARGET!)
      // 4: >=150% target (EXCEEDED TARGET!)
      let intensityLevel: 0 | 1 | 2 | 3 | 4 = 0;
      if (totalMinutes === 0) {
        intensityLevel = 0;
      } else if (metTarget) {
        intensityLevel = totalHours >= (targetHours > 0 ? targetHours * 1.5 : 4) ? 4 : 3;
      } else if (pctOfTarget >= 50) {
        intensityLevel = 2;
      } else {
        intensityLevel = 1;
      }

      days.push({
        dateStr,
        dateObj: new Date(curr),
        dayOfWeek,
        totalMinutes,
        totalHours,
        sessionsCount,
        targetHours,
        isStudyDayScheduled: isScheduled,
        metTarget,
        pctOfTarget,
        subjectMinutes: logInfo.subjects,
        intensityLevel,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return days;
  }, [pomodoroLogs, preferences, selectedSubjectId]);

  // Group into weeks (columns of 7 days: Sun=0 to Sat=6)
  const weeks = useMemo(() => {
    const list: DayHeatmapData[][] = [];
    for (let i = 0; i < heatmapData.length; i += 7) {
      list.push(heatmapData.slice(i, i + 7));
    }
    return list;
  }, [heatmapData]);

  // Month headers placement based on first day of each week
  const monthLabels = useMemo(() => {
    const labels: Array<{ weekIndex: number; monthName: string }> = [];
    let lastMonth = -1;

    weeks.forEach((week, wIdx) => {
      // Look at the middle or first day of the week
      const firstDay = week[0];
      if (!firstDay) return;
      const month = firstDay.dateObj.getMonth();
      if (month !== lastMonth && week.some((d) => d.dateObj.getDate() <= 7)) {
        labels.push({
          weekIndex: wIdx,
          monthName: MONTH_NAMES_ES[month],
        });
        lastMonth = month;
      }
    });

    return labels;
  }, [weeks]);

  // Statistics & Reinforcement KPI calculations
  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const pastDays = heatmapData.filter((d) => d.dateStr <= todayStr);

    let daysMetTarget = 0;
    let daysWithAnyStudy = 0;
    let totalMinutesAnnual = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    // Sort ascending for streak calculation
    const sortedDays = [...pastDays].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    sortedDays.forEach((day) => {
      if (day.totalMinutes > 0) {
        daysWithAnyStudy++;
        totalMinutesAnnual += day.totalMinutes;
      }

      if (day.metTarget) {
        daysMetTarget++;
        tempStreak++;
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    });

    // Current streak (counting backwards from today/yesterday)
    const reversed = [...sortedDays].reverse();
    for (let i = 0; i < reversed.length; i++) {
      const d = reversed[i];
      if (i === 0 && d.dateStr === todayStr && !d.metTarget) {
        // Today still ongoing, check if yesterday was part of streak
        continue;
      }
      if (d.metTarget) {
        currentStreak++;
      } else {
        break;
      }
    }

    const scheduledDaysCount = pastDays.filter((d) => d.isStudyDayScheduled).length;
    const consistencyRate = scheduledDaysCount > 0
      ? Math.round((daysMetTarget / scheduledDaysCount) * 100)
      : 0;

    return {
      daysMetTarget,
      daysWithAnyStudy,
      totalHoursAnnual: Math.round((totalMinutesAnnual / 60) * 10) / 10,
      currentStreak,
      maxStreak,
      consistencyRate,
      activeDaysEvaluated: pastDays.length,
    };
  }, [heatmapData]);

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return `${DAY_NAMES_ES[dt.getDay()]}, ${d} de ${MONTH_NAMES_ES[m - 1]} de ${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Consistencia y Hábitos de Estudio Anual (Heatmap 365 días)</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold uppercase">
                  Refuerzo Positivo
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Visualiza cada jornada del año. Los días destacados en esmeralda intenso representan el cumplimiento exitoso de tu meta diaria de horas bloqueadas.
              </p>
            </div>
          </div>
        </div>

        {/* Subject filter */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
          >
            <option value="all">Todas las asignaturas combinadas</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards (Refuerzo Positivo) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 dark:from-emerald-950/40 dark:to-slate-800 border border-emerald-200/80 dark:border-emerald-800/60">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Objetivo Cumplido</span>
          </div>
          <div className="text-2xl font-extrabold font-mono-numbers text-emerald-900 dark:text-emerald-200">
            {kpis.daysMetTarget}
          </div>
          <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
            Días con meta 100%+
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-slate-800 border border-amber-200/80 dark:border-amber-800/60">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1">
            <Flame className="w-4 h-4 text-amber-600" />
            <span>Racha Actual</span>
          </div>
          <div className="text-2xl font-extrabold font-mono-numbers text-amber-900 dark:text-amber-200">
            {kpis.currentStreak} <span className="text-xs font-semibold">días</span>
          </div>
          <div className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5">
            Cumpliendo consecutivamente
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/50 dark:from-purple-950/40 dark:to-slate-800 border border-purple-200/80 dark:border-purple-800/60">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-800 dark:text-purple-300 mb-1">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Mejor Racha Anual</span>
          </div>
          <div className="text-2xl font-extrabold font-mono-numbers text-purple-900 dark:text-purple-200">
            {kpis.maxStreak} <span className="text-xs font-semibold">días</span>
          </div>
          <div className="text-[10px] text-purple-700/80 dark:text-purple-400 mt-0.5">
            Récord personal este año
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Horas Totales Año</span>
          </div>
          <div className="text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-slate-100">
            {kpis.totalHoursAnnual}h
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono-numbers">
            {kpis.daysWithAnyStudy} jornadas activas
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
            <Target className="w-4 h-4 text-indigo-600" />
            <span>Tasa de Consistencia</span>
          </div>
          <div className="text-2xl font-extrabold font-mono-numbers text-indigo-700 dark:text-indigo-300">
            {kpis.consistencyRate}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            De días lectivos planificados
          </div>
        </div>
      </div>

      {/* Heatmap Matrix Grid */}
      <div className="space-y-2">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[760px]">
            {/* Months Header */}
            <div className="flex text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5 pl-8">
              <div className="flex-1 flex justify-between pr-2 font-mono-numbers">
                {MONTH_NAMES_ES.map((m) => (
                  <span key={m} className="w-12 text-left">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Grid Container */}
            <div className="flex items-start gap-1.5">
              {/* Day of Week Labels (Left: Lun, Mié, Vie, Dom) */}
              <div className="flex flex-col justify-between h-[126px] text-[10px] font-bold text-slate-400 dark:text-slate-500 pr-1 select-none pt-0.5">
                <span className="leading-none">Dom</span>
                <span className="leading-none">Lun</span>
                <span className="leading-none">Mar</span>
                <span className="leading-none">Mié</span>
                <span className="leading-none">Jue</span>
                <span className="leading-none">Vie</span>
                <span className="leading-none">Sáb</span>
              </div>

              {/* Weeks Columns */}
              <div className="flex gap-[3.5px] flex-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3.5px]">
                    {week.map((day) => {
                      const isToday = day.dateStr === new Date().toISOString().split('T')[0];
                      const isHovered = hoveredDay?.dateStr === day.dateStr;

                      // Level styling
                      let cellClass = 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50';
                      if (day.intensityLevel === 1) {
                        cellClass = 'bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80';
                      } else if (day.intensityLevel === 2) {
                        cellClass = 'bg-emerald-300 dark:bg-emerald-700/80 border border-emerald-400 dark:border-emerald-600';
                      } else if (day.intensityLevel === 3) {
                        // Target met! Highlighted!
                        cellClass =
                          'bg-emerald-500 dark:bg-emerald-500 border border-emerald-600 dark:border-emerald-400 shadow-xs ring-1 ring-emerald-400/80';
                      } else if (day.intensityLevel === 4) {
                        // Target exceeded! Special star reward!
                        cellClass =
                          'bg-emerald-600 dark:bg-emerald-400 border border-emerald-700 dark:border-emerald-300 shadow-sm ring-2 ring-emerald-400/90 ring-offset-1 dark:ring-offset-slate-900';
                      }

                      return (
                        <div
                          key={day.dateStr}
                          onMouseEnter={() => setHoveredDay(day)}
                          onClick={() => setHoveredDay(day)}
                          className={`w-[13.5px] h-[13.5px] rounded-[3px] transition-all cursor-pointer relative ${cellClass} ${
                            isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                          } ${isHovered ? 'scale-125 z-10' : ''}`}
                          title={`${day.dateStr}: ${day.totalHours}h (Meta: ${day.targetHours}h)`}
                        >
                          {/* Mini star indicator on days target was fulfilled */}
                          {day.metTarget && day.intensityLevel >= 3 && (
                            <span className="absolute inset-0 flex items-center justify-center text-[7px] text-white font-extrabold leading-none pointer-events-none">
                              ★
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend and Active Day Details Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Legend */}
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] flex-wrap">
            <span>Menos</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" title="0 horas" />
              <span className="w-3 h-3 rounded-[3px] bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200" title="< 50% de la meta" />
              <span className="w-3 h-3 rounded-[3px] bg-emerald-300 dark:bg-emerald-700/80" title="50% a 99% de la meta" />
              <span className="w-3.5 h-3.5 rounded-[3px] bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold shadow-xs ring-1 ring-emerald-400" title="¡Meta cumplida 100%!">
                ★
              </span>
              <span className="w-3.5 h-3.5 rounded-[3px] bg-emerald-600 dark:bg-emerald-400 text-white flex items-center justify-center text-[8px] font-bold shadow-sm ring-2 ring-emerald-400" title="¡Meta superada 150%+!">
                ★
              </span>
            </div>
            <span>Más</span>
            <span className="text-slate-400">·</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              ★ = Objetivo de horas cumplido
            </span>
          </div>

          {/* Prompt/Hover hint */}
          {!hoveredDay ? (
            <span className="text-[11px] text-slate-400 italic">
              Pasa el cursor o pulsa sobre cualquier día para ver el desglose detallado.
            </span>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-3 animate-in fade-in">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  {formatDateDisplay(hoveredDay.dateStr)}
                </span>
                <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono-numbers">
                  <span>
                    Estudiado: <strong>{hoveredDay.totalHours}h</strong> ({hoveredDay.sessionsCount} sesiones)
                  </span>
                  <span>·</span>
                  <span>Meta: {hoveredDay.targetHours}h</span>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  hoveredDay.metTarget
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                    : hoveredDay.totalHours > 0
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {hoveredDay.metTarget
                  ? '🏆 ¡Objetivo cumplido!'
                  : hoveredDay.totalHours > 0
                  ? `⚡ ${hoveredDay.pctOfTarget}% de la meta`
                  : hoveredDay.isStudyDayScheduled
                  ? 'Sin registro'
                  : 'Día de descanso'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
