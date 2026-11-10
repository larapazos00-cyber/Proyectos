import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  Play,
  FileText,
  Layers,
  Plus,
  Trash2,
  Ban,
  X,
  Brain,
  TrendingUp,
  Award,
  History,
  Check,
  Info,
  Filter,
  GripVertical,
  Wand2,
  Zap,
  Repeat,
  Dumbbell,
  GraduationCap,
  Briefcase,
  Coffee,
  Download,
} from 'lucide-react';
import {
  Subject,
  Topic,
  StudyPreferences,
  ScheduledStudySession,
  Task,
  Exam,
  CalendarViewType,
  BlockedTimeEvent,
  WeeklyObligation,
  PomodoroLog,
  ReviewQuality,
  SpacedReviewRecord,
} from '../types';
import { schedulerService } from '../services/schedulerService';
import { WeeklyAvailabilityPlanner } from './WeeklyAvailabilityPlanner';
import { HabitsAndMoodTrackerBar } from './HabitsAndMoodTrackerBar';
import { IcsCalendarExportModal } from './IcsCalendarExportModal';
import {
  ProjectedReviewMilestone,
  TopicReviewAnalysis,
} from './SpacedRepetitionCalendarView';
import {
  toLocalDateStr,
  parseLocalDate,
  getTodayLocalDateStr,
  getDayOfWeekFromDateStr,
  formatReadableDate,
  addDaysToDateStr,
  diffDaysBetween,
  getWeekDates as getWeekDatesList,
  getDaysInMonthGrid,
} from '../utils/dateUtils';

export type DraggedCalendarItem =
  | {
      kind: 'topic_session';
      subjectId: string;
      topicId: string;
      sourceDateStr: string;
      sourceHourStr?: string;
      title?: string;
      topicTitle?: string;
      subjectName: string;
      durationHours?: number;
    }
  | {
      kind: 'spaced_review';
      subjectId: string;
      topicId: string;
      cycle: number;
      sourceDateStr: string;
      sourceHourStr?: string;
      title?: string;
      topicTitle?: string;
      subjectName: string;
      label: string;
    }
  | {
      kind: 'task';
      subjectId: string;
      taskId: string;
      sourceDateStr: string;
      sourceHourStr?: string;
      title?: string;
      taskTitle?: string;
      subjectName: string;
    }
  | {
      kind: 'blocked_event';
      eventId: string;
      isWeeklyObligation?: boolean;
      sourceObligationId?: string;
      sourceDateStr: string;
      sourceHourStr?: string;
      title: string;
      durationHours?: number;
    };

export interface EffectiveBlockedCalendarItem extends BlockedTimeEvent {
  isRecurringWeekly?: boolean;
  isWeeklyObligation?: boolean;
  sourceObligationId?: string;
  durationHours?: number;
}

interface SmartCalendarModalProps {
  subjects: Subject[];
  preferences: StudyPreferences;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  blockedEvents?: BlockedTimeEvent[];
  onAddBlockedEvent?: (event: BlockedTimeEvent) => void;
  onDeleteBlockedEvent?: (id: string) => void;
  onUpdateBlockedEvent?: (event: BlockedTimeEvent) => void;
  onUpdateTopicsSchedule: (subjectId: string, updatedTopics: any[]) => void;
  onUpdateSubject?: (updatedSubject: Subject) => void;
  onBatchUpdateSubjects?: (updatedSubjects: Subject[]) => void;
  onAddTaskToSubject?: (subjectId: string, task: Task) => void;
  pomodoroLogs?: PomodoroLog[];
  onSelectSubject: (subjectId: string) => void;
  onToggleTask?: (subjectId: string, taskId: string, completed: boolean) => void;
  onStartPomodoro?: (subjectId: string, topicId?: string) => void;
  onOpenProgramManager?: () => void;
  onOpenPreferences?: () => void;
}

const BASE_INTERVALS = [
  { cycle: 1, days: 1, name: '1er repaso · 24 horas' },
  { cycle: 2, days: 3, name: '2º repaso · A los 3 días' },
  { cycle: 3, days: 7, name: '3º repaso · A la semana (7 días)' },
  { cycle: 4, days: 15, name: '4º repaso · A los 15 días' },
  { cycle: 5, days: 30, name: '5º repaso · Al mes (30 días)' },
];

export const SmartCalendarModal: React.FC<SmartCalendarModalProps> = ({
  subjects,
  preferences,
  onUpdatePreferences,
  blockedEvents = [],
  onAddBlockedEvent,
  onDeleteBlockedEvent,
  onUpdateBlockedEvent,
  onUpdateTopicsSchedule,
  onUpdateSubject,
  onBatchUpdateSubjects,
  onAddTaskToSubject,
  pomodoroLogs = [],
  onSelectSubject,
  onToggleTask,
  onStartPomodoro,
  onOpenProgramManager,
  onOpenPreferences,
}) => {
  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [calendarView, setCalendarView] = useState<CalendarViewType>('weekly');
  const [timeBlockMode, setTimeBlockMode] = useState<boolean>(true);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(todayStr);
  const [rescheduledNotice, setRescheduledNotice] = useState<string | null>(null);
  const [showAvailabilityPlanner, setShowAvailabilityPlanner] = useState<boolean>(false);
  const [showRetentionRoadmap, setShowRetentionRoadmap] = useState<boolean>(false);
  const [isRecalculatingAll, setIsRecalculatingAll] = useState<boolean>(false);
  const [showQuickBlockBar, setShowQuickBlockBar] = useState<boolean>(false);
  const [showDraggableTray, setShowDraggableTray] = useState<boolean>(false);
  const [showIcsExportModal, setShowIcsExportModal] = useState<boolean>(false);

  // Universal Drag-and-Drop state for Tasks, Study Topics, Spaced Reviews, and Blocked Events across Days & Hours
  const [draggedItem, setDraggedItem] = useState<DraggedCalendarItem | null>(null);
  const [draggedReview, setDraggedReview] = useState<{
    kind?: string;
    subjectId: string;
    topicId: string;
    cycle: number;
    sourceDateStr: string;
    sourceHourStr?: string;
    title?: string;
    topicTitle?: string;
    subjectName: string;
    label: string;
  } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Unified calendar layer filter: show everything together or filter specific layers
  const [calendarLayerFilter, setCalendarLayerFilter] = useState<
    'all' | 'estudio' | 'repaso' | 'examenes_tareas'
  >('all');
  const [includeUnstartedProjections, setIncludeUnstartedProjections] = useState<boolean>(false);
  const [urgencyFilter, setUrgencyFilter] = useState<
    'all' | 'actionable' | 'upcoming' | 'stable' | 'unstarted'
  >('all');

  // Estado para la sección de Vueltas al Temario (1ª, 2ª, 3ª+ Vuelta) y Tareas Semanales
  const [showVueltasSection, setShowVueltasSection] = useState<boolean>(true);
  const [vueltasFilter, setVueltasFilter] = useState<
    'all' | 'vuelta_0' | 'vuelta_1' | 'vuelta_2' | 'vuelta_3plus' | 'weekly_task'
  >('all');

  // Estado para la sección de Meta Diaria y Disponibilidad de Estudio (Cálculo directo de horas libres del calendario)
  const [showDailyGoalAvailabilitySection, setShowDailyGoalAvailabilitySection] = useState<boolean>(true);
  const [showCustomDaysGoal, setShowCustomDaysGoal] = useState<boolean>(false);
  const [localDailyGoalHours, setLocalDailyGoalHours] = useState<number>(() => preferences.dailyGoalHours ?? 4.0);
  const [localHoursPerDay, setLocalHoursPerDay] = useState<Record<number, number>>(() => ({
    1: 4.0, 2: 4.0, 3: 4.0, 4: 4.0, 5: 4.0, 6: 4.0, 0: 4.0,
    ...(preferences.hoursPerDay || {}),
  }));

  // Modal for adding a new Blocked Time Event (Fijo Semanal: Clases, Entrenos... OR Plan sobre la marcha)
  const [showAddBlockedModal, setShowAddBlockedModal] = useState<boolean>(false);
  const [blockedModalMode, setBlockedModalMode] = useState<'on_the_fly' | 'weekly_recurring'>('on_the_fly');
  const [blockedTitle, setBlockedTitle] = useState<string>('');
  const [blockedDate, setBlockedDate] = useState<string>(selectedDayStr);
  const [blockedRecurringDays, setBlockedRecurringDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [blockedStartTime, setBlockedStartTime] = useState<string>('16:00');
  const [blockedEndTime, setBlockedEndTime] = useState<string>('18:00');
  const [blockedCategory, setBlockedCategory] = useState<BlockedTimeEvent['category']>('personal');
  const [blockedNotes, setBlockedNotes] = useState<string>('');

  // Distinct active study programs present in subjects
  const distinctPrograms = useMemo(() => {
    const map = new Map<string, string>();
    subjects.forEach((s) => {
      if (s.programId && s.programName) {
        map.set(s.programId, s.programName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [subjects]);

  // 1. Compute Smart Study Plan sessions across subjects (avoiding time collisions across subjects)
  const allGeneratedSessions: ScheduledStudySession[] = [];
  let latestProjectedDate = todayStr;
  let isAnyAheadWarning = false;

  const relevantSubjects = subjects.filter((s) => {
    if (selectedSubjectId !== 'all' && s.id !== selectedSubjectId) return false;
    if (selectedProgramFilter !== 'all' && s.programId && s.programId !== selectedProgramFilter)
      return false;
    return true;
  });

  const cumulativeScheduleBlocks: BlockedTimeEvent[] = [...blockedEvents];
  relevantSubjects.forEach((sub) => {
    const result = schedulerService.generateSmartSchedule(
      sub.topics,
      sub.id,
      sub.name,
      sub.color,
      sub.exams,
      preferences,
      undefined,
      cumulativeScheduleBlocks,
      sub.tasks
    );

    result.sessions.forEach((sess) => {
      if (sess.startTime && sess.endTime) {
        cumulativeScheduleBlocks.push({
          id: `live-sess-${sess.id}`,
          title: sess.topicTitle,
          date: sess.date,
          startTime: sess.startTime,
          endTime: sess.endTime,
          category: 'otro',
        });
      }
    });

    allGeneratedSessions.push(...result.sessions);
    if (result.projectedCompletionDate > latestProjectedDate) {
      latestProjectedDate = result.projectedCompletionDate;
    }
    if (!result.isAheadOfExam) {
      isAnyAheadWarning = true;
    }
  });

  // Group daily new study sessions (Topics & Pages per day to arrive on time for exams/tasks) by date
  const sessionsByDate: Record<string, ScheduledStudySession[]> = {};
  allGeneratedSessions.forEach((sess) => {
    if (sess.type !== 'estudio_nuevo') return;
    if (!sessionsByDate[sess.date]) {
      sessionsByDate[sess.date] = [];
    }
    sessionsByDate[sess.date].push(sess);
  });

  // Group specific-date blocked events by date (avoid duplicating topic sessions already rendered in sessionsByDate, while always keeping custom study blocks)
  const blockedByDate: Record<string, BlockedTimeEvent[]> = {};
  blockedEvents.forEach((ev) => {
    if (ev.date) {
      const isAlreadyRenderedTopicSession =
        !ev.id?.startsWith('custom-study-') &&
        (ev.linkedItemType === 'topic' || ev.id?.startsWith('block-topic-')) &&
        (sessionsByDate[ev.date] || []).some((s) => s.topicId === ev.linkedTopicId);
      if (isAlreadyRenderedTopicSession) {
        return;
      }
      if (!blockedByDate[ev.date]) {
        blockedByDate[ev.date] = [];
      }
      blockedByDate[ev.date].push(ev);
    }
  });

  // Helper: Get ALL effective blocked items for a specific date (includes specific-date plans, custom study blocks, AND weekly recurring blocks)
  const getEffectiveBlockedForDate = (dateStr: string): EffectiveBlockedCalendarItem[] => {
    const dayOfWeek = getDayOfWeekFromDateStr(dateStr);
    const list: EffectiveBlockedCalendarItem[] = [];
    const seenKeys = new Set<string>();
    const dayTopicIds = new Set((sessionsByDate[dateStr] || []).map((s) => s.topicId));

    // 1. Specific date blocked events (Planes sobre la marcha / citas puntuales / bloques de estudio personalizados)
    (blockedByDate[dateStr] || []).forEach((ev) => {
      const isAlreadyRenderedTopicSession =
        !ev.id?.startsWith('custom-study-') &&
        (ev.linkedItemType === 'topic' || ev.id?.startsWith('block-topic-')) &&
        ev.linkedTopicId &&
        dayTopicIds.has(ev.linkedTopicId);
      if (isAlreadyRenderedTopicSession) return;
      const key = `${ev.id || ev.title.toLowerCase()}-${ev.startTime}-${ev.endTime}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        list.push({ ...ev, isRecurringWeekly: false });
      }
    });

    // 2. Recurring BlockedTimeEvents
    blockedEvents.forEach((ev) => {
      if (!ev.date && ev.recurringDays && ev.recurringDays.includes(dayOfWeek)) {
        const key = `${ev.id || ev.title.toLowerCase()}-${ev.startTime}-${ev.endTime}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            ...ev,
            date: dateStr,
            isRecurringWeekly: true,
          });
        }
      }
    });

    // 3. WeeklyFixedObligations from preferences (Clases, entrenos, gimnasio, trabajo...)
    (preferences.weeklyFixedObligations || []).forEach((ob) => {
      const matchesDay =
        ob.dayOfWeek === dayOfWeek ||
        (ob.recurringDays && ob.recurringDays.includes(dayOfWeek));
      if (matchesDay) {
        const key = `${ob.title.toLowerCase()}-${ob.startTime}-${ob.endTime}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: `weekly-ob-${ob.id}-${dateStr}`,
            sourceObligationId: ob.id,
            title: ob.title,
            date: dateStr,
            startTime: ob.startTime,
            endTime: ob.endTime,
            durationHours: ob.durationHours,
            category: ob.category === 'gimnasio' ? 'deporte' : (ob.category as any),
            notes: ob.notes,
            recurringDays: ob.recurringDays || [ob.dayOfWeek],
            isRecurringWeekly: true,
            isWeeklyObligation: true,
          });
        }
      }
    });

    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return list;
  };

  // Collect all pending tasks grouped by due date
  const tasksByDate: Record<string, Array<{ task: Task; subjectId: string; subjectName: string }>> = {};
  relevantSubjects.forEach((sub) => {
    sub.tasks.forEach((t) => {
      const d = t.dueDate;
      if (!tasksByDate[d]) tasksByDate[d] = [];
      tasksByDate[d].push({ task: t, subjectId: sub.id, subjectName: sub.name });
    });
  });

  // Collect all exams grouped by date
  const examsByDate: Record<string, Array<{ exam: Exam; subjectId: string; subjectName: string }>> = {};
  relevantSubjects.forEach((sub) => {
    sub.exams.forEach((ex) => {
      if (!examsByDate[ex.date]) examsByDate[ex.date] = [];
      examsByDate[ex.date].push({ exam: ex, subjectId: sub.id, subjectName: sub.name });
    });
  });

  // 2. Compute Spaced Repetition (SM-2 + Ebbinghaus) reviews for all topics in the same calendar
  const topicAnalyses: TopicReviewAnalysis[] = useMemo(() => {
    const results: TopicReviewAnalysis[] = [];

    relevantSubjects.forEach((subject) => {
      const upcomingExams = (subject.exams || [])
        .filter((ex) => !ex.completed && ex.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date));
      const nearestSubjectExam = upcomingExams[0] || null;

      subject.topics.forEach((topic, idx) => {
        const matchingLogs = pomodoroLogs.filter(
          (log) =>
            log.subjectId === subject.id &&
            log.topicTitle &&
            (log.topicTitle.toLowerCase() === topic.title.toLowerCase() ||
              log.topicTitle.toLowerCase().includes(topic.title.toLowerCase()))
        );

        const pomodoroSessionsCount = matchingLogs.length;
        const pomodoroMinutesTotal = matchingLogs.reduce(
          (acc, l) => acc + (l.durationMinutes || 0),
          0
        );
        const totalStudyHours =
          Math.round(
            Math.max(topic.actualHoursSpent || 0, pomodoroMinutesTotal / 60) * 10
          ) / 10;

        const historyRecords = topic.reviewsHistory || [];
        const logDates = matchingLogs.map((l) => l.date).filter(Boolean).sort();
        const historyDates = historyRecords.map((r) => r.date).filter(Boolean).sort();

        const pageInfo = schedulerService.getTopicStudiedPages(topic, preferences);

        // REGLA ESTRICTA: Los repasos espaciados (1, 3, 7, 15, 30 días) SOLO se crean para temas o páginas marcadas como estudiadas/leídas
        const hasStudyHistory =
          topic.status === 'estudiado' ||
          topic.status === 'repasado' ||
          pageInfo.studiedPages > 0;

        // Also check if smart scheduler assigned a study date for this topic
        const scheduledFirstSession = allGeneratedSessions.find(
          (s) => s.topicId === topic.id && s.type === 'estudio_nuevo'
        );

        let anchorStudyDate = todayStr;
        if (topic.studiedAt) {
          anchorStudyDate = topic.studiedAt;
        } else if (historyDates.length > 0) {
          anchorStudyDate = historyDates[0];
        } else if (logDates.length > 0) {
          anchorStudyDate = logDates[0];
        } else if (hasStudyHistory) {
          anchorStudyDate = todayStr;
        } else if (topic.scheduledDate) {
          anchorStudyDate = topic.scheduledDate;
        } else if (scheduledFirstSession) {
          anchorStudyDate = scheduledFirstSession.date;
        } else {
          anchorStudyDate = addDaysToDateStr(todayStr, idx * 2 + 1);
        }

        const allActivityDates = [
          ...(topic.studiedAt ? [topic.studiedAt] : []),
          ...historyDates,
          ...logDates,
        ].sort();
        const lastReviewDate =
          allActivityDates.length > 0
            ? allActivityDates[allActivityDates.length - 1]
            : hasStudyHistory
            ? anchorStudyDate
            : null;

        let effectiveLevel = topic.reviewLevel || 0;
        if (effectiveLevel === 0 && hasStudyHistory) {
          if (topic.status === 'repasado') {
            effectiveLevel = Math.max(2, historyRecords.length + 1);
          } else {
            effectiveLevel = Math.max(1, historyRecords.length || 1);
          }
        }
        effectiveLevel = Math.min(5, effectiveLevel);

        const topicErrorLogsCount = (subject.errorLogs || []).filter(
          (err) =>
            !err.resolved &&
            (err.topicId === topic.id ||
              (err.topicTitle && err.topicTitle.toLowerCase().includes(topic.title.toLowerCase())) ||
              (err.concept && err.concept.toLowerCase().includes(topic.title.toLowerCase())))
        ).length;
        const lastRecord =
          historyRecords.length > 0 ? historyRecords[historyRecords.length - 1] : null;
        const errorsCount =
          topic.unresolvedErrorsCount !== undefined
            ? Math.max(topicErrorLogsCount, topic.unresolvedErrorsCount)
            : topicErrorLogsCount + (lastRecord?.errorsCount || 0);

        let intervalMultiplier = 1.0;
        if (lastRecord) {
          if (lastRecord.quality === 'repetir') intervalMultiplier *= 0.5;
          else if (lastRecord.quality === 'dificil') intervalMultiplier *= 0.75;
          else if (lastRecord.quality === 'facil' && errorsCount === 0) intervalMultiplier *= 1.25;
        }
        if (errorsCount > 0) {
          intervalMultiplier *= Math.max(0.5, 1 - errorsCount * 0.14);
        }
        if (topic.perceivedRetentionPct !== undefined) {
          if (topic.perceivedRetentionPct < 60) intervalMultiplier *= 0.65;
          else if (topic.perceivedRetentionPct >= 88 && errorsCount === 0) {
            intervalMultiplier = Math.max(intervalMultiplier, 1.28);
          }
        }

        const topicExam =
          (subject.exams || [])
            .filter(
              (ex) =>
                !ex.completed &&
                ex.date >= todayStr &&
                (!ex.topicIds || ex.topicIds.length === 0 || ex.topicIds.includes(topic.id))
            )
            .sort((a, b) => a.date.localeCompare(b.date))[0] || nearestSubjectExam;

        const upcomingExamDate = topicExam ? topicExam.date : null;

        const milestones: ProjectedReviewMilestone[] = [];
        let runningBaseDate = anchorStudyDate;

        BASE_INTERVALS.forEach((base, cIdx) => {
          const cycleNum = base.cycle;
          const adjustedDays = Math.max(1, Math.round(base.days * intervalMultiplier));
          const manualCycleDate = topic.milestoneDateOverrides?.[cycleNum];

          if (hasStudyHistory && cycleNum <= historyRecords.length) {
            const rec = historyRecords[cycleNum - 1];
            runningBaseDate =
              manualCycleDate || rec.date || addDaysToDateStr(runningBaseDate, adjustedDays);
            milestones.push({
              cycle: cycleNum,
              label: `R${cycleNum} (+${adjustedDays}d)`,
              intervalDays: adjustedDays,
              date: runningBaseDate,
              status: 'completed',
              quality: rec.quality,
            });
          } else if (hasStudyHistory && cycleNum < effectiveLevel) {
            const completedDate =
              manualCycleDate || addDaysToDateStr(anchorStudyDate, base.days);
            runningBaseDate = completedDate <= todayStr ? completedDate : todayStr;
            milestones.push({
              cycle: cycleNum,
              label: `R${cycleNum} (+${adjustedDays}d)`,
              intervalDays: adjustedDays,
              date: runningBaseDate,
              status: 'completed',
              quality: 'bien',
            });
          } else if (hasStudyHistory && cycleNum === Math.max(1, effectiveLevel)) {
            let optimalDate =
              manualCycleDate ||
              topic.nextReviewDate ||
              addDaysToDateStr(lastReviewDate || anchorStudyDate, adjustedDays);

            let isExamPrep = false;
            if (
              !manualCycleDate &&
              upcomingExamDate &&
              optimalDate > upcomingExamDate &&
              upcomingExamDate >= todayStr
            ) {
              const dayBeforeExam = addDaysToDateStr(upcomingExamDate, -1);
              if (dayBeforeExam >= todayStr) {
                optimalDate = dayBeforeExam;
                isExamPrep = true;
              }
            }

            runningBaseDate = optimalDate;
            const status: ProjectedReviewMilestone['status'] =
              optimalDate < todayStr
                ? 'overdue'
                : optimalDate === todayStr
                ? 'due_today'
                : 'upcoming';

            milestones.push({
              cycle: cycleNum,
              label: `R${cycleNum} (+${adjustedDays}d)`,
              intervalDays: adjustedDays,
              date: optimalDate,
              status,
              isExamPrep,
            });
          } else {
            const prevDate = cIdx === 0 ? anchorStudyDate : runningBaseDate;
            const projDate = manualCycleDate || addDaysToDateStr(prevDate, adjustedDays);
            runningBaseDate = projDate;

            milestones.push({
              cycle: cycleNum,
              label: `R${cycleNum} (+${adjustedDays}d)`,
              intervalDays: adjustedDays,
              date: projDate,
              status: hasStudyHistory ? 'upcoming' : 'projected',
            });
          }
        });

        const nextPendingMilestone =
          milestones.find((m) => m.status !== 'completed') ||
          milestones[milestones.length - 1];

        const nextOptimalDate = nextPendingMilestone.date;
        const nextCycleNumber = nextPendingMilestone.cycle;

        let retentionPct = 0;
        if (hasStudyHistory) {
          const referenceDate = lastReviewDate || anchorStudyDate;
          const elapsedDays = Math.max(0, diffDaysBetween(referenceDate, todayStr));
          const baseStability =
            BASE_INTERVALS[Math.min(BASE_INTERVALS.length - 1, Math.max(0, effectiveLevel - 1))]
              .days *
              2.4 *
              intervalMultiplier +
            Math.min(6, totalStudyHours * 0.8);
          const rawRetention = Math.exp(-elapsedDays / Math.max(1.5, baseStability)) * 100;
          retentionPct = Math.max(12, Math.min(100, Math.round(rawRetention)));
        }

        let urgency: TopicReviewAnalysis['urgency'] = 'unstarted';
        if (hasStudyHistory) {
          if (nextOptimalDate < todayStr) {
            urgency = 'overdue';
          } else if (nextOptimalDate === todayStr) {
            urgency = 'due_today';
          } else if (diffDaysBetween(todayStr, nextOptimalDate) <= 7) {
            urgency = 'upcoming_soon';
          } else {
            urgency = 'stable';
          }
        }

        const revTime = schedulerService.calculateTopicReviewTime(
          topic,
          pageInfo.studiedPages,
          Math.max(1, effectiveLevel)
        );

        results.push({
          subject,
          topic,
          topicIndex: idx + 1,
          hasStudyHistory,
          anchorStudyDate,
          lastReviewDate,
          effectiveLevel,
          retentionPct,
          urgency,
          nextOptimalDate,
          nextCycleNumber,
          pomodoroSessionsCount,
          pomodoroMinutesTotal,
          totalStudyHours,
          upcomingExamDate,
          milestones,
          studiedPages: revTime.pagesToReview,
          totalPages: revTime.totalPages,
          studiedPct: revTime.studiedPct,
          estimatedReviewMinutes: revTime.reviewMinutes,
          estimatedReviewHours: revTime.reviewHours,
        });
      });
    });

    return results;
  }, [relevantSubjects, pomodoroLogs, todayStr, allGeneratedSessions]);

  const filteredAnalyses = useMemo(() => {
    return topicAnalyses.filter((item) => {
      if (!includeUnstartedProjections && !item.hasStudyHistory) {
        return false;
      }
      if (urgencyFilter === 'actionable') {
        return item.urgency === 'overdue' || item.urgency === 'due_today';
      }
      if (urgencyFilter === 'upcoming') {
        return item.urgency === 'upcoming_soon';
      }
      if (urgencyFilter === 'stable') {
        return item.urgency === 'stable';
      }
      if (urgencyFilter === 'unstarted') {
        return item.urgency === 'unstarted';
      }
      return true;
    });
  }, [topicAnalyses, includeUnstartedProjections, urgencyFilter]);

  // Map all Spaced Repetition review events onto calendar dates
  const srReviewsByDate = useMemo(() => {
    const map: Record<
      string,
      Array<{
        analysis: TopicReviewAnalysis;
        milestone: ProjectedReviewMilestone;
      }>
    > = {};

    filteredAnalyses.forEach((analysis) => {
      analysis.milestones.forEach((milestone) => {
        if (!includeUnstartedProjections && milestone.status === 'projected') return;

        const targetDate = milestone.date;
        if (!map[targetDate]) map[targetDate] = [];
        map[targetDate].push({ analysis, milestone });

        if (milestone.status === 'overdue' && targetDate !== todayStr) {
          if (!map[todayStr]) map[todayStr] = [];
          const alreadyInToday = map[todayStr].some(
            (e) =>
              e.analysis.topic.id === analysis.topic.id &&
              e.milestone.cycle === milestone.cycle
          );
          if (!alreadyInToday) {
            map[todayStr].push({ analysis, milestone });
          }
        }
      });
    });

    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => {
        const priorityOrder = {
          overdue: 0,
          due_today: 1,
          upcoming: 2,
          projected: 3,
          completed: 4,
        };
        return priorityOrder[a.milestone.status] - priorityOrder[b.milestone.status];
      });
    });

    return map;
  }, [filteredAnalyses, includeUnstartedProjections, todayStr]);

  // Unified KPI metrics (Smart Plan + Spaced Repetition)
  const kpiMetrics = useMemo(() => {
    const activeItems = topicAnalyses.filter((a) => a.hasStudyHistory);
    const overdueCount = activeItems.filter((a) => a.urgency === 'overdue').length;
    const dueTodayCount = activeItems.filter((a) => a.urgency === 'due_today').length;
    const next7DaysCount = activeItems.filter((a) => a.urgency === 'upcoming_soon').length;

    const avgRetention =
      activeItems.length > 0
        ? Math.round(
            activeItems.reduce((sum, a) => sum + a.retentionPct, 0) / activeItems.length
          )
        : 0;

    const totalCompletedReviews = topicAnalyses.reduce(
      (sum, a) =>
        sum + a.milestones.filter((m) => m.status === 'completed').length,
      0
    );

    const totalPlannedStudyHours =
      Math.round(
        allGeneratedSessions.reduce((acc, s) => acc + s.durationHours, 0) * 10
      ) / 10;

    return {
      activeTopicsCount: activeItems.length,
      overdueCount,
      dueTodayCount,
      actionableToday: overdueCount + dueTodayCount,
      next7DaysCount,
      avgRetention,
      totalCompletedReviews,
      totalPlannedSessions: allGeneratedSessions.length,
      totalPlannedStudyHours,
    };
  }, [topicAnalyses, allGeneratedSessions]);

  // Cálculo dinámico de horas libres del calendario y contraste con la meta diaria elegida
  const calendarAvailabilityData = useMemo(() => {
    const WEEK_DAYS = [
      { day: 1, name: 'Lunes', short: 'Lun' },
      { day: 2, name: 'Martes', short: 'Mar' },
      { day: 3, name: 'Miércoles', short: 'Mié' },
      { day: 4, name: 'Jueves', short: 'Jue' },
      { day: 5, name: 'Viernes', short: 'Vie' },
      { day: 6, name: 'Sábado', short: 'Sáb' },
      { day: 0, name: 'Domingo', short: 'Dom' },
    ];

    const obligations = preferences.weeklyFixedObligations || [];

    const dayBreakdowns = WEEK_DAYS.map((wd) => {
      const obsOnDay = obligations.filter((o) => o.dayOfWeek === wd.day);
      const obsHours = obsOnDay.reduce((acc, o) => acc + (o.durationHours || 0), 0);

      const blockedRecurringOnDay = blockedEvents.filter((b) => {
        const days = b.recurringDays && b.recurringDays.length > 0 ? b.recurringDays : [];
        return days.includes(wd.day);
      });
      const blockedHours = blockedRecurringOnDay.reduce((acc, b) => acc + (b.durationHours || 0), 0);

      const totalOccupied = Math.round((obsHours + blockedHours) * 10) / 10;
      const freeHours = Math.max(0, Math.round((15.0 - totalOccupied) * 10) / 10);
      const configuredHours = localHoursPerDay[wd.day] ?? localDailyGoalHours;
      const margin = Math.round((freeHours - configuredHours) * 10) / 10;

      return {
        ...wd,
        totalOccupied,
        freeHours,
        configuredHours,
        margin,
        reasonsCount: obsOnDay.length + blockedRecurringOnDay.length,
      };
    });

    const totalWeeklyFreeHours = Math.round(dayBreakdowns.reduce((acc, d) => acc + d.freeHours, 0) * 10) / 10;
    const avgDailyFreeHours = Math.round((totalWeeklyFreeHours / 7) * 10) / 10;
    const totalWeeklyStudyGoal = Math.round(dayBreakdowns.reduce((acc, d) => acc + d.configuredHours, 0) * 10) / 10;
    const dailyMargin = Math.round((avgDailyFreeHours - localDailyGoalHours) * 10) / 10;
    const weeklyMargin = Math.round((totalWeeklyFreeHours - totalWeeklyStudyGoal) * 10) / 10;

    let status: 'optimo' | 'ajustado' | 'sobrecarga' = 'optimo';
    let statusLabel = 'Ritmo Sostenible';
    let statusMessage = 'Cuentas con holgura suficiente para descansar y absorber imprevistos.';

    if (localDailyGoalHours > avgDailyFreeHours) {
      status = 'sobrecarga';
      statusLabel = 'Sobrecarga de Horario';
      statusMessage = `Tu meta de ${localDailyGoalHours}h/día supera tus horas libres medias del calendario (${avgDailyFreeHours}h/día). Faltan ${Math.abs(dailyMargin)}h/día.`;
    } else if (localDailyGoalHours > avgDailyFreeHours * 0.75) {
      status = 'ajustado';
      statusLabel = 'Ritmo Ajustado';
      statusMessage = `Dedicando ${localDailyGoalHours}h/día emplearás la mayor parte de tus horas libres del calendario.`;
    }

    const usagePct = avgDailyFreeHours > 0 ? Math.min(100, Math.round((localDailyGoalHours / avgDailyFreeHours) * 100)) : 100;

    return {
      dayBreakdowns,
      totalWeeklyFreeHours,
      avgDailyFreeHours,
      totalWeeklyStudyGoal,
      configuredDailyGoal: localDailyGoalHours,
      dailyMargin,
      weeklyMargin,
      status,
      statusLabel,
      statusMessage,
      usagePct,
    };
  }, [preferences.weeklyFixedObligations, blockedEvents, localHoursPerDay, localDailyGoalHours]);

  // Record a Spaced Repetition review (Curva del Olvido: 24h, 3d, 7d, 15d, 30d + ajuste por errores/retención y páginas estudiadas)
  const handleRecordReview = (
    analysis: TopicReviewAnalysis,
    quality: ReviewQuality,
    customOptions?: { errorsCount?: number; retentionPct?: number; studiedPages?: number }
  ) => {
    const { subject, topic, effectiveLevel, errorsCount = 0 } = analysis;
    const pageInfo = schedulerService.getTopicStudiedPages(topic);
    const pagesReviewed =
      customOptions?.studiedPages !== undefined
        ? customOptions.studiedPages
        : analysis.studiedPages || pageInfo.studiedPages || pageInfo.totalPages;
    const totalTopicPages = Math.max(pageInfo.totalPages, pagesReviewed);

    const effectiveErrors =
      customOptions?.errorsCount !== undefined
        ? customOptions.errorsCount
        : quality === 'repetir'
        ? Math.max(2, errorsCount)
        : quality === 'dificil'
        ? Math.max(1, errorsCount)
        : 0;

    const calc = schedulerService.getNextSpacedReview(effectiveLevel, quality, {
      errorsCount: effectiveErrors,
      retentionPct: customOptions?.retentionPct,
      baseDateStr: todayStr,
      studiedPages: pagesReviewed,
      totalPages: totalTopicPages,
      difficulty: topic.difficulty,
    });

    const newRecord: SpacedReviewRecord = {
      date: todayStr,
      quality,
      retentionPct: calc.inferredRetentionPct,
      errorsCount: effectiveErrors,
      intervalDaysUsed: calc.adjustedIntervalDays,
      adjustmentNote: calc.adjustmentNote,
      pagesReviewed,
      totalTopicPages,
      estimatedReviewMinutes: calc.estimatedReviewMinutes,
    };

    const updatedTopics: Topic[] = subject.topics.map((t) => {
      if (t.id === topic.id) {
        return {
          ...t,
          status: 'repasado',
          studiedAt: t.studiedAt || todayStr,
          pagesRead: Math.max(t.pagesRead || 0, pagesReviewed),
          pageCount: totalTopicPages,
          reviewLevel: calc.nextLevel,
          nextReviewDate: calc.nextDate,
          perceivedRetentionPct: calc.inferredRetentionPct,
          unresolvedErrorsCount: effectiveErrors,
          lastIntervalDays: calc.adjustedIntervalDays,
          lastAdjustmentReason: calc.adjustmentNote,
          vueltasCount: (t.vueltasCount || 1) + 1,
          reviewsHistory: [...(t.reviewsHistory || []), newRecord],
        };
      }
      return t;
    });

    if (onUpdateSubject) {
      onUpdateSubject({
        ...subject,
        topics: updatedTopics,
      });
    } else {
      onUpdateTopicsSchedule(subject.id, updatedTopics);
    }

    const qualityLabels: Record<ReviewQuality, string> = {
      repetir: 'Baja retención / Repetir (24h)',
      dificil: 'Con errores / Adelantar repaso',
      bien: 'Estándar Curva (24h·3d·7d·15d·30d)',
      facil: 'Retención muy alta / Espaciar más',
    };

    setRescheduledNotice(
      `Repaso de "${topic.title}" registrado (${pagesReviewed}/${totalTopicPages} págs. estudiadas · ~${calc.estimatedReviewMinutes} min · ${qualityLabels[quality]}). Próximo repaso programado para el ${formatReadableDate(calc.nextDate)} (+${calc.adjustedIntervalDays} ${calc.adjustedIntervalDays === 1 ? 'día / 24h' : 'días'} · Ciclo R${calc.nextLevel}).`
    );
    setTimeout(() => setRescheduledNotice(null), 6000);
  };

  // Adelantar o espaciar el repaso de un tema directamente desde el calendario unificado
  const handleAdjustReviewByRetentionOrErrors = (
    analysis: TopicReviewAnalysis,
    mode: 'adelantar_baja_retencion' | 'espaciar_alta_retencion' | 'restaurar_curva'
  ) => {
    const { subject, topic } = analysis;
    const adjusted = schedulerService.adjustTopicReviewSchedule(topic, mode);

    const updatedTopics: Topic[] = subject.topics.map((t) => {
      if (t.id === topic.id) {
        return {
          ...t,
          studiedAt: t.studiedAt || todayStr,
          status: t.status === 'pendiente' ? 'estudiado' : t.status,
          reviewLevel: adjusted.reviewLevel,
          nextReviewDate: adjusted.nextReviewDate,
          perceivedRetentionPct: adjusted.perceivedRetentionPct,
          unresolvedErrorsCount: adjusted.unresolvedErrorsCount,
          lastIntervalDays: adjusted.lastIntervalDays,
          lastAdjustmentReason: adjusted.lastAdjustmentReason,
        };
      }
      return t;
    });

    if (onUpdateSubject) {
      onUpdateSubject({
        ...subject,
        topics: updatedTopics,
      });
    } else {
      onUpdateTopicsSchedule(subject.id, updatedTopics);
    }

    setRescheduledNotice(
      `Ajuste aplicado en "${topic.title}": ${adjusted.lastAdjustmentReason}. Nueva fecha: ${formatReadableDate(adjusted.nextReviewDate)}.`
    );
    setTimeout(() => setRescheduledNotice(null), 6000);
  };

  // Master Action: Recalculate all Study Topics & Spaced Repetition Reviews around weekly recurring blocks & ad-hoc plans
  const handleRecalculateTopicsAndReviews = (options?: {
    customBlockedEvents?: BlockedTimeEvent[];
    customPreferences?: StudyPreferences;
    preserveManualPins?: boolean;
    prefixMessage?: string;
  }) => {
    setIsRecalculatingAll(true);
    const activeBlocked = options?.customBlockedEvents ?? blockedEvents;
    const activePrefs = options?.customPreferences ?? preferences;

    setTimeout(() => {
      try {
        const result = schedulerService.recalculateTopicsAccordingToBlockedHours(
          subjects,
          activePrefs,
          activeBlocked,
          activePrefs.weeklyFixedObligations || [],
          {
            preserveManualPins: options?.preserveManualPins ?? false,
            startFromDateStr: todayStr,
          }
        );

        if (onBatchUpdateSubjects) {
          onBatchUpdateSubjects(result.updatedSubjects);
        } else {
          result.updatedSubjects.forEach((sub) => {
            if (onUpdateSubject) {
              onUpdateSubject(sub);
            } else {
              onUpdateTopicsSchedule(sub.id, sub.topics);
            }
          });
        }

        if (onUpdatePreferences) {
          onUpdatePreferences(result.updatedPreferences);
        }

        const msg = options?.prefixMessage
          ? `${options.prefixMessage} · ${result.summaryMessage}`
          : result.summaryMessage;
        setRescheduledNotice(msg);
        setTimeout(() => setRescheduledNotice(null), 7000);
      } catch (err) {
        console.error('Error recalculating topics and reviews:', err);
      } finally {
        setIsRecalculatingAll(false);
      }
    }, 250);
  };

  const handleReschedule = () => {
    handleRecalculateTopicsAndReviews({ preserveManualPins: false });
  };

  // Aplicar la meta diaria configurada o personalizada por día y recalcular el plan de estudio
  const handleApplyDailyGoalHours = (customGoal?: number) => {
    const goalToApply = typeof customGoal === 'number' ? customGoal : localDailyGoalHours;
    const updatedHoursPerDay: Record<number, number> = {};
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
      updatedHoursPerDay[d] = showCustomDaysGoal
        ? localHoursPerDay[d] ?? goalToApply
        : goalToApply;
    });

    const activeDays = Object.entries(updatedHoursPerDay)
      .filter(([_, h]) => h > 0)
      .map(([d]) => Number(d));

    const updatedPrefs: StudyPreferences = {
      ...preferences,
      dailyGoalHours: goalToApply,
      hoursPerDay: updatedHoursPerDay,
      availableDays: activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5, 6, 0],
    };

    if (onUpdatePreferences) {
      onUpdatePreferences(updatedPrefs);
    }

    handleRecalculateTopicsAndReviews({
      customPreferences: updatedPrefs,
      prefixMessage: `¡Meta de ${goalToApply}h/día aplicada! El calendario se ha recalculado basándose en tus ${calendarAvailabilityData.avgDailyFreeHours}h libres diarias disponibles`,
    });
  };

  // Helper: Get concrete scheduled hour ("08:00" .. "21:00") for a topic review on a given date
  const getReviewScheduledTime = (topic: Topic, dateStr: string): string | undefined => {
    const byDate = topic.reviewTimeByDate?.[dateStr];
    if (byDate) return byDate;
    if (topic.reviewScheduledTime && (!topic.nextReviewDate || topic.nextReviewDate === dateStr)) {
      return topic.reviewScheduledTime;
    }
    return undefined;
  };

  // Helper: Upsert a time block in the main application blockedEvents state
  const upsertBlockedEventInAppState = (event: BlockedTimeEvent) => {
    if (onUpdateBlockedEvent) {
      onUpdateBlockedEvent(event);
    } else if (onAddBlockedEvent) {
      onAddBlockedEvent(event);
    }
  };

  // Assign a review to a concrete hour slot or new date (via Drag-and-Drop or selector)
  const handleAssignReviewToTimeSlot = (
    subjectId: string,
    topicId: string,
    targetDateStr: string,
    hourStr: string | undefined,
    sourceDateStr?: string,
    cycleNum?: number
  ) => {
    const targetSub = subjects.find((s) => s.id === subjectId);
    if (!targetSub) return;

    const matchedTopic = targetSub.topics.find((t) => t.id === topicId);
    const movedTopicTitle = matchedTopic?.title || '';
    const existingPrevHour =
      sourceDateStr && matchedTopic?.reviewTimeByDate
        ? matchedTopic.reviewTimeByDate[sourceDateStr]
        : undefined;
    const resolvedEffectiveHour: string | undefined =
      hourStr !== undefined ? hourStr : existingPrevHour;

    const updatedTopics = targetSub.topics.map((t) => {
      if (t.id !== topicId) return t;
      const nextMap = { ...(t.reviewTimeByDate || {}) };
      if (sourceDateStr && sourceDateStr !== targetDateStr) {
        delete nextMap[sourceDateStr];
      }
      if (resolvedEffectiveHour) {
        nextMap[targetDateStr] = resolvedEffectiveHour;
      } else if (hourStr === undefined && (!sourceDateStr || sourceDateStr === targetDateStr)) {
        delete nextMap[targetDateStr];
      }

      const nextMilestoneOverrides = { ...(t.milestoneDateOverrides || {}) };
      if (cycleNum !== undefined && sourceDateStr && sourceDateStr !== targetDateStr) {
        nextMilestoneOverrides[cycleNum] = targetDateStr;
      }

      const shouldUpdateNextDate =
        (sourceDateStr && sourceDateStr !== targetDateStr) &&
        (t.nextReviewDate === sourceDateStr ||
          !t.nextReviewDate ||
          cycleNum === Math.max(1, t.reviewLevel || 1));

      return {
        ...t,
        reviewScheduledTime: resolvedEffectiveHour,
        reviewTimeByDate: nextMap,
        milestoneDateOverrides: nextMilestoneOverrides,
        nextReviewDate: shouldUpdateNextDate ? targetDateStr : t.nextReviewDate,
      };
    });

    if (onUpdateSubject) {
      onUpdateSubject({
        ...targetSub,
        topics: updatedTopics,
      });
    } else {
      onUpdateTopicsSchedule(targetSub.id, updatedTopics);
    }

    // Automatically synchronize review time block with main blockedEvents state
    const reviewBlockId = `block-review-${topicId}`;
    if (resolvedEffectiveHour) {
      const startH = parseInt(resolvedEffectiveHour.split(':')[0], 10);
      const endHourStr = `${String(Math.min(23, startH + 1)).padStart(2, '0')}:00`;
      upsertBlockedEventInAppState({
        id: reviewBlockId,
        title: `🧠 Repaso: ${movedTopicTitle || 'Tema'} (${targetSub.name})`,
        date: targetDateStr,
        startTime: resolvedEffectiveHour,
        endTime: endHourStr,
        durationHours: 1,
        category: 'clase',
        notes: `Repaso espaciado programado en bloque horario (${targetSub.name})`,
        linkedItemType: 'review',
        linkedTopicId: topicId,
        linkedSubjectId: targetSub.id,
        subjectName: targetSub.name,
        subjectColor: targetSub.color,
      });
    } else if (hourStr === undefined && (!sourceDateStr || sourceDateStr === targetDateStr)) {
      onDeleteBlockedEvent?.(reviewBlockId);
    }

    if (hourStr) {
      setRescheduledNotice(
        `🧠 Repaso de "${movedTopicTitle}" movido al ${formatReadableDate(targetDateStr)} a las ${hourStr} (bloque actualizado en horario).`
      );
    } else if (sourceDateStr && sourceDateStr !== targetDateStr) {
      setRescheduledNotice(
        `🧠 Repaso de "${movedTopicTitle}" movido al ${formatReadableDate(targetDateStr)}.`
      );
    } else {
      setRescheduledNotice(`Se ha liberado la hora fija del repaso "${movedTopicTitle}".`);
    }
    setTimeout(() => setRescheduledNotice(null), 4500);
  };

  // Helper: Calculate endTime automatically from startTime + durationHours (preserving topic duration)
  const calculateAutoEndTime = (startTimeStr: string, durationHours: number): string => {
    const safeStart = startTimeStr && startTimeStr.includes(':') ? startTimeStr : '09:00';
    const [hPart, mPart] = safeStart.split(':').map((n) => parseInt(n, 10) || 0);
    const startMins = hPart * 60 + mPart;
    const durationMins = Math.max(30, Math.round((durationHours || 1) * 60));
    const endTotalMins = Math.min(23 * 60 + 59, startMins + durationMins);
    return `${String(Math.floor(endTotalMins / 60)).padStart(2, '0')}:${String(
      endTotalMins % 60
    ).padStart(2, '0')}`;
  };

  // Change ONLY the start time (or move slot) of a study topic session without duplicating blocks or spawning another topic
  const handleChangeTopicSessionStartTime = (
    subjectId: string,
    topicId: string,
    targetDateStr: string,
    newStartTime: string,
    durationHours: number,
    sourceDateStr?: string
  ) => {
    const targetSub = subjects.find((s) => s.id === subjectId);
    if (!targetSub) return;

    const cleanStart = newStartTime && newStartTime.includes(':') ? newStartTime : '09:00';
    const autoEndStr = calculateAutoEndTime(cleanStart, durationHours);
    let movedTopicTitle = 'Tema';

    const updatedTopics = targetSub.topics.map((t) => {
      if (t.id !== topicId) return t;
      movedTopicTitle = t.title;
      const nextStudyMap = { ...(t.studyTimeByDate || {}) };
      const nextExtraMap = { ...(t.extraStudySessionsByDate || {}) };

      if (sourceDateStr && sourceDateStr !== targetDateStr) {
        delete nextStudyMap[sourceDateStr];
        if (nextExtraMap[sourceDateStr]) {
          const prevExtra = nextExtraMap[sourceDateStr];
          delete nextExtraMap[sourceDateStr];
          nextExtraMap[targetDateStr] = { ...prevExtra, startTime: cleanStart };
        } else {
          // Moving a topic session to another date places an explicit user session on targetDateStr
          nextExtraMap[targetDateStr] = { startTime: cleanStart };
        }
      } else if (nextExtraMap[targetDateStr]) {
        nextExtraMap[targetDateStr] = {
          ...nextExtraMap[targetDateStr],
          startTime: cleanStart,
        };
      }

      nextStudyMap[targetDateStr] = cleanStart;

      return {
        ...t,
        scheduledTime: cleanStart,
        scheduledEndTime: autoEndStr,
        studyTimeByDate: nextStudyMap,
        extraStudySessionsByDate: nextExtraMap,
        // Keep manualScheduledDate false so the sequential scheduler NEVER pulls a second topic into the same day
        manualScheduledDate: false,
      };
    });

    if (onUpdateSubject) {
      onUpdateSubject({ ...targetSub, topics: updatedTopics });
    } else {
      onUpdateTopicsSchedule(targetSub.id, updatedTopics);
    }

    // Persistently update blockedEvents with the new startTime and recalculated endTime based on original duration
    const existingTopicBlock = blockedEvents.find(
      (b) =>
        b.id === `block-topic-${topicId}` ||
        (!b.id.startsWith('custom-study-') &&
          b.linkedTopicId === topicId &&
          b.linkedItemType === 'topic')
    );

    upsertBlockedEventInAppState({
      id: existingTopicBlock?.id || `block-topic-${topicId}`,
      title: `📖 Estudio: ${movedTopicTitle} (${targetSub.name})`,
      date: targetDateStr,
      startTime: cleanStart,
      endTime: autoEndStr,
      durationHours,
      category: 'estudio',
      notes: `Bloque de estudio (${durationHours}h) asignado a ${cleanStart}–${autoEndStr}`,
      linkedItemType: 'topic',
      linkedTopicId: topicId,
      linkedSubjectId: targetSub.id,
      subjectName: targetSub.name,
      subjectColor: targetSub.color,
    });

    setRescheduledNotice(
      `🕒 Hora de "${movedTopicTitle}" (${targetSub.name}) actualizada: ${cleanStart} – ${autoEndStr} (${durationHours}h, guardado en blockedEvents).`
    );
    setTimeout(() => setRescheduledNotice(null), 4500);
  };

  // State & Handlers for "+ Añadir tema en hueco libre" (User-chosen extra topic on any day with page selector & live endTime)
  const [showAddTopicSlotModal, setShowAddTopicSlotModal] = useState(false);
  const [extraTopicDate, setExtraTopicDate] = useState<string>(todayStr);
  const [extraTopicSubjectId, setExtraTopicSubjectId] = useState<string>(
    subjects[0]?.id || ''
  );
  const [extraTopicId, setExtraTopicId] = useState<string>(
    subjects[0]?.topics?.find((t) => !t.studiedAt && t.status !== 'estudiado')?.id ||
      subjects[0]?.topics?.[0]?.id ||
      ''
  );
  const [extraTopicStartTime, setExtraTopicStartTime] = useState<string>('17:00');
  const [extraTopicPagesCount, setExtraTopicPagesCount] = useState<number>(5);

  // Helper: Minutes per page based on user preferences and topic difficulty
  const getTopicMinutesPerPage = (topic?: any): number => {
    const base =
      preferences.averageMinutesPerPage && preferences.averageMinutesPerPage > 0
        ? preferences.averageMinutesPerPage
        : 8;
    const useScaling = preferences.useDifficultyScalingForPages ?? true;
    if (!useScaling || !topic) return base;
    const diff = topic.difficulty || 'Media';
    if (diff === 'Baja') return Math.max(1, Math.round(base * 0.75 * 10) / 10);
    if (diff === 'Alta') return Math.round(base * 1.5 * 10) / 10;
    return base;
  };

  // Helper: Calculate end time HH:mm from startTime + exact duration in minutes
  const calculateAutoEndTimeFromMinutes = (
    startTimeStr: string,
    durationMinutes: number
  ): string => {
    const safeStart = startTimeStr && startTimeStr.includes(':') ? startTimeStr : '17:00';
    const [hPart, mPart] = safeStart.split(':').map((n) => parseInt(n, 10) || 0);
    const startMins = hPart * 60 + mPart;
    const safeDurMins = Math.max(5, Math.round(durationMinutes || 30));
    const endTotalMins = Math.min(23 * 60 + 59, startMins + safeDurMins);
    return `${String(Math.floor(endTotalMins / 60)).padStart(2, '0')}:${String(
      endTotalMins % 60
    ).padStart(2, '0')}`;
  };

  // Helper: Get sensible default pages count for a chosen topic
  const getDefaultPagesForTopic = (topic?: any, dateForCheck?: string): number => {
    if (!topic) return 5;
    if (dateForCheck && topic.extraStudySessionsByDate?.[dateForCheck]?.pagesCount) {
      return Math.max(1, topic.extraStudySessionsByDate[dateForCheck].pagesCount);
    }
    const attachedPages = (topic.attachedFiles || []).reduce(
      (sum: number, f: any) => sum + (f.includeInOrganization !== false ? f.pageCount || 0 : 0),
      0
    );
    const rawTotal = Math.max(topic.pageCount || 0, topic.paginasTotales || 0, attachedPages);
    if (rawTotal > 0) {
      const readP = Math.max(0, topic.pagesRead || 0);
      const remaining = Math.max(1, rawTotal - readP);
      return Math.min(remaining, 6);
    }
    const minsPerPage = getTopicMinutesPerPage(topic);
    const estH = topic.estimatedHours && topic.estimatedHours > 0 ? topic.estimatedHours : 1.5;
    return Math.max(1, Math.min(8, Math.round((estH * 60) / minsPerPage)));
  };

  const openAddTopicSlotModalForDate = (dateStr: string, preferredHourStr?: string) => {
    setExtraTopicDate(dateStr);
    const defaultSub =
      subjects.find((s) => s.topics.some((t) => !t.studiedAt && t.status !== 'estudiado')) ||
      subjects[0];
    if (defaultSub) {
      setExtraTopicSubjectId(defaultSub.id);
      const nextPending =
        defaultSub.topics.find((t) => {
          const totalP = Math.max(0, t.pageCount || 0);
          const readP = Math.max(0, t.pagesRead || 0);
          const done =
            totalP > 0
              ? readP >= totalP
              : Boolean(t.studiedAt || t.status === 'estudiado' || t.status === 'repasado');
          return !done;
        }) || defaultSub.topics[0];
      if (nextPending) {
        setExtraTopicId(nextPending.id);
        setExtraTopicPagesCount(getDefaultPagesForTopic(nextPending, dateStr));
      }
    }
    if (preferredHourStr) {
      setExtraTopicStartTime(preferredHourStr);
    } else {
      const freeH = findFreeHourForDate(dateStr);
      setExtraTopicStartTime(
        freeH !== null ? `${String(freeH).padStart(2, '0')}:00` : '17:00'
      );
    }
    setShowAddTopicSlotModal(true);
  };

  const handleSuggestNextPendingTopicForSlot = () => {
    for (const sub of subjects) {
      const candidate = sub.topics.find((t) => {
        const totalP = Math.max(0, t.pageCount || 0);
        const readP = Math.max(0, t.pagesRead || 0);
        const done =
          totalP > 0
            ? readP >= totalP
            : Boolean(t.studiedAt || t.status === 'estudiado' || t.status === 'repasado');
        return !done && !t.extraStudySessionsByDate?.[extraTopicDate];
      });
      if (candidate) {
        setExtraTopicSubjectId(sub.id);
        setExtraTopicId(candidate.id);
        setExtraTopicPagesCount(getDefaultPagesForTopic(candidate, extraTopicDate));
        return;
      }
    }
  };

  const handleConfirmAddExtraTopicToDay = (e: React.FormEvent) => {
    e.preventDefault();
    const targetSub = subjects.find((s) => s.id === extraTopicSubjectId);
    if (!targetSub) return;
    const targetTopic = targetSub.topics.find((t) => t.id === extraTopicId);
    if (!targetTopic) return;

    const cleanStart = extraTopicStartTime || '17:00';
    const chosenPages = Math.max(1, Math.round(extraTopicPagesCount || 1));
    const minsPerPage = getTopicMinutesPerPage(targetTopic);
    const durationMinutes = Math.max(5, Math.round(chosenPages * minsPerPage));
    const estHours = Math.max(0.1, Math.round((durationMinutes / 60) * 100) / 100);
    const autoEndStr = calculateAutoEndTimeFromMinutes(cleanStart, durationMinutes);

    const updatedTopics = targetSub.topics.map((t) => {
      if (t.id !== targetTopic.id) return t;
      const currentTotalPages = Math.max(
        t.pageCount || 0,
        (t. pagesRead || 0) + chosenPages
      );
      return {
        ...t,
        pageCount: t.pageCount && t.pageCount >= currentTotalPages ? t.pageCount : currentTotalPages,
        studyTimeByDate: {
          ...(t.studyTimeByDate || {}),
          [extraTopicDate]: cleanStart,
        },
        extraStudySessionsByDate: {
          ...(t.extraStudySessionsByDate || {}),
          [extraTopicDate]: {
            startTime: cleanStart,
            pagesCount: chosenPages,
          },
        },
      };
    });

    if (onUpdateSubject) {
      onUpdateSubject({ ...targetSub, topics: updatedTopics });
    } else {
      onUpdateTopicsSchedule(targetSub.id, updatedTopics);
    }

    // Also persist in blockedEvents with the exact duration and endTime computed from chosenPages
    upsertBlockedEventInAppState({
      id: `block-topic-${targetTopic.id}-${extraTopicDate}`,
      title: `📖 Estudio: ${targetTopic.title} (${chosenPages} ${
        chosenPages === 1 ? 'pág' : 'págs'
      } · ${targetSub.name})`,
      date: extraTopicDate,
      startTime: cleanStart,
      endTime: autoEndStr,
      durationHours: estHours,
      category: 'estudio',
      notes: `Sesión extra de ${chosenPages} páginas (~${durationMinutes} min) de ${cleanStart} a ${autoEndStr}`,
      linkedItemType: 'topic',
      linkedTopicId: targetTopic.id,
      linkedSubjectId: targetSub.id,
      subjectName: targetSub.name,
      subjectColor: targetSub.color,
    });

    setShowAddTopicSlotModal(false);
    setSelectedDayStr(extraTopicDate);
    setRescheduledNotice(
      `➕ Tema "${targetTopic.title}" (${chosenPages} ${
        chosenPages === 1 ? 'página' : 'páginas'
      } · ~${durationMinutes} min) añadido el ${formatReadableDate(
        extraTopicDate
      )} de ${cleanStart} a ${autoEndStr}.`
    );
    setTimeout(() => setRescheduledNotice(null), 5000);
  };

  const handleRemoveExtraTopicFromDay = (
    subjectId: string,
    topicId: string,
    dateStr: string
  ) => {
    const targetSub = subjects.find((s) => s.id === subjectId);
    if (!targetSub) return;
    const updatedTopics = targetSub.topics.map((t) => {
      if (t.id !== topicId) return t;
      const nextExtra = { ...(t.extraStudySessionsByDate || {}) };
      delete nextExtra[dateStr];
      const nextStudyMap = { ...(t.studyTimeByDate || {}) };
      delete nextStudyMap[dateStr];
      return {
        ...t,
        extraStudySessionsByDate: nextExtra,
        studyTimeByDate: nextStudyMap,
      };
    });

    if (onUpdateSubject) {
      onUpdateSubject({ ...targetSub, topics: updatedTopics });
    } else {
      onUpdateTopicsSchedule(targetSub.id, updatedTopics);
    }
    setRescheduledNotice(`🗑️ Sesión extra eliminada del ${formatReadableDate(dateStr)}.`);
    setTimeout(() => setRescheduledNotice(null), 4000);
  };

  // Universal Drop Handler for Tasks, Study Topics, Spaced Reviews, and Blocked Events across Days and Hours
  const handleDropCalendarItem = (targetDateStr: string, targetHourStr?: string) => {
    setDragOverSlot(null);

    // Support legacy draggedReview if set
    if (!draggedItem && draggedReview) {
      handleAssignReviewToTimeSlot(
        draggedReview.subjectId,
        draggedReview.topicId,
        targetDateStr,
        targetHourStr,
        draggedReview.sourceDateStr,
        draggedReview.cycle
      );
      setDraggedReview(null);
      return;
    }

    if (!draggedItem) return;

    if (draggedItem.kind === 'spaced_review') {
      handleAssignReviewToTimeSlot(
        draggedItem.subjectId,
        draggedItem.topicId,
        targetDateStr,
        targetHourStr,
        draggedItem.sourceDateStr,
        draggedItem.cycle
      );
      setDraggedItem(null);
      setDraggedReview(null);
      return;
    }

    if (draggedItem.kind === 'topic_session') {
      const finalHourStr =
        targetHourStr ||
        draggedItem.sourceHourStr ||
        (() => {
          const freeH = findFreeHourForDate(targetDateStr);
          return freeH !== null ? `${String(freeH).padStart(2, '0')}:00` : '10:00';
        })();

      const durationHours = Math.max(0.5, Math.min(4, draggedItem.durationHours || 1));
      handleChangeTopicSessionStartTime(
        draggedItem.subjectId,
        draggedItem.topicId,
        targetDateStr,
        finalHourStr,
        durationHours,
        draggedItem.sourceDateStr
      );
      setDraggedItem(null);
      return;
    }

    if (draggedItem.kind === 'task') {
      const targetSub = subjects.find((s) => s.id === draggedItem.subjectId);
      if (!targetSub) {
        setDraggedItem(null);
        return;
      }

      const finalHourStr =
        targetHourStr ||
        draggedItem.sourceHourStr ||
        (() => {
          const freeH = findFreeHourForDate(targetDateStr);
          return freeH !== null ? `${String(freeH).padStart(2, '0')}:00` : '16:00';
        })();

      const endHourNum = Math.min(23, parseInt(finalHourStr.split(':')[0], 10) + 1);
      const finalEndStr = `${String(endHourNum).padStart(2, '0')}:00`;

      const updatedTasks = targetSub.tasks.map((tk) => {
        if (tk.id !== draggedItem.taskId) return tk;
        return {
          ...tk,
          dueDate: targetDateStr,
          scheduledTime: finalHourStr,
          startTime: finalHourStr,
          endTime: finalEndStr,
        };
      });

      if (onUpdateSubject) {
        onUpdateSubject({ ...targetSub, tasks: updatedTasks });
      }

      const displayTaskTitle = draggedItem.title || draggedItem.taskTitle || 'Tarea';
      const existingTaskBlock = blockedEvents.find(
        (b) =>
          b.id === `block-task-${draggedItem.taskId}` ||
          b.linkedTaskId === draggedItem.taskId
      );

      // Automatically update blockedEvents in the main App state
      upsertBlockedEventInAppState({
        id: existingTaskBlock?.id || `block-task-${draggedItem.taskId}`,
        title: `✓ Tarea: ${displayTaskTitle} (${draggedItem.subjectName})`,
        date: targetDateStr,
        startTime: finalHourStr,
        endTime: finalEndStr,
        durationHours: 1,
        category: 'trabajo',
        notes: `Bloque de tarea asignado mediante Drag & Drop para "${displayTaskTitle}" (${draggedItem.subjectName})`,
        linkedItemType: 'task',
        linkedTaskId: draggedItem.taskId,
        linkedSubjectId: draggedItem.subjectId,
        subjectName: draggedItem.subjectName,
        subjectColor: targetSub.color,
      });

      setRescheduledNotice(
        `✓ Tarea "${displayTaskTitle}" movida al ${formatReadableDate(
          targetDateStr
        )} (${finalHourStr}–${finalEndStr}) · Bloque actualizado en blockedEvents.`
      );
      setTimeout(() => setRescheduledNotice(null), 5000);
      setDraggedItem(null);
      return;
    }

    if (draggedItem.kind === 'blocked_event') {
      const targetDayOfWeek = getDayOfWeekFromDateStr(targetDateStr);

      if (draggedItem.isWeeklyObligation && onUpdatePreferences) {
        const updatedObs = (preferences.weeklyFixedObligations || []).map((ob) => {
          if (ob.id !== draggedItem.eventId && ob.id !== draggedItem.sourceObligationId) return ob;
          const [sH, sM] = (ob.startTime || '09:00').split(':').map(Number);
          const [eH, eM] = (ob.endTime || '10:00').split(':').map(Number);
          const computedDurHours = Math.max(
            0.5,
            ((eH * 60 + (eM || 0)) - (sH * 60 + (sM || 0))) / 60
          );
          const origDurationHours =
            ob.durationHours && ob.durationHours > 0 ? ob.durationHours : computedDurHours;
          const nextStart = targetHourStr || ob.startTime;
          const nextEnd = calculateAutoEndTime(nextStart, origDurationHours);
          return {
            ...ob,
            dayOfWeek: targetDayOfWeek,
            recurringDays: [targetDayOfWeek],
            startTime: nextStart,
            endTime: nextEnd,
            durationHours: origDurationHours,
          };
        });
        onUpdatePreferences({
          ...preferences,
          weeklyFixedObligations: updatedObs,
        });
      } else {
        const targetEvt = blockedEvents.find((b) => b.id === draggedItem.eventId);
        if (targetEvt) {
          const [sH, sM] = (targetEvt.startTime || '09:00').split(':').map(Number);
          const [eH, eM] = (targetEvt.endTime || '10:00').split(':').map(Number);
          const computedDurHours = Math.max(
            0.5,
            ((eH * 60 + (eM || 0)) - (sH * 60 + (sM || 0))) / 60
          );
          const origDurationHours =
            targetEvt.durationHours && targetEvt.durationHours > 0
              ? targetEvt.durationHours
              : draggedItem.durationHours && draggedItem.durationHours > 0
              ? draggedItem.durationHours
              : computedDurHours;

          const nextStart = targetHourStr || targetEvt.startTime || '09:00';
          const nextEnd = calculateAutoEndTime(nextStart, origDurationHours);

          upsertBlockedEventInAppState({
            ...targetEvt,
            date: targetDateStr,
            startTime: nextStart,
            endTime: nextEnd,
            durationHours: origDurationHours,
          });

          // If this blocked event is linked to a topic or task, sync its new date and time block
          if (targetEvt.linkedSubjectId && (targetEvt.linkedTopicId || targetEvt.linkedTaskId)) {
            const linkedSub = subjects.find((s) => s.id === targetEvt.linkedSubjectId);
            if (linkedSub) {
              if (targetEvt.linkedTopicId && targetEvt.linkedItemType === 'topic') {
                const updatedTopics = linkedSub.topics.map((t) => {
                  if (t.id !== targetEvt.linkedTopicId) return t;
                  const nextStudyMap = { ...(t.studyTimeByDate || {}) };
                  if (targetEvt.date && targetEvt.date !== targetDateStr) {
                    delete nextStudyMap[targetEvt.date];
                  }
                  nextStudyMap[targetDateStr] = nextStart;
                  return {
                    ...t,
                    scheduledTime: nextStart,
                    scheduledEndTime: nextEnd,
                    studyTimeByDate: nextStudyMap,
                    manualScheduledDate: false,
                  };
                });
                if (onUpdateSubject) {
                  onUpdateSubject({ ...linkedSub, topics: updatedTopics });
                } else {
                  onUpdateTopicsSchedule(linkedSub.id, updatedTopics);
                }
              } else if (targetEvt.linkedTaskId && onUpdateSubject) {
                const updatedTasks = linkedSub.tasks.map((tk) =>
                  tk.id === targetEvt.linkedTaskId
                    ? {
                        ...tk,
                        dueDate: targetDateStr,
                        scheduledTime: nextStart,
                        startTime: nextStart,
                        endTime: nextEnd,
                      }
                    : tk
                );
                onUpdateSubject({ ...linkedSub, tasks: updatedTasks });
              }
            }
          }
        }
      }

      setRescheduledNotice(
        `🕒 Bloque "${draggedItem.title}" movido al ${formatReadableDate(targetDateStr)}${
          targetHourStr ? ` (${targetHourStr})` : ''
        } · Hora de fin recalculada y guardada en blockedEvents.`
      );
      setTimeout(() => setRescheduledNotice(null), 5000);
      setDraggedItem(null);
      return;
    }
  };

  // Find a free hour on dateStr that doesn't collide with fixed obligations, blocked events, study sessions, or other reviews
  const findFreeHourForDate = (
    dateStr: string,
    extraOccupiedHours: Set<number> = new Set()
  ): number | null => {
    const preferredOrder = [10, 11, 16, 17, 18, 9, 12, 19, 15, 20, 8, 13, 14, 21];
    const dayEffectiveBlocked = getEffectiveBlockedForDate(dateStr);
    const daySessions = sessionsByDate[dateStr] || [];
    const dayReviews = srReviewsByDate[dateStr] || [];
    const dayTasks = tasksByDate[dateStr] || [];

    for (const h of preferredOrder) {
      if (extraOccupiedHours.has(h)) continue;

      // Check all effective blocked events (specific date + weekly obligations)
      const isBlocked = dayEffectiveBlocked.some((b) => {
        const sH = parseInt(b.startTime.split(':')[0], 10);
        const eH = parseInt(b.endTime.split(':')[0], 10) || sH + 1;
        return h >= sH && h < Math.max(sH + 1, eH);
      });
      if (isBlocked) continue;

      // Check smart study sessions
      const isSession = daySessions.some((s) => {
        if (!s.startTime) return false;
        const sH = parseInt(s.startTime.split(':')[0], 10);
        const eH = s.endTime ? parseInt(s.endTime.split(':')[0], 10) : sH + Math.ceil(s.durationHours || 1);
        return h >= sH && h < Math.max(sH + 1, eH);
      });
      if (isSession) continue;

      // Check tasks with scheduled startTime
      const isTask = dayTasks.some(({ task }) => {
        if (!task.startTime) return false;
        return parseInt(task.startTime.split(':')[0], 10) === h;
      });
      if (isTask) continue;

      // Check already scheduled reviews on that date
      const isReviewTaken = dayReviews.some(({ analysis }) => {
        const revTime = getReviewScheduledTime(analysis.topic, dateStr);
        if (!revTime) return false;
        return parseInt(revTime.split(':')[0], 10) === h;
      });
      if (isReviewTaken) continue;

      return h;
    }

    return null;
  };

  // Auto-find a free hour slot for a single review
  const handleFindFreeSlotForSingleReview = (
    analysis: TopicReviewAnalysis,
    dateStr: string
  ) => {
    const freeHour = findFreeHourForDate(dateStr);
    if (freeHour === null) {
      setRescheduledNotice(
        `No se encontraron horas libres el ${formatReadableDate(dateStr)} entre las 08:00 y las 21:00. Prueba a arrastrarlo a otro día.`
      );
      setTimeout(() => setRescheduledNotice(null), 4500);
      return;
    }
    const hourStr = `${String(freeHour).padStart(2, '0')}:00`;
    setTimeBlockMode(true);
    if (calendarView === 'monthly' || calendarView === 'yearly') {
      setSelectedDayStr(dateStr);
      setCurrentDate(parseLocalDate(dateStr));
      setCalendarView('daily');
    }
    handleAssignReviewToTimeSlot(analysis.subject.id, analysis.topic.id, dateStr, hourStr);
  };

  // Auto-find free hour slots for all pending reviews in the current view (day or week)
  const handleFindFreeSlotsForAllReviews = () => {
    const targetDates =
      calendarView === 'weekly'
        ? weekDates
        : [selectedDayStr || todayStr];

    const subjectTopicsMap = new Map<string, Topic[]>();
    const assignedDetails: string[] = [];

    targetDates.forEach((dateStr) => {
      const daySR = (srReviewsByDate[dateStr] || []).filter(
        ({ milestone }) => milestone.status !== 'completed'
      );
      if (daySR.length === 0) return;

      const occupiedInBatch = new Set<number>();
      daySR.forEach(({ analysis }) => {
        const existing = getReviewScheduledTime(analysis.topic, dateStr);
        if (existing) {
          occupiedInBatch.add(parseInt(existing.split(':')[0], 10));
        }
      });

      daySR.forEach(({ analysis }) => {
        const freeH = findFreeHourForDate(dateStr, occupiedInBatch);
        if (freeH !== null) {
          occupiedInBatch.add(freeH);
          const hourStr = `${String(freeH).padStart(2, '0')}:00`;
          const subId = analysis.subject.id;
          const currentTopics =
            subjectTopicsMap.get(subId) ||
            subjects.find((s) => s.id === subId)?.topics ||
            [];

          const nextTopics = currentTopics.map((t) => {
            if (t.id !== analysis.topic.id) return t;
            return {
              ...t,
              reviewScheduledTime: hourStr,
              reviewTimeByDate: {
                ...(t.reviewTimeByDate || {}),
                [dateStr]: hourStr,
              },
            };
          });
          subjectTopicsMap.set(subId, nextTopics);
          assignedDetails.push(`${analysis.topic.title} (${hourStr})`);
        }
      });
    });

    if (assignedDetails.length === 0) {
      const next7Dates = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(todayStr, i));
      next7Dates.forEach((dateStr) => {
        const daySR = (srReviewsByDate[dateStr] || []).filter(
          ({ milestone }) => milestone.status !== 'completed'
        );
        const occupiedInBatch = new Set<number>();
        daySR.forEach(({ analysis }) => {
          const freeH = findFreeHourForDate(dateStr, occupiedInBatch);
          if (freeH !== null) {
            occupiedInBatch.add(freeH);
            const hourStr = `${String(freeH).padStart(2, '0')}:00`;
            const subId = analysis.subject.id;
            const currentTopics =
              subjectTopicsMap.get(subId) ||
              subjects.find((s) => s.id === subId)?.topics ||
              [];
            const nextTopics = currentTopics.map((t) =>
              t.id === analysis.topic.id
                ? {
                    ...t,
                    reviewScheduledTime: hourStr,
                    reviewTimeByDate: {
                      ...(t.reviewTimeByDate || {}),
                      [dateStr]: hourStr,
                    },
                  }
                : t
            );
            subjectTopicsMap.set(subId, nextTopics);
            assignedDetails.push(`${analysis.topic.title} (${hourStr})`);
          }
        });
      });
    }

    if (subjectTopicsMap.size > 0) {
      subjectTopicsMap.forEach((updatedTopics, subId) => {
        const subObj = subjects.find((s) => s.id === subId);
        if (subObj && onUpdateSubject) {
          onUpdateSubject({ ...subObj, topics: updatedTopics });
        } else {
          onUpdateTopicsSchedule(subId, updatedTopics);
        }
      });

      setTimeBlockMode(true);
      if (calendarView === 'monthly' || calendarView === 'yearly') {
        setCalendarView('weekly');
      }

      setRescheduledNotice(
        `⚡ Huecos libres asignados automáticamente para ${assignedDetails.length} ${
          assignedDetails.length === 1 ? 'repaso' : 'repasos'
        }: ${assignedDetails.slice(0, 3).join(', ')}${
          assignedDetails.length > 3 ? ` y ${assignedDetails.length - 3} más` : ''
        }. Puedes arrastrarlos a otra hora o día si lo prefieres.`
      );
      setTimeout(() => setRescheduledNotice(null), 6000);
    } else {
      setRescheduledNotice(
        'No hay repasos pendientes de asignar hueco en este periodo o todas las horas están ocupadas.'
      );
      setTimeout(() => setRescheduledNotice(null), 4000);
    }
  };

  // Delete an effective blocked item (either a specific BlockedTimeEvent or a WeeklyObligation)
  const handleDeleteEffectiveBlockedItem = (item: EffectiveBlockedCalendarItem) => {
    if (item.isWeeklyObligation && item.sourceObligationId && onUpdatePreferences) {
      const nextObs = (preferences.weeklyFixedObligations || []).filter(
        (ob) => ob.id !== item.sourceObligationId
      );
      onUpdatePreferences({
        ...preferences,
        weeklyFixedObligations: nextObs,
      });
      // Also remove any mirrored recurring event in blockedEvents with matching title/hours
      if (onDeleteBlockedEvent) {
        blockedEvents
          .filter(
            (ev) =>
              ev.id === item.id ||
              ev.id === `block-weekly-${item.sourceObligationId}` ||
              (!ev.date &&
                ev.title.toLowerCase() === item.title.toLowerCase() &&
                ev.startTime === item.startTime &&
                ev.endTime === item.endTime)
          )
          .forEach((ev) => onDeleteBlockedEvent(ev.id));
      }
      setRescheduledNotice(`Rutina semanal "${item.title}" eliminada del calendario.`);
      setTimeout(() => setRescheduledNotice(null), 4000);
    } else if (onDeleteBlockedEvent) {
      onDeleteBlockedEvent(item.id);
      // If it was a recurring weekly event that also exists in weeklyFixedObligations, remove it there too
      if (item.isRecurringWeekly && onUpdatePreferences) {
        const nextObs = (preferences.weeklyFixedObligations || []).filter(
          (ob) =>
            !(
              ob.title.toLowerCase() === item.title.toLowerCase() &&
              ob.startTime === item.startTime &&
              ob.endTime === item.endTime
            )
        );
        if (nextObs.length !== (preferences.weeklyFixedObligations || []).length) {
          onUpdatePreferences({
            ...preferences,
            weeklyFixedObligations: nextObs,
          });
        }
      }
      if (item.linkedSubjectId && (item.linkedTopicId || item.linkedTaskId)) {
        const linkedSub = subjects.find((s) => s.id === item.linkedSubjectId);
        if (linkedSub) {
          if (item.linkedTopicId && item.linkedItemType === 'topic') {
            const updatedTopics = linkedSub.topics.map((t) => {
              if (t.id !== item.linkedTopicId) return t;
              const nextStudyMap = { ...(t.studyTimeByDate || {}) };
              if (item.date) delete nextStudyMap[item.date];
              return {
                ...t,
                scheduledTime: undefined,
                scheduledEndTime: undefined,
                studyTimeByDate: nextStudyMap,
                manualScheduledDate: false,
              };
            });
            if (onUpdateSubject) {
              onUpdateSubject({ ...linkedSub, topics: updatedTopics });
            } else {
              onUpdateTopicsSchedule(linkedSub.id, updatedTopics);
            }
          } else if (item.linkedTaskId && onUpdateSubject) {
            const updatedTasks = linkedSub.tasks.map((tk) =>
              tk.id === item.linkedTaskId
                ? { ...tk, scheduledTime: undefined, startTime: undefined, endTime: undefined }
                : tk
            );
            onUpdateSubject({ ...linkedSub, tasks: updatedTasks });
          }
        }
      }
      setRescheduledNotice(`Bloque de tiempo "${item.title}" eliminado del calendario.`);
      setTimeout(() => setRescheduledNotice(null), 4000);
    }
  };

  // Quick 1-click Weekly Recurring Preset (Clases, Entrenos, Gimnasio, Trabajo...) + Auto Recalculate
  const handleQuickBlockWeeklyRecurring = (
    title: string,
    category: WeeklyObligation['category'],
    days: number[],
    startTime: string,
    endTime: string,
    autoRecalculate = true,
    notes?: string
  ) => {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationHours = Math.max(
      0.5,
      Math.round(((eH * 60 + (eM || 0) - (sH * 60 + (sM || 0))) / 60) * 10) / 10
    );

    const cleanDays = days && days.length > 0 ? days : [1, 2, 3, 4, 5];
    const batchTs = Date.now();

    const newObs: WeeklyObligation[] = cleanDays.map((d) => ({
      id: `ob-auto-${batchTs}-${d}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      category,
      dayOfWeek: d,
      startTime,
      endTime,
      durationHours,
      notes: notes || undefined,
      isAutomatedWeekly: true,
      recurringDays: [d],
    }));

    const updatedPreferences: StudyPreferences = {
      ...preferences,
      weeklyFixedObligations: [...(preferences.weeklyFixedObligations || []), ...newObs],
    };

    onUpdatePreferences?.(updatedPreferences);

    // Also persist as a recurring BlockedTimeEvent in blockedEvents so it stays synced across all storage layers
    const mappedBlockedCat: BlockedTimeEvent['category'] =
      category === 'gimnasio'
        ? 'deporte'
        : category === 'clase'
        ? 'clase'
        : category === 'trabajo'
        ? 'trabajo'
        : category === 'descanso'
        ? 'descanso'
        : 'personal';

    const recurringBlockedEvent: BlockedTimeEvent = {
      id: `block-weekly-${batchTs}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      startTime,
      endTime,
      durationHours,
      category: mappedBlockedCat,
      notes: notes || undefined,
      recurringDays: cleanDays,
    };

    onAddBlockedEvent?.(recurringBlockedEvent);
    const nextBlockedList = [...blockedEvents, recurringBlockedEvent];

    if (autoRecalculate) {
      handleRecalculateTopicsAndReviews({
        customPreferences: updatedPreferences,
        customBlockedEvents: nextBlockedList,
        preserveManualPins: true,
        prefixMessage: `🔁 Bloqueado todas las semanas "${title}" (${startTime}–${endTime})`,
      });
    } else {
      setRescheduledNotice(
        `🔁 "${title}" (${startTime}–${endTime}) guardado y bloqueado automáticamente para todas las semanas.`
      );
      setTimeout(() => setRescheduledNotice(null), 5000);
    }
  };

  // Quick 1-click On-the-Fly Plan (Plan que surge sobre la marcha) + Auto Recalculate
  const handleQuickAddOnTheFlyPlan = (
    title: string,
    dateStr: string,
    startTime: string,
    endTime: string,
    category: BlockedTimeEvent['category'] = 'personal',
    autoRecalculate = true,
    notes?: string
  ) => {
    const effectiveDate = dateStr || selectedDayStr || todayStr;
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationHours = Math.max(
      0.5,
      Math.round(((eH * 60 + (eM || 0) - (sH * 60 + (sM || 0))) / 60) * 10) / 10
    );

    const newEvent: BlockedTimeEvent = {
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      date: effectiveDate,
      startTime,
      endTime,
      durationHours,
      category,
      notes: notes || undefined,
    };

    onAddBlockedEvent?.(newEvent);
    setSelectedDayStr(effectiveDate);
    const nextBlockedList = [...blockedEvents, newEvent];

    if (autoRecalculate) {
      handleRecalculateTopicsAndReviews({
        customBlockedEvents: nextBlockedList,
        preserveManualPins: true,
        prefixMessage: `⚡ Plan sobre la marcha "${title}" guardado el ${formatReadableDate(effectiveDate)} (${startTime}–${endTime})`,
      });
    } else {
      setRescheduledNotice(
        `⚡ Plan "${title}" (${startTime}–${endTime}) guardado el ${formatReadableDate(effectiveDate)}.`
      );
      setTimeout(() => setRescheduledNotice(null), 5000);
    }
  };

  const handleSaveBlockedEvent = (e?: React.FormEvent, shouldRecalculateAfter = false) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const startT = blockedStartTime || '16:00';
    const endT = blockedEndTime || '18:00';

    const categoryDefaultTitles: Record<string, string> = {
      personal: 'Plan Personal / Imprevisto',
      clase: 'Clases / Academia',
      deporte: 'Entreno / Deporte',
      social: 'Plan Social / Ocio',
      medico: 'Cita Médica / Salud',
      trabajo: 'Trabajo / Obligaciones',
      descanso: 'Descanso',
      otro: blockedModalMode === 'weekly_recurring' ? 'Rutina Fija Semanal' : 'Plan Bloqueado',
    };

    const resolvedTitle =
      blockedTitle.trim() ||
      categoryDefaultTitles[blockedCategory] ||
      (blockedModalMode === 'weekly_recurring' ? 'Rutina Fija Semanal' : 'Plan Personal');

    const resolvedNotes = blockedNotes.trim() || undefined;

    if (blockedModalMode === 'weekly_recurring') {
      const daysToApply = blockedRecurringDays.length > 0 ? blockedRecurringDays : [1, 2, 3, 4, 5];
      const mappedCat: WeeklyObligation['category'] =
        blockedCategory === 'deporte'
          ? 'gimnasio'
          : blockedCategory === 'clase'
          ? 'clase'
          : blockedCategory === 'trabajo'
          ? 'trabajo'
          : blockedCategory === 'descanso'
          ? 'descanso'
          : 'personal';

      handleQuickBlockWeeklyRecurring(
        resolvedTitle,
        mappedCat,
        daysToApply,
        startT,
        endT,
        shouldRecalculateAfter,
        resolvedNotes
      );
      setShowAddBlockedModal(false);
      setBlockedTitle('');
      setBlockedNotes('');
      return;
    }

    const resolvedDate = blockedDate || selectedDayStr || todayStr;
    handleQuickAddOnTheFlyPlan(
      resolvedTitle,
      resolvedDate,
      startT,
      endT,
      blockedCategory,
      shouldRecalculateAfter,
      resolvedNotes
    );
    setShowAddBlockedModal(false);
    setBlockedTitle('');
    setBlockedNotes('');
  };

  // Date navigation helpers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (calendarView === 'yearly') {
      next.setFullYear(next.getFullYear() - 1);
    } else if (calendarView === 'monthly') {
      next.setMonth(next.getMonth() - 1);
    } else if (calendarView === 'weekly') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
    setSelectedDayStr(toLocalDateStr(next));
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (calendarView === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else if (calendarView === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else if (calendarView === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
    setSelectedDayStr(toLocalDateStr(next));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDayStr(toLocalDateStr(now));
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const daysGrid = useMemo(
    () => getDaysInMonthGrid(currentYear, currentMonth, todayStr),
    [currentYear, currentMonth, todayStr]
  );

  const weekDates = useMemo(
    () => getWeekDatesList(currentDate),
    [currentDate]
  );

  // Dynamic timeline hours: default 08:00..22:00, automatically expanding to include early/late plans (e.g. 07:00 or 23:00)
  const timelineHours = useMemo(() => {
    let minH = 8;
    let maxH = 22;
    const expandForRange = (startStr?: string, endStr?: string) => {
      if (startStr) {
        const sH = parseInt(startStr.split(':')[0], 10);
        if (!Number.isNaN(sH)) {
          minH = Math.min(minH, Math.max(0, sH));
          maxH = Math.max(maxH, Math.min(23, sH));
        }
      }
      if (endStr) {
        const eH = parseInt(endStr.split(':')[0], 10);
        if (!Number.isNaN(eH)) {
          maxH = Math.max(maxH, Math.min(23, Math.max(0, eH - 1)));
        }
      }
    };

    blockedEvents.forEach((ev) => expandForRange(ev.startTime, ev.endTime));
    (preferences.weeklyFixedObligations || []).forEach((ob) =>
      expandForRange(ob.startTime, ob.endTime)
    );

    const hours: number[] = [];
    for (let h = minH; h <= maxH; h++) {
      hours.push(h);
    }
    return hours;
  }, [blockedEvents, preferences.weeklyFixedObligations]);

  // Selected Day Data for the Unified Day Inspector
  const selectedDayStudySessions =
    calendarLayerFilter === 'repaso' || calendarLayerFilter === 'examenes_tareas'
      ? []
      : sessionsByDate[selectedDayStr] || [];
  const selectedDaySRReviews =
    calendarLayerFilter === 'estudio' || calendarLayerFilter === 'examenes_tareas'
      ? []
      : srReviewsByDate[selectedDayStr] || [];
  const selectedDayTasks =
    calendarLayerFilter === 'estudio' || calendarLayerFilter === 'repaso'
      ? []
      : tasksByDate[selectedDayStr] || [];
  const selectedDayExams =
    calendarLayerFilter === 'estudio' || calendarLayerFilter === 'repaso'
      ? []
      : examsByDate[selectedDayStr] || [];
  const selectedDayBlocked = getEffectiveBlockedForDate(selectedDayStr);

  const showStudyLayer =
    calendarLayerFilter === 'all' || calendarLayerFilter === 'estudio';
  const showRepasoLayer =
    calendarLayerFilter === 'all' || calendarLayerFilter === 'repaso';
  const showExamsTasksLayer =
    calendarLayerFilter === 'all' || calendarLayerFilter === 'examenes_tareas';

  // Helper: Calcular el número efectivo de vueltas de un tema
  const getTopicEffectiveVueltas = (topic: Topic): number => {
    if (typeof topic.vueltasCount === 'number' && topic.vueltasCount >= 0) {
      return topic.vueltasCount;
    }
    const revHistoryCount = topic.reviewsHistory?.length || 0;
    if (topic.status === 'repasado') {
      return Math.max(2, (topic.reviewLevel || 1) + 1, revHistoryCount + 1);
    }
    if (topic.status === 'estudiado') {
      return Math.max(1, revHistoryCount + 1);
    }
    return 0;
  };

  // Mapa de temas vinculados a tareas de esta semana y estadísticas globales/por materia de Vueltas al Temario
  const vueltasAndWeeklyTasksData = useMemo(() => {
    const topicWeeklyTaskLookup = new Map<
      string,
      { task: Task; targetDateStr: string; subjectName: string }
    >();

    let totalTopicsCount = 0;
    let vuelta1Completed = 0; // >= 1 vuelta
    let vuelta2Completed = 0; // >= 2 vueltas
    let vuelta3PlusCompleted = 0; // >= 3 vueltas
    let totalVueltasSum = 0;

    const subjectSummaries: Array<{
      subject: Subject;
      totalTopics: number;
      vuelta1Count: number;
      vuelta2Count: number;
      vuelta3PlusCount: number;
      vuelta1Pct: number;
      vuelta2Pct: number;
      vuelta3PlusPct: number;
      weeklyTasksCount: number;
    }> = [];

    const allTopicItems: Array<{
      subject: Subject;
      topic: Topic;
      vueltas: number;
      weeklyTaskInfo?: { task: Task; targetDateStr: string };
    }> = [];

    const weekEndStr = addDaysToDateStr(todayStr, 7);

    relevantSubjects.forEach((sub) => {
      const matchedMap = schedulerService.matchWeeklyTasksToTopics(
        sub.topics || [],
        sub.tasks || [],
        todayStr
      );

      matchedMap.forEach((val, topicId) => {
        topicWeeklyTaskLookup.set(topicId, {
          ...val,
          subjectName: sub.name,
        });
      });

      const subTopics = sub.topics || [];
      let sV1 = 0;
      let sV2 = 0;
      let sV3 = 0;

      subTopics.forEach((t) => {
        const v = getTopicEffectiveVueltas(t);
        totalTopicsCount++;
        totalVueltasSum += v;
        if (v >= 1) {
          vuelta1Completed++;
          sV1++;
        }
        if (v >= 2) {
          vuelta2Completed++;
          sV2++;
        }
        if (v >= 3) {
          vuelta3PlusCompleted++;
          sV3++;
        }

        allTopicItems.push({
          subject: sub,
          topic: t,
          vueltas: v,
          weeklyTaskInfo: matchedMap.get(t.id),
        });
      });

      const subWeeklyTasksCount = (sub.tasks || []).filter(
        (tk) => !tk.completed && tk.dueDate && tk.dueDate >= todayStr && tk.dueDate <= weekEndStr
      ).length;

      const count = subTopics.length;
      subjectSummaries.push({
        subject: sub,
        totalTopics: count,
        vuelta1Count: sV1,
        vuelta2Count: sV2,
        vuelta3PlusCount: sV3,
        vuelta1Pct: count > 0 ? Math.round((sV1 / count) * 100) : 0,
        vuelta2Pct: count > 0 ? Math.round((sV2 / count) * 100) : 0,
        vuelta3PlusPct: count > 0 ? Math.round((sV3 / count) * 100) : 0,
        weeklyTasksCount: subWeeklyTasksCount,
      });
    });

    return {
      topicWeeklyTaskLookup,
      totalTopicsCount,
      vuelta1Completed,
      vuelta2Completed,
      vuelta3PlusCompleted,
      vuelta1Pct:
        totalTopicsCount > 0 ? Math.round((vuelta1Completed / totalTopicsCount) * 100) : 0,
      vuelta2Pct:
        totalTopicsCount > 0 ? Math.round((vuelta2Completed / totalTopicsCount) * 100) : 0,
      vuelta3PlusPct:
        totalTopicsCount > 0 ? Math.round((vuelta3PlusCompleted / totalTopicsCount) * 100) : 0,
      avgVueltas:
        totalTopicsCount > 0 ? Math.round((totalVueltasSum / totalTopicsCount) * 10) / 10 : 0,
      subjectSummaries,
      allTopicItems,
    };
  }, [relevantSubjects, todayStr]);

  // Actualizar el contador de vueltas de un tema (+1 vuelta o -1 vuelta) y sincronizar su estado y próximo repaso
  const handleUpdateTopicVueltas = (subjectId: string, topicId: string, nextVueltas: number) => {
    const sub = subjects.find((s) => s.id === subjectId);
    if (!sub) return;

    const clamped = Math.max(0, Math.min(15, nextVueltas));
    const updatedTopics = sub.topics.map((t) => {
      if (t.id !== topicId) return t;

      const nextStatus: Topic['status'] =
        clamped === 0 ? 'pendiente' : clamped === 1 ? 'estudiado' : 'repasado';
      const nextReviewLevel = clamped === 0 ? 0 : Math.min(5, clamped);
      const intervalDays =
        clamped === 0
          ? 0
          : clamped === 1
          ? 1
          : clamped === 2
          ? 3
          : clamped === 3
          ? 7
          : clamped === 4
          ? 15
          : 30;
      const nextReviewDate =
        clamped > 0 ? addDaysToDateStr(todayStr, intervalDays) : undefined;

      return {
        ...t,
        vueltasCount: clamped,
        status: nextStatus,
        studiedAt: clamped >= 1 ? t.studiedAt || todayStr : undefined,
        reviewLevel: nextReviewLevel,
        nextReviewDate,
        lastAdjustmentReason:
          clamped > 0
            ? `Marcada ${clamped}ª Vuelta al temario · Próximo repaso en +${intervalDays}d`
            : 'Reiniciado a 0 vueltas',
      };
    });

    if (onUpdateSubject) {
      onUpdateSubject({ ...sub, topics: updatedTopics });
    } else {
      onUpdateTopicsSchedule(sub.id, updatedTopics);
    }

    const targetTopic = sub.topics.find((t) => t.id === topicId);
    if (targetTopic) {
      setRescheduledNotice(
        `🔄 "${targetTopic.title}" (${sub.name}) actualizado a ${clamped} ${
          clamped === 1 ? 'vuelta' : 'vueltas'
        } al temario.`
      );
      setTimeout(() => setRescheduledNotice(null), 4000);
    }
  };

  const renderVueltaRing = (pct: number, colorHex: string, trackClass: string) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const size = 64;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (clamped / 100) * circumference;

    return (
      <div
        className="relative inline-flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            strokeWidth={strokeWidth}
            className={trackClass}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={colorHex}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <span className="absolute text-xs font-extrabold font-mono-numbers text-slate-900 dark:text-white">
          {clamped}%
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. CABECERA COMPACTA Y KPIS ESENCIALES */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Planificación, Vueltas y Calendario
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Interactivo · Drag & Drop
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Control visual de vueltas al temario, priorización por tareas semanales y calendario dinámico.
              </p>
            </div>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr gap-2.5 items-stretch">
            {distinctPrograms.length > 1 && (
              <select
                value={selectedProgramFilter}
                onChange={(e) => setSelectedProgramFilter(e.target.value)}
                className="w-full h-10 text-xs bg-slate-50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 text-indigo-900 dark:text-indigo-200 font-bold focus:outline-none shadow-2xs truncate cursor-pointer"
                title="Filtrar por estudio"
              >
                <option value="all">Mix Estudios ({distinctPrograms.length})</option>
                {distinctPrograms.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full h-10 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none shadow-2xs truncate cursor-pointer"
            >
              <option value="all">Todas las materias ({relevantSubjects.length})</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.programName && distinctPrograms.length > 1
                    ? `[${sub.programName}] ${sub.name}`
                    : sub.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowQuickBlockBar(!showQuickBlockBar)}
              className={`w-full h-10 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer shadow-2xs ${
                showQuickBlockBar
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Atajos de 1 clic para bloquear clases, entrenos o planes imprevistos"
            >
              <Ban className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">Bloqueos Rápidos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBlockedDate(selectedDayStr);
                setBlockedModalMode('on_the_fly');
                setShowAddBlockedModal(true);
              }}
              className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Añadir Plan / Bloqueo</span>
            </button>

            <button
              type="button"
              onClick={() => handleRecalculateTopicsAndReviews({ preserveManualPins: true })}
              disabled={isRecalculatingAll}
              className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer"
              title="Recalcular temas y repasos teniendo en cuenta tareas semanales y bloqueos"
            >
              <RotateCw className={`w-3.5 h-3.5 shrink-0 ${isRecalculatingAll ? 'animate-spin' : ''}`} />
              <span className="truncate">Recalcular Plan</span>
            </button>

            <button
              type="button"
              onClick={() => setShowIcsExportModal(true)}
              className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer"
              title="Exportar eventos bloqueados (estudio, hábitos y exámenes) a un archivo .ics para Google Calendar o Apple Calendar"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Sincronizar .ICS</span>
            </button>
          </div>
        </div>

        {/* 5 Indicadores Visuales Compactos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div
            onClick={() =>
              setCalendarLayerFilter(calendarLayerFilter === 'estudio' ? 'all' : 'estudio')
            }
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              calendarLayerFilter === 'estudio'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400'
                : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300'
            }`}
          >
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Plan de Estudio
              </span>
              <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-slate-900 dark:text-white mt-0.5">
                {kpiMetrics.totalPlannedStudyHours}h{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({kpiMetrics.totalPlannedSessions} ses.)
                </span>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                Fin: {formatReadableDate(latestProjectedDate)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-blue-100/80 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>

          <div
            onClick={() => {
              setSelectedDayStr(todayStr);
              setCalendarLayerFilter(calendarLayerFilter === 'repaso' ? 'all' : 'repaso');
            }}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              kpiMetrics.actionableToday > 0
                ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300'
            }`}
          >
            <div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Repasos para Hoy
              </span>
              <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-slate-900 dark:text-white mt-0.5">
                {kpiMetrics.actionableToday}{' '}
                <span className="text-xs font-normal text-slate-400">
                  (+{kpiMetrics.next7DaysCount} en 7d)
                </span>
              </div>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                Ciclos R1–R5 activos
              </span>
            </div>
            <div className="p-2 rounded-xl bg-amber-100/80 dark:bg-amber-950 text-amber-700 dark:text-amber-300 shrink-0">
              <Brain className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Retención Media
              </span>
              <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-emerald-600 dark:text-emerald-400 mt-0.5">
                {kpiMetrics.activeTopicsCount > 0 ? `${kpiMetrics.avgRetention}%` : '—'}
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${kpiMetrics.avgRetention}%` }}
                />
              </div>
            </div>
            <div className="p-2 rounded-xl bg-emerald-100/80 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div
            onClick={() => setShowVueltasSection(!showVueltasSection)}
            className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/70 flex items-center justify-between gap-3 cursor-pointer"
          >
            <div>
              <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 block">
                Vueltas al Temario
              </span>
              <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-purple-700 dark:text-purple-300 mt-0.5">
                {vueltasAndWeeklyTasksData.vuelta1Pct}%{' '}
                <span className="text-xs font-normal text-slate-500">1ª vuelta</span>
              </div>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                Media: {vueltasAndWeeklyTasksData.avgVueltas} vueltas/tema
              </span>
            </div>
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 shrink-0">
              <RotateCw className="w-4 h-4" />
            </div>
          </div>

          {/* Card 5: Meta y Horas Libres del Calendario */}
          <div
            onClick={() => setShowDailyGoalAvailabilitySection(!showDailyGoalAvailabilitySection)}
            className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/70 flex items-center justify-between gap-3 cursor-pointer"
          >
            <div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                Meta Diaria & Libres
              </span>
              <div className="text-lg sm:text-xl font-extrabold font-mono-numbers text-emerald-700 dark:text-emerald-300 mt-0.5">
                {calendarAvailabilityData.configuredDailyGoal}h{' '}
                <span className="text-xs font-normal text-slate-500">/día</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                ~{calendarAvailabilityData.avgDailyFreeHours}h libres/d
              </span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* BARRA COMPACTA DESPLEGABLE: CONTROL DE HÁBITOS (CON BUSCADOR DE HUECOS) Y MOOD TRACKER */}
      <HabitsAndMoodTrackerBar
        preferences={preferences}
        onUpdatePreferences={onUpdatePreferences}
        selectedDayStr={selectedDayStr}
        sessionsByDate={sessionsByDate}
        getEffectiveBlockedForDate={getEffectiveBlockedForDate}
        onScheduleHabitOneDay={(title, dateStr, startTime, endTime, category, notes) =>
          handleQuickAddOnTheFlyPlan(title, dateStr, startTime, endTime, category, true, notes)
        }
        onScheduleHabitWeekly={(title, category, days, startTime, endTime, notes) =>
          handleQuickBlockWeeklyRecurring(title, category, days, startTime, endTime, true, notes)
        }
      />

      {/* SECCIÓN VISUAL: META DIARIA Y HORAS LIBRES DEL CALENDARIO (Disponibilidad de Estudio) */}
      {showDailyGoalAvailabilitySection && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-5">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xs shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Meta Diaria y Horas Libres del Calendario
                  </h4>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                      calendarAvailabilityData.status === 'optimo'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                        : calendarAvailabilityData.status === 'ajustado'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {calendarAvailabilityData.status === 'optimo' ? '●' : '▲'}{' '}
                    {calendarAvailabilityData.statusLabel} (~{calendarAvailabilityData.avgDailyFreeHours}h/día libres)
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Calculado automáticamente restando tus clases fijas, trabajo y eventos del calendario. Decide cuántas horas dedicar cada día y recalcula tu plan en 1 clic.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCustomDaysGoal(!showCustomDaysGoal)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  showCustomDaysGoal
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {showCustomDaysGoal ? '✓ Desglose L–D Activo' : 'Personalizar Lunes a Domingo'}
              </button>
            </div>
          </div>

          {/* 3 Metric Cards: Horas Libres en Calendario vs Meta Elegida vs Margen de Descanso */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Card 1: Horas Libres del Calendario */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-semibold">Horas Libres del Calendario</span>
                <span className="p-1 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <CalendarIcon className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 font-mono-numbers">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {calendarAvailabilityData.avgDailyFreeHours}h
                </span>
                <span className="text-xs text-slate-500">/ día de media</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers pt-1 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                <span>Total semanal libre:</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {calendarAvailabilityData.totalWeeklyFreeHours}h / sem
                </strong>
              </div>
            </div>

            {/* Card 2: Meta Diaria de Estudio Elegida */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                <span className="text-xs font-semibold">Meta de Estudio Elegida</span>
                <span className="p-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                  <BookOpen className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 font-mono-numbers">
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {localDailyGoalHours}h
                </span>
                <span className="text-xs text-slate-500">/ día planificadas</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono-numbers pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
                <span>Total estudio semanal:</span>
                <strong className="text-emerald-700 dark:text-emerald-300">
                  {calendarAvailabilityData.totalWeeklyStudyGoal}h / sem
                </strong>
              </div>
            </div>

            {/* Card 3: Margen de Descanso y Viabilidad */}
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                calendarAvailabilityData.status === 'optimo'
                  ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                  : calendarAvailabilityData.status === 'ajustado'
                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                  : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Margen de Tiempo Personal
                </span>
                <span
                  className={`p-1 rounded-lg ${
                    calendarAvailabilityData.status === 'optimo'
                      ? 'bg-blue-100 text-blue-700'
                      : calendarAvailabilityData.status === 'ajustado'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 font-mono-numbers">
                <span
                  className={`text-2xl font-black ${
                    calendarAvailabilityData.dailyMargin >= 0
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {calendarAvailabilityData.dailyMargin >= 0 ? '+' : ''}
                  {calendarAvailabilityData.dailyMargin}h
                </span>
                <span className="text-xs text-slate-500">/ día de respiro</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug pt-1 border-t border-black/5 dark:border-white/5">
                {calendarAvailabilityData.statusMessage}
              </div>
            </div>
          </div>

          {/* Selector de Horas Diarias: Stepper + Presets de 1 Clic + Botón Guardar y Recalcular */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  ¿Cuántas horas quieres dedicarle al estudio al día?
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Selecciona tu meta habitual diaria. Los temas pendientes y repasos espaciados se programarán dentro de esta capacidad.
                </p>
              </div>

              {/* Stepper Controls */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, Math.round((localDailyGoalHours - 0.5) * 10) / 10);
                      setLocalDailyGoalHours(next);
                      if (!showCustomDaysGoal) {
                        const upd: Record<number, number> = {};
                        [1, 2, 3, 4, 5, 6, 0].forEach((d) => (upd[d] = next));
                        setLocalHoursPerDay(upd);
                      }
                    }}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-sm flex items-center justify-center cursor-pointer transition-colors"
                    title="Restar 30 minutos"
                  >
                    -
                  </button>

                  <div className="px-3 text-center min-w-[90px]">
                    <span className="text-lg font-black font-mono-numbers text-slate-900 dark:text-white block leading-none">
                      {localDailyGoalHours}h
                    </span>
                    <span className="text-[10px] text-slate-400">al día</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(12, Math.round((localDailyGoalHours + 0.5) * 10) / 10);
                      setLocalDailyGoalHours(next);
                      if (!showCustomDaysGoal) {
                        const upd: Record<number, number> = {};
                        [1, 2, 3, 4, 5, 6, 0].forEach((d) => (upd[d] = next));
                        setLocalHoursPerDay(upd);
                      }
                    }}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-sm flex items-center justify-center cursor-pointer transition-colors"
                    title="Sumar 30 minutos"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isRecalculatingAll}
                  onClick={() => handleApplyDailyGoalHours(localDailyGoalHours)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRecalculatingAll ? 'animate-spin' : ''}`} />
                  <span>Aplicar y Recalcular Plan</span>
                </button>
              </div>
            </div>

            {/* Quick 1-click Preset Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Preajustes rápidos:</span>
              </span>
              {[
                { hours: 2.0, label: '2h · Ligero' },
                { hours: 3.0, label: '3h · Moderado' },
                { hours: 4.0, label: '4h · Equilibrado' },
                { hours: 5.0, label: '5h · Intensivo' },
                { hours: 6.5, label: '6.5h · Exámenes' },
                { hours: 8.0, label: '8h · Oposición' },
              ].map((preset) => {
                const isSelected = localDailyGoalHours === preset.hours;
                return (
                  <button
                    key={preset.hours}
                    type="button"
                    onClick={() => {
                      setLocalDailyGoalHours(preset.hours);
                      if (!showCustomDaysGoal) {
                        const upd: Record<number, number> = {};
                        [1, 2, 3, 4, 5, 6, 0].forEach((d) => (upd[d] = preset.hours));
                        setLocalHoursPerDay(upd);
                      }
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Day-by-Day (Lunes a Domingo) Detailed Grid */}
            {showCustomDaysGoal && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Ajuste Fino por Día de la Semana (L–D)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Adapta tus horas de estudio si ciertos días tienes más clases o compromisos
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {calendarAvailabilityData.dayBreakdowns.map((d) => {
                    const isDayOverloaded = d.margin < 0;
                    return (
                      <div
                        key={d.day}
                        className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between space-y-2 ${
                          isDayOverloaded
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {d.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              d.freeHours >= d.configuredHours
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {d.freeHours}h libres
                          </span>
                        </div>

                        <div className="flex items-center justify-between font-mono-numbers text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Ocupado:</span>
                          <strong className="text-slate-700 dark:text-slate-300">
                            {d.totalOccupied}h
                          </strong>
                        </div>

                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 font-semibold">Meta:</span>
                          <div className="flex items-center gap-1 font-mono-numbers">
                            <button
                              type="button"
                              onClick={() => {
                                const current = localHoursPerDay[d.day] ?? localDailyGoalHours;
                                const next = Math.max(0, Math.round((current - 0.5) * 10) / 10);
                                setLocalHoursPerDay((prev) => ({ ...prev, [d.day]: next }));
                              }}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 min-w-[26px] text-center">
                              {d.configuredHours}h
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = localHoursPerDay[d.day] ?? localDailyGoalHours;
                                const next = Math.min(12, Math.round((current + 0.5) * 10) / 10);
                                setLocalHoursPerDay((prev) => ({ ...prev, [d.day]: next }));
                              }}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANEL DESPLEGABLE OPCIONAL: ATAJOS RÁPIDOS DE BLOQUEOS SEMANALES Y PLANES */}
      {showQuickBlockBar && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Ban className="w-4 h-4 text-indigo-600" />
              <span>Atajos de 1 clic para Bloqueos Fijos Semanales o Planes de Hoy</span>
            </span>
            <button
              type="button"
              onClick={() => setShowQuickBlockBar(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 w-full mb-0.5">
                🔁 Rutinas Fijas Semanales:
              </span>
              <button
                type="button"
                onClick={() =>
                  handleQuickBlockWeeklyRecurring('Clases / Universidad', 'clase', [1, 2, 3, 4, 5], '09:00', '14:00', true)
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer hover:bg-indigo-50"
              >
                🎓 Clases L–V (09–14h)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickBlockWeeklyRecurring('Entreno / Gimnasio', 'gimnasio', [1, 3, 5], '18:00', '19:30', true)
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer hover:bg-emerald-50"
              >
                🏋️ Gimnasio L-X-V (18–19:30h)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickBlockWeeklyRecurring('Trabajo / Prácticas', 'trabajo', [1, 2, 3, 4, 5], '16:00', '20:00', true)
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer hover:bg-amber-50"
              >
                💼 Trabajo L–V (16–20h)
              </button>
              <button
                type="button"
                onClick={() => setShowAvailabilityPlanner(!showAvailabilityPlanner)}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 text-[11px] font-bold cursor-pointer"
              >
                ⚙️ Configurar Horario Fijo
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 w-full mb-0.5">
                ⚡ Imprevistos para {selectedDayStr === todayStr ? 'Hoy' : formatReadableDate(selectedDayStr)}:
              </span>
              <button
                type="button"
                onClick={() =>
                  handleQuickAddOnTheFlyPlan('Tarde Ocupada', selectedDayStr, '16:00', '20:00', 'social', true)
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 text-[11px] font-semibold text-amber-900 dark:text-amber-200 cursor-pointer"
              >
                ☕ Tarde ocupada (16–20h)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickAddOnTheFlyPlan('Mañana Ocupada', selectedDayStr, '09:00', '13:00', 'personal', true)
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 text-[11px] font-semibold text-amber-900 dark:text-amber-200 cursor-pointer"
              >
                🩺 Mañana ocupada (09–13h)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickAddOnTheFlyPlan('Día Completo No Disponible', selectedDayStr, '08:00', '21:00', 'personal', true)
                }
                className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-800 cursor-pointer"
              >
                🚫 Bloquear Día Entero
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SECCIÓN VISUAL: CONTROL DE VUELTAS AL TEMARIO Y REVISIÓN POR TAREAS SEMANALES */}
      {showVueltasSection && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-xs shrink-0">
                <RotateCw className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Control Visual de Vueltas al Temario y Tareas de la Semana
                  </h4>
                  {vueltasAndWeeklyTasksData.topicWeeklyTaskLookup.size > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                      📋 {vueltasAndWeeklyTasksData.topicWeeklyTaskLookup.size}{' '}
                      {vueltasAndWeeklyTasksData.topicWeeklyTaskLookup.size === 1
                        ? 'tema priorizado por tarea esta semana'
                        : 'temas priorizados por tareas esta semana'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Anillos de progreso por vuelta (1ª, 2ª y 3ª+) y temas vinculados a tus entregas de esta semana.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleRecalculateTopicsAndReviews({ preserveManualPins: true })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer shadow-2xs transition-colors"
              title="Recalcular el plan priorizando los temas vinculados a las tareas que vencen esta semana"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Priorizar Tareas de la Semana</span>
            </button>
          </div>

          {/* 3 Anillos Visuales Globales (1ª Vuelta, 2ª Vuelta, 3ª+ Vuelta) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1ª Vuelta */}
            <div
              onClick={() => setVueltasFilter(vueltasFilter === 'vuelta_1' ? 'all' : 'vuelta_1')}
              className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all ${
                vueltasFilter === 'vuelta_1'
                  ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-400 ring-2 ring-blue-500/20'
                  : 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/50 hover:border-blue-300'
              }`}
            >
              {renderVueltaRing(
                vueltasAndWeeklyTasksData.vuelta1Pct,
                '#2563eb',
                'stroke-blue-100 dark:stroke-blue-950'
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-900 dark:text-blue-300 block">
                  1ª Vuelta · Estudio Base
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono-numbers">
                  {vueltasAndWeeklyTasksData.vuelta1Completed} /{' '}
                  {vueltasAndWeeklyTasksData.totalTopicsCount} temas
                </div>
                <div className="w-full h-1.5 bg-blue-100 dark:bg-blue-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${vueltasAndWeeklyTasksData.vuelta1Pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 2ª Vuelta */}
            <div
              onClick={() => setVueltasFilter(vueltasFilter === 'vuelta_2' ? 'all' : 'vuelta_2')}
              className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all ${
                vueltasFilter === 'vuelta_2'
                  ? 'bg-purple-50/90 dark:bg-purple-950/50 border-purple-400 ring-2 ring-purple-500/20'
                  : 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-900/50 hover:border-purple-300'
              }`}
            >
              {renderVueltaRing(
                vueltasAndWeeklyTasksData.vuelta2Pct,
                '#9333ea',
                'stroke-purple-100 dark:stroke-purple-950'
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-purple-900 dark:text-purple-300 block">
                  2ª Vuelta · Consolidación
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono-numbers">
                  {vueltasAndWeeklyTasksData.vuelta2Completed} /{' '}
                  {vueltasAndWeeklyTasksData.totalTopicsCount} temas
                </div>
                <div className="w-full h-1.5 bg-purple-100 dark:bg-purple-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{ width: `${vueltasAndWeeklyTasksData.vuelta2Pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 3ª+ Vuelta */}
            <div
              onClick={() =>
                setVueltasFilter(vueltasFilter === 'vuelta_3plus' ? 'all' : 'vuelta_3plus')
              }
              className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all ${
                vueltasFilter === 'vuelta_3plus'
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-400 ring-2 ring-emerald-500/20'
                  : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-300'
              }`}
            >
              {renderVueltaRing(
                vueltasAndWeeklyTasksData.vuelta3PlusPct,
                '#10b981',
                'stroke-emerald-100 dark:stroke-emerald-950'
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 block">
                  3ª+ Vuelta · Dominio Total
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono-numbers">
                  {vueltasAndWeeklyTasksData.vuelta3PlusCompleted} /{' '}
                  {vueltasAndWeeklyTasksData.totalTopicsCount} temas
                </div>
                <div className="w-full h-1.5 bg-emerald-100 dark:bg-emerald-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${vueltasAndWeeklyTasksData.vuelta3PlusPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Barras Visuales de Vueltas por Asignatura */}
          {vueltasAndWeeklyTasksData.subjectSummaries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vueltasAndWeeklyTasksData.subjectSummaries.map((item) => (
                <div
                  key={item.subject.id}
                  className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.subject.color || '#3b82f6' }}
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.subject.name}
                      </span>
                    </div>
                    {item.weeklyTasksCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                        📋 {item.weeklyTasksCount} tarea(s) sem.
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono-numbers text-slate-400">
                        {item.totalTopics} temas
                      </span>
                    )}
                  </div>

                  {/* 3 Mini Barras Horizontales Visuales (V1, V2, V3+) */}
                  <div className="space-y-1.5 text-[10px] font-mono-numbers">
                    <div className="flex items-center gap-2">
                      <span className="w-8 font-bold text-blue-700 dark:text-blue-400">1ª V.</span>
                      <div className="flex-1 h-2 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${item.vuelta1Pct}%` }}
                        />
                      </div>
                      <span className="w-9 text-right font-bold text-slate-700 dark:text-slate-300">
                        {item.vuelta1Pct}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-8 font-bold text-purple-700 dark:text-purple-400">2ª V.</span>
                      <div className="flex-1 h-2 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full transition-all"
                          style={{ width: `${item.vuelta2Pct}%` }}
                        />
                      </div>
                      <span className="w-9 text-right font-bold text-slate-700 dark:text-slate-300">
                        {item.vuelta2Pct}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-8 font-bold text-emerald-700 dark:text-emerald-400">3ª+</span>
                      <div className="flex-1 h-2 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${item.vuelta3PlusPct}%` }}
                        />
                      </div>
                      <span className="w-9 text-right font-bold text-slate-700 dark:text-slate-300">
                        {item.vuelta3PlusPct}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filtros Visuales + Tarjetas de Temas con Indicador de Vuelta por Puntos */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    {
                      id: 'all',
                      label: `Todos (${vueltasAndWeeklyTasksData.totalTopicsCount})`,
                    },
                    {
                      id: 'weekly_task',
                      label: `📋 Tareas de esta Semana (${vueltasAndWeeklyTasksData.topicWeeklyTaskLookup.size})`,
                    },
                    { id: 'vuelta_0', label: '0 Vueltas' },
                    { id: 'vuelta_1', label: '1ª Vuelta' },
                    { id: 'vuelta_2', label: '2ª Vuelta' },
                    { id: 'vuelta_3plus', label: '3ª+ Vuelta' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setVueltasFilter(f.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      vueltasFilter === f.id
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {vueltasAndWeeklyTasksData.allTopicItems
                .filter((item) => {
                  if (vueltasFilter === 'weekly_task') return Boolean(item.weeklyTaskInfo);
                  if (vueltasFilter === 'vuelta_0') return item.vueltas === 0;
                  if (vueltasFilter === 'vuelta_1') return item.vueltas === 1;
                  if (vueltasFilter === 'vuelta_2') return item.vueltas === 2;
                  if (vueltasFilter === 'vuelta_3plus') return item.vueltas >= 3;
                  return true;
                })
                .map(({ subject, topic, vueltas, weeklyTaskInfo }) => (
                  <div
                    key={`${subject.id}-${topic.id}`}
                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                      weeklyTaskInfo
                        ? 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: subject.color || '#3b82f6' }}
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
                            {subject.name}
                          </span>
                        </div>

                        {/* Indicador Visual de 3 Segmentos de Vuelta */}
                        <div className="flex items-center gap-1 shrink-0" title={`${vueltas} vueltas completadas`}>
                          {[1, 2, 3].map((step) => (
                            <span
                              key={step}
                              className={`w-3.5 h-1.5 rounded-full transition-colors ${
                                vueltas >= step
                                  ? step === 1
                                    ? 'bg-blue-600'
                                    : step === 2
                                    ? 'bg-purple-600'
                                    : 'bg-emerald-500'
                                  : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            />
                          ))}
                          <span className="text-[10px] font-mono-numbers font-extrabold text-slate-700 dark:text-slate-300 ml-0.5">
                            {vueltas}V
                          </span>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {topic.title}
                      </div>

                      {weeklyTaskInfo ? (
                        <div className="px-2 py-1 rounded-lg bg-amber-100/80 dark:bg-amber-950/60 text-[10px] font-bold text-amber-900 dark:text-amber-200 truncate">
                          📋 Tarea: {weeklyTaskInfo.task.title} ({formatReadableDate(weeklyTaskInfo.task.dueDate)})
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-mono-numbers">
                          {topic.nextReviewDate
                            ? `Próx. repaso: ${formatReadableDate(topic.nextReviewDate)}`
                            : topic.scheduledDate
                            ? `Programado: ${formatReadableDate(topic.scheduledDate)}`
                            : 'Pendiente de programar'}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[10px] font-semibold text-slate-500">
                        {vueltas === 0 ? 'Sin iniciar' : `${vueltas}ª Vuelta completada`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={vueltas === 0}
                          onClick={() => handleUpdateTopicVueltas(subject.id, topic.id, vueltas - 1)}
                          className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                          title="Restar 1 vuelta"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateTopicVueltas(subject.id, topic.id, vueltas + 1)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          +1 Vuelta
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Planificador de Disponibilidad Semanal (desplegable bajo demanda) */}
      {showAvailabilityPlanner && onUpdatePreferences && (
        <WeeklyAvailabilityPlanner
          obligations={preferences.weeklyFixedObligations || []}
          onUpdateObligations={(updatedObs) => {
            onUpdatePreferences({
              ...preferences,
              weeklyFixedObligations: updatedObs,
            });
          }}
          hoursPerDay={preferences.hoursPerDay}
          onApplyCalculatedHours={(calculatedHours) => {
            const activeDays = Object.entries(calculatedHours)
              .filter(([_, h]) => h > 0)
              .map(([d]) => Number(d));
            onUpdatePreferences({
              ...preferences,
              hoursPerDay: calculatedHours,
              availableDays: activeDays.length > 0 ? activeDays : preferences.availableDays,
            });
          }}
        />
      )}

      {/* Notificación de confirmación al mover o recalcular */}
      {rescheduledNotice && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{rescheduledNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setRescheduledNotice(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:underline text-[11px] font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 3. BARRA UNIFICADA DE CONTROLES DEL CALENDARIO */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Selector de Vista: Semanal, Mes, Día, Año */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setCalendarView('weekly')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                calendarView === 'weekly'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setCalendarView('monthly')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                calendarView === 'monthly'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setCalendarView('daily')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                calendarView === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Día
            </button>
            <button
              onClick={() => setCalendarView('yearly')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                calendarView === 'yearly'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Año
            </button>
          </div>

          {/* Navegación de Fechas */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
            >
              Hoy
            </button>
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
              <button
                onClick={handlePrev}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 px-3 whitespace-nowrap min-w-[140px] text-center">
                {calendarView === 'yearly' && `Año ${currentYear}`}
                {calendarView === 'monthly' && `${monthNames[currentMonth]} ${currentYear}`}
                {calendarView === 'weekly' &&
                  `Semana del ${new Date(weekDates[0]).getDate()} de ${
                    monthNames[new Date(weekDates[0]).getMonth()]
                  }`}
                {calendarView === 'daily' &&
                  `${currentDate.toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}`}
              </span>
              <button
                onClick={handleNext}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Herramientas de Vista y Drag & Drop */}
          <div className="flex flex-wrap items-center gap-2">
            {(calendarView === 'weekly' || calendarView === 'daily') && (
              <button
                onClick={() => setTimeBlockMode(!timeBlockMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  timeBlockMode
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Por Horas</span>
              </button>
            )}

            {calendarView === 'weekly' && (
              <button
                type="button"
                onClick={() => setShowDraggableTray(!showDraggableTray)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  showDraggableTray
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                <GripVertical className="w-3.5 h-3.5" />
                <span>Bandeja Temas/Tareas</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openAddTopicSlotModalForDate(selectedDayStr)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Elegir y añadir un tema de estudio en un hueco libre de este día"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Tema en Hueco</span>
            </button>

            <button
              type="button"
              onClick={handleFindFreeSlotsForAllReviews}
              className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              title="Asignar horas libres automáticamente a los repasos de la semana"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Ubicar Repasos</span>
            </button>
          </div>
        </div>

        {/* Filtro Rápido de Capas Visuales */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Todo (Plan + Repasos + Tareas)' },
              { id: 'estudio', label: '📖 Estudio' },
              { id: 'repaso', label: '🧠 Repasos (R1–R5)' },
              { id: 'examenes_tareas', label: '🎯 Exámenes y Tareas' },
            ].map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => setCalendarLayerFilter(layer.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  calendarLayerFilter === layer.id
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {layer.label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeUnstartedProjections}
              onChange={(e) => setIncludeUnstartedProjections(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Proyectar repasos futuros</span>
          </label>
        </div>
      </div>

      {/* VIEW 1: MONTHLY UNIFIED CALENDAR + RIGHT/BOTTOM DAY INSPECTOR */}
      {calendarView === 'monthly' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Monthly Grid (8 cols on lg) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            {/* Monthly View Action Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Calendario Mensual · {monthNames[currentMonth]} {currentYear}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  (Arrastra cualquier tema, repaso, tarea o cita sobre otro día para moverlo)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBlockedDate(selectedDayStr);
                    setBlockedModalMode('on_the_fly');
                    setShowAddBlockedModal(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold cursor-pointer"
                >
                  + Plan en {selectedDayStr.slice(5)}
                </button>
                <button
                  type="button"
                  onClick={() => handleRecalculateTopicsAndReviews({ preserveManualPins: true })}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Recalcular Temas y Repasos</span>
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center text-xs font-bold text-slate-600 dark:text-slate-300 py-2.5">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {daysGrid.map((day) => {
                const sessions = showStudyLayer ? sessionsByDate[day.dateStr] || [] : [];
                const daySR = showRepasoLayer ? srReviewsByDate[day.dateStr] || [] : [];
                const dayTasks = showExamsTasksLayer ? tasksByDate[day.dateStr] || [] : [];
                const dayExams = showExamsTasksLayer ? examsByDate[day.dateStr] || [] : [];
                const dayBlocked = getEffectiveBlockedForDate(day.dateStr);
                const pendingDayTasks = dayTasks.filter((t) => !t.task.completed);
                const isSelected = selectedDayStr === day.dateStr;
                const isDropTarget = dragOverSlot === `month-${day.dateStr}`;

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => {
                      setSelectedDayStr(day.dateStr);
                      setCurrentDate(parseLocalDate(day.dateStr));
                    }}
                    onDragOver={(e) => {
                      if (!draggedItem && !draggedReview) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverSlot !== `month-${day.dateStr}`) {
                        setDragOverSlot(`month-${day.dateStr}`);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverSlot === `month-${day.dateStr}`) {
                        setDragOverSlot(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverSlot(null);
                      handleDropCalendarItem(day.dateStr);
                    }}
                    className={`p-2 min-h-[125px] cursor-pointer transition-colors flex flex-col justify-between ${
                      isDropTarget
                        ? 'bg-indigo-100/80 dark:bg-indigo-950/70 ring-2 ring-inset ring-indigo-500'
                        : isSelected
                        ? 'bg-blue-50/50 dark:bg-indigo-950/40 ring-2 ring-blue-500/40'
                        : day.isCurrentMonth
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        : 'bg-slate-50/30 dark:bg-slate-900/30 opacity-45 hover:opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-mono-numbers font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                          day.isToday
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayStr(day.dateStr);
                          setBlockedDate(day.dateStr);
                          setBlockedModalMode('on_the_fly');
                          setShowAddBlockedModal(true);
                        }}
                        className="text-[10px] text-slate-400 hover:text-amber-600 font-bold px-1 rounded hover:bg-amber-50 cursor-pointer"
                        title="Añadir plan sobre la marcha en este día"
                      >
                        +
                      </button>
                    </div>

                    {/* Unified Day Content Badges (Draggable!) */}
                    <div className="mt-1 space-y-1 overflow-hidden">
                      {/* Exam badge */}
                      {dayExams.length > 0 && (
                        <div className="text-[10px] font-bold text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded truncate">
                          🎯 Examen ({dayExams[0].exam.examType})
                        </div>
                      )}

                      {/* Blocked events / Weekly routines badge (draggable) */}
                      {dayBlocked.slice(0, 1).map((b) => (
                        <div
                          key={b.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedItem({
                              kind: 'blocked_event',
                              eventId: b.id,
                              title: b.title,
                              sourceDateStr: day.dateStr,
                              sourceHourStr: b.startTime,
                              durationHours: b.durationHours,
                              isWeeklyObligation: b.isWeeklyObligation,
                              sourceObligationId: b.sourceObligationId,
                            });
                          }}
                          onDragEnd={() => {
                            setDraggedItem(null);
                            setDragOverSlot(null);
                          }}
                          className="text-[10px] font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing flex items-center justify-between gap-1"
                          title={`${b.isWeeklyObligation ? '🔁 Rutina semanal' : '🚫 Plan bloqueado'}: ${b.title} (${b.startTime}-${b.endTime}) · Arrastra para mover`}
                        >
                          <span className="truncate">
                            {b.isWeeklyObligation ? '🔁' : '🚫'} {b.title}
                          </span>
                          {dayBlocked.length > 1 && (
                            <span className="text-[9px] shrink-0">+{dayBlocked.length - 1}</span>
                          )}
                        </div>
                      ))}

                      {/* Smart Plan Study Topics (draggable pills) */}
                      {sessions.slice(0, 2).map((sess) => (
                        <div
                          key={sess.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedItem({
                              kind: 'topic_session',
                              subjectId: sess.subjectId,
                              topicId: sess.topicId,
                              topicTitle: sess.topicTitle,
                              subjectName: sess.subjectName,
                              sourceDateStr: day.dateStr,
                              sourceHourStr: sess.startTime,
                              durationHours: sess.durationHours,
                            });
                          }}
                          onDragEnd={() => {
                            setDraggedItem(null);
                            setDragOverSlot(null);
                          }}
                          className="text-[10px] font-semibold text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800 px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing flex items-center gap-1"
                          title={`Arrastra este tema a otro día: ${sess.subjectName} · ${sess.topicTitle}`}
                        >
                          <span className="shrink-0">📖</span>
                          <span className="truncate">{sess.topicTitle}</span>
                        </div>
                      ))}
                      {sessions.length > 2 && (
                        <div className="text-[9px] font-bold text-blue-600 pl-1">
                          +{sessions.length - 2} tema(s) más
                        </div>
                      )}

                      {/* Spaced Repetition SM-2 Milestones (draggable pills) */}
                      {daySR.slice(0, 2).map(({ analysis, milestone }) => {
                        const pillClass =
                          milestone.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : milestone.status === 'overdue' ||
                              milestone.status === 'due_today'
                            ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 font-bold'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800';

                        return (
                          <div
                            key={`${analysis.topic.id}-${milestone.cycle}`}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.effectAllowed = 'move';
                              const itemPayload: DraggedCalendarItem = {
                                kind: 'spaced_review',
                                subjectId: analysis.subject.id,
                                topicId: analysis.topic.id,
                                cycle: milestone.cycle,
                                sourceDateStr: day.dateStr,
                                topicTitle: analysis.topic.title,
                                subjectName: analysis.subject.name,
                                label: milestone.label,
                              };
                              setDraggedItem(itemPayload);
                              setDraggedReview(itemPayload);
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDraggedReview(null);
                              setDragOverSlot(null);
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded border truncate flex items-center gap-1 cursor-grab active:cursor-grabbing ${pillClass}`}
                            title={`Repaso Espaciado ${milestone.label}: ${analysis.topic.title} (${analysis.studiedPages}/${analysis.totalPages} págs. leídas)`}
                          >
                            <span className="font-mono-numbers font-bold shrink-0">
                              🧠 R{milestone.cycle} ({milestone.intervalDays}d)
                            </span>
                            <span className="truncate">
                              {analysis.topic.title} ({analysis.studiedPages}p)
                            </span>
                          </div>
                        );
                      })}
                      {daySR.length > 2 && (
                        <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 pl-1 font-mono-numbers">
                          +{daySR.length - 2} repaso(s) más
                        </div>
                      )}

                      {/* Tasks (draggable pills) */}
                      {pendingDayTasks.slice(0, 1).map(({ task, subjectId, subjectName }) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedItem({
                              kind: 'task',
                              subjectId,
                              taskId: task.id,
                              taskTitle: task.title,
                              subjectName,
                              sourceDateStr: day.dateStr,
                              sourceHourStr: task.scheduledTime,
                            });
                          }}
                          onDragEnd={() => {
                            setDraggedItem(null);
                            setDragOverSlot(null);
                          }}
                          className="text-[10px] font-semibold text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-1.5 py-0.5 rounded truncate cursor-grab active:cursor-grabbing"
                          title={`Arrastra esta tarea a otro día: ${task.title}`}
                        >
                          ✓ {task.title}
                        </div>
                      ))}
                    </div>

                    {/* Hours summary */}
                    <div className="text-right pt-1">
                      {sessions.length > 0 && (
                        <span className="text-[10px] font-mono-numbers text-slate-400">
                          {Math.round(
                            sessions.reduce((acc, s) => acc + s.durationHours, 0) * 10
                          ) / 10}
                          h
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unified Selected Day Inspector (4 cols on lg) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                    Agenda Unificada del Día (Arrastrable)
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedDayStr === todayStr
                      ? `Hoy · ${formatReadableDate(selectedDayStr)}`
                      : formatReadableDate(selectedDayStr)}
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRecalculateTopicsAndReviews({ preserveManualPins: true })}
                    className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 cursor-pointer"
                    title="Recalcular temas y repasos"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarView('daily')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Por horas →
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
                {/* 1. Exámenes y Citas / Rutinas Bloqueadas del Día */}
                {selectedDayExams.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs"
                  >
                    <div className="font-bold text-rose-900 dark:text-rose-200">
                      🎯 Examen: {ex.exam.title}
                    </div>
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                      {ex.subjectName} · Convocatoria {ex.exam.examType}
                    </div>
                  </div>
                ))}

                {selectedDayBlocked.map((b) => (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedItem({
                        kind: 'blocked_event',
                        eventId: b.id,
                        title: b.title,
                        sourceDateStr: selectedDayStr,
                        sourceHourStr: b.startTime,
                        durationHours: b.durationHours,
                        isWeeklyObligation: b.isWeeklyObligation,
                        sourceObligationId: b.sourceObligationId,
                      });
                    }}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setDragOverSlot(null);
                    }}
                    className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs flex items-center justify-between cursor-grab active:cursor-grabbing"
                    title="Arrastra a otro día del calendario para mover este bloqueo"
                  >
                    <div>
                      <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                        <GripVertical className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          {b.isWeeklyObligation ? '🔁 Rutina Semanal:' : '🚫 Plan:'} {b.title}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-numbers text-amber-700 dark:text-amber-300 pl-4">
                        {b.startTime} - {b.endTime} ({b.durationHours}h)
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEffectiveBlockedItem(b)}
                      className="text-amber-500 hover:text-rose-600 cursor-pointer"
                      title="Eliminar bloqueo o rutina"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* 2. Bloques del Plan de Estudio Inteligente (Draggable + Editable Start Time) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Plan de Estudio ({selectedDayStudySessions.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => openAddTopicSlotModalForDate(selectedDayStr)}
                      className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      title="Añadir un tema adicional en un hueco libre de este día"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Añadir tema</span>
                    </button>
                  </div>
                  {selectedDayStudySessions.map((sess) => {
                    const effectiveStart = sess.startTime || '09:00';
                    const effectiveEnd =
                      sess.endTime || calculateAutoEndTime(effectiveStart, sess.durationHours);
                    const isExtraSession = sess.id.startsWith('sess-extra-');

                    return (
                      <div
                        key={sess.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedItem({
                            kind: 'topic_session',
                            subjectId: sess.subjectId,
                            topicId: sess.topicId,
                            topicTitle: sess.topicTitle,
                            subjectName: sess.subjectName,
                            sourceDateStr: selectedDayStr,
                            sourceHourStr: effectiveStart,
                            durationHours: sess.durationHours,
                          });
                        }}
                        onDragEnd={() => {
                          setDraggedItem(null);
                          setDragOverSlot(null);
                        }}
                        className="p-3 rounded-xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/40 dark:bg-blue-950/20 text-xs space-y-2 cursor-grab active:cursor-grabbing"
                        title="Cambia la hora de inicio o arrastra este tema a otra casilla"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate inline-flex items-center gap-1">
                            <GripVertical className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            {sess.subjectName}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono-numbers text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
                              {sess.durationHours}h
                            </span>
                            {isExtraSession && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveExtraTopicFromDay(
                                    sess.subjectId,
                                    sess.topicId,
                                    selectedDayStr
                                  )
                                }
                                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Quitar este tema extra del día"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {sess.topicTitle}
                        </div>

                        {/* Selector directo de Hora de Inicio con cálculo automático de Hora de Fin */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-wrap items-center justify-between gap-1.5 bg-white/90 dark:bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-blue-200/80 dark:border-blue-800/60"
                        >
                          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>Inicio:</span>
                            <input
                              type="time"
                              value={effectiveStart}
                              onChange={(e) => {
                                if (!e.target.value) return;
                                handleChangeTopicSessionStartTime(
                                  sess.subjectId,
                                  sess.topicId,
                                  selectedDayStr,
                                  e.target.value,
                                  sess.durationHours
                                );
                              }}
                              className="bg-blue-50 dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded px-1.5 py-0.5 text-[11px] font-mono-numbers font-bold text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>
                          <span className="text-[10px] font-mono-numbers font-semibold text-slate-600 dark:text-slate-400">
                            → Fin: <strong className="text-blue-700 dark:text-blue-300">{effectiveEnd}</strong>
                          </span>
                        </div>

                        {sess.pagesAllocation && (
                          <div className="text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1 font-mono-numbers">
                            <FileText className="w-3 h-3 shrink-0" />
                            <span>{sess.pagesAllocation}</span>
                          </div>
                        )}
                        {onStartPomodoro && (
                          <button
                            type="button"
                            onClick={() => onStartPomodoro(sess.subjectId, sess.topicId)}
                            className="w-full mt-1 py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>Iniciar Pomodoro de Estudio</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3. Repasos Espaciados SM-2 / Ebbinghaus del Día (Draggable) */}
                {selectedDaySRReviews.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      <span>Repasos Espaciados SM-2 ({selectedDaySRReviews.length})</span>
                    </span>
                    {selectedDaySRReviews.map(({ analysis, milestone }) => {
                      const { subject, topic } = analysis;
                      const isCompleted = milestone.status === 'completed';
                      const isOverdue = milestone.status === 'overdue';

                      return (
                        <div
                          key={`${topic.id}-${milestone.cycle}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            const payload: DraggedCalendarItem = {
                              kind: 'spaced_review',
                              subjectId: subject.id,
                              topicId: topic.id,
                              cycle: milestone.cycle,
                              sourceDateStr: selectedDayStr,
                              topicTitle: topic.title,
                              subjectName: subject.name,
                              label: milestone.label,
                            };
                            setDraggedItem(payload);
                            setDraggedReview(payload);
                          }}
                          onDragEnd={() => {
                            setDraggedItem(null);
                            setDraggedReview(null);
                            setDragOverSlot(null);
                          }}
                          className={`p-3 rounded-xl border transition-all space-y-2.5 cursor-grab active:cursor-grabbing ${
                            isCompleted
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                              : isOverdue
                              ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/70'
                              : 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/70'
                          }`}
                          title="Arrastra este repaso a otro día del calendario mensual"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <GripVertical className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: subject.color || '#6366f1' }}
                                />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                                  {subject.name}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono-numbers">
                                  {milestone.label}
                                </span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-mono-numbers">
                                  {analysis.studiedPages}/{analysis.totalPages} págs. leídas
                                </span>
                              </div>
                              <h5 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                {topic.title}
                              </h5>
                            </div>

                            {analysis.hasStudyHistory && (
                              <div className="text-right shrink-0">
                                <span className="text-xs font-bold font-mono-numbers text-indigo-600 dark:text-indigo-400">
                                  {analysis.retentionPct}%
                                </span>
                                <span className="block text-[9px] text-slate-400">retención</span>
                              </div>
                            )}
                          </div>

                          {!isCompleted ? (
                            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Evaluar Repaso (SM-2):
                                </span>
                                {onStartPomodoro && (
                                  <button
                                    type="button"
                                    onClick={() => onStartPomodoro(subject.id, topic.id)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>Pomodoro</span>
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleRecordReview(analysis, 'repetir')}
                                  className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                                >
                                  Repetir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRecordReview(analysis, 'dificil')}
                                  className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                                >
                                  Difícil
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRecordReview(analysis, 'bien')}
                                  className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                                >
                                  Bien
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRecordReview(analysis, 'facil')}
                                  className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                                >
                                  Fácil
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="pt-1 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                              <span className="inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Repaso completado (
                                {milestone.quality || 'bien'})
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. Tareas del Día (Draggable) */}
                {selectedDayTasks.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Tareas y Entregas ({selectedDayTasks.length})
                    </span>
                    {selectedDayTasks.map(({ task, subjectId, subjectName }) => (
                      <label
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedItem({
                            kind: 'task',
                            subjectId,
                            taskId: task.id,
                            taskTitle: task.title,
                            subjectName,
                            sourceDateStr: selectedDayStr,
                            sourceHourStr: task.scheduledTime,
                          });
                        }}
                        onDragEnd={() => {
                          setDraggedItem(null);
                          setDragOverSlot(null);
                        }}
                        className="flex items-start gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-grab active:cursor-grabbing text-xs"
                        title="Arrastra esta tarea a otro día del calendario mensual"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={(e) =>
                            onToggleTask?.(subjectId, task.id, e.target.checked)
                          }
                          className="mt-0.5 w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
                        />
                        <div>
                          <span
                            className={`font-semibold block ${
                              task.completed
                                ? 'line-through text-slate-400'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {subjectName}
                            {task.scheduledTime ? ` · 🕒 ${task.scheduledTime}` : ''}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {selectedDayStudySessions.length === 0 &&
                  selectedDaySRReviews.length === 0 &&
                  selectedDayTasks.length === 0 &&
                  selectedDayExams.length === 0 &&
                  selectedDayBlocked.length === 0 && (
                    <div className="py-10 text-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <CalendarIcon className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Día libre en esta fecha
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Arrastra aquí un tema, repaso o tarea desde otro día, o añade un plan sobre la marcha.
                      </p>
                    </div>
                  )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Drag & Drop Activo:
                </span>{' '}
                Arrastra cualquier tarjeta (tema, repaso R1–R5, tarea o plan) hacia cualquier día del calendario para reprogramarlo al instante.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: WEEKLY UNIFIED CALENDAR */}
      {calendarView === 'weekly' && (
        <div className="space-y-4">
          {/* Bandeja Interactiva de Temas y Tareas para Arrastrar a Bloques de Tiempo */}
          {showDraggableTray && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-200/80 dark:border-indigo-900/60 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-extrabold uppercase tracking-wider">
                    Drag & Drop a Bloques Horarios
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Arrastra cualquier tema o tarea hacia una casilla de hora (08:00–21:00) o muévelos entre bloques
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Al soltar en un bloque horario se actualiza <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">blockedEvents</code> automáticamente
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Draggable Study Topics List */}
                <div className="p-3 rounded-xl bg-blue-50/40 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-300">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>Temas de Estudio Arrastrables</span>
                    </span>
                    <span className="text-[10px] text-blue-700 dark:text-blue-400 font-mono-numbers">
                      {relevantSubjects.reduce((acc, s) => acc + s.topics.length, 0)} temas
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
                    {relevantSubjects.flatMap((sub) =>
                      sub.topics.map((top) => {
                        const syncedBlock = blockedEvents.find(
                          (b) =>
                            b.id === `block-topic-${top.id}` ||
                            (b.linkedTopicId === top.id && b.linkedItemType === 'topic')
                        );
                        const scheduledDateLabel = syncedBlock?.date || top.scheduledDate;
                        const scheduledHourLabel = syncedBlock?.startTime || top.scheduledTime;

                        return (
                          <div
                            key={`tray-top-${top.id}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedItem({
                                kind: 'topic_session',
                                subjectId: sub.id,
                                topicId: top.id,
                                title: top.title,
                                topicTitle: top.title,
                                subjectName: sub.name,
                                sourceDateStr: scheduledDateLabel || selectedDayStr,
                                sourceHourStr: scheduledHourLabel,
                                durationHours: Math.max(1, Math.min(2, Math.round(top.estimatedHours || 1))),
                              });
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverSlot(null);
                            }}
                            className="shrink-0 max-w-[230px] p-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 hover:border-blue-400 shadow-2xs cursor-grab active:cursor-grabbing space-y-1 transition-all"
                            title={`Arrastra "${top.title}" (${sub.name}) a cualquier bloque de tiempo de la semana`}
                          >
                            <div className="flex items-center justify-between gap-1.5 text-[10px]">
                              <span className="font-bold text-blue-700 dark:text-blue-300 truncate inline-flex items-center gap-1">
                                <GripVertical className="w-3 h-3 text-blue-400 shrink-0" />
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: sub.color || '#3b82f6' }}
                                />
                                <span className="truncate">{sub.name}</span>
                              </span>
                              {syncedBlock && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono-numbers text-[9px] font-bold shrink-0">
                                  🔒 {syncedBlock.startTime}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                              📖 {top.title}
                            </div>
                            <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono-numbers flex items-center justify-between">
                              <span>
                                {scheduledDateLabel
                                  ? `${scheduledDateLabel.slice(5)}${scheduledHourLabel ? ` · ${scheduledHourLabel}` : ''}`
                                  : 'Sin bloque fijo'}
                              </span>
                              <span>{top.estimatedHours || 1}h</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {relevantSubjects.every((s) => s.topics.length === 0) && (
                      <span className="text-xs text-slate-400 py-2">
                        No hay temas creados en las asignaturas seleccionadas.
                      </span>
                    )}
                  </div>
                </div>

                {/* Draggable Tasks List */}
                <div className="p-3 rounded-xl bg-teal-50/40 dark:bg-slate-800/60 border border-teal-100 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-teal-900 dark:text-teal-300">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>Tareas y Entregas Arrastrables</span>
                    </span>
                    <span className="text-[10px] text-teal-700 dark:text-teal-400 font-mono-numbers">
                      {relevantSubjects.reduce((acc, s) => acc + s.tasks.length, 0)} tareas
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
                    {relevantSubjects.flatMap((sub) =>
                      sub.tasks.map((tk) => {
                        const syncedTaskBlock = blockedEvents.find(
                          (b) => b.id === `block-task-${tk.id}` || b.linkedTaskId === tk.id
                        );
                        const taskHour = syncedTaskBlock?.startTime || tk.scheduledTime || tk.startTime;
                        return (
                          <div
                            key={`tray-task-${tk.id}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedItem({
                                kind: 'task',
                                subjectId: sub.id,
                                taskId: tk.id,
                                title: tk.title,
                                taskTitle: tk.title,
                                subjectName: sub.name,
                                sourceDateStr: tk.dueDate || selectedDayStr,
                                sourceHourStr: taskHour,
                              });
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverSlot(null);
                            }}
                            className="shrink-0 max-w-[230px] p-2 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 hover:border-teal-400 shadow-2xs cursor-grab active:cursor-grabbing space-y-1 transition-all"
                            title={`Arrastra la tarea "${tk.title}" (${sub.name}) a cualquier bloque de tiempo de la semana`}
                          >
                            <div className="flex items-center justify-between gap-1.5 text-[10px]">
                              <span className="font-bold text-teal-700 dark:text-teal-300 truncate inline-flex items-center gap-1">
                                <GripVertical className="w-3 h-3 text-teal-400 shrink-0" />
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: sub.color || '#14b8a6' }}
                                />
                                <span className="truncate">{sub.name}</span>
                              </span>
                              {syncedTaskBlock && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono-numbers text-[9px] font-bold shrink-0">
                                  🔒 {syncedTaskBlock.startTime}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                              ✓ {tk.title}
                            </div>
                            <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono-numbers flex items-center justify-between">
                              <span>
                                {tk.dueDate
                                  ? `${tk.dueDate.slice(5)}${taskHour ? ` · ${taskHour}` : ''}`
                                  : 'Sin fecha'}
                              </span>
                              <span className="uppercase">{tk.priority}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {relevantSubjects.every((s) => s.tasks.length === 0) && (
                      <span className="text-xs text-slate-400 py-2">
                        No hay tareas pendientes en las asignaturas seleccionadas.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {timeBlockMode ? (
            /* WEEKLY TIME BLOCKING TIMELINE VIEW + SPACED REPETITION ROW */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-x-auto">
              <div className="min-w-[880px]">
                {/* Header with week days (Also drop targets for moving to a day) */}
                <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs">
                  <div className="p-3 text-slate-400 font-bold text-center border-r border-slate-200 dark:border-slate-800">
                    Hora / Día
                  </div>
                  {weekDates.map((dateStr) => {
                    const d = parseLocalDate(dateStr);
                    const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
                    const isToday = dateStr === todayStr;
                    const sessions = showStudyLayer ? sessionsByDate[dateStr] || [] : [];
                    const srList = showRepasoLayer ? srReviewsByDate[dateStr] || [] : [];
                    const blocked = getEffectiveBlockedForDate(dateStr);
                    const totalStudyHours =
                      Math.round(
                        sessions.reduce((acc, s) => acc + s.durationHours, 0) * 10
                      ) / 10;
                    const isHeaderDrop = dragOverSlot === `weekheader-${dateStr}`;

                    return (
                      <div
                        key={dateStr}
                        onClick={() => {
                          setSelectedDayStr(dateStr);
                          setCurrentDate(parseLocalDate(dateStr));
                        }}
                        onDragOver={(e) => {
                          if (!draggedItem && !draggedReview) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverSlot !== `weekheader-${dateStr}`) {
                            setDragOverSlot(`weekheader-${dateStr}`);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverSlot === `weekheader-${dateStr}`) {
                            setDragOverSlot(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSlot(null);
                          handleDropCalendarItem(dateStr);
                        }}
                        className={`p-3 text-center cursor-pointer transition-colors border-r border-slate-200 dark:border-slate-800 last:border-r-0 ${
                          isHeaderDrop
                            ? 'bg-indigo-100 dark:bg-indigo-950/70 ring-2 ring-inset ring-indigo-500'
                            : isToday
                            ? 'bg-blue-50/70 dark:bg-blue-950/30 font-bold'
                            : ''
                        }`}
                      >
                        <div className="uppercase text-[10px] tracking-wider text-slate-500 font-bold">
                          {dayName}
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white font-mono-numbers mt-0.5">
                          {d.getDate()}
                        </div>
                        <div className="flex items-center justify-center flex-wrap gap-1.5 mt-1 text-[10px] text-slate-400">
                          {totalStudyHours > 0 && (
                            <span className="text-blue-700 dark:text-blue-400 font-semibold">
                              {totalStudyHours}h
                            </span>
                          )}
                          {srList.length > 0 && (
                            <span className="text-indigo-700 dark:text-indigo-400 font-semibold">
                              🧠 {srList.length}
                            </span>
                          )}
                          {blocked.length > 0 && (
                            <span className="text-amber-700 font-semibold">
                              🚫 {blocked.length}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dedicated Spaced Repetition SM-2 Row + Tasks at the Top of the Weekly Grid */}
                {(showRepasoLayer || showExamsTasksLayer) && (
                  <div className="grid grid-cols-8 border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20">
                    <div className="p-2.5 text-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      <span>Repasos y Tareas</span>
                      <span className="text-[9px] font-normal text-indigo-600/80 dark:text-indigo-300/80 leading-tight">
                        Arrastra a cualquier día u hora
                      </span>
                      <button
                        type="button"
                        onClick={handleFindFreeSlotsForAllReviews}
                        className="mt-0.5 px-2 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-bold text-[9px] inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Wand2 className="w-2.5 h-2.5" />
                        <span>Buscar hueco</span>
                      </button>
                    </div>
                    {weekDates.map((dateStr) => {
                      const srList = showRepasoLayer ? srReviewsByDate[dateStr] || [] : [];
                      const dayTasks = showExamsTasksLayer ? tasksByDate[dateStr] || [] : [];
                      return (
                        <div
                          key={dateStr}
                          onDragOver={(e) => {
                            if (!draggedItem && !draggedReview) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverSlot(null);
                            handleDropCalendarItem(dateStr);
                          }}
                          className="p-1.5 border-r border-slate-100 dark:border-slate-800 last:border-r-0 space-y-1.5"
                        >
                          {srList.map(({ analysis, milestone }) => {
                            const scheduledHour = getReviewScheduledTime(
                              analysis.topic,
                              dateStr
                            );
                            return (
                              <div
                                key={`${analysis.topic.id}-${milestone.cycle}`}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move';
                                  const payload: DraggedCalendarItem = {
                                    kind: 'spaced_review',
                                    subjectId: analysis.subject.id,
                                    topicId: analysis.topic.id,
                                    cycle: milestone.cycle,
                                    sourceDateStr: dateStr,
                                    topicTitle: analysis.topic.title,
                                    subjectName: analysis.subject.name,
                                    label: milestone.label,
                                  };
                                  setDraggedItem(payload);
                                  setDraggedReview(payload);
                                }}
                                onDragEnd={() => {
                                  setDraggedItem(null);
                                  setDraggedReview(null);
                                  setDragOverSlot(null);
                                }}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 text-[10px] shadow-2xs space-y-1 cursor-grab active:cursor-grabbing transition-all"
                                title="Arrastra este repaso a otro día o a una hora concreta del calendario inferior"
                              >
                                <div className="flex items-center justify-between gap-1 font-mono-numbers">
                                  <span className="font-bold text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-0.5">
                                    <GripVertical className="w-3 h-3 text-indigo-400 shrink-0" />
                                    {milestone.label}
                                  </span>
                                  {milestone.status !== 'completed' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRecordReview(analysis, 'bien')}
                                      className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[9px] hover:bg-emerald-700 cursor-pointer"
                                    >
                                      ✓ Hecho
                                    </button>
                                  ) : (
                                    <span className="text-emerald-600 font-bold">✓</span>
                                  )}
                                </div>
                                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {analysis.topic.title}
                                </div>
                                <div className="flex items-center justify-between gap-1 pt-0.5">
                                  <select
                                    value={scheduledHour || ''}
                                    onChange={(e) =>
                                      handleAssignReviewToTimeSlot(
                                        analysis.subject.id,
                                        analysis.topic.id,
                                        dateStr,
                                        e.target.value || undefined
                                      )
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[9px] bg-indigo-50 dark:bg-slate-800 text-indigo-800 dark:text-indigo-300 rounded px-1 py-0.5 border border-indigo-200 dark:border-slate-700 font-mono-numbers focus:outline-none w-full"
                                  >
                                    <option value="">Sin hora</option>
                                    {timelineHours.map((h) => {
                                      const hLabel = `${String(h).padStart(2, '0')}:00`;
                                      return (
                                        <option key={h} value={hLabel}>
                                          🕒 {hLabel}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {!scheduledHour && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFindFreeSlotForSingleReview(analysis, dateStr);
                                      }}
                                      className="px-1 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[9px] shrink-0 cursor-pointer"
                                    >
                                      ⚡
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Tasks in top row (draggable to any day or hour) */}
                          {dayTasks.map(({ task, subjectId, subjectName }) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedItem({
                                  kind: 'task',
                                  subjectId,
                                  taskId: task.id,
                                  taskTitle: task.title,
                                  subjectName,
                                  sourceDateStr: dateStr,
                                  sourceHourStr: task.scheduledTime || task.startTime,
                                });
                              }}
                              onDragEnd={() => {
                                setDraggedItem(null);
                                setDragOverSlot(null);
                              }}
                              className="p-1.5 rounded-lg bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-[10px] space-y-0.5 cursor-grab active:cursor-grabbing"
                              title="Arrastra esta tarea a otro día o a una hora concreta inferior"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-teal-800 dark:text-teal-200 inline-flex items-center gap-0.5 truncate">
                                  <GripVertical className="w-2.5 h-2.5 text-teal-500 shrink-0" />
                                  ✓ Tarea
                                </span>
                                {(task.scheduledTime || task.startTime) && (
                                  <span className="font-mono-numbers text-[9px] text-teal-700">
                                    {task.scheduledTime || task.startTime}
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {task.title}
                              </div>
                            </div>
                          ))}

                          {srList.length === 0 && dayTasks.length === 0 && (
                            <span className="text-[10px] text-slate-400 block text-center py-2">
                              —
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Vertical time rows (Universal Drop targets for Topics, Reviews, Tasks & Blocked Plans) */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {timelineHours.map((hour) => {
                    const hourStr = `${hour.toString().padStart(2, '0')}:00`;

                    return (
                      <div key={hour} className="grid grid-cols-8 min-h-[70px]">
                        <div className="p-2.5 text-center text-[11px] font-mono-numbers font-medium text-slate-400 border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30">
                          {hourStr}
                        </div>

                        {weekDates.map((dateStr) => {
                          const slotKey = `${dateStr}-${hour}`;
                          const isDragOver = dragOverSlot === slotKey;

                          const sessions = showStudyLayer
                            ? sessionsByDate[dateStr] || []
                            : [];
                          const blocked = getEffectiveBlockedForDate(dateStr);
                          const dayReviewsAtHour = showRepasoLayer
                            ? (srReviewsByDate[dateStr] || []).filter(({ analysis }) => {
                                const revTime = getReviewScheduledTime(
                                  analysis.topic,
                                  dateStr
                                );
                                if (!revTime) return false;
                                return parseInt(revTime.split(':')[0], 10) === hour;
                              })
                            : [];
                          const dayTasksAtHour = showExamsTasksLayer
                            ? (tasksByDate[dateStr] || []).filter(({ task }) => {
                                const taskTime = task.scheduledTime || task.startTime;
                                if (!taskTime) return false;
                                return parseInt(taskTime.split(':')[0], 10) === hour;
                              })
                            : [];

                          const currentSessionsAtHour = sessions.filter((s) => {
                            if (!s.startTime) return false;
                            const sHour = parseInt(s.startTime.split(':')[0], 10);
                            return sHour === hour;
                          });

                          // Filter out blocked events that are already rendered in this exact cell as a Topic Session, Task, or Review
                          const currentBlockedList = blocked.filter((b) => {
                            const sH = parseInt(b.startTime.split(':')[0], 10);
                            const eH = parseInt(b.endTime.split(':')[0], 10);
                            const inHourRange = hour >= sH && hour < Math.max(sH + 1, eH);
                            if (!inHourRange) return false;

                            const renderedAsSession = currentSessionsAtHour.some(
                              (s) =>
                                b.linkedTopicId === s.topicId ||
                                b.id === `block-topic-${s.topicId}`
                            );
                            if (renderedAsSession) return false;

                            const renderedAsTask = dayTasksAtHour.some(
                              ({ task }) =>
                                b.linkedTaskId === task.id ||
                                b.id === `block-task-${task.id}`
                            );
                            if (renderedAsTask) return false;

                            const renderedAsReview = dayReviewsAtHour.some(
                              ({ analysis }) =>
                                (b.linkedTopicId === analysis.topic.id &&
                                  b.linkedItemType === 'review') ||
                                b.id === `block-review-${analysis.topic.id}`
                            );
                            if (renderedAsReview) return false;

                            return true;
                          });

                          return (
                            <div
                              key={dateStr}
                              onDragOver={(e) => {
                                if (!draggedItem && !draggedReview) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverSlot !== slotKey) {
                                  setDragOverSlot(slotKey);
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverSlot === slotKey) {
                                  setDragOverSlot(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOverSlot(null);
                                handleDropCalendarItem(dateStr, hourStr);
                              }}
                              onClick={() => {
                                if (
                                  currentBlockedList.length === 0 &&
                                  currentSessionsAtHour.length === 0 &&
                                  dayReviewsAtHour.length === 0 &&
                                  dayTasksAtHour.length === 0
                                ) {
                                  setSelectedDayStr(dateStr);
                                  setBlockedDate(dateStr);
                                  setBlockedStartTime(hourStr);
                                  setBlockedEndTime(
                                    `${String(Math.min(23, hour + 1)).padStart(2, '0')}:00`
                                  );
                                  setBlockedModalMode('on_the_fly');
                                  setShowAddBlockedModal(true);
                                }
                              }}
                              className={`p-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0 relative transition-all space-y-1 group ${
                                isDragOver
                                  ? 'bg-indigo-100/70 dark:bg-indigo-950/60 ring-2 ring-inset ring-indigo-500'
                                  : 'hover:bg-slate-50/60 cursor-pointer'
                              }`}
                              title="Arrastra aquí un tema, repaso, tarea o plan, o haz clic en un hueco vacío para bloquear un plan sobre la marcha"
                            >
                              {isDragOver && (
                                <div className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 text-center py-1 border border-dashed border-indigo-400 rounded-lg bg-white/80 dark:bg-slate-900/80">
                                  Soltar a las {hourStr}
                                </div>
                              )}

                              {currentBlockedList.map((currentBlocked) => (
                                <div
                                  key={currentBlocked.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedItem({
                                      kind: 'blocked_event',
                                      eventId: currentBlocked.id,
                                      title: currentBlocked.title,
                                      sourceDateStr: dateStr,
                                      sourceHourStr: currentBlocked.startTime,
                                      durationHours: currentBlocked.durationHours,
                                      isWeeklyObligation: currentBlocked.isWeeklyObligation,
                                      sourceObligationId: currentBlocked.sourceObligationId,
                                    });
                                  }}
                                  onDragEnd={() => {
                                    setDraggedItem(null);
                                    setDragOverSlot(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`p-2 rounded-xl border text-xs shadow-2xs space-y-0.5 cursor-grab active:cursor-grabbing ${
                                    currentBlocked.isWeeklyObligation || currentBlocked.isRecurringWeekly
                                      ? 'bg-slate-100/95 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                                      : 'bg-amber-50/90 border-amber-200 text-amber-950'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className="truncate inline-flex items-center gap-0.5">
                                      <GripVertical className="w-3 h-3 opacity-60 shrink-0" />
                                      {currentBlocked.isWeeklyObligation || currentBlocked.isRecurringWeekly
                                        ? '🔁'
                                        : '🚫'}{' '}
                                      {currentBlocked.title}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEffectiveBlockedItem(currentBlocked);
                                      }}
                                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                      title="Eliminar bloqueo"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="text-[9px] font-mono-numbers opacity-80">
                                    {currentBlocked.startTime} - {currentBlocked.endTime}
                                  </div>
                                </div>
                              ))}

                              {currentSessionsAtHour.map((currentSession) => {
                                const effectiveStart = currentSession.startTime || hourStr;
                                const effectiveEnd =
                                  currentSession.endTime ||
                                  calculateAutoEndTime(effectiveStart, currentSession.durationHours);
                                const isExtraSession = currentSession.id.startsWith('sess-extra-');

                                return (
                                  <div
                                    key={currentSession.id}
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      e.dataTransfer.effectAllowed = 'move';
                                      setDraggedItem({
                                        kind: 'topic_session',
                                        subjectId: currentSession.subjectId,
                                        topicId: currentSession.topicId,
                                        topicTitle: currentSession.topicTitle,
                                        subjectName: currentSession.subjectName,
                                        sourceDateStr: dateStr,
                                        sourceHourStr: effectiveStart,
                                        durationHours: currentSession.durationHours,
                                      });
                                    }}
                                    onDragEnd={() => {
                                      setDraggedItem(null);
                                      setDragOverSlot(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`p-2 rounded-xl border text-xs shadow-2xs space-y-1 cursor-grab active:cursor-grabbing ${
                                      currentSession.type === 'repaso_espaciado'
                                        ? 'bg-purple-50/90 border-purple-200 text-purple-950'
                                        : 'bg-blue-50/90 border-blue-200 text-blue-950'
                                    }`}
                                    title="Arrastra este tema a otra hora o cambia su hora de inicio aquí"
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="font-bold truncate max-w-[85px] inline-flex items-center gap-0.5">
                                        <GripVertical className="w-3 h-3 text-blue-400 shrink-0" />
                                        {currentSession.subjectName}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono-numbers text-blue-700 font-semibold">
                                          {currentSession.durationHours}h
                                        </span>
                                        {isExtraSession && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveExtraTopicFromDay(
                                                currentSession.subjectId,
                                                currentSession.topicId,
                                                dateStr
                                              );
                                            }}
                                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                            title="Quitar tema extra de este hueco"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="font-semibold leading-tight line-clamp-1 text-[11px]">
                                      {currentSession.topicTitle}
                                    </div>
                                    <div className="flex items-center justify-between gap-1 bg-white/80 px-1.5 py-0.5 rounded border border-blue-200/70 text-[9px] font-mono-numbers">
                                      <input
                                        type="time"
                                        value={effectiveStart}
                                        onChange={(e) => {
                                          if (!e.target.value) return;
                                          handleChangeTopicSessionStartTime(
                                            currentSession.subjectId,
                                            currentSession.topicId,
                                            dateStr,
                                            e.target.value,
                                            currentSession.durationHours
                                          );
                                        }}
                                        className="bg-transparent font-bold text-blue-800 focus:outline-none cursor-pointer w-[54px]"
                                        title="Cambiar hora de inicio (fin se calcula solo)"
                                      />
                                      <span className="text-slate-600">→ {effectiveEnd}</span>
                                    </div>
                                    {currentSession.pagesAllocation && (
                                      <div className="text-[9px] text-blue-700 truncate">
                                        📖 {currentSession.pagesAllocation}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Spaced Repetition Reviews Placed at this Concrete Hour */}
                              {dayReviewsAtHour.map(({ analysis, milestone }) => (
                                <div
                                  key={`slot-${analysis.topic.id}-${milestone.cycle}`}
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.effectAllowed = 'move';
                                    const payload: DraggedCalendarItem = {
                                      kind: 'spaced_review',
                                      subjectId: analysis.subject.id,
                                      topicId: analysis.topic.id,
                                      cycle: milestone.cycle,
                                      sourceDateStr: dateStr,
                                      sourceHourStr: hourStr,
                                      topicTitle: analysis.topic.title,
                                      subjectName: analysis.subject.name,
                                      label: milestone.label,
                                    };
                                    setDraggedItem(payload);
                                    setDraggedReview(payload);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedItem(null);
                                    setDraggedReview(null);
                                    setDragOverSlot(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 rounded-xl bg-indigo-50/95 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-100 text-xs shadow-2xs space-y-1 cursor-grab active:cursor-grabbing"
                                  title="Arrastra para mover de hora o día"
                                >
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <span className="font-bold text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-0.5 truncate">
                                      <GripVertical className="w-3 h-3 text-indigo-400 shrink-0" />
                                      🧠 {milestone.label} · {hourStr}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {milestone.status !== 'completed' && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRecordReview(analysis, 'bien');
                                          }}
                                          className="px-1 py-0.5 rounded bg-emerald-600 text-white font-bold text-[8px] hover:bg-emerald-700 cursor-pointer"
                                        >
                                          ✓
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAssignReviewToTimeSlot(
                                            analysis.subject.id,
                                            analysis.topic.id,
                                            dateStr,
                                            undefined
                                          );
                                        }}
                                        className="text-indigo-400 hover:text-rose-600 cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="font-semibold leading-tight line-clamp-1 text-[11px]">
                                    {analysis.topic.title}
                                  </div>
                                  <div className="text-[9px] text-indigo-700 dark:text-indigo-300 truncate">
                                    {analysis.subject.name}
                                  </div>
                                </div>
                              ))}

                              {/* Tasks Assigned to this Concrete Hour */}
                              {dayTasksAtHour.map(({ task, subjectId, subjectName }) => {
                                const syncedTaskBlock = blocked.find(
                                  (b) =>
                                    b.linkedTaskId === task.id ||
                                    b.id === `block-task-${task.id}`
                                );

                                return (
                                  <div
                                    key={`taskslot-${task.id}`}
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      e.dataTransfer.effectAllowed = 'move';
                                      setDraggedItem({
                                        kind: 'task',
                                        subjectId,
                                        taskId: task.id,
                                        taskTitle: task.title,
                                        subjectName,
                                        sourceDateStr: dateStr,
                                        sourceHourStr: hourStr,
                                      });
                                    }}
                                    onDragEnd={() => {
                                      setDraggedItem(null);
                                      setDragOverSlot(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-2 rounded-xl bg-teal-50/95 border border-teal-300 text-teal-950 text-xs shadow-2xs space-y-0.5 cursor-grab active:cursor-grabbing"
                                    title="Arrastra esta tarea a otra hora o día"
                                  >
                                    <div className="flex items-center justify-between text-[10px] font-bold text-teal-800">
                                      <span className="truncate inline-flex items-center gap-0.5">
                                        <GripVertical className="w-3 h-3 text-teal-500 shrink-0" />
                                        ✓ {subjectName}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono-numbers">{hourStr}</span>
                                        {syncedTaskBlock && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteEffectiveBlockedItem(syncedTaskBlock);
                                            }}
                                            className="text-teal-600 hover:text-rose-600 cursor-pointer"
                                            title="Liberar bloque de tarea en blockedEvents"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="font-semibold text-[11px] truncate">
                                      {task.title}
                                    </div>
                                    {syncedTaskBlock && (
                                      <div className="text-[9px] font-bold text-amber-800 bg-amber-100/80 px-1 py-0.2 rounded truncate font-mono-numbers">
                                        🔒 Bloqueado {syncedTaskBlock.startTime}–{syncedTaskBlock.endTime}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* WEEKLY COLUMN CARDS VIEW (UNIFIED STUDY + SPACED REPETITION + TASKS, ALL DRAGGABLE) */
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDates.map((dateStr) => {
                const sessions = showStudyLayer ? sessionsByDate[dateStr] || [] : [];
                const daySR = showRepasoLayer ? srReviewsByDate[dateStr] || [] : [];
                const dayTasks = showExamsTasksLayer ? tasksByDate[dateStr] || [] : [];
                const dayExams = showExamsTasksLayer ? examsByDate[dateStr] || [] : [];
                const dayBlocked = getEffectiveBlockedForDate(dateStr);
                const d = parseLocalDate(dateStr);
                const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
                const isToday = dateStr === todayStr;
                const totalHours = sessions.reduce((acc, s) => acc + s.durationHours, 0);
                const isColDrop = dragOverSlot === `weekcol-${dateStr}`;

                return (
                  <div
                    key={dateStr}
                    onDragOver={(e) => {
                      if (!draggedItem && !draggedReview) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverSlot !== `weekcol-${dateStr}`) {
                        setDragOverSlot(`weekcol-${dateStr}`);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverSlot === `weekcol-${dateStr}`) {
                        setDragOverSlot(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverSlot(null);
                      handleDropCalendarItem(dateStr);
                    }}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-2xs flex flex-col justify-between transition-all ${
                      isColDrop
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/30'
                        : isToday
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            {dayName}
                          </span>
                          <div className="text-sm font-bold font-mono-numbers text-slate-900 dark:text-white">
                            {d.getDate()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {totalHours > 0 && (
                            <span className="text-xs font-bold font-mono-numbers text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
                              {Math.round(totalHours * 10) / 10}h
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDayStr(dateStr);
                              setBlockedDate(dateStr);
                              setBlockedModalMode('on_the_fly');
                              setShowAddBlockedModal(true);
                            }}
                            className="p-1 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 cursor-pointer"
                            title="Añadir plan sobre la marcha en este día"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Blocked events / Weekly routines */}
                      {dayBlocked.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {dayBlocked.map((b) => (
                            <div
                              key={b.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedItem({
                                  kind: 'blocked_event',
                                  eventId: b.id,
                                  title: b.title,
                                  sourceDateStr: dateStr,
                                  sourceHourStr: b.startTime,
                                  durationHours: b.durationHours,
                                  isWeeklyObligation: b.isWeeklyObligation,
                                  sourceObligationId: b.sourceObligationId,
                                });
                              }}
                              onDragEnd={() => {
                                setDraggedItem(null);
                                setDragOverSlot(null);
                              }}
                              className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-0.5 cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-center justify-between text-amber-900 font-bold">
                                <span className="truncate">
                                  {b.isWeeklyObligation ? '🔁' : '🚫'} {b.title}
                                </span>
                                <button
                                  onClick={() => handleDeleteEffectiveBlockedItem(b)}
                                  className="text-amber-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="text-[10px] text-amber-700 font-mono-numbers">
                                {b.startTime} - {b.endTime}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Exams */}
                      {dayExams.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {dayExams.map((ex, i) => (
                            <div
                              key={i}
                              className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs"
                            >
                              <span className="font-bold text-rose-900">
                                🎯 {ex.exam.title}
                              </span>
                              <div className="text-[10px] text-rose-700 font-semibold uppercase">
                                Examen {ex.exam.examType}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Study Plan Sessions (Draggable + Editable Start Time) */}
                      {showStudyLayer && (
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                              Plan de Estudio ({sessions.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => openAddTopicSlotModalForDate(dateStr)}
                              className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold inline-flex items-center gap-0.5 cursor-pointer"
                              title="Añadir un tema en un hueco libre de este día"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Tema</span>
                            </button>
                          </div>
                          {sessions.map((sess) => {
                            const effectiveStart = sess.startTime || '09:00';
                            const effectiveEnd =
                              sess.endTime ||
                              calculateAutoEndTime(effectiveStart, sess.durationHours);
                            const isExtraSession = sess.id.startsWith('sess-extra-');

                            return (
                              <div
                                key={sess.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDraggedItem({
                                    kind: 'topic_session',
                                    subjectId: sess.subjectId,
                                    topicId: sess.topicId,
                                    topicTitle: sess.topicTitle,
                                    subjectName: sess.subjectName,
                                    sourceDateStr: dateStr,
                                    sourceHourStr: effectiveStart,
                                    durationHours: sess.durationHours,
                                  });
                                }}
                                onDragEnd={() => {
                                  setDraggedItem(null);
                                  setDragOverSlot(null);
                                }}
                                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1.5 cursor-grab active:cursor-grabbing hover:border-blue-400"
                                title="Cambia la hora de inicio o arrastra este tema a otro día"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate inline-flex items-center gap-0.5">
                                    <GripVertical className="w-3 h-3 text-blue-400 shrink-0" />
                                    {sess.subjectName}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono-numbers text-blue-700 dark:text-blue-400 font-semibold">
                                      {sess.durationHours}h
                                    </span>
                                    {isExtraSession && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveExtraTopicFromDay(
                                            sess.subjectId,
                                            sess.topicId,
                                            dateStr
                                          )
                                        }
                                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                        title="Quitar tema extra"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="font-medium leading-snug text-slate-900 dark:text-white">
                                  {sess.topicTitle}
                                </div>
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center justify-between gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-mono-numbers"
                                >
                                  <input
                                    type="time"
                                    value={effectiveStart}
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      handleChangeTopicSessionStartTime(
                                        sess.subjectId,
                                        sess.topicId,
                                        dateStr,
                                        e.target.value,
                                        sess.durationHours
                                      );
                                    }}
                                    className="bg-transparent font-bold text-blue-700 dark:text-blue-300 focus:outline-none cursor-pointer"
                                    title="Hora de inicio"
                                  />
                                  <span className="text-slate-500">→ {effectiveEnd}</span>
                                </div>
                                {sess.pagesAllocation && (
                                  <div className="text-[10px] text-blue-700 bg-white/70 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1 font-mono-numbers">
                                    <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                                    <span>{sess.pagesAllocation}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Spaced Repetition SM-2 Reviews in Weekly Column (Draggable) */}
                      {showRepasoLayer && daySR.length > 0 && (
                        <div className="space-y-2 mb-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                            <Brain className="w-3 h-3" />
                            <span>Repasos SM-2 ({daySR.length})</span>
                          </span>
                          {daySR.map(({ analysis, milestone }) => (
                            <div
                              key={`${analysis.topic.id}-${milestone.cycle}`}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                const payload: DraggedCalendarItem = {
                                  kind: 'spaced_review',
                                  subjectId: analysis.subject.id,
                                  topicId: analysis.topic.id,
                                  cycle: milestone.cycle,
                                  sourceDateStr: dateStr,
                                  topicTitle: analysis.topic.title,
                                  subjectName: analysis.subject.name,
                                  label: milestone.label,
                                };
                                setDraggedItem(payload);
                                setDraggedReview(payload);
                              }}
                              onDragEnd={() => {
                                setDraggedItem(null);
                                setDraggedReview(null);
                                setDragOverSlot(null);
                              }}
                              className="p-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-xs space-y-1 cursor-grab active:cursor-grabbing hover:border-indigo-400"
                              title="Arrastra este repaso a otro día de la semana"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 font-mono-numbers inline-flex items-center gap-0.5">
                                  <GripVertical className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                                  {milestone.label}
                                </span>
                                {milestone.status !== 'completed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRecordReview(analysis, 'bien')}
                                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                                  >
                                    ✓ Repasado
                                  </button>
                                )}
                              </div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {analysis.topic.title}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {analysis.subject.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tasks (Draggable) */}
                      {dayTasks.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-bold text-slate-600 block">
                            Tareas ({dayTasks.length})
                          </span>
                          {dayTasks.map(({ task, subjectId, subjectName }) => (
                            <label
                              key={task.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedItem({
                                  kind: 'task',
                                  subjectId,
                                  taskId: task.id,
                                  taskTitle: task.title,
                                  subjectName,
                                  sourceDateStr: dateStr,
                                  sourceHourStr: task.scheduledTime,
                                });
                              }}
                              onDragEnd={() => {
                                setDraggedItem(null);
                                setDragOverSlot(null);
                              }}
                              className="flex items-start gap-1.5 p-1.5 rounded-lg hover:bg-slate-50 cursor-grab active:cursor-grabbing text-xs border border-transparent hover:border-slate-200"
                              title="Arrastra esta tarea a otro día de la semana"
                            >
                              <GripVertical className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={(e) =>
                                  onToggleTask?.(subjectId, task.id, e.target.checked)
                                }
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
                              />
                              <span
                                className={`leading-snug ${
                                  task.completed
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {task.title}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: DAILY UNIFIED CALENDAR */}
      {calendarView === 'daily' && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Planificación y Repasos del Día · Drag & Drop por Horas y Días
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {currentDate.toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBlockedModalMode('weekly_recurring');
                  setShowAddBlockedModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold cursor-pointer"
              >
                🔁 Bloquear Clases/Entrenos
              </button>
              <button
                type="button"
                onClick={() => {
                  setBlockedDate(selectedDayStr);
                  setBlockedModalMode('on_the_fly');
                  setShowAddBlockedModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold cursor-pointer"
              >
                + Plan sobre la Marcha Hoy
              </button>
              <button
                type="button"
                onClick={() => handleRecalculateTopicsAndReviews({ preserveManualPins: true })}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Recalcular Temas y Repasos</span>
              </button>
            </div>
          </div>

          {/* Tira de 7 días de la semana en Vista Diaria: permite arrastrar temas/repasos/tareas a otro día sin salir de Vista Día */}
          <div className="grid grid-cols-7 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            {weekDates.map((dStr) => {
              const dObj = parseLocalDate(dStr);
              const isCurr = dStr === selectedDayStr;
              const isDropDay = dragOverSlot === `daily-strip-${dStr}`;
              return (
                <div
                  key={dStr}
                  onClick={() => {
                    setSelectedDayStr(dStr);
                    setCurrentDate(parseLocalDate(dStr));
                  }}
                  onDragOver={(e) => {
                    if (!draggedItem && !draggedReview) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverSlot !== `daily-strip-${dStr}`) {
                      setDragOverSlot(`daily-strip-${dStr}`);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverSlot === `daily-strip-${dStr}`) {
                      setDragOverSlot(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSlot(null);
                    handleDropCalendarItem(dStr);
                  }}
                  className={`p-2 rounded-xl text-center cursor-pointer transition-all border ${
                    isDropDay
                      ? 'bg-indigo-100 dark:bg-indigo-950 border-indigo-500 ring-2 ring-indigo-500/40'
                      : isCurr
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                  }`}
                  title="Haz clic para ver este día o suelta aquí cualquier tema, repaso o tarea para moverlo a esta fecha"
                >
                  <div
                    className={`text-[10px] font-bold uppercase ${
                      isCurr ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {dObj.toLocaleDateString('es-ES', { weekday: 'short' })}
                  </div>
                  <div className="text-sm font-extrabold font-mono-numbers">
                    {dObj.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spaced Repetition Reviews + Tasks Block for the Day (Draggable to hours or other days) */}
          {(showRepasoLayer || showExamsTasksLayer) &&
            (selectedDaySRReviews.length > 0 || selectedDayTasks.length > 0) && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    <Brain className="w-4 h-4" />
                    <span>
                      Repasos SM-2 ({selectedDaySRReviews.length}) y Tareas ({selectedDayTasks.length}) · Arrastra a una hora o a otro día de la barra superior
                    </span>
                  </h4>

                  <button
                    type="button"
                    onClick={handleFindFreeSlotsForAllReviews}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Buscar Hueco Automático Hoy</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedDaySRReviews.map(({ analysis, milestone }) => {
                    const scheduledHour = getReviewScheduledTime(
                      analysis.topic,
                      selectedDayStr
                    );

                    return (
                      <div
                        key={`${analysis.topic.id}-${milestone.cycle}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          const payload: DraggedCalendarItem = {
                            kind: 'spaced_review',
                            subjectId: analysis.subject.id,
                            topicId: analysis.topic.id,
                            cycle: milestone.cycle,
                            sourceDateStr: selectedDayStr,
                            topicTitle: analysis.topic.title,
                            subjectName: analysis.subject.name,
                            label: milestone.label,
                          };
                          setDraggedItem(payload);
                          setDraggedReview(payload);
                        }}
                        onDragEnd={() => {
                          setDraggedItem(null);
                          setDraggedReview(null);
                          setDragOverSlot(null);
                        }}
                        className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col justify-between gap-3 cursor-grab active:cursor-grabbing transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <GripVertical className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {analysis.subject.name}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-mono-numbers">
                                {milestone.label}
                              </span>
                            </div>
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                              {analysis.topic.title}
                            </h5>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center gap-1">
                              <select
                                value={scheduledHour || ''}
                                onChange={(e) =>
                                  handleAssignReviewToTimeSlot(
                                    analysis.subject.id,
                                    analysis.topic.id,
                                    selectedDayStr,
                                    e.target.value || undefined
                                  )
                                }
                                className="text-[11px] bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-lg px-2 py-1 font-mono-numbers font-semibold text-indigo-800 dark:text-indigo-200 focus:outline-none"
                              >
                                <option value="">🕒 Hora libre...</option>
                                {timelineHours.map((h) => {
                                  const hLabel = `${String(h).padStart(2, '0')}:00`;
                                  return (
                                    <option key={h} value={hLabel}>
                                      🕒 {hLabel}
                                    </option>
                                  );
                                })}
                              </select>
                              {!scheduledHour && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleFindFreeSlotForSingleReview(analysis, selectedDayStr)
                                  }
                                  className="px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-[10px] font-bold cursor-pointer"
                                >
                                  ⚡ Hueco
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {milestone.status !== 'completed' ? (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-800/60">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(['repetir', 'dificil', 'bien', 'facil'] as ReviewQuality[]).map(
                                (q) => (
                                  <button
                                    key={q}
                                    type="button"
                                    onClick={() => handleRecordReview(analysis, q)}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white border border-indigo-200 dark:border-slate-700 transition-colors cursor-pointer"
                                  >
                                    {q}
                                  </button>
                                )
                              )}
                            </div>
                            {onStartPomodoro && (
                              <button
                                type="button"
                                onClick={() =>
                                  onStartPomodoro(analysis.subject.id, analysis.topic.id)
                                }
                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Pomodoro</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            ✓ Repaso completado
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Draggable Tasks for Today */}
                  {selectedDayTasks.map(({ task, subjectId, subjectName }) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedItem({
                          kind: 'task',
                          subjectId,
                          taskId: task.id,
                          taskTitle: task.title,
                          subjectName,
                          sourceDateStr: selectedDayStr,
                          sourceHourStr: task.scheduledTime,
                        });
                      }}
                      onDragEnd={() => {
                        setDraggedItem(null);
                        setDragOverSlot(null);
                      }}
                      className="p-4 rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/20 flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing"
                      title="Arrastra esta tarea a una hora concreta inferior o a otro día de la semana arriba"
                    >
                      <div className="flex items-start gap-2.5">
                        <GripVertical className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={(e) =>
                            onToggleTask?.(subjectId, task.id, e.target.checked)
                          }
                          className="mt-0.5 w-4 h-4 text-teal-600 rounded border-slate-300"
                        />
                        <div>
                          <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 block">
                            ✓ Tarea · {subjectName}
                          </span>
                          <h5
                            className={`text-sm font-bold ${
                              task.completed
                                ? 'line-through text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {task.title}
                          </h5>
                        </div>
                      </div>
                      {task.scheduledTime && (
                        <span className="text-xs font-mono-numbers font-bold text-teal-800 bg-teal-100 px-2 py-1 rounded-lg">
                          🕒 {task.scheduledTime}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Time Blocking Vertical Schedule (Universal Drop target for Topics, Reviews, Tasks & Blocked Plans) */}
          {timeBlockMode ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>
                    Horario por Horas (Arrastra temas, repasos, tareas o planes de una hora a otra)
                  </span>
                </h4>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleFindFreeSlotsForAllReviews}
                    className="text-xs text-purple-700 dark:text-purple-400 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Ubicar repasos en huecos libres</span>
                  </button>
                  <button
                    onClick={() => {
                      setBlockedDate(selectedDayStr);
                      setBlockedModalMode('on_the_fly');
                      setShowAddBlockedModal(true);
                    }}
                    className="text-xs text-amber-700 font-semibold hover:underline cursor-pointer"
                  >
                    + Añadir Plan a este día
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {timelineHours.map((hour) => {
                  const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                  const slotKey = `${selectedDayStr}-${hour}`;
                  const isDragOver = dragOverSlot === slotKey;

                  const sessions = selectedDayStudySessions;
                  const blocked = selectedDayBlocked;
                  const reviewsAtHour = showRepasoLayer
                    ? selectedDaySRReviews.filter(({ analysis }) => {
                        const revTime = getReviewScheduledTime(
                          analysis.topic,
                          selectedDayStr
                        );
                        if (!revTime) return false;
                        return parseInt(revTime.split(':')[0], 10) === hour;
                      })
                    : [];
                  const tasksAtHour = showExamsTasksLayer
                    ? selectedDayTasks.filter(({ task }) => {
                        if (!task.scheduledTime) return false;
                        return parseInt(task.scheduledTime.split(':')[0], 10) === hour;
                      })
                    : [];

                  const sessionsAtHour = sessions.filter((s) => {
                    if (!s.startTime) return false;
                    const h = parseInt(s.startTime.split(':')[0], 10);
                    return h === hour;
                  });

                  const blkList = blocked.filter((b) => {
                    const sH = parseInt(b.startTime.split(':')[0], 10);
                    const eH = parseInt(b.endTime.split(':')[0], 10);
                    return hour >= sH && hour < Math.max(sH + 1, eH);
                  });

                  return (
                    <div
                      key={hour}
                      onDragOver={(e) => {
                        if (!draggedItem && !draggedReview) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverSlot !== slotKey) {
                          setDragOverSlot(slotKey);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverSlot === slotKey) {
                          setDragOverSlot(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverSlot(null);
                        handleDropCalendarItem(selectedDayStr, hourStr);
                      }}
                      className={`flex items-start gap-4 p-4 transition-all ${
                        isDragOver
                          ? 'bg-indigo-100/70 dark:bg-indigo-950/60 ring-2 ring-inset ring-indigo-500'
                          : blkList.length > 0
                          ? 'bg-amber-50/40'
                          : sessionsAtHour.length > 0 || reviewsAtHour.length > 0 || tasksAtHour.length > 0
                          ? 'bg-blue-50/20 dark:bg-slate-800/40'
                          : 'hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="w-16 font-mono-numbers font-bold text-xs text-slate-400 pt-1 shrink-0">
                        {hourStr}
                      </div>

                      <div className="flex-1 space-y-2">
                        {isDragOver && (
                          <div className="p-2.5 rounded-xl border border-dashed border-indigo-400 bg-white/90 dark:bg-slate-900/90 text-xs font-bold text-indigo-700 dark:text-indigo-300 text-center">
                            Soltar aquí para programar a las {hourStr}
                          </div>
                        )}

                        {blkList.map((blk) => (
                          <div
                            key={blk.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedItem({
                                kind: 'blocked_event',
                                eventId: blk.id,
                                title: blk.title,
                                sourceDateStr: selectedDayStr,
                                sourceHourStr: blk.startTime,
                                durationHours: blk.durationHours,
                                isWeeklyObligation: blk.isWeeklyObligation,
                                sourceObligationId: blk.sourceObligationId,
                              });
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverSlot(null);
                            }}
                            className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2 cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <GripVertical className="w-4 h-4 text-amber-500" />
                                <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-amber-200 text-amber-900">
                                  {blk.isWeeklyObligation || blk.isRecurringWeekly
                                    ? '🔁 Fijo Semanal'
                                    : '🚫 Plan Bloqueado'}
                                </span>
                                <h5 className="font-bold text-slate-900 text-sm">{blk.title}</h5>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteEffectiveBlockedItem(blk)}
                                className="text-amber-500 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex items-center gap-4 text-slate-600 font-mono-numbers pl-6">
                              <span>
                                Horario: {blk.startTime} - {blk.endTime}
                              </span>
                              {blk.notes && <span>· {blk.notes}</span>}
                            </div>
                          </div>
                        ))}

                        {sessionsAtHour.map((sess) => (
                          <div
                            key={sess.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedItem({
                                kind: 'topic_session',
                                subjectId: sess.subjectId,
                                topicId: sess.topicId,
                                topicTitle: sess.topicTitle,
                                subjectName: sess.subjectName,
                                sourceDateStr: selectedDayStr,
                                sourceHourStr: sess.startTime || hourStr,
                                durationHours: sess.durationHours,
                              });
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverSlot(null);
                            }}
                            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-grab active:cursor-grabbing ${
                              sess.type === 'repaso_espaciado'
                                ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                                : 'bg-blue-50/70 border-blue-200 text-blue-950'
                            }`}
                            title="Arrastra este tema a otra hora o a otro día de la tira superior"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <GripVertical className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="font-bold text-slate-900">{sess.subjectName}</span>
                                <span>·</span>
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-blue-200 font-mono-numbers text-xs"
                                >
                                  <span className="text-[10px] font-bold text-slate-500">Inicio:</span>
                                  <input
                                    type="time"
                                    value={sess.startTime || hourStr}
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      handleChangeTopicSessionStartTime(
                                        sess.subjectId,
                                        sess.topicId,
                                        selectedDayStr,
                                        e.target.value,
                                        sess.durationHours
                                      );
                                    }}
                                    className="font-bold text-blue-700 bg-transparent focus:outline-none cursor-pointer"
                                  />
                                  <span className="text-slate-600">
                                    → Fin auto:{' '}
                                    <strong className="text-blue-700">
                                      {sess.endTime ||
                                        calculateAutoEndTime(
                                          sess.startTime || hourStr,
                                          sess.durationHours
                                        )}
                                    </strong>{' '}
                                    ({sess.durationHours}h)
                                  </span>
                                </div>
                                {sess.id.startsWith('sess-extra-') && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveExtraTopicFromDay(
                                        sess.subjectId,
                                        sess.topicId,
                                        selectedDayStr
                                      )
                                    }
                                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                    title="Quitar este tema extra"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <h5 className="text-sm font-bold text-slate-900 pl-6">
                                {sess.topicTitle}
                              </h5>
                              {sess.pagesAllocation && (
                                <div className="text-[11px] text-blue-700 font-medium pl-6">
                                  Guía: {sess.pagesAllocation}
                                </div>
                              )}
                            </div>

                            {onStartPomodoro && (
                              <button
                                onClick={() => onStartPomodoro(sess.subjectId, sess.topicId)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer self-start sm:self-center shrink-0"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Iniciar Pomodoro</span>
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Spaced Repetition Reviews Dropped/Assigned to this Concrete Hour */}
                        {reviewsAtHour.map(({ analysis, milestone }) => (
                          <div
                            key={`daily-slot-${analysis.topic.id}-${milestone.cycle}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              const payload: DraggedCalendarItem = {
                                kind: 'spaced_review',
                                subjectId: analysis.subject.id,
                                topicId: analysis.topic.id,
                                cycle: milestone.cycle,
                                sourceDateStr: selectedDayStr,
                                sourceHourStr: hourStr,
                                topicTitle: analysis.topic.title,
                                subjectName: analysis.subject.name,
                                label: milestone.label,
                              };
                              setDraggedItem(payload);
                              setDraggedReview(payload);
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDraggedReview(null);
                              setDragOverSlot(null);
                            }}
                            className="p-4 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-grab active:cursor-grabbing"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <GripVertical className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px] font-mono-numbers">
                                  🧠 Repaso {milestone.label} · {hourStr}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {analysis.subject.name}
                                </span>
                              </div>
                              <h5 className="text-sm font-bold text-slate-900 dark:text-white pl-5">
                                {analysis.topic.title}
                              </h5>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {milestone.status !== 'completed' && (
                                <div className="flex items-center gap-1">
                                  {(['repetir', 'dificil', 'bien', 'facil'] as ReviewQuality[]).map(
                                    (q) => (
                                      <button
                                        key={q}
                                        type="button"
                                        onClick={() => handleRecordReview(analysis, q)}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold capitalize bg-white dark:bg-slate-800 hover:bg-indigo-600 hover:text-white border border-indigo-200 dark:border-slate-700 transition-colors cursor-pointer"
                                      >
                                        {q}
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                              {onStartPomodoro && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onStartPomodoro(analysis.subject.id, analysis.topic.id)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Pomodoro</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleAssignReviewToTimeSlot(
                                    analysis.subject.id,
                                    analysis.topic.id,
                                    selectedDayStr,
                                    undefined
                                  )
                                }
                                className="p-1 text-indigo-400 hover:text-rose-600 cursor-pointer"
                                title="Liberar de esta hora"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Tasks Dropped/Assigned to this Concrete Hour */}
                        {tasksAtHour.map(({ task, subjectId, subjectName }) => (
                          <div
                            key={`daily-task-${task.id}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedItem({
                                kind: 'task',
                                subjectId,
                                taskId: task.id,
                                taskTitle: task.title,
                                subjectName,
                                sourceDateStr: selectedDayStr,
                                sourceHourStr: hourStr,
                              });
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverSlot(null);
                            }}
                            className="p-4 rounded-xl bg-teal-50/90 border border-teal-300 flex items-center justify-between gap-3 text-xs cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-center gap-2.5">
                              <GripVertical className="w-4 h-4 text-teal-500" />
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={(e) =>
                                  onToggleTask?.(subjectId, task.id, e.target.checked)
                                }
                                className="w-4 h-4 text-teal-600 rounded border-slate-300"
                              />
                              <div>
                                <span className="text-[10px] font-bold text-teal-700 uppercase">
                                  ✓ Tarea · {subjectName} · {hourStr}
                                </span>
                                <h5 className="text-sm font-bold text-slate-900">{task.title}</h5>
                              </div>
                            </div>
                          </div>
                        ))}

                        {sessionsAtHour.length === 0 &&
                          blkList.length === 0 &&
                          reviewsAtHour.length === 0 &&
                          tasksAtHour.length === 0 &&
                          !isDragOver && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                              <span className="text-xs text-slate-300 italic">
                                Hueco libre · Arrastra aquí un tema, repaso o tarea
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => openAddTopicSlotModalForDate(selectedDayStr, hourStr)}
                                  className="text-[11px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                                >
                                  + Añadir tema en este hueco
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBlockedDate(selectedDayStr);
                                    setBlockedStartTime(hourStr);
                                    setBlockedEndTime(
                                      `${String(Math.min(23, hour + 1)).padStart(2, '0')}:00`
                                    );
                                    setBlockedModalMode('on_the_fly');
                                    setShowAddBlockedModal(true);
                                  }}
                                  className="text-[11px] text-slate-400 hover:text-amber-600 font-semibold cursor-pointer"
                                >
                                  + Bloquear esta hora
                                </button>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Temas del Plan de Estudio Hoy (Cambia su hora de inicio o arrastra a otro día)
                </h4>
                <button
                  type="button"
                  onClick={() => openAddTopicSlotModalForDate(selectedDayStr)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Tema en Hueco</span>
                </button>
              </div>
              <div className="space-y-3">
                {selectedDayStudySessions.map((sess) => {
                  const effectiveStart = sess.startTime || '09:00';
                  const effectiveEnd =
                    sess.endTime || calculateAutoEndTime(effectiveStart, sess.durationHours);

                  return (
                    <div
                      key={sess.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedItem({
                          kind: 'topic_session',
                          subjectId: sess.subjectId,
                          topicId: sess.topicId,
                          topicTitle: sess.topicTitle,
                          subjectName: sess.subjectName,
                          sourceDateStr: selectedDayStr,
                          sourceHourStr: effectiveStart,
                          durationHours: sess.durationHours,
                        });
                      }}
                      onDragEnd={() => {
                        setDraggedItem(null);
                        setDragOverSlot(null);
                      }}
                      className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-grab active:cursor-grabbing"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                          <GripVertical className="w-4 h-4 text-blue-500" />
                          <span className="font-bold text-slate-900">{sess.subjectName}</span>
                          <span>·</span>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-blue-200 font-mono-numbers"
                          >
                            <span className="text-[11px] font-bold text-slate-600">Hora inicio:</span>
                            <input
                              type="time"
                              value={effectiveStart}
                              onChange={(e) => {
                                if (!e.target.value) return;
                                handleChangeTopicSessionStartTime(
                                  sess.subjectId,
                                  sess.topicId,
                                  selectedDayStr,
                                  e.target.value,
                                  sess.durationHours
                                );
                              }}
                              className="font-bold text-blue-700 bg-transparent focus:outline-none cursor-pointer"
                            />
                            <span className="text-slate-600">
                              → Fin auto: <strong className="text-blue-700">{effectiveEnd}</strong> ({sess.durationHours}h)
                            </span>
                          </div>
                        </div>
                        <h5 className="text-base font-bold text-slate-900 pl-6">
                          {sess.topicTitle}
                        </h5>
                        {sess.pagesAllocation && (
                          <div className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg font-medium mt-1 ml-6">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Guía de lectura: {sess.pagesAllocation}</span>
                          </div>
                        )}
                      </div>

                      {onStartPomodoro && (
                        <button
                          type="button"
                          onClick={() => onStartPomodoro(sess.subjectId, sess.topicId)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors whitespace-nowrap self-start sm:self-center cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Iniciar Pomodoro</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: YEARLY UNIFIED CALENDAR */}
      {calendarView === 'yearly' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Calendario Anual {currentYear} · Plan de Estudio, Repasos y Convocatorias
              </h3>
              <p className="text-xs text-slate-500">
                Haz clic en cualquier mes para abrir su calendario mensual unificado.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleRecalculateTopicsAndReviews({ preserveManualPins: true })}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Recalcular Temas y Repasos del Año</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {monthNames.map((mName, mIdx) => {
              const daysInM = new Date(currentYear, mIdx + 1, 0).getDate();
              const mExams = Object.keys(examsByDate)
                .filter((d) => {
                  const parts = d.split('-');
                  return (
                    parseInt(parts[0], 10) === currentYear &&
                    parseInt(parts[1], 10) === mIdx + 1
                  );
                })
                .flatMap((d) => examsByDate[d]);

              const mTasks = Object.keys(tasksByDate)
                .filter((d) => {
                  const parts = d.split('-');
                  return (
                    parseInt(parts[0], 10) === currentYear &&
                    parseInt(parts[1], 10) === mIdx + 1
                  );
                })
                .flatMap((d) => tasksByDate[d]);

              const mSRReviews = Object.keys(srReviewsByDate)
                .filter((d) => {
                  const parts = d.split('-');
                  return (
                    parseInt(parts[0], 10) === currentYear &&
                    parseInt(parts[1], 10) === mIdx + 1
                  );
                })
                .flatMap((d) => srReviewsByDate[d]);

              return (
                <div
                  key={mName}
                  onClick={() => {
                    const next = new Date(currentDate);
                    next.setMonth(mIdx);
                    setCurrentDate(next);
                    setCalendarView('monthly');
                  }}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700 pb-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {mName}
                    </span>
                    <span className="text-[11px] font-mono-numbers text-slate-400">
                      {daysInM} días
                    </span>
                  </div>

                  <div className="space-y-1.5 min-h-[72px]">
                    {mExams.length > 0 && (
                      <div className="text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded flex items-center justify-between">
                        <span>{mExams.length} examen(es)</span>
                        <span className="text-[10px]">🎯</span>
                      </div>
                    )}
                    {mSRReviews.length > 0 && (
                      <div className="text-[11px] font-semibold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded flex items-center justify-between">
                        <span>{mSRReviews.length} repaso(s) SM-2</span>
                        <span className="text-[10px]">🧠</span>
                      </div>
                    )}
                    {mTasks.length > 0 && (
                      <div className="text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded flex items-center justify-between">
                        <span>{mTasks.length} entrega(s)</span>
                        <span className="text-[10px]">✓</span>
                      </div>
                    )}
                    {mExams.length === 0 && mTasks.length === 0 && mSRReviews.length === 0 && (
                      <div className="text-[10px] text-slate-400 italic pt-2">Sin eventos</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: AÑADIR PLAN SOBRE LA MARCHA O BLOQUEO FIJO SEMANAL (CLASES, ENTRENOS...) */}
      {showAddBlockedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <Ban className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {blockedModalMode === 'weekly_recurring'
                      ? 'Bloquear Fijo Todas las Semanas (Clases, Entrenos...)'
                      : 'Añadir Plan sobre la Marcha o Cita'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bloquea estas horas y recalcula tus temas y repasos con 1 clic.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddBlockedModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de modo: Plan sobre la marcha vs Fijo todas las semanas */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setBlockedModalMode('on_the_fly')}
                className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                  blockedModalMode === 'on_the_fly'
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                ⚡ Plan sobre la marcha (1 día)
              </button>
              <button
                type="button"
                onClick={() => setBlockedModalMode('weekly_recurring')}
                className={`py-2 px-3 rounded-lg font-bold transition-all cursor-pointer ${
                  blockedModalMode === 'weekly_recurring'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                🔁 Fijo cada semana (Clases/Entreno)
              </button>
            </div>

            <form
              onSubmit={(e) => handleSaveBlockedEvent(e, false)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Título del plan, clase o entreno *
                </label>
                <input
                  type="text"
                  required
                  value={blockedTitle}
                  onChange={(e) => setBlockedTitle(e.target.value)}
                  placeholder={
                    blockedModalMode === 'weekly_recurring'
                      ? 'Ej: Clases Facultad, Entreno Gimnasio, Inglés...'
                      : 'Ej: Comida familiar, Cita médica, Plan con amigos...'
                  }
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {blockedModalMode === 'weekly_recurring' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Días de la semana en que se repite automáticamente *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { d: 1, label: 'Lun' },
                      { d: 2, label: 'Mar' },
                      { d: 3, label: 'Mié' },
                      { d: 4, label: 'Jue' },
                      { d: 5, label: 'Vie' },
                      { d: 6, label: 'Sáb' },
                      { d: 0, label: 'Dom' },
                    ].map((dayItem) => {
                      const active = blockedRecurringDays.includes(dayItem.d);
                      return (
                        <button
                          key={dayItem.d}
                          type="button"
                          onClick={() => {
                            if (active && blockedRecurringDays.length > 1) {
                              setBlockedRecurringDays(
                                blockedRecurringDays.filter((x) => x !== dayItem.d)
                              );
                            } else if (!active) {
                              setBlockedRecurringDays([...blockedRecurringDays, dayItem.d]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {dayItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Fecha *
                    </label>
                    <input
                      type="date"
                      required
                      value={blockedDate}
                      onChange={(e) => setBlockedDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Categoría
                    </label>
                    <select
                      value={blockedCategory}
                      onChange={(e) =>
                        setBlockedCategory(e.target.value as BlockedTimeEvent['category'])
                      }
                      className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none"
                    >
                      <option value="personal">Personal / Imprevisto</option>
                      <option value="clase">Clases / Academia</option>
                      <option value="deporte">Entreno / Deporte</option>
                      <option value="social">Plan Social / Ocio</option>
                      <option value="medico">Salud / Médico</option>
                      <option value="trabajo">Trabajo / Obligaciones</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Hora Inicio (HH:mm) *
                  </label>
                  <input
                    type="time"
                    required
                    value={blockedStartTime}
                    onChange={(e) => setBlockedStartTime(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Hora Fin (HH:mm) *
                  </label>
                  <input
                    type="time"
                    required
                    value={blockedEndTime}
                    onChange={(e) => setBlockedEndTime(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notas o Ubicación (Opcional)
                </label>
                <input
                  type="text"
                  value={blockedNotes}
                  onChange={(e) => setBlockedNotes(e.target.value)}
                  placeholder="Ej: Aula 4, Gimnasio municipal, Reunión..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddBlockedModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Solo Guardar Bloqueo
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveBlockedEvent(e as any, true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-600 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Guardar y Recalcular Temas y Repasos</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AÑADIR TEMA DE ESTUDIO EN HUECO LIBRE A ELECCIÓN DEL USUARIO */}
      {showAddTopicSlotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-extrabold">
                    Añadir Tema en Hueco Libre
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    Rellena un hueco del día con el tema que tú elijas; la hora de fin se calcula sola
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTopicSlotModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddExtraTopicToDay} className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <div className="text-xs text-blue-900 dark:text-blue-200">
                  <span className="font-bold block">¿Quieres avanzar el siguiente tema pendiente?</span>
                  <span className="text-[11px] text-blue-700 dark:text-blue-300">
                    La app puede preseleccionarte el próximo tema sin estudiar o puedes elegir cualquiera.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSuggestNextPendingTopicForSlot}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Sugerir siguiente</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Día del Calendario
                  </label>
                  <input
                    type="date"
                    value={extraTopicDate}
                    onChange={(e) => setExtraTopicDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Hora de Inicio (Fin automático)
                  </label>
                  <input
                    type="time"
                    value={extraTopicStartTime}
                    onChange={(e) => setExtraTopicStartTime(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono-numbers font-bold text-blue-700 dark:text-blue-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Materia
                </label>
                <select
                  value={extraTopicSubjectId}
                  onChange={(e) => {
                    const nextSubId = e.target.value;
                    setExtraTopicSubjectId(nextSubId);
                    const subObj = subjects.find((s) => s.id === nextSubId);
                    if (subObj && subObj.topics.length > 0) {
                      const firstPending =
                        subObj.topics.find((t) => !t.studiedAt && t.status !== 'estudiado') ||
                        subObj.topics[0];
                      setExtraTopicId(firstPending.id);
                      setExtraTopicPagesCount(
                        getDefaultPagesForTopic(firstPending, extraTopicDate)
                      );
                    }
                  }}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tema que quieres estudiar en este hueco
                </label>
                <select
                  value={extraTopicId}
                  onChange={(e) => {
                    const nextTopicId = e.target.value;
                    setExtraTopicId(nextTopicId);
                    const subObj = subjects.find((s) => s.id === extraTopicSubjectId);
                    const topObj = subObj?.topics.find((t) => t.id === nextTopicId);
                    if (topObj) {
                      setExtraTopicPagesCount(
                        getDefaultPagesForTopic(topObj, extraTopicDate)
                      );
                    }
                  }}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                >
                  {(
                    subjects.find((s) => s.id === extraTopicSubjectId)?.topics || []
                  ).map((t) => {
                    const attachedP = (t.attachedFiles || []).reduce(
                      (sum, f) =>
                        sum + (f.includeInOrganization !== false ? f.pageCount || 0 : 0),
                      0
                    );
                    const totalP = Math.max(t.pageCount || 0, t.paginasTotales || 0, attachedP);
                    const readP = Math.max(0, t.pagesRead || 0);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.title} (
                        {totalP > 0
                          ? `${readP}/${totalP} págs leídas`
                          : `${t.estimatedHours || 1.5}h est.`}
                        )
                      </option>
                    );
                  })}
                </select>
              </div>

              {(() => {
                const chosenSub = subjects.find((s) => s.id === extraTopicSubjectId);
                const chosenTopic = chosenSub?.topics.find((t) => t.id === extraTopicId);
                const attachedP = (chosenTopic?.attachedFiles || []).reduce(
                  (sum, f) =>
                    sum + (f.includeInOrganization !== false ? f.pageCount || 0 : 0),
                  0
                );
                const minsPerPage = getTopicMinutesPerPage(chosenTopic);
                const fallbackTotalPages = chosenTopic
                  ? Math.max(
                      1,
                      Math.round(((chosenTopic.estimatedHours || 1.5) * 60) / minsPerPage)
                    )
                  : 10;
                const totalTopicPages = Math.max(
                  chosenTopic?.pageCount || 0,
                  chosenTopic?.paginasTotales || 0,
                  attachedP,
                  fallbackTotalPages
                );
                const readPages = Math.max(0, chosenTopic?.pagesRead || 0);
                const remainingPages = Math.max(1, totalTopicPages - readPages);
                const sliderMax = Math.max(15, remainingPages, extraTopicPagesCount);

                const safePages = Math.max(1, Math.round(extraTopicPagesCount || 1));
                const durationMins = Math.max(5, Math.round(safePages * minsPerPage));
                const durationHoursRounded = Math.round((durationMins / 60) * 100) / 100;
                const autoEnd = calculateAutoEndTimeFromMinutes(
                  extraTopicStartTime || '17:00',
                  durationMins
                );
                const startPageNum = Math.min(totalTopicPages, readPages + 1);
                const endPageNum = startPageNum + safePages - 1;

                return (
                  <div className="space-y-3">
                    {/* Selector interactivo de Número de Páginas a Estudiar */}
                    <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-slate-800/80 border border-blue-200/80 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Número de páginas que quieres estudiar:</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExtraTopicPagesCount((prev) => Math.max(1, (prev || 1) - 1))
                            }
                            className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-100 cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={extraTopicPagesCount}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setExtraTopicPagesCount(
                                Number.isFinite(val) && val > 0 ? val : 1
                              );
                            }}
                            className="w-16 text-center text-xs font-mono-numbers font-black bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg py-1 text-blue-700 dark:text-blue-300 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExtraTopicPagesCount((prev) => (prev || 1) + 1)
                            }
                            className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-100 cursor-pointer"
                          >
                            +
                          </button>
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-0.5">
                            págs.
                          </span>
                        </div>
                      </div>

                      {/* Barra deslizante + Botones rápidos de páginas */}
                      <input
                        type="range"
                        min={1}
                        max={sliderMax}
                        value={safePages}
                        onChange={(e) =>
                          setExtraTopicPagesCount(parseInt(e.target.value, 10) || 1)
                        }
                        className="w-full accent-blue-600 cursor-pointer h-1.5 bg-blue-200 rounded-lg"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {[2, 4, 6, 8, 10].map((presetP) => (
                            <button
                              key={presetP}
                              type="button"
                              onClick={() => setExtraTopicPagesCount(presetP)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono-numbers font-bold transition-colors cursor-pointer ${
                                safePages === presetP
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-100'
                              }`}
                            >
                              {presetP} págs
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setExtraTopicPagesCount(remainingPages)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                              safePages === remainingPages
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
                            }`}
                          >
                            Restantes ({remainingPages} págs)
                          </button>
                        </div>

                        <span className="text-[10px] font-mono-numbers text-slate-500 dark:text-slate-400">
                          Ritmo: {minsPerPage} min/pág ({chosenTopic?.difficulty || 'Media'})
                        </span>
                      </div>
                    </div>

                    {/* Resumen en Vivo de Hora de Inicio y Hora de Fin según el Número de Páginas Escogido */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-blue-600/5 border border-blue-300 dark:border-blue-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-slate-700 dark:text-slate-200 font-bold block">
                          Tiempo de fin según {safePages}{' '}
                          {safePages === 1 ? 'página escogida' : 'páginas escogidas'} (Págs.{' '}
                          {startPageNum}–{endPageNum}):
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Duración estimada: <strong>{durationMins} min</strong> ({durationHoursRounded}h)
                        </span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 font-mono-numbers font-black text-sm text-blue-700 dark:text-blue-300 shrink-0 text-center shadow-2xs">
                        {extraTopicStartTime || '17:00'} → {autoEnd}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTopicSlotModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Tema ({extraTopicPagesCount} págs.)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de exportación .ICS para sincronizar con Google Calendar o Apple Calendar */}
      <IcsCalendarExportModal
        isOpen={showIcsExportModal}
        onClose={() => setShowIcsExportModal(false)}
        subjects={subjects}
        preferences={preferences}
        blockedEvents={blockedEvents}
        precomputedStudySessions={allGeneratedSessions}
        initialSubjectFilterId={selectedSubjectId}
      />
    </div>
  );
};
