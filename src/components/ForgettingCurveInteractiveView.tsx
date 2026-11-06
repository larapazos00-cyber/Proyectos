import React, { useState, useMemo } from 'react';
import {
  Brain,
  RotateCw,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Clock,
  Sparkles,
  Filter,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Subject, Topic, ReviewQuality, SpacedReviewRecord } from '../types';
import { TopicReviewScheduleModal } from './TopicReviewScheduleModal';
import { schedulerService } from '../services/schedulerService';

interface ForgettingCurveInteractiveViewProps {
  subjects: Subject[];
  initialSubjectId?: string;
  onUpdateSubject?: (updated: Subject) => void;
  onSelectSubject?: (subjectId: string) => void;
  onOpenActiveRecall?: () => void;
  configuredIntervals?: [number, number, number, number, number];
  activeProfileName?: string;
}

export type ReviewUrgency =
  | 'all'
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'due_week'
  | 'due_month';

interface ScheduledTopicItem {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topic: Topic;
  topicIndex: number;
  reviewLevel: number;
  levelLabel: string;
  nextReviewDate: string | null;
  daysUntilReview: number | null;
  urgency: ReviewUrgency;
  urgencyLabel: string;
  badgeClass: string;
  estimatedRetentionPct: number;
  errorsCount: number;
  vueltasCount: number;
  studiedPages: number;
  totalPages: number;
  studiedPct: number;
  estimatedReviewMinutes: number;
}

const INTERVAL_DAYS = [1, 3, 7, 15, 30];

export const ForgettingCurveInteractiveView: React.FC<
  ForgettingCurveInteractiveViewProps
> = ({
  subjects,
  initialSubjectId = 'all',
  onUpdateSubject,
  onSelectSubject,
  onOpenActiveRecall,
  configuredIntervals,
  activeProfileName,
}) => {
  const effectiveIntervals: [number, number, number, number, number] = configuredIntervals || [1, 3, 7, 15, 30];

  const dynamicLevelLabels: Record<number, string> = useMemo(() => ({
    1: `1.ᵉʳ repaso · ${effectiveIntervals[0]}d (${effectiveIntervals[0] === 1 ? '24h' : `${effectiveIntervals[0]} días`})`,
    2: `2.º repaso · ${effectiveIntervals[1]} días`,
    3: `3.ᵉʳ repaso · ${effectiveIntervals[2]} días`,
    4: `4.º repaso · ${effectiveIntervals[3]} días`,
    5: `5.º repaso · ${effectiveIntervals[4]} días`,
  }), [effectiveIntervals]);
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId);
  const [urgencyFilter, setUrgencyFilter] = useState<ReviewUrgency>('all');
  const [showTheoreticalCurve, setShowTheoreticalCurve] = useState<boolean>(true);
  const [adjustingTopic, setAdjustingTopic] = useState<{
    topic: Topic;
    subjectName: string;
    subjectColor: string;
  } | null>(null);

  // 1. Process all scheduled reviews across subjects based on the 24h, 3d, 7d, 15d, 30d calendar
  const allScheduledTopics = useMemo(() => {
    const list: ScheduledTopicItem[] = [];

    subjects.forEach((sub) => {
      sub.topics.forEach((t, idx) => {
        const lv = Math.min(5, Math.max(1, t.reviewLevel || 1));
        const reviewDate = t.nextReviewDate || null;

        let daysUntil: number | null = null;
        let urgency: ReviewUrgency = 'all';
        let urgencyLabel = 'Programado';
        let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';

        if (reviewDate) {
          const dTarget = new Date(`${reviewDate}T00:00:00`);
          const dToday = new Date(`${todayStr}T00:00:00`);
          daysUntil = Math.round(
            (dTarget.getTime() - dToday.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysUntil < 0) {
            urgency = 'overdue';
            urgencyLabel = `Vencido (${Math.abs(daysUntil)}d atrás)`;
            badgeClass =
              'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
          } else if (daysUntil === 0) {
            urgency = 'due_today';
            urgencyLabel = '¡Vence Hoy!';
            badgeClass =
              'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
          } else if (daysUntil <= 3) {
            urgency = 'due_soon';
            urgencyLabel = `En ${daysUntil} día${daysUntil === 1 ? '' : 's'}`;
            badgeClass =
              'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
          } else if (daysUntil <= 7) {
            urgency = 'due_week';
            urgencyLabel = `En ${daysUntil} días (1 sem)`;
            badgeClass =
              'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800';
          } else {
            urgency = 'due_month';
            urgencyLabel = `En ${daysUntil} días`;
            badgeClass =
              'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
          }
        }

        // Calculate estimated retention based on Ebbinghaus model & self-evaluation
        let estimatedRetention = t.perceivedRetentionPct ?? 80;
        if (daysUntil !== null && daysUntil < 0) {
          // If overdue, decay estimated retention
          const decay = Math.min(45, Math.abs(daysUntil) * 6);
          estimatedRetention = Math.max(25, estimatedRetention - decay);
        }

        const errors =
          t.unresolvedErrorsCount !== undefined
            ? t.unresolvedErrorsCount
            : sub.errorLogs.filter(
                (e) =>
                  !e.resolved &&
                  (e.topicId === t.id ||
                    (e.topicTitle &&
                      e.topicTitle.toLowerCase().includes(t.title.toLowerCase())) ||
                    (e.concept && e.concept.toLowerCase().includes(t.title.toLowerCase())))
              ).length;

        const vueltas =
          t.vueltasCount !== undefined
            ? t.vueltasCount
            : (t.reviewsHistory?.length || 0) +
              (t.status === 'estudiado' || t.status === 'repasado' || t.studiedAt ? 1 : 0);

        const pageStats = schedulerService.getTopicStudiedPages(t);
        const revCalc = schedulerService.calculateTopicReviewTime(t, pageStats.studiedPages, lv);

        // Include topic if studied, repasado, has studied pages, or has a scheduled review
        if (
          t.nextReviewDate ||
          t.status === 'estudiado' ||
          t.status === 'repasado' ||
          pageStats.studiedPages > 0 ||
          (t.reviewsHistory && t.reviewsHistory.length > 0)
        ) {
          list.push({
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color || '#3b82f6',
            topic: t,
            topicIndex: idx + 1,
            reviewLevel: lv,
            levelLabel: dynamicLevelLabels[lv] || `Nivel ${lv}`,
            nextReviewDate: reviewDate,
            daysUntilReview: daysUntil,
            urgency,
            urgencyLabel,
            badgeClass,
            estimatedRetentionPct: estimatedRetention,
            errorsCount: errors,
            vueltasCount: vueltas,
            studiedPages: revCalc.pagesToReview,
            totalPages: revCalc.totalPages,
            studiedPct: revCalc.studiedPct,
            estimatedReviewMinutes: revCalc.reviewMinutes,
          });
        }
      });
    });

    // Sort by days until review (overdue first, then today, then upcoming)
    return list.sort((a, b) => {
      const aVal = a.daysUntilReview !== null ? a.daysUntilReview : 999;
      const bVal = b.daysUntilReview !== null ? b.daysUntilReview : 999;
      return aVal - bVal;
    });
  }, [subjects, todayStr]);

  // 2. Filtered list based on subject and urgency selectors
  const filteredTopics = useMemo(() => {
    return allScheduledTopics.filter((item) => {
      if (selectedSubjectId !== 'all' && item.subjectId !== selectedSubjectId) {
        return false;
      }
      if (urgencyFilter !== 'all' && item.urgency !== urgencyFilter) {
        return false;
      }
      return true;
    });
  }, [allScheduledTopics, selectedSubjectId, urgencyFilter]);

  // 3. Global Urgency KPIs
  const overdueCount = useMemo(
    () => allScheduledTopics.filter((t) => t.urgency === 'overdue').length,
    [allScheduledTopics]
  );
  const dueTodayCount = useMemo(
    () => allScheduledTopics.filter((t) => t.urgency === 'due_today').length,
    [allScheduledTopics]
  );
  const dueSoonCount = useMemo(
    () => allScheduledTopics.filter((t) => t.urgency === 'due_soon').length,
    [allScheduledTopics]
  );
  const avgRetention = useMemo(() => {
    if (allScheduledTopics.length === 0) return 80;
    return Math.round(
      allScheduledTopics.reduce((acc, t) => acc + t.estimatedRetentionPct, 0) /
        allScheduledTopics.length
    );
  }, [allScheduledTopics]);

  // 4. Mathematical Ebbinghaus Forgetting Curve points (0 to 35 days)
  // Incorporating review leaps at 1 day (24h), 3 days, 7 days, 15 days, and 30 days
  const ebbinghausChartData = useMemo(() => {
    const daysTimeline = [
      0, 0.5, 1, 1.01, 2, 3, 3.01, 4, 5, 6, 7, 7.01, 9, 11, 13, 15, 15.01, 18, 22, 26, 30, 30.01, 33, 35,
    ];

    // Filter topics that are in current scope
    const targetTopics =
      selectedSubjectId === 'all'
        ? allScheduledTopics
        : allScheduledTopics.filter((t) => t.subjectId === selectedSubjectId);

    return daysTimeline.map((day) => {
      // Curve WITHOUT spaced reviews: R(t) = 100 * e^(-t / 1.6)
      const sinRepaso = Math.max(12, Math.round(100 * Math.exp(-day / 1.8)));

      // Curve WITH scheduled spaced reviews (24h, 3d, 7d, 15d, 30d):
      let conRepasos = 100;
      if (day <= 1) {
        // Stage 1: initial study decaying towards 24h
        conRepasos = Math.round(100 * Math.exp(-day / 1.8));
      } else if (day <= 3) {
        // Stage 2: post-24h review (decaying from Day 1 to Day 3)
        const tSinceR1 = day - 1;
        conRepasos = Math.round(100 * Math.exp(-tSinceR1 / 4.8));
      } else if (day <= 7) {
        // Stage 3: post-3d review (decaying from Day 3 to Day 7)
        const tSinceR2 = day - 3;
        conRepasos = Math.round(100 * Math.exp(-tSinceR2 / 10.5));
      } else if (day <= 15) {
        // Stage 4: post-7d review (decaying from Day 7 to Day 15)
        const tSinceR3 = day - 7;
        conRepasos = Math.round(100 * Math.exp(-tSinceR3 / 24));
      } else if (day <= 30) {
        // Stage 5: post-15d review (decaying from Day 15 to Day 30)
        const tSinceR4 = day - 15;
        conRepasos = Math.round(100 * Math.exp(-tSinceR4 / 55));
      } else {
        // Permanent memory consolidation after 30 days
        const tSinceR5 = day - 30;
        conRepasos = Math.round(100 * Math.exp(-tSinceR5 / 150));
      }

      // Count topics scheduled near this day marker
      let markerLabel = '';
      if (day === 1) markerLabel = '1er Repaso: 24h';
      else if (day === 3) markerLabel = '2º Repaso: 3 días';
      else if (day === 7) markerLabel = '3er Repaso: 7 días';
      else if (day === 15) markerLabel = '4º Repaso: 15 días';
      else if (day === 30) markerLabel = '5º Repaso: 30 días';

      // Find topics with target review matching this interval
      const matchingTopicsCount = targetTopics.filter((t) => {
        if (day === 1 && t.reviewLevel === 1) return true;
        if (day === 3 && t.reviewLevel === 2) return true;
        if (day === 7 && t.reviewLevel === 3) return true;
        if (day === 15 && t.reviewLevel === 4) return true;
        if (day === 30 && t.reviewLevel === 5) return true;
        return false;
      }).length;

      return {
        dia: day,
        label:
          day === 0
            ? 'Estudio inicial'
            : day === 1
            ? '24h (1d)'
            : day === 3
            ? 'Día 3'
            : day === 7
            ? 'Día 7 (1 sem)'
            : day === 15
            ? 'Día 15'
            : day === 30
            ? 'Día 30 (1 mes)'
            : `Día ${Math.floor(day)}`,
        conRepasos: Math.min(100, conRepasos),
        sinRepaso,
        umbralRecomendado: 80,
        markerLabel,
        temasEnEsteHito: matchingTopicsCount > 0 ? matchingTopicsCount : null,
      };
    });
  }, [allScheduledTopics, selectedSubjectId]);

  // Handler to save manual adjustments from the modal
  const handleSaveModalSchedule = (
    topicId: string,
    updatedData: {
      nextReviewDate: string;
      perceivedRetentionPct: number;
      reviewLevel: number;
      lastIntervalDays: number;
      lastAdjustmentReason: string;
      unresolvedErrorsCount?: number;
      pagesRead?: number;
      pageCount?: number;
      newReviewRecord?: SpacedReviewRecord;
    }
  ) => {
    if (!onUpdateSubject || !adjustingTopic) return;
    const targetSub = subjects.find(
      (s) => s.topics.some((t) => t.id === topicId)
    );
    if (!targetSub) return;

    const updatedTopics = targetSub.topics.map((t) => {
      if (t.id === topicId) {
        const history = updatedData.newReviewRecord
          ? [...(t.reviewsHistory || []), updatedData.newReviewRecord]
          : t.reviewsHistory;

        return {
          ...t,
          status: t.status === 'pendiente' ? ('estudiado' as const) : t.status,
          studiedAt: t.studiedAt || todayStr,
          nextReviewDate: updatedData.nextReviewDate,
          perceivedRetentionPct: updatedData.perceivedRetentionPct,
          reviewLevel: updatedData.reviewLevel,
          lastIntervalDays: updatedData.lastIntervalDays,
          lastAdjustmentReason: updatedData.lastAdjustmentReason,
          pagesRead: updatedData.pagesRead !== undefined ? updatedData.pagesRead : t.pagesRead,
          pageCount: updatedData.pageCount !== undefined ? updatedData.pageCount : t.pageCount,
          unresolvedErrorsCount:
            updatedData.unresolvedErrorsCount !== undefined
              ? updatedData.unresolvedErrorsCount
              : t.unresolvedErrorsCount,
          reviewsHistory: history,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...targetSub,
      topics: updatedTopics,
    });

    setAdjustingTopic(null);
  };

  return (
    <div className="space-y-6">
      {/* 4 Urgency & Status KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div
          onClick={() => setUrgencyFilter(urgencyFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            overdueCount > 0
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 hover:bg-rose-100/60'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
          } ${urgencyFilter === 'overdue' ? 'ring-2 ring-rose-500 shadow-sm' : ''}`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-300">
            <span>Repasos Vencidos</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono-numbers text-rose-900 dark:text-rose-100 mt-1">
            {overdueCount}
          </div>
          <p className="text-[11px] text-rose-700/80 dark:text-rose-400 mt-0.5">
            {overdueCount === 0
              ? '¡Excelente! Sin repasos atrasados'
              : 'Curva en declive: repasa hoy para recuperar'}
          </p>
        </div>

        <div
          onClick={() => setUrgencyFilter(urgencyFilter === 'due_today' ? 'all' : 'due_today')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            dueTodayCount > 0
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 hover:bg-amber-100/60'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
          } ${urgencyFilter === 'due_today' ? 'ring-2 ring-amber-500 shadow-sm' : ''}`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
            <span>Vencen Hoy</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono-numbers text-amber-900 dark:text-amber-100 mt-1">
            {dueTodayCount}
          </div>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
            {dueTodayCount === 0 ? 'Sin temas para hoy' : 'Hito óptimo de fijación de memoria'}
          </p>
        </div>

        <div
          onClick={() => setUrgencyFilter(urgencyFilter === 'due_soon' ? 'all' : 'due_soon')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 hover:bg-blue-100/60 ${
            urgencyFilter === 'due_soon' ? 'ring-2 ring-blue-500 shadow-sm' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-800 dark:text-blue-300">
            <span>Próximas 24h - 3 días</span>
            <RotateCw className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono-numbers text-blue-900 dark:text-blue-100 mt-1">
            {dueSoonCount}
          </div>
          <p className="text-[11px] text-blue-700/80 dark:text-blue-400 mt-0.5">
            R1 y R2 para consolidación rápida
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span>Retención Media Proyectada</span>
            <Brain className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono-numbers text-emerald-900 dark:text-emerald-100 mt-1">
            {avgRetention}%
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
            Calculado con modelo Ebbinghaus
          </p>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Materia:</span>
            </span>

            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todas las materias activas ({subjects.length})</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.topics.length} temas)
                </option>
              ))}
            </select>
          </div>

          {/* Toggle theoretical curve */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showTheoreticalCurve}
              onChange={(e) => setShowTheoreticalCurve(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Comparar con Curva del Olvido Clásica (Sin Repasos)</span>
          </label>
        </div>

        {/* Urgency Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
            Filtrar por vencimiento:
          </span>

          <button
            type="button"
            onClick={() => setUrgencyFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              urgencyFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Todos ({allScheduledTopics.length})
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('overdue')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              urgencyFilter === 'overdue'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
            }`}
          >
            🔴 Vencidos ({overdueCount})
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('due_today')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              urgencyFilter === 'due_today'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
            }`}
          >
            🟡 Hoy ({dueTodayCount})
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('due_soon')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              urgencyFilter === 'due_soon'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300'
            }`}
          >
            🔵 Próximos 1-3 días ({dueSoonCount})
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('due_week')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              urgencyFilter === 'due_week'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300'
            }`}
          >
            🟣 1 semana (7 días)
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('due_month')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              urgencyFilter === 'due_month'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
            }`}
          >
            🟢 Quincena y Mes (15d - 30d)
          </button>
        </div>
      </div>

      {/* Interactive Visual Forgetting Curve Chart */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
              <RotateCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                Visualización Interactiva de la Curva del Olvido y Vencimiento de Repasos
              </span>
              {activeProfileName && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Perfil: {activeProfileName}
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Representación del decaimiento de retención ($R=e^{'{'}-t/S{'}'}$) y cómo los repasos en {effectiveIntervals[0]}d, {effectiveIntervals[1]}d, {effectiveIntervals[2]}d, {effectiveIntervals[3]}d y {effectiveIntervals[4]}d devuelven la memoria al 100%.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-indigo-600 font-semibold">
              <span className="w-3 h-0.5 bg-indigo-600 rounded" />
              Curva con Repasos ({effectiveIntervals.join('-')}d)
            </span>
            {showTheoreticalCurve && (
              <span className="flex items-center gap-1.5 text-rose-500 font-semibold">
                <span className="w-3 h-0.5 bg-rose-500 border-dashed rounded" />
                Sin Repasos
              </span>
            )}
          </div>
        </div>

        {/* Recharts Curve */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={ebbinghausChartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval={2}
              />
              <YAxis
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-3 bg-slate-900/95 text-white rounded-xl shadow-xl text-xs space-y-1.5 max-w-xs border border-slate-700">
                        <div className="font-bold text-sm text-indigo-300">
                          {data.label} (Día {data.dia})
                        </div>
                        <div className="flex items-center justify-between text-indigo-200">
                          <span>Retención con Repasos:</span>
                          <strong className="font-mono-numbers">{data.conRepasos}%</strong>
                        </div>
                        {showTheoreticalCurve && (
                          <div className="flex items-center justify-between text-rose-300">
                            <span>Retención Sin Repasar:</span>
                            <strong className="font-mono-numbers">{data.sinRepaso}%</strong>
                          </div>
                        )}
                        {data.markerLabel && (
                          <div className="pt-1 border-t border-slate-700 text-amber-300 font-semibold text-[11px]">
                            ⭐ {data.markerLabel}
                          </div>
                        )}
                        {data.temasEnEsteHito && (
                          <div className="text-emerald-300 text-[11px]">
                            📌 {data.temasEnEsteHito} tema{data.temasEnEsteHito === 1 ? '' : 's'} programado{data.temasEnEsteHito === 1 ? '' : 's'} en este nivel
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={80}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{
                  value: 'Umbral óptimo (80%)',
                  fill: '#059669',
                  fontSize: 10,
                  position: 'right',
                }}
              />
              {/* Reference lines for the 5 review milestones */}
              <ReferenceLine x="24h (1d)" stroke="#3b82f6" strokeDasharray="2 2" />
              <ReferenceLine x="Día 3" stroke="#3b82f6" strokeDasharray="2 2" />
              <ReferenceLine x="Día 7 (1 sem)" stroke="#3b82f6" strokeDasharray="2 2" />
              <ReferenceLine x="Día 15" stroke="#3b82f6" strokeDasharray="2 2" />
              <ReferenceLine x="Día 30 (1 mes)" stroke="#3b82f6" strokeDasharray="2 2" />

              <Line
                type="monotone"
                dataKey="conRepasos"
                name="Retención con Repasos"
                stroke="#4f46e5"
                strokeWidth={3}
                dot={{ r: 3, fill: '#4f46e5' }}
                activeDot={{ r: 6 }}
              />

              {showTheoreticalCurve && (
                <Line
                  type="monotone"
                  dataKey="sinRepaso"
                  name="Curva del Olvido Clásica"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Milestone Explanation Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
          <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80">
            <span className="font-bold text-blue-900 dark:text-blue-200 block">
              1er Repaso · 24h
            </span>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              Frena la caída más brusca (pérdida del 50% de la información en el 1er día).
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/80">
            <span className="font-bold text-blue-900 dark:text-blue-200 block">
              2º Repaso · 3 días
            </span>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              Consolida la huella mnémica temprana y afianza términos técnicos.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80">
            <span className="font-bold text-indigo-900 dark:text-indigo-200 block">
              3er Repaso · 7 días
            </span>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              1 semana: activa memoria a medio plazo y relaciones causa-efecto.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/80">
            <span className="font-bold text-purple-900 dark:text-purple-200 block">
              4º Repaso · 15 días
            </span>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              Quincena: consolida conceptos abstractos y resolución de problemas.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80">
            <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
              5º Repaso · 30 días
            </span>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              1 mes: memoria permanente a largo plazo lista para examen final.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Scheduled Reviews per Subject with Manual Adjust Action */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>
                Desglose de Repasos Programados por Materia ({filteredTopics.length} temas)
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pulsa en "Ajustar Fecha y Retención" en cualquier tema para adelantar o retrasar el intervalo según tu autoevaluación.
            </p>
          </div>
        </div>

        {filteredTopics.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No hay repasos en este filtro
            </h5>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Todos los temas de la materia seleccionada están al día o no coinciden con el filtro de vencimiento activo.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedSubjectId('all');
                setUrgencyFilter('all');
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Ver todos los repasos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredTopics.map((item) => (
              <div
                key={`${item.subjectId}-${item.topic.id}`}
                className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs space-y-3"
              >
                {/* Header: Subject badge & urgency pill */}
                <div className="flex items-center justify-between gap-2">
                  <div
                    onClick={() => {
                      if (onSelectSubject) onSelectSubject(item.subjectId);
                    }}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: `${item.subjectColor}15`,
                      color: item.subjectColor,
                      border: `1px solid ${item.subjectColor}30`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: item.subjectColor }}
                    />
                    <span className="truncate max-w-[140px]">{item.subjectName}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeClass}`}
                  >
                    {item.urgencyLabel}
                  </span>
                </div>

                {/* Topic Title & Difficulty */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5 font-mono-numbers">
                    <span>Tema {item.topicIndex}</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {item.levelLabel}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                    {item.topic.title}
                  </h5>
                </div>

                {/* Metrics: Retention Bar & Date */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">
                      Retención estimada:
                    </span>
                    <span className="font-mono-numbers font-bold text-slate-900 dark:text-slate-100">
                      {item.estimatedRetentionPct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.estimatedRetentionPct >= 80
                          ? 'bg-emerald-500'
                          : item.estimatedRetentionPct >= 60
                          ? 'bg-blue-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${item.estimatedRetentionPct}%` }}
                    />
                  </div>
                </div>

                {/* Studied Pages & Review Time Badge */}
                <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/70 flex items-center justify-between gap-2 text-[11px] font-mono-numbers">
                  <span className="inline-flex items-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-200">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>
                      {item.studiedPages}/{item.totalPages} págs. estudiadas ({item.studiedPct}%)
                    </span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 font-bold text-indigo-700 dark:text-indigo-300">
                    ⏱ ~{item.estimatedReviewMinutes}m repaso
                  </span>
                </div>

                {/* Date & Note metadata */}
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                  <span className="flex items-center gap-1 font-mono-numbers">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>Fecha: {item.nextReviewDate || 'Sin fecha fija'}</span>
                  </span>

                  {item.errorsCount > 0 && (
                    <span className="text-rose-600 font-semibold font-mono-numbers">
                      ⚠ {item.errorsCount} {item.errorsCount === 1 ? 'error' : 'errores'}
                    </span>
                  )}
                </div>

                {/* Action Buttons: Adjust date manually / Retention */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setAdjustingTopic({
                        topic: item.topic,
                        subjectName: item.subjectName,
                        subjectColor: item.subjectColor,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 font-bold border border-blue-200 dark:border-blue-800 rounded-xl text-xs transition-colors cursor-pointer"
                    title="Ajustar manualmente la fecha del próximo repaso y autoevaluar retención"
                  >
                    <Calendar className="w-3 h-3 text-blue-600" />
                    <span>Ajustar Fecha y Retención</span>
                  </button>

                  {onOpenActiveRecall && (
                    <button
                      type="button"
                      onClick={onOpenActiveRecall}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                      title="Abrir mazo de Active Recall para repasar"
                    >
                      <Brain className="w-3 h-3" />
                      <span>Repasar</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal interactivo de ajuste manual de fecha y autoevaluación de retención */}
      <TopicReviewScheduleModal
        isOpen={!!adjustingTopic}
        onClose={() => setAdjustingTopic(null)}
        topic={adjustingTopic?.topic || null}
        subjectName={adjustingTopic?.subjectName}
        subjectColor={adjustingTopic?.subjectColor}
        onSaveSchedule={handleSaveModalSchedule}
      />
    </div>
  );
};
