import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Calendar,
  BookOpen,
  Brain,
  Sparkles,
  Lock,
  GraduationCap,
  CheckCircle2,
  Clock,
  Bell,
  Repeat,
  HelpCircle,
  FileCheck2,
} from 'lucide-react';
import {
  Subject,
  StudyPreferences,
  BlockedTimeEvent,
  ScheduledStudySession,
} from '../types';
import {
  IcsExportOptions,
  collectCalendarEventsForExport,
  generateIcsFileContent,
  downloadIcsFile,
} from '../services/icsExportService';
import { formatReadableDate, getTodayLocalDateStr } from '../utils/dateUtils';

interface IcsCalendarExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  preferences: StudyPreferences;
  blockedEvents: BlockedTimeEvent[];
  precomputedStudySessions?: ScheduledStudySession[];
  initialSubjectFilterId?: string;
}

export const IcsCalendarExportModal: React.FC<IcsCalendarExportModalProps> = ({
  isOpen,
  onClose,
  subjects,
  preferences,
  blockedEvents,
  precomputedStudySessions,
  initialSubjectFilterId = 'all',
}) => {
  const [options, setOptions] = useState<IcsExportOptions>({
    includeStudySessions: true,
    includeSpacedReviews: true,
    includeHabits: true,
    includeBlockedEvents: true,
    includeExams: true,
    includeTasks: true,
    horizonDays: 60,
    useRRuleForRecurring: true,
    includeAlarms: true,
    subjectFilterId: initialSubjectFilterId,
  });

  const [activeGuideTab, setActiveGuideTab] = useState<'google' | 'apple' | null>(null);
  const [exportedSuccessMsg, setExportedSuccessMsg] = useState<string | null>(null);

  const previewEvents = useMemo(() => {
    if (!isOpen) return [];
    return collectCalendarEventsForExport(
      subjects,
      preferences,
      blockedEvents,
      options,
      precomputedStudySessions
    );
  }, [isOpen, subjects, preferences, blockedEvents, options, precomputedStudySessions]);

  const categoryCounts = useMemo(() => {
    const counts = {
      estudio: 0,
      repaso: 0,
      habito: 0,
      bloqueo: 0,
      examen: 0,
      tarea: 0,
    };
    previewEvents.forEach((ev) => {
      counts[ev.category] = (counts[ev.category] || 0) + 1;
    });
    return counts;
  }, [previewEvents]);

  if (!isOpen) return null;

  const handleToggleOption = (key: keyof IcsExportOptions) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setExportedSuccessMsg(null);
  };

  const handleDownloadIcs = () => {
    if (previewEvents.length === 0) return;
    const content = generateIcsFileContent(
      previewEvents,
      'StudyFlow · Plan de Estudio, Hábitos y Exámenes'
    );
    const filename = `studyflow-calendario-${getTodayLocalDateStr()}.ics`;
    downloadIcsFile(content, filename);
    setExportedSuccessMsg(
      `¡Archivo "${filename}" generado con ${previewEvents.length} eventos! Ya puedes importarlo en Google Calendar o Apple Calendar.`
    );
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'estudio':
        return {
          label: 'Estudio',
          cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        };
      case 'repaso':
        return {
          label: 'Repaso',
          cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'habito':
        return {
          label: 'Hábito',
          cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'examen':
        return {
          label: 'Examen',
          cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
      case 'tarea':
        return {
          label: 'Entrega',
          cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        };
      default:
        return {
          label: 'Bloqueo',
          cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-xs">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Sincronizar Plan con Google Calendar / Apple Calendar (.ICS)
              </h2>
              <p className="text-xs text-blue-100">
                Exporta tus bloques de estudio, hábitos, horas bloqueadas y exámenes en estándar universal iCalendar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido desplazable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Selección de capas de eventos bloqueados a incluir */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Selecciona qué eventos bloqueados incluir
              </label>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {previewEvents.length} eventos listos para exportar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {[
                {
                  key: 'includeStudySessions' as const,
                  title: 'Bloques de Estudio',
                  subtitle: `${categoryCounts.estudio} sesiones programadas`,
                  icon: <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
                  activeRing: 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30',
                },
                {
                  key: 'includeHabits' as const,
                  title: 'Hábitos y Rutinas',
                  subtitle: `${categoryCounts.habito} bloques de hábitos`,
                  icon: <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
                  activeRing: 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30',
                },
                {
                  key: 'includeExams' as const,
                  title: 'Exámenes Oficiales',
                  subtitle: `${categoryCounts.examen} fechas de examen`,
                  icon: <GraduationCap className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
                  activeRing: 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30',
                },
                {
                  key: 'includeSpacedReviews' as const,
                  title: 'Repasos Espaciados',
                  subtitle: `${categoryCounts.repaso} ciclos R1–R5`,
                  icon: <Brain className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
                  activeRing: 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30',
                },
                {
                  key: 'includeBlockedEvents' as const,
                  title: 'Horas Bloqueadas Fijas',
                  subtitle: `${categoryCounts.bloqueo} bloqueos / clases`,
                  icon: <Lock className="w-4 h-4 text-slate-600 dark:text-slate-300" />,
                  activeRing: 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30',
                },
                {
                  key: 'includeTasks' as const,
                  title: 'Tareas y Entregas',
                  subtitle: `${categoryCounts.tarea} entregas activas`,
                  icon: <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
                  activeRing: 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/30',
                },
              ].map((item) => {
                const isChecked = Boolean(options[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToggleOption(item.key)}
                    className={`p-3 rounded-2xl border text-left flex items-start justify-between gap-2.5 transition-all cursor-pointer ${
                      isChecked
                        ? item.activeRing
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 opacity-65 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 shadow-2xs shrink-0 mt-0.5">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parámetros de sincronización: horizonte temporal, asignatura, recurrencia y alarmas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Horizonte de exportación</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { days: 30, label: '30 días' },
                  { days: 60, label: '60 días' },
                  { days: 90, label: '90 días' },
                  { days: 180, label: 'Semestre (180d)' },
                ].map((h) => (
                  <button
                    key={h.days}
                    type="button"
                    onClick={() => {
                      setOptions((prev) => ({ ...prev, horizonDays: h.days }));
                      setExportedSuccessMsg(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      options.horizonDays === h.days
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>Filtrar por asignatura</span>
              </label>
              <select
                value={options.subjectFilterId || 'all'}
                onChange={(e) => {
                  setOptions((prev) => ({ ...prev, subjectFilterId: e.target.value }));
                  setExportedSuccessMsg(null);
                }}
                className="w-full h-9 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Todas las asignaturas ({subjects.length})</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Regla de repetición semanal (RRULE)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Agrupa hábitos y horarios fijos como series periódicas en Google/Apple Calendar
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleOption('useRRuleForRecurring')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  options.useRRuleForRecurring
                    ? 'bg-emerald-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    options.useRRuleForRecurring ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Recordatorios automáticos (VALARM)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Aviso 15 min antes de estudio/hábitos y 24h antes de exámenes
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleOption('includeAlarms')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  options.includeAlarms
                    ? 'bg-amber-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    options.includeAlarms ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Vista previa de eventos incluidos en el archivo .ics */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Vista previa de eventos a exportar ({previewEvents.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveGuideTab(activeGuideTab === 'google' ? null : 'google')
                  }
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                    activeGuideTab === 'google'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Cómo importar en Google Calendar</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveGuideTab(activeGuideTab === 'apple' ? null : 'apple')
                  }
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                    activeGuideTab === 'apple'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Apple Calendar</span>
                </button>
              </div>
            </div>

            {activeGuideTab === 'google' && (
              <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-950 dark:text-blue-200 space-y-1">
                <p className="font-extrabold">Pasos para Google Calendar:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                  <li>Haz clic en <strong>«Descargar Archivo .ICS»</strong> abajo.</li>
                  <li>Abre <strong>Google Calendar</strong> en tu navegador (icono de engranaje ⚙️ → <em>Configuración</em>).</li>
                  <li>En el menú izquierdo selecciona <strong>Importar y exportar</strong> → elige el archivo <code>.ics</code> descargado y pulsa <strong>Importar</strong>.</li>
                </ol>
              </div>
            )}

            {activeGuideTab === 'apple' && (
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                <p className="font-extrabold">Pasos para Apple Calendar (Mac / iPhone / iPad):</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                  <li>Haz clic en <strong>«Descargar Archivo .ICS»</strong> abajo.</li>
                  <li>En <strong>Mac</strong>: haz doble clic directamente sobre el archivo <code>.ics</code> descargado y elige en qué calendario añadir los eventos.</li>
                  <li>En <strong>iPhone / iPad</strong>: abre el archivo descargado desde <em>Archivos</em> o Safari y pulsa <strong>«Añadir todos»</strong>.</li>
                </ol>
              </div>
            )}

            {previewEvents.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                No hay eventos seleccionados con los filtros actuales. Activa al menos una categoría superior.
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                {previewEvents.slice(0, 60).map((ev) => {
                  const badge = getCategoryBadge(ev.category);
                  return (
                    <div
                      key={ev.uid}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {ev.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0 font-mono-numbers">
                        <span>{formatReadableDate(ev.date)}</span>
                        {ev.startTime && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                            {ev.startTime}
                            {ev.endTime ? `–${ev.endTime}` : ''}
                          </span>
                        )}
                        {ev.rrule && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-sans font-bold"
                            title="Evento semanal recurrente"
                          >
                            Semanal
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {previewEvents.length > 60 && (
                  <div className="px-3.5 py-2 text-center text-[11px] text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                    + {previewEvents.length - 60} eventos adicionales incluidos en el archivo .ics
                  </div>
                )}
              </div>
            )}
          </div>

          {exportedSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
              <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{exportedSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Formato estándar <strong>RFC 5545 (.ics)</strong> compatible con Google Calendar, Apple Calendar y Outlook.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={previewEvents.length === 0}
              onClick={handleDownloadIcs}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Archivo .ICS ({previewEvents.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
