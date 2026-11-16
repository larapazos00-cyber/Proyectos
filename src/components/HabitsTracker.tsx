import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Edit3,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Flame,
  Search,
  Check,
  X,
  Repeat,
  TrendingUp,
  BarChart3,
  Grid,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  ReferenceLine,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  HabitItem,
  HabitCategory,
  HabitPreferredPeriod,
  StudyPreferences,
  ScheduledStudySession,
  WeeklyObligation,
  BlockedTimeEvent,
  PomodoroLog,
  MoodEntry,
  MoodType,
} from '../types';
import { storageService } from '../services/storageService';
import { MOOD_OPTIONS_META } from './MoodTracker';
import { MoodYearlyCalendar } from './MoodYearlyCalendar';
import { EffectiveBlockedCalendarItem } from './SmartCalendarModal';
import {
  getTodayLocalDateStr,
  formatReadableDate,
  getDayOfWeekFromDateStr,
  addDaysToDateStr,
} from '../utils/dateUtils';

export interface HabitsTrackerProps {
  preferences?: StudyPreferences;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  pomodoroLogs?: PomodoroLog[];
  selectedDayStr?: string;
  defaultExpanded?: boolean;
  isExpandedExternal?: boolean;
  onToggleExpandExternal?: () => void;
  hideCollapsibleHeader?: boolean;
  sessionsByDate?: Record<string, ScheduledStudySession[]>;
  getEffectiveBlockedForDate?: (dateStr: string) => EffectiveBlockedCalendarItem[];
  onScheduleHabitOneDay?: (
    title: string,
    dateStr: string,
    startTime: string,
    endTime: string,
    category: BlockedTimeEvent['category'],
    notes?: string
  ) => void;
  onScheduleHabitWeekly?: (
    title: string,
    category: WeeklyObligation['category'],
    days: number[],
    startTime: string,
    endTime: string,
    notes?: string
  ) => void;
}

export const DEFAULT_INITIAL_HABITS: HabitItem[] = [
  {
    id: 'hab-default-gym',
    title: 'Ir al gimnasio / Entrenar',
    emoji: '🏋️',
    category: 'deporte',
    frequencyDays: [1, 3, 5],
    requiresCalendarSlot: true,
    durationMinutes: 60,
    location: 'Gimnasio',
    preferredPeriod: 'tarde',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hab-default-dog',
    title: 'Sacar al perro',
    emoji: '🐕',
    category: 'mascota',
    frequencyDays: [1, 2, 3, 4, 5, 6, 0],
    requiresCalendarSlot: true,
    durationMinutes: 30,
    location: 'Parque',
    preferredPeriod: 'manana',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hab-default-home',
    title: 'Tareas domésticas de casa',
    emoji: '🧹',
    category: 'domestico',
    frequencyDays: [2, 4, 6],
    requiresCalendarSlot: true,
    durationMinutes: 45,
    location: 'Casa',
    preferredPeriod: 'mediodia',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
];

const QUICK_HABIT_TEMPLATES: Array<{
  title: string;
  emoji: string;
  category: HabitCategory;
  requiresCalendarSlot: boolean;
  durationMinutes: number;
  location: string;
  preferredPeriod: HabitPreferredPeriod;
  frequencyDays: number[];
}> = [
  {
    title: 'Realizar tareas domésticas',
    emoji: '🧹',
    category: 'domestico',
    requiresCalendarSlot: true,
    durationMinutes: 45,
    location: 'Casa',
    preferredPeriod: 'mediodia',
    frequencyDays: [1, 3, 5, 6],
  },
  {
    title: 'Ir al gimnasio',
    emoji: '🏋️',
    category: 'deporte',
    requiresCalendarSlot: true,
    durationMinutes: 60,
    location: 'Gimnasio',
    preferredPeriod: 'tarde',
    frequencyDays: [1, 3, 5],
  },
  {
    title: 'Sacar al perro',
    emoji: '🐕',
    category: 'mascota',
    requiresCalendarSlot: true,
    durationMinutes: 30,
    location: 'Parque / Calle',
    preferredPeriod: 'manana',
    frequencyDays: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: 'Hacer la compra / Recados',
    emoji: '🛒',
    category: 'domestico',
    requiresCalendarSlot: true,
    durationMinutes: 45,
    location: 'Supermercado',
    preferredPeriod: 'tarde',
    frequencyDays: [2, 5],
  },
  {
    title: 'Beber 2L de agua',
    emoji: '💧',
    category: 'salud',
    requiresCalendarSlot: false,
    durationMinutes: 15,
    location: '',
    preferredPeriod: 'cualquiera',
    frequencyDays: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: 'Estiramientos / Desconexión',
    emoji: '🧘',
    category: 'descanso',
    requiresCalendarSlot: true,
    durationMinutes: 20,
    location: 'Casa',
    preferredPeriod: 'noche',
    frequencyDays: [1, 2, 3, 4, 5],
  },
];

const EMOJI_OPTIONS = ['🏋️', '🧹', '🐕', '🛒', '💧', '🧘', '🥗', '📖', '🏃', '🎸', '🛏️', '🌿'];

const DAY_LABELS: { day: number; short: string; name: string }[] = [
  { day: 1, short: 'L', name: 'Lun' },
  { day: 2, short: 'M', name: 'Mar' },
  { day: 3, short: 'X', name: 'Mié' },
  { day: 4, short: 'J', name: 'Jue' },
  { day: 5, short: 'V', name: 'Vie' },
  { day: 6, short: 'S', name: 'Sáb' },
  { day: 0, short: 'D', name: 'Dom' },
];

function parseMinutes(hhmm?: string, fallbackMinutes: number = 9 * 60): number {
  if (!hhmm || !hhmm.includes(':')) return fallbackMinutes;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return fallbackMinutes;
  return h * 60 + m;
}

function formatMinutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const HabitsTracker: React.FC<HabitsTrackerProps> = ({
  preferences,
  onUpdatePreferences,
  pomodoroLogs,
  selectedDayStr,
  defaultExpanded = false,
  isExpandedExternal,
  onToggleExpandExternal,
  hideCollapsibleHeader = false,
  sessionsByDate = {},
  getEffectiveBlockedForDate,
  onScheduleHabitOneDay,
  onScheduleHabitWeekly,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const activeDateStr = selectedDayStr || todayStr;

  const [isExpandedInternal, setIsExpandedInternal] = useState<boolean>(defaultExpanded);
  const isExpanded =
    typeof isExpandedExternal === 'boolean' ? isExpandedExternal : isExpandedInternal;

  const [correlationRangeDays, setCorrelationRangeDays] = useState<7 | 14 | 30 | 90>(30);
  const [showCorrelationSection, setShowCorrelationSection] = useState<boolean>(true);
  const [correlationViewMode, setCorrelationViewMode] = useState<
    'both' | 'scatter' | 'timeline'
  >('both');
  const [scatterAxisOrientation, setScatterAxisOrientation] = useState<
    'workload_x' | 'mood_x'
  >('workload_x');
  const [scatterXVariable, setScatterXVariable] = useState<'mood' | 'energy'>('mood');
  const [rightPanelBreakdownMode, setRightPanelBreakdownMode] = useState<
    'weekly_days' | 'mood_states'
  >('weekly_days');
  const [useDemoBaselineWhenSparse, setUseDemoBaselineWhenSparse] = useState<boolean>(true);
  const [showD3YearlyHeatmap, setShowD3YearlyHeatmap] = useState<boolean>(false);

  const toggleExpand = () => {
    if (onToggleExpandExternal) {
      onToggleExpandExternal();
    } else {
      setIsExpandedInternal((prev) => !prev);
    }
  };

  // Cargar histórico de moodEntries desde preferences + localStorage
  const loadMoodEntriesForCorrelation = (): MoodEntry[] => {
    const mapByDate = new Map<string, MoodEntry>();
    try {
      const raw = localStorage.getItem('studyflow_user_moods_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry: MoodEntry) => {
            if (entry && entry.date && entry.mood) {
              mapByDate.set(entry.date, entry);
            }
          });
        }
      }
    } catch {
      // ignore
    }
    if (preferences?.moodEntries && Array.isArray(preferences.moodEntries)) {
      preferences.moodEntries.forEach((entry) => {
        if (entry && entry.date && entry.mood) {
          const existing = mapByDate.get(entry.date);
          if (
            !existing ||
            new Date(entry.updatedAt || 0).getTime() >=
              new Date(existing.updatedAt || 0).getTime()
          ) {
            mapByDate.set(entry.date, entry);
          }
        }
      });
    }
    return Array.from(mapByDate.values());
  };

  const [moodEntriesList, setMoodEntriesList] = useState<MoodEntry[]>(
    loadMoodEntriesForCorrelation
  );

  useEffect(() => {
    setMoodEntriesList(loadMoodEntriesForCorrelation());
  }, [preferences?.moodEntries]);

  useEffect(() => {
    const handleMoodSync = () => {
      setMoodEntriesList(loadMoodEntriesForCorrelation());
    };
    window.addEventListener('studyflow-moods-updated', handleMoodSync);
    return () => window.removeEventListener('studyflow-moods-updated', handleMoodSync);
  }, [preferences?.moodEntries]);

  const effectivePomodoroLogs = useMemo<PomodoroLog[]>(() => {
    if (pomodoroLogs && Array.isArray(pomodoroLogs)) {
      return pomodoroLogs;
    }
    return storageService.getPomodoroLogs();
  }, [pomodoroLogs]);

  const loadStoredHabits = (): HabitItem[] => {
    if (preferences?.habits && preferences.habits.length > 0) {
      return preferences.habits;
    }
    try {
      const raw = localStorage.getItem('studyflow_user_habits_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_INITIAL_HABITS;
  };

  const [habits, setHabits] = useState<HabitItem[]>(loadStoredHabits);

  // Sync across components via custom event
  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem('studyflow_user_habits_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setHabits(parsed);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('studyflow-habits-updated', handleSync);
    return () => window.removeEventListener('studyflow-habits-updated', handleSync);
  }, []);

  const persistHabits = (nextHabits: HabitItem[]) => {
    setHabits(nextHabits);
    try {
      localStorage.setItem('studyflow_user_habits_v1', JSON.stringify(nextHabits));
      window.dispatchEvent(new CustomEvent('studyflow-habits-updated'));
    } catch {
      // ignore
    }
    if (preferences && onUpdatePreferences) {
      onUpdatePreferences({
        ...preferences,
        habits: nextHabits,
      });
    }
  };

  // Análisis Estadístico y Línea de Tiempo: Correlación entre Humor Reportado (moodEntries) y Carga de Trabajo Semanal (pomodoroLogs)
  const {
    moodPomodoroTimelineData,
    scatterPlotData,
    regressionTrendLineData,
    moodCategoryBreakdown,
    weeklyWorkloadMoodBreakdown,
    correlationSummary,
  } = useMemo(() => {
    const moodByDate = new Map<string, MoodEntry>();
    moodEntriesList.forEach((m) => moodByDate.set(m.date, m));

    const pomodorosByDate = new Map<string, { sessions: number; minutes: number }>();
    effectivePomodoroLogs.forEach((log) => {
      if (!log.date) return;
      const prev = pomodorosByDate.get(log.date) || { sessions: 0, minutes: 0 };
      pomodorosByDate.set(log.date, {
        sessions: prev.sessions + 1,
        minutes: prev.minutes + (Number(log.durationMinutes) || 25),
      });
    });

    const shortDayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const fullDayNames = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];

    const points: Array<{
      dateStr: string;
      shortLabel: string;
      readableDate: string;
      moodType: MoodType | null;
      moodScore: number | null;
      plotMoodScore: number;
      energyLevel: number | null;
      moodLabel: string;
      moodEmoji: string;
      hasMoodRecord: boolean;
      pomodoroSessions: number;
      pomodoroMinutes: number;
      habitsCompleted: number;
    }> = [];

    let highMoodDays = 0;
    let highMoodPomodoros = 0;
    let lowMoodDays = 0;
    let lowMoodPomodoros = 0;
    let totalPomodorosInPeriod = 0;
    let totalMinutesInPeriod = 0;
    let recordedMoodDaysInPeriod = 0;
    let sumMoodScore = 0;

    for (let offset = correlationRangeDays - 1; offset >= 0; offset--) {
      const dStr = addDaysToDateStr(todayStr, -offset);
      const dayOfWeek = getDayOfWeekFromDateStr(dStr);
      const [, mm, dd] = dStr.split('-');
      const entry = moodByDate.get(dStr);
      const pomo = pomodorosByDate.get(dStr) || { sessions: 0, minutes: 0 };
      const habitsDoneCount = habits.filter((h) => h.completedDates.includes(dStr)).length;

      const moodScore = entry ? MOOD_OPTIONS_META[entry.mood].score : null;
      const energyLevel = entry ? entry.energyLevel : null;

      totalPomodorosInPeriod += pomo.sessions;
      totalMinutesInPeriod += pomo.minutes;

      if (moodScore !== null) {
        recordedMoodDaysInPeriod++;
        sumMoodScore += moodScore;
        if (moodScore >= 4) {
          highMoodDays++;
          highMoodPomodoros += pomo.sessions;
        } else {
          lowMoodDays++;
          lowMoodPomodoros += pomo.sessions;
        }
      }

      points.push({
        dateStr: dStr,
        shortLabel:
          correlationRangeDays <= 7
            ? `${shortDayNames[dayOfWeek]} ${dd}`
            : `${dd}/${mm}`,
        readableDate: formatReadableDate(dStr),
        moodType: entry ? entry.mood : null,
        moodScore,
        plotMoodScore: moodScore ?? 3,
        energyLevel,
        moodLabel: entry ? MOOD_OPTIONS_META[entry.mood].label : 'Sin registrar',
        moodEmoji: entry ? MOOD_OPTIONS_META[entry.mood].emoji : '·',
        hasMoodRecord: Boolean(entry),
        pomodoroSessions: pomo.sessions,
        pomodoroMinutes: pomo.minutes,
        habitsCompleted: habitsDoneCount,
      });
    }

    // Recopilar todos los días con registro de humor o sesiones para el análisis estadístico de dispersión
    const allHistoricalDatesSet = new Set<string>();
    points.forEach((p) => allHistoricalDatesSet.add(p.dateStr));
    moodEntriesList.forEach((m) => {
      if (m.date) allHistoricalDatesSet.add(m.date);
    });

    interface RawPairedSample {
      dateStr: string;
      readableDate: string;
      dayOfWeek: number;
      shortDayName: string;
      fullDayName: string;
      moodType: MoodType;
      moodScore: number;
      energyLevel: number;
      pomodoroSessions: number;
      pomodoroMinutes: number;
      habitsCompleted: number;
      isSimulatedSample: boolean;
    }

    const realPairedSamples: RawPairedSample[] = [];
    Array.from(allHistoricalDatesSet)
      .sort()
      .slice(-correlationRangeDays)
      .forEach((dStr) => {
        const entry = moodByDate.get(dStr);
        if (!entry) return;
        const pomo = pomodorosByDate.get(dStr) || { sessions: 0, minutes: 0 };
        const habitsDoneCount = habits.filter((h) => h.completedDates.includes(dStr)).length;
        const dow = getDayOfWeekFromDateStr(dStr);
        realPairedSamples.push({
          dateStr: dStr,
          readableDate: formatReadableDate(dStr),
          dayOfWeek: dow,
          shortDayName: shortDayNames[dow],
          fullDayName: fullDayNames[dow],
          moodType: entry.mood,
          moodScore: MOOD_OPTIONS_META[entry.mood].score,
          energyLevel: entry.energyLevel || 3,
          pomodoroSessions: pomo.sessions,
          pomodoroMinutes: pomo.minutes,
          habitsCompleted: habitsDoneCount,
          isSimulatedSample: false,
        });
      });

    // Si hay menos de 3 días registrados con humor y el usuario activa la muestra base demostrativa,
    // completamos con una semana tipo para visualizar las líneas de tendencia de carga vs humor
    const isUsingDemoSamples =
      realPairedSamples.length < 3 && useDemoBaselineWhenSparse;

    const effectiveSamples: RawPairedSample[] = [...realPairedSamples];
    if (isUsingDemoSamples) {
      const demoTemplates: Array<{
        offset: number;
        moodType: MoodType;
        energyLevel: number;
        sessions: number;
        habits: number;
      }> = [
        { offset: 1, moodType: 'motivado', energyLevel: 4, sessions: 5, habits: 3 },
        { offset: 2, moodType: 'excelente', energyLevel: 5, sessions: 4, habits: 3 },
        { offset: 3, moodType: 'equilibrado', energyLevel: 3, sessions: 6, habits: 2 },
        { offset: 4, moodType: 'cansado', energyLevel: 2, sessions: 7, habits: 1 },
        { offset: 5, moodType: 'motivado', energyLevel: 4, sessions: 5, habits: 3 },
        { offset: 6, moodType: 'estresado', energyLevel: 2, sessions: 8, habits: 1 },
        { offset: 7, moodType: 'excelente', energyLevel: 5, sessions: 3, habits: 3 },
      ];
      demoTemplates.forEach((tpl) => {
        const dStr = addDaysToDateStr(todayStr, -tpl.offset);
        if (!effectiveSamples.some((s) => s.dateStr === dStr)) {
          const dow = getDayOfWeekFromDateStr(dStr);
          effectiveSamples.push({
            dateStr: dStr,
            readableDate: `${formatReadableDate(dStr)} (Muestra)`,
            dayOfWeek: dow,
            shortDayName: shortDayNames[dow],
            fullDayName: fullDayNames[dow],
            moodType: tpl.moodType,
            moodScore: MOOD_OPTIONS_META[tpl.moodType].score,
            energyLevel: tpl.energyLevel,
            pomodoroSessions: tpl.sessions,
            pomodoroMinutes: tpl.sessions * 25,
            habitsCompleted: tpl.habits,
            isSimulatedSample: true,
          });
        }
      });
    }

    // Función auxiliar de regresión lineal por mínimos cuadrados (OLS): Y sobre X
    const computeLinearRegression = (pairs: Array<{ x: number; y: number }>) => {
      const count = pairs.length;
      if (count === 0) {
        return { meanX: 0, meanY: 0, slope: 0, intercept: 0, r: 0, r2: 0 };
      }
      const mX = pairs.reduce((acc, p) => acc + p.x, 0) / count;
      const mY = pairs.reduce((acc, p) => acc + p.y, 0) / count;
      let cov = 0;
      let vX = 0;
      let vY = 0;
      pairs.forEach((p) => {
        const dx = p.x - mX;
        const dy = p.y - mY;
        cov += dx * dy;
        vX += dx * dx;
        vY += dy * dy;
      });
      const mSlope = vX > 1e-6 ? cov / vX : 0;
      const bIntercept = mY - mSlope * mX;
      const rVal =
        vX > 1e-6 && vY > 1e-6
          ? Math.max(-1, Math.min(1, cov / Math.sqrt(vX * vY)))
          : 0;
      return {
        meanX: mX,
        meanY: mY,
        slope: mSlope,
        intercept: bIntercept,
        r: rVal,
        r2: rVal * rVal,
      };
    };

    const n = effectiveSamples.length;

    // 1) Regresión en modo "workload_x" (Eje X = Sesiones Pomodoro, Eje Y = Ánimo 1..5 y Energía 1..5)
    const regWorkloadToMood = computeLinearRegression(
      effectiveSamples.map((s) => ({ x: s.pomodoroSessions, y: s.moodScore }))
    );
    const regWorkloadToEnergy = computeLinearRegression(
      effectiveSamples.map((s) => ({ x: s.pomodoroSessions, y: s.energyLevel }))
    );

    // 2) Regresión en modo "mood_x" (Eje X = Humor/Energía 1..5, Eje Y = Sesiones Pomodoro)
    const regMoodToWorkload = computeLinearRegression(
      effectiveSamples.map((s) => ({
        x: scatterXVariable === 'mood' ? s.moodScore : s.energyLevel,
        y: s.pomodoroSessions,
      }))
    );

    const activeReg =
      scatterAxisOrientation === 'workload_x' ? regWorkloadToMood : regMoodToWorkload;

    const pearsonR = activeReg.r;
    const rSquared = Number(activeReg.r2.toFixed(2));
    const roundedPearsonR = Number(pearsonR.toFixed(2));
    const roundedSlope = Number(activeReg.slope.toFixed(2));
    const roundedIntercept = Number(activeReg.intercept.toFixed(2));
    const meanX = activeReg.meanX;
    const meanY = activeReg.meanY;

    // Clasificación estadística de cómo la carga de trabajo semanal afecta al humor
    let correlationStrengthLabel = 'Carga equilibrada con el humor';
    let correlationBadgeColor =
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    if (pearsonR >= 0.55) {
      correlationStrengthLabel = 'Sinergia Positiva Fuerte (Mayor Carga = Mayor Ánimo)';
      correlationBadgeColor =
        'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    } else if (pearsonR >= 0.25) {
      correlationStrengthLabel = 'Correlación Positiva Moderada';
      correlationBadgeColor =
        'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    } else if (pearsonR <= -0.45) {
      correlationStrengthLabel = 'Fatiga por Alta Carga (Más Pomodoros Reducen el Ánimo)';
      correlationBadgeColor =
        'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    } else if (pearsonR <= -0.2) {
      correlationStrengthLabel = 'Desgaste Moderado en Días de Alta Carga';
      correlationBadgeColor =
        'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    } else if (n >= 2) {
      correlationStrengthLabel = 'Ánimo Estable ante la Carga Semanal';
      correlationBadgeColor =
        'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    }

    // Construir puntos del gráfico de dispersión con jitter determinista cuando coinciden coordenadas
    const coordCountMap = new Map<string, number>();
    let optimalFlowCount = 0;
    let resilientCount = 0;
    let highLoadFatigueCount = 0;

    const scatterItems = effectiveSamples.map((s) => {
      const rawX =
        scatterAxisOrientation === 'workload_x'
          ? s.pomodoroSessions
          : scatterXVariable === 'mood'
          ? s.moodScore
          : s.energyLevel;
      const rawY =
        scatterAxisOrientation === 'workload_x'
          ? s.moodScore
          : s.pomodoroSessions;

      const key = `${rawX}-${rawY}`;
      const seenIdx = coordCountMap.get(key) || 0;
      coordCountMap.set(key, seenIdx + 1);

      const jitterStep = scatterAxisOrientation === 'workload_x' ? 0.14 : 0.08;
      const jitterOffset =
        seenIdx === 0
          ? 0
          : (seenIdx % 2 === 1 ? 1 : -1) * Math.min(0.28, Math.ceil(seenIdx / 2) * jitterStep);
      const xPlot = Number((rawX + jitterOffset).toFixed(2));

      const predictedMoodForWorkload = Math.max(
        1,
        Math.min(
          5,
          Number(
            (regWorkloadToMood.slope * s.pomodoroSessions + regWorkloadToMood.intercept).toFixed(2)
          )
        )
      );
      const predictedEnergyForWorkload = Math.max(
        1,
        Math.min(
          5,
          Number(
            (regWorkloadToEnergy.slope * s.pomodoroSessions + regWorkloadToEnergy.intercept).toFixed(2)
          )
        )
      );
      const predictedSessionsForMood = Math.max(
        0,
        Number(
          (
            regMoodToWorkload.slope *
              (scatterXVariable === 'mood' ? s.moodScore : s.energyLevel) +
            regMoodToWorkload.intercept
          ).toFixed(2)
        )
      );

      const predictedY =
        scatterAxisOrientation === 'workload_x'
          ? predictedMoodForWorkload
          : predictedSessionsForMood;

      const meta = MOOD_OPTIONS_META[s.moodType];
      const avgPomoThreshold = Math.max(2, regWorkloadToMood.meanX);

      let quadrantLabel = 'Carga Ligera / Recuperación';
      if (s.moodScore >= 3.5 && s.pomodoroSessions >= avgPomoThreshold) {
        quadrantLabel = 'Flujo Óptimo (Alta Carga + Buen Humor)';
        optimalFlowCount++;
      } else if (s.moodScore < 3.5 && s.pomodoroSessions >= avgPomoThreshold) {
        quadrantLabel = 'Desgaste por Alta Carga (Alta Carga + Humor Afectado)';
        resilientCount++;
        highLoadFatigueCount++;
      } else if (s.moodScore >= 3.5 && s.pomodoroSessions < avgPomoThreshold) {
        quadrantLabel = 'Bienestar con Carga Moderada';
      }

      return {
        dateStr: s.dateStr,
        readableDate: s.readableDate,
        dayOfWeek: s.dayOfWeek,
        shortDayName: s.shortDayName,
        fullDayName: s.fullDayName,
        x: xPlot,
        rawX,
        y: rawY,
        predictedY,
        predictedEnergyY: predictedEnergyForWorkload,
        pomodoroSessions: s.pomodoroSessions,
        pomodoroMinutes: s.pomodoroMinutes,
        habitsCompleted: s.habitsCompleted,
        moodType: s.moodType,
        moodScore: s.moodScore,
        energyLevel: s.energyLevel,
        moodLabel: meta.label,
        moodEmoji: meta.emoji,
        hexColor: meta.hexColor,
        quadrantLabel,
        isSimulatedSample: s.isSimulatedSample,
      };
    });

    // Puntos para las Líneas de Tendencia de Regresión Lineal
    const maxSessionsInSample = Math.max(
      6,
      ...effectiveSamples.map((s) => s.pomodoroSessions)
    );
    const minSessionsInSample = Math.min(
      0,
      ...effectiveSamples.map((s) => s.pomodoroSessions)
    );

    const trendPoints =
      scatterAxisOrientation === 'workload_x'
        ? Array.from(
            { length: maxSessionsInSample - minSessionsInSample + 1 },
            (_, idx) => {
              const sessVal = minSessionsInSample + idx;
              return {
                x: sessVal,
                rawX: sessVal,
                trendY: Math.max(
                  1,
                  Math.min(
                    5,
                    Number(
                      (regWorkloadToMood.slope * sessVal + regWorkloadToMood.intercept).toFixed(2)
                    )
                  )
                ),
                trendEnergyY: Math.max(
                  1,
                  Math.min(
                    5,
                    Number(
                      (
                        regWorkloadToEnergy.slope * sessVal +
                        regWorkloadToEnergy.intercept
                      ).toFixed(2)
                    )
                  )
                ),
              };
            }
          )
        : [1, 2, 3, 4, 5].map((xVal) => ({
            x: xVal,
            rawX: xVal,
            trendY: Math.max(
              0,
              Number((regMoodToWorkload.slope * xVal + regMoodToWorkload.intercept).toFixed(2))
            ),
            trendEnergyY: undefined,
          }));

    // Desglose por Día de la Semana (Lunes a Domingo): qué días de mayor carga afectan más al humor
    const weekDaysOrder = [1, 2, 3, 4, 5, 6, 0]; // Lun..Dom
    const weeklyBreakdown = weekDaysOrder.map((dow) => {
      const matching = effectiveSamples.filter((s) => s.dayOfWeek === dow);
      const count = matching.length;
      const totalSessions = matching.reduce((acc, item) => acc + item.pomodoroSessions, 0);
      const totalMinutes = matching.reduce((acc, item) => acc + item.pomodoroMinutes, 0);
      const sumMood = matching.reduce((acc, item) => acc + item.moodScore, 0);
      const sumEnergy = matching.reduce((acc, item) => acc + item.energyLevel, 0);

      const avgSessions = count > 0 ? Number((totalSessions / count).toFixed(1)) : 0;
      const avgMinutes = count > 0 ? Math.round(totalMinutes / count) : 0;
      const avgMood = count > 0 ? Number((sumMood / count).toFixed(1)) : 0;
      const avgEnergy = count > 0 ? Number((sumEnergy / count).toFixed(1)) : 0;

      // Emoji representativo del humor medio del día
      let representativeMood: MoodType = 'equilibrado';
      if (avgMood >= 4.5) representativeMood = 'excelente';
      else if (avgMood >= 3.5) representativeMood = 'motivado';
      else if (avgMood >= 2.6) representativeMood = 'equilibrado';
      else if (avgMood >= 1.8) representativeMood = 'cansado';
      else if (count > 0) representativeMood = 'estresado';

      const moodMeta = MOOD_OPTIONS_META[representativeMood];

      // Clasificar objetivamente el impacto de la carga de ese día sobre el humor
      let impactTag = 'Sin datos';
      let impactColor = 'text-slate-400';
      if (count > 0) {
        if (avgSessions >= Math.max(3, regWorkloadToMood.meanX) && avgMood < 3.0) {
          impactTag = '⚠️ Mayor desgaste por carga';
          impactColor = 'text-rose-600 dark:text-rose-400 font-bold';
        } else if (avgSessions >= Math.max(3, regWorkloadToMood.meanX) && avgMood >= 3.8) {
          impactTag = '🔥 Alta carga bien tolerada';
          impactColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
        } else if (avgSessions >= Math.max(3, regWorkloadToMood.meanX)) {
          impactTag = '⚖️ Carga exigente estable';
          impactColor = 'text-indigo-600 dark:text-indigo-400 font-semibold';
        } else if (avgMood >= 3.8) {
          impactTag = '✨ Día de recuperación positiva';
          impactColor = 'text-blue-600 dark:text-blue-400';
        } else {
          impactTag = '🌿 Carga moderada';
          impactColor = 'text-slate-500 dark:text-slate-400';
        }
      }

      // Índice de tensión por carga = sesiones * (6 - avgMood)
      const strainScore = count > 0 ? avgSessions * (6 - avgMood) : 0;

      return {
        dayOfWeek: dow,
        shortDay: shortDayNames[dow],
        fullDay: fullDayNames[dow],
        daysRecorded: count,
        avgSessions,
        avgMinutes,
        avgMood,
        avgEnergy,
        emoji: count > 0 ? moodMeta.emoji : '·',
        hexColor: count > 0 ? moodMeta.hexColor : '#cbd5e1',
        impactTag,
        impactColor,
        strainScore,
      };
    });

    // Día de la semana con mayor carga de sesiones Pomodoro y día donde la carga más afecta al humor
    const daysWithRecords = weeklyBreakdown.filter((d) => d.daysRecorded > 0);
    const heaviestWorkloadDay =
      [...daysWithRecords].sort((a, b) => b.avgSessions - a.avgSessions)[0] || null;
    const mostImpactedMoodDay =
      [...daysWithRecords].sort((a, b) => b.strainScore - a.strainScore)[0] || null;

    // Desglose de productividad por cada uno de los estados de ánimo del Mood Tracker
    const moodOrder = Object.keys(MOOD_OPTIONS_META) as MoodType[];
    const moodBreakdown = moodOrder.map((mType) => {
      const meta = MOOD_OPTIONS_META[mType];
      const matching = effectiveSamples.filter((s) => s.moodType === mType);
      const count = matching.length;
      const totalSess = matching.reduce((acc, item) => acc + item.pomodoroSessions, 0);
      const totalMins = matching.reduce((acc, item) => acc + item.pomodoroMinutes, 0);
      const maxSess = matching.reduce(
        (max, item) => Math.max(max, item.pomodoroSessions),
        0
      );
      const avgSessions = count > 0 ? Number((totalSess / count).toFixed(1)) : 0;
      const avgMinutes = count > 0 ? Math.round(totalMins / count) : 0;
      const expectedSessions = Math.max(
        0,
        Number((regMoodToWorkload.slope * meta.score + regMoodToWorkload.intercept).toFixed(1))
      );

      return {
        moodType: mType,
        label: meta.label,
        shortLabel: meta.shortLabel,
        emoji: meta.emoji,
        score: meta.score,
        hexColor: meta.hexColor,
        daysCount: count,
        avgSessions,
        avgMinutes,
        maxSessions: maxSess,
        expectedSessions,
      };
    });

    const bestMoodBucket = [...moodBreakdown]
      .filter((b) => b.daysCount > 0)
      .sort((a, b) => b.avgSessions - a.avgSessions)[0];

    const avgHighMoodPomodoros =
      highMoodDays > 0 ? Number((highMoodPomodoros / highMoodDays).toFixed(1)) : 0;
    const avgLowMoodPomodoros =
      lowMoodDays > 0 ? Number((lowMoodPomodoros / lowMoodDays).toFixed(1)) : 0;
    const avgMoodScore =
      recordedMoodDaysInPeriod > 0
        ? Number((sumMoodScore / recordedMoodDaysInPeriod).toFixed(1))
        : 0;

    let insightMessage =
      'Registra tu estado de ánimo a diario y completa bloques Pomodoro para descubrir cómo influye la carga de estudio en tu humor.';
    if (n >= 2) {
      const wSlope = Number(regWorkloadToMood.slope.toFixed(2));
      const slopeDesc =
        wSlope < -0.05
          ? `por cada sesión Pomodoro adicional el ánimo varía en ${wSlope} pts (señal de fatiga en días muy intensos)`
          : wSlope > 0.05
          ? `por cada sesión Pomodoro adicional el ánimo sube +${wSlope} pts (el avance impulsa tu motivación)`
          : `tu ánimo se mantiene estable (${wSlope} pts/🍅) incluso cuando sube la carga de trabajo`;

      const strainText = mostImpactedMoodDay
        ? `El día donde la carga semanal afecta más tu humor es el ${mostImpactedMoodDay.fullDay} (carga media de ${mostImpactedMoodDay.avgSessions} 🍅 con ánimo ${mostImpactedMoodDay.avgMood}/5 ${mostImpactedMoodDay.emoji}).`
        : '';

      insightMessage = `Tendencia Carga vs. Humor (r = ${
        roundedPearsonR >= 0 ? `+${roundedPearsonR}` : roundedPearsonR
      }, R² = ${Math.round(rSquared * 100)}%): Se observa que ${slopeDesc}. ${strainText}`;
    }

    return {
      moodPomodoroTimelineData: points,
      scatterPlotData: scatterItems,
      regressionTrendLineData: trendPoints,
      moodCategoryBreakdown: moodBreakdown,
      weeklyWorkloadMoodBreakdown: weeklyBreakdown,
      correlationSummary: {
        avgHighMoodPomodoros,
        avgLowMoodPomodoros,
        highMoodDays,
        lowMoodDays,
        totalPomodorosInPeriod,
        totalMinutesInPeriod,
        recordedMoodDaysInPeriod,
        realPairedDaysCount: realPairedSamples.length,
        effectiveSampleSize: n,
        isUsingDemoSamples,
        avgMoodScore,
        pearsonR: roundedPearsonR,
        rSquared,
        slope: roundedSlope,
        intercept: roundedIntercept,
        energySlope: Number(regWorkloadToEnergy.slope.toFixed(2)),
        meanX: Number(meanX.toFixed(2)),
        meanY: Number(meanY.toFixed(1)),
        maxSessionsInSample,
        optimalFlowCount,
        resilientCount,
        highLoadFatigueCount,
        heaviestWorkloadDay,
        mostImpactedMoodDay,
        bestMoodBucket: bestMoodBucket || null,
        correlationStrengthLabel,
        correlationBadgeColor,
        insightMessage,
      },
    };
  }, [
    moodEntriesList,
    effectivePomodoroLogs,
    habits,
    correlationRangeDays,
    scatterAxisOrientation,
    scatterXVariable,
    useDemoBaselineWhenSparse,
    todayStr,
  ]);

  // Form state for adding / editing a habit
  const [isHabitFormOpen, setIsHabitFormOpen] = useState<boolean>(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitTitle, setHabitTitle] = useState<string>('');
  const [habitEmoji, setHabitEmoji] = useState<string>('🏋️');
  const [habitCategory, setHabitCategory] = useState<HabitCategory>('personal');
  const [habitDays, setHabitDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [habitRequiresSlot, setHabitRequiresSlot] = useState<boolean>(true);
  const [habitDurationMin, setHabitDurationMin] = useState<number>(45);
  const [habitLocation, setHabitLocation] = useState<string>('');
  const [habitPreferredPeriod, setHabitPreferredPeriod] =
    useState<HabitPreferredPeriod>('tarde');
  const [habitScheduleMode, setHabitScheduleMode] = useState<'custom_time' | 'slot_finder'>('custom_time');
  const [habitCustomStartTime, setHabitCustomStartTime] = useState<string>('18:00');
  const [habitSyncToCalendarOnSave, setHabitSyncToCalendarOnSave] = useState<boolean>(true);

  const [slotFinderHabitId, setSlotFinderHabitId] = useState<string | null>(null);
  const [manualTimeHabitId, setManualTimeHabitId] = useState<string | null>(null);
  const [manualStartTimeInput, setManualStartTimeInput] = useState<string>('18:00');
  const [manualEndTimeInput, setManualEndTimeInput] = useState<string>('18:45');
  const [scheduledSuccessBanner, setScheduledSuccessBanner] = useState<string | null>(null);

  const last7Dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dStr = addDaysToDateStr(activeDateStr, i - 6);
      const dow = getDayOfWeekFromDateStr(dStr);
      const dayLabel = DAY_LABELS.find((dl) => dl.day === dow)?.short || 'D';
      return { dateStr: dStr, dow, dayLabel, dayNum: dStr.slice(8, 10) };
    });
  }, [activeDateStr]);

  const activeDayOfWeek = getDayOfWeekFromDateStr(activeDateStr);
  const habitsForActiveDay = useMemo(
    () => habits.filter((h) => h.frequencyDays.includes(activeDayOfWeek)),
    [habits, activeDayOfWeek]
  );
  const completedCountActiveDay = useMemo(
    () => habitsForActiveDay.filter((h) => h.completedDates.includes(activeDateStr)).length,
    [habitsForActiveDay, activeDateStr]
  );

  const getPeriodicityLabel = (days: number[]) => {
    if (days.length === 7) return 'Diario (L–D)';
    const sorted = [...days].sort();
    if (sorted.join(',') === '1,2,3,4,5') return 'Lunes a Viernes';
    if (sorted.join(',') === '0,6') return 'Fin de semana';
    return DAY_LABELS.filter((dl) => days.includes(dl.day))
      .map((dl) => dl.short)
      .join(' · ');
  };

  const getDefaultStartTimeForPeriod = (period?: HabitPreferredPeriod): string => {
    if (period === 'manana') return '09:00';
    if (period === 'mediodia') return '13:30';
    if (period === 'tarde') return '18:00';
    if (period === 'noche') return '20:30';
    return '18:00';
  };

  const openCreateHabitForm = (preset?: (typeof QUICK_HABIT_TEMPLATES)[number]) => {
    setEditingHabitId(null);
    setHabitTitle(preset?.title || '');
    setHabitEmoji(preset?.emoji || '🏋️');
    setHabitCategory(preset?.category || 'personal');
    setHabitDays(preset?.frequencyDays || [1, 2, 3, 4, 5, 6, 0]);
    setHabitRequiresSlot(preset ? preset.requiresCalendarSlot : true);
    setHabitDurationMin(preset?.durationMinutes || 45);
    setHabitLocation(preset?.location || '');
    const period = preset?.preferredPeriod || 'tarde';
    setHabitPreferredPeriod(period);
    setHabitScheduleMode('custom_time');
    setHabitCustomStartTime(getDefaultStartTimeForPeriod(period));
    setHabitSyncToCalendarOnSave(true);
    setIsHabitFormOpen(true);
  };

  const openEditHabitForm = (habit: HabitItem) => {
    setEditingHabitId(habit.id);
    setHabitTitle(habit.title);
    setHabitEmoji(habit.emoji);
    setHabitCategory(habit.category);
    setHabitDays([...habit.frequencyDays]);
    setHabitRequiresSlot(habit.requiresCalendarSlot);
    setHabitDurationMin(habit.durationMinutes || 45);
    setHabitLocation(habit.location || '');
    const period = habit.preferredPeriod || 'tarde';
    setHabitPreferredPeriod(period);
    if (habit.scheduledStartTime) {
      setHabitScheduleMode('custom_time');
      setHabitCustomStartTime(habit.scheduledStartTime);
    } else {
      setHabitScheduleMode('slot_finder');
      setHabitCustomStartTime(getDefaultStartTimeForPeriod(period));
    }
    setHabitSyncToCalendarOnSave(false);
    setIsHabitFormOpen(true);
  };

  const openManualTimePickerForHabit = (habit: HabitItem) => {
    if (manualTimeHabitId === habit.id) {
      setManualTimeHabitId(null);
      return;
    }
    setSlotFinderHabitId(null);
    const start = habit.scheduledStartTime || getDefaultStartTimeForPeriod(habit.preferredPeriod);
    const dur = Math.max(15, habit.durationMinutes || 45);
    const end =
      habit.scheduledEndTime || formatMinutesToHHMM(parseMinutes(start, 18 * 60) + dur);
    setManualStartTimeInput(start);
    setManualEndTimeInput(end);
    setManualTimeHabitId(habit.id);
  };

  const handleManualStartTimeChange = (newStart: string, durationMin: number = 45) => {
    setManualStartTimeInput(newStart);
    if (newStart && newStart.includes(':')) {
      const computedEnd = formatMinutesToHHMM(
        parseMinutes(newStart, 18 * 60) + Math.max(15, durationMin)
      );
      setManualEndTimeInput(computedEnd);
    }
  };

  const handleClearHabitScheduledTime = (habit: HabitItem) => {
    const updated = habits.map((h) =>
      h.id === habit.id
        ? { ...h, scheduledStartTime: undefined, scheduledEndTime: undefined }
        : h
    );
    persistHabits(updated);
    setManualTimeHabitId(null);
    setScheduledSuccessBanner(`🕒 Hora fija eliminada del hábito "${habit.title}".`);
    setTimeout(() => setScheduledSuccessBanner(null), 4000);
  };

  const handleSaveHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = habitTitle.trim();
    if (!cleanTitle) return;

    const cleanDays = habitDays.length > 0 ? habitDays : [1, 2, 3, 4, 5, 6, 0];
    const hasCustomTime =
      habitRequiresSlot &&
      habitScheduleMode === 'custom_time' &&
      Boolean(habitCustomStartTime && habitCustomStartTime.includes(':'));
    const computedEndTime = hasCustomTime
      ? formatMinutesToHHMM(parseMinutes(habitCustomStartTime, 18 * 60) + habitDurationMin)
      : undefined;

    if (editingHabitId) {
      let editedHabitObj: HabitItem | null = null;
      const updated = habits.map((h) => {
        if (h.id !== editingHabitId) return h;
        const nextH: HabitItem = {
          ...h,
          title: cleanTitle,
          emoji: habitEmoji,
          category: habitCategory,
          frequencyDays: cleanDays,
          requiresCalendarSlot: habitRequiresSlot,
          durationMinutes: habitRequiresSlot ? habitDurationMin : undefined,
          location: habitRequiresSlot ? habitLocation.trim() : undefined,
          preferredPeriod: habitRequiresSlot ? habitPreferredPeriod : undefined,
          scheduledStartTime: hasCustomTime
            ? habitCustomStartTime
            : habitRequiresSlot
            ? h.scheduledStartTime
            : undefined,
          scheduledEndTime: hasCustomTime
            ? computedEndTime
            : habitRequiresSlot
            ? h.scheduledEndTime
            : undefined,
        };
        editedHabitObj = nextH;
        return nextH;
      });
      persistHabits(updated);
      if (editedHabitObj && hasCustomTime && computedEndTime && habitSyncToCalendarOnSave) {
        handleApplySlotToCalendar(
          editedHabitObj,
          habitCustomStartTime,
          computedEndTime,
          onScheduleHabitWeekly ? 'weekly_habit_days' : 'single_day'
        );
      } else if (editedHabitObj && habitRequiresSlot && habitScheduleMode === 'slot_finder') {
        setSlotFinderHabitId((editedHabitObj as HabitItem).id);
      }
    } else {
      const newHabit: HabitItem = {
        id: `hab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        emoji: habitEmoji,
        category: habitCategory,
        frequencyDays: cleanDays,
        requiresCalendarSlot: habitRequiresSlot,
        durationMinutes: habitRequiresSlot ? habitDurationMin : undefined,
        location: habitRequiresSlot ? habitLocation.trim() : undefined,
        preferredPeriod: habitRequiresSlot ? habitPreferredPeriod : undefined,
        scheduledStartTime: hasCustomTime ? habitCustomStartTime : undefined,
        scheduledEndTime: hasCustomTime ? computedEndTime : undefined,
        completedDates: [],
        createdAt: new Date().toISOString(),
      };
      const nextHabitsList = [...habits, newHabit];
      persistHabits(nextHabitsList);

      if (hasCustomTime && computedEndTime) {
        if (habitSyncToCalendarOnSave && (onScheduleHabitWeekly || onScheduleHabitOneDay)) {
          handleApplySlotToCalendar(
            newHabit,
            habitCustomStartTime,
            computedEndTime,
            onScheduleHabitWeekly ? 'weekly_habit_days' : 'single_day',
            nextHabitsList
          );
        } else {
          setScheduledSuccessBanner(
            `🕒 Hábito "${newHabit.title}" creado con horario ${habitCustomStartTime}–${computedEndTime}.`
          );
          setTimeout(() => setScheduledSuccessBanner(null), 4500);
        }
      } else if (habitRequiresSlot && habitScheduleMode === 'slot_finder') {
        setSlotFinderHabitId(newHabit.id);
      }
    }

    setIsHabitFormOpen(false);
    setEditingHabitId(null);
  };

  const handleDeleteHabit = (id: string) => {
    persistHabits(habits.filter((h) => h.id !== id));
    if (slotFinderHabitId === id) setSlotFinderHabitId(null);
  };

  const handleToggleHabitCompletion = (habitId: string, dateStr: string) => {
    const updated = habits.map((h) => {
      if (h.id !== habitId) return h;
      const exists = h.completedDates.includes(dateStr);
      return {
        ...h,
        completedDates: exists
          ? h.completedDates.filter((d) => d !== dateStr)
          : [...h.completedDates, dateStr],
      };
    });
    persistHabits(updated);
  };

  // Smart Slot Finder
  const findSmartSlotsForHabit = (
    habit: HabitItem,
    dateStr: string
  ): Array<{
    startTime: string;
    endTime: string;
    periodLabel: string;
    isPreferred: boolean;
    reason: string;
  }> => {
    const durationMin = Math.max(15, habit.durationMinutes || 45);
    const dayStartMin = (preferences?.studyDayStartHour ?? 8) * 60;
    const dayEndMin = (preferences?.studyDayEndHour ?? 22) * 60;

    const busyIntervals: Array<{ start: number; end: number; label: string }> = [];

    const daySessions = sessionsByDate[dateStr] || [];
    daySessions.forEach((s) => {
      const st = parseMinutes(s.startTime, 9 * 60);
      const et = s.endTime
        ? parseMinutes(s.endTime, st + Math.round((s.durationHours || 1) * 60))
        : st + Math.round((s.durationHours || 1) * 60);
      busyIntervals.push({ start: st, end: et, label: s.topicTitle });
    });

    const dayBlocked = getEffectiveBlockedForDate ? getEffectiveBlockedForDate(dateStr) : [];
    dayBlocked.forEach((b) => {
      const st = parseMinutes(b.startTime, 16 * 60);
      const et = parseMinutes(b.endTime, st + 60);
      busyIntervals.push({ start: st, end: et, label: b.title });
    });

    busyIntervals.sort((a, b) => a.start - b.start);

    const candidates: Array<{
      startTime: string;
      endTime: string;
      periodLabel: string;
      isPreferred: boolean;
      reason: string;
      score: number;
    }> = [];

    const pref = habit.preferredPeriod || 'cualquiera';
    const isInPreferredRange = (min: number) => {
      if (pref === 'manana') return min >= 8 * 60 && min < 12 * 60;
      if (pref === 'mediodia') return min >= 12 * 60 && min < 16 * 60;
      if (pref === 'tarde') return min >= 16 * 60 && min < 20 * 60;
      if (pref === 'noche') return min >= 20 * 60 && min <= 22 * 60;
      return true;
    };

    const getPeriodName = (min: number) => {
      if (min < 12 * 60) return 'Mañana';
      if (min < 16 * 60) return 'Mediodía';
      if (min < 20 * 60) return 'Tarde';
      return 'Noche';
    };

    for (let t = dayStartMin; t + durationMin <= dayEndMin; t += 30) {
      const endT = t + durationMin;
      const overlaps = busyIntervals.some((b) => t < b.end && endT > b.start);
      if (!overlaps) {
        const isPref = isInPreferredRange(t);
        const periodLabel = getPeriodName(t);
        const justAfterBlock = busyIntervals.some((b) => Math.abs(t - b.end) <= 15);
        let score = isPref ? 100 : 40;
        if (justAfterBlock) score += 20;
        if (t % 60 === 0) score += 5;

        candidates.push({
          startTime: formatMinutesToHHMM(t),
          endTime: formatMinutesToHHMM(endT),
          periodLabel,
          isPreferred: isPref,
          reason: isPref
            ? `Hueco libre en tu franja preferida (${periodLabel})`
            : justAfterBlock
            ? `Hueco libre justo al terminar otra actividad (${periodLabel})`
            : `Ventana disponible en tu agenda (${periodLabel})`,
          score,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const picked: typeof candidates = [];
    for (const c of candidates) {
      if (picked.length >= 4) break;
      const tooClose = picked.some(
        (p) => Math.abs(parseMinutes(p.startTime) - parseMinutes(c.startTime)) < 60
      );
      if (!tooClose) {
        picked.push(c);
      }
    }

    return picked;
  };

  const checkTimeRangeOverlapForDate = (
    dateStr: string,
    startTime: string,
    endTime: string
  ): string | null => {
    const st = parseMinutes(startTime, 18 * 60);
    const et = parseMinutes(endTime, st + 45);
    if (et <= st) return 'La hora de fin debe ser posterior a la de inicio';

    const daySessions = sessionsByDate[dateStr] || [];
    for (const s of daySessions) {
      const sst = parseMinutes(s.startTime, 9 * 60);
      const set = s.endTime
        ? parseMinutes(s.endTime, sst + Math.round((s.durationHours || 1) * 60))
        : sst + Math.round((s.durationHours || 1) * 60);
      if (st < set && et > sst) {
        return `Coincide con estudio: "${s.topicTitle}" (${formatMinutesToHHMM(sst)}–${formatMinutesToHHMM(set)})`;
      }
    }

    const dayBlocked = getEffectiveBlockedForDate ? getEffectiveBlockedForDate(dateStr) : [];
    for (const b of dayBlocked) {
      const bst = parseMinutes(b.startTime, 16 * 60);
      const bet = parseMinutes(b.endTime, bst + 60);
      if (st < bet && et > bst) {
        return `Coincide con: "${b.title}" (${b.startTime}–${b.endTime})`;
      }
    }

    return null;
  };

  const handleApplySlotToCalendar = (
    habit: HabitItem,
    startTime: string,
    endTime: string,
    mode: 'single_day' | 'weekly_habit_days' | 'save_only',
    baseHabitsList?: HabitItem[]
  ) => {
    const labelWithEmoji = `${habit.emoji} ${habit.title}${
      habit.location ? ` (${habit.location})` : ''
    }`;
    const notesText = habit.location
      ? `Hábito personal · Lugar: ${habit.location}`
      : 'Hábito personal programado desde el Control de Hábitos';

    if (mode === 'single_day' && onScheduleHabitOneDay) {
      const blockedCat: BlockedTimeEvent['category'] =
        habit.category === 'deporte'
          ? 'deporte'
          : habit.category === 'descanso'
          ? 'descanso'
          : 'personal';
      onScheduleHabitOneDay(
        labelWithEmoji,
        activeDateStr,
        startTime,
        endTime,
        blockedCat,
        notesText
      );
      setScheduledSuccessBanner(
        `✅ "${habit.title}" agendado en el calendario el ${formatReadableDate(
          activeDateStr
        )} de ${startTime} a ${endTime}${habit.location ? ` en ${habit.location}` : ''}.`
      );
    } else if (mode === 'weekly_habit_days' && onScheduleHabitWeekly) {
      const weeklyCat: WeeklyObligation['category'] =
        habit.category === 'deporte'
          ? 'gimnasio'
          : habit.category === 'domestico'
          ? 'domestico'
          : habit.category === 'descanso'
          ? 'descanso'
          : 'personal';
      onScheduleHabitWeekly(
        labelWithEmoji,
        weeklyCat,
        habit.frequencyDays,
        startTime,
        endTime,
        notesText
      );
      setScheduledSuccessBanner(
        `🔁 "${habit.title}" fijado en tus días del hábito (${startTime}–${endTime})${
          habit.location ? ` · 📍 ${habit.location}` : ''
        }.`
      );
    } else {
      setScheduledSuccessBanner(
        `🕒 Horario ${startTime}–${endTime} guardado en el hábito "${habit.title}".`
      );
    }

    const sourceList = baseHabitsList || habits;
    const updatedHabits = sourceList.map((h) =>
      h.id === habit.id
        ? { ...h, scheduledStartTime: startTime, scheduledEndTime: endTime }
        : h
    );
    persistHabits(updatedHabits);
    setSlotFinderHabitId(null);
    setManualTimeHabitId(null);
    setTimeout(() => setScheduledSuccessBanner(null), 5000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden transition-all">
      {/* CABECERA COMPACTA DESPLEGABLE */}
      {!hideCollapsibleHeader && (
        <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={toggleExpand}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
              }`}
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  isExpanded ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              <span>Control de Hábitos Diarios</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-numbers font-extrabold ${
                  isExpanded
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {completedCountActiveDay}/{habitsForActiveDay.length} hoy
              </span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>

            {!isExpanded && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!isExpanded) toggleExpand();
                    openCreateHabitForm();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/80 dark:border-emerald-800/80 transition-colors cursor-pointer"
                  title="Añadir un nuevo hábito diario"
                >
                  <Plus className="w-3 h-3" />
                  <span>Añadir</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isExpanded) toggleExpand();
                    setShowCorrelationSection(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 hover:bg-violet-100 border border-violet-200/80 dark:border-violet-800/80 transition-colors cursor-pointer"
                  title="Ver línea de tiempo de correlación Ánimo Diario vs Sesiones Pomodoro"
                >
                  <TrendingUp className="w-3 h-3" />
                  <span className="hidden sm:inline">Ánimo vs Pomodoro</span>
                </button>
              </>
            )}
          </div>

          {/* Vista rápida en línea cuando está plegado */}
          {!isExpanded && habitsForActiveDay.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
              {habitsForActiveDay.slice(0, 5).map((h) => {
                const done = h.completedDates.includes(activeDateStr);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => handleToggleHabitCompletion(h.id, activeDateStr)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer shrink-0 ${
                      done
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 line-through opacity-85'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                    }`}
                    title={`Marcar "${h.title}" (${getPeriodicityLabel(h.frequencyDays)}${
                      h.scheduledStartTime ? ` · ${h.scheduledStartTime}` : ''
                    })`}
                  >
                    <span>{h.emoji}</span>
                    <span className="max-w-[115px] truncate">{h.title}</span>
                    {h.scheduledStartTime && (
                      <span className="text-[10px] font-mono-numbers text-indigo-600 dark:text-indigo-400 font-bold">
                        {h.scheduledStartTime}
                      </span>
                    )}
                    {done && <Check className="w-3 h-3 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {scheduledSuccessBanner && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
          <span>{scheduledSuccessBanner}</span>
          <button
            type="button"
            onClick={() => setScheduledSuccessBanner(null)}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CONTENIDO DESPLEGADO DEL CONTROL DE HÁBITOS */}
      {isExpanded && (
        <div
          className={`p-4 sm:p-5 ${
            !hideCollapsibleHeader ? 'border-t border-slate-200/80 dark:border-slate-800' : ''
          } space-y-4 animate-in fade-in duration-150`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Gestión de Hábitos Diarios y Semanales</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {activeDateStr === todayStr ? 'Hoy' : formatReadableDate(activeDateStr)}
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Define el nombre, periodicidad y estado completado de tus hábitos, o búscales un hueco libre en el calendario.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateHabitForm()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Hábito</span>
              </button>
              <button
                type="button"
                onClick={toggleExpand}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Plegar Control de Hábitos"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ideas rápidas de 1 clic */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              Sugerencias:
            </span>
            {QUICK_HABIT_TEMPLATES.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() => openCreateHabitForm(preset)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <span>{preset.emoji}</span>
                <span>{preset.title}</span>
                <Plus className="w-3 h-3 text-emerald-600" />
              </button>
            ))}
          </div>

          {/* Formulario Crear / Editar Hábito */}
          {isHabitFormOpen && (
            <form
              onSubmit={handleSaveHabit}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-emerald-200 dark:border-emerald-900/60 space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700 pb-2">
                <h5 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {editingHabitId ? '✏️ Modificar Hábito' : '➕ Añadir Nuevo Hábito'}
                </h5>
                <button
                  type="button"
                  onClick={() => {
                    setIsHabitFormOpen(false);
                    setEditingHabitId(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Icono
                  </label>
                  <div className="flex flex-wrap gap-1 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    {EMOJI_OPTIONS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setHabitEmoji(em)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                          habitEmoji === em
                            ? 'bg-emerald-100 dark:bg-emerald-900/70 ring-2 ring-emerald-500 scale-105'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-9 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Nombre del hábito
                      </label>
                      <input
                        type="text"
                        required
                        value={habitTitle}
                        onChange={(e) => setHabitTitle(e.target.value)}
                        placeholder="Ej: Sacar al perro, Ir al gimnasio, Tareas domésticas..."
                        className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                        Categoría
                      </label>
                      <select
                        value={habitCategory}
                        onChange={(e) => setHabitCategory(e.target.value as HabitCategory)}
                        className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <option value="deporte">🏋️ Deporte / Gimnasio</option>
                        <option value="domestico">🧹 Tareas Domésticas</option>
                        <option value="mascota">🐕 Mascota / Paseo</option>
                        <option value="salud">💧 Salud / Autocuidado</option>
                        <option value="descanso">🧘 Descanso / Mente</option>
                        <option value="estudio">📖 Lectura / Hábito Estudio</option>
                        <option value="personal">✨ Otro Personal</option>
                      </select>
                    </div>
                  </div>

                  {/* Periodicidad rápida + Selección por días */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase text-slate-500 mr-1">
                        Periodicidad:
                      </span>
                      <button
                        type="button"
                        onClick={() => setHabitDays([1, 2, 3, 4, 5, 6, 0])}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          habitDays.length === 7
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Diario
                      </button>
                      <button
                        type="button"
                        onClick={() => setHabitDays([1, 2, 3, 4, 5])}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          [...habitDays].sort().join(',') === '1,2,3,4,5'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        L–V
                      </button>
                      <div className="flex items-center gap-1 ml-1">
                        {DAY_LABELS.map((dl) => {
                          const selected = habitDays.includes(dl.day);
                          return (
                            <button
                              key={dl.day}
                              type="button"
                              onClick={() => {
                                setHabitDays((prev) =>
                                  prev.includes(dl.day)
                                    ? prev.filter((d) => d !== dl.day)
                                    : [...prev, dl.day]
                                );
                              }}
                              className={`w-6 h-6 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                selected
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                              }`}
                              title={dl.name}
                            >
                              {dl.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={habitRequiresSlot}
                        onChange={(e) => setHabitRequiresSlot(e.target.checked)}
                        className="rounded accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                      <span>Ocupa tiempo y lugar en calendario</span>
                    </label>
                  </div>
                </div>
              </div>

              {habitRequiresSlot && (
                <div className="space-y-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>Duración estimada</span>
                      </label>
                      <select
                        value={habitDurationMin}
                        onChange={(e) => setHabitDurationMin(Number(e.target.value))}
                        className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <option value={15}>15 minutos</option>
                        <option value={20}>20 minutos</option>
                        <option value={30}>30 minutos</option>
                        <option value={45}>45 minutos</option>
                        <option value={60}>1 hora (60 min)</option>
                        <option value={90}>1 hora y media (90 min)</option>
                        <option value={120}>2 horas (120 min)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1 mb-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        <span>Lugar / Ubicación (opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={habitLocation}
                        onChange={(e) => setHabitLocation(e.target.value)}
                        placeholder="Ej: Casa, Gimnasio, Parque..."
                        className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1 mb-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Franja preferida (para buscar huecos)</span>
                      </label>
                      <select
                        value={habitPreferredPeriod}
                        onChange={(e) => {
                          const nextPeriod = e.target.value as HabitPreferredPeriod;
                          setHabitPreferredPeriod(nextPeriod);
                        }}
                        className="w-full h-9 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <option value="manana">🌅 Mañana (08:00 – 12:00)</option>
                        <option value="mediodia">☀️ Mediodía (12:00 – 16:00)</option>
                        <option value="tarde">🌇 Tarde (16:00 – 20:00)</option>
                        <option value="noche">🌙 Noche (20:00 – 22:00)</option>
                        <option value="cualquiera">🕒 Cualquier hueco libre</option>
                      </select>
                    </div>
                  </div>

                  {/* Selector de Modo de Horario: Escoger hora concreta vs Buscar hueco libre */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>¿Cómo quieres asignar el horario de este hábito?</span>
                      </span>

                      <div className="inline-flex rounded-xl p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setHabitScheduleMode('custom_time')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            habitScheduleMode === 'custom_time'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>Escoger hora fija</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHabitScheduleMode('slot_finder')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            habitScheduleMode === 'slot_finder'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                          }`}
                        >
                          <Search className="w-3 h-3" />
                          <span>Buscar un hueco libre</span>
                        </button>
                      </div>
                    </div>

                    {habitScheduleMode === 'custom_time' ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                              Hora de inicio:
                            </label>
                            <input
                              type="time"
                              value={habitCustomStartTime}
                              onChange={(e) => setHabitCustomStartTime(e.target.value)}
                              className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-extrabold font-mono-numbers text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          {habitCustomStartTime && habitCustomStartTime.includes(':') && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold font-mono-numbers text-emerald-800 dark:text-emerald-300">
                              <span>Horario:</span>
                              <span>
                                {habitCustomStartTime} –{' '}
                                {formatMinutesToHHMM(
                                  parseMinutes(habitCustomStartTime, 18 * 60) + habitDurationMin
                                )}
                              </span>
                            </span>
                          )}

                          <div className="flex items-center gap-1 flex-wrap">
                            {['08:00', '10:00', '14:00', '17:00', '19:00', '21:00'].map((presetT) => (
                              <button
                                key={presetT}
                                type="button"
                                onClick={() => setHabitCustomStartTime(presetT)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono-numbers font-bold border transition-colors cursor-pointer ${
                                  habitCustomStartTime === presetT
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                                }`}
                              >
                                {presetT}
                              </button>
                            ))}
                          </div>
                        </div>

                        {(onScheduleHabitWeekly || onScheduleHabitOneDay) && (
                          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={habitSyncToCalendarOnSave}
                              onChange={(e) => setHabitSyncToCalendarOnSave(e.target.checked)}
                              className="rounded accent-emerald-600 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span>Bloquear también en el calendario</span>
                          </label>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60">
                        ✨ Al guardar el hábito se mostrarán automáticamente los mejores huecos libres de tu agenda en la franja seleccionada, y también podrás escoger cualquier hora manualmente cuando quieras.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsHabitFormOpen(false);
                    setEditingHabitId(null);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingHabitId ? 'Guardar cambios' : 'Guardar hábito'}
                </button>
              </div>
            </form>
          )}

          {/* Lista de Hábitos */}
          {habits.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              No tienes hábitos configurados. Pulsa en «Nuevo Hábito» para añadir el primero.
            </div>
          ) : (
            <div className="space-y-2.5">
              {habits.map((habit) => {
                const isDoneSelectedDay = habit.completedDates.includes(activeDateStr);
                const isSlotFinderOpen = slotFinderHabitId === habit.id;
                const isManualTimeOpen = manualTimeHabitId === habit.id;
                const suggestedSlots = isSlotFinderOpen
                  ? findSmartSlotsForHabit(habit, activeDateStr)
                  : [];
                const manualOverlapWarning = isManualTimeOpen
                  ? checkTimeRangeOverlapForDate(
                      activeDateStr,
                      manualStartTimeInput,
                      manualEndTimeInput
                    )
                  : null;

                return (
                  <div
                    key={habit.id}
                    className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleHabitCompletion(habit.id, activeDateStr)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 border transition-all cursor-pointer ${
                            isDoneSelectedDay
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                          title={
                            isDoneSelectedDay ? 'Completado hoy' : 'Marcar como completado hoy'
                          }
                        >
                          {isDoneSelectedDay ? <Check className="w-4 h-4" /> : habit.emoji}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold text-slate-900 dark:text-white ${
                                isDoneSelectedDay ? 'line-through opacity-75' : ''
                              }`}
                            >
                              {habit.emoji} {habit.title}
                            </span>

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                              {getPeriodicityLabel(habit.frequencyDays)}
                            </span>

                            {habit.durationMinutes && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                <Clock className="w-2.5 h-2.5 text-emerald-600" />
                                {habit.durationMinutes} min
                              </span>
                            )}

                            {habit.location && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                <MapPin className="w-2.5 h-2.5 text-indigo-500" />
                                {habit.location}
                              </span>
                            )}

                            {habit.scheduledStartTime && habit.scheduledEndTime && (
                              <button
                                type="button"
                                onClick={() => openManualTimePickerForHabit(habit)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors cursor-pointer"
                                title="Haz clic para cambiar la hora del hábito"
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span className="font-mono-numbers">
                                  {habit.scheduledStartTime}–{habit.scheduledEndTime}
                                </span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <span>
                              Estado hoy:{' '}
                              <strong
                                className={
                                  isDoneSelectedDay
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }
                              >
                                {isDoneSelectedDay ? 'Completado' : 'Pendiente'}
                              </strong>
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5">
                              <Flame className="w-3 h-3" />
                              {habit.completedDates.length} días cumplidos
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5">
                        {/* 7-day bubbles */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
                          {last7Dates.map((dObj) => {
                            const done = habit.completedDates.includes(dObj.dateStr);
                            const isTargetDay = habit.frequencyDays.includes(dObj.dow);
                            return (
                              <button
                                key={dObj.dateStr}
                                type="button"
                                onClick={() => handleToggleHabitCompletion(habit.id, dObj.dateStr)}
                                className={`w-6 h-6 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                                  done
                                    ? 'bg-emerald-600 text-white'
                                    : isTargetDay
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                                    : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100'
                                }`}
                                title={`${dObj.dayLabel} ${dObj.dayNum}: ${
                                  done ? 'Completado' : 'Pendiente'
                                }`}
                              >
                                <span>{dObj.dayLabel}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Botón Escoger hora manual */}
                        <button
                          type="button"
                          onClick={() => openManualTimePickerForHabit(habit)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            isManualTimeOpen
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                          }`}
                          title="Escoger manualmente la hora de inicio y fin para este hábito"
                        >
                          <Clock className="w-3 h-3" />
                          <span>
                            {habit.scheduledStartTime ? 'Cambiar hora' : 'Escoger hora'}
                          </span>
                        </button>

                        {/* Botón Buscar hueco automático */}
                        <button
                          type="button"
                          onClick={() => {
                            setManualTimeHabitId(null);
                            setSlotFinderHabitId(isSlotFinderOpen ? null : habit.id);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            isSlotFinderOpen
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                          }`}
                          title="Buscar hueco libre en el calendario para este hábito"
                        >
                          <Search className="w-3 h-3" />
                          <span>Buscar hueco</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditHabitForm(habit)}
                          className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="Modificar hábito"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteHabit(habit.id)}
                          className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                          title="Eliminar hábito"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Panel Desplegable 1: Escoger Hora Manualmente */}
                    {isManualTimeOpen && (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div>
                              <h6 className="text-xs font-extrabold text-slate-900 dark:text-white">
                                Escoger hora para «{habit.title}»
                              </h6>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Selecciona tu horario preferido o elígelo con 1 clic y agéndalo en tu calendario
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setManualTimeHabitId(null);
                                setSlotFinderHabitId(habit.id);
                              }}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Search className="w-3 h-3" />
                              <span>Ver huecos libres sugeridos</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualTimeHabitId(null)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                Inicio:
                              </label>
                              <input
                                type="time"
                                value={manualStartTimeInput}
                                onChange={(e) =>
                                  handleManualStartTimeChange(
                                    e.target.value,
                                    habit.durationMinutes || 45
                                  )
                                }
                                className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-extrabold font-mono-numbers text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                Fin:
                              </label>
                              <input
                                type="time"
                                value={manualEndTimeInput}
                                onChange={(e) => setManualEndTimeInput(e.target.value)}
                                className="h-8 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-extrabold font-mono-numbers text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            <div className="flex items-center gap-1 flex-wrap">
                              {['08:00', '09:30', '12:30', '16:30', '18:00', '20:00'].map((pt) => (
                                <button
                                  key={pt}
                                  type="button"
                                  onClick={() =>
                                    handleManualStartTimeChange(pt, habit.durationMinutes || 45)
                                  }
                                  className={`px-2 py-1 rounded-lg text-[10px] font-mono-numbers font-bold border transition-colors cursor-pointer ${
                                    manualStartTimeInput === pt
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
                                  }`}
                                >
                                  {pt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Indicador en vivo de disponibilidad en agenda */}
                          <div className="text-[11px]">
                            {manualOverlapWarning ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold">
                                ⚠️ {manualOverlapWarning}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold">
                                ✅ Franja libre en tu agenda ({activeDateStr === todayStr ? 'hoy' : formatReadableDate(activeDateStr)})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            {habit.scheduledStartTime && (
                              <button
                                type="button"
                                onClick={() => handleClearHabitScheduledTime(habit)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                Quitar hora fija
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleApplySlotToCalendar(
                                  habit,
                                  manualStartTimeInput,
                                  manualEndTimeInput,
                                  'save_only'
                                )
                              }
                              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              🕒 Solo guardar hora ({manualStartTimeInput}–{manualEndTimeInput})
                            </button>

                            {onScheduleHabitOneDay && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleApplySlotToCalendar(
                                    habit,
                                    manualStartTimeInput,
                                    manualEndTimeInput,
                                    'single_day'
                                  )
                                }
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                              >
                                📅 Agendar hoy ({manualStartTimeInput}–{manualEndTimeInput})
                              </button>
                            )}

                            {onScheduleHabitWeekly && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleApplySlotToCalendar(
                                    habit,
                                    manualStartTimeInput,
                                    manualEndTimeInput,
                                    'weekly_habit_days'
                                  )
                                }
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                              >
                                <Repeat className="w-3 h-3" />
                                <span>Fijar en días del hábito</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Panel Desplegable 2: Buscador Inteligente de Huecos Libres */}
                    {isSlotFinderOpen && (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <div>
                              <h6 className="text-xs font-extrabold text-slate-900 dark:text-white">
                                Huecos libres sugeridos para «{habit.title}» ({habit.durationMinutes || 45} min)
                              </h6>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Calculados para {activeDateStr === todayStr ? 'hoy' : formatReadableDate(activeDateStr)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openManualTimePickerForHabit(habit)}
                              className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Escoger otra hora manualmente</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSlotFinderHabitId(null)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {suggestedSlots.length === 0 ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg">
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              Este día tiene la agenda completa. Prueba con otro día o escoge una hora manualmente.
                            </p>
                            <button
                              type="button"
                              onClick={() => openManualTimePickerForHabit(habit)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Escoger hora manual
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {suggestedSlots.map((slot) => (
                              <div
                                key={`${slot.startTime}-${slot.endTime}`}
                                className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 ${
                                  slot.isPreferred
                                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                                      {slot.startTime} – {slot.endTime}
                                    </span>
                                    {slot.isPreferred && (
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                                        Ideal
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {slot.reason}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleApplySlotToCalendar(
                                        habit,
                                        slot.startTime,
                                        slot.endTime,
                                        'single_day'
                                      )
                                    }
                                    className="flex-1 py-1 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer text-center"
                                  >
                                    📅 Agendar hoy
                                  </button>
                                  {onScheduleHabitWeekly && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleApplySlotToCalendar(
                                          habit,
                                          slot.startTime,
                                          slot.endTime,
                                          'weekly_habit_days'
                                        )
                                      }
                                      className="py-1 px-2 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Repeat className="w-2.5 h-2.5" />
                                      <span>Fijar días</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* VISTA DE ANÁLISIS ESTADÍSTICO: CORRELACIÓN ENTRE HUMOR REPORTADO Y SESIONES POMODORO (DISPERSIÓN + REGRESIÓN + LÍNEA DE TIEMPO) */}
          <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-100/80 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      Análisis Estadístico: Humor Diario vs. Sesiones Pomodoro
                    </h4>
                    <span
                      className={`text-[10px] font-mono-numbers font-bold px-2 py-0.5 rounded-md border ${correlationSummary.correlationBadgeColor}`}
                    >
                      r ={' '}
                      {correlationSummary.pearsonR >= 0
                        ? `+${correlationSummary.pearsonR}`
                        : correlationSummary.pearsonR}{' '}
                      · {correlationSummary.correlationStrengthLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Regresión lineal (OLS), gráfico de dispersión y desglose por estado de ánimo para identificar patrones de productividad.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Selector de Modo de Visualización */}
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCorrelationViewMode('both')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      correlationViewMode === 'both'
                        ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Completa
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorrelationViewMode('scatter')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      correlationViewMode === 'scatter'
                        ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Dispersión + Tendencia
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorrelationViewMode('timeline')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      correlationViewMode === 'timeline'
                        ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Línea de Tiempo
                  </button>
                </div>

                {/* Selector de ventana temporal: 7, 14, 30 o 90 días */}
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                  {([7, 14, 30, 90] as const).map((daysOption) => (
                    <button
                      key={daysOption}
                      type="button"
                      onClick={() => setCorrelationRangeDays(daysOption)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        correlationRangeDays === daysOption
                          ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {daysOption}d
                    </button>
                  ))}
                </div>

                {/* Botón para mostrar/ocultar el Calendario de Calor Anual D3 */}
                <button
                  type="button"
                  onClick={() => setShowD3YearlyHeatmap((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                    showD3YearlyHeatmap
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-violet-400'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>{showD3YearlyHeatmap ? 'Ocultar Heatmap D3' : 'Heatmap Anual D3'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCorrelationSection((prev) => !prev)}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showCorrelationSection ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {showCorrelationSection && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
                {/* Tarjetas KPI Estadísticas (Pearson r, R², Regresión Lineal y Estado Óptimo) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Correlación de Pearson (r)
                    </span>
                    <div className="text-base sm:text-lg font-extrabold font-mono-numbers text-violet-600 dark:text-violet-400 mt-0.5">
                      {correlationSummary.pearsonR >= 0
                        ? `+${correlationSummary.pearsonR}`
                        : correlationSummary.pearsonR}{' '}
                      <span className="text-[10px] font-normal text-slate-400">
                        (R² = {Math.round(correlationSummary.rSquared * 100)}%)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono-numbers">
                      {correlationSummary.correlationStrengthLabel}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Impacto Marginal (Pendiente OLS)
                    </span>
                    <div className="text-base sm:text-lg font-extrabold font-mono-numbers text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {correlationSummary.slope >= 0
                        ? `+${correlationSummary.slope}`
                        : correlationSummary.slope}{' '}
                      <span className="text-[10px] font-normal text-slate-400">
                        🍅 / +1 nivel
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono-numbers">
                      Ecuación: y = {correlationSummary.slope}x{' '}
                      {correlationSummary.intercept >= 0
                        ? `+ ${correlationSummary.intercept}`
                        : `- ${Math.abs(correlationSummary.intercept)}`}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Estado de Máxima Productividad
                    </span>
                    <div className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                      {correlationSummary.bestMoodBucket ? (
                        <>
                          <span>{correlationSummary.bestMoodBucket.emoji}</span>
                          <span className="truncate">
                            {correlationSummary.bestMoodBucket.shortLabel}
                          </span>
                          <span className="text-xs font-mono-numbers">
                            ({correlationSummary.bestMoodBucket.avgSessions} 🍅)
                          </span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono-numbers">
                      Ánimo alto: {correlationSummary.avgHighMoodPomodoros} vs bajo:{' '}
                      {correlationSummary.avgLowMoodPomodoros} 🍅/día
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Día de Mayor Impacto por Carga
                    </span>
                    <div className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-0.5 flex items-center gap-1">
                      {correlationSummary.mostImpactedMoodDay ? (
                        <>
                          <span>{correlationSummary.mostImpactedMoodDay.emoji}</span>
                          <span className="truncate">
                            {correlationSummary.mostImpactedMoodDay.fullDay}
                          </span>
                          <span className="text-xs font-mono-numbers">
                            ({correlationSummary.mostImpactedMoodDay.avgSessions} 🍅 →{' '}
                            {correlationSummary.mostImpactedMoodDay.avgMood}/5)
                          </span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono-numbers">
                      Mayor carga:{' '}
                      {correlationSummary.heaviestWorkloadDay
                        ? `${correlationSummary.heaviestWorkloadDay.shortDay} (${correlationSummary.heaviestWorkloadDay.avgSessions} 🍅)`
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* SECCIÓN 1: GRÁFICO DE DISPERSIÓN CON LÍNEAS DE TENDENCIA (ÁNIMO + ENERGÍA VS CARGA POMODORO) + IMPACTO SEMANAL */}
                {(correlationViewMode === 'both' || correlationViewMode === 'scatter') && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    {/* Columna Izquierda (7 cols): Scatter Plot + Líneas de Tendencia */}
                    <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 p-3 sm:p-3.5 flex flex-col justify-between space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>
                              {scatterAxisOrientation === 'workload_x'
                                ? 'Dispersión y Líneas de Tendencia: Ánimo frente a Carga Pomodoro'
                                : `Dispersión y Regresión: Pomodoros según ${
                                    scatterXVariable === 'mood' ? 'Humor' : 'Energía'
                                  }`}
                            </span>
                          </h5>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {scatterAxisOrientation === 'workload_x'
                              ? 'Compara el ánimo y energía (1–5) frente al nº de sesiones Pomodoro completadas por día de la semana.'
                              : 'Cada punto representa un día; la recta discontinua indica la tendencia por mínimos cuadrados.'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Selector de Orientación de Ejes */}
                          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                            <button
                              type="button"
                              onClick={() => setScatterAxisOrientation('workload_x')}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                                scatterAxisOrientation === 'workload_x'
                                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="Eje X: Carga de sesiones Pomodoro · Eje Y: Nivel de Ánimo y Energía (1-5)"
                            >
                              Carga (🍅) → Humor
                            </button>
                            <button
                              type="button"
                              onClick={() => setScatterAxisOrientation('mood_x')}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                                scatterAxisOrientation === 'mood_x'
                                  ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="Eje X: Nivel de Humor (1-5) · Eje Y: Sesiones Pomodoro"
                            >
                              Humor → Carga (🍅)
                            </button>
                          </div>

                          {correlationSummary.realPairedDaysCount < 3 && (
                            <button
                              type="button"
                              onClick={() => setUseDemoBaselineWhenSparse((prev) => !prev)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-pointer ${
                                useDemoBaselineWhenSparse
                                  ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                              title="Cuando tienes menos de 3 días registrados, puedes previsualizar la regresión con una muestra base"
                            >
                              {useDemoBaselineWhenSparse ? 'Muestra activa' : 'Solo reales'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="h-60 sm:h-68 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            margin={{ top: 18, right: 16, left: -14, bottom: 8 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#e2e8f0"
                              opacity={0.65}
                            />
                            <XAxis
                              type="number"
                              dataKey="x"
                              domain={
                                scatterAxisOrientation === 'workload_x'
                                  ? [0, Math.max(6, correlationSummary.maxSessionsInSample + 1)]
                                  : [0.7, 5.3]
                              }
                              ticks={
                                scatterAxisOrientation === 'workload_x'
                                  ? undefined
                                  : [1, 2, 3, 4, 5]
                              }
                              allowDecimals={false}
                              tickFormatter={(val) => {
                                if (scatterAxisOrientation === 'workload_x') {
                                  return `${Math.round(val)} 🍅`;
                                }
                                if (scatterXVariable === 'energy') return `⚡${val}`;
                                const labels: Record<number, string> = {
                                  1: '1 🤯',
                                  2: '2 😴',
                                  3: '3 🙂',
                                  4: '4 🚀',
                                  5: '5 🤩',
                                };
                                return labels[val] || String(val);
                              }}
                              tick={{ fontSize: 10, fill: '#64748b' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              type="number"
                              domain={
                                scatterAxisOrientation === 'workload_x'
                                  ? [0.8, 5.3]
                                  : ['auto', 'auto']
                              }
                              ticks={
                                scatterAxisOrientation === 'workload_x'
                                  ? [1, 2, 3, 4, 5]
                                  : undefined
                              }
                              allowDecimals={false}
                              tickFormatter={(val) => {
                                if (scatterAxisOrientation === 'workload_x') {
                                  const moodAxisLabels: Record<number, string> = {
                                    1: '1 🤯',
                                    2: '2 😴',
                                    3: '3 🙂',
                                    4: '4 🚀',
                                    5: '5 🤩',
                                  };
                                  return moodAxisLabels[val] || String(val);
                                }
                                return String(val);
                              }}
                              tick={{ fontSize: 10, fill: '#4f46e5' }}
                              axisLine={false}
                              tickLine={false}
                              label={{
                                value:
                                  scatterAxisOrientation === 'workload_x'
                                    ? 'Ánimo / Energía (1-5)'
                                    : 'Sesiones Pomodoro (🍅)',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fontSize: 10, fill: '#4f46e5' },
                              }}
                            />
                            <ReferenceLine
                              x={correlationSummary.meanX}
                              stroke="#94a3b8"
                              strokeDasharray="3 3"
                              strokeOpacity={0.6}
                            />
                            <ReferenceLine
                              y={correlationSummary.meanY}
                              stroke="#94a3b8"
                              strokeDasharray="3 3"
                              strokeOpacity={0.6}
                            />
                            <Tooltip
                              cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const scatterEntry = payload.find(
                                  (p: any) => p.payload && p.payload.readableDate
                                );
                                if (scatterEntry) {
                                  const d = scatterEntry.payload;
                                  return (
                                    <div className="rounded-xl bg-slate-900 text-white p-2.5 text-[11px] shadow-xl border border-slate-700 space-y-1">
                                      <div className="font-bold flex items-center justify-between gap-3 border-b border-slate-700/80 pb-1">
                                        <span>
                                          {d.fullDayName} · {d.readableDate}
                                        </span>
                                        <span>{d.moodEmoji}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-indigo-300">Carga de Trabajo:</span>
                                        <span className="font-bold font-mono-numbers">
                                          🍅 {d.pomodoroSessions} sesiones ({d.pomodoroMinutes} min)
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-violet-300">Humor registrado:</span>
                                        <span className="font-bold font-mono-numbers">
                                          {d.moodLabel} ({d.moodScore}/5) · ⚡{d.energyLevel}/5
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-slate-300">Tendencia esperada:</span>
                                        <span className="font-mono-numbers font-semibold text-emerald-300">
                                          {scatterAxisOrientation === 'workload_x'
                                            ? `Ánimo ${d.predictedY}/5 · ⚡${d.predictedEnergyY}/5`
                                            : `${d.predictedY} sesiones 🍅`}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-amber-300 pt-0.5 border-t border-slate-800">
                                        Diagnóstico: {d.quadrantLabel}
                                      </div>
                                    </div>
                                  );
                                }
                                const trendItem = payload[0]?.payload;
                                if (trendItem && typeof trendItem.trendY === 'number') {
                                  return (
                                    <div className="rounded-xl bg-slate-900 text-white p-2 text-[11px] shadow-xl border border-slate-700 space-y-0.5">
                                      <div className="font-bold text-indigo-300">
                                        {scatterAxisOrientation === 'workload_x'
                                          ? `Carga: ${trendItem.rawX} sesiones Pomodoro (🍅)`
                                          : `Nivel ${trendItem.rawX}/5`}
                                      </div>
                                      <div className="font-mono-numbers">
                                        {scatterAxisOrientation === 'workload_x' ? (
                                          <>
                                            <div>
                                              Tendencia Ánimo: <strong>{trendItem.trendY}/5</strong>
                                            </div>
                                            {typeof trendItem.trendEnergyY === 'number' && (
                                              <div className="text-amber-300">
                                                Tendencia Energía: <strong>⚡{trendItem.trendEnergyY}/5</strong>
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <span>
                                            Predicción media: <strong>{trendItem.trendY} 🍅</strong>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                            <Line
                              data={regressionTrendLineData}
                              type="linear"
                              dataKey="trendY"
                              name={
                                scatterAxisOrientation === 'workload_x'
                                  ? 'Tendencia de Humor (OLS)'
                                  : 'Tendencia de Pomodoros (OLS)'
                              }
                              stroke="#7c3aed"
                              strokeWidth={2.5}
                              strokeDasharray="6 4"
                              dot={{ r: 2.5, fill: '#7c3aed' }}
                              activeDot={{ r: 4.5 }}
                            />
                            {scatterAxisOrientation === 'workload_x' && (
                              <Line
                                data={regressionTrendLineData}
                                type="linear"
                                dataKey="trendEnergyY"
                                name="Tendencia de Energía (⚡ OLS)"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                strokeDasharray="3 3"
                                dot={{ r: 2, fill: '#f59e0b' }}
                                activeDot={{ r: 4 }}
                              />
                            )}
                            <Scatter
                              name="Días (Carga vs Humor)"
                              data={scatterPlotData}
                              dataKey="y"
                              fill="#8b5cf6"
                              shape={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (typeof cx !== 'number' || typeof cy !== 'number') {
                                  return <g />;
                                }
                                const color = payload.hexColor || '#8b5cf6';
                                return (
                                  <g>
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r={10}
                                      fill={color}
                                      fillOpacity={0.18}
                                    />
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r={5.5}
                                      fill={color}
                                      stroke="#ffffff"
                                      strokeWidth={1.75}
                                    />
                                    {payload.shortDayName && (
                                      <text
                                        x={cx}
                                        y={cy - 9}
                                        textAnchor="middle"
                                        fill="#475569"
                                        fontSize={9}
                                        fontWeight={700}
                                      >
                                        {payload.shortDayName}
                                      </text>
                                    )}
                                  </g>
                                );
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Leyenda de Cuadrantes de Carga vs Humor */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>
                          {scatterAxisOrientation === 'workload_x' ? (
                            <>
                              Carga media:{' '}
                              <strong className="font-mono-numbers text-slate-700 dark:text-slate-200">
                                {correlationSummary.meanX} 🍅/día
                              </strong>{' '}
                              · Humor medio:{' '}
                              <strong className="font-mono-numbers text-slate-700 dark:text-slate-200">
                                {correlationSummary.meanY}/5
                              </strong>
                            </>
                          ) : (
                            <>
                              Humor medio:{' '}
                              <strong className="font-mono-numbers text-slate-700 dark:text-slate-200">
                                {correlationSummary.meanX}/5
                              </strong>{' '}
                              · Carga media:{' '}
                              <strong className="font-mono-numbers text-slate-700 dark:text-slate-200">
                                {correlationSummary.meanY} 🍅/día
                              </strong>
                            </>
                          )}
                        </span>
                        <span className="font-mono-numbers">
                          Pendiente Energía:{' '}
                          {correlationSummary.energySlope >= 0
                            ? `+${correlationSummary.energySlope}`
                            : correlationSummary.energySlope}{' '}
                          ⚡/🍅
                        </span>
                      </div>
                    </div>

                    {/* Columna Derecha (5 cols): Impacto Objetivo por Día de la Semana (Lun-Dom) o por Estado de Humor */}
                    <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 p-3 sm:p-3.5 flex flex-col justify-between space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                            <span>
                              {rightPanelBreakdownMode === 'weekly_days'
                                ? 'Impacto de Carga Semanal en el Humor (Lun–Dom)'
                                : 'Productividad según Estado de Humor'}
                            </span>
                          </h5>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {rightPanelBreakdownMode === 'weekly_days'
                              ? 'Identifica qué días de mayor carga Pomodoro afectan más tu estado de ánimo.'
                              : 'Promedio de sesiones completadas y enfoque en cada estado emocional.'}
                          </p>
                        </div>

                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                          <button
                            type="button"
                            onClick={() => setRightPanelBreakdownMode('weekly_days')}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                              rightPanelBreakdownMode === 'weekly_days'
                                ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Por Día (Lun–Dom)
                          </button>
                          <button
                            type="button"
                            onClick={() => setRightPanelBreakdownMode('mood_states')}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors cursor-pointer ${
                              rightPanelBreakdownMode === 'mood_states'
                                ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Por Humor
                          </button>
                        </div>
                      </div>

                      {rightPanelBreakdownMode === 'weekly_days' ? (
                        <div className="space-y-1.5 max-h-68 overflow-y-auto pr-0.5">
                          {weeklyWorkloadMoodBreakdown.map((dayItem) => {
                            const maxDayLoad = Math.max(
                              6,
                              ...weeklyWorkloadMoodBreakdown.map((d) => d.avgSessions)
                            );
                            const loadPct = Math.min(
                              100,
                              Math.round((dayItem.avgSessions / maxDayLoad) * 100)
                            );
                            const isMostImpacted =
                              correlationSummary.mostImpactedMoodDay?.dayOfWeek ===
                                dayItem.dayOfWeek && dayItem.daysRecorded > 0;

                            return (
                              <div
                                key={dayItem.dayOfWeek}
                                className={`p-2 rounded-xl border space-y-1 transition-all ${
                                  isMostImpacted
                                    ? 'bg-rose-50/50 dark:bg-rose-950/25 border-rose-200/80 dark:border-rose-800/70'
                                    : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm">{dayItem.emoji}</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                      {dayItem.fullDay}
                                    </span>
                                    <span className={`text-[10px] truncate ${dayItem.impactColor}`}>
                                      · {dayItem.impactTag}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 font-mono-numbers">
                                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                                      {dayItem.avgSessions} 🍅
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                      Ánimo {dayItem.daysRecorded > 0 ? `${dayItem.avgMood}/5` : '—'}
                                    </span>
                                  </div>
                                </div>

                                <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${loadPct}%`,
                                      backgroundColor: dayItem.hexColor,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {moodCategoryBreakdown.map((bucket) => {
                            const maxBarRef = Math.max(
                              6,
                              ...moodCategoryBreakdown.map((b) =>
                                Math.max(b.avgSessions, b.expectedSessions)
                              )
                            );
                            const barWidthPct = Math.min(
                              100,
                              Math.round((bucket.avgSessions / maxBarRef) * 100)
                            );

                            return (
                              <div
                                key={bucket.moodType}
                                className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm">{bucket.emoji}</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                      {bucket.label}
                                    </span>
                                    <span className="text-[10px] font-mono-numbers text-slate-400">
                                      ({bucket.daysCount}d)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 font-mono-numbers">
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                      {bucket.avgSessions} 🍅/día
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                      ({bucket.avgMinutes}m)
                                    </span>
                                  </div>
                                </div>

                                <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${barWidthPct}%`,
                                      backgroundColor: bucket.hexColor,
                                    }}
                                  />
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-numbers">
                                  <span>Tendencia esperada: {bucket.expectedSessions} 🍅</span>
                                  <span>Máximo alcanzado: {bucket.maxSessions} 🍅</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 2: GRÁFICO COMBINADO DE LÍNEA DE TIEMPO DIARIA */}
                {(correlationViewMode === 'both' || correlationViewMode === 'timeline') && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 p-3 sm:p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                          Evolución Temporal Diaria ({correlationRangeDays} días)
                        </h5>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Comparativa cronológica entre sesiones Pomodoro completadas (barras) y nivel de ánimo/energía (líneas).
                        </p>
                      </div>
                      <span className="text-[10px] font-mono-numbers text-slate-500 dark:text-slate-400">
                        Total período: <strong>{correlationSummary.totalPomodorosInPeriod} 🍅</strong> (
                        {Math.round((correlationSummary.totalMinutesInPeriod / 60) * 10) / 10}h)
                      </span>
                    </div>

                    <div className="h-52 sm:h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={moodPomodoroTimelineData}
                          margin={{ top: 10, right: 12, left: -16, bottom: 2 }}
                        >
                          <defs>
                            <linearGradient id="moodCorrelationAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#e2e8f0"
                            opacity={0.6}
                          />
                          <XAxis
                            dataKey="shortLabel"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="leftPomodoro"
                            orientation="left"
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: '#4f46e5' }}
                            axisLine={false}
                            tickLine={false}
                            label={{
                              value: 'Pomodoros',
                              angle: -90,
                              position: 'insideLeft',
                              style: { fontSize: 10, fill: '#4f46e5' },
                            }}
                          />
                          <YAxis
                            yAxisId="rightMood"
                            orientation="right"
                            domain={[1, 5]}
                            ticks={[1, 2, 3, 4, 5]}
                            tick={{ fontSize: 10, fill: '#8b5cf6' }}
                            axisLine={false}
                            tickLine={false}
                            label={{
                              value: 'Ánimo (1-5)',
                              angle: 90,
                              position: 'insideRight',
                              style: { fontSize: 10, fill: '#8b5cf6' },
                            }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const item = payload[0].payload;
                              return (
                                <div className="rounded-xl bg-slate-900 text-white p-2.5 text-[11px] shadow-xl border border-slate-700 space-y-1">
                                  <div className="font-bold flex items-center justify-between gap-3 border-b border-slate-700/80 pb-1">
                                    <span>{item.readableDate}</span>
                                    <span>{item.moodEmoji}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-violet-300">Estado de Ánimo:</span>
                                    <span className="font-bold font-mono-numbers">
                                      {item.hasMoodRecord
                                        ? `${item.moodLabel} (${item.moodScore}/5)`
                                        : 'Sin registro'}
                                    </span>
                                  </div>
                                  {item.hasMoodRecord && (
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-amber-300">Nivel de Energía:</span>
                                      <span className="font-bold font-mono-numbers">
                                        ⚡ {item.energyLevel}/5
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-indigo-300">Sesiones Pomodoro:</span>
                                    <span className="font-bold font-mono-numbers">
                                      🍅 {item.pomodoroSessions} ({item.pomodoroMinutes} min)
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-emerald-300">Hábitos cumplidos:</span>
                                    <span className="font-bold font-mono-numbers">
                                      ✓ {item.habitsCompleted}
                                    </span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                          />
                          <Bar
                            yAxisId="leftPomodoro"
                            dataKey="pomodoroSessions"
                            name="Sesiones Pomodoro (🍅)"
                            fill="#6366f1"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={26}
                          />
                          <Area
                            yAxisId="rightMood"
                            type="monotone"
                            dataKey="plotMoodScore"
                            name="Estado de Ánimo (1-5)"
                            stroke="#8b5cf6"
                            strokeWidth={2.5}
                            fill="url(#moodCorrelationAreaGrad)"
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
                              return (
                                <circle
                                  key={`dot-${payload.dateStr}`}
                                  cx={cx}
                                  cy={cy}
                                  r={payload.hasMoodRecord ? 4 : 2}
                                  fill={payload.hasMoodRecord ? '#7c3aed' : '#cbd5e1'}
                                  stroke="#ffffff"
                                  strokeWidth={1.5}
                                />
                              );
                            }}
                          />
                          <Line
                            yAxisId="rightMood"
                            type="monotone"
                            dataKey="energyLevel"
                            name="Nivel de Energía (⚡ 1-5)"
                            stroke="#f59e0b"
                            strokeWidth={1.75}
                            strokeDasharray="4 3"
                            connectNulls
                            dot={{ r: 2.5, fill: '#f59e0b' }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Diagnóstico Estadístico e Interpretación de Patrones de Productividad */}
                <div className="p-2.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/70 dark:border-violet-800/60 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {correlationSummary.insightMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Calendario de Calor Anual D3 desplegable dentro de HabitsTracker */}
            {showD3YearlyHeatmap && (
              <div className="pt-2">
                <MoodYearlyCalendar
                  preferences={preferences}
                  onUpdatePreferences={onUpdatePreferences}
                  compact
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
