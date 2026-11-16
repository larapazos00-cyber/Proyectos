import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import {
  Brain,
  Sparkles,
  RotateCcw,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  ArrowUpRight,
} from 'lucide-react';
import { Subject, StudyPreferences, PomodoroLog } from '../types';

interface EstimatedRetentionCurveChartProps {
  subjects: Subject[];
  preferences: StudyPreferences;
  pomodoroLogs?: PomodoroLog[];
  onOpenActiveRecall?: () => void;
  onSelectSubject?: (subjectId: string) => void;
  onOpenPreferences?: () => void;
}

interface CurveDataPoint {
  day: number;
  dayLabel: string;
  ebbinghausPure: number;
  spacedIdeal: number;
  userEstimated: number;
  simulatedBoost?: number;
  isReviewMilestone: boolean;
  milestoneLabel?: string;
}

export const EstimatedRetentionCurveChart: React.FC<EstimatedRetentionCurveChartProps> = ({
  subjects,
  preferences,
  pomodoroLogs = [],
  onOpenActiveRecall,
  onSelectSubject,
  onOpenPreferences,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [horizonDays, setHorizonDays] = useState<15 | 30 | 60>(30);
  const [simulateTodayReviewBoost, setSimulateTodayReviewBoost] = useState<boolean>(false);

  const configuredIntervals = useMemo<number[]>(() => {
    const raw = preferences.spacedRepetitionConfig?.intervals;
    if (raw && raw.length > 0) {
      return [...raw].sort((a, b) => a - b);
    }
    return [1, 3, 7, 15, 30];
  }, [preferences.spacedRepetitionConfig?.intervals]);

  const filteredSubjects = useMemo(() => {
    if (selectedSubjectId === 'all') return subjects;
    return subjects.filter((s) => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  // Aggregate quiz performance, spaced repetition history, and topic retention metrics
  const retentionAnalytics = useMemo(() => {
    let totalQuizzesCount = 0;
    let quizScoreSum = 0;
    let totalQuestionsAnswered = 0;

    let totalTopics = 0;
    let studiedTopics = 0;
    let totalReviewsCompleted = 0;
    let sumReviewLevel = 0;
    let sumPerceivedRetention = 0;
    let perceivedRetentionCount = 0;

    let totalFlashcards = 0;
    let masteredFlashcards = 0;
    let easeFactorSum = 0;

    let unresolvedErrors = 0;
    const todayIso = new Date().toISOString().split('T')[0];

    const topicBreakdown: Array<{
      topicId: string;
      topicTitle: string;
      subjectId: string;
      subjectName: string;
      subjectColor: string;
      reviewLevel: number;
      reviewsCount: number;
      quizAccuracyPct: number | null;
      estimatedRetentionToday: number;
      daysSinceLastReview: number;
      nextReviewDate?: string;
      isDueOrOverdue: boolean;
    }> = [];

    filteredSubjects.forEach((sub) => {
      // 1. Quizzes analysis for this subject
      const subQuizzes = sub.quizzes || [];
      const topicQuizScores: Record<string, number[]> = {};
      const subjectLevelScores: number[] = [];

      subQuizzes.forEach((qz) => {
        let qScore: number | undefined = qz.overallScore;
        if (qScore === undefined && qz.questions && qz.questions.length > 0) {
          const answered = qz.questions.filter(
            (qq) => qq.score !== undefined || qq.userAnswer !== undefined
          );
          if (answered.length > 0) {
            const sum = answered.reduce((acc, qq) => {
              if (typeof qq.score === 'number') return acc + qq.score;
              if (
                qq.userAnswer !== undefined &&
                qq.correctOptionIndex !== undefined
              ) {
                return acc + (Number(qq.userAnswer) === qq.correctOptionIndex ? 100 : 0);
              }
              return acc;
            }, 0);
            qScore = Math.round(sum / answered.length);
          }
        }

        if (qScore !== undefined) {
          totalQuizzesCount += 1;
          quizScoreSum += qScore;
          totalQuestionsAnswered += qz.questions?.length || 0;
          subjectLevelScores.push(qScore);
          if (qz.topicId) {
            if (!topicQuizScores[qz.topicId]) topicQuizScores[qz.topicId] = [];
            topicQuizScores[qz.topicId].push(qScore);
          }
        }
      });

      // 2. Flashcards analysis
      (sub.flashcards || []).forEach((fc) => {
        totalFlashcards += 1;
        easeFactorSum += fc.easeFactor || 2.5;
        if ((fc.repetitions || 0) >= 2 || fc.lastScore === 'facil' || fc.lastScore === 'bien') {
          masteredFlashcards += 1;
        }
      });

      // 3. Error logs
      unresolvedErrors += (sub.errorLogs || []).filter((e) => !e.resolved).length;

      // 4. Topics & Spaced Repetition analysis
      (sub.topics || []).forEach((t) => {
        totalTopics += 1;
        const isStudied = t.status === 'estudiado' || t.status === 'repasado';
        const revHistoryCount = t.reviewsHistory?.length || 0;
        const revLevel = t.reviewLevel || (isStudied ? 1 : 0);

        // Also check customQuestions scores if any
        const customAnswered = (t.customQuestions || []).filter(
          (cq) => cq.score !== undefined || cq.userAnswer !== undefined
        );
        if (customAnswered.length > 0) {
          const cScore = Math.round(
            customAnswered.reduce((acc, cq) => {
              if (typeof cq.score === 'number') return acc + cq.score;
              return acc + (Number(cq.userAnswer) === cq.correctOptionIndex ? 100 : 0);
            }, 0) / customAnswered.length
          );
          if (!topicQuizScores[t.id]) topicQuizScores[t.id] = [];
          topicQuizScores[t.id].push(cScore);
          totalQuizzesCount += 1;
          quizScoreSum += cScore;
          totalQuestionsAnswered += customAnswered.length;
        }

        if (isStudied || revHistoryCount > 0 || (topicQuizScores[t.id]?.length || 0) > 0) {
          studiedTopics += 1;
          totalReviewsCompleted += revHistoryCount;
          sumReviewLevel += revLevel;

          if (typeof t.perceivedRetentionPct === 'number') {
            sumPerceivedRetention += t.perceivedRetentionPct;
            perceivedRetentionCount += 1;
          }

          // Calculate days since last review or study
          const lastReviewRecord =
            t.reviewsHistory && t.reviewsHistory.length > 0
              ? t.reviewsHistory[t.reviewsHistory.length - 1]
              : undefined;
          const lastDateStr = lastReviewRecord?.date || t.studiedAt || todayIso;
          const diffMs =
            new Date(`${todayIso}T00:00:00`).getTime() -
            new Date(`${lastDateStr}T00:00:00`).getTime();
          const daysSince = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

          const tScores = topicQuizScores[t.id] || subjectLevelScores;
          const topicQuizAvg =
            tScores.length > 0
              ? Math.round(tScores.reduce((a, b) => a + b, 0) / tScores.length)
              : null;

          // Stability S in days for this topic: increases with reviewLevel and quiz accuracy
          const quizFactor = topicQuizAvg !== null ? 0.65 + (topicQuizAvg / 100) * 0.75 : 1.0;
          const topicStability = Math.max(
            2.2,
            (2.8 + revLevel * 4.2 + revHistoryCount * 2.5) * quizFactor
          );
          const initialAnchor =
            topicQuizAvg !== null
              ? Math.min(99, Math.max(68, Math.round(topicQuizAvg * 0.45 + 54)))
              : typeof t.perceivedRetentionPct === 'number'
              ? Math.min(98, Math.max(65, t.perceivedRetentionPct))
              : 92;

          const decayedRetention = Math.round(
            Math.max(28, Math.min(99, initialAnchor * Math.exp(-daysSince / topicStability)))
          );

          const isDueOrOverdue = Boolean(t.nextReviewDate && t.nextReviewDate <= todayIso);

          topicBreakdown.push({
            topicId: t.id,
            topicTitle: t.title,
            subjectId: sub.id,
            subjectName: sub.name,
            subjectColor: sub.color || '#3b82f6',
            reviewLevel: revLevel,
            reviewsCount: revHistoryCount,
            quizAccuracyPct: topicQuizAvg,
            estimatedRetentionToday: decayedRetention,
            daysSinceLastReview: daysSince,
            nextReviewDate: t.nextReviewDate,
            isDueOrOverdue,
          });
        }
      });
    });

    // Avg quiz score across completed quizzes (or fallback derived from perceived retention / flashcards)
    const hasQuizzes = totalQuizzesCount > 0;
    const avgQuizScorePct = hasQuizzes
      ? Math.round(quizScoreSum / totalQuizzesCount)
      : perceivedRetentionCount > 0
      ? Math.round(sumPerceivedRetention / perceivedRetentionCount)
      : totalFlashcards > 0
      ? Math.min(95, Math.round(68 + (masteredFlashcards / totalFlashcards) * 26))
      : 78;

    const avgReviewLevel =
      studiedTopics > 0 ? Math.round((sumReviewLevel / studiedTopics) * 10) / 10 : 1.2;

    const avgEaseFactor =
      totalFlashcards > 0
        ? Math.round((easeFactorSum / totalFlashcards) * 100) / 100
        : 2.5;

    const currentEstimatedRetention =
      topicBreakdown.length > 0
        ? Math.round(
            topicBreakdown.reduce((acc, item) => acc + item.estimatedRetentionToday, 0) /
              topicBreakdown.length
          )
        : avgQuizScorePct;

    // Sort topics by lowest retention or due status so the user sees what to reinforce first
    topicBreakdown.sort((a, b) => {
      if (a.isDueOrOverdue !== b.isDueOrOverdue) return a.isDueOrOverdue ? -1 : 1;
      return a.estimatedRetentionToday - b.estimatedRetentionToday;
    });

    return {
      hasQuizzes,
      totalQuizzesCount,
      totalQuestionsAnswered,
      avgQuizScorePct,
      totalTopics,
      studiedTopics,
      totalReviewsCompleted,
      avgReviewLevel,
      avgEaseFactor,
      totalFlashcards,
      masteredFlashcards,
      unresolvedErrors,
      currentEstimatedRetention,
      topicBreakdown,
    };
  }, [filteredSubjects]);

  // Build day-by-day retention curves (Day 0 to horizonDays)
  const { curveData, stabilityDays, day30RetentionUser, day30RetentionPure } = useMemo(() => {
    const {
      avgQuizScorePct,
      avgReviewLevel,
      totalReviewsCompleted,
      unresolvedErrors,
      studiedTopics,
    } = retentionAnalytics;

    // 1. Pure Ebbinghaus stability (no reviews): rapid decay S0 ~ 2.6 days
    const pureStability = 2.6;

    // 2. User calibration factor based on quiz accuracy, review depth, and unresolved mistakes
    const quizMultiplier = 0.65 + (avgQuizScorePct / 100) * 0.72; // 0.65 to 1.37
    const reviewExperienceBonus = Math.min(
      1.45,
      1 + avgReviewLevel * 0.12 + Math.min(20, totalReviewsCompleted) * 0.015
    );
    const errorPenalty = Math.max(0.78, 1 - unresolvedErrors * 0.025);

    const baseUserStability = Math.max(
      2.4,
      3.4 * quizMultiplier * reviewExperienceBonus * errorPenalty
    );

    // Starting anchor at Day 0 after a study/quiz session
    const userInitialAnchor = Math.min(
      99,
      Math.max(72, Math.round(avgQuizScorePct * 0.35 + 64))
    );

    const reviewMilestoneSet = new Set(configuredIntervals);
    const points: CurveDataPoint[] = [];

    let idealLastReviewDay = 0;
    let idealStability = 3.8;
    let idealAnchor = 98;

    let userLastReviewDay = 0;
    let currentUserStability = baseUserStability;
    let currentUserAnchor = userInitialAnchor;

    let simLastReviewDay = 0;
    let simStability = baseUserStability * 1.28;
    let simAnchor = Math.min(99, userInitialAnchor + 5);

    // Determine how consistently the user completes spaced repetition cycles
    const userReviewAdherence =
      studiedTopics > 0
        ? Math.min(1, Math.max(0.45, 0.52 + avgReviewLevel * 0.16))
        : 0.7;

    for (let day = 0; day <= horizonDays; day++) {
      const isMilestone = day > 0 && reviewMilestoneSet.has(day);
      const milestoneIndex = configuredIntervals.indexOf(day);

      if (isMilestone) {
        // Ideal Spaced Repetition boosts back to 96-99% and doubles stability
        idealLastReviewDay = day;
        idealStability = idealStability * 1.85;
        idealAnchor = Math.min(99, 95 + milestoneIndex);

        // User's Estimated Curve at review milestone: boost depends on quiz score & adherence
        userLastReviewDay = day;
        currentUserStability = currentUserStability * (1.45 + userReviewAdherence * 0.38);
        currentUserAnchor = Math.min(
          98,
          Math.round(userInitialAnchor * (0.9 + userReviewAdherence * 0.1))
        );

        // Simulated Boost Curve (if user completes today's quiz + review)
        simLastReviewDay = day;
        simStability = simStability * 1.92;
        simAnchor = 98;
      }

      const ebbinghausVal = Math.round(
        Math.max(12, 100 * Math.exp(-day / pureStability))
      );

      const idealDaysElapsed = day - idealLastReviewDay;
      const spacedIdealVal =
        day === 0
          ? 100
          : Math.round(
              Math.max(45, idealAnchor * Math.exp(-idealDaysElapsed / idealStability))
            );

      const userDaysElapsed = day - userLastReviewDay;
      const userEstimatedVal =
        day === 0
          ? userInitialAnchor
          : Math.round(
              Math.max(
                30,
                currentUserAnchor * Math.exp(-userDaysElapsed / currentUserStability)
              )
            );

      const simDaysElapsed = day - simLastReviewDay;
      const simulatedBoostVal =
        day === 0
          ? simAnchor
          : Math.round(
              Math.max(55, simAnchor * Math.exp(-simDaysElapsed / simStability))
            );

      points.push({
        day,
        dayLabel: day === 0 ? 'Día 0' : `Día ${day}`,
        ebbinghausPure: ebbinghausVal,
        spacedIdeal: spacedIdealVal,
        userEstimated: userEstimatedVal,
        simulatedBoost: simulateTodayReviewBoost ? simulatedBoostVal : undefined,
        isReviewMilestone: isMilestone,
        milestoneLabel: isMilestone ? `R${milestoneIndex + 1} (${day}d)` : undefined,
      });
    }

    const lastPt = points[points.length - 1] || points[0];

    return {
      curveData: points,
      stabilityDays: Math.round(baseUserStability * 10) / 10,
      day30RetentionUser: lastPt?.userEstimated ?? 75,
      day30RetentionPure: lastPt?.ebbinghausPure ?? 15,
    };
  }, [retentionAnalytics, configuredIntervals, horizonDays, simulateTodayReviewBoost]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400">
              <Brain className="w-5 h-5" />
            </div>
            <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Curva de Retención Estimada (Cuestionarios + Repetición Espaciada)
            </h4>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono-numbers font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              +{ Math.max(0, day30RetentionUser - day30RetentionPure) }% retención frente al olvido
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Proyección de memoria a largo plazo calculada combinando el porcentaje de acierto en tus cuestionarios y los ciclos de repaso espaciado ({configuredIntervals.join(' · ')} días).
          </p>
        </div>

        {/* Interactive Controls: Horizon & Simulation */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            {([15, 30, 60] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHorizonDays(days)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer font-mono-numbers ${
                  horizonDays === days
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {days} días
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSimulateTodayReviewBoost((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              simulateTodayReviewBoost
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
            }`}
            title="Simular el impacto en la curva si realizas un cuestionario y tus repasos espaciados hoy"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{simulateTodayReviewBoost ? 'Simulación Activa' : 'Simular Test + Repaso Hoy'}</span>
          </button>
        </div>
      </div>

      {/* Subject Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedSubjectId('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              selectedSubjectId === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
            }`}
          >
            Todas las materias ({subjects.length})
          </button>
          {subjects.map((sub) => {
            const active = selectedSubjectId === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubjectId(active ? 'all' : sub.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: sub.color || '#3b82f6' }}
                />
                <span className="max-w-[150px] truncate">{sub.name}</span>
              </button>
            );
          })}
        </div>

        {onOpenPreferences && (
          <button
            type="button"
            onClick={onOpenPreferences}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Intervalos SR: {configuredIntervals.join('-')}d</span>
          </button>
        )}
      </div>

      {/* 4 KPI Cards de Retención y Cuestionarios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80">
          <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 font-semibold">
            <span>Retención Estimada Hoy</span>
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-indigo-700 dark:text-indigo-300 mt-1">
            {retentionAnalytics.currentEstimatedRetention}%
          </div>
          <div className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5 font-mono-numbers">
            Al día {horizonDays}: ~{day30RetentionUser}% (vs {day30RetentionPure}% sin repaso)
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80">
          <div className="flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 font-semibold">
            <span>Precisión en Cuestionarios</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-emerald-700 dark:text-emerald-300 mt-1">
            {retentionAnalytics.avgQuizScorePct}%
          </div>
          <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5 font-mono-numbers">
            {retentionAnalytics.totalQuizzesCount > 0
              ? `${retentionAnalytics.totalQuizzesCount} test(s) · ${retentionAnalytics.totalQuestionsAnswered} pregs.`
              : 'Calibrado por progreso y flashcards'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/80">
          <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 font-semibold">
            <span>Estabilidad de Memoria</span>
            <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-blue-700 dark:text-blue-300 mt-1">
            {stabilityDays} días
          </div>
          <div className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-0.5 font-mono-numbers">
            Nivel medio: R{Math.max(1, Math.round(retentionAnalytics.avgReviewLevel))} · {retentionAnalytics.totalReviewsCompleted} repasos
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/80">
          <div className="flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 font-semibold">
            <span>Flashcards y Errores</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-amber-800 dark:text-amber-300 mt-1">
            {retentionAnalytics.masteredFlashcards}/{retentionAnalytics.totalFlashcards}
          </div>
          <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5 font-mono-numbers">
            Factor facilidad: {retentionAnalytics.avgEaseFactor} · {retentionAnalytics.unresolvedErrors} fallos pend.
          </div>
        </div>
      </div>

      {/* Main Recharts ComposedChart: Curva de Retención Estimada */}
      <div className="h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={curveData}
            margin={{ top: 16, right: 22, left: -8, bottom: 10 }}
          >
            <defs>
              <linearGradient id="userRetentionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="ebbinghausGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="dayLabel"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              interval={horizonDays === 60 ? 5 : horizonDays === 30 ? 2 : 1}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <Tooltip
              formatter={(value: any, name: any) => [`${value}%`, name]}
              labelFormatter={(label, payload) => {
                const pt = payload?.[0]?.payload as CurveDataPoint | undefined;
                if (pt?.isReviewMilestone && pt.milestoneLabel) {
                  return `${label} — Hito de Repaso Espaciado ${pt.milestoneLabel}`;
                }
                return String(label);
              }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

            {/* Línea de referencia del 80% (Dominio seguro para examen) */}
            <ReferenceLine
              y={80}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{
                value: 'Umbral Examen Seguro (80%)',
                position: 'insideTopRight',
                fill: '#059669',
                fontSize: 10,
              }}
            />

            {/* 1. Curva de Olvido de Ebbinghaus sin repaso */}
            <Area
              type="monotone"
              dataKey="ebbinghausPure"
              name="Olvido sin Repaso (Ebbinghaus)"
              stroke="#f43f5e"
              strokeWidth={1.75}
              strokeDasharray="4 4"
              fill="url(#ebbinghausGrad)"
              dot={false}
            />

            {/* 2. Curva Ideal del Método de Repetición Espaciada */}
            <Line
              type="monotone"
              dataKey="spacedIdeal"
              name="Método Repetición Espaciada Óptimo"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
            />

            {/* 3. Curva de Retención Estimada del Usuario (Cuestionarios + Repasos) */}
            <Area
              type="monotone"
              dataKey="userEstimated"
              name="Tu Curva de Retención Estimada"
              stroke="#4f46e5"
              strokeWidth={3}
              fill="url(#userRetentionGrad)"
              activeDot={{ r: 6, strokeWidth: 2 }}
            />

            {/* 4. Curva Simulada si hace Test + Repaso hoy */}
            {simulateTodayReviewBoost && (
              <Line
                type="monotone"
                dataKey="simulatedBoost"
                name="Proyección con Test + Repaso Hoy"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
              />
            )}

            {/* Puntos de hito de Repaso Espaciado (R1..R5) sobre la curva del usuario */}
            {curveData
              .filter((pt) => pt.isReviewMilestone)
              .map((pt) => (
                <ReferenceDot
                  key={`milestone-${pt.day}`}
                  x={pt.dayLabel}
                  y={pt.userEstimated}
                  r={5}
                  fill="#4f46e5"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Topic-level Retention & Quiz Reinforcement Table */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Diagnóstico de Retención por Tema y Refuerzo con Cuestionarios
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Temas ordenados según su decaimiento estimado en la curva del olvido y resultados en tests.
            </p>
          </div>

          {onOpenActiveRecall && (
            <button
              type="button"
              onClick={onOpenActiveRecall}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Practicar en Cuestionarios</span>
            </button>
          )}
        </div>

        {retentionAnalytics.topicBreakdown.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3">
            <span>
              Aún no hay temas estudiados o cuestionarios completados en esta selección. Marca temas como estudiados o realiza un test para calibrar tu curva individual por tema.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {retentionAnalytics.topicBreakdown.slice(0, 6).map((item) => {
              const isHigh = item.estimatedRetentionToday >= 80;
              const isMed =
                item.estimatedRetentionToday >= 60 && item.estimatedRetentionToday < 80;
              return (
                <div
                  key={`${item.subjectId}-${item.topicId}`}
                  className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 flex flex-col justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.subjectColor }}
                        />
                        <span className="truncate">{item.subjectName}</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono-numbers font-bold shrink-0 ${
                          isHigh
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : isMed
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {item.estimatedRetentionToday}% retención
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {item.topicTitle}
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isHigh
                          ? 'bg-emerald-500'
                          : isMed
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${item.estimatedRetentionToday}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono-numbers pt-0.5">
                    <span>
                      Ciclo R{Math.max(1, item.reviewLevel)} ·{' '}
                      {item.quizAccuracyPct !== null
                        ? `Test: ${item.quizAccuracyPct}%`
                        : `${item.reviewsCount} rep.`}
                    </span>
                    {onSelectSubject && (
                      <button
                        type="button"
                        onClick={() => onSelectSubject(item.subjectId)}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Repasar</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
