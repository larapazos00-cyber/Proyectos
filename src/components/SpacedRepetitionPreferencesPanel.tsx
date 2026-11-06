import React, { useState, useMemo } from 'react';
import {
  Brain,
  Bell,
  BellOff,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  Layers,
  ChevronRight,
  Zap,
  ArrowRight,
  Info,
  Check,
  BookOpen,
  Target,
} from 'lucide-react';
import {
  StudyProgram,
  ForgettingCurveProfile,
  DEFAULT_FORGETTING_CURVE_PROFILES,
  SpacedRepetitionConfig,
  Subject,
  Topic,
} from '../types';
import { schedulerService } from '../services/schedulerService';

interface SpacedRepetitionPreferencesPanelProps {
  customIntervals: [number, number, number, number, number];
  onChangeIntervals: (intervals: [number, number, number, number, number]) => void;
  phaseNotifications: [boolean, boolean, boolean, boolean, boolean];
  onChangePhaseNotifications: (notifs: [boolean, boolean, boolean, boolean, boolean]) => void;
  activeProfileId: string;
  onSelectProfileId: (profileId: string) => void;
  savedProfiles: ForgettingCurveProfile[];
  onUpdateSavedProfiles: (profiles: ForgettingCurveProfile[]) => void;
  programs?: StudyProgram[];
  onUpdatePrograms?: (programs: StudyProgram[]) => void;
  activeProgramId?: string;
  onTriggerSave?: (config: SpacedRepetitionConfig) => void;
  lastMassAppliedAt?: string;
  lastMassAppliedProgramName?: string;
}

const PHASE_METADATA = [
  {
    phase: 1,
    title: '1.ᵉʳ Repaso',
    subtitle: 'Consolidación Inicial',
    defaultDays: 1,
    defaultLabel: '24 horas (1 día)',
    description: 'Frena el decaimiento agudo inicial donde se pierde entre el 50% y el 70% de los datos nuevos.',
    urgencyColor: 'rose',
    badgeText: 'Fase Crítica',
  },
  {
    phase: 2,
    title: '2.º Repaso',
    subtitle: 'Fijación Temprana',
    defaultDays: 3,
    defaultLabel: 'A los 3 días',
    description: 'Primer anclaje semántico duradero antes de que la retención caiga por debajo del umbral del 60%.',
    urgencyColor: 'amber',
    badgeText: 'Refuerzo Clave',
  },
  {
    phase: 3,
    title: '3.ᵉʳ Repaso',
    subtitle: 'Consolidación Semanal',
    defaultDays: 7,
    defaultLabel: 'A la semana (7 días)',
    description: 'Transfiere la información de la memoria de trabajo hacia la memoria semántica a medio plazo.',
    urgencyColor: 'blue',
    badgeText: 'Medio Plazo',
  },
  {
    phase: 4,
    title: '4.º Repaso',
    subtitle: 'Fijación Quincenal',
    defaultDays: 15,
    defaultLabel: 'A los 15 días',
    description: 'Detecta lagunas residuales y asienta la red conceptual frente a temas posteriores.',
    urgencyColor: 'indigo',
    badgeText: 'Consolidación',
  },
  {
    phase: 5,
    title: '5.º Repaso',
    subtitle: 'Memoria Permanente',
    defaultDays: 30,
    defaultLabel: 'Al mes (30 días)',
    description: 'Garantiza la retención a largo plazo y sobreaprendizaje necesario para exámenes finales.',
    urgencyColor: 'emerald',
    badgeText: 'Largo Plazo',
  },
];

export const SpacedRepetitionPreferencesPanel: React.FC<SpacedRepetitionPreferencesPanelProps> = ({
  customIntervals,
  onChangeIntervals,
  phaseNotifications,
  onChangePhaseNotifications,
  activeProfileId,
  onSelectProfileId,
  savedProfiles,
  onUpdateSavedProfiles,
  programs = [],
  onUpdatePrograms,
  activeProgramId,
  onTriggerSave,
  lastMassAppliedAt,
  lastMassAppliedProgramName,
}) => {
  // Modal / Form state for saving a new profile
  const [showSaveProfileModal, setShowSaveProfileModal] = useState<boolean>(false);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [newProfileDesc, setNewProfileDesc] = useState<string>('');
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null);

  // Mass Apply target state
  const [selectedProgramId, setSelectedProgramId] = useState<string>(activeProgramId || (programs[0]?.id ?? 'all'));
  const [massApplyAnchorToday, setMassApplyAnchorToday] = useState<boolean>(true);
  const [massApplyOnlyStudied, setMassApplyOnlyStudied] = useState<boolean>(true);
  const [massApplyResult, setMassApplyResult] = useState<{
    success: boolean;
    message: string;
    affectedTopics: number;
    affectedSubjects: number;
    programName: string;
    samples: Array<{ topicTitle: string; subjectName: string; oldDate?: string; newDate: string; level: number; intervalDays: number }>;
  } | null>(null);

  // Combine default profiles with saved custom profiles
  const allProfiles: ForgettingCurveProfile[] = useMemo(() => {
    return [...DEFAULT_FORGETTING_CURVE_PROFILES, ...savedProfiles];
  }, [savedProfiles]);

  const activeProfile = allProfiles.find((p) => p.id === activeProfileId);

  // Check if current intervals match active profile exactly
  const isMatchingActiveProfile = useMemo(() => {
    if (!activeProfile) return false;
    const sameIntervals = customIntervals.every((val, idx) => val === activeProfile.intervals[idx]);
    const sameNotifs = phaseNotifications.every((val, idx) => val === activeProfile.phaseNotifications[idx]);
    return sameIntervals && sameNotifs;
  }, [activeProfile, customIntervals, phaseNotifications]);

  // Handler to activate a profile
  const handleSelectProfile = (profile: ForgettingCurveProfile) => {
    onSelectProfileId(profile.id);
    onChangeIntervals([...profile.intervals]);
    onChangePhaseNotifications([...profile.phaseNotifications]);
    setMassApplyResult(null);
  };

  // Handler to update an interval for a specific phase (1-based index)
  const handleUpdateInterval = (phaseIdx: number, newDays: number) => {
    const clamped = Math.max(1, Math.min(180, Math.round(newDays)));
    const updated: [number, number, number, number, number] = [...customIntervals];
    updated[phaseIdx] = clamped;
    onChangeIntervals(updated);
    setMassApplyResult(null);
  };

  // Handler to toggle notification for a specific phase (0-based index)
  const handleTogglePhaseNotif = (phaseIdx: number) => {
    const updated: [boolean, boolean, boolean, boolean, boolean] = [...phaseNotifications];
    updated[phaseIdx] = !updated[phaseIdx];
    onChangePhaseNotifications(updated);
  };

  // Reset to classic Ebbinghaus standards (1, 3, 7, 15, 30)
  const handleResetToClassic = () => {
    const standard: [number, number, number, number, number] = [1, 3, 7, 15, 30];
    const standardNotifs: [boolean, boolean, boolean, boolean, boolean] = [true, true, true, true, true];
    onSelectProfileId('moderado');
    onChangeIntervals(standard);
    onChangePhaseNotifications(standardNotifs);
    setMassApplyResult(null);
  };

  // Save current intervals & notification rules as a new custom profile
  const handleSaveAsCustomProfile = () => {
    if (!newProfileName.trim()) {
      setSaveProfileError('Por favor introduce un nombre para el perfil.');
      return;
    }

    const newId = `custom-profile-${Date.now()}`;
    const newProfile: ForgettingCurveProfile = {
      id: newId,
      name: newProfileName.trim(),
      description: newProfileDesc.trim() || `Perfil personalizado: [${customIntervals.join(', ')}] días`,
      isCustom: true,
      intervals: [...customIntervals],
      phaseNotifications: [...phaseNotifications],
    };

    const updatedProfiles = [...savedProfiles, newProfile];
    onUpdateSavedProfiles(updatedProfiles);
    onSelectProfileId(newId);
    setShowSaveProfileModal(false);
    setNewProfileName('');
    setNewProfileDesc('');
    setSaveProfileError(null);
  };

  // Delete a custom profile
  const handleDeleteCustomProfile = (profileId: string) => {
    const updated = savedProfiles.filter((p) => p.id !== profileId);
    onUpdateSavedProfiles(updated);
    if (activeProfileId === profileId) {
      onSelectProfileId('moderado');
    }
  };

  // Calculate live preview of affected subjects and topics for mass application
  const massApplyPreview = useMemo(() => {
    const targetProgs =
      selectedProgramId === 'all'
        ? programs
        : programs.filter((p) => p.id === selectedProgramId);

    let totalSubjects = 0;
    let totalCandidateTopics = 0;
    const sampleItems: Array<{ topic: Topic; subjectName: string; currentLevel: number; oldDate?: string; projectedDate: string; intervalDays: number }> = [];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    targetProgs.forEach((prog) => {
      prog.years.forEach((yr) => {
        yr.subjects.forEach((sub) => {
          let hasEligible = false;
          sub.topics.forEach((t) => {
            const isEligible =
              t.status === 'estudiado' ||
              t.status === 'repasado' ||
              !!t.nextReviewDate ||
              (t.reviewLevel && t.reviewLevel > 0) ||
              (t.reviewsHistory && t.reviewsHistory.length > 0);

            if (!massApplyOnlyStudied || isEligible) {
              totalCandidateTopics++;
              hasEligible = true;

              const level = Math.min(5, Math.max(1, t.reviewLevel || 1));
              const intervalDays = customIntervals[level - 1] ?? 1;

              const targetDate = new Date();
              targetDate.setDate(targetDate.getDate() + intervalDays);
              const projectedDate = targetDate.toISOString().split('T')[0];

              if (sampleItems.length < 3) {
                sampleItems.push({
                  topic: t,
                  subjectName: sub.name,
                  currentLevel: level,
                  oldDate: t.nextReviewDate,
                  projectedDate,
                  intervalDays,
                });
              }
            }
          });
          if (hasEligible) {
            totalSubjects++;
          }
        });
      });
    });

    const targetProgName =
      selectedProgramId === 'all'
        ? 'Todos los estudios y carreras'
        : programs.find((p) => p.id === selectedProgramId)?.name || 'Estudio seleccionado';

    return {
      targetProgName,
      totalSubjects,
      totalCandidateTopics,
      sampleItems,
    };
  }, [programs, selectedProgramId, massApplyOnlyStudied, customIntervals]);

  // Execute mass application across all subjects of the study
  const handleExecuteMassApply = () => {
    if (!programs || programs.length === 0 || !onUpdatePrograms) return;

    const currentProfileToApply: ForgettingCurveProfile = {
      id: activeProfileId,
      name: activeProfile?.name || 'Personalizado',
      description: activeProfile?.description || 'Perfil personalizado de curva del olvido',
      intervals: customIntervals,
      phaseNotifications,
    };

    const result = schedulerService.applyForgettingCurveProfileToPrograms(
      programs,
      selectedProgramId,
      currentProfileToApply,
      {
        anchorFromToday: massApplyAnchorToday,
        onlyStudiedOrScheduled: massApplyOnlyStudied,
      }
    );

    // Save programs state and local storage
    onUpdatePrograms(result.updatedPrograms);

    setMassApplyResult({
      success: true,
      message: `¡Perfil "${currentProfileToApply.name}" aplicado con éxito!`,
      affectedTopics: result.affectedTopicsCount,
      affectedSubjects: result.affectedSubjectsCount,
      programName: massApplyPreview.targetProgName,
      samples: result.sampleUpdates,
    });

    // Notify parent to save preferences if callback provided
    if (onTriggerSave) {
      onTriggerSave({
        activeProfileId,
        intervals: customIntervals,
        phaseNotifications,
        savedProfiles,
        lastMassAppliedAt: new Date().toISOString(),
        lastMassAppliedProgramName: massApplyPreview.targetProgName,
      });
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-purple-50/60 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900 border border-blue-200/80 dark:border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Brain className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Reglas de Repetición Espaciada y Curva del Olvido</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {activeProfile?.name || 'Personalizado'}
                </span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Personaliza los días de cada fase de repaso, gestiona alertas automáticas por ciclo y aplica perfiles masivos a todas las materias de un estudio.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleResetToClassic}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Restablecer a 1, 3, 7, 15 y 30 días"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Restablecer estándar (1, 3, 7, 15, 30d)</span>
          </button>
        </div>
      </div>

      {/* 2. Sección: Perfiles Preestablecidos de Curva del Olvido */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Perfiles Preestablecidos de 'Curva del Olvido'</span>
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Elige una estrategia adaptada a tu momento del curso o guarda tu propia configuración.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSaveProfileModal(true)}
            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Guardar actual como nuevo perfil</span>
          </button>
        </div>

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {allProfiles.map((prof) => {
            const isSelected = prof.id === activeProfileId;
            const notifsCount = prof.phaseNotifications.filter(Boolean).length;

            return (
              <div
                key={prof.id}
                onClick={() => handleSelectProfile(prof)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between gap-3 text-left ${
                  isSelected
                    ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                    : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      {prof.name}
                      {prof.isCustom && (
                        <span className="px-1.5 py-0.2 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[9px] font-semibold">
                          Personalizado
                        </span>
                      )}
                    </span>
                    {isSelected ? (
                      <span className="p-1 rounded-full bg-blue-600 text-white shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {prof.description}
                  </p>
                </div>

                {/* Interval Badges */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-1 flex-wrap">
                    {prof.intervals.map((days, idx) => (
                      <span
                        key={`${prof.id}-interval-${idx}`}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono-numbers font-semibold ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                        title={`Fase R${idx + 1}: ${days} días`}
                      >
                        R{idx + 1}: {days}d
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Bell className="w-3 h-3 text-slate-400" />
                      <span>{notifsCount}/5 fases con alerta</span>
                    </span>

                    {prof.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomProfile(prof.id);
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Eliminar este perfil personalizado"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Custom Profile Inline Modal */}
      {showSaveProfileModal && (
        <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <h6 className="text-xs font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Guardar configuración actual como nuevo perfil</span>
            </h6>
            <button
              type="button"
              onClick={() => setShowSaveProfileModal(false)}
              className="text-purple-400 hover:text-purple-700 text-xs"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-purple-900 dark:text-purple-300 mb-1">
                Nombre del perfil:
              </label>
              <input
                type="text"
                placeholder="ej: Sprint Final Oposiciones, Anatomía Intensiva"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-purple-900 dark:text-purple-300 mb-1">
                Descripción (opcional):
              </label>
              <input
                type="text"
                placeholder="ej: Para exámenes con temarios densos"
                value={newProfileDesc}
                onChange={(e) => setNewProfileDesc(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {saveProfileError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">{saveProfileError}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-purple-800 dark:text-purple-300">
              Guardará los intervalos actuales: [{customIntervals.join(', ')}] días.
            </span>
            <button
              type="button"
              onClick={handleSaveAsCustomProfile}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
            >
              Guardar Perfil
            </button>
          </div>
        </div>
      )}

      {/* 3. Sección Específica: 'Reglas de Repetición Espaciada' (Personalización de los 5 repasos y notificaciones) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/70 pb-3">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Personalización de los 5 Intervalos y Notificaciones por Fase</span>
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Ajusta los días transcurridos para cada uno de los 5 repasos y define si deseas recibir alerta automática cuando venza cada fase.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Frecuencia acumulada: {customIntervals.reduce((a, b) => a + b, 0)} días totales</span>
          </div>
        </div>

        {/* Interactive 5 Phase Table / Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {PHASE_METADATA.map((phaseMeta, idx) => {
            const days = customIntervals[idx];
            const isNotifEnabled = phaseNotifications[idx];

            return (
              <div
                key={`phase-card-${phaseMeta.phase}`}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-700/70 flex flex-col justify-between gap-3 text-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {phaseMeta.title}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      R{phaseMeta.phase}
                    </span>
                  </div>

                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {phaseMeta.subtitle}
                  </div>

                  {/* Interval Days Input with Stepper */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">
                      Intervalo (días):
                    </label>
                    <div className="flex items-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleUpdateInterval(idx, days - 1)}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
                        title="Reducir intervalo 1 día"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={days}
                        onChange={(e) => handleUpdateInterval(idx, parseInt(e.target.value) || 1)}
                        className="w-full text-center font-mono-numbers font-bold text-slate-900 dark:text-white text-xs py-1 bg-transparent focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateInterval(idx, days + 1)}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
                        title="Aumentar intervalo 1 día"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {phaseMeta.description}
                  </p>
                </div>

                {/* Notification Toggle for this Phase */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <label className="flex items-center justify-between gap-1.5 cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      {isNotifEnabled ? (
                        <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <BellOff className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                        {isNotifEnabled ? 'Alerta activa' : 'Silenciada'}
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      checked={isNotifEnabled}
                      onChange={() => handleTogglePhaseNotif(idx)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual Timeline of the Curva del Olvido */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
            <span className="font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Progresión Temporal de Repasos:</span>
            </span>
            <span className="font-mono-numbers text-[10px] text-slate-400">
              Sesión de estudio → R1 (+{customIntervals[0]}d) → R2 (+{customIntervals[1]}d) → R3 (+{customIntervals[2]}d) → R4 (+{customIntervals[3]}d) → R5 (+{customIntervals[4]}d)
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {customIntervals.map((d, i) => (
              <div
                key={`prog-bar-${i}`}
                className="h-2 rounded-full bg-blue-500/80 dark:bg-blue-400/80 overflow-hidden relative"
                title={`Fase ${i + 1}: ${d} días`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 4. Sección: Aplicación Masiva a todas las materias de un Estudio */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-blue-50/60 to-purple-50/40 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-slate-700 pb-3">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Aplicación Masiva a Todas las Materias de un Estudio</span>
            </h5>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              Recalcula automáticamente las fechas de próximo repaso (<code className="font-mono text-[10px] bg-white/70 dark:bg-slate-900 px-1 py-0.2 rounded">nextReviewDate</code>) de todos los temas según su fase actual (R1 a R5) y los intervalos configurados.
            </p>
          </div>

          {lastMassAppliedAt && (
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-numbers shrink-0">
              Último ajuste: {new Date(lastMassAppliedAt).toLocaleDateString()} ({lastMassAppliedProgramName})
            </div>
          )}
        </div>

        {/* Form controls for Mass Application */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Seleccionar Estudio / Carrera destino:
            </label>
            <select
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setMassApplyResult(null);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">🌐 Todas las carreras y estudios activos</option>
              {programs.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  🎓 {prog.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={massApplyAnchorToday}
                onChange={(e) => setMassApplyAnchorToday(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <span>
                <strong>Programar a partir de hoy</strong> (+ intervalo de días de su fase)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={massApplyOnlyStudied}
                onChange={(e) => setMassApplyOnlyStudied(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <span>
                Ajustar solo temas estudiados o con repasos activos en el temario
              </span>
            </label>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-indigo-100 dark:border-slate-700/60 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-600" />
              <span>Alcance del recálculo:</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-mono-numbers">
              {massApplyPreview.totalCandidateTopics} temas en {massApplyPreview.totalSubjects} materias
            </span>
          </div>

          {massApplyPreview.sampleItems.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] text-slate-400 font-medium">Ejemplo de ajuste programado:</div>
              {massApplyPreview.sampleItems.map((item, i) => (
                <div
                  key={`sample-${item.topic.id}-${i}`}
                  className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-700"
                >
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 dark:text-white">{item.topic.title}</span>{' '}
                    <span className="text-slate-400">({item.subjectName})</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono-numbers text-[10px]">
                    <span className="text-slate-400">{item.oldDate || 'Sin fecha'}</span>
                    <ArrowRight className="w-3 h-3 text-indigo-500" />
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {item.projectedDate} (R{item.currentLevel}: +{item.intervalDays}d)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">
              No hay temas candidatos para ajustar en este estudio con los filtros actuales.
            </p>
          )}
        </div>

        {/* Success Feedback Banner */}
        {massApplyResult && massApplyResult.success && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">{massApplyResult.message}</div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Se han recalculado correctamente <strong>{massApplyResult.affectedTopics} temas</strong> en{' '}
                <strong>{massApplyResult.affectedSubjects} asignaturas</strong> de{' '}
                <em>{massApplyResult.programName}</em> con los intervalos [{customIntervals.join(', ')}] días.
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={handleExecuteMassApply}
            disabled={massApplyPreview.totalCandidateTopics === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm ${
              massApplyPreview.totalCandidateTopics > 0
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Aplicar Perfil Masivamente a {massApplyPreview.targetProgName}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
