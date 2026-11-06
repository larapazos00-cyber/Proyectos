import { Subject, AcademicYear, Topic, ReviewQuality } from '../types';
import { schedulerService } from '../services/schedulerService';
import { getTodayLocalDateStr } from './dateUtils';

export interface SubjectRecentReviewItem {
  id: string;
  date: string;
  topicId: string;
  topicTitle: string;
  quality: ReviewQuality;
  qualityLabel: string;
  retentionPct: number;
  reviewLevel: number;
  badgeBgClass: string;
  barColorHex: string;
}

const QUALITY_META: Record<
  ReviewQuality,
  { label: string; defaultRetention: number; badgeBgClass: string; barColorHex: string }
> = {
  facil: {
    label: 'Fácil',
    defaultRetention: 95,
    badgeBgClass:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
    barColorHex: '#10b981',
  },
  bien: {
    label: 'Bien',
    defaultRetention: 82,
    badgeBgClass:
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    barColorHex: '#3b82f6',
  },
  dificil: {
    label: 'Difícil',
    defaultRetention: 58,
    badgeBgClass:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    barColorHex: '#f59e0b',
  },
  repetir: {
    label: 'Repetir',
    defaultRetention: 35,
    badgeBgClass:
      'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800',
    barColorHex: '#f43f5e',
  },
};

/**
 * Obtiene los últimos N repasos de Spaced Repetition registrados en una asignatura,
 * ordenados del más reciente al más antiguo, incluyendo fecha, tema, resultado y % de retención.
 */
export function getSubjectLastSpacedReviews(
  subject: Subject,
  limit: number = 3
): SubjectRecentReviewItem[] {
  const items: SubjectRecentReviewItem[] = [];

  (subject.topics || []).forEach((topic) => {
    (topic.reviewsHistory || []).forEach((rev, idx) => {
      const qMeta = QUALITY_META[rev.quality] || QUALITY_META.bien;
      const retentionPct =
        rev.retentionPct !== undefined
          ? Math.max(5, Math.min(100, Math.round(rev.retentionPct)))
          : qMeta.defaultRetention;

      items.push({
        id: `${topic.id}-rev-${idx}-${rev.date}`,
        date: rev.date,
        topicId: topic.id,
        topicTitle: topic.title,
        quality: rev.quality,
        qualityLabel: qMeta.label,
        retentionPct,
        reviewLevel: topic.reviewLevel || idx + 1,
        badgeBgClass: qMeta.badgeBgClass,
        barColorHex: qMeta.barColorHex,
      });
    });
  });

  // Ordenar de más reciente a más antiguo
  items.sort((a, b) => b.date.localeCompare(a.date));

  return items.slice(0, limit);
}

export interface SubjectSpacedRepetitionAlert {
  hasPendingToday: boolean;
  totalPendingToday: number;
  dueTodayCount: number;
  overdueCount: number;
  pendingTopics: Topic[];
  pendingTopicIds: string[];
  todayStr: string;
}

/**
 * Calcula cuántos temas de una asignatura tienen un repaso de Spaced Repetition
 * pendiente para hoy (incluyendo los programados exactamente para hoy y los vencidos/pendientes).
 */
export function getSubjectSpacedRepetitionAlert(
  subject: Subject,
  includeOverdue: boolean = true,
  customTodayStr?: string
): SubjectSpacedRepetitionAlert {
  const todayStr = customTodayStr || getTodayLocalDateStr();
  const topics = subject.topics || [];

  const pendingTopics: Topic[] = [];
  let dueTodayCount = 0;
  let overdueCount = 0;

  topics.forEach((topic) => {
    if (topic.nextReviewDate) {
      if (topic.nextReviewDate === todayStr) {
        dueTodayCount += 1;
        pendingTopics.push(topic);
      } else if (includeOverdue && topic.nextReviewDate < todayStr) {
        overdueCount += 1;
        pendingTopics.push(topic);
      }
    } else if (
      (topic.status === 'estudiado' || topic.status === 'repasado') &&
      topic.studiedAt &&
      topic.studiedAt <= todayStr
    ) {
      // Si el tema ya fue estudiado pero aún no tenía fecha de próximo repaso asignada, requiere su primer repaso hoy
      dueTodayCount += 1;
      pendingTopics.push(topic);
    }
  });

  return {
    hasPendingToday: pendingTopics.length > 0,
    totalPendingToday: pendingTopics.length,
    dueTodayCount,
    overdueCount,
    pendingTopics,
    pendingTopicIds: pendingTopics.map((t) => t.id),
    todayStr,
  };
}

export interface SubjectProgressAlert {
  isAlert: boolean;
  progressPct: number;
  studiedTopics: number;
  totalTopics: number;
  pagesRead: number;
  totalPages: number;
  courseStartDate: string;
  daysSinceCourseStart: number;
  weeksSinceCourseStart: number;
  isPastTwoWeeks: boolean;
  reason?: string;
}

/**
 * Evalúa si una asignatura tiene una alerta de ritmo bajo:
 * - Progreso académico (integrando páginas leídas y temas) inferior al 20% (< 20%)
 * - Tras haber pasado más de dos semanas (> 14 días) desde el inicio del curso escolar.
 */
export function checkSubjectProgressAlert(
  subject: Subject,
  year?: AcademicYear | null,
  customNow?: Date
): SubjectProgressAlert {
  const topics = subject.topics || [];
  const academicProgress = schedulerService.calculateSubjectAcademicProgress(topics);
  const totalTopics = academicProgress.totalTopics;
  const studiedTopics = academicProgress.completedTopics;
  const pagesRead = academicProgress.pagesRead;
  const totalPages = academicProgress.totalPages;
  const progressPct = academicProgress.progressPct;

  // Fecha de inicio del curso académico (prioridad: subject.startDate > year.startDate > '2026-09-15')
  const courseStartDate = subject.startDate || year?.startDate || '2026-09-15';
  const start = new Date(courseStartDate);
  const now = customNow || new Date();

  // Diferencia en días transcurridos
  const diffMs = now.getTime() - start.getTime();
  const daysSinceCourseStart = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const weeksSinceCourseStart = Math.floor(daysSinceCourseStart / 7);

  // Condiciones requeridas por el usuario:
  // 1. Más de dos semanas (> 14 días) desde el inicio del curso
  // 2. Progreso académico inferior al 20%
  const isPastTwoWeeks = daysSinceCourseStart > 14;
  const isLowProgress = totalTopics > 0 && progressPct < 20;
  const isAlert = isPastTwoWeeks && isLowProgress;

  let reason: string | undefined;
  if (isAlert) {
    reason = `Avance académico de ${progressPct}% (${pagesRead}/${totalPages} páginas leídas, inferior al 20%) tras ${weeksSinceCourseStart} semanas desde el inicio del curso (${courseStartDate}).`;
  }

  return {
    isAlert,
    progressPct,
    studiedTopics,
    totalTopics,
    pagesRead,
    totalPages,
    courseStartDate,
    daysSinceCourseStart,
    weeksSinceCourseStart,
    isPastTwoWeeks,
    reason,
  };
}

/**
 * Obtiene todas las asignaturas de un curso que tienen la alerta activa.
 */
export function getYearSubjectsWithAlert(
  year: AcademicYear,
  customNow?: Date
): { subject: Subject; alert: SubjectProgressAlert }[] {
  if (!year || !year.subjects) return [];

  return year.subjects
    .map((sub) => ({
      subject: sub,
      alert: checkSubjectProgressAlert(sub, year, customNow),
    }))
    .filter((item) => item.alert.isAlert);
}

