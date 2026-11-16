import { Subject, SubjectSmartGoal, SmartGoalMilestone } from '../types';
import { getTodayLocalDateStr } from './dateUtils';

export const SMART_GOALS_STORAGE_KEY = 'studyflow_smart_goals_v1';
export const SMART_MILESTONES_STORAGE_KEY = 'studyflow_smart_milestones_v1';

interface LegacySmartGoalEntry {
  id: string;
  title: string;
  subjectName: string;
  priority: 'alta' | 'media' | 'baja';
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
  milestones: string[];
}

interface LegacySmartGoalsStoredData {
  workloadDiagnosis: string;
  recommendedWeeklyHours: number;
  generatedAt?: string;
  timeframe?: 'semanal' | 'mensual' | 'examenes';
  smartGoals: LegacySmartGoalEntry[];
}

function readLegacyGoalsData(): LegacySmartGoalsStoredData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SMART_GOALS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LegacySmartGoalsStoredData) : null;
  } catch {
    return null;
  }
}

function readLegacyMilestonesMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SMART_MILESTONES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function extractDateFromText(text: string): string {
  const match = text?.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function addDaysIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

export function getSubjectSmartGoals(subject: Subject): SubjectSmartGoal[] {
  const subjectGoals = Array.isArray(subject.smartGoals) ? subject.smartGoals : [];
  const legacyData = readLegacyGoalsData();
  const legacyMilestones = readLegacyMilestonesMap();
  const normalizedSubName = (subject.name || '').trim().toLowerCase();
  const todayStr = getTodayLocalDateStr();

  const mergedById = new Map<string, SubjectSmartGoal>();

  subjectGoals.forEach((g) => {
    mergedById.set(g.id, g);
  });

  if (legacyData && Array.isArray(legacyData.smartGoals)) {
    legacyData.smartGoals.forEach((lg, idx) => {
      const legacySubName = (lg.subjectName || '').trim().toLowerCase();
      if (!legacySubName) return;
      const matchesSubject =
        legacySubName === normalizedSubName ||
        (normalizedSubName.length > 2 &&
          (legacySubName.includes(normalizedSubName) || normalizedSubName.includes(legacySubName)));

      if (!matchesSubject) return;

      const resolvedId = lg.id || `smart-legacy-${idx}`;
      if (mergedById.has(resolvedId)) return;

      const extractedDate = extractDateFromText(lg.timeBound);
      const milestones: SmartGoalMilestone[] = (lg.milestones || []).map((title, mIdx) => ({
        id: `${resolvedId}-m-${mIdx}`,
        title,
        completed: Boolean(legacyMilestones[`${resolvedId}__${mIdx}`]),
      }));

      mergedById.set(resolvedId, {
        id: resolvedId,
        subjectId: subject.id,
        subjectName: subject.name,
        title: lg.title,
        priority: lg.priority || 'media',
        timeframe: legacyData.timeframe || 'semanal',
        specific: lg.specific || '',
        measurable: lg.measurable || '',
        achievable: lg.achievable || '',
        relevant: lg.relevant || '',
        timeBound: lg.timeBound || 'Próximos 7 días',
        targetDate: extractedDate || addDaysIso(todayStr, 7),
        milestones,
        createdAt: legacyData.generatedAt || new Date().toISOString(),
        updatedAt: legacyData.generatedAt || new Date().toISOString(),
      });
    });
  }

  return Array.from(mergedById.values());
}

export interface SmartGoalProgressSummary {
  pct: number;
  completedMilestones: number;
  totalMilestones: number;
  linkedTasksTotal: number;
  linkedTasksDone: number;
  daysRemaining: number | null;
  status: 'completed' | 'overdue' | 'due_soon' | 'on_track';
}

export function calculateSmartGoalProgress(
  goal: SubjectSmartGoal,
  subject?: Subject
): SmartGoalProgressSummary {
  const milestones = Array.isArray(goal.milestones) ? goal.milestones : [];
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => m.completed).length;

  const linkedTasks = (subject?.tasks || []).filter((tk) => tk.smartGoalId === goal.id);
  const linkedTasksTotal = linkedTasks.length;
  const linkedTasksDone = linkedTasks.filter((tk) => tk.completed).length;

  const hasNumericTarget =
    typeof goal.targetValue === 'number' &&
    goal.targetValue > 0 &&
    typeof goal.currentValue === 'number';

  let pct = 0;

  if (hasNumericTarget) {
    pct = Math.min(100, Math.max(0, Math.round(((goal.currentValue || 0) / goal.targetValue!) * 100)));
  } else if (totalMilestones > 0 && linkedTasksTotal > 0) {
    const milestoneRatio = completedMilestones / totalMilestones;
    const taskRatio = linkedTasksDone / linkedTasksTotal;
    pct = Math.round(((milestoneRatio + taskRatio) / 2) * 100);
  } else if (totalMilestones > 0) {
    pct = Math.round((completedMilestones / totalMilestones) * 100);
  } else if (linkedTasksTotal > 0) {
    pct = Math.round((linkedTasksDone / linkedTasksTotal) * 100);
  }

  const todayStr = getTodayLocalDateStr();
  let daysRemaining: number | null = null;
  if (goal.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate)) {
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const [gy, gm, gd] = goal.targetDate.split('-').map(Number);
    const tMs = new Date(ty, tm - 1, td, 12, 0, 0).getTime();
    const gMs = new Date(gy, gm - 1, gd, 12, 0, 0).getTime();
    daysRemaining = Math.round((gMs - tMs) / 86400000);
  }

  let status: SmartGoalProgressSummary['status'] = 'on_track';
  if (pct >= 100) {
    status = 'completed';
  } else if (daysRemaining !== null && daysRemaining < 0) {
    status = 'overdue';
  } else if (daysRemaining !== null && daysRemaining <= 3) {
    status = 'due_soon';
  }

  return {
    pct,
    completedMilestones,
    totalMilestones,
    linkedTasksTotal,
    linkedTasksDone,
    daysRemaining,
    status,
  };
}

export function syncSubjectsSmartGoalsToLegacyStorage(subjects: Subject[]): void {
  if (typeof window === 'undefined') return;
  try {
    const existingLegacy = readLegacyGoalsData();
    const existingMilestones = readLegacyMilestonesMap();
    const nextMilestones = { ...existingMilestones };

    const mergedGoalsMap = new Map<string, LegacySmartGoalEntry>();

    // Keep any existing legacy goals whose subject isn't covered directly yet
    (existingLegacy?.smartGoals || []).forEach((g) => {
      if (g.id) mergedGoalsMap.set(g.id, g);
    });

    subjects.forEach((sub) => {
      (sub.smartGoals || []).forEach((sg) => {
        mergedGoalsMap.set(sg.id, {
          id: sg.id,
          title: sg.title,
          subjectName: sub.name,
          priority: sg.priority,
          specific: sg.specific,
          measurable: sg.measurable,
          achievable: sg.achievable,
          relevant: sg.relevant,
          timeBound: sg.timeBound || sg.targetDate,
          milestones: (sg.milestones || []).map((m) => m.title),
        });
        (sg.milestones || []).forEach((m, idx) => {
          nextMilestones[`${sg.id}__${idx}`] = Boolean(m.completed);
        });
      });
    });

    const nextStored: LegacySmartGoalsStoredData = {
      workloadDiagnosis:
        existingLegacy?.workloadDiagnosis ||
        `Planificación activa con ${subjects.length} asignaturas.`,
      recommendedWeeklyHours: existingLegacy?.recommendedWeeklyHours || 20,
      generatedAt: new Date().toISOString(),
      timeframe: existingLegacy?.timeframe || 'semanal',
      smartGoals: Array.from(mergedGoalsMap.values()),
    };

    window.localStorage.setItem(SMART_GOALS_STORAGE_KEY, JSON.stringify(nextStored));
    window.localStorage.setItem(SMART_MILESTONES_STORAGE_KEY, JSON.stringify(nextMilestones));
    window.dispatchEvent(new CustomEvent('studyflow-smart-goals-updated'));
  } catch {
    // ignore storage quota errors
  }
}

export function removeGoalFromLegacyStorage(goalId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existingLegacy = readLegacyGoalsData();
    if (!existingLegacy) return;
    const filtered = (existingLegacy.smartGoals || []).filter((g) => g.id !== goalId);
    window.localStorage.setItem(
      SMART_GOALS_STORAGE_KEY,
      JSON.stringify({
        ...existingLegacy,
        smartGoals: filtered,
      })
    );
    window.dispatchEvent(new CustomEvent('studyflow-smart-goals-updated'));
  } catch {
    // ignore storage errors
  }
}

export function upsertGoalOnSubject(
  subject: Subject,
  goal: SubjectSmartGoal,
  allSubjectsContext?: Subject[]
): Subject {
  const existing = getSubjectSmartGoals(subject);
  const idx = existing.findIndex((g) => g.id === goal.id);
  const nextGoals =
    idx >= 0
      ? existing.map((g, i) => (i === idx ? goal : g))
      : [goal, ...existing];

  const updatedSubject: Subject = {
    ...subject,
    smartGoals: nextGoals,
  };

  const contextList = (allSubjectsContext || [subject]).map((s) =>
    s.id === subject.id ? updatedSubject : s
  );
  syncSubjectsSmartGoalsToLegacyStorage(contextList);
  return updatedSubject;
}

export function deleteGoalFromSubject(
  subject: Subject,
  goalId: string,
  allSubjectsContext?: Subject[]
): Subject {
  const existing = getSubjectSmartGoals(subject);
  const nextGoals = existing.filter((g) => g.id !== goalId);
  const updatedSubject: Subject = {
    ...subject,
    smartGoals: nextGoals,
  };

  removeGoalFromLegacyStorage(goalId);
  const contextList = (allSubjectsContext || [subject]).map((s) =>
    s.id === subject.id ? updatedSubject : s
  );
  syncSubjectsSmartGoalsToLegacyStorage(contextList);
  return updatedSubject;
}
