import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  CheckSquare,
  BookOpen,
  Sparkles,
  Grid,
  AlignJustify,
  FileCheck,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { Subject, CornellNote, Topic } from '../types';
import {
  pdfCornellExportService,
  CornellPaperStyle,
  ExportCornellPDFOptions,
} from '../services/pdfCornellExportService';

interface CornellPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  activeNote?: CornellNote;
  activeTopic?: Topic;
  defaultScope?: 'single' | 'subject';
  onExportComplete?: (message: string) => void;
}

export const CornellPdfExportModal: React.FC<CornellPdfExportModalProps> = ({
  isOpen,
  onClose,
  subject,
  activeNote,
  activeTopic,
  defaultScope = 'single',
  onExportComplete,
}) => {
  if (!isOpen) return null;

  const allSubjectNotes = pdfCornellExportService.getExportableNotesForSubject(
    subject,
    subject.topics
  );

  const [exportScope, setExportScope] = useState<'single' | 'subject'>(
    activeNote ? defaultScope : 'subject'
  );
  const [paperStyle, setPaperStyle] = useState<CornellPaperStyle>('lined');
  const [includeActiveRecallCheckboxes, setIncludeActiveRecallCheckboxes] = useState<boolean>(true);
  const [includeReviewTracker, setIncludeReviewTracker] = useState<boolean>(true);
  const [includeCoverPage, setIncludeCoverPage] = useState<boolean>(true);
  const [includeTopicMetadata, setIncludeTopicMetadata] = useState<boolean>(true);
  const [studentName, setStudentName] = useState<string>('');
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const previewNote: CornellNote = activeNote ||
    allSubjectNotes[0] || {
      id: 'preview',
      title: ' Apunte de Ejemplo · Método Cornell',
      cues: [
        '¿Cuál es el principio fundamental del tema?',
        '¿Qué fórmula o relación conecta los conceptos?',
        '¿Cómo se aplica en un caso práctico de examen?',
      ],
      notes:
        '## 1. Concepto Fundamental\nExplicación detallada y estructurada del bloque principal.\n- Primer elemento clave para recordar.\n- Segundo punto de desarrollo.\n> Idea crítica de examen destacada.',
      summary:
        'Síntesis ejecutiva en 2-3 frases con la conclusión esencial del tema para repaso rápido.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceType: 'manual',
    };

  const handleConfirmExport = () => {
    const options: ExportCornellPDFOptions = {
      paperStyle,
      includeActiveRecallCheckboxes,
      includeReviewTracker,
      includeCoverPage,
      includeTopicMetadata,
      studentName: studentName.trim(),
    };

    if (exportScope === 'single' && activeNote) {
      const linkedTopic =
        activeTopic || subject.topics.find((t) => t.id === activeNote.topicId);
      pdfCornellExportService.exportSingleNote(subject, activeNote, linkedTopic, options);
      onExportComplete?.(
        `¡PDF Cornell estructurado de "${activeNote.title}" descargado con éxito!`
      );
    } else {
      pdfCornellExportService.exportAllNotesFromSubject(subject, subject.topics, options);
      onExportComplete?.(
        `¡Cuaderno Cornell completo de ${subject.name} (${allSubjectNotes.length} apuntes) descargado en PDF!`
      );
    }

    setExportSuccess(true);
    setTimeout(() => {
      setExportSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-xs"
              style={{ backgroundColor: subject.color || '#2563eb' }}
            >
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  Exportación Estructurada A4
                </span>
                <span className="text-xs text-slate-500 font-semibold">{subject.name}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                Exportar Apuntes del Método Cornell a PDF
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Options (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                1. Qué apuntes deseas exportar
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeNote && (
                  <button
                    type="button"
                    onClick={() => setExportScope('single')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      exportScope === 'single'
                        ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/15'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <FileText
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        exportScope === 'single' ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900">
                        Ficha Cornell Actual
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {activeNote.title}
                      </div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setExportScope('subject')}
                  disabled={allSubjectNotes.length === 0}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 disabled:opacity-50 ${
                    exportScope === 'subject'
                      ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/15'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Layers
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      exportScope === 'subject' ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">
                      Cuaderno Completo ({allSubjectNotes.length})
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      Todos los apuntes Cornell de {subject.name}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Paper Ruling Style */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                2. Pauta del Cuerpo de Notas (Para lectura o impresión)
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaperStyle('lined')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    paperStyle === 'lined'
                      ? 'bg-indigo-50/80 border-indigo-500 text-indigo-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <AlignJustify className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs">Rayado Clásico</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Ideal para anotar a mano
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperStyle('clean')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    paperStyle === 'clean'
                      ? 'bg-indigo-50/80 border-indigo-500 text-indigo-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  <span className="text-xs">Blanco Limpio</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Lectura en pantalla / iPad
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperStyle('grid')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    paperStyle === 'grid'
                      ? 'bg-indigo-50/80 border-indigo-500 text-indigo-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Grid className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs">Cuadrícula</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Ciencias y esquemas
                  </span>
                </button>
              </div>
            </div>

            {/* Structured Pedagogical Elements */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                3. Elementos Pedagógicos de la Plantilla Cornell
              </label>
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeActiveRecallCheckboxes}
                    onChange={(e) => setIncludeActiveRecallCheckboxes(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Casillas de autoevaluación en Preguntas Clave (Active Recall)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Añade un cuadro de verificación [ ] junto a cada cue para marcar al repasar tapando la columna derecha.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200/60">
                  <input
                    type="checkbox"
                    checked={includeReviewTracker}
                    onChange={(e) => setIncludeReviewTracker(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Registro de Vueltas y Repasos (R1 · R2 · R3 · R4) en cabecera
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Muestra en la esquina superior las vueltas completadas y casillas para controlar tu repetición espaciada.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200/60">
                  <input
                    type="checkbox"
                    checked={includeTopicMetadata}
                    onChange={(e) => setIncludeTopicMetadata(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Metadatos académicos (Tema asociado, dificultad y fecha)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Incluye la trazabilidad de la asignatura y tema en el encabezado de cada hoja.
                    </div>
                  </div>
                </label>

                {exportScope === 'subject' && (
                  <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200/60">
                    <input
                      type="checkbox"
                      checked={includeCoverPage}
                      onChange={(e) => setIncludeCoverPage(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        Incluir Portada Académica e Índice de Temas
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Genera una primera página con los datos de la asignatura y el listado de todas las fichas Cornell.
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Optional Student Name */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nombre del Estudiante (Opcional en portada)
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ej: Ana García · Grado en Ingeniería / Medicina..."
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Right Column: Live Visual Sheet Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
              <span>Vista Previa de Estructura A4</span>
              <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                3 Zonas Cornell
              </span>
            </div>

            {/* Miniature A4 Cornell Sheet Representation */}
            <div className="flex-1 bg-slate-100 rounded-2xl p-4 border border-slate-200 flex items-center justify-center">
              <div className="w-full max-w-[270px] aspect-[1/1.414] bg-white rounded-lg shadow-md border border-slate-300 p-3 flex flex-col justify-between text-[9px] select-none">
                {/* 1. Mini Header */}
                <div className="border border-slate-300 rounded overflow-hidden shrink-0">
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: subject.color || '#2563eb' }}
                  />
                  <div className="p-1.5 bg-white">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 truncate text-[9px]">
                        {previewNote.title}
                      </span>
                      {includeReviewTracker && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <span className="px-1 py-0.2 bg-emerald-500 text-white rounded-[2px] text-[6px] font-bold">
                            R1
                          </span>
                          <span className="px-1 py-0.2 bg-slate-100 border border-slate-300 text-slate-500 rounded-[2px] text-[6px]">
                            R2
                          </span>
                          <span className="px-1 py-0.2 bg-slate-100 border border-slate-300 text-slate-500 rounded-[2px] text-[6px]">
                            R3
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-[7px] text-slate-500 truncate mt-0.5 flex justify-between">
                      <span className="font-semibold text-blue-700">{subject.name}</span>
                      <span>{(previewNote.cues || []).length} cues</span>
                    </div>
                  </div>
                </div>

                {/* 2. Mini Two-Column Body (30% Cues / 70% Notes) */}
                <div className="my-1.5 flex-1 border border-slate-300 rounded overflow-hidden flex min-h-0">
                  {/* Cues 30% */}
                  <div
                    className="w-[33%] bg-slate-50 p-1.5 flex flex-col gap-1 border-r-2"
                    style={{ borderRightColor: subject.color || '#2563eb' }}
                  >
                    <div className="text-[6.5px] font-extrabold uppercase text-slate-600 border-b border-slate-200 pb-0.5">
                      Cues / Preguntas
                    </div>
                    {(previewNote.cues && previewNote.cues.length > 0
                      ? previewNote.cues.slice(0, 4)
                      : ['¿Idea clave 1?', '¿Concepto 2?', '¿Relación 3?']
                    ).map((cue, idx) => (
                      <div
                        key={idx}
                        className="text-[7px] text-slate-700 leading-tight flex items-start gap-1 border-b border-slate-200/60 pb-1"
                      >
                        {includeActiveRecallCheckboxes && (
                          <span className="w-2 h-2 border border-slate-400 rounded-[1px] shrink-0 mt-0.5 bg-white" />
                        )}
                        <span className="line-clamp-2 font-medium">{cue}</span>
                      </div>
                    ))}
                  </div>

                  {/* Notes 70% */}
                  <div
                    className={`w-[67%] p-1.5 flex flex-col gap-1 relative ${
                      paperStyle === 'lined'
                        ? 'bg-[linear-gradient(to_bottom,transparent_11px,#f1f5f9_12px)] bg-[length:100%_12px]'
                        : paperStyle === 'grid'
                        ? 'bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:10px_10px]'
                        : 'bg-white'
                    }`}
                  >
                    <div className="text-[6.5px] font-extrabold uppercase text-slate-600 border-b border-slate-200 pb-0.5 bg-white/80">
                      Notas Estructuradas (70%)
                    </div>
                    <div className="text-[7.5px] text-slate-800 leading-snug space-y-1 overflow-hidden">
                      <p className="font-bold text-blue-700">1. Desarrollo Conceptual</p>
                      <p className="line-clamp-6 whitespace-pre-line text-[7px] text-slate-600">
                        {previewNote.notes ||
                          '• Definiciones estructuradas\n• Fórmulas y esquemas\n• Explicaciones de clase organizadas con paginación automática.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Mini Bottom Summary Box */}
                <div className="border border-amber-400 bg-amber-50/70 rounded p-1.5 shrink-0">
                  <div className="text-[6.5px] font-extrabold uppercase text-amber-900 border-b border-amber-200 pb-0.5 mb-0.5 flex justify-between">
                    <span>Resumen Sintético (Summary)</span>
                    <span className="font-normal text-amber-700">100% Pie</span>
                  </div>
                  <p className="text-[7px] text-slate-700 line-clamp-2 leading-tight">
                    {previewNote.summary ||
                      'Síntesis de 2-3 frases con las ideas clave para repaso rápido antes del examen.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Formato <strong className="text-slate-700">A4 Vertical</strong> con paginación automática sin recortes de texto.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmExport}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              {exportSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>¡PDF Descargado!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {exportScope === 'single'
                      ? 'Descargar PDF Cornell'
                      : `Descargar Cuaderno (${allSubjectNotes.length} Fichas)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
