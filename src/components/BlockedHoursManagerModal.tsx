import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Dumbbell,
  Car,
  Coffee,
  User,
  Users,
  Repeat,
  Zap,
  BookOpen,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Subject,
  StudyPreferences,
  BlockedTimeEvent,
  WeeklyObligation,
  BlockedCategory,
} from '../types';
import {
  schedulerService,
  BLOCKED_REASON_DEFINITIONS,
} from '../services/schedulerService';

interface BlockedHoursManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  preferences: StudyPreferences;
  onUpdatePreferences: (updated: StudyPreferences) => void;
  blockedEvents: BlockedTimeEvent[];
  onAddBlockedEvent: (event: BlockedTimeEvent) => void;
  onDeleteBlockedEvent: (id: string) => void;
  onUpdateTopicsSchedule?: (subjectId: string, updatedTopics: any[]) => void;
  onUpdateSubject?: (updatedSubject: Subject) => void;
}

const DAYS_SHORT = [
  { day: 1, label: 'Lun' },
  { day: 2, label: 'Mar' },
  { day: 3, label: 'Mié' },
  { day: 4, label: 'Jue' },
  { day: 5, label: 'Vie' },
  { day: 6, label: 'Sáb' },
  { day: 0, label: 'Dom' },
];

export const BlockedHoursManagerModal: React.FC<BlockedHoursManagerModalProps> = ({
  isOpen,
  onClose,
  subjects,
  preferences,
  onUpdatePreferences,
  blockedEvents,
  onAddBlockedEvent,
  onDeleteBlockedEvent,
  onUpdateTopicsSchedule,
  onUpdateSubject,
}) => {
  // Form State para añadir un nuevo bloqueo
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BlockedCategory>('trabajo');
  const [customCategoryLabel, setCustomCategoryLabel] = useState('');
  const [isRecurringWeekly, setIsRecurringWeekly] = useState(true);
  const [selectedRecurringDays, setSelectedRecurringDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [specificDate, setSpecificDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [notes, setNotes] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateFeedback, setRecalculateFeedback] = useState<string | null>(null);

  // Calcular la duración en horas del formulario actual
  const computedDurationHours = useMemo(() => {
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    const startM = (h1 || 0) * 60 + (m1 || 0);
    const endM = (h2 || 0) * 60 + (m2 || 0);
    const diff = endM - startM;
    return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
  }, [startTime, endTime]);

  // Cálculo de necesidades diarias de estudio + repaso y desglose de horas bloqueadas
  const dailyNeeds = useMemo(() => {
    return schedulerService.calculateDailyStudyAndReviewNeeds(
      subjects,
      preferences,
      blockedEvents,
      preferences.weeklyFixedObligations || []
    );
  }, [subjects, preferences, blockedEvents]);

  if (!isOpen) return null;

  const toggleRecurringDay = (dayNum: number) => {
    setSelectedRecurringDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]
    );
  };

  const handleCreateBlockedEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !customCategoryLabel.trim()) {
      setTitle(BLOCKED_REASON_DEFINITIONS[category]?.label || 'Bloqueo personal');
    }

    const finalTitle = title.trim() || customCategoryLabel.trim() || BLOCKED_REASON_DEFINITIONS[category]?.label || 'Bloqueo';
    const newEvent: BlockedTimeEvent = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: finalTitle,
      category,
      startTime,
      endTime,
      durationHours: computedDurationHours,
      notes: notes.trim() || undefined,
      ...(isRecurringWeekly
        ? { recurringDays: selectedRecurringDays.length > 0 ? selectedRecurringDays : [1, 2, 3, 4, 5] }
        : { date: specificDate }),
    };

    onAddBlockedEvent(newEvent);

    // Si también es recurrente semanal, podemos sincronizarlo con weeklyFixedObligations
    if (isRecurringWeekly && selectedRecurringDays.length > 0) {
      const newObligations: WeeklyObligation[] = selectedRecurringDays.map((dayNum) => ({
        id: `ob-${Date.now()}-${dayNum}`,
        title: finalTitle,
        category: (category as any) || 'otro',
        dayOfWeek: dayNum,
        startTime,
        endTime,
        durationHours: computedDurationHours,
        isAutomatedWeekly: true,
        recurringDays: selectedRecurringDays,
      }));

      const existingObs = preferences.weeklyFixedObligations || [];
      onUpdatePreferences({
        ...preferences,
        weeklyFixedObligations: [...existingObs, ...newObligations],
      });
    }

    // Resetear formulario
    setTitle('');
    setNotes('');
    setCustomCategoryLabel('');
  };

  // Botón maestro: Recalcular los temas a estudiar según las horas bloqueadas
  const handleExecuteRecalculation = () => {
    setIsRecalculating(true);
    setRecalculateFeedback(null);

    setTimeout(() => {
      try {
        const result = schedulerService.recalculateTopicsAccordingToBlockedHours(
          subjects,
          preferences,
          blockedEvents,
          preferences.weeklyFixedObligations || []
        );

        // Actualizar temas en cada materia
        result.updatedSubjects.forEach((sub) => {
          if (onUpdateTopicsSchedule) {
            onUpdateTopicsSchedule(sub.id, sub.topics);
          } else if (onUpdateSubject) {
            onUpdateSubject(sub);
          }
        });

        // Actualizar preferencias con la nueva capacidad diaria
        onUpdatePreferences(result.updatedPreferences);

        setRecalculateFeedback(result.summaryMessage);
      } catch (err: any) {
        console.error('Error al recalcular temas por horas bloqueadas:', err);
        setRecalculateFeedback('No se pudo completar el recálculo automático. Revisa los datos.');
      } finally {
        setIsRecalculating(false);
      }
    }, 450);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'clase':
        return GraduationCap;
      case 'trabajo':
        return Briefcase;
      case 'medico':
        return HeartPulse;
      case 'deporte':
        return Dumbbell;
      case 'transporte':
        return Car;
      case 'descanso':
        return Coffee;
      case 'social':
        return Users;
      case 'personal':
        return User;
      default:
        return Clock;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera del Modal */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Horas Bloqueadas y Cálculo de Estudio</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold font-mono-numbers">
                  {dailyNeeds.totalHoursNeededDaily}h necesarias/día
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Añade tus motivos de bloqueo (trabajo, clases, médico, deporte...) y ajusta tu temario automáticamente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* TARJETA DESTACADA: ¿Cuántas horas necesito al día para estudiar + repasar? */}
          <div className="p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                  Diagnóstico Diario: ¿Cuántas horas necesito al día?
                </span>
              </div>
              {dailyNeeds.targetExamTitle && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-mono-numbers">
                  Meta: {dailyNeeds.targetExamTitle} ({dailyNeeds.daysUntilExam} días)
                </span>
              )}
            </div>

            {/* 4 Métricas Clave */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 1. Nuevo Estudio */}
              <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-blue-100 dark:border-slate-700/60 shadow-2xs">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  <span>Nuevo Estudio</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1 font-mono-numbers">
                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {dailyNeeds.newStudyHoursNeededDaily}
                  </span>
                  <span className="text-xs text-slate-500">h/día</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  {dailyNeeds.remainingNewTopicsCount} temas · {dailyNeeds.remainingNewPagesCount}p rest.
                </div>
              </div>

              {/* 2. Repasos Curva Olvido */}
              <div className="p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-indigo-100 dark:border-slate-700/60 shadow-2xs">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Repasos (Curva)</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1 font-mono-numbers">
                  <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                    {dailyNeeds.reviewHoursNeededDaily}
                  </span>
                  <span className="text-xs text-slate-500">h/día</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  {dailyNeeds.activeReviewsCount} temas en ciclo (1d, 3d, 7d...)
                </div>
              </div>

              {/* 3. TOTAL NECESARIO AL DÍA */}
              <div className="p-3.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                <div className="text-[11px] font-semibold text-blue-100 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Total Necesario</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1 font-mono-numbers">
                  <span className="text-2xl font-bold text-white">
                    {dailyNeeds.totalHoursNeededDaily}
                  </span>
                  <span className="text-xs text-blue-100">h/día</span>
                </div>
                <div className="text-[10px] text-blue-100 mt-1 truncate">
                  Estudio ({dailyNeeds.newStudyHoursNeededDaily}h) + Repaso ({dailyNeeds.reviewHoursNeededDaily}h)
                </div>
              </div>

              {/* 4. HORAS LIBRES REALES TRAS BLOQUEOS */}
              <div className={`p-3.5 rounded-xl border shadow-2xs ${
                dailyNeeds.status === 'sobrecarga'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
                  : dailyNeeds.status === 'ajustado'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
              }`}>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Horas Reales</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1 font-mono-numbers">
                  <span className={`text-2xl font-bold ${
                    dailyNeeds.status === 'sobrecarga'
                      ? 'text-rose-700 dark:text-rose-400'
                      : dailyNeeds.status === 'ajustado'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {dailyNeeds.realAvailableHoursDaily}
                  </span>
                  <span className="text-xs text-slate-500">h/día</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {dailyNeeds.dailyAvgBlockedHours}h bloq. ({dailyNeeds.totalBlockedHoursWeekly}h/sem)
                </div>
              </div>
            </div>

            {/* Diagnóstico y Viabilidad */}
            <div className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
              dailyNeeds.status === 'sobrecarga'
                ? 'bg-rose-100/70 text-rose-900 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-900'
                : dailyNeeds.status === 'ajustado'
                ? 'bg-amber-100/70 text-amber-900 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900'
                : 'bg-emerald-100/70 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900'
            }`}>
              {dailyNeeds.status === 'sobrecarga' ? (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : dailyNeeds.status === 'ajustado' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium leading-relaxed">
                {dailyNeeds.statusMessage}
              </div>
            </div>

            {/* BOTÓN RECALCULAR TEMAS SEGÚN HORAS BLOQUEADAS */}
            <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExecuteRecalculation}
                disabled={isRecalculating}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 text-yellow-400 ${isRecalculating ? 'animate-spin' : ''}`} />
                <span>
                  {isRecalculating
                    ? 'Recalculando temario y horas...'
                    : '⚡ Recalcular Temas según Horas Bloqueadas'}
                </span>
              </button>

              <span className="text-xs text-slate-500 dark:text-slate-400">
                Reorganiza fechas de temas y repasos sin superar tus horas libres
              </span>
            </div>

            {recalculateFeedback && (
              <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{recalculateFeedback}</span>
              </div>
            )}
          </div>

          {/* FORMULARIO: Añadir Distintos Motivos de Bloqueo */}
          <form onSubmit={handleCreateBlockedEvent} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Añadir Motivo de Bloqueo de Horas</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono-numbers">
                Duración: <strong className="text-slate-800 dark:text-slate-200">{computedDurationHours}h</strong>
              </span>
            </div>

            {/* Selector de Categorías / Motivos */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Motivo del Bloqueo:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(BLOCKED_REASON_DEFINITIONS).map(([key, def]) => {
                  const Icon = getCategoryIcon(key);
                  const isSelected = category === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCategory(key as BlockedCategory)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-500'}`} />
                      <span className="truncate">{def.label.split('/')[0].trim()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Título o descripción del motivo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Descripción / Actividad:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Ej: Turno de tarde, Clase de Anatomía, Gimnasio...`}
                  className="mt-1 w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Horario Inicio y Fin */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Hora Inicio:
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Hora Fin:
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Recurrencia semanal vs Fecha específica */}
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="recurrence"
                    checked={isRecurringWeekly}
                    onChange={() => setIsRecurringWeekly(true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Se repite todas las semanas</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="recurrence"
                    checked={!isRecurringWeekly}
                    onChange={() => setIsRecurringWeekly(false)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Fecha única puntual</span>
                </label>
              </div>

              {isRecurringWeekly ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-500 mr-2">Días activos:</span>
                  {DAYS_SHORT.map(({ day, label }) => {
                    const isDaySelected = selectedRecurringDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleRecurringDay(day)}
                        className={`w-9 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isDaySelected
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="max-w-xs">
                  <label className="text-xs text-slate-500">Fecha del bloqueo:</label>
                  <input
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Guardar Motivo de Bloqueo ({computedDurationHours}h)</span>
              </button>
            </div>
          </form>

          {/* LISTADO DE BLOQUEOS ACTIVOS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Motivos de Bloqueo Registrados ({blockedEvents.length + (preferences.weeklyFixedObligations?.length || 0)})</span>
              <span className="font-mono-numbers text-slate-700 dark:text-slate-300 font-bold">
                {dailyNeeds.totalBlockedHoursWeekly}h bloqueadas / semana
              </span>
            </h3>

            {blockedEvents.length === 0 && (!preferences.weeklyFixedObligations || preferences.weeklyFixedObligations.length === 0) ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                No tienes horas bloqueadas actualmente. Todo tu tiempo disponible está libre para el estudio.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {blockedEvents.map((evt) => {
                  const Icon = getCategoryIcon(evt.category);
                  const dur = evt.durationHours || 2;
                  const catLabel = BLOCKED_REASON_DEFINITIONS[evt.category]?.label || evt.category;

                  return (
                    <div
                      key={evt.id}
                      className="px-4 py-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 shrink-0">
                          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {evt.title}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {catLabel.split('/')[0].trim()}
                            </span>
                            <span>·</span>
                            <span className="font-mono">
                              {evt.startTime} - {evt.endTime} ({dur}h)
                            </span>
                            <span>·</span>
                            <span>
                              {evt.recurringDays && evt.recurringDays.length > 0
                                ? `Semanal (${evt.recurringDays.map((d) => DAYS_SHORT.find((x) => x.day === d)?.label).join(', ')})`
                                : evt.date || 'Puntual'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteBlockedEvent(evt.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                        title="Eliminar bloqueo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pie de modal */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Al recalcular, los temas se asignan automáticamente a tus horas libres reales.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
