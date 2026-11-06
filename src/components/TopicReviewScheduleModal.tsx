import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  RotateCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Brain,
  Layers,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import { Topic, ReviewQuality, SpacedReviewRecord } from '../types';
import { schedulerService } from '../services/schedulerService';

interface TopicReviewScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: Topic | null;
  subjectName?: string;
  subjectColor?: string;
  onSaveSchedule: (
    topicId: string,
    updatedData: {
      nextReviewDate: string;
      perceivedRetentionPct: number;
      reviewLevel: number;
      lastIntervalDays: number;
      lastAdjustmentReason: string;
      unresolvedErrorsCount?: number;
      pagesRead?: number;
      pageCount?: number;
      newReviewRecord?: SpacedReviewRecord;
    }
  ) => void;
}

const INTERVAL_DAYS = [1, 3, 7, 15, 30];

const RETENTION_PRESETS = [
  { label: 'Muy Baja', pct: 30, color: 'bg-rose-100 text-rose-800 border-rose-300', desc: 'Muchos errores, olvidar conceptos clave' },
  { label: 'Baja', pct: 50, color: 'bg-amber-100 text-amber-800 border-amber-300', desc: 'Dudas frecuentes, recuerdo lento' },
  { label: 'Media', pct: 70, color: 'bg-blue-100 text-blue-800 border-blue-300', desc: 'Recuerdo con algún titubeo' },
  { label: 'Alta', pct: 85, color: 'bg-indigo-100 text-indigo-800 border-indigo-300', desc: 'Buena fluidez y dominio' },
  { label: 'Excelente', pct: 95, color: 'bg-emerald-100 text-emerald-800 border-emerald-300', desc: 'Dominio perfecto e instantáneo' },
];

export const TopicReviewScheduleModal: React.FC<TopicReviewScheduleModalProps> = ({
  isOpen,
  onClose,
  topic,
  subjectName = 'Materia',
  subjectColor = '#3b82f6',
  onSaveSchedule,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [targetDate, setTargetDate] = useState<string>(todayStr);
  const [retentionPct, setRetentionPct] = useState<number>(75);
  const [reviewLevel, setReviewLevel] = useState<number>(1);
  const [errorsCount, setErrorsCount] = useState<number>(0);
  const [studiedPages, setStudiedPages] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(10);
  const [adjustmentNote, setAdjustmentNote] = useState<string>('');
  const [logAsCompletedSession, setLogAsCompletedSession] = useState<boolean>(false);
  const [sessionQuality, setSessionQuality] = useState<ReviewQuality>('bien');

  useEffect(() => {
    if (!topic || !isOpen) return;

    const initialDate = topic.nextReviewDate || todayStr;
    const pageStats = schedulerService.getTopicStudiedPages(topic);
    setTargetDate(initialDate);
    setRetentionPct(topic.perceivedRetentionPct ?? 75);
    setReviewLevel(topic.reviewLevel || 1);
    setErrorsCount(topic.unresolvedErrorsCount ?? 0);
    setStudiedPages(pageStats.studiedPages);
    setTotalPages(pageStats.totalPages);
    setAdjustmentNote(topic.lastAdjustmentReason || '');
    setLogAsCompletedSession(false);
  }, [topic, isOpen, todayStr]);

  if (!isOpen || !topic) return null;

  const reviewTimeCalc = schedulerService.calculateTopicReviewTime(
    { ...topic, pageCount: totalPages, pagesRead: studiedPages },
    studiedPages,
    reviewLevel
  );

  // Calculate days difference from today
  const calculateDaysDiff = (dateStr: string): number => {
    const dTarget = new Date(`${dateStr}T00:00:00`);
    const dToday = new Date(`${todayStr}T00:00:00`);
    return Math.round((dTarget.getTime() - dToday.getTime()) / (1000 * 60 * 60 * 24));
  };

  const daysUntilReview = calculateDaysDiff(targetDate);

  // Helper to shift target date by N days from today or from current target
  const handleShiftDateFromToday = (days: number, noteReason: string) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split('T')[0];
    setTargetDate(newDate);
    setAdjustmentNote(noteReason);
  };

  const handleRecalculateByStudiedPages = () => {
    const calc = schedulerService.getNextSpacedReview(
      Math.max(0, reviewLevel - 1),
      retentionPct >= 85 ? 'facil' : retentionPct < 60 ? 'dificil' : 'bien',
      {
        errorsCount,
        retentionPct,
        baseDateStr: todayStr,
        studiedPages,
        totalPages,
        difficulty: topic.difficulty,
      }
    );
    setTargetDate(calc.nextDate);
    setAdjustmentNote(calc.adjustmentNote);
  };

  const handleAdjustByRetention = (type: 'adelantar' | 'espaciar') => {
    if (type === 'adelantar') {
      // Advance review due to low retention / errors
      const currentDays = Math.max(1, calculateDaysDiff(targetDate));
      const newDays = Math.max(1, Math.floor(currentDays * 0.5));
      const note = `Adelantado por autoevaluación de baja retención (${retentionPct}%) · ${studiedPages}/${totalPages} págs. estudiadas`;
      handleShiftDateFromToday(newDays, note);
      if (retentionPct > 60) setRetentionPct(45);
    } else {
      // Space out review due to high retention
      const currentDays = Math.max(1, calculateDaysDiff(targetDate));
      const newDays = Math.max(currentDays + 3, Math.round(currentDays * 1.4));
      const note = `Espaciado por autoevaluación de alta retención (${retentionPct}%) · ${studiedPages}/${totalPages} págs. estudiadas`;
      handleShiftDateFromToday(newDays, note);
      if (retentionPct < 85) setRetentionPct(90);
    }
  };

  const handleSave = () => {
    const finalDaysDiff = Math.max(1, calculateDaysDiff(targetDate));
    let calculatedReason = adjustmentNote.trim();

    if (!calculatedReason) {
      const pageSummary = `${studiedPages}/${totalPages} págs. estudiadas (~${reviewTimeCalc.reviewMinutes} min repaso)`;
      if (retentionPct < 60) {
        calculatedReason = `Ajustado: ${finalDaysDiff}d (Retención baja: ${retentionPct}% · ${pageSummary})`;
      } else if (retentionPct >= 85) {
        calculatedReason = `Ajustado: ${finalDaysDiff}d (Retención alta: ${retentionPct}% · ${pageSummary})`;
      } else {
        calculatedReason = `Ajustado: ${finalDaysDiff}d (Retención: ${retentionPct}% · ${pageSummary})`;
      }
    }

    let newRecord: SpacedReviewRecord | undefined = undefined;
    if (logAsCompletedSession) {
      newRecord = {
        date: todayStr,
        quality: sessionQuality,
        retentionPct,
        errorsCount,
        intervalDaysUsed: finalDaysDiff,
        adjustmentNote: calculatedReason,
        pagesReviewed: studiedPages,
        totalTopicPages: totalPages,
        estimatedReviewMinutes: reviewTimeCalc.reviewMinutes,
      };
    }

    onSaveSchedule(topic.id, {
      nextReviewDate: targetDate,
      perceivedRetentionPct: retentionPct,
      reviewLevel,
      lastIntervalDays: finalDaysDiff,
      lastAdjustmentReason: calculatedReason,
      unresolvedErrorsCount: errorsCount,
      pagesRead: studiedPages,
      pageCount: totalPages,
      newReviewRecord: newRecord,
    });

    onClose();
  };

  const curveScheduleLabels: Record<number, string> = {
    1: '1er repaso · 24 horas',
    2: '2º repaso · 3 días',
    3: '3º repaso · 7 días (1 semana)',
    4: '4º repaso · 15 días',
    5: '5º repaso · 30 días (1 mes)',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: subjectColor }}
            >
              <RotateCw className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {subjectName}
                </span>
                <span className="text-xs text-slate-400 font-mono-numbers">
                  {curveScheduleLabels[reviewLevel] || `Nivel ${reviewLevel}`}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-1">
                Ajustar Repaso: {topic.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              daysUntilReview < 0
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                : daysUntilReview === 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 shrink-0" />
              <div>
                <span className="font-bold text-xs">
                  {daysUntilReview < 0
                    ? `¡Repaso Vencido hace ${Math.abs(daysUntilReview)} día${Math.abs(daysUntilReview) === 1 ? '' : 's'}!`
                    : daysUntilReview === 0
                    ? '¡El repaso está programado para HOY!'
                    : `Próximo repaso en ${daysUntilReview} día${daysUntilReview === 1 ? '' : 's'}`}
                </span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Fecha asignada: <strong className="font-mono-numbers">{targetDate}</strong>
                </p>
              </div>
            </div>

            <span className="font-mono-numbers font-bold text-xs px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 shadow-2xs">
              {daysUntilReview >= 0 ? `+${daysUntilReview}d` : `${daysUntilReview}d`}
            </span>
          </div>

          {/* Section 0: Páginas Estudiadas a Tener en Cuenta en el Repaso */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 text-xs">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Páginas Estudiadas para este Repaso</span>
                </label>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
                  El tiempo de repaso y el ajuste de la curva tienen en cuenta cuántas páginas has estudiado realmente.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 font-mono-numbers font-bold text-indigo-700 dark:text-indigo-300 text-xs">
                  📖 {studiedPages} / {totalPages} págs ({reviewTimeCalc.studiedPct}%)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-mono-numbers font-bold text-xs">
                  ⏱ ~{reviewTimeCalc.reviewMinutes} min repaso
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-indigo-100 dark:bg-indigo-900/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, reviewTimeCalc.studiedPct)}%` }}
              />
            </div>

            {/* Interactive Controls for Studied Pages & Total Pages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-800/70">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Páginas ya estudiadas a repasar
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStudiedPages((p) => Math.max(0, p - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(1, totalPages)}
                    value={studiedPages}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setStudiedPages(val);
                      if (val > totalPages) setTotalPages(val);
                    }}
                    className="w-16 text-center font-mono-numbers font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setStudiedPages((p) => {
                        const next = p + 1;
                        if (next > totalPages) setTotalPages(next);
                        return next;
                      })
                    }
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    +
                  </button>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      onClick={() => setStudiedPages(Math.max(1, Math.round(totalPages / 2)))}
                      className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 text-[10px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Mitad
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudiedPages(totalPages)}
                      className="px-2 py-1 rounded-md bg-indigo-100 dark:bg-indigo-900/70 hover:bg-indigo-200 text-[10px] font-bold text-indigo-800 dark:text-indigo-200 cursor-pointer"
                    >
                      Todas ({totalPages})
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-800/70 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Total páginas del tema
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={totalPages}
                    onChange={(e) => {
                      const tot = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setTotalPages(tot);
                      if (studiedPages > tot) setStudiedPages(tot);
                    }}
                    className="w-16 text-center font-mono-numbers font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-0.5 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRecalculateByStudiedPages}
                  className="mt-2 w-full py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Recalcular fecha óptima según {studiedPages} págs. estudiadas</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: Selector Manual de Fecha y Atajos Rápidos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Fecha del Próximo Repaso (Manual)</span>
              </label>
              <span className="text-[11px] text-slate-400">YYYY-MM-DD</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => {
                  setTargetDate(e.target.value);
                  setAdjustmentNote('Fecha seleccionada manualmente');
                }}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-mono-numbers font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleShiftDateFromToday(0, 'Adelantado a hoy para repaso urgente')}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hoy
              </button>
            </div>

            {/* Quick Shift Pills based on standard forgetting curve (24h, 3d, 7d, 15d, 30d) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Atajos según Curva del Olvido:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleShiftDateFromToday(1, 'Repaso R1: a las 24 horas')}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 text-center font-bold text-[11px] text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  +24h (1d)
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftDateFromToday(3, 'Repaso R2: a los 3 días')}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 text-center font-bold text-[11px] text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  +3 días
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftDateFromToday(7, 'Repaso R3: a los 7 días (1 sem)')}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 text-center font-bold text-[11px] text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  +7 días
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftDateFromToday(15, 'Repaso R4: a los 15 días')}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 text-center font-bold text-[11px] text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  +15 días
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftDateFromToday(30, 'Repaso R5: al mes (30 días)')}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 text-center font-bold text-[11px] text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  +30 días
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Autoevaluación de Retención y Errores */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-purple-600" />
                  <span>Autoevaluación de Retención Demostrada o Percibida</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Ajusta la fecha adelantando o retrasando el intervalo según lo que recuerdes.
                </p>
              </div>
              <span
                className={`font-mono-numbers font-bold text-sm px-2.5 py-0.5 rounded-lg border ${
                  retentionPct >= 85
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : retentionPct >= 65
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {retentionPct}%
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={retentionPct}
              onChange={(e) => setRetentionPct(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />

            {/* Presets */}
            <div className="grid grid-cols-5 gap-1.5">
              {RETENTION_PRESETS.map((p) => (
                <button
                  key={p.pct}
                  type="button"
                  onClick={() => setRetentionPct(p.pct)}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    retentionPct === p.pct
                      ? `${p.color} ring-2 ring-purple-500 font-bold shadow-2xs`
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                  title={p.desc}
                >
                  <div className="font-bold text-[11px]">{p.label}</div>
                  <div className="text-[10px] opacity-75 font-mono-numbers">{p.pct}%</div>
                </button>
              ))}
            </div>

            {/* Acciones Rápidas: Adelantar / Espaciar según Retención */}
            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-purple-950 dark:text-purple-200 text-xs">
                  Recomendación Inteligente de Intervalo:
                </span>
                <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                  {retentionPct < 60 || errorsCount > 0
                    ? '⚠️ Retención baja o errores: Conviene adelantar el repaso a corto plazo para evitar olvido.'
                    : '✨ Buena retención: Puedes espaciar el intervalo para optimizar tu tiempo de estudio.'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAdjustByRetention('adelantar')}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                  title="Adelantar fecha debido a baja retención o fallos"
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Adelantar repaso</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAdjustByRetention('espaciar')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                  title="Espaciar el repaso más días por alta retención"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Espaciar intervalo</span>
                </button>
              </div>
            </div>

            {/* Error Counter & Level Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Errores o fallos no resueltos
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setErrorsCount((prev) => Math.max(0, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-mono-numbers font-bold text-sm text-slate-900 dark:text-slate-100">
                    {errorsCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setErrorsCount((prev) => prev + 1)}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    +
                  </button>
                  {errorsCount > 0 && (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold ml-1">
                      Requiere refuerzo
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nivel de Repetición Espaciada
                </label>
                <select
                  value={reviewLevel}
                  onChange={(e) => setReviewLevel(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-xs text-slate-900 dark:text-slate-100 font-semibold cursor-pointer"
                >
                  <option value={1}>R1 · 24 horas (Día 1)</option>
                  <option value={2}>R2 · 3 días (Día 3)</option>
                  <option value={3}>R3 · 7 días (Día 7)</option>
                  <option value={4}>R4 · 15 días (Día 15)</option>
                  <option value={5}>R5 · 30 días (Mes 1)</option>
                </select>
              </div>
            </div>

            {/* Motivo o nota del ajuste */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Motivo del ajuste (opcional):
              </label>
              <input
                type="text"
                value={adjustmentNote}
                onChange={(e) => setAdjustmentNote(e.target.value)}
                placeholder="Ej: Adelantado por dudas en el mecanismo X / Espaciado por test perfecto"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            {/* Checkbox: Registrar como sesión completada hoy */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={logAsCompletedSession}
                  onChange={(e) => setLogAsCompletedSession(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Registrar también una sesión de repaso completada hoy en el histórico
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Añade un hito en la curva de retención y estadísticas con la calificación elegida.
                  </p>
                </div>
              </label>

              {logAsCompletedSession && (
                <div className="mt-2.5 pl-6 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Calidad:</span>
                  {(['facil', 'bien', 'dificil', 'repetir'] as ReviewQuality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSessionQuality(q)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-colors cursor-pointer border ${
                        sessionQuality === q
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Guardar Ajuste de Repaso</span>
          </button>
        </div>
      </div>
    </div>
  );
};
