import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Smile,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Trash2,
  X,
  Calendar,
  TrendingUp,
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

export const MOOD_OPTIONS_META: Record<
  MoodType,
  {
    emoji: string;
    label: string;
    shortLabel: string;
    score: number;
    badgeBg: string;
    activeBorder: string;
    studyTip: string;
  }
> = {
  excelente: {
    emoji: '🤩',
    label: 'Excelente',
    shortLabel: 'Excelente',
    score: 5,
    badgeBg:
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    activeBorder:
      'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20',
    studyTip:
      '¡Energía al máximo! Día ideal para abordar temas nuevos de dificultad Alta o simulacros exigentes.',
  },
  motivado: {
    emoji: '🚀',
    label: 'Motivado',
    shortLabel: 'Motivado',
    score: 4,
    badgeBg:
      'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    activeBorder:
      'border-blue-500 bg-blue-50/90 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20',
    studyTip:
      'Buen enfoque productivo. Aprovecha para avanzar páginas de temario y consolidar tus hábitos.',
  },
  equilibrado: {
    emoji: '🙂',
    label: 'Equilibrado',
    shortLabel: 'Normal',
    score: 3,
    badgeBg:
      'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    activeBorder:
      'border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/20',
    studyTip:
      'Ritmo estable. Combina estudio de dificultad Media con tus repasos espaciados programados.',
  },
  cansado: {
    emoji: '😴',
    label: 'Cansado',
    shortLabel: 'Cansado',
    score: 2,
    badgeBg:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    activeBorder:
      'border-amber-500 bg-amber-50/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/20',
    studyTip:
      'Energía baja hoy: prioriza repasos ligeros, flashcards o bloques Pomodoro cortos (25 min) y cuida tu descanso.',
  },
  estresado: {
    emoji: '🤯',
    label: 'Estresado',
    shortLabel: 'Estresado',
    score: 1,
    badgeBg:
      'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    activeBorder:
      'border-rose-500 bg-rose-50/90 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20',
    studyTip:
      'Divide las tareas en pasos pequeños, despeja la mente con un hábito activo y evita sobrecargar la tarde.',
  },
};

const DAY_SHORT_NAMES: Record<number, string> = {
  1: 'L',
  2: 'M',
  3: 'X',
  4: 'J',
  5: 'V',
  6: 'S',
  0: 'D',
};

export interface MoodTrackerProps {
  variant?: 'nav-top' | 'nav-sidebar' | 'inline';
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

  // Close dropdown on click outside when used in top nav
  useEffect(() => {
    if (variant !== 'nav-top' || !isOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setIsOpenInternal(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [variant, isOpen]);

  const loadStoredMoods = (): MoodEntry[] => {
    if (preferences?.moodEntries && preferences.moodEntries.length > 0) {
      return preferences.moodEntries;
    }
    try {
      const raw = localStorage.getItem('studyflow_user_moods_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  };

  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>(loadStoredMoods);
  const [justSavedToast, setJustSavedToast] = useState<boolean>(false);

  // Sync across components via custom event
  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem('studyflow_user_moods_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setMoodEntries(parsed);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('studyflow-moods-updated', handleSync);
    return () => window.removeEventListener('studyflow-moods-updated', handleSync);
  }, []);

  const persistMoodEntries = (nextMoods: MoodEntry[]) => {
    setMoodEntries(nextMoods);
    try {
      localStorage.setItem('studyflow_user_moods_v1', JSON.stringify(nextMoods));
      window.dispatchEvent(new CustomEvent('studyflow-moods-updated'));
    } catch {
      // ignore
    }
    if (preferences && onUpdatePreferences) {
      onUpdatePreferences({
        ...preferences,
        moodEntries: nextMoods,
      });
    }
  };

  const currentDayEntry = useMemo(
    () => moodEntries.find((m) => m.date === activeDateStr) || null,
    [moodEntries, activeDateStr]
  );

  const todayEntry = useMemo(
    () => moodEntries.find((m) => m.date === todayStr) || null,
    [moodEntries, todayStr]
  );

  const [selectedMood, setSelectedMood] = useState<MoodType>(
    currentDayEntry?.mood || 'motivado'
  );
  const [selectedEnergy, setSelectedEnergy] = useState<number>(
    currentDayEntry?.energyLevel || 4
  );
  const [moodNote, setMoodNote] = useState<string>(currentDayEntry?.note || '');

  useEffect(() => {
    const existing = moodEntries.find((m) => m.date === activeDateStr);
    if (existing) {
      setSelectedMood(existing.mood);
      setSelectedEnergy(existing.energyLevel);
      setMoodNote(existing.note || '');
    } else {
      setSelectedMood('motivado');
      setSelectedEnergy(4);
      setMoodNote('');
    }
  }, [activeDateStr, moodEntries]);

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
      const entry = moodEntries.find((m) => m.date === dObj.dateStr);
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
  }, [last7Dates, moodEntries]);

  const handleQuickSelectMood = (mood: MoodType) => {
    setSelectedMood(mood);
    const updatedEntry: MoodEntry = {
      id: currentDayEntry?.id || `mood-${Date.now()}`,
      date: activeDateStr,
      mood,
      energyLevel: selectedEnergy,
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

  // Render inner content (shared across dropdown, sidebar collapsible, and inline panel)
  const renderTrackerContent = (compact = false) => (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Smile className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
            Estado de Ánimo ·{' '}
            {activeDateStr === todayStr ? 'Hoy' : formatReadableDate(activeDateStr)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {justSavedToast && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
              ✓ Guardado
            </span>
          )}
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
          <button
            type="button"
            onClick={toggleOpen}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            title="Cerrar Mood Tracker"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 5 Emoji Mood Buttons (1-click auto-saves!) */}
      <div className="grid grid-cols-5 gap-1.5">
        {(Object.keys(MOOD_OPTIONS_META) as MoodType[]).map((mKey) => {
          const meta = MOOD_OPTIONS_META[mKey];
          const isSelected = selectedMood === mKey && !!currentDayEntry;
          const isDraftSelected = selectedMood === mKey;
          return (
            <button
              key={mKey}
              type="button"
              onClick={() => handleQuickSelectMood(mKey)}
              className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
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
            <span>Tendencia Semanal del Ánimo</span>
          </span>
          <div className="flex items-center gap-1.5">
            {weeklyTrendStats.recordedCount > 0 && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${weeklyTrendStats.trendColor}`}
              >
                {weeklyTrendStats.trendLabel} · {weeklyTrendStats.avgScore}/5
              </span>
            )}
            {activeDateStr !== todayStr && (
              <button
                type="button"
                onClick={() => setInternalActiveDateStr(todayStr)}
                className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
              >
                Hoy
              </button>
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
            const entry = moodEntries.find((m) => m.date === dObj.dateStr);
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
          title="Mood Tracker: Registrar estado de ánimo e histórico semanal"
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
          <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in duration-150">
            {renderTrackerContent(true)}
          </div>
        )}
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
      </div>
    );
  }

  // VARIANT 3: Inline Panel (used inside Plan y Repasos or General View)
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
      {renderTrackerContent(false)}
    </div>
  );
};
