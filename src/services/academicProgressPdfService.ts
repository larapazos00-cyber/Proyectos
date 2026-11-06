import { jsPDF } from 'jspdf';
import { Subject, PomodoroLog, StudyPreferences, TopicStatus } from '../types';

export interface AcademicProgressPdfOptions {
  subjectFilterId?: string; // 'all' o ID de asignatura específica
  periodDays?: 'all' | 7 | 30; // Filtro temporal para pomodoroLogs
  includePomodoroLogHistory?: boolean;
  includeDetailedTopicsTable?: boolean;
  onlyStudiedTopics?: boolean; // Si true, en el desglose detallado muestra solo 'estudiado' y 'repasado'
  studentName?: string;
}

export interface AcademicProgressReportSummary {
  generatedAt: string;
  totalPomodoroSessions: number;
  totalPomodoroMinutes: number;
  totalPomodoroHours: number;
  last7DaysHours: number;
  last30DaysHours: number;
  totalTopics: number;
  studiedTopicsCount: number; // 'estudiado' + 'repasado'
   strictlyStudiedCount: number; // 'estudiado'
  reviewedTopicsCount: number; // 'repasado'
  inProgressTopicsCount: number; // 'en_progreso'
  pendingTopicsCount: number; // 'pendiente'
  completionPercentage: number;
  totalPages: number;
  readPages: number;
  totalActualTopicHours: number;
  totalEstimatedTopicHours: number;
  fileName: string;
}

/**
 * Sanitiza texto para las fuentes estándar de jsPDF manteniendo tildes y eñes
 */
function sanitizePdfText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/•/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7F\xA0-\xFF]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function hexToRgb(hexColor?: string): [number, number, number] {
  if (!hexColor) return [37, 99, 235];
  const hex = hexColor.replace('#', '').trim();
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return [r, g, b];
    }
  }
  return [37, 99, 235];
}

function getTopicStatusLabel(status: TopicStatus): string {
  switch (status) {
    case 'repasado':
      return 'Repasado';
    case 'estudiado':
      return 'Estudiado';
    case 'en_progreso':
      return 'En progreso';
    case 'pendiente':
    default:
      return 'Pendiente';
  }
}

function getTopicStatusColor(status: TopicStatus): [number, number, number] {
  switch (status) {
    case 'repasado':
      return [5, 150, 105]; // Emerald 600
    case 'estudiado':
      return [37, 99, 235]; // Blue 600
    case 'en_progreso':
      return [217, 119, 6]; // Amber 600
    case 'pendiente':
    default:
      return [100, 116, 139]; // Slate 500
  }
}

/**
 * Genera y descarga un resumen en PDF del progreso académico basado en los datos de
 * `pomodoroLogs` y el estado actual de los temas estudiados.
 */
export function exportAcademicProgressPdf(
  subjects: Subject[],
  pomodoroLogs: PomodoroLog[],
  preferences?: StudyPreferences,
  weeklyTargetHours: number = 20,
  options: AcademicProgressPdfOptions = {}
): AcademicProgressReportSummary {
  const {
    subjectFilterId = 'all',
    periodDays = 'all',
    includePomodoroLogHistory = true,
    includeDetailedTopicsTable = true,
    onlyStudiedTopics = false,
    studentName = '',
  } = options;

  const todayStr = new Date().toISOString().split('T')[0];

  // Filtrar asignaturas según selección
  const filteredSubjects =
    subjectFilterId && subjectFilterId !== 'all'
      ? subjects.filter((s) => s.id === subjectFilterId)
      : subjects;

  const allowedSubjectIds = new Set(filteredSubjects.map((s) => s.id));
  const allowedSubjectNames = new Set(
    filteredSubjects.map((s) => s.name.toLowerCase())
  );

  // Ventanas de fechas para métricas de Pomodoro
  const cutoff7Days = new Date();
  cutoff7Days.setDate(cutoff7Days.getDate() - 6);
  const cutoff7Str = cutoff7Days.toISOString().split('T')[0];

  const cutoff30Days = new Date();
  cutoff30Days.setDate(cutoff30Days.getDate() - 29);
  const cutoff30Str = cutoff30Days.toISOString().split('T')[0];

  // Filtrar pomodoroLogs por asignatura y periodo
  const subjectMatchedLogs = pomodoroLogs.filter((log) => {
    if (subjectFilterId === 'all') return true;
    return (
      allowedSubjectIds.has(log.subjectId) ||
      allowedSubjectNames.has((log.subjectName || '').toLowerCase())
    );
  });

  const filteredLogs = subjectMatchedLogs.filter((log) => {
    if (periodDays === 7) return log.date >= cutoff7Str;
    if (periodDays === 30) return log.date >= cutoff30Str;
    return true;
  });

  // Cálculos de Pomodoro
  const totalPomodoroMinutes = filteredLogs.reduce(
    (acc, l) => acc + (l.durationMinutes || 0),
    0
  );
  const totalPomodoroHours = Math.round((totalPomodoroMinutes / 60) * 10) / 10;

  const last7DaysMinutes = subjectMatchedLogs
    .filter((l) => l.date >= cutoff7Str)
    .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const last7DaysHours = Math.round((last7DaysMinutes / 60) * 10) / 10;

  const last30DaysMinutes = subjectMatchedLogs
    .filter((l) => l.date >= cutoff30Str)
    .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const last30DaysHours = Math.round((last30DaysMinutes / 60) * 10) / 10;

  // Cálculos de estado actual de los temas
  let totalTopics = 0;
  let strictlyStudiedCount = 0;
  let reviewedTopicsCount = 0;
  let inProgressTopicsCount = 0;
  let pendingTopicsCount = 0;
  let totalPages = 0;
  let readPages = 0;
  let totalActualTopicHours = 0;
  let totalEstimatedTopicHours = 0;
  let totalSpacedReviewsCount = 0;

  filteredSubjects.forEach((sub) => {
    sub.topics.forEach((t) => {
      totalTopics += 1;
      if (t.status === 'repasado') reviewedTopicsCount += 1;
      else if (t.status === 'estudiado') strictlyStudiedCount += 1;
      else if (t.status === 'en_progreso') inProgressTopicsCount += 1;
      else pendingTopicsCount += 1;

      const tPages = t.pageCount || t.paginasTotales || 0;
      totalPages += tPages;
      readPages +=
        t.pagesRead !== undefined
          ? t.pagesRead
          : t.status === 'estudiado' || t.status === 'repasado'
          ? tPages
          : 0;

      totalActualTopicHours += t.actualHoursSpent || 0;
      totalEstimatedTopicHours += t.estimatedHours || 0;
      totalSpacedReviewsCount += (t.reviewsHistory || []).length;
    });
  });

  const studiedTopicsCount = strictlyStudiedCount + reviewedTopicsCount;
  const completionPercentage =
    totalTopics > 0 ? Math.round((studiedTopicsCount / totalTopics) * 100) : 0;
  totalActualTopicHours = Math.round(totalActualTopicHours * 10) / 10;
  totalEstimatedTopicHours = Math.round(totalEstimatedTopicHours * 10) / 10;

  // Inicializar documento PDF A4
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let y = 0;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > 274) {
      doc.addPage();
      // Banda superior sutil en páginas adicionales
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, pageWidth, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(
        'RESUMEN DE PROGRESO ACADEMICO · POMODORO LOGS Y ESTADO DE TEMAS',
        marginX,
        5.5
      );
      y = 16;
    }
  };

  // =========================================================================
  // CABECERA PRINCIPAL DEL INFORME
  // =========================================================================
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Franja de acento azul/índigo
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 37, pageWidth, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RESUMEN DE PROGRESO ACADEMICO', marginX, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    'Informe consolidado de sesiones de foco (Pomodoro Logs) y estado actual de temas estudiados',
    marginX,
    22
  );

  const periodLabel =
    periodDays === 7
      ? `Ultimos 7 dias (${cutoff7Str} a ${todayStr})`
      : periodDays === 30
      ? `Ultimos 30 dias (${cutoff30Str} a ${todayStr})`
      : `Historico completo (hasta ${todayStr})`;

  const scopeLabel =
    subjectFilterId !== 'all' && filteredSubjects[0]
      ? `Asignatura: ${sanitizePdfText(filteredSubjects[0].name)}`
      : `Alcance: ${filteredSubjects.length} asignatura(s)`;

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  const metaLine = [
    `Fecha: ${todayStr}`,
    periodLabel,
    scopeLabel,
    studentName ? `Estudiante: ${sanitizePdfText(studentName)}` : '',
  ]
    .filter(Boolean)
    .join('   |   ');
  doc.text(metaLine, marginX, 31);

  y = 48;

  // =========================================================================
  // SECCIÓN 1: TARJETAS KPI GLOBALES (POMODORO LOGS & ESTADO DE TEMAS)
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Balance Ejecutivo de Foco Pomodoro y Dominio del Temario', marginX, y);
  y += 5;

  const cardWidth = (contentWidth - 6) / 2;
  const cardHeight = 32;

  // Tarjeta Izquierda: Métricas de PomodoroLogs
  doc.setDrawColor(219, 234, 254);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(marginX, y, cardWidth, cardHeight, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 64, 175);
  doc.text('REGISTRO DE SESIONES POMODORO (POMODOROLOGS)', marginX + 4, y + 6.5);

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${totalPomodoroHours}h totales (${filteredLogs.length} sesiones)`,
    marginX + 4,
    y + 14.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Tiempo acumulado: ${totalPomodoroMinutes} min  |  Ultimos 7d: ${last7DaysHours}h / ${weeklyTargetHours}h`,
    marginX + 4,
    y + 21
  );
  doc.text(
    `Ultimos 30d: ${last30DaysHours}h  |  Racha activa: ${preferences?.streakDays || 0} dias`,
    marginX + 4,
    y + 26.5
  );

  // Tarjeta Derecha: Estado Actual de los Temas Estudiados
  const rightCardX = marginX + cardWidth + 6;
  doc.setDrawColor(209, 250, 229);
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(rightCardX, y, cardWidth, cardHeight, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text('ESTADO ACTUAL DE LOS TEMAS ESTUDIADOS', rightCardX + 4, y + 6.5);

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${studiedTopicsCount} / ${totalTopics} temas estudiados (${completionPercentage}%)`,
    rightCardX + 4,
    y + 14.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Repasados: ${reviewedTopicsCount}  |  Estudiados: ${strictlyStudiedCount}  |  En progreso: ${inProgressTopicsCount}  |  Pend.: ${pendingTopicsCount}`,
    rightCardX + 4,
    y + 21
  );
  doc.text(
    `Horas en temas: ${totalActualTopicHours}h / ${totalEstimatedTopicHours}h est.  |  Paginas: ${readPages}/${totalPages}`,
    rightCardX + 4,
    y + 26.5
  );

  y += cardHeight + 6;

  // Barra visual de distribución de estados de los temas
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, y, contentWidth, 15, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Distribucion del estado de los ${totalTopics} temas del programa:`,
    marginX + 4,
    y + 5
  );

  const barX = marginX + 4;
  const barY = y + 7.5;
  const barMaxW = contentWidth - 8;
  doc.setFillColor(226, 232, 240);
  doc.rect(barX, barY, barMaxW, 4, 'F');

  if (totalTopics > 0) {
    const wRepasado = (reviewedTopicsCount / totalTopics) * barMaxW;
    const wEstudiado = (strictlyStudiedCount / totalTopics) * barMaxW;
    const wEnProgreso = (inProgressTopicsCount / totalTopics) * barMaxW;

    let curX = barX;
    if (wRepasado > 0) {
      doc.setFillColor(5, 150, 105);
      doc.rect(curX, barY, wRepasado, 4, 'F');
      curX += wRepasado;
    }
    if (wEstudiado > 0) {
      doc.setFillColor(37, 99, 235);
      doc.rect(curX, barY, wEstudiado, 4, 'F');
      curX += wEstudiado;
    }
    if (wEnProgreso > 0) {
      doc.setFillColor(245, 158, 11);
      doc.rect(curX, barY, wEnProgreso, 4, 'F');
    }
  }

  y += 21;

  // =========================================================================
  // SECCIÓN 2: RESUMEN POR ASIGNATURA (TEMAS + POMODOROLOGS)
  // =========================================================================
  ensureSpace(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '2. Progreso Academico por Asignatura (Temas Estudiados y Tiempo Pomodoro)',
    marginX,
    y
  );
  y += 5;

  // Cabecera de tabla
  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, y, contentWidth, 7.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Asignatura', marginX + 3, y + 5);
  doc.text('Estud./Total', marginX + 68, y + 5);
  doc.text('Repasados', marginX + 93, y + 5);
  doc.text('En Prog.', marginX + 114, y + 5);
  doc.text('Pend.', marginX + 131, y + 5);
  doc.text('Sesiones Pomo', marginX + 145, y + 5);
  doc.text('Horas Totales', marginX + 166, y + 5);
  y += 8.5;

  filteredSubjects.forEach((sub, idx) => {
    ensureSpace(9);
    const subLogs = filteredLogs.filter(
      (l) =>
        l.subjectId === sub.id ||
        (l.subjectName || '').toLowerCase() === sub.name.toLowerCase()
    );
    const subPomoMins = subLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
    const subPomoHours = Math.round((subPomoMins / 60) * 10) / 10;

    const subTopicHours =
      Math.round(
        sub.topics.reduce((acc, t) => acc + (t.actualHoursSpent || 0), 0) * 10
      ) / 10;
    const effectiveHours = Math.max(subPomoHours, subTopicHours);

    const subTotal = sub.topics.length;
    const subRepasados = sub.topics.filter((t) => t.status === 'repasado').length;
    const subEstudiados = sub.topics.filter((t) => t.status === 'estudiado').length;
    const subEnProgreso = sub.topics.filter((t) => t.status === 'en_progreso').length;
    const subPendientes = sub.topics.filter((t) => t.status === 'pendiente').length;
    const subCompleted = subRepasados + subEstudiados;
    const subPct = subTotal > 0 ? Math.round((subCompleted / subTotal) * 100) : 0;

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y - 1, contentWidth, 7.5, 'F');
    }

    const [r, g, b] = hexToRgb(sub.color);
    doc.setFillColor(r, g, b);
    doc.circle(marginX + 2.5, y + 2.5, 1.3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(sub.name).slice(0, 34), marginX + 5.5, y + 3.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${subCompleted}/${subTotal} (${subPct}%)`, marginX + 68, y + 3.8);
    doc.text(`${subRepasados}`, marginX + 96, y + 3.8);
    doc.text(`${subEnProgreso}`, marginX + 117, y + 3.8);
    doc.text(`${subPendientes}`, marginX + 133, y + 3.8);
    doc.text(`${subLogs.length} (${subPomoMins}m)`, marginX + 145, y + 3.8);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`${effectiveHours}h`, marginX + 168, y + 3.8);

    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, y + 6.2, marginX + contentWidth, y + 6.2);
    y += 7.5;
  });

  y += 5;

  // =========================================================================
  // SECCIÓN 3: ESTADO ACTUAL DETALLADO DE LOS TEMAS ESTUDIADOS Y TEMARIO
  // =========================================================================
  if (includeDetailedTopicsTable) {
    ensureSpace(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      onlyStudiedTopics
        ? '3. Detalle del Estado Actual de los Temas Estudiados y Repasados'
        : '3. Estado Actual Detallado de los Temas por Asignatura',
      marginX,
      y
    );
    y += 5;

    filteredSubjects.forEach((sub) => {
      const topicsToRender = onlyStudiedTopics
        ? sub.topics.filter(
            (t) => t.status === 'estudiado' || t.status === 'repasado'
          )
        : sub.topics;

      if (topicsToRender.length === 0) return;

      ensureSpace(18);

      // Subcabecera de asignatura
      const [sr, sg, sb] = hexToRgb(sub.color);
      doc.setFillColor(sr, sg, sb);
      doc.rect(marginX, y, 2.5, 6.5, 'F');
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX + 2.5, y, contentWidth - 2.5, 6.5, 'F');

      const subStudied = sub.topics.filter(
        (t) => t.status === 'estudiado' || t.status === 'repasado'
      ).length;
      const subPct =
        sub.topics.length > 0
          ? Math.round((subStudied / sub.topics.length) * 100)
          : 0;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${sanitizePdfText(sub.name)} — ${subStudied}/${sub.topics.length} temas estudiados (${subPct}%)`,
        marginX + 5,
        y + 4.5
      );
      y += 8;

      // Encabezados de columnas de temas
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Tema', marginX + 2, y + 3);
      doc.text('Estado Actual', marginX + 86, y + 3);
      doc.text('Nivel / Vueltas', marginX + 114, y + 3);
      doc.text('Horas (Real/Est)', marginX + 139, y + 3);
      doc.text('Estudiado / Prox.', marginX + 163, y + 3);
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + 4.5, marginX + contentWidth, y + 4.5);
      y += 6;

      topicsToRender.forEach((topic, tIdx) => {
        ensureSpace(7.5);

        const topicPomoMins = filteredLogs
          .filter(
            (l) =>
              (l.subjectId === sub.id || l.subjectName === sub.name) &&
              l.topicTitle &&
              l.topicTitle.toLowerCase() === topic.title.toLowerCase()
          )
          .reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

        const topicPomoHours = Math.round((topicPomoMins / 60) * 10) / 10;
        const effectiveActualHours =
          Math.round(
            Math.max(topic.actualHoursSpent || 0, topicPomoHours) * 10
          ) / 10;

        const statusLabel = getTopicStatusLabel(topic.status);
        const [stR, stG, stB] = getTopicStatusColor(topic.status);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        const cleanTitle = sanitizePdfText(
          `${tIdx + 1}. ${topic.title}`
        ).slice(0, 48);
        doc.text(cleanTitle, marginX + 2, y + 3);

        // Estado con color distintivo
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(stR, stG, stB);
        doc.text(statusLabel, marginX + 86, y + 3);

        // Nivel SM-2 y vueltas
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const vueltas = topic.vueltasCount || (topic.status === 'pendiente' ? 0 : 1);
        doc.text(
          `R${topic.reviewLevel || 0} · ${vueltas} v.`,
          marginX + 114,
          y + 3
        );

        // Horas invertidas vs estimadas
        doc.text(
          `${effectiveActualHours}h / ${topic.estimatedHours || 1}h`,
          marginX + 139,
          y + 3
        );

        // Fechas de estudio / próximo repaso
        const dateInfo = topic.studiedAt
          ? topic.nextReviewDate
            ? `${topic.studiedAt.slice(5)} -> ${topic.nextReviewDate.slice(5)}`
            : `Est: ${topic.studiedAt}`
          : topic.scheduledDate
          ? `Plan: ${topic.scheduledDate}`
          : '-';
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(dateInfo, marginX + 163, y + 3);

        doc.setDrawColor(248, 250, 252);
        doc.line(marginX, y + 4.8, marginX + contentWidth, y + 4.8);
        y += 5.8;
      });

      y += 4;
    });
  }

  // =========================================================================
  // SECCIÓN 4: HISTORIAL CRONOLÓGICO DE SESIONES POMODORO (POMODOROLOGS)
  // =========================================================================
  if (includePomodoroLogHistory) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `4. Registro de Sesiones de Estudio (pomodoroLogs: ${filteredLogs.length} sesiones)`,
      marginX,
      y
    );
    y += 5;

    if (filteredLogs.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'No hay sesiones registradas en pomodoroLogs para el filtro seleccionado.',
        marginX + 2,
        y + 4
      );
      y += 10;
    } else {
      // Resumen diario de los últimos días con sesiones en pomodoroLogs
      const byDateMap: Record<string, { minutes: number; count: number }> = {};
      filteredLogs.forEach((log) => {
        if (!byDateMap[log.date]) {
          byDateMap[log.date] = { minutes: 0, count: 0 };
        }
        byDateMap[log.date].minutes += log.durationMinutes || 0;
        byDateMap[log.date].count += 1;
      });

      const sortedDates = Object.keys(byDateMap).sort((a, b) =>
        b.localeCompare(a)
      );

      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text('Fecha', marginX + 3, y + 4.8);
      doc.text('Asignatura', marginX + 30, y + 4.8);
      doc.text('Tema / Sesion trabajada', marginX + 85, y + 4.8);
      doc.text('Duracion', marginX + 162, y + 4.8);
      y += 8.5;

      const logsToDisplay = [...filteredLogs]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 45);

      logsToDisplay.forEach((log, idx) => {
        ensureSpace(7);
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginX, y - 1, contentWidth, 6.2, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(sanitizePdfText(log.date), marginX + 3, y + 3.2);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(
          sanitizePdfText(log.subjectName || 'Asignatura').slice(0, 28),
          marginX + 30,
          y + 3.2
        );

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(
          sanitizePdfText(log.topicTitle || 'Sesion de foco general').slice(0, 42),
          marginX + 85,
          y + 3.2
        );

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235);
        const hrs = Math.round(((log.durationMinutes || 0) / 60) * 10) / 10;
        doc.text(`${log.durationMinutes} min (${hrs}h)`, marginX + 160, y + 3.2);

        y += 6;
      });

      if (sortedDates.length > 0) {
        y += 2;
        ensureSpace(12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        const topDaysSummary = sortedDates
          .slice(0, 5)
          .map(
            (d) =>
              `${d}: ${byDateMap[d]. minutes}m (${byDateMap[d].count} ses.)`
          )
          .join('  |  ');
        doc.text(
          `Dias con actividad reciente: ${sanitizePdfText(topDaysSummary)}`,
          marginX,
          y + 4
        );
      }
    }
  }

  // =========================================================================
  // NUMERACIÓN DE PÁGINAS Y PIE DE PÁGINA EN TODO EL DOCUMENTO
  // =========================================================================
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, 285, marginX + contentWidth, 285);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `StudyFlow · Resumen de Progreso Academico (PomodoroLogs + Estado de Temas) · ${todayStr}`,
      marginX,
      290
    );
    doc.text(
      `Pagina ${p} de ${pageCount}`,
      marginX + contentWidth - 22,
      290
    );
  }

  const fileName = `Resumen_Progreso_Academico_${todayStr}.pdf`;
  doc.save(fileName);

  return {
    generatedAt: todayStr,
    totalPomodoroSessions: filteredLogs.length,
    totalPomodoroMinutes,
    totalPomodoroHours,
    last7DaysHours,
    last30DaysHours,
    totalTopics,
    studiedTopicsCount,
    strictlyStudiedCount,
    reviewedTopicsCount,
    inProgressTopicsCount,
    pendingTopicsCount,
    completionPercentage,
    totalPages,
    readPages,
    totalActualTopicHours,
    totalEstimatedTopicHours,
    fileName,
  };
}
