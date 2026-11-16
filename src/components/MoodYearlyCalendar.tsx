import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { MoodEntry, MoodType, StudyPreferences } from '../types';
import { MOOD_OPTIONS_META } from './MoodTracker';
import { formatReadableDate, getTodayLocalDateStr } from '../utils/dateUtils';

export interface MoodYearlyCalendarProps {
  preferences?: StudyPreferences;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  initialYear?: number;
  compact?: boolean;
  selectedDateStr?: string;
  onSelectDate?: (dateStr: string) => void;
}

const MONTH_LABELS_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const WEEKDAY_LABELS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function mergeMoodEntries(a: MoodEntry[], b: MoodEntry[]): MoodEntry[] {
  const byDate = new Map<string, MoodEntry>();
  for (const item of [...a, ...b]) {
    if (!item || !item.date) continue;
    const existing = byDate.get(item.date);
    if (
      !existing ||
      (item.updatedAt && (!existing.updatedAt || item.updatedAt >= existing.updatedAt))
    ) {
      byDate.set(item.date, item);
    }
  }
  return Array.from(byDate.values()).sort((x, y) => y.date.localeCompare(x.date));
}

function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const MoodYearlyCalendar: React.FC<MoodYearlyCalendarProps> = ({
  preferences,
  onUpdatePreferences,
  initialYear,
  compact = false,
  selectedDateStr: externalSelectedDateStr,
  onSelectDate,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const [selectedYear, setSelectedYear] = useState<number>(
    () => initialYear || new Date().getFullYear()
  );
  const [internalSelectedDateStr, setInternalSelectedDateStr] = useState<string>(todayStr);
  const selectedDateStr = externalSelectedDateStr || internalSelectedDateStr;
  const setSelectedDateStr = (nextDateStr: string) => {
    setInternalSelectedDateStr(nextDateStr);
    if (onSelectDate) onSelectDate(nextDateStr);
  };
  const [metricMode, setMetricMode] = useState<'mood' | 'energy'>('mood');
  const [hoveredDayInfo, setHoveredDayInfo] = useState<{
    dateStr: string;
    entry: MoodEntry | null;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const loadMoods = (): MoodEntry[] => {
    const fromPrefs = Array.isArray(preferences?.moodEntries)
      ? preferences!.moodEntries
      : [];
    let fromStorage: MoodEntry[] = [];
    try {
      const raw = localStorage.getItem('studyflow_user_moods_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) fromStorage = parsed;
      }
    } catch {
      // ignore
    }
    return mergeMoodEntries(fromPrefs, fromStorage);
  };

  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>(loadMoods);

  useEffect(() => {
    if (preferences?.moodEntries) {
      setMoodEntries((prev) => mergeMoodEntries(prev, preferences.moodEntries || []));
    }
  }, [preferences?.moodEntries]);

  useEffect(() => {
    const handleSync = () => {
      setMoodEntries(loadMoods());
    };
    window.addEventListener('studyflow-moods-updated', handleSync);
    return () => window.removeEventListener('studyflow-moods-updated', handleSync);
  }, [preferences]);

  const persistMoods = (nextMoods: MoodEntry[]) => {
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

  const moodByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    for (const entry of moodEntries) {
      if (entry && entry.date) {
        map.set(entry.date, entry);
      }
    }
    return map;
  }, [moodEntries]);

  // Estadísticas de consistencia anual
  const yearlyConsistencyStats = useMemo(() => {
    const prefix = `${selectedYear}-`;
    const entriesInYear = moodEntries
      .filter((m) => m.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));

    const counts = (Object.keys(MOOD_OPTIONS_META) as MoodType[]).reduce(
      (acc, key) => {
        acc[key] = 0;
        return acc;
      },
      {} as Record<MoodType, number>
    );

    let sumScore = 0;
    let sumEnergy = 0;
    for (const e of entriesInYear) {
      if (counts[e.mood] !== undefined) counts[e.mood] += 1;
      sumScore += MOOD_OPTIONS_META[e.mood]?.score || 3;
      sumEnergy += e.energyLevel || 3;
    }

    // Calcular la racha máxima de días consecutivos con registro en el año
    let longestStreak = 0;
    let currentRun = 0;
    let prevTime: number | null = null;
    for (const e of entriesInYear) {
      const [y, m, d] = e.date.split('-').map(Number);
      const t = new Date(y, m - 1, d).getTime();
      if (prevTime !== null && Math.round((t - prevTime) / (1000 * 3600 * 24)) === 1) {
        currentRun += 1;
      } else {
        currentRun = 1;
      }
      if (currentRun > longestStreak) longestStreak = currentRun;
      prevTime = t;
    }

    const isLeapYear =
      (selectedYear % 4 === 0 && selectedYear % 100 !== 0) || selectedYear % 400 === 0;
    const totalDaysInYear = isLeapYear ? 366 : 365;
    const consistencyPct = Math.round((entriesInYear.length / totalDaysInYear) * 100);

    return {
      totalRecorded: entriesInYear.length,
      totalDaysInYear,
      consistencyPct,
      longestStreak,
      avgScore:
        entriesInYear.length > 0
          ? Number((sumScore / entriesInYear.length).toFixed(1))
          : 0,
      avgEnergy:
        entriesInYear.length > 0
          ? Number((sumEnergy / entriesInYear.length).toFixed(1))
          : 0,
      counts,
    };
  }, [moodEntries, selectedYear]);

  // Renderizado del Heatmap Anual con D3.js
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const cellSize = 13;
    const cellGap = 3;
    const step = cellSize + cellGap;
    const leftMargin = 34;
    const topMargin = 22;
    const width = leftMargin + 53 * step + 12;
    const height = topMargin + 7 * step + 8;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Escalas de color D3 para Ánimo (1..5) y Energía (1..5)
    const moodColorScale = d3
      .scaleOrdinal<number, string>()
      .domain([1, 2, 3, 4, 5])
      .range(['#f43f5e', '#f59e0b', '#6366f1', '#3b82f6', '#10b981']);

    const energyColorScale = d3
      .scaleSequential(d3.interpolateYlGnBu)
      .domain([1, 5]);

    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear + 1, 0, 1);
    const allDays = d3.timeDays(startDate, endDate);

    // Día de la semana estilo europeo (0 = Lunes ... 6 = Domingo)
    const getEuroDay = (d: Date) => (d.getDay() + 6) % 7;

    // Índice de semana (Lunes como inicio de semana)
    const getWeekIndex = (d: Date) => d3.timeMonday.count(startDate, d);

    // Etiquetas de días de la semana (Lun, Mié, Vie, Dom)
    const dayLabelsGroup = svg
      .append('g')
      .attr('transform', `translate(0, ${topMargin})`);

    WEEKDAY_LABELS_ES.forEach((label, idx) => {
      if (idx % 2 === 0 || idx === 6) {
        dayLabelsGroup
          .append('text')
          .attr('x', leftMargin - 6)
          .attr('y', idx * step + cellSize - 2)
          .attr('text-anchor', 'end')
          .attr('fill', '#64748b')
          .attr('font-size', '9px')
          .attr('font-weight', '600')
          .text(label);
      }
    });

    // Etiquetas de meses en la parte superior usando d3.timeMonths
    const months = d3.timeMonths(startDate, endDate);
    const monthLabelsGroup = svg
      .append('g')
      .attr('transform', `translate(${leftMargin}, 0)`);

    months.forEach((monthDate, mIdx) => {
      const weekIdx = getWeekIndex(monthDate);
      monthLabelsGroup
        .append('text')
        .attr('x', weekIdx * step)
        .attr('y', 14)
        .attr('fill', '#475569')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .text(MONTH_LABELS_ES[mIdx]);
    });

    // Grupo de celdas de los días del año
    const cellsGroup = svg
      .append('g')
      .attr('transform', `translate(${leftMargin}, ${topMargin})`);

    cellsGroup
      .selectAll('rect.mood-day-cell')
      .data(allDays)
      .enter()
      .append('rect')
      .attr('class', 'mood-day-cell')
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('x', (d) => getWeekIndex(d) * step)
      .attr('y', (d) => getEuroDay(d) * step)
      .attr('fill', (d) => {
        const iso = formatDateIso(d);
        const entry = moodByDate.get(iso);
        if (!entry) return '#e2e8f0';
        if (metricMode === 'energy') {
          return energyColorScale(entry.energyLevel || 3);
        }
        const meta = MOOD_OPTIONS_META[entry.mood];
        if (meta?.hexColor) return meta.hexColor;
        const score = meta?.score || 3;
        return moodColorScale(score);
      })
      .attr('stroke', (d) => {
        const iso = formatDateIso(d);
        if (iso === selectedDateStr) return '#7c3aed';
        if (iso === todayStr) return '#0f172a';
        return 'transparent';
      })
      .attr('stroke-width', (d) => {
        const iso = formatDateIso(d);
        if (iso === selectedDateStr) return 2;
        if (iso === todayStr) return 1.25;
        return 0;
      })
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        const iso = formatDateIso(d);
        setHoveredDayInfo({
          dateStr: iso,
          entry: moodByDate.get(iso) || null,
        });
      })
      .on('mouseleave', () => {
        setHoveredDayInfo(null);
      })
      .on('click', (_event, d) => {
        const iso = formatDateIso(d);
        setSelectedDateStr(iso);
      });
  }, [selectedYear, moodByDate, metricMode, selectedDateStr, todayStr]);

  const activeDayEntry = moodByDate.get(selectedDateStr) || null;
  const activeHoverOrSelected = hoveredDayInfo || {
    dateStr: selectedDateStr,
    entry: activeDayEntry,
  };

  const handleSetDayMood = (mood: MoodType) => {
    const existing = moodByDate.get(selectedDateStr);
    const updated: MoodEntry = {
      id: existing?.id || `mood-${Date.now()}`,
      date: selectedDateStr,
      mood,
      energyLevel: existing?.energyLevel || 4,
      note: existing?.note,
      updatedAt: new Date().toISOString(),
    };
    const rest = moodEntries.filter((m) => m.date !== selectedDateStr);
    persistMoods([updated, ...rest]);
  };

  const handleSetDayEnergy = (energyLevel: number) => {
    const existing = moodByDate.get(selectedDateStr);
    const updated: MoodEntry = {
      id: existing?.id || `mood-${Date.now()}`,
      date: selectedDateStr,
      mood: existing?.mood || 'motivado',
      energyLevel,
      note: existing?.note,
      updatedAt: new Date().toISOString(),
    };
    const rest = moodEntries.filter((m) => m.date !== selectedDateStr);
    persistMoods([updated, ...rest]);
  };

  const handleDeleteSelectedDay = () => {
    persistMoods(moodEntries.filter((m) => m.date !== selectedDateStr));
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      } space-y-4`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Mapa de Calor Anual del Estado de Ánimo ({selectedYear})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-numbers">
            <span>
              Días registrados:{' '}
              <strong className="text-slate-900 dark:text-white">
                {yearlyConsistencyStats.totalRecorded}/{yearlyConsistencyStats.totalDaysInYear}
              </strong>{' '}
              ({yearlyConsistencyStats.consistencyPct}% consistencia)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Mejor racha:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {yearlyConsistencyStats.longestStreak}d
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Promedio anual:{' '}
              <strong className="text-violet-600 dark:text-violet-400">
                {yearlyConsistencyStats.avgScore}/5
              </strong>{' '}
              (⚡{yearlyConsistencyStats.avgEnergy}/5)
            </span>
          </div>
        </div>

        {/* Controles: Escala (Ánimo vs Energía) + Selector de Año */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setMetricMode('mood')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                metricMode === 'mood'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Estado de Ánimo
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('energy')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                metricMode === 'energy'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Nivel de Energía
            </button>
          </div>

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
        </div>
      </div>

      {/* Contenedor SVG D3 Heatmap */}
      <div className="w-full overflow-x-auto pb-1">
        <div className="min-w-[720px]">
          <svg ref={svgRef} className="w-full h-auto block select-none" />
        </div>
      </div>

      {/* Leyenda + Inspector de Día en Tiempo Real */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold text-slate-400">Escala:</span>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="w-3 h-3 rounded-xs inline-block bg-slate-200 dark:bg-slate-700" />
            <span>Sin registro</span>
          </div>
          {(Object.keys(MOOD_OPTIONS_META) as MoodType[]).map((mKey) => {
            const meta = MOOD_OPTIONS_META[mKey];
            const count = yearlyConsistencyStats.counts[mKey] || 0;
            return (
              <div key={mKey} className="flex items-center gap-1 text-[11px]">
                <span
                  className="w-3 h-3 rounded-xs inline-block shrink-0"
                  style={{ backgroundColor: meta.hexColor }}
                />
                <span>
                  {meta.emoji} {meta.shortLabel}
                </span>
                <span className="font-mono-numbers font-bold text-slate-900 dark:text-white">
                  ({count})
                </span>
              </div>
            );
          })}
        </div>

        {/* Estado del día bajo el cursor o seleccionado */}
        <div className="text-xs font-mono-numbers text-slate-600 dark:text-slate-300">
          {activeHoverOrSelected.entry ? (
            <span>
              <strong>{formatReadableDate(activeHoverOrSelected.dateStr)}</strong>:{' '}
              {MOOD_OPTIONS_META[activeHoverOrSelected.entry.mood].emoji}{' '}
              {MOOD_OPTIONS_META[activeHoverOrSelected.entry.mood].label} · ⚡
              {activeHoverOrSelected.entry.energyLevel}/5
              {activeHoverOrSelected.entry.note
                ? ` · "${activeHoverOrSelected.entry.note}"`
                : ''}
            </span>
          ) : (
            <span>
              <strong>{formatReadableDate(activeHoverOrSelected.dateStr)}</strong>: Sin
              registro (haz clic en una celda para editar)
            </span>
          )}
        </div>
      </div>

      {/* Barra Interactiva para Registrar o Editar el Día Seleccionado */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Editar día ({selectedDateStr === todayStr ? 'Hoy' : formatReadableDate(selectedDateStr)}):
          </span>
          <input
            type="date"
            value={selectedDateStr}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDateStr(e.target.value);
                const yr = parseInt(e.target.value.slice(0, 4), 10);
                if (!Number.isNaN(yr)) setSelectedYear(yr);
              }
            }}
            className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono-numbers text-slate-800 dark:text-slate-200"
          />
          {activeDayEntry && (
            <button
              type="button"
              onClick={handleDeleteSelectedDay}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Quitar</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {(Object.keys(MOOD_OPTIONS_META) as MoodType[]).map((mKey) => {
              const meta = MOOD_OPTIONS_META[mKey];
              const isSelected = activeDayEntry?.mood === mKey;
              return (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => handleSetDayMood(mKey)}
                  className={`px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
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

          <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => handleSetDayEnergy(lvl)}
                className={`w-6 h-6 rounded-lg text-[10px] font-mono-numbers font-bold transition-colors cursor-pointer ${
                  (activeDayEntry?.energyLevel || 0) >= lvl
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
                title={`Nivel de energía ${lvl}/5`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
