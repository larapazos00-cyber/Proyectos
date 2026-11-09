import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  X,
  LayoutDashboard,
  BookOpen,
  Calendar,
  Sparkles,
  Timer,
  BarChart3,
  Flame,
  Brain,
  RotateCcw,
  Zap,
  CheckCircle2,
  SlidersHorizontal,
  CloudCheck,
  Search,
  Plus,
  Play,
  FileText,
  Award,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import studyflowLogo from '../assets/images/studyflow_logo_1793994920234.jpg';

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
        title: 'General · Centro de Mando Académico',
        badge: 'Pestaña 1',
        icon: LayoutDashboard,
        iconColor: 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400',
        summary:
          'Visión panorámica de tu curso, avance global del temario, horas invertidas hoy y panel de control con accesos directos.',
        bullets: [
          'Barra de Comando: visualiza el grado o curso activo (o mix de varias carreras), número de materias y porcentaje global de temario dominado.',
          'Métricas Clave: horas estudiadas hoy vs tu meta diaria configurada, exámenes restantes y temas completados.',
          'Historial de Rachas (Mapa de Calor): cuadrícula de actividad de los últimos 3 a 6 meses (estilo GitHub/Duolingo) con días estudiados, récord histórico y horas acumuladas.',
          'Panorama por Asignatura: tarjetas interactivas de cada materia con su barra de progreso y avisos de Spaced Repetition pendientes hoy.',
          'Tareas Urgentes y Próximos Vencimientos: lista de entregas y fechas límite para tener siempre presentes tus compromisos inmediatos.',
        ],
      },
      {
        id: 'tab-materias',
        category: 'tabs',
        tabId: 'asignaturas',
        title: 'Materias · Cuaderno Académico y Temarios',
        badge: 'Pestaña 2',
        icon: BookOpen,
        iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
        summary:
          'Gestión completa de cada asignatura: temario oficial, apuntes Cornell, simulación Feynman, mapas conceptuales y vueltas de estudio.',
        bullets: [
          'Temario Oficial por Estados: organiza cada tema como Pendiente, En Progreso, Estudiado o Repasado.',
          'Sistema de Vueltas Académicas: gestiona ciclos de estudio sucesivos (1ª vuelta comprensiva, 2ª de consolidación, 3ª de memorización profunda).',
          'Apuntes Digitales Método Cornell: hoja con columna de preguntas detonadoras para Active Recall, notas centrales en Markdown enriquecido y resumen sintético.',
          'Simulador Método Feynman: redacta un concepto con tus palabras para que la IA evalúe la claridad, detecte jerga excesiva y te proponga analogías intuitivas.',
          'Mapas Conceptuales D3: visualización interactiva en árbol jerárquico generada automáticamente a partir del contenido del tema.',
          'Exportación a PDF Universitario: imprime tus apuntes en formato limpio con cuadrícula, rayado, casillas de autoevaluación y portada oficial.',
        ],
      },
      {
        id: 'tab-calendario',
        category: 'tabs',
        tabId: 'calendario',
        title: 'Plan y Repasos · Planificador Inteligente y Curva del Olvido',
        badge: 'Pestaña 3',
        icon: Calendar,
        iconColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
        summary:
          'Algoritmo que calcula automáticamente qué temas estudiar cada día según tus horas libres y las fechas de tus exámenes.',
        bullets: [
          'Planificación Automática con Fechas Límite: reparte de forma equilibrada los temas según los días restantes hasta cada examen o convocatoria.',
          'Curva del Olvido (Spaced Repetition): programa repasos espaciados científicos (1, 3, 7, 14, 30 días) avisándote qué temas debes repasar hoy.',
          'Selector de Horas Disponibles al Día: define cuántas horas quieres dedicar al estudio de lunes a domingo para que el plan se adapte a tu vida real.',
          'Bloqueo de Horas: añade eventos y compromisos semanales para que el planificador calcule solo sobre tus horas verdaderamente libres.',
        ],
      },
      {
        id: 'tab-cuestionarios',
        category: 'tabs',
        tabId: 'cuestionarios',
        title: 'Cuestionarios · Laboratorio de Simulacros y Active Recall',
        badge: 'Pestaña 4',
        icon: Sparkles,
        iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400',
        summary:
          'Genera exámenes tipo test y preguntas de desarrollo con IA a partir de tus temas o apuntes, y pon a prueba tu memoria.',
        bullets: [
          'Generación con IA Universitaria: formula preguntas tipo test de 4 opciones, preguntas abiertas o casos prácticos con rúbricas de corrección precisas.',
          'Evita el Olvido con Active Recall: botón inteligente que detecta qué temas necesitan repaso urgente según la curva de retención y lanza un test o flashcards al instante.',
          'Modo Flashcards Quickfire: mazo de tarjetas de recuerdo activo para autoevaluarte concepto a concepto de forma ágil.',
          'Gráfico de Retención y Analítica: compara la precisión de tus respuestas y la consolidación de contenidos por materia.',
        ],
      },
      {
        id: 'tab-pomodoro',
        category: 'tabs',
        tabId: 'pomodoro',
        title: 'Pomodoro · Concentración Profunda y Motor de Racha',
        badge: 'Pestaña 5',
        icon: Timer,
        iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400',
        summary:
          'Cronómetro de enfoque que vincula tu tiempo a materias y temas específicos, alimentando tu racha de días consecutivos.',
        bullets: [
          'Intervalos de Concentración: bloques de 25 min de estudio y 5 min de descanso para mantener tu energía mental óptima.',
          'Vinculación Temática: asocia la sesión a la asignatura y tema que estás leyendo para sumar horas reales de estudio en tus métricas.',
          'Motor de Rachas Diarias (🔥): al completar al menos 1 bloque diario, se valida y aumenta tu racha de días consecutivos.',
          'Sonidos Ambientales Concentradores: audio de fondo relajante (lluvia, cafetería, biblioteca, ruido blanco) para aislarte de distracciones.',
          'Modo Enfoque Pantalla Completa: minimiza la interfaz para una inmersión completa sin notificaciones ni elementos superfluos.',
        ],
      },
      {
        id: 'tab-estadisticas',
        category: 'tabs',
        tabId: 'estadisticas',
        title: 'Estadísticas · Analítica Académica y Logros',
        badge: 'Pestaña 6',
        icon: BarChart3,
        iconColor: 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400',
        summary:
          'Métricas globales, tiempo acumulado por asignatura, evolución de precisión y vitrina de medallas de constancia.',
        bullets: [
          'Horas Totales Invertidas: desglose de tiempo real dedicado a cada materia y evolución a lo largo de las semanas.',
          'Tasa de Retención y Acierto: evolución de tus notas en los cuestionarios y simulacros.',
          'Vitrina de Logros y Medallas: desbloqueo de insignias por constancia (3, 5, 7, 14, 30 días de racha) y volumen de páginas leídas.',
        ],
      },

      // 2. METHODS
      {
        id: 'method-active-recall',
        category: 'methods',
        title: 'Active Recall (Recuperación Activa)',
        badge: 'Metodología',
        icon: Brain,
        iconColor: 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400',
        summary:
          'La técnica más respaldada por la neurociencia: esforzarte activamente por recordar un dato sin mirarlo multiplica tu retención a largo plazo.',
        bullets: [
          'Cómo se usa en StudyFlow: a través de las columnas de Ideas Clave en los apuntes Cornell, las Flashcards Quickfire y los cuestionarios automáticos.',
          'Evita la trampa de la lectura pasiva: releer tus apuntes genera una falsa ilusión de dominio; autoevaluarte obliga a tu cerebro a fijar la ruta neuronal.',
        ],
      },
      {
        id: 'method-spaced-repetition',
        category: 'methods',
        title: 'Spaced Repetition (Curva del Olvido de Ebbinghaus)',
        badge: 'Metodología',
        icon: RotateCcw,
        iconColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
        summary:
          'Repasar en intervalos de tiempo crecientes (1, 3, 7, 14, 30 días) para aplanar la curva del olvido y que el conocimiento pase a la memoria duradera.',
        bullets: [
          'El algoritmo de StudyFlow monitoriza cuándo estudiaste o repasaste cada tema por última vez.',
          'Si un tema entra en su ventana de olvido, se genera una alerta visual y se añade a la lista de "Temas a repasar hoy" en Plan y Cuestionarios.',
        ],
      },
      {
        id: 'method-pomodoro',
        category: 'methods',
        title: 'Técnica Pomodoro (25/5 min)',
        badge: 'Metodología',
        icon: Timer,
        iconColor: 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400',
        summary:
          'Estructura el esfuerzo en bloques cortos e hiperenfocados intercalados con pausas breves para evitar la fatiga cognitiva.',
        bullets: [
          'Permite sostener sesiones de estudio de 4 a 8 horas al día manteniendo la misma lucidez.',
          'StudyFlow registra cada bloque completado en tu historial diario y en la racha de días consecutivos.',
        ],
      },
      {
        id: 'method-feynman',
        category: 'methods',
        title: 'Método Feynman de Comprensión Profunda',
        badge: 'Metodología',
        icon: Sparkles,
        iconColor: 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400',
        summary:
          'Si no puedes explicar un concepto con palabras sencillas a un principiante, aún no lo entiendes con total solidez.',
        bullets: [
          'Disponible en la pestaña de Materias dentro de cada tema.',
          'Escribe tu explicación y la IA te señalará qué puntos quedaron difusos, qué conceptos omitiste y te brindará una analogía clarificadora.',
        ],
      },

      // 3. TOOLS & FEATURES
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
          'Haz clic en el icono de fuego de la barra superior o del menú lateral en cualquier momento para ver tu racha y los días que faltan para tu siguiente medalla.',
          'Si dejas pasar más de 24 horas sin registrar ninguna sesión, la racha se reinicia a 1 día en tu siguiente sesión.',
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
          'Permite tener varios grados, másteres, oposiciones o cursos activos al mismo tiempo, o combinarlos en un Mix Académico.',
        bullets: [
          'Crea nuevos estudios o cursos desde el botón "+ Estudios" en la cabecera.',
          'Puedes seleccionar 1 curso específico o activar varios para tener una vista combinada de todas tus materias.',
        ],
        actionLabel: 'Abrir Estudios',
        onAction: onOpenProgramManager,
      },
      {
        id: 'tool-cloud-sync',
        category: 'tools',
        title: 'Sincronización en la Nube y Multi-dispositivo',
        badge: 'Herramienta',
        icon: CloudCheck,
        iconColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
        summary:
          'Inicia sesión con tu cuenta para que todo tu avance, apuntes, temas y rachas se guarden de forma segura y estén accesibles desde tu móvil y ordenador.',
        bullets: [
          'Los datos se sincronizan automáticamente con Firebase Firestore en tiempo real.',
          'Si no tienes cuenta, tus datos se guardan de forma local en el navegador para que nunca pierdas nada.',
        ],
      },
      {
        id: 'tool-customization',
        category: 'tools',
        title: 'Personalización de Interfaz y Pestañas (⚙️)',
        badge: 'Herramienta',
        icon: SlidersHorizontal,
        iconColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300',
        summary:
          'Adapta StudyFlow a tu flujo de trabajo: activa u oculta pestañas, alterna entre menú lateral y superior, y usa el modo oscuro.',
        bullets: [
          'Pestañas visibles: desde Preferencias puedes ocultar pestañas que no utilices a diario.',
          'Menú Superior vs Lateral: alterna la posición de la barra de navegación con el icono de panel lateral.',
          'Modo Claro y Oscuro: cuida tu vista cambiando el tema con el botón de sol/luna.',
        ],
        actionLabel: 'Abrir Personalización',
        onAction: onOpenPreferences,
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
                  Guía Completa de StudyFlow
                </h3>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                  Manual de Usuario
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Domina todas las pestañas, técnicas de memorización activa y herramientas académicas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onStartOnboardingTour && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartOnboardingTour();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Iniciar guía interactiva paso a paso"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Tutorial Interactivo</span>
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

        {/* Filter bar: Search + Category Pills */}
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar funcionalidad (ej: pomodoro, cornell, racha, feynman, examen, pestañas...)"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
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
                <span>Metodologías de Estudio</span>
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
                <span>Funcionalidades & Ajustes</span>
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
                <span>Personalización de Interfaz y Pestañas</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredSections.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No se han encontrado resultados para «{searchQuery}». Prueba con términos como «pomodoro», «feynman», «apuntes» o «curva».
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
                        <span>{sec.actionLabel || 'Abrir'}</span>
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
            ¿Dudas o sugerencias? StudyFlow está optimizado para potenciar tu memoria a largo plazo.
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
