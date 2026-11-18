import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Mic,
  MicOff,
  GitBranch,
} from 'lucide-react';
import {
  Topic,
  CornellNote,
  Subject,
  AttachedTopicFile,
  DocumentImageAsset,
  DocumentComment,
  EditableKeyPoint,
  DifficultyLevel,
  Mindmap,
  StudyPreferences,
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
import { D3MindMapCanvas } from './D3MindMapCanvas';

function extractLocalTermsAndCuesFromText(
  rawText: string,
  fallbackTitle: string
): {
  keyTerms: Array<{ term: string; definition: string; semanticLevel?: string; parentConcept?: string }>;
  cues: string[];
} {
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const keyTerms: Array<{ term: string; definition: string; semanticLevel?: string; parentConcept?: string }> = [];
  const seenTerms = new Set<string>();
  const cues: string[] = [];
  const seenCues = new Set<string>();
  let currentMacro = fallbackTitle || 'Tema Principal';

  const pushTerm = (t: string, d: string, semanticLevel?: string, parentConcept?: string) => {
    const cleanT = t.replace(/^[-•*0-9.)#>\s]+/, '').replace(/\*+/g, '').replace(/:$/, '').trim();
    const cleanD = d.replace(/^[-•*:\s]+/, '').replace(/\*+/g, '').trim();
    if (cleanT.length < 2 || cleanT.length > 80 || cleanD.length < 8) return;
    const low = cleanT.toLowerCase();
    if (seenTerms.has(low)) return;
    seenTerms.add(low);
    const inferredLevel =
      semanticLevel ||
      (/causa|produce|provoca|proceso|etapa|fase|regula|mecanismo/i.test(cleanD)
        ? 'Nivel 2 · Mecanismo/Proceso'
        : 'Nivel 3 · Micro-concepto/Detalle');
    keyTerms.push({
      term: cleanT,
      definition: cleanD,
      semanticLevel: inferredLevel,
      parentConcept: parentConcept || currentMacro,
    });
  };

  const pushCue = (q: string) => {
    const cleanQ = q.trim();
    if (cleanQ.length < 10) return;
    const low = cleanQ.toLowerCase();
    if (seenCues.has(low)) return;
    seenCues.add(low);
    cues.push(cleanQ);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,4}\s+/.test(line)) {
      const heading = line.replace(/^#{1,4}\s+/, '').replace(/\*+/g, '').trim();
      const next = lines[i + 1] || '';
      if (heading.length > 2) {
        currentMacro = heading;
      }
      if (heading.length > 2 && next && !/^#{1,4}\s+/.test(next) && next.length > 15) {
        pushTerm(heading, next, 'Nivel 1 · Macro-concepto', fallbackTitle);
      }
      if (heading.length > 3 && !heading.toLowerCase().includes(fallbackTitle.toLowerCase())) {
        pushCue(`[Macro] ¿Qué conceptos subordinados y fundamentos abarca "${heading}"?`);
      }
      continue;
    }

    const clean = line.replace(/^[-•*0-9.)\s]+/, '').trim();
    const colonIdx = clean.indexOf(':');
    if (colonIdx > 2 && colonIdx < 65 && clean.length > colonIdx + 10) {
      const candidateTerm = clean.slice(0, colonIdx).replace(/\*+/g, '').trim();
      const candidateDef = clean.slice(colonIdx + 1).trim();
      if (candidateTerm.split(/\s+/).length <= 8) {
        const isMeso = /causa|produce|provoca|proceso|etapa|fase|regula|mecanismo|función/i.test(
          candidateDef
        );
        pushTerm(
          candidateTerm,
          candidateDef,
          isMeso ? 'Nivel 2 · Mecanismo/Proceso' : 'Nivel 3 · Micro-concepto/Detalle',
          currentMacro
        );
        pushCue(
          isMeso
            ? `[Meso] ¿Qué mecanismo o relación causal explica "${candidateTerm}" en los apuntes?`
            : `[Micro] ¿Qué es "${candidateTerm}" y cómo se define exactamente en los apuntes?`
        );
      }
    }
  }

  return {
    keyTerms: keyTerms.slice(0, 14),
    cues: cues.slice(0, 12),
  };
}

interface TopicNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: Topic | null;
  subjectName: string;
  isNewTopic?: boolean;
  suggestedTopicNumber?: number;
  preferences?: StudyPreferences;
  initialDocumentId?: string;
  initialOpenKeyPoints?: boolean;
  initialTriggerFormatAI?: boolean;
  onOpenReadingMode?: () => void;
  onChangeTopicDifficulty?: (topicId: string, difficulty: DifficultyLevel) => void;
  onAiError?: (actionTitle: string, errorMessage: string) => void;
  initialMindmap?: Mindmap | null;
  onSaveMindmap?: (mindmap: Mindmap) => void;
  onSaveTopicNotes: (
    topicId: string,
    data: {
      title?: string;
      notes: string;
      cues: string[];
      summary: string;
      difficulty?: DifficultyLevel;
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
  isNewTopic = false,
  suggestedTopicNumber = 1,
  preferences,
  initialDocumentId,
  initialOpenKeyPoints = false,
  initialTriggerFormatAI = false,
  onOpenReadingMode,
  onChangeTopicDifficulty,
  onAiError,
  initialMindmap = null,
  onSaveMindmap,
  onSaveTopicNotes,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'cornell_ia' | 'import'>('editor');
  const [noteFormat, setNoteFormat] = useState<'free' | 'cornell'>('free'); // Página de escritura de apuntes libre por defecto
  const [isFreeReadingMode, setIsFreeReadingMode] = useState<boolean>(false);
  const [topicDifficulty, setTopicDifficulty] = useState<DifficultyLevel>(
    topic?.difficulty || 'Intermedio'
  );
  const [externalFormatVersion, setExternalFormatVersion] = useState<number>(0);
  const [cornellKeyTerms, setCornellKeyTerms] = useState<
    Array<{ term: string; definition: string; semanticLevel?: string; parentConcept?: string }>
  >(() => {
    if (topic?.keyPoints && topic.keyPoints.length > 0) {
      return topic.keyPoints.map((kp) => ({
        term: kp.title,
        definition: kp.detail,
        semanticLevel: kp.semanticLevel || 'Nivel 2 · Mecanismo/Proceso',
        parentConcept: kp.parentConcept,
      }));
    }
    const initialSource = topic?.notes || topic?.generalNotes || '';
    if (initialSource.trim().length > 30) {
      return extractLocalTermsAndCuesFromText(initialSource, topic?.title || '').keyTerms;
    }
    return [];
  });
  const [newKeyTermName, setNewKeyTermName] = useState<string>('');
  const [newKeyTermDef, setNewKeyTermDef] = useState<string>('');
  const [isActiveRecallMask, setIsActiveRecallMask] = useState<boolean>(false);
  const [editableTitle, setEditableTitle] = useState<string>(topic?.title || '');
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [notes, setNotes] = useState<string>(() => {
    if (topic?.notes) return topic.notes;
    if (topic?.generalNotes) return topic.generalNotes;
    if (!isNewTopic && topic?.description && topic.description !== 'Sin descripción detallada.') {
      return topic.description;
    }
    return '';
  });
  const [richGeneralNotes, setRichGeneralNotes] = useState<string>(() => {
    if (topic?.richGeneralNotes) return topic.richGeneralNotes;
    const seed =
      topic?.notes ||
      topic?.generalNotes ||
      (!isNewTopic && topic?.description && topic.description !== 'Sin descripción detallada.'
        ? topic.description
        : '');
    return seed ? convertMarkdownAndImagesToRichHtml(seed, topic?.generalImages || []) : '';
  });
  const [generalImages, setGeneralImages] = useState<DocumentImageAsset[]>(
    topic?.generalImages || []
  );
  const [generalComments, setGeneralComments] = useState<DocumentComment[]>(
    topic?.generalComments || []
  );
  const [topicKeyPoints, setTopicKeyPoints] = useState<EditableKeyPoint[]>(
    topic?.keyPoints || []
  );

  const [cues, setCues] = useState<string[]>(() => {
    if (topic?.cues && topic.cues.length > 0) return topic.cues;
    const initialSource = topic?.notes || topic?.generalNotes || '';
    const extracted = extractLocalTermsAndCuesFromText(initialSource, topic?.title || '').cues;
    if (extracted.length > 0) return extracted;
    if (topic?.subtopics && topic.subtopics.length > 0) {
      return topic.subtopics.map((st) => `¿En qué consiste ${st}?`);
    }
    return isNewTopic ? [] : ['¿Cuál es la definición fundamental?', '¿Qué aplicaciones prácticas tiene?'];
  });
  const [summary, setSummary] = useState<string>(topic?.summary || '');
  const [newCue, setNewCue] = useState<string>('');

  // Attached Imported Documents State
  const [attachedFiles, setAttachedFiles] = useState<AttachedTopicFile[]>(() =>
    (topic?.attachedFiles || []).map((f) => ({
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
    if (initialDocumentId && (topic?.attachedFiles || []).some((f) => f.id === initialDocumentId)) {
      return initialDocumentId;
    }
    if ((topic?.attachedFiles || []).length > 0) {
      return topic!.attachedFiles![topic!.attachedFiles!.length - 1].id;
    }
    return 'main';
  });
  const [customPageCountOverride, setCustomPageCountOverride] = useState<number | undefined>(
    topic?.pageCount
  );
  const [hasManualPageOverride, setHasManualPageOverride] = useState<boolean>(
    Boolean(topic?.pageCount && topic.pageCount > 0 && (topic?.attachedFiles?.length || 0) === 0)
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
    const hasDocKeyPoints = (topic?.attachedFiles || []).some(
      (f) => f.keyPoints && f.keyPoints.length > 0
    );
    return hasDocKeyPoints || (topic?.keyPoints?.length || 0) > 0;
  });
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [actionBannerNotice, setActionBannerNotice] = useState<string | null>(null);
  const [isPdfExportModalOpen, setIsPdfExportModalOpen] = useState<boolean>(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [showMindmapPanel, setShowMindmapPanel] = useState<boolean>(false);
  const [isGeneratingMindmapModal, setIsGeneratingMindmapModal] = useState<boolean>(false);
  const [generatedModalMindmap, setGeneratedModalMindmap] = useState<Mindmap | null>(
    initialMindmap
  );

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

    if (isDifferentTopic) {
      setEditableTitle(topic.title || '');
      setCustomPageCountOverride(topic.pageCount);
      setHasManualPageOverride(
        Boolean(topic.pageCount && topic.pageCount > 0 && normalizedFiles.length === 0)
      );
    }

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
    if (topic.difficulty) {
      setTopicDifficulty(topic.difficulty);
    }
  }, [topic?.id, topic?.attachedFiles?.length, initialDocumentId, initialOpenKeyPoints, topic?.difficulty]);

  // Total pages from attached files included in organization
  const organizedFilesPageCount = useMemo(
    () => calculateOrganizedPagesFromFiles(attachedFiles),
    [attachedFiles]
  );

  // Auto-detect page count from free-writing notes when no attached files or manual override exist
  const hasMeaningfulFreeNotes = useMemo(() => {
    const trimmed = notes.trim();
    if (!trimmed || trimmed === 'Sin descripción detallada.') return false;
    if (
      !isNewTopic &&
      !topic?.notes &&
      !topic?.generalNotes &&
      trimmed === (topic?.description || '').trim()
    ) {
      return false;
    }
    return true;
  }, [notes, isNewTopic, topic?.notes, topic?.generalNotes, topic?.description]);

  const freeNotesAutoPageCount = useMemo(() => {
    if (!hasMeaningfulFreeNotes) return 0;
    return detectTextPageCount(notes);
  }, [hasMeaningfulFreeNotes, notes]);

  // Effective page count for topic organization
  const effectivePageCount = useMemo(() => {
    if (attachedFiles.length > 0 && organizedFilesPageCount > 0) {
      if (hasManualPageOverride && customPageCountOverride && customPageCountOverride > 0) {
        return customPageCountOverride;
      }
      return Math.max(customPageCountOverride || 0, organizedFilesPageCount);
    }
    if (hasManualPageOverride && customPageCountOverride !== undefined) {
      return customPageCountOverride;
    }
    if (freeNotesAutoPageCount > 0 && (isNewTopic || !topic?.pageCount)) {
      return freeNotesAutoPageCount;
    }
    return customPageCountOverride || topic?.pageCount || freeNotesAutoPageCount || 0;
  }, [
    attachedFiles.length,
    organizedFilesPageCount,
    hasManualPageOverride,
    customPageCountOverride,
    freeNotesAutoPageCount,
    isNewTopic,
    topic?.pageCount,
  ]);

  const handleManualPageCountInput = (rawValue: string) => {
    const parsed = parseInt(rawValue, 10);
    if (!rawValue.trim() || isNaN(parsed) || parsed <= 0) {
      setHasManualPageOverride(false);
      setCustomPageCountOverride(undefined);
    } else {
      setHasManualPageOverride(true);
      setCustomPageCountOverride(Math.min(2000, parsed));
    }
  };

  // Estimated study hours based on detected pages & topic difficulty
  const estimatedStudyHours = useMemo(() => {
    return schedulerService.calculateTopicTime(
      topicDifficulty || topic?.difficulty || 'Media',
      topic?.subtopics ? topic.subtopics.length : 0,
      notes.length,
      effectivePageCount > 0 ? effectivePageCount : undefined,
      preferences
    );
  }, [topicDifficulty, topic?.difficulty, topic?.subtopics, notes.length, effectivePageCount, preferences]);

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

  if (!isOpen || !topic) return null;

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

  // Resolver título actual del tema (editable en modo creación o existente)
  const resolvedTopicTitle = editableTitle.trim() || topic.title || `Tema ${suggestedTopicNumber}`;

  // Cambiar la dificultad del tema directamente desde el modal de apuntes
  const handleSelectDifficulty = (newDiff: DifficultyLevel) => {
    setTopicDifficulty(newDiff);
    if (onChangeTopicDifficulty) {
      onChangeTopicDifficulty(topic.id, newDiff);
    }
    if (!isNewTopic || editableTitle.trim()) {
      onSaveTopicNotes(topic.id, {
        title: editableTitle.trim() || topic.title,
        notes,
        cues,
        summary,
        difficulty: newDiff,
        attachedFiles,
        pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
        richGeneralNotes,
        generalImages,
        generalComments,
        keyPoints: activeEditableKeyPoints,
      });
    }
    showTransientNotice(`Dificultad del tema actualizada a ${newDiff} (~${schedulerService.calculateTopicTime(
      newDiff,
      topic.subtopics ? topic.subtopics.length : 0,
      notes.length,
      effectivePageCount > 0 ? effectivePageCount : undefined,
      preferences
    )}h estimadas).`);
  };

  // Resuelve el texto efectivo más completo disponible (combinando apuntes actuales + documentos adjuntos para no perder información)
  const getEffectiveSourceText = (onlyActiveEditor = false): string => {
    if (onlyActiveEditor) {
      if (activeAttachedFile) {
        const activeDocText =
          activeAttachedFile.content?.trim() ||
          (activeAttachedFile.richHtmlContent
            ? convertRichHtmlToPlainText(activeAttachedFile.richHtmlContent).trim()
            : '') ||
          activeAttachedFile.rawExtractedText?.trim() ||
          '';
        if (activeDocText) return activeDocText;
      } else {
        const activeMainText =
          notes?.trim() ||
          (richGeneralNotes ? convertRichHtmlToPlainText(richGeneralNotes).trim() : '') ||
          '';
        if (activeMainText) return activeMainText;
      }
    }

    const blocks: string[] = [];
    const seenBlocks = new Set<string>();
    const pushUniqueBlock = (txt: string) => {
      const clean = (txt || '').trim();
      if (!clean) return;
      const sig = clean.slice(0, 120).toLowerCase();
      if (seenBlocks.has(sig)) return;
      seenBlocks.add(sig);
      blocks.push(clean);
    };

    if (activeAttachedFile) {
      pushUniqueBlock(
        activeAttachedFile.content ||
          (activeAttachedFile.richHtmlContent
            ? convertRichHtmlToPlainText(activeAttachedFile.richHtmlContent)
            : '') ||
          activeAttachedFile.rawExtractedText ||
          ''
      );
    }
    pushUniqueBlock(
      notes || (richGeneralNotes ? convertRichHtmlToPlainText(richGeneralNotes) : '')
    );
    for (const f of attachedFiles) {
      pushUniqueBlock(f.content || f.rawExtractedText || '');
    }
    pushUniqueBlock(topic.notes || '');
    pushUniqueBlock(topic.generalNotes || '');
    if (blocks.length === 0) {
      pushUniqueBlock(topic.description || '');
      if (topic.subtopics && topic.subtopics.length > 0) {
        pushUniqueBlock(
          `Tema: ${topic.title}\nSubtemas:\n${topic.subtopics.map((s) => `- ${s}`).join('\n')}`
        );
      }
    }
    return (blocks.join('\n\n') || topic.title || '').trim();
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
          semanticLevel:
            kp.semanticLevel ||
            (idx < 2
              ? 'Nivel 1 · Macro-concepto'
              : idx < 5
              ? 'Nivel 2 · Mecanismo/Proceso'
              : 'Nivel 3 · Micro-concepto/Detalle'),
          parentConcept: kp.parentConcept || topic.title,
          importance:
            kp.importance === 'alta' || kp.importance === 'baja' ? kp.importance : 'media',
          sourceDocName: activeAttachedFile ? activeAttachedFile.name : topic.title,
        })
      );

      const nextSummary = data.summary || summary;
      const nextCues =
        Array.isArray(data.cues) && data.cues.length > 0
          ? Array.from(new Set([...data.cues, ...cues])).slice(0, 14)
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
        setCornellKeyTerms(
          generatedPoints.map((kp) => ({
            term: kp.title,
            definition: kp.detail,
            semanticLevel: kp.semanticLevel,
            parentConcept: kp.parentConcept,
          }))
        );
      }
      if (nextCues !== cues) {
        setCues(nextCues);
      }

      // Auto-persistir los puntos clave y el resumen en la asignatura
      onSaveTopicNotes(topic.id, {
        title: editableTitle.trim() || topic.title || `Tema ${suggestedTopicNumber}`,
        notes,
        cues: nextCues,
        summary: nextSummary,
        difficulty: topicDifficulty,
        attachedFiles: nextAttachedFiles,
        pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
        richGeneralNotes,
        generalImages,
        generalComments,
        keyPoints: nextKeyPoints,
      });

      showTransientNotice(
        `¡Extracción de Jerarquía Semántica completada: ${generatedPoints.length} conceptos clave y ${nextCues.length} indicios detectados!`
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

  // Grabación de Nota de Voz Rápida (Web Speech API -> Notas Generales del Tema)
  const [isRecordingVoiceModal, setIsRecordingVoiceModal] = useState<boolean>(false);
  const modalRecognitionRef = useRef<any>(null);
  const modalVoiceBufferRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (modalRecognitionRef.current) {
        try {
          modalRecognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleToggleModalVoiceRecording = () => {
    if (!topic) return;

    if (isRecordingVoiceModal) {
      if (modalRecognitionRef.current) {
        try {
          modalRecognitionRef.current.onend = null;
          modalRecognitionRef.current.stop();
        } catch {}
        modalRecognitionRef.current = null;
      }
      setIsRecordingVoiceModal(false);
      if (modalVoiceBufferRef.current.trim()) {
        showTransientNotice(
          '¡Nota de voz convertida a texto y almacenada automáticamente en las notas generales del tema!'
        );
        modalVoiceBufferRef.current = '';
      }
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setImportError(
        'Tu navegador no soporta reconocimiento de voz directo. Prueba en Chrome o Edge.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = false;

      modalVoiceBufferRef.current = '';
      setActiveEditingDocId('main');

      recognition.onresult = (event: any) => {
        let added = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            added += event.results[i][0].transcript + ' ';
          }
        }
        const cleaned = added.trim();
        if (cleaned) {
          modalVoiceBufferRef.current = `${modalVoiceBufferRef.current} ${cleaned}`.trim();
          const timestamp = new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const voiceLine = `🎙️ [Nota de voz · ${timestamp}]: ${cleaned}`;
          setNotes((prevNotes) => {
            const nextMain = prevNotes.trim()
              ? `${prevNotes.trim()}\n\n${voiceLine}`
              : voiceLine;
            const nextRich = convertMarkdownAndImagesToRichHtml(nextMain, generalImages);
            setRichGeneralNotes(nextRich);
            onSaveTopicNotes(topic.id, {
              title: editableTitle.trim() || topic.title || `Tema ${suggestedTopicNumber}`,
              notes: nextMain,
              cues,
              summary,
              attachedFiles,
              pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
              richGeneralNotes: nextRich,
              generalImages,
              generalComments,
              keyPoints: activeEditableKeyPoints,
            });
            return nextMain;
          });
        }
      };

      recognition.onerror = (ev: any) => {
        if (ev?.error && ev.error !== 'no-speech') {
          setImportError(`Aviso de micrófono: ${ev.error}`);
        }
      };

      recognition.onend = () => {
        setIsRecordingVoiceModal(false);
        if (modalVoiceBufferRef.current.trim()) {
          showTransientNotice(
            '¡Nota de voz convertida a texto y almacenada automáticamente en las notas generales del tema!'
          );
          modalVoiceBufferRef.current = '';
        }
      };

      modalRecognitionRef.current = recognition;
      setIsRecordingVoiceModal(true);
      recognition.start();
    } catch (err: any) {
      setImportError(err?.message || 'Error al iniciar la grabación de voz.');
      setIsRecordingVoiceModal(false);
    }
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

  // AI Structure & Enhance (Mejorar Formato IA en Apuntes Libres y Método Cornell Automático con IA — Espacio ilimitado)
  const handleStructureWithAI = async (forceRefresh = true) => {
    const activeEditorSource = getEffectiveSourceText(true);
    const fullCombinedSource = getEffectiveSourceText(false);
    const fallbackSyllabusContext = [
      `Tema: ${topic.title}`,
      topic.description ? `Descripción: ${topic.description}` : '',
      Array.isArray(topic.subtopics) && topic.subtopics.length > 0
        ? `Subtemas oficiales: ${topic.subtopics.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const textToStructure =
      activeEditorSource || fullCombinedSource || fallbackSyllabusContext || topic.title;

    setIsStructuring(true);
    setImportError(null);

    try {
      const response = await fetch('/api/gemini/structure-topic-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: activeAttachedFile ? `${topic.title} — ${activeAttachedFile.name}` : topic.title,
          rawNotes: textToStructure,
          subjectName,
          subtopics: topic.subtopics || [],
          forceRefresh,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const structuredText = resData.data.notes || textToStructure;
        const localExtracted = extractLocalTermsAndCuesFromText(
          `${textToStructure}\n\n${structuredText}`,
          topic.title
        );

        const aiCues =
          Array.isArray(resData.data.cues) && resData.data.cues.length > 0
            ? resData.data.cues.map(String).filter(Boolean)
            : [];
        const nextCues =
          aiCues.length > 0 || localExtracted.cues.length > 0
            ? Array.from(new Set([...aiCues, ...localExtracted.cues])).slice(0, 12)
            : cues;

        const nextSummary = resData.data.summary || summary;

        const aiKeyTerms: Array<{
          term: string;
          definition: string;
          semanticLevel?: string;
          parentConcept?: string;
        }> =
          Array.isArray(resData.data.keyTerms) && resData.data.keyTerms.length > 0
            ? resData.data.keyTerms
                .filter((kt: any) => kt && kt.term && kt.definition)
                .map((kt: any) => ({
                  term: String(kt.term).trim(),
                  definition: String(kt.definition).trim(),
                  semanticLevel: kt.semanticLevel
                    ? String(kt.semanticLevel)
                    : 'Nivel 2 · Mecanismo/Proceso',
                  parentConcept: kt.parentConcept ? String(kt.parentConcept) : topic.title,
                }))
            : [];

        const seenTerms = new Set(aiKeyTerms.map((k) => k.term.toLowerCase()));
        const mergedKeyTerms = [...aiKeyTerms];
        for (const locKt of localExtracted.keyTerms) {
          if (!seenTerms.has(locKt.term.toLowerCase()) && mergedKeyTerms.length < 16) {
            seenTerms.add(locKt.term.toLowerCase());
            mergedKeyTerms.push(locKt);
          }
        }

        if (mergedKeyTerms.length > 0) {
          setCornellKeyTerms(mergedKeyTerms);
        }

        const nextKeyPoints: EditableKeyPoint[] =
          mergedKeyTerms.length > 0
            ? mergedKeyTerms.map((kt, idx) => ({
                id: `kp-struct-${Date.now()}-${idx}`,
                title: kt.term,
                detail: kt.definition,
                category: 'Concepto Clave IA',
                semanticLevel:
                  kt.semanticLevel ||
                  (idx < 2
                    ? 'Nivel 1 · Macro-concepto'
                    : idx < 5
                    ? 'Nivel 2 · Mecanismo/Proceso'
                    : 'Nivel 3 · Micro-concepto/Detalle'),
                parentConcept: kt.parentConcept || topic.title,
                importance: idx < 4 ? 'alta' : 'media',
                sourceDocName: activeAttachedFile ? activeAttachedFile.name : topic.title,
              }))
            : activeEditableKeyPoints;

        if (nextKeyPoints.length > 0) {
          setTopicKeyPoints(nextKeyPoints);
        }

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
                  keyPoints: nextKeyPoints,
                  cues: nextCues,
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

        setCues(nextCues);
        if (nextSummary) {
          setSummary(nextSummary);
        }

        // Forzar refresco inmediato del lienzo visual en RichEditableDocumentWorkspace
        setExternalFormatVersion((v) => v + 1);

        // Auto-persistir el formato estructurado con IA en la asignatura
        onSaveTopicNotes(topic.id, {
          title: editableTitle.trim() || topic.title || `Tema ${suggestedTopicNumber}`,
          notes: nextMainNotes,
          cues: nextCues,
          summary: nextSummary,
          difficulty: topicDifficulty,
          attachedFiles: nextAttachedFiles,
          pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
          richGeneralNotes: nextRichGeneral,
          generalImages,
          generalComments,
          keyPoints: nextKeyPoints,
        });

        showTransientNotice(
          `¡Formato académico mejorado con IA aplicado (${mergedKeyTerms.length} conceptos clave y ${nextCues.length} preguntas detectadas, conservando el 100% de tus apuntes)!`
        );
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
          editableTitle.trim() ||
            topic.title ||
            file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim(),
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
        setHasManualPageOverride(false);
        setCustomPageCountOverride(newOrganizedPages);
      }

      // If creating a new topic and title is still blank, suggest title cleanly from uploaded filename
      const suggestedFileTitle =
        !editableTitle.trim() && newlyAddedFiles[0]?.name
          ? newlyAddedFiles[0].name
              .replace(/\.[^/.]+$/, '')
              .replace(/[_-]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          : '';
      const resolvedUploadTitle =
        editableTitle.trim() || suggestedFileTitle || topic.title || `Tema ${suggestedTopicNumber}`;
      if (!editableTitle.trim() && suggestedFileTitle) {
        setEditableTitle(suggestedFileTitle);
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
        title: resolvedUploadTitle,
        notes: nextMainNotes,
        cues: mergedCues,
        summary: latestSummary,
        difficulty: topicDifficulty,
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
    setHasManualPageOverride(false);
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
    const trimmedTitle = editableTitle.trim();
    if (isNewTopic && !trimmedTitle) {
      setImportError('Escribe un título para el tema antes de guardarlo.');
      titleInputRef.current?.focus();
      return;
    }

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
      title: trimmedTitle || topic.title,
      notes: finalMainNotes,
      cues,
      summary,
      difficulty: topicDifficulty,
      attachedFiles: finalAttachedFiles,
      pageCount: effectivePageCount > 0 ? effectivePageCount : topic.pageCount,
      richGeneralNotes: finalRichGeneralNotes,
      generalImages,
      generalComments,
      keyPoints: activeEditableKeyPoints,
    };

    onSaveTopicNotes(topic.id, savePayload);
    setSaveSuccessNotice(true);
    setTimeout(() => {
      setSaveSuccessNotice(false);
      onClose();
    }, 350);
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

  // Generar Mapa Mental con IA a partir de los apuntes actuales del modal
  const handleGenerateMindmapFromModalNotes = async () => {
    setShowMindmapPanel(true);
    setIsGeneratingMindmapModal(true);
    setImportError(null);
    try {
      const combinedNotesParts: string[] = [];
      if (currentEditorText?.trim()) combinedNotesParts.push(currentEditorText.trim());
      if (notes?.trim() && notes.trim() !== currentEditorText?.trim()) {
        combinedNotesParts.push(notes.trim());
      }
      attachedFiles.forEach((f) => {
        if (f.content?.trim() && !combinedNotesParts.includes(f.content.trim())) {
          combinedNotesParts.push(`[${f.name}]\n${f.content.trim()}`);
        }
      });
      if (activeEditableKeyPoints.length > 0) {
        combinedNotesParts.push(
          `[Puntos Clave]\n${activeEditableKeyPoints
            .map((kp, i) => `${i + 1}. ${kp.title}: ${kp.detail}`)
            .join('\n')}`
        );
      }
      const fullSourceNotes =
        combinedNotesParts.join('\n\n') || topic.description || topic.title;

      const response = await fetch('/api/gemini/generate-cornell-mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: topic.title,
          topicDescription: topic.description || '',
          subtopics: topic.subtopics || [],
          subjectName,
          cornellTitle: topic.title,
          cues,
          notes: fullSourceNotes,
          summary: summary || topic.summary || '',
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success || !resData.data) {
        throw new Error(
          resData.error || 'No se pudo generar el mapa mental con IA desde los apuntes.'
        );
      }

      const newMindmap: Mindmap = {
        id: `mm-cornell-${Date.now()}`,
        topicIds: [topic.id],
        title: resData.data.title || `Mapa Mental: ${topic.title}`,
        summary: resData.data.summary || summary || '',
        rootNode: resData.data.rootNode,
        createdAt: new Date().toISOString(),
      };

      setGeneratedModalMindmap(newMindmap);
      if (onSaveMindmap) {
        onSaveMindmap(newMindmap);
      }
      setActionBannerNotice(
        `¡Mapa mental interactivo de "${topic.title}" generado con IA a partir de tus apuntes!`
      );
    } catch (err: any) {
      const msg = err?.message || 'Error al generar el mapa mental con IA.';
      setImportError(msg);
      onAiError?.('Mapa Mental IA', msg);
    } finally {
      setIsGeneratingMindmapModal(false);
    }
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'editor' || noteFormat !== 'free') {
      setIsFreeReadingMode(false);
    }
  }, [isOpen, activeTab, noteFormat]);

  useEffect(() => {
    if (!isOpen || !isFreeReadingMode) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFreeReadingMode(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isFreeReadingMode]);

  const showFocusedFreeReading =
    isFreeReadingMode && activeTab === 'editor' && noteFormat === 'free';

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
        {/* Cabecera Visual del Estudio de Apuntes y Documentos (oculta en Modo Lectura) */}
        {!showFocusedFreeReading && (
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
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

            <div className="min-w-0 flex-1">
              {/* Metadatos limpios sin cápsulas */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                <span className="font-semibold text-blue-600">
                  {isNewTopic
                    ? 'Nuevo Tema · Subir Apuntes o Escribir'
                    : 'Escritura de Apuntes Libre y Documentos'}
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

              {isNewTopic ? (
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <input
                    ref={titleInputRef}
                    type="text"
                    autoFocus
                    value={editableTitle}
                    onChange={(e) => {
                      setEditableTitle(e.target.value);
                      if (importError && e.target.value.trim()) {
                        setImportError(null);
                      }
                    }}
                    placeholder={`Título del Tema ${suggestedTopicNumber} (o sube un PDF para rellenarlo)...`}
                    className="flex-1 min-w-[220px] sm:min-w-[300px] text-sm sm:text-base font-bold text-slate-900 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <div
                    className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 rounded-xl px-2.5 py-1.5 transition-all"
                    title="Opcional: se detecta automáticamente si subes un PDF/Word o escribes apuntes libres"
                  >
                    <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                      Nº Págs.:
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="2000"
                      value={
                        hasManualPageOverride
                          ? customPageCountOverride ?? ''
                          : effectivePageCount > 0
                          ? effectivePageCount
                          : ''
                      }
                      onChange={(e) => handleManualPageCountInput(e.target.value)}
                      placeholder="Auto"
                      className="w-14 bg-transparent text-xs font-bold font-mono-numbers text-slate-900 text-center focus:outline-none"
                    />
                    {effectivePageCount > 0 && (
                      <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                        {hasManualPageOverride
                          ? 'manual'
                          : attachedFiles.length > 0
                          ? 'auto doc'
                          : 'auto texto'}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate mt-0.5">
                  {topic.title}
                </h2>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector directo de Dificultad del Tema (Básico / Intermedio / Avanzado) */}
            <div
              className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs"
              title="Cambiar el nivel de dificultad de este tema (recalcula automáticamente el tiempo estimado de estudio)"
            >
              <span className="text-[11px] font-semibold text-slate-500 px-1.5">Dificultad:</span>
              {(['Básico', 'Intermedio', 'Avanzado'] as const).map((lvl) => {
                const isSelected =
                  schedulerService.normalizeDifficultyToCanonical(topicDifficulty) === lvl;
                const activeStyle =
                  lvl === 'Avanzado'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : lvl === 'Intermedio'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-emerald-600 text-white shadow-2xs';
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleSelectDifficulty(lvl)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      isSelected ? activeStyle : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
            {onOpenReadingMode && !isNewTopic && (
              <button
                type="button"
                onClick={() => {
                  onSaveTopicNotes(topic.id, {
                    title: editableTitle.trim() || topic.title,
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
                  <span>{isNewTopic ? 'Crear Tema y Guardar' : 'Guardar cambios'}</span>
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
        )}

        {/* Barra de Navegación del Estudio y Herramientas IA (oculta en Modo Lectura) */}
        {!showFocusedFreeReading && (
        <div className="px-6 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs flex-wrap">
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
              onClick={() => {
                setActiveTab('cornell_ia');
                // Si el tema aún no tiene resumen Cornell o notas estructuradas, lo genera automáticamente con IA al abrir la pestaña
                const hasMeaningfulCornell =
                  summary.trim().length > 20 &&
                  notes.trim().length > 80 &&
                  notes.trim() !== (topic.description || '').trim();
                if (!hasMeaningfulCornell && !isStructuring) {
                  handleStructureWithAI(false);
                }
              }}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'cornell_ia'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-2xs'
                  : 'text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80'
              }`}
              title="Genera y edita automáticamente el Método Cornell completo de este tema con Inteligencia Artificial"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Método Cornell IA</span>
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

              {/* Botón de Nota de Voz Rápida (Web Speech API -> Notas Generales) */}
              <button
                type="button"
                onClick={handleToggleModalVoiceRecording}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                  isRecordingVoiceModal
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse shadow-xs'
                    : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200'
                }`}
                title="Grabar nota de voz rápida y guardarla automáticamente como texto en las notas generales del tema"
              >
                {isRecordingVoiceModal ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Detener y Guardar Voz</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-rose-600" />
                    <span>Nota de Voz</span>
                  </>
                )}
              </button>

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

              {noteFormat === 'free' && (
                <button
                  type="button"
                  onClick={() => setIsFreeReadingMode(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                  title="Ocultar interfaz de edición, centrar el contenido y ampliar el espaciado entre líneas para leer sin distracciones"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Modo Lectura</span>
                </button>
              )}

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
                onClick={() => handleStructureWithAI(true)}
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

              <button
                type="button"
                disabled={isGeneratingMindmapModal}
                onClick={() => {
                  if (!showMindmapPanel) {
                    setShowMindmapPanel(true);
                    if (!generatedModalMindmap) {
                      handleGenerateMindmapFromModalNotes();
                    }
                  } else {
                    setShowMindmapPanel(false);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap ${
                  showMindmapPanel
                    ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'
                    : 'bg-white hover:bg-violet-50 text-violet-700 border-violet-200'
                }`}
                title="Generar o ver un Mapa Mental interactivo con IA a partir de los apuntes de este tema"
              >
                {isGeneratingMindmapModal ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creando Mapa IA...</span>
                  </>
                ) : (
                  <>
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Mapa Mental IA</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        )}

        {/* Contenido Principal */}
        <div
          className={
            showFocusedFreeReading
              ? 'flex-1 overflow-hidden flex flex-col p-0'
              : 'flex-1 overflow-y-auto p-5 sm:p-6 space-y-4'
          }
        >
          {!showFocusedFreeReading && importError && (
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

          {!showFocusedFreeReading && actionBannerNotice && (
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

          {!showFocusedFreeReading && isProcessingFile && activeTab === 'editor' && (
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
            <div className={showFocusedFreeReading ? 'flex-1 flex flex-col min-h-0 h-full' : 'space-y-4'}>
              {/* Estantería Visual de Documentos y Control de Páginas del Tema */}
              {!showFocusedFreeReading && (
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
                      value={
                        hasManualPageOverride
                          ? customPageCountOverride ?? ''
                          : effectivePageCount || ''
                      }
                      onChange={(e) => handleManualPageCountInput(e.target.value)}
                      placeholder="Auto"
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
              )}

              {/* Panel Interactivo: Resumen Automático IA y Puntos Clave Editables */}
              {!showFocusedFreeReading && showKeyPointsPanel && (
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

              {/* Panel Interactivo Desplegable: Mapa Mental con IA de los Apuntes */}
              {!showFocusedFreeReading && showMindmapPanel && (
                <div className="bg-violet-50/40 border border-violet-200/90 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-violet-600 text-white">
                        <GitBranch className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Mapa Mental con IA de tus Apuntes · {topic.title}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Árbol jerárquico interactivo D3.js generado a partir de tus apuntes libres, documentos y puntos clave.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isGeneratingMindmapModal}
                        onClick={handleGenerateMindmapFromModalNotes}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingMindmapModal ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Generando con IA...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {generatedModalMindmap
                                ? 'Regenerar Mapa Mental IA'
                                : 'Generar Mapa Mental IA'}
                            </span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowMindmapPanel(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg cursor-pointer"
                        title="Ocultar panel de mapa mental"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isGeneratingMindmapModal ? (
                    <div className="p-8 bg-white rounded-xl border border-violet-100 flex flex-col items-center justify-center text-center space-y-2">
                      <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
                      <div className="text-xs font-bold text-slate-900">
                        Construyendo mapa mental con IA desde tus apuntes...
                      </div>
                      <p className="text-[11px] text-slate-500 max-w-md">
                        Sintetizando conceptos principales, subramas y preguntas de repaso activo.
                      </p>
                    </div>
                  ) : generatedModalMindmap ? (
                    <div className="rounded-xl overflow-hidden border border-violet-200 bg-white">
                      <D3MindMapCanvas
                        rootNode={generatedModalMindmap.rootNode}
                        title={generatedModalMindmap.title}
                        summary={generatedModalMindmap.summary}
                        height={420}
                      />
                    </div>
                  ) : (
                    <div className="p-5 bg-white/90 border border-dashed border-violet-200 rounded-xl text-center space-y-2">
                      <p className="text-xs font-semibold text-slate-700">
                        Pulsa el botón para crear el mapa mental de tus apuntes con IA
                      </p>
                      <button
                        type="button"
                        onClick={handleGenerateMindmapFromModalNotes}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Hacer Mapa Mental con IA</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Workspace del Documento Editable Rico (Subrayar, Comentarios, Editar Texto, Imágenes) */}
              {noteFormat === 'free' && (
                <RichEditableDocumentWorkspace
                  documentId={activeAttachedFile ? activeAttachedFile.id : `main-${topic.id}`}
                  documentTitle={activeAttachedFile ? activeAttachedFile.name : resolvedTopicTitle}
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
                  externalFormatVersion={externalFormatVersion}
                  onImproveFormatAI={() => handleStructureWithAI(true)}
                  isFormattingAI={isStructuring}
                  isReadingMode={isFreeReadingMode}
                  onToggleReadingMode={setIsFreeReadingMode}
                  subjectName={subjectName}
                  documentSwitcherSlot={
                    attachedFiles.length > 0 ? (
                      <select
                        value={activeEditingDocId}
                        onChange={(e) => setActiveEditingDocId(e.target.value)}
                        aria-label="Cambiar documento en lectura"
                        className="text-xs font-bold bg-transparent border border-current/20 rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer max-w-[240px] truncate"
                      >
                        <option value="main" className="text-slate-900 bg-white">
                          Apuntes Libres del Tema
                        </option>
                        {attachedFiles.map((f) => (
                          <option key={f.id} value={f.id} className="text-slate-900 bg-white">
                            {f.name}
                          </option>
                        ))}
                      </select>
                    ) : undefined
                  }
                  onChange={handleRichWorkspaceChange}
                />
              )}
            </div>
          )}

          {((activeTab === 'editor' && noteFormat === 'cornell') || activeTab === 'cornell_ia') && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Cabecera de Generación Automática del Método Cornell con IA */}
              <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold tracking-wide uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Sistema Oficial de la Universidad de Cornell · Espacio Ilimitado</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    Hoja Cornell Inteligente: {topic.title}
                  </h3>
                  <p className="text-xs text-indigo-100 max-w-2xl">
                    La IA analiza el 100% de tus apuntes y documentos sin recortar ni limitar la extensión, extrayendo preguntas detonadoras específicas (Indicios/Cues), Conceptos Clave IA con su definición exacta y el Resumen Ejecutivo.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isStructuring}
                    onClick={() => handleStructureWithAI(true)}
                    className="px-4 py-2.5 rounded-xl bg-white text-indigo-950 hover:bg-indigo-50 font-extrabold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
                  >
                    {isStructuring ? (
                      <>
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                        <span>Estructurando Cornell con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span>Generar / Mejorar Formato Cornell IA</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingKeyPoints}
                    onClick={handleGenerateKeyPointsFromDocumentWithAI}
                    className="px-3.5 py-2.5 rounded-xl bg-indigo-950/50 hover:bg-indigo-950/70 border border-white/25 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                    title="Analizar a fondo los apuntes actuales para detectar Indicios, Preguntas y Conceptos Clave IA"
                  >
                    {isGeneratingKeyPoints ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Detectando Conceptos...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Detectar Indicios y Conceptos IA</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsActiveRecallMask((prev) => !prev)}
                    className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActiveRecallMask
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                        : 'bg-indigo-950/40 hover:bg-indigo-950/60 text-white border-white/25'
                    }`}
                    title="Oculta temporalmente la columna derecha de apuntes para autoevaluarte respondiendo a las preguntas detonadoras"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>
                      {isActiveRecallMask ? 'Mostrar Apuntes' : 'Autoevaluar (Tapar Apuntes)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPdfExportModalOpen(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-950/60 border border-white/25 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    title="Descargar esta hoja Cornell maquetada en PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF Cornell</span>
                  </button>
                </div>
              </div>

              {isStructuring && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3 text-xs text-indigo-950 animate-pulse">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                  <div>
                    <div className="font-bold">
                      Estructurando apuntes Cornell con IA respetando el 100% de tu extensión...
                    </div>
                    <div className="text-[11px] text-indigo-700 mt-0.5">
                      Extrayendo preguntas detonadoras específicas de tus párrafos, detectando conceptos clave con su definición exacta y aplicando formato enriquecido sin recortar información.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Columna Izquierda (4 cols): Preguntas Detonadoras (Cues) + Conceptos Clave IA */}
                <div className="lg:col-span-4 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Bloque 1A: Columna de Indicios y Preguntas (Cues) */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 gap-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>1. Columna de Indicios y Preguntas (Cues)</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isGeneratingKeyPoints || isStructuring}
                            onClick={handleGenerateKeyPointsFromDocumentWithAI}
                            className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                            title="Detectar automáticamente preguntas e indicios a partir del contenido escrito en tus apuntes"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Detectar de apuntes</span>
                          </button>
                          <span className="text-xs font-mono-numbers bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold">
                            {cues.length}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Indicios y preguntas extraídos por <strong>Jerarquía Semántica</strong> (Macro · Meso · Micro) de tus apuntes para Active Recall.
                      </p>

                      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                        {cues.map((cue, idx) => {
                          const isMacro = /^\[Macro\]/i.test(cue);
                          const isMeso = /^\[Meso\]/i.test(cue);
                          const isMicro = /^\[Micro\]/i.test(cue);
                          return (
                            <div
                              key={idx}
                              className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-start justify-between gap-2 text-xs hover:border-indigo-300 transition-colors shadow-2xs"
                            >
                              <span
                                className={`px-1.5 py-0.5 rounded-md font-mono-numbers font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 ${
                                  isMacro
                                    ? 'bg-purple-100 text-purple-800'
                                    : isMeso
                                    ? 'bg-blue-100 text-blue-800'
                                    : isMicro
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-indigo-50 text-indigo-700'
                                }`}
                              >
                                {isMacro ? 'N1' : isMeso ? 'N2' : isMicro ? 'N3' : idx + 1}
                              </span>
                              <textarea
                                rows={2}
                                value={cue}
                                onChange={(e) => {
                                  const next = [...cues];
                                  next[idx] = e.target.value;
                                  setCues(next);
                                }}
                                className="flex-1 text-slate-800 font-semibold leading-snug bg-transparent focus:outline-none focus:border-b focus:border-indigo-400 resize-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveCue(idx)}
                                className="text-slate-300 hover:text-rose-500 p-0.5 shrink-0 cursor-pointer"
                                title="Eliminar indicio/pregunta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}

                        {cues.length === 0 && (
                          <div className="text-center py-5 text-[11px] text-slate-400 italic">
                            Sin preguntas detonadoras aún. Pulsa "Detectar de apuntes" para extraerlas de tu texto.
                          </div>
                        )}
                      </div>

                      {/* Añadir pregunta manual */}
                      <div className="pt-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newCue}
                          onChange={(e) => setNewCue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCue()}
                          placeholder="Añadir indicio o pregunta detonadora..."
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddCue}
                          className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
                          title="Añadir pregunta"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Bloque 1B: Conceptos Clave IA con Jerarquía Semántica */}
                    <div className="pt-3 border-t border-slate-200/90 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Conceptos Clave (Jerarquía Semántica)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleGenerateKeyPointsFromDocumentWithAI()}
                            disabled={isGeneratingKeyPoints}
                            className="px-2 py-0.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                            title="Extraer jerarquía semántica (Macro, Meso, Micro) con la API de Gemini"
                          >
                            Extraer Jerarquía IA
                          </button>
                          <span className="font-mono-numbers text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold">
                            {cornellKeyTerms.length}
                          </span>
                        </div>
                      </div>

                      {cornellKeyTerms.length === 0 ? (
                        <div className="p-3 rounded-xl bg-white border border-dashed border-indigo-200 text-[11px] text-slate-500 text-center">
                          Pulsa <strong>"Extraer Jerarquía IA"</strong> para clasificar los conceptos clave en Nivel 1 (Macro), Nivel 2 (Meso) y Nivel 3 (Micro).
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                          {cornellKeyTerms.map((kt, kIdx) => (
                            <div
                              key={kIdx}
                              className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 text-[11px] space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <input
                                  type="text"
                                  value={kt.term}
                                  onChange={(e) => {
                                    const next = [...cornellKeyTerms];
                                    next[kIdx] = { ...next[kIdx], term: e.target.value };
                                    setCornellKeyTerms(next);
                                  }}
                                  className="flex-1 font-bold text-indigo-950 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none"
                                  placeholder="Término o concepto..."
                                />
                                {kt.semanticLevel && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                                      kt.semanticLevel.includes('Nivel 1')
                                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                                        : kt.semanticLevel.includes('Nivel 2')
                                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    }`}
                                    title={
                                      kt.parentConcept
                                        ? `${kt.semanticLevel} · Eje: ${kt.parentConcept}`
                                        : kt.semanticLevel
                                    }
                                  >
                                    {kt.semanticLevel.split('·')[0].trim()}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCornellKeyTerms(cornellKeyTerms.filter((_, i) => i !== kIdx))
                                  }
                                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Eliminar concepto clave"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <textarea
                                rows={2}
                                value={kt.definition}
                                onChange={(e) => {
                                  const next = [...cornellKeyTerms];
                                  next[kIdx] = { ...next[kIdx], definition: e.target.value };
                                  setCornellKeyTerms(next);
                                }}
                                className="w-full text-slate-700 bg-white/80 border border-indigo-100 rounded-lg p-1.5 focus:outline-none focus:border-indigo-400 resize-none leading-snug"
                                placeholder="Definición o explicación extraída de los apuntes..."
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Añadir nuevo Concepto Clave manual */}
                      <div className="pt-1 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newKeyTermName}
                            onChange={(e) => setNewKeyTermName(e.target.value)}
                            placeholder="Nuevo concepto clave..."
                            className="w-2/5 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                          <input
                            type="text"
                            value={newKeyTermDef}
                            onChange={(e) => setNewKeyTermDef(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newKeyTermName.trim() && newKeyTermDef.trim()) {
                                setCornellKeyTerms([
                                  ...cornellKeyTerms,
                                  {
                                    term: newKeyTermName.trim(),
                                    definition: newKeyTermDef.trim(),
                                    semanticLevel: 'Nivel 3 · Micro-concepto/Detalle',
                                  },
                                ]);
                                setNewKeyTermName('');
                                setNewKeyTermDef('');
                              }
                            }}
                            placeholder="Definición breve..."
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newKeyTermName.trim() || !newKeyTermDef.trim()) return;
                              setCornellKeyTerms([
                                ...cornellKeyTerms,
                                {
                                  term: newKeyTermName.trim(),
                                  definition: newKeyTermDef.trim(),
                                  semanticLevel: 'Nivel 3 · Micro-concepto/Detalle',
                                },
                              ]);
                              setNewKeyTermName('');
                              setNewKeyTermDef('');
                            }}
                            className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer shrink-0"
                            title="Añadir concepto clave"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha (8 cols): Cuerpo de Apuntes Cornell con Espacio Ilimitado (Sin límite de caracteres ni filas) */}
                <div className="lg:col-span-8 space-y-2.5 relative">
                  <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-50 border border-slate-200/90 px-3.5 py-2 rounded-xl">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>2. Columna Principal de Apuntes Estructurados Cornell</span>
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                        <span>∞ Espacio ilimitado · Sin límite de caracteres</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono-numbers font-semibold">
                        {currentEditorText.length.toLocaleString()} caracteres ·{' '}
                        {currentEditorText.split(/\s+/).filter(Boolean).length.toLocaleString()} palabras
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={currentEditorText}
                      onChange={(e) => handleEditorTextChange(e.target.value)}
                      rows={Math.max(24, currentEditorText.split(/\r?\n/).length + 4)}
                      placeholder="Escribe o pega aquí tus apuntes sin límite de caracteres. Al pulsar 'Generar / Mejorar Formato Cornell IA', la IA estructurará todo tu contenido con encabezados, negritas y listas respetando el 100% de tu extensión sin recortar nada..."
                      className={`w-full min-h-[480px] text-xs font-mono p-4 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y transition-all ${
                        isActiveRecallMask ? 'blur-md select-none opacity-40' : ''
                      }`}
                    />
                    {isActiveRecallMask && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/10 rounded-2xl p-6 text-center backdrop-blur-xs">
                        <div className="bg-white/95 border border-indigo-200 rounded-2xl p-5 shadow-md max-w-md space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
                            <HelpCircle className="w-5 h-5" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-900">
                            Modo Autoevaluación Active Recall Activo
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Intenta responder en voz alta o mentalmente a las <strong>{cues.length} preguntas detonadoras</strong> de la columna izquierda antes de destapar tus apuntes.
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsActiveRecallMask(false)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                          >
                            Destapar y Comprobar Apuntes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Zona 3: Resumen Inferior Cornell */}
              <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>3. Síntesis y Resumen Ejecutivo Inferior (Pie de Hoja Cornell)</span>
                  </label>
                  <span className="text-[11px] text-indigo-700 font-medium">
                    Destilado esencial de 2-3 párrafos para repaso rápido antes del examen
                  </span>
                </div>

                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  placeholder="Pulsa 'Generar / Mejorar Formato Cornell IA' para sintetizar automáticamente la esencia de este tema..."
                  className="w-full text-xs p-3.5 bg-white border border-indigo-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y"
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

        {/* Pie de página persistente (oculto en Modo Lectura) */}
        {!showFocusedFreeReading && (
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
        )}

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
