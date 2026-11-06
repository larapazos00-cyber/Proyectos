import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Edit3,
  X,
  Search,
  CheckCircle2,
  Clock,
  Award,
  AlertCircle,
  Filter,
  Check,
  MapPin,
  Percent,
  CheckSquare,
  Calculator,
  TrendingUp,
  Sparkles,
  BookOpen,
  SlidersHorizontal,
  Layers,
  Info,
  ArrowUpRight,
} from 'lucide-react';
import { Subject, Exam, ExamType, Task, TaskPriority, TaskType } from '../types';
import { calculateSubjectGradeSummary } from '../utils/gradeCalculations';

interface ExamsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectId?: string;
  onUpdateSubject: (updated: Subject) => void;
  onBatchUpdateSubjects?: (updatedSubjects: Subject[]) => void;
}

const CONVOCATORIA_PRESETS = [
  'Convocatoria Ordinaria (Enero/Febrero)',
  'Convocatoria Ordinaria (Mayo/Junio)',
  'Convocatoria Extraordinaria (Junio/Julio)',
  'Convocatoria Extraordinaria (Septiembre)',
  'Primer Parcial',
  'Segundo Parcial',
  'Tercer Parcial',
  'Evaluación Continua / Control',
  'Examen Final Global',
  'Recuperación',
];

type ModalTab = 'all' | 'exams' | 'tasks' | 'grade_calc';

export const ExamsManagerModal: React.FC<ExamsManagerModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubjectId,
  onUpdateSubject,
  onBatchUpdateSubjects,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(
    initialSubjectId || 'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);

  // Editing state: either an Exam or a Task
  const [editingExam, setEditingExam] = useState<{
    subjectId: string;
    exam: Partial<Exam>;
    isNew: boolean;
  } | null>(null);

  const [editingTask, setEditingTask] = useState<{
    subjectId: string;
    task: Partial<Task>;
    isNew: boolean;
  } | null>(null);

  // Form state for Exam
  const [examSubjectId, setExamSubjectId] = useState<string>(
    initialSubjectId || subjects[0]?.id || ''
  );
  const [examTitle, setExamTitle] = useState<string>('');
  const [examConvocatoria, setExamConvocatoria] = useState<string>('Convocatoria Ordinaria (Mayo/Junio)');
  const [examDate, setExamDate] = useState<string>('');
  const [examTime, setExamTime] = useState<string>('');
  const [examLocation, setExamLocation] = useState<string>('');
  const [examType, setExamType] = useState<ExamType>('test');
  const [examDifficulty, setExamDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('intermedio');
  const [examWeight, setExamWeight] = useState<string>('40');
  const [examTargetGrade, setExamTargetGrade] = useState<string>('8.0');
  const [examFinalGrade, setExamFinalGrade] = useState<string>('');
  const [examNotes, setExamNotes] = useState<string>('');
  const [examSelectedTopics, setExamSelectedTopics] = useState<string[]>([]);

  // Form state for Task
  const [taskSubjectId, setTaskSubjectId] = useState<string>(
    initialSubjectId || subjects[0]?.id || ''
  );
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('media');
  const [taskType, setTaskType] = useState<TaskType>('practica');
  const [taskWeight, setTaskWeight] = useState<string>('15');
  const [taskScore, setTaskScore] = useState<string>('');
  const [taskIsGraded, setTaskIsGraded] = useState<boolean>(true);
  const [taskTopicId, setTaskTopicId] = useState<string>('');
  const [taskSubtopic, setTaskSubtopic] = useState<string>('');
  const [taskNotes, setTaskNotes] = useState<string>('');

  // Flattened exams with subject metadata
  const allExamsList = useMemo(() => {
    const list: Array<{
      subject: Subject;
      exam: Exam;
    }> = [];
    subjects.forEach((sub) => {
      (sub.exams || []).forEach((ex) => {
        list.push({
          subject: sub,
          exam: ex,
        });
      });
    });
    list.sort((a, b) => (a.exam.date || '').localeCompare(b.exam.date || ''));
    return list;
  }, [subjects]);

  // Flattened tasks with subject metadata
  const allTasksList = useMemo(() => {
    const list: Array<{
      subject: Subject;
      task: Task;
    }> = [];
    subjects.forEach((sub) => {
      (sub.tasks || []).forEach((tsk) => {
        list.push({
          subject: sub,
          task: tsk,
        });
      });
    });
    list.sort((a, b) => (a.task.dueDate || '').localeCompare(b.task.dueDate || ''));
    return list;
  }, [subjects]);

  // Grade summaries calculated for all subjects
  const subjectSummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateSubjectGradeSummary>>();
    subjects.forEach((sub) => {
      map.set(sub.id, calculateSubjectGradeSummary(sub));
    });
    return map;
  }, [subjects]);

  // Combined list of items for 'all' tab
  const combinedEvaluations = useMemo(() => {
    type UnifiedItem =
      | { type: 'exam'; subject: Subject; exam: Exam; date: string; title: string; completed: boolean; weight?: number; grade?: number }
      | { type: 'task'; subject: Subject; task: Task; date: string; title: string; completed: boolean; weight?: number; grade?: number };

    const list: UnifiedItem[] = [];

    allExamsList.forEach(({ subject, exam }) => {
      const grade = exam.finalGrade ?? exam.actualGrade;
      list.push({
        type: 'exam',
        subject,
        exam,
        date: exam.date,
        title: exam.title,
        completed: grade !== undefined || !!exam.completed,
        weight: exam.weightPercentage,
        grade,
      });
    });

    allTasksList.forEach(({ subject, task }) => {
      list.push({
        type: 'task',
        subject,
        task,
        date: task.dueDate,
        title: task.title,
        completed: task.score !== undefined || !!task.completed,
        weight: task.weightPercentage,
        grade: task.score,
      });
    });

    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return list;
  }, [allExamsList, allTasksList]);

  // Filtered combined items
  const filteredCombined = useMemo(() => {
    return combinedEvaluations.filter((item) => {
      if (selectedSubjectFilter !== 'all' && item.subject.id !== selectedSubjectFilter) {
        return false;
      }
      if (activeTab === 'exams' && item.type !== 'exam') return false;
      if (activeTab === 'tasks' && item.type !== 'task') return false;
      if (filterStatus === 'pending' && item.completed) return false;
      if (filterStatus === 'completed' && !item.completed) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSub = item.subject.name.toLowerCase().includes(q);
        const matchesDate = (item.date || '').toLowerCase().includes(q);
        let matchesExtra = false;
        if (item.type === 'exam') {
          matchesExtra =
            (item.exam.convocatoria || '').toLowerCase().includes(q) ||
            (item.exam.location || '').toLowerCase().includes(q) ||
            (item.exam.notes || '').toLowerCase().includes(q);
        } else {
          matchesExtra = (item.task.notes || '').toLowerCase().includes(q) || (item.task.subtopic || '').toLowerCase().includes(q);
        }
        if (!matchesTitle && !matchesSub && !matchesDate && !matchesExtra) {
          return false;
        }
      }
      return true;
    });
  }, [combinedEvaluations, selectedSubjectFilter, activeTab, filterStatus, searchQuery]);

  if (!isOpen) return null;

  // Active subject summary for the banner
  const activeSubjectObj = subjects.find((s) => s.id === selectedSubjectFilter);
  const activeSubjectSummary = activeSubjectObj ? subjectSummaries.get(activeSubjectObj.id) : null;

  // Global totals across subjects
  const totalExamsCount = allExamsList.length;
  const totalTasksCount = allTasksList.length;
  const totalGradedCount = combinedEvaluations.filter((i) => i.grade !== undefined).length;

  // Open Create Exam Form
  const handleOpenCreateExam = (preselectedSubjectId?: string) => {
    const targetSubId =
      preselectedSubjectId ||
      (selectedSubjectFilter !== 'all' ? selectedSubjectFilter : subjects[0]?.id || '');
    const sub = subjects.find((s) => s.id === targetSubId);
    setExamSubjectId(targetSubId);
    setExamTitle('');
    setExamConvocatoria('Convocatoria Ordinaria (Mayo/Junio)');
    setExamDate(new Date().toISOString().split('T')[0]);
    setExamTime('');
    setExamLocation('');
    setExamType('test');
    setExamDifficulty('intermedio');
    setExamWeight('40');
    setExamTargetGrade('8.0');
    setExamFinalGrade('');
    setExamNotes('');
    setExamSelectedTopics(sub ? sub.topics.map((t) => t.id) : []);
    setEditingTask(null);
    setEditingExam({
      subjectId: targetSubId,
      exam: { id: `exam-${Date.now()}` },
      isNew: true,
    });
  };

  // Open Edit Exam Form
  const handleOpenEditExam = (subjectId: string, ex: Exam) => {
    const sub = subjects.find((s) => s.id === subjectId);
    setExamSubjectId(subjectId);
    setExamTitle(ex.title);
    setExamConvocatoria(ex.convocatoria || 'Convocatoria Ordinaria');
    setExamDate(ex.date);
    setExamTime(ex.time || '');
    setExamLocation(ex.location || '');
    setExamType(ex.examType || 'test');
    setExamDifficulty(ex.difficulty || 'intermedio');
    setExamWeight(ex.weightPercentage !== undefined ? String(ex.weightPercentage) : '');
    setExamTargetGrade(ex.targetGrade !== undefined ? String(ex.targetGrade) : '');
    setExamFinalGrade(
      ex.finalGrade !== undefined
        ? String(ex.finalGrade)
        : ex.actualGrade !== undefined
        ? String(ex.actualGrade)
        : ''
    );
    setExamNotes(ex.notes || '');
    setExamSelectedTopics(ex.topicIds || (sub ? sub.topics.map((t) => t.id) : []));
    setEditingTask(null);
    setEditingExam({
      subjectId,
      exam: ex,
      isNew: false,
    });
  };

  // Open Create Task Form
  const handleOpenCreateTask = (preselectedSubjectId?: string) => {
    const targetSubId =
      preselectedSubjectId ||
      (selectedSubjectFilter !== 'all' ? selectedSubjectFilter : subjects[0]?.id || '');
    setTaskSubjectId(targetSubId);
    setTaskTitle('');
    setTaskDueDate(new Date().toISOString().split('T')[0]);
    setTaskPriority('media');
    setTaskType('practica');
    setTaskWeight('15');
    setTaskScore('');
    setTaskIsGraded(true);
    setTaskTopicId('');
    setTaskSubtopic('');
    setTaskNotes('');
    setEditingExam(null);
    setEditingTask({
      subjectId: targetSubId,
      task: { id: `task-${Date.now()}` },
      isNew: true,
    });
  };

  // Open Edit Task Form
  const handleOpenEditTask = (subjectId: string, tsk: Task) => {
    setTaskSubjectId(subjectId);
    setTaskTitle(tsk.title);
    setTaskDueDate(tsk.dueDate);
    setTaskPriority(tsk.priority || 'media');
    setTaskType(tsk.type || 'practica');
    setTaskWeight(tsk.weightPercentage !== undefined ? String(tsk.weightPercentage) : '');
    setTaskScore(tsk.score !== undefined ? String(tsk.score) : '');
    setTaskIsGraded(tsk.isGraded ?? (tsk.score !== undefined || tsk.weightPercentage !== undefined));
    setTaskTopicId(tsk.topicId || '');
    setTaskSubtopic(tsk.subtopic || '');
    setTaskNotes(tsk.notes || '');
    setEditingExam(null);
    setEditingTask({
      subjectId,
      task: tsk,
      isNew: false,
    });
  };

  // Save Exam (Create or Update)
  const handleSaveExam = () => {
    if (!editingExam || !examTitle.trim() || !examDate || !examSubjectId) return;

    const targetSub = subjects.find((s) => s.id === examSubjectId);
    if (!targetSub) return;

    const finalG =
      examFinalGrade.trim() !== ''
        ? Math.min(10, Math.max(0, parseFloat(examFinalGrade) || 0))
        : undefined;
    const targetG =
      examTargetGrade.trim() !== ''
        ? Math.min(10, Math.max(0, parseFloat(examTargetGrade) || 0))
        : undefined;
    const weightP =
      examWeight.trim() !== ''
        ? Math.min(100, Math.max(0, parseFloat(examWeight) || 0))
        : undefined;

    const examPayload: Exam = {
      id: editingExam.exam.id || `exam-${Date.now()}`,
      title: examTitle.trim(),
      convocatoria: examConvocatoria.trim() || undefined,
      date: examDate,
      time: examTime.trim() || undefined,
      location: examLocation.trim() || undefined,
      examType,
      difficulty: examDifficulty,
      topicIds: examSelectedTopics,
      weightPercentage: weightP,
      weight: weightP,
      targetGrade: targetG,
      finalGrade: finalG,
      actualGrade: finalG,
      completed: finalG !== undefined || (editingExam.exam.completed ?? false),
      notes: examNotes.trim() || undefined,
    };

    if (editingExam.isNew) {
      const updatedSubject: Subject = {
        ...targetSub,
        exams: [...(targetSub.exams || []), examPayload],
      };
      onUpdateSubject(updatedSubject);
    } else {
      if (editingExam.subjectId === examSubjectId) {
        const updatedExams = (targetSub.exams || []).map((ex) =>
          ex.id === examPayload.id ? examPayload : ex
        );
        onUpdateSubject({
          ...targetSub,
          exams: updatedExams,
        });
      } else {
        const oldSub = subjects.find((s) => s.id === editingExam.subjectId);
        if (oldSub) {
          const updatedOld = {
            ...oldSub,
            exams: (oldSub.exams || []).filter((ex) => ex.id !== examPayload.id),
          };
          const updatedNew = {
            ...targetSub,
            exams: [...(targetSub.exams || []), examPayload],
          };
          if (onBatchUpdateSubjects) {
            onBatchUpdateSubjects([updatedOld, updatedNew]);
          } else {
            onUpdateSubject(updatedOld);
            setTimeout(() => onUpdateSubject(updatedNew), 50);
          }
        }
      }
    }

    setEditingExam(null);
  };

  // Save Task (Create or Update)
  const handleSaveTask = () => {
    if (!editingTask || !taskTitle.trim() || !taskDueDate || !taskSubjectId) return;

    const targetSub = subjects.find((s) => s.id === taskSubjectId);
    if (!targetSub) return;

    const scoreNum =
      taskScore.trim() !== ''
        ? Math.min(10, Math.max(0, parseFloat(taskScore) || 0))
        : undefined;
    const weightNum =
      taskWeight.trim() !== ''
        ? Math.min(100, Math.max(0, parseFloat(taskWeight) || 0))
        : undefined;

    const isGradedBool =
      taskIsGraded || scoreNum !== undefined || weightNum !== undefined;

    const taskPayload: Task = {
      id: editingTask.task.id || `task-${Date.now()}`,
      title: taskTitle.trim(),
      dueDate: taskDueDate,
      priority: taskPriority,
      type: taskType,
      completed: scoreNum !== undefined || (editingTask.task.completed ?? false),
      reminder: editingTask.task.reminder ?? false,
      notes: taskNotes.trim() || undefined,
      topicId: taskTopicId || undefined,
      subtopic: taskSubtopic || undefined,
      score: scoreNum,
      maxScore: 10,
      weightPercentage: weightNum,
      isGraded: isGradedBool,
    };

    if (editingTask.isNew) {
      const updatedSubject: Subject = {
        ...targetSub,
        tasks: [...(targetSub.tasks || []), taskPayload],
      };
      onUpdateSubject(updatedSubject);
    } else {
      if (editingTask.subjectId === taskSubjectId) {
        const updatedTasks = (targetSub.tasks || []).map((t) =>
          t.id === taskPayload.id ? taskPayload : t
        );
        onUpdateSubject({
          ...targetSub,
          tasks: updatedTasks,
        });
      } else {
        const oldSub = subjects.find((s) => s.id === editingTask.subjectId);
        if (oldSub) {
          const updatedOld = {
            ...oldSub,
            tasks: (oldSub.tasks || []).filter((t) => t.id !== taskPayload.id),
          };
          const updatedNew = {
            ...targetSub,
            tasks: [...(targetSub.tasks || []), taskPayload],
          };
          if (onBatchUpdateSubjects) {
            onBatchUpdateSubjects([updatedOld, updatedNew]);
          } else {
            onUpdateSubject(updatedOld);
            setTimeout(() => onUpdateSubject(updatedNew), 50);
          }
        }
      }
    }

    setEditingTask(null);
  };

  // Quick Inline Score Update for Exam
  const handleQuickUpdateExamGrade = (subjectId: string, examId: string, gradeStr: string) => {
    const targetSub = subjects.find((s) => s.id === subjectId);
    if (!targetSub) return;
    const validG =
      gradeStr.trim() === ''
        ? undefined
        : Math.min(10, Math.max(0, parseFloat(gradeStr) || 0));
    const updatedExams = (targetSub.exams || []).map((ex) =>
      ex.id === examId
        ? {
            ...ex,
            finalGrade: validG,
            actualGrade: validG,
            completed: validG !== undefined,
          }
        : ex
    );
    onUpdateSubject({ ...targetSub, exams: updatedExams });
  };

  // Quick Inline Score Update for Task
  const handleQuickUpdateTaskScore = (subjectId: string, taskId: string, scoreStr: string) => {
    const targetSub = subjects.find((s) => s.id === subjectId);
    if (!targetSub) return;
    const validScore =
      scoreStr.trim() === ''
        ? undefined
        : Math.min(10, Math.max(0, parseFloat(scoreStr) || 0));
    const updatedTasks = (targetSub.tasks || []).map((t) =>
      t.id === taskId
        ? {
            ...t,
            score: validScore,
            isGraded: validScore !== undefined || t.isGraded,
            completed: validScore !== undefined ? true : t.completed,
          }
        : t
    );
    onUpdateSubject({ ...targetSub, tasks: updatedTasks });
  };

  // Delete Exam
  const handleDeleteExam = (subjectId: string, examId: string) => {
    const sub = subjects.find((s) => s.id === subjectId);
    if (!sub) return;
    onUpdateSubject({
      ...sub,
      exams: (sub.exams || []).filter((ex) => ex.id !== examId),
    });
    setDeleteConfirmKey(null);
  };

  // Delete Task
  const handleDeleteTask = (subjectId: string, taskId: string) => {
    const sub = subjects.find((s) => s.id === subjectId);
    if (!sub) return;
    onUpdateSubject({
      ...sub,
      tasks: (sub.tasks || []).filter((t) => t.id !== taskId),
    });
    setDeleteConfirmKey(null);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Gestor de Evaluaciones: Tareas y Exámenes</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold uppercase tracking-wider">
                  Cálculo Ponderado
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Añade ponderación (%) y puntuación obtenida (opcionales) para calcular automáticamente la nota final de la asignatura.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!editingExam && !editingTask && (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenCreateExam()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Examen</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenCreateTask()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Tarea</span>
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        {!editingExam && !editingTask && (
          <div className="px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Todas ({combinedEvaluations.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('exams')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'exams'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>Exámenes ({totalExamsCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'tasks'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Tareas ({totalTasksCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('grade_calc')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'grade_calc'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Cálculo Nota Final Ponderada</span>
              </button>
            </div>

            {/* Mobile quick action buttons */}
            <div className="flex sm:hidden items-center gap-1 w-full pt-1">
              <button
                type="button"
                onClick={() => handleOpenCreateExam()}
                className="flex-1 py-1.5 bg-purple-600 text-white text-[11px] font-bold rounded-lg text-center"
              >
                + Examen
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateTask()}
                className="flex-1 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg text-center"
              >
                + Tarea
              </button>
            </div>
          </div>
        )}

        {/* Form View: Exam Create/Edit */}
        {editingExam && (
          <div className="p-6 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-purple-600" />
                <span>
                  {editingExam.isNew
                    ? 'Programar Nueva Convocatoria / Examen'
                    : `Modificar Examen: ${editingExam.exam.title}`}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Volver a la lista
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Materia Vinculada *
                </label>
                <select
                  value={examSubjectId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setExamSubjectId(sid);
                    const sub = subjects.find((s) => s.id === sid);
                    if (sub) {
                      setExamSelectedTopics(sub.topics.map((t) => t.id));
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título del Examen *
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="Ej: Examen Final Ordinario, Parcial Bloque I..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Convocatoria / Llamamiento
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={examConvocatoria}
                    onChange={(e) => setExamConvocatoria(e.target.value)}
                    placeholder="Convocatoria Ordinaria, Extraordinaria, Recuperación..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CONVOCATORIA_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setExamConvocatoria(preset)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                          examConvocatoria === preset
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-purple-100/60'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha del Examen *
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 font-mono-numbers focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Hora (opcional)
                  </label>
                  <input
                    type="time"
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 font-mono-numbers focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Aula / Ubicación
                  </label>
                  <input
                    type="text"
                    value={examLocation}
                    onChange={(e) => setExamLocation(e.target.value)}
                    placeholder="Aula Magna 3"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Examen
                </label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as ExamType)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="test">Tipo Test (Opción Múltiple)</option>
                  <option value="desarrollo">Desarrollo / Preguntas Largas</option>
                  <option value="oral">Examen Oral / Defensa</option>
                  <option value="preguntas_cortas">Preguntas Cortas / Breve</option>
                  <option value="calculo">Examen de Cálculo / Problemas</option>
                  <option value="practico">Examen Práctico / Laboratorio</option>
                  <option value="mixto">Mixto (Teoría + Práctica)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nivel de Exigencia
                </label>
                <select
                  value={examDifficulty}
                  onChange={(e) => setExamDifficulty(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="basico">Básico</option>
                  <option value="intermedio">Intermedio</option>
                  <option value="avanzado">Avanzado / Exigente</option>
                </select>
              </div>

              {/* Ponderación y Nota Obtenida (Opcionales) */}
              <div className="grid grid-cols-3 gap-2 sm:col-span-2 p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-2xl">
                <div>
                  <label className="block font-bold text-purple-900 dark:text-purple-300 mb-1">
                    Ponderación % (opcional)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={examWeight}
                      onChange={(e) => setExamWeight(e.target.value)}
                      placeholder="Ej: 40"
                      className="w-full bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-xl p-2.5 font-mono-numbers font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="absolute right-3 top-2.5 text-purple-400 font-bold">%</span>
                  </div>
                  <span className="text-[10px] text-purple-700/70 dark:text-purple-300/70 mt-0.5 block">
                    Peso en nota final
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-purple-900 dark:text-purple-300 mb-1">
                    Meta de Nota (opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={examTargetGrade}
                    onChange={(e) => setExamTargetGrade(e.target.value)}
                    placeholder="8.0"
                    className="w-full bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-700 rounded-xl p-2.5 font-mono-numbers text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Objetivo personal
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-purple-900 dark:text-purple-300 mb-1">
                    Puntuación Obtenida (opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    value={examFinalGrade}
                    onChange={(e) => setExamFinalGrade(e.target.value)}
                    placeholder="Pendiente"
                    className="w-full bg-white dark:bg-slate-800 border border-purple-400 dark:border-purple-600 rounded-xl p-2.5 font-mono-numbers font-extrabold text-purple-900 dark:text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 block font-semibold">
                    Calificación real 0-10
                  </span>
                </div>
              </div>

              {/* Temas vinculados */}
              {subjects.find((s) => s.id === examSubjectId)?.topics && (
                <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Temas del Temario Incluidos ({examSelectedTopics.length})
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const sub = subjects.find((s) => s.id === examSubjectId);
                          if (sub) setExamSelectedTopics(sub.topics.map((t) => t.id));
                        }}
                        className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamSelectedTopics([])}
                        className="text-[10px] text-slate-400 hover:underline cursor-pointer"
                      >
                        Desmarcar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    {(subjects.find((s) => s.id === examSubjectId)?.topics || []).map((t) => {
                      const isChecked = examSelectedTopics.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-purple-100/70 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 font-semibold'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExamSelectedTopics((prev) => [...prev, t.id]);
                              } else {
                                setExamSelectedTopics((prev) => prev.filter((id) => id !== t.id));
                              }
                            }}
                            className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300"
                          />
                          <span className="truncate">{t.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notas, instrucciones o material permitido (opcional)
                </label>
                <textarea
                  rows={2}
                  value={examNotes}
                  onChange={(e) => setExamNotes(e.target.value)}
                  placeholder="Ej: Se permite calculadora científica. Examen en Aula Magna."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveExam}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {editingExam.isNew ? 'Guardar Examen' : 'Actualizar Examen'}
              </button>
            </div>
          </div>
        )}

        {/* Form View: Task Create/Edit */}
        {editingTask && (
          <div className="p-6 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-600" />
                <span>
                  {editingTask.isNew
                    ? 'Añadir Nueva Tarea / Entrega Evaluable'
                    : `Modificar Tarea: ${editingTask.task.title}`}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Volver a la lista
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Materia Vinculada *
                </label>
                <select
                  value={taskSubjectId}
                  onChange={(e) => {
                    setTaskSubjectId(e.target.value);
                    setTaskTopicId('');
                    setTaskSubtopic('');
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Título de la Tarea / Entrega *
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ej: Práctica 2: Algoritmos Voraces, Entrega Proyecto Bloque II..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha Límite / Entrega *
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 font-mono-numbers focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Tarea
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as TaskType)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="practica">Práctica</option>
                    <option value="entrega">Entrega Oficial</option>
                    <option value="proyecto">Proyecto</option>
                    <option value="lectura">Lectura</option>
                    <option value="repaso">Repaso</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Ponderación y Puntuación Obtenida (Opcionales) */}
              <div className="sm:col-span-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskIsGraded}
                      onChange={(e) => setTaskIsGraded(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span className="font-bold text-blue-900 dark:text-blue-300">
                      Tarea evaluable / con nota para la asignatura (opcional)
                    </span>
                  </label>
                  <span className="text-[10px] text-slate-500 italic">
                    Rellena solo si computa para la nota final
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ponderación % (opcional)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={taskWeight}
                        onChange={(e) => {
                          setTaskWeight(e.target.value);
                          if (e.target.value) setTaskIsGraded(true);
                        }}
                        placeholder="Ej: 15"
                        className="w-full bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl p-2.5 font-mono-numbers font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute right-3 top-2.5 text-blue-400 font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Peso porcentual en la evaluación continua
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Puntuación Obtenida (0 - 10) (opcional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      value={taskScore}
                      onChange={(e) => {
                        setTaskScore(e.target.value);
                        if (e.target.value) setTaskIsGraded(true);
                      }}
                      placeholder="Ej: 9.0"
                      className="w-full bg-white dark:bg-slate-800 border border-blue-400 dark:border-blue-600 rounded-xl p-2.5 font-mono-numbers font-extrabold text-blue-900 dark:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 block font-semibold">
                      Nota obtenida (dejar en blanco si aún no está calificada)
                    </span>
                  </div>
                </div>
              </div>

              {/* Tema y Subtema (opcional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:col-span-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vincular a Tema (opcional)
                  </label>
                  <select
                    value={taskTopicId}
                    onChange={(e) => {
                      setTaskTopicId(e.target.value);
                      setTaskSubtopic('');
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="">— Ningún tema específico —</option>
                    {(subjects.find((s) => s.id === taskSubjectId)?.topics || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subtema del Tema (opcional)
                  </label>
                  <select
                    value={taskSubtopic}
                    disabled={!taskTopicId}
                    onChange={(e) => setTaskSubtopic(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">— Sin subtema —</option>
                    {(
                      subjects
                        .find((s) => s.id === taskSubjectId)
                        ?.topics.find((t) => t.id === taskTopicId)?.subtopics || []
                    ).map((st, idx) => (
                      <option key={idx} value={st}>
                        {idx + 1}. {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Instrucciones o notas adicionales (opcional)
                </label>
                <textarea
                  rows={2}
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="Ej: Entregar en PDF a través del campus virtual. Incluir código fuente."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTask}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {editingTask.isNew ? 'Guardar Tarea' : 'Actualizar Tarea'}
              </button>
            </div>
          </div>
        )}

        {/* Dedicated Calculator Tab View */}
        {!editingExam && !editingTask && activeTab === 'grade_calc' && (
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    Cálculo Automático de Nota Final Ponderada
                  </h4>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    Se calcula combinando los exámenes y tareas evaluables según su ponderación asignada:
                    <span className="font-mono font-bold ml-1">Nota Ponderada = Σ (Nota × Peso) / Σ Peso</span>.
                  </p>
                </div>
              </div>

              {/* Subject filter for calculator */}
              <div className="shrink-0">
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none"
                >
                  <option value="all">Todas las Asignaturas ({subjects.length})</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List of subjects with their calculated grade cards */}
            <div className="space-y-4">
              {subjects
                .filter((s) => selectedSubjectFilter === 'all' || s.id === selectedSubjectFilter)
                .map((sub) => {
                  const summary = subjectSummaries.get(sub.id) || calculateSubjectGradeSummary(sub);

                  return (
                    <div
                      key={sub.id}
                      className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
                    >
                      {/* Subject Header & KPIs */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub.color || '#9333ea' }}
                          />
                          <div>
                            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <span>{sub.name}</span>
                              {sub.code && (
                                <span className="text-xs font-mono font-normal text-slate-400">
                                  ({sub.code})
                                </span>
                              )}
                            </h4>
                            <span className="text-[11px] text-slate-400">
                              {summary.itemsBreakdown.length} componentes evaluables ({summary.gradedItemsCount} con nota)
                            </span>
                          </div>
                        </div>

                        {/* Grade Badges */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-right">
                            <span className="text-[10px] text-slate-400 block font-semibold">
                              Puntos Asegurados
                            </span>
                            <span className="text-sm font-extrabold font-mono-numbers text-slate-900 dark:text-slate-100">
                              {summary.accumulatedPointsOn10.toFixed(2)} / 10
                            </span>
                          </div>

                          <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-300 dark:border-emerald-800 text-right">
                            <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block font-semibold">
                              Nota Media Ponderada
                            </span>
                            <span className="text-base font-extrabold font-mono-numbers text-emerald-700 dark:text-emerald-300">
                              {summary.weightedAverageGrade !== null
                                ? `${summary.weightedAverageGrade.toFixed(2)} / 10`
                                : summary.simpleAverageGraded !== null
                                ? `${summary.simpleAverageGraded.toFixed(2)} / 10 (simple)`
                                : 'Sin notas'}
                            </span>
                          </div>

                          {summary.isPassingSecured ? (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aprobado Asegurado</span>
                            </span>
                          ) : summary.requiredGradeOnRemaining !== null ? (
                            <span
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                                summary.requiredGradeOnRemaining <= 5.0
                                  ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : summary.requiredGradeOnRemaining <= 10.0
                                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              Requiere {summary.requiredGradeOnRemaining.toFixed(2)} / 10 en el{' '}
                              {summary.pendingWeight}% restante
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Weight progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            Ponderación evaluada: <strong className="text-slate-800 dark:text-slate-200">{summary.gradedWeightEvaluated}%</strong> de {summary.totalWeightConfigured}% configurado
                          </span>
                          <span className="text-slate-400 font-mono-numbers text-[11px]">
                            {summary.pendingWeight}% por evaluar
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-500"
                            style={{ width: `${Math.min(100, summary.gradedWeightEvaluated)}%` }}
                            title={`Evaluado: ${summary.gradedWeightEvaluated}%`}
                          />
                          <div
                            className="bg-purple-300 dark:bg-purple-800 h-full transition-all duration-500"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, summary.totalWeightConfigured - summary.gradedWeightEvaluated)
                              )}%`,
                            }}
                            title={`Pendiente configurado: ${Math.max(
                              0,
                              summary.totalWeightConfigured - summary.gradedWeightEvaluated
                            )}%`}
                          />
                        </div>
                      </div>

                      {/* Items table / list */}
                      {summary.itemsBreakdown.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-medium">
                                <th className="pb-2">Elemento</th>
                                <th className="pb-2">Tipo</th>
                                <th className="pb-2">Convocatoria / Fecha</th>
                                <th className="pb-2 text-right">Ponderación</th>
                                <th className="pb-2 text-right">Nota Obtenida</th>
                                <th className="pb-2 text-right">Aportación a Final</th>
                                <th className="pb-2 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono-numbers">
                              {summary.itemsBreakdown.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                  <td className="py-2.5 font-sans font-bold text-slate-900 dark:text-slate-100">
                                    {item.title}
                                  </td>
                                  <td className="py-2.5 font-sans">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        item.type === 'exam'
                                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                                          : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                                      }`}
                                    >
                                      {item.type === 'exam' ? 'Examen' : 'Tarea'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 font-sans text-slate-500 text-[11px]">
                                    {item.convocatoriaOrDueDate || '—'}
                                  </td>
                                  <td className="py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                                    {item.weight !== undefined ? `${item.weight}%` : '—'}
                                  </td>
                                  <td className="py-2.5 text-right">
                                    {item.type === 'exam' ? (
                                      <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={item.grade !== undefined ? item.grade : ''}
                                        onChange={(e) =>
                                          handleQuickUpdateExamGrade(sub.id, item.id, e.target.value)
                                        }
                                        placeholder="—"
                                        className="w-14 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                      />
                                    ) : (
                                      <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        value={item.grade !== undefined ? item.grade : ''}
                                        onChange={(e) =>
                                          handleQuickUpdateTaskScore(sub.id, item.id, e.target.value)
                                        }
                                        placeholder="—"
                                        className="w-14 px-1 py-0.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    )}
                                  </td>
                                  <td className="py-2.5 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                                    {item.grade !== undefined && item.weight !== undefined
                                      ? `+${item.contributionPoints.toFixed(2)} pts`
                                      : '—'}
                                  </td>
                                  <td className="py-2.5 text-right font-sans">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item.type === 'exam') {
                                          const ex = (sub.exams || []).find((e) => e.id === item.id);
                                          if (ex) handleOpenEditExam(sub.id, ex);
                                        } else {
                                          const t = (sub.tasks || []).find((tsk) => tsk.id === item.id);
                                          if (t) handleOpenEditTask(sub.id, t);
                                        }
                                      }}
                                      className="text-slate-400 hover:text-purple-600 p-1 cursor-pointer"
                                      title="Editar componente"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400">
                          No hay tareas ni exámenes configurados con ponderación en esta asignatura.
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* List View: All / Exams / Tasks */}
        {!editingExam && !editingTask && activeTab !== 'grade_calc' && (
          <div className="p-6 overflow-y-auto space-y-4">
            {/* Automatic Weighted Grade Highlight Banner if a specific subject is filtered */}
            {activeSubjectSummary && activeSubjectSummary.hasMetrics && (
              <div className="bg-gradient-to-r from-purple-50/90 via-emerald-50/80 to-blue-50/90 dark:from-purple-950/40 dark:via-emerald-950/30 dark:to-blue-950/40 p-4 rounded-2xl border border-purple-200 dark:border-purple-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      Nota Ponderada Calculada para {activeSubjectObj?.name}:
                    </span>
                    <span className="text-sm font-extrabold font-mono-numbers text-emerald-700 dark:text-emerald-300">
                      {activeSubjectSummary.weightedAverageGrade !== null
                        ? `${activeSubjectSummary.weightedAverageGrade.toFixed(2)} / 10`
                        : `${activeSubjectSummary.accumulatedPointsOn10.toFixed(2)} pts asegurados`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Puntos asegurados en la nota final:{' '}
                    <strong className="text-slate-800 dark:text-slate-200 font-mono-numbers">
                      {activeSubjectSummary.accumulatedPointsOn10.toFixed(2)} / 10
                    </strong>{' '}
                    (con {activeSubjectSummary.gradedWeightEvaluated}% evaluado de {activeSubjectSummary.totalWeightConfigured}%)
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  {activeSubjectSummary.isPassingSecured ? (
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>¡Aprobado Asegurado!</span>
                    </span>
                  ) : activeSubjectSummary.requiredGradeOnRemaining !== null ? (
                    <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 font-semibold text-purple-900 dark:text-purple-300 text-[11px] shadow-2xs">
                      Falta {activeSubjectSummary.requiredGradeOnRemaining.toFixed(2)} / 10 en el{' '}
                      {activeSubjectSummary.pendingWeight}% pendiente
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setActiveTab('grade_calc')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-2xs"
                  >
                    <span>Ver Desglose</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por título, convocatoria o materia..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
                >
                  <option value="all">Todas las materias ({subjects.length})</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.exams?.length || 0} ex. · {s.tasks?.length || 0} tar.)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    filterStatus === 'all'
                      ? 'bg-purple-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Todos ({filteredCombined.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('pending')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    filterStatus === 'pending'
                      ? 'bg-purple-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Pendientes ({filteredCombined.filter((i) => !i.completed).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('completed')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    filterStatus === 'completed'
                      ? 'bg-purple-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Calificados ({filteredCombined.filter((i) => i.completed).length})
                </button>
              </div>
            </div>

            {/* List of Evaluations (Exams & Tasks) */}
            <div className="space-y-3">
              {filteredCombined.map((item) => {
                const isExam = item.type === 'exam';
                const isOverdue = item.date < todayStr && !item.completed;
                const isToday = item.date === todayStr;
                const daysDiff = Math.ceil(
                  (new Date(`${item.date}T00:00:00`).getTime() -
                    new Date(`${todayStr}T00:00:00`).getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                const hasGrade = item.grade !== undefined;
                const gradeVal = item.grade;
                const weightVal = item.weight;
                const contribution =
                  hasGrade && weightVal !== undefined ? (gradeVal! * weightVal) / 100 : null;

                const itemKey = isExam ? `exam-${item.exam.id}` : `task-${item.task.id}`;

                return (
                  <div
                    key={itemKey}
                    className={`p-4 rounded-2xl border transition-all ${
                      hasGrade
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        : isToday
                        ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800 ring-2 ring-purple-400/20'
                        : isOverdue
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.subject.color || '#9333ea' }}
                          />
                          <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                            {item.subject.name}
                          </span>

                          {/* Type Badge: Examen vs Tarea */}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              isExam
                                ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300'
                                : 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300'
                            }`}
                          >
                            {isExam ? 'Examen' : 'Tarea'}
                          </span>

                          {isExam && item.exam.convocatoria && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                              {item.exam.convocatoria}
                            </span>
                          )}

                          {/* Ponderación Badge */}
                          {weightVal !== undefined ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-mono-numbers text-[10px] font-bold">
                              {weightVal}% ponderación
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] italic">
                              Sin ponderar
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </h4>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono-numbers flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            <span>{item.date}</span>
                          </span>

                          {isExam && item.exam.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{item.exam.time}</span>
                            </span>
                          )}

                          {isExam && item.exam.location && (
                            <span className="flex items-center gap-1 font-sans">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{item.exam.location}</span>
                            </span>
                          )}

                          {!isExam && item.task.subtopic && (
                            <span className="font-sans text-[11px] text-blue-600 dark:text-blue-400">
                              · Subtema: {item.task.subtopic}
                            </span>
                          )}
                        </div>

                        {/* Contribution hint */}
                        {contribution !== null && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono-numbers font-medium pt-0.5">
                            Aportación a la asignatura:{' '}
                            <strong className="font-bold">+{contribution.toFixed(2)} pts</strong>{' '}
                            ({gradeVal} × {weightVal}%)
                          </div>
                        )}
                      </div>

                      {/* Right column: Inline Score edit & Actions */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        {/* Inline Grade Input */}
                        <div className="flex items-center gap-1.5">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Puntuación</span>
                            <div className="flex items-center gap-1">
                              {isExam ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  value={gradeVal !== undefined ? gradeVal : ''}
                                  onChange={(e) =>
                                    handleQuickUpdateExamGrade(item.subject.id, item.exam.id, e.target.value)
                                  }
                                  placeholder="—"
                                  className="w-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-center font-extrabold font-mono-numbers text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                  title="Escribe la nota obtenida (0 - 10) para recalcular automáticamente"
                                />
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  value={gradeVal !== undefined ? gradeVal : ''}
                                  onChange={(e) =>
                                    handleQuickUpdateTaskScore(item.subject.id, item.task.id, e.target.value)
                                  }
                                  placeholder="—"
                                  className="w-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 text-center font-extrabold font-mono-numbers text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  title="Escribe la puntuación obtenida (0 - 10) para recalcular automáticamente"
                                />
                              )}
                              <span className="text-[10px] text-slate-400 font-mono-numbers">/10</span>
                            </div>
                          </div>
                        </div>

                        {/* Edit & Delete Actions */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (isExam) {
                                handleOpenEditExam(item.subject.id, item.exam);
                              } else {
                                handleOpenEditTask(item.subject.id, item.task);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 text-slate-700 dark:text-slate-300 hover:text-purple-700 transition-colors cursor-pointer"
                            title="Modificar ponderación, convocatoria o datos"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Modificar</span>
                          </button>

                          {deleteConfirmKey === itemKey ? (
                            <div className="flex items-center gap-1 animate-in fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isExam) {
                                    handleDeleteExam(item.subject.id, item.exam.id);
                                  } else {
                                    handleDeleteTask(item.subject.id, item.task.id);
                                  }
                                }}
                                className="px-2 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white cursor-pointer"
                              >
                                Sí, borrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmKey(null)}
                                className="px-1.5 py-1 rounded-lg text-xs text-slate-400 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmKey(itemKey)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar elemento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCombined.length === 0 && (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-3">
                  <p>No se encontraron evaluaciones con los filtros seleccionados.</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCreateExam()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir Examen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateTask()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir Tarea</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 text-xs shrink-0">
          <span className="text-slate-500 font-mono-numbers">
            {totalExamsCount} exámenes · {totalTasksCount} tareas · {totalGradedCount} con calificación
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
