import { jsPDF } from 'jspdf';
import { Subject, CornellNote, Topic } from '../types';

export type CornellPaperStyle = 'clean' | 'lined' | 'grid';

export interface ExportCornellPDFOptions {
  paperStyle?: CornellPaperStyle;
  includeActiveRecallCheckboxes?: boolean;
  includeReviewTracker?: boolean;
  includeCoverPage?: boolean;
  includeTopicMetadata?: boolean;
  studentName?: string;
}

const DEFAULT_OPTIONS: Required<ExportCornellPDFOptions> = {
  paperStyle: 'lined',
  includeActiveRecallCheckboxes: true,
  includeReviewTracker: true,
  includeCoverPage: true,
  includeTopicMetadata: true,
  studentName: '',
};

/**
 * Sanitiza texto para fuentes estándar de jsPDF (mantiene caracteres latinos como tildes, ñ, ¿, ¡)
 */
function cleanTextForPDF(text: string): string {
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

/**
 * Convierte un color HEX (#3b82f6) a RGB [r, g, b]
 */
function hexToRgb(hexColor?: string): [number, number, number] {
  if (!hexColor) return [37, 99, 235]; // Blue 600 default
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

interface ParsedNoteLine {
  type: 'h1' | 'h2' | 'bullet' | 'quote' | 'paragraph' | 'spacer';
  text: string;
}

/**
 * Parsea el cuerpo de apuntes en líneas con semántica (encabezados, listas, citas, párrafos)
 */
function parseNotesLines(rawNotes: string): ParsedNoteLine[] {
  if (!rawNotes || !rawNotes.trim()) return [];
  const rawParagraphs = rawNotes.split('\n');
  const result: ParsedNoteLine[] = [];

  for (const rawLine of rawParagraphs) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      result.push({ type: 'spacer', text: '' });
      continue;
    }

    if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      result.push({
        type: 'h2',
        text: cleanTextForPDF(trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '')),
      });
    } else if (trimmed.startsWith('# ')) {
      result.push({
        type: 'h1',
        text: cleanTextForPDF(trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '')),
      });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      result.push({
        type: 'bullet',
        text: cleanTextForPDF(trimmed.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '')),
      });
    } else if (trimmed.startsWith('> ')) {
      result.push({
        type: 'quote',
        text: cleanTextForPDF(trimmed.replace(/^>\s*/, '').replace(/\*\*/g, '')),
      });
    } else {
      result.push({
        type: 'paragraph',
        text: cleanTextForPDF(trimmed.replace(/\*\*/g, '')),
      });
    }
  }

  return result;
}

/**
 * Servicio de exportación a PDF estructurado para apuntes con el Método Cornell
 */
export const pdfCornellExportService = {
  /**
   * Obtiene todas las notas Cornell exportables de una asignatura
   * (combina `subject.cornellNotes` y temas que tengan apuntes propios no duplicados)
   */
  getExportableNotesForSubject(subject: Subject, topics: Topic[] = []): CornellNote[] {
    const allTopics = topics.length > 0 ? topics : subject.topics || [];
    const existingNotes = [...(subject.cornellNotes || [])];
    const coveredTopicIds = new Set(existingNotes.map((n) => n.topicId).filter(Boolean));

    for (const topic of allTopics) {
      const hasTopicContent =
        (topic.notes && topic.notes.trim().length > 0) ||
        (topic.generalNotes && topic.generalNotes.trim().length > 0) ||
        (topic.cues && topic.cues.length > 0) ||
        (topic.summary && topic.summary.trim().length > 0);

      if (hasTopicContent && !coveredTopicIds.has(topic.id)) {
        existingNotes.push({
          id: `topic-cornell-${topic.id}`,
          topicId: topic.id,
          title: topic.title,
          cues:
            topic.cues && topic.cues.length > 0
              ? topic.cues
              : (topic.subtopics || []).map((st) => `¿Qué es y cómo se aplica ${st}?`),
          notes: topic.notes || topic.generalNotes || topic.description || '',
          summary: topic.summary || '',
          createdAt: topic.lastNotesUpdatedAt || topic.studiedAt || new Date().toISOString(),
          updatedAt: topic.lastNotesUpdatedAt || new Date().toISOString(),
          sourceType: 'manual',
        });
      }
    }

    return existingNotes;
  },

  /**
   * Exporta una nota individual de Cornell a un PDF estructurado (con soporte multipágina automático)
   */
  exportSingleNote(
    subject: Subject,
    note: CornellNote,
    topic?: Topic,
    options?: ExportCornellPDFOptions
  ): void {
    const mergedOptions: Required<ExportCornellPDFOptions> = {
      ...DEFAULT_OPTIONS,
      ...options,
      includeCoverPage: false,
    };

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    this.renderCornellNoteMultiPage(doc, subject, note, topic, mergedOptions);
    this.addGlobalPageFooters(doc, subject, note.title);

    const safeTitle = (note.title || 'apunte')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 35);
    const safeSub = (subject.name || 'materia')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 20);

    doc.save(`Cornell_${safeSub}_${safeTitle}.pdf`);
  },

  /**
   * Exporta todas las notas Cornell de una asignatura a un único documento PDF estructurado
   */
  exportAllNotesFromSubject(
    subject: Subject,
    topics: Topic[] = [],
    options?: ExportCornellPDFOptions
  ): void {
    const mergedOptions: Required<ExportCornellPDFOptions> = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    const exportableNotes = this.getExportableNotesForSubject(subject, topics);
    if (exportableNotes.length === 0) {
      throw new Error('Esta asignatura no tiene apuntes Cornell registrados para exportar.');
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const allTopics = topics.length > 0 ? topics : subject.topics || [];

    // Portada e índice opcional cuando hay apuntes compilados
    if (mergedOptions.includeCoverPage) {
      this.renderNotebookCoverPage(doc, subject, exportableNotes, allTopics, mergedOptions);
    }

    exportableNotes.forEach((note, index) => {
      if (index > 0 || mergedOptions.includeCoverPage) {
        doc.addPage();
      }
      const linkedTopic = allTopics.find((t) => t.id === note.topicId);
      this.renderCornellNoteMultiPage(doc, subject, note, linkedTopic, mergedOptions);
    });

    this.addGlobalPageFooters(doc, subject);

    const safeSub = (subject.name || 'materia')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 28);

    doc.save(`Cuaderno_Cornell_${safeSub}.pdf`);
  },

  /**
   * Renderiza una portada académica con índice estructurado para el cuaderno Cornell
   */
  renderNotebookCoverPage(
    doc: jsPDF,
    subject: Subject,
    notes: CornellNote[],
    topics: Topic[],
    options: Required<ExportCornellPDFOptions>
  ): void {
    const pageWidth = 210;
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    const [r, g, b] = hexToRgb(subject.color);

    // Franja superior decorativa
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageWidth, 16, 'F');

    // Tarjeta principal de portada
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, 28, contentWidth, 64, 3, 3, 'FD');

    // Badge "CUADERNO ESTRUCTURADO MÉTODO CORNELL"
    doc.setFillColor(r, g, b);
    doc.roundedRect(margin + 8, 36, 78, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('CUADERNO DE ESTUDIO · METODO CORNELL', margin + 11, 40.8);

    // Nombre de la Asignatura
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    const wrappedSubName = doc.splitTextToSize(cleanTextForPDF(subject.name), contentWidth - 16);
    doc.text(wrappedSubName.slice(0, 2), margin + 8, 53);

    // Metadatos de asignatura
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const metaParts: string[] = [];
    if (subject.code) metaParts.push(`Codigo: ${cleanTextForPDF(subject.code)}`);
    if (subject.professor) metaParts.push(`Docente: ${cleanTextForPDF(subject.professor)}`);
    if (subject.credits) metaParts.push(`${subject.credits} ECTS`);
    metaParts.push(`${notes.length} ${notes.length === 1 ? 'ficha Cornell' : 'fichas Cornell'}`);
    doc.text(metaParts.join('   ·   '), margin + 8, 74);

    const exportDate = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const studentInfo = options.studentName
      ? `Estudiante: ${cleanTextForPDF(options.studentName)}   ·   `
      : '';
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${studentInfo}Generado el ${cleanTextForPDF(exportDate)}`, margin + 8, 83);

    // Guía visual rápida del Método Cornell
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, 100, contentWidth, 34, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('ESTRUCTURA DEL SISTEMA DE APUNTES CORNELL', margin + 6, 108);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    doc.text(
      '1. Columna de Ideas Clave / Cues (Izquierda 30%): Preguntas detonadoras y conceptos para Active Recall.',
      margin + 6,
      115
    );
    doc.text(
      '2. Columna de Notas de Clase (Derecha 70%): Desarrollo estructurado, definiciones, formulas y ejemplos.',
      margin + 6,
      121
    );
    doc.text(
      '3. Franja de Resumen Sintetico (Pie 100%): Sintesis ejecutiva en 2-3 frases maestras para repaso veloz.',
      margin + 6,
      127
    );

    // Índice de Apuntes Cornell incluidos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('INDICE DE APUNTES CORNELL INCLUIDOS', margin, 146);

    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.line(margin, 148.5, margin + 82, 148.5);

    let listY = 156;
    notes.forEach((n, idx) => {
      if (listY > 272) return;
      const linkedTopic = topics.find((t) => t.id === n.topicId);
      const cuesCount = (n.cues || []).length;
      const wordsCount = (n.notes || '').trim().split(/\s+/).filter(Boolean).length;

      doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(margin, listY - 4.5, contentWidth, 10, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const itemTitle = `${idx + 1}. ${cleanTextForPDF(n.title || 'Apunte sin título')}`;
      doc.text(doc.splitTextToSize(itemTitle, 108)[0], margin + 3, listY + 1.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const metaRight = `${linkedTopic ? `[${cleanTextForPDF(linkedTopic.title).slice(0, 22)}] · ` : ''}${cuesCount} cues · ${wordsCount} pal.`;
      doc.text(metaRight, pageWidth - margin - 3, listY + 1.5, { align: 'right' });

      listY += 11.5;
    });
  },

  /**
   * Renderiza una nota Cornell completa distribuyendo automáticamente el contenido en 1 o más páginas A4
   */
  renderCornellNoteMultiPage(
    doc: jsPDF,
    subject: Subject,
    note: CornellNote,
    topic: Topic | undefined,
    options: Required<ExportCornellPDFOptions>
  ): void {
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2; // 186 mm

    const startY = 36;
    const summaryBoxHeight = 42;
    const mainSectionBottom = pageHeight - margin - summaryBoxHeight - 7; // 236 mm
    const availableHeight = mainSectionBottom - startY; // 200 mm

    const cuesWidth = 56; // ~30%
    const cuesX = margin;
    const notesX = margin + cuesWidth; // Línea divisoria exacta estilo Cornell clásico
    const notesWidth = contentWidth - cuesWidth; // 130 mm (~70%)

    // Pre-procesar todas las líneas de Cues (columna izquierda)
    const cuesList = (note.cues || []).map((c) => cleanTextForPDF(c)).filter(Boolean);
    interface WrappedCueItem {
      lines: string[];
      height: number;
    }
    const cueItems: WrappedCueItem[] = cuesList.map((cueText) => {
      const prefix = options.includeActiveRecallCheckboxes ? '   ' : '? ';
      const lines = doc.splitTextToSize(`${prefix}${cueText}`, cuesWidth - 8);
      return {
        lines,
        height: lines.length * 4.1 + 3.2,
      };
    });

    // Pre-procesar todas las líneas de Notas (columna derecha)
    const parsedNotes = parseNotesLines(note.notes || '');
    interface WrappedNoteBlock {
      type: ParsedNoteLine['type'];
      lines: string[];
      height: number;
    }

    const noteBlocks: WrappedNoteBlock[] = [];
    for (const block of parsedNotes) {
      if (block.type === 'spacer') {
        noteBlocks.push({ type: 'spacer', lines: [], height: 2.8 });
        continue;
      }
      if (block.type === 'h1') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        const lines = doc.splitTextToSize(block.text, notesWidth - 10);
        noteBlocks.push({ type: 'h1', lines, height: lines.length * 4.8 + 2.5 });
      } else if (block.type === 'h2') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        const lines = doc.splitTextToSize(block.text, notesWidth - 10);
        noteBlocks.push({ type: 'h2', lines, height: lines.length * 4.4 + 2 });
      } else if (block.type === 'bullet') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        const lines = doc.splitTextToSize(block.text, notesWidth - 14);
        noteBlocks.push({ type: 'bullet', lines, height: lines.length * 4.2 + 1.4 });
      } else if (block.type === 'quote') {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.6);
        const lines = doc.splitTextToSize(block.text, notesWidth - 14);
        noteBlocks.push({ type: 'quote', lines, height: lines.length * 4.2 + 2.2 });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        const lines = doc.splitTextToSize(block.text, notesWidth - 10);
        noteBlocks.push({ type: 'paragraph', lines, height: lines.length * 4.2 + 1.6 });
      }
    }

    // Paginar bloques de Cues y bloques de Notas en hojas Cornell
    const maxBodyHeightPerSheet = availableHeight - 18; // Descontando cabecera de columnas (14mm) + margen inferior
    let cueCursor = 0;
    let noteCursor = 0;
    let sheetIndex = 0;

    // Primero calculamos cuántas hojas requerirá esta nota para mostrar "Hoja X de Y"
    const pagesData: Array<{
      cuesSlice: WrappedCueItem[];
      notesSlice: WrappedNoteBlock[];
    }> = [];

    while (cueCursor < cueItems.length || noteCursor < noteBlocks.length || pagesData.length === 0) {
      const cuesSlice: WrappedCueItem[] = [];
      let cueH = 0;
      while (cueCursor < cueItems.length) {
        const item = cueItems[cueCursor];
        if (cueH + item.height > maxBodyHeightPerSheet && cuesSlice.length > 0) {
          break;
        }
        cuesSlice.push(item);
        cueH += item.height;
        cueCursor++;
      }

      const notesSlice: WrappedNoteBlock[] = [];
      let noteH = 0;
      while (noteCursor < noteBlocks.length) {
        const block = noteBlocks[noteCursor];
        if (noteH + block.height > maxBodyHeightPerSheet && notesSlice.length > 0) {
          break;
        }
        notesSlice.push(block);
        noteH += block.height;
        noteCursor++;
      }

      pagesData.push({ cuesSlice, notesSlice });
      if (cueCursor >= cueItems.length && noteCursor >= noteBlocks.length) {
        break;
      }
    }

    const totalNoteSheets = pagesData.length;

    // Renderizar cada hoja de la nota Cornell
    for (sheetIndex = 0; sheetIndex < totalNoteSheets; sheetIndex++) {
      if (sheetIndex > 0) {
        doc.addPage();
      }

      const { cuesSlice, notesSlice } = pagesData[sheetIndex];

      // 1. Cabecera Estructurada Cornell
      this.drawCornellHeader(
        doc,
        subject,
        note,
        topic,
        sheetIndex + 1,
        totalNoteSheets,
        margin,
        contentWidth,
        options
      );

      // 2. Contenedor Principal de Dos Columnas (Cues 30% | Notes 70%)
      // Fondo columna izquierda (Cues)
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(cuesX, startY, cuesWidth, availableHeight, 'F');

      // Fondo columna derecha (Notes)
      doc.setFillColor(255, 255, 255);
      doc.rect(notesX, startY, notesWidth, availableHeight, 'F');

      // Pauta de papel (Rayado o Cuadrícula) en la columna de Notas
      this.drawPaperRuling(
        doc,
        options.paperStyle,
        notesX,
        startY + 13,
        notesWidth,
        availableHeight - 13
      );

      // Cabeceras de las dos columnas
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(cuesX, startY, cuesWidth, 12.5, 'F');
      doc.rect(notesX, startY, notesWidth, 12.5, 'F');

      // Títulos de sección
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(51, 65, 85); // Slate 700
      doc.text('IDEAS CLAVE / PREGUNTAS (CUES)', cuesX + 3, startY + 5.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text('Active Recall · Autoevaluacion', cuesX + 3, startY + 9.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(51, 65, 85);
      doc.text('NOTAS DE CLASE Y DESARROLLO ESTRUCTURADO (NOTES)', notesX + 4, startY + 5.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text('Definiciones, esquemas, formulas, argumentos e ideas principales', notesX + 4, startY + 9.8);

      // Bordes exteriores y línea divisoria vertical roja/azul estilo Cornell
      doc.setDrawColor(148, 163, 184); // Slate 400
      doc.setLineWidth(0.35);
      doc.rect(margin, startY, contentWidth, availableHeight, 'S');
      doc.line(margin, startY + 12.5, margin + contentWidth, startY + 12.5);

      // Línea vertical característica del Método Cornell (separa Cues y Notes)
      const [r, g, b] = hexToRgb(subject.color);
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.5);
      doc.line(notesX, startY, notesX, startY + availableHeight);

      // 3. Renderizar contenido de Cues (Columna Izquierda)
      let currentCueY = startY + 18;
      if (cuesSlice.length === 0 && sheetIndex === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('(Espacio para preguntas clave)', cuesX + 3, currentCueY);
      } else {
        cuesSlice.forEach((cueItem) => {
          // Casilla de verificación Active Recall si está activada
          if (options.includeActiveRecallCheckboxes) {
            doc.setDrawColor(100, 116, 139);
            doc.setFillColor(255, 255, 255);
            doc.setLineWidth(0.25);
            doc.roundedRect(cuesX + 3, currentCueY - 2.8, 3.1, 3.1, 0.5, 0.5, 'FD');
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.2);
          doc.setTextColor(30, 41, 59);

          cueItem.lines.forEach((line, lineIdx) => {
            const xOffset = lineIdx === 0 && options.includeActiveRecallCheckboxes ? cuesX + 3.5 : cuesX + 3;
            doc.text(line, xOffset, currentCueY);
            currentCueY += 4.1;
          });

          // Pequeña línea punteada separadora entre preguntas clave
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(cuesX + 3, currentCueY - 1.2, cuesX + cuesWidth - 3, currentCueY - 1.2);
          currentCueY += 3.2;
        });
      }

      // 4. Renderizar contenido de Notas (Columna Derecha)
      let currentNoteY = startY + 18;
      if (notesSlice.length === 0 && sheetIndex === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text('(Espacio libre para tomar apuntes estructurados)', notesX + 5, currentNoteY);
      } else {
        for (const block of notesSlice) {
          if (block.type === 'spacer') {
            currentNoteY += block.height;
            continue;
          }

          if (block.type === 'h1') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.2);
            doc.setTextColor(r, g, b);
            block.lines.forEach((line) => {
              doc.text(line, notesX + 5, currentNoteY);
              currentNoteY += 4.8;
            });
            currentNoteY += 1.5;
          } else if (block.type === 'h2') {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.3);
            doc.setTextColor(15, 23, 42);
            block.lines.forEach((line) => {
              doc.text(line, notesX + 5, currentNoteY);
              currentNoteY += 4.4;
            });
            currentNoteY += 1.2;
          } else if (block.type === 'bullet') {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.8);
            doc.setTextColor(30, 41, 59);
            // Dibujar punto de viñeta
            doc.setFillColor(r, g, b);
            doc.circle(notesX + 6.5, currentNoteY - 1.1, 0.75, 'F');
            block.lines.forEach((line) => {
              doc.text(line, notesX + 9.2, currentNoteY);
              currentNoteY += 4.2;
            });
            currentNoteY += 1.2;
          } else if (block.type === 'quote') {
            const quoteHeight = block.lines.length * 4.2 + 1;
            doc.setDrawColor(r, g, b);
            doc.setLineWidth(0.7);
            doc.line(notesX + 5.5, currentNoteY - 3, notesX + 5.5, currentNoteY + quoteHeight - 4.5);

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.6);
            doc.setTextColor(71, 85, 105);
            block.lines.forEach((line) => {
              doc.text(line, notesX + 8.5, currentNoteY);
              currentNoteY += 4.2;
            });
            currentNoteY += 1.8;
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.8);
            doc.setTextColor(30, 41, 59);
            block.lines.forEach((line) => {
              doc.text(line, notesX + 5, currentNoteY);
              currentNoteY += 4.2;
            });
            currentNoteY += 1.4;
          }
        }
      }

      // 5. Franja Inferior Estructurada: RESUMEN SINTÉTICO (Summary)
      const summaryY = mainSectionBottom + 3.5;
      // IMPORTANTE: jsPDF.setFillColor requiere exactamente 3 argumentos RGB (4 argumentos activaría CMYK)
      doc.setFillColor(255, 251, 235); // Amber 50 cálido
      doc.setDrawColor(245, 158, 11); // Amber 500
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, summaryY, contentWidth, summaryBoxHeight, 2, 2, 'FD');

      // Barra superior interna del cuadro de resumen
      doc.setFillColor(254, 243, 199); // Amber 100
      doc.rect(margin + 0.3, summaryY + 0.3, contentWidth - 0.6, 8.5, 'F');
      doc.setDrawColor(252, 211, 77);
      doc.setLineWidth(0.25);
      doc.line(margin, summaryY + 8.8, margin + contentWidth, summaryY + 8.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.3);
      doc.setTextColor(146, 64, 14); // Amber 800
      doc.text('RESUMEN SINTETICO (SUMMARY · SINTESIS CORNELL)', margin + 4, summaryY + 5.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(180, 83, 9);
      doc.text(
        'Conclusiones e ideas esenciales en tus propias palabras para repaso rapido',
        margin + contentWidth - 4,
        summaryY + 5.8,
        { align: 'right' }
      );

      // Pauta tenue dentro del resumen si el estilo es rayado
      if (options.paperStyle === 'lined') {
        doc.setDrawColor(253, 230, 138);
        doc.setLineWidth(0.15);
        for (let lineY = summaryY + 15; lineY < summaryY + summaryBoxHeight - 3; lineY += 5) {
          doc.line(margin + 4, lineY, margin + contentWidth - 4, lineY);
        }
      }

      // Texto del Resumen
      const rawSummary = (note.summary || '').trim();
      if (rawSummary) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.6);
        doc.setTextColor(30, 41, 59);
        const summaryText = cleanTextForPDF(rawSummary);
        const wrappedSummary = doc.splitTextToSize(summaryText, contentWidth - 8);
        let currentSummY = summaryY + 14;
        wrappedSummary.forEach((line: string) => {
          if (currentSummY < summaryY + summaryBoxHeight - 3) {
            doc.text(line, margin + 4, currentSummY);
            currentSummY += 4.5;
          }
        });
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9);
        doc.text(
          '(Espacio reservado para sintetizar en 2-3 frases el nucleo del tema tras la sesion de estudio)',
          margin + 4,
          summaryY + 14.5
        );
      }
    }
  },

  /**
   * Dibuja la cabecera académica Cornell con Asignatura, Tema, Fecha y Casillas de Repaso Espaciado
   */
  drawCornellHeader(
    doc: jsPDF,
    subject: Subject,
    note: CornellNote,
    topic: Topic | undefined,
    sheetNumber: number,
    totalSheets: number,
    margin: number,
    contentWidth: number,
    options: Required<ExportCornellPDFOptions>
  ): void {
    const [r, g, b] = hexToRgb(subject.color);

    // Caja de cabecera
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, 10, contentWidth, 23, 2, 2, 'FD');

    // Franja superior con el color de la asignatura
    doc.setFillColor(r, g, b);
    doc.rect(margin, 10, contentWidth, 3.2, 'F');

    // Título principal del Apunte Cornell
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(15, 23, 42);
    const titleSuffix = totalSheets > 1 ? ` (Hoja ${sheetNumber}/${totalSheets})` : '';
    const rawTitle = `${cleanTextForPDF(note.title || 'Apuntes Cornell')}${titleSuffix}`;
    const clippedTitle = doc.splitTextToSize(rawTitle, contentWidth - 62)[0];
    doc.text(clippedTitle, margin + 4, 20.2);

    // Casillas de Repaso Espaciado (R1, R2, R3, R4) en la esquina superior derecha
    if (options.includeReviewTracker) {
      const trackerX = margin + contentWidth - 54;
      const trackerY = 15.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text('REPASOS:', trackerX, trackerY + 3.2);

      const reviewsCount = topic?.vueltasCount ?? topic?.reviewsHistory?.length ?? 0;
      const labels = ['R1', 'R2', 'R3', 'R4'];
      labels.forEach((lbl, idx) => {
        const boxX = trackerX + 14 + idx * 9.5;
        const isCompleted = idx < reviewsCount;
        if (isCompleted) {
          doc.setFillColor(16, 185, 129); // Emerald 500
          doc.setDrawColor(16, 185, 129);
          doc.roundedRect(boxX, trackerY, 8, 4.5, 0.8, 0.8, 'FD');
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(148, 163, 184);
          doc.roundedRect(boxX, trackerY, 8, 4.5, 0.8, 0.8, 'FD');
          doc.setTextColor(71, 85, 105);
        }
        doc.setFontSize(6.5);
        doc.text(lbl, boxX + 4, trackerY + 3.2, { align: 'center' });
      });
    }

    // Línea divisoria interna en cabecera
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin + 3, 23.5, margin + contentWidth - 3, 23.5);

    // Fila inferior de metadatos: Asignatura | Tema | Dificultad | Fecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(r, g, b);
    const subLabel = cleanTextForPDF(
      `${subject.name}${subject.code ? ` (${subject.code})` : ''}`
    );
    doc.text(subLabel, margin + 4, 29.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    const metaSegments: string[] = [];
    if (options.includeTopicMetadata && topic) {
      metaSegments.push(`Tema: ${cleanTextForPDF(topic.title).slice(0, 38)}`);
      if (topic.difficulty) {
        metaSegments.push(`Dif: ${cleanTextForPDF(topic.difficulty)}`);
      }
    }
    const noteDate = note.updatedAt || note.createdAt || new Date().toISOString();
    metaSegments.push(`Fecha: ${noteDate.split('T')[0]}`);

    doc.text(metaSegments.join('   |   '), margin + contentWidth - 4, 29.2, {
      align: 'right',
    });
  },

  /**
   * Dibuja pauta rayada o cuadrícula académica suave en el área de notas
   */
  drawPaperRuling(
    doc: jsPDF,
    style: CornellPaperStyle,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (style === 'clean') return;

    doc.setDrawColor(236, 240, 245); // Gris azulado muy sutil que no interfiere con la lectura
    doc.setLineWidth(0.15);

    if (style === 'lined') {
      const stepY = 6.3;
      for (let curY = y + stepY; curY < y + height - 2; curY += stepY) {
        doc.line(x + 2, curY, x + width - 2, curY);
      }
    } else if (style === 'grid') {
      const step = 5;
      for (let curY = y + step; curY < y + height - 1; curY += step) {
        doc.line(x + 1, curY, x + width - 1, curY);
      }
      for (let curX = x + step; curX < x + width - 1; curX += step) {
        doc.line(curX, y + 1, curX, y + height - 1);
      }
    }
  },

  /**
   * Añade numeración de páginas y firma académica en el pie de todas las páginas del PDF
   */
  addGlobalPageFooters(doc: jsPDF, subject: Subject, singleNoteTitle?: string): void {
    const totalPages = doc.getNumberOfPages();
    const subClean = cleanTextForPDF(subject.name);
    const noteClean = singleNoteTitle ? ` · ${cleanTextForPDF(singleNoteTitle).slice(0, 35)}` : '';

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `StudyFlow · Metodo Cornell Estructurado · ${subClean}${noteClean}`,
        12,
        291.5
      );
      doc.setFont('helvetica', 'bold');
      doc.text(`Pagina ${i} de ${totalPages}`, 198, 291.5, { align: 'right' });
    }
  },
};
