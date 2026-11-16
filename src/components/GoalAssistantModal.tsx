import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Sparkles,
  X,
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import {
  Subject,
  StudyPreferences,
  BlockedTimeEvent,
  Task,
  TaskPriority,
  SubjectSmartGoal,
} from '../types';
import { schedulerService } from '../services/schedulerService';
import { getTodayLocalDateStr } from '../utils/dateUtils';
import type { SmartGoalEntry, SmartGoalsStoredData } from './SmartGoalsCollapsibleSection';

const STORAGE_GOALS_KEY = 'studyflow_smart_goals_v1';

interface DraftActionTask {
  localId: string;
  title: string;
  topicId: string;
  dueDate: string;
  priority: TaskPriority;
  weightPercentage: string;
  syncToCalendar: boolean;
  startTime: string;
  durationMinutes: number;
}

interface GoalAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectId?: string;
  preferences: StudyPreferences;
  blockedEvents?: BlockedTimeEvent[];
  onSaveTasksToSubject: (subjectId: string, tasks: Task[]) => void;
  onSaveGoalToSubject?: (subjectId: string, goal: SubjectSmartGoal) => void;
  onGoalCreated?: (
    goal: SmartGoalEntry,
    tasks: Task[],
    targetSubject: Subject,
    subjectGoal: SubjectSmartGoal
  ) => void;
}

const computeEndTime = (startTime: string, durationMinutes: number): string => {
  const [h, m] = (startTime || '17:00').split(':').map(Number);
  const startTotal = (h || 0) * 60 + (m || 0);
  const endTotal = Math.min(23 * 60 + 55, startTotal + Math.max(15, durationMinutes || 60));
  return `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
};

const addDaysToIsoDate = (baseIso: string, daysToAdd: number): string => {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  dt.setDate(dt.getDate() + daysToAdd);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const GoalAssistantModal: React.FC<GoalAssistantModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubjectId,
  preferences,
  blockedEvents = [],
  onSaveTasksToSubject,
  onSaveGoalToSubject,
  onGoalCreated,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || subjects[0]?.id || ''
  );
  const [timeframe, setTimeframe] = useState<'semanal' | 'mensual' | 'examenes'>('semanal');
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja'>('alta');
  const [title, setTitle] = useState<string>('');

  // SMART criteria fields
  const [specific, setSpecific] = useState<string>('');
  const [measurable, setMeasurable] = useState<string>('');
  const [achievable, setAchievable] = useState<string>('');
  const [relevant, setRelevant] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(() => addDaysToIsoDate(getTodayLocalDateStr(), 7));
  const [timeBoundLabel, setTimeBoundLabel] = useState<string>('En los próximos 7 días');

  // Actionable tasks mapped to calendar
  const [draftTasks, setDraftTasks] = useState<DraftActionTask[]>([]);
  const [isSuggestingAI, setIsSuggestingAI] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || subjects[0],
    [subjects, selectedSubjectId]
  );

  const dailyNeeds = useMemo(() => {
    return schedulerService.calculateDailyStudyAndReviewNeeds(
      selectedSubject ? [selectedSubject] : subjects,
      preferences,
      blockedEvents,
      preferences.weeklyFixedObligations || []
    );
  }, [selectedSubject, subjects, preferences, blockedEvents]);

  const subjectContextStats = useMemo(() => {
    if (!selectedSubject) {
      return {
        pendingTopics: [],
        remainingHours: 0,
        nextExam: undefined,
        pendingTasksCount: 0,
      };
    }
    const pendingTopics = (selectedSubject.topics || []).filter(
      (t) => t.status === 'pendiente' || t.status === 'en_progreso'
    );
    const prog = schedulerService.calculateSubjectAcademicProgress(
      selectedSubject.topics || [],
      preferences
    );
    const nextExam = (selectedSubject.exams || [])
      .filter((ex) => !ex.completed && ex.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const pendingTasksCount = (selectedSubject.tasks || []).filter((t) => !t.completed).length;
    return {
      pendingTopics,
      remainingHours: prog.remainingHours,
      nextExam,
      pendingTasksCount,
    };
  }, [selectedSubject, preferences, todayStr]);

  const buildDefaultTasksForSubject = (
    sub: Subject | undefined,
    baseDate: string,
    goalPriority: 'alta' | 'media' | 'baja'
  ): DraftActionTask[] => {
    if (!sub) return [];
    const pending = (sub.topics || []).filter(
      (t) => t.status === 'pendiente' || t.status === 'en_progreso'
    );
    const firstTopic = pending[0] || sub.topics[0];
    const secondTopic = pending[1] || firstTopic;
    const mappedPrio: TaskPriority = goalPriority === 'alta' ? 'alta' : goalPriority === 'baja' ? 'baja' : 'media';

    const list: DraftActionTask[] = [];
    if (firstTopic) {
      list.push({
        localId: `dt-1-${Date.now()}`,
        title: `Estudio activo y esquema: ${firstTopic.title}`,
        topicId: firstTopic.id,
        dueDate: addDaysToIsoDate(todayStr, 1),
        priority: mappedPrio,
        weightPercentage: firstTopic.customGradeWeightImpact ? String(firstTopic.customGradeWeightImpact) : '',
        syncToCalendar: true,
        startTime: '17:00',
        durationMinutes: 60,
      });
    } else {
      list.push({
        localId: `dt-1-${Date.now()}`,
        title: `Bloque de estudio focalizado (${sub.name})`,
        topicId: '',
        dueDate: addDaysToIsoDate(todayStr, 1),
        priority: mappedPrio,
        weightPercentage: '',
        syncToCalendar: true,
        startTime: '17:00',
        durationMinutes: 60,
      });
    }

    list.push({
      localId: `dt-2-${Date.now() + 1}`,
      title: secondTopic
        ? `Práctica de ejercicios y repaso R1: ${secondTopic.title}`
        : `Autoevaluación y repaso activo (${sub.name})`,
      topicId: secondTopic?.id || '',
      dueDate: baseDate >= todayStr ? baseDate : addDaysToIsoDate(todayStr, 3),
      priority: mappedPrio,
      weightPercentage: '',
      syncToCalendar: true,
      startTime: '18:30',
      durationMinutes: 45,
    });

    return list;
  };

  // Reset modal state whenever opened
  useEffect(() => {
    if (!isOpen) return;
    const subId = initialSubjectId || subjects[0]?.id || '';
    const targetSub = subjects.find((s) => s.id === subId) || subjects[0];
    const nextWeek = addDaysToIsoDate(todayStr, 7);

    setStep(1);
    setSelectedSubjectId(subId);
    setTimeframe('semanal');
    setPriority('alta');
    setTitle('');
    setSpecific('');
    setMeasurable('');
    setAchievable(
      `Dedicar bloques de 45–60 min aprovechando ${dailyNeeds.realAvailableHoursDaily || preferences.dailyGoalHours || 3}h/día disponibles.`
    );
    setRelevant('');
    setTargetDate(nextWeek);
    setTimeBoundLabel(`Antes del ${nextWeek}`);
    setAiError(null);
    setDraftTasks(buildDefaultTasksForSubject(targetSub, nextWeek, 'alta'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialSubjectId]);

  if (!isOpen) return null;

  const smartChecklist = [
    { key: 'S', label: 'Específico', ok: specific.trim().length >= 6 },
    { key: 'M', label: 'Medible', ok: measurable.trim().length >= 5 },
    { key: 'A', label: 'Alcanzable', ok: achievable.trim().length >= 5 },
    { key: 'R', label: 'Relevante', ok: relevant.trim().length >= 5 },
    { key: 'T', label: 'Temporal', ok: Boolean(targetDate) && timeBoundLabel.trim().length >= 3 },
  ];
  const smartReadyCount = smartChecklist.filter((c) => c.ok).length;

  const applyQuickTemplate = (variant: 'topics' | 'exam' | 'reviews') => {
    if (!selectedSubject) return;
    const pending = subjectContextStats.pendingTopics;
    const topNames = pending.slice(0, 2).map((t) => t.title);
    const exam = subjectContextStats.nextExam;

    if (variant === 'topics') {
      const targetTopics = topNames.length > 0 ? topNames.join(' y ') : `los próximos temas de ${selectedSubject.name}`;
      const deadline = addDaysToIsoDate(todayStr, 7);
      setTimeframe('semanal');
      setPriority('alta');
      setTargetDate(deadline);
      setTitle(`Dominar ${topNames[0] || selectedSubject.name} esta semana`);
      setSpecific(`Completar lectura activa, apuntes clave y ejercicios prácticos de ${targetTopics}.`);
      setMeasurable(`Completar el 100% de ${Math.max(1, Math.min(2, pending.length))} tema(s) y superar ≥80% en test de autoevaluación.`);
      setAchievable(`Planificar sesiones de 60 min dentro de mis ${dailyNeeds.realAvailableHoursDaily || 3}h/día libres.`);
      setRelevant(`Asegura la base de ${selectedSubject.name} y reduce las ${subjectContextStats.remainingHours}h pendientes.`);
      setTimeBoundLabel(`Completar antes del ${deadline}`);
      setDraftTasks(buildDefaultTasksForSubject(selectedSubject, deadline, 'alta'));
    } else if (variant === 'exam') {
      const examTitle = exam ? exam.title : `próxima evaluación de ${selectedSubject.name}`;
      const deadline = exam?.date || addDaysToIsoDate(todayStr, 14);
      setTimeframe('examenes');
      setPriority('alta');
      setTargetDate(deadline);
      setTitle(`Preparación integral: ${examTitle}`);
      setSpecific(`Consolidar todos los temas evaluados en ${examTitle} con simulacros de examen y resolución de fallos.`);
      setMeasurable(`Realizar 2 simulacros cronometrados con nota ≥ 7.5/10 antes del ${deadline}.`);
      setAchievable(`Reservar 4 bloques de estudio y repaso espaciado repartidos hasta la fecha del examen.`);
      setRelevant(
        exam?.weightPercentage
          ? `Impacta directamente en el ${exam.weightPercentage}% de la nota final de ${selectedSubject.name}.`
          : `Clave para maximizar la calificación en ${selectedSubject.name}.`
      );
      setTimeBoundLabel(`Fecha límite: ${deadline}`);
      setDraftTasks([
        {
          localId: `dt-ex-1-${Date.now()}`,
          title: `Revisión de temario clave para ${examTitle}`,
          topicId: pending[0]?.id || selectedSubject.topics[0]?.id || '',
          dueDate: addDaysToIsoDate(todayStr, 2),
          priority: 'urgente',
          weightPercentage: exam?.weightPercentage ? String(exam.weightPercentage) : '30',
          syncToCalendar: true,
          startTime: '16:30',
          durationMinutes: 90,
        },
        {
          localId: `dt-ex-2-${Date.now() + 1}`,
          title: `Simulacro cronometrado y análisis de errores (${examTitle})`,
          topicId: '',
          dueDate: deadline > todayStr ? addDaysToIsoDate(deadline, -1) : todayStr,
          priority: 'alta',
          weightPercentage: exam?.weightPercentage ? String(exam.weightPercentage) : '',
          syncToCalendar: true,
          startTime: '17:00',
          durationMinutes: 60,
        },
      ]);
    } else {
      const deadline = addDaysToIsoDate(todayStr, 5);
      setTimeframe('semanal');
      setPriority('media');
      setTargetDate(deadline);
      setTitle(`Consolidación por Repaso Espaciado en ${selectedSubject.name}`);
      setSpecific(`Completar los ciclos de repaso espaciado (R1–R3) y flashcards de los temas ya vistos en ${selectedSubject.name}.`);
      setMeasurable(`Alcanzar ≥85% de retención en todos los repasos pendientes durante los próximos 5 días.`);
      setAchievable(`Sesiones breves de 30–45 min al final de la jornada de estudio.`);
      setRelevant(`Evita la curva del olvido antes de acumular nuevo temario en ${selectedSubject.name}.`);
      setTimeBoundLabel(`Completar antes del ${deadline}`);
      setDraftTasks([
        {
          localId: `dt-rev-1-${Date.now()}`,
          title: `Sesión Active Recall y Flashcards (${selectedSubject.name})`,
          topicId: selectedSubject.topics[0]?.id || '',
          dueDate: addDaysToIsoDate(todayStr, 1),
          priority: 'media',
          weightPercentage: '',
          syncToCalendar: true,
          startTime: '19:00',
          durationMinutes: 45,
        },
      ]);
    }
  };

  const handleSuggestWithAI = async () => {
    if (!selectedSubject) return;
    setIsSuggestingAI(true);
    setAiError(null);
    try {
      const prog = schedulerService.calculateSubjectAcademicProgress(
        selectedSubject.topics || [],
        preferences
      );
      const nextExam = subjectContextStats.nextExam;
      const studiedTopics = (selectedSubject.topics || []).filter(
        (t) => t.status === 'estudiado' || t.status === 'repasado'
      ).length;

      const response = await fetch('/api/gemini/generate-smart-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programName: selectedSubject.programName || selectedSubject.name,
          yearName: selectedSubject.yearName || 'Curso Activo',
          targetWeeklyHours: Math.round((preferences.dailyGoalHours || 4) * 5),
          dailyAvailableHours: dailyNeeds.realAvailableHoursDaily || 3,
          blockedWeeklyHours: dailyNeeds.totalBlockedHoursWeekly || 0,
          focusTimeframe: timeframe,
          subjectsSummary: [
            {
              name: selectedSubject.name,
              code: selectedSubject.code || '',
              credits: selectedSubject.credits || 6,
              totalTopics: (selectedSubject.topics || []).length,
              studiedTopics,
              pendingTopics: subjectContextStats.pendingTopics.length,
              progressPercentage: prog.progressPct,
              remainingHours: prog.remainingHours,
              nextExamDate: nextExam ? `${nextExam.title} (${nextExam.date})` : 'Sin fecha asignada',
              pendingTasksCount: subjectContextStats.pendingTasksCount,
              unresolvedErrorsCount: (selectedSubject.errorLogs || []).filter((e) => !e.resolved).length,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || 'No se pudo generar la sugerencia SMART con IA.');
      }

      const data = await response.json();
      const firstGoal: SmartGoalEntry | undefined = data?.smartGoals?.[0];
      if (firstGoal) {
        setTitle(firstGoal.title || `Meta SMART: ${selectedSubject.name}`);
        setPriority(firstGoal.priority || 'alta');
        setSpecific(firstGoal.specific || '');
        setMeasurable(firstGoal.measurable || '');
        setAchievable(firstGoal.achievable || '');
        setRelevant(firstGoal.relevant || '');
        setTimeBoundLabel(firstGoal.timeBound || timeBoundLabel);

        const milestones = firstGoal.milestones || [];
        if (milestones.length > 0) {
          setDraftTasks(
            milestones.slice(0, 4).map((ms, idx) => ({
              localId: `dt-ai-${Date.now()}-${idx}`,
              title: ms,
              topicId: subjectContextStats.pendingTopics[idx]?.id || selectedSubject.topics[0]?.id || '',
              dueDate: addDaysToIsoDate(todayStr, Math.min(idx * 2 + 1, 14)),
              priority: (firstGoal.priority === 'alta' ? 'alta' : 'media') as TaskPriority,
              weightPercentage: '',
              syncToCalendar: true,
              startTime: idx % 2 === 0 ? '17:00' : '18:30',
              durationMinutes: 60,
            }))
          );
        }
      }
    } catch (err: any) {
      setAiError(err?.message || 'Error al conectar con el asistente IA.');
    } finally {
      setIsSuggestingAI(false);
    }
  };

  const handleAddDraftTaskRow = () => {
    const defaultTopicId = subjectContextStats.pendingTopics[0]?.id || selectedSubject?.topics[0]?.id || '';
    setDraftTasks((prev) => [
      ...prev,
      {
        localId: `dt-new-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: '',
        topicId: defaultTopicId,
        dueDate: targetDate || addDaysToIsoDate(todayStr, 3),
        priority: priority === 'alta' ? 'alta' : priority === 'baja' ? 'baja' : 'media',
        weightPercentage: '',
        syncToCalendar: true,
        startTime: '17:00',
        durationMinutes: 60,
      },
    ]);
  };

  const handleUpdateDraftTask = (localId: string, patch: Partial<DraftActionTask>) => {
    setDraftTasks((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));
  };

  const handleRemoveDraftTask = (localId: string) => {
    setDraftTasks((prev) => prev.filter((t) => t.localId !== localId));
  };

  const handleFinalizeGoalAndTasks = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;

    const cleanTitle =
      title.trim() ||
      (specific.trim() ? specific.trim().slice(0, 65) : `Meta SMART de ${selectedSubject.name}`);
    const validDrafts = draftTasks.filter((dt) => dt.title.trim().length > 0);
    const goalId = `smart-wizard-${Date.now()}`;

    const newGoal: SmartGoalEntry = {
      id: goalId,
      title: cleanTitle,
      subjectName: selectedSubject.name,
      priority,
      specific: specific.trim() || `Completar el bloque planificado de ${selectedSubject.name}.`,
      measurable:
        measurable.trim() ||
        `Completar las ${Math.max(1, validDrafts.length)} tareas vinculadas y verificar retención.`,
      achievable:
        achievable.trim() ||
        `Ajustado a ${dailyNeeds.realAvailableHoursDaily || preferences.dailyGoalHours || 3}h/día libres.`,
      relevant:
        relevant.trim() ||
        `Impulsa el dominio académico de ${selectedSubject.name}.`,
      timeBound: `${timeBoundLabel.trim() || 'Plazo objetivo'}${targetDate ? ` (${targetDate})` : ''}`,
      milestones:
        validDrafts.length > 0
          ? validDrafts.map((dt) => dt.title.trim())
          : [`Completar objetivo: ${cleanTitle}`],
    };

    try {
      const raw = localStorage.getItem(STORAGE_GOALS_KEY);
      const parsed: SmartGoalsStoredData | null = raw ? JSON.parse(raw) : null;
      const currentGoals = parsed?.smartGoals || [];
      const nextStored: SmartGoalsStoredData = {
        workloadDiagnosis:
          parsed?.workloadDiagnosis ||
          `Plan activo con ${subjects.length} asignaturas y ${dailyNeeds.realAvailableHoursDaily}h/día disponibles.`,
        recommendedWeeklyHours:
          parsed?.recommendedWeeklyHours || Math.round((preferences.dailyGoalHours || 4) * 5),
        generatedAt: new Date().toISOString(),
        timeframe,
        smartGoals: [newGoal, ...currentGoals],
      };
      localStorage.setItem(STORAGE_GOALS_KEY, JSON.stringify(nextStored));
      window.dispatchEvent(new CustomEvent('studyflow-smart-goals-updated'));
    } catch {
      // ignore storage quota errors
    }

    const createdTasks: Task[] = validDrafts.map((dt, idx) => {
      const parsedWeight = dt.weightPercentage ? parseFloat(dt.weightPercentage) : undefined;
      const validWeight =
        parsedWeight !== undefined && !isNaN(parsedWeight) && parsedWeight >= 0
          ? Math.min(100, parsedWeight)
          : undefined;
      const startTime = dt.syncToCalendar ? dt.startTime || '17:00' : undefined;
      const endTime = startTime ? computeEndTime(startTime, dt.durationMinutes || 60) : undefined;

      return {
        id: `tsk-goal-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        title: dt.title.trim(),
        dueDate: dt.dueDate || targetDate || todayStr,
        priority: dt.priority,
        type: 'practica',
        completed: false,
        reminder: true,
        reminderTime: startTime,
        scheduledTime: startTime,
        startTime,
        endTime,
        durationMinutes: dt.syncToCalendar ? Math.max(15, dt.durationMinutes || 60) : undefined,
        topicId: dt.topicId || undefined,
        weightPercentage: validWeight,
        isGraded: Boolean(validWeight && validWeight > 0),
        notes: `Generada desde Asistente de Metas SMART: ${cleanTitle}`,
        smartGoalId: goalId,
        smartGoalTitle: cleanTitle,
      };
    });

    const nowIso = new Date().toISOString();
    const subjectGoal: SubjectSmartGoal = {
      id: goalId,
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      title: cleanTitle,
      priority,
      timeframe,
      specific: newGoal.specific,
      measurable: newGoal.measurable,
      achievable: newGoal.achievable,
      relevant: newGoal.relevant,
      timeBound: timeBoundLabel.trim() || 'Plazo objetivo',
      targetDate: targetDate || addDaysToIsoDate(todayStr, 7),
      milestones: newGoal.milestones.map((mTitle, mIdx) => ({
        id: `ms-${goalId}-${mIdx}`,
        title: mTitle,
        completed: false,
      })),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (onSaveGoalToSubject) {
      onSaveGoalToSubject(selectedSubject.id, subjectGoal);
    }
    if (createdTasks.length > 0) {
      onSaveTasksToSubject(selectedSubject.id, createdTasks);
    }
    onGoalCreated?.(newGoal, createdTasks, selectedSubject, subjectGoal);
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                Asistente de Metas SMART
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Define metas por asignatura, mapea tareas accionables y sincronízalas con tu calendario
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente de metas SMART"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Segmented Stepper */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-3 gap-2">
          {(
            [
              { id: 1, title: '1. Enfoque y Materia' },
              { id: 2, title: '2. Criterios S.M.A.R.T.' },
              { id: 3, title: '3. Tareas y Calendario' },
            ] as const
          ).map((item) => {
            const active = step === item.id;
            const completed = step > item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer flex items-center justify-between gap-2 whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 dark:bg-blue-600 text-white'
                    : completed
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{item.title}</span>
                {completed && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <form onSubmit={handleFinalizeGoalAndTasks} className="p-6 space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Asignatura objetivo
                  </label>
                  <select
                    value={selectedSubject?.id || ''}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedSubjectId(nextId);
                      const sub = subjects.find((s) => s.id === nextId);
                      setDraftTasks(buildDefaultTasksForSubject(sub, targetDate, priority));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} {sub.code ? `(${sub.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'alta' | 'media' | 'baja')}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>

              {/* Clean unboxed context strip */}
              {selectedSubject && (
                <div className="py-2.5 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 font-mono-numbers">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-sans font-semibold text-slate-900 dark:text-white">
                      {selectedSubject.name}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{subjectContextStats.pendingTopics.length} temas pendientes</span>
                    <span aria-hidden="true">·</span>
                    <span>{subjectContextStats.remainingHours}h estimadas</span>
                    {subjectContextStats.nextExam && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Examen: {subjectContextStats.nextExam.title} ({subjectContextStats.nextExam.date})
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Templates & AI Assistant Trigger */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Plantillas rápidas según tu temario o sugerencia IA
                  </label>
                  <button
                    type="button"
                    onClick={handleSuggestWithAI}
                    disabled={isSuggestingAI || !selectedSubject}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {isSuggestingAI ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generando borrador...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Autocompletar con IA</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickTemplate('topics')}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-left text-xs transition-colors cursor-pointer bg-white dark:bg-slate-900"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Avance semanal de temas
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Foco en los próximos bloques pendientes
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickTemplate('exam')}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-left text-xs transition-colors cursor-pointer bg-white dark:bg-slate-900"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Recta final de examen
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Simulacros y revisión de temas evaluados
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickTemplate('reviews')}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-left text-xs transition-colors cursor-pointer bg-white dark:bg-slate-900"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Consolidar repasos R1–R3
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Active Recall y retención de memoria
                    </div>
                  </button>
                </div>
              </div>

              {aiError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Título de tu Meta de Estudio *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Ej: Dominar Temas 1 y 2 de ${selectedSubject?.name || 'la asignatura'}`}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Horizonte temporal
                  </label>
                  <select
                    value={timeframe}
                    onChange={(e) => {
                      const val = e.target.value as 'semanal' | 'mensual' | 'examenes';
                      setTimeframe(val);
                      const days = val === 'semanal' ? 7 : val === 'mensual' ? 28 : 14;
                      const dt = addDaysToIsoDate(todayStr, days);
                      setTargetDate(dt);
                      setTimeBoundLabel(
                        val === 'semanal'
                          ? `En los próximos 7 días (${dt})`
                          : val === 'mensual'
                          ? `En 4 semanas (${dt})`
                          : `Para convocatoria (${dt})`
                      );
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="semanal">Sprint 7 días</option>
                    <option value="mensual">Plan 1 mes</option>
                    <option value="examenes">Recta de exámenes</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Verificación S · M · A · R · T ({smartReadyCount}/5 completos)
                </span>
                <div className="flex items-center gap-2 text-[11px] font-mono-numbers text-slate-500 dark:text-slate-400">
                  {smartChecklist.map((c, idx) => (
                    <React.Fragment key={c.key}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span
                        className={
                          c.ok
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-slate-400 dark:text-slate-500'
                        }
                      >
                        {c.key} {c.ok ? '✓' : '○'}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  S · Específico (¿Qué temas o resultados concretos vas a trabajar?)
                </label>
                <input
                  type="text"
                  value={specific}
                  onChange={(e) => setSpecific(e.target.value)}
                  placeholder="Ej: Leer, subrayar y hacer esquema Cornell de los Temas 3 y 4"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  M · Medible (¿Cómo comprobarás que lo lograste?)
                </label>
                <input
                  type="text"
                  value={measurable}
                  onChange={(e) => setMeasurable(e.target.value)}
                  placeholder="Ej: 45 páginas completadas + 20 flashcards y ≥80% de aciertos en test"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    A · Alcanzable (Tu ritmo disponible: {dailyNeeds.realAvailableHoursDaily}h/día libres)
                  </label>
                  <input
                    type="text"
                    value={achievable}
                    onChange={(e) => setAchievable(e.target.value)}
                    placeholder="Ej: 3 bloques de 60 min distribuidos martes, miércoles y viernes"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    R · Relevante (¿Por qué importa para tu nota o examen?)
                  </label>
                  <input
                    type="text"
                    value={relevant}
                    onChange={(e) => setRelevant(e.target.value)}
                    placeholder="Ej: Representa el 35% de la nota en el próximo parcial"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    T · Fecha límite objetivo
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono-numbers text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    T · Descripción de plazo temporal
                  </label>
                  <input
                    type="text"
                    value={timeBoundLabel}
                    onChange={(e) => setTimeBoundLabel(e.target.value)}
                    placeholder="Ej: Antes del viernes 20:00h"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Tareas Accionables en {selectedSubject?.name} ({draftTasks.filter((d) => d.title.trim()).length})
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Cada tarea se guarda en la asignatura y se sincroniza en el día y hora indicados en el calendario.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddDraftTaskRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir tarea</span>
                </button>
              </div>

              {draftTasks.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                  <p className="text-slate-500 dark:text-slate-400">
                    No hay tareas añadidas todavía para esta meta.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddDraftTaskRow}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear primera tarea</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {draftTasks.map((taskRow, idx) => (
                    <div
                      key={taskRow.localId}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono-numbers font-semibold text-slate-500 dark:text-slate-400">
                          Tarea #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftTask(taskRow.localId)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-6">
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                            Título de la tarea
                          </label>
                          <input
                            type="text"
                            value={taskRow.title}
                            onChange={(e) => handleUpdateDraftTask(taskRow.localId, { title: e.target.value })}
                            placeholder="Ej: Resolver colección de problemas Tema 2"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                            Tema vinculado
                          </label>
                          <select
                            value={taskRow.topicId}
                            onChange={(e) => handleUpdateDraftTask(taskRow.localId, { topicId: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            <option value="">General de la materia</option>
                            {(selectedSubject?.topics || []).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                            % Nota
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={taskRow.weightPercentage}
                            onChange={(e) =>
                              handleUpdateDraftTask(taskRow.localId, { weightPercentage: e.target.value })
                            }
                            placeholder="Ej: 15"
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-numbers text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                        <div>
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                            Fecha
                          </label>
                          <input
                            type="date"
                            value={taskRow.dueDate}
                            onChange={(e) => handleUpdateDraftTask(taskRow.localId, { dueDate: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-numbers text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                            Prioridad
                          </label>
                          <select
                            value={taskRow.priority}
                            onChange={(e) =>
                              handleUpdateDraftTask(taskRow.localId, {
                                priority: e.target.value as TaskPriority,
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            <option value="urgente">Urgente</option>
                            <option value="alta">Alta</option>
                            <option value="media">Media</option>
                            <option value="baja">Baja</option>
                          </select>
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <label className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={taskRow.syncToCalendar}
                              onChange={(e) =>
                                handleUpdateDraftTask(taskRow.localId, {
                                  syncToCalendar: e.target.checked,
                                })
                              }
                              className="rounded text-blue-600 focus:ring-0"
                            />
                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                              En calendario
                            </span>
                          </label>
                        </div>

                        {taskRow.syncToCalendar && (
                          <>
                            <div>
                              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                Hora inicio
                              </label>
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                                <input
                                  type="time"
                                  value={taskRow.startTime}
                                  onChange={(e) =>
                                    handleUpdateDraftTask(taskRow.localId, {
                                      startTime: e.target.value,
                                    })
                                  }
                                  className="w-full bg-transparent font-mono-numbers text-slate-900 dark:text-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                Duración
                              </label>
                              <select
                                value={taskRow.durationMinutes}
                                onChange={(e) =>
                                  handleUpdateDraftTask(taskRow.localId, {
                                    durationMinutes: Number(e.target.value),
                                  })
                                }
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono-numbers text-slate-900 dark:text-white"
                              >
                                <option value={30}>30 min</option>
                                <option value={45}>45 min</option>
                                <option value={60}>1 hora</option>
                                <option value={90}>1h 30m</option>
                                <option value={120}>2 horas</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[260px]">
                {selectedSubject ? selectedSubject.name : 'Selecciona una asignatura'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((prev) => (prev === 1 ? 2 : 3))}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Siguiente</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!selectedSubject}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Guardar Meta y Sincronizar ({draftTasks.filter((d) => d.title.trim()).length} tareas)
                  </span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
