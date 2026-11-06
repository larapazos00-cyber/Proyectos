import React, { useMemo, useState } from 'react';
import {
  Target,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  ArrowUpRight,
  RotateCcw,
  Gauge,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronUp,
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
} from 'recharts';
import { Subject, PomodoroLog, StudyPreferences } from '../types';

interface ExamReadinessPredictorProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  preferences: StudyPreferences;
  onOpenExamsManager?: () => void;
  onSelectSubject?: (subjectId: string) => void;
}

export type ReadinessStatus = 'optimo' | 'ajustado' | 'riesgo';

export interface SubjectReadinessItem {
  subjectId: string;
  subjectName: string;
  shortName: string;
  color: string;
  examTitle: string;
  examDate: string | null;
  hasExplicitExamDate: boolean;
  daysRemaining: number;
  effectiveStudyDaysRemaining: number;
  totalTopics: number;
  completedTopics: number;
  pendingTopics: number;
  topicCompletionPct: number;
  totalPlannedRequiredHours: number;
  executedTotalHours: number;
  remainingRequiredHours: number;
  currentDailyPaceHours: number;
  simulatedDailyPaceHours: number;
  projectedAdditionalHours: number;
  projectedTotalHoursAtExam: number;
  projectedCoveragePct: number;
  requiredDailyHours: number;
  hoursDeltaAtExam: number;
  readinessPct: number;
  status: ReadinessStatus;
  statusLabel: string;
  actionTip: string;
}

function parseLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/**
 * Circular SVG Gauge for immediate visual perception of Exam Readiness (0-100%)
 */
const ReadinessRingGauge: React.FC<{
  percentage: number;
  status: ReadinessStatus;
  size?: number;
  strokeWidth?: number;
  sublabel?: string;
}> = ({ percentage, status, size = 92, strokeWidth = 8, sublabel = 'Preparación' }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    status === 'optimo'
      ? '#10b981' // emerald-500
      : status === 'ajustado'
      ? '#f59e0b' // amber-500
      : '#f43f5e'; // rose-500

  const trackColor =
    status === 'optimo'
      ? 'stroke-emerald-100 dark:stroke-emerald-950/60'
      : status === 'ajustado'
      ? 'stroke-amber-100 dark:stroke-amber-950/60'
      : 'stroke-rose-100 dark:stroke-rose-950/60';

  const textColor =
    status === 'optimo'
      ? 'text-emerald-600 dark:text-emerald-400'
      : status === 'ajustado'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400';

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          className={trackColor}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-lg font-extrabold font-mono-numbers leading-none ${textColor}`}>
          {clamped}%
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
          {sublabel}
        </span>
      </div>
    </div>
  );
};

export const ExamReadinessPredictor: React.FC<ExamReadinessPredictorProps> = ({
  subjects,
  pomodoroLogs,
  preferences,
  onOpenExamsManager,
  onSelectSubject,
}) => {
  // Interactive daily pace boost simulator (+0.0h to +4.0h extra per day)
  const [extraDailyHoursBoost, setExtraDailyHoursBoost] = useState<number>(0);
  const [showComparativeChart, setShowComparativeChart] = useState<boolean>(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const past14CutoffStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().split('T')[0];
  }, []);

  const availableDaysPerWeek = useMemo(() => {
    const days = preferences.availableDays?.length || 6;
    return Math.max(1, Math.min(7, days));
  }, [preferences.availableDays]);

  const subjectForecasts = useMemo<SubjectReadinessItem[]>(() => {
    const todayDate = parseLocalDay(todayStr);

    const totalRecentPomoMinutes = pomodoroLogs
      .filter((l) => l.date >= past14CutoffStr)
      .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

    const globalRecentDailyPace =
      totalRecentPomoMinutes > 0
        ? totalRecentPomoMinutes / 60 / 14
        : (preferences.dailyGoalHours || 2.5) * 0.65;

    const activeSubjectCount = Math.max(1, subjects.length);

    return subjects.map((sub) => {
      const futureExams = (sub.exams || [])
        .filter((e) => e.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date));

      const nextExam = futureExams[0] || null;
      const effectiveExamDateStr = nextExam?.date || null;

      const hasExplicitExamDate = Boolean(effectiveExamDateStr);

      let daysRemaining = 30;
      if (effectiveExamDateStr) {
        const examD = parseLocalDay(effectiveExamDateStr);
        const diffMs = examD.getTime() - todayDate.getTime();
        daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      const effectiveStudyDaysRemaining = Math.max(
        1,
        Math.round(daysRemaining * (availableDaysPerWeek / 7))
      );

      const targetTopicSet =
        nextExam && nextExam.topicIds && nextExam.topicIds.length > 0
          ? new Set(nextExam.topicIds)
          : null;

      const relevantTopics = targetTopicSet
        ? sub.topics.filter((t) => targetTopicSet.has(t.id))
        : sub.topics;

      const topicsPool = relevantTopics.length > 0 ? relevantTopics : sub.topics;
      const totalTopics = topicsPool.length;
      const completedTopics = topicsPool.filter(
        (t) => t.status === 'estudiado' || t.status === 'repasado'
      ).length;
      const pendingTopics = Math.max(0, totalTopics - completedTopics);
      const topicCompletionPct =
        totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 100;

      const difficultyHoursMap: Record<string, number> = {
        Baja: 1.5,
        Media: 2.5,
        Alta: 3.5,
      };

      let totalPlannedRequiredHours = 0;
      let remainingRequiredHours = 0;
      let topicLoggedSpentHours = 0;

      topicsPool.forEach((t) => {
        const baseEst =
          t.estimatedHours && t.estimatedHours > 0
            ? t.estimatedHours
            : difficultyHoursMap[t.difficulty] || 2.5;
        const reviewBuffer = 0.75;
        const topicTargetHours = baseEst + reviewBuffer;
        totalPlannedRequiredHours += topicTargetHours;

        const spent = t.actualHoursSpent || 0;
        topicLoggedSpentHours += spent;

        if (t.status === 'repasado') {
          remainingRequiredHours += 0.25;
        } else if (t.status === 'estudiado') {
          remainingRequiredHours += 0.65;
        } else if (t.status === 'en_progreso') {
          remainingRequiredHours += Math.max(0.75, topicTargetHours * 0.55);
        } else {
          remainingRequiredHours += topicTargetHours;
        }
      });

      const subAllTimePomoHours =
        pomodoroLogs
          .filter(
            (l) =>
              l.subjectId === sub.id ||
              (l.subjectName || '').toLowerCase() === sub.name.toLowerCase()
          )
          .reduce((acc, l) => acc + (l.durationMinutes || 0), 0) / 60;

      const impliedCompletedHours = Math.max(
        0,
        totalPlannedRequiredHours - remainingRequiredHours
      );

      const executedTotalHours =
        Math.round(
          Math.max(subAllTimePomoHours, topicLoggedSpentHours, impliedCompletedHours) * 10
        ) / 10;

      totalPlannedRequiredHours =
        Math.round(
          Math.max(
            totalPlannedRequiredHours,
            executedTotalHours + remainingRequiredHours
          ) * 10
        ) / 10;

      remainingRequiredHours =
        Math.round(
          Math.max(0, totalPlannedRequiredHours - executedTotalHours) * 10
        ) / 10;

      const subRecent14Mins = pomodoroLogs
        .filter(
          (l) =>
            l.date >= past14CutoffStr &&
            (l.subjectId === sub.id ||
              (l.subjectName || '').toLowerCase() === sub.name.toLowerCase())
        )
        .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

      const configuredSubWeeklyGoal =
        preferences.subjectWeeklyGoalHours?.[sub.id] ||
        preferences.defaultSubjectWeeklyGoalHours ||
        Math.max(2, (preferences.dailyGoalHours || 3) * 1.5);

      const currentDailyPaceHours =
        subRecent14Mins > 0
          ? Math.round((subRecent14Mins / 60 / 14) * 100) / 100
          : Math.round(
              Math.max(
                globalRecentDailyPace / activeSubjectCount,
                (configuredSubWeeklyGoal / 7) * 0.65
              ) * 100
            ) / 100;

      const perSubjectBoost = extraDailyHoursBoost / activeSubjectCount;
      const simulatedDailyPaceHours =
        Math.round((currentDailyPaceHours + perSubjectBoost) * 100) / 100;

      const projectedAdditionalHours =
        Math.round(simulatedDailyPaceHours * daysRemaining * 10) / 10;

      const projectedTotalHoursAtExam =
        Math.round((executedTotalHours + projectedAdditionalHours) * 10) / 10;

      const requiredDailyHours =
        remainingRequiredHours > 0
          ? Math.round((remainingRequiredHours / daysRemaining) * 100) / 100
          : 0;

      const hoursDeltaAtExam =
        Math.round((projectedTotalHoursAtExam - totalPlannedRequiredHours) * 10) / 10;

      const projectedCoveragePct =
        totalPlannedRequiredHours > 0
          ? Math.min(
              100,
              Math.round((projectedTotalHoursAtExam / totalPlannedRequiredHours) * 100)
            )
          : 100;

      const currentExecutionPct =
        totalPlannedRequiredHours > 0
          ? Math.min(
              100,
              Math.round((executedTotalHours / totalPlannedRequiredHours) * 100)
            )
          : 100;

      const readinessPct = Math.min(
        100,
        Math.round(projectedCoveragePct * 0.75 + currentExecutionPct * 0.25)
      );

      let status: ReadinessStatus = 'optimo';
      let statusLabel = 'En plazo';
      let actionTip = '';

      if (projectedCoveragePct >= 95 || remainingRequiredHours <= 0.5) {
        status = 'optimo';
        statusLabel = 'En Plazo';
        actionTip = `Llegas al 100% con +${Math.max(0, hoursDeltaAtExam)}h de margen para simulacros.`;
      } else if (projectedCoveragePct >= 75) {
        status = 'ajustado';
        statusLabel = 'Ajustado';
        const extraMinDay = Math.max(
          15,
          Math.round((requiredDailyHours - simulatedDailyPaceHours) * 60)
        );
        actionTip = `Suma +${extraMinDay} min/día (${requiredDailyHours}h/d) para cubrir los ${pendingTopics} temas pendientes.`;
      } else {
        status = 'riesgo';
        statusLabel = 'En Riesgo';
        actionTip = `Déficit de ${Math.abs(hoursDeltaAtExam)}h. Requiere ${requiredDailyHours}h/día y priorizar temas clave.`;
      }

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        shortName: sub.name.length > 16 ? `${sub.name.slice(0, 14)}…` : sub.name,
        color: sub.color || '#4f46e5',
        examTitle: nextExam?.title || 'Examen Final',
        examDate: effectiveExamDateStr,
        hasExplicitExamDate,
        daysRemaining,
        effectiveStudyDaysRemaining,
        totalTopics,
        completedTopics,
        pendingTopics,
        topicCompletionPct,
        totalPlannedRequiredHours,
        executedTotalHours,
        remainingRequiredHours,
        currentDailyPaceHours,
        simulatedDailyPaceHours,
        projectedAdditionalHours,
        projectedTotalHoursAtExam,
        projectedCoveragePct,
        requiredDailyHours,
        hoursDeltaAtExam,
        readinessPct,
        status,
        statusLabel,
        actionTip,
      };
    });
  }, [
    subjects,
    pomodoroLogs,
    preferences,
    todayStr,
    past14CutoffStr,
    availableDaysPerWeek,
    extraDailyHoursBoost,
  ]);

  const globalMetrics = useMemo(() => {
    if (subjectForecasts.length === 0) {
      return {
        avgProjectedCoverage: 100,
        optimoCount: 0,
        ajustadoCount: 0,
        riesgoCount: 0,
        totalExecuted: 0,
        totalPlanned: 0,
        totalProjectedAtExam: 0,
        totalRequiredDaily: 0,
        totalSimulatedDaily: 0,
        globalStatus: 'optimo' as ReadinessStatus,
      };
    }

    const totalExecuted =
      Math.round(
        subjectForecasts.reduce((acc, s) => acc + s.executedTotalHours, 0) * 10
      ) / 10;
    const totalPlanned =
      Math.round(
        subjectForecasts.reduce((acc, s) => acc + s.totalPlannedRequiredHours, 0) * 10
      ) / 10;
    const totalProjectedAtExam =
      Math.round(
        subjectForecasts.reduce((acc, s) => acc + s.projectedTotalHoursAtExam, 0) * 10
      ) / 10;

    const avgProjectedCoverage = Math.round(
      subjectForecasts.reduce((acc, s) => acc + s.projectedCoveragePct, 0) /
        subjectForecasts.length
    );

    const optimoCount = subjectForecasts.filter((s) => s.status === 'optimo').length;
    const ajustadoCount = subjectForecasts.filter((s) => s.status === 'ajustado').length;
    const riesgoCount = subjectForecasts.filter((s) => s.status === 'riesgo').length;

    const totalRequiredDaily =
      Math.round(
        subjectForecasts.reduce((acc, s) => acc + s.requiredDailyHours, 0) * 10
      ) / 10;
    const totalSimulatedDaily =
      Math.round(
        subjectForecasts.reduce((acc, s) => acc + s.simulatedDailyPaceHours, 0) * 10
      ) / 10;

    const globalStatus: ReadinessStatus =
      avgProjectedCoverage >= 92
        ? 'optimo'
        : avgProjectedCoverage >= 75
        ? 'ajustado'
        : 'riesgo';

    return {
      avgProjectedCoverage,
      optimoCount,
      ajustadoCount,
      riesgoCount,
      totalExecuted,
      totalPlanned,
      totalProjectedAtExam,
      totalRequiredDaily,
      totalSimulatedDaily,
      globalStatus,
    };
  }, [subjectForecasts]);

  const chartData = useMemo(() => {
    return subjectForecasts.map((s) => ({
      name: s.shortName,
      fullName: s.subjectName,
      horasEjecutadas: s.executedTotalHours,
      horasProyectadasAlExamen: s.projectedTotalHoursAtExam,
      horasNecesariasTotales: s.totalPlannedRequiredHours,
    }));
  }, [subjectForecasts]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Predictor Visual de Preparación para Exámenes
              </h4>
              <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800 text-[11px] font-bold">
                Tiempo Real
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Proyección de cobertura antes de cada examen según tus horas actuales y simulador de ritmo diario.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {onOpenExamsManager && (
            <button
              type="button"
              onClick={onOpenExamsManager}
              className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Fechas de Examen</span>
            </button>
          )}
        </div>
      </div>

      {/* Hero Visual Summary + Interactive Pace Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Global Readiness Gauge + Status Traffic Lights (5 cols) */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center gap-4">
          <ReadinessRingGauge
            percentage={globalMetrics.avgProjectedCoverage}
            status={globalMetrics.globalStatus}
            size={104}
            strokeWidth={10}
            sublabel="Global"
          />

          <div className="flex-1 min-w-0 space-y-2.5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Índice de Cobertura al Examen
              </span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {globalMetrics.totalProjectedAtExam}h proyectadas{' '}
                <span className="text-xs font-normal text-slate-500">
                  de {globalMetrics.totalPlanned}h meta
                </span>
              </div>
            </div>

            {/* Visual Status Traffic Light Pills */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <div className="p-2 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/60 text-center">
                <div className="text-base font-extrabold font-mono-numbers text-emerald-700 dark:text-emerald-300 leading-none">
                  {globalMetrics.optimoCount}
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1 block">
                  En plazo
                </span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 text-center">
                <div className="text-base font-extrabold font-mono-numbers text-amber-700 dark:text-amber-300 leading-none">
                  {globalMetrics.ajustadoCount}
                </div>
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mt-1 block">
                  Ajustadas
                </span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60 text-center">
                <div className="text-base font-extrabold font-mono-numbers text-rose-700 dark:text-rose-300 leading-none">
                  {globalMetrics.riesgoCount}
                </div>
                <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 mt-1 block">
                  En riesgo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Visual Simulator ("¿Qué pasa si estudio más al día?") (7 cols) */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-slate-50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-800/40 border border-indigo-200/70 dark:border-indigo-900/60 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <Sliders className="w-3.5 h-3.5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>Simulador Interactivo de Ritmo Diario</span>
                  {extraDailyHoursBoost > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono-numbers text-[10px] font-bold">
                      +{extraDailyHoursBoost}h/día activas
                    </span>
                  )}
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Prueba cómo sube tu preparación en cada asignatura al añadir tiempo diario.
                </p>
              </div>
            </div>

            {/* Quick Preset Step Buttons */}
            <div className="flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
              {[
                { val: 0, label: 'Actual' },
                { val: 0.5, label: '+30m' },
                { val: 1, label: '+1h' },
                { val: 2, label: '+2h' },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setExtraDailyHoursBoost(preset.val)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono-numbers transition-all cursor-pointer ${
                    extraDailyHoursBoost === preset.val
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slider + Live Pace Comparison Bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={4}
                step={0.25}
                value={extraDailyHoursBoost}
                onChange={(e) => setExtraDailyHoursBoost(parseFloat(e.target.value) || 0)}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                aria-label="Simular horas extra de estudio al día"
              />
              {extraDailyHoursBoost > 0 && (
                <button
                  type="button"
                  onClick={() => setExtraDailyHoursBoost(0)}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0"
                  title="Restablecer al ritmo actual"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-indigo-200/50 dark:border-indigo-900/40">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-slate-600 dark:text-slate-300">
                  Ritmo proyectado:{' '}
                  <strong className="font-mono-numbers text-indigo-700 dark:text-indigo-300">
                    {globalMetrics.totalSimulatedDaily}h/día
                  </strong>
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                Meta necesaria para el 100%:{' '}
                <strong className="font-mono-numbers text-slate-900 dark:text-white">
                  {globalMetrics.totalRequiredDaily}h/día
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Subject Readiness Cards Grid (2 Columns on Desktop) */}
      {subjectForecasts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjectForecasts.map((item) => {
            const executedWidthPct =
              item.totalPlannedRequiredHours > 0
                ? Math.min(
                    100,
                    Math.round(
                      (item.executedTotalHours / item.totalPlannedRequiredHours) * 100
                    )
                  )
                : 100;

            const projectedAdditionalWidthPct =
              item.totalPlannedRequiredHours > 0
                ? Math.min(
                    100 - executedWidthPct,
                    Math.round(
                      (item.projectedAdditionalHours / item.totalPlannedRequiredHours) *
                        100
                    )
                  )
                : 0;

            const statusBorder =
              item.status === 'optimo'
                ? 'border-emerald-200/90 dark:border-emerald-900/70'
                : item.status === 'ajustado'
                ? 'border-amber-200/90 dark:border-amber-900/70'
                : 'border-rose-200/90 dark:border-rose-900/70';

            const statusBadgeClass =
              item.status === 'optimo'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : item.status === 'ajustado'
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';

            return (
              <div
                key={item.subjectId}
                className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 ${statusBorder} shadow-2xs flex flex-col justify-between gap-4 transition-all hover:shadow-md`}
              >
                {/* Top Row: Ring Gauge + Subject Header + Countdown */}
                <div className="flex items-center gap-4">
                  <ReadinessRingGauge
                    percentage={item.projectedCoveragePct}
                    status={item.status}
                    size={84}
                    strokeWidth={8}
                    sublabel={item.statusLabel}
                  />

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <h5 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {item.subjectName}
                        </h5>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider shrink-0 inline-flex items-center gap-1 ${statusBadgeClass}`}
                      >
                        {item.status === 'optimo' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        <span>{item.statusLabel}</span>
                      </span>
                    </div>

                    {/* Exam Date & Days Countdown Pill */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                        <Calendar className="w-3 h-3 text-purple-500" />
                        <span className="truncate max-w-[150px]">{item.examTitle}</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-mono-numbers font-bold text-[11px]">
                        {item.hasExplicitExamDate
                          ? `Faltan ${item.daysRemaining} días`
                          : 'Horizonte 30d'}
                      </span>
                    </div>

                    {/* Mini Visual Metrics Row */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
                      <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[9px] uppercase text-slate-400 block">
                          Temario
                        </span>
                        <strong className="font-mono-numbers text-slate-800 dark:text-slate-200">
                          {item.completedTopics}/{item.totalTopics} ({item.topicCompletionPct}%)
                        </strong>
                      </div>

                      <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[9px] uppercase text-slate-400 block">
                          Ritmo / Meta
                        </span>
                        <strong className="font-mono-numbers text-indigo-600 dark:text-indigo-400">
                          {item.simulatedDailyPaceHours}h / {item.requiredDailyHours}h
                        </strong>
                      </div>

                      <div className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[9px] uppercase text-slate-400 block">
                          Balance
                        </span>
                        <strong
                          className={`font-mono-numbers ${
                            item.hoursDeltaAtExam >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {item.hoursDeltaAtExam >= 0
                            ? `+${item.hoursDeltaAtExam}h`
                            : `${item.hoursDeltaAtExam}h`}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dual-Segment Visual Progress Bar: Ejecutado + Proyectado vs Meta Total */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span>Hecho: {item.executedTotalHours}h</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span>Proyectado: +{item.projectedAdditionalHours}h</span>
                      </span>
                    </div>
                    <span className="font-mono-numbers font-bold text-slate-600 dark:text-slate-400">
                      Meta: {item.totalPlannedRequiredHours}h
                    </span>
                  </div>

                  {/* Multi-Segment Bar */}
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex p-0.5 gap-0.5">
                    {executedWidthPct > 0 && (
                      <div
                        className="h-full bg-blue-600 rounded-l-full transition-all duration-500"
                        style={{
                          width: `${executedWidthPct}%`,
                          borderTopRightRadius:
                            projectedAdditionalWidthPct === 0 ? '9999px' : '2px',
                          borderBottomRightRadius:
                            projectedAdditionalWidthPct === 0 ? '9999px' : '2px',
                        }}
                        title={`Horas ya ejecutadas: ${item.executedTotalHours}h`}
                      />
                    )}
                    {projectedAdditionalWidthPct > 0 && (
                      <div
                        className={`h-full transition-all duration-500 rounded-r-full ${
                          item.status === 'optimo'
                            ? 'bg-emerald-500'
                            : item.status === 'ajustado'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${projectedAdditionalWidthPct}%` }}
                        title={`Horas adicionales proyectadas antes del examen: +${item.projectedAdditionalHours}h`}
                      />
                    )}
                  </div>

                  {/* Footer Action Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">
                      {item.actionTip}
                    </span>

                    {onSelectSubject && (
                      <button
                        type="button"
                        onClick={() => onSelectSubject(item.subjectId)}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                      >
                        <span>Ver temario</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic text-center py-6">
          Añade asignaturas y fechas de examen para visualizar el predictor de preparación.
        </p>
      )}

      {/* Collapsible Comparative Bar Chart */}
      {chartData.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowComparativeChart((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>
                Gráfico Comparativo de Horas: Ejecutado vs. Proyectado vs. Meta Examen
              </span>
            </span>
            {showComparativeChart ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showComparativeChart && (
            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
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
                    formatter={(value: any, name: any) => [`${value}h`, name]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.fullName || label
                    }
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Bar
                    dataKey="horasEjecutadas"
                    name="Horas Ejecutadas"
                    fill="#3b82f6"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="horasProyectadasAlExamen"
                    name="Proyección al Examen"
                    fill="#8b5cf6"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="horasNecesariasTotales"
                    name="Meta Total Necesaria"
                    fill="#94a3b8"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
