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
  horizonDays: number; // Rango de exportación para eventos recurrentes (ej. 30, 60, 90, 180 días)
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
 * Pliega líneas largas a un máximo de 74 caracteres según RFC 5545 (CRLF + espacio)
 */
function foldIcsLine(line: string): string {
  const maxLen = 73;
  if (line.length <= maxLen) return line;
  const parts: string[] = [];
  let index = 0;
  while (index < line.length) {
    if (index === 0) {
      parts.push(line.slice(0, maxLen));
      index += maxLen;
    } else {
      parts.push(' ' + line.slice(index, index + maxLen - 1));
      index += maxLen - 1;
    }
  }
  return parts.join('\r\n');
}

/**
 * Convierte fecha YYYY-MM-DD y hora HH:mm a formato local iCalendar YYYYMMDDTHHMMSS
 */
function formatIcsDateTimeLocal(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const [rawH = '09', rawM = '00'] = (timeStr || '09:00').split(':');
  const hh = String(Math.max(0, Math.min(23, parseInt(rawH, 10) || 9))).padStart(2, '0');
  const mm = String(Math.max(0, Math.min(59, parseInt(rawM, 10) || 0))).padStart(2, '0');
  return `${cleanDate}T${hh}${mm}00`;
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
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
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
  const horizonEndStr = addDaysToDateStr(todayStr, Math.max(7, options.horizonDays || 60));
  const untilUtcStr = `${formatIcsDateOnly(horizonEndStr)}T235959Z`;

  const relevantSubjects = subjects.filter(
    (s) => !options.subjectFilterId || options.subjectFilterId === 'all' || s.id === options.subjectFilterId
  );

  const events: IcsPreviewEvent[] = [];
  const seenUids = new Set<string>();

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
          sub.tasks
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
      if (sess.date < todayStr || sess.date > horizonEndStr) return;

      const startTime = sess.startTime || '09:00';
      const durationMins = Math.max(15, Math.round((sess.durationHours || 1) * 60));
      const endTime = sess.endTime || addMinutesToTimeStr(startTime, durationMins);

      const prefix = isReview ? '🔄 [Repaso]' : '📚 [Estudio]';
      const pagesDetail = sess.pagesAllocation ? ` (${sess.pagesAllocation})` : '';

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

    // Añadir también temas con fecha u hora fijada manualmente y repasos programados directamente en el tema
    relevantSubjects.forEach((sub) => {
      sub.topics.forEach((topic) => {
        if (options.includeStudySessions && topic.scheduledDate) {
          if (topic.scheduledDate >= todayStr && topic.scheduledDate <= horizonEndStr) {
            const start =
              topic.studyTimeByDate?.[topic.scheduledDate] || topic.scheduledTime || '10:00';
            const durMins = Math.max(30, Math.round((topic.estimatedHours || 1.5) * 60));
            const end = topic.scheduledEndTime || addMinutesToTimeStr(start, durMins);

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
          if (topic.nextReviewDate >= todayStr && topic.nextReviewDate <= horizonEndStr) {
            const revStart =
              topic.reviewTimeByDate?.[topic.nextReviewDate] ||
              topic.reviewScheduledTime ||
              '17:00';
            const revEnd = addMinutesToTimeStr(revStart, 45);
            const cycleLevel = Math.max(1, topic.reviewLevel || 1);

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

      // Encontrar el primer día válido desde hoy
      let firstDateStr = todayStr;
      for (let offset = 0; offset < 7; offset++) {
        const candidate = addDaysToDateStr(todayStr, offset);
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
        for (let offset = 0; offset <= options.horizonDays; offset++) {
          const dateStr = addDaysToDateStr(todayStr, offset);
          const dow = getDayOfWeekFromDateStr(dateStr);
          if (freqDays.includes(dow)) {
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
      const isHabitBlock = block.id?.startsWith('habit-') || block.notes?.includes('Hábito');
      const isCustomStudyBlock =
        block.id?.startsWith('custom-study-') || block.linkedItemType === 'topic';

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
        if (block.date >= todayStr && block.date <= horizonEndStr) {
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
        let firstDateStr = todayStr;
        for (let offset = 0; offset < 7; offset++) {
          const candidate = addDaysToDateStr(todayStr, offset);
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
          for (let offset = 0; offset <= options.horizonDays; offset++) {
            const dateStr = addDaysToDateStr(todayStr, offset);
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
      const dedupeKey = `${ob.title.toLowerCase()}-${ob.startTime}-${ob.endTime}-${days
        .slice()
        .sort()
        .join(',')}`;
      if (seenObligationKeys.has(dedupeKey)) return;
      seenObligationKeys.add(dedupeKey);

      let firstDateStr = todayStr;
      for (let offset = 0; offset < 7; offset++) {
        const candidate = addDaysToDateStr(todayStr, offset);
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
        for (let offset = 0; offset <= options.horizonDays; offset++) {
          const dateStr = addDaysToDateStr(todayStr, offset);
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
      const dtStart = formatIcsDateTimeLocal(ev.date, ev.startTime);
      const dtEnd = formatIcsDateTimeLocal(
        ev.date,
        ev.endTime || addMinutesToTimeStr(ev.startTime, 60)
      );
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
    }

    if (ev.rrule) {
      lines.push(`RRULE:${ev.rrule}`);
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
