import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Highlighter,
  MessageSquarePlus,
  MessageSquare,
  Image as ImageIcon,
  Trash2,
  Check,
  X,
  Eraser,
  Undo2,
  Redo2,
  FileCode,
  Eye,
  Plus,
  Maximize2,
  Sparkles,
  CheckCircle2,
  Loader2,
  Sigma,
  Code2,
  Code,
  Copy,
  BookOpen,
  Edit3,
  Sun,
  Moon,
  Coffee,
} from 'lucide-react';
import {
  DocumentComment,
  DocumentImageAsset,
} from '../types';
import {
  SUPPORTED_CODE_LANGUAGES,
  buildCodeBlockHtml,
  buildImageFigureHtml,
  buildMathHtml,
  convertMarkdownAndImagesToRichHtml,
  convertRichHtmlToPlainText,
  detectTextPageCount,
  readFileAsBase64,
  renderLatexToKatexHtml,
} from '../utils/documentParser';

export interface RichEditableDocumentWorkspaceProps {
  documentId: string;
  documentTitle: string;
  markdownContent: string;
  richHtmlContent?: string;
  extractedImages: DocumentImageAsset[];
  comments: DocumentComment[];
  pageCount?: number;
  placeholder?: string;
  externalFormatVersion?: number;
  onImproveFormatAI?: () => void;
  isFormattingAI?: boolean;
  isReadingMode?: boolean;
  onToggleReadingMode?: (nextReadingMode: boolean) => void;
  subjectName?: string;
  documentSwitcherSlot?: React.ReactNode;
  onChange: (payload: {
    markdownContent: string;
    richHtmlContent: string;
    extractedImages: DocumentImageAsset[];
    comments: DocumentComment[];
  }) => void;
}

type HighlightColorKey = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

const HIGHLIGHT_PALETTE: Array<{
  key: HighlightColorKey;
  label: string;
  hex: string;
  dotClass: string;
  badgeClass: string;
}> = [
  {
    key: 'yellow',
    label: 'Amarillo · Idea principal',
    hex: '#fef08a',
    dotClass: 'bg-yellow-300 border-yellow-500',
    badgeClass: 'bg-yellow-50 text-yellow-900 border-yellow-300',
  },
  {
    key: 'green',
    label: 'Verde · Definición / Dato',
    hex: '#bbf7d0',
    dotClass: 'bg-emerald-300 border-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  },
  {
    key: 'blue',
    label: 'Azul · Fórmula / Técnico',
    hex: '#bae6fd',
    dotClass: 'bg-sky-300 border-sky-500',
    badgeClass: 'bg-sky-50 text-sky-900 border-sky-300',
  },
  {
    key: 'pink',
    label: 'Rosa · Pregunta de examen',
    hex: '#fbcfe8',
    dotClass: 'bg-pink-300 border-pink-500',
    badgeClass: 'bg-pink-50 text-pink-900 border-pink-300',
  },
  {
    key: 'orange',
    label: 'Naranja · Repasar / Duda',
    hex: '#fed7aa',
    dotClass: 'bg-orange-300 border-orange-500',
    badgeClass: 'bg-orange-50 text-orange-900 border-orange-300',
  },
];

export const RichEditableDocumentWorkspace: React.FC<RichEditableDocumentWorkspaceProps> = ({
  documentId,
  documentTitle,
  markdownContent,
  richHtmlContent,
  extractedImages,
  comments,
  pageCount,
  placeholder,
  externalFormatVersion = 0,
  onImproveFormatAI,
  isFormattingAI = false,
  isReadingMode,
  onToggleReadingMode,
  subjectName,
  documentSwitcherSlot,
  onChange,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mathTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedCursorRangeRef = useRef<Range | null>(null);
  const editingMathElementRef = useRef<HTMLElement | null>(null);
  const editingCodeElementRef = useRef<HTMLElement | null>(null);
  const lastLoadedDocIdRef = useRef<string>('');
  const lastEmittedHtmlRef = useRef<string>('');
  const lastEmittedMarkdownRef = useRef<string>('');
  const lastFormatVersionRef = useRef<number>(externalFormatVersion);

  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');
  const [internalReadingMode, setInternalReadingMode] = useState<boolean>(false);
  const activeReadingMode =
    isReadingMode !== undefined ? isReadingMode : internalReadingMode;
  const [readingFontSize, setReadingFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('lg');
  const [readingLineHeight, setReadingLineHeight] = useState<'1.75' | '1.95' | '2.15'>('1.95');
  const [readingTheme, setReadingTheme] = useState<'light' | 'sepia' | 'dark'>('light');
  const [activeHighlighterColor, setActiveHighlighterColor] = useState<HighlightColorKey | null>(null);
  const [showCommentsSidebar, setShowCommentsSidebar] = useState<boolean>(true);
  const [showImagesDrawer, setShowImagesDrawer] = useState<boolean>(false);
  const [formatAppliedNotice, setFormatAppliedNotice] = useState<string | null>(null);

  // Estado para editor de fórmulas matemáticas (LaTeX / KaTeX)
  const [isMathModalOpen, setIsMathModalOpen] = useState<boolean>(false);
  const [mathLatexInput, setMathLatexInput] = useState<string>('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
  const [mathDisplayMode, setMathDisplayMode] = useState<'block' | 'inline'>('block');
  const [isEditingExistingMath, setIsEditingExistingMath] = useState<boolean>(false);
  const [mathPaletteTab, setMathPaletteTab] = useState<'basic' | 'calculus' | 'symbols'>('basic');

  // Estado para editor de bloques de código de programación
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [codeLanguage, setCodeLanguage] = useState<string>('python');
  const [codeTitle, setCodeTitle] = useState<string>('');
  const [codeContentInput, setCodeContentInput] = useState<string>('');
  const [isEditingExistingCode, setIsEditingExistingCode] = useState<boolean>(false);

  // Estado para nuevo comentario
  const [isAddingComment, setIsAddingComment] = useState<boolean>(false);
  const [pendingCommentQuote, setPendingCommentQuote] = useState<string>('');
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [newCommentColor, setNewCommentColor] = useState<HighlightColorKey>('yellow');

  // Estado para edición de comentario existente
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  const [activeHighlightedCommentId, setActiveHighlightedCommentId] = useState<string | null>(null);

  // Inicializar o cambiar de documento activo en el lienzo editable (incluyendo actualizaciones externas con IA)
  useEffect(() => {
    const initialHtml =
      richHtmlContent && richHtmlContent.trim()
        ? richHtmlContent
        : convertMarkdownAndImagesToRichHtml(markdownContent, extractedImages);

    const isForcedFormatRefresh = externalFormatVersion !== lastFormatVersionRef.current;
    if (isForcedFormatRefresh) {
      lastFormatVersionRef.current = externalFormatVersion;
      setFormatAppliedNotice(
        '✨ Formato académico mejorado con IA aplicado al documento (100% de tus apuntes conservados con encabezados, conceptos resaltados y estructura visual).'
      );
      setTimeout(() => setFormatAppliedNotice(null), 5500);
    }

    if (editorRef.current) {
      const isUserTyping =
        !isForcedFormatRefresh &&
        document.activeElement &&
        editorRef.current.contains(document.activeElement);
      const isDocChanged = lastLoadedDocIdRef.current !== documentId;
      const isCanvasEmpty =
        !editorRef.current.innerHTML ||
        editorRef.current.innerHTML === '<br>' ||
        editorRef.current.innerHTML === '<p><br></p>';
      const isExternalProgrammaticUpdate =
        isForcedFormatRefresh ||
        (Boolean(initialHtml) &&
          initialHtml !== lastEmittedHtmlRef.current &&
          markdownContent !== lastEmittedMarkdownRef.current);

      if (
        isForcedFormatRefresh ||
        isDocChanged ||
        isCanvasEmpty ||
        isExternalProgrammaticUpdate ||
        (!isUserTyping && initialHtml && editorRef.current.innerHTML !== initialHtml)
      ) {
        editorRef.current.innerHTML = initialHtml;
        lastLoadedDocIdRef.current = documentId;
        lastEmittedHtmlRef.current = initialHtml;
        lastEmittedMarkdownRef.current = markdownContent;
      }
    }
  }, [documentId, richHtmlContent, markdownContent, extractedImages, externalFormatVersion, activeReadingMode]);

  // Si externamente se restaura el texto o cambia cuando el editor está vacío
  const forceReloadHtmlIntoCanvas = (nextHtml: string) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = nextHtml;
      lastEmittedHtmlRef.current = nextHtml;
    }
  };

  // Emitir cambios sincronizados desde el lienzo visual
  const emitVisualChanges = (
    overrideImages?: DocumentImageAsset[],
    overrideComments?: DocumentComment[]
  ) => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    const plainText = convertRichHtmlToPlainText(currentHtml);
    lastEmittedHtmlRef.current = currentHtml;
    lastEmittedMarkdownRef.current = plainText;
    onChange({
      markdownContent: plainText,
      richHtmlContent: currentHtml,
      extractedImages: overrideImages ?? extractedImages,
      comments: overrideComments ?? comments,
    });
  };

  // Ejecutar comando de formato nativo sobre el documento editable
  const runFormatCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    emitVisualChanges();
  };

  // Guardar posición actual del cursor dentro del editor visual antes de abrir un modal
  const captureCurrentEditorSelection = () => {
    if (!editorRef.current) {
      savedCursorRangeRef.current = null;
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      savedCursorRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedCursorRangeRef.current = null;
    }
  };

  // Insertar bloque HTML en la posición actual (o restaurada) o al final
  const insertHtmlAtCursorOrEnd = (htmlSnippet: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (
      savedCursorRangeRef.current &&
      editorRef.current.contains(savedCursorRangeRef.current.startContainer) &&
      sel
    ) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedCursorRangeRef.current);
      } catch {
        // Ignorar si el rango previo ya no existe
      }
      savedCursorRangeRef.current = null;
    }

    if (
      sel &&
      sel.rangeCount > 0 &&
      editorRef.current.contains(sel.anchorNode)
    ) {
      document.execCommand('insertHTML', false, htmlSnippet);
    } else {
      editorRef.current.innerHTML += `\n${htmlSnippet}`;
    }
    emitVisualChanges();
  };

  // Reemplazar un nodo existente (fórmula o bloque de código) en el DOM visual
  const replaceDomNodeWithHtml = (targetEl: HTMLElement, newHtml: string) => {
    if (!editorRef.current || !editorRef.current.contains(targetEl)) {
      insertHtmlAtCursorOrEnd(newHtml);
      return;
    }
    const template = document.createElement('template');
    template.innerHTML = newHtml.trim();
    const nextNode = template.content.firstElementChild;
    if (nextNode) {
      targetEl.replaceWith(nextNode);
    }
    emitVisualChanges();
  };

  // Abrir compositor de fórmulas matemáticas
  const handleOpenMathModal = (existingEl?: HTMLElement | null) => {
    if (existingEl) {
      editingMathElementRef.current = existingEl;
      setMathLatexInput(existingEl.getAttribute('data-math-latex') || '');
      setMathDisplayMode(
        existingEl.getAttribute('data-math-display') === 'inline' ? 'inline' : 'block'
      );
      setIsEditingExistingMath(true);
    } else {
      captureCurrentEditorSelection();
      editingMathElementRef.current = null;
      const selectedText = savedCursorRangeRef.current?.toString().trim() || '';
      setMathLatexInput(selectedText || '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
      setMathDisplayMode('block');
      setIsEditingExistingMath(false);
    }
    setIsMathModalOpen(true);
    setTimeout(() => mathTextareaRef.current?.focus(), 40);
  };

  // Insertar snippet en el textarea de fórmula LaTeX
  const insertLatexSnippet = (snippet: string) => {
    const el = mathTextareaRef.current;
    if (!el) {
      setMathLatexInput((prev) => `${prev}${prev ? ' ' : ''}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? mathLatexInput.length;
    const end = el.selectionEnd ?? mathLatexInput.length;
    const next = mathLatexInput.slice(0, start) + snippet + mathLatexInput.slice(end);
    setMathLatexInput(next);
    setTimeout(() => {
      el.focus();
      const caret = start + snippet.length;
      el.setSelectionRange(caret, caret);
    }, 0);
  };

  // Confirmar inserción o edición de fórmula matemática
  const handleConfirmMathFormula = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = mathLatexInput.trim();
    if (!trimmed) return;

    if (editorMode === 'markdown') {
      const mdSnippet =
        mathDisplayMode === 'block' ? `\n$$\n${trimmed}\n$$\n` : `$${trimmed}$`;
      const nextMd = `${markdownContent}${markdownContent.endsWith('\n') || !markdownContent ? '' : '\n'}${mdSnippet}`;
      onChange({
        markdownContent: nextMd,
        richHtmlContent: convertMarkdownAndImagesToRichHtml(nextMd, extractedImages),
        extractedImages,
        comments,
      });
      setIsMathModalOpen(false);
      return;
    }

    const mathHtml = buildMathHtml(trimmed, mathDisplayMode === 'block');
    if (editingMathElementRef.current) {
      replaceDomNodeWithHtml(editingMathElementRef.current, mathHtml);
      editingMathElementRef.current = null;
    } else {
      const wrappedHtml =
        mathDisplayMode === 'block' ? `${mathHtml}<p><br/></p>` : `${mathHtml}&nbsp;`;
      insertHtmlAtCursorOrEnd(wrappedHtml);
    }
    setIsMathModalOpen(false);
    setIsEditingExistingMath(false);
  };

  const handleDeleteEditingMath = () => {
    if (editingMathElementRef.current && editorRef.current?.contains(editingMathElementRef.current)) {
      editingMathElementRef.current.remove();
      emitVisualChanges();
    }
    editingMathElementRef.current = null;
    setIsEditingExistingMath(false);
    setIsMathModalOpen(false);
  };

  // Abrir compositor de bloque de código de programación
  const handleOpenCodeModal = (existingEl?: HTMLElement | null) => {
    if (existingEl) {
      editingCodeElementRef.current = existingEl;
      const lang = existingEl.getAttribute('data-code-lang') || 'python';
      const title = existingEl.getAttribute('data-code-title') || '';
      const codeNode =
        existingEl.querySelector('[data-code-content="true"]') ||
        existingEl.querySelector('code');
      setCodeLanguage(lang);
      setCodeTitle(title);
      setCodeContentInput((codeNode?.textContent || '').replace(/\u00a0/g, ' '));
      setIsEditingExistingCode(true);
    } else {
      captureCurrentEditorSelection();
      editingCodeElementRef.current = null;
      const selectedText = savedCursorRangeRef.current?.toString().trim() || '';
      setCodeLanguage('python');
      setCodeTitle('');
      setCodeContentInput(
        selectedText ||
          'def ejemplo(n: int) -> int:\n  # Escribe tu código aquí\n  return n * 2'
      );
      setIsEditingExistingCode(false);
    }
    setIsCodeModalOpen(true);
    setTimeout(() => codeTextareaRef.current?.focus(), 40);
  };

  const handleConfirmCodeBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = codeContentInput.replace(/\r\n/g, '\n').replace(/\n+$/, '');
    if (!cleanedCode.trim()) return;

    if (editorMode === 'markdown') {
      const fence = `\n\`\`\`${codeLanguage}\n${cleanedCode}\n\`\`\`\n`;
      const nextMd = `${markdownContent}${markdownContent.endsWith('\n') || !markdownContent ? '' : '\n'}${fence}`;
      onChange({
        markdownContent: nextMd,
        richHtmlContent: convertMarkdownAndImagesToRichHtml(nextMd, extractedImages),
        extractedImages,
        comments,
      });
      setIsCodeModalOpen(false);
      return;
    }

    const codeHtml = buildCodeBlockHtml(cleanedCode, codeLanguage, codeTitle);
    if (editingCodeElementRef.current) {
      replaceDomNodeWithHtml(editingCodeElementRef.current, codeHtml);
      editingCodeElementRef.current = null;
    } else {
      insertHtmlAtCursorOrEnd(`${codeHtml}<p><br/></p>`);
    }
    setIsCodeModalOpen(false);
    setIsEditingExistingCode(false);
  };

  const handleDeleteEditingCode = () => {
    if (editingCodeElementRef.current && editorRef.current?.contains(editingCodeElementRef.current)) {
      editingCodeElementRef.current.remove();
      emitVisualChanges();
    }
    editingCodeElementRef.current = null;
    setIsEditingExistingCode(false);
    setIsCodeModalOpen(false);
  };

  // Código en línea (`código`) desde la barra de texto
  const handleInsertInlineCode = () => {
    if (editorMode === 'markdown') {
      const nextMd = `${markdownContent}${markdownContent ? ' ' : ''}\`código\``;
      onChange({
        markdownContent: nextMd,
        richHtmlContent: convertMarkdownAndImagesToRichHtml(nextMd, extractedImages),
        extractedImages,
        comments,
      });
      return;
    }
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    const selectedText =
      sel && !sel.isCollapsed && editorRef.current.contains(sel.anchorNode)
        ? sel.toString()
        : 'código';
    const escaped = selectedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    insertHtmlAtCursorOrEnd(
      `<code class="px-1.5 py-0.5 bg-slate-100 border border-slate-200/80 rounded text-[12px] font-mono text-indigo-700">${escaped}</code>&nbsp;`
    );
  };

  // Clic dentro del lienzo visual: editar fórmulas, editar bloques de código o copiar código
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const copyBtn = target.closest('[data-code-action="copy"]') as HTMLButtonElement | null;
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const block = copyBtn.closest('[data-code-block="true"]');
      const codeNode =
        block?.querySelector('[data-code-content="true"]') || block?.querySelector('code');
      const codeText = (codeNode?.textContent || '').replace(/\u00a0/g, ' ');
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(codeText).catch(() => {});
      }
      const prevLabel = copyBtn.textContent;
      copyBtn.textContent = '¡Copiado!';
      setTimeout(() => {
        copyBtn.textContent = prevLabel || 'Copiar';
      }, 1600);
      return;
    }

    const editCodeBtn = target.closest('[data-code-action="edit"]') as HTMLElement | null;
    if (editCodeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const block = editCodeBtn.closest('[data-code-block="true"]') as HTMLElement | null;
      if (block) {
        handleOpenCodeModal(block);
      }
      return;
    }

    const mathEl = target.closest('[data-math-latex]') as HTMLElement | null;
    if (mathEl) {
      e.preventDefault();
      e.stopPropagation();
      handleOpenMathModal(mathEl);
    }
  };

  // Soportar Tab y Enter dentro de bloques de código editables en línea
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    const anchorEl =
      sel?.anchorNode instanceof HTMLElement
        ? sel.anchorNode
        : sel?.anchorNode?.parentElement;
    const insideCodeContent = anchorEl?.closest('[data-code-content="true"]');
    if (!insideCodeContent) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
      emitVisualChanges();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
      emitVisualChanges();
    }
  };

  // Subrayar el texto seleccionado con un color fluorescente
  const applyHighlightColor = (colorKey: HighlightColorKey) => {
    const paletteItem =
      HIGHLIGHT_PALETTE.find((c) => c.key === colorKey) || HIGHLIGHT_PALETTE[0];
    if (!editorRef.current) return;

    const sel = window.getSelection();
    const hasSelectionInEditor =
      sel &&
      !sel.isCollapsed &&
      sel.toString().trim().length > 0 &&
      editorRef.current.contains(sel.anchorNode);

    if (hasSelectionInEditor) {
      editorRef.current.focus();
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('hiliteColor', false, paletteItem.hex);
      emitVisualChanges();
    } else {
      // Activar o desactivar modo subrayador continuo al seleccionar con el ratón
      setActiveHighlighterColor((prev) => (prev === colorKey ? null : colorKey));
    }
  };

  // Quitar subrayado del texto seleccionado
  const removeHighlightFromSelection = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (
      sel &&
      !sel.isCollapsed &&
      editorRef.current.contains(sel.anchorNode)
    ) {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('hiliteColor', false, 'transparent');
      // También limpiar etiquetas <mark> si las hubiera dentro de la selección
      emitVisualChanges();
    }
    setActiveHighlighterColor(null);
  };

  // Al soltar el ratón dentro del documento: si el "Modo Subrayador" está activo, subrayar automáticamente
  const handleEditorMouseUp = () => {
    if (!activeHighlighterColor || !editorRef.current) return;
    const sel = window.getSelection();
    if (
      sel &&
      !sel.isCollapsed &&
      sel.toString().trim().length > 0 &&
      editorRef.current.contains(sel.anchorNode)
    ) {
      const paletteItem =
        HIGHLIGHT_PALETTE.find((c) => c.key === activeHighlighterColor) ||
        HIGHLIGHT_PALETTE[0];
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('hiliteColor', false, paletteItem.hex);
      sel.removeAllRanges();
      emitVisualChanges();
    }
  };

  // Iniciar la creación de un comentario sobre el texto seleccionado
  const handleStartAddComment = () => {
    let selectedQuote = '';
    if (editorRef.current) {
      const sel = window.getSelection();
      if (
        sel &&
        !sel.isCollapsed &&
        editorRef.current.contains(sel.anchorNode)
      ) {
        selectedQuote = sel.toString().trim();
      }
    }
    setPendingCommentQuote(selectedQuote);
    setNewCommentText('');
    setIsAddingComment(true);
    setShowCommentsSidebar(true);
  };

  // Guardar nuevo comentario y vincularlo al documento
  const handleConfirmAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: DocumentComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      quote: pendingCommentQuote || undefined,
      text: newCommentText.trim(),
      color: newCommentColor,
      createdAt: new Date().toISOString(),
      resolved: false,
    };

    // Si había una frase citada en el documento, la resaltamos sutilmente con un marcador de comentario
    if (pendingCommentQuote && editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      const escapedQuote = pendingCommentQuote
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const colorHex =
        HIGHLIGHT_PALETTE.find((c) => c.key === newCommentColor)?.hex || '#fef08a';
      if (currentHtml.includes(escapedQuote)) {
        const replacedHtml = currentHtml.replace(
          escapedQuote,
          `<mark data-comment-id="${newComment.id}" style="background-color: ${colorHex}; padding: 1px 4px; border-radius: 4px; border-bottom: 2px solid #4f46e5;" title="Comentario: ${newComment.text.replace(/"/g, '&quot;')}">${escapedQuote} 💬</mark>`
        );
        editorRef.current.innerHTML = replacedHtml;
      }
    }

    const nextComments = [newComment, ...comments];
    setIsAddingComment(false);
    setPendingCommentQuote('');
    setNewCommentText('');
    emitVisualChanges(extractedImages, nextComments);
  };

  // Eliminar un comentario y limpiar su marcador en el documento
  const handleDeleteComment = (commentId: string) => {
    if (editorRef.current) {
      const markEl = editorRef.current.querySelector(
        `[data-comment-id="${commentId}"]`
      );
      if (markEl) {
        const cleanText = (markEl.textContent || '').replace(/\s*💬$/, '');
        markEl.replaceWith(document.createTextNode(cleanText));
      }
    }
    const nextComments = comments.filter((c) => c.id !== commentId);
    emitVisualChanges(extractedImages, nextComments);
  };

  // Marcar comentario como resuelto / pendiente
  const handleToggleResolveComment = (commentId: string) => {
    const nextComments = comments.map((c) =>
      c.id === commentId ? { ...c, resolved: !c.resolved } : c
    );
    emitVisualChanges(extractedImages, nextComments);
  };

  // Guardar edición de un comentario
  const handleSaveEditedComment = (commentId: string) => {
    if (!editingCommentText.trim()) return;
    const nextComments = comments.map((c) =>
      c.id === commentId ? { ...c, text: editingCommentText.trim() } : c
    );
    setEditingCommentId(null);
    setEditingCommentText('');
    emitVisualChanges(extractedImages, nextComments);
  };

  // Hacer scroll hacia la cita del comentario en el documento
  const handleFocusCommentInDocument = (comment: DocumentComment) => {
    setActiveHighlightedCommentId(comment.id);
    setTimeout(() => setActiveHighlightedCommentId(null), 2000);
    if (!editorRef.current) return;
    const markEl = editorRef.current.querySelector(
      `[data-comment-id="${comment.id}"]`
    ) as HTMLElement | null;
    if (markEl) {
      markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Subir e insertar una o varias imágenes nuevas al documento editable
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newlyAddedImages: DocumentImageAsset[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await readFileAsBase64(file);
      const imgAsset: DocumentImageAsset = {
        id: `user-img-${Date.now()}-${i + 1}`,
        name: file.name,
        dataUrl,
        caption: file.name.replace(/\.[^/.]+$/, ''),
        widthPercent: 75,
      };
      newlyAddedImages.push(imgAsset);
    }

    const updatedImages = [...extractedImages, ...newlyAddedImages];
    // Insertar cada nueva imagen en el documento editable
    newlyAddedImages.forEach((img) => {
      const figureHtml = buildImageFigureHtml(img);
      if (editorRef.current) {
        editorRef.current.innerHTML += `\n${figureHtml}\n<p><br/></p>`;
      }
    });

    emitVisualChanges(updatedImages, comments);
    e.target.value = '';
  };

  // Pegar imagen directamente desde el portapapeles (Ctrl+V)
  const handlePasteInEditor = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const dataUrl = await readFileAsBase64(blob);
        const newImg: DocumentImageAsset = {
          id: `paste-img-${Date.now()}`,
          name: `Imagen pegada ${extractedImages.length + 1}`,
          dataUrl,
          caption: `Imagen añadida al documento`,
          widthPercent: 75,
        };
        const nextImages = [...extractedImages, newImg];
        insertHtmlAtCursorOrEnd(buildImageFigureHtml(newImg));
        emitVisualChanges(nextImages, comments);
        return;
      }
    }
  };

  // Cambiar tamaño de una imagen en el documento (50%, 75%, 100%)
  const handleResizeImage = (imageId: string, widthPercent: number) => {
    const nextImages = extractedImages.map((img) =>
      img.id === imageId ? { ...img, widthPercent } : img
    );
    if (editorRef.current) {
      const imgNode = editorRef.current.querySelector(
        `img[data-image-id="${imageId}"]`
      ) as HTMLImageElement | null;
      if (imgNode) {
        imgNode.style.width = `${widthPercent}%`;
      }
    }
    emitVisualChanges(nextImages, comments);
  };

  // Actualizar el pie de foto de una imagen
  const handleUpdateImageCaption = (imageId: string, newCaption: string) => {
    const nextImages = extractedImages.map((img) =>
      img.id === imageId ? { ...img, caption: newCaption } : img
    );
    if (editorRef.current) {
      const figNode = editorRef.current.querySelector(
        `figure[data-doc-image-id="${imageId}"] figcaption`
      );
      if (figNode) {
        figNode.textContent = newCaption;
      }
    }
    emitVisualChanges(nextImages, comments);
  };

  // Eliminar una imagen del documento y de la galería
  const handleDeleteImage = (imageId: string) => {
    if (editorRef.current) {
      const figNode = editorRef.current.querySelector(
        `figure[data-doc-image-id="${imageId}"]`
      );
      if (figNode) {
        figNode.remove();
      }
      const standaloneImg = editorRef.current.querySelector(
        `img[data-image-id="${imageId}"]`
      );
      if (standaloneImg) {
        standaloneImg.remove();
      }
    }
    const nextImages = extractedImages.filter((img) => img.id !== imageId);
    emitVisualChanges(nextImages, comments);
  };

  // Reinsertar en el documento una imagen de la galería si fue borrada del lienzo
  const handleInsertGalleryImageIntoCanvas = (img: DocumentImageAsset) => {
    insertHtmlAtCursorOrEnd(buildImageFigureHtml(img));
  };

  const wordCount = markdownContent
    .split(/\s+/)
    .filter(Boolean).length;
  const estimatedPages = pageCount || detectTextPageCount(markdownContent);
  const estimatedReadMinutes = Math.max(1, Math.round(wordCount / 200));

  const handleSetReadingMode = (nextReadingMode: boolean) => {
    if (nextReadingMode && editorMode === 'visual' && editorRef.current) {
      emitVisualChanges();
    }
    if (onToggleReadingMode) {
      onToggleReadingMode(nextReadingMode);
    } else {
      setInternalReadingMode(nextReadingMode);
    }
  };

  const renderedReadingHtml =
    richHtmlContent && richHtmlContent.trim()
      ? richHtmlContent
      : convertMarkdownAndImagesToRichHtml(markdownContent, extractedImages);

  const hasReadableContent =
    Boolean(markdownContent.trim()) ||
    extractedImages.length > 0 ||
    Boolean(
      renderedReadingHtml &&
        convertRichHtmlToPlainText(renderedReadingHtml).trim().length > 0
    );

  const readingThemeConfig = {
    light: {
      canvasBg: 'bg-[#f8fafc]',
      barBg: 'bg-white/95 border-slate-200/80 text-slate-800',
      paperBg: 'bg-white border-slate-200/80 shadow-xs',
      textColor: 'text-slate-900',
      mutedText: 'text-slate-500',
      divider: 'border-slate-200/80',
      controlBg: 'bg-slate-100/90 border-slate-200',
      activeControl: 'bg-white text-slate-900 shadow-2xs',
      proseExtra: '',
    },
    sepia: {
      canvasBg: 'bg-[#f3ebd8]',
      barBg: 'bg-[#fbf6ea]/95 border-[#e3d7bd] text-[#3a2d1d]',
      paperBg: 'bg-[#fcf8ee] border-[#e5d9bf] shadow-xs',
      textColor: 'text-[#2b2116]',
      mutedText: 'text-[#74634c]',
      divider: 'border-[#e4d8be]',
      controlBg: 'bg-[#efe4cc] border-[#dfd1b2]',
      activeControl: 'bg-[#fcf8ee] text-[#2b2116] shadow-2xs',
      proseExtra: '',
    },
    dark: {
      canvasBg: 'bg-[#0b1120]',
      barBg: 'bg-[#0f172a]/95 border-slate-800 text-slate-100',
      paperBg: 'bg-[#111827] border-slate-800 shadow-xs',
      textColor: 'text-slate-100',
      mutedText: 'text-slate-400',
      divider: 'border-slate-800',
      controlBg: 'bg-slate-800/90 border-slate-700',
      activeControl: 'bg-slate-700 text-white shadow-2xs',
      proseExtra: 'reading-mode-prose-dark',
    },
  }[readingTheme];

  const readingFontSizeClass = {
    sm: 'text-[15px]',
    base: 'text-[17px]',
    lg: 'text-[18.5px]',
    xl: 'text-[20.5px]',
  }[readingFontSize];

  const HIGHLIGHT_SHORT_LABELS: Record<HighlightColorKey, string> = {
    yellow: 'Idea clave',
    green: 'Definición',
    blue: 'Fórmula',
    pink: 'Examen',
    orange: 'Duda',
  };

  if (activeReadingMode) {
    return (
      <div
        className={`flex-1 flex flex-col min-h-0 h-full overflow-hidden transition-colors duration-200 ${readingThemeConfig.canvasBg} ${readingThemeConfig.textColor}`}
      >
        {/* Barra superior mínima y silenciosa de Modo Lectura (sin controles de edición) */}
        <div
          className={`px-4 sm:px-6 py-2.5 border-b backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 shrink-0 ${readingThemeConfig.barBg}`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            {documentSwitcherSlot ? (
              documentSwitcherSlot
            ) : (
              <span className="text-xs font-bold truncate max-w-[260px]">
                {documentTitle}
              </span>
            )}
            <div
              className={`flex items-center gap-2 text-xs font-mono-numbers ${readingThemeConfig.mutedText}`}
            >
              <span>{wordCount} palabras</span>
              <span aria-hidden="true">·</span>
              <span>~{estimatedReadMinutes} min de lectura</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector de Tema de Lectura */}
            <div
              className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border ${readingThemeConfig.controlBg}`}
              role="group"
              aria-label="Tema visual de lectura"
            >
              <button
                type="button"
                onClick={() => setReadingTheme('light')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  readingTheme === 'light'
                    ? readingThemeConfig.activeControl
                    : `${readingThemeConfig.mutedText} hover:opacity-100`
                }`}
                title="Fondo claro"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setReadingTheme('sepia')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  readingTheme === 'sepia'
                    ? readingThemeConfig.activeControl
                    : `${readingThemeConfig.mutedText} hover:opacity-100`
                }`}
                title="Fondo sepia cálido"
              >
                <Coffee className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setReadingTheme('dark')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  readingTheme === 'dark'
                    ? readingThemeConfig.activeControl
                    : `${readingThemeConfig.mutedText} hover:opacity-100`
                }`}
                title="Fondo oscuro"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tamaño de Fuente */}
            <div
              className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border ${readingThemeConfig.controlBg}`}
            >
              <button
                type="button"
                onClick={() => {
                  const order: Array<'sm' | 'base' | 'lg' | 'xl'> = ['sm', 'base', 'lg', 'xl'];
                  const idx = order.indexOf(readingFontSize);
                  if (idx > 0) setReadingFontSize(order[idx - 1]);
                }}
                disabled={readingFontSize === 'sm'}
                className="px-2 py-1 text-xs font-semibold rounded-md disabled:opacity-35 cursor-pointer"
                title="Reducir tamaño de letra"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => {
                  const order: Array<'sm' | 'base' | 'lg' | 'xl'> = ['sm', 'base', 'lg', 'xl'];
                  const idx = order.indexOf(readingFontSize);
                  if (idx < order.length - 1) setReadingFontSize(order[idx + 1]);
                }}
                disabled={readingFontSize === 'xl'}
                className="px-2 py-1 text-xs font-semibold rounded-md disabled:opacity-35 cursor-pointer"
                title="Aumentar tamaño de letra"
              >
                A+
              </button>
            </div>

            {/* Espaciado entre líneas */}
            <div
              className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border text-[11px] font-mono-numbers ${readingThemeConfig.controlBg}`}
              title="Ajustar espaciado entre líneas"
            >
              {(
                [
                  { id: '1.75', label: '1.75×' },
                  { id: '1.95', label: '1.95×' },
                  { id: '2.15', label: '2.15×' },
                ] as const
              ).map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setReadingLineHeight(sp.id)}
                  className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    readingLineHeight === sp.id
                      ? readingThemeConfig.activeControl
                      : readingThemeConfig.mutedText
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>

            {/* Volver al editor */}
            <button
              type="button"
              onClick={() => handleSetReadingMode(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title="Salir del Modo Lectura y volver a editar tus apuntes (Esc)"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Volver a editar</span>
            </button>
          </div>
        </div>

        {/* Lienzo Centrado de Lectura Larga con Espaciado Amplio */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-12">
          <div
            className={`max-w-[74ch] w-full mx-auto rounded-2xl border px-6 sm:px-14 py-10 sm:py-14 transition-colors duration-200 ${readingThemeConfig.paperBg}`}
          >
            <div className="max-w-[64ch] mx-auto">
              {/* Cabecera editorial limpia */}
              <header className={`pb-6 mb-8 border-b space-y-2 ${readingThemeConfig.divider}`}>
                <div
                  className={`flex items-center gap-2 text-xs flex-wrap ${readingThemeConfig.mutedText}`}
                >
                  {subjectName && (
                    <>
                      <span className="font-semibold">{subjectName}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span>Apuntes Libres</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-numbers">
                    {estimatedPages} {estimatedPages === 1 ? 'página' : 'páginas'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight [text-wrap:balance]">
                  {documentTitle}
                </h1>
              </header>

              {hasReadableContent ? (
                <article
                  className={`reading-mode-prose select-text tracking-[0.005em] ${readingFontSizeClass} ${readingThemeConfig.proseExtra}`}
                  style={{ lineHeight: readingLineHeight }}
                  dangerouslySetInnerHTML={{ __html: renderedReadingHtml }}
                />
              ) : (
                <div className="py-12 text-center space-y-4">
                  <BookOpen
                    className={`w-10 h-10 mx-auto opacity-35 ${readingThemeConfig.mutedText}`}
                  />
                  <div className="space-y-1">
                    <p className="text-base font-bold">
                      Estos apuntes libres aún están vacíos
                    </p>
                    <p className={`text-sm max-w-md mx-auto ${readingThemeConfig.mutedText}`}>
                      Vuelve al editor para redactar tus notas o importar un documento y disfrutar de la lectura centrada.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSetReadingMode(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Redactar apuntes</span>
                  </button>
                </div>
              )}

              {/* Pie discreto al finalizar la lectura */}
              {hasReadableContent && (
                <footer
                  className={`mt-12 pt-6 border-t flex items-center justify-between gap-4 text-xs ${readingThemeConfig.divider} ${readingThemeConfig.mutedText}`}
                >
                  <span className="font-mono-numbers">
                    Fin de lectura · {wordCount} palabras
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSetReadingMode(false)}
                    className="inline-flex items-center gap-1.5 font-semibold hover:underline cursor-pointer text-blue-600 dark:text-blue-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar estos apuntes</span>
                  </button>
                </footer>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
      {/* Barra de Herramientas Principal del Estudio de Escritura */}
      <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
        {/* Grupo 1: Formato de Texto y Estructura */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center bg-white border border-slate-200/90 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => runFormatCommand('undo')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Deshacer (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runFormatCommand('redo')}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Rehacer (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="inline-flex items-center bg-white border border-slate-200/90 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => runFormatCommand('formatBlock', 'H1')}
              className="px-2 py-1 text-[11px] font-extrabold text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Título Principal (H1)"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => runFormatCommand('formatBlock', 'H2')}
              className="px-2 py-1 text-[11px] font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Subtítulo (H2)"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => runFormatCommand('formatBlock', 'H3')}
              className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Sección (H3)"
            >
              H3
            </button>
            <span className="w-px h-4 bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={() => runFormatCommand('bold')}
              className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Negrita (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runFormatCommand('italic')}
              className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Cursiva (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runFormatCommand('underline')}
              className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Subrayado (Ctrl+U)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runFormatCommand('strikeThrough')}
              className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Tachado"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <span className="w-px h-4 bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={() => runFormatCommand('insertUnorderedList')}
              className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Lista con viñetas"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => runFormatCommand('insertOrderedList')}
              className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Lista numerada"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                insertHtmlAtCursorOrEnd(
                  '<blockquote class="border border-blue-200 bg-blue-50/60 px-4 py-2.5 my-3 italic text-slate-800 rounded-xl">Concepto clave o nota destacada de examen...</blockquote><p><br/></p>'
                )
              }
              className="p-1.5 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Insertar bloque destacado / cita"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleInsertInlineCode}
              className="p-1.5 text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Código en línea (`código`)"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grupo 2: Fórmulas Matemáticas, Código, IA Formato, Comentarios e Imágenes */}
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenMathModal(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-violet-50 text-violet-700 border border-slate-200/90 hover:border-violet-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              title="Escribir o insertar una fórmula matemática (LaTeX / KaTeX)"
            >
              <Sigma className="w-3.5 h-3.5 text-violet-600" />
              <span>Fórmula</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCodeModal(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-900 hover:text-emerald-300 text-slate-800 border border-slate-200/90 hover:border-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              title="Insertar un bloque de código de programación (Python, JavaScript, Java, C++, SQL...)"
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Código</span>
            </button>

            {onImproveFormatAI && (
              <button
                type="button"
                disabled={isFormattingAI}
                onClick={onImproveFormatAI}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50 whitespace-nowrap"
                title="Estructurar y enriquecer visualmente este documento con IA (encabezados, conceptos en negrita, listas y bloques destacados conservando el 100% de tus apuntes)"
              >
                {isFormattingAI ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mejorando formato IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Mejorar formato IA</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleStartAddComment}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200/90 hover:border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              title="Selecciona un fragmento de texto y pulsa aquí para añadir un comentario o anotación al margen"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-indigo-600" />
              <span>+ Nota al margen</span>
            </button>

            <label
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200/90 hover:border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
              title="Añadir o incrustar una nueva imagen en el documento"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ Imagen</span>
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageFileUpload}
                className="hidden"
              />
            </label>

            {extractedImages.length > 0 && (
              <button
                type="button"
                onClick={() => setShowImagesDrawer(!showImagesDrawer)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  showImagesDrawer
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Ver y gestionar todas las imágenes extraídas del documento o añadidas"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Galería ({extractedImages.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Grupo 3: Modo Lectura, Panel de Comentarios y Modo Visual/Markdown */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSetReadingMode(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            title="Activar Modo Lectura centrado y sin distracciones (oculta la interfaz de edición y aumenta el interlineado)"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Modo Lectura</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCommentsSidebar(!showCommentsSidebar)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
              showCommentsSidebar
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Mostrar u ocultar el panel lateral de comentarios y anotaciones"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Margen ({comments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (editorMode === 'visual') {
                setEditorMode('markdown');
              } else {
                const nextRich = convertMarkdownAndImagesToRichHtml(
                  markdownContent,
                  extractedImages
                );
                setEditorMode('visual');
                setTimeout(() => forceReloadHtmlIntoCanvas(nextRich), 0);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            title="Alternar entre Editor Visual Rico y Texto Markdown"
          >
            {editorMode === 'visual' ? (
              <>
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden md:inline">Markdown</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Vista Documento</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barra Visual de Subrayadores Semánticos de Estudio */}
      <div className="px-4 py-2 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mr-1">
            <Highlighter className="w-3.5 h-3.5 text-amber-500" />
            <span>Marcadores de estudio:</span>
          </span>
          {HIGHLIGHT_PALETTE.map((c) => {
            const isSelected = activeHighlighterColor === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => applyHighlightColor(c.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? `${c.badgeClass} ring-2 ring-slate-900 font-bold shadow-2xs`
                    : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 border-slate-200/90'
                }`}
                title={`Subrayar selección o activar marcador continuo (${c.label})`}
              >
                <span className={`w-3 h-3 rounded-full border shrink-0 ${c.dotClass}`} />
                <span>{HIGHLIGHT_SHORT_LABELS[c.key]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={removeHighlightFromSelection}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            title="Quitar subrayado del texto seleccionado"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Borrar marca</span>
          </button>
        </div>

        {activeHighlighterColor ? (
          <div className="flex items-center gap-2 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
            <span className="font-semibold">
              Marcador continuo activo: selecciona texto con el ratón
            </span>
            <button
              type="button"
              onClick={() => setActiveHighlighterColor(null)}
              className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
            >
              Desactivar
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 hidden xl:inline">
            Selecciona texto o activa un marcador para resaltar al arrastrar
          </span>
        )}
      </div>

      {formatAppliedNotice && (
        <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{formatAppliedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormatAppliedNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cajón desplegable de Galería de Imágenes Extraídas / Añadidas */}
      {showImagesDrawer && extractedImages.length > 0 && (
        <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">
                Imágenes Extraídas del Documento y Añadidas ({extractedImages.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Puedes redimensionarlas, cambiar su pie de foto, reinsertarlas o eliminarlas
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowImagesDrawer(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
            {extractedImages.map((img) => (
              <div
                key={img.id}
                className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 shadow-2xs"
              >
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-50"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    type="text"
                    value={img.caption || img.name}
                    onChange={(e) => handleUpdateImageCaption(img.id, e.target.value)}
                    placeholder="Pie de foto..."
                    className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    {[50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleResizeImage(img.id, pct)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                          (img.widthPercent || 75) === pct
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={`Ajustar ancho de imagen al ${pct}%`}
                      >
                        {pct}%
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleInsertGalleryImageIntoCanvas(img)}
                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 cursor-pointer"
                      title="Insertar esta imagen en la posición actual del documento"
                    >
                      + Insertar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer ml-auto"
                      title="Eliminar imagen del documento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cuerpo Principal: Lienzo Estilo Hoja de Estudio + Panel Lateral de Comentarios */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
        {/* Lienzo Editable del Documento con Marco de Estudio */}
        <div
          className={`${
            showCommentsSidebar ? 'lg:col-span-8 xl:col-span-9 border-r border-slate-200' : 'lg:col-span-12'
          } flex flex-col bg-slate-100/60 p-3 sm:p-5`}
        >
          <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
            {/* Cabecera sutil de la hoja activa */}
            <div className="px-5 py-2.5 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-slate-800 truncate">
                  {documentTitle}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-slate-500">
                  {editorMode === 'visual' ? 'Hoja de escritura rica' : 'Modo Markdown'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono-numbers">
                <span>{wordCount} palabras</span>
                <span>·</span>
                <span className="font-semibold text-blue-700">
                  {estimatedPages} {estimatedPages === 1 ? 'página' : 'páginas'}
                </span>
                {extractedImages.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-emerald-700">
                      {extractedImages.length} {extractedImages.length === 1 ? 'fig.' : 'figs.'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {editorMode === 'visual' ? (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => emitVisualChanges()}
                onClick={handleEditorClick}
                onKeyDown={handleEditorKeyDown}
                onMouseUp={handleEditorMouseUp}
                onPaste={handlePasteInEditor}
                data-placeholder={
                  placeholder ||
                  `Escribe o edita aquí todo el contenido de "${documentTitle}". Puedes modificar o borrar cualquier texto, subrayar en colores, insertar fórmulas matemáticas, bloques de código o imágenes...`
                }
                className="flex-1 w-full p-6 sm:p-8 text-sm text-slate-800 leading-relaxed focus:outline-none overflow-y-auto max-h-[620px] prose prose-slate max-w-none selection:bg-blue-200/70"
              />
            ) : (
              <textarea
                value={markdownContent}
                onChange={(e) => {
                  const nextMd = e.target.value;
                  const nextHtml = convertMarkdownAndImagesToRichHtml(
                    nextMd,
                    extractedImages
                  );
                  onChange({
                    markdownContent: nextMd,
                    richHtmlContent: nextHtml,
                    extractedImages,
                    comments,
                  });
                }}
                rows={22}
                placeholder={placeholder}
                className="flex-1 w-full p-6 text-xs font-mono text-slate-800 bg-white focus:outline-none leading-relaxed resize-y"
              />
            )}

            {/* Barra inferior de estado de la hoja */}
            <div className="px-5 py-2 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono-numbers">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span>{markdownContent.length} caracteres</span>
                <span>·</span>
                <span>{wordCount} palabras</span>
                <span>·</span>
                <span className="font-semibold text-slate-700">
                  {estimatedPages} {estimatedPages === 1 ? 'página / diapositiva' : 'páginas / diapositivas'}
                </span>
                {comments.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-indigo-700">
                      {comments.length} {comments.length === 1 ? 'nota al margen' : 'notas al margen'}
                    </span>
                  </>
                )}
              </div>
              <span className="text-slate-400">
                Fórmulas ($...$ / $$...$$) · Código (```) · Pegar imágenes (Ctrl+V)
              </span>
            </div>
          </div>
        </div>

        {/* Panel Lateral de Comentarios y Anotaciones al Margen */}
        {showCommentsSidebar && (
          <div className="lg:col-span-4 xl:col-span-3 bg-slate-50/60 flex flex-col max-h-[730px]">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900">
                  Notas al Margen ({comments.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={handleStartAddComment}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Nueva nota</span>
              </button>
            </div>

            {/* Formulario para crear un nuevo comentario */}
            {isAddingComment && (
              <form
                onSubmit={handleConfirmAddComment}
                className="p-3.5 bg-indigo-50/70 border-b border-indigo-200 space-y-2.5 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-950">
                    Nuevo comentario en el documento
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingComment(false)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {pendingCommentQuote ? (
                  <div className="p-2 bg-white/90 border-l-2 border-indigo-500 rounded text-[11px] text-slate-600 italic line-clamp-2">
                    "{pendingCommentQuote}"
                  </div>
                ) : (
                  <input
                    type="text"
                    value={pendingCommentQuote}
                    onChange={(e) => setPendingCommentQuote(e.target.value)}
                    placeholder="Cita o fragmento al que se refiere (opcional)..."
                    className="w-full text-[11px] bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}

                <textarea
                  required
                  rows={3}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Escribe tu comentario, duda, aclaración del profesor o recordatorio de examen..."
                  className="w-full text-xs bg-white border border-indigo-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {HIGHLIGHT_PALETTE.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setNewCommentColor(c.key)}
                        className={`w-4 h-4 rounded-full border cursor-pointer ${
                          c.dotClass
                        } ${
                          newCommentColor === c.key
                            ? 'ring-2 ring-slate-900 scale-110'
                            : ''
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingComment(false)}
                      className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                    >
                      Guardar Comentario
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Lista de comentarios del documento */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {comments.length === 0 ? (
                <div className="text-center py-8 px-3 space-y-2">
                  <MessageSquarePlus className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">
                    Sin comentarios en este documento
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Selecciona cualquier frase en el texto y pulsa <strong>"+ Comentario"</strong> para añadir anotaciones, dudas o apuntes de clase al margen.
                  </p>
                </div>
              ) : (
                comments.map((cmt) => {
                  const colorMeta =
                    HIGHLIGHT_PALETTE.find((c) => c.key === (cmt.color || 'yellow')) ||
                    HIGHLIGHT_PALETTE[0];
                  const isEditingThis = editingCommentId === cmt.id;

                  return (
                    <div
                      key={cmt.id}
                      onClick={() => handleFocusCommentInDocument(cmt)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        cmt.resolved
                          ? 'bg-slate-100/70 border-slate-200 opacity-75'
                          : 'bg-white border-slate-200/90 hover:border-indigo-300 shadow-2xs'
                      } ${
                        activeHighlightedCommentId === cmt.id
                          ? 'ring-2 ring-indigo-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorMeta.badgeClass}`}
                        >
                          {cmt.resolved ? '✓ Resuelto' : 'Nota al margen'}
                        </span>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleResolveComment(cmt.id)}
                            className={`p-1 rounded hover:bg-slate-100 cursor-pointer ${
                              cmt.resolved ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-600'
                            }`}
                            title={
                              cmt.resolved
                                ? 'Marcar como pendiente'
                                : 'Marcar comentario como resuelto'
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(cmt.id);
                              setEditingCommentText(cmt.text);
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(cmt.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                            title="Eliminar comentario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {cmt.quote && (
                        <div className="p-2 bg-slate-50 border-l-2 border-indigo-400 rounded text-[11px] text-slate-600 italic line-clamp-2">
                          "{cmt.quote}"
                        </div>
                      )}

                      {isEditingThis ? (
                        <div
                          className="space-y-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <textarea
                            rows={2}
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-indigo-300 rounded-lg p-2 text-slate-800 focus:outline-none"
                          />
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingCommentId(null)}
                              className="px-2 py-0.5 text-[10px] text-slate-500 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditedComment(cmt.id)}
                              className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded cursor-pointer"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={`text-xs leading-relaxed ${
                            cmt.resolved
                              ? 'line-through text-slate-500'
                              : 'text-slate-800 font-medium'
                          }`}
                        >
                          {cmt.text}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Compositor de Fórmulas Matemáticas (LaTeX + Vista Previa KaTeX) */}
      {isMathModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsMathModalOpen(false)}
        >
          <form
            onSubmit={handleConfirmMathFormula}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sigma className="w-4 h-4 text-violet-100" />
                <h4 className="text-sm font-bold">
                  {isEditingExistingMath
                    ? 'Editar fórmula matemática'
                    : 'Insertar fórmula matemática (LaTeX)'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsMathModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Modo de visualización y selector de paleta */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setMathDisplayMode('block')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      mathDisplayMode === 'block'
                        ? 'bg-white text-violet-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bloque centrado ($$...$$)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMathDisplayMode('inline')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      mathDisplayMode === 'inline'
                        ? 'bg-white text-violet-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    En línea ($...$)
                  </button>
                </div>

                <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-[11px] font-semibold">
                  {(
                    [
                      { id: 'basic', label: 'Operaciones' },
                      { id: 'calculus', label: 'Cálculo y Matrices' },
                      { id: 'symbols', label: 'Símbolos' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMathPaletteTab(tab.id)}
                      className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                        mathPaletteTab === tab.id
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botones rápidos de inserción matemática */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5">
                {mathPaletteTab === 'basic' &&
                  [
                    { label: 'Fracción a/b', tex: '\\frac{a}{b}' },
                    { label: 'Potencia xⁿ', tex: 'x^{n}' },
                    { label: 'Subíndice xᵢ', tex: 'x_{i}' },
                    { label: 'Raíz √x', tex: '\\sqrt{x}' },
                    { label: 'Raíz ⁿ√x', tex: '\\sqrt[n]{x}' },
                    { label: 'Paréntesis ( )', tex: '\\left(  \\right)' },
                    { label: 'Valor abs. |x|', tex: '|x|' },
                    { label: 'Logaritmo', tex: '\\log_{b}(x)' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => insertLatexSnippet(item.tex)}
                      className="px-2.5 py-1 bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}

                {mathPaletteTab === 'calculus' &&
                  [
                    { label: 'Integral ∫', tex: '\\int_{a}^{b} f(x)\\,dx' },
                    { label: 'Sumatorio ∑', tex: '\\sum_{i=1}^{n} a_i' },
                    { label: 'Productorio ∏', tex: '\\prod_{i=1}^{n} x_i' },
                    { label: 'Límite lím', tex: '\\lim_{x \\to \\infty} f(x)' },
                    { label: 'Derivada df/dx', tex: '\\frac{df}{dx}' },
                    { label: 'Parcial ∂f/∂x', tex: '\\frac{\\partial f}{\\partial x}' },
                    { label: 'Vector', tex: '\\vec{v}' },
                    {
                      label: 'Matriz 2×2',
                      tex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
                    },
                    {
                      label: 'Sistema de ec.',
                      tex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}',
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => insertLatexSnippet(item.tex)}
                      className="px-2.5 py-1 bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}

                {mathPaletteTab === 'symbols' &&
                  [
                    { label: 'α', tex: '\\alpha' },
                    { label: 'β', tex: '\\beta' },
                    { label: 'γ', tex: '\\gamma' },
                    { label: 'θ', tex: '\\theta' },
                    { label: 'λ', tex: '\\lambda' },
                    { label: 'μ', tex: '\\mu' },
                    { label: 'π', tex: '\\pi' },
                    { label: 'σ', tex: '\\sigma' },
                    { label: 'Δ', tex: '\\Delta' },
                    { label: 'Ω', tex: '\\Omega' },
                    { label: '∞', tex: '\\infty' },
                    { label: '±', tex: '\\pm' },
                    { label: '·', tex: '\\cdot' },
                    { label: '×', tex: '\\times' },
                    { label: '≠', tex: '\\neq' },
                    { label: '≤', tex: '\\leq' },
                    { label: '≥', tex: '\\geq' },
                    { label: '≈', tex: '\\approx' },
                    { label: '→', tex: '\\to' },
                    { label: '⇒', tex: '\\Rightarrow' },
                    { label: '⇔', tex: '\\iff' },
                    { label: '∈', tex: '\\in' },
                    { label: '∀', tex: '\\forall' },
                    { label: '∃', tex: '\\exists' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => insertLatexSnippet(item.tex)}
                      className="px-2.5 py-1 bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-lg text-xs font-bold text-slate-800 cursor-pointer transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
              </div>

              {/* Entrada de LaTeX */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Expresión LaTeX
                </label>
                <textarea
                  ref={mathTextareaRef}
                  required
                  rows={3}
                  value={mathLatexInput}
                  onChange={(e) => setMathLatexInput(e.target.value)}
                  placeholder="Ej: E = mc^2  o  \int_0^1 x^2\,dx = \frac{1}{3}"
                  className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                />
              </div>

              {/* Vista previa en tiempo real con KaTeX */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Vista previa en vivo
                </span>
                <div
                  className="min-h-[72px] p-4 rounded-xl border border-violet-200 bg-violet-50/40 flex items-center justify-center overflow-x-auto text-slate-900"
                  dangerouslySetInnerHTML={{
                    __html: renderLatexToKatexHtml(
                      mathLatexInput.trim() || 'f(x)',
                      mathDisplayMode === 'block'
                    ),
                  }}
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <div>
                {isEditingExistingMath && (
                  <button
                    type="button"
                    onClick={handleDeleteEditingMath}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar fórmula</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMathModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {isEditingExistingMath ? 'Actualizar fórmula' : 'Insertar fórmula'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Compositor de Bloques de Código de Programación */}
      {isCodeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCodeModalOpen(false)}
        >
          <form
            onSubmit={handleConfirmCodeBlock}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold">
                  {isEditingExistingCode
                    ? 'Editar bloque de código'
                    : 'Insertar bloque de código de programación'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsCodeModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Lenguaje de programación
                  </label>
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {SUPPORTED_CODE_LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Archivo o título (opcional)
                  </label>
                  <input
                    type="text"
                    value={codeTitle}
                    onChange={(e) => setCodeTitle(e.target.value)}
                    placeholder="Ej: quicksort.py, consulta_clientes.sql..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Código fuente
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Pulsa Tab para sangría (2 espacios)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(codeContentInput).catch(() => {});
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>
                <textarea
                  ref={codeTextareaRef}
                  required
                  rows={11}
                  spellCheck={false}
                  value={codeContentInput}
                  onChange={(e) => setCodeContentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const start = el.selectionStart;
                      const end = el.selectionEnd;
                      const updated =
                        codeContentInput.slice(0, start) +
                        '  ' +
                        codeContentInput.slice(end);
                      setCodeContentInput(updated);
                      setTimeout(() => {
                        el.setSelectionRange(start + 2, start + 2);
                      }, 0);
                    }
                  }}
                  placeholder="// Escribe o pega aquí tu código..."
                  className="w-full p-3.5 rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-emerald-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <div>
                {isEditingExistingCode && (
                  <button
                    type="button"
                    onClick={handleDeleteEditingCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar bloque</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {isEditingExistingCode ? 'Actualizar código' : 'Insertar código'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
