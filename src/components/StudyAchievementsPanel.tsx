import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Flame,
  BookOpen,
  Brain,
  Sparkles,
  Target,
  CheckCircle2,
  Clock,
  Zap,
  Star,
  Crown,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
  Lock,
  ArrowUpRight,
  FileCheck2,
  X,
} from 'lucide-react';
import { Subject, PomodoroLog, StudyPreferences } from '../types';

export interface StudyAchievementsPanelProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  preferences: StudyPreferences;
  onOpenActiveRecall?: () => void;
  onOpenPomodoro?: () => void;
  onOpenFeynman?: () => void;
  variant?: 'collapsible' | 'nav-top' | 'nav-sidebar' | 'inline';
  defaultExpanded?: boolean;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type AchievementCategory =
  | 'todos'
  | 'destacados'
  | 'racha'
  | 'temas'
  | 'cuestionarios'
  | 'feynman'
  | 'pomodoro';

export interface AchievementItem {
  id: string;
  category: Exclude<AchievementCategory, 'todos' | 'destacados'>;
  isFeatured?: boolean;
  title: string;
  shortLabel: string;
  description: string;
  sourceLabel: string;
  tier: AchievementTier;
  currentValue: number;
  targetValue: number;
  unit: string;
  unlocked: boolean;
  xpReward: number;
  icon: React.ElementType;
  incentiveTip?: string;
}

const TIER_STYLES: Record<
  AchievementTier,
  {
    name: string;
    border: string;
    bgUnlocked: string;
    badgeBg: string;
    badgeText: string;
    iconColor: string;
    glow: string;
  }
> = {
  bronze: {
    name: 'Bronce',
    border: 'border-amber-300 dark:border-amber-700/60',
    bgUnlocked: 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/70',
    badgeText: 'text-amber-800 dark:text-amber-300',
    iconColor: 'text-amber-700 dark:text-amber-400',
    glow: 'shadow-[0_0_15px_rgba(217,119,6,0.12)]',
  },
  silver: {
    name: 'Plata',
    border: 'border-slate-300 dark:border-slate-600',
    bgUnlocked: 'bg-gradient-to-br from-slate-400/10 via-slate-400/5 to-transparent',
    badgeBg: 'bg-slate-200 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    iconColor: 'text-slate-600 dark:text-slate-300',
    glow: 'shadow-[0_0_15px_rgba(148,163,184,0.12)]',
  },
  gold: {
    name: 'Oro',
    border: 'border-yellow-400 dark:border-yellow-600/70',
    bgUnlocked: 'bg-gradient-to-br from-yellow-500/15 via-yellow-500/5 to-transparent',
    badgeBg: 'bg-yellow-100 dark:bg-yellow-950/70',
    badgeText: 'text-yellow-800 dark:text-yellow-300',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    glow: 'shadow-[0_0_20px_rgba(234,179,8,0.18)]',
  },
  diamond: {
    name: 'Diamante',
    border: 'border-cyan-400 dark:border-cyan-500/70',
    bgUnlocked: 'bg-gradient-to-br from-cyan-500/15 via-blue-500/5 to-transparent',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-950/70',
    badgeText: 'text-cyan-800 dark:text-cyan-300',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    glow: 'shadow-[0_0_22px_rgba(6,182,212,0.22)]',
  },
};

/**
 * Calcula tanto la racha activa como la mayor racha histórica a partir de las fechas YYYY-MM-DD de pomodoroLogs
 */
function computeStreakFromPomodoroLogs(logs: PomodoroLog[]): {
  currentLogStreak: number;
  bestLogStreak: number;
  maxSessionsInSingleDay: number;
  uniqueStudyDaysCount: number;
} {
  if (!logs || logs.length === 0) {
    return {
      currentLogStreak: 0,
      bestLogStreak: 0,
      maxSessionsInSingleDay: 0,
      uniqueStudyDaysCount: 0,
    };
  }

  const sessionsByDay = new Map<string, number>();
  for (const log of logs) {
    const dStr = (log.date || (log.timestamp ? log.timestamp.slice(0, 10) : '')).slice(0, 10);
    if (!dStr || dStr.length !== 10) continue;
    sessionsByDay.set(dStr, (sessionsByDay.get(dStr) || 0) + 1);
  }

  const uniqueDates = Array.from(sessionsByDay.keys()).sort();
  if (uniqueDates.length === 0) {
    return {
      currentLogStreak: 0,
      bestLogStreak: 0,
      maxSessionsInSingleDay: 0,
      uniqueStudyDaysCount: 0,
    };
  }

  let maxSessionsInSingleDay = 0;
  sessionsByDay.forEach((count) => {
    if (count > maxSessionsInSingleDay) maxSessionsInSingleDay = count;
  });

  // Mejor racha histórica de días consecutivos en pomodoroLogs
  let bestLogStreak = 1;
  let runningStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevMs = new Date(`${uniqueDates[i - 1]}T12:00:00`).getTime();
    const currMs = new Date(`${uniqueDates[i]}T12:00:00`).getTime();
    const diffDays = Math.round((currMs - prevMs) / 86400000);
    if (diffDays === 1) {
      runningStreak += 1;
      if (runningStreak > bestLogStreak) bestLogStreak = runningStreak;
    } else if (diffDays > 1) {
      runningStreak = 1;
    }
  }

  // Racha activa hasta hoy o ayer
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dateSet = new Set(uniqueDates);

  let currentLogStreak = 0;
  let cursorDateStr = dateSet.has(todayStr)
    ? todayStr
    : dateSet.has(yesterdayStr)
    ? yesterdayStr
    : '';

  while (cursorDateStr && dateSet.has(cursorDateStr)) {
    currentLogStreak += 1;
    const prevDateMs = new Date(`${cursorDateStr}T12:00:00`).getTime() - 86400000;
    cursorDateStr = new Date(prevDateMs).toISOString().slice(0, 10);
  }

  return {
    currentLogStreak,
    bestLogStreak,
    maxSessionsInSingleDay,
    uniqueStudyDaysCount: uniqueDates.length,
  };
}

export const StudyAchievementsPanel: React.FC<StudyAchievementsPanelProps> = ({
  subjects,
  pomodoroLogs,
  preferences,
  onOpenActiveRecall,
  onOpenPomodoro,
  onOpenFeynman,
  variant = 'collapsible',
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(
    variant === 'inline' ? true : defaultExpanded
  );
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>('todos');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Cerrar el desplegable flotante en modo nav-top al hacer clic fuera
  useEffect(() => {
    if (variant !== 'nav-top' || !isExpanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [variant, isExpanded]);

  // Cálculo integral de estadísticas basándose en pomodoroLogs, resultados de cuestionarios, sesiones Feynman y temas
  const stats = useMemo(() => {
    // 1. Racha e historial de PomodoroLogs
    const pomoStreakInfo = computeStreakFromPomodoroLogs(pomodoroLogs);
    const effectiveStreakDays = Math.max(
      preferences?.streakDays || 0,
      pomoStreakInfo.currentLogStreak,
      pomoStreakInfo.bestLogStreak
    );
    const totalPomodoroSessions = pomodoroLogs.length;
    const totalFocusMinutes = pomodoroLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
    const totalFocusHours = Math.round((totalFocusMinutes / 60) * 10) / 10;

    // 2. Temas estudiados (Temario + Vueltas + Sesiones Pomodoro asociadas a temas)
    let uniqueTopicsCompleted = 0;
    let totalTopicVueltas = 0;
    let totalSpacedReviews = 0;
    let totalPagesRead = 0;

    subjects.forEach((sub) => {
      (sub.topics || []).forEach((t) => {
        totalPagesRead += t.pagesRead || 0;
        const isDone = t.status === 'estudiado' || t.status === 'repasado';
        if (isDone) {
          uniqueTopicsCompleted += 1;
          totalTopicVueltas += Math.max(1, t.vueltasCount || 1);
        } else if ((t.vueltasCount || 0) > 0) {
          totalTopicVueltas += t.vueltasCount || 0;
        }
        if (Array.isArray(t.reviewsHistory)) {
          totalSpacedReviews += t.reviewsHistory.length;
        }
      });
    });

    const pomodoroTopicSessions = pomodoroLogs.filter(
      (l) => Boolean(l.topicId || l.topicTitle)
    ).length;

    // Total acumulado de temas estudiados/repasados (combinando temas completados, vueltas, repasos y bloques Pomodoro por tema)
    const totalTopicsStudiedCount = Math.max(
      uniqueTopicsCompleted,
      totalTopicVueltas + totalSpacedReviews,
      uniqueTopicsCompleted + pomodoroTopicSessions
    );

    // 3. Resultados de Cuestionarios (subject.quizzes)
    const allQuizzes = subjects.flatMap((s) => s.quizzes || []);
    const quizScores: number[] = allQuizzes.map((q) => {
      if (typeof q.overallScore === 'number') {
        return Math.round(q.overallScore);
      }
      const questions = q.questions || [];
      if (questions.length === 0) return 0;
      const scoredQuestions = questions.filter((qq) => typeof qq.score === 'number');
      if (scoredQuestions.length > 0) {
        const sum = scoredQuestions.reduce((acc, qq) => acc + (qq.score || 0), 0);
        return Math.round(sum / scoredQuestions.length);
      }
      const correctCount = questions.filter(
        (qq) =>
          qq.userAnswer !== undefined &&
          qq.correctOptionIndex !== undefined &&
          Number(qq.userAnswer) === qq.correctOptionIndex
      ).length;
      return Math.round((correctCount / questions.length) * 100);
    });

    const totalQuizzesTaken = allQuizzes.length;
    const bestQuizScore = quizScores.length > 0 ? Math.max(...quizScores) : 0;
    const avgQuizScore =
      quizScores.length > 0
        ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
        : 0;
    const perfectQuizzesCount = quizScores.filter((s) => s >= 90).length;
    const passedQuizzesCount = quizScores.filter((s) => s >= 50).length;
    const totalQuizQuestionsResolved = allQuizzes.reduce(
      (acc, q) => acc + (q.questions?.length || 0),
      0
    );

    // 4. Sesiones Feynman (subject.feynmanSessions)
    const allFeynmanSessions = subjects.flatMap((s) => s.feynmanSessions || []);
    const feynmanScores = allFeynmanSessions.map((fs) => {
      const base =
        fs.overallScore ??
        fs.clarityScore ??
        fs.accuracyScore ??
        fs.simplicityScore ??
        0;
      const hasZeroGapsBonus =
        Array.isArray(fs.conceptualGaps) && fs.conceptualGaps.length === 0 && base >= 85
          ? Math.max(base, 92)
          : base;
      return Math.min(100, Math.round(hasZeroGapsBonus));
    });

    const totalFeynmanSessions = allFeynmanSessions.length;
    const bestFeynmanScore = feynmanScores.length > 0 ? Math.max(...feynmanScores) : 0;
    const perfectFeynmanCount = feynmanScores.filter((s) => s >= 90).length;
    const hasPerfectFeynman = perfectFeynmanCount > 0;

    return {
      effectiveStreakDays,
      currentLogStreak: pomoStreakInfo.currentLogStreak,
      bestLogStreak: pomoStreakInfo.bestLogStreak,
      maxSessionsInSingleDay: pomoStreakInfo.maxSessionsInSingleDay,
      uniqueStudyDaysCount: pomoStreakInfo.uniqueStudyDaysCount,
      totalPomodoroSessions,
      totalFocusHours,
      uniqueTopicsCompleted,
      totalTopicsStudiedCount,
      totalPagesRead,
      totalQuizzesTaken,
      bestQuizScore,
      avgQuizScore,
      perfectQuizzesCount,
      passedQuizzesCount,
      totalQuizQuestionsResolved,
      totalFeynmanSessions,
      bestFeynmanScore,
      perfectFeynmanCount,
      hasPerfectFeynman,
    };
  }, [subjects, pomodoroLogs, preferences]);

  // Catálogo de Insignias (Badges) con los 3 hitos protagonistas y los basados en pomodoroLogs y cuestionarios
  const achievements: AchievementItem[] = useMemo(() => {
    return [
      // =======================================================================
      // 1. HITOS DE RACHA (pomodoroLogs + streakDays)
      // =======================================================================
      {
        id: 'badge-streak-7',
        category: 'racha',
        isFeatured: true,
        title: 'Racha de 7 Días',
        shortLabel: 'Racha 7 días',
        description:
          'Estudia durante 7 días consecutivos registrando sesiones en tu historial de Pomodoro o actividad diaria.',
        sourceLabel: 'Historial PomodoroLogs + Racha Diaria',
        tier: 'gold',
        currentValue: stats.effectiveStreakDays,
        targetValue: 7,
        unit: 'días',
        unlocked: stats.effectiveStreakDays >= 7,
        xpReward: 500,
        icon: Flame,
        incentiveTip:
          'Completar al menos 1 Pomodoro cada día mantiene e incrementa tu racha automáticamente.',
      },
      {
        id: 'badge-streak-3',
        category: 'racha',
        title: 'Arranque Constante (3 Días)',
        shortLabel: 'Racha 3 días',
        description:
          'Alcanza una racha de 3 días seguidos con sesiones de enfoque registradas.',
        sourceLabel: 'Historial PomodoroLogs',
        tier: 'bronze',
        currentValue: stats.effectiveStreakDays,
        targetValue: 3,
        unit: 'días',
        unlocked: stats.effectiveStreakDays >= 3,
        xpReward: 150,
        icon: Flame,
      },
      {
        id: 'badge-streak-14',
        category: 'racha',
        title: 'Disciplina de Acero (14 Días)',
        shortLabel: 'Racha 14 días',
        description:
          'Encadena 2 semanas completas (14 días seguidos) de estudio constante sin interrupciones.',
        sourceLabel: 'Historial PomodoroLogs + Racha Diaria',
        tier: 'diamond',
        currentValue: stats.effectiveStreakDays,
        targetValue: 14,
        unit: 'días',
        unlocked: stats.effectiveStreakDays >= 14,
        xpReward: 1000,
        icon: Crown,
      },

      // =======================================================================
      // 2. HITOS DE TEMAS ESTUDIADOS ('100 temas estudiados')
      // =======================================================================
      {
        id: 'badge-topics-100',
        category: 'temas',
        isFeatured: true,
        title: '100 Temas Estudiados',
        shortLabel: '100 temas estudiados',
        description:
          'Alcanza el gran hito de 100 temas estudiados/repasados sumando tu avance del temario, vueltas y bloques Pomodoro.',
        sourceLabel: 'Temario + Vueltas + PomodoroLogs',
        tier: 'diamond',
        currentValue: stats.totalTopicsStudiedCount,
        targetValue: 100,
        unit: 'temas',
        unlocked: stats.totalTopicsStudiedCount >= 100,
        xpReward: 1500,
        icon: Trophy,
        incentiveTip:
          'Cada tema marcado como estudiado, vuelta completada o sesión Pomodoro enfocada en un tema suma a este hito.',
      },
      {
        id: 'badge-topics-10',
        category: 'temas',
        title: ' Conquistador Inicial (10 Temas)',
        shortLabel: '10 temas estudiados',
        description:
          'Completa el estudio o repaso de tus primeros 10 temas académicos.',
        sourceLabel: 'Temario + PomodoroLogs',
        tier: 'bronze',
        currentValue: stats.totalTopicsStudiedCount,
        targetValue: 10,
        unit: 'temas',
        unlocked: stats.totalTopicsStudiedCount >= 10,
        xpReward: 200,
        icon: BookOpen,
      },
      {
        id: 'badge-topics-25',
        category: 'temas',
        title: 'Ritmo de Crucero (25 Temas)',
        shortLabel: '25 temas estudiados',
        description:
          'Acumula 25 temas estudiados o repasados a lo largo de tus asignaturas.',
        sourceLabel: 'Temario + PomodoroLogs',
        tier: 'silver',
        currentValue: stats.totalTopicsStudiedCount,
        targetValue: 25,
        unit: 'temas',
        unlocked: stats.totalTopicsStudiedCount >= 25,
        xpReward: 400,
        icon: Layers,
      },
      {
        id: 'badge-topics-50',
        category: 'temas',
        title: 'Medio Centenar (50 Temas)',
        shortLabel: '50 temas estudiados',
        description:
          'Supera la barrera de los 50 temas trabajados con sesiones de enfoque y repaso.',
        sourceLabel: 'Temario + PomodoroLogs',
        tier: 'gold',
        currentValue: stats.totalTopicsStudiedCount,
        targetValue: 50,
        unit: 'temas',
        unlocked: stats.totalTopicsStudiedCount >= 50,
        xpReward: 750,
        icon: Award,
      },

      // =======================================================================
      // 3. HITOS DE TÉCNICA FEYNMAN ('Sesión Feynman perfecta')
      // =======================================================================
      {
        id: 'badge-feynman-perfect',
        category: 'feynman',
        isFeatured: true,
        title: 'Sesión Feynman Perfecta',
        shortLabel: 'Sesión Feynman perfecta',
        description:
          'Obtén una puntuación excelente (≥90% de claridad/precisión o 0 lagunas conceptuales) al explicar un tema con la Técnica Feynman.',
        sourceLabel: 'Evaluador IA Técnica Feynman',
        tier: 'diamond',
        currentValue: stats.bestFeynmanScore,
        targetValue: 90,
        unit: '% claridad',
        unlocked: stats.hasPerfectFeynman || stats.bestFeynmanScore >= 90,
        xpReward: 1000,
        icon: Brain,
        incentiveTip:
          'Explica un concepto con analogías sencillas y sin jerga innecesaria para superar el 90% de claridad.',
      },
      {
        id: 'badge-feynman-first',
        category: 'feynman',
        title: 'Aprendiz de Feynman',
        shortLabel: '1ª Sesión Feynman',
        description:
          'Completa tu primera sesión guiada de explicación con el método Feynman.',
        sourceLabel: 'Historial Sesiones Feynman',
        tier: 'bronze',
        currentValue: stats.totalFeynmanSessions,
        targetValue: 1,
        unit: 'sesión',
        unlocked: stats.totalFeynmanSessions >= 1,
        xpReward: 150,
        icon: Sparkles,
      },
      {
        id: 'badge-feynman-5',
        category: 'feynman',
        title: 'Divulgador Maestro (5 Feynman)',
        shortLabel: '5 Sesiones Feynman',
        description:
          'Realiza 5 sesiones de la Técnica Feynman para consolidar conceptos complejos.',
        sourceLabel: 'Historial Sesiones Feynman',
        tier: 'gold',
        currentValue: stats.totalFeynmanSessions,
        targetValue: 5,
        unit: 'sesiones',
        unlocked: stats.totalFeynmanSessions >= 5,
        xpReward: 600,
        icon: ShieldCheck,
      },

      // =======================================================================
      // 4. HITOS DE RESULTADOS DE CUESTIONARIOS (subject.quizzes)
      // =======================================================================
      {
        id: 'badge-quiz-perfect',
        category: 'cuestionarios',
        isFeatured: true,
        title: 'Cuestionario Sobresaliente (≥90%)',
        shortLabel: 'Test ≥90%',
        description:
          'Consigue al menos un 90% de acierto en los resultados de un cuestionario o simulacro de examen.',
        sourceLabel: 'Resultados de Cuestionarios',
        tier: 'gold',
        currentValue: stats.bestQuizScore,
        targetValue: 90,
        unit: '% nota',
        unlocked: stats.bestQuizScore >= 90,
        xpReward: 500,
        icon: FileCheck2,
        incentiveTip:
          'Completa simulacros en la pestaña Cuestionarios para medir tu precisión real antes del examen.',
      },
      {
        id: 'badge-quiz-first',
        category: 'cuestionarios',
        title: 'Primer Simulacro Superado',
        shortLabel: '1er Cuestionario',
        description:
          'Aprueba tu primer cuestionario de autoevaluación (nota ≥50%).',
        sourceLabel: 'Resultados de Cuestionarios',
        tier: 'bronze',
        currentValue: stats.passedQuizzesCount,
        targetValue: 1,
        unit: 'aprobado',
        unlocked: stats.passedQuizzesCount >= 1,
        xpReward: 150,
        icon: CheckCircle2,
      },
      {
        id: 'badge-quiz-10',
        category: 'cuestionarios',
        title: 'Veterano de Simulacros (10 Tests)',
        shortLabel: '10 Cuestionarios',
        description:
          'Completa 10 cuestionarios y registra sus resultados en tus asignaturas.',
        sourceLabel: 'Resultados de Cuestionarios',
        tier: 'silver',
        currentValue: stats.totalQuizzesTaken,
        targetValue: 10,
        unit: 'tests',
        unlocked: stats.totalQuizzesTaken >= 10,
        xpReward: 400,
        icon: Target,
      },
      {
        id: 'badge-quiz-mastery',
        category: 'cuestionarios',
        title: 'Precisión de Examen (Media ≥85%)',
        shortLabel: 'Media ≥85% en Tests',
        description:
          'Mantén una nota media igual o superior al 85% habiendo completado al menos 3 cuestionarios.',
        sourceLabel: 'Resultados de Cuestionarios',
        tier: 'diamond',
        currentValue: stats.totalQuizzesTaken >= 3 ? stats.avgQuizScore : Math.min(84, stats.avgQuizScore),
        targetValue: 85,
        unit: '% media',
        unlocked: stats.totalQuizzesTaken >= 3 && stats.avgQuizScore >= 85,
        xpReward: 900,
        icon: Star,
      },

      // =======================================================================
      // 5. HITOS DE ENFOQUE E HISTORIAL POMODORO (pomodoroLogs)
      // =======================================================================
      {
        id: 'badge-pomodoro-10',
        category: 'pomodoro',
        title: 'Enfoque Profundo (10 Pomodoros)',
        shortLabel: '10 Pomodoros',
        description:
          'Completa 10 sesiones de estudio concentrado en tu historial de pomodoroLogs.',
        sourceLabel: 'Historial PomodoroLogs',
        tier: 'silver',
        currentValue: stats.totalPomodoroSessions,
        targetValue: 10,
        unit: 'sesiones',
        unlocked: stats.totalPomodoroSessions >= 10,
        xpReward: 300,
        icon: Clock,
      },
      {
        id: 'badge-pomodoro-marathon',
        category: 'pomodoro',
        title: 'Jornada Intensiva (4 Pomodoros/día)',
        shortLabel: '4 Pomodoros en 1 día',
        description:
          'Registra 4 o más sesiones Pomodoro completadas dentro de un mismo día.',
        sourceLabel: 'Historial PomodoroLogs',
        tier: 'gold',
        currentValue: stats.maxSessionsInSingleDay,
        targetValue: 4,
        unit: 'en 1 día',
        unlocked: stats.maxSessionsInSingleDay >= 4,
        xpReward: 550,
        icon: Zap,
      },
      {
        id: 'badge-pomodoro-25h',
        category: 'pomodoro',
        title: 'Señor del Tiempo (25 Horas)',
        shortLabel: '25h Pomodoro',
        description:
          'Acumula 25 horas totales de concentración registradas en pomodoroLogs.',
        sourceLabel: 'Historial PomodoroLogs',
        tier: 'diamond',
        currentValue: stats.totalFocusHours,
        targetValue: 25,
        unit: 'horas',
        unlocked: stats.totalFocusHours >= 25,
        xpReward: 1100,
        icon: Medal,
      },
    ];
  }, [stats]);

  const totalUnlocked = useMemo(
    () => achievements.filter((a) => a.unlocked).length,
    [achievements]
  );
  const totalCount = achievements.length;
  const totalXP = useMemo(
    () => achievements.filter((a) => a.unlocked).reduce((acc, a) => acc + a.xpReward, 0),
    [achievements]
  );
  const userLevel = Math.max(1, Math.floor(totalXP / 500) + 1);

  const featuredMilestones = useMemo(
    () =>
      achievements.filter((a) =>
        ['badge-streak-7', 'badge-topics-100', 'badge-feynman-perfect', 'badge-quiz-perfect'].includes(
          a.id
        )
      ),
    [achievements]
  );

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'todos') return achievements;
    if (selectedCategory === 'destacados') {
      return achievements.filter((a) => a.isFeatured);
    }
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  // Contenido interno reutilizable del desplegable de logros
  const renderAchievementsBody = (isCompactDropdown = false) => (
    <div className="space-y-4">
      {/* Resumen de métricas calculadas en tiempo real desde pomodoroLogs, cuestionarios y Feynman */}
      <div
        className={`grid ${
          isCompactDropdown ? 'grid-cols-2 gap-2' : 'grid-cols-2 lg:grid-cols-4 gap-3'
        }`}
      >
        <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
              Racha Pomodoro
            </div>
            <div className="text-sm font-black font-mono-numbers text-slate-900 dark:text-white">
              {stats.effectiveStreakDays} / 7 días
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {stats.totalPomodoroSessions} sesiones ({stats.totalFocusHours}h)
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 truncate">
              Temas Estudiados
            </div>
            <div className="text-sm font-black font-mono-numbers text-slate-900 dark:text-white">
              {stats.totalTopicsStudiedCount} / 100
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {stats.uniqueTopicsCompleted} únicos · {stats.totalPagesRead} págs
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
            <Brain className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 truncate">
              Sesión Feynman
            </div>
            <div className="text-sm font-black font-mono-numbers text-slate-900 dark:text-white">
              {stats.hasPerfectFeynman ? '¡Perfecta!' : `${stats.bestFeynmanScore}% / 90%`}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {stats.totalFeynmanSessions} sesiones evaluadas
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate">
              Cuestionarios
            </div>
            <div className="text-sm font-black font-mono-numbers text-slate-900 dark:text-white">
              {stats.totalQuizzesTaken} tests · {stats.avgQuizScore}%
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              Mejor nota: {stats.bestQuizScore}% ({stats.perfectQuizzesCount} ≥90%)
            </div>
          </div>
        </div>
      </div>

      {/* Filtros por categoría */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSelectedCategory('todos')}
          className={`px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'todos'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Todos ({achievements.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('destacados')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'destacados'
              ? 'bg-amber-500 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Hitos Clave</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('racha')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'racha'
              ? 'bg-orange-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Racha</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('temas')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'temas'
              ? 'bg-blue-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>100 Temas</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('feynman')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'feynman'
              ? 'bg-purple-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Feynman</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('cuestionarios')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'cuestionarios'
              ? 'bg-emerald-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Cuestionarios</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('pomodoro')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'pomodoro'
              ? 'bg-indigo-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pomodoro</span>
        </button>
      </div>

      {/* Lista / Rejilla de Insignias */}
      <div
        className={
          isCompactDropdown
            ? 'grid grid-cols-1 gap-2.5 max-h-80 overflow-y-auto pr-1'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5'
        }
      >
        {filteredAchievements.map((item) => {
          const tier = TIER_STYLES[item.tier];
          const IconComponent = item.icon;
          const progressPct = Math.min(
            100,
            Math.max(0, Math.round((item.currentValue / item.targetValue) * 100))
          );

          return (
            <div
              key={item.id}
              className={`relative rounded-2xl p-3.5 border transition-all duration-200 flex flex-col justify-between ${
                item.unlocked
                  ? `${tier.border} ${tier.bgUnlocked} ${tier.glow} bg-white dark:bg-slate-900`
                  : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 opacity-85 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                        item.unlocked
                          ? `${tier.badgeBg} ${tier.iconColor} shadow-2xs scale-105`
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.unlocked ? (
                        <IconComponent className="w-4.5 h-4.5" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tier.badgeBg} ${tier.badgeText}`}
                        >
                          {tier.name}
                        </span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono-numbers font-bold">
                          +{item.xpReward} XP
                        </span>
                        {item.isFeatured && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30">
                            Hito Clave
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                        {item.sourceLabel}
                      </span>
                    </div>
                  </div>

                  {item.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Desbloqueado</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold font-mono-numbers text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">
                      {progressPct}%
                    </span>
                  )}
                </div>

                <h5
                  className={`text-xs sm:text-sm font-bold tracking-tight ${
                    item.unlocked
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.title}
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {item.description}
                </p>

                {item.incentiveTip && !isCompactDropdown && (
                  <div className="mt-2 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 p-1.5 rounded-lg border border-blue-100 dark:border-blue-900/60 flex items-start gap-1">
                    <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-blue-500" />
                    <span>{item.incentiveTip}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Progreso:</span>
                  <span className="font-mono-numbers font-bold text-slate-700 dark:text-slate-300">
                    {item.currentValue} / {item.targetValue} {item.unit}
                  </span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.unlocked
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Acciones rápidas para avanzar en los hitos */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>
            Cálculo sincronizado automáticamente con tu historial de <strong>pomodoroLogs</strong>,{' '}
            <strong>cuestionarios</strong> y <strong>sesiones Feynman</strong>.
          </span>
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenPomodoro && (
            <button
              type="button"
              onClick={() => {
                onOpenPomodoro();
                if (variant === 'nav-top') setIsExpanded(false);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Clock className="w-3 h-3" />
              <span>Sumar Pomodoro</span>
            </button>
          )}
          {onOpenActiveRecall && (
            <button
              type="button"
              onClick={() => {
                onOpenActiveRecall();
                if (variant === 'nav-top') setIsExpanded(false);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
            >
              <FileCheck2 className="w-3 h-3" />
              <span>Hacer Cuestionario</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
          {onOpenFeynman && (
            <button
              type="button"
              onClick={() => {
                onOpenFeynman();
                if (variant === 'nav-top') setIsExpanded(false);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Brain className="w-3 h-3" />
              <span>Sesión Feynman</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // VARIANTE 1: Desplegable flotante en la barra de navegación superior
  // =========================================================================
  if (variant === 'nav-top') {
    return (
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${
            isExpanded
              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
              : totalUnlocked > 0
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800 hover:bg-amber-100/80'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
          }`}
          title="Desplegar Logros e Insignias (Racha 7 días, 100 temas estudiados, Sesión Feynman perfecta)"
        >
          <Trophy
            className={`w-3.5 h-3.5 shrink-0 ${
              isExpanded ? 'text-white' : 'text-amber-500'
            }`}
          />
          <span className="hidden md:inline text-[11px]">Logros</span>
          <span
            className={`text-[10px] font-mono-numbers px-1.5 py-0.2 rounded-full font-extrabold ${
              isExpanded
                ? 'bg-white/20 text-white'
                : 'bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200'
            }`}
          >
            {totalUnlocked}/{totalCount}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 opacity-80" />
          ) : (
            <ChevronDown className="w-3 h-3 opacity-60" />
          )}
        </button>

        {isExpanded && (
          <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto mt-2 sm:w-[540px] md:w-[640px] max-w-[96vw] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in duration-150">
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1.5 bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                  <Trophy className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    Logros e Insignias de Estudio
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Nivel {userLevel} · {totalXP.toLocaleString()} XP · {totalUnlocked} de {totalCount} conseguidos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Cerrar desplegable de logros"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderAchievementsBody(true)}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VARIANTE 2: Desplegable compacto en el menú lateral (Sidebar)
  // =========================================================================
  if (variant === 'nav-sidebar') {
    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">Logros (Badges)</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
              {totalUnlocked}/{totalCount} · {totalXP} XP
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </span>
        </button>

        {isExpanded && (
          <div className="p-3 border-t border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900">
            {renderAchievementsBody(true)}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VARIANTE 3 (Por defecto): Barra Desplegable Principal (Collapsible Accordion)
  // =========================================================================
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden transition-all">
      {/* Cabecera del Desplegable (Siempre visible, clicable para abrir/cerrar) */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-amber-50/60 via-white to-slate-50/70 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-800/40 hover:bg-amber-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer select-none"
      >
        {/* Izquierda: Título del desplegable + contador de medallas + XP */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center shadow-2xs shrink-0">
            <Trophy className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                Logros e Insignias (Badges)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-numbers font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                {totalUnlocked}/{totalCount} desbloqueados
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-numbers font-bold bg-slate-900 text-amber-300 dark:bg-slate-800 dark:text-amber-300 inline-flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>
                  Nivel {userLevel} · {totalXP.toLocaleString()} XP
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Derecha: Píldoras de vista rápida de los hitos clave ('Racha 7 días', '100 temas estudiados', 'Sesión Feynman perfecta', 'Cuestionarios') + Botón Desplegar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden xl:flex items-center gap-1.5">
            {featuredMilestones.map((m) => {
              const IconComp = m.icon;
              const pct = Math.min(100, Math.round((m.currentValue / m.targetValue) * 100));
              return (
                <span
                  key={m.id}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    m.unlocked
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                  title={`${m.title}: ${m.currentValue}/${m.targetValue} ${m.unit} (${pct}%)`}
                >
                  <IconComp
                    className={`w-3 h-3 shrink-0 ${
                      m.unlocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                    }`}
                  />
                  <span className="truncate max-w-[130px]">{m.shortLabel}</span>
                  <span className="font-mono-numbers text-[10px] font-extrabold opacity-80">
                    {m.unlocked ? '✓' : `${m.currentValue}/${m.targetValue}`}
                  </span>
                </span>
              );
            })}
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
              isExpanded
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <span>{isExpanded ? 'Ocultar logros' : 'Desplegar logros'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>
        </div>
      </div>

      {/* Cuerpo Desplegable */}
      {isExpanded && (
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-150">
          {renderAchievementsBody(false)}
        </div>
      )}
    </div>
  );
};

export default StudyAchievementsPanel;
