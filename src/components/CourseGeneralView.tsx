import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Flame,
  CheckSquare,
  Calendar,
  Clock,
  Sparkles,
  Plus,
  Play,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Award,
  AlertTriangle,
  RotateCcw,
  HelpCircle,
  CheckCircle2,
  X,
  BookOpen,
  Layers,
  Timer,
  SlidersHorizontal,
  Target,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import {
  AcademicYear,
  Subject,
  Task,
  Exam,
  ExamType,
  StudyPreferences,
  BlockedTimeEvent,
  PomodoroLog,
} from '../types';
import { schedulerService } from '../services/schedulerService';
import { getSubjectSpacedRepetitionAlert } from '../utils/courseAlerts';

interface CourseGeneralViewProps {
  programName: string;
  year: AcademicYear;
  activeProgramsCount?: number;
  activeYearsCount?: number;
  totalProgramsCount?: number;
  totalYearsCount?: number;
  onSelectAllProgramsAndYears?: () => void;
  streakDays: number;
  preferences?: StudyPreferences;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  onOpenPreferences?: () => void;
  pomodoroLogs?: PomodoroLog[];
  onPomodoroSessionComplete?: (log: PomodoroLog) => void;
  blockedEvents?: BlockedTimeEvent[];
  onAddBlockedEvent?: (event: BlockedTimeEvent) => void;
  onDeleteBlockedEvent?: (id: string) => void;
  onSelectSubject: (subjectId: string) => void;
  onOpenNewSubject: () => void;
  onToggleTask: (subjectId: string, taskId: string, completed: boolean) => void;
  onSelectForPomodoro: (subjectId: string, topicId?: string) => void;
  onOpenScheduler: () => void;
  onAddTaskToSubject?: (subjectId: string, task: Task) => void;
  onAddExamToSubject?: (subjectId: string, exam: Exam) => void;
  onUpdateTopicsSchedule?: (subjectId: string, updatedTopics: any[]) => void;
  onOpenExamsManager?: (subjectId?: string) => void;
  onUpdateSubject?: (updated: Subject) => void;
  onOpenQuizzesForSubject?: (subjectId: string, topicIds?: string[]) => void;
}

export const CourseGeneralView: React.FC<CourseGeneralViewProps> = ({
  programName,
  year,
  activeProgramsCount,
  activeYearsCount,
  totalProgramsCount,
  totalYearsCount,
  onSelectAllProgramsAndYears,
  streakDays,
  preferences,
  onUpdatePreferences,
  onOpenPreferences,
  pomodoroLogs = [],
  onPomodoroSessionComplete,
  blockedEvents = [],
  onAddBlockedEvent,
  onDeleteBlockedEvent,
  onSelectSubject,
  onOpenNewSubject,
  onToggleTask,
  onSelectForPomodoro,
  onOpenScheduler,
  onAddTaskToSubject,
  onAddExamToSubject,
  onUpdateTopicsSchedule,
  onOpenExamsManager,
  onUpdateSubject,
  onOpenQuizzesForSubject,
}) => {
  const allSubjects = year.subjects;

  const uniqueProgramIds = new Set(
    allSubjects.map((s) => s.programId || programName).filter(Boolean)
  );
  const uniqueYearIds = new Set(
    allSubjects.map((s) => s.yearId || year.id).filter(Boolean)
  );
  const computedProgramsCount = activeProgramsCount || Math.max(1, uniqueProgramIds.size);
  const computedYearsCount = activeYearsCount || Math.max(1, uniqueYearIds.size);

  const today = new Date().toISOString().split('T')[0];

  // Avance académico global
  const globalAcademicProgress = useMemo(
    () => schedulerService.calculateGlobalAcademicProgress(allSubjects, preferences),
    [allSubjects, preferences]
  );
  const totalTopics = globalAcademicProgress.totalTopics;
  const studiedTopics = globalAcademicProgress.completedTopics;
  const inProgressTopics = globalAcademicProgress.inProgressTopics;
  const totalPagesGlobal = globalAcademicProgress.totalPages;
  const pagesReadGlobal = globalAcademicProgress.pagesRead;
  const overallProgress = globalAcademicProgress.overallProgressPct;

  // Horas estimadas y restantes
  const totalEstimatedHours = useMemo(() => {
    return allSubjects.reduce((sumSub, sub) => {
      const sp = schedulerService.calculateSubjectAcademicProgress(sub.topics || [], preferences);
      if (sp.totalHours > 0) return sumSub + sp.totalHours;
      const fallbackGoal =
        preferences?.subjectWeeklyGoalHours?.[sub.id] ??
        preferences?.defaultSubjectWeeklyGoalHours ??
        0;
      return sumSub + fallbackGoal;
    }, 0);
  }, [allSubjects, preferences]);

  const totalRemainingHours = useMemo(() => {
    return allSubjects.reduce((sumSub, sub) => {
      if (sub.topics && sub.topics.length > 0) {
        const sp = schedulerService.calculateSubjectAcademicProgress(sub.topics, preferences);
        return sumSub + sp.remainingHours;
      }
      const fallbackGoal =
        preferences?.subjectWeeklyGoalHours?.[sub.id] ??
        preferences?.defaultSubjectWeeklyGoalHours ??
        0;
      const subLoggedHours =
        pomodoroLogs
          .filter((l) => l.subjectId === sub.id || l.subjectName === sub.name)
          .reduce((acc, l) => acc + (l.durationMinutes || 0), 0) / 60;
      return sumSub + Math.max(0, fallbackGoal - subLoggedHours);
    }, 0);
  }, [allSubjects, preferences, pomodoroLogs]);

  // Recopilación de todas las tareas
  const allTasks = useMemo(() => {
    const list: Array<{ task: Task; subjectId: string; subjectName: string; subjectColor: string }> = [];
    allSubjects.forEach((sub) => {
      const seenTaskIds = new Set<string>();
      (sub.tasks || []).forEach((t) => {
        seenTaskIds.add(t.id);
        list.push({
          task: t,
          subjectId: sub.id,
          subjectName: sub.name,
          subjectColor: sub.color,
        });
      });
      (sub.projects || []).forEach((proj) => {
        (proj.tasks || []).forEach((pt) => {
          if (!seenTaskIds.has(pt.id)) {
            seenTaskIds.add(pt.id);
            list.push({
              task: pt,
              subjectId: sub.id,
              subjectName: sub.name,
              subjectColor: sub.color,
            });
          }
        });
      });
    });
    return list;
  }, [allSubjects]);

  const pendingTasks = useMemo(() => allTasks.filter((item) => !item.task.completed), [allTasks]);
  const completedTasks = useMemo(() => allTasks.filter((item) => item.task.completed), [allTasks]);

  // Recopilación de todos los exámenes
  const allExams = useMemo(() => {
    const list: Array<{ exam: Exam; subjectId: string; subjectName: string; subjectColor: string }> = [];
    allSubjects.forEach((sub) => {
      (sub.exams || []).forEach((ex) => {
        list.push({
          exam: ex,
          subjectId: sub.id,
          subjectName: sub.name,
          subjectColor: sub.color,
        });
      });
    });
    return list;
  }, [allSubjects]);

  const upcomingExams = useMemo(() => {
    return allExams
      .filter((e) => !e.exam.completed)
      .sort((a, b) => new Date(a.exam.date).getTime() - new Date(b.exam.date).getTime());
  }, [allExams]);

  const nextExam = upcomingExams[0] || null;

  // Sesión de estudio de hoy (logs de hoy)
  const todayMinutes = useMemo(() => {
    return pomodoroLogs
      .filter((l) => l.date === today)
      .reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
  }, [pomodoroLogs, today]);

  const todayHours = Math.round((todayMinutes / 60) * 10) / 10;
  const dailyGoalHours = preferences?.hoursPerDay
    ? preferences.hoursPerDay[new Date().getDay()] || 3
    : 3;
  const todayProgressPct = Math.min(100, Math.round((todayHours / Math.max(0.5, dailyGoalHours)) * 100));

  // Tareas más urgentes
  const priorityTasks = useMemo(() => {
    const priorityWeight: Record<string, number> = { urgente: 4, alta: 3, media: 2, baja: 1 };
    return [...pendingTasks]
      .sort((a, b) => {
        const dateA = a.task.dueDate ? new Date(a.task.dueDate).getTime() : 9999999999999;
        const dateB = b.task.dueDate ? new Date(b.task.dueDate).getTime() : 9999999999999;
        if (dateA !== dateB) return dateA - dateB;
        return (priorityWeight[b.task.priority] || 1) - (priorityWeight[a.task.priority] || 1);
      })
      .slice(0, 4);
  }, [pendingTasks]);

  // Vencimientos más próximos
  const upcomingDeadlines = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      date: string;
      daysLeft: number;
      kind: 'examen' | 'entrega';
      subjectId: string;
      subjectName: string;
      subjectColor: string;
      meta?: string;
    }> = [];

    const todayMs = new Date(today).getTime();

    upcomingExams.forEach(({ exam, subjectId, subjectName, subjectColor }) => {
      const targetMs = new Date(exam.date).getTime();
      const daysLeft = Math.ceil((targetMs - todayMs) / 86400000);
      items.push({
        id: `exam-${exam.id}`,
        title: exam.title,
        date: exam.date,
        daysLeft,
        kind: 'examen',
        subjectId,
        subjectName,
        subjectColor: subjectColor || '#6366f1',
        meta: exam.weightPercentage ? `${exam.weightPercentage}% ponderación` : 'Examen oficial',
      });
    });

    pendingTasks.forEach(({ task, subjectId, subjectName, subjectColor }) => {
      if (!task.dueDate) return;
      const targetMs = new Date(task.dueDate).getTime();
      const daysLeft = Math.ceil((targetMs - todayMs) / 86400000);
      items.push({
        id: `task-${task.id}`,
        title: task.title,
        date: task.dueDate,
        daysLeft,
        kind: 'entrega',
        subjectId,
        subjectName,
        subjectColor: subjectColor || '#3b82f6',
        meta: task.priority === 'urgente' || task.priority === 'alta' ? 'Alta prioridad' : 'Entrega',
      });
    });

    return items.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 4);
  }, [upcomingExams, pendingTasks, today]);

  // Recomendación inteligente para hoy
  const [suggestionIdx, setSuggestionIdx] = useState<number>(0);
  const smartSuggestions = useMemo(() => {
    const list: Array<{
      subjectId: string;
      subjectName: string;
      subjectColor: string;
      topicId: string;
      topicTitle: string;
      topicNumber: number;
      reason: string;
    }> = [];

    allSubjects.forEach((sub) => {
      const pendingT = (sub.topics || []).filter(
        (t) => t.status === 'en_progreso' || t.status === 'pendiente'
      );
      if (pendingT.length > 0) {
        const targetT = pendingT.find((t) => t.status === 'en_progreso') || pendingT[0];
        const idx = (sub.topics || []).findIndex((t) => t.id === targetT.id);
        const srAlert = getSubjectSpacedRepetitionAlert(sub, true);
        const isSpaced = srAlert.pendingTopicIds.includes(targetT.id);

        list.push({
          subjectId: sub.id,
          subjectName: sub.name,
          subjectColor: sub.color || '#3b82f6',
          topicId: targetT.id,
          topicTitle: targetT.title,
          topicNumber: idx >= 0 ? idx + 1 : 1,
          reason: isSpaced
            ? 'Repaso de Curva del Olvido pendiente para hoy'
            : targetT.status === 'en_progreso'
            ? 'Tema actualmente en progreso de lectura'
            : 'Siguiente tema en tu planificación académica',
        });
      }
    });

    return list;
  }, [allSubjects]);

  const activeSuggestion = smartSuggestions.length > 0
    ? smartSuggestions[suggestionIdx % smartSuggestions.length]
    : null;

  // Estado de modales rápidos
  const [showAddTaskModal, setShowAddTaskModal] = useState<boolean>(false);
  const [taskSubjectId, setTaskSubjectId] = useState<string>(allSubjects[0]?.id || '');
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>(today);
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('media');

  const [showAddExamModal, setShowAddExamModal] = useState<boolean>(false);
  const [examSubjectId, setExamSubjectId] = useState<string>(allSubjects[0]?.id || '');
  const [examTitle, setExamTitle] = useState<string>('');
  const [examDate, setExamDate] = useState<string>(today);
  const [examTime, setExamTime] = useState<string>('09:00');
  const [examType, setExamType] = useState<ExamType>('test');
  const [examWeight, setExamWeight] = useState<string>('40');

  const handleCreateTask = () => {
    if (!taskTitle.trim() || !taskSubjectId) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: taskTitle.trim(),
      dueDate: taskDueDate || today,
      priority: taskPriority,
      type: 'entrega',
      completed: false,
      reminder: false,
    };
    onAddTaskToSubject?.(taskSubjectId, newTask);
    setTaskTitle('');
    setShowAddTaskModal(false);
  };

  const handleCreateExam = () => {
    if (!examTitle.trim() || !examSubjectId || !examDate) return;
    const targetSub = allSubjects.find((s) => s.id === examSubjectId);
    const newExam: Exam = {
      id: `exam-${Date.now()}`,
      title: examTitle.trim(),
      date: examDate,
      time: examTime || undefined,
      examType,
      difficulty: 'intermedio',
      topicIds: targetSub ? targetSub.topics.map((t) => t.id) : [],
      weightPercentage: examWeight ? parseFloat(examWeight) : undefined,
      completed: false,
    };
    onAddExamToSubject?.(examSubjectId, newExam);
    setExamTitle('');
    setShowAddExamModal(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. HERO ACADEMIC COMMAND BAR */}
      <div className="relative overflow-hidden p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-blue-50/50 border border-slate-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Program identity & meta */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="font-bold text-blue-600">{year.name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-700 truncate max-w-[280px]">
                {computedProgramsCount > 1
                  ? `Mix académico (${computedProgramsCount} carreras)`
                  : programName}
              </span>
              {streakDays > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                    <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                    <span>{streakDays} días de racha</span>
                  </span>
                </>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              {programName}
            </h2>

            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span>{allSubjects.length} materias activas</span>
              <span aria-hidden="true">·</span>
              <span>{totalTopics} temas en temario</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-numbers font-semibold text-slate-800">
                {studiedTopics} dominados ({overallProgress}%)
              </span>
            </div>
          </div>

          {/* Right: Visual Gauge & Quick Action Buttons */}
          <div className="flex items-center gap-4 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Circular Progress Gauge */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="w-11 h-11 relative flex items-center justify-center shrink-0">
                <svg className="w-11 h-11 -rotate-90 transform" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-600 transition-all duration-700"
                    strokeDasharray={`${overallProgress}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-mono-numbers font-black text-[11px] text-slate-900">
                  {overallProgress}%
                </span>
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">Avance Global</div>
                <div className="text-[11px] text-slate-400 font-mono-numbers">
                  {pagesReadGlobal}/{totalPagesGlobal} págs.
                </div>
              </div>
            </div>

            {/* Quick Action CTAs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddTaskModal(true)}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tarea</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddExamModal(true)}
                className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Examen</span>
              </button>

              <button
                type="button"
                onClick={onOpenScheduler}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Calendario</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE METRICS CARDS (4 Essential KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Avance Global del Temario */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Temario Dominado
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono-numbers text-slate-900">
              {overallProgress}%
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-mono-numbers">
              {studiedTopics} de {totalTopics} temas ({inProgressTopics} en lectura)
            </p>
          </div>
        </div>

        {/* KPI 2: Horas Restantes */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Horas Restantes
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono-numbers text-indigo-600">
              {Math.round(totalRemainingHours * 10) / 10}h
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-mono-numbers">
              de {Math.round(totalEstimatedHours * 10) / 10}h estimadas en el plan
            </p>
          </div>
        </div>

        {/* KPI 3: Tareas y Entregas */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Tareas Pendientes
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black font-mono-numbers text-slate-900">
              {pendingTasks.length}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-mono-numbers">
              {completedTasks.length} entregas finalizadas ({allTasks.length} total)
            </p>
          </div>
        </div>

        {/* KPI 4: Próximo Examen */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Próximo Examen
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {nextExam ? (
              <>
                <div className="text-sm font-bold text-slate-900 truncate">
                  {nextExam.exam.title}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-slate-500 font-mono-numbers">
                    {nextExam.exam.date}
                  </span>
                  <span className="text-[10px] font-bold font-mono-numbers bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                    {Math.ceil((new Date(nextExam.exam.date).getTime() - new Date(today).getTime()) / 86400000)}d restantes
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 py-1">Sin exámenes agendados</div>
            )}
          </div>
        </div>
      </div>

      {/* 3. PULSO DIARIO Y META DE ESTUDIO + FOCO PROACTIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Today's Study Pulse Card (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Timer className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Estudio Realizado Hoy</h3>
              </div>
              <span className="text-xs font-mono-numbers font-bold text-blue-600">
                {todayHours}h / {dailyGoalHours}h
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  todayProgressPct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                }`}
                style={{ width: `${todayProgressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono-numbers">
              <span>{todayProgressPct}% de tu meta diaria</span>
              <span>{Math.max(0, Math.round((dailyGoalHours - todayHours) * 10) / 10)}h para completarla</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {pomodoroLogs.filter((l) => l.date === today).length} sesiones Pomodoro hoy
            </span>
            <button
              type="button"
              onClick={() => {
                if (allSubjects[0]) {
                  onSelectForPomodoro(allSubjects[0].id);
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Abrir Pomodoro</span>
            </button>
          </div>
        </div>

        {/* Right: Smart Proactive Recommendation (7 cols) */}
        <div className="lg:col-span-7 bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-white p-5 sm:p-6 rounded-2xl border border-indigo-100 shadow-2xs flex flex-col justify-between space-y-4">
          {activeSuggestion ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">
                    Foco Recomendado para Hoy
                  </span>
                </div>
                {smartSuggestions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSuggestionIdx((prev) => prev + 1)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Rotar</span>
                  </button>
                )}
              </div>

              <div className="mt-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeSuggestion.subjectColor }}
                  />
                  <span className="text-xs font-bold text-slate-700">
                    {activeSuggestion.subjectName}
                  </span>
                  <span className="text-[11px] text-indigo-700 font-medium">
                    · Tema {activeSuggestion.topicNumber}
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 mt-1 line-clamp-1">
                  {activeSuggestion.topicTitle}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  {activeSuggestion.reason}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-500">
              ¡Excelente ritmo de estudio! Todos los temas planificados están al día.
            </div>
          )}

          {activeSuggestion && (
            <div className="pt-3 border-t border-indigo-100/80 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500">
                Sesión enfocada de 25 min recomendada
              </span>
              <button
                type="button"
                onClick={() =>
                  onSelectForPomodoro(activeSuggestion.subjectId, activeSuggestion.topicId)
                }
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Estudiar este Tema</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. ASIGNATURAS ACTIVAS (PANORAMA VISUAL EN CUADRÍCULA) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Panorama por Asignatura</h3>
            <p className="text-xs text-slate-500">
              Progreso individual de cada materia. Haz clic en una tarjeta para ver sus notas y temario.
            </p>
          </div>
          <span className="text-xs font-mono-numbers text-slate-400 font-semibold">
            {allSubjects.length} materias
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {allSubjects.map((sub) => {
            const subAcademicProg = schedulerService.calculateSubjectAcademicProgress(
              sub.topics || [],
              preferences
            );
            const subProg = subAcademicProg.progressPct;
            const subStudiedTopics = (sub.topics || []).filter(
              (t) => t.status === 'estudiado' || t.status === 'repasado'
            ).length;
            const subPendingTasks = (sub.tasks || []).filter((t) => !t.completed).length;
            const subExamsCount = (sub.exams || []).filter((e) => !e.completed).length;
            const srAlert = getSubjectSpacedRepetitionAlert(sub, true);

            return (
              <div
                key={sub.id}
                onClick={() => onSelectSubject(sub.id)}
                className="p-4 rounded-2xl border border-slate-200/90 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer bg-slate-50/40 hover:bg-white flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: sub.color || '#3b82f6' }}
                      />
                      <span className="text-[10px] font-mono-numbers font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {sub.code}
                      </span>
                    </div>
                    <span className="text-xs font-mono-numbers font-bold text-slate-900">
                      {subProg}%
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {sub.name}
                  </h4>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${subProg}%`,
                        backgroundColor: sub.color || '#3b82f6',
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-mono-numbers">
                    {subStudiedTopics}/{sub.topics?.length || 0} temas
                  </span>

                  <div className="flex items-center gap-2">
                    {srAlert.hasPendingToday && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenQuizzesForSubject) {
                            onOpenQuizzesForSubject(sub.id, srAlert.pendingTopicIds);
                          }
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
                        title="Repaso Spaced Repetition pendiente hoy"
                      >
                        <RotateCcw className="w-2.5 h-2.5 text-indigo-600" />
                        <span>{srAlert.totalPendingToday} SR</span>
                      </span>
                    )}
                    {subPendingTasks > 0 && (
                      <span className="text-[10px] font-mono-numbers text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {subPendingTasks} tar.
                      </span>
                    )}
                    {subExamsCount > 0 && (
                      <span className="text-[10px] font-mono-numbers text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-bold">
                        {subExamsCount} exám.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. PRÓXIMAS PRIORIDADES: TAREAS URGENTES Y CONVOCATORIAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Tareas de Estudio Urgentes */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Tareas de Estudio Urgentes ({pendingTasks.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddTaskModal(true)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {priorityTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                ¡Todas las tareas están al día! No tienes entregas urgentes pendientes.
              </div>
            ) : (
              priorityTasks.map(({ task, subjectId, subjectName, subjectColor }) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <label className="flex items-start gap-2.5 min-w-0 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => onToggleTask(subjectId, task.id, e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 block truncate">
                        {task.title}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: subjectColor || '#3b82f6' }}
                        />
                        <span className="truncate">{subjectName}</span>
                        {task.dueDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-numbers">{task.dueDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={() => onSelectForPomodoro(subjectId)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
                    title="Iniciar sesión de Pomodoro"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Próximos Vencimientos y Convocatorias */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Próximos Vencimientos ({upcomingDeadlines.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddExamModal(true)}
              className="text-xs font-bold text-purple-600 hover:text-purple-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Examen</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {upcomingDeadlines.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No hay fechas de examen ni entregas registradas para los próximos días.
              </div>
            ) : (
              upcomingDeadlines.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectSubject(item.subjectId)}
                  className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 transition-colors flex items-center justify-between gap-3 text-xs cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors block truncate">
                      {item.title}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.subjectColor }}
                      />
                      <span className="truncate">{item.subjectName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.meta}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[11px] font-mono-numbers font-bold px-2 py-0.5 rounded-full ${
                        item.daysLeft <= 3
                          ? 'bg-rose-100 text-rose-800'
                          : item.daysLeft <= 7
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.daysLeft === 0
                        ? '¡Hoy!'
                        : item.daysLeft === 1
                        ? 'Mañana'
                        : `En ${item.daysLeft}d`}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                      {item.date}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL: DIRECT ADD TASK TO COURSE */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-600" />
                <span>Añadir Tarea al Curso</span>
              </h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Asignatura *</label>
                <select
                  value={taskSubjectId}
                  onChange={(e) => setTaskSubjectId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none"
                >
                  {allSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Título de la Tarea *</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ej: Entrega de problemas, Memoria de prácticas..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Fecha Límite *</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Prioridad</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 focus:outline-none"
                  >
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateTask}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs"
              >
                Guardar Tarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIRECT ADD EXAM TO COURSE */}
      {showAddExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>Añadir Fecha de Examen</span>
              </h3>
              <button
                onClick={() => setShowAddExamModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Asignatura *</label>
                <select
                  value={examSubjectId}
                  onChange={(e) => setExamSubjectId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none"
                >
                  {allSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Título del Examen *</label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="Ej: Examen Parcial 1, Examen Final..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hora</label>
                  <input
                    type="time"
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tipo de Examen</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 focus:outline-none"
                  >
                    <option value="test">Tipo Test</option>
                    <option value="desarrollo">Desarrollo</option>
                    <option value="oral">Oral</option>
                    <option value="preguntas_cortas">Preguntas Cortas</option>
                    <option value="calculo">Cálculo</option>
                    <option value="practico">Práctico</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ponderación (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={examWeight}
                    onChange={(e) => setExamWeight(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-mono-numbers"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddExamModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateExam}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs"
              >
                Guardar Examen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
