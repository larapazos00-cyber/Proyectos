import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  BarChart3,
  AlertTriangle,
  Play,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react';
import { Subject, PomodoroLog, BlockedTimeEvent, StudyPreferences } from '../types';

interface SubjectStudyHoursChartProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  blockedEvents?: BlockedTimeEvent[];
  preferences?: StudyPreferences;
  onSelectSubject: (subjectId: string) => void;
  onSelectForPomodoro: (subjectId: string, topicId?: string) => void;
}

function getLocalDateStrOffset(daysAgo: number): { dateStr: string; dayShort: string } {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${day}`;
  const dayShort = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
  return { dateStr, dayShort };
}

export const SubjectStudyHoursChart: React.FC<SubjectStudyHoursChartProps> = ({
  subjects,
  pomodoroLogs = [],
  blockedEvents = [],
  preferences,
  onSelectSubject,
  onSelectForPomodoro,
}) => {
  const [chartViewMode, setChartViewMode] = useState<'by_subject' | 'daily_7d'>('by_subject');

  // Generate the last 7 days window (from 6 days ago up to today)
  const last7DaysWindow = useMemo(() => {
    const days: Array<{ dateStr: string; dayShort: string }> = [];
    for (let i = 6; i >= 0; i--) {
      days.push(getLocalDateStrOffset(i));
    }
    return days;
  }, []);

  const last7DaysSet = useMemo(
    () => new Set(last7DaysWindow.map((d) => d.dateStr)),
    [last7DaysWindow]
  );

  // Aggregate study hours per subject over the last 7 days
  const subject7DaysMetrics = useMemo(() => {
    return subjects.map((sub) => {
      // 1. Minutes from Pomodoro logs in the last 7 days
      const logsMins7d = pomodoroLogs
        .filter(
          (l) =>
            l.date &&
            last7DaysSet.has(l.date) &&
            (l.subjectId === sub.id || l.subjectName === sub.name)
        )
        .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

      // 2. Minutes from custom/study blocks in blockedEvents in the last 7 days
      const blockedStudyHours7d = blockedEvents
        .filter(
          (b) =>
            b.date &&
            last7DaysSet.has(b.date) &&
            (b.linkedSubjectId === sub.id || b.subjectName === sub.name) &&
            (b.category === 'estudio' ||
              b.linkedItemType === 'topic' ||
              b.id.startsWith('custom-study-'))
        )
        .reduce((acc, b) => acc + (b.durationHours || 1), 0);

      // 3. Topic actualHoursSpent if studied within the last 7 days
      const topicStudiedHours7d = (sub.topics || [])
        .filter((t) => t.studiedAt && last7DaysSet.has(t.studiedAt.split('T')[0]))
        .reduce((acc, t) => acc + (t.actualHoursSpent || t.estimatedHours || 0), 0);

      const rawHours = Math.max(
        logsMins7d / 60 + blockedStudyHours7d,
        topicStudiedHours7d
      );
      const hoursStudied7d = Math.round(rawHours * 10) / 10;

      // Target weekly hours for this subject
      const pendingTopicsCount = (sub.topics || []).filter(
        (t) => t.status !== 'estudiado' && t.status !== 'repasado'
      ).length;
      const configuredGoal =
        preferences?.subjectWeeklyGoalHours?.[sub.id] ??
        preferences?.defaultSubjectWeeklyGoalHours ??
        Math.max(2, Math.min(6, pendingTopicsCount * 1.5 || 3));

      const targetHours7d = Math.round(configuredGoal * 10) / 10;
      const deficitHours = Math.max(0, Math.round((targetHours7d - hoursStudied7d) * 10) / 10);
      const completionPct =
        targetHours7d > 0 ? Math.min(100, Math.round((hoursStudied7d / targetHours7d) * 100)) : 100;

      // Needs attention if it has pending topics and < 50% of its 7-day target hours
      const needsAttention = pendingTopicsCount > 0 && completionPct < 55;

      const shortName =
        sub.name.length > 18 ? `${sub.name.slice(0, 16).trim()}…` : sub.name;

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        shortName,
        code: sub.code || sub.name.slice(0, 4).toUpperCase(),
        color: sub.color || '#3b82f6',
        hoursStudied7d,
        targetHours7d,
        deficitHours,
        completionPct,
        pendingTopicsCount,
        needsAttention,
        nextPendingTopic: (sub.topics || []).find(
          (t) => t.status !== 'estudiado' && t.status !== 'repasado'
        ),
      };
    });
  }, [subjects, pomodoroLogs, blockedEvents, last7DaysSet, preferences]);

  // Daily breakdown across the last 7 days per subject for the daily stacked view
  const dailyStackedData = useMemo(() => {
    return last7DaysWindow.map(({ dateStr, dayShort }) => {
      const row: Record<string, any> = {
        dateStr,
        day: dayShort,
      };
      subjects.forEach((sub) => {
        const minsFromLogs = pomodoroLogs
          .filter(
            (l) =>
              l.date === dateStr &&
              (l.subjectId === sub.id || l.subjectName === sub.name)
          )
          .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

        const hoursFromBlocks = blockedEvents
          .filter(
            (b) =>
              b.date === dateStr &&
              (b.linkedSubjectId === sub.id || b.subjectName === sub.name) &&
              (b.category === 'estudio' ||
                b.linkedItemType === 'topic' ||
                b.id.startsWith('custom-study-'))
          )
          .reduce((acc, b) => acc + (b.durationHours || 1), 0);

        const hoursFromStudiedTopics = (sub.topics || [])
          .filter((t) => t.studiedAt && t.studiedAt.split('T')[0] === dateStr)
          .reduce((acc, t) => acc + (t.actualHoursSpent || t.estimatedHours || 0), 0);

        const val = Math.max(minsFromLogs / 60 + hoursFromBlocks, hoursFromStudiedTopics);
        row[sub.name] = Math.round(val * 10) / 10;
      });
      return row;
    });
  }, [last7DaysWindow, subjects, pomodoroLogs, blockedEvents]);

  // Identify subjects that need more attention (sorted by lowest completionPct / highest deficit)
  const subjectsNeedingAttention = useMemo(() => {
    return [...subject7DaysMetrics]
      .filter((m) => m.pendingTopicsCount > 0)
      .sort((a, b) => a.hoursStudied7d - b.hoursStudied7d || b.deficitHours - a.deficitHours)
      .slice(0, 3);
  }, [subject7DaysMetrics]);

  const totalHoursLast7Days = useMemo(
    () =>
      Math.round(
        subject7DaysMetrics.reduce((acc, m) => acc + m.hoursStudied7d, 0) * 10
      ) / 10,
    [subject7DaysMetrics]
  );

  if (subjects.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
      {/* Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Horas de Estudio por Asignatura (Últimos 7 Días)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-mono-numbers text-[11px] font-bold">
                {totalHoursLast7Days}h totales en 7d
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparativa de dedicación semanal por materia para detectar qué asignaturas necesitan más atención.
            </p>
          </div>
        </div>

        {/* Toggle Chart Mode */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartViewMode('by_subject')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              chartViewMode === 'by_subject'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Por Asignatura vs. Meta
          </button>
          <button
            type="button"
            onClick={() => setChartViewMode('daily_7d')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              chartViewMode === 'daily_7d'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Evolución 7 Días
          </button>
        </div>
      </div>

      {/* Main Layout: Recharts Visualization (7 cols) + Attention Detector Panel (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Recharts BarChart (7 cols) */}
        <div className="lg:col-span-7 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-4 flex flex-col justify-between">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartViewMode === 'by_subject' ? (
                <BarChart
                  data={subject7DaysMetrics}
                  margin={{ top: 10, right: 16, left: -12, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    unit="h"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${value} horas`,
                      name === 'hoursStudied7d'
                        ? 'Estudiado (últimos 7d)'
                        : 'Meta recomendada (7d)',
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                    formatter={(value) =>
                      value === 'hoursStudied7d'
                        ? 'Horas estudiadas (7 días)'
                        : 'Meta semanal recomendada'
                    }
                  />
                  <Bar
                    dataKey="hoursStudied7d"
                    name="hoursStudied7d"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={38}
                  >
                    {subject7DaysMetrics.map((entry) => (
                      <Cell
                        key={`cell-${entry.subjectId}`}
                        fill={entry.needsAttention ? '#f59e0b' : entry.color}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="targetHours7d"
                    name="targetHours7d"
                    fill="#cbd5e1"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              ) : (
                <BarChart
                  data={dailyStackedData}
                  margin={{ top: 10, right: 16, left: -12, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    unit="h"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  {subjects.map((sub) => (
                    <Bar
                      key={sub.id}
                      dataKey={sub.name}
                      stackId="daily7d"
                      fill={sub.color || '#3b82f6'}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>Color ámbar: Asignatura por debajo del 55% de su meta semanal</span>
            </span>
            <span className="font-mono-numbers">Ventana: últimos 7 días</span>
          </div>
        </div>

        {/* Right: Subjects Needing Attention Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Asignaturas que Necesitan Más Atención</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                Prioridad 7d
              </span>
            </div>

            {subjectsNeedingAttention.length === 0 ? (
              <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  ¡Todas tus materias tienen un reparto equilibrado de horas en los últimos 7 días!
                </span>
              </div>
            ) : (
              subjectsNeedingAttention.map((item) => {
                const isLow = item.hoursStudied7d === 0 || item.needsAttention;
                return (
                  <div
                    key={item.subjectId}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                      isLow
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/90 dark:border-amber-800/70'
                        : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <button
                            type="button"
                            onClick={() => onSelectSubject(item.subjectId)}
                            className="text-xs font-extrabold text-slate-900 dark:text-white hover:text-indigo-600 truncate inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{item.subjectName}</span>
                            <ArrowUpRight className="w-3 h-3 opacity-60" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {item.hoursStudied7d === 0
                            ? `⚠️ Sin horas registradas en los últimos 7 días (${item.pendingTopicsCount} temas pendientes)`
                            : `Estudiado: ${item.hoursStudied7d}h de ${item.targetHours7d}h recomendadas (faltan ${item.deficitHours}h)`}
                        </p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full font-mono-numbers text-[10px] font-bold shrink-0 ${
                          item.hoursStudied7d === 0
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                        }`}
                      >
                        {item.hoursStudied7d}h / {item.targetHours7d}h
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate inline-flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">
                          {item.nextPendingTopic
                            ? `Siguiente: ${item.nextPendingTopic.title}`
                            : `${item.pendingTopicsCount} temas por cubrir`}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          onSelectForPomodoro(item.subjectId, item.nextPendingTopic?.id)
                        }
                        className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Dedicar 25m</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Las sesiones Pomodoro y bloques de estudio actualizan esta gráfica en vivo.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
