import React, { useState, useMemo } from 'react';
import {
  Brain,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Play,
  Sparkles,
  TrendingUp,
  Layers,
  Filter,
  History,
  Award,
  Flame,
  Check,
  BookOpen,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  Subject,
  Topic,
  PomodoroLog,
  ReviewQuality,
  SpacedReviewRecord,
} from '../types';

import { schedulerService } from '../services/schedulerService';

export interface SpacedRepetitionCalendarViewProps {
  subjects: Subject[];
  pomodoroLogs: PomodoroLog[];
  onUpdateSubject: (updatedSubject: Subject) => void;
  onStartPomodoro?: (subjectId: string, topicId?: string) => void;
  onSelectSubject?: (subjectId: string) => void;
}

export interface ProjectedReviewMilestone {
  cycle: number; // 1..5
  label: string; // 'R1 (24h)', 'R2 (3d)', etc.
  intervalDays: number;
  baseIntervalDays?: number;
  date: string; // YYYY-MM-DD
  status: 'completed' | 'overdue' | 'due_today' | 'upcoming' | 'projected';
  quality?: ReviewQuality;
  isExamPrep?: boolean;
  isAdjustedByRetention?: 'advanced' | 'spaced' | 'standard';
}

export interface TopicReviewAnalysis {
  subject: Subject;
  topic: Topic;
  topicIndex: number;
  hasStudyHistory: boolean;
  anchorStudyDate: string; // YYYY-MM-DD
  lastReviewDate: string | null;
  effectiveLevel: number; // 0 to 5
  retentionPct: number; // 0 to 100
  errorsCount?: number; // Errores asociados al tema (errorLogs + unresolvedErrorsCount)
  urgency: 'overdue' | 'due_today' | 'upcoming_soon' | 'stable' | 'unstarted';
  nextOptimalDate: string; // YYYY-MM-DD
  nextCycleNumber: number;
  pomodoroSessionsCount: number;
  pomodoroMinutesTotal: number;
  totalStudyHours: number;
  upcomingExamDate: string | null;
  milestones: ProjectedReviewMilestone[];
  studiedPages?: number;
  totalPages?: number;
  studiedPct?: number;
  estimatedReviewMinutes?: number;
  estimatedReviewHours?: number;
}

const BASE_INTERVALS = [
  { cycle: 1, days: 1, shortTag: '24h', name: '1er repaso · 24 horas' },
  { cycle: 2, days: 3, shortTag: '3d', name: '2º repaso · A los 3 días' },
  { cycle: 3, days: 7, shortTag: '7d', name: '3º repaso · A la semana (7 días)' },
  { cycle: 4, days: 15, shortTag: '15d', name: '4º repaso · A los 15 días' },
  { cycle: 5, days: 30, shortTag: '30d', name: '5º repaso · Al mes (30 días)' },
];

function addDaysToDateStr(baseDateStr: string, daysToAdd: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + daysToAdd);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function diffDaysBetween(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const dt1 = new Date(y1 || 2026, (m1 || 1) - 1, d1 || 1).getTime();
  const dt2 = new Date(y2 || 2026, (m2 || 1) - 1, d2 || 1).getTime();
  return Math.round((dt2 - dt1) / (1000 * 60 * 60 * 24));
}

function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  return `${d} ${months[(m || 1) - 1]} ${y}`;
}

export const SpacedRepetitionCalendarView: React.FC<SpacedRepetitionCalendarViewProps> = ({
  subjects,
  pomodoroLogs,
  onUpdateSubject,
  onStartPomodoro,
  onSelectSubject,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(todayStr);
  const [calendarMode, setCalendarMode] = useState<'monthly' | 'weekly'>('monthly');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<
    'all' | 'actionable' | 'upcoming' | 'stable' | 'unstarted'
  >('all');
  const [includeUnstartedProjections, setIncludeUnstartedProjections] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Calculate Spaced Repetition schedule & memory retention ONLY for topics/pages marked as studied/read
  const topicAnalyses: TopicReviewAnalysis[] = useMemo(() => {
    const results: TopicReviewAnalysis[] = [];

    subjects.forEach((subject) => {
      // Find next upcoming exam for this subject
      const upcomingExams = (subject.exams || [])
        .filter((ex) => !ex.completed && ex.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date));
      const nearestSubjectExam = upcomingExams[0] || null;

      subject.topics.forEach((topic, idx) => {
        // Match Pomodoro logs for this topic
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

        const pageInfo = schedulerService.getTopicStudiedPages(topic);

        // REGLA ESTRICTA: Los repasos espaciados (1, 3, 7, 15, 30 días) SOLO se crean cuando el tema está estudiado/repasado o tiene páginas leídas > 0
        const hasStudyHistory =
          topic.status === 'estudiado' ||
          topic.status === 'repasado' ||
          pageInfo.studiedPages > 0;

        // Determine Anchor Study Date (when the topic/pages were studied)
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
        } else {
          anchorStudyDate = addDaysToDateStr(todayStr, idx * 2 + 1);
        }

        // Most recent review or study date
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

        // Effective Review Level (0..5)
        let effectiveLevel = topic.reviewLevel || 0;
        if (effectiveLevel === 0 && hasStudyHistory) {
          if (topic.status === 'repasado') {
            effectiveLevel = Math.max(2, historyRecords.length + 1);
          } else {
            effectiveLevel = Math.max(1, historyRecords.length || 1);
          }
        }
        effectiveLevel = Math.min(5, effectiveLevel);

        // Count unresolved errors associated with this topic (from subject.errorLogs or topic.unresolvedErrorsCount)
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

        // Adaptive interval multiplier based on errors, demonstrated/perceived retention & review quality
        let intervalMultiplier = 1.0;
        let adjustmentStatus: 'advanced' | 'spaced' | 'standard' = 'standard';

        if (lastRecord) {
          if (lastRecord.quality === 'repetir') {
            intervalMultiplier *= 0.5;
            adjustmentStatus = 'advanced';
          } else if (lastRecord.quality === 'dificil') {
            intervalMultiplier *= 0.75;
            adjustmentStatus = 'advanced';
          } else if (lastRecord.quality === 'facil' && errorsCount === 0) {
            intervalMultiplier *= 1.25;
            adjustmentStatus = 'spaced';
          }
        }

        // Factor in demonstrated/perceived retention and errors
        if (errorsCount > 0) {
          const errorFactor = Math.max(0.5, 1 - errorsCount * 0.14);
          intervalMultiplier *= errorFactor;
          adjustmentStatus = 'advanced';
        }
        if (topic.perceivedRetentionPct !== undefined) {
          if (topic.perceivedRetentionPct < 60) {
            intervalMultiplier *= 0.65;
            adjustmentStatus = 'advanced';
          } else if (topic.perceivedRetentionPct >= 88 && errorsCount === 0) {
            intervalMultiplier = Math.max(intervalMultiplier, 1.28);
            adjustmentStatus = 'spaced';
          }
        }

        // Factor in studied pages count & coverage
        const revTime = schedulerService.calculateTopicReviewTime(
          topic,
          pageInfo.studiedPages,
          Math.max(1, effectiveLevel)
        );
        if (pageInfo.isPartiallyStudied && pageInfo.studiedPct < 65) {
          intervalMultiplier *= 0.85;
          adjustmentStatus = 'advanced';
        } else if (pageInfo.studiedPages >= 25 && effectiveLevel <= 2) {
          intervalMultiplier *= 0.9;
        }

        // Check if topic is part of an upcoming exam
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

        // Build the 5 Spaced Repetition Milestones (R1: 24h, R2: 3d, R3: 7d, R4: 15d, R5: 30d)
        const milestones: ProjectedReviewMilestone[] = [];
        let runningBaseDate = anchorStudyDate;

        BASE_INTERVALS.forEach((base, cIdx) => {
          const cycleNum = base.cycle;
          const isStandard = Math.abs(intervalMultiplier - 1.0) < 0.08;
          let adjustedDays = isStandard
            ? base.days
            : Math.max(1, Math.round(base.days * intervalMultiplier));

          if (!isStandard && intervalMultiplier > 1.1 && adjustedDays === base.days) {
            adjustedDays = base.days + 1;
          } else if (!isStandard && intervalMultiplier < 0.9 && base.days > 1 && adjustedDays === base.days) {
            adjustedDays = Math.max(1, base.days - 1);
          }

          const stepTag =
            cycleNum === 1 && adjustedDays === 1
              ? 'R1 (24h)'
              : `R${cycleNum} (${adjustedDays}d)`;

          // If this cycle was already completed in history
          if (hasStudyHistory && cycleNum <= historyRecords.length) {
            const rec = historyRecords[cycleNum - 1];
            const usedDays = rec.intervalDaysUsed || adjustedDays;
            runningBaseDate = rec.date || addDaysToDateStr(runningBaseDate, usedDays);
            milestones.push({
              cycle: cycleNum,
              label: cycleNum === 1 && usedDays === 1 ? 'R1 (24h)' : `R${cycleNum} (${usedDays}d)`,
              intervalDays: usedDays,
              baseIntervalDays: base.days,
              date: runningBaseDate,
              status: 'completed',
              quality: rec.quality,
              isAdjustedByRetention: adjustmentStatus,
            });
          } else if (hasStudyHistory && cycleNum < effectiveLevel) {
            // Completed implicitly via status/level
            const completedDate = addDaysToDateStr(anchorStudyDate, base.days);
            runningBaseDate = completedDate <= todayStr ? completedDate : todayStr;
            milestones.push({
              cycle: cycleNum,
              label: stepTag,
              intervalDays: adjustedDays,
              baseIntervalDays: base.days,
              date: runningBaseDate,
              status: 'completed',
              quality: 'bien',
              isAdjustedByRetention: adjustmentStatus,
            });
          } else if (hasStudyHistory && cycleNum === Math.max(1, effectiveLevel)) {
            // Current active target review
            let optimalDate =
              topic.nextReviewDate ||
              addDaysToDateStr(lastReviewDate || anchorStudyDate, adjustedDays);

            // If exam is coming up before optimalDate, compress so review happens 1 day before exam
            let isExamPrep = false;
            if (upcomingExamDate && optimalDate > upcomingExamDate && upcomingExamDate >= todayStr) {
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
              label: stepTag,
              intervalDays: adjustedDays,
              baseIntervalDays: base.days,
              date: optimalDate,
              status,
              isExamPrep,
              isAdjustedByRetention: adjustmentStatus,
            });
          } else {
            // Future projected cycles
            const prevDate = cIdx === 0 ? anchorStudyDate : runningBaseDate;
            const projDate = addDaysToDateStr(prevDate, adjustedDays);
            runningBaseDate = projDate;

            milestones.push({
              cycle: cycleNum,
              label: stepTag,
              intervalDays: adjustedDays,
              baseIntervalDays: base.days,
              date: projDate,
              status: hasStudyHistory ? 'upcoming' : 'projected',
              isAdjustedByRetention: adjustmentStatus,
            });
          }
        });

        // Determine next actionable milestone
        const nextPendingMilestone =
          milestones.find((m) => m.status !== 'completed') ||
          milestones[milestones.length - 1];

        const nextOptimalDate = nextPendingMilestone.date;
        const nextCycleNumber = nextPendingMilestone.cycle;

        // Calculate Ebbinghaus Retention Curve Percentage: R = exp(-t / S), factoring perceivedRetentionPct & errorsCount
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
          const errorPenaltyPct = errorsCount * 7;
          const computedRetention = Math.max(
            12,
            Math.min(100, Math.round(rawRetention - errorPenaltyPct))
          );
          retentionPct =
            topic.perceivedRetentionPct !== undefined
              ? Math.round(topic.perceivedRetentionPct * 0.65 + computedRetention * 0.35)
              : computedRetention;
        }

        // Determine urgency category
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

        results.push({
          subject,
          topic,
          topicIndex: idx + 1,
          hasStudyHistory,
          anchorStudyDate,
          lastReviewDate,
          effectiveLevel,
          retentionPct,
          errorsCount,
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
  }, [subjects, pomodoroLogs, todayStr]);

  // Filter analyses according to user controls
  const filteredAnalyses = useMemo(() => {
    return topicAnalyses.filter((item) => {
      if (selectedSubjectFilter !== 'all' && item.subject.id !== selectedSubjectFilter) {
        return false;
      }
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
  }, [topicAnalyses, selectedSubjectFilter, includeUnstartedProjections, urgencyFilter]);

  // Map all review events onto calendar dates
  const calendarEventsByDate = useMemo(() => {
    const map: Record<
      string,
      Array<{
        analysis: TopicReviewAnalysis;
        milestone: ProjectedReviewMilestone;
      }>
    > = {};

    filteredAnalyses.forEach((analysis) => {
      analysis.milestones.forEach((milestone) => {
        // If unstarted projections are disabled, skip 'projected'
        if (!includeUnstartedProjections && milestone.status === 'projected') return;

        // If a milestone is overdue, show it both on its original date AND as an actionable item today
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

    // Sort events inside each day: overdue first, then due_today, then by cycle
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

  // Global KPI metrics
  const kpiMetrics = useMemo(() => {
    const activeItems = topicAnalyses.filter((a) => a.hasStudyHistory);
    const overdueCount = activeItems.filter((a) => a.urgency === 'overdue').length;
    const dueTodayCount = activeItems.filter((a) => a.urgency === 'due_today').length;
    const next7DaysItems = activeItems.filter(
      (a) => a.urgency === 'upcoming_soon' || a.urgency === 'overdue' || a.urgency === 'due_today'
    );
    const next7DaysCount = activeItems.filter((a) => a.urgency === 'upcoming_soon').length;

    const next7DaysEstimatedHours =
      Math.round(
        next7DaysItems.reduce((sum, a) => sum + (a.estimatedReviewHours || 0.35), 0) * 10
      ) / 10;

    const totalStudiedPagesInReview = activeItems.reduce(
      (sum, a) => sum + (a.studiedPages || 0),
      0
    );

    const actionableTodayPages = activeItems
      .filter((a) => a.urgency === 'overdue' || a.urgency === 'due_today')
      .reduce((sum, a) => sum + (a.studiedPages || 0), 0);

    const avgRetention =
      activeItems.length > 0
        ? Math.round(
            activeItems.reduce((sum, a) => sum + a.retentionPct, 0) / activeItems.length
          )
        : 0;

    const totalCompletedReviews = topicAnalyses.reduce(
      (sum, a) =>
        sum +
        a.milestones.filter((m) => m.status === 'completed').length,
      0
    );

    return {
      activeTopicsCount: activeItems.length,
      overdueCount,
      dueTodayCount,
      actionableToday: overdueCount + dueTodayCount,
      actionableTodayPages,
      next7DaysCount,
      next7DaysEstimatedHours,
      totalStudiedPagesInReview,
      avgRetention,
      totalCompletedReviews,
    };
  }, [topicAnalyses]);

  // Update studied pages for a topic directly from the review inspector or table
  const handleUpdateTopicStudiedPages = (
    subject: Subject,
    topic: Topic,
    newStudiedPages: number
  ) => {
    const pageInfo = schedulerService.getTopicStudiedPages(topic);
    const clampedPages = Math.max(0, newStudiedPages);
    const nextTotal = Math.max(pageInfo.totalPages, clampedPages);

    const updatedTopics: Topic[] = subject.topics.map((t) => {
      if (t.id === topic.id) {
        return {
          ...t,
          pagesRead: clampedPages,
          pageCount: nextTotal,
          status:
            clampedPages >= nextTotal && t.status === 'pendiente'
              ? 'estudiado'
              : clampedPages > 0 && t.status === 'pendiente'
              ? 'en_progreso'
              : t.status,
          studiedAt: clampedPages > 0 ? t.studiedAt || todayStr : t.studiedAt,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Handle completing a spaced repetition review with SM-2 quality rating + retention/errors + studied pages adjustment
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

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });

    const qualityLabels: Record<ReviewQuality, string> = {
      repetir: 'Baja retención / Repetir (24h)',
      dificil: 'Con errores / Adelantar repaso',
      bien: 'Estándar Curva (24h·3d·7d·15d·30d)',
      facil: 'Retención muy alta / Espaciar más',
    };

    setFeedbackBanner(
      `Repaso de "${topic.title}" registrado (${pagesReviewed}/${totalTopicPages} págs. estudiadas · ~${calc.estimatedReviewMinutes} min · ${qualityLabels[quality]}). Próximo repaso el ${formatReadableDate(calc.nextDate)} (+${calc.adjustedIntervalDays} ${calc.adjustedIntervalDays === 1 ? 'día / 24h' : 'días'} · Ciclo R${calc.nextLevel}).`
    );
    setTimeout(() => setFeedbackBanner(null), 6000);
  };

  // Direct adjustment of an upcoming review date (Adelantar por errores/baja retención o Espaciar por alta retención)
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

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });

    setFeedbackBanner(
      `Ajuste aplicado en "${topic.title}": ${adjusted.lastAdjustmentReason}. Nueva fecha: ${formatReadableDate(adjusted.nextReviewDate)}.`
    );
    setTimeout(() => setFeedbackBanner(null), 6000);
  };

  // Calendar Navigation Helpers
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const handlePrevPeriod = () => {
    const next = new Date(currentDate);
    if (calendarMode === 'monthly') {
      next.setMonth(next.getMonth() - 1);
    } else {
      next.setDate(next.getDate() - 7);
    }
    setCurrentDate(next);
  };

  const handleNextPeriod = () => {
    const next = new Date(currentDate);
    if (calendarMode === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCurrentDate(next);
  };

  const handleJumpToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDayStr(todayStr);
  };

  const daysGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Monday = 0

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const dt = new Date(currentYear, currentMonth - 1, d);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const dStr = `${yyyy}-${mm}-${dd}`;
      days.push({
        dateStr: dStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
      });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const yyyy = currentYear;
      const mm = String(currentMonth + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const dStr = `${yyyy}-${mm}-${dd}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
      });
    }

    const totalCells = Math.ceil(days.length / 7) * 7;
    let nextMonthDay = 1;
    while (days.length < totalCells) {
      const dt = new Date(currentYear, currentMonth + 1, nextMonthDay);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const dStr = `${yyyy}-${mm}-${dd}`;
      days.push({
        dateStr: dStr,
        dayNumber: nextMonthDay,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
      });
      nextMonthDay++;
    }

    return days;
  }, [currentYear, currentMonth, todayStr]);

  const weekDates = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));

    const week: Array<{ dateStr: string; dayName: string; dayNum: number; isToday: boolean }> = [];
    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dStr = `${yyyy}-${mm}-${dd}`;
      week.push({
        dateStr: dStr,
        dayName: dayLabels[i],
        dayNum: d.getDate(),
        isToday: dStr === todayStr,
      });
    }
    return week;
  }, [currentDate, todayStr]);

  const selectedDayEvents = calendarEventsByDate[selectedDayStr] || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800/70">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Calendario de Repaso Espaciado</span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono-numbers">
                  Algoritmo SM-2 + Ebbinghaus
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fechas óptimas calculadas automáticamente según tu histórico de estudio, sesiones Pomodoro, dificultad del tema y proximidad de exámenes.
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todas las asignaturas ({subjects.length})</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeUnstartedProjections}
              onChange={(e) => setIncludeUnstartedProjections(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Incluir proyección de temas pendientes</span>
          </label>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:underline text-[11px] shrink-0 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Repasos para Hoy / Urgentes */}
        <div
          onClick={() => {
            setSelectedDayStr(todayStr);
            setUrgencyFilter(urgencyFilter === 'actionable' ? 'all' : 'actionable');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            kpiMetrics.actionableToday > 0
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80 hover:border-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Repasos Óptimos Hoy
            </span>
            <div
              className={`p-1.5 rounded-lg ${
                kpiMetrics.actionableToday > 0
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {kpiMetrics.actionableToday > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono-numbers">
              {kpiMetrics.actionableToday}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {kpiMetrics.overdueCount > 0
                ? `(${kpiMetrics.overdueCount} atrasados · ${kpiMetrics.dueTodayCount} de hoy)`
                : 'Al día con la curva'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono-numbers">
            {kpiMetrics.actionableTodayPages > 0
              ? `📖 ${kpiMetrics.actionableTodayPages} págs. estudiadas para repasar hoy`
              : 'Haz clic para filtrar temas urgentes'}
          </p>
        </div>

        {/* KPI 2: Próximos 7 Días */}
        <div
          onClick={() =>
            setUrgencyFilter(urgencyFilter === 'upcoming' ? 'all' : 'upcoming')
          }
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Próximos 7 Días
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono-numbers">
              {kpiMetrics.next7DaysCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-numbers">
              ~{kpiMetrics.next7DaysEstimatedHours}h según págs.
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono-numbers">
            📖 {kpiMetrics.totalStudiedPagesInReview} págs. estudiadas en ciclo de repaso
          </p>
        </div>

        {/* KPI 3: Retención Media Estimada */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Retención de Memoria Media
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono-numbers ${
                kpiMetrics.avgRetention >= 75
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : kpiMetrics.avgRetention >= 50
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {kpiMetrics.activeTopicsCount > 0 ? `${kpiMetrics.avgRetention}%` : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              en {kpiMetrics.activeTopicsCount} temas activos
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                kpiMetrics.avgRetention >= 75
                  ? 'bg-emerald-500'
                  : kpiMetrics.avgRetention >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${kpiMetrics.avgRetention}%` }}
            />
          </div>
        </div>

        {/* KPI 4: Histórico de Ciclos Consolidados */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Hitos de Repaso Completados
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono-numbers">
              {kpiMetrics.totalCompletedReviews}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              repasos registrados
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Ciclos R1 (+1d) → R5 (+30d) acumulados
          </p>
        </div>
      </div>

      {/* Main Layout: Left Calendar Grid + Right Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Column (8 cols on lg) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
          {/* Calendar Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPeriod}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Periodo anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white min-w-[150px] text-center">
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <button
                type="button"
                onClick={handleNextPeriod}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Periodo siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleJumpToday}
                className="ml-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-lg border border-indigo-200 dark:border-indigo-800 cursor-pointer"
              >
                Hoy
              </button>
            </div>

            {/* Interval Legend & Mode Switcher */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mr-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Urgente/Hoy
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Óptimo Programado
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Completado
                </span>
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCalendarMode('monthly')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    calendarMode === 'monthly'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Mes
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMode('weekly')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    calendarMode === 'weekly'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Semana
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          {calendarMode === 'monthly' ? (
            <div className="p-3">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div
                    key={d}
                    className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {daysGrid.map((day) => {
                  const dayEvents = calendarEventsByDate[day.dateStr] || [];
                  const isSelected = selectedDayStr === day.dateStr;
                  const hasUrgent = dayEvents.some(
                    (e) => e.milestone.status === 'overdue' || e.milestone.status === 'due_today'
                  );

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDayStr(day.dateStr)}
                      className={`min-h-[92px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        !day.isCurrentMonth
                          ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50 opacity-55'
                          : isSelected
                          ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-500 ring-2 ring-indigo-500/20'
                          : day.isToday
                          ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-400 dark:border-amber-700'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold font-mono-numbers w-6 h-6 rounded-lg flex items-center justify-center ${
                            day.isToday
                              ? 'bg-indigo-600 text-white'
                              : isSelected
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {dayEvents.length > 0 && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono-numbers ${
                              hasUrgent
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {dayEvents.length}
                          </span>
                        )}
                      </div>

                      {/* Event Pills inside Day Cell */}
                      <div className="space-y-1 mt-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map(({ analysis, milestone }) => {
                          const badgeColor =
                            milestone.status === 'completed'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : milestone.status === 'overdue' || milestone.status === 'due_today'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              : milestone.status === 'upcoming'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 border-dashed';

                          return (
                            <div
                              key={`${analysis.topic.id}-${milestone.cycle}`}
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-medium truncate flex items-center gap-1 ${badgeColor}`}
                              title={`${analysis.subject.name} · ${analysis.topic.title} (${milestone.label})`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: analysis.subject.color || '#6366f1' }}
                              />
                              <span className="font-bold font-mono-numbers shrink-0">
                                R{milestone.cycle}
                              </span>
                              <span className="truncate">{analysis.topic.title}</span>
                            </div>
                          );
                        })}

                        {dayEvents.length > 3 && (
                          <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 pl-1 font-mono-numbers">
                            +{dayEvents.length - 3} más...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Weekly 7-Day Detailed View */
            <div className="p-4 grid grid-cols-1 sm:grid-cols-7 gap-2.5">
              {weekDates.map((wd) => {
                const dayEvents = calendarEventsByDate[wd.dateStr] || [];
                const isSelected = selectedDayStr === wd.dateStr;

                return (
                  <div
                    key={wd.dateStr}
                    onClick={() => setSelectedDayStr(wd.dateStr)}
                    className={`min-h-[240px] p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col ${
                      isSelected
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-500 ring-2 ring-indigo-500/20'
                        : wd.isToday
                        ? 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-400'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {wd.dayName}
                      </span>
                      <span
                        className={`text-xs font-bold font-mono-numbers px-2 py-0.5 rounded-lg ${
                          wd.isToday
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {wd.dayNum}
                      </span>
                    </div>

                    <div className="space-y-2 flex-1 overflow-y-auto">
                      {dayEvents.length === 0 ? (
                        <p className="text-[11px] text-slate-400 dark:text-slate-600 text-center py-8">
                          Sin repasos
                        </p>
                      ) : (
                        dayEvents.map(({ analysis, milestone }) => (
                          <div
                            key={`${analysis.topic.id}-${milestone.cycle}`}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono-numbers">
                                {milestone.label}
                              </span>
                              <span className="text-[10px] font-mono-numbers font-semibold text-slate-500">
                                {analysis.retentionPct > 0 ? `${analysis.retentionPct}%` : 'Proy.'}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                              {analysis.topic.title}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {analysis.subject.name}
                            </p>
                            <div className="flex items-center justify-between text-[10px] font-mono-numbers text-indigo-700 dark:text-indigo-300 pt-0.5">
                              <span>📖 {analysis.studiedPages ?? 0}/{analysis.totalPages ?? 1} págs</span>
                              <span>~{analysis.estimatedReviewMinutes ?? 15}m</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Day Inspector & Quick Review Recorder (4 cols on lg) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                  Agenda de Repaso Espaciado
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedDayStr === todayStr
                    ? `Hoy · ${formatReadableDate(selectedDayStr)}`
                    : formatReadableDate(selectedDayStr)}
                </h4>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 font-mono-numbers">
                {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'tema' : 'temas'}
              </span>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No hay repasos óptimos programados para esta fecha
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Selecciona otro día en el calendario o completa sesiones de estudio para activar nuevos ciclos de consolidación.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {selectedDayEvents.map(({ analysis, milestone }) => {
                  const { subject, topic } = analysis;
                  const isCompleted = milestone.status === 'completed';
                  const isOverdue = milestone.status === 'overdue';

                  return (
                    <div
                      key={`${topic.id}-${milestone.cycle}`}
                      className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                        isCompleted
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : isOverdue
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/70'
                          : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
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
                            {milestone.isExamPrep && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                Pre-Examen
                              </span>
                            )}
                          </div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                            {topic.title}
                          </h5>
                        </div>

                        {analysis.hasStudyHistory && (
                          <div className="text-right shrink-0">
                            <span
                              className={`text-xs font-bold font-mono-numbers ${
                                analysis.retentionPct >= 75
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : analysis.retentionPct >= 50
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {analysis.retentionPct}%
                            </span>
                            <span className="block text-[9px] text-slate-400">retención</span>
                          </div>
                        )}
                      </div>

                      {/* Study History Metadata & Studied Pages Controller */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                        <span>
                          Últ. estudio:{' '}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {analysis.lastReviewDate
                              ? formatReadableDate(analysis.lastReviewDate)
                              : 'Sin iniciar'}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>{analysis.totalStudyHours}h invertidas</span>
                        {analysis.pomodoroSessionsCount > 0 && (
                          <>
                            <span>·</span>
                            <span>{analysis.pomodoroSessionsCount} Pomodoros</span>
                          </>
                        )}
                      </div>

                      {/* Páginas estudiadas a repasar */}
                      <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-900 dark:text-indigo-200 font-mono-numbers">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>
                              {analysis.studiedPages ?? 0} / {analysis.totalPages ?? 1} págs. estudiadas ({analysis.studiedPct ?? 0}%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                            Tiempo estimado de repaso: <strong className="text-indigo-700 dark:text-indigo-300">~{analysis.estimatedReviewMinutes ?? 15} min</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateTopicStudiedPages(
                                subject,
                                topic,
                                Math.max(0, (analysis.studiedPages ?? 0) - 1)
                              )
                            }
                            className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                            title="Restar 1 página estudiada"
                          >
                            -
                          </button>
                          <span className="px-1.5 text-[11px] font-mono-numbers font-bold text-slate-800 dark:text-slate-200">
                            {analysis.studiedPages ?? 0}p
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateTopicStudiedPages(
                                subject,
                                topic,
                                (analysis.studiedPages ?? 0) + 1
                              )
                            }
                            className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/70 hover:bg-indigo-200 text-indigo-800 dark:text-indigo-200 font-bold text-xs cursor-pointer"
                            title="Sumar 1 página estudiada"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Action Buttons: Rate Review Quality & Adjust by Retention/Errors */}
                      {!isCompleted ? (
                        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Completar Repaso según Retención:
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

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRecordReview(analysis, 'repetir')}
                              className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                              title="Baja retención / Muchos fallos: reiniciar al 1er repaso (24 horas)"
                            >
                              Baja (24h)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecordReview(analysis, 'dificil')}
                              className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                              title="Con errores / Dudas: adelantar el siguiente repaso"
                            >
                              Con Errores
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecordReview(analysis, 'bien')}
                              className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                              title="Retención buena: avanzar en la curva estándar (24h → 3d → 7d → 15d → 30d)"
                            >
                              Bien (Curva)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecordReview(analysis, 'facil')}
                              className="py-1.5 px-2 rounded-lg text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                              title="Retención muy alta sin fallos: espaciar el repaso un poco más (+25-35%)"
                            >
                              Muy Alta (+)
                            </button>
                          </div>

                          {/* Quick Adjust Schedule without logging a full session */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-400 font-medium">
                              Ajustar fecha:
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdjustReviewByRetentionOrErrors(
                                    analysis,
                                    'adelantar_baja_retencion'
                                  )
                                }
                                className="px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-50/80 hover:bg-amber-100 text-amber-800 border border-amber-200/80 transition-colors cursor-pointer"
                                title="Adelantar repaso por baja retención o errores detectados"
                              >
                                ⏪ Adelantar (Errores)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdjustReviewByRetentionOrErrors(
                                    analysis,
                                    'espaciar_alta_retencion'
                                  )
                                }
                                className="px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition-colors cursor-pointer"
                                title="Espaciar repaso un poco más por alta retención demostrada o percibida"
                              >
                                ⏩ Espaciar (+Retención)
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                          <span className="inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Repaso completado (Calidad: {milestone.quality || 'bien'})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Box on Ebbinghaus Intervals */}
          <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80 text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-200">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Curva del Olvido Oficial (5 Repasos):</span>
            </div>
            <ul className="grid grid-cols-1 gap-0.5 pl-5 list-disc text-[10px] text-slate-600 dark:text-slate-400">
              <li><strong>1er repaso:</strong> 24 horas (1 día) de haber estudiado</li>
              <li><strong>2º repaso:</strong> A los 3 días</li>
              <li><strong>3º repaso:</strong> A la semana (7 días)</li>
              <li><strong>4º repaso:</strong> A los 15 días</li>
              <li><strong>5º repaso:</strong> Al mes (30 días)</li>
            </ul>
            <p className="text-[10px] text-indigo-800 dark:text-indigo-300 pt-0.5">
              Puedes <strong>adelantar</strong> cualquier repaso si cometes errores o notas baja retención, o <strong>espaciarlo más</strong> si tu retención es muy alta.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Section: Full Topic Retention & Spaced Repetition Roadmap Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Hoja de Ruta de Retención y Ciclos por Tema</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Secuencia completa de los 5 ciclos de repaso espaciado calculados a partir del histórico de estudio de cada tema.
            </p>
          </div>

          {/* Urgency Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'actionable', label: `Para Hoy / Atrasados (${kpiMetrics.actionableToday})` },
              { id: 'upcoming', label: `Próximos 7 días (${kpiMetrics.next7DaysCount})` },
              { id: 'stable', label: 'Consolidados' },
              { id: 'unstarted', label: 'Pendientes 1ª Vuelta' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setUrgencyFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  urgencyFilter === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Asignatura y Tema</th>
                <th className="py-3 px-3">Histórico Estudio</th>
                <th className="py-3 px-3">Retención</th>
                <th className="py-3 px-4">Secuencia de Fechas Óptimas (R1 → R5)</th>
                <th className="py-3 px-4 text-right">Acción Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredAnalyses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No hay temas que coincidan con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredAnalyses.map((item) => {
                  const { subject, topic } = item;
                  return (
                    <tr
                      key={topic.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Subject & Topic */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: subject.color || '#6366f1' }}
                          />
                          <button
                            type="button"
                            onClick={() => onSelectSubject?.(subject.id)}
                            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 truncate cursor-pointer"
                          >
                            {subject.name}
                          </button>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Dif. {topic.difficulty}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                          {topic.title}
                        </p>
                      </td>

                      {/* Study History & Studied Pages */}
                      <td className="py-3.5 px-3 font-mono-numbers whitespace-nowrap">
                        {item.hasStudyHistory ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              Últ.: {formatReadableDate(item.lastReviewDate || item.anchorStudyDate)}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {item.totalStudyHours}h · Nivel R{item.effectiveLevel}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              📖 {item.studiedPages ?? 0}/{item.totalPages ?? 1} págs · ~{item.estimatedReviewMinutes ?? 15}m repaso
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-[11px] text-slate-400 block">
                              1ª Vuelta prog.: {formatReadableDate(item.anchorStudyDate)}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              📖 0/{item.totalPages ?? 1} págs estudiadas
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Memory Retention */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.hasStudyHistory ? (
                          <div className="w-28 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono-numbers">
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                {item.retentionPct}%
                              </span>
                              <span
                                className={`text-[10px] font-semibold ${
                                  item.urgency === 'overdue'
                                    ? 'text-rose-600'
                                    : item.urgency === 'due_today'
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {item.urgency === 'overdue'
                                  ? 'Crítico'
                                  : item.urgency === 'due_today'
                                  ? 'Repasar hoy'
                                  : 'Estable'}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.retentionPct >= 75
                                    ? 'bg-emerald-500'
                                    : item.retentionPct >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${item.retentionPct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Pendiente estudio</span>
                        )}
                      </td>

                      {/* 5 Milestones Roadmap */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.milestones.map((m) => {
                            const pillStyle =
                              m.status === 'completed'
                                ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : m.status === 'overdue' || m.status === 'due_today'
                                ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold'
                                : m.status === 'upcoming'
                                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 border-dashed';

                            return (
                              <button
                                key={m.cycle}
                                type="button"
                                onClick={() => setSelectedDayStr(m.date)}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-mono-numbers transition-all cursor-pointer hover:scale-105 ${pillStyle}`}
                                title={`Ir al ${formatReadableDate(m.date)} (${m.label})`}
                              >
                                <span className="font-bold">R{m.cycle}:</span>{' '}
                                <span>{m.date.slice(5)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Quick Action & Retention/Error Adjustment */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustReviewByRetentionOrErrors(
                                item,
                                'adelantar_baja_retencion'
                              )
                            }
                            className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Adelantar repaso por baja retención o errores cometidos"
                          >
                            ⏪ Adelantar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRecordReview(item, 'bien')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Marcar repaso espaciado como completado hoy según la curva (24h · 3d · 7d · 15d · 30d)"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Repasado</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustReviewByRetentionOrErrors(
                                item,
                                'espaciar_alta_retencion'
                              )
                            }
                            className="px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Espaciar el repaso un poco más si la retención demostrada o percibida es muy alta"
                          >
                            ⏩ Espaciar
                          </button>
                          {onStartPomodoro && (
                            <button
                              type="button"
                              onClick={() => onStartPomodoro(subject.id, topic.id)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              title="Iniciar Pomodoro de repaso para este tema"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
