import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Briefcase,
  GraduationCap,
  Dumbbell,
  User,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Zap,
  Home,
  ShoppingCart,
  Coffee,
  BookOpen,
  Search,
  Repeat,
  CalendarCheck,
  Wand2,
  ListPlus,
  Check,
} from 'lucide-react';
import { WeeklyObligation } from '../types';
import { schedulerService } from '../services/schedulerService';

interface WeeklyAvailabilityPlannerProps {
  obligations: WeeklyObligation[];
  onUpdateObligations: (updated: WeeklyObligation[]) => void;
  hoursPerDay: Record<number, number>;
  onApplyCalculatedHours: (calculatedHours: Record<number, number>) => void;
}

interface PersonalWishItem {
  id: string;
  title: string;
  category: WeeklyObligation['category'];
  durationHours: number;
  preferredTime: 'any' | 'morning' | 'afternoon' | 'evening';
}

const CATEGORY_ICONS: Record<WeeklyObligation['category'], React.ElementType> = {
  clase: GraduationCap,
  trabajo: Briefcase,
  gimnasio: Dumbbell,
  personal: User,
  domestico: Home,
  compras: ShoppingCart,
  descanso: Coffee,
  lectura: BookOpen,
  otro: Clock,
};

const CATEGORY_LABELS: Record<WeeklyObligation['category'], string> = {
  clase: '🎓 Clases / Universidad',
  trabajo: '💼 Trabajo / Prácticas',
  gimnasio: '🏋️ Gimnasio / Deporte',
  domestico: '🧹 Tareas Domésticas / Casa',
  compras: '🛒 Ir a la Compra / Recados',
  descanso: '☕ Tiempo de Descanso / Ocio',
  lectura: '📖 Leer un Libro / Hobby',
  personal: '🏠 Compromiso Personal',
  otro: '📌 Otra Actividad',
};

const CATEGORY_COLORS: Record<
  WeeklyObligation['category'],
  { border: string; bg: string; text: string; badge: string }
> = {
  clase: {
    border: 'border-blue-300 dark:border-blue-700',
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-800 dark:text-blue-300',
    badge: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200',
  },
  trabajo: {
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200',
  },
  gimnasio: {
    border: 'border-emerald-300 dark:border-emerald-700',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-800 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200',
  },
  domestico: {
    border: 'border-teal-300 dark:border-teal-700',
    bg: 'bg-teal-50 dark:bg-teal-950/60',
    text: 'text-teal-800 dark:text-teal-300',
    badge: 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200',
  },
  compras: {
    border: 'border-orange-300 dark:border-orange-700',
    bg: 'bg-orange-50 dark:bg-orange-950/60',
    text: 'text-orange-800 dark:text-orange-300',
    badge: 'bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200',
  },
  descanso: {
    border: 'border-rose-300 dark:border-rose-700',
    bg: 'bg-rose-50 dark:bg-rose-950/60',
    text: 'text-rose-800 dark:text-rose-300',
    badge: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200',
  },
  lectura: {
    border: 'border-indigo-300 dark:border-indigo-700',
    bg: 'bg-indigo-50 dark:bg-indigo-950/60',
    text: 'text-indigo-800 dark:text-indigo-300',
    badge: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200',
  },
  personal: {
    border: 'border-purple-300 dark:border-purple-700',
    bg: 'bg-purple-50 dark:bg-purple-950/60',
    text: 'text-purple-800 dark:text-purple-300',
    badge: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200',
  },
  otro: {
    border: 'border-slate-300 dark:border-slate-700',
    bg: 'bg-slate-50 dark:bg-slate-800/60',
    text: 'text-slate-800 dark:text-slate-300',
    badge: 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
  },
};

const DAYS = [
  { day: 1, label: 'Lunes', short: 'Lun' },
  { day: 2, label: 'Martes', short: 'Mar' },
  { day: 3, label: 'Miércoles', short: 'Mié' },
  { day: 4, label: 'Jueves', short: 'Jue' },
  { day: 5, label: 'Viernes', short: 'Vie' },
  { day: 6, label: 'Sábado', short: 'Sáb' },
  { day: 0, label: 'Domingo', short: 'Dom' },
];

interface SuggestedSlot {
  dayOfWeek: number;
  dayLabel: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  freeBufferHours: number;
  reason: string;
}

// Helper: HH:mm -> minutes from 00:00
const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Helper: minutes -> HH:mm
const minutesToTime = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const WeeklyAvailabilityPlanner: React.FC<WeeklyAvailabilityPlannerProps> = ({
  obligations,
  onUpdateObligations,
  hoursPerDay,
  onApplyCalculatedHours,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  // Abierto por defecto para que el usuario pueda escribir directamente qué quiere hacer y buscar hueco
  const [showSlotFinder, setShowSlotFinder] = useState(true);

  // Add fixed obligation / personal activity manually
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<WeeklyObligation['category']>('clase');
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('13:00');
  const [newIsAutomated, setNewIsAutomated] = useState(true);
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  // Smart Slot Finder state (for non-class activities: domestic tasks, shopping, rest, reading...)
  const [desiredActivityTitle, setDesiredActivityTitle] = useState('');
  const [desiredCategory, setDesiredCategory] = useState<WeeklyObligation['category']>('domestico');
  const [desiredDurationHours, setDesiredDurationHours] = useState<number>(1);
  const [preferredTimeOfDay, setPreferredTimeOfDay] = useState<'any' | 'morning' | 'afternoon' | 'evening'>('any');
  const [repeatWeeklyForSlot, setRepeatWeeklyForSlot] = useState<boolean>(false);
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);
  const [hasSearchedSlots, setHasSearchedSlots] = useState(false);

  // Lista de actividades personales pendientes para buscar hueco en bloque
  const [personalWishList, setPersonalWishList] = useState<PersonalWishItem[]>([]);

  // Calcula la duración en horas entre dos HH:mm
  const calculateDuration = (start: string, end: string): number => {
    const diff = timeToMinutes(end) - timeToMinutes(start);
    return Math.max(0.5, Math.round((diff / 60) * 10) / 10);
  };

  // Función pura para encontrar los mejores huecos libres dada una lista de obligaciones
  const computeBestFreeSlots = (
    currentObligations: WeeklyObligation[],
    durationHours: number,
    timePref: 'any' | 'morning' | 'afternoon' | 'evening'
  ): SuggestedSlot[] => {
    const durationMins = Math.round(durationHours * 60);

    let windowStart = 8 * 60 + 30; // 08:30
    let windowEnd = 22 * 60; // 22:00
    if (timePref === 'morning') {
      windowStart = 8 * 60 + 30;
      windowEnd = 14 * 60;
    } else if (timePref === 'afternoon') {
      windowStart = 14 * 60;
      windowEnd = 19 * 60 + 30;
    } else if (timePref === 'evening') {
      windowStart = 19 * 60;
      windowEnd = 22 * 60 + 30;
    }

    const found: SuggestedSlot[] = [];

    DAYS.forEach(({ day, label }) => {
      const dayObs = currentObligations
        .filter((o) => o.dayOfWeek === day)
        .map((o) => ({
          start: timeToMinutes(o.startTime),
          end: timeToMinutes(o.endTime),
          title: o.title,
        }))
        .sort((a, b) => a.start - b.start);

      const totalFixedHours = currentObligations
        .filter((o) => o.dayOfWeek === day)
        .reduce((acc, o) => acc + (o.durationHours || 0), 0);
      const studyHours = hoursPerDay[day] || 0;
      const freeBuffer = Math.max(0, Math.round((15 - totalFixedHours - studyHours) * 10) / 10);

      // Buscamos hasta 2 huecos distintos en el mismo día si están disponibles
      let slotsFoundForDay = 0;
      for (let t = windowStart; t + durationMins <= windowEnd; t += 30) {
        const slotStart = t;
        const slotEnd = t + durationMins;

        const overlapsFixed = dayObs.some(
          (ob) => slotStart < ob.end && slotEnd > ob.start
        );

        if (!overlapsFixed) {
          let reason = 'Día equilibrado con hueco despejado';
          if (freeBuffer >= 5) {
            reason = `Día muy desahogado (${freeBuffer}h libres tras estudio)`;
          } else if (day === 6 || day === 0) {
            reason = `Fin de semana con tiempo libre (${freeBuffer}h margen)`;
          } else if (dayObs.length === 0) {
            reason = 'Sin horarios fijos bloqueados este día';
          } else {
            reason = `Hueco libre entre tus actividades (${freeBuffer}h margen)`;
          }

          found.push({
            dayOfWeek: day,
            dayLabel: label,
            startTime: minutesToTime(slotStart),
            endTime: minutesToTime(slotEnd),
            durationHours,
            freeBufferHours: freeBuffer,
            reason,
          });

          slotsFoundForDay++;
          // Avanzamos para ofrecer otra alternativa horaria si hiciera falta
          t += Math.max(60, durationMins);
          if (slotsFoundForDay >= 1) break;
        }
      }
    });

    found.sort((a, b) => b.freeBufferHours - a.freeBufferHours);
    return found.slice(0, 6);
  };

  // Actualizar sugerencias automáticamente cuando cambia la duración o preferencia si ya buscó
  useEffect(() => {
    if (hasSearchedSlots) {
      const updated = computeBestFreeSlots(obligations, desiredDurationHours, preferredTimeOfDay);
      setSuggestedSlots(updated);
    }
  }, [desiredDurationHours, preferredTimeOfDay, obligations]);

  const handleAddObligation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newDays.length === 0) return;

    const duration = calculateDuration(newStartTime, newEndTime);

    const newItems: WeeklyObligation[] = newDays.map((d) => ({
      id: `ob-${Date.now()}-${d}-${Math.random().toString(36).slice(2, 6)}`,
      title: newTitle.trim(),
      category: newCategory,
      dayOfWeek: d,
      startTime: newStartTime,
      endTime: newEndTime,
      durationHours: duration,
      isAutomatedWeekly: newIsAutomated,
    }));

    onUpdateObligations([...obligations, ...newItems]);
    setNewTitle('');
    setShowAddForm(false);
    setAppliedFeedback(`"${newTitle.trim()}" añadido al calendario semanal.`);
    setTimeout(() => setAppliedFeedback(null), 3500);
  };

  const handleDeleteObligation = (id: string) => {
    onUpdateObligations(obligations.filter((o) => o.id !== id));
  };

  const handleToggleAutomation = (id: string) => {
    onUpdateObligations(
      obligations.map((o) =>
        o.id === id ? { ...o, isAutomatedWeekly: !o.isAutomatedWeekly } : o
      )
    );
  };

  const handleAutomateAll = () => {
    const updated = obligations.map((o) => ({ ...o, isAutomatedWeekly: true }));
    onUpdateObligations(updated);
    setAppliedFeedback('¡Todas las obligaciones y rutinas se han configurado para repetirse automáticamente cada semana!');
    setTimeout(() => setAppliedFeedback(null), 4000);
  };

  // Preajustes rápidos
  const handleAddPreset = (
    title: string,
    category: WeeklyObligation['category'],
    days: number[],
    start: string,
    end: string,
    automated = true
  ) => {
    const duration = calculateDuration(start, end);
    const presetItems: WeeklyObligation[] = days.map((d) => ({
      id: `preset-${Date.now()}-${d}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      category,
      dayOfWeek: d,
      startTime: start,
      endTime: end,
      durationHours: duration,
      isAutomatedWeekly: automated,
    }));
    onUpdateObligations([...obligations, ...presetItems]);
    setAppliedFeedback(`"${title}" añadido a tu horario semanal.`);
    setTimeout(() => setAppliedFeedback(null), 3500);
  };

  // Seleccionar una actividad personal rápida y buscar huecos al instante
  const handleSelectQuickPersonalActivity = (
    title: string,
    category: WeeklyObligation['category'],
    duration: number
  ) => {
    setDesiredActivityTitle(title);
    setDesiredCategory(category);
    setDesiredDurationHours(duration);
    setShowSlotFinder(true);
    setShowAddForm(false);
    const found = computeBestFreeSlots(obligations, duration, preferredTimeOfDay);
    setSuggestedSlots(found);
    setHasSearchedSlots(true);
  };

  // Cálculo automático de las horas de estudio disponibles por día
  const calculatedStudyHours = React.useMemo(() => {
    return schedulerService.calculateDailyAvailableHoursFromObligations(obligations);
  }, [obligations]);

  const handleApplyCalculated = () => {
    onApplyCalculatedHours(calculatedStudyHours);
    setAppliedFeedback('¡Horas diarias de estudio recalculadas y aplicadas al planificador!');
    setTimeout(() => setAppliedFeedback(null), 4000);
  };

  // Algoritmo para encontrar huecos libres en la semana respetando horario fijo y horas de estudio
  const handleFindFreeSlots = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const found = computeBestFreeSlots(obligations, desiredDurationHours, preferredTimeOfDay);
    setSuggestedSlots(found);
    setHasSearchedSlots(true);
  };

  // Auto-asignar directamente en el mejor hueco #1 disponible
  const handleAutoScheduleBestSlot = () => {
    const found = computeBestFreeSlots(obligations, desiredDurationHours, preferredTimeOfDay);
    if (found.length === 0) {
      setHasSearchedSlots(true);
      setSuggestedSlots([]);
      return;
    }
    const bestSlot = found[0];
    const finalTitle =
      desiredActivityTitle.trim() ||
      CATEGORY_LABELS[desiredCategory].replace(/^[^\s]+\s/, '');

    const newItem: WeeklyObligation = {
      id: `slot-${Date.now()}-${bestSlot.dayOfWeek}`,
      title: finalTitle,
      category: desiredCategory,
      dayOfWeek: bestSlot.dayOfWeek,
      startTime: bestSlot.startTime,
      endTime: bestSlot.endTime,
      durationHours: bestSlot.durationHours,
      isAutomatedWeekly: repeatWeeklyForSlot,
    };

    const nextObs = [...obligations, newItem];
    onUpdateObligations(nextObs);
    setAppliedFeedback(
      `¡Hueco encontrado y agendado! "${finalTitle}" se ha colocado el ${bestSlot.dayLabel} de ${bestSlot.startTime} a ${bestSlot.endTime}.`
    );
    setTimeout(() => setAppliedFeedback(null), 4500);
    setDesiredActivityTitle('');
    setSuggestedSlots(computeBestFreeSlots(nextObs, desiredDurationHours, preferredTimeOfDay));
    setHasSearchedSlots(true);
  };

  // Añadir a la lista de cosas personales por hacer esta semana
  const handleAddToWishList = () => {
    const finalTitle =
      desiredActivityTitle.trim() ||
      CATEGORY_LABELS[desiredCategory].replace(/^[^\s]+\s/, '');

    const item: PersonalWishItem = {
      id: `wish-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: finalTitle,
      category: desiredCategory,
      durationHours: desiredDurationHours,
      preferredTime: preferredTimeOfDay,
    };

    setPersonalWishList((prev) => [...prev, item]);
    setDesiredActivityTitle('');
  };

  // Encontrar y asignar hueco automáticamente a TODA la lista de actividades personales
  const handleAutoScheduleAllWishList = () => {
    if (personalWishList.length === 0) return;

    let workingObs = [...obligations];
    let scheduledCount = 0;

    personalWishList.forEach((item, idx) => {
      const candidates = computeBestFreeSlots(workingObs, item.durationHours, item.preferredTime);
      if (candidates.length > 0) {
        const chosen = candidates[0];
        const newOb: WeeklyObligation = {
          id: `wish-scheduled-${Date.now()}-${idx}-${chosen.dayOfWeek}`,
          title: item.title,
          category: item.category,
          dayOfWeek: chosen.dayOfWeek,
          startTime: chosen.startTime,
          endTime: chosen.endTime,
          durationHours: item.durationHours,
          isAutomatedWeekly: repeatWeeklyForSlot,
        };
        workingObs.push(newOb);
        scheduledCount++;
      }
    });

    onUpdateObligations(workingObs);
    setPersonalWishList([]);
    setAppliedFeedback(
      `¡Se han encontrado y asignado huecos libres para ${scheduledCount} actividades personales en tu semana!`
    );
    setTimeout(() => setAppliedFeedback(null), 5000);
  };

  const handleScheduleSuggestedSlot = (slot: SuggestedSlot) => {
    const finalTitle =
      desiredActivityTitle.trim() ||
      CATEGORY_LABELS[desiredCategory].replace(/^[^\s]+\s/, '');

    const newItem: WeeklyObligation = {
      id: `slot-${Date.now()}-${slot.dayOfWeek}`,
      title: finalTitle,
      category: desiredCategory,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationHours: slot.durationHours,
      isAutomatedWeekly: repeatWeeklyForSlot,
    };

    onUpdateObligations([...obligations, newItem]);
    setAppliedFeedback(
      `¡"${finalTitle}" agendado el ${slot.dayLabel} de ${slot.startTime} a ${slot.endTime}!`
    );
    setTimeout(() => setAppliedFeedback(null), 4000);

    // Recalcular sugerencias restantes
    setSuggestedSlots((prev) =>
      prev.filter(
        (s) => !(s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime)
      )
    );
  };

  return (
    <div className="space-y-4 p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80 transition-colors">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Calendario de Disponibilidad, Horario Fijo y Buscador de Huecos Personales</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Escribe tanto tus clases o trabajo como las cosas personales que quieres hacer (tareas domésticas, ir a la compra, tiempo de descanso, leer un libro...) y deja que la aplicación te encuentre el mejor hueco libre.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowSlotFinder(!showSlotFinder);
              if (!showSlotFinder) setShowAddForm(false);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              showSlotFinder
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscarme un Hueco Libre</span>
          </button>

          {obligations.length > 0 && (
            <button
              type="button"
              onClick={handleAutomateAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Repetir este horario fijo todas las semanas automáticamente"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Automatizar Semana</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir con Hora Fija</span>
          </button>
        </div>
      </div>

      {/* Botones de Preajustes Rápidos (Académicos, Laborales y Vida Personal con búsqueda instantánea) */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
          Accesos rápidos:
        </span>
        <button
          type="button"
          onClick={() =>
            handleAddPreset('Clases Universitarias / Instituto', 'clase', [1, 2, 3, 4, 5], '09:00', '13:30')
          }
          className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:border-blue-400 text-[11px] font-medium transition-colors cursor-pointer"
        >
          🎓 Clases (L-V 9:00-13:30)
        </button>
        <button
          type="button"
          onClick={() =>
            handleAddPreset('Jornada de Trabajo', 'trabajo', [1, 2, 3, 4, 5], '15:00', '19:00')
          }
          className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:border-amber-400 text-[11px] font-medium transition-colors cursor-pointer"
        >
          💼 Trabajo (15:00-19:00)
        </button>
        <button
          type="button"
          onClick={() =>
            handleAddPreset('Gimnasio y Deporte', 'gimnasio', [1, 3, 5], '19:30', '21:00')
          }
          className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:border-emerald-400 text-[11px] font-medium transition-colors cursor-pointer"
        >
          🏋️ Gimnasio (L-X-V 19:30)
        </button>
        <button
          type="button"
          onClick={() =>
            handleSelectQuickPersonalActivity('Tareas domésticas y orden en casa', 'domestico', 1.5)
          }
          className="px-2.5 py-1 bg-teal-50/90 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 rounded-lg text-teal-800 dark:text-teal-300 hover:bg-teal-100 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          🧹 Tareas domésticas (Buscar hueco)
        </button>
        <button
          type="button"
          onClick={() =>
            handleSelectQuickPersonalActivity('Ir a la compra semanal', 'compras', 1.5)
          }
          className="px-2.5 py-1 bg-orange-50/90 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 rounded-lg text-orange-800 dark:text-orange-300 hover:bg-orange-100 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          🛒 Ir a la compra (Buscar hueco)
        </button>
        <button
          type="button"
          onClick={() =>
            handleSelectQuickPersonalActivity('Tiempo de descanso y desconexión', 'descanso', 1)
          }
          className="px-2.5 py-1 bg-rose-50/90 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300 hover:bg-rose-100 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          ☕ Tiempo de descanso (Buscar hueco)
        </button>
        <button
          type="button"
          onClick={() =>
            handleSelectQuickPersonalActivity('Leer un libro', 'lectura', 1)
          }
          className="px-2.5 py-1 bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-800 rounded-lg text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          📖 Leer un libro (Buscar hueco)
        </button>
      </div>

      {/* PANEL: BUSCADOR INTELIGENTE DE HUECOS PARA VIDA PERSONAL Y TAREAS NO ACADÉMICAS */}
      {showSlotFinder && (
        <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/70 dark:from-slate-800 dark:via-slate-800/95 dark:to-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>¿Qué quieres hacer esta semana fuera de clase? Te ayudamos a encontrar hueco</span>
              </h5>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Escribe cosas cotidianas (tareas domésticas, ir a la compra, tiempo de descanso, leer un libro, deporte...). Analizamos tu horario fijo y tus horas de estudio para proponerte o asignarte el mejor momento libre.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSlotFinder(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
            >
              Ocultar
            </button>
          </div>

          <form onSubmit={handleFindFreeSlots} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            <div className="sm:col-span-4">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Actividad o cosa que quieres hacer
              </label>
              <input
                type="text"
                value={desiredActivityTitle}
                onChange={(e) => setDesiredActivityTitle(e.target.value)}
                placeholder="Ej: Tareas domésticas, Ir a la compra, Leer un libro, Descansar..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Categoría personal
              </label>
              <select
                value={desiredCategory}
                onChange={(e) => setDesiredCategory(e.target.value as WeeklyObligation['category'])}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="domestico">🧹 Tareas Domésticas / Casa</option>
                <option value="compras">🛒 Ir a la Compra / Recados</option>
                <option value="descanso">☕ Tiempo de Descanso / Ocio</option>
                <option value="lectura">📖 Leer un Libro / Hobby</option>
                <option value="gimnasio">🏋️ Gimnasio / Deporte</option>
                <option value="personal">🏠 Compromiso Personal</option>
                <option value="otro">📌 Otra Actividad</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tiempo necesario
              </label>
              <select
                value={desiredDurationHours}
                onChange={(e) => setDesiredDurationHours(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-slate-800 dark:text-slate-200 font-mono-numbers cursor-pointer"
              >
                <option value={0.5}>30 min (0.5h)</option>
                <option value={1}>1 hora</option>
                <option value={1.5}>1 hora y media</option>
                <option value={2}>2 horas</option>
                <option value={3}>3 horas</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Franja preferida
              </label>
              <select
                value={preferredTimeOfDay}
                onChange={(e) => setPreferredTimeOfDay(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="any">🕒 Cualquier momento libre</option>
                <option value="morning">🌅 Mañanas (08:30 - 14:00)</option>
                <option value="afternoon">☀️ Tardes (14:00 - 19:30)</option>
                <option value="evening">🌙 Noches (19:00 - 22:30)</option>
              </select>
            </div>

            <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={repeatWeeklyForSlot}
                  onChange={(e) => setRepeatWeeklyForSlot(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Repetir esta actividad todas las semanas</span>
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleAddToWishList}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  title="Añadir a una lista de varias cosas que quieres hacer esta semana para buscarles hueco juntas"
                >
                  <ListPlus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Añadir a mi Lista Semanal</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoScheduleBestSlot}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="Encuentra el mejor hueco libre de la semana y lo agenda directamente"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Asignar Mejor Hueco Automáticamente</span>
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Ver Huecos Libres</span>
                </button>
              </div>
            </div>
          </form>

          {/* Cola / Lista de varias cosas personales por hacer esta semana */}
          {personalWishList.length > 0 && (
            <div className="p-3 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-indigo-200 dark:border-slate-700 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ListPlus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cosas que quiero hacer esta semana ({personalWishList.length}):</span>
                </span>
                <button
                  type="button"
                  onClick={handleAutoScheduleAllWishList}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-2xs"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Encontrar y Asignar Hueco para Todas ({personalWishList.length})</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {personalWishList.map((item) => {
                  const style = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.otro;
                  return (
                    <div
                      key={item.id}
                      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${style.border} ${style.bg} ${style.text}`}
                    >
                      <span className="font-semibold">{item.title}</span>
                      <span className="text-[10px] font-mono-numbers opacity-80">({item.durationHours}h)</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPersonalWishList((prev) => prev.filter((x) => x.id !== item.id))
                        }
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Quitar de la lista"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resultados de huecos sugeridos */}
          {hasSearchedSlots && (
            <div className="space-y-2.5 pt-2 border-t border-indigo-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {suggestedSlots.length > 0
                    ? `Mejores huecos disponibles para "${desiredActivityTitle.trim() || CATEGORY_LABELS[desiredCategory].replace(/^[^\s]+\s/, '')}":`
                    : 'No se encontraron huecos libres en esa franja. Prueba con "Cualquier momento libre" o menor duración:'}
                </span>
              </div>

              {suggestedSlots.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {suggestedSlots.map((slot, idx) => (
                    <div
                      key={`${slot.dayOfWeek}-${slot.startTime}-${idx}`}
                      className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200/80 dark:border-slate-700 flex flex-col justify-between gap-2 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                            <span>{slot.dayLabel}</span>
                            {idx === 0 && (
                              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                                Recomendado
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] font-mono-numbers font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-lg">
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {slot.reason}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleScheduleSuggestedSlot(slot)}
                        className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>Elegir este hueco ({slot.dayLabel} {slot.startTime})</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulario para añadir obligación o actividad personal en horario específico */}
      {showAddForm && (
        <form
          onSubmit={handleAddObligation}
          className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-900/60 shadow-sm space-y-3 animate-in fade-in duration-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombre de la obligación o actividad personal
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej: Clases, Trabajo, Tareas domésticas, Ir a la compra, Leer un libro, Descanso..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Categoría
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as WeeklyObligation['category'])}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-blue-500 cursor-pointer"
              >
                <option value="clase">🎓 Clases / Universidad</option>
                <option value="trabajo">💼 Trabajo / Prácticas</option>
                <option value="gimnasio">🏋️ Gimnasio / Deporte</option>
                <option value="domestico">🧹 Tareas Domésticas / Casa</option>
                <option value="compras">🛒 Ir a la Compra / Recados</option>
                <option value="descanso">☕ Tiempo de Descanso / Ocio</option>
                <option value="lectura">📖 Leer un Libro / Hobby</option>
                <option value="personal">🏠 Compromiso Personal</option>
                <option value="otro">📌 Otro Horario Fijo</option>
              </select>
            </div>
          </div>

          {/* Días aplicables */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Días de la semana
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map(({ day, short }) => {
                const active = newDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (active) {
                        setNewDays(newDays.filter((d) => d !== day));
                      } else {
                        setNewDays([...newDays, day]);
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horas de inicio y fin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hora de Inicio
              </label>
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 font-mono-numbers"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hora de Fin
              </label>
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 font-mono-numbers"
                required
              />
            </div>
            <div className="pb-1.5">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsAutomated}
                  onChange={(e) => setNewIsAutomated(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-blue-600" />
                  <span>Automatizar cada semana</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-2xs"
            >
              Guardar en Horario
            </button>
          </div>
        </form>
      )}

      {/* Cuadrícula semanal de obligaciones, rutinas personales y cálculo automático */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 pt-1">
        {DAYS.map(({ day, short }) => {
          const dayObs = obligations
            .filter((o) => o.dayOfWeek === day)
            .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
          const totalOccupied = dayObs.reduce((acc, o) => acc + (o.durationHours || 0), 0);
          const autoStudy = calculatedStudyHours[day] || 0;
          const currentStudy = hoursPerDay[day] || 0;

          return (
            <div
              key={day}
              className="p-2.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between min-h-[155px] text-xs space-y-2"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1 mb-1.5">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{short}</span>
                  <span className="text-[10px] text-slate-400 font-mono-numbers">
                    {totalOccupied > 0 ? `${Math.round(totalOccupied * 10) / 10}h ocup.` : 'Libre'}
                  </span>
                </div>

                {/* Lista de bloques de obligaciones y actividades */}
                <div className="space-y-1 max-h-[165px] overflow-y-auto no-scrollbar">
                  {dayObs.map((ob) => {
                    const style = CATEGORY_COLORS[ob.category] || CATEGORY_COLORS.otro;
                    const Icon = CATEGORY_ICONS[ob.category] || Clock;

                    return (
                      <div
                        key={ob.id}
                        className={`p-1.5 rounded-lg border ${style.border} ${style.bg} group relative text-[10px] leading-tight flex items-start justify-between gap-1`}
                      >
                        <div className="truncate flex-1">
                          <div className={`font-semibold flex items-center gap-1 ${style.text} truncate`}>
                            <Icon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate" title={ob.title}>
                              {ob.title}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                              {ob.startTime}-{ob.endTime} ({ob.durationHours}h)
                            </span>
                            {ob.isAutomatedWeekly && (
                              <span
                                className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950 px-1 rounded flex items-center gap-0.5"
                                title="Se repite automáticamente todas las semanas"
                              >
                                <Repeat className="w-2 h-2" />
                                <span>Fijo</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleToggleAutomation(ob.id)}
                            className={`p-0.5 rounded cursor-pointer ${
                              ob.isAutomatedWeekly
                                ? 'text-emerald-600 hover:text-emerald-800'
                                : 'text-slate-400 hover:text-blue-600'
                            }`}
                            title={
                              ob.isAutomatedWeekly
                                ? 'Automatizado cada semana (Click para desactivar)'
                                : 'Activar repetición automática cada semana'
                            }
                          >
                            <Repeat className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteObligation(ob.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                            title="Eliminar actividad"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {dayObs.length === 0 && (
                    <div className="text-[10px] text-slate-400 italic py-2 text-center">
                      Sin actividades
                    </div>
                  )}
                </div>
              </div>

              {/* Tiempo de estudio resultante para este día */}
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/60 text-[10px]">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Estudio:</span>
                  <span className="font-bold font-mono-numbers text-blue-700 dark:text-blue-400">
                    {currentStudy}h/día
                  </span>
                </div>
                {totalOccupied > 0 && autoStudy !== currentStudy && (
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-mono-numbers block text-right">
                    Sugerido: {autoStudy}h
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón de cálculo automático inteligente */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Calcula tu tiempo de estudio real descontando clases, trabajo, compras, tareas domésticas, lectura y descanso.
          </span>
        </div>

        <button
          type="button"
          onClick={handleApplyCalculated}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md hover:scale-102 active:scale-98 shrink-0"
        >
          <Zap className="w-3.5 h-3.5 text-yellow-300" />
          <span>Calcular Horas Disponibles</span>
        </button>
      </div>

      {appliedFeedback && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{appliedFeedback}</span>
        </div>
      )}
    </div>
  );
};
