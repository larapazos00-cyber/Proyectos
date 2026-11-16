import React, { useMemo, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Brain, Filter, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { Subject, PomodoroLog, StudyPreferences } from '../types';

interface CompetencyRadarChartProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  preferences: StudyPreferences;
  onOpenActiveRecall?: () => void;
  onOpenPreferences?: () => void;
}

interface CompetencyAxisPoint {
  id: string;
  competency: string;
  shortLabel: string;
  score: number;
  targetScore: number;
  globalScore: number;
  evidenceSummary: string;
  recommendation: string;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeCompetencyScoresForSubjects(
  targetSubjects: Subject[],
  pomodoroLogs: PomodoroLog[],
  preferences: StudyPreferences,
  isSingleSubject: boolean
) {
  const allTopics = targetSubjects.flatMap((s) => s.topics || []);
  const allQuizzes = targetSubjects.flatMap((s) => s.quizzes || []);
  const allFeynman = targetSubjects.flatMap((s) => s.feynmanSessions || []);
  const allFlashcards = targetSubjects.flatMap((s) => s.flashcards || []);
  const allCornell = targetSubjects.flatMap((s) => s.cornellNotes || []);
  const allErrors = targetSubjects.flatMap((s) => s.errorLogs || []);

  // 1. Capacidad de Memoria (Quizzes recall, Flashcards ease/interval, Spaced Repetition retention)
  const quizScores: number[] = [];
  allQuizzes.forEach((q) => {
    if (typeof q.overallScore === 'number') {
      quizScores.push(q.overallScore);
    } else if (Array.isArray(q.questions) && q.questions.length > 0) {
      const scored = q.questions.filter((qq) => typeof qq.score === 'number');
      if (scored.length > 0) {
        const avg = scored.reduce((a, b) => a + (b.score || 0), 0) / scored.length;
        quizScores.push(avg);
      }
    }
  });
  const avgQuizScore =
    quizScores.length > 0
      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
      : null;

  const topicRetentions = allTopics
    .map((t) => t.perceivedRetentionPct)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const avgTopicRetention =
    topicRetentions.length > 0
      ? topicRetentions.reduce((a, b) => a + b, 0) / topicRetentions.length
      : null;

  const reviewedFlashcards = allFlashcards.filter((f) => (f.repetitions || 0) > 0);
  const flashcardMasteryScore =
    allFlashcards.length > 0
      ? Math.min(
          100,
          (reviewedFlashcards.length / allFlashcards.length) * 65 +
            (allFlashcards.reduce((acc, f) => acc + Math.min(3, f.easeFactor || 2.5), 0) /
              (allFlashcards.length * 3)) *
              35
        )
      : null;

  const memoryComponents = [avgQuizScore, avgTopicRetention, flashcardMasteryScore].filter(
    (v): v is number => v !== null
  );
  const memoryScore = clampScore(
    memoryComponents.length > 0
      ? memoryComponents.reduce((a, b) => a + b, 0) / memoryComponents.length
      : 52
  );

  // 2. Resolución de Problemas (Quizzes prácticos/test, precisión Feynman y resolución de errores)
  const problemQuizzes = allQuizzes.filter((q) =>
    ['calculo', 'practico', 'test', 'mixto'].includes(q.examType)
  );
  const problemQuizAvg =
    problemQuizzes.length > 0
      ? problemQuizzes.reduce((acc, q) => acc + (q.overallScore ?? avgQuizScore ?? 65), 0) /
        problemQuizzes.length
      : avgQuizScore;

  const feynmanAccuracyList = allFeynman.map(
    (f) => f.accuracyScore ?? f.overallScore ?? f.clarityScore ?? 70
  );
  const avgFeynmanAccuracy =
    feynmanAccuracyList.length > 0
      ? feynmanAccuracyList.reduce((a, b) => a + b, 0) / feynmanAccuracyList.length
      : null;

  const resolvedErrorsCount = allErrors.filter((e) => e.resolved).length;
  const errorResolutionRate =
    allErrors.length > 0 ? (resolvedErrorsCount / allErrors.length) * 100 : null;

  const problemComponents = [problemQuizAvg, avgFeynmanAccuracy, errorResolutionRate].filter(
    (v): v is number => v !== null
  );
  const problemSolvingScore = clampScore(
    problemComponents.length > 0
      ? problemComponents.reduce((a, b) => a + b, 0) / problemComponents.length
      : 50
  );

  // 3. Capacidad de Síntesis (Feynman simplicity/clarity + resúmenes Cornell + conceptos clave jerárquicos)
  const feynmanSynthesisScores = allFeynman.map((f) => {
    const clarity = f.clarityScore || 70;
    const simplicity = f.simplicityScore ?? clarity;
    return clarity * 0.55 + simplicity * 0.45;
  });
  const avgFeynmanSynthesis =
    feynmanSynthesisScores.length > 0
      ? feynmanSynthesisScores.reduce((a, b) => a + b, 0) / feynmanSynthesisScores.length
      : null;

  const topicsWithSynthesis = allTopics.filter(
    (t) =>
      (t.summary && t.summary.trim().length > 20) ||
      (t.keyPoints && t.keyPoints.length > 0) ||
      (t.cues && t.cues.length > 0)
  );
  const cornellCoveragePct =
    allTopics.length > 0
      ? Math.min(100, ((topicsWithSynthesis.length + allCornell.length * 0.5) / allTopics.length) * 100)
      : null;

  const synthesisComponents = [avgFeynmanSynthesis, cornellCoveragePct].filter(
    (v): v is number => v !== null
  );
  const synthesisScore = clampScore(
    synthesisComponents.length > 0
      ? synthesisComponents.reduce((a, b) => a + b, 0) / synthesisComponents.length
      : 54
  );

  // 4. Velocidad de Lectura (Páginas/hora configuradas + porcentaje de páginas leídas en el temario)
  const pagesPerHour =
    preferences.readingSpeedPagesPerHour ||
    (preferences.averageMinutesPerPage ? 60 / preferences.averageMinutesPerPage : 8);
  // 12 págs/h en estudio técnico denso equivale a ~90-100 puntos de velocidad base
  const speedBaseScore = Math.min(100, Math.round((pagesPerHour / 12) * 85 + 15));

  const totalPages = allTopics.reduce((acc, t) => acc + (t.pageCount || t.paginasTotales || 0), 0);
  const totalPagesRead = allTopics.reduce((acc, t) => acc + (t.pagesRead || 0), 0);
  const readingProgressPct =
    totalPages > 0 ? Math.min(100, Math.round((totalPagesRead / totalPages) * 100)) : null;

  const readingSpeedScore = clampScore(
    readingProgressPct !== null
      ? speedBaseScore * 0.6 + readingProgressPct * 0.4
      : speedBaseScore
  );

  // 5. Claridad Explicativa Feynman (Sesiones Feynman: claridad, analogías y dominio sin lagunas)
  const feynmanMasteryList = allFeynman.map((f) => {
    const base = f.overallScore ?? f.clarityScore ?? 70;
    const gapPenalty = Math.min(20, (f.conceptualGaps?.length || 0) * 4);
    const analogyBonus = Math.min(10, (f.intuitiveAnalogies?.length || 0) * 3);
    return Math.max(20, Math.min(100, base - gapPenalty + analogyBonus));
  });
  const oralQuizzes = allQuizzes.filter((q) =>
    ['oral', 'desarrollo', 'preguntas_cortas'].includes(q.examType)
  );
  const oralQuizAvg =
    oralQuizzes.length > 0
      ? oralQuizzes.reduce((acc, q) => acc + (q.overallScore ?? 70), 0) / oralQuizzes.length
      : null;

  const feynmanComponents = [
    feynmanMasteryList.length > 0
      ? feynmanMasteryList.reduce((a, b) => a + b, 0) / feynmanMasteryList.length
      : null,
    oralQuizAvg,
  ].filter((v): v is number => v !== null);

  const feynmanClarityScore = clampScore(
    feynmanComponents.length > 0
      ? feynmanComponents.reduce((a, b) => a + b, 0) / feynmanComponents.length
      : avgQuizScore !== null
      ? avgQuizScore * 0.85
      : 50
  );

  // 6. Constancia y Consolidación (Repasos espaciados completados + sesiones Pomodoro)
  const studiedOrReviewedTopics = allTopics.filter(
    (t) => t.status === 'estudiado' || t.status === 'repasado' || (t.reviewsHistory?.length || 0) > 0
  );
  const topicCompletionPct =
    allTopics.length > 0 ? (studiedOrReviewedTopics.length / allTopics.length) * 100 : 40;

  const targetSubjectIds = new Set(targetSubjects.map((s) => s.id));
  const relevantLogs = isSingleSubject
    ? pomodoroLogs.filter((l) => targetSubjectIds.has(l.subjectId))
    : pomodoroLogs;
  const totalFocusHours = relevantLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0) / 60;
  const streakFactor = Math.min(100, (preferences.streakDays || 1) * 12 + Math.min(60, totalFocusHours * 4));

  const consistencyScore = clampScore(topicCompletionPct * 0.55 + streakFactor * 0.45);

  return {
    memoryScore,
    problemSolvingScore,
    synthesisScore,
    readingSpeedScore,
    feynmanClarityScore,
    consistencyScore,
    counts: {
      quizzesCount: allQuizzes.length,
      feynmanCount: allFeynman.length,
      flashcardsCount: allFlashcards.length,
      topicsCount: allTopics.length,
      pagesPerHour: Number(pagesPerHour.toFixed(1)),
      totalPagesRead,
      totalPages,
      resolvedErrorsCount,
      totalErrorsCount: allErrors.length,
    },
  };
}

export const CompetencyRadarChart: React.FC<CompetencyRadarChartProps> = ({
  subjects,
  pomodoroLogs,
  preferences,
  onOpenActiveRecall,
  onOpenPreferences,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [showTargetOverlay, setShowTargetOverlay] = useState<boolean>(true);

  const { radarData, overallIndex, counts, strongestAxis, weakestAxis } = useMemo(() => {
    const globalMetrics = computeCompetencyScoresForSubjects(
      subjects,
      pomodoroLogs,
      preferences,
      false
    );

    const filteredSubjects =
      selectedSubjectId === 'ALL'
        ? subjects
        : subjects.filter((s) => s.id === selectedSubjectId);

    const activeMetrics =
      selectedSubjectId === 'ALL'
        ? globalMetrics
        : computeCompetencyScoresForSubjects(
            filteredSubjects,
            pomodoroLogs,
            preferences,
            true
          );

    const points: CompetencyAxisPoint[] = [
      {
        id: 'memoria',
        competency: 'Capacidad de Memoria',
        shortLabel: 'Memoria',
        score: activeMetrics.memoryScore,
        targetScore: 85,
        globalScore: globalMetrics.memoryScore,
        evidenceSummary: `${activeMetrics.counts.flashcardsCount} tarjetas · ${activeMetrics.counts.quizzesCount} cuestionarios`,
        recommendation:
          activeMetrics.memoryScore >= 80
            ? 'Retención espaciada sólida en intervalos largos.'
            : 'Refuerza con sesiones de flashcards y tests rápidos tras cada repaso.',
      },
      {
        id: 'resolucion',
        competency: 'Resolución de Problemas',
        shortLabel: 'Resolución',
        score: activeMetrics.problemSolvingScore,
        targetScore: 85,
        globalScore: globalMetrics.problemSolvingScore,
        evidenceSummary: `${activeMetrics.counts.quizzesCount} tests · ${activeMetrics.counts.resolvedErrorsCount}/${activeMetrics.counts.totalErrorsCount} dudas resueltas`,
        recommendation:
          activeMetrics.problemSolvingScore >= 80
            ? 'Alta precisión aplicando conceptos a casos prácticos.'
            : 'Practica cuestionarios de aplicación y revisa el registro de fallos.',
      },
      {
        id: 'sintesis',
        competency: 'Capacidad de Síntesis',
        shortLabel: 'Síntesis',
        score: activeMetrics.synthesisScore,
        targetScore: 85,
        globalScore: globalMetrics.synthesisScore,
        evidenceSummary: `${activeMetrics.counts.topicsCount} temas · Jerarquía Cornell N1–N3`,
        recommendation:
          activeMetrics.synthesisScore >= 80
            ? 'Excelente abstracción de macro-conceptos e indicios.'
            : 'Completa el resumen ejecutivo y conceptos clave en tus apuntes Cornell.',
      },
      {
        id: 'lectura',
        competency: 'Velocidad de Lectura',
        shortLabel: 'Vel. Lectura',
        score: activeMetrics.readingSpeedScore,
        targetScore: 85,
        globalScore: globalMetrics.readingSpeedScore,
        evidenceSummary: `${activeMetrics.counts.pagesPerHour} págs/h · ${activeMetrics.counts.totalPagesRead}/${activeMetrics.counts.totalPages} págs leídas`,
        recommendation:
          activeMetrics.readingSpeedScore >= 80
            ? 'Ritmo lector ágil y alineado con el plan semanal.'
            : 'Registra el avance de páginas leídas por tema para calibrar tu ritmo.',
      },
      {
        id: 'feynman',
        competency: 'Explicación Feynman',
        shortLabel: 'Técnica Feynman',
        score: activeMetrics.feynmanClarityScore,
        targetScore: 85,
        globalScore: globalMetrics.feynmanClarityScore,
        evidenceSummary: `${activeMetrics.counts.feynmanCount} retos explicativos evaluados`,
        recommendation:
          activeMetrics.feynmanClarityScore >= 80
            ? 'Explicaciones claras, sencillas y libres de jerga.'
            : 'Realiza un reto explicativo Feynman para detectar lagunas conceptuales.',
      },
      {
        id: 'constancia',
        competency: 'Consolidación y Hábito',
        shortLabel: 'Consolidación',
        score: activeMetrics.consistencyScore,
        targetScore: 85,
        globalScore: globalMetrics.consistencyScore,
        evidenceSummary: `Racha ${preferences.streakDays || 0}d · Curva de olvido activa`,
        recommendation:
          activeMetrics.consistencyScore >= 80
            ? 'Disciplina constante en bloques Pomodoro y repasos.'
            : 'Mantén bloques cortos diarios para consolidar la curva de retención.',
      },
    ];

    const avgAll = Math.round(
      points.reduce((acc, p) => acc + p.score, 0) / points.length
    );

    const sorted = [...points].sort((a, b) => b.score - a.score);

    return {
      radarData: points,
      overallIndex: avgAll,
      counts: activeMetrics.counts,
      strongestAxis: sorted[0],
      weakestAxis: sorted[sorted.length - 1],
    };
  }, [subjects, pomodoroLogs, preferences, selectedSubjectId]);

  const getCompetencyStatusLabel = (score: number) => {
    if (score >= 80) {
      return {
        label: 'Dominio Avanzado',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        barColor: '#10b981',
      };
    }
    if (score >= 60) {
      return {
        label: 'En Consolidación',
        textClass: 'text-blue-700 dark:text-blue-400',
        barColor: '#2563eb',
      };
    }
    return {
      label: 'En Desarrollo',
      textClass: 'text-amber-700 dark:text-amber-400',
      barColor: '#d97706',
    };
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Mapa de Dominio Competencial del Estudiante
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>
              Índice Global:{' '}
              <strong className="font-mono-numbers text-slate-900 dark:text-white">
                {overallIndex}/100
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-numbers">
              {counts.quizzesCount} cuestionarios evaluados
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-numbers">
              {counts.feynmanCount} sesiones Feynman
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-numbers">
              {counts.pagesPerHour} págs/h velocidad lectora
            </span>
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              aria-label="Filtrar competencias por asignatura"
            >
              <option value="ALL">Todas las asignaturas</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowTargetOverlay((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showTargetOverlay
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {selectedSubjectId === 'ALL' ? 'Comparar Meta (85%)' : 'Comparar Promedio Global'}
          </button>

          {onOpenActiveRecall && (
            <button
              type="button"
              onClick={onOpenActiveRecall}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Entrenar Competencias</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Split: Recharts RadarChart (Left) + Competency Breakdown Table (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-5">
        {/* Radar Chart Column */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="74%" data={radarData}>
                <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="shortLabel"
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tickCount={6}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload as CompetencyAxisPoint;
                    const status = getCompetencyStatusLabel(item.score);
                    return (
                      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-700 text-xs max-w-xs">
                        <div className="font-bold text-slate-100 pb-1.5 mb-2 border-b border-slate-700 flex items-center justify-between gap-3">
                          <span>{item.competency}</span>
                          <span className="font-mono-numbers text-emerald-400 font-bold">
                            {item.score}/100
                          </span>
                        </div>
                        <div className="space-y-1 text-[11px] text-slate-300">
                          <div className="flex items-center justify-between gap-3 font-mono-numbers">
                            <span className="text-slate-400">Estado:</span>
                            <span className="font-semibold text-white">{status.label}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 font-mono-numbers">
                            <span className="text-slate-400">Meta de referencia:</span>
                            <span className="font-semibold text-indigo-300">
                              {selectedSubjectId === 'ALL' ? `${item.targetScore}/100` : `${item.globalScore}/100`}
                            </span>
                          </div>
                          <p className="pt-1.5 text-slate-300 border-t border-slate-800 leading-snug">
                            {item.recommendation}
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
                />
                {showTargetOverlay && (
                  <Radar
                    name={
                      selectedSubjectId === 'ALL'
                        ? 'Meta Óptima (85 pts)'
                        : 'Promedio Global'
                    }
                    dataKey={selectedSubjectId === 'ALL' ? 'targetScore' : 'globalScore'}
                    stroke="#6366f1"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    fill="#6366f1"
                    fillOpacity={0.1}
                  />
                )}
                <Radar
                  name="Dominio Actual"
                  dataKey="score"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="#2563eb"
                  fillOpacity={0.28}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 1.5, stroke: '#ffffff' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Highlight Summary Footer under Radar */}
          <div className="w-full mt-2 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Mayor fortaleza:{' '}
              <strong className="text-slate-900 dark:text-white">
                {strongestAxis.competency}
              </strong>{' '}
              <span className="font-mono-numbers text-emerald-600 dark:text-emerald-400 font-bold">
                ({strongestAxis.score}%)
              </span>
            </div>
            <div>
              Área prioritaria:{' '}
              <strong className="text-slate-900 dark:text-white">
                {weakestAxis.competency}
              </strong>{' '}
              <span className="font-mono-numbers text-amber-600 dark:text-amber-400 font-bold">
                ({weakestAxis.score}%)
              </span>
            </div>
          </div>
        </div>

        {/* Competency Breakdown List Column */}
        <div className="lg:col-span-6 divide-y divide-slate-100 dark:divide-slate-800 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 lg:pl-6">
          {radarData.map((axis) => {
            const status = getCompetencyStatusLabel(axis.score);
            return (
              <div key={axis.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {axis.competency}
                    </span>
                    <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">
                      ·
                    </span>
                    <span className={`text-[11px] font-semibold ${status.textClass}`}>
                      {status.label}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold font-mono-numbers text-slate-900 dark:text-white shrink-0">
                    {axis.score}
                    <span className="text-[11px] font-normal text-slate-400">/100</span>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${axis.score}%`,
                      backgroundColor: status.barColor,
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono-numbers">{axis.evidenceSummary}</span>
                  {axis.id === 'lectura' && onOpenPreferences ? (
                    <button
                      type="button"
                      onClick={onOpenPreferences}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Calibrar velocidad</span>
                    </button>
                  ) : (
                    <span className="truncate max-w-xs">{axis.recommendation}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
