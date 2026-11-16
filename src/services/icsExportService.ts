import {
  Subject,
  StudyPreferences,
  BlockedTimeEvent,
  ScheduledStudySession,
  HabitItem,
  WeeklyObligation,
} from '../types';
import { schedulerService } from './schedulerService';
import { addDaysToDateStr, getDayOfWeekFromDateStr, getTodayLocalDateStr } from '../utils/dateUtils';

export interface IcsExportOptions {
  includeStudySessions: boolean; // Sesiones de estudio y bloques de estudio
  includeSpacedReviews: boolean; // Repasos espaciados (Curva del Olvido)
  includeHabits: boolean; // Hábitos configurados en HabitsTracker
  includeBlockedEvents: boolean; // Eventos bloqueados y compromisos fijos semanales
  includeExams: boolean; // Exámenes (y opcionalmente entregas/tareas con fecha)
  includeTasks: boolean; // Tareas y entregas evaluables
  horizonDays: number; // Rango de exportación (7 días semanal, 14, 30, 60, 90, 180 días)
  startDateStr?: string; // Fecha inicio explícita YYYY-MM-DD (ej. lunes de la semana visible)
  endDateStr?: string; // Fecha fin explícita YYYY-MM-DD (ej. domingo de la semana visible)
  useRRuleForRecurring: boolean; // Si se usa RRULE:FREQ=WEEKLY en lugar de expandir ocurrencias individuales
  includeAlarms: boolean; // Incluir recordatorios VALARM (15 min antes en estudio/hábitos, 24h en exámenes)
  subjectFilterId?: string; // 'all' o ID de asignatura específica
}

export interface IcsPreviewEvent {
  uid: string;
  title: string;
  category: 'estudio' | 'repaso' | 'habito' | 'bloqueo' | 'examen' | 'tarea';
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  description: string;
  rrule?: string;
  exdates?: string[]; // Fechas YYYY-MM-DD excluidas (EXDATE)
  isAllDay?: boolean;
  alarmMinutesBefore?: number;
}

const ICAL_DAY_CODES: Record<number, string> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
};

/**
 * Escapa texto según especificación RFC 5545 para propiedades iCalendar
 */
function escapeIcsText(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Pliega líneas largas a un máximo de 74 octetos UTF-8 según RFC 5545 (CRLF + espacio),
 * sin partir pares sustitutos (emojis) ni secuencias multibyte (tildes, ñ).
 */
const utf8Encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function getUtf8ByteLength(str: string): number {
  if (utf8Encoder) return utf8Encoder.encode(str).length;
  return unescape(encodeURIComponent(str)).length;
}

function foldIcsLine(line: string): string {
  const maxBytes = 74;
  if (getUtf8ByteLength(line) <= maxBytes) return line;

  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = getUtf8ByteLength(char);
    const limit = parts.length === 0 ? maxBytes : maxBytes - 1; // Espacio inicial ocupa 1 byte
    if (currentBytes + charBytes > limit && current.length > 0) {
      parts.push(parts.length === 0 ? current : ' ' + current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  if (current.length > 0) {
    parts.push(parts.length === 0 ? current : ' ' + current);
  }

  return parts.join('\r\n');
}

/**
 * Convierte fecha local YYYY-MM-DD y hora HH:mm a formato UTC iCalendar YYYYMMDDTHHMMSSZ
 * Compatible universalmente con Google Calendar, Microsoft Outlook (Web/Escritorio) y Apple Calendar.
 */
function formatDateObjToIcsUtc(dateObj: Date): string {
  const yyyy = dateObj.getUTCFullYear();
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  const hh = String(dateObj.getUTCHours()).padStart(2, '0');
  const min = String(dateObj.getUTCMinutes()).padStart(2, '0');
  const ss = String(dateObj.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

function formatIcsDateTimeUtc(dateStr: string, timeStr: string): string {
  const [yStr = '2026', mStr = '01', dStr = '01'] = dateStr.split('-');
  const [rawH = '09', rawM = '00'] = (timeStr || '09:00').split(':');
  const year = parseInt(yStr, 10) || 2026;
  const month = (parseInt(mStr, 10) || 1) - 1;
  const day = parseInt(dStr, 10) || 1;
  const hh = Math.max(0, Math.min(23, parseInt(rawH, 10) || 0));
  const mm = Math.max(0, Math.min(59, parseInt(rawM, 10) || 0));
  const localDate = new Date(year, month, day, hh, mm, 0, 0);
  return formatDateObjToIcsUtc(localDate);
}

/**
 * Convierte fecha YYYY-MM-DD a formato YYYYMMDD para eventos de día completo
 */
function formatIcsDateOnly(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Suma minutos a una hora HH:mm y devuelve HH:mm
 */
function addMinutesToTimeStr(timeStr: string, minutesToAdd: number): string {
  const [h = 9, m = 0] = timeStr.split(':').map((n) => parseInt(n, 10) || 0);
  const totalMinutes = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + Math.round(minutesToAdd)));
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * Obtiene DTSTAMP actual en UTC (YYYYMMDDTHHMMSSZ)
 */
function getCurrentUtcTimestamp(): string {
  return formatDateObjToIcsUtc(new Date());
}

/**
 * Hora por defecto según franja preferida de un hábito
 */
function getDefaultHabitStartTime(habit: HabitItem): string {
  if (habit.scheduledStartTime) return habit.scheduledStartTime;
  switch (habit.preferredPeriod) {
    case 'manana':
      return '08:30';
    case 'mediodia':
      return '14:00';
    case 'tarde':
      return '18:30';
    case 'noche':
      return '21:00';
    default:
      return '19:00';
  }
}

/**
 * Construye la lista estructurada de eventos a exportar según las opciones del usuario
 */
export function collectCalendarEventsForExport(
  subjects: Subject[],
  preferences: StudyPreferences,
  blockedEvents: BlockedTimeEvent[],
  options: IcsExportOptions,
  precomputedStudySessions?: ScheduledStudySession[]
): IcsPreviewEvent[] {
  const todayStr = getTodayLocalDateStr();
  const rangeStartStr = options.startDateStr || todayStr;
  const horizonEndStr =
    options.endDateStr || addDaysToDateStr(rangeStartStr, Math.max(6, (options.horizonDays || 60) - 1));
  const untilUtcStr = formatIcsDateTimeUtc(horizonEndStr, '23:59');

  const relevantSubjects = subjects.filter(
    (s) => !options.subjectFilterId || options.subjectFilterId === 'all' || s.id === options.subjectFilterId
  );

  const events: IcsPreviewEvent[] = [];
  const seenUids = new Set<string>();
  const emittedStudyTopicDates = new Set<string>();
  const emittedReviewTopicDates = new Set<string>();
  const seenBlockedSemanticKeys = new Set<string>();

  const normalizeSemanticBlockTitle = (rawTitle: string): string =>
    rawTitle
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '')
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim()
      .toLowerCase();

  const pushUniqueEvent = (ev: IcsPreviewEvent) => {
    if (seenUids.has(ev.uid)) return;
    seenUids.add(ev.uid);
    events.push(ev);
  };

  // 1. Sesiones de Estudio y Repasos del Planificador Inteligente
  if (options.includeStudySessions || options.includeSpacedReviews) {
    let sessions: ScheduledStudySession[] = [];

    if (precomputedStudySessions && precomputedStudySessions.length > 0) {
      sessions = precomputedStudySessions.filter(
        (s) =>
          !options.subjectFilterId ||
          options.subjectFilterId === 'all' ||
          s.subjectId === options.subjectFilterId
      );
    } else {
      const cumulativeBlocks: BlockedTimeEvent[] = [...blockedEvents];
      relevantSubjects.forEach((sub) => {
        const res = schedulerService.generateSmartSchedule(
          sub.topics,
          sub.id,
          sub.name,
          sub.color,
          sub.exams,
          preferences,
          undefined,
          cumulativeBlocks,
          sub.tasks,
          sub.projects,
          sub.gradingConfig
        );
        res.sessions.forEach((sess) => {
          if (sess.startTime && sess.endTime) {
            cumulativeBlocks.push({
              id: `ics-sess-${sess.id}`,
              title: sess.topicTitle,
              date: sess.date,
              startTime: sess.startTime,
              endTime: sess.endTime,
              category: 'otro',
            });
          }
        });
        sessions.push(...res.sessions);
      });
    }

    sessions.forEach((sess) => {
      const isReview = sess.type === 'repaso_espaciado';
      if (isReview && !options.includeSpacedReviews) return;
      if (!isReview && !options.includeStudySessions) return;
      if (sess.date < rangeStartStr || sess.date > horizonEndStr) return;

      const startTime = sess.startTime || '09:00';
      const durationMins = Math.max(15, Math.round((sess.durationHours || 1) * 60));
      const endTime = sess.endTime || addMinutesToTimeStr(startTime, durationMins);

      const prefix = isReview ? '🔄 [Repaso]' : '📚 [Estudio]';
      const pagesDetail = sess.pagesAllocation ? ` (${sess.pagesAllocation})` : '';

      if (isReview) {
        emittedReviewTopicDates.add(`${sess.topicId}::${sess.date}`);
      } else {
        emittedStudyTopicDates.add(`${sess.topicId}::${sess.date}`);
      }

      pushUniqueEvent({
        uid: `studyflow-sess-${sess.id}-${sess.date}@studyflow.app`,
        title: `${prefix} ${sess.subjectName}: ${sess.topicTitle}${pagesDetail}`,
        category: isReview ? 'repaso' : 'estudio',
        date: sess.date,
        startTime,
        endTime,
        description: [
          `Asignatura: ${sess.subjectName}`,
          `Tema: ${sess.topicTitle}`,
          `Tipo de bloque: ${isReview ? 'Repaso Espaciado (Curva del Olvido)' : 'Estudio de Temario'}`,
          sess.pagesAllocation ? `Páginas asignadas: ${sess.pagesAllocation}` : '',
          `Duración planificada: ${sess.durationHours}h`,
        ]
          .filter(Boolean)
          .join('\n'),
        alarmMinutesBefore: options.includeAlarms ? 15 : undefined,
      });
    });

    // Añadir también temas con fecha u hora fijada manualmente y repasos programados directamente en el tema (evitando duplicados)
    relevantSubjects.forEach((sub) => {
      sub.topics.forEach((topic) => {
        if (options.includeStudySessions && topic.scheduledDate) {
          const studyKey = `${topic.id}::${topic.scheduledDate}`;
          if (
            !emittedStudyTopicDates.has(studyKey) &&
            topic.scheduledDate >= rangeStartStr &&
            topic.scheduledDate <= horizonEndStr
          ) {
            const start =
              topic.studyTimeByDate?.[topic.scheduledDate] || topic.scheduledTime || '10:00';
            const durMins = Math.max(30, Math.round((topic.estimatedHours || 1.5) * 60));
            const end = topic.scheduledEndTime || addMinutesToTimeStr(start, durMins);

            emittedStudyTopicDates.add(studyKey);
            pushUniqueEvent({
              uid: `studyflow-topic-pin-${sub.id}-${topic.id}-${topic.scheduledDate}@studyflow.app`,
              title: `📚 [Estudio] ${sub.name}: ${topic.title}`,
              category: 'estudio',
              date: topic.scheduledDate,
              startTime: start,
              endTime: end,
              description: [
                `Asignatura: ${sub.name}`,
                `Tema: ${topic.title}`,
                topic.description ? `Resumen: ${topic.description}` : '',
                `Dificultad: ${topic.difficulty}`,
              ]
                .filter(Boolean)
                .join('\n'),
              alarmMinutesBefore: options.includeAlarms ? 15 : undefined,
            });
          }
        }

        if (options.includeSpacedReviews && topic.nextReviewDate) {
          const reviewKey = `${topic.id}::${topic.nextReviewDate}`;
          if (
            !emittedReviewTopicDates.has(reviewKey) &&
            topic.nextReviewDate >= rangeStartStr &&
            topic.nextReviewDate <= horizonEndStr
          ) {
            const revStart =
              topic.reviewTimeByDate?.[topic.nextReviewDate] ||
              topic.reviewScheduledTime ||
              '17:00';
            const revEnd = addMinutesToTimeStr(revStart, 45);
            const cycleLevel = Math.max(1, topic.reviewLevel || 1);

            emittedReviewTopicDates.add(reviewKey);
            pushUniqueEvent({
              uid: `studyflow-review-${sub.id}-${topic.id}-${topic.nextReviewDate}@studyflow.app`,
              title: `🧠 [Repaso R${cycleLevel}] ${sub.name}: ${topic.title}`,
              category: 'repaso',
              date: topic.nextReviewDate,
              startTime: revStart,
              endTime: revEnd,
              description: [
                `Repaso Espaciado (Ciclo R${cycleLevel})`,
                `Asignatura: ${sub.name}`,
                `Tema: ${topic.title}`,
                `Vueltas acumuladas: ${topic.vueltasCount || 1}`,
              ].join('\n'),
              alarmMinutesBefore: options.includeAlarms ? 15 : undefined,
            });
          }
        }
      });
    });
  }

  // 2. Hábitos diarios / semanales (HabitsTracker)
  if (options.includeHabits && preferences.habits && preferences.habits.length > 0) {
    preferences.habits.forEach((habit) => {
      const freqDays =
        habit.frequencyDays && habit.frequencyDays.length > 0
          ? habit.frequencyDays
          : [1, 2, 3, 4, 5];
      const startTime = getDefaultHabitStartTime(habit);
      const durationMins = habit.durationMinutes || 45;
      const endTime = habit.scheduledEndTime || addMinutesToTimeStr(startTime, durationMins);
      const semKey = `${normalizeSemanticBlockTitle(habit.title)}|${startTime}|${endTime}`;
      seenBlockedSemanticKeys.add(semKey);

      // Encontrar el primer día válido dentro del rango
      let firstDateStr = rangeStartStr;
      for (let offset = 0; offset < 7; offset++) {
        const candidate = addDaysToDateStr(rangeStartStr, offset);
        const dow = getDayOfWeekFromDateStr(candidate);
        if (freqDays.includes(dow)) {
          firstDateStr = candidate;
          break;
        }
      }

      if (options.useRRuleForRecurring) {
        const byDayList = freqDays
          .map((d) => ICAL_DAY_CODES[d])
          .filter(Boolean)
          .join(',');
        pushUniqueEvent({
          uid: `studyflow-habit-${habit.id}@studyflow.app`,
          title: `${habit.emoji || '✨'} [Hábito] ${habit.title}`,
          category: 'habito',
          date: firstDateStr,
          startTime,
          endTime,
          location: habit.location,
          rrule: `FREQ=WEEKLY;BYDAY=${byDayList};UNTIL=${untilUtcStr}`,
          description: [
            `Hábito personal: ${habit.title}`,
            `Categoría: ${habit.category}`,
            habit.location ? `Ubicación: ${habit.location}` : '',
            `Duración asignada: ${durationMins} min`,
          ]
            .filter(Boolean)
            .join('\n'),
          alarmMinutesBefore: options.includeAlarms ? 10 : undefined,
        });
      } else {
        for (let offset = 0; offset <= Math.max(6, options.horizonDays || 60); offset++) {
          const dateStr = addDaysToDateStr(rangeStartStr, offset);
          if (dateStr > horizonEndStr) break;
          const dow = getDayOfWeekFromDateStr(dateStr);
          if (freqDays.includes(dow)) {
            seenBlockedSemanticKeys.add(`${normalizeSemanticBlockTitle(habit.title)}|${dateStr}|${startTime}|${endTime}`);
            pushUniqueEvent({
              uid: `studyflow-habit-${habit.id}-${dateStr}@studyflow.app`,
              title: `${habit.emoji || '✨'} [Hábito] ${habit.title}`,
              category: 'habito',
              date: dateStr,
              startTime,
              endTime,
              location: habit.location,
              description: [
                `Hábito personal: ${habit.title}`,
                `Categoría: ${habit.category}`,
                habit.location ? `Ubicación: ${habit.location}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
              alarmMinutesBefore: options.includeAlarms ? 10 : undefined,
            });
          }
        }
      }
    });
  }

  // 3. Eventos Bloqueados (BlockedTimeEvent + WeeklyObligation)
  if (options.includeBlockedEvents) {
    blockedEvents.forEach((block) => {
      const startTime = block.startTime || '09:00';
      const endTime = block.endTime || addMinutesToTimeStr(startTime, 60);
      const isHabitBlock =
        block.id?.startsWith('habit-') ||
        block.notes?.includes('Hábito');
      const isCustomStudyBlock =
        block.id?.startsWith('custom-study-') || block.linkedItemType === 'topic';
      const normalizedBlockTitle = normalizeSemanticBlockTitle(block.title);

      const categoryType: IcsPreviewEvent['category'] = isHabitBlock
        ? 'habito'
        : isCustomStudyBlock
        ? 'estudio'
        : 'bloqueo';

      const prefix = isHabitBlock
        ? '✨ [Hábito Bloqueado]'
        : isCustomStudyBlock
        ? '📚 [Bloque Estudio]'
        : '🔒 [Bloqueado]';

      if (block.date) {
        const isDuplicateTopicSession =
          !block.id?.startsWith('custom-study-') &&
          (block.linkedItemType === 'topic' || block.id?.startsWith('block-topic-')) &&
          block.linkedTopicId &&
          emittedStudyTopicDates.has(`${block.linkedTopicId}::${block.date}`);
        if (isDuplicateTopicSession) return;

        const instanceKey = `${normalizedBlockTitle}|${block.date}|${startTime}|${endTime}`;
        if (seenBlockedSemanticKeys.has(instanceKey)) return;
        seenBlockedSemanticKeys.add(instanceKey);

        if (block.date >= rangeStartStr && block.date <= horizonEndStr) {
          pushUniqueEvent({
            uid: `studyflow-block-${block.id}-${block.date}@studyflow.app`,
            title: `${prefix} ${block.title}`,
            category: categoryType,
            date: block.date,
            startTime,
            endTime,
            description: [
              `Evento bloqueado en StudyFlow: ${block.title}`,
              `Categoría: ${block.category}`,
              block.subjectName ? `Asignatura vinculada: ${block.subjectName}` : '',
              block.notes ? `Notas: ${block.notes}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            alarmMinutesBefore: options.includeAlarms ? 15 : undefined,
          });
        }
      } else if (block.recurringDays && block.recurringDays.length > 0) {
        const recurringKey = `${normalizedBlockTitle}|${startTime}|${endTime}`;
        if (seenBlockedSemanticKeys.has(recurringKey)) return;
        seenBlockedSemanticKeys.add(recurringKey);

        const excludedSet = new Set(block.excludedDates || []);
        let firstDateStr = rangeStartStr;
        for (let offset = 0; offset < 7; offset++) {
          const candidate = addDaysToDateStr(rangeStartStr, offset);
          if (block.recurringDays.includes(getDayOfWeekFromDateStr(candidate))) {
            firstDateStr = candidate;
            break;
          }
        }

        if (options.useRRuleForRecurring) {
          const byDay = block.recurringDays
            .map((d) => ICAL_DAY_CODES[d])
            .filter(Boolean)
            .join(',');
          pushUniqueEvent({
            uid: `studyflow-recblock-${block.id}@studyflow.app`,
            title: `${prefix} ${block.title}`,
            category: categoryType,
            date: firstDateStr,
            startTime,
            endTime,
            rrule: `FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilUtcStr}`,
            exdates: block.excludedDates && block.excludedDates.length > 0 ? block.excludedDates : undefined,
            description: [
              `Bloqueo fijo semanal: ${block.title}`,
              `Categoría: ${block.category}`,
              block.notes ? `Notas: ${block.notes}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            alarmMinutesBefore: options.includeAlarms ? 15 : undefined,
          });
        } else {
          for (let offset = 0; offset <= Math.max(6, options.horizonDays || 60); offset++) {
            const dateStr = addDaysToDateStr(rangeStartStr, offset);
            if (dateStr > horizonEndStr) break;
            if (excludedSet.has(dateStr)) continue;
            if (block.recurringDays.includes(getDayOfWeekFromDateStr(dateStr))) {
              pushUniqueEvent({
                uid: `studyflow-recblock-${block.id}-${dateStr}@studyflow.app`,
                title: `${prefix} ${block.title}`,
                category: categoryType,
                date: dateStr,
                startTime,
                endTime,
                description: [
                  `Bloqueo fijo semanal: ${block.title}`,
                  `Categoría: ${block.category}`,
                  block.notes ? `Notas: ${block.notes}` : '',
                ]
                  .filter(Boolean)
                  .join('\n'),
                alarmMinutesBefore: options.includeAlarms ? 15 : undefined,
              });
            }
          }
        }
      }
    });

    // Obligaciones semanales fijas en preferences.weeklyFixedObligations
    const obligations: WeeklyObligation[] = preferences.weeklyFixedObligations || [];
    const seenObligationKeys = new Set<string>();

    obligations.forEach((ob) => {
      const days =
        ob.recurringDays && ob.recurringDays.length > 0 ? ob.recurringDays : [ob.dayOfWeek];
      const normalizedObTitle = normalizeSemanticBlockTitle(ob.title);
      const semanticObKey = `${normalizedObTitle}|${ob.startTime}|${ob.endTime}`;
      if (seenBlockedSemanticKeys.has(semanticObKey)) return;

      const dedupeKey = `${ob.title.toLowerCase()}-${ob.startTime}-${ob.endTime}-${days
        .slice()
        .sort()
        .join(',')}`;
      if (seenObligationKeys.has(dedupeKey)) return;
      seenObligationKeys.add(dedupeKey);
      seenBlockedSemanticKeys.add(semanticObKey);

      const excludedSet = new Set(ob.excludedDates || []);
      let firstDateStr = rangeStartStr;
      for (let offset = 0; offset < 7; offset++) {
        const candidate = addDaysToDateStr(rangeStartStr, offset);
        if (days.includes(getDayOfWeekFromDateStr(candidate))) {
          firstDateStr = candidate;
          break;
        }
      }

      if (options.useRRuleForRecurring) {
        const byDay = days
          .map((d) => ICAL_DAY_CODES[d])
          .filter(Boolean)
          .join(',');
        pushUniqueEvent({
          uid: `studyflow-obligation-${ob.id}@studyflow.app`,
          title: `🔒 [Horario Fijo] ${ob.title}`,
          category: 'bloqueo',
          date: firstDateStr,
          startTime: ob.startTime,
          endTime: ob.endTime,
          rrule: `FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilUtcStr}`,
          exdates: ob.excludedDates && ob.excludedDates.length > 0 ? ob.excludedDates : undefined,
          description: [
            `Compromiso fijo semanal: ${ob.title}`,
            `Categoría: ${ob.category}`,
            ob.notes ? `Notas: ${ob.notes}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          alarmMinutesBefore: options.includeAlarms ? 15 : undefined,
        });
      } else {
        for (let offset = 0; offset <= Math.max(6, options.horizonDays || 60); offset++) {
          const dateStr = addDaysToDateStr(rangeStartStr, offset);
          if (dateStr > horizonEndStr) break;
          if (excludedSet.has(dateStr)) continue;
          if (days.includes(getDayOfWeekFromDateStr(dateStr))) {
            pushUniqueEvent({
              uid: `studyflow-obligation-${ob.id}-${dateStr}@studyflow.app`,
              title: `🔒 [Horario Fijo] ${ob.title}`,
              category: 'bloqueo',
              date: dateStr,
              startTime: ob.startTime,
              endTime: ob.endTime,
              description: [
                `Compromiso fijo semanal: ${ob.title}`,
                `Categoría: ${ob.category}`,
                ob.notes ? `Notas: ${ob.notes}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
              alarmMinutesBefore: options.includeAlarms ? 15 : undefined,
            });
          }
        }
      }
    });
  }

  // 4. Exámenes Oficiales y Simulacros
  if (options.includeExams) {
    relevantSubjects.forEach((sub) => {
      (sub.exams || []).forEach((exam) => {
        if (!exam.date) return;
        if (options.endDateStr && (exam.date < rangeStartStr || exam.date > horizonEndStr)) return;
        const hasSpecificTime = Boolean(exam.time && exam.time.includes(':'));
        const startTime = hasSpecificTime ? exam.time! : '09:00';
        const endTime = addMinutesToTimeStr(startTime, 120);

        pushUniqueEvent({
          uid: `studyflow-exam-${sub.id}-${exam.id}@studyflow.app`,
          title: `🎓 [EXAMEN] ${sub.name}: ${exam.title}`,
          category: 'examen',
          date: exam.date,
          startTime: hasSpecificTime ? startTime : undefined,
          endTime: hasSpecificTime ? endTime : undefined,
          isAllDay: !hasSpecificTime,
          location: exam.location || sub.classroom,
          description: [
            `Examen de ${sub.name}`,
            `Título: ${exam.title}`,
            `Modalidad: ${exam.examType.toUpperCase()} · Dificultad: ${exam.difficulty}`,
            exam.convocatoria ? `Convocatoria: ${exam.convocatoria}` : '',
            exam.weightPercentage ? `Ponderación en nota final: ${exam.weightPercentage}%` : '',
            exam.targetGrade ? `Nota objetivo: ${exam.targetGrade}/10` : '',
            exam.notes ? `Observaciones: ${exam.notes}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          alarmMinutesBefore: options.includeAlarms ? 1440 : undefined, // 24h antes
        });
      });
    });
  }

  // 5. Tareas y Entregas
  if (options.includeTasks) {
    relevantSubjects.forEach((sub) => {
      (sub.tasks || []).forEach((task) => {
        if (!task.dueDate || task.completed) return;
        if (options.endDateStr && (task.dueDate < rangeStartStr || task.dueDate > horizonEndStr)) return;
        const startTime = task.startTime || task.scheduledTime || '18:00';
        const dur = task.durationMinutes || 60;
        const endTime = task.endTime || addMinutesToTimeStr(startTime, dur);

        pushUniqueEvent({
          uid: `studyflow-task-${sub.id}-${task.id}@studyflow.app`,
          title: `📌 [Entrega] ${sub.name}: ${task.title}`,
          category: 'tarea',
          date: task.dueDate,
          startTime,
          endTime,
          description: [
            `Tarea / Entrega de ${sub.name}`,
            `Prioridad: ${task.priority.toUpperCase()} · Tipo: ${task.type}`,
            task.weightPercentage ? `Ponderación: ${task.weightPercentage}%` : '',
            task.notes ? `Notas: ${task.notes}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          alarmMinutesBefore: options.includeAlarms ? 60 : undefined,
        });
      });
    });
  }

  events.sort((a, b) => {
    const cmpDate = a.date.localeCompare(b.date);
    if (cmpDate !== 0) return cmpDate;
    return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
  });

  return events;
}

/**
 * Genera el contenido RFC 5545 de un archivo .ics a partir de los eventos recopilados
 */
export function generateIcsFileContent(
  events: IcsPreviewEvent[],
  calendarName = 'StudyFlow · Plan de Estudio, Hábitos y Exámenes'
): string {
  const dtStamp = getCurrentUtcTimestamp();
  const timeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
      : 'Europe/Madrid';

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyFlow//Planificador Academico Inteligente//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${escapeIcsText(timeZone)}`,
    'X-WR-CALDESC:Plan de estudio inteligente\\, bloques horarios\\, habitos y examenes exportados desde StudyFlow.',
  ];

  events.forEach((ev) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);

    if (ev.isAllDay || !ev.startTime) {
      const startDay = formatIcsDateOnly(ev.date);
      const nextDay = formatIcsDateOnly(addDaysToDateStr(ev.date, 1));
      lines.push(`DTSTART;VALUE=DATE:${startDay}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay}`);
    } else {
      const dtStart = formatIcsDateTimeUtc(ev.date, ev.startTime);
      const safeEndTime =
        ev.endTime && ev.endTime > ev.startTime
          ? ev.endTime
          : addMinutesToTimeStr(ev.startTime, 60);
      const dtEnd = formatIcsDateTimeUtc(ev.date, safeEndTime);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
    }

    if (ev.rrule) {
      lines.push(`RRULE:${ev.rrule}`);
      if (ev.exdates && ev.exdates.length > 0) {
        if (ev.isAllDay || !ev.startTime) {
          lines.push(
            `EXDATE;VALUE=DATE:${ev.exdates.map((d) => formatIcsDateOnly(d)).join(',')}`
          );
        } else {
          lines.push(
            `EXDATE:${ev.exdates
              .map((d) => formatIcsDateTimeUtc(d, ev.startTime!))
              .join(',')}`
          );
        }
      }
    }

    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);

    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }

    if (ev.location) {
      lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    }

    const categoryLabel =
      ev.category === 'estudio'
        ? 'Estudio'
        : ev.category === 'repaso'
        ? 'Repaso Espaciado'
        : ev.category === 'habito'
        ? 'Habito'
        : ev.category === 'examen'
        ? 'Examen'
        : ev.category === 'tarea'
        ? 'Entrega'
        : 'Bloqueo Horario';

    lines.push(`CATEGORIES:${escapeIcsText(categoryLabel)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('X-MICROSOFT-CDO-BUSYSTATUS:BUSY');

    if (ev.alarmMinutesBefore && ev.alarmMinutesBefore > 0) {
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${ev.alarmMinutesBefore}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcsText(`Recordatorio StudyFlow: ${ev.title}`)}`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/**
 * Descarga en el navegador el archivo .ics generado
 */
export function downloadIcsFile(
  icsContent: string,
  filename = `studyflow-plan-${getTodayLocalDateStr()}.ics`
): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Escapa un campo para formato CSV estándar RFC 4180
 */
function escapeCsvCell(value: string | undefined): string {
  const str = (value || '').replace(/\r?\n/g, ' | ');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Genera el contenido CSV compatible con Google Calendar, Microsoft Outlook y Excel
 */
export function generateCsvFileContent(events: IcsPreviewEvent[]): string {
  const headers = [
    'Subject',
    'Start Date',
    'Start Time',
    'End Date',
    'End Time',
    'All Day Event',
    'Description',
    'Location',
    'Categories',
  ];

  const rows = events.map((ev) => {
    const isAllDay = Boolean(ev.isAllDay || !ev.startTime);
    const startTime = isAllDay ? '' : ev.startTime || '09:00';
    const endTime = isAllDay ? '' : ev.endTime || addMinutesToTimeStr(startTime, 60);
    const categoryLabel =
      ev.category === 'estudio'
        ? 'Estudio'
        : ev.category === 'repaso'
        ? 'Repaso Espaciado'
        : ev.category === 'habito'
        ? 'Habito'
        : ev.category === 'examen'
        ? 'Examen'
        : ev.category === 'tarea'
        ? 'Entrega'
        : 'Bloqueo Horario';

    return [
      escapeCsvCell(ev.title),
      escapeCsvCell(ev.date),
      escapeCsvCell(startTime),
      escapeCsvCell(ev.date),
      escapeCsvCell(endTime),
      isAllDay ? 'True' : 'False',
      escapeCsvCell(ev.description),
      escapeCsvCell(ev.location || ''),
      escapeCsvCell(categoryLabel),
    ].join(',');
  });

  // UTF-8 BOM para asegurar compatibilidad con acentos en Excel y Outlook en español
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n') + '\r\n';
}

/**
 * Descarga en el navegador el archivo .csv generado
 */
export function downloadCsvFile(
  csvContent: string,
  filename = `studyflow-plan-semanal-${getTodayLocalDateStr()}.csv`
): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
