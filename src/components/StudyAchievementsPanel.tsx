import React, { useState, useMemo } from 'react';
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
  Bookmark,
  ChevronRight,
  Lock,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react';
import { Subject, PomodoroLog, StudyPreferences } from '../types';

interface StudyAchievementsPanelProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  preferences: StudyPreferences;
  onOpenActiveRecall?: () => void;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type AchievementCategory = 'todos' | 'racha' | 'lectura' | 'active_recall' | 'enfoque' | 'maestria';

export interface AchievementItem {
  id: string;
  category: 'racha' | 'lectura' | 'active_recall' | 'enfoque' | 'maestria';
  title: string;
  description: string;
  tier: AchievementTier;
  currentValue: number;
  targetValue: number;
  unit: string;
  unlocked: boolean;
  xpReward: number;
  icon: React.ElementType;
  activeRecallIncentive?: string;
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
    glow: 'shadow-[0_0_15px_rgba(217,119,6,0.15)]',
  },
  silver: {
    name: 'Plata',
    border: 'border-slate-300 dark:border-slate-600',
    bgUnlocked: 'bg-gradient-to-br from-slate-400/10 via-slate-400/5 to-transparent',
    badgeBg: 'bg-slate-200 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    iconColor: 'text-slate-600 dark:text-slate-300',
    glow: 'shadow-[0_0_15px_rgba(148,163,184,0.15)]',
  },
  gold: {
    name: 'Oro',
    border: 'border-yellow-400 dark:border-yellow-600/70',
    bgUnlocked: 'bg-gradient-to-br from-yellow-500/15 via-yellow-500/5 to-transparent',
    badgeBg: 'bg-yellow-100 dark:bg-yellow-950/70',
    badgeText: 'text-yellow-800 dark:text-yellow-300',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]',
  },
  diamond: {
    name: 'Diamante',
    border: 'border-cyan-400 dark:border-cyan-500/70',
    bgUnlocked: 'bg-gradient-to-br from-cyan-500/15 via-blue-500/5 to-transparent',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-950/70',
    badgeText: 'text-cyan-800 dark:text-cyan-300',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    glow: 'shadow-[0_0_22px_rgba(6,182,212,0.25)]',
  },
};

export const StudyAchievementsPanel: React.FC<StudyAchievementsPanelProps> = ({
  subjects,
  pomodoroLogs,
  preferences,
  onOpenActiveRecall,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>('todos');

  // Cálculo de estadísticas globales para los logros
  const stats = useMemo(() => {
    // 1. Racha de días consecutivos
    const streakDays = preferences.streakDays || 0;

    // 2. Páginas estudiadas y totales
    let totalPagesRead = 0;
    let totalTopicsCompleted = 0;
    let totalCornellNotes = 0;
    let totalSpacedReviews = 0;

    subjects.forEach((sub) => {
      totalCornellNotes += sub.cornellNotes ? sub.cornellNotes.length : 0;
      sub.topics.forEach((t) => {
        totalPagesRead += t.pagesRead || 0;
        if (t.status === 'estudiado' || t.status === 'repasado') {
          totalTopicsCompleted += 1;
        }
        if (t.reviewsHistory) {
          totalSpacedReviews += t.reviewsHistory.length;
        }
      });
    });

    // 3. Active Recall metrics
    const allFlashcards = subjects.flatMap((s) => s.flashcards || []);
    const reviewedFlashcards = allFlashcards.filter((f) => f.repetitions > 0);
    const totalRecallRepetitions = allFlashcards.reduce((acc, f) => acc + (f.repetitions || 0), 0);
    const successfulCards = reviewedFlashcards.filter(
      (f) => f.lastScore === 'facil' || f.lastScore === 'bien'
    ).length;
    const retentionRate =
      reviewedFlashcards.length > 0
        ? Math.round((successfulCards / reviewedFlashcards.length) * 100)
        : 85;

    // 4. Pomodoro Focus metrics
    const totalPomodoroSessions = pomodoroLogs.length;
    const totalFocusMinutes = pomodoroLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
    const totalFocusHours = Math.round((totalFocusMinutes / 60) * 10) / 10;

    return {
      streakDays,
      totalPagesRead,
      totalTopicsCompleted,
      totalCornellNotes,
      totalSpacedReviews,
      totalRecallRepetitions,
      reviewedFlashcardsCount: reviewedFlashcards.length,
      retentionRate,
      totalPomodoroSessions,
      totalFocusHours,
    };
  }, [subjects, pomodoroLogs, preferences]);

  // Lista de logros configurados con cálculo automático de progreso y desbloqueo
  const achievements: AchievementItem[] = useMemo(() => {
    return [
      // CATEGORÍA: RACHA Y CONSTANCIA
      {
        id: 'ach-streak-3',
        category: 'racha',
        title: 'Hábito en Marcha',
        description: 'Alcanza una racha de 3 días seguidos estudiando.',
        tier: 'bronze',
        currentValue: stats.streakDays,
        targetValue: 3,
        unit: 'días',
        unlocked: stats.streakDays >= 3,
        xpReward: 100,
        icon: Flame,
      },
      {
        id: 'ach-streak-5',
        category: 'racha',
        title: 'Estudiante de 5 Días Seguidos',
        description: 'Mantén el ritmo estudiando 5 días consecutivos sin fallar.',
        tier: 'silver',
        currentValue: stats.streakDays,
        targetValue: 5,
        unit: 'días',
        unlocked: stats.streakDays >= 5,
        xpReward: 250,
        icon: Flame,
      },
      {
        id: 'ach-streak-7',
        category: 'racha',
        title: 'Semana Imparable',
        description: 'Completa una semana entera (7 días seguidos) de constancia académica.',
        tier: 'gold',
        currentValue: stats.streakDays,
        targetValue: 7,
        unit: 'días',
        unlocked: stats.streakDays >= 7,
        xpReward: 500,
        icon: Award,
      },
      {
        id: 'ach-streak-14',
        category: 'racha',
        title: 'Leyenda de la Disciplina',
        description: 'Supera 14 días consecutivos de dedicación y estudio planificado.',
        tier: 'diamond',
        currentValue: stats.streakDays,
        targetValue: 14,
        unit: 'días',
        unlocked: stats.streakDays >= 14,
        xpReward: 1000,
        icon: Crown,
      },

      // CATEGORÍA: LECTURA DE TEMARIOS Y PÁGINAS
      {
        id: 'ach-pages-25',
        category: 'lectura',
        title: 'Primeros Capítulos',
        description: 'Lee y asimila 25 páginas de los temarios de tus asignaturas.',
        tier: 'bronze',
        currentValue: stats.totalPagesRead,
        targetValue: 25,
        unit: 'págs',
        unlocked: stats.totalPagesRead >= 25,
        xpReward: 100,
        icon: BookOpen,
      },
      {
        id: 'ach-pages-50',
        category: 'lectura',
        title: 'Lector Constante',
        description: 'Alcanza 50 páginas completadas en el progreso de tus temas.',
        tier: 'silver',
        currentValue: stats.totalPagesRead,
        targetValue: 50,
        unit: 'págs',
        unlocked: stats.totalPagesRead >= 50,
        xpReward: 250,
        icon: Layers,
      },
      {
        id: 'ach-pages-100',
        category: 'lectura',
        title: '100 Páginas Estudiadas',
        description: 'Supera el hito de 100 páginas de contenido académico asimiladas.',
        tier: 'gold',
        currentValue: stats.totalPagesRead,
        targetValue: 100,
        unit: 'págs',
        unlocked: stats.totalPagesRead >= 100,
        xpReward: 600,
        icon: Trophy,
      },
      {
        id: 'ach-pages-250',
        category: 'lectura',
        title: 'Enciclopedia Humana',
        description: 'Alcanza 250 páginas estudiadas en todas tus materias activas.',
        tier: 'diamond',
        currentValue: stats.totalPagesRead,
        targetValue: 250,
        unit: 'págs',
        unlocked: stats.totalPagesRead >= 250,
        xpReward: 1200,
        icon: Star,
      },

      // CATEGORÍA: ACTIVE RECALL DIARIO
      {
        id: 'ach-recall-first',
        category: 'active_recall',
        title: 'Chispa del Active Recall',
        description: 'Realiza tu primera sesión de recuerdo activo con flashcards.',
        tier: 'bronze',
        currentValue: stats.reviewedFlashcardsCount > 0 ? 1 : 0,
        targetValue: 1,
        unit: 'repaso',
        unlocked: stats.reviewedFlashcardsCount >= 1,
        xpReward: 100,
        icon: Zap,
        activeRecallIncentive: 'Evita la curva del olvido repasando tus conceptos clave diariamente.',
      },
      {
        id: 'ach-recall-25',
        category: 'active_recall',
        title: 'Memoria Férrea (25 Repasos)',
        description: 'Acumula 25 repeticiones de Active Recall en el banco de flashcards.',
        tier: 'silver',
        currentValue: stats.totalRecallRepetitions,
        targetValue: 25,
        unit: 'repasos',
        unlocked: stats.totalRecallRepetitions >= 25,
        xpReward: 350,
        icon: Brain,
        activeRecallIncentive: 'Recuperar información activa fortalece las vías sinápticas neuronales.',
      },
      {
        id: 'ach-recall-50',
        category: 'active_recall',
        title: 'Cerebro Blindado (50 Repasos)',
        description: 'Supera 50 repasos de Active Recall para consolidación a largo plazo.',
        tier: 'gold',
        currentValue: stats.totalRecallRepetitions,
        targetValue: 50,
        unit: 'repasos',
        unlocked: stats.totalRecallRepetitions >= 50,
        xpReward: 750,
        icon: ShieldCheck,
        activeRecallIncentive: 'El recuerdo espaciado multiplica la retención para los exámenes finales.',
      },
      {
        id: 'ach-recall-retention',
        category: 'active_recall',
        title: 'Retención Sobresaliente (≥80%)',
        description: 'Consigue una tasa de retención eficaz del 80% o superior en Active Recall.',
        tier: 'gold',
        currentValue: stats.retentionRate,
        targetValue: 80,
        unit: '%',
        unlocked: stats.retentionRate >= 80,
        xpReward: 500,
        icon: Sparkles,
        activeRecallIncentive: 'Una alta tasa de acierto demuestra un entendimiento conceptual sólido.',
      },

      // CATEGORÍA: ENFOQUE Y POMODORO
      {
        id: 'ach-pomodoro-1',
        category: 'enfoque',
        title: 'Bautismo de Enfoque',
        description: 'Completa tu primer bloque de concentración profunda con Pomodoro.',
        tier: 'bronze',
        currentValue: stats.totalPomodoroSessions,
        targetValue: 1,
        unit: 'bloque',
        unlocked: stats.totalPomodoroSessions >= 1,
        xpReward: 100,
        icon: Clock,
      },
      {
        id: 'ach-pomodoro-10',
        category: 'enfoque',
        title: 'Maestro de la Concentración',
        description: 'Completa 10 bloques de Pomodoro sin distracciones.',
        tier: 'silver',
        currentValue: stats.totalPomodoroSessions,
        targetValue: 10,
        unit: 'bloques',
        unlocked: stats.totalPomodoroSessions >= 10,
        xpReward: 300,
        icon: Target,
      },
      {
        id: 'ach-pomodoro-hours',
        category: 'enfoque',
        title: 'Maratonista Intelectual',
        description: 'Acumula 10 horas de estudio enfocado registradas con el temporizador.',
        tier: 'gold',
        currentValue: stats.totalFocusHours,
        targetValue: 10,
        unit: 'horas',
        unlocked: stats.totalFocusHours >= 10,
        xpReward: 700,
        icon: Medal,
      },

      // CATEGORÍA: MAESTRÍA ACADÉMICA Y CORNELL
      {
        id: 'ach-cornell-notes',
        category: 'maestria',
        title: 'Arquitecto Cornell',
        description: 'Elabora 3 o más apuntes estructurados con método Cornell (cues, notas y resumen).',
        tier: 'silver',
        currentValue: stats.totalCornellNotes,
        targetValue: 3,
        unit: 'apuntes',
        unlocked: stats.totalCornellNotes >= 3,
        xpReward: 300,
        icon: Bookmark,
      },
      {
        id: 'ach-topics-5',
        category: 'maestria',
        title: 'Conquistador de Temas',
        description: 'Estudia o repasa al menos 5 temas completos de tu curso.',
        tier: 'gold',
        currentValue: stats.totalTopicsCompleted,
        targetValue: 5,
        unit: 'temas',
        unlocked: stats.totalTopicsCompleted >= 5,
        xpReward: 500,
        icon: CheckCircle2,
      },
    ];
  }, [stats]);

  // Contadores de logros desbloqueados
  const totalUnlocked = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const totalXP = achievements
    .filter((a) => a.unlocked)
    .reduce((acc, a) => acc + a.xpReward, 0);

  // Filtrado por categoría seleccionada
  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'todos') return achievements;
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6 transition-colors">
      {/* Encabezado del Panel de Logros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
              <Trophy className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Panel de Logros e Insignias de Estudio</span>
              <span className="text-[11px] font-mono-numbers px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
                {totalUnlocked} / {totalCount} desbloqueados
              </span>
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gana medallas e incentiva tu hábito diario de Active Recall, lectura profunda y constancia.
          </p>
        </div>

        {/* Marcador de XP y Nivel de Estudio */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/80 p-2 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 self-start sm:self-auto shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
              Puntos de Maestría
            </div>
            <div className="text-sm font-black font-mono-numbers text-slate-900 dark:text-slate-100">
              {totalXP.toLocaleString()} XP
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta de Incentivo Diario para Active Recall */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-4 sm:p-5 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-xl shrink-0 mt-0.5 border border-white/20">
              <Brain className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  Incentivo Diario
                </span>
                <span className="text-xs font-semibold text-blue-100">
                  Potencia tu Memoria a Largo Plazo
                </span>
              </div>
              <h5 className="font-extrabold text-sm sm:text-base text-white">
                El Active Recall diario multiplica x3 tu retención frente a la lectura pasiva
              </h5>
              <p className="text-xs text-blue-100/90 leading-relaxed">
                Repasar al menos 5 flashcards hoy mantiene tu racha viva y acelera el desbloqueo de las insignias{' '}
                <span className="underline decoration-amber-300 font-semibold text-white">
                  &quot;Memoria Férrea&quot;
                </span>{' '}
                y{' '}
                <span className="underline decoration-amber-300 font-semibold text-white">
                  &quot;Retención Sobresaliente&quot;
                </span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <div className="text-right hidden sm:block pr-2 border-r border-white/20">
              <div className="text-[10px] text-blue-200">Repasos registrados</div>
              <div className="text-sm font-bold font-mono-numbers">
                {stats.totalRecallRepetitions} repeticiones
              </div>
            </div>

            {onOpenActiveRecall && (
              <button
                type="button"
                onClick={onOpenActiveRecall}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer hover:scale-102 active:scale-98"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Repasar Ahora</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Elemento estético de fondo */}
        <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 w-44 h-44 bg-white/5 rounded-full pointer-events-none blur-2xl" />
      </div>

      {/* Filtros de Categorías de Logros */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSelectedCategory('todos')}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'todos'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Todos ({achievements.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('active_recall')}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'active_recall'
              ? 'bg-blue-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Active Recall</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('racha')}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'racha'
              ? 'bg-amber-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Constancia y Racha</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('lectura')}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'lectura'
              ? 'bg-emerald-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Lectura y Páginas</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('enfoque')}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'enfoque'
              ? 'bg-indigo-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Enfoque Pomodoro</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedCategory('maestria')}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
            selectedCategory === 'maestria'
              ? 'bg-purple-600 text-white shadow-2xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Maestría Temática</span>
        </button>
      </div>

      {/* Rejilla de Medallas / Insignias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((item) => {
          const tier = TIER_STYLES[item.tier];
          const IconComponent = item.icon;
          const progressPct = Math.min(
            100,
            Math.round((item.currentValue / item.targetValue) * 100)
          );

          return (
            <div
              key={item.id}
              className={`relative rounded-2xl p-4 border transition-all duration-300 flex flex-col justify-between ${
                item.unlocked
                  ? `${tier.border} ${tier.bgUnlocked} ${tier.glow} bg-white dark:bg-slate-900`
                  : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 opacity-80 hover:opacity-100'
              }`}
            >
              <div>
                {/* Cabecera de la tarjeta: Medalla/Icono + Tier badge + Estado */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform ${
                        item.unlocked
                          ? `${tier.badgeBg} ${tier.iconColor} shadow-2xs scale-105`
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.unlocked ? (
                        <IconComponent className="w-5 h-5" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tier.badgeBg} ${tier.badgeText}`}
                      >
                        {tier.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono-numbers ml-1.5 font-semibold">
                        +{item.xpReward} XP
                      </span>
                    </div>
                  </div>

                  {item.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg shadow-2xs">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Conseguido</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold font-mono-numbers text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                      {progressPct}%
                    </span>
                  )}
                </div>

                {/* Título y descripción */}
                <h5
                  className={`text-sm font-bold tracking-tight ${
                    item.unlocked
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.title}
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {item.description}
                </p>

                {/* Tip específico de Active Recall si aplica */}
                {item.activeRecallIncentive && (
                  <div className="mt-2 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 p-1.5 rounded-lg border border-blue-100 dark:border-blue-900/60 flex items-start gap-1">
                    <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-blue-500" />
                    <span>{item.activeRecallIncentive}</span>
                  </div>
                )}
              </div>

              {/* Barra de progreso inferior */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
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
                        : 'bg-blue-600 dark:bg-blue-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pie de Panel con Resumen Pedagógico */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>
            Las insignias reconocen la constancia diaria, las páginas asimiladas y la práctica activa con Active Recall.
          </span>
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          Progreso sincronizado automáticamente con tu actividad.
        </span>
      </div>
    </div>
  );
};
