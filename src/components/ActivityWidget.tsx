import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  ArrowRight,
  AlertCircle,
  CheckSquare,
  Sparkles,
  Play,
  Hourglass,
  GraduationCap,
} from 'lucide-react';
import { Task, Exam, PomodoroLog, StudyPreferences } from '../types';

interface ActivityWidgetProps {
  tasksToday: Array<{
    task: Task;
    subjectId: string;
    subjectName: string;
    subjectColor: string;
  }>;
  nextExam?: {
    exam: Exam;
    subjectId: string;
    subjectName: string;
    subjectColor: string;
  } | null;
  pomodoroLogs?: PomodoroLog[];
  preferences?: StudyPreferences;
  onToggleTask?: (subjectId: string, taskId: string, completed: boolean) => void;
  onOpenScheduler?: () => void;
  onSelectForPomodoro?: (subjectId?: string) => void;
  onSelectSubject?: (subjectId: string) => void;
}

export const ActivityWidget: React.FC<ActivityWidgetProps> = ({
  tasksToday,
  nextExam,
  pomodoroLogs = [],
  preferences,
  onToggleTask,
  onOpenScheduler,
  onSelectForPomodoro,
  onSelectSubject,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentDayOfWeek = new Date().getDay(); // 0 = Domingo, 1 = Lunes, ...

  // 1. Calculate hours studied today from Pomodoro logs
  const todayLogs = pomodoroLogs.filter((log) => {
    if (!log) return false;
    if (log.date === todayStr) return true;
    if (log.timestamp && log.timestamp.startsWith(todayStr)) return true;
    return false;
  });

  const totalMinutesToday = todayLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
  const hoursToday = Math.floor(totalMinutesToday / 60);
  const minutesToday = totalMinutesToday % 60;
  const decimalHoursToday = Math.round((totalMinutesToday / 60) * 10) / 10;

  // Daily target hours from preferences if defined
  const targetDailyHours =
    preferences?.dailyGoalHours ?? preferences?.hoursPerDay?.[currentDayOfWeek] ?? 3;
  const progressRatio = targetDailyHours > 0 ? Math.min(100, Math.round((decimalHoursToday / targetDailyHours) * 100)) : 0;

  // 2. Tasks stats for today
  const completedTasksToday = tasksToday.filter((t) => t.task.completed);
  const pendingTasksToday = tasksToday.filter((t) => !t.task.completed);

  // 3. Exam countdown calculation
  let daysUntilExam: number | null = null;
  let examFormattedDate = '';
  if (nextExam) {
    const examDate = new Date(nextExam.exam.date);
    const todayDate = new Date(todayStr);
    const diffTime = examDate.getTime() - todayDate.getTime();
    daysUntilExam = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    examFormattedDate = new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    }).format(examDate);
  }

  return (
    <div className="bg-gradient-to-br from-white via-slate-50/70 to-blue-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-800/80 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 sm:p-6 transition-all">
      {/* Header with Title and Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <span>Widget de Actividad</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                Hoy
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Resumen dinámico de estudio diario, tareas pendientes y próxima convocatoria
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenScheduler && (
            <button
              type="button"
              onClick={onOpenScheduler}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Ver Planificación</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Main Interactive Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        {/* Card 1: Horas Estudiadas Hoy (Pomodoro) */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Tiempo Estudiado Hoy</span>
              </span>
              <span className="text-[11px] font-mono-numbers font-medium text-slate-400">
                Objetivo: {targetDailyHours}h
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                {hoursToday > 0 ? `${hoursToday}h ${minutesToday}m` : `${minutesToday} min`}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono-numbers">
                ({decimalHoursToday}h)
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {todayLogs.length > 0
                ? `${todayLogs.length} ${todayLogs.length === 1 ? 'bloque Pomodoro completado' : 'bloques Pomodoro completados'}`
                : 'Sin sesiones de Pomodoro registradas hoy'}
            </p>

            {/* Daily progress bar towards hours goal */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-numbers">
                <span>Avance diario</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{progressRatio}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progressRatio >= 100
                      ? 'bg-emerald-500'
                      : progressRatio >= 50
                      ? 'bg-blue-600'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${progressRatio}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            {onSelectForPomodoro && (
              <button
                type="button"
                onClick={() => onSelectForPomodoro()}
                className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Iniciar Enfoque Pomodoro</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Tareas para Hoy */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="font-semibold flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Tareas para Hoy</span>
              </span>
              <span className="font-mono-numbers text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {completedTasksToday.length}/{tasksToday.length}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                {pendingTasksToday.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {pendingTasksToday.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}
              </span>
            </div>

            {/* List of today's tasks */}
            <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {tasksToday.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1 opacity-80" />
                  <span>¡Al día! No tienes tareas fijadas para hoy</span>
                </div>
              ) : (
                tasksToday.map(({ task, subjectId, subjectName, subjectColor }) => (
                  <div
                    key={task.id}
                    className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                      task.completed
                        ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleTask && onToggleTask(subjectId, task.id, !task.completed)}
                        className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <span
                        className={`truncate font-medium ${
                          task.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                        title={task.title}
                      >
                        {task.title}
                      </span>
                    </div>

                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 text-white truncate max-w-24"
                      style={{ backgroundColor: subjectColor || '#3b82f6' }}
                      title={subjectName}
                    >
                      {subjectName}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {tasksToday.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-center">
              <span className="text-[11px] text-slate-400">
                {pendingTasksToday.length === 0
                  ? '🎉 ¡Todas las tareas de hoy completadas!'
                  : `Quedan ${pendingTasksToday.length} entregas o revisiones`}
              </span>
            </div>
          )}
        </div>

        {/* Card 3: Próxima Fecha de Examen */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="font-semibold flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Próximo Examen</span>
              </span>
              {daysUntilExam !== null && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono-numbers ${
                    daysUntilExam === 0
                      ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 animate-pulse'
                      : daysUntilExam <= 3
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                      : 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
                  }`}
                >
                  {daysUntilExam === 0
                    ? '¡Hoy!'
                    : daysUntilExam === 1
                    ? '¡Mañana!'
                    : `En ${daysUntilExam} días`}
                </span>
              )}
            </div>

            {nextExam ? (
              <div className="space-y-2 mt-1">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                    {nextExam.exam.title}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: nextExam.subjectColor || '#8b5cf6' }}
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                      {nextExam.subjectName}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200/60 dark:border-purple-900/50 text-xs space-y-1">
                  <div className="flex items-center justify-between text-purple-900 dark:text-purple-200">
                    <span className="font-semibold">Fecha:</span>
                    <span className="font-bold font-mono-numbers capitalize">{examFormattedDate}</span>
                  </div>
                  {nextExam.exam.time && (
                    <div className="flex items-center justify-between text-purple-800/80 dark:text-purple-300/80 text-[11px]">
                      <span>Hora:</span>
                      <span className="font-mono-numbers">{nextExam.exam.time}</span>
                    </div>
                  )}
                  {(nextExam.exam.weightPercentage !== undefined || nextExam.exam.weight !== undefined) && (
                    <div className="flex items-center justify-between text-purple-800/80 dark:text-purple-300/80 text-[11px]">
                      <span>Ponderación:</span>
                      <span className="font-mono-numbers font-bold">
                        {nextExam.exam.weightPercentage ?? nextExam.exam.weight}% nota final
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400 mt-2">
                <Hourglass className="w-4 h-4 text-slate-400 mx-auto mb-1 opacity-70" />
                <span>No hay exámenes programados próximamente</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            {nextExam && onSelectSubject ? (
              <button
                type="button"
                onClick={() => onSelectSubject(nextExam.subjectId)}
                className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-700/70 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-800 dark:text-purple-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Preparar Materia</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : onOpenScheduler ? (
              <button
                type="button"
                onClick={onOpenScheduler}
                className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>Ver Calendario</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
