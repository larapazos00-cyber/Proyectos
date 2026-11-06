import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Brain,
  Sparkles,
  Maximize2,
  Minimize2,
  Type,
  Sun,
  Moon,
  Coffee,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Save,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  Clock,
  Send,
  FileText,
  Copy,
  PenTool,
  Download,
  Upload,
  Paperclip,
  Loader2,
} from 'lucide-react';
import { Topic, Subject, FeynmanSession, CornellNote, AttachedTopicFile } from '../types';
import { pdfCornellExportService } from '../services/pdfCornellExportService';
import {
  processImportedDocumentFile,
  calculateOrganizedPagesFromFiles,
  detectTextPageCount,
} from '../utils/documentParser';

interface TopicReadingModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: Topic;
  subject: Subject;
  onUpdateTopicNotes?: (
    topicId: string,
    generalNotes: string,
    attachedFiles?: AttachedTopicFile[],
    pageCount?: number
  ) => void;
  onSaveFeynmanSession?: (session: FeynmanSession) => void;
}

type ReaderTheme = 'light' | 'sepia' | 'dark' | 'midnight';
type FontSize = 'sm' | 'base' | 'lg' | 'xl' | '2xl';

export const TopicReadingModeModal: React.FC<TopicReadingModeModalProps> = ({
  isOpen,
  onClose,
  topic,
  subject,
  onUpdateTopicNotes,
  onSaveFeynmanSession,
}) => {
  // Appearance state
  const [theme, setTheme] = useState<ReaderTheme>('sepia');
  const [fontSize, setFontSize] = useState<FontSize>('lg');
  const [isFeynmanPanelOpen, setIsFeynmanPanelOpen] = useState<boolean>(true);

  // Notes & attached documents editing inside reader
  const [notesContent, setNotesContent] = useState<string>(
    topic.generalNotes || topic.notes || ''
  );
  const [attachedFiles, setAttachedFiles] = useState<AttachedTopicFile[]>(
    topic.attachedFiles || []
  );
  const [activeDocId, setActiveDocId] = useState<'main' | string>('main');
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [hasSavedNotice, setHasSavedNotice] = useState<boolean>(false);
  const [isImportingFile, setIsImportingFile] = useState<boolean>(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Feynman Quick Notes Lateral Panel State
  const [feynmanConcept, setFeynmanConcept] = useState<string>(topic.title);
  const [feynmanExplanation, setFeynmanExplanation] = useState<string>('');
  const [feynmanGaps, setFeynmanGaps] = useState<string>('');
  const [feynmanAnalogy, setFeynmanAnalogy] = useState<string>('');
  const [savedFeynmanNotes, setSavedFeynmanNotes] = useState<
    Array<{
      id: string;
      concept: string;
      explanation: string;
      gaps?: string;
      analogy?: string;
      date: string;
    }>
  >([]);
  const [showFeynmanSuccess, setShowFeynmanSuccess] = useState<boolean>(false);

  // Sync state if topic changes
  useEffect(() => {
    const rawGeneral = topic.generalNotes || topic.notes || '';
    const files = topic.attachedFiles || [];
    const combinedFromFiles =
      !rawGeneral.trim() && files.length > 0
        ? files
            .map((f) =>
              files.length > 1
                ? `## ${f.name} (${f.pageCount} págs.)\n\n${f.content || ''}`
                : f.content || ''
            )
            .join('\n\n')
        : rawGeneral;

    setNotesContent(combinedFromFiles);
    setAttachedFiles(files);
    setActiveDocId(files.length > 0 && !rawGeneral.trim() ? files[files.length - 1].id : 'main');
    setFeynmanConcept(topic.title);
  }, [topic]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeAttachedDoc = attachedFiles.find((f) => f.id === activeDocId) || null;
  const fallbackCombinedText =
    attachedFiles.length > 0
      ? attachedFiles
          .map((f) =>
            attachedFiles.length > 1
              ? `## ${f.name} (${f.pageCount} págs.)\n\n${f.content || ''}`
              : f.content || ''
          )
          .join('\n\n')
      : '';
  const currentDisplayedText = activeAttachedDoc
    ? activeAttachedDoc.content
    : notesContent.trim()
    ? notesContent
    : fallbackCombinedText;

  const activeDisplayedImages = activeAttachedDoc
    ? activeAttachedDoc.extractedImages || []
    : attachedFiles.flatMap((f) => f.extractedImages || []);

  const handleDisplayedTextChange = (val: string) => {
    if (activeAttachedDoc) {
      const updated = attachedFiles.map((f) =>
        f.id === activeAttachedDoc.id
          ? { ...f, content: val, lastEditedAt: new Date().toISOString() }
          : f
      );
      setAttachedFiles(updated);
      if (attachedFiles.length === 1 || !notesContent.trim()) {
        setNotesContent(val);
      }
    } else {
      setNotesContent(val);
    }
  };

  const organizedPagesFromFiles = calculateOrganizedPagesFromFiles(attachedFiles);
  const effectiveTopicPages = Math.max(topic.pageCount || 0, organizedPagesFromFiles);

  // Words and reading time calculation
  const totalWords = (currentDisplayedText || '').trim().split(/\s+/).filter(Boolean).length;
  const estimatedReadMinutes = Math.max(1, Math.round(totalWords / 200));

  // Handle saving notes & attached files
  const handleSaveNotes = () => {
    if (onUpdateTopicNotes) {
      onUpdateTopicNotes(
        topic.id,
        notesContent,
        attachedFiles,
        effectiveTopicPages > 0 ? effectiveTopicPages : topic.pageCount
      );
    }
    setHasSavedNotice(true);
    setIsEditingNotes(false);
    setTimeout(() => setHasSavedNotice(false), 2500);
  };

  // Import file(s) directly inside Reading & Free-Writing Mode
  const handleImportFileInReader = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsImportingFile(true);
    setImportNotice(
      files.length === 1
        ? `Extrayendo texto íntegro de "${files[0].name}"...`
        : `Extrayendo texto de ${files.length} archivos...`
    );

    try {
      let updatedFiles = [...attachedFiles];
      let updatedMainNotes = notesContent.trim();
      let lastImportedId = activeDocId;
      let totalImportedPages = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await processImportedDocumentFile(
          file,
          topic.title,
          subject.name,
          (msg) =>
            setImportNotice(
              files.length > 1 ? `[${i + 1}/${files.length}] ${msg}` : msg
            )
        );
        updatedFiles = [...updatedFiles, result.attachedFile];
        lastImportedId = result.attachedFile.id;
        totalImportedPages += result.attachedFile.pageCount;

        updatedMainNotes = updatedMainNotes
          ? `${updatedMainNotes}\n\n## ${result.attachedFile.name} (${result.attachedFile.pageCount} págs.)\n\n${result.attachedFile.content}`
          : result.attachedFile.content;
      }

      setAttachedFiles(updatedFiles);
      setNotesContent(updatedMainNotes);

      const newTotalPages = Math.max(
        topic.pageCount || 0,
        calculateOrganizedPagesFromFiles(updatedFiles)
      );

      if (onUpdateTopicNotes) {
        onUpdateTopicNotes(topic.id, updatedMainNotes, updatedFiles, newTotalPages);
      }

      setActiveDocId(lastImportedId);
      setIsEditingNotes(false);
      setImportNotice(
        files.length === 1
          ? `¡Archivo "${files[0].name}" leído correctamente (${totalImportedPages} págs.)! Puedes leerlo aquí o pulsar "Editar en Escritura Libre".`
          : `¡${files.length} archivos leídos e importados (${totalImportedPages} págs. en total)!`
      );
      setTimeout(() => setImportNotice(null), 4500);
    } catch (err: any) {
      setImportNotice(err.message || 'Error al leer el documento importado.');
      setTimeout(() => setImportNotice(null), 4500);
    } finally {
      setIsImportingFile(false);
      e.target.value = '';
    }
  };

  // Exportar apuntes actuales del modo lectura a PDF Cornell estructurado
  const handleExportReadingCornellPDF = () => {
    const existingNote = (subject.cornellNotes || []).find((n) => n.topicId === topic.id);
    const noteToExport: CornellNote = existingNote
      ? {
          ...existingNote,
          notes: notesContent || existingNote.notes,
        }
      : {
          id: `reading-cornell-${topic.id}`,
          topicId: topic.id,
          title: topic.title,
          cues:
            topic.cues && topic.cues.length > 0
              ? topic.cues
              : (topic.subtopics || []).map((st) => `¿Qué es y cómo funciona ${st}?`),
          notes: notesContent || topic.notes || topic.description || '',
          summary: topic.summary || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sourceType: 'manual',
        };
    pdfCornellExportService.exportSingleNote(subject, noteToExport, topic);
  };

  // Handle saving Feynman note
  const handleSaveFeynmanQuickNote = () => {
    if (!feynmanConcept.trim() || !feynmanExplanation.trim()) return;

    const newNote = {
      id: `fey-${Date.now()}`,
      concept: feynmanConcept.trim(),
      explanation: feynmanExplanation.trim(),
      gaps: feynmanGaps.trim() || undefined,
      analogy: feynmanAnalogy.trim() || undefined,
      date: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    };

    setSavedFeynmanNotes((prev) => [newNote, ...prev]);

    // Dispatch full FeynmanSession if parent handler is attached
    if (onSaveFeynmanSession) {
      const fullSession: FeynmanSession = {
        id: newNote.id,
        topicId: topic.id,
        concept: newNote.concept,
        explanation: newNote.explanation,
        clarityScore: Math.min(10, Math.max(6, Math.round(10 - (newNote.explanation.length > 500 ? 1 : 0)))),
        identifiedJargon: [],
        conceptualGaps: newNote.gaps ? [newNote.gaps] : [],
        intuitiveAnalogies: newNote.analogy ? [newNote.analogy] : [],
        improvedDraft: newNote.explanation,
        feedback: 'Nota rápida Feynman guardada correctamente durante el Modo Lectura.',
        createdAt: new Date().toISOString(),
        inputMode: 'written',
      };
      onSaveFeynmanSession(fullSession);
    }

    // Reset fields for next concept
    setFeynmanExplanation('');
    setFeynmanGaps('');
    setFeynmanAnalogy('');
    setShowFeynmanSuccess(true);
    setTimeout(() => setShowFeynmanSuccess(false), 2500);
  };

  // Theme style classes
  const themeStyles = {
    light: {
      bg: 'bg-white',
      panelBg: 'bg-slate-50',
      text: 'text-slate-900',
      secondaryText: 'text-slate-600',
      headerBg: 'bg-slate-100/90 border-slate-200',
      border: 'border-slate-200',
      accent: 'text-blue-600',
      paperCard: 'bg-white border-slate-200 text-slate-800',
      feynmanCard: 'bg-white border-purple-200 text-slate-800 shadow-2xs',
    },
    sepia: {
      bg: 'bg-[#fcf8ed]',
      panelBg: 'bg-[#f4eedb]',
      text: 'text-[#433422]',
      secondaryText: 'text-[#796245]',
      headerBg: 'bg-[#ede5cc]/90 border-[#ded3b6]',
      border: 'border-[#ded3b6]',
      accent: 'text-[#9c5f1e]',
      paperCard: 'bg-[#fffdf7] border-[#ded3b6] text-[#433422]',
      feynmanCard: 'bg-[#fffdf7] border-[#e1d5b8] text-[#433422] shadow-2xs',
    },
    dark: {
      bg: 'bg-slate-900',
      panelBg: 'bg-slate-950',
      text: 'text-slate-100',
      secondaryText: 'text-slate-400',
      headerBg: 'bg-slate-900/90 border-slate-800',
      border: 'border-slate-800',
      accent: 'text-blue-400',
      paperCard: 'bg-slate-800/80 border-slate-700 text-slate-100',
      feynmanCard: 'bg-slate-800/80 border-purple-900/50 text-slate-100 shadow-2xs',
    },
    midnight: {
      bg: 'bg-black',
      panelBg: 'bg-[#0a0a0a]',
      text: 'text-neutral-200',
      secondaryText: 'text-neutral-500',
      headerBg: 'bg-black/90 border-neutral-800',
      border: 'border-neutral-800',
      accent: 'text-emerald-400',
      paperCard: 'bg-neutral-900 border-neutral-800 text-neutral-200',
      feynmanCard: 'bg-neutral-900 border-neutral-800 text-neutral-200 shadow-2xs',
    },
  }[theme];

  // Font size classes
  const fontSizes = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-relaxed',
    xl: 'text-xl leading-loose',
    '2xl': 'text-2xl leading-loose',
  }[fontSize];

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${themeStyles.bg} ${themeStyles.text} select-text transition-colors duration-200 animate-in fade-in`}>
      {/* Top Reading Navigation Bar */}
      <header className={`h-14 px-4 sm:px-6 flex items-center justify-between border-b backdrop-blur-md shrink-0 ${themeStyles.headerBg} ${themeStyles.border}`}>
        {/* Left: Subject & Topic Details */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0 shadow-2xs ring-2 ring-white/20"
            style={{ backgroundColor: subject.color || '#3b82f6' }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs uppercase opacity-75">
                {subject.code || subject.name}
              </span>
              <span className="text-xs opacity-50">·</span>
              <h2 className="font-bold text-sm truncate max-w-xs sm:max-w-md">
                {topic.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Center/Right Controls: Typography, Themes & Feynman Panel Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Estimated read time badge */}
          <div className="hidden md:flex items-center gap-1.5 text-xs opacity-75 font-mono-numbers px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5">
            <Clock className="w-3.5 h-3.5" />
            <span>~{estimatedReadMinutes} min lectura</span>
          </div>

          {/* Font Size Adjusters */}
          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl border bg-black/5 dark:bg-white/5 border-current/10">
            <button
              type="button"
              onClick={() => {
                const sizes: FontSize[] = ['sm', 'base', 'lg', 'xl', '2xl'];
                const idx = sizes.indexOf(fontSize);
                if (idx > 0) setFontSize(sizes[idx - 1]);
              }}
              disabled={fontSize === 'sm'}
              className="px-2 py-0.5 text-xs font-bold rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
              title="Disminuir tamaño de letra"
            >
              A-
            </button>
            <span className="text-[10px] uppercase font-mono px-1 opacity-70">
              {fontSize}
            </span>
            <button
              type="button"
              onClick={() => {
                const sizes: FontSize[] = ['sm', 'base', 'lg', 'xl', '2xl'];
                const idx = sizes.indexOf(fontSize);
                if (idx < sizes.length - 1) setFontSize(sizes[idx + 1]);
              }}
              disabled={fontSize === '2xl'}
              className="px-2 py-0.5 text-xs font-bold rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
              title="Aumentar tamaño de letra"
            >
              A+
            </button>
          </div>

          {/* Theme Selector */}
          <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl border bg-black/5 dark:bg-white/5 border-current/10">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Tema Claro / Blanco"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('sepia')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'sepia' ? 'bg-[#ede5cc] text-[#433422] shadow-xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Tema Sepia (Cálido para vista cansada)"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'dark' ? 'bg-slate-800 text-white shadow-xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Tema Oscuro"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('midnight')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'midnight' ? 'bg-neutral-800 text-white shadow-xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Tema Medianoche (Negro Puro OLED)"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 border border-neutral-600" />
            </button>
          </div>

          {/* Export Cornell PDF Button */}
          <button
            type="button"
            onClick={handleExportReadingCornellPDF}
            className="px-3 py-1.5 rounded-xl border bg-black/5 dark:bg-white/5 border-current/10 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 opacity-85 hover:opacity-100"
            title="Exportar apuntes de este tema a un archivo PDF estructurado con el Método Cornell"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF Cornell</span>
          </button>

          {/* Toggle Feynman Side Panel */}
          <button
            type="button"
            onClick={() => setIsFeynmanPanelOpen(!isFeynmanPanelOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              isFeynmanPanelOpen
                ? 'bg-purple-600 text-white border-purple-500 hover:bg-purple-700'
                : 'bg-black/5 dark:bg-white/5 border-current/10 opacity-80 hover:opacity-100'
            }`}
            title="Abrir o cerrar panel lateral de notas Feynman"
          >
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Notas Feynman</span>
          </button>

          {/* Close Fullscreen Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer opacity-70 hover:opacity-100"
            title="Salir de pantalla completa (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Reading & Side-by-Side Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center Reading Canvas */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-12">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Topic Header inside canvas */}
            <div className="border-b pb-6 border-current/10 space-y-2">
              <div className="flex items-center gap-2 text-xs opacity-60">
                <span className="font-semibold uppercase tracking-wider">{subject.name}</span>
                <span>·</span>
                <span>Dificultad: {topic.difficulty}</span>
                {topic.pageCount && (
                  <>
                    <span>·</span>
                    <span className="font-mono-numbers">{topic.pageCount} páginas</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-serif">
                {topic.title}
              </h1>
              {topic.description && (
                <p className="text-base opacity-80 italic pt-1">
                  {topic.description}
                </p>
              )}
            </div>

            {/* Subtopics pill cloud */}
            {topic.subtopics && topic.subtopics.length > 0 && (
              <div className="p-4 rounded-2xl border bg-black/5 dark:bg-white/5 border-current/10">
                <span className="text-xs font-bold uppercase tracking-wider opacity-70 block mb-2">
                  Índice de Subtemas
                </span>
                <div className="flex flex-wrap gap-2">
                  {topic.subtopics.map((st, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFeynmanConcept(st)}
                      className="text-xs px-2.5 py-1 rounded-lg border bg-current/5 border-current/10 hover:bg-purple-500/20 transition-colors cursor-pointer text-left"
                      title="Haz clic para enviar este subtema al panel Feynman"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Notes Content Area */}
            <div className="space-y-5">
              {/* Attached Documents & Free-Writing Selector Bar */}
              <div className="p-3.5 rounded-2xl border bg-black/5 dark:bg-white/5 border-current/10 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Paperclip className="w-3.5 h-3.5 opacity-75" />
                    <span className="font-bold">
                      Documentos y Escritura Libre ({attachedFiles.length} archivos ·{' '}
                      {effectiveTopicPages || detectTextPageCount(currentDisplayedText)} págs. en organización)
                    </span>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-2xs transition-colors">
                    {isImportingFile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Detectando...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>+ Importar Documento (Contar Págs. y Editar)</span>
                      </>
                    )}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.odt,.odp,.rtf,.html,.htm,.csv,image/png,image/jpeg,image/webp,text/plain,.md,.txt"
                      onChange={handleImportFileInReader}
                      disabled={isImportingFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {importNotice && (
                  <div className="text-xs px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 font-medium">
                    {importNotice}
                  </div>
                )}

                {attachedFiles.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveDocId('main')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        activeDocId === 'main'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-current/5 border-current/15 opacity-80 hover:opacity-100'
                      }`}
                    >
                      Apuntes Generales del Tema
                    </button>
                    {attachedFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setActiveDocId(file.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          activeDocId === file.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-current/5 border-current/15 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <span className="truncate max-w-[160px]">{file.name}</span>
                        <span className="text-[10px] opacity-85 font-mono-numbers">
                          ({file.pageCount}p)
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    {activeAttachedDoc
                      ? `Documento Importado: ${activeAttachedDoc.name} (${activeAttachedDoc.pageCount} págs.)`
                      : 'Apuntes Libres y Contenido del Tema'}
                  </span>
                </span>

                <div className="flex items-center gap-2">
                  {hasSavedNotice && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Guardado</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingNotes) {
                        handleSaveNotes();
                      } else {
                        setIsEditingNotes(true);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-xl border border-current/20 hover:bg-black/5 dark:hover:bg-white/5 font-semibold transition-colors cursor-pointer"
                  >
                    {isEditingNotes ? (
                      <>
                        <Save className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Guardar Cambios</span>
                      </>
                    ) : (
                      <>
                        <PenTool className="w-3.5 h-3.5" />
                        <span>Editar en Escritura Libre</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isEditingNotes ? (
                <div className="space-y-3">
                  <textarea
                    value={currentDisplayedText}
                    onChange={(e) => handleDisplayedTextChange(e.target.value)}
                    rows={16}
                    placeholder="Escribe o edita aquí toda la información escrita del documento o tus apuntes libres..."
                    className={`w-full p-5 rounded-2xl border font-sans outline-none focus:ring-2 focus:ring-purple-500 resize-y ${themeStyles.paperCard} ${fontSizes}`}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(false)}
                      className="px-3 py-1.5 text-xs opacity-70 hover:opacity-100 cursor-pointer font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-xs"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </div>
              ) : currentDisplayedText && currentDisplayedText.trim().length > 0 ? (
                <article
                  className={`prose prose-slate max-w-none font-serif ${fontSizes} select-text space-y-4 leading-relaxed`}
                  onMouseUp={() => {
                    const sel = window.getSelection()?.toString().trim();
                    if (sel && sel.length > 3 && sel.length < 80) {
                      setFeynmanConcept(sel);
                    }
                  }}
                  title="Puedes seleccionar cualquier texto o concepto para enviarlo al panel Feynman lateral"
                >
                  {currentDisplayedText.split(/\n{2,}/).map((block, idx) => {
                    const trimmed = block.trim();
                    if (!trimmed) return null;

                    // Page divider: --- Página X ---
                    if (/^---\s*(Página|Diapositiva)\s+\d+/i.test(trimmed)) {
                      const cleanLabel = trimmed.replace(/^---+\s*|\s*---+$/g, '');
                      return (
                        <div
                          key={idx}
                          className="my-6 flex items-center gap-3 select-none opacity-65"
                        >
                          <div className="h-px flex-1 bg-current opacity-20" />
                          <span className="text-[11px] font-sans font-bold uppercase tracking-widest px-3 py-0.5 rounded-full border border-current/20">
                            {cleanLabel}
                          </span>
                          <div className="h-px flex-1 bg-current opacity-20" />
                        </div>
                      );
                    }

                    // Headings (#, ##, ###)
                    if (trimmed.startsWith('### ')) {
                      return (
                        <h3
                          key={idx}
                          className="text-lg sm:text-xl font-bold font-sans tracking-tight pt-3"
                        >
                          {trimmed.replace(/^###\s+/, '')}
                        </h3>
                      );
                    }
                    if (trimmed.startsWith('## ')) {
                      return (
                        <h2
                          key={idx}
                          className="text-xl sm:text-2xl font-extrabold font-sans tracking-tight pt-4 border-b border-current/10 pb-1.5"
                        >
                          {trimmed.replace(/^##\s+/, '')}
                        </h2>
                      );
                    }
                    if (trimmed.startsWith('# ')) {
                      return (
                        <h1
                          key={idx}
                          className="text-2xl sm:text-3xl font-extrabold font-sans tracking-tight pt-4"
                        >
                          {trimmed.replace(/^#\s+/, '')}
                        </h1>
                      );
                    }

                    // Bullet list block
                    const lines = trimmed.split('\n');
                    if (lines.every((l) => /^(\s*[-*•]|\s*\d+\.)\s+/.test(l))) {
                      return (
                        <ul key={idx} className="list-disc pl-6 space-y-1.5">
                          {lines.map((item, lIdx) => (
                            <li key={lIdx} className="leading-relaxed">
                              {item.replace(/^(\s*[-*•]|\s*\d+\.)\s+/, '')}
                            </li>
                          ))}
                        </ul>
                      );
                    }

                    // Blockquote
                    if (trimmed.startsWith('> ')) {
                      return (
                        <blockquote
                          key={idx}
                          className="border-l-4 border-purple-500/60 pl-4 italic opacity-90 my-3"
                        >
                          {trimmed.replace(/^>\s+/gm, '')}
                        </blockquote>
                      );
                    }

                    return (
                      <p key={idx} className="whitespace-pre-wrap leading-relaxed">
                        {trimmed}
                      </p>
                    );
                  })}

                  {activeDisplayedImages.length > 0 && (
                    <div className="pt-6 border-t border-current/10 space-y-4">
                      <h4 className="text-xs font-sans font-bold uppercase tracking-wider opacity-70">
                        Imágenes y Figuras del Documento ({activeDisplayedImages.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeDisplayedImages.map((img) => (
                          <figure
                            key={img.id}
                            className={`p-3 rounded-2xl border ${themeStyles.paperCard} space-y-2`}
                          >
                            <img
                              src={img.dataUrl}
                              alt={img.name}
                              className="w-full max-h-72 object-contain rounded-xl bg-white"
                            />
                            <figcaption className="text-xs font-sans opacity-75 text-center truncate">
                              {img.caption || img.name}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ) : (
                /* Empty state with instant editor prompt */
                <div className={`p-8 rounded-3xl border border-dashed text-center space-y-4 ${themeStyles.paperCard}`}>
                  <BookOpen className="w-10 h-10 mx-auto opacity-40" />
                  <div>
                    <h3 className="font-bold text-base">No hay apuntes redactados para este tema</h3>
                    <p className="text-xs opacity-75 max-w-md mx-auto mt-1">
                      Comienza a tomar notas libres o importa un documento (PDF, imagen o texto) para detectar sus páginas y editar su contenido escrito aquí mismo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingNotes(true)}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-2"
                  >
                    <PenTool className="w-4 h-4" />
                    <span>Redactar Apuntes Libres</span>
                  </button>
                </div>
              )}

              {/* Cornell Cues & Summary if present */}
              {topic.summary && (
                <div className="mt-8 p-5 rounded-2xl border bg-purple-500/10 border-purple-500/20 space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Resumen Sintetizado (Método Cornell)</span>
                  </h4>
                  <p className={`italic ${fontSizes}`}>
                    {topic.summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right / Lateral Panel: Método Feynman */}
        {isFeynmanPanelOpen && (
          <aside className={`w-80 sm:w-96 border-l flex flex-col shrink-0 overflow-hidden ${themeStyles.panelBg} ${themeStyles.border} animate-in slide-in-from-right-10 duration-200`}>
            {/* Lateral Panel Header */}
            <div className={`p-4 border-b shrink-0 flex items-center justify-between ${themeStyles.border}`}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-600 text-white rounded-lg shadow-2xs">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs">Notas Feynman</h3>
                  <p className="text-[10px] opacity-70">Explicación en lenguaje simple</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFeynmanPanelOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Cerrar panel Feynman"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Lateral Panel Form & History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Educational Tooltip Banner */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-1">
                <div className="font-bold text-[11px] text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Método Feynman para Active Recall</span>
                </div>
                <p className="text-[10px] opacity-80 leading-relaxed">
                  Lee tus apuntes a la izquierda y explica cada concepto aquí como si se lo enseñaras a alguien de 10 años. Si usas palabras complejas, identifícalo como laguna de comprensión.
                </p>
              </div>

              {/* Form: Concepto a Explicar */}
              <div className="space-y-1">
                <label className="block font-bold text-[11px] opacity-80">
                  Concepto Clave
                </label>
                <input
                  type="text"
                  value={feynmanConcept}
                  onChange={(e) => setFeynmanConcept(e.target.value)}
                  placeholder="Ej: Mitocondria, Entalpía, Regla de Bayes..."
                  className={`w-full p-2.5 rounded-xl border font-semibold outline-none focus:ring-2 focus:ring-purple-500 text-xs ${themeStyles.paperCard}`}
                />
              </div>

              {/* Form: Explicación Simple */}
              <div className="space-y-1">
                <label className="block font-bold text-[11px] opacity-80 flex items-center justify-between">
                  <span>Explicación Simple (Sin jerga)</span>
                  <span className="text-[10px] opacity-50 font-mono-numbers">
                    {feynmanExplanation.trim().split(/\s+/).filter(Boolean).length} palabras
                  </span>
                </label>
                <textarea
                  value={feynmanExplanation}
                  onChange={(e) => setFeynmanExplanation(e.target.value)}
                  rows={4}
                  placeholder="Explica qué es, cómo funciona y para qué sirve usando palabras cotidianas..."
                  className={`w-full p-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 text-xs leading-relaxed ${themeStyles.paperCard}`}
                />
              </div>

              {/* Form: Analogía o Metáfora Intuitiva */}
              <div className="space-y-1">
                <label className="block font-bold text-[11px] opacity-80">
                  Analogía de la Vida Real (Opcional)
                </label>
                <input
                  type="text"
                  value={feynmanAnalogy}
                  onChange={(e) => setFeynmanAnalogy(e.target.value)}
                  placeholder="Ej: Es como la batería de un móvil o un peaje..."
                  className={`w-full p-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 text-xs ${themeStyles.paperCard}`}
                />
              </div>

              {/* Form: Lagunas Detectadas / Dudas */}
              <div className="space-y-1">
                <label className="block font-bold text-[11px] opacity-80 flex items-center gap-1">
                  <span>Lagunas Detectadas / ¿Dónde me trabé?</span>
                </label>
                <input
                  type="text"
                  value={feynmanGaps}
                  onChange={(e) => setFeynmanGaps(e.target.value)}
                  placeholder="Ej: No sé explicar cómo se recarga el ATP..."
                  className={`w-full p-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 text-xs ${themeStyles.paperCard}`}
                />
              </div>

              {/* Save Button & Feedback */}
              <div className="pt-2">
                {showFeynmanSuccess && (
                  <div className="mb-2 p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-center font-bold text-xs flex items-center justify-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>¡Nota Feynman guardada con éxito!</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSaveFeynmanQuickNote}
                  disabled={!feynmanConcept.trim() || !feynmanExplanation.trim()}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Guardar Nota Feynman</span>
                </button>
              </div>

              {/* List of Previous Feynman Notes in this Reading Session */}
              {savedFeynmanNotes.length > 0 && (
                <div className="pt-4 border-t border-current/10 space-y-2">
                  <span className="font-bold text-[11px] uppercase tracking-wider opacity-60 block">
                    Notas Generadas en esta Sesión ({savedFeynmanNotes.length})
                  </span>
                  <div className="space-y-2">
                    {savedFeynmanNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 ${themeStyles.feynmanCard}`}
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-purple-700 dark:text-purple-300">
                            {note.concept}
                          </h5>
                          <span className="text-[10px] opacity-50 font-mono-numbers">
                            {note.date}
                          </span>
                        </div>
                        <p className="leading-snug opacity-80">
                          {note.explanation}
                        </p>
                        {note.analogy && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                            💡 {note.analogy}
                          </div>
                        )}
                        {note.gaps && (
                          <div className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded">
                            ⚠️ Laguna: {note.gaps}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
