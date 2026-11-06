import React, { useState } from 'react';
import { Info, RotateCcw, Calendar, TrendingUp } from 'lucide-react';
import { Subject } from '../types';
import { getSubjectLastSpacedReviews } from '../utils/courseAlerts';

interface SubjectSpacedRepetitionInfoPopoverProps {
  subject: Subject;
  align?: 'left' | 'right';
  compact?: boolean;
}

export const SubjectSpacedRepetitionInfoPopover: React.FC<
  SubjectSpacedRepetitionInfoPopoverProps
> = ({ subject, align = 'right', compact = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  const recentReviews = React.useMemo(
    () => getSubjectLastSpacedReviews(subject, 3),
    [subject]
  );

  // Orden cronológico (del más antiguo al más reciente de los 3) para el mini gráfico
  const chronologicalReviews = React.useMemo(
    () => [...recentReviews].reverse(),
    [recentReviews]
  );

  const avgRetention = React.useMemo(() => {
    if (recentReviews.length === 0) return 0;
    const sum = recentReviews.reduce((acc, r) => acc + r.retentionPct, 0);
    return Math.round(sum / recentReviews.length);
  }, [recentReviews]);

  const formatShortDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const dateObj = new Date(y, m - 1, d, 12, 0, 0);
      return dateObj.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsHovered((prev) => !prev);
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsHovered((prev) => !prev);
        }}
        aria-label={`Ver últimos 3 repasos Spaced Repetition de ${subject.name}`}
        className={`inline-flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
          compact ? 'p-1' : 'p-1.5'
        } ${
          isHovered
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
            : 'bg-white/90 dark:bg-slate-800/90 text-indigo-600 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-700/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
        }`}
        title="Pasa el ratón para ver las últimas 3 fechas y resultados de Spaced Repetition"
      >
        <Info className={compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} />
      </button>

      {isHovered && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-50 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl ring-1 ring-slate-900/10 dark:ring-white/10 p-3.5 text-left animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Cabecera del popover */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shrink-0">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h5 className="text-[11px] font-extrabold text-slate-900 dark:text-white truncate">
                  Últimos 3 Repasos Spaced Repetition
                </h5>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {subject.name}
                </p>
              </div>
            </div>

            {recentReviews.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 font-mono-numbers shrink-0 inline-flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" />
                <span>{avgRetention}% ret.</span>
              </span>
            )}
          </div>

          {recentReviews.length === 0 ? (
            <div className="py-5 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sin historial de repasos aún
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Completa un repaso espaciado o cuestionario para registrar resultados aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2.5">
              {/* Mini Gráfico de Barras de las últimas 3 fechas */}
              <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                  <span className="font-semibold">Evolución de retención</span>
                  <span className="font-mono-numbers">Últimas {chronologicalReviews.length} sesiones</span>
                </div>

                <div className="grid grid-cols-3 gap-2 items-end h-16 pt-2 px-1">
                  {chronologicalReviews.map((rev) => {
                    const heightPct = Math.max(18, Math.min(100, rev.retentionPct));
                    return (
                      <div
                        key={`chart-${rev.id}`}
                        className="flex flex-col items-center justify-end h-full gap-1"
                      >
                        <span className="text-[9px] font-bold font-mono-numbers text-slate-700 dark:text-slate-300">
                          {rev.retentionPct}%
                        </span>
                        <div className="w-full max-w-[36px] bg-slate-200/70 dark:bg-slate-700/60 rounded-t-md h-9 flex items-end overflow-hidden p-0.5">
                          <div
                            className="w-full rounded-t-xs transition-all duration-300"
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: rev.barColorHex,
                            }}
                          />
                        </div>
                        <span className="text-[9px] font-mono-numbers text-slate-500 dark:text-slate-400 truncate max-w-full">
                          {formatShortDate(rev.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lista Resumen con las últimas 3 fechas de repaso y resultados */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Detalle de fechas y resultados
                </div>
                {recentReviews.map((rev) => (
                  <div
                    key={`list-${rev.id}`}
                    className="p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                        <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {rev.date}
                        </span>
                        <span>·</span>
                        <span>Ciclo R{rev.reviewLevel}</span>
                      </div>
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {rev.topicTitle}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 font-mono-numbers ${rev.badgeBgClass}`}
                    >
                      {rev.qualityLabel} ({rev.retentionPct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
