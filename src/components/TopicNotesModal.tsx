import React, { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  Plus,
  Trash2,
  FileCode,
  Image as ImageIcon,
  Download,
  SlidersHorizontal,
  Paperclip,
  Calculator,
  Edit3,
  Copy,
  RotateCcw,
  CheckSquare,
  Square,
  FolderOpen,
} from 'lucide-react';
import {
  Topic,
  CornellNote,
  Subject,
  AttachedTopicFile,
  DocumentImageAsset,
  DocumentComment,
  EditableKeyPoint,
} from '../types';
import { pdfCornellExportService } from '../services/pdfCornellExportService';
import { schedulerService } from '../services/schedulerService';
import {
  processImportedDocumentFile,
  calculateOrganizedPagesFromFiles,
  detectTextPageCount,
  convertMarkdownAndImagesToRichHtml,
  convertRichHtmlToPlainText,
  getFileFormatLabel,
} from '../utils/documentParser';
import { CornellPdfExportModal } from './CornellPdfExportModal';
import { RichEditableDocumentWorkspace } from './RichEditableDocumentWorkspace';

interface TopicNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: Topic | null;
  subjectName: string;
  initialDocumentId?: string;
  initialOpenKeyPoints?: boolean;
  onOpenReadingMode?: () => void;
  onAiError?: (actionTitle: string, errorMessage: string) => void;
  onSaveTopicNotes: (
    topicId: string,
    data: {
      notes: string;
      cues: string[];
      summary: string;
      attachedFiles?: AttachedTopicFile[];
      pageCount?: number;
      richGeneralNotes?: string;
      generalImages?: DocumentImageAsset[];
      generalComments?: DocumentComment[];
      keyPoints?: EditableKeyPoint[];
    }
  ) => void;
}

export const TopicNotesModal: React.FC<TopicNotesModalProps> = ({
  isOpen,
  onClose,
  topic,
  subjectName,
  initialDocumentId,
  initialOpenKeyPoints = false,
  onOpenReadingMode,
  onAiError,
  onSaveTopicNotes,
}) => {
  if (!isOpen || !topic) return null;

  const [activeTab, setActiveTab] = useState<'editor' | 'import'>('editor');
  const [noteFormat, setNoteFormat] = useState<'free' | 'cornell'>('free'); // Página de escritura de apuntes libre por defecto
  const [notes, setNotes] = useState<string>(
    topic.notes || topic.generalNotes || topic.description || ''
  );
  const [richGeneralNotes, setRichGeneralNotes] = useState<string>(
    topic.richGeneralNotes ||
      convertMarkdownAndImagesToRichHtml(
        topic.notes || topic.generalNotes || topic.description || '',
        topic.generalImages || []
      )
  );
  const [generalImages, setGeneralImages] = useState<DocumentImageAsset[]>(
    topic.generalImages || []
  );
  const [generalComments, setGeneralComments] = useState<DocumentComment[]>(
    topic.generalComments || []
  );
  const [topicKeyPoints, setTopicKeyPoints] = useState<EditableKeyPoint[]>(
    topic.keyPoints || []
  );

  const [cues, setCues] = useState<string[]>(
    topic.cues && topic.cues.length > 0
      ? topic.cues
      : topic.subtopics && topic.subtopics.length > 0
      ? topic.subtopics.map((st) => `¿En qué consiste ${st}?`)
      : ['¿Cuál es la definición fundamental?', '¿Qué aplicaciones prácticas tiene?']
  );
  const [summary, setSummary] = useState<string>(topic.summary || '');
  const [newCue, setNewCue] = useState<string>('');

  // Attached Imported Documents State
  const [attachedFiles, setAttachedFiles] = useState<AttachedTopicFile[]>(() =>
    (topic.attachedFiles || []).map((f) => ({
      ...f,
      pageCount: f.pageCount && f.pageCount > 0 ? f.pageCount : detectTextPageCount(f.content || ''),
      includeInOrganization: f.includeInOrganization !== undefined ? f.includeInOrganization : true,
      content: f.content || '',
      richHtmlContent:
        f.richHtmlContent ||
        convertMarkdownAndImagesToRichHtml(f.content || '', f.extractedImages || []),
      extractedImages: f.extractedImages || [],
      comments: f.comments || [],
      keyPoints: f.keyPoints || [],
    }))
  );

  // Active document being edited inside the Free-Writing Notes Page ('main' = general topic notes, or file.id = specific imported document)
  const [activeEditingDocId, setActiveEditingDocId] = useState<'main' | string>(() => {
    if (initialDocumentId && (topic.attachedFiles || []).some((f) => f.id === initialDocumentId)) {
      return initialDocumentId;
    }
    if ((topic.attachedFiles || []).length > 0) {
      return topic.attachedFiles![topic.attachedFiles!.length - 1].id;
    }
    return 'main';
  });
  const [customPageCountOverride, setCustomPageCountOverride] = useState<number | undefined>(
    topic.pageCount
  );

  // Import State
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportedDoc, setLastImportedDoc] = useState<AttachedTopicFile | null>(null);

  // AI Structure & KeyPoints State
  const [isStructuring, setIsStructuring] = useState<boolean>(false);
  const [isGeneratingKeyPoints, setIsGeneratingKeyPoints] = useState<boolean>(false);
  const [showKeyPointsPanel, setShowKeyPointsPanel] = useState<boolean>(() => {
    if (initialOpenKeyPoints) return true;
    const hasDocKeyPoints = (topic.attachedFiles || []).some(
      (f) => f.keyPoints && f.keyPoints.length > 0
    );
    return hasDocKeyPoints || (topic.keyPoints?.length || 0) > 0;
  });
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [actionBannerNotice, setActionBannerNotice] = useState<string | null>(null);
  const [isPdfExportModalOpen, setIsPdfExportModalOpen] = useState<boolean>(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  const lastSyncedTopicIdRef = React.useRef<string>(topic?.id || '');

  // Sincronizar estado cuando se abre con un documento específico o cambia el tema
  React.useEffect(() => {
    if (!topic) return;
    const normalizedFiles = (topic.attachedFiles || []).map((f) => ({
      ...f,
      pageCount: f.pageCount && f.pageCount > 0 ? f.pageCount : detectTextPageCount(f.content || ''),
      includeInOrganization: f.includeInOrganization !== undefined ? f.includeInOrganization : true,
      content: f.content || '',
      richHtmlContent:
        f.richHtmlContent ||
        convertMarkdownAndImagesToRichHtml(f.content || '', f.extractedImages || []),
      extractedImages: f.extractedImages || [],
      comments: f.comments || [],
      keyPoints: f.keyPoints || [],
    }));

    const isDifferentTopic = lastSyncedTopicIdRef.current !== topic.id;
    lastSyncedTopicIdRef.current = topic.id;

    setAttachedFiles((prev) => {
      if (isDifferentTopic || prev.length === 0) return normalizedFiles;
      // Preserve local edits in `prev` when the same topic re-renders
      const map = new Map<string, AttachedTopicFile>();
      for (const f of normalizedFiles) map.set(f.id, f);
      for (const f of prev) {
        const fromProp = map.get(f.id);
        if (!fromProp) {
          map.set(f.id, f);
        } else {
          // Prefer local state `f` if it has been edited or has richer content
          const preferLocal =
            Boolean(f.lastEditedAt && f.lastEditedAt !== fromProp.lastEditedAt) ||
            (f.content?.length || 0) >= (fromProp.content?.length || 0);
          map.set(f.id, preferLocal ? f : fromProp);
        }
      }
      return Array.from(map.values());
    });

    if (initialDocumentId && normalizedFiles.some((f) => f.id === initialDocumentId)) {
      setActiveEditingDocId(initialDocumentId);
    } else if (normalizedFiles.length > 0 && activeEditingDocId === 'main') {
      setActiveEditingDocId(normalizedFiles[normalizedFiles.length - 1].id);
    }

    if (initialOpenKeyPoints) {
      setShowKeyPointsPanel(true);
    }
  }, [topic?.id, topic?.attachedFiles?.length, initialDocumentId, initialOpenKeyPoints]);

  // Total pages from attached files included in organization
  const organizedFilesPageCount = useMemo(
    () => calculateOrganizedPagesFromFiles(attachedFiles),
    [attachedFiles]
  );

  // Effective page count for topic organization
  const effectivePageCount = useMemo(() => {
    if (attachedFiles.length > 0 && organizedFilesPageCount > 0) {
      return Math.max(customPageCountOverride || 0, organizedFilesPageCount);
    }
    return customPageCountOverride || topic.pageCount || 0;
  }, [attachedFiles, organizedFilesPageCount, customPageCountOverride, topic.pageCount]);

  // Estimated study hours based on detected pages & topic difficulty
  const estimatedStudyHours = useMemo(() => {
    return schedulerService.calculateTopicTime(
      topic.difficulty,
      topic.subtopics ? topic.subtopics.length : 0,
      notes.length,
      effectivePageCount > 0 ? effectivePageCount : undefined
    );
  }, [topic.difficulty, topic.subtopics, notes.length, effectivePageCount]);

  const activeAttachedFile = useMemo(
    () => attachedFiles.find((f) => f.id === activeEditingDocId) || null,
    [attachedFiles, activeEditingDocId]
  );

  // Puntos clave editables activos (del documento seleccionado o los consolidados del tema)
  const activeEditableKeyPoints: EditableKeyPoint[] = useMemo(() => {
    if (activeAttachedFile && activeAttachedFile.keyPoints && activeAttachedFile.keyPoints.length > 0) {
      return activeAttachedFile.keyPoints;
    }
    return topicKeyPoints;
  }, [activeAttachedFile, topicKeyPoints]);

  const updateActiveKeyPoints = (nextPoints: EditableKeyPoint[]) => {
    setTopicKeyPoints(nextPoints);
    if (activeAttachedFile) {
      setAttachedFiles((prev) =>
        prev.map((f) =>
          f.id === activeAttachedFile.id ? { ...f, keyPoints: nextPoints } : f
        )
      );
    }
  };

  // Current text shown in the Free-Writing Notes editor
  const currentEditorText = activeAttachedFile ? activeAttachedFile.content : notes;

  // Resuelve el texto efectivo más completo disponible (documento activo, HTML rico, apuntes generales o temario)
  const getEffectiveSourceText = (): string => {
    const candidates: string[] = [];
    if (activeAttachedFile) {
      if (activeAttachedFile.content?.trim()) candidates.push(activeAttachedFile.content.trim());
      if (activeAttachedFile.rawExtractedText?.trim()) {
        candidates.push(activeAttachedFile.rawExtractedText.trim());
      }
      if (activeAttachedFile.richHtmlContent?.trim()) {
        const plainFromRich = convertRichHtmlToPlainText(activeAttachedFile.richHtmlContent).trim();
        if (plainFromRich) candidates.push(plainFromRich);
      }
    }
    if (notes?.trim()) candidates.push(notes.trim());
    if (richGeneralNotes?.trim()) {
      const plainGeneral = convertRichHtmlToPlainText(richGeneralNotes).trim();
      if (plainGeneral) candidates.push(plainGeneral);
    }
    for (const f of attachedFiles) {
      if (f.content?.trim()) candidates.push(f.content.trim());
      else if (f.rawExtractedText?.trim()) candidates.push(f.rawExtractedText.trim());
    }
    if (topic.notes?.trim()) candidates.push(topic.notes.trim());
    if (topic.generalNotes?.trim()) candidates.push(topic.generalNotes.trim());
    if (topic.description?.trim()) candidates.push(topic.description.trim());
    if (topic.subtopics && topic.subtopics.length > 0) {
      candidates.push(
        `Tema: ${topic.title}\nSubtemas:\n${topic.subtopics.map((s) => `- ${s}`).join('\n')}`
      );
    }
    const longest = candidates.sort((a, b) => b.length - a.length)[0];
    return (longest || topic.title || '').trim();
  };

  const handleGenerateKeyPointsFromDocumentWithAI = async () => {
    const sourceText = getEffectiveSourceText();
    if (!sourceText) {
      setImportError('No hay contenido en el documento para generar el resumen y puntos clave.');
      return;
    }

    setIsGeneratingKeyPoints(true);
    setImportError(null);
    setShowKeyPointsPanel(true);

    try {
      const response = await fetch('/api/gemini/summarize-document-keypoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: activeAttachedFile ? activeAttachedFile.name : topic.title,
          documentContent: sourceText,
          topicTitle: topic.title,
          subjectName,
          pageCount: activeAttachedFile ? activeAttachedFile.pageCount : effectivePageCount || 1,
        }),
      });
      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Error al generar el resumen y puntos clave con IA.');
      }

      const data = resData.data;
      const generatedPoints: EditableKeyPoint[] = (data.keyPoints || []).map(
        (kp: any, idx: number) => ({
          id: `kp-${Date.now()}-${idx + 1}`,
          title: kp.title || `Punto clave ${idx + 1}`,
          detail: kp.detail || '',
          category: kp.category || 'Concepto Clave',
          importance:
            kp.importance === 'alta' || kp.importance === 'baja' ? kp.importance : 'media',
          sourceDocName: activeAttachedFile ? activeAttachedFile.name : topic.title,
        })
      );

      const nextSummary = data.summary || summary;
      const nextCues =
        Array.isArray(data.cues) && data.cues.length > 0
          ? Array.from(new Set([...cues, ...data.cues]))
          : cues;
      const nextKeyPoints =
        generatedPoints.length > 0 ? generatedPoints : activeEditableKeyPoints;

      let nextAttachedFiles = attachedFiles;
      if (activeAttachedFile) {
        nextAttachedFiles = attachedFiles.map((f) =>
          f.id === activeAttachedFile.id
            ? {
                ...f,
                summary: nextSummary,
                keyPoints: nextKeyPoints,
                lastEditedAt: new Date().toISOString(),
              }
            : f
        );
        setAttachedFiles(nextAttachedFiles);
      }

      if (data.summary) {
        setSummary(data.summary);
      }
      if (generatedPoints.length > 0) {
        setTopicKeyPoints(generatedPoints);
      }
      if (nextCues !== cues) {
        setCues(nextCues);
      }

      // Auto-persistir los puntos clave y el resumen en la asignatura
      onSaveTopicNotes(topic.id, {
        notes,
        cues: nextCues,
        summary: nextSummary,
        attachedFiles: nextAttachedFiles,
        pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
        richGeneralNotes,
        generalImages,
        generalComments,
        keyPoints: nextKeyPoints,
      });

      showTransientNotice(
        `¡Resumen automático y ${generatedPoints.length} puntos clave editables generados y guardados con IA!`
      );
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Error al generar puntos clave con IA.';
      setImportError(errMsg);
      onAiError?.('Puntos clave IA', errMsg);
    } finally {
      setIsGeneratingKeyPoints(false);
    }
  };

  const handleInsertKeyPointsIntoDocumentCanvas = () => {
    if (activeEditableKeyPoints.length === 0 && !summary.trim()) return;
    const formattedBlock = [
      `## ✨ Resumen Automático y Puntos Clave (${activeAttachedFile ? activeAttachedFile.name : topic.title})`,
      summary.trim() ? `> ${summary.trim().replace(/\n+/g, '\n> ')}` : '',
      ...activeEditableKeyPoints.map(
        (kp) => `- **${kp.title}** [${(kp.importance || 'media').toUpperCase()}]: ${kp.detail}`
      ),
    ]
      .filter(Boolean)
      .join('\n\n');

    const baseText = currentEditorText.trim() || getEffectiveSourceText();
    const nextText = baseText ? `${baseText}\n\n${formattedBlock}` : formattedBlock;
    handleEditorTextChange(nextText);
    showTransientNotice(
      'Resumen y puntos clave insertados en el lienzo editable del documento.'
    );
  };

  const handleEditorTextChange = (newText: string) => {
    if (activeAttachedFile) {
      const nowIso = new Date().toISOString();
      const nextRich = convertMarkdownAndImagesToRichHtml(
        newText,
        activeAttachedFile.extractedImages || []
      );
      const updatedFiles = attachedFiles.map((f) =>
        f.id === activeAttachedFile.id
          ? { ...f, content: newText, richHtmlContent: nextRich, lastEditedAt: nowIso }
          : f
      );
      setAttachedFiles(updatedFiles);

      if (
        attachedFiles.length === 1 ||
        !notes.trim() ||
        notes.trim() === topic.description?.trim() ||
        notes === activeAttachedFile.content
      ) {
        setNotes(newText);
      }
    } else {
      setNotes(newText);
      setRichGeneralNotes(convertMarkdownAndImagesToRichHtml(newText, generalImages));
    }
  };

  const handleRichWorkspaceChange = (payload: {
    markdownContent: string;
    richHtmlContent: string;
    extractedImages: DocumentImageAsset[];
    comments: DocumentComment[];
  }) => {
    if (activeAttachedFile) {
      const nowIso = new Date().toISOString();
      const updatedFiles = attachedFiles.map((f) =>
        f.id === activeAttachedFile.id
          ? {
              ...f,
              content: payload.markdownContent,
              richHtmlContent: payload.richHtmlContent,
              extractedImages: payload.extractedImages,
              comments: payload.comments,
              lastEditedAt: nowIso,
            }
          : f
      );
      setAttachedFiles(updatedFiles);

      if (
        attachedFiles.length === 1 ||
        !notes.trim() ||
        notes.trim() === topic.description?.trim()
      ) {
        setNotes(payload.markdownContent);
      }
    } else {
      setNotes(payload.markdownContent);
      setRichGeneralNotes(payload.richHtmlContent);
      setGeneralImages(payload.extractedImages);
      setGeneralComments(payload.comments);
    }
  };

  const showTransientNotice = (msg: string) => {
    setActionBannerNotice(msg);
    setTimeout(() => setActionBannerNotice(null), 3200);
  };

  // Add a new cue
  const handleAddCue = () => {
    if (!newCue.trim()) return;
    setCues([...cues, newCue.trim()]);
    setNewCue('');
  };

  // Remove a cue
  const handleRemoveCue = (index: number) => {
    setCues(cues.filter((_, i) => i !== index));
  };

  // AI Structure & Enhance
  const handleStructureWithAI = async () => {
    const textToStructure = getEffectiveSourceText();
    if (!textToStructure) {
      setImportError('Por favor escribe o selecciona un documento con texto antes de estructurar con IA.');
      return;
    }

    setIsStructuring(true);
    setImportError(null);

    try {
      const response = await fetch('/api/gemini/structure-topic-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: topic.title,
          rawNotes: textToStructure,
          subjectName,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const structuredText = resData.data.notes || textToStructure;
        const nextCues =
          Array.isArray(resData.data.cues) && resData.data.cues.length > 0
            ? resData.data.cues
            : cues;
        const nextSummary = resData.data.summary || summary;

        const nowIso = new Date().toISOString();
        let nextMainNotes = notes;
        let nextRichGeneral = richGeneralNotes;
        let nextAttachedFiles = attachedFiles;

        if (activeAttachedFile) {
          const nextRichDoc = convertMarkdownAndImagesToRichHtml(
            structuredText,
            activeAttachedFile.extractedImages || []
          );
          nextAttachedFiles = attachedFiles.map((f) =>
            f.id === activeAttachedFile.id
              ? {
                  ...f,
                  content: structuredText,
                  richHtmlContent: nextRichDoc,
                  summary: nextSummary,
                  lastEditedAt: nowIso,
                }
              : f
          );
          setAttachedFiles(nextAttachedFiles);

          if (
            attachedFiles.length === 1 ||
            !notes.trim() ||
            notes.trim() === topic.description?.trim() ||
            notes === activeAttachedFile.content
          ) {
            nextMainNotes = structuredText;
            nextRichGeneral = convertMarkdownAndImagesToRichHtml(structuredText, generalImages);
            setNotes(nextMainNotes);
            setRichGeneralNotes(nextRichGeneral);
          }
        } else {
          nextMainNotes = structuredText;
          nextRichGeneral = convertMarkdownAndImagesToRichHtml(structuredText, generalImages);
          setNotes(nextMainNotes);
          setRichGeneralNotes(nextRichGeneral);
        }

        if (nextCues !== cues) {
          setCues(nextCues);
        }
        if (nextSummary !== summary) {
          setSummary(nextSummary);
        }

        // Auto-persistir el formato estructurado con IA en la asignatura
        onSaveTopicNotes(topic.id, {
          notes: nextMainNotes,
          cues: nextCues,
          summary: nextSummary,
          attachedFiles: nextAttachedFiles,
          pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
          richGeneralNotes: nextRichGeneral,
          generalImages,
          generalComments,
          keyPoints: activeEditableKeyPoints,
        });

        showTransientNotice('¡Formato mejorado, estructurado y guardado automáticamente con IA!');
      } else {
        throw new Error(resData.error || 'No se pudieron estructurar los apuntes.');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Error al conectar con Gemini.';
      setImportError(errMsg);
      onAiError?.('Mejorar formato IA', errMsg);
    } finally {
      setIsStructuring(false);
    }
  };

  // Handle File Upload (PDF, Image, Text) — supports single or multiple files
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    openDirectlyInFreeEditor = false
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    setIsProcessingFile(true);
    setImportError(null);
    setImportStatus(`Procesando ${filesArray.length} archivo(s)...`);

    try {
      const newlyAddedFiles: AttachedTopicFile[] = [];
      let combinedNewText = '';
      let mergedCues: string[] = [...cues];
      let latestSummary = summary;

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const result = await processImportedDocumentFile(
          file,
          topic.title,
          subjectName,
          (statusMsg) =>
            setImportStatus(
              filesArray.length > 1
                ? `[${i + 1}/${filesArray.length}] ${statusMsg}`
                : statusMsg
            )
        );

        newlyAddedFiles.push(result.attachedFile);
        if (result.attachedFile.content) {
          combinedNewText +=
            (combinedNewText ? '\n\n---\n\n' : '') + result.attachedFile.content;
        }
        if (result.cues && result.cues.length > 0) {
          mergedCues = Array.from(new Set([...mergedCues, ...result.cues]));
        }
        if (result.summary && !latestSummary) {
          latestSummary = result.summary;
        }
      }

      const nextAttachedFiles = [...attachedFiles, ...newlyAddedFiles];
      setAttachedFiles(nextAttachedFiles);

      // Recalculate organized pages and update customPageCountOverride
      const newOrganizedPages = calculateOrganizedPagesFromFiles(nextAttachedFiles);
      const nextEffectivePages =
        newOrganizedPages > 0
          ? newOrganizedPages
          : effectivePageCount > 0
          ? effectivePageCount
          : topic.pageCount;
      if (newOrganizedPages > 0) {
        setCustomPageCountOverride(newOrganizedPages);
      }

      // Update main free-writing notes and richGeneralNotes synchronously
      const isMainNotesEmptyOrDefault =
        !notes.trim() || notes.trim() === (topic.description || '').trim();
      let nextMainNotes = notes;
      if (combinedNewText) {
        if (isMainNotesEmptyOrDefault) {
          nextMainNotes = combinedNewText;
        } else {
          nextMainNotes = `${notes.trim()}\n\n## Documento Importado: ${newlyAddedFiles
            .map((f) => `${f.name} (${f.pageCount} págs.)`)
            .join(', ')}\n\n${combinedNewText}`;
        }
        setNotes(nextMainNotes);
      }

      const newExtractedImgs = newlyAddedFiles.flatMap((f) => f.extractedImages || []);
      const nextGeneralImages = [...generalImages, ...newExtractedImgs];
      if (newExtractedImgs.length > 0) {
        setGeneralImages(nextGeneralImages);
      }

      const nextRichGeneralNotes = convertMarkdownAndImagesToRichHtml(
        nextMainNotes,
        nextGeneralImages
      );
      setRichGeneralNotes(nextRichGeneralNotes);

      if (mergedCues.length > 0) setCues(mergedCues);
      if (latestSummary) setSummary(latestSummary);

      // Auto-persist uploaded PDFs immediately to parent state & storage so they are never lost
      onSaveTopicNotes(topic.id, {
        notes: nextMainNotes,
        cues: mergedCues,
        summary: latestSummary,
        attachedFiles: nextAttachedFiles,
        pageCount: nextEffectivePages,
        richGeneralNotes: nextRichGeneralNotes,
        generalImages: nextGeneralImages,
        generalComments,
        keyPoints: activeEditableKeyPoints,
      });

      const lastDoc = newlyAddedFiles[newlyAddedFiles.length - 1];
      setLastImportedDoc(lastDoc);

      const totalDetectedPages = newlyAddedFiles.reduce((s, f) => s + f.pageCount, 0);
      const totalExtractedImgs = newlyAddedFiles.reduce(
        (s, f) => s + (f.extractedImages?.length || 0),
        0
      );
      setImportStatus(
        `¡${newlyAddedFiles.length === 1 ? 'Documento importado y guardado' : `${newlyAddedFiles.length} documentos importados y guardados`}! Se han detectado ${totalDetectedPages} ${
          totalDetectedPages === 1 ? 'página/diapositiva' : 'páginas/diapositivas'
        }${totalExtractedImgs > 0 ? ` y ${totalExtractedImgs} imágenes` : ''} y se ha guardado todo el contenido en la asignatura.`
      );

      if (lastDoc) {
        setActiveEditingDocId(lastDoc.id);
        if (openDirectlyInFreeEditor) {
          setNoteFormat('free');
          setActiveTab('editor');
        }
        showTransientNotice(
          `Documento "${lastDoc.name}" (${lastDoc.pageCount} págs.${
            (lastDoc.extractedImages?.length || 0) > 0
              ? `, ${lastDoc.extractedImages!.length} imágenes`
              : ''
          }) guardado automáticamente y listo para editar.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || 'Error al importar y detectar el documento.');
    } finally {
      setIsProcessingFile(false);
      e.target.value = '';
    }
  };

  // Update pageCount of an individual attached file
  const handleUpdateFilePageCount = (fileId: string, newPageCount: number) => {
    const validPages = Math.max(1, Math.min(2000, newPageCount || 1));
    const updated = attachedFiles.map((f) =>
      f.id === fileId ? { ...f, pageCount: validPages } : f
    );
    setAttachedFiles(updated);
    const totalOrgPages = calculateOrganizedPagesFromFiles(updated);
    setCustomPageCountOverride(totalOrgPages > 0 ? totalOrgPages : undefined);
  };

  // Toggle whether a file's pages count toward study organization
  const handleToggleFileInOrganization = (fileId: string) => {
    const updated = attachedFiles.map((f) =>
      f.id === fileId
        ? { ...f, includeInOrganization: f.includeInOrganization === false ? true : false }
        : f
    );
    setAttachedFiles(updated);
    const totalOrgPages = calculateOrganizedPagesFromFiles(updated);
    setCustomPageCountOverride(totalOrgPages > 0 ? totalOrgPages : undefined);
  };

  // Delete an attached file
  const handleRemoveAttachedFile = (fileId: string) => {
    const updated = attachedFiles.filter((f) => f.id !== fileId);
    setAttachedFiles(updated);
    if (activeEditingDocId === fileId) {
      setActiveEditingDocId('main');
    }
    if (lastImportedDoc?.id === fileId) {
      setLastImportedDoc(null);
    }
    const totalOrgPages = calculateOrganizedPagesFromFiles(updated);
    setCustomPageCountOverride(totalOrgPages > 0 ? totalOrgPages : undefined);
  };

  // Sync or merge active attached file's edited content into the topic's General Free Notes
  const handleMergeDocIntoMainNotes = (file: AttachedTopicFile, mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setNotes(file.content);
      showTransientNotice(
        `El texto editado de "${file.name}" ha reemplazado los Apuntes Libres Generales del tema.`
      );
    } else {
      setNotes((prev) =>
        prev.trim()
          ? `${prev.trim()}\n\n## ${file.name} (${file.pageCount} págs.)\n\n${file.content}`
          : file.content
      );
      showTransientNotice(
        `El contenido de "${file.name}" se ha añadido al lienzo de Apuntes Libres Generales.`
      );
    }
  };

  // Restore original OCR/extracted text of an attached file
  const handleRestoreOriginalDocText = (file: AttachedTopicFile) => {
    if (!file.rawExtractedText) return;
    const restoredRich = convertMarkdownAndImagesToRichHtml(
      file.rawExtractedText,
      file.extractedImages || []
    );
    const updated = attachedFiles.map((f) =>
      f.id === file.id
        ? {
            ...f,
            content: file.rawExtractedText || f.content,
            richHtmlContent: restoredRich,
          }
        : f
    );
    setAttachedFiles(updated);
    showTransientNotice(`Contenido original de "${file.name}" restaurado.`);
  };

  // Save notes, attached files, and total page count for study organization
  const handleSave = () => {
    let finalMainNotes = notes;
    let finalRichGeneralNotes = richGeneralNotes;
    let finalAttachedFiles = attachedFiles;

    if (activeAttachedFile) {
      const isMainNotesEmptyOrDefault =
        !finalMainNotes.trim() ||
        finalMainNotes.trim() === (topic.description || '').trim() ||
        attachedFiles.length === 1;
      if (isMainNotesEmptyOrDefault) {
        finalMainNotes = activeAttachedFile.content;
        finalRichGeneralNotes =
          activeAttachedFile.richHtmlContent ||
          convertMarkdownAndImagesToRichHtml(
            activeAttachedFile.content,
            activeAttachedFile.extractedImages || []
          );
      }
    } else {
      if (!finalRichGeneralNotes && finalMainNotes) {
        finalRichGeneralNotes = convertMarkdownAndImagesToRichHtml(finalMainNotes, generalImages);
      }
      // If editing general notes ('main') and there is a single attached file, keep its content in sync
      if (finalAttachedFiles.length === 1 && finalMainNotes.trim()) {
        finalAttachedFiles = [
          {
            ...finalAttachedFiles[0],
            content: finalMainNotes,
            richHtmlContent: finalRichGeneralNotes,
            lastEditedAt: new Date().toISOString(),
          },
        ];
      }
    }

    const savePayload = {
      notes: finalMainNotes,
      cues,
      summary,
      attachedFiles: finalAttachedFiles,
      pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
      richGeneralNotes: finalRichGeneralNotes,
      generalImages,
      generalComments,
      keyPoints: activeEditableKeyPoints,
    };

    console.log('[TopicNotesModal] handleSave -> passing payload to onSaveTopicNotes:', {
      topicId: topic.id,
      attachedFilesCount: finalAttachedFiles.length,
      attachedFiles: finalAttachedFiles,
      savePayload,
    });

    onSaveTopicNotes(topic.id, savePayload);
    setSaveSuccessNotice(true);
    setTimeout(() => {
      setSaveSuccessNotice(false);
      onClose();
    }, 450);
  };

  const buildTempCornellNote = (): CornellNote => ({
    id: `topic-note-${topic.id}`,
    topicId: topic.id,
    title: topic.title,
    notes: currentEditorText,
    cues,
    summary,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceType: 'manual',
  });

  const buildMockSubject = (tempNote: CornellNote): Subject => ({
    id: 'sub',
    name: subjectName,
    color: '#3b82f6',
    topics: [{ ...topic, pageCount: effectivePageCount || topic.pageCount, attachedFiles }],
    tasks: [],
    exams: [],
    cornellNotes: [tempNote],
    flashcards: [],
    quizzes: [],
    feynmanSessions: [],
    mindmaps: [],
    errorLogs: [],
  });

  // Exportar notas del tema a PDF formateado
  const handleExportPDF = () => {
    const tempNote = buildTempCornellNote();
    const mockSubject = buildMockSubject(tempNote);
    pdfCornellExportService.exportSingleNote(mockSubject, tempNote, {
      ...topic,
      pageCount: effectivePageCount || topic.pageCount,
    });
    setPdfNotice('¡PDF Cornell descargado!');
    setTimeout(() => setPdfNotice(null), 2500);
  };

  const mainNotesWordCount = notes.split(/\s+/).filter(Boolean).length;
  const totalExtractedWords =
    mainNotesWordCount +
    attachedFiles.reduce(
      (acc, f) => acc + (f.content || '').split(/\s+/).filter(Boolean).length,
      0
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Cabecera Visual del Estudio de Apuntes y Documentos */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Indicador Visual de Volumen de Páginas */}
            <div
              className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 flex flex-col items-center justify-center shrink-0 text-blue-700"
              title="Páginas contabilizadas para la organización del estudio"
            >
              <span className="text-xs font-extrabold font-mono-numbers leading-none">
                {effectivePageCount || 0}p
              </span>
              <span className="text-[9px] font-bold text-blue-500 mt-0.5">
                ~{estimatedStudyHours}h
              </span>
            </div>

            <div className="min-w-0">
              {/* Metadatos limpios sin cápsulas */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                <span className="font-semibold text-blue-600">
                  Escritura de Apuntes Libre y Documentos
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-slate-700">{subjectName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-numbers">
                  {effectivePageCount} {effectivePageCount === 1 ? 'pág. organizada' : 'págs. organizadas'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-numbers">
                  {attachedFiles.length} {attachedFiles.length === 1 ? 'documento' : 'documentos'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-numbers">
                  {totalExtractedWords} palabras
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate mt-0.5">
                {topic.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenReadingMode && (
              <button
                type="button"
                onClick={() => {
                  onSaveTopicNotes(topic.id, {
                    notes,
                    cues,
                    summary,
                    attachedFiles,
                    pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
                  });
                  onClose();
                  onOpenReadingMode();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-200 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                title="Abrir este tema en Modo Lectura a pantalla completa con panel lateral Feynman"
              >
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                <span>Modo Lectura</span>
              </button>
            )}

            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1.5 px-3 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                title="Descargar directamente PDF estructurado con el Método Cornell"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>{pdfNotice || 'Exportar PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPdfExportModalOpen(true)}
                className="px-2.5 py-2 hover:bg-slate-50 text-slate-500 hover:text-blue-600 border-l border-slate-200 transition-colors cursor-pointer"
                title="Opciones de diseño PDF Cornell (Rayado, Cuadrícula, Casillas Active Recall)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              {saveSuccessNotice ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Navegación del Estudio y Herramientas IA */}
        <div className="px-6 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'editor'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Lienzo de Escritura Libre</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'import'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                Biblioteca de Documentos ({attachedFiles.length})
              </span>
            </button>
          </div>

          {activeTab === 'editor' && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Botón directo de importación a documento editable */}
              <label
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                title="Importa un PDF, Word (.docx/.doc), PowerPoint (.pptx/.ppt), imagen o TXT: extrae todo su texto e imágenes a un documento editable"
              >
                {isProcessingFile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Digitalizando documento...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ Subir PDF / Word / PPTX</span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.odt,.odp,.rtf,.html,.htm,.csv,image/png,image/jpeg,image/webp,text/plain,.md,.txt"
                  onChange={(e) => handleFileUpload(e, true)}
                  disabled={isProcessingFile}
                  className="hidden"
                />
              </label>

              {/* Selector de formato de trabajo */}
              <div className="flex items-center bg-white border border-slate-200 p-0.5 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setNoteFormat('free')}
                  className={`px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    noteFormat === 'free'
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Escribe o edita directamente documentos importados en la página de escritura de apuntes libre"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Apuntes Libres</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNoteFormat('cornell')}
                  className={`px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    noteFormat === 'cornell'
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Estructura Cornell con preguntas detonadoras (Active Recall) y resumen"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Método Cornell</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isGeneratingKeyPoints}
                onClick={() => {
                  if (!showKeyPointsPanel) {
                    setShowKeyPointsPanel(true);
                    if (activeEditableKeyPoints.length === 0) {
                      handleGenerateKeyPointsFromDocumentWithAI();
                    }
                  } else {
                    handleGenerateKeyPointsFromDocumentWithAI();
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${
                  showKeyPointsPanel
                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                    : 'bg-white hover:bg-indigo-50 text-indigo-700 border-slate-200 hover:border-indigo-200'
                }`}
                title="Generar o actualizar con IA el Resumen Automático y los Puntos Clave Editables del tema/documento"
              >
                {isGeneratingKeyPoints ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Puntos Clave IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      Puntos Clave IA ({activeEditableKeyPoints.length})
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleStructureWithAI}
                disabled={isStructuring}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                title="Aplica formato Markdown estructurado, añade preguntas detonadoras y resumen automático"
              >
                {isStructuring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                    <span>Estructurando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mejorar Formato IA</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {importError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
              <button
                onClick={() => setImportError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {actionBannerNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{actionBannerNotice}</span>
              </div>
              <button
                onClick={() => setActionBannerNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {isProcessingFile && activeTab === 'editor' && (
            <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-2xl flex items-center gap-3 text-xs text-blue-900">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
              <div>
                <div className="font-bold">{importStatus || 'Analizando documento importado...'}</div>
                <div className="text-[11px] text-blue-700">
                  Contando el número de páginas para la organización y detectando toda la información escrita para que puedas editarla aquí mismo.
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: ESTUDIO DE ESCRITURA LIBRE Y DOCUMENTOS EDITABLES */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              {/* Estantería Visual de Documentos y Control de Páginas del Tema */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      Cuaderno y Documentos del Tema
                    </span>
                    <span className="text-[11px] text-slate-500">
                      · Selecciona cualquier tarjeta para abrir y editar su contenido en el lienzo inferior
                    </span>
                  </div>

                  {/* Ajustador de páginas para organización */}
                  <div className="flex items-center gap-2 text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                    <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-slate-600 font-medium">Páginas organizadas:</span>
                    <input
                      type="number"
                      min="1"
                      max="2000"
                      value={effectivePageCount || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setCustomPageCountOverride(!isNaN(val) && val > 0 ? val : 0);
                      }}
                      placeholder="0"
                      className="w-14 bg-slate-50 border border-slate-300 rounded-lg px-1.5 py-0.5 text-center font-bold font-mono-numbers text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      title="Número total de páginas tenidas en cuenta para organizar sesiones y tiempo de estudio"
                    />
                    <span className="text-[11px] text-slate-500 font-mono-numbers">
                      págs. · ~{estimatedStudyHours}h estudio
                    </span>
                  </div>
                </div>

                {/* Carrusel / Grid de Tarjetas Visuales de Documentos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Tarjeta 1: Cuaderno de Apuntes Libres Generales */}
                  <button
                    type="button"
                    onClick={() => setActiveEditingDocId('main')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      activeEditingDocId === 'main'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/20'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        activeEditingDocId === 'main'
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">
                        Apuntes Libres del Tema
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 font-mono-numbers ${
                          activeEditingDocId === 'main' ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        {mainNotesWordCount} palabras · Lienzo general
                      </div>
                    </div>
                  </button>

                  {/* Tarjetas de cada archivo importado */}
                  {attachedFiles.map((file) => {
                    const isSelected = activeEditingDocId === file.id;
                    const fileWords = (file.content || '').split(/\s+/).filter(Boolean).length;
                    const formatLabel = getFileFormatLabel(file.fileType);
                    return (
                      <div
                        key={file.id}
                        className={`rounded-xl border transition-all flex items-stretch overflow-hidden ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveEditingDocId(file.id)}
                          className="p-3 flex-1 min-w-0 flex items-start gap-2.5 text-left cursor-pointer"
                          title={`Editar "${file.name}" en el lienzo inferior`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 text-[9px] font-extrabold uppercase ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            <span>{formatLabel.slice(0, 4)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate">{file.name}</div>
                            <div
                              className={`text-[11px] mt-0.5 font-mono-numbers flex items-center gap-1.5 flex-wrap ${
                                isSelected ? 'text-indigo-100' : 'text-slate-500'
                              }`}
                            >
                              <span>
                                {file.pageCount} {file.pageCount === 1 ? 'pág.' : 'págs.'}
                              </span>
                              <span>·</span>
                              <span>{fileWords} pal.</span>
                              {file.includeInOrganization !== false && (
                                <>
                                  <span>·</span>
                                  <span
                                    className={
                                      isSelected
                                        ? 'text-emerald-200 font-semibold'
                                        : 'text-emerald-600 font-semibold'
                                    }
                                  >
                                    ✓ Plan
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachedFile(file.id)}
                          className={`px-2.5 border-l flex items-center justify-center transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-indigo-500 text-indigo-200 hover:text-white hover:bg-indigo-700'
                              : 'border-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title="Quitar archivo adjunto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Tarjeta rápida para subir nuevo documento */}
                  <label className="p-3 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 bg-white/70 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-center gap-2.5 text-slate-600 hover:text-emerald-800">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold">Añadir Documento</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        PDF, Word, PPTX o Imagen
                      </div>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.odt,.odp,.rtf,.html,.htm,.csv,image/png,image/jpeg,image/webp,text/plain,.md,.txt"
                      onChange={(e) => handleFileUpload(e, true)}
                      disabled={isProcessingFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Barra de Inspector cuando hay un documento importado seleccionado */}
                {activeAttachedFile && (
                  <div className="p-3 bg-white border border-indigo-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">Documento activo:</span>
                        <input
                          type="text"
                          value={activeAttachedFile.name}
                          onChange={(e) => {
                            const updated = attachedFiles.map((f) =>
                              f.id === activeAttachedFile.id
                                ? { ...f, name: e.target.value }
                                : f
                            );
                            setAttachedFiles(updated);
                          }}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          title="Cambiar el nombre del archivo importado"
                        />
                      </div>

                      {/* Ajuste de páginas de este documento */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <span className="text-slate-600 font-medium">Páginas:</span>
                        <input
                          type="number"
                          min="1"
                          max="2000"
                          value={activeAttachedFile.pageCount}
                          onChange={(e) =>
                            handleUpdateFilePageCount(
                              activeAttachedFile.id,
                              parseInt(e.target.value, 10) || 1
                            )
                          }
                          className="w-12 text-center font-mono-numbers font-bold text-indigo-900 bg-white border border-slate-200 rounded px-1 py-0.5 focus:outline-none"
                        />
                      </div>

                      {/* Incluir en organización */}
                      <button
                        type="button"
                        onClick={() => handleToggleFileInOrganization(activeAttachedFile.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                          activeAttachedFile.includeInOrganization !== false
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                        title="Activa o desactiva si las páginas de este archivo se suman a la organización del tema"
                      >
                        {activeAttachedFile.includeInOrganization !== false ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Contar en organización</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleMergeDocIntoMainNotes(activeAttachedFile, 'replace')}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="Usar este documento editado como cuerpo principal de los Apuntes Libres del tema"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Usar como Apunte Principal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMergeDocIntoMainNotes(activeAttachedFile, 'append')}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-indigo-800 border border-slate-200 hover:border-indigo-200 font-semibold rounded-lg transition-colors cursor-pointer"
                        title="Añadir el texto de este documento al final de los Apuntes Libres Generales"
                      >
                        + Añadir al Apunte General
                      </button>
                      {activeAttachedFile.rawExtractedText &&
                        activeAttachedFile.rawExtractedText !== activeAttachedFile.content && (
                          <button
                            type="button"
                            onClick={() => handleRestoreOriginalDocText(activeAttachedFile)}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Restaurar el texto original detectado al importar el documento"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restaurar original</span>
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel Interactivo: Resumen Automático IA y Puntos Clave Editables */}
              {showKeyPointsPanel && (
                <div className="bg-indigo-50/40 border border-indigo-200/90 rounded-2xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-600 text-white">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900">
                            Resumen Automático IA y Puntos Clave Editables
                          </h4>
                          <span className="text-xs text-indigo-700 font-mono-numbers font-semibold">
                            · {activeEditableKeyPoints.length} puntos clave
                          </span>
                          {activeAttachedFile && (
                            <span className="text-xs text-slate-500">
                              · Origen: {activeAttachedFile.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Edita el resumen y cada punto clave extraído del documento, cambia su prioridad o insértalos en el lienzo.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleGenerateKeyPointsFromDocumentWithAI}
                        disabled={isGeneratingKeyPoints}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingKeyPoints ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Analizando con IA...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {activeEditableKeyPoints.length > 0
                                ? 'Regenerar Puntos Clave IA'
                                : 'Generar Puntos Clave IA'}
                            </span>
                          </>
                        )}
                      </button>

                      {(activeEditableKeyPoints.length > 0 || summary.trim()) && (
                        <button
                          type="button"
                          onClick={handleInsertKeyPointsIntoDocumentCanvas}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                          title="Insertar el resumen y todos los puntos clave editados dentro del documento editable inferior"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Volcar al Lienzo</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          updateActiveKeyPoints([
                            ...activeEditableKeyPoints,
                            {
                              id: `kp-manual-${Date.now()}`,
                              title: 'Nuevo punto clave',
                              detail: 'Escribe aquí la definición, fórmula o idea esencial...',
                              category: 'Punto Clave',
                              importance: 'alta',
                              sourceDocName: activeAttachedFile
                                ? activeAttachedFile.name
                                : topic.title,
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-600" />
                        <span>+ Punto Clave</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowKeyPointsPanel(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                        title="Ocultar panel de puntos clave"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Resumen Automático Editable */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-indigo-950">
                      Resumen Ejecutivo del Documento (Editable)
                    </label>
                    <textarea
                      rows={3}
                      value={
                        activeAttachedFile && activeAttachedFile.summary
                          ? activeAttachedFile.summary
                          : summary
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setSummary(val);
                        if (activeAttachedFile) {
                          setAttachedFiles((prev) =>
                            prev.map((f) =>
                              f.id === activeAttachedFile.id ? { ...f, summary: val } : f
                            )
                          );
                        }
                      }}
                      placeholder="Pulsa 'Generar Puntos Clave IA' para sintetizar automáticamente el documento o escribe aquí tu resumen..."
                      className="w-full text-xs p-3 bg-white border border-indigo-200/90 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y"
                    />
                  </div>

                  {/* Lista de Puntos Clave Editables */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-950">
                        Tarjetas de Puntos Clave ({activeEditableKeyPoints.length})
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Haz clic en cualquier título o explicación para modificarlo
                      </span>
                    </div>

                    {activeEditableKeyPoints.length === 0 ? (
                      <div className="p-5 bg-white/80 border border-dashed border-indigo-200 rounded-xl text-center space-y-1.5">
                        <p className="text-xs font-semibold text-slate-700">
                          Aún no se han generado puntos clave para este documento
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                          Pulsa <strong>"Generar Puntos Clave IA"</strong> arriba para extraer automáticamente las ideas esenciales en tarjetas editables.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                        {activeEditableKeyPoints.map((kp, idx) => (
                          <div
                            key={kp.id}
                            className="p-3 bg-white border border-slate-200/90 hover:border-indigo-300 rounded-xl space-y-2 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold font-mono-numbers flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={kp.title}
                                  onChange={(e) => {
                                    const next = activeEditableKeyPoints.map((item) =>
                                      item.id === kp.id
                                        ? { ...item, title: e.target.value }
                                        : item
                                    );
                                    updateActiveKeyPoints(next);
                                  }}
                                  placeholder="Título del punto clave..."
                                  className="w-full text-xs font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none px-1 py-0.5"
                                />
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <select
                                  value={kp.importance || 'media'}
                                  onChange={(e) => {
                                    const next = activeEditableKeyPoints.map((item) =>
                                      item.id === kp.id
                                        ? {
                                            ...item,
                                            importance: e.target.value as
                                              | 'alta'
                                              | 'media'
                                              | 'baja',
                                          }
                                        : item
                                    );
                                    updateActiveKeyPoints(next);
                                  }}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border focus:outline-none cursor-pointer ${
                                    kp.importance === 'alta'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : kp.importance === 'baja'
                                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  <option value="alta">Alta</option>
                                  <option value="media">Media</option>
                                  <option value="baja">Baja</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveKeyPoints(
                                      activeEditableKeyPoints.filter(
                                        (item) => item.id !== kp.id
                                      )
                                    )
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                                  title="Eliminar este punto clave"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <textarea
                              rows={2}
                              value={kp.detail}
                              onChange={(e) => {
                                const next = activeEditableKeyPoints.map((item) =>
                                  item.id === kp.id
                                    ? { ...item, detail: e.target.value }
                                    : item
                                );
                                updateActiveKeyPoints(next);
                              }}
                              placeholder="Detalle o explicación del punto clave..."
                              className="w-full text-xs text-slate-700 bg-slate-50/70 border border-slate-200/80 rounded-lg p-2 focus:outline-none focus:bg-white focus:border-indigo-400 leading-relaxed resize-y"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Workspace del Documento Editable Rico (Subrayar, Comentarios, Editar Texto, Imágenes) */}
              {noteFormat === 'free' && (
                <RichEditableDocumentWorkspace
                  documentId={activeAttachedFile ? activeAttachedFile.id : `main-${topic.id}`}
                  documentTitle={activeAttachedFile ? activeAttachedFile.name : topic.title}
                  markdownContent={currentEditorText}
                  richHtmlContent={
                    activeAttachedFile
                      ? activeAttachedFile.richHtmlContent
                      : richGeneralNotes
                  }
                  extractedImages={
                    activeAttachedFile
                      ? activeAttachedFile.extractedImages || []
                      : generalImages
                  }
                  comments={
                    activeAttachedFile
                      ? activeAttachedFile.comments || []
                      : generalComments
                  }
                  pageCount={
                    activeAttachedFile
                      ? activeAttachedFile.pageCount
                      : effectivePageCount
                  }
                  placeholder={
                    activeAttachedFile
                      ? `Aquí tienes todo el texto e imágenes extraídas de "${activeAttachedFile.name}". Puedes modificar o eliminar cualquier parte, subrayar en colores, añadir comentarios al margen o insertar imágenes...`
                      : 'Escribe tus apuntes o sube un documento externo (PDF, Word, PowerPoint, imagen o texto) para volcar toda su información e imágenes en este documento editable...'
                  }
                  onChange={handleRichWorkspaceChange}
                />
              )}
            </div>
          )}

          {activeTab === 'editor' && noteFormat === 'cornell' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Columna Izquierda (4 cols): Preguntas Detonadoras (Cues) */}
                <div className="lg:col-span-4 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                        <span>Preguntas Detonadoras (Cues)</span>
                      </span>
                      <span className="text-xs font-mono-numbers text-slate-500 font-bold">
                        {cues.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Preguntas clave del Método Cornell para autoevaluarte con Active Recall sin mirar los apuntes.
                    </p>

                    <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                      {cues.map((cue, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-start justify-between gap-2 text-xs hover:border-slate-300 transition-colors"
                        >
                          <span className="text-slate-800 font-medium leading-snug">
                            {cue}
                          </span>
                          <button
                            onClick={() => handleRemoveCue(idx)}
                            className="text-slate-300 hover:text-rose-500 p-0.5 shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {cues.length === 0 && (
                        <div className="text-center py-6 text-[11px] text-slate-400 italic">
                          Sin preguntas detonadoras aún. Añade una abajo o usa "Mejorar Formato IA".
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Añadir pregunta */}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCue}
                      onChange={(e) => setNewCue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCue()}
                      placeholder="Nueva pregunta detonadora..."
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAddCue}
                      className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer"
                      title="Añadir pregunta"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Columna Derecha (8 cols): Cuerpo de Apuntes */}
                <div className="lg:col-span-8 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cuerpo de Apuntes del Tema (Markdown / Texto)</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono-numbers">
                      {currentEditorText.length} caracteres ·{' '}
                      {currentEditorText.split(/\s+/).filter(Boolean).length} palabras
                    </span>
                  </div>

                  <textarea
                    value={currentEditorText}
                    onChange={(e) => handleEditorTextChange(e.target.value)}
                    rows={17}
                    placeholder="Escribe aquí los apuntes del tema. Puedes usar subtítulos con ##, listas con guiones (-), definiciones en negrita (**término**), y fórmulas..."
                    className="w-full text-xs font-mono p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-none"
                  />
                </div>
              </div>

              {/* Resumen Inferior */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Resumen Ejecutivo del Tema (Síntesis para Repaso Rápido)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    2 a 3 párrafos con lo fundamental para exámenes
                  </span>
                </div>

                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  placeholder="Escribe o genera aquí el resumen esencial de este tema..."
                  className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: BIBLIOTECA DE DOCUMENTOS, CONTEO DE PÁGINAS E IMPORTACIÓN OCR */}
          {activeTab === 'import' && (
            <div className="max-w-5xl mx-auto space-y-5 py-1">
              {/* 4 KPIs Visuales de Planificación y Volumen Documental */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl">
                  <div className="text-[11px] font-medium text-slate-500">
                    Documentos Importados
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 font-mono-numbers mt-1">
                    {attachedFiles.length}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Archivos convertidos a editable
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl">
                  <div className="text-[11px] font-medium text-emerald-800">
                    Páginas Contabilizadas
                  </div>
                  <div className="text-xl font-extrabold text-emerald-900 font-mono-numbers mt-1">
                    {effectivePageCount} págs.
                  </div>
                  <div className="text-[11px] text-emerald-700/80 mt-0.5">
                    Incluidas en el plan de estudio
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-2xl">
                  <div className="text-[11px] font-medium text-blue-800">
                    Tiempo Estimado de Estudio
                  </div>
                  <div className="text-xl font-extrabold text-blue-900 font-mono-numbers mt-1">
                    ~{estimatedStudyHours} h
                  </div>
                  <div className="text-[11px] text-blue-700/80 mt-0.5">
                    Dificultad {topic.difficulty}
                  </div>
                </div>

                <div className="p-4 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl">
                  <div className="text-[11px] font-medium text-indigo-800">
                    Volumen de Texto Editable
                  </div>
                  <div className="text-xl font-extrabold text-indigo-900 font-mono-numbers mt-1">
                    {totalExtractedWords} pal.
                  </div>
                  <div className="text-[11px] text-indigo-700/80 mt-0.5">
                    Apuntes + documentos extraídos
                  </div>
                </div>
              </div>

              {/* Zona Visual de Subida Multi-Formato */}
              <div className="p-6 sm:p-8 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl bg-slate-50/60 hover:bg-blue-50/20 transition-all text-center space-y-4 cursor-pointer relative">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.odt,.odp,.rtf,.html,.htm,.csv,image/png,image/jpeg,image/webp,text/plain,.md,.txt"
                  onChange={(e) => handleFileUpload(e, true)}
                  disabled={isProcessingFile}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-2xl mx-auto">
                  <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">PDF Académico</div>
                      <div className="text-[10px] text-slate-400">Texto + conteo págs.</div>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Word (.docx)</div>
                      <div className="text-[10px] text-slate-400">Texto + imágenes</div>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">PowerPoint</div>
                      <div className="text-[10px] text-slate-400">Diapositivas + figuras</div>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Imágenes / OCR</div>
                      <div className="text-[10px] text-slate-400">Fotos de cuaderno</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold text-blue-600">
                    Haz clic o arrastra tus archivos aquí para convertirlos en documentos 100% editables
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl mx-auto">
                    Extrae automáticamente todo el texto, diapositivas e imágenes para subrayar en colores, añadir notas al margen y contabilizar páginas en el plan de estudio.
                  </p>
                </div>
              </div>

              {/* Estado de procesamiento */}
              {isProcessingFile && (
                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center gap-3 text-xs text-blue-900">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                  <div>
                    <div className="font-bold">{importStatus || 'Procesando documento...'}</div>
                    <div className="text-[11px] text-blue-700 mt-0.5">
                      Contando páginas para la organización del estudio y transcribiendo toda la información escrita del documento.
                    </div>
                  </div>
                </div>
              )}

              {/* Lista Visual de Documentos Añadidos a este Tema */}
              {attachedFiles.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                      <span>Documentos Vinculados a este Tema ({attachedFiles.length})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setNoteFormat('free');
                        setActiveTab('editor');
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Volver al Lienzo de Escritura Libre →</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {attachedFiles.map((file) => {
                      const fileWords = (file.content || '').split(/\s+/).filter(Boolean).length;
                      return (
                        <div
                          key={file.id}
                          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 transition-all space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex flex-col items-center justify-center shrink-0 font-extrabold text-[10px]">
                                {getFileFormatLabel(file.fileType).slice(0, 4)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">
                                  {file.name}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 flex-wrap font-mono-numbers">
                                  <span className="font-semibold text-slate-700">
                                    {getFileFormatLabel(file.fileType)}
                                  </span>
                                  <span>·</span>
                                  <span className="font-semibold text-emerald-700">
                                    {file.pageCount} {file.pageCount === 1 ? 'página' : 'páginas'}
                                  </span>
                                  <span>·</span>
                                  <span>{fileWords} palabras</span>
                                  {(file.extractedImages?.length || 0) > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-teal-700 font-semibold">
                                        {file.extractedImages!.length} {file.extractedImages!.length === 1 ? 'imagen' : 'imágenes'}
                                      </span>
                                    </>
                                  )}
                                  {(file.comments?.length || 0) > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-indigo-700 font-semibold">
                                        {file.comments!.length} {file.comments!.length === 1 ? 'nota al margen' : 'notas al margen'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Ajustar páginas */}
                              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
                                <span className="text-slate-600 font-medium">Páginas:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="2000"
                                  value={file.pageCount}
                                  onChange={(e) =>
                                    handleUpdateFilePageCount(
                                      file.id,
                                      parseInt(e.target.value, 10) || 1
                                    )
                                  }
                                  className="w-12 text-center font-mono-numbers font-bold text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5"
                                />
                              </div>

                              {/* Incluir en organización */}
                              <button
                                type="button"
                                onClick={() => handleToggleFileInOrganization(file.id)}
                                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                                  file.includeInOrganization !== false
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}
                                title="Incluir el número de páginas de este archivo en la organización del estudio"
                              >
                                {file.includeInOrganization !== false ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-400" />
                                )}
                                <span>En plan</span>
                              </button>

                              {/* Abrir en lienzo de escritura libre */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveEditingDocId(file.id);
                                  setNoteFormat('free');
                                  setActiveTab('editor');
                                }}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Editar en Lienzo Libre</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRemoveAttachedFile(file.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Eliminar archivo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Extracto del texto detectado */}
                          <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-3 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-600">
                                Vista previa del texto extraído:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveEditingDocId(file.id);
                                  setNoteFormat('free');
                                  setActiveTab('editor');
                                }}
                                className="text-blue-600 hover:underline font-bold cursor-pointer"
                              >
                                Abrir documento completo para subrayar o editar →
                              </button>
                            </div>
                            <p className="text-xs text-slate-700 font-mono whitespace-pre-wrap line-clamp-3 leading-relaxed">
                              {file.content || 'Sin texto detectado.'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">
                    Todavía no has subido documentos externos en este tema
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Usa el recuadro superior para subir PDFs, documentos Word, presentaciones PowerPoint o fotos de apuntes y editarlos en el lienzo libre.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie de página persistente */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2 font-mono-numbers">
            <Paperclip className="w-3.5 h-3.5 text-blue-600" />
            <span>
              <strong className="text-slate-800">{attachedFiles.length}</strong>{' '}
              {attachedFiles.length === 1 ? 'documento adjunto' : 'documentos adjuntos'} ·{' '}
              <strong className="text-slate-800">{effectivePageCount}</strong> págs. organizadas ·{' '}
              <strong className="text-slate-800">{totalExtractedWords}</strong> palabras
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveSuccessNotice ? '¡Guardado!' : 'Guardar Apuntes y Archivos'}</span>
            </button>
          </div>
        </div>

        <CornellPdfExportModal
          isOpen={isPdfExportModalOpen}
          onClose={() => setIsPdfExportModalOpen(false)}
          subject={buildMockSubject(buildTempCornellNote())}
          activeNote={buildTempCornellNote()}
          activeTopic={{
            ...topic,
            pageCount: effectivePageCount || topic.pageCount,
            attachedFiles,
          }}
          defaultScope="single"
          onExportComplete={() => {
            setPdfNotice('¡PDF Cornell descargado!');
            setTimeout(() => setPdfNotice(null), 2500);
          }}
        />
      </div>
    </div>
  );
};
