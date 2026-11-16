import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Smile,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Trash2,
  X,
  Calendar,
  TrendingUp,
  Grid,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { MoodEntry, MoodType, StudyPreferences } from '../types';
import {
  getTodayLocalDateStr,
  formatReadableDate,
  getDayOfWeekFromDateStr,
  addDaysToDateStr,
} from '../utils/dateUtils';
import { MoodYearlyCalendar } from './MoodYearlyCalendar';

export const MOOD_OPTIONS_META: Record<
  MoodType,
  {
    emoji: string;
    label: string;
    shortLabel: string;
    score: number;
    category: 'positivo' | 'estable' | 'desgaste';
    badgeBg: string;
    activeBorder: string;
    cellBg: string;
    cellText: string;
    hexColor: string;
    studyTip: string;
  }
> = {
  excelente: {
    emoji: '🤩',
    label: 'Excelente / Euforia',
    shortLabel: 'Excelente',
    score: 5,
    category: 'positivo',
    badgeBg:
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    activeBorder:
      'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20',
    cellBg: 'bg-emerald-500 dark:bg-emerald-500 text-white border-emerald-600',
    cellText: 'text-emerald-700 dark:text-emerald-300',
    hexColor: '#10b981',
    studyTip:
      '¡Energía al máximo! Día ideal para abordar temas nuevos de dificultad Avanzada, retos Feynman o simulacros exigentes.',
  },
  en_flujo: {
    emoji: '🔥',
    label: 'En Flujo / Hiperfoco',
    shortLabel: 'En flujo',
    score: 5,
    category: 'positivo',
    badgeBg:
      'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    activeBorder:
      'border-teal-500 bg-teal-50/90 dark:bg-teal-950/60 text-teal-900 dark:text-teal-100 ring-2 ring-teal-500/20',
    cellBg: 'bg-teal-500 dark:bg-teal-500 text-white border-teal-600',
    cellText: 'text-teal-700 dark:text-teal-300',
    hexColor: '#14b8a6',
    studyTip:
      'Estás en estado de concentración profunda. Aprovecha ciclos largos (52/17 min) sin interrupciones para los temas más densos.',
  },
  motivado: {
    emoji: '🚀',
    label: 'Motivado / Productivo',
    shortLabel: 'Motivado',
    score: 4,
    category: 'positivo',
    badgeBg:
      'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    activeBorder:
      'border-blue-500 bg-blue-50/90 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20',
    cellBg: 'bg-blue-500 dark:bg-blue-500 text-white border-blue-600',
    cellText: 'text-blue-700 dark:text-blue-300',
    hexColor: '#3b82f6',
    studyTip:
      'Buen enfoque productivo. Aprovecha para avanzar páginas de temario, completar objetivos SMART y consolidar tus hábitos.',
  },
  inspirado: {
    emoji: '✨',
    label: 'Inspirado / Creativo',
    shortLabel: 'Inspirado',
    score: 4,
    category: 'positivo',
    badgeBg:
      'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    activeBorder:
      'border-violet-500 bg-violet-50/90 dark:bg-violet-950/60 text-violet-900 dark:text-violet-100 ring-2 ring-violet-500/20',
    cellBg: 'bg-violet-500 dark:bg-violet-500 text-white border-violet-600',
    cellText: 'text-violet-700 dark:text-violet-300',
    hexColor: '#8b5cf6',
    studyTip:
      'Mente clara y asociativa: momento perfecto para crear mapas mentales, sintetizar apuntes Cornell o explicar con analogías Feynman.',
  },
  tranquilo: {
    emoji: '🧘',
    label: 'Tranquilo / Sereno',
    shortLabel: 'Tranquilo',
    score: 4,
    category: 'estable',
    badgeBg:
      'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    activeBorder:
      'border-sky-500 bg-sky-50/90 dark:bg-sky-950/60 text-sky-900 dark:text-sky-100 ring-2 ring-sky-500/20',
    cellBg: 'bg-sky-500 dark:bg-sky-500 text-white border-sky-600',
    cellText: 'text-sky-700 dark:text-sky-300',
    hexColor: '#0ea5e9',
    studyTip:
      'Calma mental óptima para asimilar conceptos sin prisa, hacer lecturas comprensivas y repasar con buena retención.',
  },
  equilibrado: {
    emoji: '🙂',
    label: 'Equilibrado / Normal',
    shortLabel: 'Normal',
    score: 3,
    category: 'estable',
    badgeBg:
      'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    activeBorder:
      'border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/20',
    cellBg: 'bg-indigo-400 dark:bg-indigo-500 text-white border-indigo-500',
    cellText: 'text-indigo-700 dark:text-indigo-300',
    hexColor: '#6366f1',
    studyTip:
      'Ritmo estable. Combina estudio de dificultad Intermedia con tus repasos espaciados programados del día.',
  },
  distraido: {
    emoji: '🌀',
    label: 'Distraído / Disperso',
    shortLabel: 'Distraído',
    score: 2,
    category: 'desgaste',
    badgeBg:
      'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    activeBorder:
      'border-orange-500 bg-orange-50/90 dark:bg-orange-950/60 text-orange-900 dark:text-orange-100 ring-2 ring-orange-500/20',
    cellBg: 'bg-orange-400 dark:bg-orange-500 text-white border-orange-500',
    cellText: 'text-orange-700 dark:text-orange-300',
    hexColor: '#f97316',
    studyTip:
      'Si te cuesta concentrarte, usa bloques Pomodoro cortos (20–25 min), despeja el escritorio y empieza por cuestionarios dinámicos.',
  },
  cansado: {
    emoji: '😴',
    label: 'Cansado / Sin Energía',
    shortLabel: 'Cansado',
    score: 2,
    category: 'desgaste',
    badgeBg:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    activeBorder:
      'border-amber-500 bg-amber-50/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/20',
    cellBg: 'bg-amber-400 dark:bg-amber-500 text-slate-950 border-amber-500',
    cellText: 'text-amber-700 dark:text-amber-300',
    hexColor: '#f59e0b',
    studyTip:
      'Energía baja hoy: prioriza repasos ligeros, flashcards o bloques Pomodoro cortos (25 min) y cuida tu descanso.',
  },
  ansioso: {
    emoji: '😰',
    label: 'Ansioso / Nervioso',
    shortLabel: 'Ansioso',
    score: 2,
    category: 'desgaste',
    badgeBg:
      'bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800',
    activeBorder:
      'border-fuchsia-500 bg-fuchsia-50/90 dark:bg-fuchsia-950/60 text-fuchsia-900 dark:text-fuchsia-100 ring-2 ring-fuchsia-500/20',
    cellBg: 'bg-fuchsia-500 dark:bg-fuchsia-500 text-white border-fuchsia-600',
    cellText: 'text-fuchsia-700 dark:text-fuchsia-300',
    hexColor: '#d946ef',
    studyTip:
      'Respira hondo y céntrate solo en el siguiente micro-objetivo de 25 minutos. Tacharlo reducirá la incertidumbre.',
  },
  frustrado: {
    emoji: '😤',
    label: 'Frustrado / Bloqueado',
    shortLabel: 'Frustrado',
    score: 1,
    category: 'desgaste',
    badgeBg:
      'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    activeBorder:
      'border-red-500 bg-red-50/90 dark:bg-red-950/60 text-red-900 dark:text-red-100 ring-2 ring-red-500/20',
    cellBg: 'bg-red-500 dark:bg-red-500 text-white border-red-600',
    cellText: 'text-red-700 dark:text-red-300',
    hexColor: '#ef4444',
    studyTip:
      'Si un tema te bloquea, cambia de asignatura o usa el Reto Feynman con IA para desglosar el concepto con una analogía sencilla.',
  },
  desanimado: {
    emoji: '😔',
    label: 'Desanimado / Apático',
    shortLabel: 'Desanimado',
    score: 1,
    category: 'desgaste',
    badgeBg:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    activeBorder:
      'border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-2 ring-slate-500/20',
    cellBg: 'bg-slate-500 dark:bg-slate-600 text-white border-slate-600',
    cellText: 'text-slate-700 dark:text-slate-300',
    hexColor: '#64748b',
    studyTip:
      'No busques la perfección hoy: cumple una meta mínima de 15–20 minutos con un tema que te guste para recuperar inercia.',
  },
  estresado: {
    emoji: '🤯',
    label: 'Estresado / Saturado',
    shortLabel: 'Estresado',
    score: 1,
    category: 'desgaste',
    badgeBg:
      'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    activeBorder:
      'border-rose-500 bg-rose-50/90 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20',
    cellBg: 'bg-rose-500 dark:bg-rose-500 text-white border-rose-600',
    cellText: 'text-rose-700 dark:text-rose-300',
    hexColor: '#f43f5e',
    studyTip:
      'Divide las tareas en pasos pequeños, despeja la mente con un hábito activo y evita sobrecargar la tarde.',
  },
};

export const EMOTION_TAGS_CATALOG: Array<{ id: string; label: string; emoji: string }> = [
  { id: 'orgulloso', label: 'Orgulloso', emoji: '🏆' },
  { id: 'concentrado', label: 'Concentrado', emoji: '🎯' },
  { id: 'curioso', label: 'Curioso', emoji: '💡' },
  { id: 'en_paz', label: 'En paz', emoji: '🌿' },
  { id: 'confiado', label: 'Confiado', emoji: '💪' },
  { id: 'con_sueno', label: 'Con sueño', emoji: '☕' },
  { id: 'presion_examen', label: 'Presión examen', emoji: '📚' },
  { id: 'abrumado', label: 'Abrumado', emoji: '🌧️' },
  { id: 'agotado_mental', label: 'Agotamiento mental', emoji: '🪫' },
];

const DAY_SHORT_NAMES: Record<number, string> = {
  1: 'L',
  2: 'M',
  3: 'X',
  4: 'J',
  5: 'V',
  6: 'S',
  0: 'D',
};

const MONTH_NAMES = [
  { index: 0, short: 'Ene', full: 'Enero' },
  { index: 1, short: 'Feb', full: 'Febrero' },
  { index: 2, short: 'Mar', full: 'Marzo' },
  { index: 3, short: 'Abr', full: 'Abril' },
  { index: 4, short: 'May', full: 'Mayo' },
  { index: 5, short: 'Jun', full: 'Junio' },
  { index: 6, short: 'Jul', full: 'Julio' },
  { index: 7, short: 'Ago', full: 'Agosto' },
  { index: 8, short: 'Sep', full: 'Septiembre' },
  { index: 9, short: 'Oct', full: 'Octubre' },
  { index: 10, short: 'Nov', full: 'Noviembre' },
  { index: 11, short: 'Dic', full: 'Diciembre' },
];

const DAYS_HEADER = Array.from({ length: 31 }, (_, i) => i + 1);

function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

function mergeMoodListsByDate(listA: MoodEntry[], listB: MoodEntry[]): MoodEntry[] {
  const byDate = new Map<string, MoodEntry>();
  for (const item of [...listA, ...listB]) {
    if (!item || !item.date) continue;
    const existing = byDate.get(item.date);
    if (
      !existing ||
      (item.updatedAt && (!existing.updatedAt || item.updatedAt >= existing.updatedAt))
    ) {
      byDate.set(item.date, item);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export interface MoodTrackerProps {
  variant?: 'nav-top' | 'nav-sidebar' | 'inline' | 'annual-card';
  selectedDayStr?: string;
  preferences?: StudyPreferences;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  isExpandedExternal?: boolean;
  onToggleExpandExternal?: () => void;
}

export const MoodTracker: React.FC<MoodTrackerProps> = ({
  variant = 'inline',
  selectedDayStr,
  preferences,
  onUpdatePreferences,
  isExpandedExternal,
  onToggleExpandExternal,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const [internalActiveDateStr, setInternalActiveDateStr] = useState<string>(
    selectedDayStr || todayStr
  );
  const [isAnnualModalOpen, setIsAnnualModalOpen] = useState<boolean>(false);
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear()
  );
  const [annualCellDisplayMode, setAnnualCellDisplayMode] = useState<'color' | 'emoji'>('emoji');

  useEffect(() => {
    if (selectedDayStr) {
      setInternalActiveDateStr(selectedDayStr);
    }
  }, [selectedDayStr]);

  const activeDateStr = internalActiveDateStr || todayStr;

  const [isOpenInternal, setIsOpenInternal] = useState<boolean>(false);
  const isOpen =
    typeof isExpandedExternal === 'boolean' ? isExpandedExternal : isOpenInternal;

  const toggleOpen = () => {
    if (onToggleExpandExternal) {
      onToggleExpandExternal();
    } else {
      setIsOpenInternal((prev) => !prev);
    }
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside when used in top nav (unless annual modal is open)
  useEffect(() => {
    if (variant !== 'nav-top' || !isOpen || isAnnualModalOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setIsOpenInternal(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [variant, isOpen, isAnnualModalOpen]);

  const loadStoredMoods = (): MoodEntry[] => {
    const prefMoods = Array.isArray(preferences?.moodEntries)
      ? preferences!.moodEntries
      : [];
    let localMoods: MoodEntry[] = [];
    try {
      const raw = localStorage.getItem('studyflow_user_moods_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localMoods = parsed;
      }
    } catch {
      // ignore
    }
    return mergeMoodListsByDate(prefMoods, localMoods);
  };

  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>(loadStoredMoods);
  const [justSavedToast, setJustSavedToast] = useState<boolean>(false);

  // Keep synced if preferences.moodEntries updates from IndexedDB or Cloud
  useEffect(() => {
    if (preferences?.moodEntries && preferences.moodEntries.length > 0) {
      setMoodEntries((prev) => {
        const merged = mergeMoodListsByDate(prev, preferences.moodEntries || []);
        try {
          localStorage.setItem('studyflow_user_moods_v1', JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      });
    }
  }, [preferences?.moodEntries]);

  // Sync across components via custom event
  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem('studyflow_user_moods_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setMoodEntries((prev) => mergeMoodListsByDate(prev, parsed));
          }
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('studyflow-moods-updated', handleSync);
    return () => window.removeEventListener('studyflow-moods-updated', handleSync);
  }, []);

  const persistMoodEntries = (nextMoods: MoodEntry[]) => {
    const sorted = [...nextMoods].sort((a, b) => b.date.localeCompare(a.date));
    setMoodEntries(sorted);
    try {
      localStorage.setItem('studyflow_user_moods_v1', JSON.stringify(sorted));
      window.dispatchEvent(new CustomEvent('studyflow-moods-updated'));
    } catch {
      // ignore
    }
    if (preferences && onUpdatePreferences) {
      onUpdatePreferences({
        ...preferences,
        moodEntries: sorted,
      });
    }
  };

  const moodByDateMap = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    for (const m of moodEntries) {
      if (m && m.date) map.set(m.date, m);
    }
    return map;
  }, [moodEntries]);

  const currentDayEntry = useMemo(
    () => moodByDateMap.get(activeDateStr) || null,
    [moodByDateMap, activeDateStr]
  );

  const todayEntry = useMemo(
    () => moodByDateMap.get(todayStr) || null,
    [moodByDateMap, todayStr]
  );

  const [selectedMood, setSelectedMood] = useState<MoodType>(
    currentDayEntry?.mood || 'motivado'
  );
  const [selectedEnergy, setSelectedEnergy] = useState<number>(
    currentDayEntry?.energyLevel || 4
  );
  const [selectedEmotionTags, setSelectedEmotionTags] = useState<string[]>(
    currentDayEntry?.emotionTags || []
  );
  const [moodNote, setMoodNote] = useState<string>(currentDayEntry?.note || '');
  const [moodCategoryFilter, setMoodCategoryFilter] = useState<
    'all' | 'positivo' | 'estable' | 'desgaste'
  >('all');

  useEffect(() => {
    const existing = moodByDateMap.get(activeDateStr);
    if (existing) {
      setSelectedMood(existing.mood);
      setSelectedEnergy(existing.energyLevel);
      setSelectedEmotionTags(existing.emotionTags || []);
      setMoodNote(existing.note || '');
    } else {
      setSelectedMood('motivado');
      setSelectedEnergy(4);
      setSelectedEmotionTags([]);
      setMoodNote('');
    }
  }, [activeDateStr, moodByDateMap]);

  const last7Dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dStr = addDaysToDateStr(todayStr, i - 6);
      const dow = getDayOfWeekFromDateStr(dStr);
      return {
        dateStr: dStr,
        dayLabel: DAY_SHORT_NAMES[dow] || 'D',
        dayNum: dStr.slice(8, 10),
      };
    });
  }, [todayStr]);

  // Datos y métricas para la pequeña gráfica de tendencia semanal del ánimo
  const weeklyTrendStats = useMemo(() => {
    const points = last7Dates.map((dObj) => {
      const entry = moodByDateMap.get(dObj.dateStr);
      const meta = entry ? MOOD_OPTIONS_META[entry.mood] : null;
      return {
        dateStr: dObj.dateStr,
        label: `${dObj.dayLabel} ${dObj.dayNum}`,
        shortLabel: dObj.dayLabel,
        score: meta ? meta.score : null,
        plotScore: meta ? meta.score : 3,
        hasRecord: Boolean(entry),
        emoji: meta ? meta.emoji : '·',
        moodLabel: meta ? meta.label : 'Sin registro',
        energy: entry ? entry.energyLevel : null,
      };
    });

    const recorded = points.filter((p) => p.hasRecord && p.score !== null);
    const avgScore =
      recorded.length > 0
        ? Math.round(
            (recorded.reduce((sum, p) => sum + (p.score || 0), 0) / recorded.length) * 10
          ) / 10
        : 0;

    let trendLabel = 'Estable';
    let trendColor = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60';
    if (recorded.length >= 2) {
      const firstHalf = recorded.slice(0, Math.ceil(recorded.length / 2));
      const secondHalf = recorded.slice(Math.floor(recorded.length / 2));
      const avgFirst =
        firstHalf.reduce((s, p) => s + (p.score || 0), 0) / Math.max(1, firstHalf.length);
      const avgSecond =
        secondHalf.reduce((s, p) => s + (p.score || 0), 0) / Math.max(1, secondHalf.length);
      if (avgSecond - avgFirst >= 0.4) {
        trendLabel = '↗ En ascenso';
        trendColor = 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60';
      } else if (avgFirst - avgSecond >= 0.4) {
        trendLabel = '↘ Descanso sugerido';
        trendColor = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60';
      }
    }

    return {
      points,
      recordedCount: recorded.length,
      avgScore,
      trendLabel,
      trendColor,
    };
  }, [last7Dates, moodByDateMap]);

  // Estadísticas anuales para la Tablita Anual
  const annualStats = useMemo(() => {
    const yearPrefix = `${selectedYear}-`;
    const yearEntries = moodEntries.filter((m) => m.date.startsWith(yearPrefix));
    const countsByMood = (Object.keys(MOOD_OPTIONS_META) as MoodType[]).reduce(
      (acc, key) => {
        acc[key] = 0;
        return acc;
      },
      {} as Record<MoodType, number>
    );
    let totalScore = 0;
    let totalEnergy = 0;

    for (const entry of yearEntries) {
      if (countsByMood[entry.mood] !== undefined) {
        countsByMood[entry.mood] += 1;
      }
      totalScore += MOOD_OPTIONS_META[entry.mood]?.score || 3;
      totalEnergy += entry.energyLevel || 3;
    }

    const totalDays = yearEntries.length;
    const avgMoodScore =
      totalDays > 0 ? Number((totalScore / totalDays).toFixed(1)) : 0;
    const avgEnergy =
      totalDays > 0 ? Number((totalEnergy / totalDays).toFixed(1)) : 0;

    return {
      totalDays,
      countsByMood,
      avgMoodScore,
      avgEnergy,
    };
  }, [moodEntries, selectedYear]);

  const handleQuickSelectMood = (mood: MoodType, targetDateOverride?: string) => {
    const targetDate = targetDateOverride || activeDateStr;
    const existingForTarget = moodByDateMap.get(targetDate);
    setSelectedMood(mood);
    const updatedEntry: MoodEntry = {
      id: existingForTarget?.id || `mood-${Date.now()}`,
      date: targetDate,
      mood,
      energyLevel: existingForTarget ? existingForTarget.energyLevel : selectedEnergy,
      emotionTags:
        targetDate === activeDateStr
          ? selectedEmotionTags
          : existingForTarget?.emotionTags || [],
      note: moodNote.trim() || existingForTarget?.note || undefined,
      updatedAt: new Date().toISOString(),
    };
    const filtered = moodEntries.filter((m) => m.date !== targetDate);
    persistMoodEntries([updatedEntry, ...filtered]);
    setJustSavedToast(true);
    setTimeout(() => setJustSavedToast(false), 2000);
  };

  const handleToggleEmotionTag = (tagLabel: string) => {
    const exists = selectedEmotionTags.includes(tagLabel);
    const nextTags = exists
      ? selectedEmotionTags.filter((t) => t !== tagLabel)
      : [...selectedEmotionTags, tagLabel];
    setSelectedEmotionTags(nextTags);

    const updatedEntry: MoodEntry = {
      id: currentDayEntry?.id || `mood-${Date.now()}`,
      date: activeDateStr,
      mood: selectedMood,
      energyLevel: selectedEnergy,
      emotionTags: nextTags,
      note: moodNote.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    const filtered = moodEntries.filter((m) => m.date !== activeDateStr);
    persistMoodEntries([updatedEntry, ...filtered]);
    setJustSavedToast(true);
    setTimeout(() => setJustSavedToast(false), 2000);
  };

  const handleSaveMoodForm = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedEntry: MoodEntry = {
      id: currentDayEntry?.id || `mood-${Date.now()}`,
      date: activeDateStr,
      mood: selectedMood,
      energyLevel: selectedEnergy,
      emotionTags: selectedEmotionTags,
      note: moodNote.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    const filtered = moodEntries.filter((m) => m.date !== activeDateStr);
    persistMoodEntries([updatedEntry, ...filtered]);
    setJustSavedToast(true);
    setTimeout(() => setJustSavedToast(false), 2000);
  };

  const handleDeleteDayMood = (dateStr: string) => {
    persistMoodEntries(moodEntries.filter((m) => m.date !== dateStr));
  };

  // Renderizado de la Tablita Anual (12 meses × 31 días)
  const renderAnnualMoodTable = (isModalView = false) => (
    <div className="space-y-4">
      {/* Controles Superiores de la Tabla Anual */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Tabla Anual de Estados de Ánimo ({selectedYear})
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Haz clic en cualquier día del año para consultar, registrar o editar tu estado de ánimo y nivel de energía.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de modo de celda: Emoji vs Color */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setAnnualCellDisplayMode('emoji')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                annualCellDisplayMode === 'emoji'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Emojis + Color
            </button>
            <button
              type="button"
              onClick={() => setAnnualCellDisplayMode('color')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                annualCellDisplayMode === 'color'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Mapa de Calor
            </button>
          </div>

          {/* Selector de Año */}
          <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y - 1)}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded cursor-pointer"
              title="Año anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold font-mono-numbers text-slate-800 dark:text-slate-100 px-1.5">
              {selectedYear}
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y + 1)}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded cursor-pointer"
              title="Año siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isModalView && (
            <button
              type="button"
              onClick={() => setIsAnnualModalOpen(false)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="Cerrar tabla anual"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Resumen Anual y Leyenda de Estados */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-2 font-mono-numbers">
          <span>
            Días registrados en {selectedYear}:{' '}
            <strong className="text-slate-900 dark:text-white">{annualStats.totalDays}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Media ánimo:{' '}
            <strong className="text-violet-600 dark:text-violet-400">
              {annualStats.avgMoodScore}/5
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Media energía:{' '}
            <strong className="text-amber-600 dark:text-amber-400">
              ⚡{annualStats.avgEnergy}/5
            </strong>
          </span>
        </div>

        {/* Leyenda con conteo por mood */}
        <div className="flex flex-wrap items-center gap-3">
          {(Object.keys(MOOD_OPTIONS_META) as MoodType[]).map((mKey) => {
            const meta = MOOD_OPTIONS_META[mKey];
            const count = annualStats.countsByMood[mKey] || 0;
            return (
              <div key={mKey} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="w-3 h-3 rounded-xs inline-block shrink-0"
                  style={{ backgroundColor: meta.hexColor }}
                />
                <span>
                  {meta.emoji} {meta.shortLabel}:
                </span>
                <strong className="font-mono-numbers text-slate-900 dark:text-white">
                  {count}d
                </strong>
              </div>
            );
          })}
        </div>
      </div>

      {/* Matriz / Tablita Anual: 12 Meses (Filas) × 31 Días (Columnas) */}
      <div className="overflow-x-auto pb-1">
        <table className="w-full border-collapse select-none min-w-[760px]">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1 pr-2 w-12">
                Mes
              </th>
              {DAYS_HEADER.map((dayNum) => (
                <th
                  key={dayNum}
                  className="text-center text-[10px] font-mono-numbers font-semibold text-slate-400 dark:text-slate-500 pb-1 px-0.5"
                >
                  {dayNum}
                </th>
              ))}
              <th className="text-right text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1 pl-2 w-14">
                Media
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {MONTH_NAMES.map((mObj) => {
              const daysInMonth = getDaysInMonth(selectedYear, mObj.index);
              const monthNumStr = String(mObj.index + 1).padStart(2, '0');
              let monthScoreSum = 0;
              let monthRecordedCount = 0;

              return (
                <tr key={mObj.index} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="text-[11px] font-bold text-slate-700 dark:text-slate-300 py-1 pr-2 whitespace-nowrap">
                    {mObj.short}
                  </td>
                  {DAYS_HEADER.map((dayNum) => {
                    const isValidDay = dayNum <= daysInMonth;
                    if (!isValidDay) {
                      return (
                        <td key={dayNum} className="p-0.5 text-center">
                          <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 mx-auto rounded-xs bg-slate-100/40 dark:bg-slate-900/30 opacity-30" />
                        </td>
                      );
                    }

                    const dateStr = `${selectedYear}-${monthNumStr}-${String(dayNum).padStart(
                      2,
                      '0'
                    )}`;
                    const entry = moodByDateMap.get(dateStr);
                    const meta = entry ? MOOD_OPTIONS_META[entry.mood] : null;
                    if (meta) {
                      monthScoreSum += meta.score;
                      monthRecordedCount += 1;
                    }
                    const isSelectedCell = dateStr === activeDateStr;
                    const isTodayCell = dateStr === todayStr;

                    return (
                      <td key={dayNum} className="p-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => setInternalActiveDateStr(dateStr)}
                          title={`${dayNum} ${mObj.full} ${selectedYear}: ${
                            entry && meta
                              ? `${meta.emoji} ${meta.label} · Energía ⚡${entry.energyLevel}/5${
                                  entry.note ? ` · "${entry.note}"` : ''
                                }`
                              : 'Sin registro (Haz clic para registrar)'
                          }`}
                          className={`w-5 h-5 sm:w-5.5 sm:h-5.5 mx-auto rounded-xs flex items-center justify-center text-[10px] transition-transform cursor-pointer border ${
                            entry && meta
                              ? meta.cellBg
                              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200/70 dark:border-slate-700/70 hover:border-violet-400 text-slate-300 dark:text-slate-600'
                          } ${
                            isSelectedCell
                              ? 'ring-2 ring-violet-600 dark:ring-violet-400 scale-110 z-10'
                              : isTodayCell
                              ? 'ring-1 ring-slate-900 dark:ring-white'
                              : 'hover:scale-110'
                          }`}
                        >
                          {entry && meta
                            ? annualCellDisplayMode === 'emoji'
                              ? meta.emoji
                              : ''
                            : ''}
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-right text-[11px] font-mono-numbers font-semibold text-slate-600 dark:text-slate-400 py-1 pl-2 whitespace-nowrap">
                    {monthRecordedCount > 0
                      ? `${(monthScoreSum / monthRecordedCount).toFixed(1)}/5`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Editor Rápido del Día Seleccionado en la Tabla Anual */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Día seleccionado:{' '}
            <span className="text-violet-600 dark:text-violet-400">
              {activeDateStr === todayStr ? `Hoy (${activeDateStr})` : formatReadableDate(activeDateStr)}
            </span>
          </span>
          <input
            type="date"
            value={activeDateStr}
            onChange={(e) => {
              if (e.target.value) {
                setInternalActiveDateStr(e.target.value);
                const yr = parseInt(e.target.value.slice(0, 4), 10);
                if (!Number.isNaN(yr)) setSelectedYear(yr);
              }
            }}
            className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono-numbers text-slate-700 dark:text-slate-200"
          />
          {currentDayEntry && (
            <button
              type="button"
              onClick={() => handleDeleteDayMood(activeDateStr)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Borrar día</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(MOOD_OPTIONS_META) as MoodType[]).map((mKey) => {
            const meta = MOOD_OPTIONS_META[mKey];
            const isActive = currentDayEntry?.mood === mKey;
            return (
              <button
                key={mKey}
                type="button"
                onClick={() => handleQuickSelectMood(mKey, activeDateStr)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? meta.activeBorder
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-violet-300'
                }`}
              >
                <span>{meta.emoji}</span>
                <span>{meta.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendario de Calor Anual D3 (Heatmap de Consistencia 53 semanas × 7 días) */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <MoodYearlyCalendar
          preferences={preferences}
          onUpdatePreferences={onUpdatePreferences}
          selectedDateStr={activeDateStr}
          onSelectDate={(dStr) => setInternalActiveDateStr(dStr)}
          compact
        />
      </div>
    </div>
  );

  // Render inner content (shared across dropdown, sidebar collapsible, and inline panel)
  const renderTrackerContent = (compact = false) => (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Smile className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
            Estado de Ánimo ·{' '}
            {activeDateStr === todayStr ? 'Hoy' : formatReadableDate(activeDateStr)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {justSavedToast && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
              ✓ Guardado
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsAnnualModalOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-violet-700 dark:text-violet-300 text-[10px] font-bold transition-colors cursor-pointer"
            title="Abrir Tabla Anual de Estados de Ánimo (365 días)"
          >
            <Grid className="w-3 h-3" />
            <span>Tabla Anual</span>
          </button>
          {currentDayEntry && (
            <button
              type="button"
              onClick={() => handleDeleteDayMood(activeDateStr)}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
              title="Borrar registro del día"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {(variant === 'nav-top' || variant === 'nav-sidebar') && (
            <button
              type="button"
              onClick={toggleOpen}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              title="Cerrar Mood Tracker"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selector de fecha para registrar cualquier día pasado o actual */}
      <div className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Fecha de registro:</span>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={activeDateStr}
            onChange={(e) => {
              if (e.target.value) setInternalActiveDateStr(e.target.value);
            }}
            className="bg-transparent text-[11px] font-mono-numbers font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
          />
          {activeDateStr !== todayStr && (
            <button
              type="button"
              onClick={() => setInternalActiveDateStr(todayStr)}
              className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
            >
              Ir a Hoy
            </button>
          )}
        </div>
      </div>

      {/* Filtros por categoría emocional + 12 Botones de Estado de Ánimo (Guardado en 1 clic) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Elige tu emoción principal ({Object.keys(MOOD_OPTIONS_META).length} estados):
          </span>
          <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'positivo', label: '✨ Positivos' },
                { id: 'estable', label: '🧘 Calma' },
                { id: 'desgaste', label: '🌧️ Desgaste' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setMoodCategoryFilter(cat.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                  moodCategoryFilter === cat.id
                    ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`grid gap-1.5 ${
            compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'
          }`}
        >
          {(Object.keys(MOOD_OPTIONS_META) as MoodType[])
            .filter(
              (mKey) =>
                moodCategoryFilter === 'all' ||
                MOOD_OPTIONS_META[mKey].category === moodCategoryFilter
            )
            .map((mKey) => {
              const meta = MOOD_OPTIONS_META[mKey];
              const isSelected = selectedMood === mKey && !!currentDayEntry;
              const isDraftSelected = selectedMood === mKey;
              return (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => handleQuickSelectMood(mKey)}
                  className={`py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                    isSelected || isDraftSelected
                      ? meta.activeBorder
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300'
                  }`}
                  title={`Registrar ánimo: ${meta.label}`}
                >
                  <span className={compact ? 'text-base' : 'text-lg'}>{meta.emoji}</span>
                  <span className="text-[10px] font-bold leading-tight truncate max-w-full">
                    {meta.shortLabel}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Matices / Emociones secundarias combinables */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Matices emocionales del día (opcional):
          </span>
          {selectedEmotionTags.length > 0 && (
            <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
              {selectedEmotionTags.length} seleccionados
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {EMOTION_TAGS_CATALOG.map((tag) => {
            const isTagActive = selectedEmotionTags.includes(tag.label);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleToggleEmotionTag(tag.label)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                  isTagActive
                    ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-300'
                }`}
              >
                <span>{tag.emoji}</span>
                <span>{tag.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Energy Level + Note Form */}
      <form onSubmit={handleSaveMoodForm} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>Energía ({selectedEnergy}/5)</span>
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setSelectedEnergy(lvl);
                  const updatedEntry: MoodEntry = {
                    id: currentDayEntry?.id || `mood-${Date.now()}`,
                    date: activeDateStr,
                    mood: selectedMood,
                    energyLevel: lvl,
                    emotionTags: selectedEmotionTags,
                    note: moodNote.trim() || undefined,
                    updatedAt: new Date().toISOString(),
                  };
                  const filtered = moodEntries.filter((m) => m.date !== activeDateStr);
                  persistMoodEntries([updatedEntry, ...filtered]);
                }}
                className={`w-6 h-6 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                  lvl <= selectedEnergy
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={moodNote}
            onChange={(e) => setMoodNote(e.target.value)}
            placeholder="Nota del día (opcional)..."
            className="flex-1 h-8 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            className="h-8 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer shrink-0"
          >
            Guardar
          </button>
        </div>
      </form>

      {/* Gráfica de Tendencia Semanal del Ánimo + Histórico de 7 días */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-violet-500" />
            <span>Tendencia Semanal ({moodEntries.length} días guardados)</span>
          </span>
          <div className="flex items-center gap-1.5">
            {weeklyTrendStats.recordedCount > 0 && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${weeklyTrendStats.trendColor}`}
              >
                {weeklyTrendStats.trendLabel} · {weeklyTrendStats.avgScore}/5
              </span>
            )}
          </div>
        </div>

        {/* Mini Gráfica de Área / Línea con Recharts */}
        <div className="h-24 w-full rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 px-1.5 pt-2 pb-0.5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={weeklyTrendStats.points}
              margin={{ top: 6, right: 8, left: -28, bottom: 0 }}
            >
              <defs>
                <linearGradient id="moodTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 3, 5]}
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const pt = payload[0].payload;
                  return (
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] shadow-lg border border-slate-700">
                      <div className="font-bold">
                        {pt.label} · {pt.emoji} {pt.moodLabel}
                      </div>
                      {pt.hasRecord && (
                        <div className="text-violet-300 font-mono-numbers">
                          Ánimo: {pt.score}/5 · Energía: ⚡{pt.energy}/5
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="plotScore"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#moodTrendGrad)"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (typeof cx !== 'number' || typeof cy !== 'number') return <g />;
                  return (
                    <circle
                      key={payload.dateStr}
                      cx={cx}
                      cy={cy}
                      r={payload.hasRecord ? 3.5 : 2}
                      fill={payload.hasRecord ? '#7c3aed' : '#cbd5e1'}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {last7Dates.map((dObj) => {
            const entry = moodByDateMap.get(dObj.dateStr);
            const isSelected = dObj.dateStr === activeDateStr;
            return (
              <button
                key={dObj.dateStr}
                type="button"
                onClick={() => setInternalActiveDateStr(dObj.dateStr)}
                className={`p-1.5 rounded-xl border text-center flex flex-col items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-950/50'
                    : 'border-slate-200/70 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-violet-300'
                }`}
                title={`${dObj.dayLabel} ${dObj.dayNum}: ${
                  entry ? `${MOOD_OPTIONS_META[entry.mood].label} (⚡${entry.energyLevel}/5)` : 'Sin registro'
                }`}
              >
                <span className="text-[9px] font-bold text-slate-500">{dObj.dayLabel}</span>
                <span className="text-sm my-0.5">
                  {entry ? MOOD_OPTIONS_META[entry.mood].emoji : '·'}
                </span>
                <span className="text-[9px] font-mono-numbers font-bold text-amber-600 dark:text-amber-400">
                  {entry ? `⚡${entry.energyLevel}` : dObj.dayNum}
                </span>
              </button>
            );
          })}
        </div>

        {/* Botón destacado para abrir la Tablita Anual Completa */}
        <button
          type="button"
          onClick={() => setIsAnnualModalOpen(true)}
          className="w-full py-2 px-3 rounded-xl bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/60 border border-violet-200/80 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Ver Tabla Anual de Moods ({selectedYear})</span>
        </button>
      </div>

      {/* Study Tip */}
      <div className="p-2 rounded-xl bg-violet-50/60 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/60 flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
          {MOOD_OPTIONS_META[selectedMood].studyTip}
        </p>
      </div>
    </div>
  );

  const annualModalPortal =
    isAnnualModalOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-auto max-h-[92vh] overflow-y-auto">
              {renderAnnualMoodTable(true)}
            </div>
          </div>,
          document.body
        )
      : null;

  // VARIANT 4: Direct Annual Card (for Statistics or Dashboard)
  if (variant === 'annual-card') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        {renderAnnualMoodTable(false)}
      </div>
    );
  }

  // VARIANT 1: Top Navigation Bar Dropdown Button
  if (variant === 'nav-top') {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={toggleOpen}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            todayEntry
              ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Mood Tracker: Registrar estado de ánimo y ver tabla anual"
        >
          <span className="text-sm">
            {todayEntry ? MOOD_OPTIONS_META[todayEntry.mood].emoji : '😊'}
          </span>
          <span className="hidden lg:inline text-[11px]">
            {todayEntry ? MOOD_OPTIONS_META[todayEntry.mood].shortLabel : 'Ánimo'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-92 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in duration-150">
            {renderTrackerContent(true)}
          </div>
        )}
        {annualModalPortal}
      </div>
    );
  }

  // VARIANT 2: Sidebar Collapsible Section
  if (variant === 'nav-sidebar') {
    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 overflow-hidden">
        <button
          type="button"
          onClick={toggleOpen}
          className="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-sm shrink-0">
              {todayEntry ? MOOD_OPTIONS_META[todayEntry.mood].emoji : '😊'}
            </span>
            <span className="truncate">Mood Tracker</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {todayEntry ? (
              <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                {MOOD_OPTIONS_META[todayEntry.mood].shortLabel} ⚡{todayEntry.energyLevel}
              </span>
            ) : (
              <span className="text-[10px] text-violet-600 dark:text-violet-400">Hoy</span>
            )}
            {isOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </span>
        </button>

        {isOpen && (
          <div className="p-3 border-t border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900">
            {renderTrackerContent(true)}
          </div>
        )}
        {annualModalPortal}
      </div>
    );
  }

  // VARIANT 3: Inline Panel (used inside Plan y Repasos or General View)
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
      {renderTrackerContent(false)}
      {annualModalPortal}
    </div>
  );
};
