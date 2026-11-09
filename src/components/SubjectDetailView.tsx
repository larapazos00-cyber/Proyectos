import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  Brain,
  Network,
  RotateCw,
  FileText,
  HelpCircle,
  Flame,
  ArrowRight,
  TrendingUp,
  Loader2,
  FolderKanban,
  Calculator,
  Award,
  Palette,
  Edit3,
  X,
  Layers,
  LayoutList,
  Kanban,
  ChevronDown,
  ChevronUp,
  Check,
  MoreVertical,
  Play,
  Trophy,
  Minus,
  AlertTriangle,
  Download,
  Printer,
  SlidersHorizontal,
  Paperclip,
  GitBranch,
  Mic,
  MicOff,
} from 'lucide-react';
import {
  Subject,
  Topic,
  Task,
  Exam,
  CornellNote,
  Flashcard,
  Quiz,
  FeynmanSession,
  Mindmap,
  ErrorLogEntry,
  ReviewQuality,
  ExamType,
  AttachedTopicFile,
  DocumentImageAsset,
  DocumentComment,
  EditableKeyPoint,
  StudyPreferences,
} from '../types';
import { schedulerService } from '../services/schedulerService';
import { checkSubjectProgressAlert } from '../utils/courseAlerts';
import {
  calculateOrganizedPagesFromFiles,
  convertMarkdownAndImagesToRichHtml,
  convertRichHtmlToPlainText,
} from '../utils/documentParser';
import { calculateSubjectGradeSummary } from '../utils/gradeCalculations';
import { pdfCornellExportService } from '../services/pdfCornellExportService';
import { CornellEditor } from './CornellEditor';
import { CornellPdfExportModal } from './CornellPdfExportModal';
import { FlashcardDeck } from './FlashcardDeck';
import { QuizRunner } from './QuizRunner';
import { PracticeQuizModule } from './PracticeQuizModule';
import { FeynmanCoachModal } from './FeynmanCoachModal';
import { FeynmanChallenge } from './FeynmanChallenge';
import { MindmapViewer } from './MindmapViewer';
import { ErrorAnalysisModal } from './ErrorAnalysisModal';
import { ConceptDiagramModal } from './ConceptDiagramModal';
import { SubjectProjectsTab } from './SubjectProjectsTab';
import { SubjectGradingTab } from './SubjectGradingTab';
import { TopicNotesModal } from './TopicNotesModal';
import { TopicReadingModeModal } from './TopicReadingModeModal';
import { FlashcardGeneratorModal } from './FlashcardGeneratorModal';
import { TopicKanbanBoard } from './TopicKanbanBoard';
import { SubjectVueltasTab } from './SubjectVueltasTab';
import { D3MindMapCanvas } from './D3MindMapCanvas';
import { TopicReviewScheduleModal } from './TopicReviewScheduleModal';

interface SubjectDetailViewProps {
  subject: Subject;
  preferences?: StudyPreferences;
  onOpenPreferences?: () => void;
  onUpdateSubject: (updated: Subject) => void;
  onSelectForPomodoro: (subjectId: string, topicId?: string) => void;
  onOpenExamsManager?: (subjectId?: string) => void;
}

interface SubjectAiErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class SubjectAiErrorBoundary extends React.Component<
  { children: React.ReactNode; subjectName: string },
  SubjectAiErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; subjectName: string }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): SubjectAiErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Se produjo un error inesperado en el módulo de IA.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SubjectAiErrorBoundary] Error capturado en SubjectDetailView:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 text-xs text-rose-900 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Error en las herramientas de IA de {this.props.subjectName}</span>
          </div>
          <p className="text-rose-700 leading-relaxed">
            No se pudo completar la operación solicitada: <strong>{this.state.errorMessage}</strong>
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Reintentar y restaurar vista
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const SubjectDetailView: React.FC<SubjectDetailViewProps> = ({
  subject,
  preferences,
  onOpenPreferences,
  onUpdateSubject,
  onSelectForPomodoro,
  onOpenExamsManager,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'temario'
    | 'vueltas'
    | 'apuntes'
    | 'active_recall'
    | 'feynman_challenge'
    | 'proyectos'
    | 'examenes'
    | 'calificaciones'
    | 'mapas_mentales'
    | 'tareas'
  >('temario');

  // Topic View Mode (Lista detallada vs Tablero Kanban)
  const [topicViewMode, setTopicViewMode] = useState<'lista' | 'kanban'>('lista');

  // Action menu dropdown on topic list item
  const [openActionsMenuTopicId, setOpenActionsMenuTopicId] = useState<string | null>(null);
  const [showHeaderToolsMenu, setShowHeaderToolsMenu] = useState(false);
  const [showMoreTabsMenu, setShowMoreTabsMenu] = useState(false);

  // Automatic Weighted Grade Summary
  const subjectGradeSummary = useMemo(() => calculateSubjectGradeSummary(subject), [subject]);

  // Modals & FeynmanChallenge target state
  const [isFeynmanModalOpen, setIsFeynmanModalOpen] = useState(false);
  const [selectedFeynmanConcept, setSelectedFeynmanConcept] = useState('');
  const [feynmanChallengeTopicId, setFeynmanChallengeTopicId] = useState<string | undefined>(
    subject.topics[0]?.id
  );
  const [feynmanChallengeSubtopic, setFeynmanChallengeSubtopic] = useState<string | undefined>(
    undefined
  );
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);
  const [selectedDiagramTopic, setSelectedDiagramTopic] = useState<Topic | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [selectedNotesTopic, setSelectedNotesTopic] = useState<Topic | null>(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [readingModeTopic, setReadingTopic] = useState<Topic | null>(null);
  const [isFlashcardGeneratorOpen, setIsFlashcardGeneratorOpen] = useState(false);
  const [flashcardGenTopicId, setFlashcardGenTopicId] = useState<string | undefined>(undefined);
  const [flashcardGenNoteId, setFlashcardGenNoteId] = useState<string | undefined>(undefined);

  // Cornell Mindmap (Gemini + D3.js) State
  const [isCornellMindmapModalOpen, setIsCornellMindmapModalOpen] = useState(false);
  const [selectedCornellMindmapTopicId, setSelectedCornellMindmapTopicId] = useState<string>(
    subject.topics[0]?.id || ''
  );
  const [activeCornellMindmap, setActiveCornellMindmap] = useState<Mindmap | null>(
    subject.mindmaps[0] || null
  );
  const [isGeneratingCornellMindmap, setIsGeneratingCornellMindmap] = useState(false);
  const [cornellMindmapError, setCornellMindmapError] = useState<string | null>(null);

  // Centralized AI Processing, Feedback & Error Handling State
  const [aiLoadingByKey, setAiLoadingByKey] = useState<Record<string, boolean>>({});
  const [aiErrorBanner, setAiErrorBanner] = useState<{
    actionTitle: string;
    reason: string;
    suggestion: string;
  } | null>(null);
  const [aiSuccessBanner, setAiSuccessBanner] = useState<{
    message: string;
    topicId?: string;
  } | null>(null);
  const [expandedKeyPointsByTopic, setExpandedKeyPointsByTopic] = useState<
    Record<string, boolean>
  >({});

  // Helper to format API/network errors into clear user-facing explanations
  const explainAiFailureReason = (
    err: unknown
  ): { reason: string; suggestion: string } => {
    const rawMsg =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
        ? err
        : 'Error desconocido al comunicarse con el servidor de IA.';

    if (/503|UNAVAILABLE|high demand|overloaded/i.test(rawMsg)) {
      return {
        reason:
          'El modelo de IA está experimentando una alta demanda temporal (Error 503 Service Unavailable).',
        suggestion:
          'Por favor, vuelve a pulsar el botón en unos segundos; el sistema alternará automáticamente al modelo de respaldo.',
      };
    }
    if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(rawMsg)) {
      return {
        reason:
          'Se ha alcanzado el límite temporal de peticiones por minuto a la API de IA (Error 429).',
        suggestion:
          'Espera unos 10-15 segundos antes de volver a solicitar la generación.',
      };
    }
    if (/Failed to fetch|NetworkError|network|ECONNREFUSED/i.test(rawMsg)) {
      return {
        reason:
          'Fallo de conexión de red al intentar contactar con el servidor de IA.',
        suggestion:
          'Verifica tu conexión o recarga la página e inténtalo nuevamente.',
      };
    }
    if (/sin contenido|vacío|empty|Provide|faltan datos/i.test(rawMsg)) {
      return {
        reason: rawMsg,
        suggestion:
          'Añade una descripción, subtemas, apuntes o importa un documento en el tema antes de ejecutar la herramienta.',
      };
    }
    return {
      reason: rawMsg,
      suggestion:
        'Revisa que el tema o apunte tenga contenido de texto válido y vuelve a intentarlo.',
    };
  };

  const reportCentralizedAiError = (actionTitle: string, err: unknown) => {
    const { reason, suggestion } = explainAiFailureReason(err);
    setAiErrorBanner({ actionTitle, reason, suggestion });
  };

  // Centralized try-catch wrapper around AI-powered functions in SubjectDetailView
  const runSubjectAiTask = async <T,>(
    taskKey: string,
    actionTitle: string,
    fn: () => Promise<T>
  ): Promise<T | null> => {
    setAiLoadingByKey((prev) => ({ ...prev, [taskKey]: true }));
    setAiErrorBanner(null);
    try {
      const result = await fn();
      return result;
    } catch (err: unknown) {
      console.error(`[SubjectDetailView AI Error - ${actionTitle}]:`, err);
      reportCentralizedAiError(actionTitle, err);
      return null;
    } finally {
      setAiLoadingByKey((prev) => ({ ...prev, [taskKey]: false }));
    }
  };

  // Subject Edit (Color, Name, Optional Code, Credits, Multiple Professors)
  const [showEditSubjectModal, setShowEditSubjectModal] = useState(false);
  const [editName, setEditName] = useState(subject.name);
  const [editCode, setEditCode] = useState(subject.code || '');
  const [editColor, setEditColor] = useState(subject.color || '#3b82f6');
  const [editCredits, setEditCredits] = useState(
    subject.credits !== undefined && subject.credits > 0 ? String(subject.credits) : ''
  );
  const [editProf, setEditProf] = useState(subject.professor || '');
  const [editProfessorsList, setEditProfessorsList] = useState<string[]>(() => {
    if (subject.professors && subject.professors.length > 0) return subject.professors;
    return subject.professor ? [subject.professor] : [];
  });
  const [newProfInput, setNewProfInput] = useState('');

  // Filtro de temas impresos vs digitales
  const [topicPrintedFilter, setTopicPrintedFilter] = useState<'all' | 'printed' | 'digital'>('all');

  // New Exam Form
  const [showAddExam, setShowAddExam] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamConvocatoria, setNewExamConvocatoria] = useState('Convocatoria Ordinaria');
  const [newExamLocation, setNewExamLocation] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [newExamTime, setNewExamTime] = useState('');
  const [newExamType, setNewExamType] = useState<ExamType>('test');
  const [newExamDifficulty, setNewExamDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('intermedio');
  const [newExamTargetGrade, setNewExamTargetGrade] = useState('');
  const [newExamWeight, setNewExamWeight] = useState('30');
  const [newExamNotes, setNewExamNotes] = useState('');
  const [newExamSelectedTopics, setNewExamSelectedTopics] = useState<string[]>([]);

  // Edit Exam Modal State
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editExamTitle, setEditExamTitle] = useState('');
  const [editExamConvocatoria, setEditExamConvocatoria] = useState('Convocatoria Ordinaria');
  const [editExamLocation, setEditExamLocation] = useState('');
  const [editExamDate, setEditExamDate] = useState('');
  const [editExamTime, setEditExamTime] = useState('');
  const [editExamType, setEditExamType] = useState<ExamType>('test');
  const [editExamDifficulty, setEditExamDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('intermedio');
  const [editExamTargetGrade, setEditExamTargetGrade] = useState('');
  const [editExamWeight, setEditExamWeight] = useState('');
  const [editExamFinalGrade, setEditExamFinalGrade] = useState('');
  const [editExamNotes, setEditExamNotes] = useState('');
  const [editExamCompleted, setEditExamCompleted] = useState(false);

  // New Topic Form
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<'Baja' | 'Media' | 'Alta'>('Media');
  const [newTopicPages, setNewTopicPages] = useState<string>('');
  const [newTopicSubtopics, setNewTopicSubtopics] = useState<string[]>([]);
  const [newTopicSubtopicInput, setNewTopicSubtopicInput] = useState<string>('');
  const [isEstimatingTime, setIsEstimatingTime] = useState(false);
  const [editingPagesTopicId, setEditingPagesTopicId] = useState<string | null>(null);
  const [tempPagesInput, setTempPagesInput] = useState<string>('');
  const [markingReadPagesTopicId, setMarkingReadPagesTopicId] = useState<string | null>(null);
  const [tempReadPagesInput, setTempReadPagesInput] = useState<string>('');
  const [tempTotalPagesInput, setTempTotalPagesInput] = useState<string>('');

  // Edit Topic Modal State (includes Subtopics Editor)
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicDesc, setEditTopicDesc] = useState('');
  const [editTopicDifficulty, setEditTopicDifficulty] = useState<'Baja' | 'Media' | 'Alta'>('Media');
  const [editTopicPages, setEditTopicPages] = useState('');
  const [editTopicSubtopics, setEditTopicSubtopics] = useState<string[]>([]);
  const [editTopicNewSubtopicInput, setEditTopicNewSubtopicInput] = useState('');

  // Inline Subtopics Management State on Topic Cards
  const [managingSubtopicsTopicId, setManagingSubtopicsTopicId] = useState<string | null>(null);
  const [inlineEditingSubtopic, setInlineEditingSubtopic] = useState<{
    topicId: string;
    index: number;
    text: string;
  } | null>(null);
  const [addingSubtopicInputByTopic, setAddingSubtopicInputByTopic] = useState<
    Record<string, string>
  >({});

  // Manual review date adjustment modal state
  const [manualScheduleTopic, setManualScheduleTopic] = useState<Topic | null>(null);

  // New Task Form
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'urgente' | 'alta' | 'media' | 'baja'>('media');
  const [newTaskTopicId, setNewTaskTopicId] = useState<string>('');
  const [newTaskSubtopic, setNewTaskSubtopic] = useState<string>('');
  const [newTaskIsGraded, setNewTaskIsGraded] = useState<boolean>(false);
  const [newTaskScore, setNewTaskScore] = useState<string>('');
  const [newTaskMaxScore, setNewTaskMaxScore] = useState<string>('10');
  const [newTaskWeight, setNewTaskWeight] = useState<string>('');
  const [subtopicTaskNotice, setSubtopicTaskNotice] = useState<string | null>(null);

  // Active Cornell Note
  const [activeNoteId, setActiveNoteId] = useState<string>(
    subject.cornellNotes.length > 0 ? subject.cornellNotes[0].id : ''
  );

  // Estados para exportar apuntes Cornell a PDF
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [isCornellExportModalOpen, setIsCornellExportModalOpen] = useState<boolean>(false);
  const [cornellExportDefaultScope, setCornellExportDefaultScope] = useState<'single' | 'subject'>('single');
  const [pdfExportNotice, setPdfExportNotice] = useState<string | null>(null);

  // Exportar apunte activo a PDF
  const handleExportActiveNotePDF = () => {
    const targetNote = subject.cornellNotes.find((n) => n.id === activeNoteId);
    if (!targetNote) return;
    const linkedTopic = subject.topics.find((t) => t.id === targetNote.topicId);
    pdfCornellExportService.exportSingleNote(subject, targetNote, linkedTopic);
    setPdfExportNotice(`¡Apunte "${targetNote.title}" exportado a PDF exitosamente!`);
    setIsExportDropdownOpen(false);
    setTimeout(() => setPdfExportNotice(null), 4000);
  };

  // Exportar todas las notas Cornell de la asignatura a PDF
  const handleExportAllNotesPDF = () => {
    const exportable = pdfCornellExportService.getExportableNotesForSubject(subject, subject.topics);
    if (exportable.length === 0) return;
    pdfCornellExportService.exportAllNotesFromSubject(subject, subject.topics);
    setPdfExportNotice(`¡Cuaderno con ${exportable.length} apuntes Cornell de ${subject.name} exportado a PDF exitosamente!`);
    setIsExportDropdownOpen(false);
    setTimeout(() => setPdfExportNotice(null), 4000);
  };

  // Exportar un tema específico directamente en formato PDF Cornell estructurado
  const handleExportTopicCornellPDF = (topic: Topic) => {
    const existingNote = (subject.cornellNotes || []).find((n) => n.topicId === topic.id);
    const noteToExport: CornellNote = existingNote || {
      id: `topic-cornell-${topic.id}`,
      topicId: topic.id,
      title: topic.title,
      cues:
        topic.cues && topic.cues.length > 0
          ? topic.cues
          : (topic.subtopics || []).map((st) => `¿En qué consiste ${st}?`),
      notes: topic.notes || topic.generalNotes || topic.description || '',
      summary: topic.summary || '',
      createdAt: topic.lastNotesUpdatedAt || new Date().toISOString(),
      updatedAt: topic.lastNotesUpdatedAt || new Date().toISOString(),
      sourceType: 'manual',
    };
    pdfCornellExportService.exportSingleNote(subject, noteToExport, topic);
  };

  // Helper to resolve Cornell Notes data (cues, notes, summary) for a given topic
  const getTopicCornellData = (topicId: string, cornellNoteOverride?: CornellNote) => {
    const targetTopic = subject.topics.find((t) => t.id === topicId) || subject.topics[0];
    const linkedNote =
      cornellNoteOverride ||
      subject.cornellNotes.find((n) => n.topicId === topicId) ||
      (subject.cornellNotes.length > 0 && !topicId ? subject.cornellNotes[0] : undefined);

    const cues =
      linkedNote?.cues && linkedNote.cues.length > 0
        ? linkedNote.cues
        : targetTopic?.cues && targetTopic.cues.length > 0
        ? targetTopic.cues
        : (targetTopic?.subtopics || []).map((st) => `¿Qué es y cómo funciona ${st}?`);

    const notes =
      linkedNote?.notes && linkedNote.notes.trim().length > 0
        ? linkedNote.notes
        : targetTopic?.notes ||
          targetTopic?.generalNotes ||
          targetTopic?.description ||
          '';

    const summary =
      linkedNote?.summary && linkedNote.summary.trim().length > 0
        ? linkedNote.summary
        : targetTopic?.summary || targetTopic?.description || '';

    return {
      topic: targetTopic,
      linkedNote,
      cues,
      notes,
      summary,
    };
  };

  // Función que utiliza Gemini para generar un mapa mental jerárquico a partir de los apuntes Cornell del tema seleccionado y lo renderiza con D3.js
  const handleGenerateCornellMindmap = async (
    topicId: string,
    cornellNoteOverride?: CornellNote
  ): Promise<Mindmap | null> => {
    const { topic, linkedNote, cues, notes, summary } = getTopicCornellData(
      topicId,
      cornellNoteOverride
    );

    if (!topic && !linkedNote) return null;

    setSelectedCornellMindmapTopicId(topic?.id || '');
    setIsGeneratingCornellMindmap(true);
    setCornellMindmapError(null);

    const generated = await runSubjectAiTask(
      `mindmap-${topic?.id || 'default'}`,
      `Mapa Mental Cornell IA (${topic?.title || linkedNote?.title || subject.name})`,
      async () => {
        const response = await fetch('/api/gemini/generate-cornell-mindmap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicTitle: topic?.title || linkedNote?.title || 'Tema de Estudio',
            topicDescription: topic?.description || '',
            subtopics: topic?.subtopics || [],
            subjectName: subject.name,
            cornellTitle: linkedNote?.title || topic?.title || '',
            cues,
            notes,
            summary,
          }),
        });

        const resData = await response.json();
        if (!response.ok || !resData.success || !resData.data) {
          throw new Error(
            resData.error || 'No se pudo generar el mapa mental desde apuntes Cornell.'
          );
        }

        const newMindmap: Mindmap = {
          id: `mm-cornell-${Date.now()}`,
          topicIds: topic ? [topic.id] : [],
          cornellNoteId: linkedNote?.id,
          title:
            resData.data.title ||
            `Mapa Mental Cornell: ${topic?.title || linkedNote?.title || subject.name}`,
          summary: resData.data.summary || summary,
          rootNode: resData.data.rootNode,
          createdAt: new Date().toISOString(),
        };

        onUpdateSubject({
          ...subject,
          mindmaps: [newMindmap, ...subject.mindmaps],
        });

        setActiveCornellMindmap(newMindmap);
        return newMindmap;
      }
    );

    if (!generated) {
      setCornellMindmapError(
        'No se pudo generar el mapa mental con IA. Revisa el aviso detallado en la parte superior.'
      );
    }
    setIsGeneratingCornellMindmap(false);
    return generated;
  };

  // Abrir el visor interactivo D3.js para un tema específico (y generar si no existe aún)
  const handleOpenCornellMindmapForTopic = async (
    topicId?: string,
    autoGenerateIfMissing = true,
    cornellNoteOverride?: CornellNote
  ) => {
    const resolvedTopicId =
      topicId ||
      cornellNoteOverride?.topicId ||
      selectedCornellMindmapTopicId ||
      subject.topics[0]?.id ||
      '';

    setSelectedCornellMindmapTopicId(resolvedTopicId);
    setCornellMindmapError(null);
    setIsCornellMindmapModalOpen(true);

    const existingForTopic = subject.mindmaps.find((m) =>
      resolvedTopicId ? m.topicIds.includes(resolvedTopicId) : true
    );

    if (existingForTopic && !cornellNoteOverride) {
      setActiveCornellMindmap(existingForTopic);
    } else if (autoGenerateIfMissing && (resolvedTopicId || cornellNoteOverride)) {
      await handleGenerateCornellMindmap(resolvedTopicId, cornellNoteOverride);
    }
  };

  // Save notes, attached imported documents & page counts directly inside a topic & synchronize with Cornell notes
  const handleSaveTopicNotes = (
    topicId: string,
    notes: string,
    cues: string[],
    summary: string,
    attachedFiles?: AttachedTopicFile[],
    pageCount?: number,
    richGeneralNotes?: string,
    generalImages?: DocumentImageAsset[],
    generalComments?: DocumentComment[],
    keyPoints?: EditableKeyPoint[]
  ) => {
    const nowIso = new Date().toISOString();
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const nextAttached = attachedFiles !== undefined ? attachedFiles : t.attachedFiles;
        const orgPages = calculateOrganizedPagesFromFiles(nextAttached);
        const nextPages =
          pageCount !== undefined
            ? pageCount
            : orgPages > 0
            ? Math.max(t.pageCount || 0, orgPages)
            : t.pageCount;

        const nextEstimatedHours = schedulerService.calculateTopicTime(
          t.difficulty,
          t.subtopics ? t.subtopics.length : 0,
          notes ? notes.length : t.description.length,
          nextPages
        );

        return {
          ...t,
          notes,
          generalNotes: notes,
          richGeneralNotes:
            richGeneralNotes !== undefined ? richGeneralNotes : t.richGeneralNotes,
          generalImages: generalImages !== undefined ? generalImages : t.generalImages,
          generalComments: generalComments !== undefined ? generalComments : t.generalComments,
          cues,
          summary,
          keyPoints: keyPoints !== undefined ? keyPoints : t.keyPoints,
          attachedFiles: nextAttached,
          pageCount: nextPages,
          paginasTotales: nextPages,
          estimatedHours: nextEstimatedHours,
          lastNotesUpdatedAt: nowIso,
        };
      }
      return t;
    });

    let updatedNotes = [...subject.cornellNotes];
    const existingIndex = updatedNotes.findIndex((n) => n.topicId === topicId);
    const targetTopic = subject.topics.find((t) => t.id === topicId);
    const topicTitle = targetTopic ? targetTopic.title : 'Apuntes del Tema';

    if (existingIndex >= 0) {
      updatedNotes[existingIndex] = {
        ...updatedNotes[existingIndex],
        notes,
        cues,
        summary,
        keyPoints:
          keyPoints !== undefined ? keyPoints : updatedNotes[existingIndex].keyPoints,
        title: topicTitle,
        updatedAt: nowIso,
      };
    } else {
      const newNote: CornellNote = {
        id: `cn-${Date.now()}`,
        topicId,
        title: topicTitle,
        sourceType: 'manual',
        cues,
        notes,
        summary,
        keyPoints,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      updatedNotes.push(newNote);
    }

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
      cornellNotes: updatedNotes,
    });
  };

  // ==========================================
  // NOTAS DE VOZ RÁPIDAS (WEB SPEECH API -> TEXTO EN NOTAS GENERALES DEL TEMA)
  // ==========================================
  const [voiceRecordingTopicId, setVoiceRecordingTopicId] = useState<string | null>(null);
  const [voiceFinalTranscript, setVoiceFinalTranscript] = useState<string>('');
  const [voiceInterimTranscript, setVoiceInterimTranscript] = useState<string>('');
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState<number>(0);
  const [voiceNoticeByTopic, setVoiceNoticeByTopic] = useState<Record<string, string>>({});
  const [voiceErrorByTopic, setVoiceErrorByTopic] = useState<Record<string, string>>({});
  const [expandedGeneralNotesByTopic, setExpandedGeneralNotesByTopic] = useState<
    Record<string, boolean>
  >({});

  const speechRecognitionRef = useRef<any>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const activeVoiceTopicRef = useRef<Topic | null>(null);

  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      if (voiceTimerRef.current) {
        window.clearInterval(voiceTimerRef.current);
      }
    };
  }, []);

  const appendTranscribedVoiceToTopic = (targetTopic: Topic, rawTranscript: string) => {
    const cleaned = rawTranscript.trim();
    if (!cleaned) return;

    const latestTopic = subject.topics.find((t) => t.id === targetTopic.id) || targetTopic;
    const timestamp = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const voiceEntry = `🎙️ [Nota de voz · ${timestamp}]: ${cleaned}`;
    const existingNotes = (latestTopic.generalNotes || latestTopic.notes || '').trim();
    const updatedNotesText = existingNotes
      ? `${existingNotes}\n\n${voiceEntry}`
      : voiceEntry;

    const nextRichGeneral = convertMarkdownAndImagesToRichHtml(
      updatedNotesText,
      latestTopic.generalImages || []
    );

    handleSaveTopicNotes(
      latestTopic.id,
      updatedNotesText,
      latestTopic.cues || [],
      latestTopic.summary || '',
      latestTopic.attachedFiles,
      latestTopic.pageCount,
      nextRichGeneral,
      latestTopic.generalImages,
      latestTopic.generalComments,
      latestTopic.keyPoints
    );

    setExpandedGeneralNotesByTopic((prev) => ({
      ...prev,
      [latestTopic.id]: true,
    }));
    setVoiceNoticeByTopic((prev) => ({
      ...prev,
      [latestTopic.id]: 'Nota de voz convertida a texto y guardada automáticamente en las notas generales del tema.',
    }));
    window.setTimeout(() => {
      setVoiceNoticeByTopic((prev) => {
        const copy = { ...prev };
        delete copy[latestTopic.id];
        return copy;
      });
    }, 5000);
  };

  const stopVoiceNoteRecording = (saveTranscript = true) => {
    if (voiceTimerRef.current) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }

    const fullText = `${accumulatedTranscriptRef.current} ${voiceInterimTranscript}`.trim();
    const targetTopic = activeVoiceTopicRef.current;

    if (saveTranscript && targetTopic && fullText) {
      appendTranscribedVoiceToTopic(targetTopic, fullText);
    }

    setVoiceRecordingTopicId(null);
    setVoiceFinalTranscript('');
    setVoiceInterimTranscript('');
    setVoiceRecordingSeconds(0);
    accumulatedTranscriptRef.current = '';
    activeVoiceTopicRef.current = null;
  };

  const handleToggleVoiceNoteForTopic = (topic: Topic) => {
    // Si ya está grabando en este tema, detener y guardar automáticamente
    if (voiceRecordingTopicId === topic.id) {
      stopVoiceNoteRecording(true);
      return;
    }

    // Si estaba grabando en otro tema, guardar el anterior primero
    if (voiceRecordingTopicId) {
      stopVoiceNoteRecording(true);
    }

    setVoiceErrorByTopic((prev) => {
      const next = { ...prev };
      delete next[topic.id];
      return next;
    });

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    activeVoiceTopicRef.current = topic;
    accumulatedTranscriptRef.current = '';
    setVoiceFinalTranscript('');
    setVoiceInterimTranscript('');
    setVoiceRecordingSeconds(0);
    setVoiceRecordingTopicId(topic.id);
    setExpandedGeneralNotesByTopic((prev) => ({ ...prev, [topic.id]: true }));

    voiceTimerRef.current = window.setInterval(() => {
      setVoiceRecordingSeconds((s) => s + 1);
    }, 1000);

    if (!SpeechRecognitionAPI) {
      setVoiceErrorByTopic((prev) => ({
        ...prev,
        [topic.id]:
          'Tu navegador no soporta reconocimiento de voz directo (prueba Chrome o Edge), o escribe tu nota rápida abajo para guardarla al instante.',
      }));
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcriptPiece + ' ';
          } else {
            interimChunk += transcriptPiece;
          }
        }
        if (finalChunk) {
          accumulatedTranscriptRef.current =
            `${accumulatedTranscriptRef.current} ${finalChunk}`.trim();
          setVoiceFinalTranscript(accumulatedTranscriptRef.current);
        }
        setVoiceInterimTranscript(interimChunk);
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error || '';
        if (errCode === 'no-speech') return;
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setVoiceErrorByTopic((prev) => ({
            ...prev,
            [topic.id]:
              'Permiso de micrófono denegado en el navegador. Permite el acceso al micrófono o dicta/escribe en el cuadro inferior.',
          }));
        } else {
          setVoiceErrorByTopic((prev) => ({
            ...prev,
            [topic.id]: `Aviso de audio (${errCode}). Puedes seguir dictando o pulsar Guardar.`,
          }));
        }
      };

      recognition.onend = () => {
        // Si el usuario no ha detenido manualmente la grabación, guardar lo dictado automáticamente
        if (activeVoiceTopicRef.current?.id === topic.id) {
          stopVoiceNoteRecording(true);
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setVoiceErrorByTopic((prev) => ({
        ...prev,
        [topic.id]:
          err?.message ||
          'No se pudo iniciar el micrófono. Escribe o edita tu nota rápida en el panel abierto.',
      }));
    }
  };

  // Resuelve todo el contenido de texto de un tema (apuntes, documentos adjuntos, notas Cornell, descripción y subtemas)
  const getTopicEffectiveContent = (topic: Topic): string => {
    const linkedNote = subject.cornellNotes.find((n) => n.topicId === topic.id);
    const candidates: string[] = [];

    if (topic.notes?.trim()) candidates.push(topic.notes.trim());
    if (topic.generalNotes?.trim()) candidates.push(topic.generalNotes.trim());
    if (topic.richGeneralNotes?.trim()) {
      const plain = convertRichHtmlToPlainText(topic.richGeneralNotes).trim();
      if (plain) candidates.push(plain);
    }
    if (linkedNote?.notes?.trim()) candidates.push(linkedNote.notes.trim());

    if (topic.attachedFiles && topic.attachedFiles.length > 0) {
      const filesText = topic.attachedFiles
        .map((f) => {
          if (f.content?.trim()) return f.content.trim();
          if (f.rawExtractedText?.trim()) return f.rawExtractedText.trim();
          if (f.richHtmlContent?.trim()) return convertRichHtmlToPlainText(f.richHtmlContent).trim();
          return '';
        })
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (filesText) candidates.push(filesText);
    }

    const metaParts: string[] = [];
    if (topic.title?.trim()) metaParts.push(`Tema: ${topic.title.trim()}`);
    if (topic.description?.trim()) metaParts.push(`Descripción: ${topic.description.trim()}`);
    if (topic.subtopics && topic.subtopics.length > 0) {
      metaParts.push(`Subtemas:\n${topic.subtopics.map((st) => `- ${st}`).join('\n')}`);
    }
    if (metaParts.length > 0) {
      candidates.push(metaParts.join('\n'));
    }

    const longest = candidates.sort((a, b) => b.length - a.length)[0];
    return (longest || topic.title || subject.name).trim();
  };

  // Generar Puntos Clave IA directamente para un tema de la asignatura y actualizar el estado de apuntes
  const handleGenerateTopicKeyPointsAI = async (topic: Topic) => {
    await runSubjectAiTask(
      `keypoints-${topic.id}`,
      `Puntos clave IA (${topic.title})`,
      async () => {
        const sourceText = getTopicEffectiveContent(topic);
        if (!sourceText) {
          throw new Error(
            `El tema "${topic.title}" no tiene contenido disponible para extraer puntos clave.`
          );
        }

        const primaryDoc =
          topic.attachedFiles && topic.attachedFiles.length > 0
            ? topic.attachedFiles[topic.attachedFiles.length - 1]
            : null;

        const response = await fetch('/api/gemini/summarize-document-keypoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentName: primaryDoc ? primaryDoc.name : topic.title,
            documentContent: sourceText,
            topicTitle: topic.title,
            subjectName: subject.name,
            pageCount: primaryDoc?.pageCount || topic.pageCount || 1,
          }),
        });

        const resJson = await response.json();
        if (!response.ok || !resJson.success) {
          throw new Error(
            resJson.error ||
              `Error (${response.status}) al generar puntos clave con IA para "${topic.title}".`
          );
        }

        const data = resJson.data || resJson;
        const generatedPoints: EditableKeyPoint[] = Array.isArray(data.keyPoints)
          ? data.keyPoints.map((kp: any, idx: number) => ({
              id: `kp-${Date.now()}-${idx + 1}`,
              title: String(kp.title || `Punto clave ${idx + 1}`),
              detail: String(kp.detail || ''),
              category: kp.category ? String(kp.category) : 'Concepto Clave',
              importance:
                kp.importance === 'alta' || kp.importance === 'baja' ? kp.importance : 'media',
              sourceDocName: primaryDoc ? primaryDoc.name : topic.title,
            }))
          : [];

        if (generatedPoints.length === 0) {
          throw new Error('La respuesta de IA no devolvió puntos clave para este contenido.');
        }

        const nextSummary = data.summary || topic.summary || '';
        const existingCues = topic.cues || [];
        const nextCues =
          Array.isArray(data.cues) && data.cues.length > 0
            ? Array.from(new Set([...existingCues, ...data.cues.map(String)]))
            : existingCues;

        const updatedAttachedFiles =
          topic.attachedFiles && topic.attachedFiles.length > 0
            ? topic.attachedFiles.map((f, idx, arr) =>
                idx === arr.length - 1
                  ? {
                      ...f,
                      summary: nextSummary,
                      keyPoints: generatedPoints,
                      lastEditedAt: new Date().toISOString(),
                    }
                  : f
              )
            : undefined;

        const currentNotes = topic.notes || topic.generalNotes || sourceText;

        handleSaveTopicNotes(
          topic.id,
          currentNotes,
          nextCues,
          nextSummary,
          updatedAttachedFiles,
          topic.pageCount,
          topic.richGeneralNotes,
          topic.generalImages,
          topic.generalComments,
          generatedPoints
        );

        setExpandedKeyPointsByTopic((prev) => ({ ...prev, [topic.id]: true }));
        setAiSuccessBanner({
          message: `¡${generatedPoints.length} puntos clave y resumen ejecutivo generados con IA para "${topic.title}"!`,
          topicId: topic.id,
        });
        setTimeout(() => setAiSuccessBanner(null), 5000);
      }
    );
  };

  // Mejorar Formato con IA directamente para un tema de la asignatura y actualizar el estado de apuntes
  const handleImproveTopicFormatAI = async (topic: Topic) => {
    await runSubjectAiTask(
      `format-${topic.id}`,
      `Mejorar formato IA (${topic.title})`,
      async () => {
        const sourceText = getTopicEffectiveContent(topic);
        if (!sourceText) {
          throw new Error(
            `El tema "${topic.title}" no tiene texto disponible para estructurar y mejorar con IA.`
          );
        }

        const response = await fetch('/api/gemini/structure-topic-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicTitle: topic.title,
            rawNotes: sourceText,
            subjectName: subject.name,
          }),
        });

        const resJson = await response.json();
        if (!response.ok || !resJson.success || !resJson.data) {
          throw new Error(
            resJson.error ||
              `Error (${response.status}) al estructurar y mejorar el formato de "${topic.title}".`
          );
        }

        const structuredNotes = resJson.data.notes || sourceText;
        const nextCues =
          Array.isArray(resJson.data.cues) && resJson.data.cues.length > 0
            ? resJson.data.cues.map(String)
            : topic.cues || [];
        const nextSummary = resJson.data.summary || topic.summary || '';
        const nextRichGeneral = convertMarkdownAndImagesToRichHtml(
          structuredNotes,
          topic.generalImages || []
        );

        const nowIso = new Date().toISOString();
        const updatedAttachedFiles =
          topic.attachedFiles && topic.attachedFiles.length > 0
            ? topic.attachedFiles.map((f, idx, arr) =>
                idx === arr.length - 1
                  ? {
                      ...f,
                      content: structuredNotes,
                      richHtmlContent: convertMarkdownAndImagesToRichHtml(
                        structuredNotes,
                        f.extractedImages || []
                      ),
                      summary: nextSummary,
                      lastEditedAt: nowIso,
                    }
                  : f
              )
            : undefined;

        handleSaveTopicNotes(
          topic.id,
          structuredNotes,
          nextCues,
          nextSummary,
          updatedAttachedFiles,
          topic.pageCount,
          nextRichGeneral,
          topic.generalImages,
          topic.generalComments,
          topic.keyPoints
        );

        setAiSuccessBanner({
          message: `¡Formato académico, preguntas Cornell y resumen de "${topic.title}" mejorados y guardados con IA!`,
          topicId: topic.id,
        });
        setTimeout(() => setAiSuccessBanner(null), 5000);
      }
    );
  };

  const handleSaveTopicGeneralNotes = (
    topicId: string,
    generalNotes: string,
    attachedFiles?: AttachedTopicFile[],
    pageCount?: number
  ) => {
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const nextAttached = attachedFiles !== undefined ? attachedFiles : t.attachedFiles;
        const orgPages = calculateOrganizedPagesFromFiles(nextAttached);
        const nextPages =
          pageCount !== undefined
            ? pageCount
            : orgPages > 0
            ? Math.max(t.pageCount || 0, orgPages)
            : t.pageCount;
        const nextEstimatedHours = schedulerService.calculateTopicTime(
          t.difficulty,
          t.subtopics ? t.subtopics.length : 0,
          generalNotes ? generalNotes.length : t.description.length,
          nextPages
        );

        return {
          ...t,
          generalNotes,
          notes: generalNotes,
          attachedFiles: nextAttached,
          pageCount: nextPages,
          paginasTotales: nextPages,
          estimatedHours: nextEstimatedHours,
        };
      }
      return t;
    });
    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  const handleAttachFileToTopic = (topicId: string, attachedFile: AttachedTopicFile) => {
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const nextAttached = [...(t.attachedFiles || []), attachedFile];
        const orgPages = calculateOrganizedPagesFromFiles(nextAttached);
        const nextPages = Math.max(t.pageCount || 0, orgPages);
        const nextNotes =
          t.notes && t.notes.trim()
            ? `${t.notes.trim()}\n\n## ${attachedFile.name} (${attachedFile.pageCount} págs.)\n\n${attachedFile.content}`
            : attachedFile.content;
        const nextEstimatedHours = schedulerService.calculateTopicTime(
          t.difficulty,
          t.subtopics ? t.subtopics.length : 0,
          nextNotes.length,
          nextPages
        );
        return {
          ...t,
          attachedFiles: nextAttached,
          pageCount: nextPages,
          paginasTotales: nextPages,
          notes: nextNotes,
          generalNotes: nextNotes,
          estimatedHours: nextEstimatedHours,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  const handleSaveReadingFeynmanSession = (session: FeynmanSession) => {
    onUpdateSubject({
      ...subject,
      feynmanSessions: [session, ...subject.feynmanSessions],
    });
  };

  // Helper to get total times a topic has been studied or reviewed
  const getTopicVueltas = (topic: Topic): number => {
    if (topic.vueltasCount !== undefined) {
      return topic.vueltasCount;
    }
    const historyCount = topic.reviewsHistory ? topic.reviewsHistory.length : 0;
    const baseStudy = topic.status === 'estudiado' || topic.status === 'repasado' || topic.studiedAt ? 1 : 0;
    return Math.max(historyCount, baseStudy);
  };

  const handleIncrementTopicVuelta = (topicId: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const nextCount = getTopicVueltas(t) + 1;
        const pageInfo = schedulerService.getTopicStudiedPages(t);
        const pagesReviewed =
          pageInfo.studiedPages > 0 ? pageInfo.studiedPages : pageInfo.totalPages;
        const topicErrors = subject.errorLogs.filter(
          (e) =>
            !e.resolved &&
            (e.topicId === t.id ||
              (e.topicTitle && e.topicTitle.toLowerCase().includes(t.title.toLowerCase())) ||
              (e.concept && e.concept.toLowerCase().includes(t.title.toLowerCase())))
        ).length;
        const calc = schedulerService.getNextSpacedReview(t.reviewLevel || 0, 'bien', {
          errorsCount: topicErrors,
          retentionPct: t.perceivedRetentionPct,
          baseDateStr: todayStr,
          studiedPages: pagesReviewed,
          totalPages: pageInfo.totalPages,
          difficulty: t.difficulty,
        });
        return {
          ...t,
          vueltasCount: nextCount,
          status: 'repasado' as const,
          studiedAt: t.studiedAt || todayStr,
          pagesRead: Math.max(t.pagesRead || 0, pagesReviewed),
          nextReviewDate: calc.nextDate,
          reviewLevel: calc.nextLevel,
          lastIntervalDays: calc.adjustedIntervalDays,
          lastAdjustmentReason: calc.adjustmentNote,
          reviewsHistory: [
            ...(t.reviewsHistory || []),
            {
              date: todayStr,
              quality: 'bien' as ReviewQuality,
              retentionPct: calc.inferredRetentionPct,
              errorsCount: topicErrors,
              intervalDaysUsed: calc.adjustedIntervalDays,
              adjustmentNote: calc.adjustmentNote,
              pagesReviewed,
              totalTopicPages: pageInfo.totalPages,
              estimatedReviewMinutes: calc.estimatedReviewMinutes,
            },
          ],
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  const handleDecrementTopicVuelta = (topicId: string) => {
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const currentCount = getTopicVueltas(t);
        const nextCount = Math.max(0, currentCount - 1);
        const updatedHistory = (t.reviewsHistory || []).slice(0, -1);
        return {
          ...t,
          vueltasCount: nextCount,
          status: (nextCount === 0 ? 'pendiente' : (nextCount === 1 ? 'estudiado' : 'repasado')) as Topic['status'],
          reviewsHistory: updatedHistory,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  const handleToggleTopicPrinted = (topicId: string) => {
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const isNowPrinted = !(t.isPrinted || t.impreso);
        return {
          ...t,
          isPrinted: isNowPrinted,
          impreso: isNowPrinted,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // 1. Topic Status change & Spaced Repetition calculation (Curva del olvido: 24h, 3d, 7d, 15d, 30d)
  const handleMarkTopicStatus = (topicId: string, newStatus: 'pendiente' | 'en_progreso' | 'estudiado' | 'repasado') => {
    const todayStr = new Date().toISOString().split('T')[0];

    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const topicErrors = subject.errorLogs.filter(
          (e) =>
            !e.resolved &&
            (e.topicId === t.id ||
              (e.topicTitle && e.topicTitle.toLowerCase().includes(t.title.toLowerCase())) ||
              (e.concept && e.concept.toLowerCase().includes(t.title.toLowerCase())))
        ).length;

        const pageInfo = schedulerService.getTopicStudiedPages(t);
        const pagesReviewed =
          pageInfo.studiedPages > 0 ? pageInfo.studiedPages : pageInfo.totalPages;

        if (newStatus === 'estudiado') {
          // 1er repaso: 24 horas (1 día) tras haber estudiado, teniendo en cuenta páginas estudiadas
          const calc = schedulerService.getNextSpacedReview(0, 'bien', {
            errorsCount: topicErrors,
            retentionPct: t.perceivedRetentionPct,
            baseDateStr: todayStr,
            studiedPages: pagesReviewed,
            totalPages: pageInfo.totalPages,
            difficulty: t.difficulty,
          });
          const nextVueltas = Math.max(1, getTopicVueltas(t) + 1);
          return {
            ...t,
            status: newStatus,
            vueltasCount: nextVueltas,
            studiedAt: t.studiedAt || todayStr,
            pagesRead: Math.max(t.pagesRead || 0, pagesReviewed),
            nextReviewDate: calc.nextDate,
            reviewLevel: calc.nextLevel,
            lastIntervalDays: calc.adjustedIntervalDays,
            lastAdjustmentReason: calc.adjustmentNote,
            reviewsHistory: [
              ...t.reviewsHistory,
              {
                date: todayStr,
                quality: 'bien' as ReviewQuality,
                retentionPct: calc.inferredRetentionPct,
                errorsCount: topicErrors,
                intervalDaysUsed: calc.adjustedIntervalDays,
                adjustmentNote: calc.adjustmentNote,
                pagesReviewed,
                totalTopicPages: pageInfo.totalPages,
                estimatedReviewMinutes: calc.estimatedReviewMinutes,
              },
            ],
          };
        } else if (newStatus === 'repasado') {
          const calc = schedulerService.getNextSpacedReview(t.reviewLevel || 1, 'bien', {
            errorsCount: topicErrors,
            retentionPct: t.perceivedRetentionPct,
            baseDateStr: todayStr,
            studiedPages: pagesReviewed,
            totalPages: pageInfo.totalPages,
            difficulty: t.difficulty,
          });
          const nextVueltas = Math.max(1, getTopicVueltas(t) + 1);
          return {
            ...t,
            status: newStatus,
            vueltasCount: nextVueltas,
            studiedAt: t.studiedAt || todayStr,
            pagesRead: Math.max(t.pagesRead || 0, pagesReviewed),
            nextReviewDate: calc.nextDate,
            reviewLevel: calc.nextLevel,
            lastIntervalDays: calc.adjustedIntervalDays,
            lastAdjustmentReason: calc.adjustmentNote,
            reviewsHistory: [
              ...t.reviewsHistory,
              {
                date: todayStr,
                quality: 'bien' as ReviewQuality,
                retentionPct: calc.inferredRetentionPct,
                errorsCount: topicErrors,
                intervalDaysUsed: calc.adjustedIntervalDays,
                adjustmentNote: calc.adjustmentNote,
                pagesReviewed,
                totalTopicPages: pageInfo.totalPages,
                estimatedReviewMinutes: calc.estimatedReviewMinutes,
              },
            ],
          };
        }
        if (newStatus === 'pendiente') {
          return {
            ...t,
            status: newStatus,
            pagesRead: 0,
            studiedAt: undefined,
            nextReviewDate: undefined,
            reviewLevel: 0,
          };
        }
        if (newStatus === 'en_progreso') {
          const halfPages = Math.max(1, Math.round(pageInfo.totalPages * 0.25));
          const readCount =
            t.pagesRead && t.pagesRead > 0 && t.pagesRead < pageInfo.totalPages
              ? t.pagesRead
              : halfPages;
          const calcPartial = schedulerService.getNextSpacedReview(0, 'bien', {
            baseDateStr: t.studiedAt || todayStr,
            studiedPages: readCount,
            totalPages: pageInfo.totalPages,
            difficulty: t.difficulty,
          });
          return {
            ...t,
            status: newStatus,
            pagesRead: readCount,
            studiedAt: t.studiedAt || todayStr,
            reviewLevel: Math.max(1, t.reviewLevel || 1),
            nextReviewDate: t.nextReviewDate || calcPartial.nextDate,
          };
        }
        return { ...t, status: newStatus };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Marcar páginas leídas de un tema e integrarlo automáticamente en el estado y en la creación de repasos espaciados (1, 3, 7, 15, 30 días)
  const handleMarkTopicPagesRead = (
    topicId: string,
    newPagesRead: number,
    customTotalPages?: number
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];

    const updatedTopics = subject.topics.map((t) => {
      if (t.id !== topicId) return t;

      const pageInfo = schedulerService.getTopicStudiedPages(t, preferences);
      const effectiveTotal =
        customTotalPages !== undefined && customTotalPages > 0
          ? customTotalPages
          : pageInfo.totalPages;
      const clampedRead = Math.max(0, Math.min(effectiveTotal, Math.round(newPagesRead)));

      const recalculatedHours = schedulerService.calculateTopicTime(
        t.difficulty,
        t.subtopics ? t.subtopics.length : 0,
        t.description ? t.description.length : 0,
        effectiveTotal,
        preferences
      );

      // Si se completan todas las páginas del tema -> marcar como estudiado y programar repaso espaciado (1, 3, 7, 15, 30d)
      if (effectiveTotal > 0 && clampedRead >= effectiveTotal) {
        if (t.status !== 'estudiado' && t.status !== 'repasado') {
          const topicErrors = subject.errorLogs.filter(
            (e) =>
              !e.resolved &&
              (e.topicId === t.id ||
                (e.topicTitle && e.topicTitle.toLowerCase().includes(t.title.toLowerCase())) ||
                (e.concept && e.concept.toLowerCase().includes(t.title.toLowerCase())))
          ).length;

          const calc = schedulerService.getNextSpacedReview(0, 'bien', {
            errorsCount: topicErrors,
            retentionPct: t.perceivedRetentionPct,
            baseDateStr: todayStr,
            studiedPages: effectiveTotal,
            totalPages: effectiveTotal,
            difficulty: t.difficulty,
          });
          const nextVueltas = Math.max(1, getTopicVueltas(t) + 1);
          return {
            ...t,
            pageCount: effectiveTotal,
            paginasTotales: effectiveTotal,
            pagesRead: effectiveTotal,
            estimatedHours: recalculatedHours,
            status: 'estudiado' as const,
            vueltasCount: nextVueltas,
            studiedAt: t.studiedAt || todayStr,
            nextReviewDate: calc.nextDate,
            reviewLevel: calc.nextLevel,
            lastIntervalDays: calc.adjustedIntervalDays,
            lastAdjustmentReason: calc.adjustmentNote,
            reviewsHistory: [
              ...(t.reviewsHistory || []),
              {
                date: todayStr,
                quality: 'bien' as ReviewQuality,
                retentionPct: calc.inferredRetentionPct,
                errorsCount: topicErrors,
                intervalDaysUsed: calc.adjustedIntervalDays,
                adjustmentNote: calc.adjustmentNote,
                pagesReviewed: effectiveTotal,
                totalTopicPages: effectiveTotal,
                estimatedReviewMinutes: calc.estimatedReviewMinutes,
              },
            ],
          };
        }
        return {
          ...t,
          pageCount: effectiveTotal,
          paginasTotales: effectiveTotal,
          pagesRead: effectiveTotal,
          estimatedHours: recalculatedHours,
        };
      }

      // Si hay páginas leídas parciales (> 0 y < total) -> estado 'en_progreso' Y crear/activar sus repasos espaciados (1, 3, 7, 15, 30d) para esas páginas leídas
      if (clampedRead > 0) {
        const calcPartial = schedulerService.getNextSpacedReview(0, 'bien', {
          baseDateStr: t.studiedAt || todayStr,
          studiedPages: clampedRead,
          totalPages: effectiveTotal,
          difficulty: t.difficulty,
        });
        return {
          ...t,
          pageCount: effectiveTotal,
          paginasTotales: effectiveTotal,
          pagesRead: clampedRead,
          estimatedHours: recalculatedHours,
          status: 'en_progreso' as const,
          studiedAt: t.studiedAt || todayStr,
          reviewLevel: Math.max(1, t.reviewLevel || 1),
          nextReviewDate: t.nextReviewDate || calcPartial.nextDate,
          lastIntervalDays: t.lastIntervalDays || calcPartial.adjustedIntervalDays,
          lastAdjustmentReason:
            t.lastAdjustmentReason ||
            `Repaso espaciado activado para ${clampedRead}/${effectiveTotal} págs. leídas`,
        };
      }

      // Si se marca 0 páginas leídas -> estado 'pendiente' y sin repasos espaciados
      return {
        ...t,
        pageCount: effectiveTotal,
        paginasTotales: effectiveTotal,
        pagesRead: 0,
        estimatedHours: recalculatedHours,
        status: 'pendiente' as const,
        studiedAt: undefined,
        nextReviewDate: undefined,
        reviewLevel: 0,
      };
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Add new topic with page count & user reading speed as primary determinant of estimated study time
  const handleAddTopic = async () => {
    if (!newTopicTitle.trim()) return;

    setIsEstimatingTime(true);
    const parsedPages = newTopicPages ? parseInt(newTopicPages, 10) : undefined;
    const pendingInputSubtopics = newTopicSubtopicInput
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const manualSubtopics = Array.from(
      new Set([...newTopicSubtopics, ...pendingInputSubtopics])
    );

    let calculatedHours = schedulerService.calculateTopicTime(
      newTopicDifficulty,
      manualSubtopics.length,
      newTopicDesc.length,
      parsedPages,
      preferences
    );
    let subtopicsList: string[] = [...manualSubtopics];

    try {
      const response = await fetch('/api/gemini/estimate-topic-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTopicTitle.trim(),
          description: newTopicDesc.trim(),
          pagesOrComplexity: parsedPages ? `${parsedPages} páginas` : '',
          subjectName: subject.name,
        }),
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        if (manualSubtopics.length === 0 && resData.data.subtopics) {
          subtopicsList = resData.data.subtopics;
        }
        if (parsedPages && parsedPages > 0) {
          // Cuando el tema tiene número de páginas, las páginas y la velocidad de lectura en preferencias determinan el tiempo
          calculatedHours = schedulerService.calculateTopicTime(
            newTopicDifficulty,
            subtopicsList.length,
            newTopicDesc.length,
            parsedPages,
            preferences
          );
        } else if (resData.data.estimatedHours) {
          calculatedHours = resData.data.estimatedHours;
        }
      }
    } catch (e) {
      console.warn('Fallback to local calculation', e);
    } finally {
      setIsEstimatingTime(false);
    }

    const newTopic: Topic = {
      id: `top-${Date.now()}`,
      title: newTopicTitle.trim(),
      description: newTopicDesc.trim() || 'Sin descripción detallada.',
      subtopics: subtopicsList,
      completedSubtopics: [],
      difficulty: newTopicDifficulty,
      pageCount: parsedPages,
      paginasTotales: parsedPages,
      pagesRead: 0,
      estimatedHours: calculatedHours,
      actualHoursSpent: 0,
      status: 'pendiente',
      reviewLevel: 0,
      reviewsHistory: [],
    };

    onUpdateSubject({
      ...subject,
      topics: [...subject.topics, newTopic],
    });

    setNewTopicTitle('');
    setNewTopicDesc('');
    setNewTopicPages('');
    setNewTopicSubtopics([]);
    setNewTopicSubtopicInput('');
    setShowAddTopic(false);
  };

  const handleUpdateTopicPages = (topicId: string, pageCount: number, pagesRead?: number) => {
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const recalculated = schedulerService.calculateTopicTime(
          t.difficulty,
          t.subtopics.length,
          t.description.length,
          pageCount,
          preferences
        );
        return {
          ...t,
          pageCount,
          paginasTotales: pageCount,
          pagesRead: pagesRead !== undefined ? pagesRead : t.pagesRead || 0,
          estimatedHours: recalculated,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
    setEditingPagesTopicId(null);
  };

  const handleRecalculateSubjectTopicsByReadingSpeed = () => {
    const res = schedulerService.recalculateSubjectsByReadingSpeed([subject], preferences || {});
    if (res.updatedSubjects[0]) {
      onUpdateSubject(res.updatedSubjects[0]);
    }
  };

  const handleDeleteTopic = (topicId: string) => {
    onUpdateSubject({
      ...subject,
      topics: subject.topics.filter((t) => t.id !== topicId),
    });
  };

  const handleOpenEditTopicModal = (topic: Topic) => {
    setEditingTopic(topic);
    setEditTopicTitle(topic.title);
    setEditTopicDesc(topic.description || '');
    setEditTopicDifficulty(topic.difficulty);
    setEditTopicPages(topic.pageCount ? String(topic.pageCount) : '');
    setEditTopicSubtopics([...(topic.subtopics || [])]);
    setEditTopicNewSubtopicInput('');
  };

  const handleSaveEditedTopic = () => {
    if (!editingTopic || !editTopicTitle.trim()) return;
    const pCount = editTopicPages ? parseInt(editTopicPages, 10) : undefined;
    const pendingSubtopics = editTopicNewSubtopicInput
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const cleanedSubtopics = [
      ...editTopicSubtopics.map((s) => s.trim()).filter((s) => s.length > 0),
      ...pendingSubtopics,
    ];

    const calculatedHours = schedulerService.calculateTopicTime(
      editTopicDifficulty,
      cleanedSubtopics.length,
      editTopicDesc.length,
      pCount,
      preferences
    );

    const updatedTopics = subject.topics.map((t) => {
      if (t.id === editingTopic.id) {
        const validCompleted = (t.completedSubtopics || []).filter((cs) =>
          cleanedSubtopics.includes(cs)
        );
        return {
          ...t,
          title: editTopicTitle.trim(),
          description: editTopicDesc.trim(),
          difficulty: editTopicDifficulty,
          subtopics: cleanedSubtopics,
          completedSubtopics: validCompleted,
          pageCount: pCount,
          paginasTotales: pCount,
          estimatedHours: calculatedHours,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
    setEditingTopic(null);
    setEditTopicNewSubtopicInput('');
  };

  // ==========================================
  // SUBTOPICS INLINE CRUD HANDLERS
  // ==========================================
  const handleAddSubtopicToTopic = (topicId: string, rawInput: string) => {
    const newItems = rawInput
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (newItems.length === 0) return;

    const updatedTopics = subject.topics.map((t) => {
      if (t.id !== topicId) return t;
      const existing = t.subtopics || [];
      const nextSubtopics = [...existing, ...newItems.filter((item) => !existing.includes(item))];
      const nextHours = schedulerService.calculateTopicTime(
        t.difficulty,
        nextSubtopics.length,
        t.description ? t.description.length : 0,
        t.pageCount,
        preferences
      );
      return {
        ...t,
        subtopics: nextSubtopics,
        estimatedHours: nextHours,
      };
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
    setAddingSubtopicInputByTopic((prev) => ({ ...prev, [topicId]: '' }));
  };

  const handleUpdateSubtopicInTopic = (
    topicId: string,
    subtopicIndex: number,
    newText: string
  ) => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    let oldSubtopicValue: string | undefined;
    let topicTitle = '';

    const updatedTopics = subject.topics.map((t) => {
      if (t.id !== topicId) return t;
      topicTitle = t.title;
      const currentSubtopics = [...(t.subtopics || [])];
      const oldValue = currentSubtopics[subtopicIndex];
      if (oldValue === undefined) return t;
      oldSubtopicValue = oldValue;
      currentSubtopics[subtopicIndex] = trimmed;

      const nextCompleted = (t.completedSubtopics || []).map((cs) =>
        cs === oldValue ? trimmed : cs
      );

      return {
        ...t,
        subtopics: currentSubtopics,
        completedSubtopics: nextCompleted,
      };
    });

    const updatedTasks = oldSubtopicValue
      ? subject.tasks.map((task) => {
          if (task.topicId === topicId && task.subtopic === oldSubtopicValue) {
            return {
              ...task,
              subtopic: trimmed,
              title: `${topicTitle}: ${trimmed}`,
            };
          }
          return task;
        })
      : subject.tasks;

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
      tasks: updatedTasks,
    });
    setInlineEditingSubtopic(null);
  };

  const handleDeleteSubtopicFromTopic = (topicId: string, subtopicIndex: number) => {
    let removedSubtopicValue: string | undefined;

    const updatedTopics = subject.topics.map((t) => {
      if (t.id !== topicId) return t;
      const currentSubtopics = [...(t.subtopics || [])];
      const removedValue = currentSubtopics[subtopicIndex];
      removedSubtopicValue = removedValue;
      const nextSubtopics = currentSubtopics.filter((_, idx) => idx !== subtopicIndex);
      const nextCompleted = (t.completedSubtopics || []).filter((cs) => cs !== removedValue);
      const nextHours = schedulerService.calculateTopicTime(
        t.difficulty,
        nextSubtopics.length,
        t.description ? t.description.length : 0,
        t.pageCount,
        preferences
      );

      return {
        ...t,
        subtopics: nextSubtopics,
        completedSubtopics: nextCompleted,
        estimatedHours: nextHours,
      };
    });

    const updatedTasks = removedSubtopicValue
      ? subject.tasks.filter(
          (task) => !(task.topicId === topicId && task.subtopic === removedSubtopicValue)
        )
      : subject.tasks;

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
      tasks: updatedTasks,
    });
    if (
      inlineEditingSubtopic &&
      inlineEditingSubtopic.topicId === topicId &&
      inlineEditingSubtopic.index === subtopicIndex
    ) {
      setInlineEditingSubtopic(null);
    }
  };

  const handleMoveSubtopicInTopic = (
    topicId: string,
    subtopicIndex: number,
    direction: 'up' | 'down'
  ) => {
    const updatedTopics = subject.topics.map((t) => {
      if (t.id !== topicId) return t;
      const list = [...(t.subtopics || [])];
      const targetIndex = direction === 'up' ? subtopicIndex - 1 : subtopicIndex + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return t;
      const temp = list[subtopicIndex];
      list[subtopicIndex] = list[targetIndex];
      list[targetIndex] = temp;
      return {
        ...t,
        subtopics: list,
      };
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  const handleToggleSubtopicCompleted = (topicId: string, subtopicText: string) => {
    let nextCompletedState = false;

    const updatedTopics = subject.topics.map((t) => {
      if (t.id !== topicId) return t;
      const currentCompleted = t.completedSubtopics || [];
      const isAlreadyDone = currentCompleted.includes(subtopicText);
      nextCompletedState = !isAlreadyDone;
      const nextCompleted = isAlreadyDone
        ? currentCompleted.filter((item) => item !== subtopicText)
        : [...currentCompleted, subtopicText];
      return {
        ...t,
        completedSubtopics: nextCompleted,
      };
    });

    const updatedTasks = subject.tasks.map((task) => {
      if (task.topicId === topicId && task.subtopic === subtopicText) {
        return {
          ...task,
          completed: nextCompletedState,
        };
      }
      return task;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
      tasks: updatedTasks,
    });
  };

  // Crear una tarea individual a partir de un subtema concreto
  const handleCreateTaskFromSubtopic = (topic: Topic, subtopicText: string) => {
    const alreadyExists = subject.tasks.some(
      (task) => task.topicId === topic.id && task.subtopic === subtopicText
    );
    if (alreadyExists) {
      setActiveTab('tareas');
      return;
    }

    const totalSubtopics = Math.max(1, (topic.subtopics || []).length);
    const estimatedMins = Math.max(
      15,
      Math.round(((topic.estimatedHours || 1.5) * 60) / totalSubtopics)
    );
    const isCompleted = (topic.completedSubtopics || []).includes(subtopicText);
    const priorityMap: Record<'Baja' | 'Media' | 'Alta', 'baja' | 'media' | 'alta'> = {
      Baja: 'baja',
      Media: 'media',
      Alta: 'alta',
    };

    const newTask: Task = {
      id: `tsk-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${topic.title}: ${subtopicText}`,
      dueDate: topic.scheduledDate || new Date().toISOString().split('T')[0],
      priority: priorityMap[topic.difficulty] || 'media',
      type: 'lectura',
      completed: isCompleted,
      reminder: true,
      durationMinutes: estimatedMins,
      topicId: topic.id,
      subtopic: subtopicText,
    };

    onUpdateSubject({
      ...subject,
      tasks: [...subject.tasks, newTask],
    });

    setSubtopicTaskNotice(`Subtema "${subtopicText}" añadido como tarea (${estimatedMins} min est.).`);
    setTimeout(() => setSubtopicTaskNotice(null), 3500);
  };

  // Desglosar todos los subtemas de un tema en tareas individuales
  const handleBreakdownTopicSubtopicsIntoTasks = (topic: Topic) => {
    const subtopics = topic.subtopics || [];
    if (subtopics.length === 0) return;

    const existingSubtopicSet = new Set(
      subject.tasks
        .filter((task) => task.topicId === topic.id && task.subtopic)
        .map((task) => task.subtopic as string)
    );

    const missingSubtopics = subtopics.filter((st) => !existingSubtopicSet.has(st));
    if (missingSubtopics.length === 0) {
      setActiveTab('tareas');
      return;
    }

    const totalSubtopics = Math.max(1, subtopics.length);
    const estimatedMins = Math.max(
      15,
      Math.round(((topic.estimatedHours || 1.5) * 60) / totalSubtopics)
    );
    const priorityMap: Record<'Baja' | 'Media' | 'Alta', 'baja' | 'media' | 'alta'> = {
      Baja: 'baja',
      Media: 'media',
      Alta: 'alta',
    };
    const dueDate = topic.scheduledDate || new Date().toISOString().split('T')[0];

    const createdTasks: Task[] = missingSubtopics.map((st, idx) => ({
      id: `tsk-sub-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${topic.title}: ${st}`,
      dueDate,
      priority: priorityMap[topic.difficulty] || 'media',
      type: 'lectura',
      completed: (topic.completedSubtopics || []).includes(st),
      reminder: true,
      durationMinutes: estimatedMins,
      topicId: topic.id,
      subtopic: st,
    }));

    onUpdateSubject({
      ...subject,
      tasks: [...subject.tasks, ...createdTasks],
    });

    setSubtopicTaskNotice(
      `Se han desglosado ${createdTasks.length} subtemas de "${topic.title}" en tareas individuales.`
    );
    setTimeout(() => setSubtopicTaskNotice(null), 4000);
  };

  const handleLogTopicReview = (
    topicId: string,
    quality: ReviewQuality = 'bien',
    options?: { errorsCount?: number; retentionPct?: number }
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const history = t.reviewsHistory || [];
        const topicErrors =
          options?.errorsCount !== undefined
            ? options.errorsCount
            : subject.errorLogs.filter(
                (e) =>
                  !e.resolved &&
                  (e.topicId === t.id ||
                    (e.topicTitle && e.topicTitle.toLowerCase().includes(t.title.toLowerCase())) ||
                    (e.concept && e.concept.toLowerCase().includes(t.title.toLowerCase())))
              ).length;

        const pageInfo = schedulerService.getTopicStudiedPages(t);
        const pagesReviewed =
          pageInfo.studiedPages > 0 ? pageInfo.studiedPages : pageInfo.totalPages;

        const calc = schedulerService.getNextSpacedReview(t.reviewLevel || 0, quality, {
          errorsCount: topicErrors,
          retentionPct: options?.retentionPct ?? t.perceivedRetentionPct,
          baseDateStr: todayStr,
          studiedPages: pagesReviewed,
          totalPages: pageInfo.totalPages,
          difficulty: t.difficulty,
        });
        const nextCount = history.length + 1;

        return {
          ...t,
          status: 'repasado' as const,
          reviewLevel: calc.nextLevel,
          nextReviewDate: calc.nextDate,
          studiedAt: t.studiedAt || todayStr,
          pagesRead: Math.max(t.pagesRead || 0, pagesReviewed),
          perceivedRetentionPct: calc.inferredRetentionPct,
          unresolvedErrorsCount: topicErrors,
          lastIntervalDays: calc.adjustedIntervalDays,
          lastAdjustmentReason: calc.adjustmentNote,
          vueltasCount: Math.max(t.vueltasCount || 0, nextCount),
          reviewsHistory: [
            ...history,
            {
              date: todayStr,
              quality,
              retentionPct: calc.inferredRetentionPct,
              errorsCount: topicErrors,
              intervalDaysUsed: calc.adjustedIntervalDays,
              adjustmentNote: calc.adjustmentNote,
              pagesReviewed,
              totalTopicPages: pageInfo.totalPages,
              estimatedReviewMinutes: calc.estimatedReviewMinutes,
            },
          ],
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Adelantar o espaciar el repaso de un tema según errores cometidos o retención demostrada/percibida
  const handleAdjustTopicReviewByRetention = (
    topicId: string,
    mode: 'adelantar_baja_retencion' | 'espaciar_alta_retencion' | 'restaurar_curva'
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const topicErrors = subject.errorLogs.filter(
          (e) =>
            !e.resolved &&
            (e.topicId === t.id ||
              (e.topicTitle && e.topicTitle.toLowerCase().includes(t.title.toLowerCase())) ||
              (e.concept && e.concept.toLowerCase().includes(t.title.toLowerCase())))
        ).length;
        const adjusted = schedulerService.adjustTopicReviewSchedule(t, mode, {
          errorsCount:
            mode === 'adelantar_baja_retencion'
              ? Math.max(1, topicErrors || (t.unresolvedErrorsCount || 0) + 1)
              : 0,
        });
        return {
          ...t,
          status: t.status === 'pendiente' ? ('estudiado' as const) : t.status,
          studiedAt: t.studiedAt || todayStr,
          reviewLevel: adjusted.reviewLevel,
          nextReviewDate: adjusted.nextReviewDate,
          perceivedRetentionPct: adjusted.perceivedRetentionPct,
          unresolvedErrorsCount: adjusted.unresolvedErrorsCount,
          lastIntervalDays: adjusted.lastIntervalDays,
          lastAdjustmentReason: adjusted.lastAdjustmentReason,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Guardar ajuste manual de fecha de repaso, páginas estudiadas y autoevaluación de retención
  const handleSaveManualTopicReviewSchedule = (
    topicId: string,
    updatedData: {
      nextReviewDate: string;
      perceivedRetentionPct: number;
      reviewLevel: number;
      lastIntervalDays: number;
      lastAdjustmentReason: string;
      unresolvedErrorsCount?: number;
      pagesRead?: number;
      pageCount?: number;
      newReviewRecord?: any;
    }
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updatedTopics = subject.topics.map((t) => {
      if (t.id === topicId) {
        const history = updatedData.newReviewRecord
          ? [...(t.reviewsHistory || []), updatedData.newReviewRecord]
          : t.reviewsHistory;
        return {
          ...t,
          status: t.status === 'pendiente' ? ('estudiado' as const) : t.status,
          studiedAt: t.studiedAt || todayStr,
          nextReviewDate: updatedData.nextReviewDate,
          perceivedRetentionPct: updatedData.perceivedRetentionPct,
          reviewLevel: updatedData.reviewLevel,
          lastIntervalDays: updatedData.lastIntervalDays,
          lastAdjustmentReason: updatedData.lastAdjustmentReason,
          pagesRead: updatedData.pagesRead !== undefined ? updatedData.pagesRead : t.pagesRead,
          pageCount: updatedData.pageCount !== undefined ? updatedData.pageCount : t.pageCount,
          unresolvedErrorsCount:
            updatedData.unresolvedErrorsCount !== undefined
              ? updatedData.unresolvedErrorsCount
              : t.unresolvedErrorsCount,
          reviewsHistory: history,
        };
      }
      return t;
    });

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
  };

  // Add new task
  const handleAddTask = () => {
    const linkedTopic = subject.topics.find((t) => t.id === newTaskTopicId);
    const computedTitle = newTaskTitle.trim()
      ? newTaskTitle.trim()
      : linkedTopic && newTaskSubtopic
      ? `${linkedTopic.title}: ${newTaskSubtopic}`
      : '';
    if (!computedTitle) return;

    const totalSubtopics = linkedTopic ? Math.max(1, (linkedTopic.subtopics || []).length) : 1;
    const estimatedMins =
      linkedTopic && newTaskSubtopic
        ? Math.max(15, Math.round(((linkedTopic.estimatedHours || 1.5) * 60) / totalSubtopics))
        : undefined;

    const newTask: Task = {
      id: `tsk-${Date.now()}`,
      title: computedTitle,
      dueDate: newTaskDueDate || new Date().toISOString().split('T')[0],
      priority: newTaskPriority,
      type: newTaskSubtopic ? 'lectura' : 'practica',
      completed:
        linkedTopic && newTaskSubtopic
          ? (linkedTopic.completedSubtopics || []).includes(newTaskSubtopic)
          : false,
      reminder: true,
      durationMinutes: estimatedMins,
      topicId: newTaskTopicId || undefined,
      subtopic: newTaskSubtopic || undefined,
      isGraded: newTaskIsGraded,
      weightPercentage: newTaskWeight ? parseFloat(newTaskWeight) : undefined,
      score: newTaskScore ? parseFloat(newTaskScore) : undefined,
      maxScore: newTaskMaxScore ? parseFloat(newTaskMaxScore) : 10,
    };

    onUpdateSubject({
      ...subject,
      tasks: [...subject.tasks, newTask],
    });

    setNewTaskTitle('');
    setNewTaskTopicId('');
    setNewTaskSubtopic('');
    setNewTaskIsGraded(false);
    setNewTaskWeight('');
    setNewTaskScore('');
    setShowAddTask(false);
  };

  // Create empty Cornell note
  const handleCreateEmptyNote = () => {
    const newNote: CornellNote = {
      id: `cor-${Date.now()}`,
      title: 'Nuevos Apuntes Cornell',
      cues: [],
      notes: '',
      summary: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceType: 'manual',
    };

    onUpdateSubject({
      ...subject,
      cornellNotes: [newNote, ...subject.cornellNotes],
    });
    setActiveNoteId(newNote.id);
  };

  const activeCornellNote = subject.cornellNotes.find((n) => n.id === activeNoteId);

  // Statistics calculation for this subject (integrating read pages and user reading speed per page)
  const subjectAcademicProgress = schedulerService.calculateSubjectAcademicProgress(
    subject.topics,
    preferences
  );
  const totalTopics = subjectAcademicProgress.totalTopics;
  const studiedTopics = subjectAcademicProgress.completedTopics;
  const inProgressTopics = subjectAcademicProgress.inProgressTopics;
  const progressPercent = subjectAcademicProgress.progressPct;
  const subjectStudyStats = schedulerService.calculateSubjectEstimatedStudyHours(
    subject.topics,
    preferences
  );
  const totalEstimatedHours = subjectStudyStats.totalEstimatedHours;
  const remainingHours = subjectAcademicProgress.remainingHours;

  // Spaced reviews due today or overdue
  const todayStr = new Date().toISOString().split('T')[0];
  const reviewsDueToday = subject.topics.filter(
    (t) => t.nextReviewDate && t.nextReviewDate <= todayStr
  );

  const progressAlert = checkSubjectProgressAlert(subject);
  const printedTopicsCount = subject.topics.filter((t) => t.isPrinted || t.impreso).length;
  const digitalCount = totalTopics - printedTopicsCount;
  const allProfessors = subject.professors && subject.professors.length > 0
    ? subject.professors
    : (subject.professor ? [subject.professor] : []);

  return (
    <SubjectAiErrorBoundary subjectName={subject.name}>
    <div className="space-y-6">
      {/* Subject Header Banner Visual */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="h-2 w-full"
          style={{ backgroundColor: subject.color || '#3b82f6' }}
        />
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              {/* Anillo SVG de Dominio de la Materia */}
              {(() => {
                const r = 30;
                const c = 2 * Math.PI * r;
                const off = c - (progressPercent / 100) * c;
                return (
                  <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                    <svg className="w-18 h-18 -rotate-90" viewBox="0 0 72 72">
                      <circle
                        cx="36"
                        cy="36"
                        r={r}
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth="6"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r={r}
                        fill="none"
                        stroke={
                          progressAlert.isAlert
                            ? '#f59e0b'
                            : progressPercent >= 80
                            ? '#10b981'
                            : subject.color || '#3b82f6'
                        }
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={off}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-extrabold font-mono-numbers text-slate-900 leading-none">
                        {progressPercent}%
                      </span>
                      <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
                        {subject.currentVuelta || 1}ª Vuelta
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1 flex-wrap">
                  {subject.code && (
                    <>
                      <span
                        className="font-mono-numbers text-white px-2 py-0.5 rounded font-bold text-[11px]"
                        style={{ backgroundColor: subject.color || '#3b82f6' }}
                      >
                        {subject.code}
                      </span>
                      <span className="text-slate-300">·</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(subject.name);
                      setEditCode(subject.code || '');
                      setEditColor(subject.color || '#3b82f6');
                      setEditCredits(
                        subject.credits !== undefined && subject.credits > 0
                          ? String(subject.credits)
                          : ''
                      );
                      setEditProf(subject.professor || '');
                      setEditProfessorsList(allProfessors);
                      setShowEditSubjectModal(true);
                    }}
                    className="font-mono-numbers text-slate-700 hover:text-blue-700 font-semibold cursor-pointer inline-flex items-center gap-1.5 bg-slate-100 hover:bg-blue-50 px-2.5 py-0.5 rounded-md transition-colors"
                    title="Editar créditos ECTS (opcional), docentes, color o datos de la asignatura"
                  >
                    {subject.credits !== undefined && subject.credits > 0 ? (
                      <span>{subject.credits} ECTS</span>
                    ) : (
                      <span className="font-sans text-slate-400 font-normal">
                        + Créditos (opcional)
                      </span>
                    )}
                    {allProfessors.length > 0 && (
                      <>
                        <span className="text-slate-300 font-sans">·</span>
                        <span className="font-sans text-slate-700 font-medium">
                          {allProfessors.length > 1 ? 'Docentes:' : 'Prof.'} {allProfessors.join(', ')}
                        </span>
                      </>
                    )}
                    <Edit3 className="w-3 h-3 text-blue-600 ml-0.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {subject.name}
                  </h2>
                  {progressAlert.isAlert && (
                    <div
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold shadow-2xs"
                      title={`Aviso de ritmo: ${progressAlert.progressPct}% estudiado tras ${progressAlert.weeksSinceCourseStart} semanas desde el inicio del curso (${progressAlert.courseStartDate}).`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>&lt; 20% avance ({progressAlert.progressPct}%)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          {/* Simplified Quick Action Bar: Primary Study Button + Unified AI & Study Tools Dropdown */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onSelectForPomodoro(subject.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Estudiar con Pomodoro</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFeynmanChallengeTopicId(subject.topics[0]?.id);
                setFeynmanChallengeSubtopic(undefined);
                setActiveTab('feynman_challenge');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
              title="Abrir módulo FeynmanChallenge para explicar un tema con tus propias palabras y analizar simplicidad y precisión con IA"
            >
              <Brain className="w-3.5 h-3.5 text-purple-600" />
              <span>Reto Feynman IA</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHeaderToolsMenu((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-2xs ${
                  showHeaderToolsMenu
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="Abrir herramientas de estudio IA, diagramas, mapas mentales y registro de errores"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Herramientas IA y Estudio</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {showHeaderToolsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowHeaderToolsMenu(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100">
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderToolsMenu(false);
                          setFlashcardGenTopicId(undefined);
                          setFlashcardGenNoteId(undefined);
                          setIsFlashcardGeneratorOpen(true);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-semibold">Flashcards con IA ({subject.flashcards.length})</div>
                          <div className="text-[10px] text-slate-400">Generar tarjetas de Active Recall</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderToolsMenu(false);
                          handleOpenCornellMindmapForTopic(
                            subject.topics[0]?.id,
                            subject.mindmaps.length === 0
                          );
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <GitBranch className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="font-semibold">Mapa Mental Cornell (D3.js)</div>
                          <div className="text-[10px] text-slate-400">Árbol jerárquico interactivo</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderToolsMenu(false);
                          setSelectedDiagramTopic(null);
                          setIsDiagramModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Network className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <div className="font-semibold">Diagrama Visual (SVG)</div>
                          <div className="text-[10px] text-slate-400">Esquema conceptual Mermaid</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderToolsMenu(false);
                          setFeynmanChallengeTopicId(subject.topics[0]?.id);
                          setFeynmanChallengeSubtopic(undefined);
                          setActiveTab('feynman_challenge');
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Brain className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                          <div className="font-semibold">Reto Feynman (FeynmanChallenge)</div>
                          <div className="text-[10px] text-slate-400">Explicar con tus palabras y corregir con IA</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderToolsMenu(false);
                          setSelectedFeynmanConcept('');
                          setIsFeynmanModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                          <div className="font-semibold">Simplificador de Conceptos IA</div>
                          <div className="text-[10px] text-slate-400">Pedir explicación intuitiva a la IA</div>
                        </div>
                      </button>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderToolsMenu(false);
                          setIsErrorModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-semibold">
                            Mis Errores ({subject.errorLogs.filter((e) => !e.resolved).length})
                          </div>
                          <div className="text-[10px] text-slate-400">Cuaderno de fallos y repaso</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mapa Interactivo de Temas en la Cabecera */}
        {subject.topics.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
              <span className="font-semibold text-slate-700">
                Mapa rápido del temario (haz clic en cualquier bloque para abrir sus apuntes)
              </span>
              <div className="flex items-center gap-3 font-mono-numbers">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-emerald-500" />
                  <span>{studiedTopics} estudiados</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-amber-400" />
                  <span>{inProgressTopics} en lectura</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-slate-200" />
                  <span>{Math.max(0, totalTopics - studiedTopics - inProgressTopics)} pend.</span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-1.5">
              {subject.topics.map((t, idx) => {
                const isDone = t.status === 'estudiado' || t.status === 'repasado';
                const isProg = t.status === 'en_progreso';
                const vCount = t.vueltasCount || (isDone ? 1 : 0);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedNotesTopic(t);
                      setIsNotesModalOpen(true);
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-1 ${
                      isDone
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                        : isProg
                        ? 'bg-amber-50/90 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                    title={`Tema ${idx + 1}: ${t.title} — ${t.status} (clic para abrir Apuntes)`}
                  >
                    <span className="text-[10px] font-mono-numbers font-bold">T{idx + 1}</span>
                    <span className="text-[9px] font-mono-numbers opacity-75">
                      {vCount > 0 ? `${vCount}V` : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Banner de aviso de progreso si < 20% tras > 2 semanas */}
        {progressAlert.isAlert && (
          <div className="mt-5 p-4 bg-gradient-to-r from-amber-50/95 via-orange-50/90 to-amber-50/80 border border-amber-300/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in duration-200">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h5 className="font-bold text-amber-950 text-sm">
                  Aviso de ritmo académico: Temario por debajo del 20%
                </h5>
                <p className="text-amber-900/80 text-xs mt-0.5 leading-relaxed">
                  Han transcurrido {progressAlert.weeksSinceCourseStart} semanas desde el inicio del curso escolar ({progressAlert.courseStartDate}) y esta asignatura lleva un {progressAlert.progressPct}% de progreso ({progressAlert.studiedTopics} de {progressAlert.totalTopics} temas estudiados).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('temario')}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              Ver Temario
            </button>
          </div>
        )}

        {/* Centralized AI Error & Feedback Banner inside SubjectDetailView */}
        {aiErrorBanner && (
          <div className="mt-5 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-rose-900 shadow-2xs animate-in fade-in duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-rose-950 text-sm">
                  No se pudo completar: {aiErrorBanner.actionTitle}
                </h5>
                <p className="text-rose-800 leading-relaxed">
                  <strong>Motivo:</strong> {aiErrorBanner.reason}
                </p>
                <p className="text-rose-700/90 text-[11px]">
                  💡 {aiErrorBanner.suggestion}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiErrorBanner(null)}
              className="p-1.5 text-rose-500 hover:text-rose-800 rounded-lg cursor-pointer shrink-0"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {aiSuccessBanner && (
          <div className="mt-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900 shadow-2xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{aiSuccessBanner.message}</span>
            </div>
            <div className="flex items-center gap-2">
              {aiSuccessBanner.topicId && (
                <button
                  type="button"
                  onClick={() => {
                    const target = subject.topics.find((t) => t.id === aiSuccessBanner.topicId);
                    if (target) {
                      setSelectedNotesTopic(target);
                      setIsNotesModalOpen(true);
                    }
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Abrir en Apuntes
                </button>
              )}
              <button
                type="button"
                onClick={() => setAiSuccessBanner(null)}
                className="p-1 text-emerald-700 hover:text-emerald-950 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 4 Tarjetas de Métricas Visuales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Lectura y Temas</span>
              <span className="text-sm font-extrabold font-mono-numbers text-slate-900">
                {progressPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden my-2">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor:
                    progressPercent >= 80
                      ? '#10b981'
                      : progressAlert.isAlert
                      ? '#f59e0b'
                      : subject.color || '#2563eb',
                }}
              />
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers">
              <strong>{subjectAcademicProgress.pagesRead}</strong>/{subjectAcademicProgress.totalPages} págs · {studiedTopics}/{totalTopics} temas
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Tiempo Pendiente</span>
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-lg font-extrabold font-mono-numbers text-slate-900 mt-1">
              {Math.round(remainingHours * 10) / 10}h{' '}
              <span className="text-xs font-normal text-slate-400">
                / {Math.round(totalEstimatedHours * 10) / 10}h
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers mt-0.5">
              {subjectAcademicProgress.remainingPages} págs rest. (~{subjectStudyStats.readingSpeedPagesPerHour} págs/h)
            </div>
          </div>

          <div
            onClick={() => setActiveTab('vueltas')}
            className="p-3.5 rounded-xl bg-slate-50/80 hover:bg-blue-50/50 border border-slate-200/70 cursor-pointer transition-colors"
            title="Haz clic para abrir el control detallado de Vueltas al Temario"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Control de Vueltas</span>
              <span className="text-xs font-extrabold font-mono-numbers text-blue-600">
                {subject.currentVuelta || 1}ª Vuelta →
              </span>
            </div>
            <div className="text-lg font-extrabold font-mono-numbers mt-1 text-slate-900">
              {reviewsDueToday.length > 0 ? (
                <span className="text-amber-600">{reviewsDueToday.length} SR hoy</span>
              ) : (
                <span className="text-emerald-600">SR al día ✓</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {subject.flashcards.length} flashcards · {subject.cornellNotes.length} apuntes
            </div>
          </div>

          <div
            onClick={() => setActiveTab('examenes')}
            className="p-3.5 rounded-xl bg-slate-50/80 hover:bg-blue-50/50 border border-slate-200/70 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Próximo Examen</span>
              <Calendar className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-sm font-bold text-slate-900 mt-1.5 truncate">
              {subject.exams.filter((e) => !e.completed)[0]?.title || 'Sin examen programado'}
            </div>
            <div className="text-[11px] text-slate-500 font-mono-numbers mt-0.5">
              {subject.exams.filter((e) => !e.completed)[0]?.date || 'Haz clic para añadir fecha'}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Spaced Repetition Due Alert Banner */}
      {reviewsDueToday.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
              <RotateCw className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                ¡Tienes {reviewsDueToday.length} tema(s) pendientes de repaso espaciado hoy!
              </h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                La curva del olvido indica que repasar hoy fija estos conceptos en la memoria a largo plazo: {reviewsDueToday.map((t) => t.title).join(', ')}.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('active_recall')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Hacer Active Recall
          </button>
        </div>
      )}

      {/* Consola Visual de Secciones de la Asignatura (Tarjetas Interactivas con Progreso en Vivo) */}
      {(() => {
        const totalAttachedDocs = subject.topics.reduce(
          (acc, t) => acc + (t.attachedFiles?.length || 0),
          0
        );
        const topicsWithNotesCount = subject.topics.filter(
          (t) =>
            (t.generalNotes && t.generalNotes.trim().length > 0) ||
            (t.attachedFiles && t.attachedFiles.length > 0)
        ).length;
        const notesCoveragePct =
          totalTopics > 0
            ? Math.min(
                100,
                Math.round(
                  ((topicsWithNotesCount + subject.cornellNotes.length) /
                    Math.max(1, totalTopics)) *
                    100
                )
              )
            : subject.cornellNotes.length > 0
            ? 100
            : 0;

        const v1Count = subject.topics.filter(
          (t) =>
            (t.vueltasCount || 0) >= 1 ||
            t.status === 'estudiado' ||
            t.status === 'repasado'
        ).length;
        const v2Count = subject.topics.filter(
          (t) => (t.vueltasCount || 0) >= 2 || (t.reviewLevel || 0) >= 1
        ).length;
        const v3Count = subject.topics.filter(
          (t) => (t.vueltasCount || 0) >= 3 || (t.reviewLevel || 0) >= 2
        ).length;
        const v1Pct = totalTopics > 0 ? Math.round((v1Count / totalTopics) * 100) : 0;
        const v2Pct = totalTopics > 0 ? Math.round((v2Count / totalTopics) * 100) : 0;
        const v3Pct = totalTopics > 0 ? Math.round((v3Count / totalTopics) * 100) : 0;

        const feynmanPct =
          totalTopics > 0
            ? Math.min(100, Math.round((subject.feynmanSessions.length / totalTopics) * 100))
            : subject.feynmanSessions.length > 0
            ? 100
            : 0;

        const recallReadyPct =
          totalTopics > 0
            ? Math.min(
                100,
                Math.round((subject.flashcards.length / Math.max(1, totalTopics * 3)) * 100)
              )
            : subject.flashcards.length > 0
            ? 100
            : 0;

        const nextUpcomingExam = subject.exams
          .filter((e) => !e.completed)
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
        const completedExamsCount = subject.exams.filter((e) => e.completed).length;
        const examsPct =
          subject.exams.length > 0
            ? Math.round((completedExamsCount / subject.exams.length) * 100)
            : progressPercent;

        const completedTasksCount = subject.tasks.filter((t) => t.completed).length;
        const tasksPct =
          subject.tasks.length > 0
            ? Math.round((completedTasksCount / subject.tasks.length) * 100)
            : 0;

        const displayGrade =
          subjectGradeSummary.weightedAverageGrade !== null
            ? subjectGradeSummary.weightedAverageGrade
            : subjectGradeSummary.simpleAverageGraded;
        const gradePct =
          displayGrade !== null ? Math.min(100, Math.round((displayGrade / 10) * 100)) : 0;

        const coreVisualTabs = [
          {
            id: 'temario',
            title: 'Temario',
            metric: `${studiedTopics}/${totalTopics}`,
            sublabel: `${subjectAcademicProgress.pagesRead}/${subjectAcademicProgress.totalPages} págs`,
            pct: progressPercent,
            icon: BookOpen,
            activeBg: 'bg-blue-50/90 border-blue-500 text-blue-950 ring-2 ring-blue-500/15',
            iconBg: 'bg-blue-600 text-white',
            barColor: 'bg-blue-600',
          },
          {
            id: 'vueltas',
            title: 'Vueltas',
            metric: `${subject.currentVuelta || 1}ª Vuelta`,
            sublabel: `1V ${v1Pct}% · 2V ${v2Pct}% · 3V ${v3Pct}%`,
            pct: v1Pct,
            isVueltas: true,
            v1Pct,
            v2Pct,
            v3Pct,
            icon: RotateCw,
            activeBg: 'bg-indigo-50/90 border-indigo-500 text-indigo-950 ring-2 ring-indigo-500/15',
            iconBg: 'bg-indigo-600 text-white',
            barColor: 'bg-indigo-600',
          },
          {
            id: 'apuntes',
            title: 'Apuntes',
            metric: `${subject.cornellNotes.length + totalAttachedDocs}`,
            sublabel: `${subject.cornellNotes.length} Cornell · ${totalAttachedDocs} PDFs`,
            pct: notesCoveragePct,
            icon: FileText,
            activeBg: 'bg-sky-50/90 border-sky-500 text-sky-950 ring-2 ring-sky-500/15',
            iconBg: 'bg-sky-600 text-white',
            barColor: 'bg-sky-500',
          },
          {
            id: 'feynman_challenge',
            title: 'Reto Feynman',
            metric: `${subject.feynmanSessions.length}`,
            sublabel:
              subject.feynmanSessions.length > 0
                ? `${subject.feynmanSessions.length} explicaciones IA`
                : 'Explicar con IA',
            pct: feynmanPct,
            icon: Brain,
            activeBg: 'bg-purple-50/90 border-purple-500 text-purple-950 ring-2 ring-purple-500/15',
            iconBg: 'bg-purple-600 text-white',
            barColor: 'bg-purple-600',
          },
          {
            id: 'active_recall',
            title: 'Active Recall',
            metric: `${subject.flashcards.length}`,
            sublabel:
              reviewsDueToday.length > 0
                ? `${reviewsDueToday.length} repaso(s) hoy`
                : 'Tarjetas al día',
            pct: recallReadyPct,
            icon: Sparkles,
            activeBg:
              'bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/15',
            iconBg: 'bg-emerald-600 text-white',
            barColor: 'bg-emerald-500',
          },
          {
            id: 'examenes',
            title: 'Exámenes',
            metric: `${subject.exams.length}`,
            sublabel: nextUpcomingExam
              ? `Próx: ${nextUpcomingExam.date}`
              : 'Gestionar fechas',
            pct: examsPct,
            icon: Calendar,
            activeBg: 'bg-rose-50/90 border-rose-500 text-rose-950 ring-2 ring-rose-500/15',
            iconBg: 'bg-rose-600 text-white',
            barColor: 'bg-rose-500',
          },
        ];

        const secondaryVisualTabs = [
          {
            id: 'tareas',
            title: 'Tareas y Entregas',
            metric: `${completedTasksCount}/${subject.tasks.length}`,
            sublabel: `${tasksPct}% completadas`,
            pct: tasksPct,
            icon: LayoutList,
            colorClass: 'text-amber-600',
            barColor: 'bg-amber-500',
          },
          {
            id: 'calificaciones',
            title: 'Calificaciones y Nota',
            metric: displayGrade !== null ? `${displayGrade.toFixed(1)}/10` : '—/10',
            sublabel: `${subjectGradeSummary.gradedWeightEvaluated}% peso evaluado`,
            pct: gradePct,
            icon: Calculator,
            colorClass: 'text-emerald-600',
            barColor: 'bg-emerald-500',
          },
          {
            id: 'proyectos',
            title: 'Proyectos y Fases',
            metric: `${(subject.projects || []).length}`,
            sublabel: 'Hitos y entregas',
            pct: (subject.projects || []).length > 0 ? 100 : 0,
            icon: FolderKanban,
            colorClass: 'text-blue-600',
            barColor: 'bg-blue-500',
          },
          {
            id: 'mapas_mentales',
            title: 'Mapas Mentales',
            metric: `${subject.mindmaps.length}`,
            sublabel: 'Árboles D3.js e IA',
            pct: subject.mindmaps.length > 0 ? 100 : 0,
            icon: GitBranch,
            colorClass: 'text-indigo-600',
            barColor: 'bg-indigo-500',
          },
        ];

        const isSidebarNav = preferences?.navigationPosition === 'sidebar';

        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs space-y-2.5">
            {/* Fila 1: 6 Tarjetas Visuales Principales */}
            <div
              className={`grid grid-cols-2 sm:grid-cols-3 ${
                isSidebarNav ? 'xl:grid-cols-6' : 'lg:grid-cols-6'
              } gap-2.5`}
            >
              {coreVisualTabs.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setShowMoreTabsMenu(false);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 group ${
                      isActive
                        ? tab.activeBg
                        : 'bg-slate-50/70 hover:bg-white border-slate-200/80 hover:border-slate-300 text-slate-800 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                          isActive
                            ? tab.iconBg
                            : 'bg-white border border-slate-200/90 text-slate-700'
                        }`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-extrabold font-mono-numbers tracking-tight">
                        {tab.metric}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold leading-snug truncate">{tab.title}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5 font-mono-numbers">
                        {tab.sublabel}
                      </div>
                    </div>

                    {/* Indicador visual inferior: triple barra para Vueltas o barra de progreso */}
                    {tab.isVueltas ? (
                      <div className="grid grid-cols-3 gap-1 pt-0.5">
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{ width: `${tab.v1Pct}%` }}
                          />
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${tab.v2Pct}%` }}
                          />
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${tab.v3Pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${tab.barColor}`}
                          style={{ width: `${Math.max(isActive ? 12 : 0, tab.pct)}%` }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Fila 2: 4 Accesos Visuales Complementarios (Tareas, Calificaciones, Proyectos, Mapas Mentales) */}
            <div
              className={`grid grid-cols-2 ${
                isSidebarNav ? 'xl:grid-cols-4' : 'lg:grid-cols-4'
              } gap-2 pt-1 border-t border-slate-100`}
            >
              {secondaryVisualTabs.map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setShowMoreTabsMenu(false);
                    }}
                    className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200/70 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <IconComponent
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-white' : tab.colorClass
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold truncate">{tab.title}</div>
                        <div
                          className={`text-[10px] truncate ${
                            isActive ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {tab.sublabel}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-extrabold font-mono-numbers shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {tab.metric}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Tab 1: Temario y Cálculo de tiempo promedio */}
      {activeTab === 'temario' && (() => {
        const printedTopicsCount = subject.topics.filter((t) => t.isPrinted || t.impreso).length;
        const digitalTopicsCount = subject.topics.length - printedTopicsCount;
        const displayedTopics = subject.topics.filter((t) => {
          const isPr = !!(t.isPrinted || t.impreso);
          if (topicPrintedFilter === 'printed') return isPr;
          if (topicPrintedFilter === 'digital') return !isPr;
          return true;
        });

        const subjectDailyPlan = schedulerService.calculateSubjectDailyPageStudyPlan(
          subject,
          preferences
        );
        const pendingPlanItems = Object.values(subjectDailyPlan.topicPlans).filter(
          (tp) => tp.remainingPages > 0
        );
        const activeSpacedPlanItems = Object.values(subjectDailyPlan.topicPlans).filter(
          (tp) => tp.hasSpacedRepetition
        );

        return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  Temario Oficial y Plan de Estudio
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenPreferences?.()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-mono-numbers font-bold transition-colors cursor-pointer"
                  title="Velocidad de Lectura Promedio (páginas por hora) configurada en tus preferencias (haz clic para personalizar)"
                >
                  <BookOpen className="w-3 h-3 text-indigo-600" />
                  <span>
                    Velocidad: {subjectStudyStats.readingSpeedPagesPerHour} págs/h (~{subjectStudyStats.configuredMinutesPerPage} min/pág)
                  </span>
                </button>
                {subject.topics.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRecalculateSubjectTopicsByReadingSpeed}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-[10px] font-semibold transition-colors cursor-pointer"
                    title="Recalcular las horas estimadas de los temas pendientes según tu Velocidad de Lectura Promedio"
                  >
                    <RotateCw className="w-2.5 h-2.5" />
                    <span>Recalcular tiempos por páginas</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {subjectStudyStats.totalPages > 0 ? (
                  <span>
                    Pendientes: <strong className="font-mono-numbers text-indigo-700">{subjectStudyStats.pendingEstimatedHours.toFixed(1)}h</strong> ({subjectStudyStats.pendingTopicsCount} temas pend. · {subjectStudyStats.pendingPages} págs restantes) · Total curso: <strong className="font-mono-numbers text-slate-700">{subjectStudyStats.totalPages} págs</strong> ({subjectStudyStats.pagesRead} leídas → <strong className="font-mono-numbers text-blue-700">{subjectStudyStats.totalEstimatedHours.toFixed(1)}h</strong>)
                  </span>
                ) : (
                  <span>El tiempo estimado de los temas pendientes se calcula automáticamente a partir de su número de páginas y tu Velocidad de Lectura Promedio ({subjectStudyStats.readingSpeedPagesPerHour} págs/hora).</span>
                )}
              </p>
            </div>

            {/* Simplified Temario Toolbar: Compact Filter Select + View Switcher + Add Topic */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={topicPrintedFilter}
                onChange={(e) => setTopicPrintedFilter(e.target.value as 'all' | 'printed' | 'digital')}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-semibold focus:outline-none cursor-pointer shadow-2xs"
                title="Filtrar temas por formato (Todos, Impresos o Digitales)"
              >
                <option value="all">Todos ({subject.topics.length})</option>
                <option value="printed">🖨️ Impresos ({printedTopicsCount})</option>
                <option value="digital">💻 Digitales ({digitalTopicsCount})</option>
              </select>

              <button
                type="button"
                onClick={() => setTopicViewMode(topicViewMode === 'lista' ? 'kanban' : 'lista')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                title="Alternar entre vista en Lista y Tablero Kanban"
              >
                {topicViewMode === 'lista' ? (
                  <>
                    <Kanban className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ver Kanban</span>
                  </>
                ) : (
                  <>
                    <LayoutList className="w-3.5 h-3.5 text-slate-700" />
                    <span>Ver Lista</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowAddTopic(!showAddTopic)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Tema</span>
              </button>
            </div>
          </div>

          {/* Panel de Plan Diario de Páginas por Tema y Repasos Espaciados (1, 3, 7, 15, 30d) dentro de la Materia */}
          {subject.topics.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 border border-blue-200/80 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Plan Diario de Páginas a Estudiar y Repasos Espaciados (1, 3, 7, 15, 30d)
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      {subjectDailyPlan.remainingPages > 0 ? (
                        <>
                          Necesitas estudiar{' '}
                          <strong className="text-blue-700 font-mono-numbers">
                            {subjectDailyPlan.globalPagesPerDayNeeded} págs/día
                          </strong>{' '}
                          ({subjectDailyPlan.remainingPages} págs restantes en{' '}
                          {subjectDailyPlan.availableStudyDaysToExam} días de estudio disponibles)
                          {subjectDailyPlan.nextExam
                            ? ` para llegar a tiempo a ${subjectDailyPlan.nextExam.title} (${subjectDailyPlan.nextExam.date})`
                            : ' para completar el temario y entregas a tiempo'}
                          .
                        </>
                      ) : (
                        <span className="text-emerald-700 font-semibold">
                          ¡Has completado la lectura de todas las páginas de esta materia! Todos los temas tienen su curva de repaso activa.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono-numbers">
                  <span className="px-2.5 py-1 rounded-xl bg-blue-100/80 text-blue-800 font-bold border border-blue-200">
                    📖 Meta: {subjectDailyPlan.globalPagesPerDayNeeded} págs/día
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-100/80 text-indigo-800 font-bold border border-indigo-200">
                    🧠 Repasos 1-3-7 activos: {activeSpacedPlanItems.length}/{subject.topics.length} temas
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                {/* Columna 1: Qué páginas estudiar cada día para llegar al examen o tarea */}
                <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      <span>Páginas a estudiar por día (para Examen y Tareas)</span>
                    </span>
                    <span className="text-[10px] font-mono-numbers text-slate-500">
                      {pendingPlanItems.length} tema(s) por leer
                    </span>
                  </div>

                  {pendingPlanItems.length === 0 ? (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                      ✓ Todas las páginas del temario están leídas.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {pendingPlanItems.map((tp) => (
                        <div
                          key={tp.topicId}
                          className="p-2 rounded-lg bg-slate-50/90 border border-slate-200/70 text-[11px] flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 truncate">
                              {tp.topicTitle}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono-numbers font-bold text-[10px] shrink-0">
                              {tp.pagesPerDayNeeded} págs/día
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-600">
                            <span>
                              Restan <strong>{tp.remainingPages} págs</strong> (de {tp.totalPages}p) ·{' '}
                              <span className="text-indigo-700 font-semibold">{tp.deadlineLabel}</span>
                            </span>
                            {tp.dailySessions.length > 0 && (
                              <span className="font-mono-numbers font-semibold text-blue-700">
                                Próx: {tp.dailySessions[0].date} (Págs. {tp.dailySessions[0].startPage}–{tp.dailySessions[0].endPage})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Columna 2: Repasos Espaciados (1, 3, 7, 15, 30d) SOLO de temas o páginas marcadas como estudiadas/leídas */}
                <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Repasos Espaciados (1, 3, 7, 15, 30d · Solo lo estudiado/leído)</span>
                    </span>
                    <span className="text-[10px] font-mono-numbers text-slate-500">
                      {activeSpacedPlanItems.length} activo(s)
                    </span>
                  </div>

                  {activeSpacedPlanItems.length === 0 ? (
                    <div className="text-[11px] text-slate-600 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
                      Aún no hay temas ni páginas marcadas como estudiadas/leídas en esta materia.{' '}
                      <strong>
                        Cuando marques páginas como leídas (+1p, +5p) o un tema como «Estudiado», se crearán automáticamente sus repasos espaciados (1, 3, 7, 15 y 30 días).
                      </strong>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {activeSpacedPlanItems.map((tp) => (
                        <div
                          key={tp.topicId}
                          className="p-2 rounded-lg bg-indigo-50/40 border border-indigo-200/70 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 truncate">
                              {tp.topicTitle}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono-numbers font-bold text-[10px] shrink-0">
                              {tp.studiedPages}/{tp.totalPages} págs. leídas
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 font-mono-numbers text-[10px]">
                            {tp.spacedRepetitionSchedule.map((ms) => (
                              <span
                                key={ms.level}
                                className={`px-1.5 py-0.5 rounded border ${
                                  ms.status === 'completed'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : ms.status === 'due_today' || ms.status === 'overdue'
                                    ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                                    : 'bg-white border-indigo-200 text-indigo-700'
                                }`}
                              >
                                {ms.label}: {ms.date.slice(5)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add Topic Form */}
          {showAddTopic && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Nuevo Tema de Estudio
                </h4>
                {(() => {
                  const previewPages = newTopicPages ? parseInt(newTopicPages, 10) : undefined;
                  const effMins = schedulerService.getMinutesPerPage(
                    newTopicDifficulty,
                    preferences?.averageMinutesPerPage,
                    preferences?.useDifficultyScalingForPages
                  );
                  const previewHours = schedulerService.calculateTopicTime(
                    newTopicDifficulty,
                    newTopicSubtopics.length,
                    newTopicDesc.length,
                    previewPages && previewPages > 0 ? previewPages : undefined,
                    preferences
                  );
                  return (
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-mono-numbers font-bold">
                      ⏱ Tiempo estimado: {previewHours}h (
                      {previewPages && previewPages > 0
                        ? `${previewPages} págs × ${effMins} min/pág`
                        : `ritmo ~${effMins} min/pág`}
                      )
                    </span>
                  );
                })()}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Título del tema</label>
                  <input
                    type="text"
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    placeholder="Ejemplo: Inervación del miembro superior y plexo braquial"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nº Páginas (Factor de tiempo)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={newTopicPages}
                    onChange={(e) => setNewTopicPages(e.target.value)}
                    placeholder="Ej: 24 págs"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-mono-numbers focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Dificultad</label>
                  <select
                    value={newTopicDifficulty}
                    onChange={(e) => setNewTopicDifficulty(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none"
                  >
                    <option value="Baja">
                      Baja (~{schedulerService.getMinutesPerPage('Baja', preferences?.averageMinutesPerPage, preferences?.useDifficultyScalingForPages)} min/pág)
                    </option>
                    <option value="Media">
                      Media (~{schedulerService.getMinutesPerPage('Media', preferences?.averageMinutesPerPage, preferences?.useDifficultyScalingForPages)} min/pág)
                    </option>
                    <option value="Alta">
                      Alta (~{schedulerService.getMinutesPerPage('Alta', preferences?.averageMinutesPerPage, preferences?.useDifficultyScalingForPages)} min/pág)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Descripción, conceptos o páginas
                </label>
                <textarea
                  value={newTopicDesc}
                  onChange={(e) => setNewTopicDesc(e.target.value)}
                  placeholder="Detalla qué incluye el tema para que la IA calcule el tiempo con máxima precisión..."
                  rows={2}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none resize-none"
                />
              </div>

              {/* Subtopics Editor for New Topic */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-600">
                    Subtemas del tema ({newTopicSubtopics.length})
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Puedes añadir subtemas manualmente o dejar que la IA los sugiera
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTopicSubtopicInput}
                    onChange={(e) => setNewTopicSubtopicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTopicSubtopicInput.trim()) {
                        e.preventDefault();
                        const items = newTopicSubtopicInput
                          .split(/[,;\n]+/)
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0 && !newTopicSubtopics.includes(s));
                        if (items.length > 0) {
                          setNewTopicSubtopics((prev) => [...prev, ...items]);
                        }
                        setNewTopicSubtopicInput('');
                      }
                    }}
                    placeholder="Escribe un subtema (o varios separados por coma) y pulsa Enter..."
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTopicSubtopicInput.trim()) return;
                      const items = newTopicSubtopicInput
                        .split(/[,;\n]+/)
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0 && !newTopicSubtopics.includes(s));
                      if (items.length > 0) {
                        setNewTopicSubtopics((prev) => [...prev, ...items]);
                      }
                      setNewTopicSubtopicInput('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir subtema</span>
                  </button>
                </div>

                {newTopicSubtopics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    {newTopicSubtopics.map((st, sIdx) => (
                      <div
                        key={sIdx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs"
                      >
                        <span className="font-mono-numbers text-[10px] text-slate-400 font-bold">
                          {sIdx + 1}.
                        </span>
                        <input
                          type="text"
                          value={st}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewTopicSubtopics((prev) =>
                              prev.map((item, idx) => (idx === sIdx ? val : item))
                            );
                          }}
                          className="bg-transparent text-xs text-slate-800 focus:outline-none min-w-[110px]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNewTopicSubtopics((prev) => prev.filter((_, idx) => idx !== sIdx))
                          }
                          className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                          title="Eliminar subtema"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTopic(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddTopic}
                  disabled={isEstimatingTime || !newTopicTitle.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isEstimatingTime ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Calculando tiempo con IA...</span>
                    </>
                  ) : (
                    <span>Guardar y Calcular Tiempo</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Topic View: Kanban Board or List */}
          {topicViewMode === 'kanban' ? (
            <TopicKanbanBoard
              topics={subject.topics}
              subjectName={subject.name}
              subjectColor={subject.color}
              onUpdateTopicStatus={(topicId, newStatus) => handleMarkTopicStatus(topicId, newStatus)}
              onUpdateTopicReviewSchedule={handleSaveManualTopicReviewSchedule}
              onOpenNotes={(t) => {
                setSelectedNotesTopic(t);
                setIsNotesModalOpen(true);
              }}
              onOpenFlashcards={(t) => {
                setFlashcardGenTopicId(t.id);
                setFlashcardGenNoteId(undefined);
                setIsFlashcardGeneratorOpen(true);
              }}
              onOpenDiagram={(t) => {
                setSelectedDiagramTopic(t);
                setIsDiagramModalOpen(true);
              }}
              onOpenFeynman={(title) => {
                setSelectedFeynmanConcept(title);
                setIsFeynmanModalOpen(true);
              }}
              onOpenReadingMode={(t) => setReadingTopic(t)}
              onStartPomodoro={(topicId) => onSelectForPomodoro(subject.id, topicId)}
              onEditTopic={(t) => handleOpenEditTopicModal(t)}
              onDeleteTopic={(topicId) => handleDeleteTopic(topicId)}
            />
          ) : (
            /* Lista Visual de Temas (Tarjetas Estructuradas en 3 Zonas) */
            <div className="space-y-4">
              {displayedTopics.map((topic, idx) => {
                const topicProg = schedulerService.calculateTopicAcademicProgress(
                  topic,
                  preferences
                );
                const effectivePages = schedulerService.getTopicEffectivePages(topic);
                const isMarkingOpen = markingReadPagesTopicId === topic.id;
                const isDone = topic.status === 'estudiado' || topic.status === 'repasado';
                const isProg = topic.status === 'en_progreso' || topicProg.pagesRead > 0;
                const vCount =
                  topic.vueltasCount ||
                  (topic.status === 'repasado' ? 2 : topic.status === 'estudiado' ? 1 : 0);

                // Anillo circular SVG para el tema
                const ringR = 19;
                const ringC = 2 * Math.PI * ringR;
                const ringOff = ringC - (topicProg.progressPct / 100) * ringC;
                const ringStrokeColor =
                  topicProg.progressPct >= 100 || isDone
                    ? '#10b981'
                    : isProg
                    ? subject.color || '#2563eb'
                    : '#cbd5e1';

                return (
                  <div
                    key={topic.id}
                    className={`bg-white rounded-2xl border shadow-2xs hover:shadow-md transition-all overflow-hidden ${
                      isDone
                        ? 'border-emerald-200/90 hover:border-emerald-300'
                        : isProg
                        ? 'border-blue-200/90 hover:border-blue-300'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* ZONA 1: CABECERA VISUAL DEL TEMA (Anillo SVG + Título + Vueltas 1V/2V/3V + Estado + Menú) */}
                    <div className="p-5 pb-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        {/* Anillo SVG del Tema */}
                        <div
                          onClick={() => {
                            if (isMarkingOpen) {
                              setMarkingReadPagesTopicId(null);
                            } else {
                              setMarkingReadPagesTopicId(topic.id);
                              setTempReadPagesInput(String(topicProg.pagesRead));
                              setTempTotalPagesInput(String(topicProg.totalPages));
                            }
                          }}
                          className="relative w-12 h-12 shrink-0 flex items-center justify-center cursor-pointer group/ring"
                          title={`Avance del tema: ${topicProg.progressPct}% (${topicProg.pagesRead}/${topicProg.totalPages} págs. leídas — haz clic para ajustar)`}
                        >
                          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                            <circle
                              cx="24"
                              cy="24"
                              r={ringR}
                              fill="none"
                              stroke="#f1f5f9"
                              strokeWidth="4.5"
                            />
                            <circle
                              cx="24"
                              cy="24"
                              r={ringR}
                              fill="none"
                              stroke={ringStrokeColor}
                              strokeWidth="4.5"
                              strokeLinecap="round"
                              strokeDasharray={ringC}
                              strokeDashoffset={ringOff}
                              className="transition-all duration-500"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[11px] font-extrabold font-mono-numbers text-slate-900 leading-none">
                              T{idx + 1}
                            </span>
                            <span className="text-[8px] font-mono-numbers font-bold text-slate-400 mt-0.5">
                              {topicProg.progressPct}%
                            </span>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Línea de metadatos limpia con separadores tipográficos */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-bold text-slate-700 font-mono-numbers">
                              Tema {idx + 1}
                            </span>
                            <span>·</span>
                            <span
                              className={`font-semibold ${
                                topic.difficulty === 'Alta'
                                  ? 'text-rose-600'
                                  : topic.difficulty === 'Baja'
                                  ? 'text-emerald-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              Dificultad {topic.difficulty}
                            </span>
                            <span>·</span>
                            {effectivePages > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPagesTopicId(topic.id);
                                  setTempPagesInput(String(effectivePages));
                                }}
                                className="text-slate-700 hover:text-blue-700 font-semibold font-mono-numbers inline-flex items-center gap-1 cursor-pointer hover:underline"
                                title="Haz clic para cambiar el número total de páginas de este tema"
                              >
                                <span>{effectivePages} págs</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPagesTopicId(topic.id);
                                  setTempPagesInput('');
                                }}
                                className="text-blue-600 hover:underline text-[11px] font-semibold cursor-pointer"
                              >
                                + Asignar páginas
                              </button>
                            )}
                            <span>·</span>
                            <span className="text-indigo-600 font-semibold font-mono-numbers">
                              {topic.estimatedHours}h est.
                            </span>

                            {(topic.isPrinted || topic.impreso) && (
                              <>
                                <span>·</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleTopicPrinted(topic.id)}
                                  className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                                  title="Tema impreso en papel (clic para cambiar a digital)"
                                >
                                  Impreso
                                </button>
                              </>
                            )}

                            {topic.scheduledDate && (
                              <>
                                <span>·</span>
                                <span className="text-slate-500 font-mono-numbers">
                                  Plan: {topic.scheduledDate}
                                </span>
                              </>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-slate-900 leading-snug">
                            {topic.title}
                          </h4>

                          {topic.description && (
                            <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                              {topic.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Controles Superiores Derecha: Indicador de Vueltas (1V · 2V · 3V) + Selector de Estado + Menú ⋮ */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Indicador Visual Interactivo de 3 Vueltas */}
                        <div
                          className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80"
                          title="Control rápido de vueltas completadas en este tema"
                        >
                          {[1, 2, 3].map((step) => {
                            const activeStep = vCount >= step;
                            return (
                              <button
                                key={step}
                                type="button"
                                onClick={() => {
                                  if (step > vCount) {
                                    handleLogTopicReview(topic.id, 'bien');
                                  } else if (step === vCount && vCount > 0) {
                                    handleDecrementTopicVuelta(topic.id);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-numbers font-extrabold transition-all cursor-pointer ${
                                  activeStep
                                    ? step === 1
                                      ? 'bg-blue-600 text-white shadow-2xs'
                                      : step === 2
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-400 hover:text-slate-700'
                                }`}
                                title={
                                  activeStep
                                    ? `${step}ª Vuelta completada (clic para ajustar)`
                                    : `Marcar ${step}ª Vuelta en este tema`
                                }
                              >
                                {step}V
                              </button>
                            );
                          })}
                        </div>

                        {/* Selector de Estado */}
                        <select
                          value={topic.status}
                          onChange={(e) => handleMarkTopicStatus(topic.id, e.target.value as any)}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-bold cursor-pointer focus:outline-none transition-colors shadow-2xs ${
                            topic.status === 'estudiado'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : topic.status === 'repasado'
                              ? 'bg-purple-50 text-purple-800 border-purple-300'
                              : topic.status === 'en_progreso'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                          title="Estado de estudio del tema"
                        >
                          <option value="pendiente">Pendiente (0%)</option>
                          <option value="en_progreso">En lectura</option>
                          <option value="estudiado">✓ Estudiado (100%)</option>
                          <option value="repasado">★ Repasado</option>
                        </select>

                        {/* Menú de Tres Puntos (MoreVertical) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenActionsMenuTopicId(
                                openActionsMenuTopicId === topic.id ? null : topic.id
                              )
                            }
                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
                              openActionsMenuTopicId === topic.id
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-slate-200 shadow-2xs'
                            }`}
                            title="Más herramientas del tema (Modo Lectura, PDF Cornell, Flashcards, Mapas, Editar, Eliminar)"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionsMenuTopicId === topic.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setOpenActionsMenuTopicId(null)}
                              />
                              <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100">
                                {(() => {
                                  const reviewsCount = topic.reviewsHistory
                                    ? topic.reviewsHistory.length
                                    : 0;
                                  return (
                                    <div className="px-3.5 py-2.5 space-y-2 bg-slate-50/70">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <RotateCw className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                          <div>
                                            <div className="text-xs font-bold text-slate-800 font-mono-numbers">
                                              {reviewsCount}{' '}
                                              {reviewsCount === 1 ? 'repaso' : 'repasos'} · Nivel R
                                              {topic.reviewLevel || 0}/5
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                              Curva: 24h → 3d → 7d → 15d → 30d
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleDecrementTopicVuelta(topic.id)}
                                            disabled={reviewsCount <= 0}
                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 bg-white transition-colors cursor-pointer disabled:opacity-30"
                                            title="Restar 1 repaso (-1)"
                                          >
                                            <Minus className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleLogTopicReview(topic.id, 'bien')}
                                            className="p-1.5 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 bg-indigo-50 transition-colors cursor-pointer"
                                            title="Sumar 1 repaso en la curva estándar (+1)"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-1 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleLogTopicReview(topic.id, 'dificil', {
                                              errorsCount: 2,
                                              retentionPct: 50,
                                            });
                                            setOpenActionsMenuTopicId(null);
                                          }}
                                          className="px-1.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer text-center"
                                        >
                                          ⏪ Baja Ret.
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleLogTopicReview(topic.id, 'bien', {
                                              errorsCount: 0,
                                              retentionPct: 80,
                                            });
                                            setOpenActionsMenuTopicId(null);
                                          }}
                                          className="px-1.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold cursor-pointer text-center"
                                        >
                                          ✓ Estándar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleLogTopicReview(topic.id, 'facil', {
                                              errorsCount: 0,
                                              retentionPct: 95,
                                            });
                                            setOpenActionsMenuTopicId(null);
                                          }}
                                          className="px-1.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer text-center"
                                        >
                                          ⏩ Muy Alta
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsMenuTopicId(null);
                                      setReadingTopic(topic);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-purple-900 hover:bg-purple-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
                                    <div>
                                      <div className="font-bold">Modo Lectura Inmersivo</div>
                                      <div className="text-[10px] text-slate-400">
                                        Pantalla completa con panel Feynman lateral
                                      </div>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsMenuTopicId(null);
                                      handleExportTopicCornellPDF(topic);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Download className="w-4 h-4 text-blue-600 shrink-0" />
                                    <div>
                                      <div className="font-semibold">Exportar PDF Cornell</div>
                                      <div className="text-[10px] text-slate-400">
                                        Descargar ficha estructurada en A4
                                      </div>
                                    </div>
                                  </button>
                                </div>

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsMenuTopicId(null);
                                      setFlashcardGenTopicId(topic.id);
                                      setFlashcardGenNoteId(undefined);
                                      setIsFlashcardGeneratorOpen(true);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                                    <div>
                                      <div className="font-semibold">Flashcards IA (Active Recall)</div>
                                      <div className="text-[10px] text-slate-400">
                                        Generar tarjetas de memoria automáticas
                                      </div>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsMenuTopicId(null);
                                      setSelectedDiagramTopic(topic);
                                      setIsDiagramModalOpen(true);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                                    <div>
                                      <div className="font-semibold">Mapa Conceptual Mermaid</div>
                                      <div className="text-[10px] text-slate-400">
                                        Diagrama interactivo de conceptos
                                      </div>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsMenuTopicId(null);
                                      handleOpenCornellMindmapForTopic(topic.id, true);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <GitBranch className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <div>
                                      <div className="font-semibold">Mapa Mental Cornell (D3.js)</div>
                                      <div className="text-[10px] text-slate-400">
                                        Árbol jerárquico IA desde apuntes Cornell
                                      </div>
                                    </div>
                                  </button>
                                </div>

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsMenuTopicId(null);
                                      handleToggleTopicPrinted(topic.id);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Printer className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <div>
                                      <div className="font-semibold">
                                        {topic.isPrinted || topic.impreso
                                          ? 'Cambiar a Formato Digital'
                                          : 'Marcar como Impreso en Papel'}
                                      </div>
                                    </div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsMenuTopicId(null);
                                      handleOpenEditTopicModal(topic);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4 text-blue-600 shrink-0" />
                                    <div>
                                      <div className="font-semibold">Editar Tema y Subtemas</div>
                                      <div className="text-[10px] text-slate-400">
                                        Título, subtemas, páginas y dificultad
                                      </div>
                                    </div>
                                  </button>
                                </div>

                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionsMenuTopicId(null);
                                      handleDeleteTopic(topic.id);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                                    <span className="font-semibold">Eliminar Tema</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ZONA 2: PROGRESO DE LECTURA VISUAL, ARCHIVOS, SUBTEMAS Y CURVA DEL OLVIDO */}
                    <div className="px-5 pb-4 space-y-3">
                      {/* Editor rápido del total de páginas si se pulsó en "X págs" */}
                      {editingPagesTopicId === topic.id && (
                        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-2 text-xs">
                          <span className="text-blue-900 font-semibold">Nº total de páginas:</span>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={tempPagesInput}
                            onChange={(e) => setTempPagesInput(e.target.value)}
                            placeholder="Ej: 30"
                            className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-mono-numbers text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const p = parseInt(tempPagesInput, 10);
                              if (!isNaN(p) && p > 0) {
                                handleUpdateTopicPages(topic.id, p);
                              }
                            }}
                            className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-xs cursor-pointer"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPagesTopicId(null)}
                            className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      {/* Barra Visual Integrada de Lectura por Páginas */}
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Lectura:</span>
                            </span>
                            <span className="font-mono-numbers font-extrabold text-slate-900">
                              {topicProg.pagesRead}/{topicProg.totalPages} págs ({topicProg.progressPct}%)
                            </span>
                            {topicProg.remainingPages > 0 ? (
                              <span className="text-[11px] text-slate-500 font-mono-numbers">
                                · Restan {topicProg.remainingPages}p (~{topicProg.remainingHours}h)
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-600 font-bold">
                                · Lectura completada ✓
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkTopicPagesRead(
                                  topic.id,
                                  Math.max(0, topicProg.pagesRead - 1),
                                  topicProg.totalPages
                                )
                              }
                              disabled={topicProg.pagesRead <= 0}
                              className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-mono-numbers font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-40"
                            >
                              -1p
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkTopicPagesRead(
                                  topic.id,
                                  Math.min(topicProg.totalPages, topicProg.pagesRead + 1),
                                  topicProg.totalPages
                                )
                              }
                              disabled={topicProg.pagesRead >= topicProg.totalPages}
                              className="px-2 py-0.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-mono-numbers font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-40"
                            >
                              +1p
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkTopicPagesRead(
                                  topic.id,
                                  Math.min(topicProg.totalPages, topicProg.pagesRead + 5),
                                  topicProg.totalPages
                                )
                              }
                              disabled={topicProg.pagesRead >= topicProg.totalPages}
                              className="px-2 py-0.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-mono-numbers font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-40"
                            >
                              +5p
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isMarkingOpen) {
                                  setMarkingReadPagesTopicId(null);
                                } else {
                                  setMarkingReadPagesTopicId(topic.id);
                                  setTempReadPagesInput(String(topicProg.pagesRead));
                                  setTempTotalPagesInput(String(topicProg.totalPages));
                                }
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                isMarkingOpen
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-200'
                              }`}
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span>Deslizador</span>
                            </button>
                          </div>
                        </div>

                        <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              topicProg.progressPct >= 100
                                ? 'bg-emerald-500'
                                : topicProg.progressPct > 0
                                ? 'bg-blue-600'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${topicProg.progressPct}%` }}
                          />
                        </div>

                        {isMarkingOpen && (
                          <div className="pt-2 mt-1 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                              <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                                Páginas leídas:
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={Math.max(
                                  1,
                                  parseInt(tempTotalPagesInput, 10) || topicProg.totalPages
                                )}
                                value={Math.min(
                                  Math.max(
                                    1,
                                    parseInt(tempTotalPagesInput, 10) || topicProg.totalPages
                                  ),
                                  parseInt(tempReadPagesInput, 10) || 0
                                )}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setTempReadPagesInput(String(val));
                                  handleMarkTopicPagesRead(
                                    topic.id,
                                    val,
                                    parseInt(tempTotalPagesInput, 10) || topicProg.totalPages
                                  );
                                }}
                                className="flex-1 accent-blue-600 cursor-pointer"
                              />
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1 text-xs">
                                <input
                                  type="number"
                                  min={0}
                                  max={500}
                                  value={tempReadPagesInput}
                                  onChange={(e) => setTempReadPagesInput(e.target.value)}
                                  className="w-14 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-center font-mono-numbers font-bold text-slate-900 text-xs"
                                />
                                <span className="text-slate-400">/</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={500}
                                  value={tempTotalPagesInput}
                                  onChange={(e) => setTempTotalPagesInput(e.target.value)}
                                  className="w-14 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-center font-mono-numbers text-slate-700 text-xs"
                                />
                                <span className="text-slate-500 text-[11px]">págs</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const readVal = parseInt(tempReadPagesInput, 10);
                                  const totVal = parseInt(tempTotalPagesInput, 10);
                                  handleMarkTopicPagesRead(
                                    topic.id,
                                    !isNaN(readVal) ? readVal : 0,
                                    !isNaN(totVal) && totVal > 0 ? totVal : topicProg.totalPages
                                  );
                                  setMarkingReadPagesTopicId(null);
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                              >
                                Aplicar
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const totVal =
                                    parseInt(tempTotalPagesInput, 10) || topicProg.totalPages;
                                  handleMarkTopicPagesRead(topic.id, totVal, totVal);
                                  setMarkingReadPagesTopicId(null);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                              >
                                ✓ 100%
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Archivos PDF / Documentos Adjuntos al Tema */}
                      {topic.attachedFiles && topic.attachedFiles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {topic.attachedFiles.map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => {
                                setSelectedNotesTopic(topic);
                                setIsNotesModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 text-[11px] bg-blue-50/60 hover:bg-blue-100/80 text-blue-900 border border-blue-200/80 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                              title={`Abrir "${file.name}" (${file.pageCount} págs.) en Apuntes`}
                            >
                              <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                              <span className="font-semibold truncate max-w-[200px]">
                                {file.name}
                              </span>
                              <span className="text-[10px] font-mono-numbers text-blue-700 font-bold">
                                · {file.pageCount}p
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Checklist Visual de Subtemas */}
                      {(() => {
                        const subtopics = topic.subtopics || [];
                        const completedSubtopics = topic.completedSubtopics || [];
                        const isManagingSubtopics = managingSubtopicsTopicId === topic.id;
                        const newSubtopicDraft = addingSubtopicInputByTopic[topic.id] || '';
                        const subtopicProgressPct =
                          subtopics.length > 0
                            ? Math.round((completedSubtopics.length / subtopics.length) * 100)
                            : 0;
                        const linkedTasksForTopic = subject.tasks.filter(
                          (tsk) => tsk.topicId === topic.id && tsk.subtopic
                        );
                        const unlinkedSubtopicsCount = subtopics.filter(
                          (st) => !linkedTasksForTopic.some((tsk) => tsk.subtopic === st)
                        ).length;

                        return (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-700">
                                  Subtemas ({completedSubtopics.length}/{subtopics.length})
                                </span>
                                {subtopics.length > 0 && (
                                  <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full transition-all"
                                      style={{ width: `${subtopicProgressPct}%` }}
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setManagingSubtopicsTopicId(
                                      isManagingSubtopics ? null : topic.id
                                    )
                                  }
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer border ${
                                    isManagingSubtopics
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  <Edit3 className="w-2.5 h-2.5" />
                                  <span>
                                    {isManagingSubtopics ? 'Listo' : 'Editar subtemas'}
                                  </span>
                                </button>

                                {subtopics.length > 0 && unlinkedSubtopicsCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleBreakdownTopicSubtopicsIntoTasks(topic)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                                  >
                                    <LayoutList className="w-2.5 h-2.5" />
                                    <span>Crear tareas ({unlinkedSubtopicsCount})</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {subtopicTaskNotice && (
                              <div className="text-[11px] bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded-lg flex items-center justify-between">
                                <span>{subtopicTaskNotice}</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('tareas')}
                                  className="font-bold underline hover:text-indigo-950 ml-2 cursor-pointer"
                                >
                                  Ver tareas
                                </button>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              {subtopics.map((st, i) => {
                                const isEditingThis =
                                  inlineEditingSubtopic?.topicId === topic.id &&
                                  inlineEditingSubtopic?.index === i;
                                const isCompleted = completedSubtopics.includes(st);
                                const hasLinkedTask = linkedTasksForTopic.some(
                                  (tsk) => tsk.subtopic === st
                                );

                                if (isEditingThis) {
                                  return (
                                    <div
                                      key={i}
                                      className="inline-flex items-center gap-1 bg-blue-50/90 border border-blue-300 px-2 py-1 rounded-lg shadow-2xs"
                                    >
                                      <input
                                        type="text"
                                        autoFocus
                                        value={inlineEditingSubtopic.text}
                                        onChange={(e) =>
                                          setInlineEditingSubtopic({
                                            topicId: topic.id,
                                            index: i,
                                            text: e.target.value,
                                          })
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleUpdateSubtopicInTopic(
                                              topic.id,
                                              i,
                                              inlineEditingSubtopic.text
                                            );
                                          } else if (e.key === 'Escape') {
                                            setInlineEditingSubtopic(null);
                                          }
                                        }}
                                        className="bg-white border border-blue-200 rounded px-2 py-0.5 text-xs text-slate-900 focus:outline-none min-w-[150px]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateSubtopicInTopic(
                                            topic.id,
                                            i,
                                            inlineEditingSubtopic.text
                                          )
                                        }
                                        className="p-1 bg-blue-600 text-white rounded cursor-pointer"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setInlineEditingSubtopic(null)}
                                        className="p-1 text-slate-500 rounded cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={i}
                                    className={`group/st inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                                      isCompleted
                                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                        : 'bg-slate-50/80 hover:bg-white border-slate-200/80 text-slate-700'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSubtopicCompleted(topic.id, st)}
                                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${
                                        isCompleted
                                          ? 'bg-emerald-600 border-emerald-600 text-white'
                                          : 'bg-white border-slate-300 hover:border-blue-500 text-transparent'
                                      }`}
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </button>

                                    <span
                                      onClick={() =>
                                        setInlineEditingSubtopic({
                                          topicId: topic.id,
                                          index: i,
                                          text: st,
                                        })
                                      }
                                      className={`cursor-pointer select-none ${
                                        isCompleted ? 'line-through opacity-75' : 'hover:text-blue-700'
                                      }`}
                                    >
                                      <span className="font-mono-numbers text-[10px] text-slate-400 mr-1">
                                        {i + 1}.
                                      </span>
                                      {st}
                                    </span>

                                    {hasLinkedTask && (
                                      <span
                                        onClick={() => setActiveTab('tareas')}
                                        className="text-[9px] font-semibold text-indigo-600 underline cursor-pointer ml-0.5"
                                      >
                                        Tarea
                                      </span>
                                    )}

                                    <div
                                      className={`items-center gap-0.5 ml-0.5 ${
                                        isManagingSubtopics
                                          ? 'inline-flex'
                                          : 'hidden group-hover/st:inline-flex'
                                      }`}
                                    >
                                      {isManagingSubtopics && (
                                        <>
                                          <button
                                            type="button"
                                            disabled={i === 0}
                                            onClick={() =>
                                              handleMoveSubtopicInTopic(topic.id, i, 'up')
                                            }
                                            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                          >
                                            <ChevronUp className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            disabled={i === subtopics.length - 1}
                                            onClick={() =>
                                              handleMoveSubtopicInTopic(topic.id, i, 'down')
                                            }
                                            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                                          >
                                            <ChevronDown className="w-3 h-3" />
                                          </button>
                                        </>
                                      )}
                                      {!hasLinkedTask && (
                                        <button
                                          type="button"
                                          onClick={() => handleCreateTaskFromSubtopic(topic, st)}
                                          className="p-0.5 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                          title="Convertir en tarea"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSubtopicFromTopic(topic.id, i)}
                                        className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                                        title="Eliminar subtema"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {!isManagingSubtopics && (
                                <div className="inline-flex items-center gap-1 bg-white border border-dashed border-slate-300 hover:border-blue-400 rounded-lg px-2 py-0.5">
                                  <input
                                    type="text"
                                    value={newSubtopicDraft}
                                    onChange={(e) =>
                                      setAddingSubtopicInputByTopic((prev) => ({
                                        ...prev,
                                        [topic.id]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && newSubtopicDraft.trim()) {
                                        e.preventDefault();
                                        handleAddSubtopicToTopic(topic.id, newSubtopicDraft);
                                      }
                                    }}
                                    placeholder="+ Subtema..."
                                    className="text-[11px] bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none w-24 focus:w-36 transition-all"
                                  />
                                  {newSubtopicDraft.trim() && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAddSubtopicToTopic(topic.id, newSubtopicDraft)
                                      }
                                      className="text-blue-600 hover:text-blue-800 p-0.5 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {isManagingSubtopics && (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  value={newSubtopicDraft}
                                  onChange={(e) =>
                                    setAddingSubtopicInputByTopic((prev) => ({
                                      ...prev,
                                      [topic.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newSubtopicDraft.trim()) {
                                      e.preventDefault();
                                      handleAddSubtopicToTopic(topic.id, newSubtopicDraft);
                                    }
                                  }}
                                  placeholder="Nuevo subtema (separa varios con comas)..."
                                  className="flex-1 min-w-[200px] bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddSubtopicToTopic(topic.id, newSubtopicDraft)
                                  }
                                  disabled={!newSubtopicDraft.trim()}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Añadir</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Plan Diario de Páginas de este Tema + Tira de Repaso Espaciado (1, 3, 7, 15, 30d SOLO si tiene páginas leídas o está estudiado) */}
                      {(() => {
                        const topicPlan = subjectDailyPlan.topicPlans[topic.id];
                        const curveScheduleLabels: Record<number, string> = {
                          1: 'R1 · 1d',
                          2: 'R2 · 3d',
                          3: 'R3 · 7d',
                          4: 'R4 · 15d',
                          5: 'R5 · 30d',
                        };
                        const currentLv = Math.min(5, Math.max(1, topic.reviewLevel || 1));

                        return (
                          <div className="space-y-2 pt-1">
                            {/* 1. Meta Diaria de Páginas para llegar a tiempo al Examen o Tarea */}
                            {topicPlan && topicPlan.remainingPages > 0 && (
                              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-mono-numbers font-bold text-[10px]">
                                    Meta: {topicPlan.pagesPerDayNeeded} págs/día
                                  </span>
                                  <span className="text-blue-950 font-semibold">
                                    Para llegar a tiempo ({topicPlan.deadlineLabel})
                                  </span>
                                </div>
                                {topicPlan.dailySessions.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 font-mono-numbers text-[10px]">
                                    {topicPlan.dailySessions.slice(0, 3).map((ds, dsIdx) => (
                                      <span
                                        key={dsIdx}
                                        className="px-2 py-0.5 rounded bg-white border border-blue-200 text-blue-800 font-bold"
                                      >
                                        📅 {ds.date.slice(5)}: Págs. {ds.startPage}–{ds.endPage} ({ds.pagesCount}p)
                                      </span>
                                    ))}
                                    {topicPlan.dailySessions.length > 3 && (
                                      <span className="text-blue-700 font-bold">
                                        +{topicPlan.dailySessions.length - 3} día(s)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 2. Repasos Espaciados (1, 3, 7, 15, 30d): SOLO activos cuando se marcan páginas leídas o tema estudiado */}
                            {topicPlan && topicPlan.hasSpacedRepetition ? (
                              <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-1.5 text-[11px]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => setManualScheduleTopic(topic)}
                                      className="inline-flex items-center gap-1.5 font-bold text-indigo-900 hover:underline cursor-pointer"
                                    >
                                      <RotateCw className="w-3 h-3 text-indigo-600" />
                                      <span>
                                        Repasos Espaciados ({curveScheduleLabels[currentLv]}) ·{' '}
                                        {topicPlan.studiedPages}/{topicPlan.totalPages} págs. leídas
                                      </span>
                                    </button>
                                    {topic.perceivedRetentionPct !== undefined && (
                                      <span className="font-mono-numbers font-bold text-emerald-700">
                                        · Retención {topic.perceivedRetentionPct}%
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setManualScheduleTopic(topic)}
                                      className="text-[10px] font-bold text-blue-700 hover:underline cursor-pointer"
                                    >
                                      Ajustar fecha
                                    </button>
                                    <span>·</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdjustTopicReviewByRetention(
                                          topic.id,
                                          'adelantar_baja_retencion'
                                        )
                                      }
                                      className="text-[10px] font-semibold text-amber-700 hover:underline cursor-pointer"
                                    >
                                      Adelantar
                                    </button>
                                    <span>·</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdjustTopicReviewByRetention(
                                          topic.id,
                                          'espaciar_alta_retencion'
                                        )
                                      }
                                      className="text-[10px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                                    >
                                      Espaciar
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 font-mono-numbers text-[10px]">
                                  {topicPlan.spacedRepetitionSchedule.map((ms) => (
                                    <span
                                      key={ms.level}
                                      className={`px-2 py-0.5 rounded-md border ${
                                        ms.status === 'completed'
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                                          : ms.status === 'due_today' || ms.status === 'overdue'
                                          ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
                                          : 'bg-white border-indigo-200 text-indigo-800'
                                      }`}
                                    >
                                      {ms.label}: {ms.date} ({ms.pagesToReview}p)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-[11px] text-slate-500 flex items-center justify-between gap-2">
                                <span>
                                  ⏳ <strong>Repasos espaciados (1, 3, 7, 15, 30d) en espera:</strong> se activarán automáticamente en cuanto marques páginas leídas (+1p, +5p) o el tema como estudiado.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Panel desplegable de Puntos Clave IA generados para este tema */}
                      {topic.keyPoints && topic.keyPoints.length > 0 && (
                        <div className="rounded-xl border border-indigo-200/90 bg-indigo-50/40 p-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedKeyPointsByTopic((prev) => ({
                                  ...prev,
                                  [topic.id]: !prev[topic.id],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-900 hover:text-indigo-700 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Puntos Clave IA ({topic.keyPoints.length})</span>
                              {expandedKeyPointsByTopic[topic.id] ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedNotesTopic(topic);
                                setIsNotesModalOpen(true);
                              }}
                              className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-950 underline cursor-pointer"
                            >
                              Editar en Apuntes
                            </button>
                          </div>

                          {expandedKeyPointsByTopic[topic.id] && (
                            <div className="space-y-2 pt-1 border-t border-indigo-100">
                              {topic.summary && (
                                <p className="text-[11px] text-slate-700 bg-white/90 p-2.5 rounded-lg border border-indigo-100 leading-relaxed">
                                  <strong className="text-indigo-900">Resumen IA:</strong>{' '}
                                  {topic.summary}
                                </p>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {topic.keyPoints.map((kp, kpIdx) => (
                                  <div
                                    key={kp.id || kpIdx}
                                    className="p-2.5 rounded-lg bg-white border border-indigo-100 text-xs space-y-1 shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="font-bold text-slate-900">
                                        {kpIdx + 1}. {kp.title}
                                      </span>
                                      <span
                                        className={`text-[9px] font-bold uppercase ${
                                          kp.importance === 'alta'
                                            ? 'text-rose-600'
                                            : kp.importance === 'baja'
                                            ? 'text-slate-500'
                                            : 'text-amber-700'
                                        }`}
                                      >
                                        {kp.importance || 'media'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                      {kp.detail}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Panel de Grabación de Voz en Vivo y Notas Generales del Tema */}
                      {(voiceRecordingTopicId === topic.id ||
                        voiceNoticeByTopic[topic.id] ||
                        voiceErrorByTopic[topic.id] ||
                        Boolean((topic.generalNotes || topic.notes || '').trim())) && (
                        <div className="rounded-xl border border-rose-200/80 bg-gradient-to-r from-rose-50/40 via-white to-blue-50/30 p-3.5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {voiceRecordingTopicId === topic.id ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold animate-pulse">
                                  <Mic className="w-3 h-3" />
                                  <span>
                                    Escuchando voz ({Math.floor(voiceRecordingSeconds / 60)}:
                                    {String(voiceRecordingSeconds % 60).padStart(2, '0')})
                                  </span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedGeneralNotesByTopic((prev) => ({
                                      ...prev,
                                      [topic.id]: !prev[topic.id],
                                    }))
                                  }
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-blue-700 cursor-pointer"
                                >
                                  <Mic className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Notas Generales y de Voz del Tema</span>
                                  {expandedGeneralNotesByTopic[topic.id] ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {voiceRecordingTopicId === topic.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => stopVoiceNoteRecording(true)}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Detener y Guardar en Notas</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => stopVoiceNoteRecording(false)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleVoiceNoteForTopic(topic)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Mic className="w-3 h-3" />
                                  <span>+ Dictar otra nota de voz</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Transcripción en tiempo real mientras habla */}
                          {voiceRecordingTopicId === topic.id && (
                            <div className="space-y-2">
                              <textarea
                                rows={2}
                                value={
                                  voiceInterimTranscript
                                    ? `${voiceFinalTranscript} ${voiceInterimTranscript}`.trim()
                                    : voiceFinalTranscript
                                }
                                onChange={(e) => {
                                  accumulatedTranscriptRef.current = e.target.value;
                                  setVoiceFinalTranscript(e.target.value);
                                  setVoiceInterimTranscript('');
                                }}
                                placeholder="Habla ahora al micrófono... Tu voz se está convirtiendo a texto en tiempo real (también puedes retocar el texto aquí antes de guardar)."
                                className="w-full text-xs p-2.5 rounded-xl bg-white border border-rose-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
                              />
                              {voiceErrorByTopic[topic.id] && (
                                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                  {voiceErrorByTopic[topic.id]}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Aviso de guardado automático */}
                          {voiceNoticeByTopic[topic.id] && (
                            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{voiceNoticeByTopic[topic.id]}</span>
                            </div>
                          )}

                          {/* Vista rápida / edición de las Notas Generales almacenadas en el tema */}
                          {(expandedGeneralNotesByTopic[topic.id] ||
                            Boolean(voiceNoticeByTopic[topic.id])) &&
                            Boolean((topic.generalNotes || topic.notes || '').trim()) && (
                              <div className="space-y-1.5 pt-1 border-t border-slate-200/70">
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-700">
                                    Contenido en Notas Generales del Tema:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedNotesTopic(topic);
                                      setIsNotesModalOpen(true);
                                    }}
                                    className="text-blue-600 hover:underline font-bold cursor-pointer"
                                  >
                                    Abrir en Lienzo Completo →
                                  </button>
                                </div>
                                <textarea
                                  rows={3}
                                  value={topic.generalNotes || topic.notes || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleSaveTopicNotes(
                                      topic.id,
                                      val,
                                      topic.cues || [],
                                      topic.summary || '',
                                      topic.attachedFiles,
                                      topic.pageCount,
                                      convertMarkdownAndImagesToRichHtml(
                                        val,
                                        topic.generalImages || []
                                      ),
                                      topic.generalImages,
                                      topic.generalComments,
                                      topic.keyPoints
                                    );
                                  }}
                                  className="w-full text-xs p-2.5 rounded-xl bg-white/90 border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y"
                                />
                              </div>
                            )}
                        </div>
                      )}
                    </div>

                    {/* ZONA 3: BARRA INFERIOR DE HERRAMIENTAS DE ESTUDIO E IA DEL TEMA */}
                    <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 1. Apuntes y PDFs */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNotesTopic(topic);
                            setIsNotesModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Apuntes y PDFs</span>
                        </button>

                        {/* 1b. Grabar Nota de Voz Rápida (Web Speech API -> Notas Generales) */}
                        <button
                          type="button"
                          onClick={() => handleToggleVoiceNoteForTopic(topic)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                            voiceRecordingTopicId === topic.id
                              ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse'
                              : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                          title="Grabar nota de voz rápida con el micrófono del navegador y guardarla automáticamente como texto en las notas generales del tema"
                        >
                          {voiceRecordingTopicId === topic.id ? (
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

                        {/* 2. Puntos Clave IA */}
                        <button
                          type="button"
                          disabled={Boolean(aiLoadingByKey[`keypoints-${topic.id}`])}
                          onClick={() => handleGenerateTopicKeyPointsAI(topic)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-800 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
                        >
                          {aiLoadingByKey[`keypoints-${topic.id}`] ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                              <span>Generando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              <span>
                                Puntos clave IA
                                {topic.keyPoints && topic.keyPoints.length > 0
                                  ? ` (${topic.keyPoints.length})`
                                  : ''}
                              </span>
                            </>
                          )}
                        </button>

                        {/* 3. Mejorar Formato IA */}
                        <button
                          type="button"
                          disabled={Boolean(aiLoadingByKey[`format-${topic.id}`])}
                          onClick={() => handleImproveTopicFormatAI(topic)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-200 bg-white hover:bg-sky-50 text-sky-900 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
                        >
                          {aiLoadingByKey[`format-${topic.id}`] ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                              <span>Mejorando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                              <span>Mejorar formato IA</span>
                            </>
                          )}
                        </button>

                        {/* 4. Reto Feynman */}
                        <button
                          type="button"
                          onClick={() => {
                            setFeynmanChallengeTopicId(topic.id);
                            setFeynmanChallengeSubtopic(undefined);
                            setActiveTab('feynman_challenge');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-800 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Brain className="w-3.5 h-3.5 text-purple-600" />
                          <span>Reto Feynman</span>
                        </button>
                      </div>

                      {/* Acciones de enfoque rápido a la derecha */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReadingTopic(topic)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          title="Abrir Modo Lectura Inmersivo a pantalla completa"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                          <span>Modo Lectura</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectForPomodoro(subject.id, topic.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                          title="Iniciar sesión Pomodoro en este tema"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Pomodoro</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            {displayedTopics.length === 0 && subject.topics.length > 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2">
                <div className="font-semibold text-slate-700">
                  No hay temas con el filtro "{topicPrintedFilter === 'printed' ? 'Impresos' : 'Digitales'}"
                </div>
                <button
                  type="button"
                  onClick={() => setTopicPrintedFilter('all')}
                  className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 cursor-pointer"
                >
                  Ver todos los {subject.topics.length} temas
                </button>
              </div>
            )}

            {subject.topics.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
                No hay temas registrados en esta materia aún. Añade el primer tema para comenzar a planificar.
              </div>
            )}
          </div>
        )}
      </div>
        );
      })()}

      {/* Tab: Vueltas al Temario */}
      {activeTab === 'vueltas' && (
        <SubjectVueltasTab
          subject={subject}
          onUpdateSubject={onUpdateSubject}
          onStartPomodoro={(topicId) => onSelectForPomodoro(subject.id, topicId)}
          onOpenNotes={(topic) => {
            setSelectedNotesTopic(topic);
            setIsNotesModalOpen(true);
          }}
        />
      )}

      {/* Tab 2: Apuntes Cornell y OCR */}
      {activeTab === 'apuntes' && (
        <div className="space-y-6">
          {/* Estantería Visual: Escritura de Apuntes Libre y Documentos por Tema */}
          {subject.topics.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Escritura de Apuntes Libre y Documentos por Tema
                  </h3>
                  <p className="text-xs text-slate-500">
                    Abre el lienzo de escritura libre de cualquier tema para redactar, subrayar con marcadores de colores, añadir notas al margen o importar PDFs, Word y PowerPoint.
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-mono-numbers">
                  {subject.topics.reduce((acc, t) => acc + (t.attachedFiles?.length || 0), 0)} documentos ·{' '}
                  {subject.topics.reduce((acc, t) => acc + (t.pageCount || 0), 0)} págs. totales
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subject.topics.map((t, idx) => {
                  const filesCount = t.attachedFiles?.length || 0;
                  const noteWords = (t.generalNotes || t.notes || '')
                    .split(/\s+/)
                    .filter(Boolean).length;
                  const filesWords = (t.attachedFiles || []).reduce(
                    (acc, f) => acc + (f.content || '').split(/\s+/).filter(Boolean).length,
                    0
                  );
                  const totalWords = noteWords + filesWords;
                  const keyPointsCount = t.keyPoints?.length || 0;

                  return (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-white transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 flex flex-col items-center justify-center shrink-0 font-mono-numbers">
                          <span className="text-[10px] font-extrabold leading-none">
                            T{idx + 1}
                          </span>
                          <span className="text-[9px] font-semibold text-blue-500 mt-0.5">
                            {t.pageCount || 0}p
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {t.title}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap font-mono-numbers">
                            <span className={filesCount > 0 ? 'text-indigo-700 font-semibold' : ''}>
                              {filesCount} {filesCount === 1 ? 'doc.' : 'docs.'}
                            </span>
                            <span>·</span>
                            <span>{totalWords} pal.</span>
                            {keyPointsCount > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-700 font-semibold">
                                  {keyPointsCount} pts IA
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNotesTopic(t);
                            setIsNotesModalOpen(true);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Lienzo Libre y Docs</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReadingTopic(t)}
                          className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                          title="Abrir este tema en Modo Lectura"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cuaderno de Fichas Cornell y Digitalización OCR */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cuaderno de Fichas Cornell y Digitalización OCR
                </h3>
                <p className="text-xs text-slate-500">
                  Crea fichas con preguntas detonadoras para Active Recall, extrae puntos clave con IA o exporta tu cuaderno completo en PDF.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {subject.cornellNotes.length > 0 && (
                  <select
                    value={activeNoteId}
                    onChange={(e) => setActiveNoteId(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800 focus:outline-none"
                  >
                    {subject.cornellNotes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                  </select>
                )}

                {/* Botón de Exportar a PDF */}
                {(subject.cornellNotes.length > 0 ||
                  pdfCornellExportService.getExportableNotesForSubject(subject, subject.topics).length > 0) && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsExportDropdownOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
                      title="Exportar apuntes Cornell a documento PDF estructurado (cuerpo de notas, ideas clave y resumen)"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Exportar PDF Cornell</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {isExportDropdownOpen && (
                      <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-1.5 space-y-1">
                        {activeCornellNote && (
                          <button
                            type="button"
                            onClick={handleExportActiveNotePDF}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-semibold block truncate">Descargar apunte activo (A4)</span>
                              <span className="text-[10px] text-slate-400 block truncate">{activeCornellNote.title}</span>
                            </div>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleExportAllNotesPDF}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-slate-800 hover:bg-blue-50 hover:text-blue-700 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-semibold block">Descargar Cuaderno Completo</span>
                            <span className="text-[10px] text-slate-400 block">
                              Portada + {pdfCornellExportService.getExportableNotesForSubject(subject, subject.topics).length} fichas de {subject.name}
                            </span>
                          </div>
                        </button>

                        <div className="border-t border-slate-100 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsExportDropdownOpen(false);
                              setCornellExportDefaultScope(activeCornellNote ? 'single' : 'subject');
                              setIsCornellExportModalOpen(true);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-indigo-800 hover:bg-indigo-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <div>
                              <span className="font-semibold block">Personalizar diseño y vista previa...</span>
                              <span className="text-[10px] text-slate-500 block">
                                Rayado, cuadrícula, casillas Active Recall y portada
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeCornellNote && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenCornellMindmapForTopic(
                          activeCornellNote.topicId || subject.topics[0]?.id,
                          true,
                          activeCornellNote
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      title="Generar mapa mental jerárquico con Gemini a partir de este apunte Cornell y renderizarlo con D3.js"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Mapa Mental IA (D3.js)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFlashcardGenNoteId(activeCornellNote.id);
                        setFlashcardGenTopicId(activeCornellNote.topicId);
                        setIsFlashcardGeneratorOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      title="Generar flashcards de Active Recall a partir de este apunte"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Flashcards con IA</span>
                    </button>
                  </>
                )}

                <button
                  onClick={handleCreateEmptyNote}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Ficha Cornell</span>
                </button>
              </div>
            </div>

            {/* Feedback de exportación a PDF */}
            {pdfExportNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-2xs animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{pdfExportNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfExportNotice(null)}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-bold px-2 py-0.5 rounded cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            )}

          {activeCornellNote ? (
            <CornellEditor
              key={activeCornellNote.id}
              note={activeCornellNote}
              topics={subject.topics}
              subject={subject}
              onAttachFileToTopic={handleAttachFileToTopic}
              onAiError={(actionTitle, errorMessage) =>
                reportCentralizedAiError(actionTitle, errorMessage)
              }
              onSave={(updated, newlyAttachedFiles) => {
                let targetTopicId = updated.topicId || subject.topics[0]?.id;
                let baseTopics = [...subject.topics];

                // If the subject had no topics yet and the user uploaded a PDF or saved a note, create a topic automatically
                if (!targetTopicId && (newlyAttachedFiles?.length || updated.notes?.trim())) {
                  const newTopicId = `top-${Date.now()}`;
                  targetTopicId = newTopicId;
                  const initialPages =
                    newlyAttachedFiles && newlyAttachedFiles.length > 0
                      ? calculateOrganizedPagesFromFiles(newlyAttachedFiles)
                      : 10;
                  const newTopic: Topic = {
                    id: newTopicId,
                    title: updated.title || 'Tema 1',
                    description: `Tema vinculado a ${updated.title || 'Apuntes'}`,
                    notes: updated.notes,
                    generalNotes: updated.notes,
                    cues: updated.cues,
                    summary: updated.summary,
                    keyPoints: updated.keyPoints,
                    subtopics: [],
                    difficulty: 'Media',
                    pageCount: initialPages,
                    paginasTotales: initialPages,
                    pagesRead: 0,
                    estimatedHours: schedulerService.calculateTopicTime(
                      'Media',
                      0,
                      (updated.notes || '').length,
                      initialPages
                    ),
                    actualHoursSpent: 0,
                    status: 'pendiente',
                    reviewLevel: 0,
                    reviewsHistory: [],
                    attachedFiles: newlyAttachedFiles || [],
                    lastNotesUpdatedAt: updated.updatedAt,
                  };
                  baseTopics = [newTopic];
                }

                const finalUpdatedNote: CornellNote = {
                  ...updated,
                  topicId: targetTopicId || updated.topicId,
                };

                const updatedList = subject.cornellNotes.map((n) =>
                  n.id === finalUpdatedNote.id ? finalUpdatedNote : n
                );

                const updatedTopics = targetTopicId
                  ? baseTopics.map((t) => {
                      if (t.id !== targetTopicId) return t;
                      const existingFiles = t.attachedFiles || [];
                      const existingIds = new Set(existingFiles.map((f) => f.id));
                      const mergedFiles = [
                        ...existingFiles,
                        ...(newlyAttachedFiles || []).filter((f) => !existingIds.has(f.id)),
                      ];
                      const orgPages = calculateOrganizedPagesFromFiles(mergedFiles);
                      const nextPages =
                        orgPages > 0 ? Math.max(t.pageCount || 0, orgPages) : t.pageCount;
                      return {
                        ...t,
                        notes: finalUpdatedNote.notes,
                        generalNotes: finalUpdatedNote.notes,
                        cues: finalUpdatedNote.cues,
                        summary: finalUpdatedNote.summary,
                        keyPoints:
                          finalUpdatedNote.keyPoints !== undefined
                            ? finalUpdatedNote.keyPoints
                            : t.keyPoints,
                        attachedFiles: mergedFiles,
                        pageCount: nextPages,
                        paginasTotales: nextPages,
                        lastNotesUpdatedAt: finalUpdatedNote.updatedAt,
                      };
                    })
                  : baseTopics;

                onUpdateSubject({
                  ...subject,
                  topics: updatedTopics,
                  cornellNotes: updatedList,
                });
              }}
              onDelete={(noteId) => {
                const filtered = subject.cornellNotes.filter((n) => n.id !== noteId);
                onUpdateSubject({ ...subject, cornellNotes: filtered });
                if (filtered.length > 0) setActiveNoteId(filtered[0].id);
              }}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              No tienes apuntes creados aún. Pulsa "Nueva Ficha Cornell" o sube un PDF / foto para digitalizarlo automáticamente.
            </div>
          )}
          </div>
        </div>
      )}

      {/* Tab: Módulo FeynmanChallenge (Explicar un tema con tus propias palabras y corrección con IA) */}
      {activeTab === 'feynman_challenge' && (
        <FeynmanChallenge
          subject={subject}
          initialTopicId={feynmanChallengeTopicId}
          initialSubtopic={feynmanChallengeSubtopic}
          onSaveSession={(session) => {
            onUpdateSubject({
              ...subject,
              feynmanSessions: [session, ...subject.feynmanSessions],
            });
          }}
          onDeleteSession={(sessionId) => {
            onUpdateSubject({
              ...subject,
              feynmanSessions: subject.feynmanSessions.filter((s) => s.id !== sessionId),
            });
          }}
          onLogMistake={(mistake) => {
            onUpdateSubject({
              ...subject,
              errorLogs: [mistake, ...subject.errorLogs],
            });
          }}
          onMarkTopicReviewed={(topicId, retentionPct) => {
            const updatedTopics = subject.topics.map((t) =>
              t.id === topicId ? { ...t, perceivedRetentionPct: retentionPct } : t
            );
            onUpdateSubject({
              ...subject,
              topics: updatedTopics,
            });
          }}
        />
      )}

      {/* Tab 3: Active Recall (Flashcards & Quizzes) */}
      {activeTab === 'active_recall' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Active Recall · Repetición Espaciada y Flashcards
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Practica la recuperación activa de conceptos antes de mirar las respuestas para construir memoria a largo plazo.
            </p>
            <FlashcardDeck
              flashcards={subject.flashcards}
              topics={subject.topics}
              subjectName={subject.name}
              onUpdateFlashcard={(updated) => {
                const list = subject.flashcards.map((f) => (f.id === updated.id ? updated : f));
                onUpdateSubject({ ...subject, flashcards: list });
              }}
              onAddFlashcards={(newCards) => {
                onUpdateSubject({ ...subject, flashcards: [...newCards, ...subject.flashcards] });
              }}
              onDeleteFlashcard={(cardId) => {
                const filtered = subject.flashcards.filter((f) => f.id !== cardId);
                onUpdateSubject({ ...subject, flashcards: filtered });
              }}
            />
          </div>

          <div className="pt-6 border-t border-slate-200">
            <PracticeQuizModule
              subjects={[subject]}
              initialSubjectId={subject.id}
              onSaveQuizResult={(subId, quiz) => {
                onUpdateSubject({ ...subject, quizzes: [quiz, ...subject.quizzes] });
              }}
              onLogMistake={(mistake) => {
                onUpdateSubject({ ...subject, errorLogs: [mistake, ...subject.errorLogs] });
              }}
              onOpenErrorAnalysis={() => setIsErrorModalOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Tab 4: Mapas Mentales y Esquemas automáticos */}
      {activeTab === 'mapas_mentales' && (
        <MindmapViewer
          mindmaps={subject.mindmaps}
          topics={subject.topics}
          cornellNotes={subject.cornellNotes}
          subjectName={subject.name}
          onSaveMindmap={(newMap) => {
            onUpdateSubject({ ...subject, mindmaps: [newMap, ...subject.mindmaps] });
          }}
          onGenerateCornellMindmapForTopic={(topicId) => handleGenerateCornellMindmap(topicId)}
        />
      )}

      {/* Tab: Proyectos y Fases */}
      {activeTab === 'proyectos' && (
        <SubjectProjectsTab
          subject={subject}
          onUpdateSubject={onUpdateSubject}
        />
      )}

      {/* Tab: Calificaciones y Cálculo Progresivo de Nota Final */}
      {activeTab === 'calificaciones' && (
        <SubjectGradingTab
          subject={subject}
          onUpdateSubject={onUpdateSubject}
        />
      )}

      {/* Tab: Exámenes */}
      {activeTab === 'examenes' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>Calendario de Exámenes y Convocatorias</span>
              </h3>
              <p className="text-xs text-slate-500">
                Señala la convocatoria (Ordinaria, Extraordinaria, Parcial), tipo de examen y gestiona notas y ponderaciones.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              {onOpenExamsManager && (
                <button
                  type="button"
                  onClick={() => onOpenExamsManager(subject.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl border border-purple-200 transition-colors cursor-pointer"
                  title="Gestionar todas las convocatorias y exámenes del curso"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Gestionar Convocatorias</span>
                </button>
              )}
              <button
                onClick={() => setShowAddExam(!showAddExam)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Programar Examen</span>
              </button>
            </div>
          </div>

          {/* Automatic Calculated Weighted Final Grade Banner */}
          {subjectGradeSummary.hasMetrics && (
            <div className="p-4 bg-gradient-to-r from-purple-50/90 via-emerald-50/80 to-blue-50/90 dark:from-purple-950/40 dark:via-emerald-950/30 dark:to-blue-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-purple-600" />
                    <span>Nota Ponderada Calculada:</span>
                  </span>
                  <span className="text-sm font-extrabold font-mono-numbers text-emerald-700 dark:text-emerald-400">
                    {subjectGradeSummary.weightedAverageGrade !== null
                      ? `${subjectGradeSummary.weightedAverageGrade.toFixed(2)} / 10`
                      : subjectGradeSummary.simpleAverageGraded !== null
                      ? `${subjectGradeSummary.simpleAverageGraded.toFixed(2)} / 10 (media simple)`
                      : `${subjectGradeSummary.accumulatedPointsOn10.toFixed(2)} pts asegurados`}
                  </span>
                  {subjectGradeSummary.isPassingSecured && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      ¡Aprobado Asegurado!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Puntos asegurados en la nota final:{' '}
                  <strong className="text-slate-800 font-mono-numbers">
                    {subjectGradeSummary.accumulatedPointsOn10.toFixed(2)} / 10
                  </strong>{' '}
                  · Evaluado: <strong className="font-mono-numbers">{subjectGradeSummary.gradedWeightEvaluated}%</strong> de {subjectGradeSummary.totalWeightConfigured}% ponderado total
                  {subjectGradeSummary.requiredGradeOnRemaining !== null && !subjectGradeSummary.isPassingSecured && (
                    <span> · Falta {subjectGradeSummary.requiredGradeOnRemaining.toFixed(2)}/10 en el {subjectGradeSummary.pendingWeight}% restante para aprobar</span>
                  )}
                </p>
              </div>

              {onOpenExamsManager && (
                <button
                  type="button"
                  onClick={() => onOpenExamsManager(subject.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-2xs cursor-pointer self-start sm:self-auto shrink-0 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Gestor de Evaluaciones</span>
                </button>
              )}
            </div>
          )}

          {/* Add Exam Form */}
          {showAddExam && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Nuevo Examen para {subject.name}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Título del Examen *
                  </label>
                  <input
                    type="text"
                    value={newExamTitle}
                    onChange={(e) => setNewExamTitle(e.target.value)}
                    placeholder="Ej: Examen Parcial 1, Examen Final Teórico..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fecha del Examen *
                  </label>
                  <input
                    type="date"
                    value={newExamDate}
                    onChange={(e) => setNewExamDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Convocatoria
                  </label>
                  <select
                    value={newExamConvocatoria}
                    onChange={(e) => setNewExamConvocatoria(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none"
                  >
                    <option value="Convocatoria Ordinaria">Convocatoria Ordinaria</option>
                    <option value="Convocatoria Extraordinaria">Convocatoria Extraordinaria</option>
                    <option value="1er Parcial">1er Parcial</option>
                    <option value="2º Parcial">2º Parcial</option>
                    <option value="Examen Final">Examen Final</option>
                    <option value="Evaluación Continua">Evaluación Continua</option>
                    <option value="Fin de Grado / Máster">Fin de Grado / Máster</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ubicación / Aula (opcional)
                  </label>
                  <input
                    type="text"
                    value={newExamLocation}
                    onChange={(e) => setNewExamLocation(e.target.value)}
                    placeholder="Ej: Aula 204, Edificio B"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Exam Type Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Tipo de Examen
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {[
                    { type: 'test' as ExamType, label: 'Test', desc: 'Opción múltiple' },
                    { type: 'desarrollo' as ExamType, label: 'Desarrollo', desc: 'Tema abierto' },
                    { type: 'oral' as ExamType, label: 'Oral', desc: 'Defensa oral' },
                    { type: 'preguntas_cortas' as ExamType, label: 'Preg. Cortas', desc: 'Respuesta breve' },
                    { type: 'calculo' as ExamType, label: 'Cálculo', desc: 'Problemas numéricos' },
                    { type: 'practico' as ExamType, label: 'Práctico', desc: 'Casos/Laboratorio' },
                    { type: 'mixto' as ExamType, label: 'Mixto', desc: 'Combinado' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setNewExamType(item.type)}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        newExamType === item.type
                          ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold shadow-2xs'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Hora (opcional)
                  </label>
                  <input
                    type="time"
                    value={newExamTime}
                    onChange={(e) => setNewExamTime(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Meta de Calificación (0 - 10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={newExamTargetGrade}
                    onChange={(e) => setNewExamTargetGrade(e.target.value)}
                    placeholder="8.0"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-mono-numbers"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ponderación (% Nota Final)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newExamWeight}
                    onChange={(e) => setNewExamWeight(e.target.value)}
                    placeholder="30"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-mono-numbers"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notas o instrucciones del examen (opcional)
                </label>
                <input
                  type="text"
                  value={newExamNotes}
                  onChange={(e) => setNewExamNotes(e.target.value)}
                  placeholder="Ej: Se permite calculadora científica sin memoria programable. Aula 204."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExam(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newExamTitle.trim() || !newExamDate) return;
                    const newExam: Exam = {
                      id: `exam-${Date.now()}`,
                      title: newExamTitle.trim(),
                      date: newExamDate,
                      time: newExamTime || undefined,
                      convocatoria: newExamConvocatoria.trim() || undefined,
                      location: newExamLocation.trim() || undefined,
                      examType: newExamType,
                      difficulty: newExamDifficulty,
                      topicIds: subject.topics.map((t) => t.id),
                      targetGrade: newExamTargetGrade ? parseFloat(newExamTargetGrade) : undefined,
                      weightPercentage: newExamWeight ? parseFloat(newExamWeight) : undefined,
                      completed: false,
                      notes: newExamNotes.trim() || undefined,
                    };
                    onUpdateSubject({ ...subject, exams: [...subject.exams, newExam] });
                    setNewExamTitle('');
                    setNewExamDate('');
                    setNewExamTime('');
                    setNewExamLocation('');
                    setNewExamNotes('');
                    setShowAddExam(false);
                  }}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs"
                >
                  Programar Examen
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subject.exams.map((ex) => (
              <div
                key={ex.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3.5 hover:border-slate-300 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {ex.examType.replace('_', ' ')}
                      </span>
                      {ex.convocatoria && (
                        <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                          {ex.convocatoria}
                        </span>
                      )}
                      {ex.weightPercentage !== undefined && (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono-numbers">
                          {ex.weightPercentage}% final
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <h4 className="text-base font-bold text-slate-900">{ex.title}</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExam(ex);
                          setEditExamTitle(ex.title);
                          setEditExamConvocatoria(ex.convocatoria || 'Convocatoria Ordinaria');
                          setEditExamLocation(ex.location || '');
                          setEditExamDate(ex.date);
                          setEditExamTime(ex.time || '');
                          setEditExamType(ex.examType);
                          setEditExamDifficulty(ex.difficulty || 'intermedio');
                          setEditExamTargetGrade(ex.targetGrade !== undefined ? String(ex.targetGrade) : '');
                          setEditExamWeight(ex.weightPercentage !== undefined ? String(ex.weightPercentage) : '');
                          setEditExamFinalGrade(ex.finalGrade !== undefined ? String(ex.finalGrade) : (ex.actualGrade !== undefined ? String(ex.actualGrade) : ''));
                          setEditExamNotes(ex.notes || '');
                          setEditExamCompleted(!!ex.completed);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-purple-600 transition-opacity cursor-pointer"
                        title="Modificar examen o convocatoria"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono-numbers font-bold text-slate-800">{ex.date}</span>
                    {ex.time && <div className="text-[11px] text-slate-400 font-mono-numbers">{ex.time}</div>}
                    {ex.location && <div className="text-[10px] text-slate-500">{ex.location}</div>}
                  </div>
                </div>

                {ex.notes && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {ex.notes}
                  </p>
                )}

                {/* Final Grade input row */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-600 font-semibold">Nota Obtenida:</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={ex.finalGrade !== undefined ? ex.finalGrade : (ex.actualGrade !== undefined ? ex.actualGrade : '')}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                        const validGrade = val !== undefined && !isNaN(val) ? Math.min(10, Math.max(0, val)) : undefined;
                        const updatedExams = subject.exams.map((item) =>
                          item.id === ex.id
                            ? { ...item, finalGrade: validGrade, actualGrade: validGrade, completed: validGrade !== undefined }
                            : item
                        );
                        onUpdateSubject({ ...subject, exams: updatedExams });
                      }}
                      placeholder="—"
                      className="w-14 bg-slate-50 border border-slate-200 rounded-lg p-1 text-center font-bold font-mono-numbers text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <span className="text-slate-400">/ 10</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {ex.targetGrade && (
                      <span className="text-[11px] text-slate-400">
                        Meta: <strong className="text-slate-700 font-mono-numbers">{ex.targetGrade}</strong>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingExam(ex);
                        setEditExamTitle(ex.title);
                        setEditExamConvocatoria(ex.convocatoria || 'Convocatoria Ordinaria');
                        setEditExamLocation(ex.location || '');
                        setEditExamDate(ex.date);
                        setEditExamTime(ex.time || '');
                        setEditExamType(ex.examType);
                        setEditExamDifficulty(ex.difficulty || 'intermedio');
                        setEditExamTargetGrade(ex.targetGrade !== undefined ? String(ex.targetGrade) : '');
                        setEditExamWeight(ex.weightPercentage !== undefined ? String(ex.weightPercentage) : '');
                        setEditExamFinalGrade(ex.finalGrade !== undefined ? String(ex.finalGrade) : (ex.actualGrade !== undefined ? String(ex.actualGrade) : ''));
                        setEditExamNotes(ex.notes || '');
                        setEditExamCompleted(!!ex.completed);
                      }}
                      className="text-slate-400 hover:text-purple-600 p-1 transition-colors cursor-pointer"
                      title="Editar examen"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        const updatedExams = subject.exams.filter((item) => item.id !== ex.id);
                        onUpdateSubject({ ...subject, exams: updatedExams });
                      }}
                      className="text-slate-300 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                      title="Eliminar examen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {subject.exams.length === 0 && (
              <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 text-xs text-slate-400 italic">
                No hay exámenes programados para esta materia. Pulsa "Programar Examen" o "Gestionar Convocatorias".
              </div>
            )}
          </div>

          {/* Edit Exam Modal */}
          {editingExam && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
              <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-purple-600" />
                    <span>Modificar Examen o Convocatoria</span>
                  </h3>
                  <button
                    onClick={() => setEditingExam(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Título del Examen *</label>
                    <input
                      type="text"
                      value={editExamTitle}
                      onChange={(e) => setEditExamTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Convocatoria</label>
                      <select
                        value={editExamConvocatoria}
                        onChange={(e) => setEditExamConvocatoria(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                      >
                        <option value="Convocatoria Ordinaria">Convocatoria Ordinaria</option>
                        <option value="Convocatoria Extraordinaria">Convocatoria Extraordinaria</option>
                        <option value="1er Parcial">1er Parcial</option>
                        <option value="2º Parcial">2º Parcial</option>
                        <option value="Examen Final">Examen Final</option>
                        <option value="Evaluación Continua">Evaluación Continua</option>
                        <option value="Fin de Grado / Máster">Fin de Grado / Máster</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Ubicación / Aula</label>
                      <input
                        type="text"
                        value={editExamLocation}
                        onChange={(e) => setEditExamLocation(e.target.value)}
                        placeholder="Ej: Aula 204"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Fecha *</label>
                      <input
                        type="date"
                        value={editExamDate}
                        onChange={(e) => setEditExamDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Hora</label>
                      <input
                        type="time"
                        value={editExamTime}
                        onChange={(e) => setEditExamTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Tipo de Examen</label>
                      <select
                        value={editExamType}
                        onChange={(e) => setEditExamType(e.target.value as ExamType)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                      >
                        <option value="test">Tipo Test</option>
                        <option value="desarrollo">Desarrollo</option>
                        <option value="oral">Oral</option>
                        <option value="preguntas_cortas">Preguntas Cortas</option>
                        <option value="calculo">Cálculo</option>
                        <option value="practico">Práctico</option>
                        <option value="mixto">Mixto</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Dificultad</label>
                      <select
                        value={editExamDifficulty}
                        onChange={(e) => setEditExamDifficulty(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                      >
                        <option value="basico">Básico</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Ponderación %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editExamWeight}
                        onChange={(e) => setEditExamWeight(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-mono-numbers"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Nota Meta</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={editExamTargetGrade}
                        onChange={(e) => setEditExamTargetGrade(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-mono-numbers"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Nota Obtenida</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={editExamFinalGrade}
                        onChange={(e) => setEditExamFinalGrade(e.target.value)}
                        placeholder="—"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-mono-numbers font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Instrucciones o Notas</label>
                    <input
                      type="text"
                      value={editExamNotes}
                      onChange={(e) => setEditExamNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingExam(null)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editExamTitle.trim() || !editExamDate) return;
                      const fGrade = editExamFinalGrade !== '' ? parseFloat(editExamFinalGrade) : undefined;
                      const updatedExams = subject.exams.map((ex) =>
                        ex.id === editingExam.id
                          ? {
                              ...ex,
                              title: editExamTitle.trim(),
                              convocatoria: editExamConvocatoria.trim() || undefined,
                              location: editExamLocation.trim() || undefined,
                              date: editExamDate,
                              time: editExamTime || undefined,
                              examType: editExamType,
                              difficulty: editExamDifficulty,
                              weightPercentage: editExamWeight ? parseFloat(editExamWeight) : undefined,
                              targetGrade: editExamTargetGrade ? parseFloat(editExamTargetGrade) : undefined,
                              finalGrade: fGrade,
                              actualGrade: fGrade,
                              completed: fGrade !== undefined,
                              notes: editExamNotes.trim() || undefined,
                            }
                          : ex
                      );
                      onUpdateSubject({ ...subject, exams: updatedExams });
                      setEditingExam(null);
                    }}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Tareas pendientes & Recordatorios */}
      {activeTab === 'tareas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tareas Pendientes y Desglose por Subtemas
              </h3>
              <p className="text-xs text-slate-500">
                Prácticas, entregas, lecturas y tareas granulares vinculadas a subtemas de cada tema.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenExamsManager && (
                <button
                  type="button"
                  onClick={() => onOpenExamsManager(subject.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 transition-colors cursor-pointer"
                  title="Gestionar tareas y exámenes con cálculo ponderado"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Gestor de Evaluaciones</span>
                </button>
              )}
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Tarea</span>
              </button>
            </div>
          </div>

          {/* Automatic Calculated Weighted Final Grade Banner */}
          {subjectGradeSummary.hasMetrics && (
            <div className="p-4 bg-gradient-to-r from-blue-50/90 via-emerald-50/80 to-purple-50/90 dark:from-blue-950/40 dark:via-emerald-950/30 dark:to-purple-950/40 rounded-2xl border border-blue-200 dark:border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    <span>Nota Ponderada Calculada:</span>
                  </span>
                  <span className="text-sm font-extrabold font-mono-numbers text-emerald-700 dark:text-emerald-400">
                    {subjectGradeSummary.weightedAverageGrade !== null
                      ? `${subjectGradeSummary.weightedAverageGrade.toFixed(2)} / 10`
                      : subjectGradeSummary.simpleAverageGraded !== null
                      ? `${subjectGradeSummary.simpleAverageGraded.toFixed(2)} / 10 (media simple)`
                      : `${subjectGradeSummary.accumulatedPointsOn10.toFixed(2)} pts asegurados`}
                  </span>
                  {subjectGradeSummary.isPassingSecured && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      ¡Aprobado Asegurado!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Puntos asegurados en la nota final:{' '}
                  <strong className="text-slate-800 font-mono-numbers">
                    {subjectGradeSummary.accumulatedPointsOn10.toFixed(2)} / 10
                  </strong>{' '}
                  · Evaluado: <strong className="font-mono-numbers">{subjectGradeSummary.gradedWeightEvaluated}%</strong> de {subjectGradeSummary.totalWeightConfigured}% ponderado total
                  {subjectGradeSummary.requiredGradeOnRemaining !== null && !subjectGradeSummary.isPassingSecured && (
                    <span> · Falta {subjectGradeSummary.requiredGradeOnRemaining.toFixed(2)}/10 en el {subjectGradeSummary.pendingWeight}% restante para aprobar</span>
                  )}
                </p>
              </div>

              {onOpenExamsManager && (
                <button
                  type="button"
                  onClick={() => onOpenExamsManager(subject.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-2xs cursor-pointer self-start sm:self-auto shrink-0 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Calcular Ponderación</span>
                </button>
              )}
            </div>
          )}

          {showAddTask && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Título de la tarea</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Ejemplo: Entrega de problemas o estudio de subtema..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vincular a Tema (opcional)
                  </label>
                  <select
                    value={newTaskTopicId}
                    onChange={(e) => {
                      setNewTaskTopicId(e.target.value);
                      setNewTaskSubtopic('');
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none"
                  >
                    <option value="">— Sin tema específico —</option>
                    {subject.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Subtema específico (opcional)
                  </label>
                  <select
                    value={newTaskSubtopic}
                    disabled={!newTaskTopicId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTaskSubtopic(val);
                      if (val && !newTaskTitle.trim()) {
                        const tObj = subject.topics.find((t) => t.id === newTaskTopicId);
                        if (tObj) {
                          setNewTaskTitle(`${tObj.title}: ${val}`);
                        }
                      }
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">— Sin subtema —</option>
                    {(subject.topics.find((t) => t.id === newTaskTopicId)?.subtopics || []).map(
                      (st, idx) => (
                        <option key={idx} value={st}>
                          {idx + 1}. {st}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Prioridad</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) =>
                      setNewTaskPriority(
                        e.target.value as 'urgente' | 'alta' | 'media' | 'baja'
                      )
                    }
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Configuración de puntuación y ponderación (opcional) */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTaskIsGraded}
                    onChange={(e) => setNewTaskIsGraded(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span className="font-semibold text-slate-800 text-xs">
                    Tarea evaluable / puntúa (opcional)
                  </span>
                </label>

                {newTaskIsGraded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Puntuación obtenida (opcional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={newTaskScore}
                        onChange={(e) => setNewTaskScore(e.target.value)}
                        placeholder="Ej: 8.5"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono-numbers text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Ponderación % de la nota (opcional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={newTaskWeight}
                        onChange={(e) => setNewTaskWeight(e.target.value)}
                        placeholder="Ej: 15"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-mono-numbers text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="px-3 py-1 text-xs text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddTask}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Guardar Tarea
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {subject.tasks.map((task) => {
              const linkedTopic = task.topicId
                ? subject.topics.find((t) => t.id === task.topicId)
                : undefined;

              return (
                <div
                  key={task.id}
                  className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const updatedTasks = subject.tasks.map((t) =>
                          t.id === task.id ? { ...t, completed: checked } : t
                        );
                        const updatedTopics =
                          task.topicId && task.subtopic
                            ? subject.topics.map((t) => {
                                if (t.id !== task.topicId) return t;
                                const currentDone = t.completedSubtopics || [];
                                const nextDone = checked
                                  ? currentDone.includes(task.subtopic!)
                                    ? currentDone
                                    : [...currentDone, task.subtopic!]
                                  : currentDone.filter((item) => item !== task.subtopic);
                                return {
                                  ...t,
                                  completedSubtopics: nextDone,
                                };
                              })
                            : subject.topics;

                        onUpdateSubject({
                          ...subject,
                          tasks: updatedTasks,
                          topics: updatedTopics,
                        });
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`font-semibold ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.isGraded && (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-mono-numbers">
                            {task.score !== undefined ? `Nota: ${task.score}/${task.maxScore || 10}` : 'Evaluable (sin nota)'}
                          </span>
                        )}
                        {task.weightPercentage !== undefined && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono-numbers">
                            {task.weightPercentage}% ponderación
                          </span>
                        )}
                        {linkedTopic && (
                          <span className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                            {linkedTopic.title}
                            {task.subtopic ? ` · ${task.subtopic}` : ''}
                          </span>
                        )}
                        {task.durationMinutes && (
                          <span className="text-[10px] font-mono-numbers bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            ~{task.durationMinutes} min
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-numbers mt-0.5">
                        Vence: {task.dueDate} · Prioridad: {task.priority}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Inline score filler for evaluable tasks */}
                    {task.isGraded && (
                      <div className="flex items-center gap-1 bg-amber-50/70 border border-amber-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] font-semibold text-amber-800">Nota:</span>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={task.score !== undefined ? task.score : ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                            const validScore = val !== undefined && !isNaN(val) ? Math.min(10, Math.max(0, val)) : undefined;
                            const updatedTasks = subject.tasks.map((t) =>
                              t.id === task.id ? { ...t, score: validScore } : t
                            );
                            onUpdateSubject({ ...subject, tasks: updatedTasks });
                          }}
                          placeholder="—"
                          className="w-11 bg-white border border-amber-300 rounded px-1 py-0.5 text-center font-mono-numbers font-bold text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <span className="text-[10px] text-amber-700 font-mono-numbers">/10</span>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        const filtered = subject.tasks.filter((t) => t.id !== task.id);
                        onUpdateSubject({ ...subject, tasks: filtered });
                      }}
                      className="text-slate-300 hover:text-rose-500 p-1 cursor-pointer"
                      title="Eliminar tarea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {subject.tasks.length === 0 && (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
                No hay tareas pendientes. Puedes crear una tarea aquí o desglosar los subtemas de cualquier tema desde la pestaña Temario.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Topic Notes Modal (Write or OCR Import) */}
      {isNotesModalOpen && selectedNotesTopic && (
        <TopicNotesModal
          isOpen={isNotesModalOpen}
          onClose={() => {
            setIsNotesModalOpen(false);
            setSelectedNotesTopic(null);
          }}
          subjectName={subject.name}
          topic={
            subject.topics.find((t) => t.id === selectedNotesTopic.id) || selectedNotesTopic
          }
          onAiError={(actionTitle, errorMessage) =>
            reportCentralizedAiError(`${actionTitle} (${selectedNotesTopic.title})`, errorMessage)
          }
          onOpenReadingMode={() => {
            if (selectedNotesTopic) {
              const liveTopic =
                subject.topics.find((t) => t.id === selectedNotesTopic.id) ||
                selectedNotesTopic;
              setReadingTopic(liveTopic);
            }
          }}
          onSaveTopicNotes={(topicId, data) => {
            handleSaveTopicNotes(
              topicId,
              data.notes,
              data.cues,
              data.summary,
              data.attachedFiles,
              data.pageCount,
              data.richGeneralNotes,
              data.generalImages,
              data.generalComments,
              data.keyPoints
            );
            const currentBase =
              subject.topics.find((t) => t.id === topicId) || selectedNotesTopic;
            setSelectedNotesTopic({
              ...currentBase,
              notes: data.notes,
              generalNotes: data.notes,
              richGeneralNotes: data.richGeneralNotes,
              generalImages: data.generalImages,
              generalComments: data.generalComments,
              cues: data.cues,
              summary: data.summary,
              keyPoints:
                data.keyPoints !== undefined ? data.keyPoints : currentBase.keyPoints,
              attachedFiles:
                data.attachedFiles !== undefined
                  ? data.attachedFiles
                  : currentBase.attachedFiles,
              pageCount:
                data.pageCount !== undefined ? data.pageCount : currentBase.pageCount,
            });
          }}
        />
      )}

      {/* Modal: Modo Lectura Inmersivo con Panel Lateral Feynman */}
      {readingModeTopic && (
        <TopicReadingModeModal
          isOpen={!!readingModeTopic}
          onClose={() => setReadingTopic(null)}
          topic={subject.topics.find((t) => t.id === readingModeTopic.id) || readingModeTopic}
          subject={subject}
          onUpdateTopicNotes={handleSaveTopicGeneralNotes}
          onSaveFeynmanSession={handleSaveReadingFeynmanSession}
        />
      )}

      {/* Feynman Coach Modal */}
      <FeynmanCoachModal
        isOpen={isFeynmanModalOpen}
        onClose={() => setIsFeynmanModalOpen(false)}
        subjectName={subject.name}
        topics={subject.topics}
        initialConcept={selectedFeynmanConcept}
        onSaveSession={(session) => {
          onUpdateSubject({
            ...subject,
            feynmanSessions: [session, ...subject.feynmanSessions],
          });
        }}
      />

      {/* Error Analysis Modal */}
      <ErrorAnalysisModal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        errors={subject.errorLogs}
        subjectName={subject.name}
        onResolveError={(errId) => {
          const updatedLogs = subject.errorLogs.map((e) =>
            e.id === errId ? { ...e, resolved: true } : e
          );
          onUpdateSubject({ ...subject, errorLogs: updatedLogs });
        }}
      />

      {/* Concept Diagram Modal (SVG & Mermaid) */}
      <ConceptDiagramModal
        isOpen={isDiagramModalOpen}
        onClose={() => {
          setIsDiagramModalOpen(false);
          setSelectedDiagramTopic(null);
        }}
        subjectName={subject.name}
        initialTopic={selectedDiagramTopic}
        topics={subject.topics}
        cornellNotes={subject.cornellNotes}
      />

      {/* Flashcard Generator Modal (Active Recall con IA) */}
      {isFlashcardGeneratorOpen && (
        <FlashcardGeneratorModal
          isOpen={isFlashcardGeneratorOpen}
          onClose={() => {
            setIsFlashcardGeneratorOpen(false);
            setFlashcardGenTopicId(undefined);
            setFlashcardGenNoteId(undefined);
          }}
          subject={subject}
          initialTopicId={flashcardGenTopicId}
          initialNoteId={flashcardGenNoteId}
          onAddFlashcards={(newCards) => {
            onUpdateSubject({
              ...subject,
              flashcards: [...newCards, ...subject.flashcards],
            });
          }}
        />
      )}

      {/* Subject Edit (Color, Code, Name) Modal */}
      {showEditSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-600" />
                <span>Personalizar Asignatura</span>
              </h3>
              <button
                onClick={() => setShowEditSubjectModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nombre de la Asignatura</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Código / Siglas (opcional)</label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="Dejar en blanco si no aplica"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1.5">Color distintivo</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { hex: '#3b82f6', label: 'Azul' },
                    { hex: '#6366f1', label: 'Índigo' },
                    { hex: '#8b5cf6', label: 'Violeta' },
                    { hex: '#a855f7', label: 'Púrpura' },
                    { hex: '#ec4899', label: 'Rosa' },
                    { hex: '#f43f5e', label: 'Cereza' },
                    { hex: '#f97316', label: 'Naranja' },
                    { hex: '#eab308', label: 'Ámbar' },
                    { hex: '#10b981', label: 'Esmeralda' },
                    { hex: '#06b6d4', label: 'Cian' },
                    { hex: '#64748b', label: 'Pizarra' },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setEditColor(c.hex)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer border ${
                        editColor === c.hex ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105 border-transparent'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Número de Créditos ECTS <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="60"
                  value={editCredits}
                  onChange={(e) => setEditCredits(e.target.value)}
                  placeholder="Dejar en blanco o indicar créditos (opcional)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono-numbers focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1.5">
                  Profesores y Docentes de la Asignatura
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newProfInput}
                      onChange={(e) => setNewProfInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newProfInput.trim()) {
                          e.preventDefault();
                          setEditProfessorsList(prev => [...prev, newProfInput.trim()]);
                          setNewProfInput('');
                        }
                      }}
                      placeholder="Nombre del docente (ej: Dr. García, Catedrático López...)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newProfInput.trim()) {
                          setEditProfessorsList(prev => [...prev, newProfInput.trim()]);
                          setNewProfInput('');
                        }
                      }}
                      className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Añadir
                    </button>
                  </div>

                  {editProfessorsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      {editProfessorsList.map((prof, pIdx) => (
                        <span
                          key={pIdx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-lg shadow-2xs"
                        >
                          <span>{prof}</span>
                          <button
                            type="button"
                            onClick={() => setEditProfessorsList(prev => prev.filter((_, i) => i !== pIdx))}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditSubjectModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editName.trim()) return;
                  const parsedCredits =
                    editCredits.trim() !== '' ? parseFloat(editCredits) : NaN;
                  const validProfs = editProfessorsList.filter(p => p.trim().length > 0);
                  if (newProfInput.trim() && !validProfs.includes(newProfInput.trim())) {
                    validProfs.push(newProfInput.trim());
                  }

                  onUpdateSubject({
                    ...subject,
                    name: editName.trim(),
                    code: editCode.trim() || undefined,
                    color: editColor,
                    credits: !isNaN(parsedCredits) && parsedCredits > 0 ? parsedCredits : undefined,
                    professor: validProfs[0] || undefined,
                    professors: validProfs.length > 0 ? validProfs : undefined,
                  });
                  setNewProfInput('');
                  setShowEditSubjectModal(false);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Tema y Subtemas */}
      {editingTopic && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Editar Tema y Subtemas</h3>
                  <p className="text-xs text-slate-500">
                    Modifica el título, los subtemas de la asignatura, páginas y dificultad
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Título del Tema</label>
                <input
                  type="text"
                  value={editTopicTitle}
                  onChange={(e) => setEditTopicTitle(e.target.value)}
                  placeholder="Ej: Tema 3: Reacciones Redox"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descripción y conceptos clave</label>
                <textarea
                  value={editTopicDesc}
                  onChange={(e) => setEditTopicDesc(e.target.value)}
                  placeholder="Descripción resumida del tema..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-blue-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Dificultad</label>
                  <select
                    value={editTopicDifficulty}
                    onChange={(e) => setEditTopicDifficulty(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-blue-500 text-xs"
                  >
                    <option value="Baja">
                      Baja (~{schedulerService.getMinutesPerPage('Baja', preferences?.averageMinutesPerPage, preferences?.useDifficultyScalingForPages)} min/pág)
                    </option>
                    <option value="Media">
                      Media (~{schedulerService.getMinutesPerPage('Media', preferences?.averageMinutesPerPage, preferences?.useDifficultyScalingForPages)} min/pág)
                    </option>
                    <option value="Alta">
                      Alta (~{schedulerService.getMinutesPerPage('Alta', preferences?.averageMinutesPerPage, preferences?.useDifficultyScalingForPages)} min/pág)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Número de páginas</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={editTopicPages}
                    onChange={(e) => setEditTopicPages(e.target.value)}
                    placeholder="Ej: 25"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-blue-500 text-xs font-mono-numbers"
                  />
                </div>
              </div>

              {/* Sección de Subtemas dentro del Modal de Edición */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-slate-800 font-bold text-xs">
                      Subtemas del Tema ({editTopicSubtopics.length})
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Edita el texto de cualquier subtema, cambia su orden o añade nuevos apartados
                    </p>
                  </div>
                </div>

                {/* Añadir nuevo subtema */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTopicNewSubtopicInput}
                    onChange={(e) => setEditTopicNewSubtopicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editTopicNewSubtopicInput.trim()) {
                        e.preventDefault();
                        const items = editTopicNewSubtopicInput
                          .split(/[,;\n]+/)
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0);
                        if (items.length > 0) {
                          setEditTopicSubtopics((prev) => [...prev, ...items]);
                        }
                        setEditTopicNewSubtopicInput('');
                      }
                    }}
                    placeholder="Añadir subtema (o varios separados por coma) y pulsar Enter..."
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!editTopicNewSubtopicInput.trim()) return;
                      const items = editTopicNewSubtopicInput
                        .split(/[,;\n]+/)
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                      if (items.length > 0) {
                        setEditTopicSubtopics((prev) => [...prev, ...items]);
                      }
                      setEditTopicNewSubtopicInput('');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>

                {/* Lista editable de subtemas */}
                {editTopicSubtopics.length === 0 ? (
                  <div className="text-center py-4 bg-white rounded-xl border border-dashed border-slate-200 text-[11px] text-slate-400">
                    Este tema aún no tiene subtemas registrados. Escribe arriba para añadir el primero.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {editTopicSubtopics.map((st, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs"
                      >
                        <span className="w-6 text-center font-mono-numbers text-[11px] font-bold text-slate-400 shrink-0">
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          value={st}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditTopicSubtopics((prev) =>
                              prev.map((item, i) => (i === idx ? val : item))
                            );
                          }}
                          placeholder={`Nombre del subtema ${idx + 1}...`}
                          className="flex-1 bg-slate-50/70 focus:bg-white border border-transparent focus:border-blue-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none"
                        />
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              setEditTopicSubtopics((prev) => {
                                const copy = [...prev];
                                const temp = copy[idx - 1];
                                copy[idx - 1] = copy[idx];
                                copy[idx] = temp;
                                return copy;
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Subir subtema"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === editTopicSubtopics.length - 1}
                            onClick={() => {
                              setEditTopicSubtopics((prev) => {
                                const copy = [...prev];
                                const temp = copy[idx + 1];
                                copy[idx + 1] = copy[idx];
                                copy[idx] = temp;
                                return copy;
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Bajar subtema"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditTopicSubtopics((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Eliminar subtema"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(() => {
                const pCount = editTopicPages ? parseInt(editTopicPages, 10) : undefined;
                const effMins = schedulerService.getMinutesPerPage(
                  editTopicDifficulty,
                  preferences?.averageMinutesPerPage,
                  preferences?.useDifficultyScalingForPages
                );
                const previewHours = schedulerService.calculateTopicTime(
                  editTopicDifficulty,
                  editTopicSubtopics.filter((s) => s.trim().length > 0).length,
                  editTopicDesc.length,
                  pCount,
                  preferences
                );
                return (
                  <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 flex items-center justify-between text-[11px]">
                    <span>Tiempo de estudio estimado según páginas, subtemas y velocidad:</span>
                    <strong className="font-mono-numbers text-blue-700">
                      {previewHours}h ({pCount && pCount > 0 ? `${pCount} págs × ` : ''}{effMins} min/pág)
                    </strong>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditedTopic}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs transition-colors"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Exportar Apuntes Cornell a PDF Estructurado */}
      <CornellPdfExportModal
        isOpen={isCornellExportModalOpen}
        onClose={() => setIsCornellExportModalOpen(false)}
        subject={subject}
        activeNote={activeCornellNote}
        activeTopic={
          activeCornellNote
            ? subject.topics.find((t) => t.id === activeCornellNote.topicId)
            : undefined
        }
        defaultScope={cornellExportDefaultScope}
        onExportComplete={(msg) => {
          setPdfExportNotice(msg);
          setTimeout(() => setPdfExportNotice(null), 4000);
        }}
      />

      {/* Modal Interactivo: Generador de Mapa Mental desde Apuntes Cornell con Gemini + D3.js */}
      {isCornellMindmapModalOpen && (() => {
        const currentCornellData = getTopicCornellData(selectedCornellMindmapTopicId);
        const topicMindmaps = subject.mindmaps.filter((m) =>
          selectedCornellMindmapTopicId ? m.topicIds.includes(selectedCornellMindmapTopicId) : true
        );
        const mindmapToRender =
          activeCornellMindmap &&
          (!selectedCornellMindmapTopicId ||
            activeCornellMindmap.topicIds.includes(selectedCornellMindmapTopicId))
            ? activeCornellMindmap
            : topicMindmaps[0] || activeCornellMindmap;

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xs">
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        Mapa Mental Jerárquico Cornell · Renderizado D3.js
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                        Gemini + d3.tree
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Genera y explora la estructura jerárquica extraída de las Ideas Clave (Cues), Cuerpo de Notas y Resumen Cornell del tema seleccionado.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCornellMindmapModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Topic & Cornell Source Bar */}
              <div className="px-6 py-3.5 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                      Tema seleccionado:
                    </label>
                    <select
                      value={selectedCornellMindmapTopicId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedCornellMindmapTopicId(nextId);
                        const existing = subject.mindmaps.find((m) =>
                          m.topicIds.includes(nextId)
                        );
                        setActiveCornellMindmap(existing || null);
                      }}
                      className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs sm:max-w-md"
                    >
                      {subject.topics.map((t, idx) => {
                        const hasNote =
                          subject.cornellNotes.some((n) => n.topicId === t.id) ||
                          Boolean(t.notes && t.notes.trim()) ||
                          Boolean(t.cues && t.cues.length > 0);
                        return (
                          <option key={t.id} value={t.id}>
                            Tema {idx + 1}: {t.title} {hasNote ? '✓ (Apuntes Cornell)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Cornell Note Metadata Pills */}
                  <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold font-mono-numbers">
                      {currentCornellData.cues.length} Cues
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-semibold font-mono-numbers">
                      {currentCornellData.notes.length} caract. en Notas
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                      {currentCornellData.summary ? 'Con Resumen Cornell' : 'Síntesis automática'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {topicMindmaps.length > 1 && (
                    <select
                      value={mindmapToRender?.id || ''}
                      onChange={(e) => {
                        const found = subject.mindmaps.find((m) => m.id === e.target.value);
                        if (found) setActiveCornellMindmap(found);
                      }}
                      className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700"
                    >
                      {topicMindmaps.map((m, i) => (
                        <option key={m.id} value={m.id}>
                          Versión {topicMindmaps.length - i}: {m.title}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => handleGenerateCornellMindmap(selectedCornellMindmapTopicId)}
                    disabled={isGeneratingCornellMindmap || !selectedCornellMindmapTopicId}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingCornellMindmap ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generando estructura con Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {mindmapToRender
                            ? 'Regenerar Mapa Cornell con IA'
                            : 'Generar Mapa Mental Cornell con IA'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error banner if any */}
              {cornellMindmapError && (
                <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                  <span>{cornellMindmapError}</span>
                  <button
                    type="button"
                    onClick={() => setCornellMindmapError(null)}
                    className="text-rose-800 font-bold underline ml-4 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              )}

              {/* Modal Body: D3.js Hierarchical Renderer */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
                {isGeneratingCornellMindmap ? (
                  <div className="h-[520px] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-8 text-center space-y-3">
                    <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Analizando apuntes Cornell con Gemini y construyendo árbol D3.js...
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md">
                      Extrayendo relaciones jerárquicas entre la columna de preguntas clave (Cues), el cuerpo de notas de "{currentCornellData.topic?.title}" y el resumen inferior.
                    </p>
                  </div>
                ) : mindmapToRender ? (
                  <D3MindMapCanvas
                    rootNode={mindmapToRender.rootNode}
                    title={mindmapToRender.title}
                    summary={mindmapToRender.summary}
                    subjectColor={subject.color}
                    height={520}
                  />
                ) : (
                  <div className="h-[460px] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
                      <GitBranch className="w-8 h-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">
                        Sin mapa mental generado aún para este tema
                      </h4>
                      <p className="text-xs text-slate-500">
                        Pulsa el botón para que Gemini analice los apuntes Cornell de{' '}
                        <strong className="text-slate-700">
                          {currentCornellData.topic?.title || 'este tema'}
                        </strong>{' '}
                        y renderice la estructura jerárquica interactiva con D3.js.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGenerateCornellMindmap(selectedCornellMindmapTopicId)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Generar Mapa Mental desde Apuntes Cornell</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal interactivo para ajustar manualmente la fecha del próximo repaso y autoevaluación de retención */}
      <TopicReviewScheduleModal
        isOpen={!!manualScheduleTopic}
        onClose={() => setManualScheduleTopic(null)}
        topic={manualScheduleTopic}
        subjectName={subject.name}
        subjectColor={subject.color}
        onSaveSchedule={handleSaveManualTopicReviewSchedule}
      />
    </div>
    </SubjectAiErrorBoundary>
  );
};
