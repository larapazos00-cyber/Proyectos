import React, { useState } from 'react';
import {
  RotateCw,
  CheckCircle2,
  Trophy,
  Flame,
  ArrowRight,
  TrendingUp,
  Plus,
  Minus,
  Sparkles,
  BookOpen,
  Calendar,
  Layers,
  FileText,
  AlertCircle,
  Play,
} from 'lucide-react';
import { Subject, Topic, ReviewQuality } from '../types';
import { schedulerService } from '../services/schedulerService';

interface SubjectVueltasTabProps {
  subject: Subject;
  onUpdateSubject: (updated: Subject) => void;
  onStartPomodoro?: (topicId: string) => void;
  onOpenNotes?: (topic: Topic) => void;
}

export const SubjectVueltasTab: React.FC<SubjectVueltasTabProps> = ({
  subject,
  onUpdateSubject,
  onStartPomodoro,
  onOpenNotes,
}) => {
  const currentVuelta = subject.currentVuelta || 1;
  const targetVueltas = subject.targetVueltas || 3;
  const [filterMode, setFilterMode] = useState<'todos' | 'pendientes' | 'completados'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to get total times a topic has been studied or reviewed
  const getTopicVueltas = (topic: Topic): number => {
    if (topic.vueltasCount !== undefined) {
      return topic.vueltasCount;
    }
    const historyCount = topic.reviewsHistory ? topic.reviewsHistory.length : 0;
    const baseStudy = topic.status === 'estudiado' || topic.status === 'repasado' || topic.studiedAt ? 1 : 0;
    return Math.max(historyCount, baseStudy);
  };

  // Change current global vuelta for the subject
  const handleChangeCurrentVuelta = (newVuelta: number) => {
    if (newVuelta < 1) return;
    onUpdateSubject({
      ...subject,
      currentVuelta: newVuelta,
    });
  };

  // Change target vueltas goal
  const handleChangeTargetVueltas = (newTarget: number) => {
    if (newTarget < 1) return;
    onUpdateSubject({
      ...subject,
      targetVueltas: newTarget,
    });
  };

  // Increment vuelta for a single topic with forgetting curve schedule (24h, 3d, 7d, 15d, 30d) + studied pages
  const handleIncrementTopicVuelta = (
    topicId: string,
    quality: ReviewQuality = 'bien',
    options?: { errorsCount?: number; retentionPct?: number }
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const currentCount = getTopicVueltas(t);
        const nextCount = currentCount + 1;
        const pageInfo = schedulerService.getTopicStudiedPages(t);
        const pagesReviewed =
          pageInfo.studiedPages > 0 ? pageInfo.studiedPages : pageInfo.totalPages;
        const calc = schedulerService.getNextSpacedReview(t.reviewLevel || 0, quality, {
          errorsCount: options?.errorsCount,
          retentionPct: options?.retentionPct ?? t.perceivedRetentionPct,
          baseDateStr: todayStr,
          studiedPages: pagesReviewed,
          totalPages: pageInfo.totalPages,
          difficulty: t.difficulty,
        });

        return {
          ...t,
          vueltasCount: nextCount,
          status: 'repasado' as const,
          pagesRead: Math.max(t.pagesRead || 0, pagesReviewed),
          nextReviewDate: calc.nextDate,
          reviewLevel: calc.nextLevel,
          perceivedRetentionPct: calc.inferredRetentionPct,
          lastIntervalDays: calc.adjustedIntervalDays,
          lastAdjustmentReason: calc.adjustmentNote,
          studiedAt: t.studiedAt || todayStr,
          reviewsHistory: [
            ...(t.reviewsHistory || []),
            {
              date: todayStr,
              quality,
              retentionPct: calc.inferredRetentionPct,
              errorsCount: options?.errorsCount,
              intervalDaysUsed: calc.adjustedIntervalDays,
              adjustmentNote: calc.adjustmentNote,
              pagesReviewed,
              totalTopicPages: pageInfo.totalPages,
              estimatedReviewMinutes: calc.estimatedReviewMinutes,
            },
          ],
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Update studied pages for a topic directly in the Vueltas tab
  const handleUpdateTopicStudiedPages = (topicId: string, newStudiedPages: number) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const pageInfo = schedulerService.getTopicStudiedPages(t);
        const clamped = Math.max(0, newStudiedPages);
        const nextTotal = Math.max(pageInfo.totalPages, clamped);
        return {
          ...t,
          pagesRead: clamped,
          pageCount: nextTotal,
          studiedAt: clamped > 0 ? t.studiedAt || todayStr : t.studiedAt,
          status:
            clamped >= nextTotal && t.status === 'pendiente'
              ? ('estudiado' as const)
              : clamped > 0 && t.status === 'pendiente'
              ? ('en_progreso' as const)
              : t.status,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Adelantar o espaciar el próximo repaso de un tema según errores o retención demostrada/percibida
  const handleAdjustTopicReview = (
    topicId: string,
    mode: 'adelantar_baja_retencion' | 'espaciar_alta_retencion' | 'restaurar_curva'
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const adjusted = schedulerService.adjustTopicReviewSchedule(t, mode);
        return {
          ...t,
          status: t.status === 'pendiente' ? ('estudiado' as const) : t.status,
          studiedAt: t.studiedAt || todayStr,
          reviewLevel: adjusted.reviewLevel,
          nextReviewDate: adjusted.nextReviewDate,
          perceivedRetentionPct: adjusted.perceivedRetentionPct,
          unresolvedErrorsCount: adjusted.unresolvedErrorsCount,
          lastIntervalDays: adjusted.lastIntervalDays,
          lastAdjustmentReason: adjusted.lastAdjustmentReason,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Decrement vuelta for a single topic
  const handleDecrementTopicVuelta = (topicId: string) => {
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const currentCount = getTopicVueltas(t);
        const nextCount = Math.max(0, currentCount - 1);
        return {
          ...t,
          vueltasCount: nextCount,
          status: nextCount === 0 ? ('pendiente' as const) : t.status,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Metrics
  const totalTopics = subject.topics.length;
  const topicsInCurrentVuelta = subject.topics.filter((t) => getTopicVueltas(t) >= currentVuelta).length;
  const pctCurrentVuelta = totalTopics > 0 ? Math.round((topicsInCurrentVuelta / totalTopics) * 100) : 0;
  
  const totalVueltasAccumulated = subject.topics.reduce((acc, t) => acc + getTopicVueltas(t), 0);
  const averageVueltasPerTopic = totalTopics > 0 ? (totalVueltasAccumulated / totalTopics).toFixed(1) : '0';

  // Topics completed for next milestones
  const topicsWithVuelta1 = subject.topics.filter((t) => getTopicVueltas(t) >= 1).length;
  const topicsWithVuelta2 = subject.topics.filter((t) => getTopicVueltas(t) >= 2).length;
  const topicsWithVuelta3 = subject.topics.filter((t) => getTopicVueltas(t) >= 3).length;

  // Filtered topics list
  const filteredTopics = subject.topics.filter((topic) => {
    const matchesSearch = topic.title.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const vueltas = getTopicVueltas(topic);
    if (filterMode === 'pendientes') {
      return vueltas < currentVuelta;
    }
    if (filterMode === 'completados') {
      return vueltas >= currentVuelta;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner & Vuelta Controller */}
      <div className="p-6 bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 rounded-2xl text-white shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
                <RotateCw className="w-5 h-5 animate-spin-slow" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Plan de Vueltas al Temario
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono-numbers">
                    Vuelta {currentVuelta} de {targetVueltas}
                  </span>
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Lleva el control de cuántas veces has estudiado y repasado cada tema para llegar al examen con máxima retención.
                </p>
              </div>
            </div>
          </div>

          {/* Current Vuelta Selector */}
          <div className="flex items-center gap-3 bg-white/10 p-2 rounded-xl backdrop-blur-xs border border-white/15">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-200">
                Vuelta en curso
              </div>
              <div className="text-base font-extrabold font-mono-numbers text-white">
                Vuelta {currentVuelta}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleChangeCurrentVuelta(currentVuelta - 1)}
                disabled={currentVuelta <= 1}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors cursor-pointer"
                title="Vuelta anterior"
              >
                <Minus className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                onClick={() => handleChangeCurrentVuelta(currentVuelta + 1)}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer flex items-center gap-1 text-xs px-2.5"
                title="Iniciar siguiente vuelta al temario"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Vuelta</span>
              </button>
            </div>
          </div>
        </div>

        {/* Current Vuelta Progress Bar */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-indigo-200">
              Progreso de la <strong>Vuelta {currentVuelta}</strong>:
            </span>
            <span className="font-bold text-white font-mono-numbers">
              {topicsInCurrentVuelta} de {totalTopics} temas ({pctCurrentVuelta}%)
            </span>
          </div>

          <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5 border border-white/15">
            <div
              className="bg-gradient-to-r from-blue-400 to-indigo-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${pctCurrentVuelta}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-indigo-300 pt-1">
            <span>
              {pctCurrentVuelta === 100
                ? '¡Enhorabuena! Has completado todos los temas en esta vuelta.'
                : `Quedan ${totalTopics - topicsInCurrentVuelta} temas para completar la Vuelta ${currentVuelta}.`}
            </span>
            <div className="flex items-center gap-1.5">
              <span>Meta final:</span>
              <select
                value={targetVueltas}
                onChange={(e) => handleChangeTargetVueltas(parseInt(e.target.value, 10))}
                className="bg-slate-800 text-white border border-slate-600 rounded px-1.5 py-0.5 text-[11px] font-mono-numbers cursor-pointer focus:outline-none"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} vueltas
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Repasos y Estudios</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono-numbers text-slate-900">
            {totalVueltasAccumulated}
          </div>
          <div className="text-xs text-slate-500">
            Promedio de <strong className="text-slate-800 font-mono-numbers">{averageVueltasPerTopic}</strong> vueltas por tema
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Desglose por Vueltas</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-center gap-3 text-xs font-mono-numbers pt-1">
            <span className="text-slate-700">
              V1: <strong className="text-blue-600">{topicsWithVuelta1}</strong>/{totalTopics}
            </span>
            <span className="text-slate-700">
              V2: <strong className="text-indigo-600">{topicsWithVuelta2}</strong>/{totalTopics}
            </span>
            <span className="text-slate-700">
              V3+: <strong className="text-purple-600">{topicsWithVuelta3}</strong>/{totalTopics}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Consolidación progresiva de la memoria
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Curva del Olvido (5 Repasos)</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-[11px] text-slate-600 leading-snug pt-1">
            <strong>1º:</strong> 24h · <strong>2º:</strong> 3 días · <strong>3º:</strong> 7 días · <strong>4º:</strong> 15 días · <strong>5º:</strong> 30 días.
            <br />
            Ajustable: adelanta si hay fallos/baja retención o espacia si es muy alta.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterMode('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'todos'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos los temas ({totalTopics})
          </button>
          <button
            onClick={() => setFilterMode('pendientes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'pendientes'
                ? 'bg-white text-amber-900 shadow-2xs border border-amber-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pendientes en Vuelta {currentVuelta} ({totalTopics - topicsInCurrentVuelta})
          </button>
          <button
            onClick={() => setFilterMode('completados')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'completados'
                ? 'bg-white text-emerald-900 shadow-2xs border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completados en Vuelta {currentVuelta} ({topicsInCurrentVuelta})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar tema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Topics Vueltas Table / Cards */}
      <div className="space-y-3">
        {filteredTopics.map((topic, idx) => {
          const vueltas = getTopicVueltas(topic);
          const hasReachedCurrent = vueltas >= currentVuelta;
          const reviewsCount = topic.reviewsHistory ? topic.reviewsHistory.length : 0;
          const pageInfo = schedulerService.getTopicStudiedPages(topic);
          const revTime = schedulerService.calculateTopicReviewTime(
            topic,
            pageInfo.studiedPages,
            Math.max(1, topic.reviewLevel || 1)
          );

          return (
            <div
              key={topic.id}
              className={`p-4 bg-white rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs ${
                hasReachedCurrent
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-amber-200/80 bg-amber-50/20'
              }`}
            >
              {/* Topic Info */}
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-bold text-slate-700 font-mono-numbers">
                    Tema {topic.id.replace('t', '') || idx + 1}
                  </span>
                  <span>·</span>
                  <span className="text-slate-600">Dificultad: {topic.difficulty}</span>
                  <span>·</span>
                  <span className="text-indigo-700 font-semibold font-mono-numbers">
                    📖 {pageInfo.studiedPages}/{pageInfo.totalPages} págs. estudiadas (~{revTime.reviewMinutes}m repaso)
                  </span>
                  <span>·</span>
                  <span className="text-blue-700 font-medium font-mono-numbers">
                    ⏱ {topic.estimatedHours}h estimadas
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{topic.title}</h4>

                {/* Progress Indicators */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {/* Status Tag */}
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      hasReachedCurrent
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {hasReachedCurrent ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Al día con la Vuelta {currentVuelta}</span>
                      </>
                    ) : (
                      <>
                        <RotateCw className="w-3 h-3 text-amber-600" />
                        <span>Pendiente para Vuelta {currentVuelta}</span>
                      </>
                    )}
                  </span>

                  {/* Studied Pages Stepper inline */}
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-mono-numbers text-indigo-900">
                    <span className="font-semibold">Págs. estudiadas:</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateTopicStudiedPages(topic.id, Math.max(0, pageInfo.studiedPages - 1))
                      }
                      className="w-4 h-4 rounded bg-white hover:bg-indigo-100 text-indigo-800 font-bold leading-none cursor-pointer"
                      title="Restar 1 página estudiada"
                    >
                      -
                    </button>
                    <strong className="px-1">
                      {pageInfo.studiedPages}/{pageInfo.totalPages}
                    </strong>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateTopicStudiedPages(topic.id, pageInfo.studiedPages + 1)
                      }
                      className="w-4 h-4 rounded bg-white hover:bg-indigo-100 text-indigo-800 font-bold leading-none cursor-pointer"
                      title="Sumar 1 página estudiada"
                    >
                      +
                    </button>
                  </div>

                  {/* Reviews History summary */}
                  {topic.studiedAt && (
                    <span className="text-slate-500 text-[11px] font-mono-numbers">
                      Primer estudio: {topic.studiedAt}
                    </span>
                  )}

                  {topic.nextReviewDate && (
                    <span className="text-indigo-600 text-[11px] font-mono-numbers font-medium">
                      Próximo repaso (R{Math.min(5, Math.max(1, topic.reviewLevel || 1))}): {topic.nextReviewDate}
                    </span>
                  )}

                  {/* Quick buttons to advance or space out review based on errors / retention */}
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleAdjustTopicReview(topic.id, 'adelantar_baja_retencion')}
                      className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Adelantar repaso por baja retención o errores"
                    >
                      ⏪ Adelantar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustTopicReview(topic.id, 'espaciar_alta_retencion')}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Espaciar repaso un poco más por alta retención"
                    >
                      ⏩ Espaciar
                    </button>
                  </div>
                </div>
              </div>

              {/* Vueltas Counter & Quick Actions */}
              <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                {/* Visual Vuelta Dots */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((vNum) => (
                    <span
                      key={vNum}
                      className={`w-2.5 h-2.5 rounded-full border transition-all ${
                        vueltas >= vNum
                          ? 'bg-indigo-600 border-indigo-700'
                          : 'bg-slate-200 border-slate-300'
                      }`}
                      title={`Vuelta ${vNum} ${vueltas >= vNum ? 'completada' : 'pendiente'}`}
                    />
                  ))}
                </div>

                {/* Interactive Vueltas Stepper */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => handleDecrementTopicVuelta(topic.id)}
                    disabled={vueltas <= 0}
                    className="p-1 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-30 text-slate-700 transition-colors cursor-pointer"
                    title="Restar una vuelta"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="px-2.5 py-0.5 text-center min-w-[75px]">
                    <span className="text-xs font-bold text-slate-900 font-mono-numbers block">
                      {vueltas} {vueltas === 1 ? 'vuelta' : 'vueltas'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono-numbers block">
                      {reviewsCount} repasos
                    </span>
                  </div>

                  <button
                    onClick={() => handleIncrementTopicVuelta(topic.id)}
                    className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
                    title="Registrar una nueva vuelta o repaso para este tema"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick study button */}
                {onStartPomodoro && (
                  <button
                    onClick={() => onStartPomodoro(topic.id)}
                    className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    title="Iniciar sesión de Pomodoro en este tema"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}

                {onOpenNotes && (
                  <button
                    onClick={() => onOpenNotes(topic)}
                    className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    title="Ver o redactar apuntes de este tema"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredTopics.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
            No se han encontrado temas con el filtro seleccionado.
          </div>
        )}
      </div>
    </div>
  );
};
