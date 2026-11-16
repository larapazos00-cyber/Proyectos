import React, { useState, useMemo } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  Trash2,
  Edit3,
  Calendar,
  Sparkles,
  Minus,
  Check,
  X,
} from 'lucide-react';
import {
  Subject,
  StudyPreferences,
  SubjectSmartGoal,
  SmartGoalMilestone,
} from '../types';
import { getTodayLocalDateStr } from '../utils/dateUtils';
import {
  getSubjectSmartGoals,
  calculateSmartGoalProgress,
  upsertGoalOnSubject,
  deleteGoalFromSubject,
} from '../utils/smartGoalsUtils';

interface SubjectSmartGoalsTabProps {
  subject: Subject;
  allSubjects?: Subject[];
  preferences?: StudyPreferences;
  onUpdateSubject: (updated: Subject) => void;
  onOpenGoalAssistant?: () => void;
}

function addDaysIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

export const SubjectSmartGoalsTab: React.FC<SubjectSmartGoalsTabProps> = ({
  subject,
  allSubjects,
  preferences,
  onUpdateSubject,
  onOpenGoalAssistant,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const subjectColor = subject.color || '#3b82f6';

  const goals = useMemo(() => getSubjectSmartGoals(subject), [subject]);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Form state for creating/editing a SMART goal
  const [title, setTitle] = useState<string>('');
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja'>('alta');
  const [timeframe, setTimeframe] = useState<SubjectSmartGoal['timeframe']>('semanal');
  const [specific, setSpecific] = useState<string>('');
  const [measurable, setMeasurable] = useState<string>('');
  const [achievable, setAchievable] = useState<string>('');
  const [relevant, setRelevant] = useState<string>('');
  const [timeBound, setTimeBound] = useState<string>('En los próximos 7 días');
  const [targetDate, setTargetDate] = useState<string>(() => addDaysIso(getTodayLocalDateStr(), 7));
  const [metricLabel, setMetricLabel] = useState<string>('Temas');
  const [targetValue, setTargetValue] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('0');
  const [milestonesInput, setMilestonesInput] = useState<string>('');

  const resetForm = () => {
    setEditingGoalId(null);
    setTitle('');
    setPriority('alta');
    setTimeframe('semanal');
    setSpecific('');
    setMeasurable('');
    setAchievable(
      `Planificando bloques diarios de 45-60 min según ${preferences?.dailyGoalHours || 3}h/día de estudio.`
    );
    setRelevant('');
    setTimeBound('En los próximos 7 días');
    setTargetDate(addDaysIso(todayStr, 7));
    setMetricLabel('Temas');
    setTargetValue('');
    setCurrentValue('0');
    setMilestonesInput('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (goal: SubjectSmartGoal) => {
    setEditingGoalId(goal.id);
    setTitle(goal.title);
    setPriority(goal.priority);
    setTimeframe(goal.timeframe || 'semanal');
    setSpecific(goal.specific);
    setMeasurable(goal.measurable);
    setAchievable(goal.achievable);
    setRelevant(goal.relevant);
    setTimeBound(goal.timeBound);
    setTargetDate(goal.targetDate || addDaysIso(todayStr, 7));
    setMetricLabel(goal.metricLabel || 'Temas');
    setTargetValue(goal.targetValue !== undefined ? String(goal.targetValue) : '');
    setCurrentValue(goal.currentValue !== undefined ? String(goal.currentValue) : '0');
    setMilestonesInput((goal.milestones || []).map((m) => m.title).join('\n'));
    setIsFormOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !specific.trim()) return;

    const existingGoal = editingGoalId ? goals.find((g) => g.id === editingGoalId) : undefined;
    const rawLines = milestonesInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const parsedMilestones: SmartGoalMilestone[] =
      rawLines.length > 0
        ? rawLines.map((line, idx) => {
            const matchedPrev = existingGoal?.milestones?.find(
              (m) => m.title.toLowerCase() === line.toLowerCase()
            );
            return {
              id: matchedPrev?.id || `ms-${Date.now()}-${idx}`,
              title: line,
              completed: matchedPrev?.completed || false,
            };
          })
        : existingGoal?.milestones && existingGoal.milestones.length > 0
        ? existingGoal.milestones
        : [
            {
              id: `ms-${Date.now()}-0`,
              title: `Completar ${title.trim()}`,
              completed: false,
            },
          ];

    const parsedTargetNum = targetValue.trim() ? parseFloat(targetValue) : undefined;
    const parsedCurrentNum = currentValue.trim() ? parseFloat(currentValue) : 0;
    const validTarget =
      parsedTargetNum !== undefined && !isNaN(parsedTargetNum) && parsedTargetNum > 0
        ? parsedTargetNum
        : undefined;
    const validCurrent =
      validTarget !== undefined && !isNaN(parsedCurrentNum)
        ? Math.max(0, Math.min(validTarget, parsedCurrentNum))
        : undefined;

    const goalId = existingGoal?.id || `smart-sub-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const nextGoal: SubjectSmartGoal = {
      id: goalId,
      subjectId: subject.id,
      subjectName: subject.name,
      title: title.trim(),
      priority,
      timeframe,
      specific: specific.trim(),
      measurable:
        measurable.trim() ||
        (validTarget
          ? `Alcanzar ${validTarget} ${metricLabel || 'unidades'} verificadas.`
          : `Completar los ${parsedMilestones.length} hitos definidos.`),
      achievable:
        achievable.trim() ||
        `Ajustado a bloques realistas de estudio en ${subject.name}.`,
      relevant:
        relevant.trim() ||
        `Clave para consolidar resultados y evaluación en ${subject.name}.`,
      timeBound: timeBound.trim() || `Objetivo hasta ${targetDate}`,
      targetDate: targetDate || addDaysIso(todayStr, 7),
      metricLabel: validTarget ? metricLabel.trim() || 'Hitos' : undefined,
      targetValue: validTarget,
      currentValue: validCurrent,
      milestones: parsedMilestones,
      createdAt: existingGoal?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const updatedSub = upsertGoalOnSubject(subject, nextGoal, allSubjects);
    onUpdateSubject(updatedSub);
    setIsFormOpen(false);
    resetForm();
  };

  const handleToggleMilestone = (goal: SubjectSmartGoal, milestoneId: string) => {
    const updatedMilestones = goal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );
    const updatedGoal: SubjectSmartGoal = {
      ...goal,
      milestones: updatedMilestones,
      updatedAt: new Date().toISOString(),
    };
    const updatedSub = upsertGoalOnSubject(subject, updatedGoal, allSubjects);
    onUpdateSubject(updatedSub);
  };

  const handleStepNumericProgress = (goal: SubjectSmartGoal, delta: number) => {
    if (!goal.targetValue || goal.targetValue <= 0) return;
    const current = goal.currentValue || 0;
    const nextVal = Math.max(0, Math.min(goal.targetValue, current + delta));
    const updatedGoal: SubjectSmartGoal = {
      ...goal,
      currentValue: nextVal,
      updatedAt: new Date().toISOString(),
    };
    const updatedSub = upsertGoalOnSubject(subject, updatedGoal, allSubjects);
    onUpdateSubject(updatedSub);
  };

  const handleDeleteGoal = (goalId: string) => {
    const updatedSub = deleteGoalFromSubject(subject, goalId, allSubjects);
    onUpdateSubject(updatedSub);
  };

  const enrichedGoals = useMemo(() => {
    return goals.map((goal) => ({
      goal,
      progress: calculateSmartGoalProgress(goal, subject),
    }));
  }, [goals, subject]);

  const filteredGoals = useMemo(() => {
    if (statusFilter === 'completed') {
      return enrichedGoals.filter((item) => item.progress.pct >= 100);
    }
    if (statusFilter === 'active') {
      return enrichedGoals.filter((item) => item.progress.pct < 100);
    }
    return enrichedGoals;
  }, [enrichedGoals, statusFilter]);

  const averagePct = useMemo(() => {
    if (enrichedGoals.length === 0) return 0;
    const sum = enrichedGoals.reduce((acc, g) => acc + g.progress.pct, 0);
    return Math.round(sum / enrichedGoals.length);
  }, [enrichedGoals]);

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: subjectColor }}
            />
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
              {subject.name}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-numbers tabular-nums">
              {goals.length} {goals.length === 1 ? 'objetivo' : 'objetivos'} SMART · {averagePct}% promedio
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Objetivos SMART de la Asignatura
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define metas Específicas, Medibles, Alcanzables, Relevantes y Temporales sincronizadas con el panel general.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'active', label: 'En curso' },
                { id: 'completed', label: 'Completados' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {onOpenGoalAssistant && (
            <button
              type="button"
              onClick={onOpenGoalAssistant}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Asistente IA</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (isFormOpen ? setIsFormOpen(false) : handleOpenCreate())}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFormOpen ? 'Cerrar formulario' : 'Nuevo Objetivo SMART'}</span>
          </button>
        </div>
      </div>

      {/* Create / Edit SMART Goal Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveGoal}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingGoalId ? 'Editar Objetivo SMART' : `Definir Objetivo SMART · ${subject.name}`}
            </h4>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              aria-label="Cancelar edición"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Core Identity Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <div className="md:col-span-6">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Título del Objetivo *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Ej: Dominar bloques clave de ${subject.name} antes del parcial`}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Horizonte
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as SubjectSmartGoal['timeframe'])}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="examenes">Convocatoria / Examen</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'alta' | 'media' | 'baja')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="alta">Prioridad Alta</option>
                <option value="media">Prioridad Media</option>
                <option value="baja">Prioridad Baja</option>
              </select>
            </div>
          </div>

          {/* 5 Explicit S.M.A.R.T Criteria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                S · Específico *
              </label>
              <textarea
                rows={2}
                required
                value={specific}
                onChange={(e) => setSpecific(e.target.value)}
                placeholder="¿Qué temas, habilidades o entregables concretos quieres lograr?"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                M · Medible (Criterio de éxito)
              </label>
              <textarea
                rows={2}
                value={measurable}
                onChange={(e) => setMeasurable(e.target.value)}
                placeholder="Ej: Superar >85% en el simulacro y completar los 4 temas prácticos."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                A · Alcanzable (Plan realista)
              </label>
              <textarea
                rows={2}
                value={achievable}
                onChange={(e) => setAchievable(e.target.value)}
                placeholder="¿Con qué bloques diarios o recursos reales lo vas a conseguir?"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                R · Relevante (Impacto académico)
              </label>
              <textarea
                rows={2}
                value={relevant}
                onChange={(e) => setRelevant(e.target.value)}
                placeholder="¿Por qué es clave para la nota o evaluación de esta asignatura?"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* T (Time-bound) + Quantitative Target + Actionable Milestones */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="md:col-span-3">
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                T · Fecha Límite
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono-numbers"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                T · Plazo descriptivo
              </label>
              <input
                type="text"
                value={timeBound}
                onChange={(e) => setTimeBound(e.target.value)}
                placeholder="Ej: Antes del parcial 1"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Meta numérica (opc.)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Ej: 5"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono-numbers"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Avance inicial
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                disabled={!targetValue}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono-numbers disabled:opacity-50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Unidad
              </label>
              <input
                type="text"
                value={metricLabel}
                onChange={(e) => setMetricLabel(e.target.value)}
                placeholder="Temas / Horas"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-12">
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Hitos medibles (uno por línea — opcional, actualizan la barra de progreso)
              </label>
              <textarea
                rows={3}
                value={milestonesInput}
                onChange={(e) => setMilestonesInput(e.target.value)}
                placeholder={'Resumen y mapa conceptual del Tema 1\nEjercicios prácticos sin apuntes\nSimulacro de autoevaluación (>80%)'}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingGoalId ? 'Guardar cambios' : 'Crear Objetivo SMART'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Goals List */}
      {filteredGoals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto">
            <Target className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {goals.length === 0
                ? `Sin objetivos SMART definidos para ${subject.name}`
                : 'No hay objetivos en este filtro'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Crea una meta Específica, Medible, Alcanzable, Relevante y Temporal para hacer seguimiento visual desde el panel general.
            </p>
          </div>
          {goals.length === 0 && (
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Definir Objetivo SMART</span>
              </button>
              {onOpenGoalAssistant && (
                <button
                  type="button"
                  onClick={onOpenGoalAssistant}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Usar Asistente Guiado</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGoals.map(({ goal, progress }) => {
            const deadlineText =
              progress.status === 'completed'
                ? 'Completado'
                : progress.daysRemaining === null
                ? goal.timeBound
                : progress.daysRemaining < 0
                ? `Vencido hace ${Math.abs(progress.daysRemaining)}d`
                : progress.daysRemaining === 0
                ? 'Vence hoy'
                : `En ${progress.daysRemaining}d · ${goal.targetDate}`;

            return (
              <div
                key={goal.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                        Prioridad {goal.priority}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{goal.timeframe}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-mono-numbers tabular-nums font-semibold ${
                          progress.status === 'completed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : progress.status === 'overdue'
                            ? 'text-rose-600 dark:text-rose-400'
                            : progress.status === 'due_soon'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {deadlineText}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {goal.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold font-mono-numbers tabular-nums text-slate-900 dark:text-white">
                        {progress.pct}%
                      </div>
                      <div className="text-[11px] font-mono-numbers tabular-nums text-slate-500 dark:text-slate-400">
                        {goal.targetValue
                          ? `${goal.currentValue || 0}/${goal.targetValue} ${goal.metricLabel || ''}`
                          : `${progress.completedMilestones}/${progress.totalMilestones} hitos`}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(goal)}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Editar objetivo SMART"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Eliminar objetivo SMART"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress.pct}%`,
                      backgroundColor: progress.pct >= 100 ? '#16a34a' : subjectColor,
                    }}
                  />
                </div>

                {/* Numeric Counter Controls (if configured) */}
                {goal.targetValue !== undefined && goal.targetValue > 0 && (
                  <div className="flex items-center justify-between gap-3 pt-1 text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Progreso medible ({goal.metricLabel || 'Unidades'}):{' '}
                      <strong className="font-mono-numbers tabular-nums text-slate-900 dark:text-white">
                        {goal.currentValue || 0} / {goal.targetValue}
                      </strong>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStepNumericProgress(goal, -1)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                        aria-label="Reducir progreso"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepNumericProgress(goal, 1)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                        aria-label="Incrementar progreso"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* S-M-A-R-T Criteria Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      S · Específico
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {goal.specific}
                    </p>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      M · Medible
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {goal.measurable}
                    </p>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      A · Alcanzable
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {goal.achievable}
                    </p>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      R · Relevante
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {goal.relevant}
                    </p>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      T · Temporal
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {goal.timeBound}
                      {goal.targetDate ? ` (${goal.targetDate})` : ''}
                    </p>
                  </div>
                </div>

                {/* Actionable Milestones Checklist */}
                {goal.milestones && goal.milestones.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Hitos del objetivo ({progress.completedMilestones}/{progress.totalMilestones})
                      </span>
                      {progress.linkedTasksTotal > 0 && (
                        <span className="text-slate-500 dark:text-slate-400 font-mono-numbers tabular-nums">
                          {progress.linkedTasksDone}/{progress.linkedTasksTotal} tareas en calendario
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {goal.milestones.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 cursor-pointer text-xs transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={m.completed}
                            onChange={() => handleToggleMilestone(goal, m.id)}
                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span
                            className={
                              m.completed
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-800 dark:text-slate-200 font-medium'
                            }
                          >
                            {m.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
