import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  LayoutDashboard,
  BookOpen,
  Calendar,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Compass,
  Play,
  Pause,
  Maximize2,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { NavTabId } from './Navigation';

export const ONBOARDING_PROGRESS_STORAGE_KEY = 'studyflow_onboarding_progress_v1';
export const ONBOARDING_COMPLETED_STORAGE_KEY = 'studyflow_onboarding_completed_v1';

export interface OnboardingPersistedProgress {
  currentStepIndex: number;
  completedStepIds: string[];
  isInteractivePreview: boolean;
  isAutoPlaying: boolean;
  lastUpdatedAt: string;
}

interface InteractiveOnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavTabId) => void;
  onOpenProgramManager: () => void;
  onOpenPreferences: () => void;
  onOpenFirstSubject?: () => void;
}

interface OnboardingStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  highlightTargetLabel: string;
  highlightPositionHint: string;
  icon: React.ElementType;
  accentColor: string;
  description: string;
  keyPoints: string[];
  recommendedTab?: NavTabId;
  actionButtonLabel: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome-programs',
    badge: 'Paso 1 de 5 · Configuración Inicial',
    title: 'Gestor de Programas y Cursos (+ Estudios)',
    subtitle: 'Organiza tu carrera, máster, oposición o combina varios estudios',
    highlightTargetLabel: 'Botón "+ Estudios" en la esquina superior derecha / menú lateral',
    highlightPositionHint: 'Arriba a la derecha',
    icon: Plus,
    accentColor: 'from-blue-600 to-indigo-600',
    description:
      'Desde el Gestor de Programas puedes crear tus grados, cursos o certificaciones, importar asignaturas y activar el modo Mix Académico para estudiar asignaturas de varios cursos simultáneamente.',
    keyPoints: [
      'Pulsa "+ Estudios" en la barra superior para crear o cambiar de carrera o curso.',
      'Selecciona varios cursos a la vez si tienes asignaturas de distintos años.',
      'Exporta o importa copias de seguridad o carga datos de demostración en 1 clic.',
    ],
    recommendedTab: 'curso',
    actionButtonLabel: 'Probar Paso 1: Gestor de Estudios y Continuar',
  },
  {
    id: 'navigation-overview',
    badge: 'Paso 2 de 5 · Navegación Inteligente',
    title: 'Barra de Navegación y Centro de Mando',
    subtitle: 'Recorre las 6 áreas clave de tu entorno de estudio',
    highlightTargetLabel:
      'Barra de Navegación Principal (General · Materias · Plan · Cuestionarios · Pomodoro · Estadísticas)',
    highlightPositionHint: 'Cabecera central o panel izquierdo',
    icon: LayoutDashboard,
    accentColor: 'from-indigo-600 to-violet-600',
    description:
      'La barra de navegación conecta todo tu flujo académico: desde el resumen diario en "General" hasta tus apuntes en "Materias", tu calendario en "Plan y Repasos" y tus simulacros con IA.',
    keyPoints: [
      'General: métricas del día, mapa de calor de rachas (3 y 6 meses) y alertas urgentes.',
      'Materias: temario por estados, páginas leídas, apuntes Cornell y reto Feynman.',
      'Cuestionarios y Pomodoro: tests de Active Recall y bloques de concentración.',
    ],
    recommendedTab: 'curso',
    actionButtonLabel: 'Probar Paso 2: Explorar Centro de Mando y Continuar',
  },
  {
    id: 'materias-pages',
    badge: 'Paso 3 de 5 · Estudio por Páginas',
    title: 'Materias: Lectura Diaria y Activación de Repasos',
    subtitle: 'Marca páginas leídas o temas estudiados para disparar la curva 1-3-7',
    highlightTargetLabel: 'Pestaña "Materias" → Temario Oficial y Plan Diario de Páginas',
    highlightPositionHint: 'Pestaña 2 de la navegación',
    icon: BookOpen,
    accentColor: 'from-emerald-600 to-teal-600',
    description:
      'Dentro de cada materia verás exactamente cuántas páginas al día necesitas leer de cada tema para llegar a tiempo a tus exámenes y entregas de tareas. Al marcar páginas como leídas o un tema como estudiado, se crean automáticamente sus repasos espaciados.',
    keyPoints: [
      'Cuota Diaria de Páginas: calcula qué páginas estudiar cada día antes del examen o tarea.',
      'Repasos Espaciados Reales: solo se programan (1, 3, 7, 15 y 30 días) sobre los temas o páginas que ya has marcado como estudiados/leídos.',
      'Herramientas IA ultrarrápidas: extrae Puntos Clave IA, esquemas y flashcards de tus PDFs.',
    ],
    recommendedTab: 'asignaturas',
    actionButtonLabel: 'Probar Paso 3: Ver Materias y Plan de Páginas',
  },
  {
    id: 'plan-spaced-repetition',
    badge: 'Paso 4 de 5 · Planificador y Curva del Olvido',
    title: 'Plan y Repasos: Calendario Diario de Páginas y Retención',
    subtitle: 'Tu hoja de ruta diaria para exámenes, entregas y repasos espaciados',
    highlightTargetLabel: 'Pestaña "Plan y Repasos" en la barra de navegación',
    highlightPositionHint: 'Pestaña 3 de la navegación',
    icon: Calendar,
    accentColor: 'from-purple-600 to-indigo-600',
    description:
      'El calendario combina dos capas esenciales: qué temas y número exacto de páginas te toca estudiar cada día para llegar a tiempo al examen o tarea, y los repasos espaciados (R1 1d, R2 3d, R3 7d, R4 15d, R5 30d) de lo que ya has estudiado.',
    keyPoints: [
      'Meta Diaria de Estudio: indica "Tema X: Págs. A–B (N págs)" en cada día del calendario.',
      'Curva de Ebbinghaus (1, 3, 7, 15, 30d): repasa únicamente las páginas que ya has leído.',
      'Sincronizado con tus horas libres de lunes a domingo y fechas reales de examen.',
    ],
    recommendedTab: 'calendario',
    actionButtonLabel: 'Probar Paso 4: Ver Calendario de Plan y Repasos',
  },
  {
    id: 'customization-streak',
    badge: 'Paso 5 de 5 · Personalización y Racha Diaria',
    title: 'Personalización de Interfaz (⚙️) y Racha (🔥)',
    subtitle: 'Adapta las pestañas, posición del menú y mantén tu constancia',
    highlightTargetLabel: 'Iconos de Personalización (⚙️ / Pestañas), Racha (🔥) y Ayuda (?)',
    highlightPositionHint: 'Barra de herramientas superior',
    icon: SlidersHorizontal,
    accentColor: 'from-amber-500 to-orange-600',
    description:
      'Personaliza StudyFlow a tu gusto: alterna entre barra superior o menú lateral izquierdo, muestra u oculta pestañas, ajusta tu velocidad de lectura (págs/hora) y mantén viva tu racha diaria completando sesiones Pomodoro.',
    keyPoints: [
      'Personalización de Interfaz y Pestañas: oculta o activa pestañas y cambia la posición del menú.',
      'Racha Diaria (🔥): suma +1 día consecutivo con cada sesión de enfoque y desbloquea medallas.',
      'Botón "? Ayuda": vuelve a abrir la guía o este tutorial interactivo cuando lo necesites.',
    ],
    recommendedTab: 'curso',
    actionButtonLabel: 'Probar Paso 5: Abrir Personalización de Interfaz',
  },
];

function loadPersistedOnboardingProgress(): OnboardingPersistedProgress {
  try {
    const raw = localStorage.getItem(ONBOARDING_PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validIdx =
        typeof parsed.currentStepIndex === 'number' &&
        parsed.currentStepIndex >= 0 &&
        parsed.currentStepIndex < ONBOARDING_STEPS.length
          ? parsed.currentStepIndex
          : 0;
      return {
        currentStepIndex: validIdx,
        completedStepIds: Array.isArray(parsed.completedStepIds) ? parsed.completedStepIds : [],
        isInteractivePreview: Boolean(parsed.isInteractivePreview),
        isAutoPlaying: false,
        lastUpdatedAt: parsed.lastUpdatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('[InteractiveOnboardingTour] Error reading persisted progress from localStorage:', err);
  }
  return {
    currentStepIndex: 0,
    completedStepIds: [],
    isInteractivePreview: false,
    isAutoPlaying: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function savePersistedOnboardingProgress(progress: OnboardingPersistedProgress): void {
  try {
    localStorage.setItem(ONBOARDING_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('[InteractiveOnboardingTour] Error saving progress to localStorage:', err);
  }
}

export const InteractiveOnboardingTour: React.FC<InteractiveOnboardingTourProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onOpenProgramManager,
  onOpenPreferences,
  onOpenFirstSubject,
}) => {
  const initialProgress = loadPersistedOnboardingProgress();

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialProgress.currentStepIndex);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>(initialProgress.completedStepIds);
  const [isInteractivePreview, setIsInteractivePreview] = useState<boolean>(
    initialProgress.isInteractivePreview
  );
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [isContainerReady, setIsContainerReady] = useState<boolean>(false);

  // Refs to avoid stale closures and prevent locked step triggers
  const tourContainerRef = useRef<HTMLDivElement | null>(null);
  const stepTriggerLockRef = useRef<boolean>(false);
  const callbacksRef = useRef({
    onClose,
    onSelectTab,
    onOpenProgramManager,
    onOpenPreferences,
    onOpenFirstSubject,
  });

  useEffect(() => {
    callbacksRef.current = {
      onClose,
      onSelectTab,
      onOpenProgramManager,
      onOpenPreferences,
      onOpenFirstSubject,
    };
  }, [onClose, onSelectTab, onOpenProgramManager, onOpenPreferences, onOpenFirstSubject]);

  // Verify container readiness when isOpen changes
  useEffect(() => {
    if (!isOpen) {
      setIsAutoPlaying(false);
      stepTriggerLockRef.current = false;
      setIsContainerReady(false);
      return;
    }

    // Restore persisted progress when opened
    const persisted = loadPersistedOnboardingProgress();
    const safeStepIdx =
      persisted.currentStepIndex >= 0 && persisted.currentStepIndex < ONBOARDING_STEPS.length
        ? persisted.currentStepIndex
        : 0;
    setCurrentStepIndex(safeStepIdx);
    setCompletedStepIds(persisted.completedStepIds);

    const rafId = window.requestAnimationFrame(() => {
      const containerMounted = Boolean(tourContainerRef.current) || document.readyState === 'complete';
      setIsContainerReady(containerMounted);
      console.log('[InteractiveOnboardingTour] Container initialized & ready:', {
        isOpen,
        containerMounted,
        hasContainerRef: Boolean(tourContainerRef.current),
        restoredStepIndex: safeStepIdx,
        completedStepIds: persisted.completedStepIds,
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [isOpen]);

  // Persist progress to localStorage whenever step state changes
  useEffect(() => {
    if (!isOpen) return;
    const progressPayload: OnboardingPersistedProgress = {
      currentStepIndex,
      completedStepIds,
      isInteractivePreview,
      isAutoPlaying,
      lastUpdatedAt: new Date().toISOString(),
    };
    savePersistedOnboardingProgress(progressPayload);
  }, [isOpen, currentStepIndex, completedStepIds, isInteractivePreview, isAutoPlaying]);

  // Execute the navigation/side-effect for a given step index
  const executeStepSideEffect = useCallback((stepIdx: number, openModals = false) => {
    const targetStep = ONBOARDING_STEPS[stepIdx];
    if (!targetStep) return;

    const cbs = callbacksRef.current;

    if (targetStep.id === 'materias-pages') {
      if (cbs.onOpenFirstSubject) {
        cbs.onOpenFirstSubject();
      } else {
        cbs.onSelectTab('asignaturas');
      }
    } else if (targetStep.recommendedTab) {
      cbs.onSelectTab(targetStep.recommendedTab);
    }

    if (openModals) {
      if (targetStep.id === 'welcome-programs') {
        cbs.onOpenProgramManager();
      } else if (targetStep.id === 'customization-streak') {
        cbs.onOpenPreferences();
      }
    }
  }, []);

  // Safe step transition helper with lock recovery and localStorage persistence
  const transitionToStep = useCallback(
    (nextIdx: number, source: string, openModals = false) => {
      if (stepTriggerLockRef.current) {
        console.warn(
          `[InteractiveOnboardingTour] Step trigger lock detected during "${source}". Auto-unlocking to prevent blocked state.`
        );
        stepTriggerLockRef.current = false;
      }

      stepTriggerLockRef.current = true;
      const clampedIdx = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, nextIdx));
      const currentStepObj = ONBOARDING_STEPS[currentStepIndex];

      setCompletedStepIds((prev) => {
        const nextCompleted =
          currentStepObj && !prev.includes(currentStepObj.id)
            ? [...prev, currentStepObj.id]
            : prev;
        const payload: OnboardingPersistedProgress = {
          currentStepIndex: clampedIdx,
          completedStepIds: nextCompleted,
          isInteractivePreview,
          isAutoPlaying,
          lastUpdatedAt: new Date().toISOString(),
        };
        savePersistedOnboardingProgress(payload);
        return nextCompleted;
      });

      setCurrentStepIndex(clampedIdx);
      executeStepSideEffect(clampedIdx, openModals);

      window.setTimeout(() => {
        stepTriggerLockRef.current = false;
      }, 120);
    },
    [currentStepIndex, executeStepSideEffect, isAutoPlaying, isInteractivePreview]
  );

  // Robust Play button handler (both for Header Sequential Auto-Play and Primary Step Play button)
  const handlePlayButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, mode: 'auto_sequence' | 'step_action') => {
      e.preventDefault();
      e.stopPropagation();

      const containerEl = tourContainerRef.current;
      const domReady = Boolean(containerEl) && document.readyState !== 'loading';
      const currentStepObj = ONBOARDING_STEPS[currentStepIndex] || ONBOARDING_STEPS[0];

      // Detailed diagnostic console log as requested
      console.log('[InteractiveOnboardingTour] Play button onClick diagnostic:', {
        mode,
        isOpen,
        isContainerReady,
        hasContainerDOMNode: Boolean(containerEl),
        documentReadyState: document.readyState,
        isStepTriggerLocked: stepTriggerLockRef.current,
        currentStepIndex,
        currentStepId: currentStepObj.id,
        totalSteps: ONBOARDING_STEPS.length,
        isAutoPlaying,
        isInteractivePreview,
        completedStepIds,
        persistedStorage: loadPersistedOnboardingProgress(),
      });

      if (!isOpen) {
        console.warn('[InteractiveOnboardingTour] Play clicked while isOpen is false. Aborting.');
        return;
      }

      // Clear any stale lock so the step trigger is never blocked
      if (stepTriggerLockRef.current) {
        console.warn('[InteractiveOnboardingTour] Clearing stale stepTriggerLockRef before starting Play.');
        stepTriggerLockRef.current = false;
      }

      const runPlayLogic = () => {
        if (mode === 'auto_sequence') {
          setIsAutoPlaying((prevAuto) => {
            const nextAuto = !prevAuto;
            // If starting auto-play from the last step, restart sequentially from step 0
            const startIdx =
              nextAuto && currentStepIndex >= ONBOARDING_STEPS.length - 1 ? 0 : currentStepIndex;

            if (nextAuto) {
              setCurrentStepIndex(startIdx);
              executeStepSideEffect(startIdx, false);
            }

            const updatedProgress: OnboardingPersistedProgress = {
              currentStepIndex: startIdx,
              completedStepIds,
              isInteractivePreview,
              isAutoPlaying: nextAuto,
              lastUpdatedAt: new Date().toISOString(),
            };
            savePersistedOnboardingProgress(updatedProgress);

            console.log('[InteractiveOnboardingTour] Sequential Auto-Play toggled:', {
              isAutoPlaying: nextAuto,
              activeStepIndex: startIdx,
              activeStepId: ONBOARDING_STEPS[startIdx]?.id,
            });
            return nextAuto;
          });
          return;
        }

        // mode === 'step_action': Execute current step's live action and advance/unlock sequential flow
        setIsAutoPlaying(false);
        const stepId = currentStepObj.id;

        // Mark current step as completed
        const updatedCompleted = completedStepIds.includes(stepId)
          ? completedStepIds
          : [...completedStepIds, stepId];
        setCompletedStepIds(updatedCompleted);

        // Switch into live interactive preview so the dark overlay does not block the UI
        setIsInteractivePreview(true);
        executeStepSideEffect(currentStepIndex, true);

        const nextSequentialIndex =
          currentStepIndex < ONBOARDING_STEPS.length - 1 ? currentStepIndex + 1 : currentStepIndex;

        const updatedProgress: OnboardingPersistedProgress = {
          currentStepIndex,
          completedStepIds: updatedCompleted,
          isInteractivePreview: true,
          isAutoPlaying: false,
          lastUpdatedAt: new Date().toISOString(),
        };
        savePersistedOnboardingProgress(updatedProgress);

        console.log('[InteractiveOnboardingTour] Step Play action executed:', {
          executedStepIndex: currentStepIndex,
          executedStepId: stepId,
          nextSequentialIndex,
          isInteractivePreview: true,
          completedStepIds: updatedCompleted,
        });
      };

      if (!domReady) {
        console.warn(
          '[InteractiveOnboardingTour] Container not yet ready on click; scheduling execution on next animation frame.'
        );
        window.requestAnimationFrame(() => {
          setIsContainerReady(true);
          runPlayLogic();
        });
      } else {
        runPlayLogic();
      }
    },
    [
      completedStepIds,
      currentStepIndex,
      executeStepSideEffect,
      isAutoPlaying,
      isContainerReady,
      isInteractivePreview,
      isOpen,
    ]
  );

  // Sequential Auto-Play progression effect
  useEffect(() => {
    if (!isOpen || !isAutoPlaying) return;

    const timer = window.setTimeout(() => {
      setCurrentStepIndex((prevIdx) => {
        const currentStepObj = ONBOARDING_STEPS[prevIdx];
        if (prevIdx < ONBOARDING_STEPS.length - 1) {
          const nextIdx = prevIdx + 1;
          console.log('[InteractiveOnboardingTour] Auto-Play advancing sequentially:', {
            fromStep: prevIdx + 1,
            toStep: nextIdx + 1,
            stepId: ONBOARDING_STEPS[nextIdx]?.id,
          });
          setCompletedStepIds((prevComp) => {
            const nextComp =
              currentStepObj && !prevComp.includes(currentStepObj.id)
                ? [...prevComp, currentStepObj.id]
                : prevComp;
            savePersistedOnboardingProgress({
              currentStepIndex: nextIdx,
              completedStepIds: nextComp,
              isInteractivePreview,
              isAutoPlaying: true,
              lastUpdatedAt: new Date().toISOString(),
            });
            return nextComp;
          });
          executeStepSideEffect(nextIdx, false);
          return nextIdx;
        } else {
          console.log('[InteractiveOnboardingTour] Auto-Play reached final step. Stopping sequence.');
          setIsAutoPlaying(false);
          return prevIdx;
        }
      });
    }, 3800);

    return () => window.clearTimeout(timer);
  }, [isOpen, isAutoPlaying, isInteractivePreview, executeStepSideEffect]);

  const handleRestartFromStepOne = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    stepTriggerLockRef.current = false;
    setCurrentStepIndex(0);
    setCompletedStepIds([]);
    setIsInteractivePreview(false);
    setIsAutoPlaying(false);
    const resetPayload: OnboardingPersistedProgress = {
      currentStepIndex: 0,
      completedStepIds: [],
      isInteractivePreview: false,
      isAutoPlaying: false,
      lastUpdatedAt: new Date().toISOString(),
    };
    savePersistedOnboardingProgress(resetPayload);
    executeStepSideEffect(0, false);
    console.log('[InteractiveOnboardingTour] Progress reset to Step 1:', resetPayload);
  };

  const handleFinishTour = () => {
    setIsAutoPlaying(false);
    setIsInteractivePreview(false);
    stepTriggerLockRef.current = false;
    savePersistedOnboardingProgress({
      currentStepIndex: 0,
      completedStepIds: ONBOARDING_STEPS.map((s) => s.id),
      isInteractivePreview: false,
      isAutoPlaying: false,
      lastUpdatedAt: new Date().toISOString(),
    });
    onClose();
  };

  if (!isOpen) return null;

  const step = ONBOARDING_STEPS[currentStepIndex] || ONBOARDING_STEPS[0];
  const Icon = step.icon;

  // Compact interactive floating bar when user clicks the Play button to interact live with the screen
  if (isInteractivePreview) {
    return (
      <div
        ref={tourContainerRef}
        data-tour-container="interactive-preview"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[95vw] max-w-2xl pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        <div className="bg-slate-900/95 dark:bg-slate-900 text-white rounded-2xl p-3.5 sm:px-5 shadow-2xl border border-blue-500/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-r ${step.accentColor} flex items-center justify-center shrink-0 shadow-sm`}
            >
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Modo Interactivo · Paso {currentStepIndex + 1} de {ONBOARDING_STEPS.length}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-white truncate">{step.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setIsInteractivePreview(false)}
              className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-400/30 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Volver a ver la explicación detallada del paso"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Ver explicación</span>
            </button>

            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={() => transitionToStep(currentStepIndex - 1, 'preview-prev', false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                title="Paso anterior"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStepIndex < ONBOARDING_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  transitionToStep(currentStepIndex + 1, 'preview-next', false);
                  setIsInteractivePreview(false);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <span>Siguiente paso</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishTour}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Finalizar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cerrar tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={tourContainerRef}
      data-tour-container="modal-overlay"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      {/* Visual Spotlight Indicator Banner at Top of Screen */}
      <div
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[75] flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/95 text-white border border-blue-400/50 shadow-xl text-xs font-semibold max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0" />
        <Compass className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="hidden sm:inline shrink-0">Enfoque actual:</span>
        <span className="font-bold text-blue-200 truncate">{step.highlightTargetLabel}</span>
      </div>

      {/* Focused Modal Card */}
      <div
        className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Header */}
        <div
          className={`p-6 text-white bg-gradient-to-r ${step.accentColor} relative overflow-hidden`}
        >
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-xs">
                  <Sparkles className="w-3 h-3" />
                  <span>{step.badge}</span>
                </span>

                <button
                  type="button"
                  onClick={(e) => handlePlayButtonClick(e, 'auto_sequence')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    isAutoPlaying
                      ? 'bg-amber-400 text-slate-950 shadow-sm ring-2 ring-white/50'
                      : 'bg-black/25 hover:bg-black/40 text-white border border-white/25'
                  }`}
                  title={
                    isAutoPlaying
                      ? 'Pausar reproducción secuencial del tutorial'
                      : 'Iniciar reproducción secuencial automática de los pasos'
                  }
                >
                  {isAutoPlaying ? (
                    <>
                      <Pause className="w-3 h-3 fill-current" />
                      <span>Pausar guía ({currentStepIndex + 1}/{ONBOARDING_STEPS.length})</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play · Recorrido secuencial</span>
                    </>
                  )}
                </button>

                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handleRestartFromStepOne}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                    title="Reiniciar tutorial desde el Paso 1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Paso 1</span>
                  </button>
                )}
              </div>

              <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
                {step.title}
              </h3>
              <p className="text-xs sm:text-sm text-white/90 font-medium">{step.subtitle}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-black/15 hover:bg-black/30 text-white/90 hover:text-white transition-colors cursor-pointer"
                title="Saltar tutorial"
                aria-label="Cerrar tutorial"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step Progress Bar */}
          <div className="flex items-center gap-1.5 mt-5 relative z-10">
            {ONBOARDING_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => transitionToStep(idx, 'progress-bar-dot', false)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'flex-1 bg-white'
                    : idx < currentStepIndex || completedStepIds.includes(s.id)
                    ? 'w-8 bg-white/75'
                    : 'w-6 bg-white/30 hover:bg-white/50'
                }`}
                title={`Ir al paso ${idx + 1}: ${s.title}`}
              />
            ))}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {/* Highlighted UI Element Callout Box */}
          <div className="p-3 rounded-2xl bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider shrink-0">
                Ubicación
              </span>
              <span className="font-semibold text-blue-950 dark:text-blue-200 truncate">
                {step.highlightTargetLabel}
              </span>
            </div>
            <span className="text-[11px] font-mono-numbers text-blue-700 dark:text-blue-300 font-bold shrink-0 hidden sm:inline">
              {step.highlightPositionHint}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {step.description}
          </p>

          <div className="space-y-2 pt-1">
            {step.keyPoints.map((point, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{point}</span>
              </div>
            ))}
          </div>

          {/* Primary Play Action Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={(e) => handlePlayButtonClick(e, 'step_action')}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{step.actionButtonLabel}</span>
              <Eye className="w-3.5 h-3.5 ml-1 opacity-80" />
            </button>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            Saltar tutorial
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={() => transitionToStep(currentStepIndex - 1, 'footer-prev', false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            {currentStepIndex < ONBOARDING_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => transitionToStep(currentStepIndex + 1, 'footer-next', false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <span>Siguiente</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishTour}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>¡Empezar a estudiar!</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
