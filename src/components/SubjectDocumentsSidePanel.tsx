import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Filter,
  BookOpen,
  Calendar,
  CheckCircle2,
  Plus,
  Upload,
  Clock,
  ChevronRight,
  FileCheck,
  Sparkles,
  Trash2,
  X,
  Edit3,
  Loader2,
  Layers,
  Check,
  Maximize2,
  MessageSquare,
} from 'lucide-react';
import {
  Subject,
  Topic,
  AttachedTopicFile,
  DocumentCategoryType,
  ImportedFileFormat,
  EditableKeyPoint,
  CornellNote,
  Flashcard,
  DocumentComment,
} from '../types';
import {
  detectImportedFileType,
  processImportedDocumentFile,
  calculateOrganizedPagesFromFiles,
  convertMarkdownAndImagesToRichHtml,
} from '../utils/documentParser';
import { TopicNotesModal } from './TopicNotesModal';
import { DocumentReadingModeOverlay } from './DocumentReadingModeOverlay';

export type DocumentFilterType =
  | 'all'
  | 'pdf'
  | 'teoria'
  | 'apuntes'
  | 'libro'
  | 'practicas'
  | 'resumen'
  | 'doc';

export interface NormalizedSubjectDocument {
  id: string;
  name: string;
  fileType: ImportedFileFormat;
  documentCategory: DocumentCategoryType;
  pageCount: number;
  pagesRead: number;
  remainingPages: number;
  scheduledDate?: string;
  topicId: string;
  topicTitle: string;
  topicStatus: Topic['status'];
  isSynthesized?: boolean;
  date: string;
  imageCount?: number;
  commentCount?: number;
  content?: string;
  summary?: string;
  keyPoints?: EditableKeyPoint[];
}

interface SubjectDocumentsSidePanelProps {
  subjects: Subject[];
  selectedSubject: Subject | null;
  onSelectSubject?: (subjectId: string) => void;
  onUpdateSubject: (updatedSubject: Subject) => void;
  onStartPomodoro?: (subjectId: string, topicId?: string) => void;
  onOpenProgramModal?: () => void;
  onLoadDemoData?: () => void;
  compactMode?: boolean;
}

const CATEGORY_LABELS: Record<DocumentCategoryType, { label: string; badgeClass: string }> = {
  teoria: {
    label: 'Teoría',
    badgeClass: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-950/50 dark:text-blue-300',
  },
  apuntes: {
    label: 'Apuntes',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  libro: {
    label: 'Libro / Manual',
    badgeClass: 'bg-purple-50 text-purple-700 ring-purple-600/15 dark:bg-purple-950/50 dark:text-purple-300',
  },
  practicas: {
    label: 'Prácticas',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-950/50 dark:text-amber-300',
  },
  resumen: {
    label: 'Resumen',
    badgeClass: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-950/50 dark:text-indigo-300',
  },
};

const FILE_FORMAT_BADGE: Record<ImportedFileFormat, { label: string; className: string }> = {
  pdf: {
    label: 'PDF',
    className: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300',
  },
  word: {
    label: 'WORD',
    className: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-300',
  },
  powerpoint: {
    label: 'PPTX',
    className: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950/50 dark:text-orange-300',
  },
  doc: {
    label: 'DOC',
    className: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/50 dark:text-sky-300',
  },
  text: {
    label: 'TXT',
    className: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
  },
  image: {
    label: 'IMG',
    className: 'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-950/50 dark:text-teal-300',
  },
};

function inferCategoryFromFileName(name: string, index: number): DocumentCategoryType {
  const lower = name.toLowerCase();
  if (lower.includes('atlas') || lower.includes('manual') || lower.includes('libro') || lower.includes('cap')) {
    return 'libro';
  }
  if (lower.includes('apunte') || lower.includes('magistral') || lower.includes('clase')) {
    return 'apuntes';
  }
  if (lower.includes('guion') || lower.includes('practic') || lower.includes('seminario') || lower.includes('ejercicio') || lower.includes('problema')) {
    return 'practicas';
  }
  if (lower.includes('resumen') || lower.includes('esquema') || lower.includes('tabla')) {
    return 'resumen';
  }
  const fallbackOrder: DocumentCategoryType[] = ['teoria', 'libro', 'apuntes', 'practicas', 'resumen'];
  return fallbackOrder[index % fallbackOrder.length];
}

export const SubjectDocumentsSidePanel: React.FC<SubjectDocumentsSidePanelProps> = ({
  subjects,
  selectedSubject,
  onSelectSubject,
  onUpdateSubject,
  onStartPomodoro,
  onOpenProgramModal,
  onLoadDemoData,
}) => {
  const [internalSubjectId, setInternalSubjectId] = useState<string>(
    selectedSubject?.id || subjects[0]?.id || ''
  );

  // Sincronizar materia activa cuando estamos dentro de SubjectDetailView o en la vista general de Asignaturas
  const activeSubject: Subject | null = useMemo(() => {
    if (selectedSubject) return selectedSubject;
    return subjects.find((s) => s.id === internalSubjectId) || subjects[0] || null;
  }, [selectedSubject, subjects, internalSubjectId]);

  const [activeTypeFilter, setActiveTypeFilter] = useState<DocumentFilterType>('all');
  const [onlyPendingFilter, setOnlyPendingFilter] = useState<boolean>(false);

  // Estado para importar o registrar nuevo PDF/Word/PowerPoint/documento
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [newDocName, setNewDocName] = useState<string>('');
  const [newDocCategory, setNewDocCategory] = useState<DocumentCategoryType>('teoria');
  const [newDocFileType, setNewDocFileType] = useState<ImportedFileFormat>('pdf');
  const [newDocTotalPages, setNewDocTotalPages] = useState<string>('20');
  const [newDocPagesRead, setNewDocPagesRead] = useState<string>('0');
  const [newDocTopicId, setNewDocTopicId] = useState<string>('');
  const [newDocScheduledDate, setNewDocScheduledDate] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [pendingExtractedFile, setPendingExtractedFile] = useState<AttachedTopicFile | null>(null);
  const [pendingExtractedFiles, setPendingExtractedFiles] = useState<AttachedTopicFile[]>([]);
  const [docSaveNotice, setDocSaveNotice] = useState<{
    message: string;
    topicId: string;
    docId?: string;
  } | null>(null);
  const [editingModalTarget, setEditingModalTarget] = useState<{
    topicId: string;
    docId?: string;
    openKeyPoints?: boolean;
  } | null>(null);
  const [readingModeDocId, setReadingModeDocId] = useState<string | null>(null);
  const [summarizingDocId, setSummarizingDocId] = useState<string | null>(null);
  const [expandedSummaryDocId, setExpandedSummaryDocId] = useState<string | null>(null);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  // Estado para analizar apuntes importados con IA y generar flashcards estructuradas (Concepto / Definición)
  const [generatingFlashcardsDocId, setGeneratingFlashcardsDocId] = useState<string | null>(null);
  const [activeFlashcardsDocId, setActiveFlashcardsDocId] = useState<string | null>(null);
  const [generatedDocFlashcards, setGeneratedDocFlashcards] = useState<
    Array<{
      id: string;
      concept: string;
      definition: string;
      hint: string;
      conceptTag: string;
      selected: boolean;
    }>
  >([]);
  const [flashcardsTargetSubjectId, setFlashcardsTargetSubjectId] = useState<string>('');
  const [flashcardsSaveNotice, setFlashcardsSaveNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingExtractedFilesRef = useRef<AttachedTopicFile[]>([]);
  const extractionPromiseRef = useRef<Promise<AttachedTopicFile[]> | null>(null);

  // Decorador de trazabilidad para verificar la estructura exacta del objeto Subject y metadatos de archivos enviados a onUpdateSubject
  const withSubjectUpdateLogging = (
    actionLabel: string,
    updatedSubject: Subject,
    localFileStateSnapshot?: Record<string, unknown>
  ) => {
    const mappedTopicsDiagnostic = (updatedSubject.topics || []).map((t) => ({
      topicId: t.id,
      title: t.title,
      pageCount: t.pageCount,
      pagesRead: t.pagesRead,
      notesLength: t.notes?.length || 0,
      attachedFilesCount: t.attachedFiles?.length || 0,
      attachedFilesMetadata: (t.attachedFiles || []).map((f) => ({
        id: f.id,
        name: f.name,
        fileType: f.fileType,
        documentCategory: f.documentCategory,
        pageCount: f.pageCount,
        pagesRead: f.pagesRead,
        scheduledDate: f.scheduledDate,
        includeInOrganization: f.includeInOrganization,
        contentLength: f.content?.length || 0,
        richHtmlContentLength: f.richHtmlContent?.length || 0,
        extractedImagesCount: f.extractedImages?.length || 0,
        date: f.date,
      })),
    }));

    console.group(`[SubjectDocumentsSidePanel :: Trace] ${actionLabel}`);
    if (localFileStateSnapshot) {
      console.log('1. Local State Snapshot (before mapping):', localFileStateSnapshot);
    }
    console.log('2. Mapped Topics & attachedFiles Metadata:', mappedTopicsDiagnostic);
    console.log('3. Exact Subject Object Structure sent to onUpdateSubject:', updatedSubject);
    console.groupEnd();

    onUpdateSubject(updatedSubject);
  };

  // Sincronizar siempre el tema destino del formulario cuando cambia la asignatura activa
  React.useEffect(() => {
    if (!activeSubject) return;
    setNewDocTopicId((prev) => {
      if (prev === '__new__') return prev;
      if (prev && activeSubject.topics.some((t) => t.id === prev)) return prev;
      return activeSubject.topics[0]?.id || '';
    });
  }, [activeSubject?.id, activeSubject?.topics]);

  // Construye la lista normalizada de documentos PDF/importados de la asignatura activa
  const allSubjectDocuments: NormalizedSubjectDocument[] = useMemo(() => {
    if (!activeSubject) return [];

    const docs: NormalizedSubjectDocument[] = [];

    activeSubject.topics.forEach((topic, tIdx) => {
      if (topic.attachedFiles && topic.attachedFiles.length > 0) {
        topic.attachedFiles.forEach((file, fIdx) => {
          const total = Math.max(1, file.pageCount || topic.pageCount || 12);
          const defaultRead =
            file.pagesRead !== undefined
              ? file.pagesRead
              : topic.status === 'estudiado' || topic.status === 'repasado'
              ? total
              : topic.pagesRead !== undefined
              ? Math.min(total, topic.pagesRead)
              : 0;
          const read = Math.min(total, Math.max(0, defaultRead));
          const remaining = Math.max(0, total - read);

          docs.push({
            id: file.id,
            name: file.name,
            fileType: file.fileType || 'pdf',
            documentCategory:
              file.documentCategory || inferCategoryFromFileName(file.name, tIdx + fIdx),
            pageCount: total,
            pagesRead: read,
            remainingPages: remaining,
            scheduledDate: file.scheduledDate || topic.scheduledDate || topic.nextReviewDate,
            topicId: topic.id,
            topicTitle: topic.title,
            topicStatus: topic.status,
            isSynthesized: false,
            date: file.date,
            imageCount: file.extractedImages?.length || 0,
            commentCount: file.comments?.length || 0,
            content: file.content || topic.notes || topic.description || '',
            summary: file.summary || topic.summary,
            keyPoints:
              file.keyPoints && file.keyPoints.length > 0
                ? file.keyPoints
                : topic.keyPoints,
          });
        });
      } else {
        // Si un tema tiene páginas configuradas (o existe en el temario sin archivo explícito),
        // generamos su documento PDF asociado para que el usuario vea siempre el desglose de páginas restantes
        const total = Math.max(1, topic.pageCount || topic.paginasTotales || 16);
        const read =
          topic.pagesRead !== undefined
            ? Math.min(total, Math.max(0, topic.pagesRead))
            : topic.status === 'estudiado' || topic.status === 'repasado'
            ? total
            : topic.status === 'en_progreso'
            ? Math.round(total * 0.35)
            : 0;
        const remaining = Math.max(0, total - read);
        const safeSlug = topic.title
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 38);

        docs.push({
          id: `synth-doc-${topic.id}`,
          name: `T${tIdx + 1}_${safeSlug || 'Tema'}.pdf`,
          fileType: 'pdf',
          documentCategory: inferCategoryFromFileName(topic.title, tIdx),
          pageCount: total,
          pagesRead: read,
          remainingPages: remaining,
          scheduledDate: topic.scheduledDate || topic.nextReviewDate,
          topicId: topic.id,
          topicTitle: topic.title,
          topicStatus: topic.status,
          isSynthesized: true,
          date: topic.studiedAt || new Date().toISOString(),
          commentCount: topic.generalComments?.length || 0,
          content: topic.notes || topic.description || `Contenido académico del tema ${topic.title}`,
          summary: topic.summary,
          keyPoints: topic.keyPoints,
        });
      }
    });

    return docs;
  }, [activeSubject]);

  // Filtrado por tipo de documento y estado de lectura
  const filteredDocuments = useMemo(() => {
    return allSubjectDocuments.filter((doc) => {
      if (onlyPendingFilter && doc.remainingPages === 0) return false;
      if (activeTypeFilter === 'all') return true;
      if (activeTypeFilter === 'pdf') return doc.fileType === 'pdf';
      if (activeTypeFilter === 'doc') return doc.fileType === 'doc' || doc.fileType === 'text';
      return doc.documentCategory === activeTypeFilter;
    });
  }, [allSubjectDocuments, activeTypeFilter, onlyPendingFilter]);

  // Métricas globales de lectura para el estudio programado de la materia
  const readingMetrics = useMemo(() => {
    const totalPages = allSubjectDocuments.reduce((acc, d) => acc + d.pageCount, 0);
    const totalRead = allSubjectDocuments.reduce((acc, d) => acc + d.pagesRead, 0);
    const totalRemaining = Math.max(0, totalPages - totalRead);
    const progressPct = totalPages > 0 ? Math.round((totalRead / totalPages) * 100) : 0;

    // Documentos con estudio programado pendiente
    const scheduledPendingDocs = allSubjectDocuments.filter(
      (d) => d.remainingPages > 0 && d.scheduledDate
    );
    const nextScheduledDate = scheduledPendingDocs
      .map((d) => d.scheduledDate!)
      .sort()[0];

    return {
      totalPages,
      totalRead,
      totalRemaining,
      progressPct,
      pendingDocsCount: allSubjectDocuments.filter((d) => d.remainingPages > 0).length,
      nextScheduledDate,
    };
  }, [allSubjectDocuments]);

  // Actualizar páginas leídas de un documento (y sincronizar con el tema)
  const handleUpdateDocumentPagesRead = (
    doc: NormalizedSubjectDocument,
    nextPagesReadRaw: number
  ) => {
    if (!activeSubject) return;
    const clampedRead = Math.min(doc.pageCount, Math.max(0, nextPagesReadRaw));

    const updatedTopics = activeSubject.topics.map((topic) => {
      if (topic.id !== doc.topicId) return topic;

      let updatedAttachedFiles: AttachedTopicFile[];
      if (topic.attachedFiles && topic.attachedFiles.length > 0 && !doc.isSynthesized) {
        updatedAttachedFiles = topic.attachedFiles.map((f) =>
          f.id === doc.id ? { ...f, pagesRead: clampedRead } : f
        );
      } else {
        // Persistir documento sintetizado como AttachedTopicFile real
        updatedAttachedFiles = [
          {
            id: doc.isSynthesized ? `doc-${topic.id}` : doc.id,
            name: doc.name,
            fileType: doc.fileType,
            documentCategory: doc.documentCategory,
            pageCount: doc.pageCount,
            pagesRead: clampedRead,
            scheduledDate: doc.scheduledDate,
            includeInOrganization: true,
            content: topic.notes || topic.description || '',
            date: doc.date,
          },
        ];
      }

      const sumTotalPages = updatedAttachedFiles.reduce((acc, f) => acc + (f.pageCount || 0), 0);
      const sumReadPages = updatedAttachedFiles.reduce((acc, f) => acc + (f.pagesRead || 0), 0);

      let nextStatus = topic.status;
      if (sumReadPages >= sumTotalPages && sumTotalPages > 0) {
        nextStatus = topic.status === 'repasado' ? 'repasado' : 'estudiado';
      } else if (sumReadPages > 0 && topic.status === 'pendiente') {
        nextStatus = 'en_progreso';
      }

      return {
        ...topic,
        attachedFiles: updatedAttachedFiles,
        pageCount: sumTotalPages,
        pagesRead: sumReadPages,
        status: nextStatus,
      };
    });

    onUpdateSubject({
      ...activeSubject,
      topics: updatedTopics,
    });
  };

  // Eliminar un documento importado
  const handleDeleteDocument = (doc: NormalizedSubjectDocument) => {
    if (!activeSubject) return;
    const updatedTopics = activeSubject.topics.map((topic) => {
      if (topic.id !== doc.topicId) return topic;
      const nextFiles = (topic.attachedFiles || []).filter((f) => f.id !== doc.id);
      return {
        ...topic,
        attachedFiles: nextFiles,
      };
    });

    onUpdateSubject({
      ...activeSubject,
      topics: updatedTopics,
    });
  };

  // Guardar resaltados, texto enriquecido y notas rápidas desde la vista de Modo Lectura a pantalla completa
  const handleSaveDocumentReadingChanges = (
    doc: NormalizedSubjectDocument,
    updates: {
      markdownContent: string;
      richHtmlContent: string;
      comments: DocumentComment[];
      pagesRead?: number;
    }
  ) => {
    if (!activeSubject) return;
    const nowIso = new Date().toISOString();

    const updatedTopics = activeSubject.topics.map((topic) => {
      if (topic.id !== doc.topicId) return topic;

      const resolvedPagesRead =
        updates.pagesRead !== undefined
          ? Math.min(doc.pageCount, Math.max(0, updates.pagesRead))
          : doc.pagesRead;

      let updatedAttachedFiles: AttachedTopicFile[];
      if (topic.attachedFiles && topic.attachedFiles.length > 0 && !doc.isSynthesized) {
        updatedAttachedFiles = topic.attachedFiles.map((f) =>
          f.id === doc.id
            ? {
                ...f,
                content: updates.markdownContent,
                richHtmlContent: updates.richHtmlContent,
                comments: updates.comments,
                pagesRead: resolvedPagesRead,
                lastEditedAt: nowIso,
              }
            : f
        );
      } else {
        const persistedId = doc.isSynthesized ? `doc-${topic.id}` : doc.id;
        updatedAttachedFiles = [
          {
            id: persistedId,
            name: doc.name,
            fileType: doc.fileType,
            documentCategory: doc.documentCategory,
            pageCount: doc.pageCount,
            pagesRead: resolvedPagesRead,
            scheduledDate: doc.scheduledDate,
            includeInOrganization: true,
            content: updates.markdownContent,
            richHtmlContent: updates.richHtmlContent,
            comments: updates.comments,
            date: doc.date || nowIso,
            lastEditedAt: nowIso,
          },
        ];
      }

      const sumTotalPages = updatedAttachedFiles.reduce((acc, f) => acc + (f.pageCount || 0), 0);
      const sumReadPages = updatedAttachedFiles.reduce((acc, f) => acc + (f.pagesRead || 0), 0);

      let nextStatus = topic.status;
      if (sumReadPages >= sumTotalPages && sumTotalPages > 0) {
        nextStatus = topic.status === 'repasado' ? 'repasado' : 'estudiado';
      } else if (sumReadPages > 0 && topic.status === 'pendiente') {
        nextStatus = 'en_progreso';
      }

      return {
        ...topic,
        attachedFiles: updatedAttachedFiles,
        pageCount: sumTotalPages,
        paginasTotales: sumTotalPages,
        pagesRead: sumReadPages,
        status: nextStatus,
        notes:
          updatedAttachedFiles.length === 1
            ? updates.markdownContent
            : topic.notes || updates.markdownContent,
        generalNotes:
          updatedAttachedFiles.length === 1
            ? updates.markdownContent
            : topic.generalNotes || updates.markdownContent,
        richGeneralNotes:
          updatedAttachedFiles.length === 1
            ? updates.richHtmlContent
            : topic.richGeneralNotes || updates.richHtmlContent,
        generalComments: updates.comments,
        lastNotesUpdatedAt: nowIso,
      };
    });

    onUpdateSubject({
      ...activeSubject,
      topics: updatedTopics,
    });

    if (doc.isSynthesized) {
      setReadingModeDocId(`doc-${doc.topicId}`);
    }
  };

  // Generar resumen automático con IA y convertirlo en puntos clave editables en la vista de apuntes
  const handleGenerateDocumentSummaryAndKeyPoints = async (
    doc: NormalizedSubjectDocument,
    openInNotesAfter: boolean = false
  ) => {
    if (!activeSubject) return;
    setSummarizingDocId(doc.id);
    setAiSummaryError(null);

    try {
      const targetTopic = activeSubject.topics.find((t) => t.id === doc.topicId);
      const rawContent =
        doc.content ||
        targetTopic?.notes ||
        targetTopic?.description ||
        `Documento académico "${doc.name}" del tema "${doc.topicTitle}" en la asignatura "${activeSubject.name}".`;

      let generatedSummary = '';
      let generatedKeyPoints: EditableKeyPoint[] = [];
      let generatedCues: string[] = [];

      const response = await fetch('/api/gemini/summarize-document-keypoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: doc.name,
          documentContent: rawContent,
          topicTitle: doc.topicTitle,
          subjectName: activeSubject.name,
        }),
      });

      if (response.ok) {
        const resJson = await response.json();
        const data = resJson.data || resJson;
        generatedSummary =
          data.summary || `Resumen sintético generado con IA para ${doc.name}.`;
        generatedKeyPoints = Array.isArray(data.keyPoints)
          ? data.keyPoints.map((kp: any, idx: number) => ({
              id: `kp-${Date.now()}-${idx}`,
              title: String(kp.title || `Punto clave ${idx + 1}`),
              detail: String(kp.detail || ''),
              category: kp.category ? String(kp.category) : doc.documentCategory,
              importance:
                kp.importance === 'alta' || kp.importance === 'baja'
                  ? kp.importance
                  : 'media',
              sourceDocName: doc.name,
            }))
          : [];
        generatedCues = Array.isArray(data.cues)
          ? data.cues.map((c: any) => String(c))
          : [];
      } else {
        // Fallback estructurado local si el endpoint devuelve error
        generatedSummary = `Síntesis ejecutiva de ${doc.name} (${doc.topicTitle}): recoge los fundamentos teóricos, conceptos críticos de examen y relaciones clave de ${activeSubject.name}.`;
        generatedKeyPoints = [
          {
            id: `kp-${Date.now()}-1`,
            title: `Concepto central de ${doc.topicTitle}`,
            detail: `Definición y estructura principal extraída de ${doc.name} (${doc.pageCount} págs.).`,
            category: 'Concepto',
            importance: 'alta',
            sourceDocName: doc.name,
          },
          {
            id: `kp-${Date.now()}-2`,
            title: `Desarrollo y mecanismos clave`,
            detail: `Puntos esenciales para dominar la materia y resolver preguntas de evaluación.`,
            category: 'Desarrollo',
            importance: 'alta',
            sourceDocName: doc.name,
          },
          {
            id: `kp-${Date.now()}-3`,
            title: `Aplicación práctica y repaso activo`,
            detail: `Casos tipo y criterios de resolución vinculados al estudio programado.`,
            category: 'Práctica',
            importance: 'media',
            sourceDocName: doc.name,
          },
        ];
      }

      const nowIso = new Date().toISOString();
      const persistedDocId = doc.isSynthesized ? `doc-${doc.topicId}` : doc.id;

      // Formatear bloque markdown de puntos clave para enriquecer los apuntes si estaban vacíos o breves
      const keyPointsMarkdownBlock = [
        `### ✨ Puntos Clave IA (${doc.name})`,
        `**Resumen ejecutivo:** ${generatedSummary}`,
        '',
        ...generatedKeyPoints.map(
          (kp, idx) =>
            `${idx + 1}. **[${(kp.importance || 'media').toUpperCase()}] ${kp.title}:** ${kp.detail}`
        ),
      ].join('\n');

      const updatedTopics = activeSubject.topics.map((topic) => {
        if (topic.id !== doc.topicId) return topic;

        // Combinar puntos clave de otros documentos del tema + los nuevos de este documento
        const otherKeyPoints = (topic.keyPoints || []).filter(
          (kp) => kp.sourceDocName !== doc.name
        );
        const mergedKeyPoints = [...generatedKeyPoints, ...otherKeyPoints];

        let updatedAttachedFiles: AttachedTopicFile[];
        if (topic.attachedFiles && topic.attachedFiles.length > 0 && !doc.isSynthesized) {
          updatedAttachedFiles = topic.attachedFiles.map((f) =>
            f.id === doc.id
              ? {
                  ...f,
                  summary: generatedSummary,
                  keyPoints: generatedKeyPoints,
                }
              : f
          );
        } else {
          updatedAttachedFiles = [
            {
              id: persistedDocId,
              name: doc.name,
              fileType: doc.fileType,
              documentCategory: doc.documentCategory,
              pageCount: doc.pageCount,
              pagesRead: doc.pagesRead,
              scheduledDate: doc.scheduledDate,
              includeInOrganization: true,
              content: rawContent,
              date: doc.date,
              summary: generatedSummary,
              keyPoints: generatedKeyPoints,
            },
          ];
        }

        const existingCues = topic.cues || [];
        const mergedCues = Array.from(new Set([...existingCues, ...generatedCues])).slice(
          0,
          12
        );

        const baseNotes = topic.notes || topic.description || '';
        const updatedNotesText = baseNotes.includes(`### ✨ Puntos Clave IA (${doc.name})`)
          ? baseNotes
          : `${baseNotes.trim()}\n\n${keyPointsMarkdownBlock}`.trim();

        return {
          ...topic,
          attachedFiles: updatedAttachedFiles,
          summary: generatedSummary,
          keyPoints: mergedKeyPoints,
          cues: mergedCues.length > 0 ? mergedCues : topic.cues,
          notes: updatedNotesText,
          generalNotes: updatedNotesText,
          lastNotesUpdatedAt: nowIso,
        };
      });

      // Sincronizar también con los apuntes Cornell de la asignatura para que aparezcan en la vista de Apuntes
      const targetUpdatedTopic = updatedTopics.find((t) => t.id === doc.topicId);
      const updatedCornellNotes: CornellNote[] = [...(activeSubject.cornellNotes || [])];
      const existingCornellIdx = updatedCornellNotes.findIndex(
        (n) => n.topicId === doc.topicId
      );

      if (existingCornellIdx >= 0 && targetUpdatedTopic) {
        updatedCornellNotes[existingCornellIdx] = {
          ...updatedCornellNotes[existingCornellIdx],
          summary: generatedSummary,
          keyPoints: targetUpdatedTopic.keyPoints,
          cues: targetUpdatedTopic.cues || updatedCornellNotes[existingCornellIdx].cues,
          notes: targetUpdatedTopic.notes || updatedCornellNotes[existingCornellIdx].notes,
          updatedAt: nowIso,
        };
      } else if (targetUpdatedTopic) {
        updatedCornellNotes.push({
          id: `cn-${Date.now()}`,
          topicId: doc.topicId,
          title: targetUpdatedTopic.title,
          sourceType: 'ocr_pdf',
          cues: targetUpdatedTopic.cues || generatedCues,
          notes: targetUpdatedTopic.notes || keyPointsMarkdownBlock,
          summary: generatedSummary,
          keyPoints: targetUpdatedTopic.keyPoints,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      onUpdateSubject({
        ...activeSubject,
        topics: updatedTopics,
        cornellNotes: updatedCornellNotes,
      });

      setExpandedSummaryDocId(doc.id);

      if (openInNotesAfter) {
        setEditingModalTarget({
          topicId: doc.topicId,
          docId: persistedDocId,
          openKeyPoints: true,
        });
      }
    } catch (err: any) {
      console.error('Error al resumir documento con IA:', err);
      setAiSummaryError(
        err?.message || 'No se pudo generar el resumen IA en este momento.'
      );
    } finally {
      setSummarizingDocId(null);
    }
  };

  // Analizar contenido de los apuntes importados con IA para generar flashcards estructuradas (Concepto y Definición)
  const handleGenerateDocumentFlashcards = async (doc: NormalizedSubjectDocument) => {
    if (!activeSubject) return;
    setGeneratingFlashcardsDocId(doc.id);
    setAiSummaryError(null);
    setFlashcardsSaveNotice(null);

    try {
      const targetTopic = activeSubject.topics.find((t) => t.id === doc.topicId);
      const rawContent =
        doc.content ||
        targetTopic?.notes ||
        targetTopic?.description ||
        `Apuntes importados del archivo "${doc.name}" sobre el tema "${doc.topicTitle}" de la asignatura "${activeSubject.name}".`;

      const response = await fetch('/api/gemini/generate-document-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: doc.name,
          documentContent: rawContent,
          topicTitle: doc.topicTitle,
          subjectName: activeSubject.name,
          count: 6,
        }),
      });

      let structuredCards: Array<{
        id: string;
        concept: string;
        definition: string;
        hint: string;
        conceptTag: string;
        selected: boolean;
      }> = [];

      if (response.ok) {
        const resData = await response.json();
        const rawList = Array.isArray(resData.flashcards)
          ? resData.flashcards
          : Array.isArray(resData.data)
          ? resData.data
          : [];

        structuredCards = rawList.map((item: any, idx: number) => ({
          id: `doc-fc-${Date.now()}-${idx}`,
          concept: String(item.concept || item.question || `Concepto ${idx + 1} (${doc.topicTitle})`),
          definition: String(
            item.definition ||
              item.answer ||
              `Definición fundamental extraída de ${doc.name}.`
          ),
          hint: String(item.hint || `Revisa el apartado principal en ${doc.name}`),
          conceptTag: String(item.conceptTag || doc.topicTitle || activeSubject.name),
          selected: true,
        }));
      }

      // Fallback estructurado si la respuesta llega vacía
      if (structuredCards.length === 0) {
        const kpSource = doc.keyPoints && doc.keyPoints.length > 0 ? doc.keyPoints : [];
        if (kpSource.length > 0) {
          structuredCards = kpSource.map((kp, idx) => ({
            id: `doc-fc-${Date.now()}-${idx}`,
            concept: kp.title,
            definition: kp.detail,
            hint: `Categoría: ${kp.category || 'Concepto clave'} · ${doc.name}`,
            conceptTag: doc.topicTitle,
            selected: true,
          }));
        } else {
          structuredCards = [
            {
              id: `doc-fc-${Date.now()}-1`,
              concept: `Definición nuclear de ${doc.topicTitle}`,
              definition: `Principio fundamental desarrollado en "${doc.name}" que establece las bases teóricas y operativas del tema en ${activeSubject.name}.`,
              hint: `Primer bloque conceptual de ${doc.name}`,
              conceptTag: doc.topicTitle,
              selected: true,
            },
            {
              id: `doc-fc-${Date.now()}-2`,
              concept: `Mecanismo y estructura clave (${doc.topicTitle})`,
              definition: `Relación funcional entre los componentes principales descritos en los apuntes importados (${doc.pageCount} págs.) y su impacto en problemas de examen.`,
              hint: `Esquema central del documento`,
              conceptTag: doc.topicTitle,
              selected: true,
            },
            {
              id: `doc-fc-${Date.now()}-3`,
              concept: `Criterio de aplicación práctica en ${activeSubject.name}`,
              definition: `Condiciones y reglas técnicas bajo las cuales se aplica la teoría de "${doc.topicTitle}" en supuestos prácticos y evaluación.`,
              hint: `Conclusión operativa de ${doc.name}`,
              conceptTag: doc.topicTitle,
              selected: true,
            },
          ];
        }
      }

      setGeneratedDocFlashcards(structuredCards);
      setActiveFlashcardsDocId(doc.id);
      setFlashcardsTargetSubjectId(activeSubject.id);
    } catch (err: any) {
      console.error('Error al generar flashcards desde documento:', err);
      setAiSummaryError(
        err?.message || 'Error al analizar los apuntes para generar flashcards con IA.'
      );
    } finally {
      setGeneratingFlashcardsDocId(null);
    }
  };

  // Guardar las flashcards estructuradas (Concepto y Definición) directamente en la asignatura correspondiente
  const handleSaveGeneratedFlashcardsToSubject = (doc: NormalizedSubjectDocument) => {
    const selectedDrafts = generatedDocFlashcards.filter((c) => c.selected);
    if (selectedDrafts.length === 0) return;

    const targetSubject =
      subjects.find((s) => s.id === flashcardsTargetSubjectId) || activeSubject;
    if (!targetSubject) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const resolvedTopicId =
      targetSubject.id === activeSubject?.id
        ? doc.topicId
        : targetSubject.topics[0]?.id;

    const newFlashcards: Flashcard[] = selectedDrafts.map((draft, idx) => ({
      id: `fc-doc-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      topicId: resolvedTopicId,
      concept: draft.concept.trim(),
      definition: draft.definition.trim(),
      question: draft.concept.trim(),
      answer: draft.definition.trim(),
      hint: draft.hint.trim() || undefined,
      conceptTag: draft.conceptTag.trim() || doc.topicTitle || targetSubject.name,
      sourceDocName: doc.name,
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      nextReview: todayStr,
    }));

    const updatedTopics = targetSubject.topics.map((t) =>
      t.id === resolvedTopicId
        ? {
            ...t,
            enabledResources: {
              ...(t.enabledResources || {}),
              flashcards: true,
            },
          }
        : t
    );

    onUpdateSubject({
      ...targetSubject,
      topics: updatedTopics,
      flashcards: [...(targetSubject.flashcards || []), ...newFlashcards],
    });

    setFlashcardsSaveNotice(
      `¡${newFlashcards.length} flashcards (Concepto/Definición) guardadas en ${targetSubject.name}!`
    );
    setActiveFlashcardsDocId(null);
    setGeneratedDocFlashcards([]);
    setTimeout(() => setFlashcardsSaveNotice(null), 4500);
  };

  // Seleccionar uno o varios archivos PDF / Word / PowerPoint / Imagen desde el equipo y extraer todo su texto e imágenes a editable
  const handleFileUploadSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !activeSubject) return;

    const files = Array.from(fileList);
    setIsReadingFile(true);
    setDocSaveNotice(null);

    const firstFile = files[0];
    const detectedType = detectImportedFileType(firstFile);
    setNewDocName(
      files.length === 1
        ? firstFile.name
        : `${firstFile.name} (+${files.length - 1} más)`
    );
    setNewDocFileType(detectedType);
    setNewDocCategory(inferCategoryFromFileName(firstFile.name, 0));

    const targetTopic =
      activeSubject.topics.find((t) => t.id === newDocTopicId) ||
      activeSubject.topics[0];

    const extractionTask = (async (): Promise<AttachedTopicFile[]> => {
      const extractedFilesList: AttachedTopicFile[] = [];
      let totalPagesDetected = 0;

      for (const file of files) {
        const extractedResult = await processImportedDocumentFile(
          file,
          targetTopic ? targetTopic.title : file.name,
          activeSubject.name
        );
        extractedFilesList.push(extractedResult.attachedFile);
        totalPagesDetected += Math.max(1, extractedResult.attachedFile.pageCount || 1);
      }

      pendingExtractedFilesRef.current = extractedFilesList;
      setPendingExtractedFiles(extractedFilesList);
      setPendingExtractedFile(extractedFilesList[0] || null);
      setNewDocTotalPages(String(Math.max(1, totalPagesDetected)));
      setNewDocPagesRead('0');

      console.log('[SubjectDocumentsSidePanel] Extracted PDF file(s) ready to save:', {
        count: extractedFilesList.length,
        files: extractedFilesList.map((f) => ({
          id: f.id,
          name: f.name,
          pageCount: f.pageCount,
          contentLength: f.content?.length || 0,
        })),
      });

      return extractedFilesList;
    })();

    extractionPromiseRef.current = extractionTask;

    try {
      await extractionTask;
    } catch (err) {
      console.warn('Error extrayendo archivo en panel lateral:', err);
    } finally {
      extractionPromiseRef.current = null;
      setIsReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Guardar nuevo(s) documento(s) PDF/Word/PowerPoint importado(s) en la asignatura
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject) return;

    // Si aún se está procesando un PDF subido cuando el usuario pulsa Guardar, esperar a que termine para no perder sus datos
    let awaitedExtracted: AttachedTopicFile[] = [];
    if (extractionPromiseRef.current) {
      try {
        awaitedExtracted = await extractionPromiseRef.current;
      } catch {
        // ignore
      }
    }

    const filesToSaveSource =
      awaitedExtracted.length > 0
        ? awaitedExtracted
        : pendingExtractedFilesRef.current.length > 0
        ? pendingExtractedFilesRef.current
        : pendingExtractedFiles.length > 0
        ? pendingExtractedFiles
        : pendingExtractedFile
        ? [pendingExtractedFile]
        : [];

    if (filesToSaveSource.length === 0 && !newDocName.trim()) return;

    const totalPagesInput = Math.max(1, parseInt(newDocTotalPages, 10) || 15);
    const readPagesInput = Math.min(totalPagesInput, Math.max(0, parseInt(newDocPagesRead, 10) || 0));

    const extForType =
      newDocFileType === 'word' || newDocFileType === 'doc'
        ? 'docx'
        : newDocFileType === 'powerpoint'
        ? 'pptx'
        : newDocFileType === 'text'
        ? 'txt'
        : 'pdf';

    const scheduled =
      newDocScheduledDate ||
      new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

    const preparedFiles: AttachedTopicFile[] =
      filesToSaveSource.length > 0
        ? filesToSaveSource.map((extracted, idx) => {
            const singleCustomName =
              filesToSaveSource.length === 1 && newDocName.trim()
                ? newDocName.trim().includes('.')
                  ? newDocName.trim()
                  : `${newDocName.trim()}.${extForType}`
                : extracted.name;
            const filePages =
              filesToSaveSource.length === 1
                ? totalPagesInput
                : Math.max(1, extracted.pageCount || 1);
            const fileRead =
              filesToSaveSource.length === 1
                ? readPagesInput
                : Math.min(filePages, extracted.pagesRead || 0);
            return {
              ...extracted,
              id: extracted.id || `doc-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              name: singleCustomName,
              fileType: filesToSaveSource.length === 1 ? newDocFileType : extracted.fileType || newDocFileType,
              documentCategory: newDocCategory,
              pageCount: filePages,
              pagesRead: fileRead,
              scheduledDate: scheduled,
              includeInOrganization: true,
              content: extracted.content || '',
              richHtmlContent:
                extracted.richHtmlContent ||
                convertMarkdownAndImagesToRichHtml(
                  extracted.content || '',
                  extracted.extractedImages || []
                ),
            };
          })
        : [
            {
              id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: newDocName.trim().includes('.')
                ? newDocName.trim()
                : `${newDocName.trim()}.${extForType}`,
              fileType: newDocFileType,
              documentCategory: newDocCategory,
              pageCount: totalPagesInput,
              pagesRead: readPagesInput,
              scheduledDate: scheduled,
              includeInOrganization: true,
              content: `# ${newDocName.trim()}\n\nDocumento importado (${totalPagesInput} páginas). Puedes editar, subrayar, añadir comentarios o insertar imágenes aquí.`,
              date: new Date().toISOString(),
            },
          ];

    const createNewTopicPerFile =
      newDocTopicId === '__new__' || activeSubject.topics.length === 0;
    const matchedTopic =
      !createNewTopicPerFile
        ? activeSubject.topics.find((t) => t.id === newDocTopicId) || activeSubject.topics[0]
        : undefined;
    const targetTopicId = matchedTopic ? matchedTopic.id : '';

    let savedTopicId = targetTopicId;
    const lastSavedFile = preparedFiles[preparedFiles.length - 1];

    if (targetTopicId && matchedTopic) {
      const updatedTopics = activeSubject.topics.map((topic) => {
        if (topic.id !== targetTopicId) return topic;
        const existingFiles = topic.attachedFiles || [];
        const existingIds = new Set(existingFiles.map((f) => f.id));
        const deduplicatedNew = preparedFiles.filter((f) => !existingIds.has(f.id));
        const nextFiles =
          deduplicatedNew.length > 0
            ? [...existingFiles, ...deduplicatedNew]
            : existingFiles.map((ef) => {
                const updatedMatch = preparedFiles.find((pf) => pf.id === ef.id);
                return updatedMatch ? { ...ef, ...updatedMatch } : ef;
              });
        const sumTotal = nextFiles.reduce((acc, f) => acc + (f.pageCount || 0), 0);
        const sumRead = nextFiles.reduce((acc, f) => acc + (f.pagesRead || 0), 0);

        const appendedContent = preparedFiles
          .map((f) => `## ${f.name} (${f.pageCount} págs.)\n\n${f.content}`)
          .join('\n\n---\n\n');

        const isTopicNotesDefault =
          !topic.notes || topic.notes.trim() === (topic.description || '').trim();
        const nextNotes = isTopicNotesDefault
          ? preparedFiles.length === 1
            ? preparedFiles[0].content
            : appendedContent
          : `${topic.notes!.trim()}\n\n${appendedContent}`.trim();

        const newImages = preparedFiles.flatMap((f) => f.extractedImages || []);
        const combinedImages = [...(topic.generalImages || []), ...newImages];

        const nextRich =
          isTopicNotesDefault && preparedFiles.length === 1 && preparedFiles[0].richHtmlContent
            ? preparedFiles[0].richHtmlContent
            : convertMarkdownAndImagesToRichHtml(nextNotes, combinedImages);

        return {
          ...topic,
          attachedFiles: nextFiles,
          pageCount: sumTotal,
          paginasTotales: sumTotal,
          pagesRead: sumRead,
          scheduledDate: topic.scheduledDate || lastSavedFile.scheduledDate,
          notes: nextNotes,
          generalNotes: nextNotes,
          richGeneralNotes: nextRich,
          generalImages: combinedImages,
          lastNotesUpdatedAt: new Date().toISOString(),
        };
      });

      // Sync or create CornellNote for the updated topic
      const updatedTopicObj = updatedTopics.find((t) => t.id === targetTopicId);
      const existingCornell = (activeSubject.cornellNotes || []).find(
        (n) => n.topicId === targetTopicId
      );
      const updatedCornellNotes = existingCornell
        ? (activeSubject.cornellNotes || []).map((n) =>
            n.id === existingCornell.id
              ? {
                  ...n,
                  notes: updatedTopicObj?.notes || n.notes,
                  updatedAt: new Date().toISOString(),
                }
              : n
          )
        : [
            ...(activeSubject.cornellNotes || []),
            {
              id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              topicId: targetTopicId,
              title: updatedTopicObj?.title || lastSavedFile.name,
              cues: ['Conceptos clave', 'Puntos importantes'],
              notes: updatedTopicObj?.notes || lastSavedFile.content,
              summary: `Apuntes importados de ${preparedFiles.map((f) => f.name).join(', ')}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sourceType: 'ocr_pdf' as const,
            },
          ];

      const updatedSubjectPayload: Subject = {
        ...activeSubject,
        topics: updatedTopics,
        cornellNotes: updatedCornellNotes,
      };

      withSubjectUpdateLogging(
        'Save Button (handleAddDocument - Existing Topic)',
        updatedSubjectPayload,
        {
          newDocName,
          newDocCategory,
          newDocFileType,
          newDocTotalPages,
          newDocPagesRead,
          newDocTopicId,
          targetTopicId,
          newDocScheduledDate,
          pendingExtractedFilesStateCount: pendingExtractedFiles.length,
          pendingExtractedFilesRefCount: pendingExtractedFilesRef.current.length,
          preparedFiles,
        }
      );
    } else {
      const createdTopics: Topic[] = preparedFiles.map((fileItem, idx) => {
        const newTopicId = `top-${Date.now()}-${idx}`;
        if (idx === preparedFiles.length - 1) {
          savedTopicId = newTopicId;
        }
        const fPages = Math.max(1, fileItem.pageCount || 1);
        const fRead = Math.min(fPages, fileItem.pagesRead || 0);
        return {
          id: newTopicId,
          title: fileItem.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          description: `Tema creado a partir del documento importado ${fileItem.name}`,
          notes: fileItem.content,
          generalNotes: fileItem.content,
          richGeneralNotes:
            fileItem.richHtmlContent ||
            convertMarkdownAndImagesToRichHtml(fileItem.content, fileItem.extractedImages || []),
          generalImages: fileItem.extractedImages || [],
          subtopics: [],
          difficulty: 'Media',
          pageCount: fPages,
          paginasTotales: fPages,
          pagesRead: fRead,
          estimatedHours: Math.max(1, Math.round(((fPages * 7) / 60) * 10) / 10),
          actualHoursSpent: 0,
          status: fRead >= fPages ? 'estudiado' : fRead > 0 ? 'en_progreso' : 'pendiente',
          reviewLevel: 0,
          reviewsHistory: [],
          scheduledDate: fileItem.scheduledDate,
          attachedFiles: [fileItem],
          lastNotesUpdatedAt: new Date().toISOString(),
        };
      });

      const createdNotes: CornellNote[] = createdTopics.map((t, idx) => ({
        id: `note-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        topicId: t.id,
        title: t.title,
        cues: ['Conceptos clave', 'Puntos importantes'],
        notes: t.notes || '',
        summary: `Documento importado: ${t.attachedFiles?.[0]?.name || t.title}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceType: 'ocr_pdf',
      }));

      const updatedSubjectPayload: Subject = {
        ...activeSubject,
        topics: [...activeSubject.topics, ...createdTopics],
        cornellNotes: [...(activeSubject.cornellNotes || []), ...createdNotes],
      };

      withSubjectUpdateLogging(
        'Save Button (handleAddDocument - New Topic)',
        updatedSubjectPayload,
        {
          newDocName,
          newDocCategory,
          newDocFileType,
          newDocTotalPages,
          newDocPagesRead,
          newDocTopicId,
          newDocScheduledDate,
          pendingExtractedFilesStateCount: pendingExtractedFiles.length,
          pendingExtractedFilesRefCount: pendingExtractedFilesRef.current.length,
          preparedFiles,
        }
      );
    }

    // Reset filters so newly saved documents are always visible in the list
    setActiveTypeFilter('all');
    setOnlyPendingFilter(false);

    setNewDocName('');
    setNewDocTotalPages('20');
    setNewDocPagesRead('0');
    pendingExtractedFilesRef.current = [];
    setPendingExtractedFile(null);
    setPendingExtractedFiles([]);
    setIsAddOpen(false);

    if (savedTopicId && lastSavedFile) {
      setDocSaveNotice({
        message:
          preparedFiles.length === 1
            ? `¡"${lastSavedFile.name}" (${lastSavedFile.pageCount} págs.) guardado correctamente en la asignatura!`
            : `¡${preparedFiles.length} documentos PDF guardados correctamente en la asignatura!`,
        topicId: savedTopicId,
        docId: lastSavedFile.id,
      });
    }
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'Sin fecha fija';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  // Contadores por tipo para las píldoras de filtro
  const filterCounts = useMemo(() => {
    return {
      all: allSubjectDocuments.length,
      pdf: allSubjectDocuments.filter((d) => d.fileType === 'pdf').length,
      teoria: allSubjectDocuments.filter((d) => d.documentCategory === 'teoria').length,
      apuntes: allSubjectDocuments.filter((d) => d.documentCategory === 'apuntes').length,
      libro: allSubjectDocuments.filter((d) => d.documentCategory === 'libro').length,
      practicas: allSubjectDocuments.filter(
        (d) => d.documentCategory === 'practicas' || d.fileType === 'doc'
      ).length,
      resumen: allSubjectDocuments.filter((d) => d.documentCategory === 'resumen').length,
    };
  }, [allSubjectDocuments]);

  if (!activeSubject) {
    return (
      <aside className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-900/5 dark:ring-white/10 p-5 space-y-3 sticky top-20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <FileText className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            PDFs y Documentos
          </h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Añade una materia o carga el plan de ejemplo para gestionar los documentos PDF importados, filtrarlos por tipo y ver las páginas restantes para el estudio programado.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {onOpenProgramModal && (
            <button
              type="button"
              onClick={onOpenProgramModal}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              + Añadir Materia
            </button>
          )}
          {onLoadDemoData && (
            <button
              type="button"
              onClick={onLoadDemoData}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cargar Datos Demo
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Panel lateral de documentos y PDFs importados"
      className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-900/5 dark:ring-white/10 shadow-2xs p-4 sm:p-5 space-y-4 sticky top-20"
    >
      {/* Cabecera del panel lateral */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              PDFs y Documentos
            </h4>
            <span className="px-2 py-0.5 text-[11px] font-bold font-mono-numbers bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">
              {allSubjectDocuments.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Control de páginas y resúmenes IA en puntos clave editables
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {allSubjectDocuments.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setReadingModeDocId(
                  filteredDocuments[0]?.id || allSubjectDocuments[0]?.id || null
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 ring-1 ring-amber-300/70 dark:ring-amber-700/60 text-[11px] font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Abrir Modo Lectura en pantalla completa para resaltar texto y añadir notas rápidas"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Modo Lectura</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setNewDocTopicId(activeSubject.topics[0]?.id || '');
              setIsAddOpen(!isAddOpen);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-[11px] font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Importar o registrar un nuevo archivo PDF / documento para esta asignatura"
          >
            {isAddOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isAddOpen ? 'Cerrar' : 'Importar PDF'}</span>
          </button>
        </div>
      </div>

      {/* Selector rápido de asignatura cuando hay varias materias disponibles */}
      {subjects.length > 1 && (
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Materia seleccionada
          </label>
          <div className="flex items-center gap-1.5">
            <select
              value={activeSubject.id}
              onChange={(e) => {
                const nextId = e.target.value;
                setInternalSubjectId(nextId);
                setActiveTypeFilter('all');
                setEditingModalTarget(null);
                setReadingModeDocId(null);
                if (selectedSubject && onSelectSubject) {
                  onSelectSubject(nextId);
                }
              }}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 ring-1 ring-slate-200/80 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.code ? `${sub.code} · ` : ''}
                  {sub.name}
                </option>
              ))}
            </select>
            {!selectedSubject && onSelectSubject && (
              <button
                type="button"
                onClick={() => onSelectSubject(activeSubject.id)}
                className="px-2.5 py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100/80 rounded-xl transition-colors shrink-0 cursor-pointer"
                title="Abrir ficha completa de esta asignatura"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Resumen de Páginas Restantes para el Estudio Programado */}
      <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 ring-1 ring-slate-200/60 dark:ring-slate-700/60 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Restantes para estudio programado
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono-numbers text-slate-900 dark:text-white">
                {readingMetrics.totalRemaining}
              </span>
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                págs. por leer
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold font-mono-numbers text-slate-800 dark:text-slate-200">
              {readingMetrics.progressPct}% leído
            </span>
            <span className="block text-[11px] font-mono-numbers text-slate-400">
              {readingMetrics.totalRead} / {readingMetrics.totalPages} págs.
            </span>
          </div>
        </div>

        {/* Barra de progreso global de lectura */}
        <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              readingMetrics.progressPct >= 100
                ? 'bg-emerald-500'
                : readingMetrics.progressPct >= 50
                ? 'bg-blue-600'
                : 'bg-amber-500'
            }`}
            style={{ width: `${readingMetrics.progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-600" />
            <span>
              ~{Math.max(0, Math.round((readingMetrics.totalRemaining * 6) / 60 * 10) / 10)}h de lectura est.
            </span>
          </span>
          {readingMetrics.nextScheduledDate && (
            <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <Calendar className="w-3 h-3 text-amber-600" />
              <span>Próx. sesión: {formatShortDate(readingMetrics.nextScheduledDate)}</span>
            </span>
          )}
        </div>
      </div>

      {aiSummaryError && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-center justify-between gap-2">
          <span>{aiSummaryError}</span>
          <button
            type="button"
            onClick={() => setAiSummaryError(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {flashcardsSaveNotice && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{flashcardsSaveNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFlashcardsSaveNotice(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Aviso de documento guardado con acceso directo al editor */}
      {docSaveNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold truncate">{docSaveNotice.message}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingModalTarget({
                  topicId: docSaveNotice.topicId,
                  docId: docSaveNotice.docId,
                });
                setDocSaveNotice(null);
              }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
            >
              Abrir en Editor
            </button>
            <button
              type="button"
              onClick={() => setDocSaveNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 text-[11px] font-bold px-1.5 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Formulario desplegable para importar un nuevo PDF o documento */}
      {isAddOpen && (
        <form
          onSubmit={handleAddDocument}
          className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-slate-800/80 ring-1 ring-blue-200/80 dark:ring-slate-700 space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Subir PDF, Word o PowerPoint a Editable
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.odt,.odp,.txt,.md,image/*"
              onChange={handleFileUploadSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReadingFile}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 rounded-lg ring-1 ring-blue-200 dark:ring-slate-600 hover:bg-blue-50 cursor-pointer"
            >
              {isReadingFile ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Extrayendo datos...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3 h-3" />
                  <span>Elegir archivo(s)</span>
                </>
              )}
            </button>
          </div>

          {pendingExtractedFiles.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-950 dark:text-emerald-200 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {pendingExtractedFiles.length === 1
                      ? 'Documento extraído con éxito'
                      : `${pendingExtractedFiles.length} documentos extraídos con éxito`}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 font-mono-numbers">
                  {pendingExtractedFiles.reduce((s, f) => s + (f.pageCount || 1), 0)} págs.
                  {pendingExtractedFiles.reduce(
                    (s, f) => s + (f.extractedImages?.length || 0),
                    0
                  ) > 0
                    ? ` · ${pendingExtractedFiles.reduce(
                        (s, f) => s + (f.extractedImages?.length || 0),
                        0
                      )} imgs`
                    : ''}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
                  Todo el texto, estructura e imágenes están listos. Pulsa{' '}
                  <strong>"Guardar Documento"</strong> para dejarlos guardados en la asignatura.
                </p>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  Guardar Ahora
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              required={pendingExtractedFiles.length === 0}
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              placeholder="Nombre del archivo (ej. Tema_4_Apuntes.pdf)"
              className="w-full text-xs bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  Tipo de material
                </label>
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value as DocumentCategoryType)}
                  className="w-full text-xs bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="teoria">Teoría</option>
                  <option value="apuntes">Apuntes</option>
                  <option value="libro">Libro / Manual</option>
                  <option value="practicas">Prácticas / Ejercicios</option>
                  <option value="resumen">Resumen / Esquema</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  Formato
                </label>
                <select
                  value={newDocFileType}
                  onChange={(e) => setNewDocFileType(e.target.value as ImportedFileFormat)}
                  className="w-full text-xs bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="pdf">PDF (.pdf)</option>
                  <option value="word">Word (.docx / .doc)</option>
                  <option value="powerpoint">PowerPoint (.pptx / .ppt)</option>
                  <option value="text">Texto (.txt / .md)</option>
                  <option value="image">Escaneo / Imagen</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  Págs. totales
                </label>
                <input
                  type="number"
                  min="1"
                  max="2000"
                  value={newDocTotalPages}
                  onChange={(e) => setNewDocTotalPages(e.target.value)}
                  className="w-full text-xs font-mono-numbers bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  Págs. leídas
                </label>
                <input
                  type="number"
                  min="0"
                  max="2000"
                  value={newDocPagesRead}
                  onChange={(e) => setNewDocPagesRead(e.target.value)}
                  className="w-full text-xs font-mono-numbers bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  Fecha estudio
                </label>
                <input
                  type="date"
                  value={newDocScheduledDate}
                  onChange={(e) => setNewDocScheduledDate(e.target.value)}
                  className="w-full text-[11px] font-mono-numbers bg-white dark:bg-slate-900 rounded-lg px-1.5 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {activeSubject.topics.length > 0 && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                  Vincular a tema
                </label>
                <select
                  value={newDocTopicId || activeSubject.topics[0]?.id || ''}
                  onChange={(e) => setNewDocTopicId(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-slate-900 rounded-lg px-2 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700 text-slate-800 dark:text-slate-100"
                >
                  {activeSubject.topics.map((t, i) => (
                    <option key={t.id} value={t.id}>
                      T{i + 1}: {t.title}
                    </option>
                  ))}
                  <option value="__new__">✨ Crear un tema nuevo a partir del PDF</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsAddOpen(false);
                pendingExtractedFilesRef.current = [];
                setPendingExtractedFile(null);
                setPendingExtractedFiles([]);
              }}
              className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isReadingFile}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Guardar Documento
            </button>
          </div>
        </form>
      )}

      {/* Filtros por tipo de documento */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <Filter className="w-3 h-3" />
            <span>Filtrar por tipo</span>
          </span>

          <button
            type="button"
            onClick={() => setOnlyPendingFilter(!onlyPendingFilter)}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
              onlyPendingFilter
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            {onlyPendingFilter ? 'Solo con págs. pendientes' : 'Ver todos'}
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              { id: 'all', label: 'Todos', count: filterCounts.all },
              { id: 'pdf', label: 'PDF', count: filterCounts.pdf },
              { id: 'teoria', label: 'Teoría', count: filterCounts.teoria },
              { id: 'apuntes', label: 'Apuntes', count: filterCounts.apuntes },
              { id: 'libro', label: 'Libros', count: filterCounts.libro },
              { id: 'practicas', label: 'Prácticas', count: filterCounts.practicas },
              { id: 'resumen', label: 'Resúmenes', count: filterCounts.resumen },
            ] as { id: DocumentFilterType; label: string; count: number }[]
          ).map((f) => {
            const isActive = activeTypeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveTypeFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1 ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                    : 'bg-slate-100/90 hover:bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`font-mono-numbers text-[10px] ${
                    isActive ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de archivos PDF / documentos de la asignatura */}
      <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-0.5">
        {filteredDocuments.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
            <BookOpen className="w-5 h-5 text-slate-400 mx-auto" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              No hay documentos en este filtro
            </p>
            <p className="text-[11px] text-slate-400">
              Prueba con otro tipo de documento o importa un archivo PDF nuevo.
            </p>
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const pct =
              doc.pageCount > 0 ? Math.min(100, Math.round((doc.pagesRead / doc.pageCount) * 100)) : 0;
            const isCompleted = doc.remainingPages === 0;
            const catMeta = CATEGORY_LABELS[doc.documentCategory] || CATEGORY_LABELS.teoria;
            const fmtMeta = FILE_FORMAT_BADGE[doc.fileType] || FILE_FORMAT_BADGE.pdf;
            const isSummarizing = summarizingDocId === doc.id;
            const isGeneratingCards = generatingFlashcardsDocId === doc.id;
            const isFlashcardsOpen = activeFlashcardsDocId === doc.id;
            const docKeyPoints = doc.keyPoints || [];
            const hasAISummary = Boolean(doc.summary || docKeyPoints.length > 0);
            const isExpanded = expandedSummaryDocId === doc.id;
            const savedDocFlashcardsCount = (activeSubject.flashcards || []).filter(
              (fc) => fc.sourceDocName === doc.name
            ).length;

            return (
              <div
                key={doc.id}
                className={`p-3 rounded-xl ring-1 transition-all space-y-2 ${
                  isCompleted
                    ? 'bg-slate-50/60 dark:bg-slate-800/30 ring-slate-200/60 dark:ring-slate-800'
                    : 'bg-white dark:bg-slate-800/60 ring-slate-200/90 dark:ring-slate-700/80 hover:ring-blue-400/60'
                }`}
              >
                {/* Fila superior: Formato + Tipo + Páginas restantes */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ring-1 font-mono-numbers ${fmtMeta.className}`}
                    >
                      {fmtMeta.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ring-1 ${catMeta.badgeClass}`}
                    >
                      {catMeta.label}
                    </span>
                    {docKeyPoints.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSummaryDocId(isExpanded ? null : doc.id)
                        }
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20 hover:bg-indigo-100 cursor-pointer"
                        title="Ver resumen IA y puntos clave generados para este documento"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                        <span>{docKeyPoints.length} pts clave</span>
                      </button>
                    )}
                    {savedDocFlashcardsCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20"
                        title="Flashcards guardadas en la asignatura a partir de este documento"
                      >
                        <Layers className="w-2.5 h-2.5 text-emerald-600" />
                        <span>{savedDocFlashcardsCount} flashcards</span>
                      </span>
                    )}
                  </div>

                  {/* Indicador destacado de páginas restantes para el estudio programado */}
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono-numbers">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>0 págs. restantes</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300 font-mono-numbers">
                      <span>Faltan {doc.remainingPages} págs.</span>
                    </span>
                  )}
                </div>

                {/* Nombre del PDF/documento y tema asociado */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h5
                      className={`text-xs font-semibold break-all leading-snug ${
                        isCompleted
                          ? 'text-slate-500 line-through decoration-slate-300'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                      title={doc.name}
                    >
                      {doc.name}
                    </h5>
                    {!doc.isSynthesized && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc)}
                        className="text-slate-300 hover:text-rose-600 transition-colors p-0.5 shrink-0 cursor-pointer"
                        title="Eliminar archivo de la lista"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    Tema: {doc.topicTitle}
                  </p>
                </div>

                {/* Barra de progreso de páginas leídas vs totales */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono-numbers">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Leídas: <strong>{doc.pagesRead}</strong> de <strong>{doc.pageCount}</strong> págs.
                    </span>
                    <span className="text-slate-400 font-semibold">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted
                          ? 'bg-emerald-500'
                          : pct >= 50
                          ? 'bg-blue-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Acciones de IA: Resumen IA + Puntos Clave + Generación de Flashcards (Concepto/Definición) */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      disabled={isSummarizing}
                      onClick={() => handleGenerateDocumentSummaryAndKeyPoints(doc, false)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-2xs disabled:opacity-50 cursor-pointer"
                      title="Generar resumen automático con IA de este documento y convertirlo en puntos clave editables en los apuntes"
                    >
                      {isSummarizing ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Resumiendo...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>{hasAISummary ? 'Regenerar Resumen' : 'Resumen IA'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isGeneratingCards}
                      onClick={() => handleGenerateDocumentFlashcards(doc)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs disabled:opacity-50 cursor-pointer"
                      title="Analizar el contenido de estos apuntes con IA para generar flashcards estructuradas (Concepto y Definición) y guardarlas en la asignatura"
                    >
                      {isGeneratingCards ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Creando Flashcards...</span>
                        </>
                      ) : (
                        <>
                          <Layers className="w-3 h-3" />
                          <span>Flashcards IA</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingModalTarget({
                        topicId: doc.topicId,
                        docId: doc.isSynthesized ? undefined : doc.id,
                        openKeyPoints: true,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 cursor-pointer"
                    title="Abrir vista de apuntes con los puntos clave editables de este documento"
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                    <span>Puntos ({docKeyPoints.length})</span>
                  </button>
                </div>

                {/* Panel interactivo de Flashcards estructuradas (Concepto y Definición) generadas por IA desde este documento */}
                {isFlashcardsOpen && generatedDocFlashcards.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                          Flashcards IA · Concepto y Definición (
                          {generatedDocFlashcards.filter((c) => c.selected).length}/
                          {generatedDocFlashcards.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFlashcardsDocId(null);
                          setGeneratedDocFlashcards([]);
                        }}
                        className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                        title="Cerrar vista previa de flashcards"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Selector de asignatura destino donde guardar las flashcards */}
                    <div className="flex items-center justify-between gap-2 bg-white/90 dark:bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/70 dark:border-emerald-900">
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                        Guardar en:
                      </span>
                      <select
                        value={flashcardsTargetSubjectId || activeSubject.id}
                        onChange={(e) => setFlashcardsTargetSubjectId(e.target.value)}
                        className="text-[11px] font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none truncate max-w-[180px] cursor-pointer"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Lista editable de tarjetas Concepto / Definición */}
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                      {generatedDocFlashcards.map((card, cIdx) => (
                        <div
                          key={card.id}
                          className={`p-2 rounded-lg border transition-colors space-y-1.5 ${
                            card.selected
                              ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/80'
                              : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <label className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={card.selected}
                                onChange={() =>
                                  setGeneratedDocFlashcards((prev) =>
                                    prev.map((item) =>
                                      item.id === card.id
                                        ? { ...item, selected: !item.selected }
                                        : item
                                    )
                                  )
                                }
                                className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span>Tarjeta #{cIdx + 1} · Concepto</span>
                            </label>
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 truncate max-w-[110px]">
                              {card.conceptTag}
                            </span>
                          </div>

                          <input
                            type="text"
                            value={card.concept}
                            onChange={(e) =>
                              setGeneratedDocFlashcards((prev) =>
                                prev.map((item) =>
                                  item.id === card.id
                                    ? { ...item, concept: e.target.value }
                                    : item
                                )
                              )
                            }
                            placeholder="Concepto clave..."
                            className="w-full text-[11px] font-bold text-slate-900 dark:text-slate-100 bg-slate-50/80 dark:bg-slate-800/80 px-2 py-1 rounded border border-slate-200/80 dark:border-slate-700 focus:outline-none focus:border-emerald-500"
                          />

                          <div>
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              Definición
                            </span>
                            <textarea
                              rows={2}
                              value={card.definition}
                              onChange={(e) =>
                                setGeneratedDocFlashcards((prev) =>
                                  prev.map((item) =>
                                    item.id === card.id
                                      ? { ...item, definition: e.target.value }
                                      : item
                                  )
                                )
                              }
                              placeholder="Definición estructurada..."
                              className="w-full text-[11px] text-slate-700 dark:text-slate-200 bg-slate-50/80 dark:bg-slate-800/80 px-2 py-1 rounded border border-slate-200/80 dark:border-slate-700 focus:outline-none focus:border-emerald-500 resize-none leading-snug"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setGeneratedDocFlashcards((prev) => [
                            ...prev,
                            {
                              id: `doc-fc-${Date.now()}-manual`,
                              concept: 'Nuevo concepto',
                              definition: 'Escribe la definición del concepto...',
                              hint: '',
                              conceptTag: doc.topicTitle,
                              selected: true,
                            },
                          ])
                        }
                        className="px-2 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                        title="Añadir otra flashcard manualmente"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+1</span>
                      </button>

                      <button
                        type="button"
                        disabled={
                          generatedDocFlashcards.filter((c) => c.selected).length === 0
                        }
                        onClick={() => handleSaveGeneratedFlashcardsToSubject(doc)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          Guardar{' '}
                          {generatedDocFlashcards.filter((c) => c.selected).length}{' '}
                          Flashcards en Asignatura
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Vista previa desplegable del Resumen IA y Puntos Clave generados en el panel lateral */}
                {isExpanded && hasAISummary && (
                  <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/70 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span>Resumen IA y Puntos Clave</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedSummaryDocId(null)}
                        className="text-indigo-400 hover:text-indigo-700 cursor-pointer"
                        title="Ocultar vista previa"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {doc.summary && (
                      <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed bg-white/90 dark:bg-slate-900/80 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                        {doc.summary}
                      </p>
                    )}

                    {docKeyPoints.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                        {docKeyPoints.map((kp, kIdx) => (
                          <div
                            key={kp.id || kIdx}
                            className="p-2 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                {kIdx + 1}. {kp.title}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                  kp.importance === 'alta'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : kp.importance === 'baja'
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {kp.importance}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                              {kp.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setEditingModalTarget({
                          topicId: doc.topicId,
                          docId: doc.isSynthesized ? undefined : doc.id,
                          openKeyPoints: true,
                        })
                      }
                      className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Editar Puntos Clave en Vista de Apuntes</span>
                    </button>
                  </div>
                )}

                {/* Pie de tarjeta: fecha de estudio programado + controles rápidos de páginas */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="truncate">
                      Programado: <strong className="text-slate-700 dark:text-slate-200">{formatShortDate(doc.scheduledDate)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReadingModeDocId(doc.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100/90 hover:bg-amber-200/90 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 cursor-pointer whitespace-nowrap"
                      title="Abrir en Modo Lectura a pantalla completa (oculta la interfaz principal, permite resaltar texto y añadir notas rápidas con menú flotante)"
                    >
                      <Maximize2 className="w-2.5 h-2.5" />
                      <span>Modo Lectura</span>
                      {(doc.commentCount || 0) > 0 && (
                        <span className="font-mono-numbers text-[9px] opacity-80">
                          ({doc.commentCount})
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingModalTarget({
                          topicId: doc.topicId,
                          docId: doc.isSynthesized ? undefined : doc.id,
                          openKeyPoints: false,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer whitespace-nowrap"
                      title="Abrir este documento en el editor para modificar texto, subrayar en colores, añadir comentarios o gestionar imágenes"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      disabled={doc.pagesRead <= 0}
                      onClick={() => handleUpdateDocumentPagesRead(doc, doc.pagesRead - 1)}
                      className="px-1.5 py-0.5 text-[10px] font-bold font-mono-numbers rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"
                      title="Restar 1 página leída"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      disabled={isCompleted}
                      onClick={() => handleUpdateDocumentPagesRead(doc, doc.pagesRead + 1)}
                      className="px-1.5 py-0.5 text-[10px] font-bold font-mono-numbers rounded bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-40 cursor-pointer"
                      title="Marcar 1 página más como leída"
                    >
                      +1 pág
                    </button>
                    <button
                      type="button"
                      disabled={isCompleted}
                      onClick={() => handleUpdateDocumentPagesRead(doc, doc.pagesRead + 5)}
                      className="px-1.5 py-0.5 text-[10px] font-bold font-mono-numbers rounded bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-40 cursor-pointer"
                      title="Avanzar 5 páginas leídas"
                    >
                      +5
                    </button>
                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleUpdateDocumentPagesRead(doc, doc.pageCount)}
                        className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer"
                        title="Marcar todas las páginas del documento como leídas"
                      >
                        100%
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Edición Interactiva del Documento y Puntos Clave IA */}
      {editingModalTarget && activeSubject && (() => {
        const targetTopic = activeSubject.topics.find(
          (t) => t.id === editingModalTarget.topicId
        );
        if (!targetTopic) return null;
        return (
          <TopicNotesModal
            isOpen={true}
            onClose={() => setEditingModalTarget(null)}
            topic={targetTopic}
            subjectName={activeSubject.name}
            initialDocumentId={editingModalTarget.docId}
            initialOpenKeyPoints={editingModalTarget.openKeyPoints}
            onSaveTopicNotes={(topicId, data) => {
              const nowIso = new Date().toISOString();
              const updatedTopics = activeSubject.topics.map((t) => {
                if (t.id !== topicId) return t;
                const rawNextAttached =
                  data.attachedFiles !== undefined ? data.attachedFiles : t.attachedFiles || [];
                const orgPages = calculateOrganizedPagesFromFiles(rawNextAttached);
                const nextPages =
                  data.pageCount !== undefined
                    ? data.pageCount
                    : orgPages > 0
                    ? Math.max(t.pageCount || 0, orgPages)
                    : t.pageCount || 12;

                // Ensure attachedFiles is always populated when saving from the document editor modal
                // even if the topic previously only had a synthesized document
                const persistedAttachedFiles: AttachedTopicFile[] =
                  rawNextAttached.length > 0
                    ? rawNextAttached
                    : [
                        {
                          id: editingModalTarget.docId || `doc-${t.id}`,
                          name: `${t.title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_')}.pdf`,
                          fileType: 'pdf',
                          documentCategory: inferCategoryFromFileName(t.title, 0),
                          pageCount: nextPages,
                          pagesRead: t.pagesRead || 0,
                          scheduledDate: t.scheduledDate || t.nextReviewDate,
                          includeInOrganization: true,
                          content: data.notes || t.notes || t.description || '',
                          richHtmlContent:
                            data.richGeneralNotes !== undefined
                              ? data.richGeneralNotes
                              : t.richGeneralNotes,
                          extractedImages:
                            data.generalImages !== undefined
                              ? data.generalImages
                              : t.generalImages || [],
                          comments:
                            data.generalComments !== undefined
                              ? data.generalComments
                              : t.generalComments || [],
                          keyPoints:
                            data.keyPoints !== undefined ? data.keyPoints : t.keyPoints || [],
                          summary: data.summary || t.summary,
                          date: nowIso,
                          lastEditedAt: nowIso,
                        },
                      ];

                return {
                  ...t,
                  notes: data.notes,
                  generalNotes: data.notes,
                  richGeneralNotes:
                    data.richGeneralNotes !== undefined
                      ? data.richGeneralNotes
                      : t.richGeneralNotes,
                  generalImages:
                    data.generalImages !== undefined ? data.generalImages : t.generalImages,
                  generalComments:
                    data.generalComments !== undefined
                      ? data.generalComments
                      : t.generalComments,
                  cues: data.cues,
                  summary: data.summary,
                  keyPoints: data.keyPoints !== undefined ? data.keyPoints : t.keyPoints,
                  attachedFiles: persistedAttachedFiles,
                  pageCount: nextPages,
                  paginasTotales: nextPages,
                  lastNotesUpdatedAt: nowIso,
                };
              });

              const updatedCornellNotes = [...(activeSubject.cornellNotes || [])];
              const existingNoteIdx = updatedCornellNotes.findIndex(
                (n) => n.topicId === topicId
              );
              if (existingNoteIdx >= 0) {
                updatedCornellNotes[existingNoteIdx] = {
                  ...updatedCornellNotes[existingNoteIdx],
                  notes: data.notes,
                  cues: data.cues,
                  summary: data.summary,
                  keyPoints:
                    data.keyPoints !== undefined
                      ? data.keyPoints
                      : updatedCornellNotes[existingNoteIdx].keyPoints,
                  updatedAt: nowIso,
                };
              } else {
                const updatedTopicObj = updatedTopics.find((t) => t.id === topicId);
                if (updatedTopicObj) {
                  updatedCornellNotes.push({
                    id: `cn-${Date.now()}`,
                    topicId,
                    title: updatedTopicObj.title,
                    sourceType: 'ocr_pdf',
                    cues: data.cues || ['Conceptos clave'],
                    notes: data.notes,
                    summary: data.summary || '',
                    keyPoints: data.keyPoints,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                  });
                }
              }

              const updatedSubjectPayload: Subject = {
                ...activeSubject,
                topics: updatedTopics,
                cornellNotes: updatedCornellNotes,
              };

              withSubjectUpdateLogging(
                'Save Button in Modal (onSaveTopicNotes)',
                updatedSubjectPayload,
                {
                  topicId,
                  editingModalTarget,
                  incomingDataAttachedFilesCount: data.attachedFiles?.length || 0,
                  incomingDataPageCount: data.pageCount,
                  incomingDataNotesLength: data.notes?.length || 0,
                }
              );
            }}
          />
        );
      })()}

      {/* Vista 'Modo Lectura' a pantalla completa con menú flotante de resaltado y notas rápidas */}
      {readingModeDocId && activeSubject && (
        <DocumentReadingModeOverlay
          isOpen={true}
          onClose={() => setReadingModeDocId(null)}
          subject={activeSubject}
          documents={allSubjectDocuments}
          initialDocumentId={readingModeDocId}
          onSaveDocumentReadingChanges={handleSaveDocumentReadingChanges}
        />
      )}
    </aside>
  );
};
