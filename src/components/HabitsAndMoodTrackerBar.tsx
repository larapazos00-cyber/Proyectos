import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Smile,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import {
  HabitItem,
  MoodEntry,
  StudyPreferences,
  ScheduledStudySession,
  WeeklyObligation,
  BlockedTimeEvent,
} from '../types';
import { EffectiveBlockedCalendarItem } from './SmartCalendarModal';
import { HabitsTracker, DEFAULT_INITIAL_HABITS } from './HabitsTracker';
import { MoodTracker, MOOD_OPTIONS_META } from './MoodTracker';
import { getTodayLocalDateStr, getDayOfWeekFromDateStr } from '../utils/dateUtils';

interface HabitsAndMoodTrackerBarProps {
  preferences: StudyPreferences;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  selectedDayStr: string;
  sessionsByDate: Record<string, ScheduledStudySession[]>;
  getEffectiveBlockedForDate: (dateStr: string) => EffectiveBlockedCalendarItem[];
  onScheduleHabitOneDay: (
    title: string,
    dateStr: string,
    startTime: string,
    endTime: string,
    category: BlockedTimeEvent['category'],
    notes?: string
  ) => void;
  onScheduleHabitWeekly: (
    title: string,
    category: WeeklyObligation['category'],
    days: number[],
    startTime: string,
    endTime: string,
    notes?: string
  ) => void;
}

export const HabitsAndMoodTrackerBar: React.FC<HabitsAndMoodTrackerBarProps> = ({
  preferences,
  onUpdatePreferences,
  selectedDayStr,
  sessionsByDate,
  getEffectiveBlockedForDate,
  onScheduleHabitOneDay,
  onScheduleHabitWeekly,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const activeDateStr = selectedDayStr || todayStr;
  const [openSection, setOpenSection] = useState<'none' | 'habits' | 'mood'>('none');

  const loadHabits = (): HabitItem[] => {
    if (preferences.habits && preferences.habits.length > 0) return preferences.habits;
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

  const loadMoods = (): MoodEntry[] => {
    if (preferences.moodEntries && preferences.moodEntries.length > 0)
      return preferences.moodEntries;
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

  const [habits, setHabits] = useState<HabitItem[]>(loadHabits);
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>(loadMoods);

  useEffect(() => {
    const syncH = () => setHabits(loadHabits());
    const syncM = () => setMoodEntries(loadMoods());
    window.addEventListener('studyflow-habits-updated', syncH);
    window.addEventListener('studyflow-moods-updated', syncM);
    return () => {
      window.removeEventListener('studyflow-habits-updated', syncH);
      window.removeEventListener('studyflow-moods-updated', syncM);
    };
  }, []);

  const activeDayOfWeek = getDayOfWeekFromDateStr(activeDateStr);
  const habitsForActiveDay = useMemo(
    () => habits.filter((h) => h.frequencyDays.includes(activeDayOfWeek)),
    [habits, activeDayOfWeek]
  );
  const completedCountActiveDay = useMemo(
    () => habitsForActiveDay.filter((h) => h.completedDates.includes(activeDateStr)).length,
    [habitsForActiveDay, activeDateStr]
  );

  const currentDayMoodEntry = useMemo(
    () => moodEntries.find((m) => m.date === activeDateStr) || null,
    [moodEntries, activeDateStr]
  );

  const handleQuickToggleHabit = (habitId: string) => {
    const updated = habits.map((h) => {
      if (h.id !== habitId) return h;
      const exists = h.completedDates.includes(activeDateStr);
      return {
        ...h,
        completedDates: exists
          ? h.completedDates.filter((d) => d !== activeDateStr)
          : [...h.completedDates, activeDateStr],
      };
    });
    setHabits(updated);
    try {
      localStorage.setItem('studyflow_user_habits_v1', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('studyflow-habits-updated'));
    } catch {
      // ignore
    }
    onUpdatePreferences?.({
      ...preferences,
      habits: updated,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden transition-all">
      {/* Barra compacta superior con los botones desplegables de HabitsTracker y MoodTracker */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/70 dark:bg-slate-800/40">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === 'habits' ? 'none' : 'habits')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              openSection === 'habits'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
            }`}
          >
            <CheckCircle2
              className={`w-3.5 h-3.5 ${
                openSection === 'habits' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
            <span>Control de Hábitos</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono-numbers font-extrabold ${
                openSection === 'habits'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {completedCountActiveDay}/{habitsForActiveDay.length} hoy
            </span>
            {openSection === 'habits' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setOpenSection(openSection === 'mood' ? 'none' : 'mood')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              openSection === 'mood'
                ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-violet-400'
            }`}
          >
            <Smile
              className={`w-3.5 h-3.5 ${
                openSection === 'mood' ? 'text-white' : 'text-violet-600 dark:text-violet-400'
              }`}
            />
            <span>Mood Tracker</span>
            {currentDayMoodEntry ? (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                  openSection === 'mood'
                    ? 'bg-white/20 text-white'
                    : MOOD_OPTIONS_META[currentDayMoodEntry.mood].badgeBg
                }`}
              >
                <span>{MOOD_OPTIONS_META[currentDayMoodEntry.mood].emoji}</span>
                <span>{MOOD_OPTIONS_META[currentDayMoodEntry.mood].label}</span>
                <span className="font-mono-numbers">⚡{currentDayMoodEntry.energyLevel}/5</span>
              </span>
            ) : (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                  openSection === 'mood'
                    ? 'bg-white/20 text-white'
                    : 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                }`}
              >
                Registrar hoy
              </span>
            )}
            {openSection === 'mood' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            )}
          </button>
        </div>

        {openSection === 'none' && habitsForActiveDay.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
            {habitsForActiveDay.slice(0, 4).map((h) => {
              const done = h.completedDates.includes(activeDateStr);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => handleQuickToggleHabit(h.id)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer shrink-0 ${
                    done
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 line-through opacity-85'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                  }`}
                >
                  <span>{h.emoji}</span>
                  <span className="max-w-[110px] truncate">{h.title}</span>
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

      {openSection === 'habits' && (
        <div className="border-t border-slate-200/80 dark:border-slate-800">
          <HabitsTracker
            preferences={preferences}
            onUpdatePreferences={onUpdatePreferences}
            selectedDayStr={activeDateStr}
            isExpandedExternal={true}
            onToggleExpandExternal={() => setOpenSection('none')}
            hideCollapsibleHeader={true}
            sessionsByDate={sessionsByDate}
            getEffectiveBlockedForDate={getEffectiveBlockedForDate}
            onScheduleHabitOneDay={onScheduleHabitOneDay}
            onScheduleHabitWeekly={onScheduleHabitWeekly}
          />
        </div>
      )}

      {openSection === 'mood' && (
        <div className="border-t border-slate-200/80 dark:border-slate-800 p-4">
          <MoodTracker
            variant="inline"
            selectedDayStr={activeDateStr}
            preferences={preferences}
            onUpdatePreferences={onUpdatePreferences}
            isExpandedExternal={true}
            onToggleExpandExternal={() => setOpenSection('none')}
          />
        </div>
      )}
    </div>
  );
};
