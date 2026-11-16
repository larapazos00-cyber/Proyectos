import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCw,
  AlertTriangle,
  BarChart3,
  Plus,
  Trash2,
  CheckCircle2,
  BookOpen,
  X,
  Calendar,
  Clock,
  CheckSquare,
} from 'lucide-react';
import { Subject, StudyPreferences, BlockedTimeEvent, Task, TaskPriority } from '../types';
import { schedulerService } from '../services/schedulerService';
import { getTodayLocalDateStr } from '../utils/dateUtils';
import { GoalAssistantModal } from './GoalAssistantModal';

export interface SmartGoalEntry {
  id: string;
  title: string;
  subjectName: string;
  priority: 'alta' | 'media' | 'baja';
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
  milestones: string[];
}

export interface SmartGoalsStoredData {
  workloadDiagnosis: string;
  recommendedWeeklyHours: number;
  generatedAt?: string;
  timeframe?: 'semanal' | 'mensual' | 'examenes';
  smartGoals: SmartGoalEntry[];
}

interface SmartGoalsCollapsibleSectionProps {
  subjects: Subject[];
  preferences: StudyPreferences;
  blockedEvents?: BlockedTimeEvent[];
  isExpandedExternal?: boolean;
  onToggleExpandExternal?: () => void;
  onApplyDailyGoalHours?: (dailyHours: number) => void;
  onSelectSubject?: (subjectId: string) => void;
  onAddTaskToSubject?: (subjectId: string, task: Task) => void;
  onTaskScheduledToCalendar?: (subjectId: string, task: Task) => void;
}

const STORAGE_GOALS_KEY = 'studyflow_smart_goals_v1';
const STORAGE_MILESTONES_KEY = 'studyflow_smart_milestones_v1';

const computeTaskEndTimeStr = (startTime: string, durationMinutes: number): string => {
  const [h, m] = (startTime || '16:00').split(':').map(Number);
  const startTotal = (h || 0) * 60 + (m || 0);
  const endTotal = Math.min(23 * 60 + 55, startTotal + Math.max(15, durationMinutes || 60));
  return `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
};

export const SmartGoalsCollapsibleSection: React.FC<SmartGoalsCollapsibleSectionProps> = ({
  subjects,
  preferences,
  blockedEvents = [],
  isExpandedExternal,
  onToggleExpandExternal,
  onApplyDailyGoalHours,
  onSelectSubject,
  onAddTaskToSubject,
  onTaskScheduledToCalendar,
}) => {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(false);
  const isExpanded = isExpandedExternal !== undefined ? isExpandedExternal : internalExpanded;

  const handleToggleExpand = () => {
    if (onToggleExpandExternal) {
      onToggleExpandExternal();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const [smartGoalsTimeframe, setSmartGoalsTimeframe] = useState<
    'semanal' | 'mensual' | 'examenes'
  >('semanal');
  const [isGeneratingSmartGoals, setIsGeneratingSmartGoals] = useState<boolean>(false);
  const [smartGoalsError, setSmartGoalsError] = useState<string | null>(null);
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);
  const [isGoalAssistantOpen, setIsGoalAssistantOpen] = useState<boolean>(false);

  // Manual SMART Goal creation form state
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualSubjectName, setManualSubjectName] = useState<string>(
    subjects[0]?.name || 'General'
  );
  const [manualPriority, setManualPriority] = useState<'alta' | 'media' | 'baja'>('alta');
  const [manualSpecific, setManualSpecific] = useState<string>('');
  const [manualMeasurable, setManualMeasurable] = useState<string>('');
  const [manualAchievable, setManualAchievable] = useState<string>('');
  const [manualRelevant, setManualRelevant] = useState<string>('');
  const [manualTimeBound, setManualTimeBound] = useState<string>('En los próximos 7 días');
  const [manualMilestonesText, setManualMilestonesText] = useState<string>('');

  // Inline Create Task + Add to Calendar state per SMART goal
  const [taskComposerGoalKey, setTaskComposerGoalKey] = useState<string | null>(null);
  const [taskDraftSubjectId, setTaskDraftSubjectId] = useState<string>('');
  const [taskDraftTopicId, setTaskDraftTopicId] = useState<string>('');
  const [taskDraftTitle, setTaskDraftTitle] = useState<string>('');
  const [taskDraftDate, setTaskDraftDate] = useState<string>(() => getTodayLocalDateStr());
  const [taskDraftAddToCalendar, setTaskDraftAddToCalendar] = useState<boolean>(true);
  const [taskDraftStartTime, setTaskDraftStartTime] = useState<string>('17:00');
  const [taskDraftDurationMins, setTaskDraftDurationMins] = useState<number>(60);
  const [taskDraftPriority, setTaskDraftPriority] = useState<TaskPriority>('alta');

  const loadStoredGoals = (): SmartGoalsStoredData | null => {
    try {
      const saved = localStorage.getItem(STORAGE_GOALS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const loadStoredMilestones = (): Record<string, boolean> => {
    try {
      const saved = localStorage.getItem(STORAGE_MILESTONES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const [smartGoalsData, setSmartGoalsData] = useState<SmartGoalsStoredData | null>(
    loadStoredGoals
  );
  const [completedMilestones, setCompletedMilestones] = useState<Record<string, boolean>>(
    loadStoredMilestones
  );

  useEffect(() => {
    const syncFromStorage = () => {
      setSmartGoalsData(loadStoredGoals());
      setCompletedMilestones(loadStoredMilestones());
    };
    window.addEventListener('studyflow-smart-goals-updated', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('studyflow-smart-goals-updated', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const saveGoalsToStorage = (nextData: SmartGoalsStoredData | null) => {
    setSmartGoalsData(nextData);
    try {
      if (nextData) {
        localStorage.setItem(STORAGE_GOALS_KEY, JSON.stringify(nextData));
      } else {
        localStorage.removeItem(STORAGE_GOALS_KEY);
      }
      window.dispatchEvent(new CustomEvent('studyflow-smart-goals-updated'));
    } catch {
      // ignore storage errors
    }
  };

  const handleToggleMilestone = (goalId: string, milestoneIdx: number) => {
    const key = `${goalId}__${milestoneIdx}`;
    setCompletedMilestones((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_MILESTONES_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('studyflow-smart-goals-updated'));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  const handleDeleteGoal = (goalId: string, fallbackIdx: number) => {
    if (!smartGoalsData) return;
    const updatedGoals = (smartGoalsData.smartGoals || []).filter(
      (g, idx) => (g.id || String(idx)) !== (goalId || String(fallbackIdx))
    );
    saveGoalsToStorage({
      ...smartGoalsData,
      smartGoals: updatedGoals,
    });
  };

  const handleCreateManualGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualSpecific.trim()) return;

    const milestones = manualMilestonesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const newGoal: SmartGoalEntry = {
      id: `smart-manual-${Date.now()}`,
      title: manualTitle.trim(),
      subjectName: manualSubjectName.trim() || 'General',
      priority: manualPriority,
      specific: manualSpecific.trim(),
      measurable:
        manualMeasurable.trim() ||
        'Completar el 100% de los bloques planificados y verificar retención.',
      achievable:
        manualAchievable.trim() ||
        `Ajustado a la disponibilidad real de ${dailyNeeds.realAvailableHoursDaily}h/día libres.`,
      relevant:
        manualRelevant.trim() ||
        'Clave para consolidar el temario y llegar con margen a los repasos espaciados.',
      timeBound: manualTimeBound.trim() || '7 días',
      milestones:
        milestones.length > 0
          ? milestones
          : [
              `Completar estudio activo de: ${manualTitle.trim()}`,
              'Realizar 1er repaso espaciado (R1) y autoevaluación',
            ],
    };

    const currentList = smartGoalsData?.smartGoals || [];
    const nextData: SmartGoalsStoredData = {
      workloadDiagnosis:
        smartGoalsData?.workloadDiagnosis ||
        `Plan activo con ${subjects.length} asignaturas y ${dailyNeeds.realAvailableHoursDaily}h/día disponibles.`,
      recommendedWeeklyHours:
        smartGoalsData?.recommendedWeeklyHours ||
        Math.round((preferences.dailyGoalHours || 4) * 5),
      generatedAt: new Date().toISOString(),
      timeframe: smartGoalsTimeframe,
      smartGoals: [newGoal, ...currentList],
    };

    saveGoalsToStorage(nextData);
    setManualTitle('');
    setManualSpecific('');
    setManualMeasurable('');
    setManualAchievable('');
    setManualRelevant('');
    setManualMilestonesText('');
    setShowManualForm(false);
  };

  // Calculate daily study & review needs from current subjects & calendar blocks
  const dailyNeeds = useMemo(() => {
    return schedulerService.calculateDailyStudyAndReviewNeeds(
      subjects,
      preferences,
      blockedEvents,
      preferences.weeklyFixedObligations || []
    );
  }, [subjects, preferences, blockedEvents]);

  const academicSummaryMetrics = useMemo(() => {
    const allTopics = subjects.flatMap((s) => s.topics || []);
    const totalTopics = allTopics.length;
    const completedTopics = allTopics.filter(
      (t) => t.status === 'estudiado' || t.status === 'repasado'
    ).length;
    const completionPct =
      totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    const remainingHours =
      Math.round(
        subjects.reduce(
          (acc, s) =>
            acc +
            schedulerService.calculateSubjectAcademicProgress(s.topics || []).remainingHours,
          0
        ) * 10
      ) / 10;

    return {
      totalTopics,
      completedTopics,
      completionPct,
      remainingHours,
    };
  }, [subjects]);

  // Global milestone progress across current SMART goals
  const milestoneStats = useMemo(() => {
    const goals = smartGoalsData?.smartGoals || [];
    let total = 0;
    let completed = 0;
    goals.forEach((g, idx) => {
      const mList = g.milestones || [];
      mList.forEach((_, mIdx) => {
        total += 1;
        if (completedMilestones[`${g.id || idx}__${mIdx}`]) {
          completed += 1;
        }
      });
    });
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      goalsCount: goals.length,
      totalMilestones: total,
      completedMilestones: completed,
      pct,
    };
  }, [smartGoalsData, completedMilestones]);

  const handleGenerateSmartGoals = async () => {
    setIsGeneratingSmartGoals(true);
    setSmartGoalsError(null);

    try {
      const subjectsSummary = subjects.map((sub) => {
        const prog = schedulerService.calculateSubjectAcademicProgress(sub.topics || []);
        const upcomingExams = (sub.exams || [])
          .filter((ex) => ex.date >= new Date().toISOString().split('T')[0])
          .sort((a, b) => a.date.localeCompare(b.date));
        const nextExam = upcomingExams[0];
        const pendingTopics = (sub.topics || []).filter(
          (t) => t.status === 'pendiente' || t.status === 'en_progreso'
        ).length;
        const studiedTopics = (sub.topics || []).filter(
          (t) => t.status === 'estudiado' || t.status === 'repasado'
        ).length;

        return {
          name: sub.name,
          code: sub.code || '',
          credits: sub.credits || 6,
          totalTopics: (sub.topics || []).length,
          studiedTopics,
          pendingTopics,
          progressPercentage: prog.progressPct,
          remainingHours: prog.remainingHours,
          nextExamDate: nextExam ? `${nextExam.title} (${nextExam.date})` : 'Sin fecha asignada',
          pendingTasksCount: (sub.tasks || []).filter((tk) => !tk.completed).length,
          unresolvedErrorsCount: (sub.errorLogs || []).filter((er) => !er.resolved).length,
        };
      });

      const response = await fetch('/api/gemini/generate-smart-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programName: subjects[0]?.programName || 'Planificación y Repasos',
          yearName: 'Curso Activo',
          targetWeeklyHours: Math.round((preferences.dailyGoalHours || 4) * 5),
          dailyAvailableHours: dailyNeeds.realAvailableHoursDaily || 4,
          blockedWeeklyHours: dailyNeeds.totalBlockedHoursWeekly || 0,
          focusTimeframe: smartGoalsTimeframe,
          subjectsSummary,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || 'No se pudieron generar los objetivos SMART.');
      }

      const data = await response.json();
      const enriched: SmartGoalsStoredData = {
        ...data,
        generatedAt: new Date().toISOString(),
        timeframe: smartGoalsTimeframe,
      };
      saveGoalsToStorage(enriched);
    } catch (error: any) {
      setSmartGoalsError(error?.message || 'Error al conectar con el motor de IA.');
    } finally {
      setIsGeneratingSmartGoals(false);
    }
  };

  const handleApplyRecommendedHoursToPlan = (weeklyHours: number) => {
    const daily = Math.max(1, Math.min(12, Math.round((weeklyHours / 5) * 2) / 2));
    if (onApplyDailyGoalHours) {
      onApplyDailyGoalHours(daily);
      setAppliedFeedback(
        `✓ Meta aplicada al Plan y Repasos: ${daily}h/día (~${weeklyHours}h/semana).`
      );
      setTimeout(() => setAppliedFeedback(null), 4500);
    }
  };

  const handleOpenGoalTaskComposer = (
    goalKey: string,
    goal: SmartGoalEntry,
    matchedSubject: Subject | undefined,
    customTitle?: string
  ) => {
    const defaultSubject = matchedSubject || subjects[0];
    setTaskComposerGoalKey(goalKey);
    setTaskDraftSubjectId(defaultSubject?.id || '');
    setTaskDraftTopicId('');
    setTaskDraftTitle(customTitle || goal.title);
    setTaskDraftDate(getTodayLocalDateStr());
    setTaskDraftAddToCalendar(true);
    setTaskDraftStartTime('17:00');
    setTaskDraftDurationMins(60);
    setTaskDraftPriority(
      goal.priority === 'alta' ? 'alta' : goal.priority === 'baja' ? 'baja' : 'media'
    );
  };

  const handleSubmitGoalTask = (
    e: React.FormEvent,
    goal: SmartGoalEntry
  ) => {
    e.preventDefault();
    const targetSub =
      subjects.find((s) => s.id === taskDraftSubjectId) || subjects[0];
    if (!targetSub || !taskDraftTitle.trim()) return;

    const cleanTime = taskDraftAddToCalendar ? (taskDraftStartTime || '17:00') : undefined;
    const endTime = cleanTime
      ? computeTaskEndTimeStr(cleanTime, taskDraftDurationMins || 60)
      : undefined;

    const newTask: Task = {
      id: `tsk-smart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: taskDraftTitle.trim(),
      dueDate: taskDraftDate || getTodayLocalDateStr(),
      priority: taskDraftPriority,
      type: 'practica',
      completed: false,
      reminder: true,
      reminderTime: cleanTime,
      scheduledTime: cleanTime,
      startTime: cleanTime,
      endTime,
      durationMinutes: taskDraftAddToCalendar ? Math.max(15, taskDraftDurationMins || 60) : undefined,
      topicId: taskDraftTopicId || undefined,
      notes: `Creada para cumplir Objetivo SMART: ${goal.title}`,
      smartGoalId: goal.id,
      smartGoalTitle: goal.title,
    };

    onAddTaskToSubject?.(targetSub.id, newTask);
    if (taskDraftAddToCalendar) {
      onTaskScheduledToCalendar?.(targetSub.id, newTask);
    }

    setTaskComposerGoalKey(null);
    setAppliedFeedback(
      taskDraftAddToCalendar
        ? `✓ Tarea "${newTask.title}" añadida a ${targetSub.name} y programada en el calendario el ${newTask.dueDate} (${cleanTime}–${endTime}).`
        : `✓ Tarea "${newTask.title}" añadida a ${targetSub.name} (fecha límite ${newTask.dueDate}).`
    );
    setTimeout(() => setAppliedFeedback(null), 5000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden transition-all">
      {/* Cabecera Desplegable Compacta */}
      <div
        onClick={handleToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleExpand();
          }
        }}
        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/80 via-white to-blue-50/70 dark:from-indigo-950/40 dark:via-slate-900 dark:to-blue-950/30 hover:from-indigo-100/70 dark:hover:from-indigo-950/60 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-2xs shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                Objetivos SMART del Plan y Repasos
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>IA Gemini · S.M.A.R.T.</span>
              </span>
              {milestoneStats.goalsCount > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono-numbers font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {milestoneStats.completedMilestones}/{milestoneStats.totalMilestones} hitos ({milestoneStats.pct}%)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Metas Específicas, Medibles, Alcanzables, Relevantes y con Plazo basadas en tus temas pendientes, exámenes y horas libres.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onAddTaskToSubject && subjects.length > 0 && (
            <button
              type="button"
              onClick={() => setIsGoalAssistantOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
              title="Abrir Asistente Guiado para crear metas SMART vinculadas al calendario"
            >
              <Target className="w-3.5 h-3.5 text-indigo-300" />
              <span>Asistente SMART</span>
            </button>
          )}
          {!isExpanded && milestoneStats.goalsCount === 0 && (
            <button
              type="button"
              onClick={() => {
                if (!isExpanded) handleToggleExpand();
                handleGenerateSmartGoals();
              }}
              disabled={isGeneratingSmartGoals}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Generar Objetivos SMART</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleExpand}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isExpanded
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
            }`}
          >
            <span>{isExpanded ? 'Ocultar Objetivos SMART' : 'Desplegar Objetivos SMART'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Vista previa rápida cuando está plegado pero hay objetivos activos */}
      {!isExpanded && smartGoalsData && smartGoalsData.smartGoals?.length > 0 && (
        <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Metas activas:
            </span>
            {smartGoalsData.smartGoals.slice(0, 3).map((goal, idx) => {
              const totalM = (goal.milestones || []).length;
              const doneM = (goal.milestones || []).filter(
                (_, mIdx) => completedMilestones[`${goal.id || idx}__${mIdx}`]
              ).length;
              const isAllDone = totalM > 0 && doneM === totalM;
              return (
                <button
                  key={goal.id || idx}
                  type="button"
                  onClick={handleToggleExpand}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer shrink-0 ${
                    isAllDone
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <span className="max-w-[180px] truncate">{goal.title}</span>
                  {totalM > 0 && (
                    <span className="text-[10px] font-mono-numbers font-bold text-indigo-600 dark:text-indigo-400">
                      {doneM}/{totalM}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
            Pulsa para ver desglose S-M-A-R-T e hitos
          </span>
        </div>
      )}

      {/* Contenido Desplegado */}
      {isExpanded && (
        <div className="p-5 sm:p-6 border-t border-slate-200/80 dark:border-slate-800 space-y-5 animate-in fade-in duration-150">
          {/* Banner de Control y Generación con IA */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white border border-indigo-800/60 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Planificador Estratégico S.M.A.R.T. · Integrado con Plan y Repasos</span>
                </div>
                <h5 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Hoja de Ruta de Objetivos SMART por Asignatura
                </h5>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Basado en tus{' '}
                  <span className="font-mono-numbers font-bold text-white">
                    {subjects.length} asignaturas
                  </span>
                  ,{' '}
                  <span className="font-mono-numbers font-bold text-white">
                    {academicSummaryMetrics.remainingHours}h
                  </span>{' '}
                  de estudio pendiente y{' '}
                  <span className="font-mono-numbers font-bold text-white">
                    {dailyNeeds.realAvailableHoursDaily}h/día
                  </span>{' '}
                  libres en tu calendario para transformar tu estudio y repasos espaciados en hitos medibles.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 text-xs">
                  {(
                    [
                      { id: 'semanal', label: 'Sprint 7 días' },
                      { id: 'mensual', label: 'Mes (4 sem)' },
                      { id: 'examenes', label: 'Recta Exámenes' },
                    ] as const
                  ).map((tf) => (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => setSmartGoalsTimeframe(tf.id)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                        smartGoalsTimeframe === tf.id
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsGoalAssistantOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Asistente Guiado SMART</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualForm((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Manual</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateSmartGoals}
                  disabled={isGeneratingSmartGoals}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-extrabold text-xs transition-all cursor-pointer shadow-sm"
                >
                  {isGeneratingSmartGoals ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Analizando Plan con IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {smartGoalsData ? 'Regenerar con IA' : 'Generar Objetivos SMART con IA'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Resumen de métricas del Plan y Repasos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/10 text-xs">
              <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Temas Dominados
                </span>
                <span className="font-mono-numbers font-bold text-emerald-300">
                  {academicSummaryMetrics.completedTopics}/{academicSummaryMetrics.totalTopics} (
                  {academicSummaryMetrics.completionPct}%)
                </span>
              </div>
              <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Carga Neta Diaria
                </span>
                <span className="font-mono-numbers font-bold text-amber-300">
                  {dailyNeeds.totalHoursNeededDaily}h/día requeridas
                </span>
              </div>
              <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Capacidad Libre Real
                </span>
                <span className="font-mono-numbers font-bold text-sky-300">
                  {dailyNeeds.realAvailableHoursDaily}h/día libres
                </span>
              </div>
              <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                  Progreso de Hitos SMART
                </span>
                <span className="font-mono-numbers font-bold text-indigo-200">
                  {milestoneStats.completedMilestones}/{milestoneStats.totalMilestones} completados (
                  {milestoneStats.pct}%)
                </span>
              </div>
            </div>
          </div>

          {appliedFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{appliedFeedback}</span>
            </div>
          )}

          {smartGoalsError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{smartGoalsError}</span>
              </div>
              <button
                type="button"
                onClick={handleGenerateSmartGoals}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500 cursor-pointer shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Formulario desplegable para crear Objetivo SMART manual */}
          {showManualForm && (
            <form
              onSubmit={handleCreateManualGoal}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-indigo-200 dark:border-indigo-800/70 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span>Nuevo Objetivo SMART Personalizado</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Título de la Meta *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Ej: Dominar bloques 1 a 3 y sus repasos R1"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Asignatura
                  </label>
                  <select
                    value={manualSubjectName}
                    onChange={(e) => setManualSubjectName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="Plan General">Plan General</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={manualPriority}
                    onChange={(e) =>
                      setManualPriority(e.target.value as 'alta' | 'media' | 'baja')
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="alta">Alta prioridad</option>
                    <option value="media">Media prioridad</option>
                    <option value="baja">Baja prioridad</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    S · Específico (¿Qué harás exactamente?) *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualSpecific}
                    onChange={(e) => setManualSpecific(e.target.value)}
                    placeholder="Ej: Estudiar y resumir los Temas 1, 2 y 3"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    M · Medible (¿Cómo medirás el éxito?)
                  </label>
                  <input
                    type="text"
                    value={manualMeasurable}
                    onChange={(e) => setManualMeasurable(e.target.value)}
                    placeholder="Ej: 3 temas estudiados y test con >80% acierto"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    T · Plazo Temporal (¿Para cuándo?)
                  </label>
                  <input
                    type="text"
                    value={manualTimeBound}
                    onChange={(e) => setManualTimeBound(e.target.value)}
                    placeholder="Ej: Antes del domingo a las 20:00"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    A · Alcanzable / R · Relevante (Opcional)
                  </label>
                  <input
                    type="text"
                    value={manualAchievable}
                    onChange={(e) => setManualAchievable(e.target.value)}
                    placeholder="Ej: 4 bloques Pomodoro repartidos entre martes y jueves"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Hitos Verificables (1 por línea)
                  </label>
                  <textarea
                    rows={2}
                    value={manualMilestonesText}
                    onChange={(e) => setManualMilestonesText(e.target.value)}
                    placeholder={'Completar lectura activa del Tema 1\nHacer repaso R1 y test de práctica'}
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                >
                  Guardar Objetivo SMART
                </button>
              </div>
            </form>
          )}

          {/* Lista de Objetivos SMART */}
          {smartGoalsData && smartGoalsData.smartGoals?.length > 0 ? (
            <div className="space-y-4">
              {/* Diagnóstico de Carga y Meta Semanal Sugerida */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                      Diagnóstico de Carga y Repasos (IA)
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {smartGoalsData.workloadDiagnosis}
                  </p>
                </div>

                {smartGoalsData.recommendedWeeklyHours > 0 && (
                  <div className="shrink-0 bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Ritmo Recomendado
                      </span>
                      <span className="text-base font-extrabold font-mono-numbers text-indigo-600 dark:text-indigo-400">
                        {smartGoalsData.recommendedWeeklyHours}h / semana
                      </span>
                    </div>
                    {onApplyDailyGoalHours && (
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyRecommendedHoursToPlan(
                            smartGoalsData.recommendedWeeklyHours
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        title="Ajustar la meta diaria de estudio del calendario según este diagnóstico SMART"
                      >
                        Aplicar al Plan
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Grid de Tarjetas SMART */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {smartGoalsData.smartGoals.map((goal, idx) => {
                  const priorityBadge =
                    goal.priority === 'alta'
                      ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
                      : goal.priority === 'media'
                      ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800';

                  const totalMilestones = (goal.milestones || []).length;
                  const doneMilestones = (goal.milestones || []).filter(
                    (_, mIdx) => completedMilestones[`${goal.id || idx}__${mIdx}`]
                  ).length;

                  const matchedSubject = subjects.find((s) => {
                    const normS = s.name.toLowerCase();
                    const normG = (goal.subjectName || '').toLowerCase();
                    return normG !== '' && (normS === normG || normS.includes(normG) || normG.includes(normS));
                  });
                  const goalKey = goal.id || `goal-${idx}`;
                  const linkedGoalTasks = subjects.flatMap((sub) =>
                    (sub.tasks || [])
                      .filter(
                        (tk) =>
                          (goal.id && tk.smartGoalId === goal.id) ||
                          (tk.smartGoalTitle && tk.smartGoalTitle === goal.title) ||
                          (tk.notes && tk.notes.includes(goal.title))
                      )
                      .map((tk) => ({ subject: sub, task: tk }))
                  );
                  const isComposerOpen = taskComposerGoalKey === goalKey;
                  const composerSubject =
                    subjects.find((s) => s.id === taskDraftSubjectId) || matchedSubject || subjects[0];

                  return (
                    <div
                      key={goalKey}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                {goal.subjectName}
                              </span>
                              {matchedSubject && onSelectSubject && (
                                <button
                                  type="button"
                                  onClick={() => onSelectSubject(matchedSubject.id)}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                                >
                                  <BookOpen className="w-3 h-3" />
                                  <span>Ver asignatura</span>
                                </button>
                              )}
                            </div>
                            <h5 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                              {goal.title}
                            </h5>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {onAddTaskToSubject && subjects.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  isComposerOpen
                                    ? setTaskComposerGoalKey(null)
                                    : handleOpenGoalTaskComposer(goalKey, goal, matchedSubject)
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                  isComposerOpen
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                }`}
                                title="Crear una tarea en la asignatura para cumplir este objetivo SMART y añadirla al calendario"
                              >
                                <Calendar className="w-3 h-3" />
                                <span>+ Tarea / Calendario</span>
                              </button>
                            )}
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${priorityBadge}`}
                            >
                              Prioridad {goal.priority}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteGoal(goal.id, idx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Eliminar objetivo SMART"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Desglose S-M-A-R-T */}
                        <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded bg-blue-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              S
                            </span>
                            <p className="text-slate-700 dark:text-slate-300">
                              <strong className="text-slate-900 dark:text-slate-100">
                                Específico:
                              </strong>{' '}
                              {goal.specific}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded bg-indigo-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              M
                            </span>
                            <p className="text-slate-700 dark:text-slate-300">
                              <strong className="text-slate-900 dark:text-slate-100">
                                Medible:
                              </strong>{' '}
                              {goal.measurable}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              A
                            </span>
                            <p className="text-slate-700 dark:text-slate-300">
                              <strong className="text-slate-900 dark:text-slate-100">
                                Alcanzable:
                              </strong>{' '}
                              {goal.achievable}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded bg-amber-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              R
                            </span>
                            <p className="text-slate-700 dark:text-slate-300">
                              <strong className="text-slate-900 dark:text-slate-100">
                                Relevante:
                              </strong>{' '}
                              {goal.relevant}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded bg-purple-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              T
                            </span>
                            <p className="text-slate-700 dark:text-slate-300">
                              <strong className="text-slate-900 dark:text-slate-100">
                                Plazo temporal:
                              </strong>{' '}
                              {goal.timeBound}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Formulario inline para crear Tarea en una Asignatura y añadirla al Calendario */}
                      {isComposerOpen && onAddTaskToSubject && subjects.length > 0 && (
                        <form
                          onSubmit={(e) => handleSubmitGoalTask(e, goal)}
                          className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                              <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Nueva Tarea de Asignatura para cumplir el Objetivo SMART</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setTaskComposerGoalKey(null)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                Asignatura *
                              </label>
                              <select
                                value={taskDraftSubjectId || composerSubject?.id || ''}
                                onChange={(e) => {
                                  setTaskDraftSubjectId(e.target.value);
                                  setTaskDraftTopicId('');
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                              >
                                {subjects.map((sub) => (
                                  <option key={sub.id} value={sub.id}>
                                    {sub.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                Vincular a tema (opcional)
                              </label>
                              <select
                                value={taskDraftTopicId}
                                onChange={(e) => setTaskDraftTopicId(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                              >
                                <option value="">Cualquier tema de la asignatura</option>
                                {(composerSubject?.topics || []).map((top) => (
                                  <option key={top.id} value={top.id}>
                                    {top.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                              Título de la tarea *
                            </label>
                            <input
                              type="text"
                              required
                              value={taskDraftTitle}
                              onChange={(e) => setTaskDraftTitle(e.target.value)}
                              placeholder="Ej: Completar ejercicios Tema 2 (Objetivo SMART)"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                            />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                Fecha en calendario
                              </label>
                              <input
                                type="date"
                                value={taskDraftDate}
                                onChange={(e) => setTaskDraftDate(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-numbers text-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                Prioridad
                              </label>
                              <select
                                value={taskDraftPriority}
                                onChange={(e) => setTaskDraftPriority(e.target.value as TaskPriority)}
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                              >
                                <option value="urgente">Urgente</option>
                                <option value="alta">Alta</option>
                                <option value="media">Media</option>
                                <option value="baja">Baja</option>
                              </select>
                            </div>
                            <div className="col-span-2 sm:col-span-1 flex items-end">
                              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 w-full cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={taskDraftAddToCalendar}
                                  onChange={(e) => setTaskDraftAddToCalendar(e.target.checked)}
                                  className="rounded text-indigo-600 focus:ring-0"
                                />
                                <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 truncate">
                                  Agendar hora
                                </span>
                              </label>
                            </div>
                          </div>

                          {taskDraftAddToCalendar && (
                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                  Hora de inicio
                                </label>
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                                  <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <input
                                    type="time"
                                    value={taskDraftStartTime}
                                    onChange={(e) => setTaskDraftStartTime(e.target.value)}
                                    className="w-full bg-transparent font-mono-numbers font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-0.5">
                                  Duración
                                </label>
                                <select
                                  value={taskDraftDurationMins}
                                  onChange={(e) => setTaskDraftDurationMins(Number(e.target.value))}
                                  className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-numbers text-slate-800 dark:text-slate-100"
                                >
                                  <option value={30}>30 min</option>
                                  <option value={45}>45 min</option>
                                  <option value={60}>1 hora</option>
                                  <option value={90}>1h 30min</option>
                                  <option value={120}>2 horas</option>
                                </select>
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setTaskComposerGoalKey(null)}
                              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Guardar Tarea y Añadir al Calendario</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Hitos verificables */}
                      {totalMilestones > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/70 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Hitos del Plan y Repasos ({doneMilestones}/{totalMilestones})
                            </span>
                            <span className="font-mono-numbers text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {Math.round((doneMilestones / totalMilestones) * 100)}% completado
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {goal.milestones.map((ms, mIdx) => {
                              const isDone = Boolean(
                                completedMilestones[`${goal.id || idx}__${mIdx}`]
                              );
                              return (
                                <div
                                  key={mIdx}
                                  className={`flex items-start justify-between gap-2 p-2 rounded-lg border text-xs transition-colors ${
                                    isDone
                                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 opacity-80'
                                      : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100/70'
                                  }`}
                                >
                                  <label
                                    onClick={() =>
                                      handleToggleMilestone(goal.id || String(idx), mIdx)
                                    }
                                    className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isDone}
                                      onChange={() => {}}
                                      className="mt-0.5 rounded text-emerald-600 focus:ring-0 cursor-pointer shrink-0"
                                    />
                                    <span className={`leading-snug ${isDone ? 'line-through' : ''}`}>
                                      {ms}
                                    </span>
                                  </label>
                                  {onAddTaskToSubject && subjects.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenGoalTaskComposer(
                                          goalKey,
                                          goal,
                                          matchedSubject,
                                          ms
                                        )
                                      }
                                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white text-[10px] font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Convertir este hito en una tarea de asignatura en el calendario"
                                    >
                                      <Calendar className="w-2.5 h-2.5" />
                                      <span>Al calendario</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tareas ya creadas en las asignaturas para este Objetivo SMART */}
                      {linkedGoalTasks.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/70 space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                            Tareas vinculadas ({linkedGoalTasks.length})
                          </span>
                          <div className="space-y-1">
                            {linkedGoalTasks.map(({ subject: sub, task: tk }) => (
                              <div
                                key={tk.id}
                                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-700 text-[11px]"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: sub.color || '#6366f1' }}
                                  />
                                  <span
                                    className={`font-semibold truncate ${
                                      tk.completed
                                        ? 'line-through text-slate-400'
                                        : 'text-slate-800 dark:text-slate-100'
                                    }`}
                                  >
                                    {tk.title}
                                  </span>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    ({sub.name})
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono-numbers font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                  {tk.dueDate}
                                  {tk.scheduledTime ? ` · ${tk.scheduledTime}` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-center space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Target className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Aún no has generado Objetivos SMART para tu Plan y Repasos
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pulsa en «Generar Objetivos SMART con IA» para que Gemini analice tus asignaturas, temas pendientes, repasos espaciados y horas libres, o añade un objetivo manualmente.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGoalAssistantOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  <Target className="w-4 h-4 text-indigo-300" />
                  <span>Asistente Guiado SMART</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateSmartGoals}
                  disabled={isGeneratingSmartGoals}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generar Objetivos SMART Ahora</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualForm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Objetivo Manual</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Asistente Guiado de Metas SMART + Tareas sincronizadas con Calendario */}
      <GoalAssistantModal
        isOpen={isGoalAssistantOpen}
        onClose={() => setIsGoalAssistantOpen(false)}
        subjects={subjects}
        preferences={preferences}
        blockedEvents={blockedEvents}
        onSaveTasksToSubject={(targetSubjectId, newTasks) => {
          newTasks.forEach((tk) => onAddTaskToSubject?.(targetSubjectId, tk));
        }}
        onGoalCreated={(goal, createdTasks, targetSubject) => {
          const firstTimedTask = createdTasks.find((tk) => tk.scheduledTime || tk.dueDate);
          if (firstTimedTask) {
            onTaskScheduledToCalendar?.(targetSubject.id, firstTimedTask);
          }
          setAppliedFeedback(
            createdTasks.length > 0
              ? `Objetivo SMART "${goal.title}" guardado para ${targetSubject.name} con ${createdTasks.length} tarea(s) sincronizada(s) con el calendario.`
              : `Objetivo SMART "${goal.title}" guardado para ${targetSubject.name}.`
          );
          setTimeout(() => setAppliedFeedback(null), 5500);
        }}
      />
    </div>
  );
};
