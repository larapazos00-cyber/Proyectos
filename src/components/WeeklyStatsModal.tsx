import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  TrendingUp,
  Award,
  CheckCircle2,
  BookOpen,
  FileDown,
  Target,
  Settings,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Subject,
  PomodoroLog,
  StudyPreferences,
  BlockedTimeEvent,
} from '../types';
import { storageService } from '../services/storageService';
import { schedulerService } from '../services/schedulerService';
import { ExamReadinessPredictor } from './ExamReadinessPredictor';
import { exportAcademicProgressPdf } from '../services/academicProgressPdfService';

interface WeeklyStatsModalProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  preferences: StudyPreferences;
  weeklyTargetHours: number;
  blockedEvents?: BlockedTimeEvent[];
  activeSubjectId?: string;
  onSelectSubject?: (subjectId: string) => void;
  onOpenActiveRecall?: () => void;
  onOpenPreferences?: () => void;
  onOpenProgramManager?: () => void;
  onOpenExamsManager?: () => void;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  onUpdateSubject?: (updated: Subject) => void;
}

export const WeeklyStatsModal: React.FC<WeeklyStatsModalProps> = ({
  subjects,
  pomodoroLogs,
  preferences,
  weeklyTargetHours,
  blockedEvents,
  onSelectSubject,
  onOpenPreferences,
  onOpenProgramManager,
  onOpenExamsManager,
  onUpdatePreferences,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [showPdfExportPanel, setShowPdfExportPanel] = useState<boolean>(false);
  const [pdfSubjectFilter, setPdfSubjectFilter] = useState<string>('all');
  const [pdfPeriodDays, setPdfPeriodDays] = useState<'all' | 7 | 30>('all');
  const [pdfOnlyStudiedTopics, setPdfOnlyStudiedTopics] = useState<boolean>(false);
  const [pdfIncludePomodoroLogs, setPdfIncludePomodoroLogs] = useState<boolean>(true);
  const [pdfExportNotice, setPdfExportNotice] = useState<string | null>(null);
  const [showGoalEditor, setShowGoalEditor] = useState<boolean>(false);
  const [subjectHoursChartScope, setSubjectHoursChartScope] = useState<'total' | 'semanal'>('total');

  const todayStr = new Date().toISOString().split('T')[0];

  const effectiveBlockedEvents = useMemo(
    () => blockedEvents || storageService.getBlockedEvents(),
    [blockedEvents]
  );

  const dailyNeeds = useMemo(
    () =>
      schedulerService.calculateDailyStudyAndReviewNeeds(
        subjects,
        preferences,
        effectiveBlockedEvents,
        preferences.weeklyFixedObligations || []
      ),
    [subjects, preferences, effectiveBlockedEvents]
  );

  // Calculate focus minutes in the last 7 days
  const past7Days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      }),
    []
  );
  const past7DaysSet = useMemo(() => new Set(past7Days), [past7Days]);

  const {
    totalWeekHours,
    totalAllTimePomodoroHours,
    targetPercent,
    subjectWeekMinutesById,
  } = useMemo(() => {
    let weekMins = 0;
    const subWeekMap: Record<string, number> = {};

    pomodoroLogs.forEach((log) => {
      if (past7DaysSet.has(log.date)) {
        weekMins += log.durationMinutes;
        const matchedSub = subjects.find(
          (s) => s.id === log.subjectId || s.name === log.subjectName
        );
        if (matchedSub) {
          subWeekMap[matchedSub.id] =
            (subWeekMap[matchedSub.id] || 0) + log.durationMinutes;
        }
      }
    });

    const allTimeMins = pomodoroLogs.reduce(
      (acc, log) => acc + log.durationMinutes,
      0
    );
    const weekH = Math.round((weekMins / 60) * 10) / 10;
    const allTimeH = Math.round((allTimeMins / 60) * 10) / 10;
    const pct = Math.min(
      100,
      Math.round((weekH / (weeklyTargetHours || 20)) * 100)
    );

    return {
      totalWeekHours: weekH,
      totalAllTimePomodoroHours: allTimeH,
      targetPercent: pct,
      subjectWeekMinutesById: subWeekMap,
    };
  }, [pomodoroLogs, past7DaysSet, subjects, weeklyTargetHours]);

  // Default per-subject weekly goal from preferences
  const defaultSubWeeklyGoal =
    preferences.defaultSubjectWeeklyGoalHours ??
    Math.max(
      2,
      Math.round((weeklyTargetHours / Math.max(1, subjects.length)) * 2) / 2
    );

  // Subject Summary Data (Topics + Planned Hours vs Real Registered Hours)
  const subjectComparisonData = useMemo(() => {
    return subjects.map((sub) => {
      const weekMins = subjectWeekMinutesById[sub.id] || 0;
      const allTimeSubMins = pomodoroLogs
        .filter((l) => l.subjectId === sub.id || l.subjectName === sub.name)
        .reduce((acc, l) => acc + l.durationMinutes, 0);
      const topicLoggedHours = sub.topics.reduce(
        (acc, t) => acc + (t.actualHoursSpent || 0),
        0
      );

      // Horas planificadas en el temario y en bloques del calendario para esta asignatura
      const topicsPlannedHours = sub.topics.reduce(
        (acc, t) => acc + (t.estimatedHours || 1.5),
        0
      );
      const calendarPlannedMins = effectiveBlockedEvents
        .filter(
          (ev) =>
            (ev as any).subjectId === sub.id ||
            (ev.title && ev.title.toLowerCase().includes(sub.name.toLowerCase()))
        )
        .reduce((acc, ev) => {
          const [sh, sm] = (ev.startTime || '09:00').split(':').map(Number);
          const [eh, em] = (ev.endTime || '10:00').split(':').map(Number);
          const diff = eh * 60 + em - (sh * 60 + sm);
          return acc + (diff > 0 ? diff : 60);
        }, 0);

      const objectiveWeeklyHours =
        preferences.subjectWeeklyGoalHours?.[sub.id] ?? defaultSubWeeklyGoal;

      const totalPlannedHours =
        Math.round(
          Math.max(
            topicsPlannedHours,
            calendarPlannedMins / 60,
            objectiveWeeklyHours
          ) * 10
        ) / 10;

      const totalRealRegisteredHours =
        Math.round(
          Math.max(
            allTimeSubMins / 60 + topicLoggedHours,
            weekMins / 60
          ) * 10
        ) / 10;

      const realWeekHours =
        weekMins > 0
          ? Math.round((weekMins / 60) * 10) / 10
          : allTimeSubMins > 0
          ? Math.round((allTimeSubMins / 60) * 10) / 10
          : Math.round(topicLoggedHours * 10) / 10;

      const totalTopics = sub.topics.length;
      const completedTopics = sub.topics.filter(
        (t) => t.status === 'estudiado' || t.status === 'repasado'
      ).length;
      const inProgressTopics = sub.topics.filter(
        (t) => t.status === 'en_progreso'
      ).length;
      const topicProgressPct =
        totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

      const horasPlanificadas =
        subjectHoursChartScope === 'total'
          ? totalPlannedHours
          : objectiveWeeklyHours;
      const horasRealesRegistradas =
        subjectHoursChartScope === 'total'
          ? totalRealRegisteredHours
          : realWeekHours;

      return {
        subjectId: sub.id,
        name: sub.name.length > 18 ? `${sub.name.slice(0, 16)}…` : sub.name,
        fullName: sub.name,
        code: sub.code || sub.name.slice(0, 4).toUpperCase(),
        color: sub.color || '#3b82f6',
        horasPlanificadas,
        horasRealesRegistradas,
        totalPlannedHours,
        totalRealRegisteredHours,
        horasReales: realWeekHours,
        objetivoPreferencias: objectiveWeeklyHours,
        completedTopics,
        inProgressTopics,
        totalTopics,
        topicProgressPct,
      };
    });
  }, [
    subjects,
    subjectWeekMinutesById,
    pomodoroLogs,
    effectiveBlockedEvents,
    preferences.subjectWeeklyGoalHours,
    defaultSubWeeklyGoal,
    subjectHoursChartScope,
  ]);

  // Current Week Daily Bar Data (Monday to Sunday)
  const currentWeekDailyBarData = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayNamesFull = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];

    const availableDaysList = preferences.availableDays || [1, 2, 3, 4, 5, 6];
    const fallbackDailyGoal =
      preferences.dailyGoalHours ||
      Math.round(
        ((weeklyTargetHours || 20) / Math.max(1, availableDaysList.length)) * 10
      ) / 10;

    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      const dayNum = d.getDay();
      const ddMm = `${String(d.getDate()).padStart(2, '0')}/${String(
        d.getMonth() + 1
      ).padStart(2, '0')}`;

      const pomoMins = pomodoroLogs
        .filter((log) => log.date === dateStr)
        .reduce((acc, log) => acc + log.durationMinutes, 0);

      let topicActivityHours = 0;
      subjects.forEach((sub) => {
        sub.topics.forEach((t) => {
          if (t.studiedAt === dateStr) {
            topicActivityHours += Math.max(0.75, t.actualHoursSpent || 1.2);
          }
          (t.reviewsHistory || []).forEach((rev) => {
            if (rev.date === dateStr && t.studiedAt !== dateStr) {
              topicActivityHours += 0.6;
            }
          });
        });
      });

      const horasEstudioRealizadas =
        pomoMins > 0
          ? Math.round((pomoMins / 60) * 10) / 10
          : Math.round(topicActivityHours * 10) / 10;

      const configuredDayHours =
        preferences.hoursPerDay?.[dayNum] !== undefined
          ? preferences.hoursPerDay[dayNum]
          : availableDaysList.includes(dayNum)
          ? fallbackDailyGoal
          : 1.0;

      const horasObjetivo = Math.round(configuredDayHours * 10) / 10;

      return {
        dateStr,
        shortDay: dayNamesShort[dayNum],
        fullDay: dayNamesFull[dayNum],
        dayLabel:
          dateStr === todayStr
            ? `${dayNamesShort[dayNum]} (Hoy)`
            : dayNamesShort[dayNum],
        ddMm,
        isToday: dateStr === todayStr,
        horasEstudioRealizadas,
        horasObjetivo,
      };
    });
  }, [todayStr, pomodoroLogs, subjects, preferences, weeklyTargetHours]);

  const currentWeekRealTotal = useMemo(
    () =>
      Math.round(
        currentWeekDailyBarData.reduce(
          (acc, d) => acc + d.horasEstudioRealizadas,
          0
        ) * 10
      ) / 10,
    [currentWeekDailyBarData]
  );

  const currentWeekTargetTotal = useMemo(
    () =>
      Math.round(
        currentWeekDailyBarData.reduce((acc, d) => acc + d.horasObjetivo, 0) * 10
      ) / 10,
    [currentWeekDailyBarData]
  );

  // Global topic completion & retention stats
  const {
    totalTopicsAll,
    completedTopicsAll,
    globalTopicsPct,
    avgRetentionPct,
    consolidatedTopicsCount,
  } = useMemo(() => {
    let totalT = 0;
    let completedT = 0;
    let retentionSum = 0;
    let studiedCount = 0;
    let consolidatedCount = 0;

    subjects.forEach((s) => {
      s.topics.forEach((t) => {
        totalT += 1;
        const isDone = t.status === 'estudiado' || t.status === 'repasado';
        if (isDone) {
          completedT += 1;
          studiedCount += 1;
          const revCount =
            (t.reviewsHistory?.length || 0) + (t.reviewLevel || 0);
          const estRetention = Math.min(96, 62 + revCount * 8);
          retentionSum += estRetention;
          if (estRetention >= 80) consolidatedCount += 1;
        }
      });
    });

    const pct = totalT > 0 ? Math.round((completedT / totalT) * 100) : 0;
    const avgRet =
      studiedCount > 0 ? Math.round(retentionSum / studiedCount) : 85;

    return {
      totalTopicsAll: totalT,
      completedTopicsAll: completedT,
      globalTopicsPct: pct,
      avgRetentionPct: avgRet,
      consolidatedTopicsCount: consolidatedCount,
    };
  }, [subjects]);

  // PDF Export Handler
  const handleExportAcademicProgressPdf = () => {
    setIsExportingPdf(true);
    try {
      const summary = exportAcademicProgressPdf(
        subjects,
        pomodoroLogs,
        preferences,
        weeklyTargetHours,
        {
          subjectFilterId: pdfSubjectFilter,
          periodDays: pdfPeriodDays,
          includePomodoroLogHistory: pdfIncludePomodoroLogs,
          includeDetailedTopicsTable: true,
          onlyStudiedTopics: pdfOnlyStudiedTopics,
        }
      );
      setPdfExportNotice(
        `Informe PDF descargado (${summary.fileName}): ${summary.studiedTopicsCount}/${summary.totalTopics} temas dominados (${summary.completionPercentage}%) y ${summary.totalPomodoroHours}h registradas.`
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleUpdateSubjectGoal = (subjectId: string, hours: number) => {
    if (!onUpdatePreferences) return;
    const validHours = Math.max(0.5, Math.min(40, hours));
    onUpdatePreferences({
      ...preferences,
      subjectWeeklyGoalHours: {
        ...(preferences.subjectWeeklyGoalHours || {}),
        [subjectId]: validHours,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER & 4 KPIs ESENCIALES */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Resumen de Rendimiento y Preparación
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Métricas clave de avance del temario, cumplimiento semanal y pronóstico para tus exámenes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleExportAcademicProgressPdf}
              disabled={isExportingPdf}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {isExportingPdf ? 'Generando PDF...' : 'Exportar Informe PDF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowPdfExportPanel((prev) => !prev)}
              className={`p-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                showPdfExportPanel
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
              title="Opciones de filtrado para el PDF"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Confirmación de PDF */}
        {pdfExportNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{pdfExportNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setPdfExportNotice(null)}
              className="text-[11px] font-bold underline cursor-pointer shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Opciones compactas de filtro PDF */}
        {showPdfExportPanel && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Asignatura
              </label>
              <select
                value={pdfSubjectFilter}
                onChange={(e) => setPdfSubjectFilter(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="all">Todas ({subjects.length})</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Periodo
              </label>
              <select
                value={String(pdfPeriodDays)}
                onChange={(e) => {
                  const val = e.target.value;
                  setPdfPeriodDays(
                    val === '7' ? 7 : val === '30' ? 30 : 'all'
                  );
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="all">Histórico completo</option>
                <option value="30">Últimos 30 días</option>
                <option value="7">Últimos 7 días</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pdfOnlyStudiedTopics}
                  onChange={(e) => setPdfOnlyStudiedTopics(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Solo temas dominados
                </span>
              </label>
            </div>

            <div className="flex items-end">
              <label className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pdfIncludePomodoroLogs}
                  onChange={(e) => setPdfIncludePomodoroLogs(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Incluir historial Pomodoro
                </span>
              </label>
            </div>
          </div>
        )}

        {/* 4 Tarjetas KPI Esenciales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          {/* KPI 1: Horas esta semana */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Estudio (7 días)
              </span>
              <div className="p-1.5 rounded-lg bg-blue-100/80 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-white mt-1">
              {totalWeekHours}h{' '}
              <span className="text-xs font-normal text-slate-400">
                / {weeklyTargetHours}h
              </span>
            </div>
            <div className="w-full bg-slate-200/80 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, targetPercent)}%` }}
              />
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-1 font-mono-numbers">
              {targetPercent}% de tu meta semanal
            </div>
          </div>

          {/* KPI 2: Temario Dominado */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Temario Dominado
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-100/80 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-indigo-600 dark:text-indigo-400 mt-1">
              {globalTopicsPct}%
            </div>
            <div className="w-full bg-slate-200/80 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${globalTopicsPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono-numbers">
              {completedTopicsAll} de {totalTopicsAll} temas completados
            </div>
          </div>

          {/* KPI 3: Nivel de Retención */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Retención Media
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-emerald-600 dark:text-emerald-400 mt-1">
              {avgRetentionPct}%
            </div>
            <div className="w-full bg-slate-200/80 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${avgRetentionPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {consolidatedTopicsCount} temas consolidados (≥80%)
            </div>
          </div>

          {/* KPI 4: Foco Total Acumulado */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Foco Acumulado
              </span>
              <div className="p-1.5 rounded-lg bg-purple-100/80 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-white mt-1">
              {totalAllTimePomodoroHours}h
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>{pomodoroLogs.length} sesiones Pomodoro</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECCIÓN PROTAGONISTA: PREDICTOR VISUAL DE PREPARACIÓN */}
      <ExamReadinessPredictor
        subjects={subjects}
        pomodoroLogs={pomodoroLogs}
        preferences={preferences}
        onOpenExamsManager={onOpenExamsManager}
        onSelectSubject={onSelectSubject}
      />

      {/* 2B. GRÁFICO DE BARRAS RECHARTS: HORAS PLANIFICADAS VS. HORAS REALES REGISTRADAS POR ASIGNATURA */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                Horas de Estudio Planificadas vs. Horas Reales Registradas por Asignatura
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comparativa directa entre la carga horaria planificada y el tiempo real registrado en sesiones Pomodoro y temas estudiados.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setSubjectHoursChartScope('total')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                subjectHoursChartScope === 'total'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Total Asignatura
            </button>
            <button
              type="button"
              onClick={() => setSubjectHoursChartScope('semanal')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                subjectHoursChartScope === 'semanal'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Meta Semanal
            </button>
          </div>
        </div>

        {/* Resumen rápido de totales del gráfico */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Total Planificado ({subjectHoursChartScope === 'total' ? 'Curso' : 'Semana'})
            </span>
            <span className="text-sm font-extrabold font-mono-numbers text-slate-900 dark:text-white">
              {Math.round(
                subjectComparisonData.reduce((acc, s) => acc + s.horasPlanificadas, 0) * 10
              ) / 10}
              h
            </span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800 flex items-center justify-between">
            <span className="text-xs font-medium text-blue-800 dark:text-blue-300">
              Total Real Registrado
            </span>
            <span className="text-sm font-extrabold font-mono-numbers text-blue-700 dark:text-blue-300">
              {Math.round(
                subjectComparisonData.reduce((acc, s) => acc + s.horasRealesRegistradas, 0) * 10
              ) / 10}
              h
            </span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Cumplimiento Global
            </span>
            <span className="text-sm font-extrabold font-mono-numbers text-emerald-700 dark:text-emerald-300">
              {(() => {
                const planSum = subjectComparisonData.reduce(
                  (acc, s) => acc + s.horasPlanificadas,
                  0
                );
                const realSum = subjectComparisonData.reduce(
                  (acc, s) => acc + s.horasRealesRegistradas,
                  0
                );
                return planSum > 0 ? Math.min(100, Math.round((realSum / planSum) * 100)) : 0;
              })()}
              %
            </span>
          </div>
        </div>

        {/* Gráfico de Barras Agrupadas por Asignatura */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={subjectComparisonData}
              margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                unit="h"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                formatter={(value: any, name: any) => [`${value} h`, name]}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload;
                  return row ? `${row.fullName} (${row.completedTopics}/${row.totalTopics} temas)` : label;
                }}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Bar
                dataKey="horasPlanificadas"
                name="Horas Planificadas"
                fill="#94a3b8"
                radius={[6, 6, 0, 0]}
                maxBarSize={38}
              />
              <Bar
                dataKey="horasRealesRegistradas"
                name="Horas Reales Registradas"
                fill="#2563eb"
                radius={[6, 6, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. FILA DE ANÁLISIS ESENCIAL (2 COLUMNAS: RITMO SEMANAL + AVANCE POR ASIGNATURA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (7 cols): Horas Realizadas vs. Objetivo (Semana Actual) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Ritmo Semanal: Estudio Real vs. Objetivo</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Semana actual ({currentWeekDailyBarData[0]?.ddMm} –{' '}
                {currentWeekDailyBarData[6]?.ddMm}) · Realizado:{' '}
                <strong className="font-mono-numbers text-blue-600 dark:text-blue-400">
                  {currentWeekRealTotal}h
                </strong>{' '}
                de {currentWeekTargetTotal}h
              </p>
            </div>

            {onOpenProgramManager && (
              <button
                type="button"
                onClick={onOpenProgramManager}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Ajustar Horario
              </button>
            )}
          </div>

          <div className="h-64 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={currentWeekDailyBarData}
                margin={{ top: 10, right: 16, left: -12, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="dayLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  unit="h"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [`${value}h`, name]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    return row ? `${row.fullDay} (${row.ddMm})` : label;
                  }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <ReferenceLine
                  y={dailyNeeds.totalHoursNeededDaily}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                />
                <Bar
                  dataKey="horasEstudioRealizadas"
                  name="Estudio Realizado"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="horasObjetivo"
                  name="Meta del Día"
                  fill="#cbd5e1"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Columna Derecha (5 cols): Avance y Horas por Asignatura */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Avance por Asignatura</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Temas dominados y horas dedicadas frente a tu meta.
              </p>
            </div>

            {onUpdatePreferences && (
              <button
                type="button"
                onClick={() => setShowGoalEditor((prev) => !prev)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                title="Ajustar metas semanales por asignatura"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {subjectComparisonData.map((sub) => {
              const hoursPct =
                sub.objetivoPreferencias > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (sub.horasReales / sub.objetivoPreferencias) * 100
                      )
                    )
                  : 100;

              return (
                <div
                  key={sub.subjectId}
                  className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: sub.color }}
                      />
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {sub.fullName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono-numbers font-bold text-indigo-600 dark:text-indigo-400">
                        {sub.topicProgressPct}% temario
                      </span>
                      {onSelectSubject && (
                        <button
                          type="button"
                          onClick={() => onSelectSubject(sub.subjectId)}
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          title="Ir a la asignatura"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra de Temario */}
                  <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${sub.topicProgressPct}%`,
                        backgroundColor: sub.color,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                    <span>
                      {sub.completedTopics}/{sub.totalTopics} temas dominados
                    </span>
                    <span>
                      Tiempo:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {sub.horasReales}h
                      </strong>{' '}
                      / {sub.objetivoPreferencias}h ({hoursPct}%)
                    </span>
                  </div>

                  {showGoalEditor && onUpdatePreferences && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400">
                        Meta semanal (h/sem):
                      </span>
                      <input
                        type="number"
                        min={0.5}
                        max={40}
                        step={0.5}
                        value={sub.objetivoPreferencias}
                        onChange={(e) =>
                          handleUpdateSubjectGoal(
                            sub.subjectId,
                            parseFloat(e.target.value) || 1
                          )
                        }
                        className="w-16 px-2 py-0.5 text-center font-mono-numbers font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {subjectComparisonData.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-6">
                No hay asignaturas registradas.
              </p>
            )}
          </div>

          {onOpenPreferences && (
            <div className="pt-1 text-right">
              <button
                type="button"
                onClick={onOpenPreferences}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Configurar preferencias de estudio →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
