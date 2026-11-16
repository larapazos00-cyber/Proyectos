import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  BookOpen,
  Calendar,
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
  Mic,
  Award,
  TrendingUp,
  HelpCircle,
  Clock,
  Layers,
  ListOrdered,
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
  onOpenHelpGuide?: () => void;
}

interface OnboardingStep {
  id: string;
  shortLabel: string;
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
    id: 'welcome-programs-hours',
    shortLabel: '1. Estudios y Horas',
    badge: 'Paso 1 de 9 · Estudios, Temarios y Previsión de Horas',
    title: 'Tus Estudios y Previsión Real de Horas (Total · Llevas · 1 Sem · 1 Mes)',
    subtitle: 'Sube tus temarios y conoce exactamente cuántas horas necesitas en total y por periodo',
    highlightTargetLabel: 'Botón "+ Estudios", KPI "Horas Restantes" y "Meta de Estudio Diaria"',
    highlightPositionHint: 'Barra superior y Vista General',
    icon: Clock,
    accentColor: 'from-blue-600 to-indigo-600',
    description:
      'Desde "+ Estudios" creas tus carreras, másteres u oposiciones. A partir de los temas y PDFs subidos, StudyFlow calcula automáticamente cuántas horas totales vas a necesitar, cuántas horas llevas ya completadas, cuántas te faltan y cuántas horas están previstas en 1 semana y en 1 mes.',
    keyPoints: [
      'Previsión clara con tus temarios subidos: consulta el Total Necesario (h), las Horas que Llevas (%) y las Horas Restantes tanto en General como en Plan y Repasos.',
      'Proyección por horizonte temporal: visualiza al instante cuántas horas estudiarás en 1 semana (7 días) y en 1 mes (30 días), y en cuántas semanas completarás el 100% del temario.',
      'Gestor "+ Estudios": combina varios cursos a la vez (Mix Académico) y genera Objetivos SMART con IA.',
    ],
    recommendedTab: 'curso',
    actionButtonLabel: 'Probar en Vivo: Ver Estudios y Previsión de Horas',
  },
  {
    id: 'interface-design-models',
    shortLabel: '2. Modelos Interfaz',
    badge: 'Paso 2 de 9 · 3 Modelos de Diseño de Interfaz',
    title: 'Elige tu Diseño: Completo, Intermedio o Minimalista',
    subtitle: 'Cambia de estilo en 1 clic conservando intactos todos tus documentos y materias',
    highlightTargetLabel: 'Selector "Completo | Intermedio | Minimalista" en el menú o en Ajustes (⚙️)',
    highlightPositionHint: 'Barra de navegación (sin deslizar) y Ajustes',
    icon: Layers,
    accentColor: 'from-indigo-600 to-violet-600',
    description:
      'Puedes adaptar toda la interfaz en cualquier momento según cómo prefieras estudiar hoy, sin que afecte jamás a los PDFs, apuntes, temas o cursos que hayas subido. Además, el menú muestra todas sus opciones directamente sin necesidad de deslizarlo.',
    keyPoints: [
      'Modelo Completo: muestra todas las pestañas, analíticas avanzadas, logros, Feynman, hábitos y herramientas.',
      'Modelo Intermedio: interfaz equilibrada con las herramientas principales de estudio, calendario y seguimiento.',
      'Modelo Minimalista: vista limpia y sin distracciones centrada en lo esencial (Repaso Espaciado del día, acceso directo a tus documentos/PDFs y Pomodoro).',
    ],
    recommendedTab: 'curso',
    actionButtonLabel: 'Probar en Vivo: Abrir Ajustes de Diseño de Interfaz',
  },
  {
    id: 'priority-grade-weight',
    shortLabel: '3. Prioridad (% Nota)',
    badge: 'Paso 3 de 9 · Orden de Prioridad por % de Nota Final y Manual',
    title: 'Prioridad de Agendado según % de Nota Final (Exámenes, Proyectos y Tareas)',
    subtitle: 'Agenda primero lo que más vale en tu nota final o modifica el orden manualmente',
    highlightTargetLabel: 'Pestaña "Plan y Repasos" → Botón y Panel "Prioridad (% Nota)"',
    highlightPositionHint: 'Plan y Repasos y dentro de cada Materia',
    icon: ListOrdered,
    accentColor: 'from-amber-500 to-orange-600',
    description:
      'Al agendar los temas de cada asignatura al calendario, StudyFlow establece un orden de prioridad inteligente tomando la importancia de tus Proyectos, Tareas y Exámenes en base al porcentaje de la nota final, permitiéndote también modificarlo o fijarlo manualmente.',
    keyPoints: [
      'Cálculo Automático por % Nota Final: suma el peso evaluable (% Exámenes + % Proyectos + % Tareas) y la cercanía de entrega para clasificar cada tema y asignatura en prioridad Crítica, Alta, Media o Baja.',
      'Control Manual Total: cambia cualquier tema o materia entre Automático (% nota), Crítica, Alta, Media o Baja, ajusta manualmente su % de impacto o reordena su posición con las flechas ↑ y ↓.',
      'Botón "Agendar según Prioridad": recalcula todo tu calendario en 1 clic asignando tus mejores horas libres a los temas más importantes.',
    ],
    recommendedTab: 'calendario',
    actionButtonLabel: 'Probar en Vivo: Ver Orden de Prioridad (% Nota)',
  },
  {
    id: 'plan-smart-goals-hours',
    shortLabel: '4. Plan, SMART y Horas',
    badge: 'Paso 4 de 9 · Plan y Repasos, Objetivos SMART y Horas Libres',
    title: 'Objetivos SMART Desplegables, Horas del Calendario y Vueltas al Temario',
    subtitle: 'Contrasta tus horas libres con las horas totales de tus temarios y exporta a .ics',
    highlightTargetLabel: 'Pestaña "Plan y Repasos" → "Objetivos SMART" y "Meta Diaria & Libres"',
    highlightPositionHint: 'Pestaña Plan y Repasos',
    icon: Calendar,
    accentColor: 'from-cyan-600 to-blue-600',
    description:
      'En "Plan y Repasos" cuentas con la sección desplegable de Objetivos SMART con IA, el control de 1ª, 2ª y 3ª Vuelta al temario y el panel de Meta Diaria y Horas Libres del Calendario con el desglose completo de horas de tus temarios subidos.',
    keyPoints: [
      'Objetivos SMART Desplegables (🎯): genera metas específicas y medibles o aplica directamente la meta diaria recomendada por la IA a tu calendario.',
      'Previsión de Horas en Calendario: visualiza claramente el Total Previsto para tus temarios subidos, las Horas que Llevas, las Horas Restantes y lo previsto en 1 Semana y 1 Mes.',
      'Sincronización .ICS y Drag & Drop: arrastra sesiones o repasos a cualquier hora y exporta tu agenda a Google Calendar o Apple Calendar.',
    ],
    recommendedTab: 'calendario',
    actionButtonLabel: 'Probar en Vivo: Abrir Plan, Objetivos SMART y Horas',
  },
  {
    id: 'materias-notes-math-code',
    shortLabel: '5. Materias, LaTeX y Código',
    badge: 'Paso 5 de 9 · Materias, Fórmulas Matemáticas y Código',
    title: 'Apuntes con Fórmulas Matemáticas, Bloques de Código y Revisión Rápida',
    subtitle: 'Escribe ecuaciones científicas, programa código ejecutable y repasa con Cornell',
    highlightTargetLabel: 'Pestaña "Materias" → "Apuntes Libres / Documentos" y "⚡ Revisión Rápida"',
    highlightPositionHint: 'Pestaña Materias',
    icon: BookOpen,
    accentColor: 'from-emerald-600 to-teal-600',
    description:
      'Dentro de cada asignatura dispones de un espacio de trabajo completo para tus PDFs, Apuntes Cornell y Apuntes Libres con soporte nativo para insertar fórmulas matemáticas y bloques de código de programación, además de poder elegir la prioridad de agendado de cada tema.',
    keyPoints: [
      'Fórmulas Matemáticas (Σ Fórmula): inserta ecuaciones con paleta rápida de símbolos (fracciones, raíces, integrales, sumatorios, matrices) y previsualización en vivo.',
      'Bloques de Código (</> Código): escribe código en Python, JavaScript, TypeScript, C++, Java, SQL o HTML, cópialo en 1 clic y ejecuta JS/TS directamente en tus apuntes.',
      'Botón "⚡ Revisión Rápida": abre un resumen instantáneo con las ideas clave y preguntas Cornell antes de tu examen.',
    ],
    recommendedTab: 'asignaturas',
    actionButtonLabel: 'Probar en Vivo: Abrir Materia y Apuntes Enriquecidos',
  },
  {
    id: 'feynman-voice-ai',
    shortLabel: '6. Feynman por Voz + IA',
    badge: 'Paso 6 de 9 · Reto Feynman con Voz (Speech-to-Text) e IA',
    title: 'Explica en Voz Alta (Speech-to-Text) y Detecta Conceptos Mal Entendidos',
    subtitle: 'Dicta tu explicación oralmente y deja que Gemini diagnostique errores y cree Flashcards',
    highlightTargetLabel: 'Pestaña "Materias" → "Técnica Feynman" → Botón "Explicar por Voz (Dictado)"',
    highlightPositionHint: 'Dentro de cualquier Materia o Vista Feynman',
    icon: Mic,
    accentColor: 'from-purple-600 to-indigo-600',
    description:
      'El Reto Feynman integra reconocimiento de voz (Web Speech-to-Text) en español para transcribir en tiempo real tus explicaciones orales y analizarlas con Gemini frente al temario oficial.',
    keyPoints: [
      'Dictado Oral en Vivo (🎙️): habla con naturalidad para explicar el tema como si enseñaras a otra persona; tu voz se convierte en texto automáticamente.',
      'Diagnóstico IA de Conceptos Mal Entendidos (⚠️): Gemini identifica confusiones conceptuales exactas, cita qué dijiste, explica el error y te da la corrección clara.',
      'Conversión Automática a Flashcards: transforma tus sesiones explicativas y correcciones en tarjetas de memoria activa.',
    ],
    recommendedTab: 'asignaturas',
    actionButtonLabel: 'Probar en Vivo: Ver Reto Feynman por Voz e IA',
  },
  {
    id: 'achievements-mood-habits',
    shortLabel: '7. Logros y 12 Emociones',
    badge: 'Paso 7 de 9 · Logros Desplegables, Hábitos y 12 Emociones',
    title: 'Logros Desplegables (🏆), Hábitos y Mood Tracker Ampliado',
    subtitle: 'Premia tu constancia con medallas automáticas y registra hasta 12 estados de ánimo',
    highlightTargetLabel: 'Desplegable "🏆 Logros", "😊 Ánimo" y barra de Hábitos Diarios',
    highlightPositionHint: 'Vista General y Menú Principal',
    icon: Award,
    accentColor: 'from-yellow-500 to-amber-600',
    description:
      'Mantén la motivación alta con el panel desplegable de Logros y Medallas calculado en tiempo real sobre tu historial de Pomodoros, temas dominados y cuestionarios, junto con el Mood Tracker de 12 emociones.',
    keyPoints: [
      'Logros Desplegables (🏆): desbloquea insignias como "Racha de 7 días", "100 temas estudiados", "Sesión Feynman perfecta" o "Maestro del Test" sin ocupar espacio fijo.',
      'Mood Tracker con 12 Estados de Ánimo: registra cómo te sientes (Motivado, En Flow, Concentrado, Positivo, Tranquilo, Curioso, Neutral, Cansado, Distraído, Ansioso, Frustrado o Saturado).',
      'Control de Hábitos Diarios: gestiona tus rutinas y búscales hueco libre en tu calendario en 1 clic.',
    ],
    recommendedTab: 'curso',
    actionButtonLabel: 'Probar en Vivo: Explorar Logros, Ánimo y Hábitos',
  },
  {
    id: 'quizzes-pomodoro',
    shortLabel: '8. Tests IA y Pomodoro',
    badge: 'Paso 8 de 9 · Cuestionarios IA y Pomodoro con Metas',
    title: 'Simulacros con IA, Flashcards Quickfire y Pomodoro con Metas de Temas',
    subtitle: 'Evalúa tu dominio real y marca temas como estudiados automáticamente al terminar el reloj',
    highlightTargetLabel: 'Pestañas "Cuestionarios" y "Pomodoro"',
    highlightPositionHint: 'Menú Principal',
    icon: Sparkles,
    accentColor: 'from-fuchsia-600 to-purple-600',
    description:
      'Combina la práctica de recuperación activa en Cuestionarios con sesiones cronometradas en Pomodoro que actualizan el estado de tus temas, las horas que llevas estudiadas y tu racha diaria automáticamente.',
    keyPoints: [
      'Cuestionarios IA y Flashcards: genera tests de 4 opciones o preguntas de desarrollo sobre tus temas y repasa tarjetas con algoritmo SM-2.',
      'Metas de Temas en Pomodoro: selecciona qué tema(s) vas a estudiar antes de iniciar el temporizador para que se marquen como estudiados al finalizar.',
      'Avisos de Fin de Sesión: activa notificaciones visuales y alarmas sonoras personalizables.',
    ],
    recommendedTab: 'pomodoro',
    actionButtonLabel: 'Probar en Vivo: Ver Pomodoro y Metas de Temas',
  },
  {
    id: 'stats-retention-curve',
    shortLabel: '9. Curva Retención y Ayuda',
    badge: 'Paso 9 de 9 · Estadísticas, Curva de Retención y Botón Ayuda',
    title: 'Curva de Retención Estimada (Ebbinghaus + Tests) y Acceso en ? Ayuda',
    subtitle: 'Visualiza cómo consolidan tu memoria los repasos R1–R5 y los cuestionarios',
    highlightTargetLabel: 'Pestaña "Estadísticas" → "Curva de Retención Estimada" y Botón "? Ayuda"',
    highlightPositionHint: 'Pestaña Estadísticas y Barra superior',
    icon: TrendingUp,
    accentColor: 'from-rose-600 to-indigo-600',
    description:
      'En Estadísticas puedes analizar la gráfica interactiva de tu Curva de Retención Estimada (de Hoy a +60 días), comparando tu memoria consolidada frente al olvido sin repasos y detectando qué temas necesitan refuerzo urgente.',
    keyPoints: [
      'Curva de Retención Estimada: combina tus notas en Cuestionarios con tus ciclos de Repetición Espaciada (R1 a R5) y permite filtrar por materia.',
      'Índice de Estabilidad de Memoria y Alertas: identifica de un vistazo los temas con retención crítica (<60%) para repasarlos a tiempo.',
      'Solo en el primer registro: este tutorial solo se abre automáticamente la primera vez que una persona se registra; después podrás acceder siempre a él y al manual desde el botón "? Ayuda".',
    ],
    recommendedTab: 'estadisticas',
    actionButtonLabel: 'Probar en Vivo: Ver Estadísticas y Curva de Retención',
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

export function savePersistedOnboardingProgress(progress: OnboardingPersistedProgress): void {
  try {
    localStorage.setItem(ONBOARDING_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.warn('[InteractiveOnboardingTour] Error saving progress to localStorage:', err);
  }
}

export function resetOnboardingProgressToStart(): void {
  savePersistedOnboardingProgress({
    currentStepIndex: 0,
    completedStepIds: [],
    isInteractivePreview: false,
    isAutoPlaying: false,
    lastUpdatedAt: new Date().toISOString(),
  });
}

export const InteractiveOnboardingTour: React.FC<InteractiveOnboardingTourProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onOpenProgramManager,
  onOpenPreferences,
  onOpenFirstSubject,
  onOpenHelpGuide,
}) => {
  const initialProgress = loadPersistedOnboardingProgress();

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialProgress.currentStepIndex);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>(initialProgress.completedStepIds);
  const [isInteractivePreview, setIsInteractivePreview] = useState<boolean>(
    initialProgress.isInteractivePreview
  );
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [isContainerReady, setIsContainerReady] = useState<boolean>(false);

  const tourContainerRef = useRef<HTMLDivElement | null>(null);
  const stepTriggerLockRef = useRef<boolean>(false);
  const callbacksRef = useRef({
    onClose,
    onSelectTab,
    onOpenProgramManager,
    onOpenPreferences,
    onOpenFirstSubject,
    onOpenHelpGuide,
  });

  useEffect(() => {
    callbacksRef.current = {
      onClose,
      onSelectTab,
      onOpenProgramManager,
      onOpenPreferences,
      onOpenFirstSubject,
      onOpenHelpGuide,
    };
  }, [onClose, onSelectTab, onOpenProgramManager, onOpenPreferences, onOpenFirstSubject, onOpenHelpGuide]);

  // Verify container readiness when isOpen changes
  useEffect(() => {
    if (!isOpen) {
      setIsAutoPlaying(false);
      stepTriggerLockRef.current = false;
      setIsContainerReady(false);
      return;
    }

    // Immediately record that the onboarding tutorial has been shown so it never auto-opens again
    try {
      localStorage.setItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
    } catch {
      // ignore storage quota errors
    }

    const persisted = loadPersistedOnboardingProgress();
    const safeStepIdx =
      persisted.currentStepIndex >= 0 && persisted.currentStepIndex < ONBOARDING_STEPS.length
        ? persisted.currentStepIndex
        : 0;
    setCurrentStepIndex(safeStepIdx);
    setCompletedStepIds(persisted.completedStepIds);
    setIsInteractivePreview(false);

    const rafId = window.requestAnimationFrame(() => {
      const containerMounted = Boolean(tourContainerRef.current) || document.readyState === 'complete';
      setIsContainerReady(containerMounted);
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

    if (
      targetStep.id === 'materias-notes-math-code' ||
      targetStep.id === 'feynman-voice-ai'
    ) {
      if (cbs.onOpenFirstSubject) {
        cbs.onOpenFirstSubject();
      } else {
        cbs.onSelectTab('asignaturas');
      }
    } else if (targetStep.recommendedTab) {
      cbs.onSelectTab(targetStep.recommendedTab);
    }

    if (openModals) {
      if (targetStep.id === 'welcome-programs-hours') {
        cbs.onOpenProgramManager();
      } else if (targetStep.id === 'interface-design-models') {
        cbs.onOpenPreferences();
      }
    }
  }, []);

  // Safe step transition helper
  const transitionToStep = useCallback(
    (nextIdx: number, _source: string, openModals = false) => {
      if (stepTriggerLockRef.current) {
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

  // Keyboard navigation (Left / Right arrows & Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentStepIndex < ONBOARDING_STEPS.length - 1) {
        transitionToStep(currentStepIndex + 1, 'keyboard-next', false);
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        transitionToStep(currentStepIndex - 1, 'keyboard-prev', false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, transitionToStep, onClose]);

  const handlePlayButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, mode: 'auto_sequence' | 'step_action') => {
      e.preventDefault();
      e.stopPropagation();

      const containerEl = tourContainerRef.current;
      const domReady = Boolean(containerEl) && document.readyState !== 'loading';
      const currentStepObj = ONBOARDING_STEPS[currentStepIndex] || ONBOARDING_STEPS[0];

      if (!isOpen) return;

      if (stepTriggerLockRef.current) {
        stepTriggerLockRef.current = false;
      }

      const runPlayLogic = () => {
        if (mode === 'auto_sequence') {
          setIsAutoPlaying((prevAuto) => {
            const nextAuto = !prevAuto;
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
            return nextAuto;
          });
          return;
        }

        setIsAutoPlaying(false);
        const stepId = currentStepObj.id;

        const updatedCompleted = completedStepIds.includes(stepId)
          ? completedStepIds
          : [...completedStepIds, stepId];
        setCompletedStepIds(updatedCompleted);

        setIsInteractivePreview(true);
        executeStepSideEffect(currentStepIndex, true);

        const updatedProgress: OnboardingPersistedProgress = {
          currentStepIndex,
          completedStepIds: updatedCompleted,
          isInteractivePreview: true,
          isAutoPlaying: false,
          lastUpdatedAt: new Date().toISOString(),
        };
        savePersistedOnboardingProgress(updatedProgress);
      };

      if (!domReady && !isContainerReady) {
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
          setIsAutoPlaying(false);
          return prevIdx;
        }
      });
    }, 4200);

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
    resetOnboardingProgressToStart();
    executeStepSideEffect(0, false);
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
  const progressPct = Math.round(((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100);

  // Compact interactive floating bar when user clicks the Play button to interact live with the screen
  if (isInteractivePreview) {
    return (
      <div
        ref={tourContainerRef}
        data-tour-container="interactive-preview"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[95vw] max-w-3xl pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        <div className="bg-slate-900/95 dark:bg-slate-900 text-white rounded-2xl p-3.5 sm:px-5 shadow-2xl border border-blue-500/40 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-r ${step.accentColor} flex items-center justify-center shrink-0 shadow-sm`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Modo Interactivo en Vivo · Paso {currentStepIndex + 1} de {ONBOARDING_STEPS.length}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-emerald-300 font-semibold">
                  Puedes interactuar con la pantalla
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">{step.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsInteractivePreview(false)}
              className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-400/30 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Volver a abrir la tarjeta explicativa del paso"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Ver tarjeta</span>
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
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <span>Siguiente ({currentStepIndex + 2}/{ONBOARDING_STEPS.length})</span>
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
              title="Cerrar tutorial (disponible siempre en ? Ayuda)"
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
        className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Header */}
        <div
          className={`p-5 sm:p-6 text-white bg-gradient-to-r ${step.accentColor} relative overflow-hidden shrink-0`}
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
                      : 'Iniciar reproducción secuencial automática de los 9 pasos'
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
                      <span>Play · Recorrido automático</span>
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

              <h3 className="text-lg sm:text-xl font-black tracking-tight leading-snug">
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
                title="Cerrar tutorial (podrás volver a abrirlo siempre desde el botón ? Ayuda)"
                aria-label="Cerrar tutorial"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3.5 w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Clickable Step Selector Pills (No Horizontal Scroll Needed - Wraps Cleanly) */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 relative z-10">
            {ONBOARDING_STEPS.map((s, idx) => {
              const isCurrent = idx === currentStepIndex;
              const isDone = idx < currentStepIndex || completedStepIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => transitionToStep(idx, 'step-pill', false)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-white text-slate-900 shadow-xs scale-102'
                      : isDone
                      ? 'bg-white/25 text-white hover:bg-white/35'
                      : 'bg-black/20 text-white/80 hover:bg-black/30'
                  }`}
                  title={`Ir al ${s.badge}: ${s.title}`}
                >
                  {isDone && !isCurrent && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300 shrink-0" />}
                  <span>{s.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Highlighted UI Element Callout Box */}
          <div className="p-3 rounded-2xl bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider shrink-0">
                Dónde encontrarlo
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

          <div className="space-y-2 pt-0.5">
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

          {/* Primary Play Action Button + Switch to Help Manual */}
          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={(e) => handlePlayButtonClick(e, 'step_action')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{step.actionButtonLabel}</span>
              <Eye className="w-3.5 h-3.5 ml-1 opacity-80" />
            </button>

            {onOpenHelpGuide && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHelpGuide();
                }}
                className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Abrir el Manual y Tutorial Escrito con buscador"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Manual y Guía (? Ayuda)</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Saltar tutorial (disponible en ? Ayuda)
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
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
                <span>Siguiente ({currentStepIndex + 2}/{ONBOARDING_STEPS.length})</span>
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
