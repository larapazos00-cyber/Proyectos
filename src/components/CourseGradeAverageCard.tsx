import React, { useMemo, useState } from 'react';
import {
  Award,
  Calculator,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  BookOpen,
} from 'lucide-react';
import { AcademicTerm, Subject } from '../types';
import {
  ACADEMIC_TERM_OPTIONS,
  calculateCourseGradeSummary,
  getAcademicTermLabel,
} from '../utils/gradeCalculations';

interface CourseGradeAverageCardProps {
  subjects: Subject[];
  compact?: boolean;
  onSelectSubject?: (subjectId: string) => void;
  onOpenExamsManager?: (subjectId?: string) => void;
}

export const CourseGradeAverageCard: React.FC<CourseGradeAverageCardProps> = ({
  subjects,
  compact = false,
  onSelectSubject,
  onOpenExamsManager,
}) => {
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm | 'all'>('all');
  const [showSubjectsBreakdown, setShowSubjectsBreakdown] = useState<boolean>(!compact);

  const courseSummary = useMemo(
    () => calculateCourseGradeSummary(subjects, selectedTerm),
    [subjects, selectedTerm]
  );

  // Also compute global breakdown (always contains all populated term breakdowns regardless of selectedTerm)
  const termCards = courseSummary.termBreakdowns;
  const hasAnyGrade =
    courseSummary.effectiveCourseAverage !== null ||
    termCards.some((t) => t.averageGrade !== null);

  const gradeColorClass = (grade: number | null) => {
    if (grade === null) return 'text-slate-400 dark:text-slate-500';
    if (grade >= 9) return 'text-emerald-600 dark:text-emerald-400';
    if (grade >= 7) return 'text-blue-600 dark:text-blue-400';
    if (grade >= 5) return 'text-slate-900 dark:text-white';
    return 'text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
      {/* Header + Term Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>Nota Media del Curso</span>
              {selectedTerm !== 'all' && (
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-lg">
                  {getAcademicTermLabel(selectedTerm)}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cálculo automático a partir de tus exámenes y tareas por trimestre o cuatrimestre.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value as AcademicTerm | 'all')}
            aria-label="Filtrar nota media por trimestre o cuatrimestre"
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="all">Todo el curso (Global)</option>
            <optgroup label="Por Trimestres">
              {ACADEMIC_TERM_OPTIONS.filter((o) => o.group === 'trimestre').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Por Cuatrimestres">
              {ACADEMIC_TERM_OPTIONS.filter((o) => o.group === 'cuatrimestre').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Global / Convocatoria Final">
              {ACADEMIC_TERM_OPTIONS.filter((o) => o.group === 'anual').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>

          {onOpenExamsManager && (
            <button
              type="button"
              onClick={() => onOpenExamsManager()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Notas y Ponderaciones</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Average KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-stretch">
        {/* Highlight Average Score */}
        <div className="md:col-span-5 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {selectedTerm === 'all'
                ? courseSummary.creditsWeightedCourseAverage !== null
                  ? 'Media Ponderada por ECTS'
                  : 'Nota Media Global'
                : `Media · ${getAcademicTermLabel(selectedTerm)}`}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-3xl sm:text-4xl font-black font-mono-numbers tracking-tight ${gradeColorClass(
                  courseSummary.effectiveCourseAverage
                )}`}
              >
                {courseSummary.effectiveCourseAverage !== null
                  ? courseSummary.effectiveCourseAverage.toFixed(2)
                  : '—'}
              </span>
              <span className="text-sm font-bold text-slate-400 font-mono-numbers">/ 10</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers">
              {courseSummary.gradedSubjectsCount > 0 ? (
                <>
                  {courseSummary.gradedSubjectsCount}/{courseSummary.totalSubjects} asignaturas con
                  nota · {courseSummary.passedSubjectsCount} aprobada(s)
                  {courseSummary.creditsWeightedCourseAverage !== null &&
                    courseSummary.simpleCourseAverage !== null && (
                      <span className="block text-slate-400">
                        Media aritmética simple: {courseSummary.simpleCourseAverage.toFixed(2)} / 10 (
                        {courseSummary.totalCreditsGraded} ECTS)
                      </span>
                    )}
                </>
              ) : (
                <span>
                  Asigna notas a exámenes o tareas evaluables para calcular la media automáticamente.
                </span>
              )}
            </div>
          </div>

          <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {/* Term Breakdown Strip (Populated Trimestres / Cuatrimestres) */}
        <div className="md:col-span-7 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Medias por Trimestre / Cuatrimestre
            </span>
            {courseSummary.unassignedGradedItemsCount > 0 && (
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {courseSummary.unassignedGradedItemsCount} eval. sin periodo asignado
              </span>
            )}
          </div>

          {termCards.length === 0 ? (
            <div className="flex-1 p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>
                Aún no has asignado ningún examen o tarea a un trimestre o cuatrimestre concreto.
              </span>
              {onOpenExamsManager && (
                <button
                  type="button"
                  onClick={() => onOpenExamsManager()}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-purple-400 shrink-0 cursor-pointer"
                >
                  Configurar
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {termCards.map((tc) => {
                const isSelected = selectedTerm === tc.term;
                return (
                  <button
                    key={tc.term}
                    type="button"
                    onClick={() => setSelectedTerm(isSelected ? 'all' : tc.term)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/15'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                        {tc.label}
                      </span>
                      <span className="text-[10px] font-mono-numbers text-slate-400 shrink-0">
                        {tc.gradedItemsCount}/{tc.totalItemsCount}
                      </span>
                    </div>
                    <div
                      className={`text-lg font-black font-mono-numbers mt-0.5 ${gradeColorClass(
                        tc.averageGrade
                      )}`}
                    >
                      {tc.averageGrade !== null ? `${tc.averageGrade.toFixed(2)}` : '—'}
                      <span className="text-[10px] font-normal text-slate-400 ml-0.5">/10</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-numbers truncate">
                      {tc.gradedSubjectsCount > 0
                        ? `${tc.gradedSubjectsCount} asign. evaluadas`
                        : 'Pendiente de nota'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Subject-by-Subject Breakdown */}
      {subjects.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowSubjectsBreakdown((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white py-1.5 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Desglose por Asignatura (
                {selectedTerm === 'all' ? 'Todo el curso' : getAcademicTermLabel(selectedTerm)})
              </span>
            </span>
            {showSubjectsBreakdown ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showSubjectsBreakdown && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {courseSummary.subjectRows.map((row) => {
                const sub = row.subject;
                return (
                  <div
                    key={sub.id}
                    onClick={() =>
                      onSelectSubject
                        ? onSelectSubject(sub.id)
                        : onOpenExamsManager?.(sub.id)
                    }
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: sub.color || '#3b82f6' }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {sub.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                          {row.summary.gradedItemsCount} eval. con nota
                          {row.credits > 0 ? ` · ${row.credits} ECTS` : ''}
                          {row.summary.gradedWeightEvaluated > 0
                            ? ` · ${row.summary.gradedWeightEvaluated}% peso`
                            : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-black font-mono-numbers ${gradeColorClass(
                          row.effectiveGrade
                        )}`}
                      >
                        {row.effectiveGrade !== null
                          ? row.effectiveGrade.toFixed(2)
                          : hasAnyGrade
                          ? 'Sin notas'
                          : '—'}
                      </div>
                      {row.effectiveGrade !== null && (
                        <div
                          className={`text-[10px] font-bold ${
                            row.passed
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {row.passed ? 'Aprobada' : 'Suspensa'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
