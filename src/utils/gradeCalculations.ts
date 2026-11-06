import { Subject, Exam, Task } from '../types';

export interface EvaluatedItemContribution {
  id: string;
  title: string;
  type: 'exam' | 'task';
  weight?: number; // Porcentaje de peso (0-100)
  grade?: number; // Nota de 0 a 10
  contributionPoints: number; // Puntos que aporta sobre 10 (grade * weight / 100)
  status: 'graded' | 'pending';
  convocatoriaOrDueDate?: string;
  isGradedTask?: boolean;
}

export interface SubjectGradeSummary {
  hasMetrics: boolean;
  totalItemsCount: number;
  gradedItemsCount: number;
  totalWeightConfigured: number;
  gradedWeightEvaluated: number;
  pendingWeight: number;
  accumulatedPointsOn10: number;
  weightedAverageGrade: number | null;
  simpleAverageGraded: number | null;
  passingGrade: number;
  isPassingSecured: boolean;
  requiredGradeOnRemaining: number | null;
  itemsBreakdown: EvaluatedItemContribution[];
  statusLabel: 'sin_datos' | 'en_progreso' | 'aprobado_asegurado' | 'sobresaliente' | 'alerta_recuperacion';
}

/**
 * Calcula automáticamente la nota ponderada final de una asignatura
 * a partir de sus exámenes y tareas que tengan puntuaciones o ponderaciones opcionales.
 */
export function calculateSubjectGradeSummary(
  subject: Subject,
  customPassingGrade: number = 5.0
): SubjectGradeSummary {
  const passingGrade = subject.gradingConfig?.passingGrade ?? customPassingGrade;
  const itemsBreakdown: EvaluatedItemContribution[] = [];

  let sumWeightedPoints = 0;
  let sumEvaluatedWeight = 0;
  let sumAllConfiguredWeight = 0;
  let sumSimpleScores = 0;
  let countSimpleScores = 0;

  // Process Exams
  (subject.exams || []).forEach((ex: Exam) => {
    const rawGrade = ex.finalGrade !== undefined ? ex.finalGrade : ex.actualGrade;
    const grade = rawGrade !== undefined && !isNaN(rawGrade) ? Math.min(10, Math.max(0, rawGrade)) : undefined;
    const rawWeight = ex.weightPercentage !== undefined ? ex.weightPercentage : ex.weight;
    const weight = rawWeight !== undefined && !isNaN(rawWeight) ? Math.min(100, Math.max(0, rawWeight)) : undefined;

    if (weight !== undefined) {
      sumAllConfiguredWeight += weight;
    }

    const isGraded = grade !== undefined;
    const contributionPoints = isGraded && weight !== undefined ? (grade * weight) / 100 : 0;

    if (isGraded) {
      sumSimpleScores += grade;
      countSimpleScores += 1;
      if (weight !== undefined) {
        sumWeightedPoints += contributionPoints;
        sumEvaluatedWeight += weight;
      }
    }

    itemsBreakdown.push({
      id: ex.id,
      title: ex.title,
      type: 'exam',
      weight,
      grade,
      contributionPoints: Math.round(contributionPoints * 100) / 100,
      status: isGraded ? 'graded' : 'pending',
      convocatoriaOrDueDate: ex.convocatoria || ex.date,
    });
  });

  // Process Tasks
  (subject.tasks || []).forEach((tsk: Task) => {
    const rawGrade = tsk.score;
    // Normalize grade to 0-10 if maxScore is given and not 10
    let grade: number | undefined = undefined;
    if (rawGrade !== undefined && !isNaN(rawGrade)) {
      if (tsk.maxScore && tsk.maxScore > 0 && tsk.maxScore !== 10) {
        grade = Math.min(10, Math.max(0, (rawGrade / tsk.maxScore) * 10));
      } else {
        grade = Math.min(10, Math.max(0, rawGrade));
      }
    }

    const rawWeight = tsk.weightPercentage;
    const weight = rawWeight !== undefined && !isNaN(rawWeight) ? Math.min(100, Math.max(0, rawWeight)) : undefined;

    if (weight !== undefined) {
      sumAllConfiguredWeight += weight;
    }

    const isGraded = grade !== undefined;
    const contributionPoints = grade !== undefined && weight !== undefined ? (grade * weight) / 100 : 0;

    if (grade !== undefined) {
      sumSimpleScores += grade;
      countSimpleScores += 1;
      if (weight !== undefined) {
        sumWeightedPoints += contributionPoints;
        sumEvaluatedWeight += weight;
      }
    }

    // Only include in breakdown if it is marked as graded, has score, has weight, or user has added metrics
    if (tsk.isGraded || grade !== undefined || weight !== undefined) {
      itemsBreakdown.push({
        id: tsk.id,
        title: tsk.title,
        type: 'task',
        weight,
        grade,
        contributionPoints: Math.round(contributionPoints * 100) / 100,
        status: isGraded ? 'graded' : 'pending',
        convocatoriaOrDueDate: tsk.dueDate,
        isGradedTask: tsk.isGraded,
      });
    }
  });

  const hasMetrics = itemsBreakdown.length > 0 || countSimpleScores > 0 || sumAllConfiguredWeight > 0;
  const gradedItemsCount = countSimpleScores;
  const totalItemsCount = itemsBreakdown.length;

  const accumulatedPointsOn10 = Math.round(sumWeightedPoints * 100) / 100;
  const weightedAverageGrade =
    sumEvaluatedWeight > 0
      ? Math.round(((sumWeightedPoints * 100) / sumEvaluatedWeight) * 100) / 100
      : null;

  const simpleAverageGraded =
    countSimpleScores > 0
      ? Math.round((sumSimpleScores / countSimpleScores) * 100) / 100
      : null;

  const pendingWeight = Math.max(0, 100 - sumEvaluatedWeight);
  const isPassingSecured = accumulatedPointsOn10 >= passingGrade;

  let requiredGradeOnRemaining: number | null = null;
  if (!isPassingSecured && pendingWeight > 0) {
    const neededPoints = passingGrade - accumulatedPointsOn10;
    const req = (neededPoints / (pendingWeight / 100));
    requiredGradeOnRemaining = Math.round(Math.max(0, req) * 100) / 100;
  }

  let statusLabel: SubjectGradeSummary['statusLabel'] = 'sin_datos';
  if (!hasMetrics || (gradedItemsCount === 0 && sumAllConfiguredWeight === 0)) {
    statusLabel = 'sin_datos';
  } else if (accumulatedPointsOn10 >= 9.0) {
    statusLabel = 'sobresaliente';
  } else if (isPassingSecured) {
    statusLabel = 'aprobado_asegurado';
  } else if (pendingWeight > 0 && (requiredGradeOnRemaining || 0) > 10) {
    statusLabel = 'alerta_recuperacion';
  } else {
    statusLabel = 'en_progreso';
  }

  return {
    hasMetrics,
    totalItemsCount,
    gradedItemsCount,
    totalWeightConfigured: Math.round(sumAllConfiguredWeight * 10) / 10,
    gradedWeightEvaluated: Math.round(sumEvaluatedWeight * 10) / 10,
    pendingWeight: Math.round(pendingWeight * 10) / 10,
    accumulatedPointsOn10,
    weightedAverageGrade,
    simpleAverageGraded,
    passingGrade,
    isPassingSecured,
    requiredGradeOnRemaining,
    itemsBreakdown,
    statusLabel,
  };
}
