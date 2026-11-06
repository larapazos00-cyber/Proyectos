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
} from 'lucide-react';
import {
  DocumentComment,
  DocumentImageAsset,
} from '../types';
import {
  buildImageFigureHtml,
  convertMarkdownAndImagesToRichHtml,
  convertRichHtmlToPlainText,
  detectTextPageCount,
  readFileAsBase64,
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
  onChange,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const lastLoadedDocIdRef = useRef<string>('');
  const lastEmittedHtmlRef = useRef<string>('');
  const lastEmittedMarkdownRef = useRef<string>('');

  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');
  const [activeHighlighterColor, setActiveHighlighterColor] = useState<HighlightColorKey | null>(null);
  const [showCommentsSidebar, setShowCommentsSidebar] = useState<boolean>(true);
  const [showImagesDrawer, setShowImagesDrawer] = useState<boolean>(false);

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

    if (editorRef.current) {
      const isUserTyping =
        document.activeElement && editorRef.current.contains(document.activeElement);
      const isDocChanged = lastLoadedDocIdRef.current !== documentId;
      const isCanvasEmpty =
        !editorRef.current.innerHTML ||
        editorRef.current.innerHTML === '<br>' ||
        editorRef.current.innerHTML === '<p><br></p>';
      const isExternalProgrammaticUpdate =
        Boolean(initialHtml) &&
        initialHtml !== lastEmittedHtmlRef.current &&
        markdownContent !== lastEmittedMarkdownRef.current;

      if (
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
  }, [documentId, richHtmlContent, markdownContent, extractedImages]);

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

  // Insertar bloque HTML en la posición actual o al final
  const insertHtmlAtCursorOrEnd = (htmlSnippet: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
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

  const HIGHLIGHT_SHORT_LABELS: Record<HighlightColorKey, string> = {
    yellow: 'Idea clave',
    green: 'Definición',
    blue: 'Fórmula',
    pink: 'Examen',
    orange: 'Duda',
  };

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
          </div>

          {/* Grupo 2: Comentarios e Imágenes */}
          <div className="inline-flex items-center gap-1.5">
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

        {/* Grupo 3: Conmutador Panel de Comentarios y Modo Visual/Markdown */}
        <div className="flex items-center gap-1.5">
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
                onMouseUp={handleEditorMouseUp}
                onPaste={handlePasteInEditor}
                data-placeholder={
                  placeholder ||
                  `Escribe o edita aquí todo el contenido de "${documentTitle}". Puedes modificar o borrar cualquier texto, subrayar en colores, añadir comentarios al margen o incrustar imágenes...`
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
                100% editable · Admite pegar capturas e imágenes (Ctrl+V)
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
    </div>
  );
};
