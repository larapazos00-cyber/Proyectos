import React, { useState, useMemo, useEffect } from 'react';
import {
  Target,
  Plus,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Minus,
} from 'lucide-react';
import { Subject, SubjectSmartGoal } from '../types';
import {
  getSubjectSmartGoals,
  calculateSmartGoalProgress,
  upsertGoalOnSubject,
} from '../utils/smartGoalsUtils';

interface SmartGoalsDashboardCardProps {
  subjects: Subject[];
  onUpdateSubject?: (updated: Subject) => void;
  onSelectSubjectSmartGoals?: (subjectId: string) => void;
  onOpenCreateGoal?: (subjectId?: string) => void;
}

export const SmartGoalsDashboardCard: React.FC<SmartGoalsDashboardCardProps> = ({
  subjects,
  onUpdateSubject,
  onSelectSubjectSmartGoals,
  onOpenCreateGoal,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('all');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [storageRevision, setStorageRevision] = useState<number>(0);

  useEffect(() => {
    const bump = () => setStorageRevision((prev) => prev + 1);
    window.addEventListener('studyflow-smart-goals-updated', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('studyflow-smart-goals-updated', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const allGoalItems = useMemo(() => {
    const list: Array<{
      subject: Subject;
      goal: SubjectSmartGoal;
      progress: ReturnType<typeof calculateSmartGoalProgress>;
    }> = [];

    subjects.forEach((sub) => {
      const subGoals = getSubjectSmartGoals(sub);
      subGoals.forEach((goal) => {
        list.push({
          subject: sub,
          goal,
          progress: calculateSmartGoalProgress(goal, sub),
        });
      });
    });

    // Sort active & closest deadlines first, completed last
    return list.sort((a, b) => {
      const aDone = a.progress.pct >= 100 ? 1 : 0;
      const bDone = b.progress.pct >= 100 ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const da = a.progress.daysRemaining ?? 999;
      const db = b.progress.daysRemaining ?? 999;
      return da - db;
    });
  }, [subjects, storageRevision]);

  const filteredItems = useMemo(() => {
    if (filterMode === 'completed') {
      return allGoalItems.filter((item) => item.progress.pct >= 100);
    }
    if (filterMode === 'active') {
      return allGoalItems.filter((item) => item.progress.pct < 100);
    }
    return allGoalItems;
  }, [allGoalItems, filterMode]);

  const summaryStats = useMemo(() => {
    const total = allGoalItems.length;
    const completedGoals = allGoalItems.filter((i) => i.progress.pct >= 100).length;
    const avgPct =
      total > 0
        ? Math.round(allGoalItems.reduce((acc, i) => acc + i.progress.pct, 0) / total)
        : 0;
    const totalMilestones = allGoalItems.reduce(
      (acc, i) => acc + i.progress.totalMilestones,
      0
    );
    const completedMilestones = allGoalItems.reduce(
      (acc, i) => acc + i.progress.completedMilestones,
      0
    );
    const coveredSubjects = new Set(allGoalItems.map((i) => i.subject.id)).size;

    return {
      total,
      completedGoals,
      avgPct,
      totalMilestones,
      completedMilestones,
      coveredSubjects,
    };
  }, [allGoalItems]);

  const handleToggleMilestone = (
    sub: Subject,
    goal: SubjectSmartGoal,
    milestoneId: string
  ) => {
    if (!onUpdateSubject) return;
    const updatedMilestones = goal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );
    const nextGoal: SubjectSmartGoal = {
      ...goal,
      milestones: updatedMilestones,
      updatedAt: new Date().toISOString(),
    };
    const updatedSubject = upsertGoalOnSubject(sub, nextGoal, subjects);
    onUpdateSubject(updatedSubject);
  };

  const handleStepNumeric = (
    sub: Subject,
    goal: SubjectSmartGoal,
    delta: number
  ) => {
    if (!onUpdateSubject || !goal.targetValue || goal.targetValue <= 0) return;
    const nextVal = Math.max(
      0,
      Math.min(goal.targetValue, (goal.currentValue || 0) + delta)
    );
    const nextGoal: SubjectSmartGoal = {
      ...goal,
      currentValue: nextVal,
      updatedAt: new Date().toISOString(),
    };
    const updatedSubject = upsertGoalOnSubject(sub, nextGoal, subjects);
    onUpdateSubject(updatedSubject);
  };

  const ringRadius = 18;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (summaryStats.avgPct / 100) * ringCirc;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
      {/* Header Row with Progress Ring, Metadata & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Visual SVG Progress Ring */}
          <div className="w-12 h-12 relative flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-slate-100 dark:text-slate-800"
              />
              <circle
                cx="22"
                cy="22"
                r={ringRadius}
                fill="none"
                stroke={summaryStats.avgPct >= 100 ? '#16a34a' : '#2563eb'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={ringCirc}
                strokeDashoffset={ringOffset}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute text-[11px] font-bold font-mono-numbers tabular-nums text-slate-900 dark:text-white">
              {summaryStats.avgPct}%
            </span>
          </div>

          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Progreso de Objetivos SMART por Asignatura
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap font-mono-numbers tabular-nums">
              <span>
                {summaryStats.completedGoals}/{summaryStats.total} completados
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {summaryStats.completedMilestones}/{summaryStats.totalMilestones} hitos
              </span>
              <span aria-hidden="true">·</span>
              <span>{summaryStats.coveredSubjects} asignaturas con meta</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {summaryStats.total > 0 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'active', label: 'En curso' },
                  { id: 'completed', label: 'Logrados' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    filterMode === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {onOpenCreateGoal && (
            <button
              type="button"
              onClick={() => onOpenCreateGoal(subjects[0]?.id)}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Definir Objetivo SMART</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State or Visual Subject SMART Cards */}
      {summaryStats.total === 0 ? (
        <div className="py-6 px-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Todavía no has definido objetivos SMART para tus asignaturas
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                Define metas Específicas, Medibles, Alcanzables, Relevantes y Temporales desde Cursos o aquí mismo para ver su progreso visual en el panel general.
              </p>
            </div>
          </div>

          {onOpenCreateGoal && subjects.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenCreateGoal(subjects[0].id)}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear primer Objetivo</span>
            </button>
          )}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          No hay objetivos SMART en la vista seleccionada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map(({ subject: sub, goal, progress }) => {
            const subColor = sub.color || '#3b82f6';
            const isExpanded = expandedGoalId === goal.id;
            const deadlineLabel =
              progress.status === 'completed'
                ? 'Completado'
                : progress.daysRemaining === null
                ? goal.timeBound
                : progress.daysRemaining < 0
                ? `Vencido ${Math.abs(progress.daysRemaining)}d`
                : progress.daysRemaining === 0
                ? 'Vence hoy'
                : `En ${progress.daysRemaining}d`;

            return (
              <div
                key={goal.id}
                className="p-4 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  {/* Top unboxed metadata row */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onSelectSubjectSmartGoals?.(sub.id)}
                      className="inline-flex items-center gap-1.5 min-w-0 font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      title={`Ver objetivos SMART en ${sub.name}`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: subColor }}
                      />
                      <span className="truncate">{sub.name}</span>
                      <ArrowRight className="w-3 h-3 opacity-60 shrink-0" />
                    </button>

                    <span
                      className={`font-mono-numbers tabular-nums font-semibold shrink-0 ${
                        progress.status === 'completed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : progress.status === 'overdue'
                          ? 'text-rose-600 dark:text-rose-400'
                          : progress.status === 'due_soon'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {deadlineLabel}
                    </span>
                  </div>

                  {/* Goal Title & % */}
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {goal.title}
                    </h4>
                    <span className="text-sm font-bold font-mono-numbers tabular-nums text-slate-900 dark:text-white shrink-0">
                      {progress.pct}%
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress.pct}%`,
                        backgroundColor: progress.pct >= 100 ? '#16a34a' : subColor,
                      }}
                    />
                  </div>

                  {/* Numeric Counter (if numeric goal configured) */}
                  {goal.targetValue !== undefined && goal.targetValue > 0 && (
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-slate-500 dark:text-slate-400 font-mono-numbers tabular-nums">
                        {goal.currentValue || 0} / {goal.targetValue} {goal.metricLabel || 'unidades'}
                      </span>
                      {onUpdateSubject && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStepNumeric(sub, goal, -1)}
                            className="p-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                            aria-label="Disminuir avance"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepNumeric(sub, goal, 1)}
                            className="p-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            aria-label="Incrementar avance"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Interactive Milestones */}
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {goal.milestones.slice(0, isExpanded ? goal.milestones.length : 2).map((m) => (
                        <label
                          key={m.id}
                          className="flex items-start gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={m.completed}
                            disabled={!onUpdateSubject}
                            onChange={() => handleToggleMilestone(sub, goal, m.id)}
                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span
                            className={`truncate ${
                              m.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                            }`}
                          >
                            {m.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer: Toggle full S.M.A.R.T criteria + milestone count */}
                <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono-numbers tabular-nums">
                      {progress.completedMilestones}/{progress.totalMilestones} hitos
                      {progress.linkedTasksTotal > 0
                        ? ` · ${progress.linkedTasksDone}/${progress.linkedTasksTotal} tareas`
                        : ''}
                    </span>

                    <button
                      type="button"
                      onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                      className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      <span>{isExpanded ? 'Ocultar S·M·A·R·T' : 'Ver S·M·A·R·T'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                      <div>
                        <strong className="text-slate-800 dark:text-slate-100">S · Específico:</strong>{' '}
                        {goal.specific}
                      </div>
                      <div>
                        <strong className="text-slate-800 dark:text-slate-100">M · Medible:</strong>{' '}
                        {goal.measurable}
                      </div>
                      <div>
                        <strong className="text-slate-800 dark:text-slate-100">A · Alcanzable:</strong>{' '}
                        {goal.achievable}
                      </div>
                      <div>
                        <strong className="text-slate-800 dark:text-slate-100">R · Relevante:</strong>{' '}
                        {goal.relevant}
                      </div>
                      <div>
                        <strong className="text-slate-800 dark:text-slate-100">T · Temporal:</strong>{' '}
                        {goal.timeBound}
                        {goal.targetDate ? ` (${goal.targetDate})` : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
