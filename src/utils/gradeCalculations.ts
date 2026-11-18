import { Subject, Exam, Task, AcademicTerm } from '../types';

export interface AcademicTermOption {
  value: AcademicTerm;
  label: string;
  shortLabel: string;
  group: 'trimestre' | 'cuatrimestre' | 'anual';
}

export const ACADEMIC_TERM_OPTIONS: AcademicTermOption[] = [
  { value: '1T', label: '1er Trimestre', shortLabel: '1T', group: 'trimestre' },
  { value: '2T', label: '2º Trimestre', shortLabel: '2T', group: 'trimestre' },
  { value: '3T', label: '3er Trimestre', shortLabel: '3T', group: 'trimestre' },
  { value: '1C', label: '1er Cuatrimestre', shortLabel: '1C', group: 'cuatrimestre' },
  { value: '2C', label: '2º Cuatrimestre', shortLabel: '2C', group: 'cuatrimestre' },
  { value: 'anual', label: 'Final / Anual', shortLabel: 'Anual', group: 'anual' },
];

export function getAcademicTermLabel(term?: AcademicTerm): string {
  if (!term) return 'Sin periodo';
  return ACADEMIC_TERM_OPTIONS.find((opt) => opt.value === term)?.label || term;
}

export function getAcademicTermShortLabel(term?: AcademicTerm): string {
  if (!term) return '—';
  return ACADEMIC_TERM_OPTIONS.find((opt) => opt.value === term)?.shortLabel || term;
}

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
  academicTerm?: AcademicTerm;
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
  effectiveGrade: number | null;
  passingGrade: number;
  isPassingSecured: boolean;
  requiredGradeOnRemaining: number | null;
  itemsBreakdown: EvaluatedItemContribution[];
  statusLabel:
    | 'sin_datos'
    | 'en_progreso'
    | 'aprobado_asegurado'
    | 'sobresaliente'
    | 'alerta_recuperacion';
}

export interface CourseSubjectGradeRow {
  subject: Subject;
  summary: SubjectGradeSummary;
  effectiveGrade: number | null;
  credits: number;
  passed: boolean;
}

export interface CourseTermBreakdown {
  term: AcademicTerm;
  label: string;
  shortLabel: string;
  group: 'trimestre' | 'cuatrimestre' | 'anual';
  averageGrade: number | null;
  simpleAverageGrade: number | null;
  creditsWeightedAverageGrade: number | null;
  gradedSubjectsCount: number;
  totalItemsCount: number;
  gradedItemsCount: number;
}

export interface CourseGradeSummary {
  termFilter: AcademicTerm | 'all';
  effectiveCourseAverage: number | null;
  simpleCourseAverage: number | null;
  creditsWeightedCourseAverage: number | null;
  totalSubjects: number;
  gradedSubjectsCount: number;
  passedSubjectsCount: number;
  failedSubjectsCount: number;
  totalCreditsGraded: number;
  totalEvaluatedItemsCount: number;
  unassignedGradedItemsCount: number;
  subjectRows: CourseSubjectGradeRow[];
  termBreakdowns: CourseTermBreakdown[];
}

/**
 * Calcula automáticamente la nota ponderada final (o media simple si no hay ponderaciones)
 * de una asignatura a partir de sus exámenes y tareas, con soporte opcional por trimestre o cuatrimestre.
 */
export function calculateSubjectGradeSummary(
  subject: Subject,
  customPassingGrade: number = 5.0,
  termFilter: AcademicTerm | 'all' = 'all'
): SubjectGradeSummary {
  const passingGrade = subject.gradingConfig?.passingGrade ?? customPassingGrade;
  const itemsBreakdown: EvaluatedItemContribution[] = [];

  let sumWeightedPoints = 0;
  let sumEvaluatedWeight = 0;
  let sumAllConfiguredWeight = 0;
  let sumSimpleScores = 0;
  let countSimpleScores = 0;

  const matchesTerm = (term?: AcademicTerm) => {
    if (!termFilter || termFilter === 'all') return true;
    return term === termFilter;
  };

  // Process Exams
  (subject.exams || [])
    .filter((ex: Exam) => matchesTerm(ex.academicTerm))
    .forEach((ex: Exam) => {
      const rawGrade = ex.finalGrade !== undefined ? ex.finalGrade : ex.actualGrade;
      const grade =
        rawGrade !== undefined && !isNaN(rawGrade)
          ? Math.min(10, Math.max(0, rawGrade))
          : undefined;
      const rawWeight = ex.weightPercentage !== undefined ? ex.weightPercentage : ex.weight;
      const weight =
        rawWeight !== undefined && !isNaN(rawWeight)
          ? Math.min(100, Math.max(0, rawWeight))
          : undefined;

      if (weight !== undefined) {
        sumAllConfiguredWeight += weight;
      }

      const isGraded = grade !== undefined;
      const contributionPoints =
        isGraded && weight !== undefined ? (grade * weight) / 100 : 0;

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
        academicTerm: ex.academicTerm,
      });
    });

  // Process Tasks
  (subject.tasks || [])
    .filter((tsk: Task) => matchesTerm(tsk.academicTerm))
    .forEach((tsk: Task) => {
      const rawGrade = tsk.score;
      let grade: number | undefined = undefined;
      if (rawGrade !== undefined && !isNaN(rawGrade)) {
        if (tsk.maxScore && tsk.maxScore > 0 && tsk.maxScore !== 10) {
          grade = Math.min(10, Math.max(0, (rawGrade / tsk.maxScore) * 10));
        } else {
          grade = Math.min(10, Math.max(0, rawGrade));
        }
      }

      const rawWeight = tsk.weightPercentage;
      const weight =
        rawWeight !== undefined && !isNaN(rawWeight)
          ? Math.min(100, Math.max(0, rawWeight))
          : undefined;

      if (weight !== undefined) {
        sumAllConfiguredWeight += weight;
      }

      const isGraded = grade !== undefined;
      const contributionPoints =
        grade !== undefined && weight !== undefined ? (grade * weight) / 100 : 0;

      if (grade !== undefined) {
        sumSimpleScores += grade;
        countSimpleScores += 1;
        if (weight !== undefined) {
          sumWeightedPoints += contributionPoints;
          sumEvaluatedWeight += weight;
        }
      }

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
          academicTerm: tsk.academicTerm,
        });
      }
    });

  const hasMetrics =
    itemsBreakdown.length > 0 || countSimpleScores > 0 || sumAllConfiguredWeight > 0;
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

  const effectiveGrade = weightedAverageGrade ?? simpleAverageGraded;

  const pendingWeight = Math.max(0, 100 - sumEvaluatedWeight);
  const isPassingSecured =
    sumEvaluatedWeight > 0
      ? accumulatedPointsOn10 >= passingGrade
      : (effectiveGrade ?? 0) >= passingGrade && countSimpleScores > 0;

  let requiredGradeOnRemaining: number | null = null;
  if (sumEvaluatedWeight > 0 && accumulatedPointsOn10 < passingGrade && pendingWeight > 0) {
    const neededPoints = passingGrade - accumulatedPointsOn10;
    const req = neededPoints / (pendingWeight / 100);
    requiredGradeOnRemaining = Math.round(Math.max(0, req) * 100) / 100;
  }

  let statusLabel: SubjectGradeSummary['statusLabel'] = 'sin_datos';
  if (!hasMetrics || (gradedItemsCount === 0 && sumAllConfiguredWeight === 0)) {
    statusLabel = 'sin_datos';
  } else if ((effectiveGrade ?? 0) >= 9.0 && (sumEvaluatedWeight === 0 || accumulatedPointsOn10 >= 9.0)) {
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
    effectiveGrade,
    passingGrade,
    isPassingSecured,
    requiredGradeOnRemaining,
    itemsBreakdown,
    statusLabel,
  };
}

/**
 * Calcula la nota media global del curso y el desglose por trimestre / cuatrimestre
 * combinando todas las asignaturas activas (ponderada por créditos ECTS si existen, más media simple).
 */
export function calculateCourseGradeSummary(
  subjects: Subject[],
  termFilter: AcademicTerm | 'all' = 'all'
): CourseGradeSummary {
  const computeForTerm = (targetTerm: AcademicTerm | 'all') => {
    const subjectRows: CourseSubjectGradeRow[] = subjects.map((subject) => {
      const summary = calculateSubjectGradeSummary(subject, 5.0, targetTerm);
      const effectiveGrade = summary.effectiveGrade;
      const credits = subject.credits && subject.credits > 0 ? subject.credits : 0;
      const passed = effectiveGrade !== null && effectiveGrade >= summary.passingGrade;
      return {
        subject,
        summary,
        effectiveGrade,
        credits,
        passed,
      };
    });

    const gradedRows = subjectRows.filter((r) => r.effectiveGrade !== null);
    const simpleCourseAverage =
      gradedRows.length > 0
        ? Math.round(
            (gradedRows.reduce((acc, r) => acc + (r.effectiveGrade || 0), 0) /
              gradedRows.length) *
              100
          ) / 100
        : null;

    const rowsWithCredits = gradedRows.filter((r) => r.credits > 0);
    const totalCreditsGraded = rowsWithCredits.reduce((acc, r) => acc + r.credits, 0);
    const creditsWeightedCourseAverage =
      totalCreditsGraded > 0
        ? Math.round(
            (rowsWithCredits.reduce(
              (acc, r) => acc + (r.effectiveGrade || 0) * r.credits,
              0
            ) /
              totalCreditsGraded) *
              100
          ) / 100
        : null;

    const effectiveCourseAverage = creditsWeightedCourseAverage ?? simpleCourseAverage;

    return {
      subjectRows,
      gradedRows,
      simpleCourseAverage,
      creditsWeightedCourseAverage,
      effectiveCourseAverage,
      totalCreditsGraded,
    };
  };

  const mainResult = computeForTerm(termFilter);

  let unassignedGradedItemsCount = 0;
  subjects.forEach((sub) => {
    (sub.exams || []).forEach((ex) => {
      const hasG = (ex.finalGrade ?? ex.actualGrade) !== undefined;
      if (hasG && !ex.academicTerm) unassignedGradedItemsCount += 1;
    });
    (sub.tasks || []).forEach((tsk) => {
      if (tsk.score !== undefined && !tsk.academicTerm) unassignedGradedItemsCount += 1;
    });
  });

  const termBreakdowns: CourseTermBreakdown[] = [];
  ACADEMIC_TERM_OPTIONS.forEach((opt) => {
    const termRes = computeForTerm(opt.value);
    const totalItemsCount = termRes.subjectRows.reduce(
      (acc, r) => acc + r.summary.totalItemsCount,
      0
    );
    const gradedItemsCount = termRes.subjectRows.reduce(
      (acc, r) => acc + r.summary.gradedItemsCount,
      0
    );

    if (totalItemsCount > 0 || gradedItemsCount > 0) {
      termBreakdowns.push({
        term: opt.value,
        label: opt.label,
        shortLabel: opt.shortLabel,
        group: opt.group,
        averageGrade: termRes.effectiveCourseAverage,
        simpleAverageGrade: termRes.simpleCourseAverage,
        creditsWeightedAverageGrade: termRes.creditsWeightedCourseAverage,
        gradedSubjectsCount: termRes.gradedRows.length,
        totalItemsCount,
        gradedItemsCount,
      });
    }
  });

  return {
    termFilter,
    effectiveCourseAverage: mainResult.effectiveCourseAverage,
    simpleCourseAverage: mainResult.simpleCourseAverage,
    creditsWeightedCourseAverage: mainResult.creditsWeightedCourseAverage,
    totalSubjects: subjects.length,
    gradedSubjectsCount: mainResult.gradedRows.length,
    passedSubjectsCount: mainResult.gradedRows.filter((r) => r.passed).length,
    failedSubjectsCount: mainResult.gradedRows.filter((r) => !r.passed).length,
    totalCreditsGraded: mainResult.totalCreditsGraded,
    totalEvaluatedItemsCount: mainResult.subjectRows.reduce(
      (acc, r) => acc + r.summary.gradedItemsCount,
      0
    ),
    unassignedGradedItemsCount,
    subjectRows: mainResult.subjectRows,
    termBreakdowns,
  };
}
