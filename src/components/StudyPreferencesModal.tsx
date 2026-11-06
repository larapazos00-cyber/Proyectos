import React, { useState } from 'react';
import {
  Settings,
  Clock,
  Calendar,
  Check,
  X,
  Bell,
  BellRing,
  Volume2,
  Sliders,
  Layout,
  Sparkles,
  GraduationCap,
  ClipboardList,
  Brain,
  Timer,
  Send,
  AlertTriangle,
  Plus,
  Trash2,
  Target,
  ShieldAlert,
  BookOpen,
  RotateCw,
} from 'lucide-react';
import {
  StudyPreferences,
  WeeklyObligation,
  Subject,
  PomodoroLog,
  ContextualNotificationRule,
  StudyProgram,
  ForgettingCurveProfile,
  SpacedRepetitionConfig,
} from '../types';
import { notificationService, DEFAULT_CONTEXTUAL_RULES } from '../services/notificationService';
import { schedulerService } from '../services/schedulerService';
import { WeeklyAvailabilityPlanner } from './WeeklyAvailabilityPlanner';
import { SpacedRepetitionPreferencesPanel } from './SpacedRepetitionPreferencesPanel';

interface StudyPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: StudyPreferences;
  onSavePreferences: (updated: StudyPreferences) => void;
  subjects?: Subject[];
  pomodoroLogs?: PomodoroLog[];
  programs?: StudyProgram[];
  onUpdatePrograms?: (updatedPrograms: StudyProgram[]) => void;
  activeProgramId?: string;
}

const DEFAULT_TABS = [
  { id: 'curso', defaultLabel: 'General' },
  { id: 'asignaturas', defaultLabel: 'Materias' },
  { id: 'calendario', defaultLabel: 'Plan y Repasos' },
  { id: 'cuestionarios', defaultLabel: 'Cuestionarios' },
  { id: 'pomodoro', defaultLabel: 'Pomodoro' },
  { id: 'estadisticas', defaultLabel: 'Estadísticas' },
];

export const StudyPreferencesModal: React.FC<StudyPreferencesModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
  subjects = [],
  pomodoroLogs = [],
  programs = [],
  onUpdatePrograms,
  activeProgramId,
}) => {
  const [activePrefView, setActivePrefView] = useState<
    'general' | 'notificaciones_push' | 'reglas_repeticion' | 'reglas_contextuales'
  >('general');
  const [availableDays, setAvailableDays] = useState<number[]>(preferences.availableDays || [1, 2, 3, 4, 5]);
  const [hoursPerDay, setHoursPerDay] = useState<Record<number, number>>(
    preferences.hoursPerDay || { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 4, 0: 0 }
  );
  const [dailyGoalHours, setDailyGoalHours] = useState<number>(
    preferences.dailyGoalHours ?? preferences.hoursPerDay?.[new Date().getDay()] ?? 3
  );
  // Velocidad de Lectura Promedio (en páginas por hora) y su equivalente en minutos por página
  const [readingSpeedPagesPerHour, setReadingSpeedPagesPerHour] = useState<number>(
    preferences.readingSpeedPagesPerHour ??
      (preferences.averageMinutesPerPage
        ? Math.round((60 / Math.max(0.5, preferences.averageMinutesPerPage)) * 10) / 10
        : 8)
  );
  const [averageMinutesPerPage, setAverageMinutesPerPage] = useState<number>(
    preferences.averageMinutesPerPage ??
      (preferences.readingSpeedPagesPerHour
        ? Math.round((60 / Math.max(1, preferences.readingSpeedPagesPerHour)) * 100) / 100
        : 7.5)
  );
  const [useDifficultyScalingForPages, setUseDifficultyScalingForPages] = useState<boolean>(
    preferences.useDifficultyScalingForPages ?? true
  );
  const [defaultPagesPerTopic, setDefaultPagesPerTopic] = useState<number>(
    preferences.defaultPagesPerTopic ?? 15
  );
  const [readingSpeedRecalcNotice, setReadingSpeedRecalcNotice] = useState<string | null>(null);
  const [defaultSubjectWeeklyGoalHours, setDefaultSubjectWeeklyGoalHours] = useState<number>(
    preferences.defaultSubjectWeeklyGoalHours ?? 4
  );
  const [subjectWeeklyGoalHours, setSubjectWeeklyGoalHours] = useState<Record<string, number>>(
    preferences.subjectWeeklyGoalHours || {}
  );
  const [contextualRules, setContextualRules] = useState<ContextualNotificationRule[]>(
    preferences.contextualNotificationRules && preferences.contextualNotificationRules.length > 0
      ? preferences.contextualNotificationRules
      : DEFAULT_CONTEXTUAL_RULES
  );

  // Form state for adding a new custom contextual rule
  const [showNewRuleForm, setShowNewRuleForm] = useState<boolean>(false);
  const [newRuleName, setNewRuleName] = useState<string>('');
  const [newRuleCondition, setNewRuleCondition] = useState<ContextualNotificationRule['conditionType']>(
    'subject_below_weekly_goal'
  );
  const [newRuleSubjectId, setNewRuleSubjectId] = useState<string>('all');
  const [newRuleThresholdHours, setNewRuleThresholdHours] = useState<number>(4);
  const [newRuleThresholdPct, setNewRuleThresholdPct] = useState<number>(50);
  const [newRuleEvalDay, setNewRuleEvalDay] = useState<'any' | 'midweek' | 'weekend'>('any');
  const [newRuleSuggestedMins, setNewRuleSuggestedMins] = useState<number>(25);

  const handleChangeReadingSpeedPagesPerHour = (pagesPerHourVal: number) => {
    const clampedPagesPerHour = Math.max(1, Math.min(60, Math.round(pagesPerHourVal * 10) / 10));
    const derivedMinsPerPage = Math.round((60 / clampedPagesPerHour) * 100) / 100;
    setReadingSpeedPagesPerHour(clampedPagesPerHour);
    setAverageMinutesPerPage(derivedMinsPerPage);
  };

  const handleChangeMinutesPerPage = (minsPerPageVal: number) => {
    const clampedMins = Math.max(1, Math.min(60, Math.round(minsPerPageVal * 100) / 100));
    const derivedPagesPerHour = Math.round((60 / clampedMins) * 10) / 10;
    setAverageMinutesPerPage(clampedMins);
    setReadingSpeedPagesPerHour(derivedPagesPerHour);
  };

  React.useEffect(() => {
    setAvailableDays(preferences.availableDays || [1, 2, 3, 4, 5]);
    setHoursPerDay(preferences.hoursPerDay || { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 4, 0: 0 });
    setDailyGoalHours(
      preferences.dailyGoalHours ?? preferences.hoursPerDay?.[new Date().getDay()] ?? 3
    );
    const resolvedPagesPerHour =
      preferences.readingSpeedPagesPerHour ??
      (preferences.averageMinutesPerPage
        ? Math.round((60 / Math.max(0.5, preferences.averageMinutesPerPage)) * 10) / 10
        : 8);
    const resolvedMinsPerPage =
      preferences.averageMinutesPerPage ??
      Math.round((60 / Math.max(1, resolvedPagesPerHour)) * 100) / 100;
    setReadingSpeedPagesPerHour(resolvedPagesPerHour);
    setAverageMinutesPerPage(resolvedMinsPerPage);
    setUseDifficultyScalingForPages(preferences.useDifficultyScalingForPages ?? true);
    setDefaultPagesPerTopic(preferences.defaultPagesPerTopic ?? 15);
    setDefaultSubjectWeeklyGoalHours(preferences.defaultSubjectWeeklyGoalHours ?? 4);
    setSubjectWeeklyGoalHours(preferences.subjectWeeklyGoalHours || {});
    setContextualRules(
      preferences.contextualNotificationRules && preferences.contextualNotificationRules.length > 0
        ? preferences.contextualNotificationRules
        : DEFAULT_CONTEXTUAL_RULES
    );
    setCustomIntervals(preferences.spacedRepetitionConfig?.intervals || [1, 3, 7, 15, 30]);
    setPhaseNotifications(preferences.spacedRepetitionConfig?.phaseNotifications || [true, true, true, true, true]);
    setActiveProfileId(preferences.spacedRepetitionConfig?.activeProfileId || 'moderado');
    setSavedProfiles(preferences.spacedRepetitionConfig?.savedProfiles || []);
    setLastMassAppliedAt(preferences.spacedRepetitionConfig?.lastMassAppliedAt);
    setLastMassAppliedProgramName(preferences.spacedRepetitionConfig?.lastMassAppliedProgramName);
  }, [preferences, isOpen]);
  const [weeklyObligations, setWeeklyObligations] = useState<WeeklyObligation[]>(
    preferences.weeklyFixedObligations || []
  );
  const [enabledTabs, setEnabledTabs] = useState<string[]>(
    preferences.enabledTabs || ['curso', 'asignaturas', 'calendario', 'cuestionarios', 'pomodoro', 'estadisticas']
  );
  const [navigationPosition, setNavigationPosition] = useState<'top' | 'sidebar'>(
    preferences.navigationPosition || 'top'
  );
  const [pomodoroFocus, setPomodoroFocus] = useState<number>(
    preferences.pomodoroConfig?.focusMinutes || 25
  );
  const [pomodoroShortBreak, setPomodoroShortBreak] = useState<number>(
    preferences.pomodoroConfig?.shortBreakMinutes || 5
  );
  const [pomodoroLongBreak, setPomodoroLongBreak] = useState<number>(
    preferences.pomodoroConfig?.longBreakMinutes || 15
  );

  // Notification Preferences State
  const [enableWebNotifications, setEnableWebNotifications] = useState<boolean>(
    preferences.enableWebNotifications ?? false
  );
  const [enableBrowserPushService, setEnableBrowserPushService] = useState<boolean>(
    preferences.enableBrowserPushService ?? notificationService.isPushSubscribed()
  );
  const [notifyOverdueReviewsBackground, setNotifyOverdueReviewsBackground] = useState<boolean>(
    preferences.notifyOverdueReviewsBackground ?? true
  );
  const [isPushSubscribing, setIsPushSubscribing] = useState<boolean>(false);
  const [overdueCheckNotice, setOverdueCheckNotice] = useState<string | null>(null);
  const [notifyClassStart, setNotifyClassStart] = useState<boolean>(
    preferences.notifyClassStart ?? true
  );
  const [classReminderMinutesBefore, setClassReminderMinutesBefore] = useState<number>(
    preferences.classReminderMinutesBefore ?? 15
  );
  const [notifyTaskDeadlines, setNotifyTaskDeadlines] = useState<boolean>(
    preferences.notifyTaskDeadlines ?? true
  );
  const [taskReminderDaysAhead, setTaskReminderDaysAhead] = useState<number>(
    preferences.taskReminderDaysAhead ?? 2
  );
  const [taskNotifyOnlyHighPriority, setTaskNotifyOnlyHighPriority] = useState<boolean>(
    preferences.taskNotifyOnlyHighPriority ?? false
  );
  const [notifyDailyReviews, setNotifyDailyReviews] = useState<boolean>(
    preferences.notifyDailyReviews ?? true
  );
  const [spacedRepetitionReminderTime, setSpacedRepetitionReminderTime] = useState<string>(
    preferences.spacedRepetitionReminderTime || preferences.customReminderTime || '09:00'
  );
  const [spacedRepetitionIncludeOverdue, setSpacedRepetitionIncludeOverdue] = useState<boolean>(
    preferences.spacedRepetitionIncludeOverdue ?? true
  );
  // Reglas de Repetición Espaciada y Curva del Olvido
  const [customIntervals, setCustomIntervals] = useState<[number, number, number, number, number]>(
    preferences.spacedRepetitionConfig?.intervals || [1, 3, 7, 15, 30]
  );
  const [phaseNotifications, setPhaseNotifications] = useState<[boolean, boolean, boolean, boolean, boolean]>(
    preferences.spacedRepetitionConfig?.phaseNotifications || [true, true, true, true, true]
  );
  const [activeProfileId, setActiveProfileId] = useState<string>(
    preferences.spacedRepetitionConfig?.activeProfileId || 'moderado'
  );
  const [savedProfiles, setSavedProfiles] = useState<ForgettingCurveProfile[]>(
    preferences.spacedRepetitionConfig?.savedProfiles || []
  );
  const [lastMassAppliedAt, setLastMassAppliedAt] = useState<string | undefined>(
    preferences.spacedRepetitionConfig?.lastMassAppliedAt
  );
  const [lastMassAppliedProgramName, setLastMassAppliedProgramName] = useState<string | undefined>(
    preferences.spacedRepetitionConfig?.lastMassAppliedProgramName
  );
  const [notifyPomodoroBreaks, setNotifyPomodoroBreaks] = useState<boolean>(
    preferences.notifyPomodoroBreaks ?? true
  );
  const [notifyUpcomingExams, setNotifyUpcomingExams] = useState<boolean>(
    preferences.notifyUpcomingExams ?? true
  );
  const [examReminderDaysAhead, setExamReminderDaysAhead] = useState<number>(
    preferences.examReminderDaysAhead || 7
  );
  const [customReminderTime, setCustomReminderTime] = useState<string>(
    preferences.customReminderTime || '09:00'
  );
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [lastTestedEvent, setLastTestedEvent] = useState<string | null>(null);
  const [pushErrorNotice, setPushErrorNotice] = useState<string | null>(null);

  React.useEffect(() => {
    setEnableWebNotifications(preferences.enableWebNotifications ?? false);
    setEnableBrowserPushService(
      preferences.enableBrowserPushService ?? notificationService.isPushSubscribed()
    );
    setNotifyOverdueReviewsBackground(preferences.notifyOverdueReviewsBackground ?? true);
    setNotifyClassStart(preferences.notifyClassStart ?? true);
    setClassReminderMinutesBefore(preferences.classReminderMinutesBefore ?? 15);
    setNotifyTaskDeadlines(preferences.notifyTaskDeadlines ?? true);
    setTaskReminderDaysAhead(preferences.taskReminderDaysAhead ?? 2);
    setTaskNotifyOnlyHighPriority(preferences.taskNotifyOnlyHighPriority ?? false);
    setNotifyDailyReviews(preferences.notifyDailyReviews ?? true);
    setSpacedRepetitionReminderTime(
      preferences.spacedRepetitionReminderTime || preferences.customReminderTime || '09:00'
    );
    setSpacedRepetitionIncludeOverdue(preferences.spacedRepetitionIncludeOverdue ?? true);
    setNotifyPomodoroBreaks(preferences.notifyPomodoroBreaks ?? true);
    setNotifyUpcomingExams(preferences.notifyUpcomingExams ?? true);
    setExamReminderDaysAhead(preferences.examReminderDaysAhead || 7);
    setCustomReminderTime(preferences.customReminderTime || '09:00');
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, [preferences, isOpen]);

  if (!isOpen) return null;

  const daysOfWeek = [
    { day: 1, label: 'Lunes' },
    { day: 2, label: 'Martes' },
    { day: 3, label: 'Miércoles' },
    { day: 4, label: 'Jueves' },
    { day: 5, label: 'Viernes' },
    { day: 6, label: 'Sábado' },
    { day: 0, label: 'Domingo' },
  ];

  const handleToggleDay = (day: number) => {
    if (availableDays.includes(day)) {
      setAvailableDays(availableDays.filter((d) => d !== day));
    } else {
      setAvailableDays([...availableDays, day]);
      if (!hoursPerDay[day]) {
        setHoursPerDay({ ...hoursPerDay, [day]: 3.0 });
      }
    }
  };

  const handleHoursChange = (day: number, hours: number) => {
    setHoursPerDay({
      ...hoursPerDay,
      [day]: Math.max(0.5, Math.min(12, hours)),
    });
  };

  // Total weekly calculation
  const totalWeeklyHours = availableDays.reduce((acc, d) => acc + (hoursPerDay[d] || 0), 0);
  const scheduledClassesCount = weeklyObligations.filter((o) => o.category === 'clase').length;

  const handleTriggerTestByType = async (
    type:
      | 'class_start'
      | 'task_deadline'
      | 'spaced_repetition'
      | 'exam'
      | 'pomodoro'
      | 'contextual_rule'
      | 'general',
    label: string
  ) => {
    setPushErrorNotice(null);
    if (notifPermission !== 'granted') {
      const granted = await notificationService.requestPermission();
      setNotifPermission(granted ? 'granted' : Notification.permission);
      if (granted) {
        setEnableWebNotifications(true);
      } else {
        setPushErrorNotice(
          'Para ver la notificación emergente del sistema, concede el permiso de notificaciones en tu navegador. (Se ha reproducido el aviso sonoro de prueba).'
        );
      }
    }
    notificationService.sendTestNotificationByType(type);
    setLastTestedEvent(label);
    setTimeout(() => {
      setLastTestedEvent((prev) => (prev === label ? null : prev));
    }, 3500);
  };

  // Estadísticas en vivo para la pantalla de Notificaciones Push (Exámenes próximos y Repaso Espaciado)
  const todayIsoStr = new Date().toISOString().split('T')[0];
  const upcomingExamsSummary = React.useMemo(() => {
    const allUpcoming: Array<{ title: string; date: string; subjectName: string; daysLeft: number }> = [];
    subjects.forEach((sub) => {
      (sub.exams || []).forEach((ex) => {
        if (ex.completed || !ex.date) return;
        const diff = Math.round(
          (new Date(`${ex.date}T00:00:00`).getTime() - new Date(`${todayIsoStr}T00:00:00`).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (diff >= 0) {
          allUpcoming.push({
            title: ex.title,
            date: ex.date,
            subjectName: sub.name,
            daysLeft: diff,
          });
        }
      });
    });
    allUpcoming.sort((a, b) => a.daysLeft - b.daysLeft);
    const withinThreshold = allUpcoming.filter((e) => e.daysLeft <= examReminderDaysAhead);
    return {
      totalUpcoming: allUpcoming.length,
      withinThresholdCount: withinThreshold.length,
      nextExam: allUpcoming[0] || null,
    };
  }, [subjects, examReminderDaysAhead, todayIsoStr]);

  const spacedReviewsSummary = React.useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    subjects.forEach((sub) => {
      (sub.topics || []).forEach((t) => {
        if (!t.nextReviewDate) return;
        if (t.nextReviewDate === todayIsoStr) dueToday++;
        else if (t.nextReviewDate < todayIsoStr) overdue++;
      });
    });
    return { dueToday, overdue, totalPendingReviews: dueToday + overdue };
  }, [subjects, todayIsoStr]);

  const handleAddContextualRule = () => {
    if (!newRuleName.trim()) return;
    const rule: ContextualNotificationRule = {
      id: `ctx-rule-${Date.now()}`,
      name: newRuleName.trim(),
      conditionType: newRuleCondition,
      subjectId: newRuleSubjectId,
      thresholdHours: newRuleThresholdHours,
      thresholdPercentage: newRuleThresholdPct,
      evaluationDay: newRuleEvalDay,
      suggestedMinutes: newRuleSuggestedMins,
      enabled: true,
    };
    setContextualRules((prev) => [...prev, rule]);
    setNewRuleName('');
    setShowNewRuleForm(false);
  };

  const handleToggleRule = (id: string) => {
    setContextualRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRule = (id: string) => {
    setContextualRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDistributeSubjectGoals = () => {
    if (subjects.length === 0) return;
    const perSubject = Math.max(1, Math.round((totalWeeklyHours / subjects.length) * 2) / 2);
    const updated: Record<string, number> = {};
    subjects.forEach((s) => {
      updated[s.id] = perSubject;
    });
    setSubjectWeeklyGoalHours(updated);
    setDefaultSubjectWeeklyGoalHours(perSubject);
  };

  // Live preview of contextual alerts against current subjects & pomodoroLogs
  const previewPreferences: StudyPreferences = {
    ...preferences,
    dailyGoalHours,
    readingSpeedPagesPerHour,
    averageMinutesPerPage,
    useDifficultyScalingForPages,
    defaultPagesPerTopic,
    defaultSubjectWeeklyGoalHours,
    subjectWeeklyGoalHours,
    contextualNotificationRules: contextualRules,
  };
  const liveEvaluatedAlerts = notificationService.evaluateContextualRules(
    subjects,
    previewPreferences,
    pomodoroLogs
  );

  // Estadísticas en vivo del impacto de la Velocidad de Lectura Promedio (págs/hora) en los temas pendientes de cada asignatura
  const allTopicsInSubjects = subjects.flatMap((s) => s.topics || []);
  const liveReadingSpeedImpact = schedulerService.calculateSubjectEstimatedStudyHours(
    allTopicsInSubjects,
    {
      readingSpeedPagesPerHour,
      averageMinutesPerPage,
      useDifficultyScalingForPages,
      defaultPagesPerTopic,
    }
  );
  const livePendingBySubject = schedulerService.calculatePendingTopicsBySubject(subjects, {
    readingSpeedPagesPerHour,
    averageMinutesPerPage,
    useDifficultyScalingForPages,
    defaultPagesPerTopic,
  });

  const handleRecalculateTopicsWithReadingSpeed = () => {
    if (!onUpdatePrograms || programs.length === 0) return;
    const res = schedulerService.recalculateProgramsByReadingSpeed(programs, {
      readingSpeedPagesPerHour,
      averageMinutesPerPage,
      useDifficultyScalingForPages,
      defaultPagesPerTopic,
    });
    onUpdatePrograms(res.updatedPrograms);
    setReadingSpeedRecalcNotice(
      `¡Tiempos actualizados a ${readingSpeedPagesPerHour} págs/hora! Se han recalculado ${res.pendingTopicsCount} temas pendientes (${res.pendingPagesCount} págs por completar → ${res.pendingEstimatedHours}h restantes; ${res.totalEstimatedHours}h totales del curso).`
    );
    setTimeout(() => setReadingSpeedRecalcNotice(null), 5000);
  };

  const handleSave = () => {
    const updatedPrefs: StudyPreferences = {
      ...preferences,
      availableDays,
      hoursPerDay,
      dailyGoalHours,
      readingSpeedPagesPerHour,
      averageMinutesPerPage,
      useDifficultyScalingForPages,
      defaultPagesPerTopic,
      defaultSubjectWeeklyGoalHours,
      subjectWeeklyGoalHours,
      contextualNotificationRules: contextualRules,
      weeklyFixedObligations: weeklyObligations,
      enabledTabs,
      navigationPosition,
      pomodoroConfig: {
        focusMinutes: pomodoroFocus,
        shortBreakMinutes: pomodoroShortBreak,
        longBreakMinutes: pomodoroLongBreak,
        longBreakInterval: 4,
      },
      enableWebNotifications,
      enableBrowserPushService,
      notifyOverdueReviewsBackground,
      notifyClassStart,
      classReminderMinutesBefore,
      notifyTaskDeadlines,
      taskReminderDaysAhead,
      taskNotifyOnlyHighPriority,
      notifyDailyReviews,
      spacedRepetitionReminderTime,
      spacedRepetitionIncludeOverdue,
      notifyPomodoroBreaks,
      notifyUpcomingExams,
      examReminderDaysAhead,
      customReminderTime: spacedRepetitionReminderTime || customReminderTime,
      spacedRepetitionConfig: {
        activeProfileId,
        intervals: customIntervals,
        phaseNotifications,
        savedProfiles,
        lastMassAppliedAt,
        lastMassAppliedProgramName,
      },
    };

    if (onUpdatePrograms && programs.length > 0) {
      const recalc = schedulerService.recalculateProgramsByReadingSpeed(programs, updatedPrefs);
      onUpdatePrograms(recalc.updatedPrograms);
    }

    onSavePreferences(updatedPrefs);
    onClose();
  };

  const handleToggleTab = (tabId: string) => {
    if (enabledTabs.includes(tabId)) {
      if (enabledTabs.length > 1) {
        setEnabledTabs(enabledTabs.filter((t) => t !== tabId));
      }
    } else {
      setEnabledTabs([...enabledTabs, tabId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Preferencias de Estudio, Metas y Reglas de Notificación</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Horario semanal, metas por asignatura, reglas de notificaciones contextuales y módulos.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* View Switcher inside Preferences */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-900/70 p-1 rounded-xl w-fit flex-wrap">
            <button
              type="button"
              onClick={() => setActivePrefView('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activePrefView === 'general'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Horario y Pomodoro</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePrefView('notificaciones_push')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activePrefView === 'notificaciones_push'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notificaciones Push</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  notifPermission === 'granted' && enableWebNotifications
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                    : notifPermission === 'denied'
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                }`}
              >
                {notifPermission === 'granted' && enableWebNotifications
                  ? 'Activas'
                  : notifPermission === 'denied'
                  ? 'Bloqueadas'
                  : 'Configurar'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActivePrefView('reglas_repeticion')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activePrefView === 'reglas_repeticion'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Reglas de Repetición Espaciada</span>
              <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-semibold">
                {activeProfileId === 'intensivo'
                  ? 'Intensivo'
                  : activeProfileId === 'moderado'
                  ? 'Moderado'
                  : activeProfileId === 'relajado'
                  ? 'Relajado'
                  : savedProfiles.find((p) => p.id === activeProfileId)?.name || 'Personalizado'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActivePrefView('reglas_contextuales')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activePrefView === 'reglas_contextuales'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Reglas Contextuales y Metas</span>
              {liveEvaluatedAlerts.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-mono-numbers">
                  {liveEvaluatedAlerts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {activePrefView === 'reglas_repeticion' ? (
            <SpacedRepetitionPreferencesPanel
              customIntervals={customIntervals}
              onChangeIntervals={setCustomIntervals}
              phaseNotifications={phaseNotifications}
              onChangePhaseNotifications={setPhaseNotifications}
              activeProfileId={activeProfileId}
              onSelectProfileId={setActiveProfileId}
              savedProfiles={savedProfiles}
              onUpdateSavedProfiles={setSavedProfiles}
              programs={programs}
              onUpdatePrograms={onUpdatePrograms}
              activeProgramId={activeProgramId}
              lastMassAppliedAt={lastMassAppliedAt}
              lastMassAppliedProgramName={lastMassAppliedProgramName}
              onTriggerSave={(cfg) => {
                setLastMassAppliedAt(cfg.lastMassAppliedAt);
                setLastMassAppliedProgramName(cfg.lastMassAppliedProgramName);
                onSavePreferences({
                  ...preferences,
                  spacedRepetitionConfig: cfg,
                });
              }}
            />
          ) : activePrefView === 'reglas_contextuales' ? (
            <div className="space-y-6">
              {/* Sub-section A: Metas Semanales por Asignatura */}
              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/70 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Metas Semanales de Estudio por Asignatura</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Define cuántas horas semanales deseas dedicar a cada materia. Se usan tanto en las gráficas de Estadísticas como en las reglas de alerta contextual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDistributeSubjectGoals}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    Repartir {totalWeeklyHours}h equitativamente
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    Meta semanal por defecto para nuevas asignaturas:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0.5}
                      max={40}
                      step={0.5}
                      value={defaultSubjectWeeklyGoalHours}
                      onChange={(e) =>
                        setDefaultSubjectWeeklyGoalHours(Math.max(0.5, parseFloat(e.target.value) || 4))
                      }
                      className="w-16 px-2 py-1 text-center font-mono-numbers font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <span className="text-slate-500 text-[11px]">h / semana</span>
                  </div>
                </div>

                {subjects.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {subjects.map((sub) => {
                      const goalVal =
                        subjectWeeklyGoalHours[sub.id] ?? defaultSubjectWeeklyGoalHours;
                      return (
                        <div
                          key={sub.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: sub.color || '#3b82f6' }}
                            />
                            <div className="truncate">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                                {sub.name}
                              </span>
                              {sub.programName && (
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {sub.programName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min={0.5}
                              max={40}
                              step={0.5}
                              value={goalVal}
                              onChange={(e) => {
                                const val = Math.max(0.5, parseFloat(e.target.value) || 1);
                                setSubjectWeeklyGoalHours((prev) => ({
                                  ...prev,
                                  [sub.id]: val,
                                }));
                              }}
                              className="w-14 px-1.5 py-1 text-center font-mono-numbers font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                            <span className="text-[11px] text-slate-400">h/sem</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No hay asignaturas activas cargadas en este momento.
                  </p>
                )}
              </div>

              {/* Sub-section B: Reglas de Notificaciones Contextuales */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Reglas de Notificaciones Contextuales</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Configura alertas inteligentes cuando el tiempo acumulado de estudio de una materia sea menor a su meta semanal o exista riesgo académico.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTriggerTestByType('contextual_rule', 'Regla Contextual')}
                      className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Probar Alerta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewRuleForm((prev) => !prev)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nueva Regla</span>
                    </button>
                  </div>
                </div>

                {lastTestedEvent && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
                    <span>Notificación de prueba enviada: {lastTestedEvent}</span>
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Form to create a new Contextual Notification Rule */}
                {showNewRuleForm && (
                  <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/70 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-950 dark:text-blue-200">
                        Añadir Regla de Notificación Contextual
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewRuleForm(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Nombre descriptivo de la regla
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Alerta si Cálculo baja de 4h semanales"
                          value={newRuleName}
                          onChange={(e) => setNewRuleName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Condición disparadora
                        </label>
                        <select
                          value={newRuleCondition}
                          onChange={(e) =>
                            setNewRuleCondition(
                              e.target.value as ContextualNotificationRule['conditionType']
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="subject_below_weekly_goal">
                            Tiempo acumulado semanal de materia menor a la meta establecida
                          </option>
                          <option value="daily_goal_deficit">
                            Tiempo de estudio diario inferior a la meta diaria
                          </option>
                          <option value="topic_stagnation">
                            Materia con avance de temario inferior al umbral (%)
                          </option>
                          <option value="exam_readiness_low">
                            Examen próximo con baja cobertura de estudio
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Materia objetivo
                        </label>
                        <select
                          value={newRuleSubjectId}
                          onChange={(e) => setNewRuleSubjectId(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="all">Todas las asignaturas activas</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Meta / Umbral (h)
                          </label>
                          <input
                            type="number"
                            min={0.5}
                            max={30}
                            step={0.5}
                            value={newRuleThresholdHours}
                            onChange={(e) =>
                              setNewRuleThresholdHours(Math.max(0.5, parseFloat(e.target.value) || 2))
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-numbers"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Umbral Avance (%)
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={100}
                            step={5}
                            value={newRuleThresholdPct}
                            onChange={(e) =>
                              setNewRuleThresholdPct(Math.max(10, Math.min(100, parseInt(e.target.value) || 50)))
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-numbers"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Momento de evaluación
                        </label>
                        <select
                          value={newRuleEvalDay}
                          onChange={(e) =>
                            setNewRuleEvalDay(e.target.value as 'any' | 'midweek' | 'weekend')
                          }
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                        >
                          <option value="any">Cualquier día de la semana</option>
                          <option value="midweek">Mitad de semana (Miércoles a Domingo)</option>
                          <option value="weekend">Fin de semana (Viernes a Domingo)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Acción Pomodoro sugerida (min)
                        </label>
                        <input
                          type="number"
                          min={15}
                          max={90}
                          step={5}
                          value={newRuleSuggestedMins}
                          onChange={(e) =>
                            setNewRuleSuggestedMins(Math.max(15, parseInt(e.target.value) || 25))
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-numbers"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowNewRuleForm(false)}
                        className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleAddContextualRule}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl cursor-pointer"
                      >
                        Guardar Regla
                      </button>
                    </div>
                  </div>
                )}

                {/* List of configured Contextual Notification Rules */}
                <div className="space-y-2.5">
                  {contextualRules.map((rule) => {
                    const targetSubjectName =
                      !rule.subjectId || rule.subjectId === 'all'
                        ? 'Todas las materias'
                        : subjects.find((s) => s.id === rule.subjectId)?.name || 'Materia seleccionada';

                    return (
                      <div
                        key={rule.id}
                        className={`p-3.5 rounded-2xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          rule.enabled
                            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                            : 'bg-slate-50/70 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => handleToggleRule(rule.id)}
                            className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                              <span>{rule.name}</span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                {targetSubjectName}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {rule.conditionType === 'subject_below_weekly_goal' &&
                                `Envía alerta cuando las horas acumuladas en la semana estén por debajo del ${
                                  rule.thresholdPercentage ?? 100
                                }% de la meta semanal (${rule.thresholdHours ?? defaultSubjectWeeklyGoalHours}h).`}
                              {rule.conditionType === 'daily_goal_deficit' &&
                                `Envía alerta si la dedicación diaria es menor a ${rule.thresholdHours ?? dailyGoalHours}h.`}
                              {rule.conditionType === 'topic_stagnation' &&
                                `Envía alerta cuando el avance de temas completados sea menor al ${
                                  rule.thresholdPercentage ?? 25
                                }%.`}
                              {rule.conditionType === 'exam_readiness_low' &&
                                `Envía alerta ante examen próximo si el dominio del temario es menor al ${
                                  rule.thresholdPercentage ?? 50
                                }%.`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400">Umbral %:</span>
                            <input
                              type="number"
                              min={10}
                              max={100}
                              step={5}
                              value={rule.thresholdPercentage ?? 100}
                              onChange={(e) => {
                                const val = Math.max(10, Math.min(100, parseInt(e.target.value) || 50));
                                setContextualRules((prev) =>
                                  prev.map((r) =>
                                    r.id === rule.id ? { ...r, thresholdPercentage: val } : r
                                  )
                                );
                              }}
                              className="w-11 text-center font-mono-numbers font-bold bg-transparent text-slate-800 dark:text-slate-200"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar regla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-section C: Live Diagnosis of Active Contextual Rules */}
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Diagnóstico en Tiempo Real según tus Logs de Pomodoro</span>
                  </h5>
                  <span className="text-[11px] font-mono-numbers font-semibold text-amber-800 dark:text-amber-300">
                    {liveEvaluatedAlerts.length} alerta(s) activa(s)
                  </span>
                </div>

                {liveEvaluatedAlerts.length > 0 ? (
                  <div className="space-y-2">
                    {liveEvaluatedAlerts.slice(0, 5).map((item, idx) => (
                      <div
                        key={`${item.rule.id}-${item.subject.id}-${idx}`}
                        className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200/70 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.subject.name}:{' '}
                            <span className="font-mono-numbers text-amber-700 dark:text-amber-400">
                              {item.accumulatedHours}h acumuladas
                            </span>{' '}
                            frente a{' '}
                            <span className="font-mono-numbers font-bold">
                              {item.targetHours}h de meta semanal
                            </span>
                          </div>
                          {item.suggestedTopicTitle && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Sugerencia activa: Dedica 25 min al tema «{item.suggestedTopicTitle}»
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            notificationService.notifyContextualRuleAlert(
                              item.rule.name,
                              item.subject.name,
                              item.accumulatedHours,
                              item.targetHours,
                              item.suggestedTopicTitle
                            );
                            setLastTestedEvent(item.subject.name);
                          }}
                          className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 text-amber-900 dark:text-amber-200 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0"
                        >
                          Emitir aviso ahora
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    ¡Excelente! Todas tus asignaturas cumplen actualmente los umbrales de las reglas activas.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
          {activePrefView === 'general' && (
            <>
          {/* Section 1: Calendario de Disponibilidad y Horario Fijo Semanal */}
          <WeeklyAvailabilityPlanner
            obligations={weeklyObligations}
            onUpdateObligations={setWeeklyObligations}
            hoursPerDay={hoursPerDay}
            onApplyCalculatedHours={(calcHours) => {
              setHoursPerDay(calcHours);
              const active = Object.entries(calcHours)
                .filter(([_, hrs]) => hrs > 0)
                .map(([d]) => Number(d));
              if (active.length > 0) {
                setAvailableDays(active);
              }
            }}
          />

          {/* Section 1.5: Velocidad de Lectura Promedio (Páginas por Hora) */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-emerald-50/40 dark:from-indigo-950/40 dark:via-slate-800/80 dark:to-slate-900 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Velocidad de Lectura Promedio (Páginas por Hora)</span>
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 max-w-xl">
                  Define tu velocidad de lectura promedio en páginas por hora. Este valor se utiliza en el planificador para recalcular automáticamente el tiempo estimado necesario para completar los temas pendientes de cada asignatura.
                </p>
              </div>

              {/* Controles acoplados: Páginas por hora (principal) y Minutos por página (equivalencia sincronizada) */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border-2 border-indigo-400 dark:border-indigo-500 shadow-2xs">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-0.5">
                    Velocidad de Lectura Promedio
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="60"
                      aria-label="Velocidad de Lectura Promedio (páginas por hora)"
                      value={readingSpeedPagesPerHour}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          handleChangeReadingSpeedPagesPerHour(val);
                        }
                      }}
                      className="w-16 bg-indigo-50/80 dark:bg-slate-800 border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-1 text-center font-mono-numbers font-extrabold text-sm text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      páginas / hora
                    </span>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                    Ritmo por página equivalente
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="60"
                      value={averageMinutesPerPage}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          handleChangeMinutesPerPage(val);
                        }
                      }}
                      className="w-14 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-1 text-center font-mono-numbers font-bold text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      min / pág
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Slider + Presets de Velocidad en Páginas por Hora */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                  Lectura densa (3 págs/h)
                </span>
                <input
                  type="range"
                  min="3"
                  max="25"
                  step="0.5"
                  value={Math.min(25, Math.max(3, readingSpeedPagesPerHour))}
                  onChange={(e) => handleChangeReadingSpeedPagesPerHour(parseFloat(e.target.value) || 8)}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-indigo-200 dark:bg-slate-700 rounded-lg"
                />
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  Lectura rápida (25 págs/h)
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">
                    Perfiles de velocidad (págs/hora):
                  </span>
                  {[
                    { pph: 5, label: '5 págs/h (12m/pág · Densa)' },
                    { pph: 6, label: '6 págs/h (10m/pág · Técnica)' },
                    { pph: 8, label: '8 págs/h (7.5m/pág · Estándar)' },
                    { pph: 10, label: '10 págs/h (6m/pág · Fluida)' },
                    { pph: 12, label: '12 págs/h (5m/pág · Ágil)' },
                    { pph: 15, label: '15 págs/h (4m/pág · Rápida)' },
                  ].map((preset) => (
                    <button
                      key={preset.pph}
                      type="button"
                      onClick={() => handleChangeReadingSpeedPagesPerHour(preset.pph)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-numbers font-bold transition-colors cursor-pointer ${
                        Math.abs(readingSpeedPagesPerHour - preset.pph) < 0.2
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Escalado por dificultad y páginas por defecto */}
            <div className="pt-3 border-t border-indigo-200/60 dark:border-slate-700/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={useDifficultyScalingForPages}
                    onChange={(e) => setUseDifficultyScalingForPages(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>
                    Modular velocidad (páginas/hora) según la dificultad del tema (Baja / Media / Alta)
                  </span>
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    Páginas por defecto si un tema no indica nº de págs:
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={defaultPagesPerTopic}
                    onChange={(e) =>
                      setDefaultPagesPerTopic(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 15)))
                    }
                    className="w-14 px-2 py-0.5 text-center font-mono-numbers font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-500">págs</span>
                </div>
              </div>

              {/* Desglose visual de tiempos por página según dificultad */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {(['Baja', 'Media', 'Alta'] as const).map((diff) => {
                  const pPerHour = schedulerService.getPagesPerHour(
                    diff,
                    readingSpeedPagesPerHour,
                    useDifficultyScalingForPages,
                    averageMinutesPerPage
                  );
                  const effMins = schedulerService.getMinutesPerPage(
                    diff,
                    averageMinutesPerPage,
                    useDifficultyScalingForPages,
                    readingSpeedPagesPerHour
                  );
                  const sample20PagesHours = Math.round((20 / Math.max(0.5, pPerHour)) * 10) / 10;

                  return (
                    <div
                      key={diff}
                      className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            diff === 'Baja'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : diff === 'Media'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          Dificultad {diff}
                        </span>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono-numbers">
                          Tema de 20 págs → <strong>{sample20PagesHours}h</strong>
                        </div>
                      </div>
                      <div className="text-right font-mono-numbers">
                        <div className="font-extrabold text-indigo-700 dark:text-indigo-300 text-xs">
                          {pPerHour} págs/h
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          ~{effMins} min/pág
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desglose por asignatura del tiempo estimado para completar los temas pendientes */}
              {livePendingBySubject.subjectBreakdowns.length > 0 && (
                <div className="p-3 rounded-xl bg-white/85 dark:bg-slate-900/85 border border-indigo-200/70 dark:border-slate-700 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Tiempo estimado para completar temas pendientes por asignatura (a {readingSpeedPagesPerHour} págs/h):
                    </span>
                    <span className="font-mono-numbers font-bold text-indigo-700 dark:text-indigo-300">
                      {livePendingBySubject.totalPendingTopics} temas pendientes · {livePendingBySubject.totalPendingPages} págs restantes → {livePendingBySubject.totalPendingEstimatedHours}h
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {livePendingBySubject.subjectBreakdowns.map((subItem) => (
                      <div
                        key={subItem.subjectId}
                        className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: subItem.subjectColor }}
                          />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                              {subItem.subjectName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono-numbers">
                              {subItem.pendingTopicsCount} temas pend. · {subItem.pendingPages} págs por leer
                            </span>
                          </div>
                        </div>
                        <div className="text-right font-mono-numbers shrink-0">
                          <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 font-extrabold">
                            {subItem.pendingEstimatedHours}h rest.
                          </span>
                          <span className="block text-[9px] text-slate-400 mt-0.5">
                            de {subItem.totalEstimatedHours}h totales
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen de impacto en el temario actual y botón de recálculo inmediato */}
              <div className="p-3 rounded-xl bg-indigo-950/5 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                    <span>Temas pendientes en tus asignaturas:</span>
                    <span className="font-mono-numbers text-indigo-700 dark:text-indigo-300">
                      {liveReadingSpeedImpact.pendingPages} págs pendientes ({liveReadingSpeedImpact.pendingTopicsCount} temas)
                    </span>
                    <span>→</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono-numbers font-extrabold">
                      {liveReadingSpeedImpact.pendingEstimatedHours}h estimadas para completar pendientes
                    </span>
                    <span className="text-[11px] font-mono-numbers text-slate-500">
                      ({liveReadingSpeedImpact.totalEstimatedHours}h curso completo)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Al guardar o pulsar «Recalcular temas ahora», el schedulerService recalcula el tiempo estimado de los temas pendientes de cada asignatura usando {readingSpeedPagesPerHour} págs/hora.
                  </p>
                </div>

                {onUpdatePrograms && programs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRecalculateTopicsWithReadingSpeed}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-2xs transition-colors cursor-pointer shrink-0"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Recalcular temas ahora</span>
                  </button>
                )}
              </div>

              {readingSpeedRecalcNotice && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center justify-between">
                  <span>{readingSpeedRecalcNotice}</span>
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Meta Diaria de Estudio y Horas por Jornada */}
          <div className="space-y-3 pt-2">
            {/* Meta Diaria Global Configurada en Preferencias */}
            <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/40 dark:from-blue-950/40 dark:via-slate-800/80 dark:to-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Meta Diaria de Estudio (Resumen Diario)</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Objetivo diario de referencia mostrado en el widget «Resumen Diario» de la vista Curso.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="14"
                    value={dailyGoalHours}
                    onChange={(e) => {
                      const val = Math.max(0.5, Math.min(14, parseFloat(e.target.value) || 1));
                      setDailyGoalHours(val);
                    }}
                    className="w-20 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl px-2.5 py-1.5 text-center font-mono-numbers font-extrabold text-sm text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">horas / día</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-blue-200/50 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">Valores rápidos:</span>
                  {[1.5, 2, 3, 4, 5, 6].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDailyGoalHours(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-numbers font-bold transition-colors cursor-pointer ${
                        dailyGoalHours === preset
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300'
                      }`}
                    >
                      {preset}h
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const updated: Record<number, number> = { ...hoursPerDay };
                    availableDays.forEach((d) => {
                      updated[d] = dailyGoalHours;
                    });
                    setHoursPerDay(updated);
                  }}
                  className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Aplicar {dailyGoalHours}h a todos los días activos
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Horas Disponibles por Día (Cálculo Efectivo)
              </h4>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 font-mono-numbers">
                Total: {Math.round(totalWeeklyHours * 10) / 10}h / semana
              </span>
            </div>

            <div className="space-y-2">
              {daysOfWeek.map(({ day, label }) => {
                const isSelected = availableDays.includes(day);
                const currentHours = hoursPerDay[day] || 3.0;

                return (
                  <div
                    key={day}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/30 border-blue-200'
                        : 'bg-slate-50/50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleDay(day)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-900">{label}</span>
                    </div>

                    {isSelected ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">Horas disponibles:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="12"
                          value={currentHours}
                          onChange={(e) => handleHoursChange(day, parseFloat(e.target.value) || 1)}
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-mono-numbers font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-slate-500 text-xs">horas</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Descanso</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Pomodoro settings */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              2. Parámetros del Temporizador Pomodoro
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Enfoque (min)
                </label>
                <input
                  type="number"
                  value={pomodoroFocus}
                  onChange={(e) => setPomodoroFocus(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono-numbers text-center text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Pausa Corta (min)
                </label>
                <input
                  type="number"
                  value={pomodoroShortBreak}
                  onChange={(e) => setPomodoroShortBreak(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono-numbers text-center text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Pausa Larga (min)
                </label>
                <input
                  type="number"
                  value={pomodoroLongBreak}
                  onChange={(e) => setPomodoroLongBreak(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono-numbers text-center text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          </div>
            </>
          )}

          {/* Section 3: Pantalla de Configuración de Permisos de Notificaciones Push y Selección de Alertas */}
          <div
            className={`space-y-4 ${
              activePrefView === 'general'
                ? 'pt-4 border-t border-slate-200 dark:border-slate-800'
                : ''
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>3. Permisos de Notificaciones Push y Selección de Alertas</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Gestiona los permisos push de tu navegador y elige qué tipos de alertas recibir (exámenes próximos, sesiones Pomodoro o repaso espaciado).
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activePrefView !== 'notificaciones_push' && (
                  <button
                    type="button"
                    onClick={() => setActivePrefView('notificaciones_push')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    Abrir vista dedicada
                  </button>
                )}
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    notifPermission === 'granted'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : notifPermission === 'denied'
                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {notifPermission === 'granted'
                    ? 'Permiso Push Concedido'
                    : notifPermission === 'denied'
                    ? 'Permiso Bloqueado en Navegador'
                    : 'Permiso del Navegador Pendiente'}
                </span>
              </div>
            </div>

            {/* Bloque 1: Gestión de Permisos del Navegador e Interruptor Maestro */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Activar Notificaciones Push en el Navegador
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Autoriza al navegador a mostrar alertas emergentes y sonoras en tiempo real, incluso con la pestaña en segundo plano.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {notifPermission !== 'granted' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setPushErrorNotice(null);
                        const granted = await notificationService.requestPermission();
                        setNotifPermission(granted ? 'granted' : Notification.permission);
                        if (granted) {
                          setEnableWebNotifications(true);
                          notificationService.sendTestNotification();
                          setLastTestedEvent('Permiso de Navegador Concedido');
                        } else {
                          setPushErrorNotice(
                            'El navegador no concedió el permiso de notificaciones. Si está bloqueado, habilítalo desde el icono del candado en la barra de direcciones.'
                          );
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Solicitar Permiso Push
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && 'Notification' in window) {
                          setNotifPermission(Notification.permission);
                        }
                        notificationService.sendTestNotification();
                        setLastTestedEvent('Verificación de Permiso del Navegador');
                      }}
                      className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                    >
                      Probar permiso activo
                    </button>
                  )}

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableWebNotifications}
                      onChange={(e) => setEnableWebNotifications(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="ml-2 font-bold text-slate-800 dark:text-slate-200">
                      {enableWebNotifications ? 'Activadas' : 'Desactivadas'}
                    </span>
                  </label>
                </div>
              </div>

              {notifPermission === 'denied' && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-[11px] text-rose-800 dark:text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold">
                      Las notificaciones están bloqueadas en la configuración de tu navegador.
                    </p>
                    <p className="text-rose-700 dark:text-rose-300">
                      Haz clic en el icono de ajustes o candado junto a la URL en la barra de direcciones, cambia «Notificaciones» a «Permitir» y pulsa en «Actualizar estado».
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined' && 'Notification' in window) {
                        setNotifPermission(Notification.permission);
                      }
                    }}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 rounded-lg font-bold text-rose-700 dark:text-rose-300 cursor-pointer shrink-0"
                  >
                    Actualizar estado
                  </button>
                </div>
              )}

              {pushErrorNotice && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
                  <span>{pushErrorNotice}</span>
                  <button
                    type="button"
                    onClick={() => setPushErrorNotice(null)}
                    className="text-amber-700 dark:text-amber-300 font-bold cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              )}

              {/* SERVICIO DE SUSCRIPCIÓN A NOTIFICACIONES PUSH PARA NAVEGADORES (SERVICE WORKER) */}
              <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <span className="font-bold text-blue-950 dark:text-blue-100 text-xs">
                        Servicio Push en Segundo Plano (Service Worker)
                      </span>
                      <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-0.5">
                        Permite recibir alertas del navegador para exámenes próximos, sesiones Pomodoro y repasos espaciados incluso si la pestaña está minimizada.
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      enableBrowserPushService || notificationService.isPushSubscribed()
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {enableBrowserPushService || notificationService.isPushSubscribed()
                      ? '🟢 Suscripción Push Activa'
                      : '⚪ Sin Suscripción Activa'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-900/60">
                  <button
                    type="button"
                    disabled={isPushSubscribing}
                    onClick={async () => {
                      setIsPushSubscribing(true);
                      setPushErrorNotice(null);
                      const res = await notificationService.subscribePushService();
                      setIsPushSubscribing(false);
                      if (res.success) {
                        setEnableBrowserPushService(true);
                        setEnableWebNotifications(true);
                        setNotifPermission('granted');
                        setLastTestedEvent('Suscripción Push para Navegador Activa');
                      } else {
                        setPushErrorNotice(res.error || 'No se pudo activar la suscripción push.');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>
                      {isPushSubscribing
                        ? 'Suscribiendo...'
                        : enableBrowserPushService
                        ? 'Revalidar Suscripción Push'
                        : 'Suscribirse a Notificaciones Push'}
                    </span>
                  </button>

                  {enableBrowserPushService && (
                    <button
                      type="button"
                      onClick={async () => {
                        await notificationService.unsubscribePushService();
                        setEnableBrowserPushService(false);
                        setLastTestedEvent('Suscripción Push en segundo plano pausada');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 text-slate-600 dark:text-slate-300 hover:text-rose-600 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span>Pausar suscripción</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      await notificationService.sendPushTestNotification(
                        '🔔 Prueba de Notificación Push en Segundo Plano',
                        'El servicio de Service Worker de StudyFlow está activo para alertar de exámenes, Pomodoro y repaso espaciado.'
                      );
                      setLastTestedEvent('Alerta Push Service Worker en Segundo Plano');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Probar en segundo plano</span>
                  </button>
                </div>
              </div>

              {/* Feedback de prueba de notificación */}
              {lastTestedEvent && (
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between text-xs text-blue-800 dark:text-blue-200 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>
                      Acción / notificación ejecutada: <strong>{lastTestedEvent}</strong>
                    </span>
                  </div>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              )}

              {/* Cabecera de Selección de Tipos de Alertas con acciones rápidas */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Elige qué tipos de alertas deseas recibir
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Activa o personaliza de forma independiente las alertas de Exámenes Próximos, Sesiones Pomodoro y Repaso Espaciado.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEnableWebNotifications(true);
                      setNotifyUpcomingExams(true);
                      setNotifyPomodoroBreaks(true);
                      setNotifyDailyReviews(true);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-100/80 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 hover:bg-blue-200/70 transition-colors cursor-pointer"
                  >
                    Activar las 3 alertas clave
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifyUpcomingExams(false);
                      setNotifyPomodoroBreaks(false);
                      setNotifyDailyReviews(false);
                      setNotifyClassStart(false);
                      setNotifyTaskDeadlines(false);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300/70 transition-colors cursor-pointer"
                  >
                    Silenciar todas
                  </button>
                </div>
              </div>

              {/* Tarjetas Principales: 1. Exámenes Próximos, 2. Sesiones Pomodoro, 3. Repaso Espaciado */}
              <div className="grid grid-cols-1 gap-3">
                {/* ALERTA CLAVE 1: EXÁMENES PRÓXIMOS */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    notifyUpcomingExams && enableWebNotifications
                      ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 shadow-2xs'
                      : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-[220px]">
                      <input
                        type="checkbox"
                        checked={notifyUpcomingExams}
                        onChange={(e) => setNotifyUpcomingExams(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            1. Exámenes Próximos
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                            {upcomingExamsSummary.withinThresholdCount} en umbral ({upcomingExamsSummary.totalUpcoming} totales)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Recibe avisos automáticos cuando se acerque la fecha de un examen parcial o final, indicando tus horas de estudio asignadas ese día.
                        </p>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleTriggerTestByType('exam', 'Examen Próximo')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 hover:text-indigo-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      title="Enviar notificación de prueba de Examen Próximo"
                    >
                      <Send className="w-3 h-3 text-indigo-600" />
                      <span>Probar alerta</span>
                    </button>
                  </div>

                  {notifyUpcomingExams && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          Avisar con antelación de:
                        </span>
                        <select
                          value={examReminderDaysAhead}
                          onChange={(e) => setExamReminderDaysAhead(Number(e.target.value))}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value={1}>1 día antes</option>
                          <option value={2}>2 días antes</option>
                          <option value={3}>3 días antes</option>
                          <option value={5}>5 días antes</option>
                          <option value={7}>7 días antes (Recomendado)</option>
                          <option value={14}>14 días antes</option>
                        </select>
                      </div>

                      {upcomingExamsSummary.nextExam && (
                        <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                          Próximo: <strong>{upcomingExamsSummary.nextExam.title}</strong> ({upcomingExamsSummary.nextExam.subjectName}) en{' '}
                          <span className="font-mono-numbers font-bold">
                            {upcomingExamsSummary.nextExam.daysLeft}d
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* ALERTA CLAVE 2: SESIONES POMODORO */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    notifyPomodoroBreaks && enableWebNotifications
                      ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 shadow-2xs'
                      : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-[220px]">
                      <input
                        type="checkbox"
                        checked={notifyPomodoroBreaks}
                        onChange={(e) => setNotifyPomodoroBreaks(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Timer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            2. Sesiones Pomodoro y Descansos
                          </span>
                          <span className="text-[10px] font-mono-numbers font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                            {pomodoroFocus}m foco · {pomodoroShortBreak}m pausa · {pomodoroLongBreak}m larga
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Notifica con alerta visual y timbre acústico al terminar cada bloque de estudio profundo y al concluir los descansos cortos o largos.
                        </p>
                      </div>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTriggerTestByType('pomodoro', 'Sesión Pomodoro Completada')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 hover:text-emerald-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title="Enviar notificación de prueba de Sesión Pomodoro"
                      >
                        <Send className="w-3 h-3 text-emerald-600" />
                        <span>Probar alerta</span>
                      </button>
                    </div>
                  </div>

                  {notifyPomodoroBreaks && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-600 dark:text-slate-400">
                        Incluye avisos para: <strong>Fin de Enfoque ({pomodoroFocus} min)</strong>, <strong>Pausa Corta ({pomodoroShortBreak} min)</strong> y <strong>Pausa Larga ({pomodoroLongBreak} min)</strong>.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          notificationService.notifyPomodoro('focus', 'Tema en estudio activo');
                          setLastTestedEvent('Fin de descanso Pomodoro (Vuelta al Foco)');
                        }}
                        className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Simular vuelta al foco
                      </button>
                    </div>
                  )}
                </div>

                {/* ALERTA CLAVE 3: REPASO ESPACIADO */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    notifyDailyReviews && enableWebNotifications
                      ? 'bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-700 shadow-2xs'
                      : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-[220px]">
                      <input
                        type="checkbox"
                        checked={notifyDailyReviews}
                        onChange={(e) => setNotifyDailyReviews(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            3. Repaso Espaciado (Curva del Olvido)
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800">
                            {spacedReviewsSummary.dueToday} hoy · {spacedReviewsSummary.overdue} atrasados
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Notifica qué temas cumplen hoy su ciclo de repetición espaciada ({customIntervals.join(', ')} días) para consolidar la memoria a largo plazo.
                        </p>
                      </div>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const res = notificationService.checkAndNotifyOverdueReviews(subjects, { force: true });
                          if (res.overdueCount > 0 || res.dueTodayCount > 0) {
                            setOverdueCheckNotice(
                              `Comprobación completada: ${res.overdueCount} repasos vencidos y ${res.dueTodayCount} para hoy. Alerta enviada.`
                            );
                          } else {
                            setOverdueCheckNotice('¡Al día! No se detectaron repasos vencidos ni pendientes para hoy.');
                          }
                          setTimeout(() => setOverdueCheckNotice(null), 5000);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors cursor-pointer"
                        title="Comprobar temas vencidos ahora"
                      >
                        <span>Comprobar hoy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerTestByType('spaced_repetition', 'Repaso Espaciado')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 text-slate-700 dark:text-slate-300 hover:text-purple-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title="Enviar notificación de prueba de Repaso Espaciado"
                      >
                        <Send className="w-3 h-3 text-purple-600" />
                        <span>Probar alerta</span>
                      </button>
                    </div>
                  </div>

                  {notifyDailyReviews && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">
                            Hora diaria del recordatorio:
                          </span>
                          <input
                            type="time"
                            value={spacedRepetitionReminderTime}
                            onChange={(e) => {
                              setSpacedRepetitionReminderTime(e.target.value);
                              setCustomReminderTime(e.target.value);
                            }}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-mono-numbers text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={spacedRepetitionIncludeOverdue}
                            onChange={(e) => setSpacedRepetitionIncludeOverdue(e.target.checked)}
                            className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                          />
                          <span>Incluir temas con repaso atrasado</span>
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                          <input
                            type="checkbox"
                            checked={notifyOverdueReviewsBackground}
                            onChange={(e) => setNotifyOverdueReviewsBackground(e.target.checked)}
                            className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                          />
                          <span>
                            Alertar en segundo plano cuando un repaso esté vencido (fases {customIntervals.join('d, ')}d)
                          </span>
                        </label>
                      </div>

                      {overdueCheckNotice && (
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] text-emerald-800 dark:text-emerald-200 font-medium">
                          {overdueCheckNotice}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ALERTAS COMPLEMENTARIAS: INICIO DE CLASE Y VENCIMIENTO DE TAREAS */}
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Alertas Académicas Complementarias
                  </span>

                  {/* INICIO DE CLASE */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${
                      notifyClassStart && enableWebNotifications
                        ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800/70 shadow-2xs'
                        : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={notifyClassStart}
                          onChange={(e) => setNotifyClassStart(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              Inicio de Clase (Horario Fijo)
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                              {scheduledClassesCount}{' '}
                              {scheduledClassesCount === 1 ? 'clase programada' : 'clases programadas'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Envía un recordatorio antes de que comience cada clase registrada en tu calendario semanal.
                          </p>
                        </div>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleTriggerTestByType('class_start', 'Inicio de Clase')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        <Send className="w-3 h-3 text-blue-600" />
                        <span>Probar aviso</span>
                      </button>
                    </div>

                    {notifyClassStart && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          Antelación del aviso antes de empezar la clase:
                        </span>
                        <select
                          value={classReminderMinutesBefore}
                          onChange={(e) => setClassReminderMinutesBefore(Number(e.target.value))}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={0}>Al inicio exacto (0 min)</option>
                          <option value={5}>5 minutos antes</option>
                          <option value={10}>10 minutos antes</option>
                          <option value={15}>15 minutos antes (Recomendado)</option>
                          <option value={30}>30 minutos antes</option>
                          <option value={60}>1 hora antes</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* VENCIMIENTO DE TAREAS */}
                  <div
                    className={`p-3.5 rounded-xl border transition-all ${
                      notifyTaskDeadlines && enableWebNotifications
                        ? 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/70 shadow-2xs'
                        : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={notifyTaskDeadlines}
                          onChange={(e) => setNotifyTaskDeadlines(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              Vencimiento de Tareas y Entregas
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Recibe alertas cuando se acerque la fecha límite de tus tareas, prácticas o fases de proyecto.
                          </p>
                        </div>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleTriggerTestByType('task_deadline', 'Vencimiento de Tareas')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 hover:text-amber-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        <Send className="w-3 h-3 text-amber-600" />
                        <span>Probar aviso</span>
                      </button>
                    </div>

                    {notifyTaskDeadlines && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">Avisar con:</span>
                          <select
                            value={taskReminderDaysAhead}
                            onChange={(e) => setTaskReminderDaysAhead(Number(e.target.value))}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value={0}>El mismo día de entrega</option>
                            <option value={1}>1 día de antelación</option>
                            <option value={2}>2 días de antelación (Recomendado)</option>
                            <option value={3}>3 días de antelación</option>
                            <option value={5}>5 días de antelación</option>
                            <option value={7}>1 semana de antelación</option>
                          </select>
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={taskNotifyOnlyHighPriority}
                            onChange={(e) => setTaskNotifyOnlyHighPriority(e.target.checked)}
                            className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                          />
                          <span>Solo prioridades Urgente y Alta</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {activePrefView === 'general' && (
          /* Section 4: Personalización y Gestión de Pestañas */
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layout className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>4. Personalizar y Mostrar/Ocultar Pestañas del Sistema</span>
              </h4>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-numbers">
                {enabledTabs.length} de {DEFAULT_TABS.length} activas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Activa, desactiva u oculta las secciones de navegación según tu método de estudio (ej: temarios, materias, pomodoro, cuestionarios...).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {DEFAULT_TABS.map(({ id, defaultLabel }) => {
                const isEnabled = enabledTabs.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleToggleTab(id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isEnabled
                        ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-2xs font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60'
                    }`}
                  >
                    <span className="text-xs">{defaultLabel}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono-numbers ${
                        isEnabled
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                      }`}
                    >
                      {isEnabled ? 'Visible' : 'Oculta'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selector de Posición del Menú: Superior vs Lateral */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Posición del Menú de Navegación
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Elige si prefieres la barra de navegación arriba o en un panel lateral izquierdo.
                </span>
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setNavigationPosition('top')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    navigationPosition === 'top'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Menú Superior
                </button>
                <button
                  type="button"
                  onClick={() => setNavigationPosition('sidebar')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    navigationPosition === 'sidebar'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Menú Lateral
                </button>
              </div>
            </div>
          </div>
          )}
            </>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Guardar Configuración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
