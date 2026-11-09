import {
  Subject,
  Topic,
  Exam,
  Task,
  StudyPreferences,
  ScheduledStudySession,
  ReviewQuality,
  BlockedTimeEvent,
  WeeklyObligation,
  StudyProgram,
  ForgettingCurveProfile,
  BlockedReasonSummary,
  DailyNeedsCalculation,
  BlockedCategory,
} from '../types';
import {
  toLocalDateStr,
  parseLocalDate,
  getDayOfWeekFromDateStr,
  getTodayLocalDateStr,
} from '../utils/dateUtils';

export const BLOCKED_REASON_DEFINITIONS: Record<
  string,
  { label: string; icon: string; defaultColor: string }
> = {
  clase: { label: 'Clases / Universidad / Instituto', icon: 'GraduationCap', defaultColor: '#3b82f6' },
  trabajo: { label: 'Trabajo / Prácticas', icon: 'Briefcase', defaultColor: '#f59e0b' },
  medico: { label: 'Médico / Salud / Citas', icon: 'HeartPulse', defaultColor: '#ef4444' },
  deporte: { label: 'Deporte / Gimnasio', icon: 'Dumbbell', defaultColor: '#10b981' },
  transporte: { label: 'Desplazamientos / Transporte', icon: 'Car', defaultColor: '#6366f1' },
  descanso: { label: 'Ocio / Descanso / Desconexión', icon: 'Coffee', defaultColor: '#ec4899' },
  personal: { label: 'Compromisos Personales / Familia', icon: 'User', defaultColor: '#8b5cf6' },
  social: { label: 'Eventos Sociales / Amigos', icon: 'Users', defaultColor: '#14b8a6' },
  otro: { label: 'Otro Motivo Personalizado', icon: 'Clock', defaultColor: '#64748b' },
};

export const SPACED_INTERVALS_DAYS = [1, 3, 7, 15, 30];

export const FORGETTING_CURVE_SCHEDULE = [
  { level: 1, days: 1, label: '1er repaso: 24 horas (1 día)', shortLabel: 'R1 (24h)' },
  { level: 2, days: 3, label: '2º repaso: A los 3 días', shortLabel: 'R2 (3 días)' },
  { level: 3, days: 7, label: '3º repaso: A la semana (7 días)', shortLabel: 'R3 (7 días)' },
  { level: 4, days: 15, label: '4º repaso: A los 15 días', shortLabel: 'R4 (15 días)' },
  { level: 5, days: 30, label: '5º repaso: Al mes (30 días)', shortLabel: 'R5 (30 días)' },
];

export interface SpacedReviewAdjustmentOptions {
  errorsCount?: number; // Nº de fallos cometidos o pendientes en el tema
  retentionPct?: number; // Retención demostrada o percibida (0-100%)
  baseDateStr?: string; // Fecha de referencia (por defecto hoy)
  studiedPages?: number; // Nº de páginas estudiadas a tener en cuenta en el repaso
  totalPages?: number; // Nº de páginas totales del tema
  difficulty?: 'Baja' | 'Media' | 'Alta';
}

export interface SpacedReviewCalculationResult {
  nextDate: string;
  nextLevel: number;
  baseIntervalDays: number;
  adjustedIntervalDays: number;
  adjustmentNote: string;
  inferredRetentionPct: number;
  pagesReviewed?: number;
  totalPages?: number;
  estimatedReviewMinutes?: number;
}

// Obtiene la configuración de Velocidad de Lectura Promedio (páginas por hora y minutos por página) desde preferencias o localStorage
export function getStoredReadingSpeedConfig(prefsOverride?: Partial<StudyPreferences>): {
  readingSpeedPagesPerHour: number;
  averageMinutesPerPage: number;
  useDifficultyScalingForPages: boolean;
  defaultPagesPerTopic: number;
} {
  let stored: Partial<StudyPreferences> = {};
  if (
    prefsOverride?.readingSpeedPagesPerHour === undefined ||
    prefsOverride?.averageMinutesPerPage === undefined ||
    prefsOverride?.useDifficultyScalingForPages === undefined ||
    prefsOverride?.defaultPagesPerTopic === undefined
  ) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('studyflow_preferences_v1');
        if (raw) {
          stored = JSON.parse(raw);
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  let readingSpeedPagesPerHour = 8.0;
  let averageMinutesPerPage = 7.5;

  if (
    prefsOverride?.readingSpeedPagesPerHour !== undefined &&
    Number(prefsOverride.readingSpeedPagesPerHour) > 0
  ) {
    readingSpeedPagesPerHour = Math.max(
      1,
      Math.min(120, Math.round(Number(prefsOverride.readingSpeedPagesPerHour) * 10) / 10)
    );
    averageMinutesPerPage = Math.round((60 / readingSpeedPagesPerHour) * 100) / 100;
  } else if (
    prefsOverride?.averageMinutesPerPage !== undefined &&
    Number(prefsOverride.averageMinutesPerPage) > 0
  ) {
    averageMinutesPerPage = Math.max(
      0.5,
      Math.min(60, Math.round(Number(prefsOverride.averageMinutesPerPage) * 100) / 100)
    );
    readingSpeedPagesPerHour = Math.round((60 / averageMinutesPerPage) * 10) / 10;
  } else if (
    stored.readingSpeedPagesPerHour !== undefined &&
    Number(stored.readingSpeedPagesPerHour) > 0
  ) {
    readingSpeedPagesPerHour = Math.max(
      1,
      Math.min(120, Math.round(Number(stored.readingSpeedPagesPerHour) * 10) / 10)
    );
    averageMinutesPerPage = Math.round((60 / readingSpeedPagesPerHour) * 100) / 100;
  } else if (
    stored.averageMinutesPerPage !== undefined &&
    Number(stored.averageMinutesPerPage) > 0
  ) {
    averageMinutesPerPage = Math.max(
      0.5,
      Math.min(60, Math.round(Number(stored.averageMinutesPerPage) * 100) / 100)
    );
    readingSpeedPagesPerHour = Math.round((60 / averageMinutesPerPage) * 10) / 10;
  }

  const useDifficultyScalingForPages =
    prefsOverride?.useDifficultyScalingForPages ??
    stored.useDifficultyScalingForPages ??
    true;

  const rawDefaultPages =
    prefsOverride?.defaultPagesPerTopic ?? stored.defaultPagesPerTopic ?? 15;
  const defaultPagesPerTopic = Math.max(1, Math.min(200, Math.round(Number(rawDefaultPages) || 15)));

  return {
    readingSpeedPagesPerHour,
    averageMinutesPerPage,
    useDifficultyScalingForPages,
    defaultPagesPerTopic,
  };
}

// Velocidad efectiva en páginas por hora según la Velocidad de Lectura Promedio configurada y la dificultad del tema
export function getPagesPerHour(
  difficulty: 'Baja' | 'Media' | 'Alta',
  customPagesPerHour?: number,
  useDifficultyScaling?: boolean,
  customAvgMinutesPerPage?: number
): number {
  const cfg = getStoredReadingSpeedConfig({
    readingSpeedPagesPerHour: customPagesPerHour,
    averageMinutesPerPage: customAvgMinutesPerPage,
    useDifficultyScalingForPages: useDifficultyScaling,
  });

  const basePagesPerHour = cfg.readingSpeedPagesPerHour;
  if (!cfg.useDifficultyScalingForPages) {
    return Math.round(basePagesPerHour * 10) / 10;
  }

  switch (difficulty) {
    case 'Alta':
      return Math.max(1, Math.round((basePagesPerHour / 1.35) * 10) / 10); // Lectura profunda (~74% de la velocidad base)
    case 'Media':
      return Math.round(basePagesPerHour * 10) / 10; // Velocidad de lectura promedio estándar configurada
    case 'Baja':
    default:
      return Math.round((basePagesPerHour / 0.72) * 10) / 10; // Lectura ágil (~139% de la velocidad base)
  }
}

// Ritmo estimado de minutos necesarios por página según la velocidad de lectura configurada en preferencias y la dificultad
export function getMinutesPerPage(
  difficulty: 'Baja' | 'Media' | 'Alta',
  customAvgMinutesPerPage?: number,
  useDifficultyScaling?: boolean,
  customPagesPerHour?: number
): number {
  const effPagesPerHour = getPagesPerHour(
    difficulty,
    customPagesPerHour,
    useDifficultyScaling,
    customAvgMinutesPerPage
  );
  return Math.round((60 / Math.max(0.5, effPagesPerHour)) * 10) / 10;
}

// Ritmo estimado de minutos por página ESTUDIADA durante un repaso espaciado
export function getReviewMinutesPerStudiedPage(
  difficulty: 'Baja' | 'Media' | 'Alta',
  reviewLevel = 1,
  customAvgMinutesPerPage?: number
): number {
  const studyMinsPerPage = getMinutesPerPage(difficulty, customAvgMinutesPerPage);
  // El repaso de una página ya estudiada toma aprox. el 38% del tiempo de estudio inicial
  const baseMins = Math.max(1.0, studyMinsPerPage * 0.38);

  // A mayor nivel de consolidación (R3..R5), el repaso por página es más ágil
  const levelFactor =
    reviewLevel >= 4 ? 0.75 : reviewLevel === 3 ? 0.85 : reviewLevel === 2 ? 0.92 : 1.0;
  return Math.round(baseMins * levelFactor * 10) / 10;
}

// Helper to convert minutes into HH:mm
function minutesToTimeStr(totalMinutes: number): string {
  const normalized = Math.min(23 * 60 + 59, Math.max(0, Math.floor(totalMinutes)));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper to convert HH:mm to minutes from midnight
function timeStrToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const schedulerService = {
  /**
   * Devuelve los minutos por página según la velocidad de lectura en preferencias y la dificultad
   */
  getMinutesPerPage,

  /**
   * Devuelve las páginas por hora según la Velocidad de Lectura Promedio en preferencias y la dificultad
   */
  getPagesPerHour,

  /**
   * Devuelve la configuración efectiva de velocidad de lectura (páginas por hora y minutos por página)
   */
  getStoredReadingSpeedConfig,

  /**
   * Calcula el tiempo estimado para dominar un tema (en horas)
   * usando la 'Velocidad de Lectura Promedio' (páginas por hora) configurada por el usuario
   * y el número de páginas del tema como factores determinantes.
   */
  calculateTopicTime(
    difficulty: 'Baja' | 'Media' | 'Alta',
    subtopicsCount = 0,
    textLength = 0,
    pageCount?: number,
    preferencesOrSpeed?: Partial<StudyPreferences> | number
  ): number {
    const prefsOverride: Partial<StudyPreferences> | undefined =
      typeof preferencesOrSpeed === 'number'
        ? { averageMinutesPerPage: preferencesOrSpeed }
        : preferencesOrSpeed;

    const cfg = getStoredReadingSpeedConfig(prefsOverride);
    const effectivePagesPerHour = getPagesPerHour(
      difficulty,
      cfg.readingSpeedPagesPerHour,
      cfg.useDifficultyScalingForPages,
      cfg.averageMinutesPerPage
    );

    const explicitPages = pageCount && pageCount > 0 ? pageCount : 0;
    if (explicitPages > 0) {
      // El número de páginas dividido entre la Velocidad de Lectura Promedio (páginas/hora) determina el tiempo
      const baseHoursFromPages = explicitPages / Math.max(0.5, effectivePagesPerHour);
      const subtopicBonus = Math.max(0, subtopicsCount - 3) * 0.15;
      return Math.max(0.2, Math.round((baseHoursFromPages + subtopicBonus) * 10) / 10);
    }

    // Si el tema aún no tiene páginas explícitas, inferimos páginas según longitud de apuntes o páginas por defecto en preferencias
    const inferredPagesFromText =
      textLength > 600 ? Math.max(5, Math.ceil(textLength / 1800)) : 0;
    const difficultyDefaultFactor =
      difficulty === 'Alta' ? 1.25 : difficulty === 'Baja' ? 0.8 : 1.0;
    const effectiveFallbackPages =
      inferredPagesFromText > 0
        ? inferredPagesFromText
        : Math.max(1, Math.round(cfg.defaultPagesPerTopic * difficultyDefaultFactor));

    const baseHours = effectiveFallbackPages / Math.max(0.5, effectivePagesPerHour);
    const subtopicBonus = Math.max(0, subtopicsCount - 2) * 0.2;

    const total = Math.round((baseHours + subtopicBonus) * 10) / 10;
    return Math.max(0.3, total);
  },

  /**
   * Calcula dinámicamente las horas estimadas de un tema a partir de sus páginas efectivas
   * (manuales + archivos adjuntos) y la Velocidad de Lectura Promedio (páginas/hora) configurada en preferencias.
   */
  getTopicDynamicEstimatedHours(
    topic: Topic,
    preferences?: Partial<StudyPreferences>
  ): number {
    const effectivePages = this.getTopicEffectivePages(topic);
    const notesLen = (topic.notes || topic.generalNotes || topic.description || '').length;
    return this.calculateTopicTime(
      topic.difficulty || 'Media',
      topic.subtopics ? topic.subtopics.length : 0,
      notesLen,
      effectivePages > 0 ? effectivePages : undefined,
      preferences
    );
  },

  /**
   * Obtiene el número efectivo de páginas de un tema teniendo en cuenta
   * los documentos/apuntes importados asociados para la organización.
   */
  getTopicEffectivePages(topic: Topic): number {
    const attachedPages = (topic.attachedFiles || []).reduce((sum, f) => {
      if (f.includeInOrganization === false) return sum;
      return sum + (f.pageCount && f.pageCount > 0 ? f.pageCount : 1);
    }, 0);
    const manualPages = topic.paginasTotales || topic.pageCount || 0;
    return Math.max(manualPages, attachedPages);
  },

  /**
   * Obtiene el número de páginas efectivamente estudiadas/leídas de un tema
   * (combinando pagesRead del tema, pagesRead de sus documentos adjuntos y su estado),
   * para dimensionar el avance académico y los repasos según las páginas realmente leídas.
   */
  getTopicStudiedPages(topic: Topic, preferences?: Partial<StudyPreferences>): {
    studiedPages: number;
    totalPages: number;
    studiedPct: number;
    isPartiallyStudied: boolean;
  } {
    const cfg = getStoredReadingSpeedConfig(preferences);
    const effectiveTotal = this.getTopicEffectivePages(topic);
    const attachedRead = (topic.attachedFiles || []).reduce((sum, f) => {
      if (f.includeInOrganization === false) return sum;
      return sum + Math.max(0, f.pagesRead || 0);
    }, 0);

    const baseTotal = effectiveTotal > 0 ? effectiveTotal : cfg.defaultPagesPerTopic;

    let studiedPages = 0;
    if (topic.pagesRead !== undefined) {
      studiedPages = Math.max(0, topic.pagesRead, attachedRead);
    } else if (topic.status === 'estudiado' || topic.status === 'repasado') {
      studiedPages = baseTotal;
    } else if (attachedRead > 0) {
      studiedPages = attachedRead;
    } else if (topic.reviewsHistory && topic.reviewsHistory.length > 0) {
      studiedPages = topic.reviewsHistory[topic.reviewsHistory.length - 1].pagesReviewed || 0;
    } else if (topic.status === 'en_progreso' && baseTotal > 0 && (topic.actualHoursSpent || 0) > 0) {
      const estRatio =
        topic.estimatedHours > 0
          ? Math.min(1, (topic.actualHoursSpent || 0) / topic.estimatedHours)
          : 0.35;
      studiedPages = Math.max(1, Math.round(baseTotal * estRatio));
    }

    const finalTotal = Math.max(baseTotal, studiedPages);
    const clampedStudied = finalTotal > 0 ? Math.min(finalTotal, studiedPages) : studiedPages;
    const studiedPct =
      finalTotal > 0 ? Math.min(100, Math.round((clampedStudied / finalTotal) * 100)) : 0;

    return {
      studiedPages: clampedStudied,
      totalPages: finalTotal,
      studiedPct,
      isPartiallyStudied: clampedStudied > 0 && clampedStudied < finalTotal,
    };
  },

  /**
   * Calcula el avance académico detallado de un tema integrando el conteo de páginas leídas
   * y recalculando el tiempo estimado restante para completarlo según la Velocidad de Lectura Promedio (págs/hora).
   */
  calculateTopicAcademicProgress(
    topic: Topic,
    preferences?: Partial<StudyPreferences>
  ): {
    pagesRead: number;
    totalPages: number;
    remainingPages: number;
    progressPct: number;
    isCompleted: boolean;
    isInProgress: boolean;
    totalHours: number;
    remainingHours: number;
    effectivePagesPerHour: number;
  } {
    const cfg = getStoredReadingSpeedConfig(preferences);
    const pageInfo = this.getTopicStudiedPages(topic, preferences);
    const totalPages = pageInfo.totalPages;
    const pagesRead = pageInfo.studiedPages;
    const remainingPages = Math.max(0, totalPages - pagesRead);
    const progressPct = pageInfo.studiedPct;
    const isCompleted =
      topic.status === 'estudiado' ||
      topic.status === 'repasado' ||
      (totalPages > 0 && pagesRead >= totalPages);
    const isInProgress = !isCompleted && (pagesRead > 0 || topic.status === 'en_progreso');

    const effectivePagesPerHour = getPagesPerHour(
      topic.difficulty || 'Media',
      cfg.readingSpeedPagesPerHour,
      cfg.useDifficultyScalingForPages,
      cfg.averageMinutesPerPage
    );

    const totalHours = this.getTopicDynamicEstimatedHours(topic, preferences);
    // Para temas pendientes o en progreso, recalculamos el tiempo estimado restante directamente
    // a partir de las páginas pendientes por leer y la Velocidad de Lectura Promedio (páginas por hora)
    let remainingHours = 0;
    if (!isCompleted) {
      if (remainingPages > 0) {
        const subtopicCount = topic.subtopics ? topic.subtopics.length : 0;
        const unreadRatio = totalPages > 0 ? remainingPages / totalPages : 1;
        const subtopicBonus = Math.max(0, subtopicCount - 3) * 0.15 * unreadRatio;
        const hoursByRemainingPages =
          remainingPages / Math.max(0.5, effectivePagesPerHour) + subtopicBonus;
        remainingHours = Math.max(0.2, Math.round(hoursByRemainingPages * 10) / 10);
      } else {
        remainingHours = Math.max(0, Math.round((totalHours - (topic.actualHoursSpent || 0)) * 10) / 10);
      }
    }

    return {
      pagesRead,
      totalPages,
      remainingPages,
      progressPct,
      isCompleted,
      isInProgress,
      totalHours,
      remainingHours,
      effectivePagesPerHour,
    };
  },

  /**
   * Calcula el avance académico de una asignatura integrando las páginas leídas de todos sus temas
   * y el tiempo estimado necesario para completar sus temas pendientes según la Velocidad de Lectura Promedio.
   */
  calculateSubjectAcademicProgress(
    topics: Topic[],
    preferences?: Partial<StudyPreferences>
  ): {
    pagesRead: number;
    totalPages: number;
    remainingPages: number;
    progressPct: number;
    totalTopics: number;
    completedTopics: number;
    inProgressTopics: number;
    pendingTopicsCount: number;
    totalHours: number;
    remainingHours: number;
  } {
    let pagesRead = 0;
    let totalPages = 0;
    let completedTopics = 0;
    let inProgressTopics = 0;
    let pendingTopicsCount = 0;
    let totalHours = 0;
    let remainingHours = 0;

    (topics || []).forEach((t) => {
      const tp = this.calculateTopicAcademicProgress(t, preferences);
      pagesRead += tp.pagesRead;
      totalPages += tp.totalPages;
      totalHours += tp.totalHours;
      remainingHours += tp.remainingHours;
      if (tp.isCompleted) {
        completedTopics += 1;
      } else {
        pendingTopicsCount += 1;
        if (tp.isInProgress) {
          inProgressTopics += 1;
        }
      }
    });

    const remainingPages = Math.max(0, totalPages - pagesRead);
    const progressPct =
      totalPages > 0
        ? Math.min(100, Math.round((pagesRead / totalPages) * 100))
        : topics.length > 0
        ? Math.round((completedTopics / topics.length) * 100)
        : 0;

    return {
      pagesRead,
      totalPages,
      remainingPages,
      progressPct,
      totalTopics: topics.length,
      completedTopics,
      inProgressTopics,
      pendingTopicsCount,
      totalHours: Math.round(totalHours * 10) / 10,
      remainingHours: Math.round(remainingHours * 10) / 10,
    };
  },

  /**
   * Calcula el avance académico global de múltiples asignaturas integrando el conteo de páginas leídas.
   */
  calculateGlobalAcademicProgress(
    subjects: Subject[],
    preferences?: Partial<StudyPreferences>
  ): {
    pagesRead: number;
    totalPages: number;
    remainingPages: number;
    overallProgressPct: number;
    totalTopics: number;
    completedTopics: number;
    inProgressTopics: number;
    pendingTopicsCount: number;
    totalHours: number;
    remainingHours: number;
  } {
    let pagesRead = 0;
    let totalPages = 0;
    let totalTopics = 0;
    let completedTopics = 0;
    let inProgressTopics = 0;
    let pendingTopicsCount = 0;
    let totalHours = 0;
    let remainingHours = 0;

    (subjects || []).forEach((sub) => {
      const sp = this.calculateSubjectAcademicProgress(sub.topics || [], preferences);
      pagesRead += sp.pagesRead;
      totalPages += sp.totalPages;
      totalTopics += sp.totalTopics;
      completedTopics += sp.completedTopics;
      inProgressTopics += sp.inProgressTopics;
      pendingTopicsCount += sp.pendingTopicsCount;
      totalHours += sp.totalHours;
      remainingHours += sp.remainingHours;
    });

    const remainingPages = Math.max(0, totalPages - pagesRead);
    const overallProgressPct =
      totalPages > 0
        ? Math.min(100, Math.round((pagesRead / totalPages) * 100))
        : totalTopics > 0
        ? Math.round((completedTopics / totalTopics) * 100)
        : 0;

    return {
      pagesRead,
      totalPages,
      remainingPages,
      overallProgressPct,
      totalTopics,
      completedTopics,
      inProgressTopics,
      pendingTopicsCount,
      totalHours: Math.round(totalHours * 10) / 10,
      remainingHours: Math.round(remainingHours * 10) / 10,
    };
  },

  /**
   * Calcula la duración estimada de un repaso en función del número de páginas estudiadas
   * y la dificultad del tema.
   */
  calculateTopicReviewTime(
    topic: Topic,
    customStudiedPages?: number,
    reviewCycle?: number
  ): {
    pagesToReview: number;
    totalPages: number;
    studiedPct: number;
    reviewMinutes: number;
    reviewHours: number;
    minutesPerPageReview: number;
  } {
    const pageInfo = this.getTopicStudiedPages(topic);
    const totalPages = pageInfo.totalPages;
    const pagesToReview =
      customStudiedPages !== undefined
        ? Math.max(0, customStudiedPages)
        : pageInfo.studiedPages > 0
        ? pageInfo.studiedPages
        : totalPages > 0
        ? totalPages
        : 10;

    const cycle = reviewCycle ?? Math.max(1, topic.reviewLevel || 1);
    const minutesPerPageReview = getReviewMinutesPerStudiedPage(topic.difficulty || 'Media', cycle);

    // Si hay páginas estudiadas, el tiempo de repaso es proporcional a esas páginas estudiadas
    const rawMinutes =
      pagesToReview > 0
        ? Math.round(pagesToReview * minutesPerPageReview)
        : topic.difficulty === 'Alta'
        ? 45
        : topic.difficulty === 'Media'
        ? 30
        : 20;

    const reviewMinutes = Math.max(10, Math.min(180, rawMinutes));
    const reviewHours = Math.max(0.2, Math.round((reviewMinutes / 60) * 100) / 100);
    const finalTotal = Math.max(totalPages, pagesToReview);
    const studiedPct =
      finalTotal > 0 ? Math.min(100, Math.round((pagesToReview / finalTotal) * 100)) : 100;

    return {
      pagesToReview,
      totalPages: finalTotal,
      studiedPct,
      reviewMinutes,
      reviewHours,
      minutesPerPageReview,
    };
  },

  /**
   * Calcula el tiempo total de estudio estimado y el tiempo estimado para completar los temas pendientes
   * de una asignatura usando la Velocidad de Lectura Promedio (páginas por hora) configurada en preferencias.
   */
  calculateSubjectEstimatedStudyHours(
    topics: Topic[],
    preferences?: Partial<StudyPreferences>
  ): {
    totalHours: number;
    totalEstimatedHours: number;
    pendingEstimatedHours: number;
    totalPages: number;
    pagesRead: number;
    totalPagesRead: number;
    pendingPages: number;
    pendingTopicsCount: number;
    readingSpeedPagesPerHour: number;
    averageMinutesPerPage: number;
    avgMinutesPerPage: number;
    configuredMinutesPerPage: number;
    pagesPerHour: number;
    topicsCount: number;
  } {
    const cfg = getStoredReadingSpeedConfig(preferences);
    let totalHours = 0;
    let pendingEstimatedHours = 0;
    let totalPages = 0;
    let totalPagesRead = 0;
    let pendingPages = 0;
    let pendingTopicsCount = 0;

    topics.forEach((t) => {
      const tp = this.calculateTopicAcademicProgress(t, preferences);
      totalPages += tp.totalPages;
      totalPagesRead += tp.pagesRead;
      totalHours += tp.totalHours;
      if (!tp.isCompleted) {
        pendingTopicsCount += 1;
        pendingPages += tp.remainingPages;
        pendingEstimatedHours += tp.remainingHours;
      }
    });

    const averageMinutesPerPage =
      totalPages > 0
        ? Math.round(((totalHours * 60) / totalPages) * 10) / 10
        : cfg.averageMinutesPerPage;

    const pagesPerHour =
      averageMinutesPerPage > 0
        ? Math.round((60 / averageMinutesPerPage) * 10) / 10
        : cfg.readingSpeedPagesPerHour;

    const roundedHours = Math.round(totalHours * 10) / 10;
    const roundedPendingHours = Math.round(pendingEstimatedHours * 10) / 10;

    return {
      totalHours: roundedHours,
      totalEstimatedHours: roundedHours,
      pendingEstimatedHours: roundedPendingHours,
      totalPages,
      pagesRead: totalPagesRead,
      totalPagesRead,
      pendingPages,
      pendingTopicsCount,
      readingSpeedPagesPerHour: cfg.readingSpeedPagesPerHour,
      averageMinutesPerPage,
      avgMinutesPerPage: averageMinutesPerPage,
      configuredMinutesPerPage: cfg.averageMinutesPerPage,
      pagesPerHour,
      topicsCount: topics.length,
    };
  },

  /**
   * Calcula el desglose por asignatura del tiempo estimado necesario para completar los temas pendientes
   * según la 'Velocidad de Lectura Promedio' (páginas por hora) configurada por el usuario.
   */
  calculatePendingTopicsBySubject(
    subjects: Subject[],
    preferences?: Partial<StudyPreferences>
  ): {
    readingSpeedPagesPerHour: number;
    configuredMinutesPerPage: number;
    totalPendingTopics: number;
    totalPendingPages: number;
    totalPendingEstimatedHours: number;
    subjectBreakdowns: Array<{
      subjectId: string;
      subjectName: string;
      subjectColor: string;
      totalTopics: number;
      pendingTopicsCount: number;
      completedTopicsCount: number;
      totalPages: number;
      pagesRead: number;
      pendingPages: number;
      pendingEstimatedHours: number;
      totalEstimatedHours: number;
      progressPct: number;
    }>;
  } {
    const cfg = getStoredReadingSpeedConfig(preferences);
    let totalPendingTopics = 0;
    let totalPendingPages = 0;
    let totalPendingEstimatedHours = 0;

    const subjectBreakdowns = (subjects || []).map((sub) => {
      const stats = this.calculateSubjectEstimatedStudyHours(sub.topics || [], preferences);
      const prog = this.calculateSubjectAcademicProgress(sub.topics || [], preferences);

      totalPendingTopics += stats.pendingTopicsCount;
      totalPendingPages += stats.pendingPages;
      totalPendingEstimatedHours += stats.pendingEstimatedHours;

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectColor: sub.color || '#3b82f6',
        totalTopics: prog.totalTopics,
        pendingTopicsCount: stats.pendingTopicsCount,
        completedTopicsCount: prog.completedTopics,
        totalPages: stats.totalPages,
        pagesRead: stats.pagesRead,
        pendingPages: stats.pendingPages,
        pendingEstimatedHours: stats.pendingEstimatedHours,
        totalEstimatedHours: stats.totalEstimatedHours,
        progressPct: prog.progressPct,
      };
    });

    return {
      readingSpeedPagesPerHour: cfg.readingSpeedPagesPerHour,
      configuredMinutesPerPage: cfg.averageMinutesPerPage,
      totalPendingTopics,
      totalPendingPages,
      totalPendingEstimatedHours: Math.round(totalPendingEstimatedHours * 10) / 10,
      subjectBreakdowns,
    };
  },

  /**
   * Recalcula las horas estimadas (estimatedHours) de todos los temas (especialmente los temas pendientes)
   * de una lista de asignaturas aplicando el número de páginas por tema y la Velocidad de Lectura Promedio (págs/hora).
   */
  recalculateSubjectsByReadingSpeed(
    subjects: Subject[],
    preferences: Partial<StudyPreferences>
  ): {
    updatedSubjects: Subject[];
    updatedTopicsCount: number;
    pendingTopicsCount: number;
    totalPagesCount: number;
    pendingPagesCount: number;
    totalEstimatedHours: number;
    pendingEstimatedHours: number;
  } {
    let updatedTopicsCount = 0;
    let pendingTopicsCount = 0;
    let totalPagesCount = 0;
    let pendingPagesCount = 0;
    let totalEstimatedHours = 0;
    let pendingEstimatedHours = 0;

    const updatedSubjects = subjects.map((sub) => {
      const updatedTopics = (sub.topics || []).map((topic) => {
        const effPages = this.getTopicEffectivePages(topic);
        const tp = this.calculateTopicAcademicProgress(topic, preferences);
        totalPagesCount += tp.totalPages;
        const newEstimatedHours = tp.totalHours;
        totalEstimatedHours += newEstimatedHours;

        if (!tp.isCompleted) {
          pendingTopicsCount++;
          pendingPagesCount += tp.remainingPages;
          pendingEstimatedHours += tp.remainingHours;
        }

        if (Math.abs((topic.estimatedHours || 0) - newEstimatedHours) >= 0.05) {
          updatedTopicsCount++;
        }
        return {
          ...topic,
          pageCount: effPages > 0 ? effPages : topic.pageCount,
          paginasTotales: effPages > 0 ? effPages : topic.paginasTotales,
          estimatedHours: newEstimatedHours,
        };
      });

      return {
        ...sub,
        topics: updatedTopics,
      };
    });

    return {
      updatedSubjects,
      updatedTopicsCount,
      pendingTopicsCount,
      totalPagesCount,
      pendingPagesCount,
      totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
      pendingEstimatedHours: Math.round(pendingEstimatedHours * 10) / 10,
    };
  },

  /**
   * Recalcula las horas estimadas (estimatedHours) de todos los temas en todos los programas de estudio
   * en base al número de páginas por tema y la Velocidad de Lectura Promedio (páginas por hora) configurada por el usuario.
   */
  recalculateProgramsByReadingSpeed(
    programs: StudyProgram[],
    preferences: Partial<StudyPreferences>
  ): {
    updatedPrograms: StudyProgram[];
    updatedTopicsCount: number;
    pendingTopicsCount: number;
    totalPagesCount: number;
    pendingPagesCount: number;
    totalEstimatedHours: number;
    pendingEstimatedHours: number;
  } {
    let updatedTopicsCount = 0;
    let pendingTopicsCount = 0;
    let totalPagesCount = 0;
    let pendingPagesCount = 0;
    let totalEstimatedHours = 0;
    let pendingEstimatedHours = 0;

    const updatedPrograms = programs.map((prog) => ({
      ...prog,
      years: prog.years.map((year) => {
        const res = this.recalculateSubjectsByReadingSpeed(year.subjects, preferences);
        updatedTopicsCount += res.updatedTopicsCount;
        pendingTopicsCount += res.pendingTopicsCount;
        totalPagesCount += res.totalPagesCount;
        pendingPagesCount += res.pendingPagesCount;
        totalEstimatedHours += res.totalEstimatedHours;
        pendingEstimatedHours += res.pendingEstimatedHours;
        return {
          ...year,
          subjects: res.updatedSubjects,
        };
      }),
    }));

    return {
      updatedPrograms,
      updatedTopicsCount,
      pendingTopicsCount,
      totalPagesCount,
      pendingPagesCount,
      totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
      pendingEstimatedHours: Math.round(pendingEstimatedHours * 10) / 10,
    };
  },

  /**
   * Calcula automáticamente la disponibilidad real de estudio diaria
   * restando los compromisos fijos semanales (clase, trabajo, gimnasio...)
   * de una jornada despierta estándar (~16h).
   */
  calculateDailyAvailableHoursFromObligations(
    obligations: WeeklyObligation[] = [],
    wakingHours = 15.5
  ): Record<number, number> {
    const result: Record<number, number> = {
      0: 0, // Domingo por defecto descanso / repaso suave
      1: 4.0,
      2: 4.0,
      3: 4.0,
      4: 4.0,
      5: 3.5,
      6: 5.0,
    };

    // Agrupamos obligaciones por día de la semana (0 a 6)
    const dayOccupiedHours: Record<number, number> = {
      0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
    };

    obligations.forEach((ob) => {
      let duration = ob.durationHours;
      if (!duration && ob.startTime && ob.endTime) {
        const startM = timeStrToMinutes(ob.startTime);
        const endM = timeStrToMinutes(ob.endTime);
        duration = Math.max(0, (endM - startM) / 60);
      }
      dayOccupiedHours[ob.dayOfWeek] = (dayOccupiedHours[ob.dayOfWeek] || 0) + (duration || 0);
    });

    for (let day = 0; day <= 6; day++) {
      const occupied = dayOccupiedHours[day] || 0;
      if (occupied > 0) {
        // Dejamos 2h para comidas, desplazamientos e higiene personal
        const freeTime = Math.max(0, wakingHours - occupied - 2.0);
        // Sugerencia pedagógica: entre 1h y 6h diarias de concentración efectiva
        const studyTime = Math.max(1.0, Math.min(8.0, Math.round(freeTime * 0.7 * 10) / 10));
        result[day] = studyTime;
      }
    }

    return result;
  },

  /**
   * Calcula la siguiente fecha de repaso según la curva del olvido:
   * - 1er repaso: 24 horas (1 día) de haber estudiado
   * - 2º repaso: A los 3 días
   * - 3º repaso: A la semana (7 días)
   * - 4º repaso: A los 15 días
   * - 5º repaso: Al mes (30 días)
   * Y ajusta el intervalo adelantando el repaso si hay errores o baja retención,
   * o espaciándolo un poco más si la retención demostrada/percibida es muy alta.
   */
  getNextSpacedReview(
    currentLevel: number,
    quality: ReviewQuality,
    options?: SpacedReviewAdjustmentOptions
  ): SpacedReviewCalculationResult {
    const errorsCount = Math.max(0, options?.errorsCount || 0);
    const defaultRetentionByQuality: Record<ReviewQuality, number> = {
      repetir: 35,
      dificil: 58,
      bien: 80,
      facil: 95,
    };
    const rawRetention =
      options?.retentionPct !== undefined
        ? Math.max(0, Math.min(100, options.retentionPct))
        : defaultRetentionByQuality[quality];

    // Penalizar retención efectiva si se han cometido fallos en el repaso
    const effectiveRetention = Math.max(15, rawRetention - errorsCount * 8);

    let newLevel = currentLevel;
    if (quality === 'repetir' || effectiveRetention < 45 || errorsCount >= 4) {
      newLevel = 1; // Reinicia al 1er repaso (24 horas) por baja retención / muchos fallos
    } else if (quality === 'dificil' || effectiveRetention < 65 || errorsCount >= 2) {
      // Mantiene el ciclo actual o retrocede un escalón si estaba alto para afianzar antes
      newLevel = Math.max(1, currentLevel > 2 && errorsCount >= 2 ? currentLevel - 1 : currentLevel);
    } else if (quality === 'bien') {
      newLevel = Math.min(SPACED_INTERVALS_DAYS.length, Math.max(0, currentLevel) + 1);
    } else if (quality === 'facil') {
      newLevel = Math.min(SPACED_INTERVALS_DAYS.length, Math.max(0, currentLevel) + 1);
    }

    const baseIntervalDays =
      SPACED_INTERVALS_DAYS[Math.min(SPACED_INTERVALS_DAYS.length - 1, Math.max(0, newLevel - 1))] || 1;

    // Ajuste dinámico según errores y retención demostrada o percibida
    let multiplier = 1.0;
    let adjustmentNote = `Curva estándar · ${FORGETTING_CURVE_SCHEDULE[Math.max(0, newLevel - 1)]?.label || `${baseIntervalDays}d`}`;

    if (quality === 'repetir' || effectiveRetention < 45 || errorsCount >= 4) {
      multiplier = 1.0; // Ya se reinició a nivel 1 (24 horas = 1 día)
      adjustmentNote =
        errorsCount > 0
          ? `Repaso adelantado a 24h (${errorsCount} ${errorsCount === 1 ? 'error' : 'errores'} · retención ${effectiveRetention}%)`
          : `Repaso adelantado a 24h por baja retención (${effectiveRetention}%)`;
    } else if (quality === 'dificil' || effectiveRetention < 68 || errorsCount > 0) {
      // Adelantar el repaso entre un 25% y un 50% según los errores y la baja retención
      const errorPenalty = Math.min(0.35, errorsCount * 0.12);
      const retentionPenalty = effectiveRetention < 68 ? (68 - effectiveRetention) * 0.01 : 0.15;
      multiplier = Math.max(0.45, 1.0 - Math.max(0.25, errorPenalty + retentionPenalty));
      adjustmentNote =
        errorsCount > 0
          ? `Repaso adelantado por ${errorsCount} ${errorsCount === 1 ? 'fallo' : 'fallos'} y retención del ${effectiveRetention}%`
          : `Repaso adelantado por retención moderada-baja (${effectiveRetention}%)`;
    } else if ((quality === 'facil' || effectiveRetention >= 88) && errorsCount === 0) {
      // Espaciar el repaso un poco más (+25% a +35%) cuando la retención es muy alta y sin errores
      const bonus = effectiveRetention >= 94 ? 1.35 : 1.25;
      multiplier = bonus;
      adjustmentNote = `Repaso espaciado (+${Math.round((bonus - 1) * 100)}% días) por alta retención (${effectiveRetention}%) sin errores`;
    }

    // Ajuste adicional teniendo en cuenta el número de páginas estudiadas
    const studiedPages = options?.studiedPages;
    const totalPages = options?.totalPages;
    const difficulty = options?.difficulty || 'Media';

    if (studiedPages !== undefined && studiedPages > 0) {
      // Si el volumen de páginas estudiadas a repasar es muy extenso (>= 30 págs) y la calidad no fue 'facil',
      // acortamos ligeramente el intervalo para consolidar bloques densos de páginas sin olvido.
      if (studiedPages >= 30 && quality !== 'facil' && multiplier >= 0.9) {
        multiplier *= 0.85;
      } else if (
        totalPages &&
        totalPages > 0 &&
        studiedPages < totalPages &&
        studiedPages / totalPages < 0.5 &&
        multiplier > 1.0
      ) {
        // Si se ha estudiado menos del 50% de las páginas del tema, moderar el espaciado hasta completar más páginas
        multiplier = Math.min(multiplier, 1.0);
      }
    }

    let adjustedIntervalDays = Math.max(1, Math.round(baseIntervalDays * multiplier));
    // Si se espacia por alta retención en el 1er repaso (base 1d), asegurar que suba al menos a 2 días
    if (multiplier > 1.1 && adjustedIntervalDays === baseIntervalDays) {
      adjustedIntervalDays = baseIntervalDays + 1;
    }
    // Si se adelanta por baja retención/errores en ciclos >= 2 (3d, 7d, 15d, 30d), asegurar que se reduzca al menos 1 día
    if (multiplier < 0.9 && baseIntervalDays > 1 && adjustedIntervalDays === baseIntervalDays) {
      adjustedIntervalDays = Math.max(1, baseIntervalDays - 1);
    }

    const estimatedReviewMinutes =
      studiedPages && studiedPages > 0
        ? Math.max(10, Math.round(studiedPages * getReviewMinutesPerStudiedPage(difficulty, newLevel)))
        : undefined;

    if (studiedPages !== undefined && studiedPages > 0) {
      const pagesTag =
        totalPages && totalPages > 0
          ? `${studiedPages}/${totalPages} págs. estudiadas`
          : `${studiedPages} págs. estudiadas`;
      adjustmentNote = `${adjustmentNote} · Repaso de ${pagesTag}${
        estimatedReviewMinutes ? ` (~${estimatedReviewMinutes} min)` : ''
      }`;
    }

    const baseDate = options?.baseDateStr ? new Date(`${options.baseDateStr}T12:00:00`) : new Date();
    baseDate.setDate(baseDate.getDate() + adjustedIntervalDays);
    const nextDate = baseDate.toISOString().split('T')[0];

    return {
      nextDate,
      nextLevel: newLevel,
      baseIntervalDays,
      adjustedIntervalDays,
      adjustmentNote,
      inferredRetentionPct: effectiveRetention,
      pagesReviewed: studiedPages,
      totalPages,
      estimatedReviewMinutes,
    };
  },

  /**
   * Permite adelantar o espaciar directamente el próximo repaso de un tema
   * según los errores cometidos, la retención percibida/demostrada y el número de páginas estudiado.
   */
  adjustTopicReviewSchedule(
    topic: Topic,
    mode: 'adelantar_baja_retencion' | 'espaciar_alta_retencion' | 'restaurar_curva',
    customOptions?: { errorsCount?: number; retentionPct?: number; studiedPages?: number }
  ): {
    nextReviewDate: string;
    reviewLevel: number;
    perceivedRetentionPct: number;
    unresolvedErrorsCount: number;
    lastIntervalDays: number;
    lastAdjustmentReason: string;
    studiedPages: number;
    totalPages: number;
  } {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentLevel = Math.min(5, Math.max(1, topic.reviewLevel || 1));
    const baseCurveDays = SPACED_INTERVALS_DAYS[currentLevel - 1] || 1;
    const currentNextDate = topic.nextReviewDate && topic.nextReviewDate >= todayStr ? topic.nextReviewDate : todayStr;

    const pageInfo = this.getTopicStudiedPages(topic);
    const studiedPages =
      customOptions?.studiedPages !== undefined ? customOptions.studiedPages : pageInfo.studiedPages;
    const totalPages = Math.max(pageInfo.totalPages, studiedPages);
    const pagesSummary =
      totalPages > 0 ? ` [${studiedPages}/${totalPages} págs. estudiadas]` : '';

    const [y1, m1, d1] = todayStr.split('-').map(Number);
    const [y2, m2, d2] = currentNextDate.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    const currentRemainingDays = Math.max(1, Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24)));

    if (mode === 'adelantar_baja_retencion') {
      const errs = customOptions?.errorsCount ?? Math.max(1, (topic.unresolvedErrorsCount || 0) + 1);
      const retPct = customOptions?.retentionPct ?? Math.max(35, (topic.perceivedRetentionPct ?? 65) - 20);
      // Adelantamos el repaso reduciendo los días restantes a la mitad (o a mañana = 1 día / 24h si es crítico)
      const newDays = retPct <= 45 || errs >= 3 ? 1 : Math.max(1, Math.floor(Math.min(currentRemainingDays, baseCurveDays) * 0.6));
      const target = new Date();
      target.setDate(target.getDate() + newDays);
      const nextReviewDate = target.toISOString().split('T')[0];

      return {
        nextReviewDate,
        reviewLevel: currentLevel,
        perceivedRetentionPct: retPct,
        unresolvedErrorsCount: errs,
        lastIntervalDays: newDays,
        lastAdjustmentReason: `Adelantado a +${newDays}d (${newDays === 1 ? '24h' : `${newDays} días`}) por baja retención (${retPct}%) / ${errs} ${errs === 1 ? 'error' : 'errores'}${pagesSummary}`,
        studiedPages,
        totalPages,
      };
    }

    if (mode === 'espaciar_alta_retencion') {
      const errs = customOptions?.errorsCount ?? 0;
      const retPct = customOptions?.retentionPct ?? Math.min(98, Math.max(88, (topic.perceivedRetentionPct ?? 82) + 12));
      // Espaciamos el repaso un +30% (mínimo +2 días adicionales sobre el intervalo actual o base)
      const baseRef = Math.max(currentRemainingDays, baseCurveDays);
      const extraDays = Math.max(2, Math.round(baseRef * 0.3));
      const newDays = baseRef + extraDays;
      const target = new Date();
      target.setDate(target.getDate() + newDays);
      const nextReviewDate = target.toISOString().split('T')[0];

      return {
        nextReviewDate,
        reviewLevel: currentLevel,
        perceivedRetentionPct: retPct,
        unresolvedErrorsCount: errs,
        lastIntervalDays: newDays,
        lastAdjustmentReason: `Espaciado a +${newDays} días (+${extraDays}d extra) por alta retención demostrada (${retPct}%)${pagesSummary}`,
        studiedPages,
        totalPages,
      };
    }

    // restaurar_curva: devuelve el repaso al intervalo exacto de la curva del olvido (1d, 3d, 7d, 15d, 30d)
    const target = new Date();
    target.setDate(target.getDate() + baseCurveDays);
    const nextReviewDate = target.toISOString().split('T')[0];
    return {
      nextReviewDate,
      reviewLevel: currentLevel,
      perceivedRetentionPct: 80,
      unresolvedErrorsCount: 0,
      lastIntervalDays: baseCurveDays,
      lastAdjustmentReason: `Ajustado a la curva estándar (${FORGETTING_CURVE_SCHEDULE[currentLevel - 1]?.label})${pagesSummary}`,
      studiedPages,
      totalPages,
    };
  },

  /**
   * Relaciona las tareas pendientes de la semana (próximos 7 días) con los temas de la asignatura
   * para priorizar su estudio y programar su repaso durante la semana antes de la fecha de entrega.
   */
  matchWeeklyTasksToTopics(
    topics: Topic[],
    tasks: Task[] = [],
    todayStr: string
  ): Map<string, { task: Task; targetDateStr: string }> {
    const result = new Map<string, { task: Task; targetDateStr: string }>();
    if (!tasks || tasks.length === 0 || !topics || topics.length === 0) return result;

    const startObj = parseLocalDate(todayStr);
    const weekEndObj = new Date(startObj);
    weekEndObj.setDate(weekEndObj.getDate() + 7);
    const weekEndStr = toLocalDateStr(weekEndObj);

    const normalize = (str: string) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    // Tareas activas cuya entrega es esta semana (entre hoy y +7 días)
    const weeklyTasks = tasks
      .filter((tk) => !tk.completed && tk.dueDate && tk.dueDate >= todayStr && tk.dueDate <= weekEndStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (weeklyTasks.length === 0) return result;

    const stopWords = new Set([
      'para',
      'como',
      'este',
      'esta',
      'estos',
      'estas',
      'sobre',
      'entre',
      'desde',
      'hasta',
      'hacer',
      'entrega',
      'tarea',
      'practica',
      'ejercicio',
      'ejercicios',
      'semana',
      'semanal',
      'repaso',
      'estudio',
    ]);

    weeklyTasks.forEach((task) => {
      const normTask = normalize(task.title);
      const taskWords = normTask
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !stopWords.has(w));

      // Extraer menciones numéricas tipo "tema 2", "unidad 3", "bloque 1", "t2"
      const numMatch = normTask.match(/(?:tema|unidad|bloque|cap|leccion|t)\s*(\d+)/);
      const explicitTopicNum = numMatch ? parseInt(numMatch[1], 10) : null;

      // Fecha objetivo ideal para revisar el tema: 1 día antes de la tarea (o hoy si vence hoy/mañana)
      const dueObj = parseLocalDate(task.dueDate);
      dueObj.setDate(dueObj.getDate() - 1);
      const dayBeforeTaskStr = toLocalDateStr(dueObj);
      const targetDateStr = dayBeforeTaskStr >= todayStr ? dayBeforeTaskStr : todayStr;

      const matchedTopics: Topic[] = [];

      topics.forEach((topic, idx) => {
        const normTopic = normalize(
          `${topic.title} ${(topic.subtopics || []).join(' ')} ${topic.description || ''}`
        );

        let isMatch = false;
        if (explicitTopicNum !== null) {
          const topicNumMatch = normalize(topic.title).match(/(?:tema|unidad|bloque|t)?\s*(\d+)/);
          const thisNum = topicNumMatch ? parseInt(topicNumMatch[1], 10) : idx + 1;
          if (thisNum === explicitTopicNum) {
            isMatch = true;
          }
        }

        if (!isMatch && taskWords.length > 0) {
          const hit = taskWords.some((w) => normTopic.includes(w));
          if (hit) isMatch = true;
        }

        if (isMatch) {
          matchedTopics.push(topic);
        }
      });

      // Si la tarea de esta semana es general de la asignatura (no menciona un tema concreto),
      // vinculamos los temas en progreso/estudiados recientemente (hasta 2) y el próximo tema pendiente
      if (matchedTopics.length === 0) {
        const activeOrStudied = topics.filter(
          (t) => t.status === 'en_progreso' || t.status === 'estudiado' || t.status === 'repasado'
        );
        if (activeOrStudied.length > 0) {
          matchedTopics.push(...activeOrStudied.slice(-2));
        }
        const firstPending = topics.find(
          (t) => t.status === 'pendiente' || t.status === 'en_progreso'
        );
        if (firstPending && !matchedTopics.some((m) => m.id === firstPending.id)) {
          matchedTopics.push(firstPending);
        }
      }

      matchedTopics.forEach((mt) => {
        const existing = result.get(mt.id);
        if (!existing || targetDateStr < existing.targetDateStr) {
          result.set(mt.id, { task, targetDateStr });
        }
      });
    });

    return result;
  },

  /**
   * Genera el calendario de sesiones de estudio inteligentes
   * distribuyendo temario y repasos espaciados según los días y horas disponibles,
   * respetando los bloques de tiempo personales, citas añadidas y priorizando los temas
   * vinculados a tareas que vencen esa semana.
   */
  generateSmartSchedule(
    topics: Topic[],
    subjectId: string,
    subjectName: string,
    subjectColor: string,
    exams: Exam[],
    preferences: StudyPreferences,
    startDateStr?: string,
    blockedEvents?: BlockedTimeEvent[],
    tasks?: Task[]
  ): {
    sessions: ScheduledStudySession[];
    updatedTopics: Topic[];
    projectedCompletionDate: string;
    isAheadOfExam: boolean;
    deficitHours: number;
    taskPrioritizedCount?: number;
  } {
    const today = startDateStr ? parseLocalDate(startDateStr) : new Date();
    const todayStr = toLocalDateStr(today);
    const availableDaysSet = new Set(preferences.availableDays);
    const hoursPerDay = preferences.hoursPerDay;
    const defaultStartHour = preferences.studyDayStartHour || 9;

    // Próximo examen relevante para esta asignatura
    const upcomingExam = exams
      .filter((e) => !e.completed && new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    const examDate = upcomingExam ? new Date(upcomingExam.date) : null;

    // Identificar temas asociados a tareas que hay que entregar esta semana
    const weeklyTaskMap = this.matchWeeklyTasksToTopics(topics, tasks || [], todayStr);
    let taskPrioritizedCount = 0;

    // Clonamos temas y recalculamos su tiempo estimado (estimatedHours) usando el nº de páginas por tema
    // y la velocidad de lectura promedio por página configurada en las preferencias del usuario
    const updatedTopics = topics.map((t) => {
      const effPages = this.getTopicEffectivePages(t);
      const dynamicEstHours = this.calculateTopicTime(
        t.difficulty || 'Media',
        t.subtopics ? t.subtopics.length : 0,
        (t.notes || t.generalNotes || t.description || '').length,
        effPages > 0 ? effPages : undefined,
        preferences
      );

      const matchedTaskInfo = weeklyTaskMap.get(t.id);
      const pInfo = this.getTopicStudiedPages(t, preferences);
      const isStudiedOrHasReadPages =
        t.status === 'estudiado' ||
        t.status === 'repasado' ||
        pInfo.studiedPages > 0;

      // REGLA ESTRICTA: Los repasos espaciados (1, 3, 7, 15, 30 días) SOLO existen para temas o páginas marcadas como estudiadas/leídas
      let nextReviewDate = isStudiedOrHasReadPages ? t.nextReviewDate : undefined;
      let studiedAt = isStudiedOrHasReadPages ? t.studiedAt || todayStr : undefined;
      let reviewLevel = isStudiedOrHasReadPages ? Math.max(1, t.reviewLevel || 1) : 0;
      let lastAdjustmentReason = t.lastAdjustmentReason;

      if (isStudiedOrHasReadPages && !nextReviewDate) {
        const customInts = preferences?.spacedRepetitionConfig?.intervals || [1, 3, 7, 15, 30];
        const firstInt = customInts[Math.min(customInts.length - 1, Math.max(0, reviewLevel - 1))] || 1;
        const anchorObj = parseLocalDate(studiedAt || todayStr);
        anchorObj.setDate(anchorObj.getDate() + firstInt);
        nextReviewDate = toLocalDateStr(anchorObj);
      }

      if (matchedTaskInfo) {
        taskPrioritizedCount++;
        if (isStudiedOrHasReadPages) {
          if (!nextReviewDate || nextReviewDate > matchedTaskInfo.task.dueDate || nextReviewDate < todayStr) {
            nextReviewDate = matchedTaskInfo.targetDateStr;
          }
          lastAdjustmentReason = `Repaso priorizado para tarea "${matchedTaskInfo.task.title}" (entrega ${matchedTaskInfo.task.dueDate})`;
        } else {
          lastAdjustmentReason = `Lectura diaria priorizada para llegar a tarea "${matchedTaskInfo.task.title}" (${matchedTaskInfo.task.dueDate})`;
        }
      }

      return {
        ...t,
        pageCount: effPages > 0 ? effPages : pInfo.totalPages,
        paginasTotales: effPages > 0 ? effPages : pInfo.totalPages,
        estimatedHours: dynamicEstHours,
        studiedAt,
        reviewLevel,
        nextReviewDate,
        lastAdjustmentReason,
      };
    });

    const sessions: ScheduledStudySession[] = [];
    const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);

    // Mapear TODAS las tareas pendientes (no solo las de esta semana) para saber qué temas requieren terminarse antes de una entrega
    const pendingTasks = (tasks || [])
      .filter((tk) => !tk.completed && tk.dueDate >= todayStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const topicDeadlineMap = new Map<
      string,
      { type: 'task' | 'exam'; title: string; dueDate: string; targetStudyDate: string }
    >();

    updatedTopics.forEach((topic) => {
      // 1. Buscar tarea vinculada directamente o por título/subtema
      const linkedTask =
        weeklyTaskMap.get(topic.id)?.task ||
        pendingTasks.find((tk) => {
          if (tk.topicId && tk.topicId === topic.id) return true;
          const tLower = `${tk.title} ${tk.subtopic || ''}`.toLowerCase();
          const topLower = topic.title.toLowerCase();
          return tLower.includes(topLower) || topLower.includes(tk.title.toLowerCase());
        });

      if (linkedTask) {
        const dueObj = parseLocalDate(linkedTask.dueDate);
        dueObj.setDate(dueObj.getDate() - 1);
        const targetStr = toLocalDateStr(dueObj) >= todayStr ? toLocalDateStr(dueObj) : linkedTask.dueDate;
        topicDeadlineMap.set(topic.id, {
          type: 'task',
          title: linkedTask.title,
          dueDate: linkedTask.dueDate,
          targetStudyDate: targetStr,
        });
        return;
      }

      // 2. Buscar examen próximo que incluya este tema o sea general de la materia
      const matchingExam =
        exams
          .filter(
            (e) =>
              !e.completed &&
              e.date >= todayStr &&
              (!e.topicIds || e.topicIds.length === 0 || e.topicIds.includes(topic.id))
          )
          .sort((a, b) => a.date.localeCompare(b.date))[0] || upcomingExam;

      if (matchingExam && matchingExam.date >= todayStr) {
        const exObj = parseLocalDate(matchingExam.date);
        exObj.setDate(exObj.getDate() - 1);
        const targetStr = toLocalDateStr(exObj) >= todayStr ? toLocalDateStr(exObj) : matchingExam.date;
        topicDeadlineMap.set(topic.id, {
          type: 'exam',
          title: matchingExam.title,
          dueDate: matchingExam.date,
          targetStudyDate: targetStr,
        });
      }
    });

    // Cola de temas que aún tienen páginas pendientes por estudiar (o que tienen sesiones extra elegidas por el usuario)
    const allPendingClones = updatedTopics
      .filter((t) => {
        const pInfo = this.getTopicStudiedPages(t, preferences);
        const hasUnreadPages = pInfo.studiedPages < pInfo.totalPages;
        const hasExtraSessions =
          t.extraStudySessionsByDate && Object.keys(t.extraStudySessionsByDate).length > 0;
        return (
          (t.status !== 'repasado' && t.status !== 'estudiado' && hasUnreadPages) ||
          Boolean(hasExtraSessions)
        );
      })
      .map((t) => {
        const pInfo = this.getTopicStudiedPages(t, preferences);
        return {
          ...t,
          _totalPages: pInfo.totalPages,
          _simulatedHoursSpent: t.actualHoursSpent || 0,
          _simulatedPagesRead: Math.min(pInfo.totalPages, pInfo.studiedPages),
        };
      });

    // Mantener todos los temas pendientes en su orden lógico sin extraerlos a otra lista (evita que aparezca otro tema o se duplique al cambiar la hora de inicio)
    const pendingTopics = [...allPendingClones].sort((a, b) => {
      const dlA = topicDeadlineMap.get(a.id);
      const dlB = topicDeadlineMap.get(b.id);
      if (dlA && !dlB) return -1;
      if (!dlA && dlB) return 1;
      if (dlA && dlB && dlA.targetStudyDate !== dlB.targetStudyDate) {
        return dlA.targetStudyDate.localeCompare(dlB.targetStudyDate);
      }
      return 0;
    });

    // Contar días de estudio disponibles hasta la fecha límite (examen o entrega) para garantizar que el ritmo diario de páginas llegue a tiempo
    const countAvailableStudyDaysBetween = (fromStr: string, toStr: string): number => {
      if (toStr <= fromStr) return 1;
      const cur = parseLocalDate(fromStr);
      const end = parseLocalDate(toStr);
      let count = 0;
      let guard = 0;
      while (cur <= end && guard < 180) {
        guard++;
        if (availableDaysSet.has(cur.getDay())) {
          count++;
        }
        cur.setDate(cur.getDate() + 1);
      }
      return Math.max(1, count);
    };

    const totalRemainingPagesAllPending = pendingTopics.reduce(
      (sum, pt) => sum + Math.max(0, pt._totalPages - pt._simulatedPagesRead),
      0
    );

    const earliestExamDateStr = upcomingExam ? upcomingExam.date : null;
    const availableDaysBeforeExam = earliestExamDateStr
      ? countAvailableStudyDaysBetween(todayStr, earliestExamDateStr)
      : 14;
    const minSubjectPagesPerDayForExam =
      totalRemainingPagesAllPending > 0
        ? Math.max(1, Math.ceil(totalRemainingPagesAllPending / Math.max(1, availableDaysBeforeExam)))
        : 0;

    // Conjunto de fechas que tienen sesiones extra añadidas manualmente por el usuario ("+ Añadir tema")
    const extraSessionDatesSet = new Set<string>();
    pendingTopics.forEach((pt) => {
      if (pt.extraStudySessionsByDate) {
        Object.keys(pt.extraStudySessionsByDate).forEach((d) => extraSessionDatesSet.add(d));
      }
    });

    // Cola de repasos espaciados: ESTRICTAMENTE SOLO temas marcados como estudiados/repasados o con páginas leídas > 0
    const spacedReviews = updatedTopics
      .filter((t) => {
        const pInfo = this.getTopicStudiedPages(t, preferences);
        return (
          t.status === 'estudiado' ||
          t.status === 'repasado' ||
          pInfo.studiedPages > 0
        );
      })
      .sort((a, b) => {
        const taskA = weeklyTaskMap.get(a.id);
        const taskB = weeklyTaskMap.get(b.id);
        if (taskA && !taskB) return -1;
        if (!taskA && taskB) return 1;
        return (a.nextReviewDate || '').localeCompare(b.nextReviewDate || '');
      });

    let topicIdx = 0;
    let daysEvaluated = 0;
    const maxDays = 120; // Límite de proyección a 4 meses

    // Bucle para distribuir sesiones en días disponibles (o días con temas extra elegidos por el usuario)
    while (
      (topicIdx < pendingTopics.length ||
        spacedReviews.length > 0 ||
        extraSessionDatesSet.size > 0) &&
      daysEvaluated < maxDays
    ) {
      const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 1 = Lunes...
      const dateStr = toLocalDateStr(currentDate);
      const hasUserExtraToday = extraSessionDatesSet.has(dateStr);

      if (availableDaysSet.has(dayOfWeek) || hasUserExtraToday) {
        extraSessionDatesSet.delete(dateStr);

        // Ignorar bloques antiguos vinculados a temas (block-topic-*) para que nunca dupliquen ni resten horas del tema
        const nonTopicBlockedEvents = (blockedEvents || []).filter(
          (e) =>
            e.linkedItemType !== 'topic' &&
            !(e.id && e.id.startsWith('block-topic-'))
        );

        // Bloqueos en esta fecha: combina citas puntuales (date === dateStr), bloqueos recurrentes semanales y weeklyFixedObligations
        const specificDateBlocked = nonTopicBlockedEvents.filter((e) => e.date === dateStr);
        const recurringBlocked = nonTopicBlockedEvents.filter(
          (e) => !e.date && e.recurringDays && e.recurringDays.includes(dayOfWeek)
        );
        const fixedObligationsToday = (preferences.weeklyFixedObligations || [])
          .filter(
            (ob) =>
              ob.dayOfWeek === dayOfWeek ||
              (ob.recurringDays && ob.recurringDays.includes(dayOfWeek))
          )
          .map((ob) => ({
            id: ob.id,
            title: ob.title,
            startTime: ob.startTime,
            endTime: ob.endTime,
            category: ob.category,
          }));

        // Sesiones ya creadas en este día también ocupan su tramo horario
        const manualSessionsToday = sessions
          .filter((s) => s.date === dateStr && s.startTime && s.endTime)
          .map((s) => ({
            id: s.id,
            title: s.topicTitle,
            startTime: s.startTime!,
            endTime: s.endTime!,
            category: 'otro',
          }));

        // Unificar intervalos bloqueados evitando duplicar obligaciones idénticas en la misma franja
        const seenRanges = new Set<string>();
        const dateBlocked: Array<{ startTime: string; endTime: string; title?: string; isSpecificDate?: boolean }> = [];

        [
          ...specificDateBlocked.map((b) => ({ ...b, isSpecificDate: true })),
          ...recurringBlocked.map((b) => ({ ...b, isSpecificDate: false })),
          ...fixedObligationsToday.map((b) => ({ ...b, isSpecificDate: false })),
          ...manualSessionsToday.map((b) => ({ ...b, isSpecificDate: true })),
        ].forEach((b) => {
          const rangeKey = `${b.startTime}-${b.endTime}`;
          if (!seenRanges.has(rangeKey)) {
            seenRanges.add(rangeKey);
            dateBlocked.push(b);
          }
        });

        let specificBlockedHoursToday = 0;
        specificDateBlocked.forEach((b) => {
          const startM = timeStrToMinutes(b.startTime);
          const endM = timeStrToMinutes(b.endTime);
          const diff = endM - startM;
          if (diff > 0) {
            specificBlockedHoursToday += diff / 60;
          }
        });

        const dailyAvailableHours = availableDaysSet.has(dayOfWeek)
          ? Math.max(0, (hoursPerDay[dayOfWeek] || 3.0) - specificBlockedHoursToday)
          : 0;
        let dayRemainingHours = dailyAvailableHours;

        // Rastreador del cursor de tiempo para time blocking
        let currentTimelineMinute = defaultStartHour * 60;

        // Función interna para encontrar el siguiente intervalo libre que no colisione con eventos bloqueados ni horarios fijos
        const allocateSlot = (durationMins: number): { startTime: string; endTime: string } => {
          let testStart = currentTimelineMinute;
          let conflict = true;
          let guard = 0;

          while (conflict && guard < 24) {
            guard++;
            conflict = false;
            const testEnd = testStart + durationMins;

            for (const b of dateBlocked) {
              const bStart = timeStrToMinutes(b.startTime);
              const bEnd = timeStrToMinutes(b.endTime);

              // Comprobar solapamiento
              if (testStart < bEnd && testEnd > bStart) {
                // Hay conflicto, saltar al final del bloqueo + 15 min de descanso
                testStart = bEnd + 15;
                conflict = true;
                break;
              }
            }
          }

          const finalEnd = testStart + durationMins;
          currentTimelineMinute = finalEnd + 15; // 15 minutos entre sesiones
          const allocated = {
            startTime: minutesToTimeStr(testStart),
            endTime: minutesToTimeStr(finalEnd),
          };
          dateBlocked.push({
            startTime: allocated.startTime,
            endTime: allocated.endTime,
            isSpecificDate: true,
          });
          return allocated;
        };

        // 0. Colocar temas extra añadidos a elección del usuario en este día ("+ Añadir tema en hueco")
        pendingTopics.forEach((extraTopic) => {
          const extraCfg = extraTopic.extraStudySessionsByDate?.[dateStr];
          if (!extraCfg) return;

          const topicMinsPerPage = getMinutesPerPage(
            extraTopic.difficulty || 'Media',
            preferences.averageMinutesPerPage,
            preferences.useDifficultyScalingForPages
          );
          const pagesLeft = Math.max(1, extraTopic._totalPages - extraTopic._simulatedPagesRead);
          const requestedPages = extraCfg.pagesCount
            ? Math.max(1, extraCfg.pagesCount)
            : Math.min(pagesLeft, Math.max(2, Math.min(minSubjectPagesPerDayForExam || 6, 8)));

          const effectiveTopicPages = Math.max(
            extraTopic._totalPages,
            extraTopic._simulatedPagesRead + requestedPages
          );

          const allocatedMins = Math.max(5, Math.round(requestedPages * topicMinsPerPage));
          const allocatedHours = Math.max(
            0.1,
            Math.round((allocatedMins / 60) * 100) / 100
          );

          const startPage = Math.min(effectiveTopicPages, extraTopic._simulatedPagesRead + 1);
          const endPage = Math.min(effectiveTopicPages, startPage + requestedPages - 1);
          const pCount = Math.max(1, endPage - startPage + 1);
          extraTopic._simulatedPagesRead = Math.min(effectiveTopicPages, endPage);

          const chosenStart =
            extraTopic.studyTimeByDate?.[dateStr] ||
            extraCfg.startTime ||
            `${String(defaultStartHour).padStart(2, '0')}:00`;
          const startMins = timeStrToMinutes(chosenStart);
          const endMins = Math.min(23 * 60 + 59, startMins + allocatedMins);
          const chosenEnd = minutesToTimeStr(endMins);

          dateBlocked.push({
            startTime: chosenStart,
            endTime: chosenEnd,
            title: extraTopic.title,
            isSpecificDate: true,
          });

          sessions.push({
            id: `sess-extra-${extraTopic.id}-${dateStr}`,
            date: dateStr,
            startTime: chosenStart,
            endTime: chosenEnd,
            subjectId,
            subjectName,
            subjectColor,
            topicId: extraTopic.id,
            topicTitle: `${extraTopic.title} (Págs. ${startPage}–${endPage})`,
            durationHours: allocatedHours,
            pageCount: effectiveTopicPages,
            pagesAllocation: `Págs. ${startPage}–${endPage} (${pCount} ${
              pCount === 1 ? 'pág' : 'págs'
            } · ~${allocatedMins} min)`,
            type: 'estudio_nuevo',
            completed: false,
          });
        });

        // 1. Prioridad: Colocar repasos espaciados que venzan hoy o antes, dimensionados según el número de páginas estudiado
        for (let i = 0; i < spacedReviews.length; i++) {
          const reviewTopic = spacedReviews[i];
          const due = reviewTopic.nextReviewDate || dateStr;
          if (due <= dateStr) {
            const revTimeCalc = this.calculateTopicReviewTime(reviewTopic);
            const reviewTime = Math.max(0.25, Math.round(revTimeCalc.reviewHours * 10) / 10);
            if (dayRemainingHours >= Math.min(0.3, reviewTime)) {
              const sessionDurHours = Math.round(Math.min(dayRemainingHours, reviewTime) * 10) / 10;
              const customRevTime =
                reviewTopic.reviewTimeByDate?.[dateStr] ||
                (reviewTopic.nextReviewDate === dateStr ? reviewTopic.reviewScheduledTime : undefined);
              const slot = customRevTime
                ? {
                    startTime: customRevTime,
                    endTime: minutesToTimeStr(
                      timeStrToMinutes(customRevTime) + Math.max(15, Math.round(sessionDurHours * 60))
                    ),
                  }
                : allocateSlot(Math.max(15, Math.round(sessionDurHours * 60)));
              const pagesAllocLabel =
                revTimeCalc.pagesToReview > 0
                  ? revTimeCalc.pagesToReview < revTimeCalc.totalPages
                    ? `Repaso de ${revTimeCalc.pagesToReview}/${revTimeCalc.totalPages} págs. estudiadas (~${revTimeCalc.reviewMinutes} min)`
                    : `Repaso de ${revTimeCalc.pagesToReview} págs. estudiadas (~${revTimeCalc.reviewMinutes} min)`
                  : undefined;

              sessions.push({
                id: `sess-rev-${reviewTopic.id}-${dateStr}`,
                date: dateStr,
                startTime: slot.startTime,
                endTime: slot.endTime,
                subjectId,
                subjectName,
                subjectColor,
                topicId: reviewTopic.id,
                topicTitle: `Repaso Espaciado: ${reviewTopic.title}`,
                durationHours: sessionDurHours,
                pageCount: revTimeCalc.totalPages,
                studiedPagesToReview: revTimeCalc.pagesToReview,
                pagesAllocation: pagesAllocLabel,
                type: 'repaso_espaciado',
                completed: false,
              });
              dayRemainingHours -= sessionDurHours;
              // Removido de la cola de repasos pendientes
              spacedReviews.splice(i, 1);
              i--;
            }
          }
        }

        // 2. Colocar estudio diario de páginas por tema para llegar a tiempo al examen o tarea
        while (topicIdx < pendingTopics.length && dayRemainingHours >= 0.25) {
          const currentTopic = pendingTopics[topicIdx];
          const effectiveTopicPages = currentTopic._totalPages;
          const topicMinsPerPage = getMinutesPerPage(
            currentTopic.difficulty || 'Media',
            preferences.averageMinutesPerPage,
            preferences.useDifficultyScalingForPages
          );

          const pagesLeft = Math.max(0, effectiveTopicPages - currentTopic._simulatedPagesRead);
          if (pagesLeft <= 0) {
            topicIdx++;
            continue;
          }

          // Si ya tenía una sesión extra añadida manualmente en este mismo día para este mismo tema, evitamos duplicarlo salvo que queden más temas
          const alreadyScheduledExtraToday = sessions.some(
            (s) => s.date === dateStr && s.topicId === currentTopic.id && s.id.startsWith('sess-extra-')
          );
          if (alreadyScheduledExtraToday) {
            break;
          }

          // Verificar fecha límite del tema (tarea o examen) para calcular cuántas páginas mínimas hay que ver hoy
          const dlInfo = topicDeadlineMap.get(currentTopic.id);
          const daysLeftForTopic = dlInfo
            ? countAvailableStudyDaysBetween(dateStr, dlInfo.targetStudyDate)
            : availableDaysBeforeExam;
          const minPagesTodayForTopicDeadline = Math.max(
            1,
            Math.ceil(pagesLeft / Math.max(1, daysLeftForTopic))
          );

          // Páginas que caben por horas disponibles hoy, garantizando al menos el ritmo necesario para llegar al examen/tarea
          const pagesByAvailableTime = Math.max(
            1,
            Math.round((dayRemainingHours * 60) / Math.max(1, topicMinsPerPage))
          );
          const targetPagesInSession = Math.min(
            pagesLeft,
            Math.max(
              minPagesTodayForTopicDeadline,
              Math.min(pagesByAvailableTime, Math.max(minSubjectPagesPerDayForExam, 8))
            )
          );

          const allocatedHours = Math.max(
            0.25,
            Math.round(((targetPagesInSession * topicMinsPerPage) / 60) * 10) / 10
          );

          const totalPages = effectiveTopicPages;
          const startPage = Math.min(totalPages, currentTopic._simulatedPagesRead + 1);
          const endPage = Math.min(totalPages, startPage + targetPagesInSession - 1);
          const pCount = Math.max(1, endPage - startPage + 1);
          const dlBadge = dlInfo
            ? ` · Para ${dlInfo.type === 'task' ? `Tarea "${dlInfo.title}" (${dlInfo.dueDate})` : `${dlInfo.title} (${dlInfo.dueDate})`}`
            : '';
          const pagesAllocText = `Págs. ${startPage}–${endPage} (${pCount} ${
            pCount === 1 ? 'pág/día' : 'págs/día'
          })${dlBadge}`;
          currentTopic._simulatedPagesRead = endPage;

          const customStartForDate = currentTopic.studyTimeByDate?.[dateStr];
          const slot = customStartForDate
            ? (() => {
                const startM = timeStrToMinutes(customStartForDate);
                const endM = Math.min(
                  23 * 60 + 59,
                  startM + Math.max(15, Math.round(allocatedHours * 60))
                );
                const sStr = minutesToTimeStr(startM);
                const eStr = minutesToTimeStr(endM);
                dateBlocked.push({
                  startTime: sStr,
                  endTime: eStr,
                  title: currentTopic.title,
                  isSpecificDate: true,
                });
                return { startTime: sStr, endTime: eStr };
              })()
            : allocateSlot(Math.max(15, Math.round(allocatedHours * 60)));

          sessions.push({
            id: `sess-top-${currentTopic.id}-${dateStr}-${startPage}`,
            date: dateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subjectId,
            subjectName,
            subjectColor,
            topicId: currentTopic.id,
            topicTitle: `${currentTopic.title} (Págs. ${startPage}–${endPage})`,
            durationHours: allocatedHours,
            pageCount: effectiveTopicPages,
            pagesAllocation: pagesAllocText,
            type: 'estudio_nuevo',
            completed: false,
          });

          // Marcamos fecha y hora programada en el tema (primera sesión)
          if (!currentTopic.scheduledDate) {
            currentTopic.scheduledDate = dateStr;
            currentTopic.scheduledTime = slot.startTime;
            currentTopic.scheduledEndTime = slot.endTime;
            const originalInArray = updatedTopics.find((t) => t.id === currentTopic.id);
            if (originalInArray) {
              originalInArray.scheduledDate = dateStr;
              originalInArray.scheduledTime = slot.startTime;
              originalInArray.scheduledEndTime = slot.endTime;
            }
          }

          dayRemainingHours = Math.round((dayRemainingHours - allocatedHours) * 10) / 10;
          currentTopic._simulatedHoursSpent =
            Math.round((currentTopic._simulatedHoursSpent + allocatedHours) * 10) / 10;

          // Si completamos todas las páginas del tema en esta sesión, pasamos al siguiente tema
          if (currentTopic._simulatedPagesRead >= effectiveTopicPages) {
            topicIdx++;
          } else {
            // El resto de páginas de este tema se verá en el siguiente día disponible
            break;
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
      daysEvaluated++;
    }

    const projectedCompletionDate = sessions.length > 0 ? sessions[sessions.length - 1].date : toLocalDateStr(today);

    const isAheadOfExam = examDate ? new Date(projectedCompletionDate) <= examDate : true;

    // Calcular déficit de horas si no da tiempo antes del examen
    let deficitHours = 0;
    if (examDate && new Date(projectedCompletionDate) > examDate) {
      const remainingTotalHours = pendingTopics.reduce(
        (acc, t) => acc + Math.max(0, t.estimatedHours - (t.actualHoursSpent || 0)),
        0
      );
      deficitHours = Math.max(0, Math.round(remainingTotalHours * 0.35));
    }

    return {
      sessions,
      updatedTopics,
      projectedCompletionDate,
      isAheadOfExam,
      deficitHours,
      taskPrioritizedCount,
    };
  },

  /**
   * Reprograma todo el plan ante un imprevisto
   * (ejemplo: no se pudo estudiar hoy o los últimos 2 días)
   */
  rescheduleAfterImprevisto(
    topics: Topic[],
    subjectId: string,
    subjectName: string,
    subjectColor: string,
    exams: Exam[],
    preferences: StudyPreferences,
    blockedEvents?: BlockedTimeEvent[]
  ) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toLocalDateStr(tomorrow);

    // Reinicia las fechas de temas no completados para empezar desde mañana
    const refreshedTopics = topics.map((t) => {
      if (t.status === 'pendiente' || t.status === 'en_progreso') {
        return {
          ...t,
          scheduledDate: undefined,
        };
      }
      return t;
    });

    return this.generateSmartSchedule(
      refreshedTopics,
      subjectId,
      subjectName,
      subjectColor,
      exams,
      preferences,
      tomorrowStr,
      blockedEvents
    );
  },

  /**
   * Aplica de forma masiva un perfil de curva del olvido a un programa de estudio específico (o a todos),
   * recalculando automáticamente las fechas de repaso programadas (nextReviewDate) de todas las materias.
   */
  applyForgettingCurveProfileToPrograms(
    programs: StudyProgram[],
    targetProgramId: string | 'all',
    profile: ForgettingCurveProfile,
    options?: {
      anchorFromToday?: boolean;
      onlyStudiedOrScheduled?: boolean;
    }
  ): {
    updatedPrograms: StudyProgram[];
    affectedSubjectsCount: number;
    affectedTopicsCount: number;
    sampleUpdates: Array<{
      topicTitle: string;
      subjectName: string;
      oldDate?: string;
      newDate: string;
      level: number;
      intervalDays: number;
    }>;
  } {
    const today = new Date();
    const todayStr = toLocalDateStr(today);
    const anchorFromToday = options?.anchorFromToday ?? true;
    const onlyStudiedOrScheduled = options?.onlyStudiedOrScheduled ?? true;

    let affectedSubjectsCount = 0;
    let affectedTopicsCount = 0;
    const sampleUpdates: Array<{
      topicTitle: string;
      subjectName: string;
      oldDate?: string;
      newDate: string;
      level: number;
      intervalDays: number;
    }> = [];

    const updatedPrograms = programs.map((prog) => {
      if (targetProgramId !== 'all' && prog.id !== targetProgramId) {
        return prog;
      }

      return {
        ...prog,
        years: prog.years.map((year) => ({
          ...year,
          subjects: year.subjects.map((subject) => {
            let subjectModified = false;

            const updatedTopics = subject.topics.map((topic) => {
              const hasReviewContext =
                topic.status === 'estudiado' ||
                topic.status === 'repasado' ||
                !!topic.nextReviewDate ||
                (topic.reviewLevel && topic.reviewLevel > 0) ||
                (topic.reviewsHistory && topic.reviewsHistory.length > 0);

              if (onlyStudiedOrScheduled && !hasReviewContext) {
                return topic;
              }

              const currentLevel = Math.min(5, Math.max(1, topic.reviewLevel || 1));
              const newIntervalDays = profile.intervals[currentLevel - 1] ?? 1;

              let targetDate = new Date();
              if (anchorFromToday) {
                targetDate = new Date(today);
                targetDate.setDate(targetDate.getDate() + newIntervalDays);
              } else {
                const lastDateStr =
                  topic.reviewsHistory?.slice(-1)[0]?.date ||
                  topic.studiedAt ||
                  topic.nextReviewDate ||
                  todayStr;
                targetDate = new Date(`${lastDateStr}T12:00:00`);
                targetDate.setDate(targetDate.getDate() + newIntervalDays);
              }

              const newNextReviewDate = toLocalDateStr(targetDate);
              const oldDate = topic.nextReviewDate;

              subjectModified = true;
              affectedTopicsCount++;

              if (sampleUpdates.length < 5) {
                sampleUpdates.push({
                  topicTitle: topic.title,
                  subjectName: subject.name,
                  oldDate,
                  newDate: newNextReviewDate,
                  level: currentLevel,
                  intervalDays: newIntervalDays,
                });
              }

              return {
                ...topic,
                nextReviewDate: newNextReviewDate,
                reviewLevel: currentLevel,
                lastIntervalDays: newIntervalDays,
                lastAdjustmentReason: `Ajuste masivo · Perfil "${profile.name}" (Fase R${currentLevel}: ${newIntervalDays} ${newIntervalDays === 1 ? 'día' : 'días'})`,
              };
            });

            if (subjectModified) {
              affectedSubjectsCount++;
            }

            return {
              ...subject,
              topics: updatedTopics,
            };
          }),
        })),
      };
    });

    return {
      updatedPrograms,
      affectedSubjectsCount,
      affectedTopicsCount,
      sampleUpdates,
    };
  },

  /**
   * Calcula con precisión cuántas horas diarias se necesitan para:
   * 1. Nuevo Estudio de Temas pendientes
   * 2. Repasos de la Curva del Olvido
   * Y compara la suma frente a las horas libres reales descontando los motivos de bloqueo.
   */
  calculateDailyStudyAndReviewNeeds(
    subjects: Subject[],
    preferences: StudyPreferences,
    blockedEvents: BlockedTimeEvent[] = [],
    weeklyObligations: WeeklyObligation[] = []
  ): DailyNeedsCalculation {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const allTopics = subjects.flatMap((s) => s.topics || []);
    const allExams = subjects
      .flatMap((s) => s.exams || [])
      .filter((e) => !e.completed && e.date >= todayStr);

    // Próximo examen relevante
    const sortedExams = [...allExams].sort((a, b) => a.date.localeCompare(b.date));
    const nearestExam = sortedExams[0];

    // Horizonte temporal (días hasta el próximo examen o 30 días estándar)
    let daysUntilExam = 30;
    if (nearestExam && nearestExam.date) {
      const [ey, em, ed] = nearestExam.date.split('-').map(Number);
      const examDt = new Date(ey, (em || 1) - 1, ed || 1).getTime();
      const diff = Math.round((examDt - today.getTime()) / (1000 * 60 * 60 * 24));
      daysUntilExam = Math.max(1, diff);
    }

    // Días de estudio hábiles dentro del horizonte
    const availableDaysSet = new Set(preferences.availableDays || [1, 2, 3, 4, 5, 6]);
    let availableStudyDaysCount = 0;
    for (let i = 0; i < daysUntilExam; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (availableDaysSet.has(d.getDay())) {
        availableStudyDaysCount++;
      }
    }
    availableStudyDaysCount = Math.max(1, availableStudyDaysCount);

    // 1. Horas necesarias para NUEVO ESTUDIO (recalculadas a partir de los temas pendientes y la Velocidad de Lectura Promedio en páginas/hora)
    const speedCfg = getStoredReadingSpeedConfig(preferences);
    const pendingTopics = allTopics.filter(
      (t) => t.status !== 'estudiado' && t.status !== 'repasado'
    );
    let totalNewStudyHoursRemaining = 0;
    let remainingNewPagesCount = 0;

    pendingTopics.forEach((t) => {
      const tp = this.calculateTopicAcademicProgress(t, preferences);
      if (!tp.isCompleted) {
        remainingNewPagesCount += tp.remainingPages;
        totalNewStudyHoursRemaining += Math.max(0.25, tp.remainingHours);
      }
    });

    const newStudyHoursNeededDaily =
      Math.round((totalNewStudyHoursRemaining / availableStudyDaysCount) * 10) / 10;

    // 2. Horas necesarias para REPASOS ESPACIADOS (Curva del Olvido) teniendo en cuenta las páginas estudiadas
    const activeReviewTopics = allTopics.filter((t) => {
      const pInfo = this.getTopicStudiedPages(t);
      return (
        t.status === 'estudiado' ||
        t.status === 'repasado' ||
        pInfo.studiedPages > 0 ||
        (t.reviewsHistory && t.reviewsHistory.length > 0) ||
        (t.reviewLevel && t.reviewLevel > 0)
      );
    });

    const estimatedReviewMulti =
      daysUntilExam <= 7 ? 1.0 : daysUntilExam <= 15 ? 1.8 : 2.5;

    let totalStudiedPagesForReview = 0;
    let rawReviewHoursSum = 0;

    activeReviewTopics.forEach((t) => {
      const revCalc = this.calculateTopicReviewTime(t);
      totalStudiedPagesForReview += revCalc.pagesToReview;
      rawReviewHoursSum += revCalc.reviewHours * estimatedReviewMulti * 0.75;
    });

    const totalReviewHoursRemaining =
      Math.round(Math.max(activeReviewTopics.length * 0.25, rawReviewHoursSum) * 10) / 10;

    const reviewHoursNeededDaily =
      Math.round((totalReviewHoursRemaining / availableStudyDaysCount) * 10) / 10;

    const totalHoursNeededDaily =
      Math.round((newStudyHoursNeededDaily + reviewHoursNeededDaily) * 10) / 10;

    // 3. Desglose y suma de motivos de bloqueo (WeeklyObligations + BlockedEvents)
    const breakdownMap = new Map<
      string,
      { label: string; icon: string; weeklyHours: number; count: number }
    >();

    Object.entries(BLOCKED_REASON_DEFINITIONS).forEach(([key, meta]) => {
      breakdownMap.set(key, {
        label: meta.label,
        icon: meta.icon,
        weeklyHours: 0,
        count: 0,
      });
    });

    const blockedEventIds = new Set((blockedEvents || []).map((b) => b.id));
    const rawObligations = [
      ...weeklyObligations,
      ...(preferences.weeklyFixedObligations || []),
    ];
    const seenObIds = new Set<string>();
    const allObligations = rawObligations.filter((ob) => {
      if (!ob || seenObIds.has(ob.id)) return false;
      // Skip obligations that were auto-generated from a BlockedTimeEvent already in blockedEvents
      for (const bId of blockedEventIds) {
        if (ob.id.startsWith(`ob-${bId}-`)) return false;
      }
      seenObIds.add(ob.id);
      return true;
    });

    allObligations.forEach((ob) => {
      let dur = ob.durationHours;
      if (!dur && ob.startTime && ob.endTime) {
        dur = Math.max(
          0,
          (timeStrToMinutes(ob.endTime) - timeStrToMinutes(ob.startTime)) / 60
        );
      }
      dur = dur || 0;
      const cat = ob.category === 'gimnasio' ? 'deporte' : ob.category || 'otro';
      const entry = breakdownMap.get(cat) || {
        label: BLOCKED_REASON_DEFINITIONS[cat]?.label || 'Otro Bloqueo',
        icon: BLOCKED_REASON_DEFINITIONS[cat]?.icon || 'Clock',
        weeklyHours: 0,
        count: 0,
      };
      entry.weeklyHours += dur;
      entry.count += 1;
      breakdownMap.set(cat, entry);
    });

    (blockedEvents || []).forEach((b) => {
      let dur = b.durationHours;
      if (!dur && b.startTime && b.endTime) {
        dur = Math.max(
          0,
          (timeStrToMinutes(b.endTime) - timeStrToMinutes(b.startTime)) / 60
        );
      }
      dur = dur || 0;
      const cat = b.category === 'gimnasio' ? 'deporte' : b.category || 'otro';
      const entry = breakdownMap.get(cat) || {
        label: BLOCKED_REASON_DEFINITIONS[cat]?.label || 'Otro Bloqueo',
        icon: BLOCKED_REASON_DEFINITIONS[cat]?.icon || 'Clock',
        weeklyHours: 0,
        count: 0,
      };
      if (b.recurringDays && b.recurringDays.length > 0) {
        entry.weeklyHours += dur * b.recurringDays.length;
      } else {
        entry.weeklyHours += dur;
      }
      entry.count += 1;
      breakdownMap.set(cat, entry);
    });

    let totalBlockedHoursWeekly = 0;
    const blockedReasonsBreakdown: BlockedReasonSummary[] = [];

    breakdownMap.forEach((val, key) => {
      if (val.weeklyHours > 0 || val.count > 0) {
        totalBlockedHoursWeekly += val.weeklyHours;
        blockedReasonsBreakdown.push({
          category: key as any,
          label: val.label,
          iconName: val.icon,
          totalHoursWeekly: Math.round(val.weeklyHours * 10) / 10,
          hoursPerDayAvg: Math.round((val.weeklyHours / 7) * 10) / 10,
          count: val.count,
        });
      }
    });

    blockedReasonsBreakdown.sort((a, b) => b.totalHoursWeekly - a.totalHoursWeekly);

    const dailyAvgBlockedHours =
      Math.round((totalBlockedHoursWeekly / 7) * 10) / 10;

    const configuredDailyAvg =
      Object.values(preferences.hoursPerDay || {}).reduce((s, h) => s + h, 0) /
      Math.max(1, Object.keys(preferences.hoursPerDay || {}).length);

    // Horas disponibles reales descontando bloqueos de una jornada activa (~15.5h despiertas - 2h comidas/higiene)
    const effectiveWakingFree = Math.max(0, 15.5 - dailyAvgBlockedHours - 2.0);
    const realAvailableHoursDaily = Math.min(
      8.0,
      Math.max(
        0.5,
        Math.round(
          (totalBlockedHoursWeekly > 0
            ? effectiveWakingFree * 0.65
            : Math.min(configuredDailyAvg, effectiveWakingFree * 0.75)) * 10
        ) / 10
      )
    );

    const balanceDailyHours =
      Math.round((realAvailableHoursDaily - totalHoursNeededDaily) * 10) / 10;

    let status: 'viable' | 'ajustado' | 'sobrecarga' = 'viable';
    let statusMessage = '';

    if (balanceDailyHours >= 1.0) {
      status = 'viable';
      statusMessage = `Ritmo viable y óptimo. Tienes ${balanceDailyHours}h libres de margen al día tras tus bloqueos.`;
    } else if (balanceDailyHours >= 0) {
      status = 'ajustado';
      statusMessage = `Plan ajustado (+${balanceDailyHours}h de margen al día). Mantén la constancia para no acumular retrasos.`;
    } else {
      status = 'sobrecarga';
      const deficit = Math.abs(balanceDailyHours);
      statusMessage = `Sobrecarga horaria: Te faltan ${deficit}h diarias para abarcar el estudio y los repasos. Se recomienda reducir bloqueos o adelantar fechas.`;
    }

    return {
      newStudyHoursNeededDaily,
      remainingNewTopicsCount: pendingTopics.length,
      remainingNewPagesCount,
      totalNewStudyHoursRemaining: Math.round(totalNewStudyHoursRemaining * 10) / 10,
      reviewHoursNeededDaily,
      activeReviewsCount: activeReviewTopics.length,
      totalReviewHoursRemaining,
      totalStudiedPagesForReview,
      totalHoursNeededDaily,
      totalBlockedHoursWeekly: Math.round(totalBlockedHoursWeekly * 10) / 10,
      dailyAvgBlockedHours,
      realAvailableHoursDaily,
      balanceDailyHours,
      status,
      statusMessage,
      blockedReasonsBreakdown,
      targetExamTitle: nearestExam?.title,
      targetExamDate: nearestExam?.date,
      daysUntilExam,
      availableStudyDaysCount,
      configuredMinutesPerPage: speedCfg.averageMinutesPerPage,
      pagesPerHour:
        speedCfg.averageMinutesPerPage > 0
          ? Math.round((60 / speedCfg.averageMinutesPerPage) * 10) / 10
          : 8.0,
    };
  },

  /**
   * Recalcula y redistribuye masivamente todos los temas a estudiar y repasos
   * en función de las horas bloqueadas por los distintos motivos y las horas libres reales.
   */
  recalculateTopicsAccordingToBlockedHours(
    subjects: Subject[],
    preferences: StudyPreferences,
    blockedEvents: BlockedTimeEvent[] = [],
    weeklyObligations: WeeklyObligation[] = [],
    options?: {
      preserveManualPins?: boolean;
      startFromDateStr?: string;
    }
  ): {
    updatedSubjects: Subject[];
    updatedPreferences: StudyPreferences;
    recalculatedTopicsCount: number;
    recalculatedReviewsCount: number;
    sessionsGeneratedCount: number;
    dailyNeeds: DailyNeedsCalculation;
    summaryMessage: string;
  } {
    const todayStr = options?.startFromDateStr || getTodayLocalDateStr();
    const preserveManualPins = options?.preserveManualPins ?? false;

    const blockedEventIds = new Set((blockedEvents || []).map((b) => b.id));
    const rawObligations = [
      ...weeklyObligations,
      ...(preferences.weeklyFixedObligations || []),
    ];
    const seenObIds = new Set<string>();
    const allObligations = rawObligations.filter((ob) => {
      if (!ob || seenObIds.has(ob.id)) return false;
      for (const bId of blockedEventIds) {
        if (ob.id.startsWith(`ob-${bId}-`)) return false;
      }
      seenObIds.add(ob.id);
      return true;
    });

    // 1. Recalcular disponibilidad diaria por día de la semana (0 a 6) restando compromisos
    const adjustedHoursPerDay = this.calculateDailyAvailableHoursFromObligations(
      allObligations
    );

    // Ajustar también por eventos de bloqueo recurrentes
    (blockedEvents || []).forEach((evt) => {
      let dur = evt.durationHours;
      if (!dur && evt.startTime && evt.endTime) {
        dur = Math.max(
          0,
          (timeStrToMinutes(evt.endTime) - timeStrToMinutes(evt.startTime)) / 60
        );
      }
      dur = dur || 0;
      if (evt.recurringDays && evt.recurringDays.length > 0) {
        evt.recurringDays.forEach((dayNum) => {
          adjustedHoursPerDay[dayNum] = Math.max(
            1.0,
            Math.round(
              ((adjustedHoursPerDay[dayNum] || 4.0) - dur * 0.6) * 10
            ) / 10
          );
        });
      }
    });

    const activeDaysList = Object.entries(adjustedHoursPerDay)
      .filter(([_, h]) => h > 0)
      .map(([d]) => Number(d));

    const updatedPreferences: StudyPreferences = {
      ...preferences,
      hoursPerDay: adjustedHoursPerDay,
      availableDays:
        activeDaysList.length > 0
          ? Array.from(new Set([...(preferences.availableDays || [1, 2, 3, 4, 5, 6]), ...activeDaysList]))
          : preferences.availableDays,
    };

    let recalculatedTopicsCount = 0;
    let recalculatedReviewsCount = 0;
    let sessionsGeneratedCount = 0;
    let weeklyTaskPrioritizedCount = 0;

    // Acumulador de bloques ya ocupados entre asignaturas para no solapar temas ni repasos a la misma hora
    const workingBlockedEvents: BlockedTimeEvent[] = [...(blockedEvents || [])];

    // Helper: comprobar si una hora HH:00 está libre en una fecha dada
    const isHourSlotConflict = (dateStr: string, hour: number, durationMins = 60): boolean => {
      const dayOfWeek = getDayOfWeekFromDateStr(dateStr);
      const testStart = hour * 60;
      const testEnd = testStart + durationMins;

      // Comprobar bloqueos de fecha o recurrentes
      for (const b of workingBlockedEvents) {
        const appliesToday =
          b.date === dateStr ||
          (!b.date && b.recurringDays && b.recurringDays.includes(dayOfWeek));
        if (!appliesToday) continue;
        const bStart = timeStrToMinutes(b.startTime);
        const bEnd = timeStrToMinutes(b.endTime);
        if (testStart < bEnd && testEnd > bStart) return true;
      }

      // Comprobar obligaciones fijas semanales
      for (const ob of allObligations) {
        const appliesToday =
          ob.dayOfWeek === dayOfWeek ||
          (ob.recurringDays && ob.recurringDays.includes(dayOfWeek));
        if (!appliesToday) continue;
        const oStart = timeStrToMinutes(ob.startTime);
        const oEnd = timeStrToMinutes(ob.endTime);
        if (testStart < oEnd && testEnd > oStart) return true;
      }

      return false;
    };

    const preferredReviewHours = [10, 11, 16, 17, 18, 9, 12, 19, 15, 20, 8, 13, 14, 21];

    const findNextFreeDateAndHour = (
      initialDateStr: string,
      durationMins = 60
    ): { dateStr: string; hourStr: string } => {
      const cursor = parseLocalDate(initialDateStr);
      for (let offset = 0; offset < 30; offset++) {
        const candidateDate = toLocalDateStr(cursor);
        for (const h of preferredReviewHours) {
          if (!isHourSlotConflict(candidateDate, h, durationMins)) {
            return {
              dateStr: candidateDate,
              hourStr: `${String(h).padStart(2, '0')}:00`,
            };
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return { dateStr: initialDateStr, hourStr: '10:00' };
    };

    // 2. Ejecutar planificación inteligente para cada materia distribuyendo temas y repasos sin colisionar
    // y teniendo en cuenta las tareas que vencen esta semana para revisar esos temas durante la semana
    const updatedSubjects = subjects.map((subject) => {
      const subjectWeeklyTaskMap = this.matchWeeklyTasksToTopics(
        subject.topics || [],
        subject.tasks || [],
        todayStr
      );

      // Limpiar fechas previas de temas pendientes para recalcular en limpio (salvo que preserveManualPins esté activo y no haya conflicto)
      const preparedTopics = (subject.topics || []).map((t) => {
        if (t.status !== 'estudiado' && t.status !== 'repasado') {
          if (preserveManualPins && t.manualScheduledDate && t.scheduledDate) {
            const pinnedHour = t.scheduledTime
              ? parseInt(t.scheduledTime.split(':')[0], 10)
              : 10;
            if (!isHourSlotConflict(t.scheduledDate, pinnedHour, 60)) {
              return t;
            }
          }
          return {
            ...t,
            scheduledDate: undefined,
            scheduledTime: undefined,
            scheduledEndTime: undefined,
            manualScheduledDate: false,
            studyTimeByDate: {},
          };
        }
        return t;
      });

      const scheduleResult = this.generateSmartSchedule(
        preparedTopics,
        subject.id,
        subject.name,
        subject.color || '#3b82f6',
        subject.exams || [],
        updatedPreferences,
        todayStr,
        workingBlockedEvents,
        subject.tasks || []
      );

      weeklyTaskPrioritizedCount += scheduleResult.taskPrioritizedCount || 0;

      // Registrar las sesiones generadas como bloques ocupados para que la siguiente asignatura no use la misma hora
      scheduleResult.sessions.forEach((sess) => {
        if (sess.startTime && sess.endTime) {
          workingBlockedEvents.push({
            id: `alloc-${sess.id}`,
            title: sess.topicTitle,
            date: sess.date,
            startTime: sess.startTime,
            endTime: sess.endTime,
            category: 'otro',
          });
        }
      });

      // Reubicar también los repasos espaciados (nextReviewDate y reviewTimeByDate) para evitar conflictos con horas bloqueadas o planes sobre la marcha
      // y garantizar que los temas vinculados a tareas de esta semana se revisen antes de la fecha de entrega de la tarea
      const finalTopics = scheduleResult.updatedTopics.map((topic) => {
        const pInfo = this.getTopicStudiedPages(topic);
        const linkedTaskInfo = subjectWeeklyTaskMap.get(topic.id);
        // REGLA ESTRICTA: Solo programar repaso espaciado si el tema está estudiado/repasado o tiene páginas leídas > 0
        const hasReview =
          topic.status === 'estudiado' ||
          topic.status === 'repasado' ||
          pInfo.studiedPages > 0;

        if (!hasReview) {
          if (topic.scheduledDate) recalculatedTopicsCount++;
          return {
            ...topic,
            nextReviewDate: undefined,
            reviewScheduledTime: undefined,
            reviewLevel: 0,
          };
        }

        let targetReviewDate =
          topic.nextReviewDate && topic.nextReviewDate >= todayStr
            ? topic.nextReviewDate
            : todayStr;

        // Si el tema ya estudiado está vinculado a una tarea de esta semana, asegurar que su repaso ocurra antes de la entrega
        if (linkedTaskInfo) {
          if (targetReviewDate > linkedTaskInfo.task.dueDate) {
            targetReviewDate = linkedTaskInfo.targetDateStr;
          }
        }

        const existingHourStr =
          topic.reviewTimeByDate?.[targetReviewDate] || topic.reviewScheduledTime;
        const existingHour = existingHourStr
          ? parseInt(existingHourStr.split(':')[0], 10)
          : null;

        let assignedDate = targetReviewDate;
        let assignedHourStr = existingHourStr;

        if (
          existingHour === null ||
          isNaN(existingHour) ||
          isHourSlotConflict(targetReviewDate, existingHour, 45)
        ) {
          const found = findNextFreeDateAndHour(targetReviewDate, 45);
          assignedDate = found.dateStr;
          assignedHourStr = found.hourStr;
        }

        if (assignedHourStr) {
          const hNum = parseInt(assignedHourStr.split(':')[0], 10);
          workingBlockedEvents.push({
            id: `alloc-rev-${topic.id}-${assignedDate}`,
            title: `Repaso: ${topic.title}`,
            date: assignedDate,
            startTime: assignedHourStr,
            endTime: `${String(Math.min(23, hNum + 1)).padStart(2, '0')}:00`,
            category: 'otro',
          });
        }

        recalculatedReviewsCount++;
        if (topic.scheduledDate) recalculatedTopicsCount++;

        const nextReviewTimeByDate = { ...(topic.reviewTimeByDate || {}) };
        if (assignedHourStr) {
          nextReviewTimeByDate[assignedDate] = assignedHourStr;
        }

        return {
          ...topic,
          studiedAt: topic.studiedAt || todayStr,
          reviewLevel: Math.max(1, topic.reviewLevel || 1),
          nextReviewDate: assignedDate,
          reviewScheduledTime: assignedHourStr,
          reviewTimeByDate: nextReviewTimeByDate,
          lastAdjustmentReason: linkedTaskInfo
            ? `Revisión programada esta semana por tarea "${linkedTaskInfo.task.title}" (entrega ${linkedTaskInfo.task.dueDate})`
            : topic.lastAdjustmentReason,
        };
      });

      sessionsGeneratedCount += scheduleResult.sessions.length;

      return {
        ...subject,
        topics: finalTopics,
      };
    });

    const dailyNeeds = this.calculateDailyStudyAndReviewNeeds(
      updatedSubjects,
      updatedPreferences,
      blockedEvents,
      allObligations
    );

    const taskSuffix =
      weeklyTaskPrioritizedCount > 0
        ? ` Además, se han priorizado ${weeklyTaskPrioritizedCount} ${
            weeklyTaskPrioritizedCount === 1 ? 'tema vinculado' : 'temas vinculados'
          } a tus tareas de esta semana para que los estudies o repases antes de su entrega.`
        : '';

    const summaryMessage = `¡Temas y repasos recalculados con éxito! Se han reorganizado ${recalculatedTopicsCount} temas con su cuota de páginas por día y ${recalculatedReviewsCount} repasos espaciados (solo de temas/páginas leídas) respetando tus entregas y exámenes (${dailyNeeds.totalHoursNeededDaily}h/día necesarias).${taskSuffix}`;

    return {
      updatedSubjects,
      updatedPreferences,
      recalculatedTopicsCount,
      recalculatedReviewsCount,
      sessionsGeneratedCount,
      dailyNeeds,
      summaryMessage,
    };
  },

  /**
   * Calcula el plan detallado de páginas a estudiar por día de cada tema de una materia
   * para llegar a tiempo a los exámenes y entregas de tareas, y genera los hitos de
   * Repetición Espaciada (1, 3, 7, 15, 30 días) ÚNICAMENTE para los temas o páginas ya marcados como estudiados/leídos.
   */
  calculateSubjectDailyPageStudyPlan(
    subject: Subject,
    preferences?: StudyPreferences,
    blockedEvents?: BlockedTimeEvent[]
  ): {
    todayStr: string;
    totalPages: number;
    studiedPages: number;
    remainingPages: number;
    nextExam: Exam | null;
    pendingTasksCount: number;
    availableStudyDaysToExam: number;
    globalPagesPerDayNeeded: number;
    activeSpacedRepetitionTopicsCount: number;
    topicPlans: Record<
      string,
      {
        topicId: string;
        topicTitle: string;
        totalPages: number;
        studiedPages: number;
        remainingPages: number;
        pagesPerDayNeeded: number;
        availableDaysUntilDeadline: number;
        deadlineType: 'task' | 'exam' | 'continuous';
        deadlineLabel: string;
        deadlineDate: string | null;
        dailySessions: Array<{
          date: string;
          startTime?: string;
          endTime?: string;
          startPage: number;
          endPage: number;
          pagesCount: number;
          label: string;
        }>;
        hasSpacedRepetition: boolean;
        spacedRepetitionAnchorDate: string | null;
        spacedRepetitionSchedule: Array<{
          level: number;
          label: string;
          intervalDays: number;
          date: string;
          pagesToReview: number;
          status: 'completed' | 'due_today' | 'overdue' | 'upcoming';
        }>;
      }
    >;
  } {
    const today = new Date();
    const todayStr = toLocalDateStr(today);
    const prefs: StudyPreferences = preferences || {
      availableDays: [1, 2, 3, 4, 5],
      hoursPerDay: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 4, 0: 0 },
      streakDays: 0,
      lastStudyDate: todayStr,
      enableWebNotifications: false,
      notifyPomodoroBreaks: false,
      notifyDailyReviews: false,
      notifyTaskDeadlines: false,
      pomodoroConfig: {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakInterval: 4,
      },
    };
    const availableDaysSet = new Set(prefs.availableDays || [1, 2, 3, 4, 5]);
    const customIntervals = prefs.spacedRepetitionConfig?.intervals || [1, 3, 7, 15, 30];

    const upcomingExam =
      (subject.exams || [])
        .filter((e) => !e.completed && e.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date))[0] || null;

    const pendingTasks = (subject.tasks || [])
      .filter((t) => !t.completed && t.dueDate >= todayStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const countStudyDays = (fromStr: string, toStr: string): number => {
      if (toStr <= fromStr) return 1;
      const cur = parseLocalDate(fromStr);
      const end = parseLocalDate(toStr);
      let count = 0;
      let guard = 0;
      while (cur <= end && guard < 180) {
        guard++;
        if (availableDaysSet.has(cur.getDay())) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return Math.max(1, count);
    };

    const scheduleRes = this.generateSmartSchedule(
      subject.topics || [],
      subject.id,
      subject.name,
      subject.color || '#3b82f6',
      subject.exams || [],
      prefs,
      todayStr,
      blockedEvents || [],
      subject.tasks || []
    );

    let totalPages = 0;
    let studiedPages = 0;
    let remainingPages = 0;
    let activeSpacedRepetitionTopicsCount = 0;

    const availableStudyDaysToExam = upcomingExam
      ? countStudyDays(todayStr, upcomingExam.date)
      : 14;

    const topicPlans: Record<string, any> = {};

    (subject.topics || []).forEach((topic) => {
      const pInfo = this.getTopicStudiedPages(topic, prefs);
      const tTotal = pInfo.totalPages;
      const tRead = pInfo.studiedPages;
      const tRem = Math.max(0, tTotal - tRead);

      totalPages += tTotal;
      studiedPages += tRead;
      remainingPages += tRem;

      // Buscar tarea o examen que requiera este tema
      const linkedTask = pendingTasks.find((tk) => {
        if (tk.topicId && tk.topicId === topic.id) return true;
        const tLower = `${tk.title} ${tk.subtopic || ''}`.toLowerCase();
        const topLower = topic.title.toLowerCase();
        return tLower.includes(topLower) || topLower.includes(tk.title.toLowerCase());
      });

      const matchingExam =
        (subject.exams || [])
          .filter(
            (e) =>
              !e.completed &&
              e.date >= todayStr &&
              (!e.topicIds || e.topicIds.length === 0 || e.topicIds.includes(topic.id))
          )
          .sort((a, b) => a.date.localeCompare(b.date))[0] || upcomingExam;

      let deadlineType: 'task' | 'exam' | 'continuous' = 'continuous';
      let deadlineLabel = 'Ritmo continuo recomendado';
      let deadlineDate: string | null = null;
      let availableDaysUntilDeadline = availableStudyDaysToExam;

      if (linkedTask) {
        deadlineType = 'task';
        deadlineDate = linkedTask.dueDate;
        deadlineLabel = `Tarea: "${linkedTask.title}" (${linkedTask.dueDate})`;
        availableDaysUntilDeadline = countStudyDays(todayStr, linkedTask.dueDate);
      } else if (matchingExam) {
        deadlineType = 'exam';
        deadlineDate = matchingExam.date;
        deadlineLabel = `Examen: ${matchingExam.title} (${matchingExam.date})`;
        availableDaysUntilDeadline = countStudyDays(todayStr, matchingExam.date);
      }

      const pagesPerDayNeeded =
        tRem > 0 ? Math.max(1, Math.ceil(tRem / Math.max(1, availableDaysUntilDeadline))) : 0;

      // Sesiones diarias programadas para este tema en el calendario inteligente
      const topicStudySessions = scheduleRes.sessions
        .filter((s) => s.topicId === topic.id && s.type === 'estudio_nuevo')
        .map((s) => {
          const matchRange = (s.pagesAllocation || '').match(/Págs\.\s*(\d+)[–-](\d+)/);
          const sPage = matchRange ? parseInt(matchRange[1], 10) : tRead + 1;
          const ePage = matchRange ? parseInt(matchRange[2], 10) : tTotal;
          const pCnt = Math.max(1, ePage - sPage + 1);
          return {
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            startPage: sPage,
            endPage: ePage,
            pagesCount: pCnt,
            label: s.pagesAllocation || `Págs. ${sPage}–${ePage} (${pCnt} págs)`,
          };
        });

      // Repetición espaciada: SOLO si el tema está marcado como estudiado/repasado o tiene páginas leídas > 0
      const hasSpacedRepetition =
        topic.status === 'estudiado' ||
        topic.status === 'repasado' ||
        tRead > 0;

      if (hasSpacedRepetition) {
        activeSpacedRepetitionTopicsCount++;
      }

      const anchorDate = hasSpacedRepetition ? topic.studiedAt || todayStr : null;
      const completedReviewsCount = topic.reviewsHistory ? topic.reviewsHistory.length : 0;
      const currentLevel = Math.min(5, Math.max(1, topic.reviewLevel || 1));

      const spacedRepetitionSchedule: Array<{
        level: number;
        label: string;
        intervalDays: number;
        date: string;
        pagesToReview: number;
        status: 'completed' | 'due_today' | 'overdue' | 'upcoming';
      }> = [];

      if (hasSpacedRepetition && anchorDate) {
        let cursorDateStr = anchorDate;
        for (let idx = 0; idx < customIntervals.length; idx++) {
          const lv = idx + 1;
          const intervalDays = customIntervals[idx];
          const manualOverride = (topic as any).manualReviewDates?.[lv];

          let milestoneDateStr: string;
          if (manualOverride) {
            milestoneDateStr = manualOverride;
            cursorDateStr = manualOverride;
          } else if (lv === currentLevel && topic.nextReviewDate) {
            milestoneDateStr = topic.nextReviewDate;
            cursorDateStr = topic.nextReviewDate;
          } else {
            const dObj = parseLocalDate(cursorDateStr);
            dObj.setDate(dObj.getDate() + intervalDays);
            milestoneDateStr = toLocalDateStr(dObj);
            cursorDateStr = milestoneDateStr;
          }

          let mStatus: 'completed' | 'due_today' | 'overdue' | 'upcoming' = 'upcoming';
          if (lv <= completedReviewsCount || (topic.status === 'repasado' && lv < currentLevel)) {
            mStatus = 'completed';
          } else if (milestoneDateStr < todayStr) {
            mStatus = 'overdue';
          } else if (milestoneDateStr === todayStr) {
            mStatus = 'due_today';
          }

          spacedRepetitionSchedule.push({
            level: lv,
            label: `R${lv} (${intervalDays}d)`,
            intervalDays,
            date: milestoneDateStr,
            pagesToReview: tRead > 0 ? tRead : tTotal,
            status: mStatus,
          });
        }
      }

      topicPlans[topic.id] = {
        topicId: topic.id,
        topicTitle: topic.title,
        totalPages: tTotal,
        studiedPages: tRead,
        remainingPages: tRem,
        pagesPerDayNeeded,
        availableDaysUntilDeadline,
        deadlineType,
        deadlineLabel,
        deadlineDate,
        dailySessions: topicStudySessions,
        hasSpacedRepetition,
        spacedRepetitionAnchorDate: anchorDate,
        spacedRepetitionSchedule,
      };
    });

    const globalPagesPerDayNeeded =
      remainingPages > 0
        ? Math.max(1, Math.ceil(remainingPages / Math.max(1, availableStudyDaysToExam)))
        : 0;

    return {
      todayStr,
      totalPages,
      studiedPages,
      remainingPages,
      nextExam: upcomingExam,
      pendingTasksCount: pendingTasks.length,
      availableStudyDaysToExam,
      globalPagesPerDayNeeded,
      activeSpacedRepetitionTopicsCount,
      topicPlans,
    };
  },
};
