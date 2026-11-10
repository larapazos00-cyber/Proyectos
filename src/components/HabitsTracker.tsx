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
} from 'lucide-react';
import {
  HabitItem,
  HabitCategory,
  HabitPreferredPeriod,
  StudyPreferences,
  ScheduledStudySession,
  WeeklyObligation,
  BlockedTimeEvent,
} from '../types';
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

  const toggleExpand = () => {
    if (onToggleExpandExternal) {
      onToggleExpandExternal();
    } else {
      setIsExpandedInternal((prev) => !prev);
    }
  };

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
        </div>
      )}
    </div>
  );
};
