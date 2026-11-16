import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { TrendingUp, Target, Calendar, Filter, Award, Settings } from 'lucide-react';
import { Subject, PomodoroLog, StudyPreferences } from '../types';

interface WeeklyStudyProgressAreaChartProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  preferences: StudyPreferences;
  onOpenProgramManager?: () => void;
}

interface DayChartPoint {
  dayShort: string;
  dayFull: string;
  dateStr: string;
  realHoursDaily: number;
  targetHoursDaily: number;
  realHoursCumulative: number;
  targetHoursCumulative: number;
  deltaDaily: number;
  deltaCumulative: number;
  compliancePct: number;
  isToday: boolean;
  isFuture: boolean;
}

const DAY_META: { jsDay: number; short: string; full: string }[] = [
  { jsDay: 1, short: 'Lun', full: 'Lunes' },
  { jsDay: 2, short: 'Mar', full: 'Martes' },
  { jsDay: 3, short: 'Mié', full: 'Miércoles' },
  { jsDay: 4, short: 'Jue', full: 'Jueves' },
  { jsDay: 5, short: 'Vie', full: 'Viernes' },
  { jsDay: 6, short: 'Sáb', full: 'Sábado' },
  { jsDay: 0, short: 'Dom', full: 'Domingo' },
];

export const WeeklyStudyProgressAreaChart: React.FC<WeeklyStudyProgressAreaChartProps> = ({
  subjects,
  pomodoroLogs,
  preferences,
  onOpenProgramManager,
}) => {
  const [chartMode, setChartMode] = useState<'cumulative' | 'daily'>('cumulative');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current week, 1 = last week, etc.

  const { chartData, summary } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const startOfWeek = new Date(todayStart);
    startOfWeek.setDate(todayStart.getDate() + diffToMonday - weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    // Base weekly target across all subjects from daily configuration
    let baseDailyTargets = DAY_META.map((d) => {
      const configured =
        preferences.hoursPerDay?.[d.jsDay] ??
        preferences.dailyGoalHours ??
        2;
      return Math.max(0, Number(configured));
    });

    const totalBaseWeeklyTarget = baseDailyTargets.reduce((acc, v) => acc + v, 0);

    // If a specific subject is selected, scale the daily target proportionally or use subjectWeeklyGoalHours
    if (selectedSubjectId !== 'ALL') {
      const customSubjectWeekly = preferences.subjectWeeklyGoalHours?.[selectedSubjectId];
      const subjectCount = Math.max(1, subjects.length);
      const subjectWeeklyGoal =
        customSubjectWeekly !== undefined && customSubjectWeekly > 0
          ? customSubjectWeekly
          : Number((totalBaseWeeklyTarget / subjectCount).toFixed(2));

      if (totalBaseWeeklyTarget > 0) {
        const scale = subjectWeeklyGoal / totalBaseWeeklyTarget;
        baseDailyTargets = baseDailyTargets.map((h) => Number((h * scale).toFixed(2)));
      } else {
        const perDay = Number((subjectWeeklyGoal / 7).toFixed(2));
        baseDailyTargets = baseDailyTargets.map(() => perDay);
      }
    }

    let runningReal = 0;
    let runningTarget = 0;
    let elapsedTargetSoFar = 0;

    const points: DayChartPoint[] = DAY_META.map((meta, idx) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + idx);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);

      const isToday = d.getTime() === todayStart.getTime();
      const isFuture = d.getTime() > todayStart.getTime();

      const dayIsoStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

      const dayLogs = pomodoroLogs.filter((log) => {
        if (selectedSubjectId !== 'ALL' && log.subjectId !== selectedSubjectId) return false;
        if (log.date) {
          return log.date === dayIsoStr;
        }
        const logDate = new Date(log.timestamp);
        return logDate >= d && logDate < nextD;
      });

      const realMinutes = dayLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
      const realHoursDaily = Number((realMinutes / 60).toFixed(2));
      const targetHoursDaily = Number(baseDailyTargets[idx].toFixed(2));

      runningReal = Number((runningReal + realHoursDaily).toFixed(2));
      runningTarget = Number((runningTarget + targetHoursDaily).toFixed(2));

      if (!isFuture) {
        elapsedTargetSoFar = Number((elapsedTargetSoFar + targetHoursDaily).toFixed(2));
      }

      const compliancePct =
        targetHoursDaily > 0
          ? Math.round((realHoursDaily / targetHoursDaily) * 100)
          : realHoursDaily > 0
          ? 100
          : 0;

      const dayNumber = d.getDate().toString().padStart(2, '0');
      const monthNumber = (d.getMonth() + 1).toString().padStart(2, '0');

      return {
        dayShort: meta.short,
        dayFull: `${meta.full} (${dayNumber}/${monthNumber})`,
        dateStr: `${dayNumber}/${monthNumber}`,
        realHoursDaily,
        targetHoursDaily,
        realHoursCumulative: runningReal,
        targetHoursCumulative: runningTarget,
        deltaDaily: Number((realHoursDaily - targetHoursDaily).toFixed(2)),
        deltaCumulative: Number((runningReal - runningTarget).toFixed(2)),
        compliancePct,
        isToday,
        isFuture,
      };
    });

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const formatRange = (start: Date, end: Date) => {
      const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
      return `${start.toLocaleDateString('es-ES', opts)} – ${end.toLocaleDateString('es-ES', opts)}`;
    };

    const weeklyCompletionPct =
      runningTarget > 0 ? Math.round((runningReal / runningTarget) * 100) : 0;

    const paceDelta = Number((runningReal - elapsedTargetSoFar).toFixed(2));

    return {
      chartData: points,
      summary: {
        totalRealHours: runningReal,
        totalTargetHours: runningTarget,
        elapsedTargetSoFar,
        paceDelta,
        weeklyCompletionPct,
        weekLabel: formatRange(startOfWeek, endOfWeek),
      },
    };
  }, [pomodoroLogs, preferences, selectedSubjectId, subjects.length, weekOffset]);

  const realKey = chartMode === 'cumulative' ? 'realHoursCumulative' : 'realHoursDaily';
  const targetKey = chartMode === 'cumulative' ? 'targetHoursCumulative' : 'targetHoursDaily';

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
              Progreso de Estudio Semanal: Horas Reales vs. Horas Objetivo
            </h3>
            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 text-[11px] font-semibold border border-stone-200 font-mono-numbers">
              {summary.weekLabel}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Comparativa visual mediante gráfico de áreas del tiempo efectivo de estudio frente a la meta planificada ({chartMode === 'cumulative' ? 'curva acumulada L–D' : 'desglose diario L–D'}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Subject Filter */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-stone-700 focus:outline-none cursor-pointer"
              aria-label="Filtrar por materia"
            >
              <option value="ALL">Todas las materias</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Week Selector */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={weekOffset}
              onChange={(e) => setWeekOffset(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-stone-700 focus:outline-none cursor-pointer"
              aria-label="Seleccionar semana"
            >
              <option value={0}>Semana actual</option>
              <option value={1}>Semana pasada</option>
              <option value={2}>Hace 2 semanas</option>
              <option value={3}>Hace 3 semanas</option>
            </select>
          </div>

          {/* Mode Toggle */}
          <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
            <button
              type="button"
              onClick={() => setChartMode('cumulative')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                chartMode === 'cumulative'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Acumulado
            </button>
            <button
              type="button"
              onClick={() => setChartMode('daily')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                chartMode === 'daily'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Diario (L–D)
            </button>
          </div>

          {onOpenProgramManager && (
            <button
              type="button"
              onClick={onOpenProgramManager}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors"
              title="Ajustar horas objetivo semanales"
            >
              <Settings className="w-3.5 h-3.5 text-stone-500" />
              Ajustar Meta
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Horas Reales
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-950 font-mono-numbers">
              {summary.totalRealHours}h
            </span>
            <span className="text-[11px] text-emerald-700 font-medium">
              registradas
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
              Horas Objetivo
            </span>
            <Target className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-indigo-950 font-mono-numbers">
              {summary.totalTargetHours}h
            </span>
            <span className="text-[11px] text-indigo-700 font-medium">
              meta semanal
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
              Cumplimiento Semanal
            </span>
            <Award className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl font-black font-mono-numbers ${
                summary.weeklyCompletionPct >= 100
                  ? 'text-emerald-700'
                  : summary.weeklyCompletionPct >= 70
                  ? 'text-amber-700'
                  : 'text-stone-900'
              }`}
            >
              {summary.weeklyCompletionPct}%
            </span>
            <span className="text-[11px] text-stone-500">
              del total semanal
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
              Ritmo vs. Hoy
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                summary.paceDelta >= 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {summary.paceDelta >= 0 ? 'En meta' : 'Por recuperar'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-xl font-black font-mono-numbers ${
                summary.paceDelta >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {summary.paceDelta > 0 ? `+${summary.paceDelta}` : summary.paceDelta}h
            </span>
            <span className="text-[11px] text-stone-500 font-mono-numbers">
              (meta hoy: {summary.elapsedTargetSoFar}h)
            </span>
          </div>
        </div>
      </div>

      {/* Recharts AreaChart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="weeklyTargetGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="weeklyRealGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.38} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
            <XAxis
              dataKey="dayShort"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#57534e', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#78716c', fontSize: 11 }}
              unit="h"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as DayChartPoint;
                const realVal = chartMode === 'cumulative' ? d.realHoursCumulative : d.realHoursDaily;
                const targetVal = chartMode === 'cumulative' ? d.targetHoursCumulative : d.targetHoursDaily;
                const diff = Number((realVal - targetVal).toFixed(2));
                return (
                  <div className="bg-stone-900 text-white p-3 rounded-xl shadow-lg border border-stone-700 text-xs min-w-[200px]">
                    <div className="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-stone-700">
                      <span className="font-bold text-stone-100">{d.dayFull}</span>
                      {d.isToday && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          Hoy
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 font-mono-numbers">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-emerald-400 font-semibold">
                          Horas Reales ({chartMode === 'cumulative' ? 'Acum.' : 'Día'}):
                        </span>
                        <span className="font-bold text-white">{realVal} h</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-indigo-300 font-semibold">
                          Horas Objetivo ({chartMode === 'cumulative' ? 'Acum.' : 'Día'}):
                        </span>
                        <span className="font-bold text-white">{targetVal} h</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 pt-1 border-t border-stone-800">
                        <span className="text-stone-400">Diferencia:</span>
                        <span
                          className={`font-bold ${
                            diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff} h
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={32}
              iconType="circle"
              wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
            />
            {chartMode === 'cumulative' && summary.totalTargetHours > 0 && (
              <ReferenceLine
                y={summary.totalTargetHours}
                stroke="#6366f1"
                strokeDasharray="4 4"
                label={{
                  value: `Meta Semanal (${summary.totalTargetHours}h)`,
                  position: 'insideTopRight',
                  fill: '#4f46e5',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={targetKey}
              name="Horas Objetivo"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="5 4"
              fillOpacity={1}
              fill="url(#weeklyTargetGradient)"
              activeDot={{ r: 5, strokeWidth: 0, fill: '#6366f1' }}
            />
            <Area
              type="monotone"
              dataKey={realKey}
              name="Horas Reales Estudiadas"
              stroke="#10b981"
              strokeWidth={2.75}
              fillOpacity={1}
              fill="url(#weeklyRealGradient)"
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#ffffff', fill: '#059669' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
