/**
 * Modelos de datos para StudyFlow
 */

export type ExamType = 'oral' | 'test' | 'desarrollo' | 'preguntas_cortas' | 'calculo' | 'practico' | 'mixto';
export type DifficultyLevel = 'Baja' | 'Media' | 'Alta';
export type TaskPriority = 'urgente' | 'alta' | 'media' | 'baja';
export type TaskType = 'entrega' | 'lectura' | 'practica' | 'proyecto' | 'repaso';
export type TopicStatus = 'pendiente' | 'en_progreso' | 'estudiado' | 'repasado';
export type ReviewQuality = 'repetir' | 'dificil' | 'bien' | 'facil';

export interface SpacedReviewRecord {
  date: string;
  quality: ReviewQuality;
  retentionPct?: number; // Retención demostrada o percibida (0-100%)
  errorsCount?: number; // Fallos cometidos durante el repaso
  intervalDaysUsed?: number; // Intervalo en días programado tras este repaso
  adjustmentNote?: string; // Nota del ajuste (ej. "Adelantado por baja retención", "Espaciado por alta retención")
  pagesReviewed?: number; // Número de páginas estudiadas incluidas en el repaso
  totalTopicPages?: number; // Número total de páginas del tema en el momento del repaso
  estimatedReviewMinutes?: number; // Duración estimada del repaso según páginas estudiadas
}

export type DocumentCategoryType = 'teoria' | 'apuntes' | 'libro' | 'practicas' | 'resumen';

export type ImportedFileFormat = 'pdf' | 'word' | 'powerpoint' | 'image' | 'text' | 'doc';

export interface DocumentImageAsset {
  id: string;
  name: string;
  dataUrl: string;
  caption?: string;
  pageOrSlideNumber?: number;
  widthPercent?: number;
}

export interface DocumentComment {
  id: string;
  quote?: string;
  text: string;
  color?: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  createdAt: string;
  resolved?: boolean;
}

export interface EditableKeyPoint {
  id: string;
  title: string;
  detail: string;
  category?: string;
  importance?: 'alta' | 'media' | 'baja';
  sourceDocName?: string;
}

export interface AttachedTopicFile {
  id: string;
  name: string;
  fileType?: ImportedFileFormat;
  documentCategory?: DocumentCategoryType; // Categoría del documento para filtrado
  pageCount: number; // Número de páginas o diapositivas detectadas del archivo para la organización
  pagesRead?: number; // Páginas leídas hasta el momento
  scheduledDate?: string; // Fecha objetivo de estudio programado (YYYY-MM-DD)
  includeInOrganization?: boolean; // Si se tiene en cuenta para el cálculo de páginas y tiempo del tema
  content: string; // Toda la información escrita detectada y editable en apuntes libres
  richHtmlContent?: string; // Contenido enriquecido editable con subrayados, comentarios e imágenes
  rawExtractedText?: string; // Texto original detectado al importar
  extractedImages?: DocumentImageAsset[]; // Imágenes extraídas del PDF/Word/PowerPoint o añadidas por el usuario
  comments?: DocumentComment[]; // Comentarios y anotaciones añadidas al documento
  keyPoints?: EditableKeyPoint[]; // Puntos clave editables generados con IA a partir de este documento
  cues?: string[];
  summary?: string;
  size?: number;
  date: string;
  lastEditedAt?: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  subtopics: string[];
  completedSubtopics?: string[]; // Subtemas marcados como completados por el usuario
  difficulty: DifficultyLevel;
  pageCount?: number; // Número de páginas para dividir la materia
  pagesRead?: number; // Páginas completadas
  estimatedHours: number;
  actualHoursSpent: number;
  status: TopicStatus;
  category?: string; // Área de conocimiento o categoría temático
  paginasTotales?: number; // Páginas totales del tema para cálculo adaptativo
  isPrinted?: boolean; // Pestaña/indicador de tema impreso o en formato digital
  impreso?: boolean; // Alias en español para filtro de impresión
  generalNotes?: string; // Apuntes libres sin necesidad de estructura Cornell
  richGeneralNotes?: string; // Apuntes libres enriquecidos (subrayados, imágenes, etc.)
  generalComments?: DocumentComment[]; // Comentarios en los apuntes generales
  generalImages?: DocumentImageAsset[]; // Imágenes en los apuntes generales
  attachedFiles?: AttachedTopicFile[]; // Documentos y apuntes importados con conteo de páginas y texto editable
  studiedAt?: string;
  nextReviewDate?: string; // Fecha en formato YYYY-MM-DD
  reviewScheduledTime?: string; // Hora asignada para el repaso en Time-Blocking (ej: "11:00")
  reviewTimeByDate?: Record<string, string>; // Mapa fecha YYYY-MM-DD -> hora HH:mm para repasos arrastrados o ubicados en hueco libre
  milestoneDateOverrides?: Record<number, string>; // Mapa ciclo R1..R5 -> fecha YYYY-MM-DD cuando el usuario arrastra un repaso a otro día
  reviewLevel: number; // 0: no estudiado, 1: 24h (1 día), 2: 3 días, 3: 7 días (1 semana), 4: 15 días, 5: 30 días (1 mes)
  reviewsHistory: SpacedReviewRecord[];
  perceivedRetentionPct?: number; // Retención demostrada o percibida del tema (0-100%)
  unresolvedErrorsCount?: number; // Errores pendientes o cometidos en este tema
  lastIntervalDays?: number; // Último intervalo de días aplicado (ajustado por retención/errores)
  lastAdjustmentReason?: string; // Explicación del ajuste aplicado al repaso
  scheduledDate?: string; // Asignado por el planificador inteligente o arrastrado manualmente
  scheduledTime?: string; // Hora de inicio (HH:mm) asignada o arrastrada manualmente para estudiar el tema
  scheduledEndTime?: string; // Hora de fin (HH:mm) asignada para estudiar el tema
  studyTimeByDate?: Record<string, string>; // Mapa fecha YYYY-MM-DD -> hora HH:mm para cambiar la hora de inicio de sesiones de estudio
  extraStudySessionsByDate?: Record<string, { startTime: string; pagesCount?: number }>; // Sesiones extra añadidas por el usuario para rellenar huecos libres en un día concreto
  manualScheduledDate?: boolean; // Si fue ubicado manualmente arrastrando en el calendario
  vueltasCount?: number; // Veces que se ha estudiado o repasado este tema (vueltas al temario)
  notes?: string; // Apuntes detallados redactados o importados para este tema
  cues?: string[]; // Preguntas detonadoras / Active Recall asociadas al tema
  summary?: string; // Resumen ejecutivo del tema
  keyPoints?: EditableKeyPoint[]; // Puntos clave editables generados con IA desde los documentos del tema
  lastNotesUpdatedAt?: string; // Fecha de última actualización de los apuntes
  enabledResources?: {
    flashcards?: boolean;
    quiz?: boolean;
    reading?: boolean;
    diagram?: boolean;
    feynman?: boolean;
  }; // Decidir qué apartados y recursos de la app activar para este tema
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: TaskPriority;
  type: TaskType;
  completed: boolean;
  reminder: boolean;
  reminderTime?: string;
  scheduledTime?: string; // HH:mm para tareas arrastradas o asignadas a una hora
  startTime?: string; // HH:mm para vista en bloque (ej: "16:00")
  endTime?: string; // HH:mm para vista en bloque (ej: "17:00")
  durationMinutes?: number; // minutos estimados para la tarea
  notes?: string;
  projectId?: string; // Vinculado a un proyecto de la asignatura
  phaseId?: string; // Vinculado a una fase específica del proyecto
  topicId?: string; // Vinculado a un tema específico del temario
  subtopic?: string; // Vinculado a un subtema específico dentro del tema
  // Puntuación y ponderación opcionales (no obligatorias, para que se pueda rellenar la nota solo de los que puntúen)
  score?: number; // Puntuación / calificación obtenida (ej: 8.5)
  maxScore?: number; // Puntuación máxima de referencia (ej: 10)
  weightPercentage?: number; // Ponderación en la nota final o continua (ej: 15%)
  isGraded?: boolean; // Indica si la tarea es evaluable o puntúa
}

export interface Exam {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  examType: ExamType;
  difficulty: 'basico' | 'intermedio' | 'avanzado';
  topicIds: string[];
  targetGrade?: number;
  actualGrade?: number; // Equivalente a finalGrade
  finalGrade?: number; // Calificación final obtenida (0 - 10)
  weightPercentage?: number; // Ponderación en la nota final (ej: 40%)
  weight?: number; // Alias de ponderación
  completed: boolean;
  notes?: string;
  convocatoria?: string; // ej: "Ordinaria", "Extraordinaria", "Parcial 1", "Parcial 2", "Final", "Recuperación"
  location?: string; // Aula o ubicación del examen
}

export interface CornellNote {
  id: string;
  topicId?: string;
  title: string;
  cues: string[]; // Preguntas o palabras detonadoras en la columna izquierda
  notes: string; // Apuntes detallados en el cuerpo central
  summary: string; // Resumen inferior
  keyPoints?: EditableKeyPoint[]; // Puntos clave editables generados por IA desde documentos importados
  createdAt: string;
  updatedAt: string;
  sourceType: 'manual' | 'ocr_pdf' | 'ocr_image';
}

export interface Flashcard {
  id: string;
  topicId?: string;
  question: string;
  answer: string;
  concept?: string; // Concepto clave estructurado extraído de apuntes/documentos
  definition?: string; // Definición asociada al concepto
  sourceDocName?: string; // Nombre del documento importado de origen
  hint?: string;
  conceptTag: string;
  interval: number; // Días
  repetitions: number;
  easeFactor: number;
  nextReview: string;
  lastScore?: ReviewQuality;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options?: string[]; // Para examen tipo test
  correctOptionIndex?: number;
  explanation: string;
  optionExplanations?: string[]; // Explicaciones pedagógicas detalladas de cada opción para tests
  keyPoints?: string[]; // Para examen oral o desarrollo
  rubricCriteria?: string[]; // Rúbrica de corrección
  userAnswer?: string | number;
  score?: number; // 0-100
  feedback?: string;
}

export interface Quiz {
  id: string;
  topicId?: string;
  sourceNoteIds?: string[];
  examTitle: string;
  examType: ExamType;
  difficulty: 'basico' | 'intermedio' | 'avanzado';
  questions: QuizQuestion[];
  takenAt?: string;
  overallScore?: number;
}

export interface FeynmanConceptCorrection {
  concept: string;
  userMistake: string;
  correction: string;
  severity?: 'error_conceptual' | 'imprecision' | 'exceso_jerga';
}

export interface FeynmanSession {
  id: string;
  topicId?: string;
  subtopic?: string;
  concept: string;
  explanation: string;
  clarityScore: number;
  simplicityScore?: number;
  accuracyScore?: number;
  overallScore?: number;
  corrections?: FeynmanConceptCorrection[];
  deepDiveSuggestions?: string[];
  strengths?: string[];
  identifiedJargon: string[];
  conceptualGaps: string[];
  intuitiveAnalogies: string[];
  improvedDraft: string;
  followUpQuestions?: string[];
  feedback: string;
  createdAt: string;
  inputMode?: 'written' | 'audio';
  transcription?: string;
  oralDeliveryFeedback?: string;
}

export interface MindmapNode {
  id: string;
  label: string;
  description: string;
  category?: string;
  cueQuestion?: string;
  cornellSection?: 'cue' | 'notes' | 'summary' | 'core';
  children?: MindmapNode[];
}

export interface Mindmap {
  id: string;
  topicIds: string[];
  cornellNoteId?: string;
  title: string;
  summary: string;
  rootNode: MindmapNode;
  createdAt: string;
}

export interface ErrorLogEntry {
  id: string;
  subjectId: string;
  topicId?: string;
  topicTitle: string;
  concept?: string;
  questionPrompt: string;
  userMistake: string;
  correctAnswer: string;
  rootCauseCategory: 'falta_concepto' | 'confusion_terminos' | 'despiste' | 'calculo' | 'otro';
  date: string;
  resolved: boolean;
}

export interface ProjectPhase {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  order: number;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  weightPercentage?: number; // % en la nota final (ej: 25%)
  finalGrade?: number; // Calificación final obtenida (0 - 10)
  status: 'planificacion' | 'en_progreso' | 'entregado' | 'calificado';
  phases: ProjectPhase[];
  tasks: Task[];
}

export interface GradingComponent {
  id: string;
  name: string;
  type: 'exam' | 'project' | 'continuous' | 'activity' | 'custom';
  weight: number; // Porcentaje del total (ej: 40 para 40%)
  linkedId?: string; // ID del examen o proyecto asociado
  grade?: number; // Nota obtenida de 0 a 10
}

export interface SubjectGradingConfig {
  passingGrade: number; // Por defecto 5.0
  targetGrade?: number; // Meta personal, por defecto 8.0
  components: GradingComponent[];
}

export interface Subject {
  id: string;
  name: string;
  code?: string; // Código de asignatura opcional
  color: string; // Hex color o clase de color
  credits?: number;
  professor?: string; // Profesor principal (compatibilidad)
  professors?: string[]; // Múltiples profesores de la asignatura
  classroom?: string;
  programId?: string; // ID del estudio/carrera al que pertenece (útil al combinar varios estudios)
  programName?: string; // Nombre del estudio/carrera
  yearId?: string; // ID del curso académico
  yearName?: string; // Nombre del curso académico
  startDate?: string; // Fecha de inicio de la asignatura (YYYY-MM-DD)
  currentVuelta?: number; // Vuelta global actual al temario (ej: 1, 2, 3...)
  targetVueltas?: number; // Meta de vueltas antes del examen (ej: 3 vueltas)
  gradingScaleMode?: 'numeric' | 'percentage' | 'both'; // Calificaciones en número (0-10) o porcentaje (0-100%)
  hiddenTabs?: string[]; // Pestañas internas eliminadas u ocultadas por el usuario
  topics: Topic[];
  tasks: Task[];
  exams: Exam[];
  projects?: Project[]; // Proyectos y fases vinculadas
  gradingConfig?: SubjectGradingConfig; // Configuración de ponderación y cálculo de nota final
  cornellNotes: CornellNote[];
  flashcards: Flashcard[];
  quizzes: Quiz[];
  feynmanSessions: FeynmanSession[];
  mindmaps: Mindmap[];
  errorLogs: ErrorLogEntry[];
}

export interface AcademicYear {
  id: string;
  name: string; // ej: "1º Curso"
  academicPeriod: string; // ej: "2026/2027"
  startDate?: string; // Fecha de inicio del curso académico (YYYY-MM-DD, ej: "2026-09-15")
  targetWeeklyHours: number;
  subjects: Subject[];
}

export interface StudyProgram {
  id: string;
  name: string; // ej: "Grado en Medicina", "Bachillerato de Ciencias"
  institution?: string; // ej: "Universidad Autónoma", "IES"
  years: AcademicYear[];
}

export interface WeeklyObligation {
  id: string;
  title: string;
  category:
    | 'clase'
    | 'trabajo'
    | 'gimnasio'
    | 'personal'
    | 'domestico'
    | 'compras'
    | 'descanso'
    | 'lectura'
    | 'otro';
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  startTime: string; // HH:mm ej. "09:00"
  endTime: string; // HH:mm ej. "13:00"
  durationHours: number; // Horas dedicadas a esta obligación
  color?: string;
  notes?: string;
  isAutomatedWeekly?: boolean; // Automatizar todas las semanas
  recurringDays?: number[]; // Días en los que se repite la obligación fija semanal
}

export type BlockedCategory =
  | 'clase'
  | 'trabajo'
  | 'medico'
  | 'deporte'
  | 'transporte'
  | 'descanso'
  | 'social'
  | 'personal'
  | 'otro';

export interface BlockedTimeEvent {
  id: string;
  title: string;
  date?: string; // YYYY-MM-DD (para bloqueos de una fecha concreta)
  startTime: string; // HH:mm (ej: "17:00")
  endTime: string; // HH:mm (ej: "18:30")
  durationHours?: number; // Duración calculada en horas
  category: BlockedCategory | string;
  notes?: string;
  recurringDays?: number[]; // [1, 2, 3, 4, 5] para bloqueos que se repiten ciertos días de la semana
  linkedItemType?: 'topic' | 'task' | 'review';
  linkedTopicId?: string;
  linkedTaskId?: string;
  linkedSubjectId?: string;
  subjectName?: string;
  subjectColor?: string;
}

export interface BlockedReasonSummary {
  category: BlockedCategory | string;
  label: string;
  iconName: string;
  totalHoursWeekly: number;
  hoursPerDayAvg: number;
  count: number;
}

export interface DailyNeedsCalculation {
  // Horas necesarias para nuevo temario
  newStudyHoursNeededDaily: number;
  remainingNewTopicsCount: number;
  remainingNewPagesCount: number;
  totalNewStudyHoursRemaining: number;

  // Horas necesarias para repetición espaciada (Curva del Olvido)
  reviewHoursNeededDaily: number;
  activeReviewsCount: number;
  totalReviewHoursRemaining: number;
  totalStudiedPagesForReview?: number; // Total de páginas estudiadas que entran en los repasos programados

  // Horas totales necesarias al día (Estudio + Repaso)
  totalHoursNeededDaily: number;

  // Horas bloqueadas y disponibilidad real
  totalBlockedHoursWeekly: number;
  dailyAvgBlockedHours: number;
  realAvailableHoursDaily: number;

  // Margen y diagnóstico
  balanceDailyHours: number; // realAvailableHoursDaily - totalHoursNeededDaily
  status: 'viable' | 'ajustado' | 'sobrecarga';
  statusMessage: string;

  // Desglose por motivos de bloqueo
  blockedReasonsBreakdown: BlockedReasonSummary[];

  // Contexto temporal
  targetExamTitle?: string;
  targetExamDate?: string;
  daysUntilExam: number;
  availableStudyDaysCount: number;

  // Velocidad de lectura configurada
  configuredMinutesPerPage?: number;
  pagesPerHour?: number;
}

export type CalendarViewType = 'monthly' | 'weekly' | 'daily' | 'yearly';

export interface ContextualNotificationRule {
  id: string;
  name: string;
  conditionType:
    | 'subject_below_weekly_goal'
    | 'daily_goal_deficit'
    | 'topic_stagnation'
    | 'exam_readiness_low';
  subjectId?: string; // 'all' o ID de una asignatura específica
  thresholdHours?: number; // Meta semanal mínima en horas para la asignatura
  thresholdPercentage?: number; // Umbral porcentual (ej: 80% de la meta semanal)
  evaluationDay?: 'any' | 'midweek' | 'weekend';
  suggestedMinutes?: number; // Duración sugerida (ej: 25 min)
  enabled: boolean;
}

export interface StudyPreferences {
  availableDays: number[]; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  hoursPerDay: Record<number, number>; // Horas disponibles calculadas o manuales por día de la semana
  dailyGoalHours?: number; // Meta diaria de estudio configurada en preferencias (en horas, ej: 3.0)
  dailyGoalTopics?: number; // Meta diaria de temas completados o repasados (ej: 2 temas/día)
  dailyGoalMode?: 'hours' | 'topics' | 'both'; // Modo de seguimiento de la meta diaria en la vista General
  // Velocidad de lectura y estudio por página (Factor determinante en la planificación)
  readingSpeedPagesPerHour?: number; // Velocidad de lectura promedio en páginas por hora (ej: 8 págs/hora)
  averageMinutesPerPage?: number; // Minutos promedio de estudio/lectura por página (ej: 7.5 min/pág)
  useDifficultyScalingForPages?: boolean; // Si se modula la velocidad por página según la dificultad Baja/Media/Alta del tema
  defaultPagesPerTopic?: number; // Nº de páginas estimado por defecto cuando un tema aún no tiene páginas asignadas (ej: 15)
  subjectWeeklyGoalHours?: Record<string, number>; // Objetivo semanal de horas de estudio por asignatura (subjectId -> horas/semana)
  defaultSubjectWeeklyGoalHours?: number; // Meta semanal por defecto por asignatura (ej: 4h)
  contextualNotificationRules?: ContextualNotificationRule[]; // Reglas de notificaciones contextuales configurables
  weeklyFixedObligations?: WeeklyObligation[]; // Horario semanal de compromisos fijos (clase, trabajo, gimnasio...)
  enabledTabs?: string[]; // Pestañas activas/visibles configuradas por el usuario
  navigationPosition?: 'top' | 'sidebar'; // Posición del menú: superior o lateral a decisión del usuario
  pomodoroConfig: {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    longBreakInterval: number;
  };
  streakDays: number;
  lastStudyDate: string;
  // Web & Browser Push Notification Preferences
  enableWebNotifications: boolean;
  enableBrowserPushService?: boolean; // Suscripción activa al servicio de notificaciones push del navegador
  notifyOverdueReviewsBackground?: boolean; // Alertas en segundo plano para repasos vencidos o próximos
  pushSubscriptionEndpoint?: string; // Endpoint o identificador de suscripción web push
  notifyPomodoroBreaks: boolean;
  notifyDailyReviews: boolean;
  notifyTaskDeadlines: boolean;
  notifyClassStart?: boolean; // Alertas de inicio de clase según horario fijo
  classReminderMinutesBefore?: number; // Minutos de antelación antes de clase (ej: 15 min)
  taskReminderDaysAhead?: number; // Días de antelación para vencimiento de tareas (ej: 2 días)
  taskNotifyOnlyHighPriority?: boolean; // Avisar solo de tareas urgentes o de prioridad alta
  spacedRepetitionReminderTime?: string; // Hora preferida para recordatorios de repaso espaciado (HH:mm)
  spacedRepetitionIncludeOverdue?: boolean; // Incluir repasos espaciados atrasados además de los de hoy
  notifyUpcomingExams?: boolean; // Alertas para exámenes próximos
  examReminderDaysAhead?: number; // Días de antelación para avisar (ej: 3 días)
  customReminderTime?: string;
  // Reglas de Repetición Espaciada y Curva del Olvido
  spacedRepetitionConfig?: SpacedRepetitionConfig;
  // Time Blocking Config
  timeBlockMode?: boolean; // Activar vista en bloque horario
  studyDayStartHour?: number; // hora de inicio del día (ej: 8 para 08:00)
  studyDayEndHour?: number; // hora de fin del día (ej: 22 para 22:00)
}

export interface ForgettingCurveProfile {
  id: string; // ej: 'intensivo' | 'moderado' | 'relajado' | custom string
  name: string; // ej: 'Intensivo', 'Moderado (Estándar)', 'Relajado'
  description: string;
  isCustom?: boolean;
  intervals: [number, number, number, number, number]; // [d1, d2, d3, d4, d5]
  phaseNotifications: [boolean, boolean, boolean, boolean, boolean]; // Notificaciones activas para cada fase (1..5)
}

export interface SpacedRepetitionConfig {
  activeProfileId: string;
  intervals: [number, number, number, number, number];
  phaseNotifications: [boolean, boolean, boolean, boolean, boolean];
  savedProfiles?: ForgettingCurveProfile[];
  lastMassAppliedAt?: string;
  lastMassAppliedProgramName?: string;
}

export const DEFAULT_FORGETTING_CURVE_PROFILES: ForgettingCurveProfile[] = [
  {
    id: 'intensivo',
    name: 'Intensivo',
    description: 'Intervalos cortos y alta frecuencia de fijación para exámenes inminentes u oposiciones.',
    intervals: [1, 2, 5, 10, 20],
    phaseNotifications: [true, true, true, true, true],
  },
  {
    id: 'moderado',
    name: 'Moderado',
    description: 'Curva estándar de Ebbinghaus: 24h, 3 días, 1 semana, quincena y mes. Equilibrio óptimo.',
    intervals: [1, 3, 7, 15, 30],
    phaseNotifications: [true, true, true, true, true],
  },
  {
    id: 'relajado',
    name: 'Relajado',
    description: 'Espaciado amplio para asignaturas anuales, lecturas secundarias o menor presión de entrega.',
    intervals: [2, 5, 14, 30, 60],
    phaseNotifications: [true, true, true, true, false],
  },
];

export interface PomodoroLog {
  id: string;
  subjectId: string;
  subjectName: string;
  topicTitle?: string;
  durationMinutes: number;
  date: string; // YYYY-MM-DD
  timestamp: string;
}

export interface ScheduledStudySession {
  id: string;
  date: string; // YYYY-MM-DD
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  topicId: string;
  topicTitle: string;
  durationHours: number;
  startTime?: string; // HH:mm para vista en bloque (ej: "09:00")
  endTime?: string; // HH:mm para vista en bloque (ej: "11:30")
  pageCount?: number;
  studiedPagesToReview?: number; // Páginas estudiadas a repasar en esta sesión
  pagesAllocation?: string; // e.g. "Páginas 1-18"
  type: 'estudio_nuevo' | 'repaso_espaciado' | 'simulacro_examen';
  completed: boolean;
}

