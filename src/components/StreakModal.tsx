import React from 'react';
import {
  Flame,
  X,
  Timer,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Trophy,
  Award,
  Zap,
} from 'lucide-react';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakDays: number;
  onStartStudy?: () => void;
}

const STREAK_MILESTONES = [
  { days: 3, title: 'Hábito en Marcha', icon: '🥉', desc: '3 días seguidos estudiando' },
  { days: 5, title: 'Constancia de Bronce', icon: '🥉', desc: '5 días de compromiso continuo' },
  { days: 7, title: 'Semana Imparable', icon: '🥈', desc: '7 días completos sin fallar' },
  { days: 14, title: 'Disciplina de Élite', icon: '🥇', desc: '2 semanas consolidando memoria' },
  { days: 30, title: 'Maestría Académica', icon: '👑', desc: '1 mes de dominio absoluto' },
];

export const StreakModal: React.FC<StreakModalProps> = ({
  isOpen,
  onClose,
  streakDays,
  onStartStudy,
}) => {
  if (!isOpen) return null;

  // Next milestone calculation
  const nextMilestone = STREAK_MILESTONES.find((m) => m.days > streakDays) || null;
  const daysToNext = nextMilestone ? nextMilestone.days - streakDays : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-md shadow-orange-500/20 text-white">
              <Flame className="w-7 h-7 fill-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Racha de Estudio
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tu motor de constancia y memoria a largo plazo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Highlight Card */}
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/80 dark:border-amber-900/40">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Racha actual
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-4xl font-black text-slate-900 dark:text-white font-mono-numbers">
                  {streakDays}
                </span>
                <span className="text-base font-bold text-slate-600 dark:text-slate-300">
                  {streakDays === 1 ? 'día consecutivo' : 'días consecutivos'}
                </span>
              </div>
            </div>

            <div className="text-right">
              {streakDays === 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Inicia hoy
                </span>
              ) : nextMilestone ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/60 px-3 py-1.5 rounded-full border border-amber-300/60 dark:border-amber-800/60">
                  <Trophy className="w-3.5 h-3.5 text-amber-600" />
                  Faltan {daysToNext}d para {nextMilestone.title}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-300/60">
                  <Award className="w-3.5 h-3.5" />
                  ¡Nivel Máximo!
                </span>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {streakDays === 0
              ? 'Completa hoy al menos 1 bloque de estudio o cronómetro Pomodoro para encender tu llama de racha.'
              : '¡Fantástico trabajo! Cada día consecutivo de estudio refuerza las sinapsis y afianza los contenidos en tu memoria a largo plazo.'}
          </p>
        </div>

        {/* 3 Core Rules Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            ¿Cómo se consigue y mantiene la racha?
          </h4>

          <div className="grid gap-2.5">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  1. Completa 1 sesión de estudio al día
                </div>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Basta con terminar un bloque en el <strong>cronómetro Pomodoro</strong> (o registrar un tema/repaso completado) para sumar la jornada.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  2. Estudia días consecutivos
                </div>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Si estudias hoy y vuelves a estudiar mañana, tu racha sube <strong>+1 día</strong>. Estudiar varias veces el mismo día consolida la jornada sin duplicarla.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-white">
                  3. Si pasa un día en blanco, se reinicia
                </div>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  Si dejas pasar un día completo sin estudiar, la racha volverá a 1 día en tu siguiente sesión. ¡Incluso 10 minutos bastan para salvar tu racha!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Milestones and Badges */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Medallas de Constancia
            </h4>
            <span className="text-[11px] text-slate-400">
              {STREAK_MILESTONES.filter((m) => streakDays >= m.days).length} de {STREAK_MILESTONES.length} desbloqueadas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STREAK_MILESTONES.map((milestone) => {
              const isUnlocked = streakDays >= milestone.days;
              return (
                <div
                  key={milestone.days}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                    isUnlocked
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                      : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800/60 opacity-60'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                      isUnlocked
                        ? 'bg-amber-100 dark:bg-amber-900/50 shadow-2xs'
                        : 'bg-slate-200 dark:bg-slate-700 grayscale'
                    }`}
                  >
                    <span>{milestone.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {milestone.title}
                      </span>
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        {milestone.days}d
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                      {isUnlocked ? '✓ Desbloqueada' : milestone.desc}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          {onStartStudy && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartStudy();
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-500 hover:to-red-500 rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>Estudiar con Pomodoro ahora</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
