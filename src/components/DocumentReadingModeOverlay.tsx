import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  X,
  Highlighter,
  MessageSquarePlus,
  MessageSquare,
  Sun,
  Coffee,
  Moon,
  Check,
  Trash2,
  Eraser,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Sparkles,
  CheckCircle2,
  Edit3,
  Plus,
  StickyNote,
} from 'lucide-react';
import {
  Subject,
  Topic,
  AttachedTopicFile,
  DocumentComment,
  DocumentImageAsset,
} from '../types';
import {
  convertMarkdownAndImagesToRichHtml,
  convertRichHtmlToPlainText,
} from '../utils/documentParser';
import { NormalizedSubjectDocument } from './SubjectDocumentsSidePanel';

export type HighlightColorKey = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

interface HighlightColorOption {
  key: HighlightColorKey;
  label: string;
  shortLabel: string;
  hex: string;
  dotClass: string;
  cardClass: string;
  textClass: string;
}

export const READING_HIGHLIGHT_PALETTE: HighlightColorOption[] = [
  {
    key: 'yellow',
    label: 'Amarillo · Idea principal',
    shortLabel: 'Idea clave',
    hex: '#fef08a',
    dotClass: 'bg-yellow-300 border-yellow-500',
    cardClass: 'bg-yellow-50/90 border-yellow-300/80 dark:bg-yellow-950/40 dark:border-yellow-700/60',
    textClass: 'text-yellow-900 dark:text-yellow-200',
  },
  {
    key: 'green',
    label: 'Verde · Definición / Dato',
    shortLabel: 'Definición',
    hex: '#bbf7d0',
    dotClass: 'bg-emerald-300 border-emerald-500',
    cardClass: 'bg-emerald-50/90 border-emerald-300/80 dark:bg-emerald-950/40 dark:border-emerald-700/60',
    textClass: 'text-emerald-900 dark:text-emerald-200',
  },
  {
    key: 'blue',
    label: 'Azul · Fórmula / Técnico',
    shortLabel: 'Técnico',
    hex: '#bae6fd',
    dotClass: 'bg-sky-300 border-sky-500',
    cardClass: 'bg-sky-50/90 border-sky-300/80 dark:bg-sky-950/40 dark:border-sky-700/60',
    textClass: 'text-sky-900 dark:text-sky-200',
  },
  {
    key: 'pink',
    label: 'Rosa · Pregunta de examen',
    shortLabel: 'Examen',
    hex: '#fbcfe8',
    dotClass: 'bg-pink-300 border-pink-500',
    cardClass: 'bg-pink-50/90 border-pink-300/80 dark:bg-pink-950/40 dark:border-pink-700/60',
    textClass: 'text-pink-900 dark:text-pink-200',
  },
  {
    key: 'orange',
    label: 'Naranja · Repasar / Duda',
    shortLabel: 'Duda',
    hex: '#fed7aa',
    dotClass: 'bg-orange-300 border-orange-500',
    cardClass: 'bg-orange-50/90 border-orange-300/80 dark:bg-orange-950/40 dark:border-orange-700/60',
    textClass: 'text-orange-900 dark:text-orange-200',
  },
];

type ReaderTheme = 'light' | 'sepia' | 'dark' | 'midnight';
type FontSize = 'sm' | 'base' | 'lg' | 'xl';

interface FloatingSelectionMenuState {
  visible: boolean;
  top: number;
  left: number;
  placement: 'above' | 'below';
  selectedText: string;
  showNoteForm: boolean;
}

interface DocumentReadingModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  documents: NormalizedSubjectDocument[];
  initialDocumentId: string;
  onSaveDocumentReadingChanges: (
    doc: NormalizedSubjectDocument,
    updates: {
      markdownContent: string;
      richHtmlContent: string;
      comments: DocumentComment[];
      pagesRead?: number;
    }
  ) => void;
}

export const DocumentReadingModeOverlay: React.FC<DocumentReadingModeOverlayProps> = ({
  isOpen,
  onClose,
  subject,
  documents,
  initialDocumentId,
  onSaveDocumentReadingChanges,
}) => {
  const [activeDocId, setActiveDocId] = useState<string>(initialDocumentId);
  const [theme, setTheme] = useState<ReaderTheme>('sepia');
  const [fontSize, setFontSize] = useState<FontSize>('lg');
  const [showNotesSidebar, setShowNotesSidebar] = useState<boolean>(true);
  const [activeContinuousColor, setActiveContinuousColor] = useState<HighlightColorKey | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Floating menu state for text selection
  const [floatingMenu, setFloatingMenu] = useState<FloatingSelectionMenuState>({
    visible: false,
    top: 0,
    left: 0,
    placement: 'above',
    selectedText: '',
    showNoteForm: false,
  });

  // Quick note input inside floating menu or sidebar
  const [quickNoteText, setQuickNoteText] = useState<string>('');
  const [quickNoteColor, setQuickNoteColor] = useState<HighlightColorKey>('yellow');
  const [quickNoteQuote, setQuickNoteQuote] = useState<string>('');
  const [isQuickNoteModalOpen, setIsQuickNoteModalOpen] = useState<boolean>(false);

  // Editing an existing note
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');
  const [noteFilterColor, setNoteFilterColor] = useState<HighlightColorKey | 'all'>('all');

  const readerCanvasRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRangeRef = useRef<Range | null>(null);
  const loadedDocIdRef = useRef<string>('');

  // Sync activeDocId when prop changes
  useEffect(() => {
    if (initialDocumentId) {
      setActiveDocId(initialDocumentId);
    }
  }, [initialDocumentId]);

  const activeDoc: NormalizedSubjectDocument | undefined = useMemo(() => {
    return documents.find((d) => d.id === activeDocId) || documents[0];
  }, [documents, activeDocId]);

  const activeTopic: Topic | undefined = useMemo(() => {
    if (!activeDoc) return undefined;
    return subject.topics.find((t) => t.id === activeDoc.topicId);
  }, [subject.topics, activeDoc]);

  const activeAttachedFile: AttachedTopicFile | undefined = useMemo(() => {
    if (!activeTopic || !activeDoc) return undefined;
    return (activeTopic.attachedFiles || []).find((f) => f.id === activeDoc.id);
  }, [activeTopic, activeDoc]);

  // Resolve comments for current document
  const currentComments: DocumentComment[] = useMemo(() => {
    if (activeAttachedFile?.comments) {
      return activeAttachedFile.comments;
    }
    if (activeTopic?.generalComments) {
      return activeTopic.generalComments;
    }
    return [];
  }, [activeAttachedFile, activeTopic]);

  // Resolve images for current document
  const currentImages: DocumentImageAsset[] = useMemo(() => {
    if (activeAttachedFile?.extractedImages && activeAttachedFile.extractedImages.length > 0) {
      return activeAttachedFile.extractedImages;
    }
    return activeTopic?.generalImages || [];
  }, [activeAttachedFile, activeTopic]);

  // Resolve initial rich HTML for the document
  const initialRichHtml = useMemo(() => {
    if (!activeDoc) return '';
    if (activeAttachedFile?.richHtmlContent && activeAttachedFile.richHtmlContent.trim()) {
      return activeAttachedFile.richHtmlContent;
    }
    if (activeDoc.isSynthesized && activeTopic?.richGeneralNotes && activeTopic.richGeneralNotes.trim()) {
      return activeTopic.richGeneralNotes;
    }
    const rawText =
      activeAttachedFile?.content ||
      activeDoc.content ||
      activeTopic?.notes ||
      activeTopic?.description ||
      `# ${activeDoc.name}\n\nContenido académico del tema **${activeDoc.topicTitle}** en la asignatura **${subject.name}**.\n\nSelecciona cualquier fragmento de texto con el cursor para resaltarlo en colores o añadir una nota rápida mediante el menú flotante.`;
    return convertMarkdownAndImagesToRichHtml(rawText, currentImages);
  }, [activeDoc, activeAttachedFile, activeTopic, currentImages, subject.name]);

  // Load HTML into canvas when document changes
  useEffect(() => {
    if (!isOpen || !activeDoc || !readerCanvasRef.current) return;
    if (loadedDocIdRef.current !== activeDoc.id) {
      readerCanvasRef.current.innerHTML = initialRichHtml;
      loadedDocIdRef.current = activeDoc.id;
      setFloatingMenu((prev) => ({ ...prev, visible: false, showNoteForm: false }));
    }
  }, [isOpen, activeDoc, initialRichHtml]);

  // Reset loadedDocIdRef when overlay closes so reopening refreshes properly
  useEffect(() => {
    if (!isOpen) {
      loadedDocIdRef.current = '';
      setFloatingMenu((prev) => ({ ...prev, visible: false, showNoteForm: false }));
    }
  }, [isOpen]);

  // Lock body scroll and hide underlying UI overflow while open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (floatingMenu.visible) {
          setFloatingMenu((prev) => ({ ...prev, visible: false, showNoteForm: false }));
          return;
        }
        if (isQuickNoteModalOpen) {
          setIsQuickNoteModalOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, floatingMenu.visible, isQuickNoteModalOpen, onClose]);

  const triggerSaveFeedback = (msg: string) => {
    setSaveFeedback(msg);
    setTimeout(() => {
      setSaveFeedback((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  // Persist current DOM HTML + comments back to parent
  const persistCurrentDocumentState = useCallback(
    (overrideComments?: DocumentComment[], overridePagesRead?: number) => {
      if (!activeDoc || !readerCanvasRef.current) return;
      const htmlContent = readerCanvasRef.current.innerHTML;
      const plainText = convertRichHtmlToPlainText(htmlContent);
      onSaveDocumentReadingChanges(activeDoc, {
        markdownContent: plainText,
        richHtmlContent: htmlContent,
        comments: overrideComments ?? currentComments,
        pagesRead: overridePagesRead,
      });
    },
    [activeDoc, currentComments, onSaveDocumentReadingChanges]
  );

  // Restore saved Range selection if needed before running execCommand
  const restoreSelectionRange = () => {
    const sel = window.getSelection();
    if (!sel || !savedSelectionRangeRef.current) return false;
    try {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRangeRef.current);
      return true;
    } catch {
      return false;
    }
  };

  // Apply highlight to current selection
  const handleHighlightSelection = useCallback(
    (colorKey: HighlightColorKey, keepMenuOpen: boolean = false) => {
      const palette =
        READING_HIGHLIGHT_PALETTE.find((p) => p.key === colorKey) ||
        READING_HIGHLIGHT_PALETTE[0];
      if (!readerCanvasRef.current) return;

      const sel = window.getSelection();
      const hasLiveSelection =
        sel &&
        !sel.isCollapsed &&
        sel.toString().trim().length > 0 &&
        readerCanvasRef.current.contains(sel.anchorNode);

      if (!hasLiveSelection) {
        restoreSelectionRange();
      }

      const activeSel = window.getSelection();
      if (
        activeSel &&
        !activeSel.isCollapsed &&
        activeSel.toString().trim().length > 0 &&
        readerCanvasRef.current.contains(activeSel.anchorNode)
      ) {
        readerCanvasRef.current.focus();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('hiliteColor', false, palette.hex);
        persistCurrentDocumentState();
        triggerSaveFeedback(`Texto resaltado (${palette.shortLabel})`);
        if (!keepMenuOpen) {
          activeSel.removeAllRanges();
          savedSelectionRangeRef.current = null;
          setFloatingMenu((prev) => ({ ...prev, visible: false, showNoteForm: false }));
        }
      }
    },
    [persistCurrentDocumentState]
  );

  // Remove highlight from current selection
  const handleRemoveHighlight = () => {
    if (!readerCanvasRef.current) return;
    const sel = window.getSelection();
    const hasLiveSelection =
      sel &&
      !sel.isCollapsed &&
      sel.toString().trim().length > 0 &&
      readerCanvasRef.current.contains(sel.anchorNode);

    if (!hasLiveSelection) {
      restoreSelectionRange();
    }

    const activeSel = window.getSelection();
    if (
      activeSel &&
      !activeSel.isCollapsed &&
      readerCanvasRef.current.contains(activeSel.anchorNode)
    ) {
      readerCanvasRef.current.focus();
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('removeFormat', false, undefined);
      persistCurrentDocumentState();
      triggerSaveFeedback('Resaltado eliminado');
      activeSel.removeAllRanges();
      savedSelectionRangeRef.current = null;
      setFloatingMenu((prev) => ({ ...prev, visible: false, showNoteForm: false }));
    }
  };

  // Detect text selection inside the document canvas and position the floating menu
  const handleCanvasSelectionChange = () => {
    if (!readerCanvasRef.current) return;
    const sel = window.getSelection();
    if (
      !sel ||
      sel.isCollapsed ||
      !sel.toString().trim() ||
      !readerCanvasRef.current.contains(sel.anchorNode)
    ) {
      if (!floatingMenu.showNoteForm) {
        setFloatingMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
      return;
    }

    const selectedText = sel.toString().trim();
    if (selectedText.length < 2) return;

    const range = sel.getRangeAt(0);
    savedSelectionRangeRef.current = range.cloneRange();

    // If continuous highlighter mode is active, apply immediately
    if (activeContinuousColor) {
      handleHighlightSelection(activeContinuousColor, false);
      return;
    }

    const rect = range.getBoundingClientRect();
    const menuWidth = 340;
    const viewportW = window.innerWidth;
    const centerX = rect.left + rect.width / 2;
    const clampedLeft = Math.max(
      menuWidth / 2 + 16,
      Math.min(viewportW - menuWidth / 2 - 16, centerX)
    );

    const showBelow = rect.top < 140;
    const topPos = showBelow ? rect.bottom + 12 : rect.top - 12;

    setFloatingMenu({
      visible: true,
      top: topPos,
      left: clampedLeft,
      placement: showBelow ? 'below' : 'above',
      selectedText: selectedText.slice(0, 280),
      showNoteForm: false,
    });
  };

  // Open the inline quick note composer inside the floating menu
  const handleOpenQuickNoteFromSelection = (defaultColor?: HighlightColorKey) => {
    const chosenColor = defaultColor || quickNoteColor || 'yellow';
    setQuickNoteColor(chosenColor);
    setQuickNoteQuote(floatingMenu.selectedText);
    setQuickNoteText('');
    // Also highlight the selected text in that color so it remains visually marked in the PDF/apunte
    handleHighlightSelection(chosenColor, true);
    setFloatingMenu((prev) => ({
      ...prev,
      visible: true,
      showNoteForm: true,
    }));
  };

  // Save a quick note (either from floating selection menu or standalone floating button)
  const handleSaveQuickNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedText = quickNoteText.trim();
    if (!trimmedText) return;

    const newComment: DocumentComment = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      quote: quickNoteQuote.trim() || undefined,
      text: trimmedText,
      color: quickNoteColor,
      createdAt: new Date().toISOString(),
      resolved: false,
    };

    const nextComments = [newComment, ...currentComments];
    persistCurrentDocumentState(nextComments);

    setQuickNoteText('');
    setQuickNoteQuote('');
    setFloatingMenu({
      visible: false,
      top: 0,
      left: 0,
      placement: 'above',
      selectedText: '',
      showNoteForm: false,
    });
    setIsQuickNoteModalOpen(false);
    setShowNotesSidebar(true);
    triggerSaveFeedback('Nota rápida añadida');
  };

  const handleDeleteComment = (commentId: string) => {
    const nextComments = currentComments.filter((c) => c.id !== commentId);
    persistCurrentDocumentState(nextComments);
    triggerSaveFeedback('Nota eliminada');
  };

  const handleSaveEditedComment = (commentId: string) => {
    if (!editingNoteText.trim()) return;
    const nextComments = currentComments.map((c) =>
      c.id === commentId ? { ...c, text: editingNoteText.trim() } : c
    );
    persistCurrentDocumentState(nextComments);
    setEditingNoteId(null);
    setEditingNoteText('');
    triggerSaveFeedback('Nota actualizada');
  };

  const handleUpdatePagesRead = (nextPagesRead: number) => {
    if (!activeDoc) return;
    const clamped = Math.min(activeDoc.pageCount, Math.max(0, nextPagesRead));
    persistCurrentDocumentState(undefined, clamped);
    triggerSaveFeedback(`Progreso: ${clamped}/${activeDoc.pageCount} págs. leídas`);
  };

  if (!isOpen || !activeDoc) return null;

  // Theme styles
  const themeConfig = {
    light: {
      shellBg: 'bg-slate-100 text-slate-900',
      headerBg: 'bg-white/95 border-slate-200 text-slate-900',
      paperBg: 'bg-white border-slate-200/90 text-slate-900 shadow-sm',
      sidebarBg: 'bg-white border-slate-200 text-slate-900',
      mutedText: 'text-slate-500',
      subtleSurface: 'bg-slate-100/80 border-slate-200',
    },
    sepia: {
      shellBg: 'bg-[#f4eedb] text-[#3d2e1e]',
      headerBg: 'bg-[#fcf8ed]/95 border-[#ded3b6] text-[#3d2e1e]',
      paperBg: 'bg-[#fffdf7] border-[#e2d7bc] text-[#3d2e1e] shadow-sm',
      sidebarBg: 'bg-[#fcf8ed] border-[#ded3b6] text-[#3d2e1e]',
      mutedText: 'text-[#796245]',
      subtleSurface: 'bg-[#ede4cb]/70 border-[#ded3b6]',
    },
    dark: {
      shellBg: 'bg-slate-950 text-slate-100',
      headerBg: 'bg-slate-900/95 border-slate-800 text-slate-100',
      paperBg: 'bg-slate-900 border-slate-800 text-slate-100 shadow-lg',
      sidebarBg: 'bg-slate-900 border-slate-800 text-slate-100',
      mutedText: 'text-slate-400',
      subtleSurface: 'bg-slate-800/80 border-slate-700',
    },
    midnight: {
      shellBg: 'bg-black text-neutral-200',
      headerBg: 'bg-neutral-950/95 border-neutral-800 text-neutral-100',
      paperBg: 'bg-neutral-950 border-neutral-800 text-neutral-100',
      sidebarBg: 'bg-neutral-950 border-neutral-800 text-neutral-200',
      mutedText: 'text-neutral-500',
      subtleSurface: 'bg-neutral-900 border-neutral-800',
    },
  }[theme];

  const fontSizeClass = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-relaxed',
    xl: 'text-xl leading-loose',
  }[fontSize];

  const filteredComments = currentComments.filter(
    (c) => noteFilterColor === 'all' || (c.color || 'yellow') === noteFilterColor
  );

  const currentDocIndex = documents.findIndex((d) => d.id === activeDoc.id);
  const prevDoc = currentDocIndex > 0 ? documents[currentDocIndex - 1] : null;
  const nextDoc =
    currentDocIndex >= 0 && currentDocIndex < documents.length - 1
      ? documents[currentDocIndex + 1]
      : null;

  const progressPct =
    activeDoc.pageCount > 0
      ? Math.min(100, Math.round((activeDoc.pagesRead / activeDoc.pageCount) * 100))
      : 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Modo Lectura: ${activeDoc.name}`}
      className={`fixed inset-0 z-[120] flex flex-col ${themeConfig.shellBg} transition-colors duration-150 select-text`}
    >
      {/* Barra superior minimalista de Modo Lectura */}
      <header
        className={`h-14 px-4 sm:px-6 border-b backdrop-blur-md flex items-center justify-between gap-4 shrink-0 ${themeConfig.headerBg}`}
      >
        {/* Izquierda: Selector de documento y contexto de materia */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: subject.color || '#2563eb' }}
          />
          <span className={`text-xs font-semibold hidden md:inline shrink-0 ${themeConfig.mutedText}`}>
            {subject.name}
          </span>
          <span className={`hidden md:inline ${themeConfig.mutedText}`}>/</span>

          {/* Navegación rápida entre documentos del panel lateral */}
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              disabled={!prevDoc}
              onClick={() => prevDoc && setActiveDocId(prevDoc.id)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 cursor-pointer shrink-0"
              title={prevDoc ? `Anterior: ${prevDoc.name}` : 'Primer documento'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={activeDoc.id}
              onChange={(e) => setActiveDocId(e.target.value)}
              className={`text-xs sm:text-sm font-bold rounded-lg px-2.5 py-1 border focus:outline-none focus:ring-2 focus:ring-blue-500 truncate max-w-[200px] sm:max-w-[320px] cursor-pointer ${themeConfig.subtleSurface}`}
              title="Cambiar de PDF o apunte sin salir del Modo Lectura"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  {d.name} ({d.pagesRead}/{d.pageCount} págs.)
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!nextDoc}
              onClick={() => nextDoc && setActiveDocId(nextDoc.id)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 cursor-pointer shrink-0"
              title={nextDoc ? `Siguiente: ${nextDoc.name}` : 'Último documento'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Centro: Control de páginas leídas en tiempo real */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1 rounded-xl border border-current/10 bg-black/5 dark:bg-white/5">
          <span className="text-xs font-medium opacity-75">Progreso lectura:</span>
          <button
            type="button"
            disabled={activeDoc.pagesRead <= 0}
            onClick={() => handleUpdatePagesRead(activeDoc.pagesRead - 1)}
            className="px-1.5 py-0.5 text-xs font-bold font-mono-numbers rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
            title="Restar 1 página leída"
          >
            -1
          </button>
          <span className="text-xs font-bold font-mono-numbers">
            {activeDoc.pagesRead} / {activeDoc.pageCount} págs. ({progressPct}%)
          </span>
          <button
            type="button"
            disabled={activeDoc.pagesRead >= activeDoc.pageCount}
            onClick={() => handleUpdatePagesRead(activeDoc.pagesRead + 1)}
            className="px-2 py-0.5 text-xs font-bold font-mono-numbers rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 cursor-pointer"
            title="Sumar 1 página leída"
          >
            +1 pág
          </button>
        </div>

        {/* Derecha: Tamaño de fuente, Temas de lectura, Panel de notas y Salir */}
        <div className="flex items-center gap-2 shrink-0">
          {saveFeedback && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-in fade-in duration-150">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saveFeedback}</span>
            </span>
          )}

          {/* Selector de tamaño tipográfico */}
          <div className="hidden sm:flex items-center gap-0.5 p-1 rounded-xl border border-current/10 bg-black/5 dark:bg-white/5">
            <button
              type="button"
              disabled={fontSize === 'sm'}
              onClick={() => {
                const order: FontSize[] = ['sm', 'base', 'lg', 'xl'];
                const idx = order.indexOf(fontSize);
                if (idx > 0) setFontSize(order[idx - 1]);
              }}
              className="px-2 py-0.5 text-xs font-bold rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
              title="Reducir tamaño de texto"
            >
              A-
            </button>
            <button
              type="button"
              disabled={fontSize === 'xl'}
              onClick={() => {
                const order: FontSize[] = ['sm', 'base', 'lg', 'xl'];
                const idx = order.indexOf(fontSize);
                if (idx < order.length - 1) setFontSize(order[idx + 1]);
              }}
              className="px-2 py-0.5 text-xs font-bold rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
              title="Aumentar tamaño de texto"
            >
              A+
            </button>
          </div>

          {/* Selector de tema visual */}
          <div className="flex items-center gap-1 p-1 rounded-xl border border-current/10 bg-black/5 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'light' ? 'bg-white text-slate-900 shadow-2xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Modo Claro"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('sepia')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'sepia' ? 'bg-[#ede5cc] text-[#3d2e1e] shadow-2xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Modo Papel Sepia"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'dark' ? 'bg-slate-800 text-white shadow-2xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Modo Noche"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Botón para mostrar/ocultar cajón de Notas Rápidas */}
          <button
            type="button"
            onClick={() => setShowNotesSidebar(!showNotesSidebar)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showNotesSidebar
                ? 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400'
                : 'border-current/15 bg-black/5 dark:bg-white/5 hover:bg-black/10'
            }`}
            title="Mostrar u ocultar panel de notas rápidas y fragmentos resaltados"
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Notas ({currentComments.length})</span>
          </button>

          {/* Botón Salir de Modo Lectura */}
          <button
            type="button"
            onClick={() => {
              persistCurrentDocumentState();
              onClose();
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Salir del Modo Lectura y volver a la interfaz principal (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Cuerpo principal en pantalla completa */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Lienzo central de lectura del PDF / Apunte */}
        <div
          ref={scrollContainerRef}
          onScroll={() => {
            if (floatingMenu.visible && !floatingMenu.showNoteForm) {
              setFloatingMenu((prev) => ({ ...prev, visible: false }));
            }
          }}
          className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-14 py-8 pb-32"
        >
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Encabezado editorial del documento */}
            <div className={`p-6 sm:p-8 rounded-2xl border ${themeConfig.paperBg} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-75">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold uppercase tracking-wider">{activeDoc.fileType.toUpperCase()}</span>
                  <span>·</span>
                  <span>Tema: {activeDoc.topicTitle}</span>
                  <span>·</span>
                  <span className="font-mono-numbers">{activeDoc.pageCount} páginas totales</span>
                </div>
                <span className="text-[11px]">
                  Selecciona cualquier texto para resaltar o añadir una nota rápida
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {activeDoc.name}
              </h1>

              {/* Resumen IA si existe */}
              {activeDoc.summary && (
                <div className={`p-4 rounded-xl border ${themeConfig.subtleSurface} space-y-1`}>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Síntesis del documento</span>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed opacity-90">
                    {activeDoc.summary}
                  </p>
                </div>
              )}

              {/* Superficie del documento con soporte de resaltado e inspección */}
              <div
                ref={readerCanvasRef}
                contentEditable
                suppressContentEditableWarning
                onMouseUp={handleCanvasSelectionChange}
                onKeyUp={handleCanvasSelectionChange}
                onBlur={() => persistCurrentDocumentState()}
                className={`pt-4 border-t border-current/10 outline-none prose prose-slate dark:prose-invert max-w-none font-serif ${fontSizeClass} leading-relaxed space-y-4 min-h-[55vh] cursor-text`}
              />
            </div>
          </div>
        </div>

        {/* MENÚ FLOTANTE CONTEXTUAL AL SELECCIONAR TEXTO */}
        {floatingMenu.visible && (
          <div
            style={{
              position: 'fixed',
              top: `${floatingMenu.top}px`,
              left: `${floatingMenu.left}px`,
              transform:
                floatingMenu.placement === 'above'
                  ? 'translate(-50%, -100%)'
                  : 'translate(-50%, 0)',
            }}
            onMouseDown={(e) => {
              // Evitar que al hacer clic en los botones de resaltado se pierda la selección del documento
              if (!floatingMenu.showNoteForm) {
                e.preventDefault();
              }
            }}
            className="z-[140] w-[340px] sm:w-[370px] rounded-2xl bg-slate-900/95 text-white border border-slate-700/90 shadow-2xl backdrop-blur-md p-2.5 animate-in fade-in zoom-in-95 duration-150"
          >
            {!floatingMenu.showNoteForm ? (
              <div className="flex items-center justify-between gap-1.5">
                {/* Colores de resaltado rápido */}
                <div className="flex items-center gap-1.5 px-1">
                  <Highlighter className="w-3.5 h-3.5 text-amber-300 shrink-0 mr-0.5" />
                  {READING_HIGHLIGHT_PALETTE.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleHighlightSelection(item.key, false)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${item.dotClass}`}
                      title={`Resaltar: ${item.label}`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={handleRemoveHighlight}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Quitar resaltado del texto seleccionado"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="h-5 w-px bg-slate-700 shrink-0" />

                {/* Acción para añadir nota rápida sobre el fragmento seleccionado */}
                <button
                  type="button"
                  onClick={() => handleOpenQuickNoteFromSelection('yellow')}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>+ Nota rápida</span>
                </button>
              </div>
            ) : (
              /* Formulario flotante de nota rápida vinculada al texto resaltado */
              <form onSubmit={handleSaveQuickNote} className="space-y-2.5 p-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>Nueva nota rápida en selección</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFloatingMenu((prev) => ({
                        ...prev,
                        visible: false,
                        showNoteForm: false,
                      }))
                    }
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {quickNoteQuote && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300 italic line-clamp-2">
                    «{quickNoteQuote}»
                  </div>
                )}

                <textarea
                  autoFocus
                  rows={3}
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder="Escribe tu anotación, duda o regla mnemotécnica..."
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {READING_HIGHLIGHT_PALETTE.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                          setQuickNoteColor(c.key);
                          handleHighlightSelection(c.key, true);
                        }}
                        className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${c.dotClass} ${
                          quickNoteColor === c.key ? 'scale-110 ring-2 ring-white' : 'opacity-70'
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFloatingMenu((prev) => ({
                          ...prev,
                          showNoteForm: false,
                        }))
                      }
                      className="px-2.5 py-1 text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      disabled={!quickNoteText.trim()}
                      className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Guardar nota
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* BARRA FLOTANTE INFERIOR (Dock de Marcadores y Nota Rápida Directa) */}
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[130] flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 text-white border border-slate-700/80 shadow-2xl backdrop-blur-md">
          <span className="text-[11px] font-semibold text-slate-300 hidden sm:inline pr-1">
            Subrayador activo:
          </span>

          {READING_HIGHLIGHT_PALETTE.map((item) => {
            const isContinuous = activeContinuousColor === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  const sel = window.getSelection();
                  if (
                    sel &&
                    !sel.isCollapsed &&
                    sel.toString().trim().length > 0 &&
                    readerCanvasRef.current?.contains(sel.anchorNode)
                  ) {
                    handleHighlightSelection(item.key, false);
                  } else {
                    setActiveContinuousColor((prev) => (prev === item.key ? null : item.key));
                  }
                }}
                className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${item.dotClass} ${
                  isContinuous ? 'scale-125 ring-2 ring-white' : 'opacity-85 hover:opacity-100'
                }`}
                title={`${item.label} (haz clic para activar modo subrayador continuo o resaltar selección)`}
              />
            );
          })}

          {activeContinuousColor && (
            <button
              type="button"
              onClick={() => setActiveContinuousColor(null)}
              className="px-2 py-0.5 rounded-lg bg-slate-800 text-[10px] font-semibold text-amber-300 hover:bg-slate-700 cursor-pointer"
              title="Desactivar subrayador automático"
            >
              Continuo ON
            </button>
          )}

          <div className="h-5 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => {
              const sel = window.getSelection();
              const quote =
                sel && !sel.isCollapsed && readerCanvasRef.current?.contains(sel.anchorNode)
                  ? sel.toString().trim().slice(0, 280)
                  : '';
              setQuickNoteQuote(quote);
              setQuickNoteText('');
              setIsQuickNoteModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Nota Rápida</span>
          </button>
        </div>

        {/* Modal flotante cuando el usuario pulsa "+ Añadir Nota Rápida" en el dock inferior */}
        {isQuickNoteModalOpen && (
          <div className="fixed inset-0 z-[145] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveQuickNote}
              className="w-full max-w-md rounded-2xl bg-slate-900 text-white border border-slate-700 p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold">Añadir Nota Rápida al Documento</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickNoteModalOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {quickNoteQuote && (
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300 italic">
                  «{quickNoteQuote}»
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contenido de la nota
                </label>
                <textarea
                  autoFocus
                  rows={4}
                  required
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder="Escribe una idea clave, recordatorio de examen o aclaración sobre esta sección..."
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Color de etiqueta:</span>
                <div className="flex items-center gap-1.5">
                  {READING_HIGHLIGHT_PALETTE.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setQuickNoteColor(c.key)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${c.dotClass} ${
                        quickNoteColor === c.key ? 'scale-110 ring-2 ring-white' : 'opacity-70'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickNoteModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Guardar Nota
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cajón lateral de Notas Rápidas y Fragmentos Resaltados */}
        {showNotesSidebar && (
          <aside
            className={`w-80 sm:w-96 border-l flex flex-col shrink-0 overflow-hidden ${themeConfig.sidebarBg}`}
          >
            <div className="p-4 border-b border-current/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                <div>
                  <h3 className="text-xs font-bold">Notas Rápidas y Resaltados</h3>
                  <p className={`text-[11px] ${themeConfig.mutedText}`}>
                    {currentComments.length} anotaciones en este documento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotesSidebar(false)}
                className="p-1 opacity-60 hover:opacity-100 cursor-pointer"
                title="Ocultar panel de notas"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filtro por color de marcador */}
            <div className="px-4 py-2.5 border-b border-current/10 flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={() => setNoteFilterColor('all')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  noteFilterColor === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                Todas ({currentComments.length})
              </button>
              <div className="flex items-center gap-1.5">
                {READING_HIGHLIGHT_PALETTE.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() =>
                      setNoteFilterColor((prev) => (prev === c.key ? 'all' : c.key))
                    }
                    className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${c.dotClass} ${
                      noteFilterColor === c.key ? 'scale-125 ring-2 ring-blue-500' : 'opacity-75'
                    }`}
                    title={`Filtrar: ${c.label}`}
                  />
                ))}
              </div>
            </div>

            {/* Lista de notas rápidas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredComments.length === 0 ? (
                <div className={`p-5 rounded-2xl border text-center space-y-2 ${themeConfig.subtleSurface}`}>
                  <StickyNote className="w-6 h-6 mx-auto opacity-50" />
                  <p className="text-xs font-semibold">Sin notas rápidas todavía</p>
                  <p className={`text-[11px] leading-relaxed ${themeConfig.mutedText}`}>
                    Selecciona cualquier frase del PDF/apunte para ver el menú flotante, resaltarla y añadir una nota rápida.
                  </p>
                </div>
              ) : (
                filteredComments.map((note) => {
                  const palette =
                    READING_HIGHLIGHT_PALETTE.find((p) => p.key === (note.color || 'yellow')) ||
                    READING_HIGHLIGHT_PALETTE[0];
                  const isEditing = editingNoteId === note.id;

                  return (
                    <div
                      key={note.id}
                      className={`p-3 rounded-xl border space-y-2 transition-all ${palette.cardClass}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${palette.textClass}`}>
                          {palette.shortLabel}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditingNoteText(note.text);
                            }}
                            className="p-1 opacity-60 hover:opacity-100 cursor-pointer"
                            title="Editar nota"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(note.id)}
                            className="p-1 opacity-60 hover:text-rose-600 hover:opacity-100 cursor-pointer"
                            title="Eliminar nota"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {note.quote && (
                        <blockquote className="px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-[11px] italic opacity-85 line-clamp-3">
                          «{note.quote}»
                        </blockquote>
                      )}

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2 text-xs text-slate-900 dark:text-slate-100"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-1 text-[11px] opacity-75 hover:opacity-100 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditedComment(note.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[11px] font-bold cursor-pointer"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">
                          {note.text}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>
    </div>,
    document.body
  );
};
