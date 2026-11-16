import React, { useState, useMemo } from 'react';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Target,
  Clock,
  CheckCircle2,
  SlidersHorizontal,
  ArrowDownWideNarrow,
} from 'lucide-react';
import {
  Subject,
  StudyPreferences,
  Topic,
  Task,
  SchedulingPriorityLevel,
  TaskPriority,
} from '../types';
import { schedulerService } from '../services/schedulerService';
import { getTodayLocalDateStr } from '../utils/dateUtils';

interface SubjectPriorityDashboardProps {
  subject: Subject;
  preferences?: StudyPreferences;
  onUpdateSubject: (updatedSubject: Subject) => void;
  onOpenGoalAssistant?: () => void;
  onStartPomodoro?: (subjectId: string, topicId?: string) => void;
  onOpenExamsManager?: (subjectId: string) => void;
}

type UnifiedPriorityRow =
  | {
      kind: 'topic';
      key: string;
      id: string;
      title: string;
      subtitle: string;
      manualOrder?: number;
      weightPct: number;
      autoWeightPct: number;
      isCustomWeight: boolean;
      effectiveScore: number;
      nearestDeadline?: string;
      topic: Topic;
      effectiveLevel: 'critica' | 'alta' | 'media' | 'baja';
      smartGoalAligned?: boolean;
    }
  | {
      kind: 'task';
      key: string;
      id: string;
      title: string;
      subtitle: string;
      manualOrder?: number;
      weightPct: number;
      isCustomWeight: boolean;
      effectiveScore: number;
      nearestDeadline?: string;
      task: Task;
      priority: TaskPriority;
    };

export const SubjectPriorityDashboard: React.FC<SubjectPriorityDashboardProps> = ({
  subject,
  preferences,
  onUpdateSubject,
  onOpenGoalAssistant,
  onStartPomodoro,
  onOpenExamsManager,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const [filterKind, setFilterKind] = useState<'all' | 'topics' | 'tasks'>('all');
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [pauseDragKey, setPauseDragKey] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const showSavedFeedback = (msg: string) => {
    setSaveFeedback(msg);
    setTimeout(() => {
      setSaveFeedback((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const unifiedQueue = useMemo<UnifiedPriorityRow[]>(() => {
    const topicRows: UnifiedPriorityRow[] = (subject.topics || [])
      .filter((t) => t.status !== 'estudiado' && t.status !== 'repasado')
      .map((topic) => {
        const pInfo = schedulerService.calculateTopicSchedulingPriority(
          topic,
          {
            id: subject.id,
            subjectName: subject.name,
            exams: subject.exams,
            tasks: subject.tasks,
            projects: subject.projects,
            gradingConfig: subject.gradingConfig,
            topicsCount: (subject.topics || []).length,
          },
          todayStr
        );
        const autoWeightOnly = Math.min(
          100,
          Math.round((pInfo.examWeightPct + pInfo.projectWeightPct + pInfo.taskWeightPct) * 10) / 10
        );
        return {
          kind: 'topic',
          key: `topic::${topic.id}`,
          id: topic.id,
          title: topic.title,
          subtitle: `${topic.pageCount || preferences?.defaultPagesPerTopic || 15} págs · ${topic.estimatedHours}h · ${pInfo.reasons[0] || 'Temario'}`,
          manualOrder: topic.manualPriorityOrder,
          weightPct: pInfo.totalGradeWeightPct,
          autoWeightPct: autoWeightOnly,
          isCustomWeight: topic.customGradeWeightImpact !== undefined,
          effectiveScore: pInfo.effectiveScore,
          nearestDeadline: pInfo.nearestDeadlineDate,
          topic,
          effectiveLevel: pInfo.effectiveLevel,
          smartGoalAligned: pInfo.smartGoalAligned,
        };
      });

    const prioScoreMap: Record<TaskPriority, number> = {
      urgente: 180,
      alta: 130,
      media: 80,
      baja: 30,
    };

    const taskRows: UnifiedPriorityRow[] = (subject.tasks || [])
      .filter((tk) => !tk.completed)
      .map((task) => {
        const linkedTopic = task.topicId
          ? (subject.topics || []).find((t) => t.id === task.topicId)
          : undefined;
        const w = task.weightPercentage ?? 0;
        const manualBonus =
          typeof task.manualPriorityOrder === 'number' && task.manualPriorityOrder > 0
            ? Math.max(50, 600 - task.manualPriorityOrder * 15)
            : 0;
        const deadlineDays =
          task.dueDate >= todayStr
            ? Math.max(
                0,
                Math.round(
                  (new Date(task.dueDate).getTime() - new Date(todayStr).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              )
            : 0;
        const urgencyBoost = deadlineDays <= 3 ? 40 : deadlineDays <= 7 ? 24 : 8;
        const score = Math.round((w * 1.4 + (prioScoreMap[task.priority] || 60) + urgencyBoost + manualBonus) * 10) / 10;

        return {
          kind: 'task',
          key: `task::${task.id}`,
          id: task.id,
          title: task.title,
          subtitle: `Entrega: ${task.dueDate}${task.scheduledTime ? ` (${task.scheduledTime})` : ''}${
            linkedTopic ? ` · Tema: ${linkedTopic.title}` : ''
          }${task.smartGoalTitle ? ` · SMART: ${task.smartGoalTitle}` : ''}`,
          manualOrder: task.manualPriorityOrder,
          weightPct: w,
          isCustomWeight: task.weightPercentage !== undefined,
          effectiveScore: score,
          nearestDeadline: task.dueDate,
          task,
          priority: task.priority,
        };
      });

    const combined = [...topicRows, ...taskRows];
    combined.sort((a, b) => {
      if (
        typeof a.manualOrder === 'number' &&
        typeof b.manualOrder === 'number' &&
        a.manualOrder !== b.manualOrder
      ) {
        return a.manualOrder - b.manualOrder;
      }
      if (typeof a.manualOrder === 'number' && typeof b.manualOrder !== 'number') return -1;
      if (typeof a.manualOrder !== 'number' && typeof b.manualOrder === 'number') return 1;
      if (Math.abs(b.effectiveScore - a.effectiveScore) >= 0.5) {
        return b.effectiveScore - a.effectiveScore;
      }
      return b.weightPct - a.weightPct;
    });

    return combined;
  }, [subject, preferences, todayStr]);

  const visibleRows = useMemo(() => {
    if (filterKind === 'topics') return unifiedQueue.filter((r) => r.kind === 'topic');
    if (filterKind === 'tasks') return unifiedQueue.filter((r) => r.kind === 'task');
    return unifiedQueue;
  }, [unifiedQueue, filterKind]);

  const summaryStats = useMemo(() => {
    const topicsCount = unifiedQueue.filter((r) => r.kind === 'topic').length;
    const tasksCount = unifiedQueue.filter((r) => r.kind === 'task').length;
    const manualCount = unifiedQueue.filter((r) => typeof r.manualOrder === 'number').length;
    const totalTopicWeight = unifiedQueue
      .filter((r) => r.kind === 'topic')
      .reduce((acc, r) => acc + r.weightPct, 0);
    const totalTaskWeight = unifiedQueue
      .filter((r) => r.kind === 'task')
      .reduce((acc, r) => acc + r.weightPct, 0);
    return {
      topicsCount,
      tasksCount,
      manualCount,
      totalWeightDisplay: Math.round(Math.max(totalTopicWeight, totalTaskWeight) * 10) / 10,
      firstItem: unifiedQueue[0],
    };
  }, [unifiedQueue]);

  const persistOrderedQueue = (orderedList: UnifiedPriorityRow[], message: string) => {
    const topicRankMap = new Map<string, number>();
    const taskRankMap = new Map<string, number>();

    orderedList.forEach((row, idx) => {
      const rank = idx + 1;
      if (row.kind === 'topic') {
        topicRankMap.set(row.id, rank);
      } else {
        taskRankMap.set(row.id, rank);
      }
    });

    const updatedTopics = subject.topics.map((t) =>
      topicRankMap.has(t.id) ? { ...t, manualPriorityOrder: topicRankMap.get(t.id) } : t
    );
    const updatedTasks = subject.tasks.map((tk) =>
      taskRankMap.has(tk.id) ? { ...tk, manualPriorityOrder: taskRankMap.get(tk.id) } : tk
    );

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
      tasks: updatedTasks,
    });
    showSavedFeedback(message);
  };

  const handleReorderByKeys = (sourceKey: string, targetKey: string) => {
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    const fullCopy = [...unifiedQueue];
    const fromIdx = fullCopy.findIndex((r) => r.key === sourceKey);
    const toIdx = fullCopy.findIndex((r) => r.key === targetKey);
    if (fromIdx < 0 || toIdx < 0) return;

    const [moved] = fullCopy.splice(fromIdx, 1);
    fullCopy.splice(toIdx, 0, moved);
    persistOrderedQueue(
      fullCopy,
      `Orden actualizado: "${moved.title}" en posición #${toIdx + 1} para auto-planificación.`
    );
  };

  const handleMoveStep = (key: string, direction: -1 | 1) => {
    const visibleIdx = visibleRows.findIndex((r) => r.key === key);
    const targetVisibleIdx = visibleIdx + direction;
    if (visibleIdx < 0 || targetVisibleIdx < 0 || targetVisibleIdx >= visibleRows.length) return;
    handleReorderByKeys(key, visibleRows[targetVisibleIdx].key);
  };

  const handleSortByWeightDesc = () => {
    const sorted = [...unifiedQueue].sort((a, b) => {
      if (b.weightPct !== a.weightPct) return b.weightPct - a.weightPct;
      return (a.nearestDeadline || '9999-12-31').localeCompare(b.nearestDeadline || '9999-12-31');
    });
    persistOrderedQueue(sorted, 'Cola ordenada automáticamente de mayor a menor % en la nota final.');
  };

  const handleResetAutoOrder = () => {
    const updatedTopics = subject.topics.map((t) => ({
      ...t,
      manualPriorityOrder: undefined,
    }));
    const updatedTasks = subject.tasks.map((tk) => ({
      ...tk,
      manualPriorityOrder: undefined,
    }));
    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
      tasks: updatedTasks,
    });
    showSavedFeedback('Orden manual restablecido: el planificador usará el cálculo automático (% nota + fechas + metas SMART).');
  };

  const handleUpdateTopicWeight = (topicId: string, rawValue: string) => {
    const trimmed = rawValue.trim();
    const numeric = trimmed === '' ? undefined : Math.max(0, Math.min(100, Number(trimmed)));
    if (numeric !== undefined && isNaN(numeric)) return;
    const updatedTopics = subject.topics.map((t) =>
      t.id === topicId ? { ...t, customGradeWeightImpact: numeric } : t
    );
    onUpdateSubject({ ...subject, topics: updatedTopics });
  };

  const handleUpdateTopicLevel = (topicId: string, level: SchedulingPriorityLevel) => {
    const updatedTopics = subject.topics.map((t) =>
      t.id === topicId ? { ...t, schedulingPriority: level } : t
    );
    onUpdateSubject({ ...subject, topics: updatedTopics });
  };

  const handleUpdateTaskWeight = (taskId: string, rawValue: string) => {
    const trimmed = rawValue.trim();
    const numeric = trimmed === '' ? undefined : Math.max(0, Math.min(100, Number(trimmed)));
    if (numeric !== undefined && isNaN(numeric)) return;
    const updatedTasks = subject.tasks.map((tk) =>
      tk.id === taskId
        ? {
            ...tk,
            weightPercentage: numeric,
            isGraded: numeric !== undefined ? numeric > 0 : tk.isGraded,
          }
        : tk
    );
    onUpdateSubject({ ...subject, tasks: updatedTasks });
  };

  const handleUpdateTaskPriority = (taskId: string, nextPriority: TaskPriority) => {
    const updatedTasks = subject.tasks.map((tk) =>
      tk.id === taskId ? { ...tk, priority: nextPriority } : tk
    );
    onUpdateSubject({ ...subject, tasks: updatedTasks });
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Panel de Prioridad y Peso Académico (Drag & Drop)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Arrastra temas y tareas o ajusta su % en la nota final para definir qué entra primero en tu calendario automático.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenGoalAssistant && (
            <button
              type="button"
              onClick={onOpenGoalAssistant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Asistente SMART</span>
            </button>
          )}
          {onOpenExamsManager && (
            <button
              type="button"
              onClick={() => onOpenExamsManager(subject.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Ponderación de Exámenes</span>
            </button>
          )}
        </div>
      </div>

      {/* Flat hairline summary strip (single elevation, tabular numbers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-3.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            Elementos activos en cola
          </span>
          <span className="text-base font-bold font-mono-numbers text-slate-900 dark:text-white mt-0.5 block">
            {summaryStats.topicsCount} temas · {summaryStats.tasksCount} tareas
          </span>
        </div>
        <div className="p-3.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            Carga ponderada visible
          </span>
          <span className="text-base font-bold font-mono-numbers text-slate-900 dark:text-white mt-0.5 block">
            {summaryStats.totalWeightDisplay}% nota en juego
          </span>
        </div>
        <div className="p-3.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            Modo de cola
          </span>
          <span className="text-base font-bold font-mono-numbers text-slate-900 dark:text-white mt-0.5 block">
            {summaryStats.manualCount > 0
              ? `${summaryStats.manualCount} orden manual`
              : '100% automático'}
          </span>
        </div>
        <div className="p-3.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            Siguiente en agendar (#1)
          </span>
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 mt-1 block truncate">
            {summaryStats.firstItem ? summaryStats.firstItem.title : 'Todo completado'}
          </span>
        </div>
      </div>

      {/* Filter Segmented Bar + Bulk Sort Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          {(
            [
              { id: 'all', label: `Todos (${unifiedQueue.length})` },
              { id: 'topics', label: `Temas (${summaryStats.topicsCount})` },
              { id: 'tasks', label: `Tareas (${summaryStats.tasksCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterKind(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filterKind === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSortByWeightDesc}
            disabled={unifiedQueue.length < 2}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <ArrowDownWideNarrow className="w-3.5 h-3.5 text-blue-600" />
            <span>Ordenar por % Nota</span>
          </button>

          {summaryStats.manualCount > 0 && (
            <button
              type="button"
              onClick={handleResetAutoOrder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Automático</span>
            </button>
          )}
        </div>
      </div>

      {saveFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* Drag & Drop Priority List */}
      {visibleRows.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            No hay elementos pendientes en esta vista
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Añade nuevos temas al temario o crea tareas vinculadas a tus Objetivos SMART para priorizarlos aquí.
          </p>
          {onOpenGoalAssistant && (
            <button
              type="button"
              onClick={onOpenGoalAssistant}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Crear Meta y Tareas con Asistente SMART</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
          {visibleRows.map((row, idx) => {
            const isDragging = draggedKey === row.key;
            const isDragOver = dragOverKey === row.key && draggedKey !== row.key;
            const weightFillPct = Math.max(4, Math.min(100, row.weightPct));

            return (
              <div
                key={row.key}
                draggable={pauseDragKey !== row.key}
                onDragStart={(e) => {
                  setDraggedKey(row.key);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', row.key);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverKey !== row.key) {
                    setDragOverKey(row.key);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverKey === row.key) {
                    setDragOverKey(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceKey = draggedKey || e.dataTransfer.getData('text/plain');
                  setDraggedKey(null);
                  setDragOverKey(null);
                  if (sourceKey) {
                    handleReorderByKeys(sourceKey, row.key);
                  }
                }}
                onDragEnd={() => {
                  setDraggedKey(null);
                  setDragOverKey(null);
                }}
                className={`px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors ${
                  isDragging
                    ? 'opacity-50 bg-slate-50 dark:bg-slate-800'
                    : isDragOver
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500'
                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Left: Drag Handle + Rank + Kind + Title + Unboxed Metadata */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div
                    className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing shrink-0 pt-0.5 sm:pt-0"
                    title="Arrastra esta fila para reordenar su prioridad en la auto-planificación"
                  >
                    <GripVertical className="w-4 h-4" />
                    <span className="w-7 text-xs font-mono-numbers font-bold text-slate-700 dark:text-slate-300">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span
                        className={`font-semibold ${
                          row.kind === 'topic'
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {row.kind === 'topic' ? 'Tema' : 'Tarea'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-numbers">
                        {row.manualOrder ? 'Orden manual' : 'Cálculo automático'}
                      </span>
                      {row.kind === 'topic' && row.smartGoalAligned && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                            Objetivo SMART
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                      {row.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono-numbers">
                      {row.subtitle}
                    </div>
                  </div>
                </div>

                {/* Right: Grade Weight %, Priority Dropdown & Accessible Move Buttons */}
                <div
                  className="flex flex-wrap items-center gap-2.5 shrink-0 pl-9 lg:pl-0"
                  onMouseEnter={() => setPauseDragKey(row.key)}
                  onMouseLeave={() => setPauseDragKey(null)}
                >
                  {/* Academic Weight Control */}
                  <div className="flex items-center gap-2">
                    <div className="w-20 hidden sm:block">
                      <div className="flex items-center justify-between text-[10px] font-mono-numbers text-slate-500 dark:text-slate-400 mb-1">
                        <span>Peso</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {row.weightPct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            row.weightPct >= 30
                              ? 'bg-rose-500'
                              : row.weightPct >= 15
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${weightFillPct}%` }}
                        />
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        aria-label={`Peso académico de ${row.title}`}
                        value={
                          row.kind === 'topic'
                            ? row.topic.customGradeWeightImpact ?? ''
                            : row.task.weightPercentage ?? ''
                        }
                        placeholder={String(row.weightPct)}
                        onChange={(e) =>
                          row.kind === 'topic'
                            ? handleUpdateTopicWeight(row.id, e.target.value)
                            : handleUpdateTaskWeight(row.id, e.target.value)
                        }
                        className="w-11 bg-transparent font-mono-numbers font-bold text-right text-slate-900 dark:text-white focus:outline-none"
                      />
                      <span className="text-slate-400 font-mono-numbers">%</span>
                    </label>

                    {row.kind === 'topic' && row.topic.customGradeWeightImpact !== undefined && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTopicWeight(row.id, '')}
                        className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title={`Restablecer al peso automático (${row.autoWeightPct}%)`}
                      >
                        Auto
                      </button>
                    )}
                  </div>

                  {/* Level / Priority Control */}
                  {row.kind === 'topic' ? (
                    <select
                      value={row.topic.schedulingPriority || 'auto'}
                      onChange={(e) =>
                        handleUpdateTopicLevel(row.id, e.target.value as SchedulingPriorityLevel)
                      }
                      aria-label={`Prioridad de ${row.title}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
                    >
                      <option value="auto">Auto ({row.effectiveLevel})</option>
                      <option value="critica">Crítica</option>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  ) : (
                    <select
                      value={row.priority}
                      onChange={(e) =>
                        handleUpdateTaskPriority(row.id, e.target.value as TaskPriority)
                      }
                      aria-label={`Prioridad de tarea ${row.title}`}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
                    >
                      <option value="urgente">Urgente</option>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                  )}

                  {/* Reorder Up/Down Buttons (Touch & Keyboard accessibility) */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(row.key, -1)}
                      aria-label={`Subir prioridad de ${row.title}`}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === visibleRows.length - 1}
                      onClick={() => handleMoveStep(row.key, 1)}
                      aria-label={`Bajar prioridad de ${row.title}`}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {row.kind === 'topic' && onStartPomodoro && (
                    <button
                      type="button"
                      onClick={() => onStartPomodoro(subject.id, row.id)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                      title="Iniciar Pomodoro en este tema"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
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
