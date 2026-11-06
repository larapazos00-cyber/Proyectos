import React, { useState, useEffect } from 'react';
import { Sparkles, Upload, FileText, Plus, Trash2, Check, ArrowRight, Loader2, Download, SlidersHorizontal, Paperclip } from 'lucide-react';
import { CornellNote, Topic, Subject, AttachedTopicFile, EditableKeyPoint } from '../types';
import { pdfCornellExportService } from '../services/pdfCornellExportService';
import { processImportedDocumentFile } from '../utils/documentParser';
import { CornellPdfExportModal } from './CornellPdfExportModal';

interface CornellEditorProps {
  note: CornellNote;
  topics: Topic[];
  subject?: Subject;
  onSave: (updatedNote: CornellNote, attachedFiles?: AttachedTopicFile[]) => void;
  onDelete?: (noteId: string) => void;
  onAttachFileToTopic?: (topicId: string, attachedFile: AttachedTopicFile) => void;
  onAiError?: (actionTitle: string, errorMessage: string) => void;
}

export const CornellEditor: React.FC<CornellEditorProps> = ({
  note,
  topics,
  subject,
  onSave,
  onDelete,
  onAttachFileToTopic,
  onAiError,
}) => {
  const [title, setTitle] = useState(note.title);
  const [topicId, setTopicId] = useState(note.topicId || (topics[0]?.id ?? ''));
  const [cues, setCues] = useState<string[]>(note.cues || []);
  const [notesText, setNotesText] = useState(note.notes || '');
  const [summary, setSummary] = useState(note.summary || '');
  const linkedTopic = topics.find((t) => t.id === (note.topicId || topicId));
  const [keyPoints, setKeyPoints] = useState<EditableKeyPoint[]>(
    note.keyPoints && note.keyPoints.length > 0
      ? note.keyPoints
      : linkedTopic?.keyPoints || []
  );
  const [newCueInput, setNewCueInput] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isGeneratingKeyPointsAI, setIsGeneratingKeyPointsAI] = useState(false);
  const [isStructuringFormatAI, setIsStructuringFormatAI] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [detectedDocPages, setDetectedDocPages] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<AttachedTopicFile[]>([]);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  useEffect(() => {
    setTitle(note.title);
    setTopicId(note.topicId || (topics[0]?.id ?? ''));
    setCues(note.cues || []);
    setNotesText(note.notes || '');
    setSummary(note.summary || '');
    const t = topics.find((item) => item.id === (note.topicId || topicId));
    setKeyPoints(
      note.keyPoints && note.keyPoints.length > 0
        ? note.keyPoints
        : t?.keyPoints || []
    );
  }, [note.id]);

  // Keep state synced if parent updates note content/keyPoints/summary via external AI buttons
  useEffect(() => {
    if (note.notes && note.notes !== notesText) {
      setNotesText(note.notes);
    }
    if (note.summary && note.summary !== summary) {
      setSummary(note.summary);
    }
    if (note.cues && note.cues.length > 0) {
      setCues(note.cues);
    }
    if (note.keyPoints && note.keyPoints.length > 0) {
      setKeyPoints(note.keyPoints);
    }
  }, [note.updatedAt]);

  const getEffectiveSourceText = (): string => {
    const currentTopic = topics.find((t) => t.id === topicId) || topics[0];
    const candidates: string[] = [];
    if (notesText?.trim()) candidates.push(notesText.trim());
    if (currentTopic?.notes?.trim()) candidates.push(currentTopic.notes.trim());
    if (currentTopic?.generalNotes?.trim()) candidates.push(currentTopic.generalNotes.trim());
    if (currentTopic?.attachedFiles && currentTopic.attachedFiles.length > 0) {
      const filesText = currentTopic.attachedFiles
        .map((f) => f.content || f.rawExtractedText || '')
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (filesText) candidates.push(filesText);
    }
    if (currentTopic?.description?.trim()) candidates.push(currentTopic.description.trim());
    if (currentTopic?.subtopics && currentTopic.subtopics.length > 0) {
      candidates.push(
        `Tema: ${currentTopic.title}\nSubtemas:\n${currentTopic.subtopics.map((s) => `- ${s}`).join('\n')}`
      );
    }
    const longest = candidates.sort((a, b) => b.length - a.length)[0];
    return (longest || currentTopic?.title || title || subject?.name || '').trim();
  };

  const buildCurrentNoteObject = (): CornellNote => ({
    ...note,
    title: title.trim() || 'Apuntes sin título',
    topicId: topicId || undefined,
    cues,
    notes: notesText,
    summary,
    keyPoints,
  });

  const buildTargetSubject = (currentNoteData: CornellNote): Subject =>
    subject || {
      id: 'sub-export',
      name: 'Asignatura',
      color: '#3b82f6',
      topics,
      tasks: [],
      exams: [],
      cornellNotes: [currentNoteData],
      flashcards: [],
      quizzes: [],
      feynmanSessions: [],
      mindmaps: [],
      errorLogs: [],
    };

  // Exportar apunte actual formateado a PDF en 1 clic
  const handleExportPDF = () => {
    const currentNoteData = buildCurrentNoteObject();
    const currentTopic = topics.find((t) => t.id === topicId);
    const targetSubject = buildTargetSubject(currentNoteData);
    pdfCornellExportService.exportSingleNote(targetSubject, currentNoteData, currentTopic);
    setSaveStatus('¡PDF descargado!');
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleAddCue = () => {
    if (!newCueInput.trim()) return;
    setCues([...cues, newCueInput.trim()]);
    setNewCueInput('');
  };

  const handleRemoveCue = (index: number) => {
    setCues(cues.filter((_, i) => i !== index));
  };

  const handleAddKeyPoint = () => {
    setKeyPoints((prev) => [
      ...prev,
      {
        id: `kp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: 'Nuevo punto clave',
        detail: 'Desarrolla aquí la idea clave o definición esencial...',
        category: 'Apuntes',
        importance: 'media',
      },
    ]);
  };

  const handleUpdateKeyPoint = (
    id: string,
    patch: Partial<EditableKeyPoint>
  ) => {
    setKeyPoints((prev) =>
      prev.map((kp) => (kp.id === id ? { ...kp, ...patch } : kp))
    );
  };

  const handleDeleteKeyPoint = (id: string) => {
    setKeyPoints((prev) => prev.filter((kp) => kp.id !== id));
  };

  const handleGenerateKeyPointsWithAI = async () => {
    setIsGeneratingKeyPointsAI(true);
    setOcrError(null);
    try {
      const currentTopic = topics.find((t) => t.id === topicId) || topics[0];
      const sourceText = getEffectiveSourceText();
      if (!sourceText) {
        throw new Error('No hay contenido en el apunte ni en el tema seleccionado para extraer puntos clave.');
      }

      const response = await fetch('/api/gemini/summarize-document-keypoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: title || currentTopic?.title || 'Apuntes',
          documentContent: sourceText,
          topicTitle: currentTopic?.title || title,
          subjectName: subject?.name || 'Asignatura',
        }),
      });

      const resJson = await response.json();
      if (!response.ok || resJson.success === false) {
        throw new Error(resJson.error || `Error del servidor (${response.status}) al generar puntos clave con IA.`);
      }

      const data = resJson.data || resJson;
      const nextSummary = data.summary || summary;
      const nextKeyPoints: EditableKeyPoint[] =
        Array.isArray(data.keyPoints) && data.keyPoints.length > 0
          ? data.keyPoints.map((kp: any, idx: number) => ({
              id: `kp-${Date.now()}-${idx}`,
              title: String(kp.title || `Punto clave ${idx + 1}`),
              detail: String(kp.detail || ''),
              category: kp.category ? String(kp.category) : 'Concepto',
              importance:
                kp.importance === 'alta' || kp.importance === 'baja'
                  ? kp.importance
                  : 'media',
              sourceDocName: title || currentTopic?.title,
            }))
          : keyPoints;
      const nextCues =
        Array.isArray(data.cues) && data.cues.length > 0
          ? Array.from(new Set([...cues, ...data.cues.map(String)])).slice(0, 12)
          : cues;

      if (nextSummary) setSummary(nextSummary);
      if (nextKeyPoints.length > 0) setKeyPoints(nextKeyPoints);
      if (nextCues.length > 0) setCues(nextCues);

      const updatedNote: CornellNote = {
        ...note,
        title: title.trim() || currentTopic?.title || 'Apuntes sin título',
        topicId: (topicId || currentTopic?.id) || undefined,
        cues: nextCues,
        notes: notesText || sourceText,
        summary: nextSummary,
        keyPoints: nextKeyPoints,
        updatedAt: new Date().toISOString(),
      };
      onSave(updatedNote);

      setSaveStatus(`¡${nextKeyPoints.length} Puntos clave IA listos!`);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      const msg = err?.message || 'Error al generar puntos clave con IA';
      setOcrError(msg);
      onAiError?.('Puntos clave IA', msg);
    } finally {
      setIsGeneratingKeyPointsAI(false);
    }
  };

  const handleImproveFormatWithAI = async () => {
    setIsStructuringFormatAI(true);
    setOcrError(null);
    try {
      const currentTopic = topics.find((t) => t.id === topicId) || topics[0];
      const sourceText = getEffectiveSourceText();
      if (!sourceText) {
        throw new Error('Escribe texto o selecciona un tema con contenido antes de mejorar el formato con IA.');
      }

      const response = await fetch('/api/gemini/structure-topic-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: currentTopic?.title || title || 'Apuntes del Tema',
          rawNotes: sourceText,
          subjectName: subject?.name || 'Asignatura',
        }),
      });

      const resJson = await response.json();
      if (!response.ok || resJson.success === false) {
        throw new Error(resJson.error || `Error del servidor (${response.status}) al mejorar el formato con IA.`);
      }

      const data = resJson.data || resJson;
      const nextNotes = data.notes || sourceText;
      const nextCues =
        Array.isArray(data.cues) && data.cues.length > 0
          ? data.cues.map(String)
          : cues;
      const nextSummary = data.summary || summary;

      setNotesText(nextNotes);
      if (nextCues.length > 0) setCues(nextCues);
      if (nextSummary) setSummary(nextSummary);

      const updatedNote: CornellNote = {
        ...note,
        title: title.trim() || currentTopic?.title || 'Apuntes sin título',
        topicId: (topicId || currentTopic?.id) || undefined,
        cues: nextCues,
        notes: nextNotes,
        summary: nextSummary,
        keyPoints,
        updatedAt: new Date().toISOString(),
      };
      onSave(updatedNote);

      setSaveStatus('¡Formato mejorado con IA!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      const msg = err?.message || 'Error al mejorar el formato con IA';
      setOcrError(msg);
      onAiError?.('Mejorar formato IA', msg);
    } finally {
      setIsStructuringFormatAI(false);
    }
  };

  const handleInsertKeyPointsIntoNotes = () => {
    if (keyPoints.length === 0) return;
    const block = [
      `### ✨ Puntos Clave Editables (${title})`,
      ...keyPoints.map(
        (kp, i) =>
          `${i + 1}. **[${(kp.importance || 'media').toUpperCase()}] ${kp.title}:** ${kp.detail}`
      ),
    ].join('\n');
    setNotesText((prev) => (prev.trim() ? `${prev.trim()}\n\n${block}` : block));
    setSaveStatus('Insertado en apuntes');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleSave = () => {
    const updated: CornellNote = {
      ...note,
      title: title.trim() || 'Apuntes sin título',
      topicId: topicId || undefined,
      cues,
      notes: notesText,
      summary,
      keyPoints,
      updatedAt: new Date().toISOString(),
    };
    onSave(updated, uploadedFiles.length > 0 ? uploadedFiles : undefined);
    setUploadedFiles([]);
    setSaveStatus('¡Guardado!');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  // Convert uploaded PDF(s), image or text file, count pages for organization and extract all written text
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setIsProcessingAI(true);
    setOcrError(null);

    try {
      const targetTopic = topics.find((t) => t.id === topicId) || topics[0];
      const extractedFiles: AttachedTopicFile[] = [];
      let combinedContent = notesText.trim();
      let nextTitle = title;
      let nextCues = [...cues];
      let nextSummary = summary;
      let totalPages = 0;

      for (const file of files) {
        const result = await processImportedDocumentFile(
          file,
          targetTopic ? targetTopic.title : title || file.name,
          subject?.name || 'Asignatura'
        );

        extractedFiles.push(result.attachedFile);
        totalPages += Math.max(1, result.attachedFile.pageCount || 1);

        if (result.detectedTitle && (!nextTitle || nextTitle === 'Nuevo Apunte')) {
          nextTitle = result.detectedTitle;
        }
        if (result.cues && result.cues.length > 0) {
          nextCues = Array.from(new Set([...nextCues, ...result.cues]));
        }
        if (result.attachedFile.content) {
          combinedContent = combinedContent
            ? `${combinedContent}\n\n---\n\n${result.attachedFile.content}`
            : result.attachedFile.content;
        }
        if (result.summary && !nextSummary) {
          nextSummary = result.summary;
        }
      }

      const resolvedTopicId = topicId || targetTopic?.id || '';
      if (nextTitle) setTitle(nextTitle);
      if (nextCues.length > 0) setCues(nextCues);
      if (combinedContent) setNotesText(combinedContent);
      if (nextSummary) setSummary(nextSummary);
      if (resolvedTopicId && !topicId) setTopicId(resolvedTopicId);
      setDetectedDocPages((prev) => (prev || 0) + totalPages);

      const nextUploaded = [...uploadedFiles, ...extractedFiles];
      setUploadedFiles(nextUploaded);

      // Immediately persist both the CornellNote and the attached PDFs so they are saved even before clicking Guardar
      const autoSavedNote: CornellNote = {
        ...note,
        title: (nextTitle || title).trim() || 'Apuntes sin título',
        topicId: resolvedTopicId || undefined,
        cues: nextCues,
        notes: combinedContent,
        summary: nextSummary,
        keyPoints,
        sourceType: 'ocr_pdf',
        updatedAt: new Date().toISOString(),
      };
      onSave(autoSavedNote, extractedFiles);
      setUploadedFiles([]);

      setSaveStatus(
        `¡Extraído y guardado (${totalPages} ${totalPages === 1 ? 'pág.' : 'págs.'})!`
      );
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Error al procesar el archivo';
      setOcrError(msg);
      onAiError?.('Importación OCR / Documento IA', msg);
    } finally {
      setIsProcessingAI(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del apunte o sesión..."
            className="w-full text-lg font-bold text-slate-900 bg-transparent border-none focus:outline-none placeholder-slate-400"
          />
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span>Tema asociado:</span>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="">(Sin tema específico)</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {detectedDocPages && (
              <>
                <span>·</span>
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold font-mono-numbers flex items-center gap-1">
                  <Paperclip className="w-3 h-3 text-emerald-600" />
                  <span>{detectedDocPages} págs. añadidas a organización</span>
                </span>
              </>
            )}
            {note.sourceType !== 'manual' && (
              <>
                <span>·</span>
                <span className="text-blue-600 font-medium">Digitalizado con OCR</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Puntos clave IA button */}
          <button
            type="button"
            disabled={isGeneratingKeyPointsAI}
            onClick={handleGenerateKeyPointsWithAI}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            title="Generar resumen ejecutivo y puntos clave con IA para este apunte"
          >
            {isGeneratingKeyPointsAI ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span>Generando Puntos Clave...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Puntos clave IA ({keyPoints.length})</span>
              </>
            )}
          </button>

          {/* Mejorar formato IA button */}
          <button
            type="button"
            disabled={isStructuringFormatAI}
            onClick={handleImproveFormatWithAI}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            title="Mejorar formato Markdown, extraer preguntas detonadoras y resumen con IA"
          >
            {isStructuringFormatAI ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>Mejorando formato...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Mejorar formato IA</span>
              </>
            )}
          </button>

          {/* File Upload OCR & Office Extraction Trigger */}
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Importar PDF / Word / PPTX / Imagen</span>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.odt,.odp,application/pdf,image/*,text/plain,.md,.txt"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessingAI}
            />
          </label>

          {onDelete && (
            <button
              onClick={() => onDelete(note.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
              title="Eliminar apunte"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Export to PDF Button Group */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors cursor-pointer"
              title="Descarga rápida del apunte Cornell en formato PDF estructurado A4"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Exportar PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="px-2 py-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 border-l border-slate-200 transition-colors cursor-pointer"
              title="Configurar diseño de página PDF (Rayado, Cuadrícula, Casillas Active Recall, Portada)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saveStatus || 'Guardar'}</span>
          </button>
        </div>
      </div>

      {(isProcessingAI || isStructuringFormatAI || isGeneratingKeyPointsAI) && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3 text-xs text-blue-700">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>
            {isGeneratingKeyPointsAI
              ? 'Analizando el contenido de la asignatura y generando puntos clave editables con IA...'
              : isStructuringFormatAI
              ? 'Estructurando apuntes, preguntas detonadoras y resumen en formato académico con IA...'
              : 'Extrayendo texto y estructurando formato Cornell con IA... Por favor espera un instante.'}
          </span>
        </div>
      )}

      {ocrError && (
        <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2">
          <span><strong>Aviso al generar con IA:</strong> {ocrError}</span>
          <button
            type="button"
            onClick={() => setOcrError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Cornell Note Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
        {/* Left Column: Cues & Key Questions (30%) */}
        <div className="md:col-span-4 p-5 border-r border-slate-200 bg-slate-50/40 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Preguntas Clave y Cues
            </h4>
            <span className="text-[10px] text-slate-400">Active Recall</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Escribe preguntas detonadoras o conceptos para tapar las notas y ponerte a prueba.
          </p>

          <div className="flex-1 space-y-2 overflow-y-auto mb-4">
            {cues.map((cue, idx) => (
              <div
                key={idx}
                className="group flex items-start justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 shadow-2xs hover:border-blue-300 transition-colors"
              >
                <span className="flex-1 font-medium">{cue}</span>
                <button
                  onClick={() => handleRemoveCue(idx)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
                  title="Eliminar cue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {cues.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                Sin preguntas clave aún. Añade una abajo o digitaliza apuntes con IA.
              </div>
            )}
          </div>

          {/* Add Cue Input */}
          <div className="flex gap-1.5 mt-auto pt-2 border-t border-slate-200">
            <input
              type="text"
              value={newCueInput}
              onChange={(e) => setNewCueInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCue()}
              placeholder="¿Qué formula define...? o palabra clave"
              className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAddCue}
              className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Añadir pregunta"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Detailed Notes Body (70%) */}
        <div className="md:col-span-8 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Cuerpo de Apuntes (Notes)
            </h4>
            <span className="text-xs text-slate-400">Esquemas, definiciones, fórmulas</span>
          </div>

          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Escribe tus notas estructuradas aquí..."
            className="flex-1 w-full p-3 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans leading-relaxed resize-none min-h-[340px]"
          />
        </div>
      </div>

      {/* Puntos Clave Editables (Generados con IA desde los documentos importados) */}
      <div className="p-5 border-t border-indigo-100 bg-indigo-50/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Puntos Clave Editables (Resúmenes IA de Documentos)</span>
              <span className="px-2 py-0.5 text-[10px] font-mono-numbers bg-indigo-100 text-indigo-700 rounded-full">
                {keyPoints.length}
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Edita el título, explicación o prioridad de cada punto clave extraído por IA o insértalos en el cuerpo de tus apuntes.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isGeneratingKeyPointsAI}
              onClick={handleGenerateKeyPointsWithAI}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingKeyPointsAI ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando con IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generar / Actualizar con IA</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleAddKeyPoint}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Punto Clave</span>
            </button>

            {keyPoints.length > 0 && (
              <button
                type="button"
                onClick={handleInsertKeyPointsIntoNotes}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Volcar al Cuerpo de Apuntes</span>
              </button>
            )}
          </div>
        </div>

        {keyPoints.length === 0 ? (
          <div className="p-4 rounded-xl bg-white/80 border border-indigo-100 text-center text-xs text-slate-500">
            Aún no hay puntos clave en este apunte. Pulsa <strong>"Generar / Actualizar con IA"</strong> o genéralos desde el panel lateral de documentos.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {keyPoints.map((kp, idx) => (
              <div
                key={kp.id}
                className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-700 font-mono-numbers text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={kp.title}
                      onChange={(e) =>
                        handleUpdateKeyPoint(kp.id, { title: e.target.value })
                      }
                      placeholder="Título del punto clave..."
                      className="w-full text-xs font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={kp.importance}
                      onChange={(e) =>
                        handleUpdateKeyPoint(kp.id, {
                          importance: e.target.value as EditableKeyPoint['importance'],
                        })
                      }
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border cursor-pointer ${
                        kp.importance === 'alta'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : kp.importance === 'baja'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteKeyPoint(kp.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Eliminar punto clave"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <textarea
                  value={kp.detail}
                  onChange={(e) =>
                    handleUpdateKeyPoint(kp.id, { detail: e.target.value })
                  }
                  rows={2}
                  placeholder="Explicación editable del punto clave..."
                  className="w-full text-xs text-slate-700 bg-slate-50/70 border border-slate-200/80 rounded-lg p-2 focus:outline-none focus:bg-white focus:border-indigo-400 resize-none leading-relaxed"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Full-Width Strip: Summary (2-3 sentences) */}
      <div className="p-5 border-t border-slate-200 bg-amber-50/20">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
            Resumen Sintético (Summary)
          </h4>
          <span className="text-xs text-amber-700/80">Conclusiones e ideas maestras para repaso veloz</span>
        </div>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Sintetiza en 2-3 frases el núcleo esencial de este tema..."
          rows={3}
          className="w-full p-2.5 text-xs text-slate-800 bg-white border border-amber-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 leading-relaxed resize-none"
        />
      </div>

      {/* Modal de Exportación PDF Cornell Personalizada */}
      <CornellPdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        subject={buildTargetSubject(buildCurrentNoteObject())}
        activeNote={buildCurrentNoteObject()}
        activeTopic={topics.find((t) => t.id === topicId)}
        defaultScope="single"
        onExportComplete={() => {
          setSaveStatus('¡PDF descargado!');
          setTimeout(() => setSaveStatus(null), 2500);
        }}
      />
    </div>
  );
};
