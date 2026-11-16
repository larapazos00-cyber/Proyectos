import React, { useState, useMemo } from 'react';
import {
  X,
  LayoutDashboard,
  BookOpen,
  Calendar,
  Sparkles,
  Timer,
  BarChart3,
  Flame,
  Brain,
  Zap,
  CheckCircle2,
  SlidersHorizontal,
  CloudCheck,
  Search,
  Plus,
  Play,
  Award,
  Clock,
  Layers,
  ArrowRight,
  Mic,
  TrendingUp,
  Code2,
  ListOrdered,
} from 'lucide-react';
import studyflowLogo from '../assets/images/studyflow_logo_1793994920234.jpg';
import { resetOnboardingProgressToStart } from './InteractiveOnboardingTour';

interface AppHelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tabId: string) => void;
  onOpenPreferences?: () => void;
  onOpenProgramManager?: () => void;
  onOpenStreakModal?: () => void;
  onStartOnboardingTour?: () => void;
}

interface GuideSection {
  id: string;
  category: 'tabs' | 'methods' | 'tools';
  title: string;
  badge: string;
  icon: React.ElementType;
  iconColor: string;
  summary: string;
  bullets: string[];
  tabId?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const AppHelpGuideModal: React.FC<AppHelpGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenPreferences,
  onOpenProgramManager,
  onOpenStreakModal,
  onStartOnboardingTour,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'tabs' | 'methods' | 'tools'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const GUIDE_SECTIONS: GuideSection[] = useMemo(
    () => [
      // 1. TABS
      {
        id: 'tab-general',
        category: 'tabs',
        tabId: 'curso',
        title: 'General · Centro de Mando, Horas Previstas y Logros',
        badge: 'Pestaña 1',
        icon: LayoutDashboard,
        iconColor: 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400',
        summary:
          'Visión panorámica de tu curso, previsión total de horas según tus temarios subidos (Total · Llevas · Restantes · 1 Semana · 1 Mes), desplegable de Logros (🏆), Hábitos y Mood Tracker.',
        bullets: [
          'KPI "Horas Restantes en el Plan" y "Meta de Estudio Diaria": muestra claramente cuántas horas totales prevé la aplicación según los temarios y documentos subidos, cuántas horas llevas estudiadas, cuántas te faltan y las horas previstas en 1 semana y en 1 mes.',
          'Desplegable de Logros y Medallas (🏆): premia automáticamente hitos como "Racha de 7 días", "100 temas estudiados" o "Sesión Feynman perfecta" basándose en tu historial real.',
          'Barra Compacta Desplegable de Hábitos y Mood Tracker (12 emociones): registra tus hábitos diarios y tu estado de ánimo sin ocupar espacio permanente.',
          'Botón "⚡ Revisión Rápida" en cada Materia: abre un resumen instantáneo con los puntos clave y conceptos esenciales de tus apuntes Cornell antes del examen.',
        ],
      },
      {
        id: 'tab-materias',
        category: 'tabs',
        tabId: 'asignaturas',
        title: 'Materias · Apuntes con Fórmulas/Código, Prioridad por Tema y Feynman por Voz',
        badge: 'Pestaña 2',
        icon: BookOpen,
        iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
        summary:
          'Gestión completa de cada asignatura: documentos y PDFs, Apuntes Libres con fórmulas matemáticas y código de programación, prioridad de agendado por tema y Reto Feynman por voz con IA.',
        bullets: [
          'Apuntes Libres con Fórmulas Matemáticas y Código: inserta bloques de ecuaciones científicas (Σ Fórmula con símbolos LaTeX rápidos) y bloques de código de programación (</> Código en Python, JS/TS ejecutable, C++, Java, SQL).',
          'Prioridad de Agendado en cada Tema: visualiza el % de impacto en la nota final de cada tema y cámbialo entre Automático (% nota), Crítica, Alta, Media o Baja.',
          'Reto Feynman con Speech-to-Text e IA Gemini: explica un tema en voz alta usando el micrófono; la app transcribe tu voz y Gemini detecta automáticamente conceptos mal entendidos y genera Flashcards.',
          'Temario Oficial y Vueltas Académicas: organiza cada tema por estado (Pendiente, En Progreso, Estudiado, Repasado), registra páginas leídas y controla 1ª, 2ª y 3ª vuelta.',
        ],
      },
      {
        id: 'tab-calendario',
        category: 'tabs',
        tabId: 'calendario',
        title: 'Plan y Repasos · Orden de Prioridad (% Nota), Objetivos SMART y Horas del Calendario',
        badge: 'Pestaña 3',
        icon: Calendar,
        iconColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
        summary:
          'Planificador dinámico con orden de prioridad basado en el % de la nota final (proyectos, tareas y exámenes) o manual, sección desplegable de Objetivos SMART, previsión de horas y exportación .ics.',
        bullets: [
          'Orden de Prioridad al Agendar (% Nota Final · Manual o Automático): prioriza temas y asignaturas según el porcentaje de la nota final de sus exámenes, proyectos y tareas, o modifícalo manualmente (Crítica, Alta, Media, Baja y flechas ↑/↓).',
          'Previsión de Horas con Temarios Subidos: tanto en la cabecera como en "Meta Diaria y Horas Libres del Calendario" ves el Total Necesario (h), las Horas que Llevas (%), las Horas Restantes y las horas previstas en 1 semana (7d) y en 1 mes (30d).',
          'Objetivos SMART Desplegables (🎯): despliega en 1 clic tus metas Específicas, Medibles, Alcanzables, Relevantes y con Tiempo definido generadas con IA o personalizadas.',
          'Sincronización .ICS y Drag & Drop: arrastra sesiones o repasos y exporta tus bloques de estudio, hábitos y exámenes a Google Calendar o Apple Calendar.',
        ],
      },
      {
        id: 'tab-cuestionarios',
        category: 'tabs',
        tabId: 'cuestionarios',
        title: 'Cuestionarios · Laboratorio de Simulacros IA y Active Recall',
        badge: 'Pestaña 4',
        icon: Sparkles,
        iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400',
        summary:
          'Genera exámenes tipo test y preguntas de desarrollo con IA a partir de tus temas o apuntes, y repasa tus sets de Flashcards SM-2.',
        bullets: [
          'Generación con IA Universitaria: formula preguntas tipo test de 4 opciones, preguntas abiertas o casos prácticos con rúbricas de corrección precisas.',
          'Evita el Olvido con Active Recall: detecta qué temas necesitan repaso urgente según la curva de retención y lanza un test o flashcards al instante.',
          'Modo Flashcards Quickfire y SM-2: repasa todas las tarjetas de tus materias, incluyendo los sets generados automáticamente en el Reto Feynman.',
        ],
      },
      {
        id: 'tab-pomodoro',
        category: 'tabs',
        tabId: 'pomodoro',
        title: 'Pomodoro · Metas de Temas, Avisos y Motor de Racha',
        badge: 'Pestaña 5',
        icon: Timer,
        iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400',
        summary:
          'Cronómetro de enfoque con configuración de Metas de Temas automáticas, avisos visuales/sonoros de fin de sesión y registro directo de horas.',
        bullets: [
          'Metas de Temas antes de Iniciar: selecciona uno o varios temas objetivo para que se marquen automáticamente como "Estudiados" al completar el tiempo asignado.',
          'Suma de Horas Reales: cada minuto completado actualiza automáticamente las "Horas que Llevas" en tu Plan y en tu Meta Diaria.',
          'Botón "Avisos fin de sesión": configura alertas visuales del navegador y alarmas sonoras personalizables.',
        ],
      },
      {
        id: 'tab-estadisticas',
        category: 'tabs',
        tabId: 'estadisticas',
        title: 'Estadísticas · Curva de Retención Estimada, Progreso y Logros',
        badge: 'Pestaña 6',
        icon: BarChart3,
        iconColor: 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400',
        summary:
          'Visualización interactiva de la Curva de Retención Estimada (cuestionarios + repetición espaciada), progreso diario por materia y vitrina desplegable de logros.',
        bullets: [
          'Curva de Retención Estimada (Recharts): proyecta tu memoria consolidada desde Hoy hasta +60 días basándose en tus resultados de cuestionarios y ciclos R1–R5 (1, 3, 7, 15, 30 y 60 días), comparándola frente al olvido natural de Ebbinghaus.',
          'Filtro por Materia y Alertas de Refuerzo: detecta automáticamente qué temas tienen una retención estimada crítica (<60%) para repasarlos antes del examen.',
          'Vista "Progreso por Materia" y Mapa de Calor Anual: mide tu consistencia diaria y el cumplimiento de tus objetivos.',
        ],
      },

      // 2. METHODS
      {
        id: 'method-priority-grade',
        category: 'methods',
        tabId: 'calendario',
        title: 'Orden de Prioridad por % de la Nota Final (Exámenes, Proyectos y Tareas) y Manual',
        badge: 'Priorización Inteligente',
        icon: ListOrdered,
        iconColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300',
        summary:
          'Agendado inteligente de temas al calendario tomando el porcentaje sobre la nota final de proyectos, tareas y exámenes, con opción de modificarlo o fijarlo manualmente.',
        bullets: [
          'Ponderación Automática (% Nota Final): suma el porcentaje de calificación de exámenes, proyectos y tareas vinculadas a cada tema y materia para darle prioridad Crítica, Alta, Media o Baja.',
          'Edición Manual y Reordenación: cambia cualquier tema o asignatura a prioridad manual, edita su % de impacto en la nota o sube/baja su orden con los botones ↑ y ↓.',
          'Recálculo Instantáneo: pulsa "Agendar según Prioridad" en Plan y Repasos para redistribuir las sesiones en tus horas libres respetando tus prioridades.',
        ],
      },
      {
        id: 'method-feynman-voice',
        category: 'methods',
        tabId: 'asignaturas',
        title: 'Método Feynman por Voz (Speech-to-Text) y Diagnóstico IA',
        badge: 'Metodología + Voz IA',
        icon: Mic,
        iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400',
        summary:
          'Explica un tema oralmente o por escrito con tus propias palabras; la app transcribe tu voz en vivo y Gemini identifica automáticamente conceptos mal entendidos.',
        bullets: [
          'Dictado por Voz en Español (🎙️ Speech-to-Text): pulsa "Explicar por Voz (Dictado)" para hablar al micrófono y convertir tu explicación oral en texto automáticamente.',
          'Detección Automática de Conceptos Mal Entendidos (⚠️): Gemini contrasta tu explicación con el temario y te muestra cada confusión detectada, lo que dijiste y la explicación correcta.',
          'Conversión Automática en Set de Flashcards y Analíticas de Dominio Conceptual.',
        ],
      },
      {
        id: 'method-retention-curve',
        category: 'methods',
        tabId: 'estadisticas',
        title: 'Curva de Retención Estimada (Ebbinghaus + Cuestionarios)',
        badge: 'Metodología + Datos',
        icon: TrendingUp,
        iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
        summary:
          'Combina el método de repetición espaciada (1, 3, 7, 15, 30 días) con el rendimiento real en tus cuestionarios para estimar qué porcentaje del temario recuerdas.',
        bullets: [
          'Cada repaso completado (R1 a R5) y cada test superado eleva el índice de estabilidad de tu memoria y aplana la curva del olvido.',
          'Disponible en la pestaña "Estadísticas" con selector por asignatura y desglose tema por tema.',
        ],
      },
      {
        id: 'method-quick-review',
        category: 'methods',
        tabId: 'curso',
        title: 'Revisión Rápida Pre-Examen (⚡ Apuntes Cornell)',
        badge: 'Metodología',
        icon: Zap,
        iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400',
        summary:
          'Repaso ultrarrápido de última hora con los puntos clave, conceptos esenciales y preguntas de autoevaluación extraídos de los apuntes Cornell de cada materia.',
        bullets: [
          'Pulsa el botón "⚡ Revisión Rápida" en la tarjeta de cualquier materia (en General o en Materias).',
          'Oculta o muestra respuestas para practicar Active Recall y salta en 1 clic a un test o Pomodoro del tema.',
        ],
      },

      // 3. TOOLS & FEATURES
      {
        id: 'tool-interface-models',
        category: 'tools',
        title: '3 Modelos de Diseño de Interfaz (Completo, Intermedio y Minimalista)',
        badge: 'Personalización',
        icon: Layers,
        iconColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300',
        summary:
          'Escoge en Ajustes o directamente en el menú de navegación cómo quieres ver la aplicación sin que afecte a tus documentos, PDFs ni materias subidas.',
        bullets: [
          'Modelo Completo: interfaz integral con todas las pestañas, analíticas avanzadas, logros, Feynman, hábitos y herramientas.',
          'Modelo Intermedio: diseño equilibrado con las secciones esenciales de estudio, planificación y cuestionarios.',
          'Modelo Minimalista: interfaz simplificada y libre de distracciones centrada en el Repaso Espaciado del día, el acceso directo a tus documentos subidos y Pomodoro.',
          'Menú sin deslizamiento horizontal: todos los botones del menú se adaptan limpiamente a tu pantalla sin necesidad de deslizar lateralmente.',
        ],
        actionLabel: 'Elegir Modelo de Interfaz',
        onAction: onOpenPreferences,
      },
      {
        id: 'tool-hours-forecast',
        category: 'tools',
        tabId: 'calendario',
        title: 'Previsión de Horas del Temario (Total · Llevas · 1 Semana · 1 Mes)',
        badge: 'Planificación',
        icon: Clock,
        iconColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
        summary:
          'Conoce con total claridad cuántas horas prevé la aplicación que necesitarás para estudiar todos los temarios subidos, cuántas horas llevas y cuántas están previstas por periodo.',
        bullets: [
          'Visible en "General" (Horas Restantes en el Plan y Meta de Estudio Diaria) y en "Plan y Repasos" (Cabecera y Meta Diaria y Horas Libres del Calendario).',
          'Muestra simultáneamente: 1) Total de horas necesarias según tus temas/páginas subidas, 2) Horas que llevas completadas (%) y Horas restantes, 3) Horas previstas en 1 semana (7 días) y 4) Horas previstas en 1 mes (30 días) con estimación de semanas para acabar el 100%.',
        ],
      },
      {
        id: 'tool-math-code-notes',
        category: 'tools',
        tabId: 'asignaturas',
        title: 'Fórmulas Matemáticas y Código de Programación en Apuntes Libres',
        badge: 'Cuaderno Científico',
        icon: Code2,
        iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
        summary:
          'Escribe ecuaciones matemáticas y fragmentos de código directamente dentro de tus Apuntes Libres en cualquier materia o documento.',
        bullets: [
          'Botón "Σ Fórmula": inserta bloques matemáticos con barra de símbolos rápidos (fracciones, raíces, integrales, sumatorios, límites, letras griegas) y previsualización formateada.',
          'Botón "</> Código": inserta bloques de código con selector de lenguaje (Python, JavaScript, TypeScript, Java, C++, SQL, HTML/CSS), numeración de líneas y botón "▶ Ejecutar" para probar JS/TS en vivo.',
        ],
      },
      {
        id: 'tool-achievements-badges',
        category: 'tools',
        tabId: 'curso',
        title: 'Desplegable de Logros y Medallas Académicas (🏆)',
        badge: 'Gamificación',
        icon: Award,
        iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400',
        summary:
          'Sistema de insignias desplegable que premia automáticamente tu esfuerzo diario calculando tus hitos sobre sesiones Pomodoro, temas y cuestionarios.',
        bullets: [
          'Incluye medallas por Racha de 7 y 30 días, 25 y 100 temas estudiados, Sesión Feynman perfecta (≥90%), Maestro del Test y Maratón Pomodoro.',
          'Formato 100% desplegable en General, Estadísticas y barra lateral para mantener tu espacio de estudio despejado.',
        ],
      },
      {
        id: 'tool-smart-goals',
        category: 'tools',
        tabId: 'calendario',
        title: 'Objetivos SMART Desplegables en Plan y Repasos (IA)',
        badge: 'IA + Planificación',
        icon: Sparkles,
        iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400',
        summary:
          'Sección desplegable dentro de "Plan y Repasos" (y en "+ Estudios") que genera y verifica objetivos Específicas, Medibles, Alcanzables, Relevantes y con Tiempo.',
        bullets: [
          'Pulsa el botón "Objetivos SMART" en Plan y Repasos para desplegar tus hitos semanales o generar nuevas metas con Gemini según tus exámenes y horas libres.',
          'Aplica en 1 clic la meta diaria recomendada por un objetivo SMART directamente a tu calendario.',
        ],
      },
      {
        id: 'tool-habits-mood',
        category: 'tools',
        tabId: 'calendario',
        title: 'Mood Tracker (12 Emociones) y Control de Hábitos Diarios',
        badge: 'Bienestar',
        icon: CheckCircle2,
        iconColor: 'bg-teal-100 text-teal-600 dark:bg-teal-950/80 dark:text-teal-400',
        summary:
          'Registra tu estado emocional entre 12 estados de ánimo académicos y organiza tus hábitos diarios con buscador automático de huecos libres.',
        bullets: [
          '12 Estados de Ánimo: Motivado, En Flow, Concentrado, Positivo, Tranquilo, Curioso, Neutral, Cansado, Distraído, Ansioso, Frustrado y Saturado, con calendario anual y consejos personalizados.',
          'HabitsTracker: añade tus rutinas diarias y ubícalas en tu agenda pulsando "🕒 Escoger hora" o "🔍 Buscar hueco".',
        ],
      },
      {
        id: 'tool-racha',
        category: 'tools',
        title: 'Racha de Estudio Diaria (🔥)',
        badge: 'Función Clave',
        icon: Flame,
        iconColor: 'bg-orange-100 text-orange-600 dark:bg-orange-950/80 dark:text-orange-400',
        summary:
          'Mide tu disciplina diaria: completa al menos 1 bloque Pomodoro o 1 sesión de estudio al día para sumar +1 día a tu racha consecutiva.',
        bullets: [
          'Haz clic en el icono de fuego de la barra superior o del menú lateral para ver tu racha y tus próximas medallas.',
        ],
        actionLabel: 'Ver Racha',
        onAction: onOpenStreakModal,
      },
      {
        id: 'tool-programas',
        category: 'tools',
        title: 'Gestor de Estudios y Cursos (+ Estudios)',
        badge: 'Herramienta',
        icon: Plus,
        iconColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
        summary:
          'Permite tener varios grados, másteres, oposiciones o cursos activos al mismo tiempo y combinarlos en un Mix Académico.',
        bullets: [
          'El botón "+ Estudios" está siempre visible tanto en menú superior como lateral.',
          'Incluye copia de seguridad en archivo JSON para exportar o restaurar tus cursos.',
        ],
        actionLabel: 'Abrir Estudios',
        onAction: onOpenProgramManager,
      },
      {
        id: 'tool-cloud-sync',
        category: 'tools',
        title: 'Tutorial de Primer Registro y Acceso Permanente en ? Ayuda',
        badge: 'Cuenta y Ayuda',
        icon: CloudCheck,
        iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
        summary:
          'El tutorial interactivo solo aparece automáticamente la primera vez que una persona se registra. Después siempre puedes acceder a él desde el botón de Ayuda (? Ayuda).',
        bullets: [
          'Al crear tu cuenta por primera vez se lanza el recorrido interactivo de bienvenida y queda registrado en tu perfil para no volver a abrirse sola en futuros inicios de sesión.',
          'Siempre que quieras volver a ver el Tutorial Interactivo o consultar esta Guía, pulsa el botón "? Ayuda" en la barra de navegación.',
        ],
      },
    ],
    [onOpenPreferences, onOpenProgramManager, onOpenStreakModal]
  );

  const filteredSections = useMemo(() => {
    return GUIDE_SECTIONS.filter((sec) => {
      const matchesCategory =
        activeCategory === 'all' || sec.category === activeCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        sec.title.toLowerCase().includes(q) ||
        sec.summary.toLowerCase().includes(q) ||
        sec.badge.toLowerCase().includes(q) ||
        sec.bullets.some((b) => b.toLowerCase().includes(q))
      );
    });
  }, [GUIDE_SECTIONS, activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-blue-50/50 via-slate-50 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3.5">
            <img
              src={studyflowLogo}
              alt="StudyFlow Logo"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-contain shadow-2xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Centro de Ayuda y Tutorial de StudyFlow
                </h3>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                  Guía y Tutorial Interactivo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manual completo de pestañas, prioridad por % de nota final, previsión de horas y modelos de interfaz
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onStartOnboardingTour && (
              <button
                type="button"
                onClick={() => {
                  resetOnboardingProgressToStart();
                  onClose();
                  onStartOnboardingTour();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Iniciar el Tutorial Interactivo paso a paso desde el principio"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Tutorial Interactivo (9 Pasos)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar guía"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Tutorial Quick-Launch Banner */}
        {onStartOnboardingTour && (
          <div className="px-4 sm:px-6 py-3 bg-gradient-to-r from-indigo-50/90 via-blue-50/80 to-emerald-50/70 dark:from-indigo-950/40 dark:via-slate-900 dark:to-emerald-950/30 border-b border-indigo-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                  Recorrido Guiado en Vivo (9 Pasos)
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  ¿Quieres recorrer la aplicación paso a paso de forma interactiva?
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                El tutorial interactivo solo aparece automáticamente la primera vez que una persona se registra. Después siempre puedes iniciarlo desde aquí a través del botón de Ayuda.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  resetOnboardingProgressToStart();
                  onClose();
                  onStartOnboardingTour();
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Empezar desde el Paso 1</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartOnboardingTour();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Continuar en el último paso visitado"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Filter bar: Search + Category Pills */}
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el tutorial (ej: prioridad, nota final, horas, minimalista, feynman, fórmulas, código, curva, smart...)"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Todo ({GUIDE_SECTIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('tabs')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeCategory === 'tabs'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Pestañas (6)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('methods')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeCategory === 'methods'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Metodologías y Prioridad</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('tools')}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeCategory === 'tools'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Herramientas y Diseño</span>
              </button>
            </div>

            {onOpenPreferences && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPreferences();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-700 hover:text-blue-700 dark:text-slate-200 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Ajustes y Modelos de Interfaz</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredSections.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No se han encontrado resultados para «{searchQuery}». Prueba con términos como «prioridad», «horas», «minimalista», «feynman», «fórmulas» o «curva».
            </div>
          ) : (
            filteredSections.map((sec) => {
              const Icon = sec.icon;
              const hasAction = Boolean((sec.tabId && onNavigateTab) || sec.onAction);
              const handleCardAction = () => {
                if (sec.onAction) {
                  onClose();
                  sec.onAction();
                } else if (sec.tabId && onNavigateTab) {
                  onClose();
                  onNavigateTab(sec.tabId);
                }
              };

              return (
                <div
                  key={sec.id}
                  onClick={hasAction ? handleCardAction : undefined}
                  className={`p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3 transition-all hover:border-blue-300 dark:hover:border-blue-700 ${
                    hasAction ? 'cursor-pointer hover:shadow-md' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${sec.iconColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {sec.badge}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {sec.title}
                        </h4>
                      </div>
                    </div>

                    {hasAction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardAction();
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50/90 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 border border-blue-200/80 dark:border-blue-800 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                        title={sec.actionLabel || 'Abrir sección'}
                      >
                        <span>{sec.actionLabel || 'Ir a sección'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {sec.summary}
                  </p>

                  <ul className="space-y-1.5 pt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-[11px] text-slate-500 dark:text-slate-400">
                    {sec.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-white dark:bg-slate-900">
          <span className="text-slate-400 dark:text-slate-500">
            Recuerda: el tutorial interactivo solo aparece al registrarte por primera vez; después puedes abrirlo siempre desde el botón «? Ayuda».
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
