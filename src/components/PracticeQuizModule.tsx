import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  HelpCircle,
  Check,
  X,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  Mic,
  FileText,
  CheckCircle2,
  Loader2,
  BookOpen,
  Filter,
  Award,
  Printer,
  ChevronDown,
  Layers,
  Send,
  Lightbulb,
  Zap,
  BarChart3,
  TrendingUp,
  CheckSquare,
  Calculator,
  Briefcase,
  PenTool,
  Target,
  Flame,
  Search,
  Calendar,
  SlidersHorizontal,
  Clock,
  ArrowUpRight,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Subject, Topic, CornellNote, Quiz, QuizQuestion, ExamType, ErrorLogEntry, Flashcard } from '../types';
import { CornellFlashcardExtractorModal } from './CornellFlashcardExtractorModal';
import { CustomTopicQuestionsModal } from './CustomTopicQuestionsModal';
import { getSubjectSpacedRepetitionAlert } from '../utils/courseAlerts';
import { FlashcardQuickfireMode, getSubjectQuickfireDeck } from './FlashcardQuickfireMode';
import { SpacedRepetitionQuizAccuracyChart } from './SpacedRepetitionQuizAccuracyChart';

interface PracticeQuizModuleProps {
  subjects: Subject[];
  initialSubjectId?: string;
  initialTopicIds?: string[];
  initialSpacedRepetitionFocus?: boolean;
  onSaveQuizResult: (subjectId: string, quiz: Quiz) => void;
  onLogMistake: (mistake: ErrorLogEntry) => void;
  onOpenErrorAnalysis?: () => void;
  onSaveFlashcards?: (subjectId: string, flashcards: Flashcard[]) => void;
  onUpdateSubject?: (updated: Subject) => void;
}

export const PracticeQuizModule: React.FC<PracticeQuizModuleProps> = ({
  subjects,
  initialSubjectId,
  initialTopicIds,
  initialSpacedRepetitionFocus,
  onSaveQuizResult,
  onLogMistake,
  onOpenErrorAnalysis,
  onSaveFlashcards,
  onUpdateSubject,
}) => {
  // Cornell Flashcard Extractor modal state
  const [isCornellExtractorOpen, setIsCornellExtractorOpen] = useState<boolean>(false);

  // Source selector state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || (subjects[0] ? subjects[0].id : '')
  );
  const [sourceMode, setSourceMode] = useState<'topics' | 'cornell_notes'>('topics');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(initialTopicIds || []);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>('');

  // Quiz parameters
  const [examType, setExamType] = useState<ExamType>('test');
  const [questionSourcePool, setQuestionSourcePool] = useState<'ai' | 'custom' | 'both'>('ai');
  const [difficulty, setDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('intermedio');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Custom Topic Questions & Flashcards Creator/Reviewer Modal
  const [isCustomQuestionsModalOpen, setIsCustomQuestionsModalOpen] = useState<boolean>(false);
  const [customQuestionsModalTopicId, setCustomQuestionsModalTopicId] = useState<string | undefined>(undefined);

  // Active quiz session state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState<string>('');
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);

  // AI evaluation state for open-ended or oral answers
  const [isEvaluatingOpenAnswer, setIsEvaluatingOpenAnswer] = useState<boolean>(false);
  const [openAnswerEvaluation, setOpenAnswerEvaluation] = useState<{
    score: number;
    strengths: string[];
    missingPoints: string[];
    feedback: string;
    modelAnswer: string;
  } | null>(null);

  // Inline editing state for current quiz question & answers during test runner
  const [isEditingQuestion, setIsEditingQuestion] = useState<boolean>(false);
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectOptionIndex, setEditCorrectOptionIndex] = useState<number>(0);
  const [editExplanation, setEditExplanation] = useState<string>('');
  const [runnerActionNotice, setRunnerActionNotice] = useState<string | null>(null);

  // Active view navigation
  const [activeView, setActiveView] = useState<
    'create' | 'runner' | 'history' | 'quickfire' | 'analytics' | 'cornell_deck'
  >('create');
  const [showActiveRecallModal, setShowActiveRecallModal] = useState<boolean>(false);
  const [activeRecallToast, setActiveRecallToast] = useState<string | null>(null);

  // Estado para el Generador Automático de Mazo de Flashcards desde Conceptos Clave de Notas Cornell
  const [selectedCornellSourceFilter, setSelectedCornellSourceFilter] = useState<string>('all');
  const [selectedCornellConcepts, setSelectedCornellConcepts] = useState<string[]>([]);
  const [customCornellConceptInput, setCustomCornellConceptInput] = useState<string>('');
  const [extraCornellConcepts, setExtraCornellConcepts] = useState<string[]>([]);
  const [cornellDeckTargetCount, setCornellDeckTargetCount] = useState<number>(6);
  const [isGeneratingCornellDeck, setIsGeneratingCornellDeck] = useState<boolean>(false);
  const [cornellDeckError, setCornellDeckError] = useState<string | null>(null);
  const [generatedCornellDeck, setGeneratedCornellDeck] = useState<Flashcard[]>([]);
  const [cornellDeckDisplayMode, setCornellDeckDisplayMode] = useState<'flip' | 'grid'>('flip');
  const [cornellDeckActiveIdx, setCornellDeckActiveIdx] = useState<number>(0);
  const [isCornellCardFlipped, setIsCornellCardFlipped] = useState<boolean>(false);

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

  const quickfireDeck = useMemo(
    () => getSubjectQuickfireDeck(currentSubject),
    [currentSubject]
  );

  const currentSubjectSpacedAlert = useMemo(
    () =>
      currentSubject
        ? getSubjectSpacedRepetitionAlert(currentSubject, true)
        : {
            hasPendingToday: false,
            totalPendingToday: 0,
            dueTodayCount: 0,
            overdueCount: 0,
            pendingTopics: [],
            pendingTopicIds: [],
            todayStr: '',
          },
    [currentSubject]
  );

  // Global performance metrics across all subjects
  const globalStats = useMemo(() => {
    let totalQuizzes = 0;
    let totalScoreSum = 0;
    let totalQuestionsAnswered = 0;
    let totalQuickfirePending = 0;
    let totalQuickfireDeckCards = 0;
    let totalSpacedTopicsPending = 0;

    subjects.forEach((sub) => {
      // Quizzes
      (sub.quizzes || []).forEach((q) => {
        totalQuizzes += 1;
        if (typeof q.overallScore === 'number') {
          totalScoreSum += q.overallScore;
        }
        totalQuestionsAnswered += q.questions?.length || 0;
      });

      // Quickfire flashcards
      const deck = getSubjectQuickfireDeck(sub);
      totalQuickfirePending += deck.pendingTodayCards.length;
      totalQuickfireDeckCards += deck.allCards.length;

      // Spaced alerts
      const srAlert = getSubjectSpacedRepetitionAlert(sub, true);
      totalSpacedTopicsPending += srAlert.totalPendingToday;
    });

    const avgAccuracy = totalQuizzes > 0 ? Math.round(totalScoreSum / totalQuizzes) : null;

    return {
      totalQuizzes,
      avgAccuracy,
      totalQuestionsAnswered,
      totalQuickfirePending,
      totalQuickfireDeckCards,
      totalSpacedTopicsPending,
    };
  }, [subjects]);

  // Sincronizar materia y temas cuando se salta desde una tarjeta de materia con notificación de Spaced Repetition
  React.useEffect(() => {
    if (initialSubjectId) {
      setSelectedSubjectId(initialSubjectId);
      setSourceMode('topics');
      setActiveView('create');
      const targetSub = subjects.find((s) => s.id === initialSubjectId);
      if (initialTopicIds && initialTopicIds.length > 0) {
        setSelectedTopicIds(initialTopicIds);
      } else if (targetSub) {
        const srAlert = getSubjectSpacedRepetitionAlert(targetSub, true);
        if (srAlert.hasPendingToday) {
          setSelectedTopicIds(srAlert.pendingTopicIds);
        }
      }
    }
  }, [initialSubjectId, initialTopicIds, initialSpacedRepetitionFocus, subjects]);

  // Helper to toggle topic selection
  const handleToggleTopic = (topicId: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  };

  // Select all topics in current subject
  const handleSelectAllTopics = () => {
    if (!currentSubject) return;
    if (selectedTopicIds.length === currentSubject.topics.length) {
      setSelectedTopicIds([]);
    } else {
      setSelectedTopicIds(currentSubject.topics.map((t) => t.id));
    }
  };

  // Combined selectable notes (Cornell notes + Topic notes/imported documents)
  const availableNotes = useMemo(() => {
    if (!currentSubject) return [];
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      content: string;
      createdAt: string;
      badge: string;
      cornellId?: string;
    }> = [];

    // 1. Cornell notes
    (currentSubject.cornellNotes || []).forEach((note) => {
      items.push({
        id: `cornell:${note.id}`,
        cornellId: note.id,
        title: note.title,
        subtitle: note.summary || note.notes,
        content: `APUNTES CORNELL: ${note.title}\nPreguntas detonadoras (Cues): ${note.cues.join('; ')}\nNotas detalladas: ${note.notes}\nResumen: ${note.summary}`,
        createdAt: note.createdAt,
        badge: `Cornell · ${note.cues.length} cues`,
      });
    });

    // 2. Topic notes & imported documents
    (currentSubject.topics || []).forEach((topic) => {
      const hasTopicNotes = Boolean(
        (topic.notes && topic.notes.trim().length > 0) ||
        (topic.generalNotes && topic.generalNotes.trim().length > 0) ||
        (topic.summary && topic.summary.trim().length > 0)
      );
      if (hasTopicNotes) {
        const rawNotes = topic.notes || topic.generalNotes || '';
        items.push({
          id: `topic-note:${topic.id}`,
          title: `Apuntes del Tema: ${topic.title}`,
          subtitle: topic.summary || rawNotes.slice(0, 160),
          content: `APUNTES DEL TEMA "${topic.title}":\n${rawNotes}\n${
            topic.summary ? `Resumen: ${topic.summary}\n` : ''
          }${
            topic.keyPoints && topic.keyPoints.length > 0
              ? `Puntos clave: ${topic.keyPoints.map((kp) => `${kp.title}: ${kp.detail}`).join('; ')}`
              : ''
          }`,
          createdAt: topic.lastNotesUpdatedAt ? topic.lastNotesUpdatedAt.split('T')[0] : 'Apuntes',
          badge: 'Apunte de Tema',
        });
      }

      (topic.attachedFiles || []).forEach((file) => {
        const docText = file.content || file.rawExtractedText || '';
        if (docText.trim().length > 0) {
          items.push({
            id: `doc:${file.id}`,
            title: `Documento: ${file.name}`,
            subtitle: file.summary || docText.slice(0, 160),
            content: `DOCUMENTO IMPORTADO "${file.name}" (Tema: ${topic.title}):\n${docText}\n${
              file.summary ? `Resumen IA: ${file.summary}` : ''
            }`,
            createdAt: file.date ? file.date.split('T')[0] : `${file.pageCount} págs`,
            badge: `Doc Importado · ${file.pageCount} págs`,
          });
        }
      });
    });

    return items;
  }, [currentSubject]);

  const handleToggleNoteSelection = (id: string, cornellId?: string) => {
    setSelectedNoteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      return next;
    });
    if (cornellId) {
      setSelectedNoteId(cornellId);
    }
  };

  const handleSelectAllNotes = () => {
    if (selectedNoteIds.length === availableNotes.length) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(availableNotes.map((n) => n.id));
    }
  };

  const [quizError, setQuizError] = useState<string | null>(null);

  // Generate quiz using Gemini API
  const handleGenerateQuiz = async () => {
    if (!currentSubject) return;
    setQuizError(null);

    let contentToEvaluate = '';
    let examTitle = '';

    if (sourceMode === 'topics') {
      const allTopics = currentSubject.topics || [];
      const chosenTopics = allTopics.filter((t) =>
        selectedTopicIds.length > 0 ? selectedTopicIds.includes(t.id) : true
      );

      if (chosenTopics.length > 0) {
        examTitle = `Simulacro de ${examType.toUpperCase()}: ${
          chosenTopics.length === 1
            ? chosenTopics[0].title
            : `${currentSubject.name} (${chosenTopics.length} temas)`
        }`;

        contentToEvaluate = chosenTopics
          .map((t) => {
            const notesPart = t.notes ? `\nApuntes del tema: ${t.notes.slice(0, 2000)}` : '';
            const generalNotesPart = t.generalNotes
              ? `\nNotas adicionales: ${t.generalNotes.slice(0, 1500)}`
              : '';
            const summaryPart = t.summary ? `\nResumen: ${t.summary}` : '';
            const keyPointsPart =
              Array.isArray(t.keyPoints) && t.keyPoints.length > 0
                ? `\nPuntos clave: ${t.keyPoints.join('; ')}`
                : '';
            const attachedTextPart =
              Array.isArray(t.attachedFiles) && t.attachedFiles.length > 0
                ? t.attachedFiles
                    .map((f) => f.rawExtractedText || f.content || '')
                    .filter(Boolean)
                    .join('\n')
                    .slice(0, 1500)
                : '';
            return `TEMA: ${t.title}\nDescripción: ${t.description || t.title}\nSubtemas clave: ${
              Array.isArray(t.subtopics) && t.subtopics.length > 0
                ? t.subtopics.join(', ')
                : t.title
            }${notesPart}${generalNotesPart}${summaryPart}${keyPointsPart}${
              attachedTextPart ? `\nDocumentos del tema: ${attachedTextPart}` : ''
            }`;
          })
          .join('\n\n');
      } else if (availableNotes.length > 0) {
        examTitle = `Simulacro de ${examType.toUpperCase()}: ${currentSubject.name}`;
        contentToEvaluate = availableNotes.map((n) => n.content).join('\n\n---\n\n');
      } else {
        examTitle = `Simulacro de ${examType.toUpperCase()}: ${currentSubject.name}`;
        contentToEvaluate = `TEMA: ${currentSubject.name}\nDescripción: Conceptos fundamentales, principios teóricos y aplicaciones prácticas de la asignatura ${currentSubject.name}.`;
      }
    } else {
      let chosenNotes = availableNotes.filter((n) => selectedNoteIds.includes(n.id));
      if (chosenNotes.length === 0 && availableNotes.length > 0) {
        chosenNotes = availableNotes;
        setSelectedNoteIds(availableNotes.map((n) => n.id));
      }

      if (chosenNotes.length > 0) {
        examTitle =
          chosenNotes.length === 1
            ? `Cuestionario basado en Apuntes: ${chosenNotes[0].title}`
            : `Cuestionario combinado (${chosenNotes.length} apuntes seleccionados)`;
        contentToEvaluate = chosenNotes.map((n) => n.content).join('\n\n---\n\n');
      } else if ((currentSubject.topics || []).length > 0) {
        const fallbackTopics = currentSubject.topics;
        examTitle = `Simulacro de ${examType.toUpperCase()}: ${currentSubject.name}`;
        contentToEvaluate = fallbackTopics
          .map(
            (t) =>
              `TEMA: ${t.title}\nDescripción: ${t.description || t.title}\nSubtemas clave: ${
                (t.subtopics || []).join(', ') || t.title
              }${t.notes ? `\nApuntes del tema: ${t.notes.slice(0, 1500)}` : ''}`
          )
          .join('\n\n');
      } else {
        examTitle = `Simulacro de ${examType.toUpperCase()}: ${currentSubject.name}`;
        contentToEvaluate = `TEMA: ${currentSubject.name}\nDescripción: Evaluación integral sobre ${currentSubject.name}.`;
      }
    }

    if (customInstructions.trim()) {
      contentToEvaluate += `\n\nEnfoque solicitado: ${customInstructions.trim()}`;
    }

    const allSubjectTopics = currentSubject.topics || [];
    const targetCustomTopics =
      sourceMode === 'topics' && selectedTopicIds.length > 0
        ? allSubjectTopics.filter((t) => selectedTopicIds.includes(t.id))
        : allSubjectTopics;

    const matchingCustomQuestions: QuizQuestion[] = targetCustomTopics.flatMap((t) =>
      (t.customQuestions || []).filter((q) => {
        if (examType === 'verdadero_falso') return q.questionType === 'verdadero_falso';
        if (examType === 'test') return q.questionType !== 'verdadero_falso';
        return true;
      })
    );
    const allCustomQuestionsForTopics: QuizQuestion[] = targetCustomTopics.flatMap(
      (t) => t.customQuestions || []
    );
    const customQuestionsToUse =
      matchingCustomQuestions.length > 0 ? matchingCustomQuestions : allCustomQuestionsForTopics;

    // Si el usuario eligió revisar SOLO sus preguntas creadas
    if (questionSourcePool === 'custom') {
      if (customQuestionsToUse.length === 0) {
        setQuizError(
          'Aún no has creado preguntas propias (Test o Verdadero/Falso) en los temas seleccionados. Pulsa en "Crear / Gestionar Mis Preguntas" para añadir las tuyas o selecciona "IA de la Aplicación".'
        );
        return;
      }

      const effectiveExamType: ExamType =
        examType === 'verdadero_falso' ||
        customQuestionsToUse.every((q) => q.questionType === 'verdadero_falso')
          ? 'verdadero_falso'
          : 'test';

      const customQuiz: Quiz = {
        id: `quiz-custom-${Date.now()}`,
        topicId: sourceMode === 'topics' && selectedTopicIds[0] ? selectedTopicIds[0] : undefined,
        examTitle: `Repaso de Mis Preguntas Propias (${customQuestionsToUse.length}) · ${currentSubject.name}`,
        examType: effectiveExamType,
        difficulty,
        questions: customQuestionsToUse.map((q, idx) => ({
          ...q,
          id: q.id || `custom-q-${idx}`,
          userAnswer: undefined,
          score: undefined,
        })),
      };

      setQuizFinished(false);
      setCurrentQIndex(0);
      setIsAnswerRevealed(false);
      setSelectedOption(null);
      setWrittenAnswer('');
      setOpenAnswerEvaluation(null);
      setActiveQuiz(customQuiz);
      setActiveView('runner');
      return;
    }

    setIsGenerating(true);
    setQuizFinished(false);
    setCurrentQIndex(0);
    setIsAnswerRevealed(false);
    setSelectedOption(null);
    setWrittenAnswer('');
    setOpenAnswerEvaluation(null);

    try {
      const response = await fetch('/api/gemini/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: examTitle,
          topicContent: contentToEvaluate,
          examType,
          difficulty,
          questionCount,
        }),
      });

      const resData = await response.json().catch(() => ({}));
      const payload = resData?.data || resData;

      if (response.ok && payload && Array.isArray(payload.questions) && payload.questions.length > 0) {
        const aiQuestions: QuizQuestion[] = payload.questions.map((q: any, i: number) => ({
          id: q.id || `q-${i}`,
          prompt: q.prompt || `Pregunta ${i + 1} sobre ${examTitle}`,
          options: Array.isArray(q.options) ? q.options : [],
          correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
          explanation: q.explanation || '',
          optionExplanations: Array.isArray(q.optionExplanations) ? q.optionExplanations : [],
          keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints : [],
          rubricCriteria: Array.isArray(q.rubricCriteria) ? q.rubricCriteria : [],
          isCustom: false,
        }));

        const combinedQuestions =
          questionSourcePool === 'both' && customQuestionsToUse.length > 0
            ? [
                ...customQuestionsToUse.map((cq) => ({
                  ...cq,
                  userAnswer: undefined,
                  score: undefined,
                })),
                ...aiQuestions,
              ]
            : aiQuestions;

        const quiz: Quiz = {
          id: `quiz-${Date.now()}`,
          topicId: sourceMode === 'topics' && selectedTopicIds[0] ? selectedTopicIds[0] : undefined,
          sourceNoteIds: sourceMode === 'cornell_notes' ? selectedNoteIds : undefined,
          examTitle: payload.examTitle || examTitle,
          examType,
          difficulty,
          questions: combinedQuestions,
        };

        setActiveQuiz(quiz);
        setActiveView('runner');
      } else {
        setQuizError(
          resData?.error ||
            'No se pudo generar el cuestionario en este momento. Por favor, inténtalo de nuevo.'
        );
      }
    } catch (e: any) {
      console.error('Error generating quiz', e);
      setQuizError(
        e?.message || 'Error de conexión al generar el cuestionario. Inténtalo de nuevo.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Launch an Express AI Quiz in 1 single click (for a specific topic or the active subject)
  const handleQuickExpressQuiz = async (opts?: {
    topicId?: string;
    count?: number;
    type?: ExamType;
    diff?: 'basico' | 'intermedio' | 'avanzado';
  }) => {
    if (!currentSubject || isGenerating) return;
    setQuizError(null);

    const targetType = opts?.type || examType || 'test';
    const targetDiff = opts?.diff || difficulty || 'intermedio';
    const targetCount = opts?.count || 5;

    if (opts?.topicId) {
      setSelectedTopicIds([opts.topicId]);
      setSourceMode('topics');
    }
    if (opts?.type) setExamType(opts.type);
    if (opts?.diff) setDifficulty(opts.diff);
    if (opts?.count) setQuestionCount(opts.count);

    const allTopics = currentSubject.topics || [];
    const chosenTopics = opts?.topicId
      ? allTopics.filter((t) => t.id === opts.topicId)
      : selectedTopicIds.length > 0
      ? allTopics.filter((t) => selectedTopicIds.includes(t.id))
      : allTopics;

    const examTitle =
      chosenTopics.length === 1
        ? `Test Rápido IA: ${chosenTopics[0].title}`
        : `Test Rápido IA: ${currentSubject.name}`;

    const contentToEvaluate =
      chosenTopics.length > 0
        ? chosenTopics
            .map((t) => {
              const notesPart = t.notes ? `\nApuntes: ${t.notes.slice(0, 1400)}` : '';
              const summaryPart = t.summary ? `\nResumen: ${t.summary}` : '';
              return `TEMA: ${t.title}\nDescripción: ${t.description || t.title}\nSubtemas clave: ${
                (t.subtopics || []).join(', ') || t.title
              }${notesPart}${summaryPart}`;
            })
            .join('\n\n')
        : `TEMA: ${currentSubject.name}\nDescripción: Evaluación ágil de ${currentSubject.name}.`;

    setIsGenerating(true);
    setQuizFinished(false);
    setCurrentQIndex(0);
    setIsAnswerRevealed(false);
    setSelectedOption(null);
    setWrittenAnswer('');
    setOpenAnswerEvaluation(null);

    try {
      const response = await fetch('/api/gemini/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: examTitle,
          topicContent: contentToEvaluate,
          examType: targetType,
          difficulty: targetDiff,
          questionCount: targetCount,
        }),
      });

      const resData = await response.json().catch(() => ({}));
      const payload = resData?.data || resData;

      if (response.ok && payload && Array.isArray(payload.questions) && payload.questions.length > 0) {
        const quiz: Quiz = {
          id: `quiz-${Date.now()}`,
          topicId: opts?.topicId || (selectedTopicIds[0] ? selectedTopicIds[0] : undefined),
          examTitle: payload.examTitle || examTitle,
          examType: targetType,
          difficulty: targetDiff,
          questions: payload.questions.map((q: any, i: number) => ({
            id: q.id || `q-${i}`,
            prompt: q.prompt || `Pregunta ${i + 1} sobre ${examTitle}`,
            options: Array.isArray(q.options) ? q.options : [],
            correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
            explanation: q.explanation || '',
            optionExplanations: Array.isArray(q.optionExplanations) ? q.optionExplanations : [],
            keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints : [],
            rubricCriteria: Array.isArray(q.rubricCriteria) ? q.rubricCriteria : [],
          })),
        };
        setActiveQuiz(quiz);
        setActiveView('runner');
      } else {
        setQuizError(resData?.error || 'No se pudo generar el test rápido.');
      }
    } catch (e: any) {
      setQuizError(e?.message || 'Error al generar el test rápido.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Confirm or check answer
  const handleConfirmAnswer = () => {
    if (!activeQuiz) return;
    const currentQ = activeQuiz.questions[currentQIndex];

    if (activeQuiz.examType === 'test' || activeQuiz.examType === 'verdadero_falso') {
      if (selectedOption === null) return;
      currentQ.userAnswer = selectedOption;
      const isCorrect = selectedOption === currentQ.correctOptionIndex;
      currentQ.score = isCorrect ? 100 : 0;

      // Log error to mistake bank if wrong
      if (!isCorrect) {
        onLogMistake({
          id: `err-${Date.now()}`,
          subjectId: currentSubject.id,
          topicTitle: currentSubject.name,
          questionPrompt: currentQ.prompt,
          userMistake: currentQ.options ? currentQ.options[selectedOption] : 'Opción incorrecta',
          correctAnswer: currentQ.options
            ? currentQ.options[currentQ.correctOptionIndex || 0]
            : currentQ.explanation,
          rootCauseCategory: 'falta_concepto',
          date: new Date().toISOString().split('T')[0],
          resolved: false,
        });
      }
      setIsAnswerRevealed(true);
    }
  };

  // Evaluate open or oral answer using Gemini AI
  const handleEvaluateOpenAnswer = async () => {
    if (!activeQuiz || !writtenAnswer.trim()) return;
    const currentQ = activeQuiz.questions[currentQIndex];

    setIsEvaluatingOpenAnswer(true);
    setQuizError(null);
    try {
      const res = await fetch('/api/gemini/evaluate-open-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionPrompt: currentQ.prompt,
          userAnswer: writtenAnswer,
          examType: activeQuiz.examType,
          keyPoints: currentQ.keyPoints || [],
          rubricCriteria: currentQ.rubricCriteria || [],
          difficulty: activeQuiz.difficulty,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      const evalData = resData?.data || resData;
      if (res.ok && evalData && typeof evalData.score === 'number') {
        setOpenAnswerEvaluation({
          score: evalData.score,
          strengths: Array.isArray(evalData.strengths) ? evalData.strengths : [],
          missingPoints: Array.isArray(evalData.missingPoints) ? evalData.missingPoints : [],
          feedback: evalData.feedback || '',
          modelAnswer: evalData.modelAnswer || currentQ.explanation || '',
        });
        currentQ.userAnswer = writtenAnswer;
        currentQ.score = evalData.score;
        currentQ.feedback = evalData.feedback;
        setIsAnswerRevealed(true);
      } else {
        setQuizError(resData?.error || 'Error al evaluar la respuesta abierta.');
      }
    } catch (e: any) {
      console.error('Error evaluating open answer', e);
      setQuizError(e?.message || 'Error al evaluar la respuesta abierta.');
    } finally {
      setIsEvaluatingOpenAnswer(false);
    }
  };

  // Advance to next question or complete quiz
  const handleNextQuestion = () => {
    if (!activeQuiz) return;
    setIsEditingQuestion(false);
    setRunnerActionNotice(null);
    if (currentQIndex < activeQuiz.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setSelectedOption(null);
      setWrittenAnswer('');
      setIsAnswerRevealed(false);
      setOpenAnswerEvaluation(null);
    } else {
      // Complete quiz
      const totalScore = activeQuiz.questions.reduce((acc, q) => acc + (q.score || 0), 0);
      const overall = Math.round(totalScore / Math.max(1, activeQuiz.questions.length));
      const finishedQuiz: Quiz = {
        ...activeQuiz,
        overallScore: overall,
        takenAt: new Date().toISOString().split('T')[0],
      };
      setActiveQuiz(finishedQuiz);
      onSaveQuizResult(currentSubject.id, finishedQuiz);
      setQuizFinished(true);

      if (overall >= 70) {
        confetti({ particleCount: 80, spread: 70 });
      }
    }
  };

  // Start inline editing of current question and answers during test
  const handleStartEditQuestion = () => {
    if (!activeQuiz) return;
    const currentQ = activeQuiz.questions[currentQIndex];
    if (!currentQ) return;
    setEditPrompt(currentQ.prompt || '');
    setEditOptions(
      Array.isArray(currentQ.options) && currentQ.options.length > 0
        ? [...currentQ.options]
        : ['', '', '', '']
    );
    setEditCorrectOptionIndex(
      typeof currentQ.correctOptionIndex === 'number' ? currentQ.correctOptionIndex : 0
    );
    setEditExplanation(currentQ.explanation || '');
    setIsEditingQuestion(true);
    setRunnerActionNotice(null);
  };

  // Save inline modifications to current question, answer options, and linked flashcard
  const handleSaveEditQuestion = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeQuiz) return;
    const currentQ = activeQuiz.questions[currentQIndex];
    if (!currentQ) return;

    const trimmedPrompt = editPrompt.trim();
    if (!trimmedPrompt) return;

    const oldPromptLower = (currentQ.prompt || '').trim().toLowerCase();
    const isChoiceMode =
      activeQuiz.examType === 'test' || activeQuiz.examType === 'verdadero_falso';
    const cleanedOptions = isChoiceMode
      ? editOptions.map((o, idx) => o.trim() || `Opción ${String.fromCharCode(65 + idx)}`)
      : currentQ.options;

    const validCorrectIdx =
      cleanedOptions && cleanedOptions.length > 0
        ? Math.min(Math.max(0, editCorrectOptionIndex), cleanedOptions.length - 1)
        : 0;

    const updatedExplanation = editExplanation.trim() || currentQ.explanation || '';

    const updatedQ: QuizQuestion = {
      ...currentQ,
      prompt: trimmedPrompt,
      options: cleanedOptions,
      correctOptionIndex: validCorrectIdx,
      explanation: updatedExplanation,
      score:
        isAnswerRevealed && isChoiceMode && selectedOption !== null
          ? selectedOption === validCorrectIdx
            ? 100
            : 0
          : currentQ.score,
    };

    const nextQuestions = activeQuiz.questions.map((q, idx) =>
      idx === currentQIndex ? updatedQ : q
    );

    setActiveQuiz({
      ...activeQuiz,
      questions: nextQuestions,
    });

    // Si existe una flashcard vinculada en la asignatura con ese enunciado, actualizarla también
    if (onUpdateSubject && currentSubject && Array.isArray(currentSubject.flashcards)) {
      const hasLinkedCard = currentSubject.flashcards.some(
        (fc) =>
          (fc.question || '').trim().toLowerCase() === oldPromptLower ||
          (fc.concept || '').trim().toLowerCase() === oldPromptLower
      );
      if (hasLinkedCard) {
        const newAnswerText =
          activeQuiz.examType === 'test' && cleanedOptions && cleanedOptions[validCorrectIdx]
            ? `${cleanedOptions[validCorrectIdx]}${updatedExplanation ? ` — ${updatedExplanation}` : ''}`
            : updatedExplanation;

        const updatedFlashcards = currentSubject.flashcards.map((fc) => {
          const matches =
            (fc.question || '').trim().toLowerCase() === oldPromptLower ||
            (fc.concept || '').trim().toLowerCase() === oldPromptLower;
          if (!matches) return fc;
          return {
            ...fc,
            question: trimmedPrompt,
            answer: newAnswerText || fc.answer,
            concept: fc.concept ? trimmedPrompt : undefined,
            definition: fc.definition ? newAnswerText || fc.definition : undefined,
          };
        });
        onUpdateSubject({
          ...currentSubject,
          flashcards: updatedFlashcards,
        });
      }
    }

    setIsEditingQuestion(false);
    setRunnerActionNotice('Pregunta y respuestas actualizadas correctamente.');
  };

  // Delete current question from active test (and remove matching flashcard if present)
  const handleDeleteCurrentQuestion = () => {
    if (!activeQuiz) return;
    const currentQ = activeQuiz.questions[currentQIndex];
    if (!currentQ) return;

    const promptLower = (currentQ.prompt || '').trim().toLowerCase();

    // Si existe una flashcard con el mismo enunciado en la materia, eliminarla también
    if (onUpdateSubject && currentSubject && Array.isArray(currentSubject.flashcards)) {
      const filteredCards = currentSubject.flashcards.filter(
        (fc) =>
          (fc.question || '').trim().toLowerCase() !== promptLower &&
          (fc.concept || '').trim().toLowerCase() !== promptLower
      );
      if (filteredCards.length !== currentSubject.flashcards.length) {
        onUpdateSubject({
          ...currentSubject,
          flashcards: filteredCards,
        });
      }
    }

    const remainingQuestions = activeQuiz.questions.filter((_, idx) => idx !== currentQIndex);
    setIsEditingQuestion(false);
    setSelectedOption(null);
    setWrittenAnswer('');
    setIsAnswerRevealed(false);
    setOpenAnswerEvaluation(null);

    if (remainingQuestions.length === 0) {
      setActiveQuiz(null);
      setActiveView('create');
      return;
    }

    if (currentQIndex >= remainingQuestions.length) {
      // Era la última pregunta: finalizar el test con las preguntas restantes ya respondidas
      const totalScore = remainingQuestions.reduce((acc, q) => acc + (q.score || 0), 0);
      const overall = Math.round(totalScore / remainingQuestions.length);
      const finishedQuiz: Quiz = {
        ...activeQuiz,
        questions: remainingQuestions,
        overallScore: overall,
        takenAt: new Date().toISOString().split('T')[0],
      };
      setCurrentQIndex(remainingQuestions.length - 1);
      setActiveQuiz(finishedQuiz);
      onSaveQuizResult(currentSubject.id, finishedQuiz);
      setQuizFinished(true);
    } else {
      setActiveQuiz({
        ...activeQuiz,
        questions: remainingQuestions,
      });
      setRunnerActionNotice('Pregunta descartada del test.');
    }
  };

  // Save or update current test question as a Flashcard in the subject
  const handleSaveCurrentQuestionAsFlashcard = () => {
    if (!activeQuiz || !currentSubject) return;
    const currentQ = activeQuiz.questions[currentQIndex];
    if (!currentQ) return;

    const questionText = currentQ.prompt.trim();
    const correctOptionText =
      activeQuiz.examType === 'test' &&
      Array.isArray(currentQ.options) &&
      typeof currentQ.correctOptionIndex === 'number'
        ? currentQ.options[currentQ.correctOptionIndex] || ''
        : '';

    const answerText = correctOptionText
      ? `${correctOptionText}${currentQ.explanation ? `\n\nExplicación: ${currentQ.explanation}` : ''}`
      : currentQ.explanation || openAnswerEvaluation?.modelAnswer || 'Ver apuntes del tema.';

    const todayStr = new Date().toISOString().split('T')[0];
    const newCard: Flashcard = {
      id: `fc-quiz-${Date.now()}`,
      topicId: activeQuiz.topicId || currentSubject.topics?.[0]?.id || 'general',
      question: questionText,
      answer: answerText,
      conceptTag: activeQuiz.examTitle || currentSubject.name,
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      nextReview: todayStr,
    };

    if (onUpdateSubject) {
      const existing = currentSubject.flashcards || [];
      const existingIdx = existing.findIndex(
        (fc) => (fc.question || '').trim().toLowerCase() === questionText.toLowerCase()
      );
      const nextFlashcards =
        existingIdx >= 0
          ? existing.map((fc, i) =>
              i === existingIdx ? { ...fc, question: questionText, answer: answerText } : fc
            )
          : [newCard, ...existing];

      onUpdateSubject({
        ...currentSubject,
        flashcards: nextFlashcards,
      });
      setRunnerActionNotice(
        existingIdx >= 0
          ? 'Flashcard actualizada en el mazo de la asignatura.'
          : 'Pregunta guardada como Flashcard en la asignatura.'
      );
    } else if (onSaveFlashcards) {
      onSaveFlashcards(currentSubject.id, [newCard]);
      setRunnerActionNotice('Pregunta guardada como Flashcard en la asignatura.');
    }
  };

  // Feedback de éxito al generar y guardar flashcards
  const [flashcardSuccessMsg, setFlashcardSuccessMsg] = useState<string | null>(null);

  // Función en el módulo de Cuestionarios para iniciar la extracción de flashcards desde apuntes Cornell
  const handleStartCornellExtraction = () => {
    const notes = currentSubject?.cornellNotes || [];
    if (notes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(notes[0].id);
    }
    setIsCornellExtractorOpen(true);
  };

  // Extraer todos los "conceptos clave" disponibles en las notas Cornell y apuntes de la asignatura actual
  const cornellKeyConceptsData = useMemo(() => {
    if (!currentSubject) {
      return {
        sources: [] as Array<{
          id: string;
          title: string;
          topicId?: string;
          cornellNoteId?: string;
          notesContent: string;
          summary: string;
          cues: string[];
          keyPoints: Array<{ title: string; detail: string }>;
        }>,
        allConcepts: [] as Array<{
          concept: string;
          sourceId: string;
          sourceTitle: string;
          topicId?: string;
        }>,
      };
    }

    const sources: Array<{
      id: string;
      title: string;
      topicId?: string;
      cornellNoteId?: string;
      notesContent: string;
      summary: string;
      cues: string[];
      keyPoints: Array<{ title: string; detail: string }>;
    }> = [];

    const seenConcepts = new Set<string>();
    const allConcepts: Array<{
      concept: string;
      sourceId: string;
      sourceTitle: string;
      topicId?: string;
    }> = [];

    const registerConcept = (
      rawConcept: string,
      sourceId: string,
      sourceTitle: string,
      topicId?: string
    ) => {
      const clean = (rawConcept || '').replace(/^[•\-*\d.)\s]+/, '').trim();
      if (!clean || clean.length < 2) return;
      const key = clean.toLowerCase();
      if (seenConcepts.has(key)) return;
      seenConcepts.add(key);
      allConcepts.push({
        concept: clean,
        sourceId,
        sourceTitle,
        topicId,
      });
    };

    // 1. Notas Cornell explícitas de la asignatura
    (currentSubject.cornellNotes || []).forEach((note) => {
      const srcId = `cn:${note.id}`;
      const kps = (note.keyPoints || []).map((kp) => ({
        title: kp.title,
        detail: kp.detail,
      }));
      sources.push({
        id: srcId,
        title: note.title,
        topicId: note.topicId,
        cornellNoteId: note.id,
        notesContent: note.notes || '',
        summary: note.summary || '',
        cues: note.cues || [],
        keyPoints: kps,
      });

      (note.cues || []).forEach((cue) =>
        registerConcept(cue, srcId, note.title, note.topicId)
      );
      kps.forEach((kp) =>
        registerConcept(kp.title, srcId, note.title, note.topicId)
      );
    });

    // 2. Conceptos clave, Cues y Puntos Clave guardados en los temas
    (currentSubject.topics || []).forEach((topic) => {
      const hasTopicCornell =
        (topic.cues && topic.cues.length > 0) ||
        (topic.keyPoints && topic.keyPoints.length > 0) ||
        (topic.notes && topic.notes.trim().length > 0) ||
        (topic.generalNotes && topic.generalNotes.trim().length > 0);

      if (hasTopicCornell) {
        const srcId = `tp:${topic.id}`;
        const kps = (topic.keyPoints || []).map((kp) => ({
          title: kp.title,
          detail: kp.detail,
        }));
        sources.push({
          id: srcId,
          title: `Cornell Tema: ${topic.title}`,
          topicId: topic.id,
          notesContent: topic.notes || topic.generalNotes || topic.description || '',
          summary: topic.summary || topic.description || '',
          cues: topic.cues || [],
          keyPoints: kps,
        });

        (topic.cues || []).forEach((cue) =>
          registerConcept(cue, srcId, topic.title, topic.id)
        );
        kps.forEach((kp) =>
          registerConcept(kp.title, srcId, topic.title, topic.id)
        );
        if (
          (!topic.cues || topic.cues.length === 0) &&
          kps.length === 0 &&
          Array.isArray(topic.subtopics)
        ) {
          topic.subtopics.slice(0, 4).forEach((sub) =>
            registerConcept(sub, srcId, topic.title, topic.id)
          );
        }
      }
    });

    // 3. Si aún no hay conceptos explícitos pero hay temas, usar los subtemas/títulos como conceptos clave base
    if (allConcepts.length === 0 && (currentSubject.topics || []).length > 0) {
      (currentSubject.topics || []).forEach((topic) => {
        const srcId = `tp:${topic.id}`;
        if (!sources.some((s) => s.id === srcId)) {
          sources.push({
            id: srcId,
            title: topic.title,
            topicId: topic.id,
            notesContent: topic.description || topic.title,
            summary: topic.summary || topic.description || '',
            cues: topic.subtopics || [],
            keyPoints: [],
          });
        }
        if (Array.isArray(topic.subtopics) && topic.subtopics.length > 0) {
          topic.subtopics.forEach((sub) =>
            registerConcept(sub, srcId, topic.title, topic.id)
          );
        } else {
          registerConcept(topic.title, srcId, topic.title, topic.id);
        }
      });
    }

    // Añadir conceptos personalizados agregados por el usuario en la sesión
    extraCornellConcepts.forEach((customConcept) => {
      registerConcept(customConcept, 'custom', 'Concepto Añadido');
    });

    return { sources, allConcepts };
  }, [currentSubject, extraCornellConcepts]);

  // Conceptos filtrados según la nota Cornell / tema elegido
  const filteredCornellConcepts = useMemo(() => {
    if (selectedCornellSourceFilter === 'all') {
      return cornellKeyConceptsData.allConcepts;
    }
    return cornellKeyConceptsData.allConcepts.filter(
      (item) =>
        item.sourceId === selectedCornellSourceFilter || item.sourceId === 'custom'
    );
  }, [cornellKeyConceptsData, selectedCornellSourceFilter]);

  // Sincronizar selección por defecto de conceptos clave al cambiar de materia o filtro
  React.useEffect(() => {
    const conceptsList = filteredCornellConcepts.map((c) => c.concept);
    setSelectedCornellConcepts(conceptsList.slice(0, 12));
  }, [selectedSubjectId, selectedCornellSourceFilter, filteredCornellConcepts.length]);

  const handleToggleCornellConcept = (concept: string) => {
    setSelectedCornellConcepts((prev) =>
      prev.includes(concept)
        ? prev.filter((item) => item !== concept)
        : [...prev, concept]
    );
  };

  const handleAddCustomCornellConcept = () => {
    const clean = customCornellConceptInput.trim();
    if (!clean) return;
    if (!extraCornellConcepts.includes(clean)) {
      setExtraCornellConcepts((prev) => [...prev, clean]);
    }
    if (!selectedCornellConcepts.includes(clean)) {
      setSelectedCornellConcepts((prev) => [...prev, clean]);
    }
    setCustomCornellConceptInput('');
  };

  // Generar automáticamente con IA el mazo de flashcards con definiciones, ejemplos prácticos y situaciones de uso real desde los conceptos clave Cornell
  const handleGenerateCornellConceptDeck = async (overrideSourceId?: string) => {
    if (!currentSubject || isGeneratingCornellDeck) return;
    setIsGeneratingCornellDeck(true);
    setCornellDeckError(null);

    const activeFilter = overrideSourceId || selectedCornellSourceFilter;
    const chosenSources =
      activeFilter === 'all'
        ? cornellKeyConceptsData.sources
        : cornellKeyConceptsData.sources.filter((s) => s.id === activeFilter);

    const primarySource = chosenSources[0] || cornellKeyConceptsData.sources[0];
    const combinedNotesContent = chosenSources
      .map((s) => `[${s.title}]\n${s.notesContent}`)
      .join('\n\n')
      .slice(0, 8000);
    const combinedSummary = chosenSources
      .map((s) => s.summary)
      .filter(Boolean)
      .join(' | ');
    const combinedCues = chosenSources.flatMap((s) => s.cues);
    const combinedKeyPoints = chosenSources.flatMap((s) => s.keyPoints);

    const termsToGenerate =
      selectedCornellConcepts.length > 0
        ? selectedCornellConcepts
        : filteredCornellConcepts.map((c) => c.concept).slice(0, cornellDeckTargetCount);

    const effectiveCount =
      termsToGenerate.length > 0
        ? Math.min(12, Math.max(cornellDeckTargetCount, Math.min(termsToGenerate.length, 10)))
        : cornellDeckTargetCount;

    try {
      const response = await fetch('/api/gemini/extract-cornell-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: currentSubject.name,
          topicTitle:
            chosenSources.length === 1
              ? chosenSources[0].title
              : `Notas Cornell de ${currentSubject.name}`,
          notesContent: combinedNotesContent || currentSubject.name,
          cues: combinedCues,
          keyPoints: combinedKeyPoints,
          summary: combinedSummary,
          selectedTerms: termsToGenerate,
          count: effectiveCount,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success || !resData.data?.flashcards) {
        throw new Error(
          resData.error ||
            'No se pudo generar el mazo de flashcards desde los conceptos clave Cornell.'
        );
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const rawCards: any[] = resData.data.flashcards || [];

      const createdDeck: Flashcard[] = rawCards.map((c, idx) => {
        const term = c.term || termsToGenerate[idx] || `Concepto Clave ${idx + 1}`;
        const definition =
          c.definition || `Definición académica de ${term} en ${currentSubject.name}.`;
        const practicalExample =
          c.practicalExample ||
          c.practicalCase ||
          `Ejemplo práctico aplicado sobre ${term}.`;
        const realWorldScenario =
          c.realWorldScenario ||
          `Situación de uso real de ${term} en el ámbito profesional de ${currentSubject.name}.`;

        const compositeAnswer = `📘 Definición:\n${definition}\n\n💡 Ejemplo Práctico:\n${practicalExample}\n\n🌍 Situación de Uso Real:\n${realWorldScenario}`;

        return {
          id: `fc-cornell-concept-${Date.now()}-${idx}`,
          topicId: primarySource?.topicId || currentSubject.topics?.[0]?.id,
          sourceCornellNoteId: primarySource?.cornellNoteId,
          question: term,
          answer: compositeAnswer,
          concept: term,
          definition,
          practicalExample,
          realWorldScenario,
          hint: c.hint || `Recuerda su definición, ejemplo práctico y caso real.`,
          conceptTag: c.conceptTag || primarySource?.title || currentSubject.name,
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          nextReview: todayStr,
          isCustom: false,
        };
      });

      setGeneratedCornellDeck(createdDeck);
      setCornellDeckActiveIdx(0);
      setIsCornellCardFlipped(false);
      setActiveView('cornell_deck');

      // Guardar automáticamente el mazo en la asignatura
      if (onSaveFlashcards) {
        onSaveFlashcards(currentSubject.id, createdDeck);
      } else if (onUpdateSubject) {
        onUpdateSubject({
          ...currentSubject,
          flashcards: [...createdDeck, ...(currentSubject.flashcards || [])],
        });
      }

      setFlashcardSuccessMsg(
        `¡Mazo de ${createdDeck.length} flashcards generado automáticamente con IA (Definición + Ejemplo Práctico + Situación Real) y guardado en ${currentSubject.name}!`
      );
      setTimeout(() => setFlashcardSuccessMsg(null), 6000);
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch (_) {}
    } catch (err: any) {
      console.error('Error generating Cornell concept deck:', err);
      setCornellDeckError(
        err?.message || 'Error al generar el mazo automático desde conceptos Cornell.'
      );
    } finally {
      setIsGeneratingCornellDeck(false);
    }
  };

  // Filtered topics based on search
  const filteredTopics = useMemo(() => {
    const list = currentSubject?.topics || [];
    if (!topicSearchQuery.trim()) return list;
    const q = topicSearchQuery.toLowerCase();
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.subtopics && t.subtopics.some((st) => st.toLowerCase().includes(q)))
    );
  }, [currentSubject, topicSearchQuery]);

  if (activeView === 'quickfire') {
    return (
      <FlashcardQuickfireMode
        subjects={subjects}
        selectedSubjectId={currentSubject?.id || selectedSubjectId}
        onChangeSubject={(subId) => {
          setSelectedSubjectId(subId);
          setSelectedTopicIds([]);
          setSelectedNoteId('');
          setSelectedNoteIds([]);
        }}
        onUpdateSubject={onUpdateSubject}
        onExitQuickfire={() => setActiveView('create')}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Notificación de éxito al crear flashcards */}
      {flashcardSuccessMsg && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{flashcardSuccessMsg}</span>
          </div>
          <button
            onClick={() => setFlashcardSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      {/* EXECUTIVE PERFORMANCE HUD / TOP METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Completed Quizzes */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-blue-100">
              Simulacros Hechos
            </span>
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Award className="w-4 h-4 text-blue-100" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono-numbers">
              {globalStats.totalQuizzes}
            </div>
            <p className="text-[11px] text-blue-100/80 mt-0.5 flex items-center gap-1">
              <span>{globalStats.totalQuestionsAnswered} preguntas evaluadas</span>
            </p>
          </div>
        </div>

        {/* Metric 2: Average Accuracy */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
              Precisión Media
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              globalStats.avgAccuracy === null
                ? 'bg-slate-100 text-slate-400'
                : globalStats.avgAccuracy >= 80
                ? 'bg-emerald-50 text-emerald-600'
                : globalStats.avgAccuracy >= 60
                ? 'bg-amber-50 text-amber-600'
                : 'bg-rose-50 text-rose-600'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono-numbers text-slate-900">
                {globalStats.avgAccuracy !== null ? `${globalStats.avgAccuracy}%` : '—'}
              </span>
              {globalStats.avgAccuracy !== null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                  globalStats.avgAccuracy >= 80
                    ? 'bg-emerald-100 text-emerald-800'
                    : globalStats.avgAccuracy >= 60
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {globalStats.avgAccuracy >= 80 ? 'Excelente' : globalStats.avgAccuracy >= 60 ? 'Bien' : 'Reforzar'}
                </span>
              )}
            </div>
            {/* Accuracy Visual Bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${
                  (globalStats.avgAccuracy || 0) >= 80
                    ? 'bg-emerald-500'
                    : (globalStats.avgAccuracy || 0) >= 60
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${globalStats.avgAccuracy || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 3: Quickfire Flashcards */}
        <div
          onClick={() => setActiveView('quickfire')}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 shadow-2xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-amber-700">
              Flashcards Quickfire
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 group-hover:bg-amber-500 text-amber-600 group-hover:text-white transition-colors flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono-numbers text-slate-900 group-hover:text-amber-600 transition-colors">
                {globalStats.totalQuickfirePending}
              </span>
              <span className="text-xs text-slate-400 font-semibold">pendientes hoy</span>
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1">
              <span>{globalStats.totalQuickfireDeckCards} tarjetas activas</span>
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </p>
          </div>
        </div>

        {/* Metric 4: Spaced Repetition Due Today */}
        <div
          onClick={() => setShowActiveRecallModal(true)}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md shadow-2xs transition-all cursor-pointer group flex flex-col justify-between"
          title="Haz clic para abrir el panel de Active Recall y repasar los temas pendientes"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-700">
              Curva del Olvido (SR)
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white transition-colors flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono-numbers text-slate-900 group-hover:text-indigo-600 transition-colors">
                {globalStats.totalSpacedTopicsPending}
              </span>
              <span className="text-xs text-slate-400 font-semibold">temas a repasar</span>
            </div>
            <p className="text-[11px] text-indigo-700 font-bold mt-1.5 flex items-center gap-1 group-hover:text-indigo-900 transition-colors">
              <span className="underline underline-offset-2">Evita el olvido con active recall</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </p>
          </div>
        </div>
      </div>

      {/* HEADER & MAIN NAVIGATION BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Laboratorio de Simulacros y Cuestionarios IA
                </h2>
                <p className="text-xs text-slate-500">
                  Genera exámenes con rúbrica universitaria, repasa mazos Flashcard Quickfire y visualiza tu curva de retención.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quickfire Fast-Launch Button */}
            <button
              type="button"
              onClick={() => setActiveView('quickfire')}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-2xs hover:shadow-sm transition-all cursor-pointer group"
              title="Modo Flashcard Quickfire: repasa rápidamente todas las flashcards"
            >
              <Zap className="w-4 h-4 text-amber-100 group-hover:scale-110 transition-transform shrink-0" />
              <span>Quickfire</span>
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-900/40 rounded-md font-mono-numbers text-amber-50 font-semibold">
                {quickfireDeck.pendingTodayCards.length > 0
                  ? `${quickfireDeck.pendingTodayCards.length} hoy`
                  : `${quickfireDeck.allCards.length}`}
              </span>
            </button>

            {/* Cornell Flashcards Extractor Button */}
            <button
              type="button"
              onClick={handleStartCornellExtraction}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer group"
              title="Extraer conceptos clave de las notas Cornell y generar flashcards"
            >
              <Layers className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
              <span>Extraer Cornell</span>
              {currentSubject?.cornellNotes && currentSubject.cornellNotes.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-emerald-200/80 text-emerald-900 rounded-md font-mono-numbers font-semibold">
                  {currentSubject.cornellNotes.length}
                </span>
              )}
            </button>

            {/* Custom Questions & Flashcards Creator Button */}
            <button
              type="button"
              onClick={() => {
                setCustomQuestionsModalTopicId(selectedTopicIds[0] || currentSubject?.topics?.[0]?.id);
                setIsCustomQuestionsModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer group"
              title="Crear y revisar mis propias flashcards, preguntas de test y verdadero/falso por tema"
            >
              <Plus className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
              <span>Mis Preguntas / V-F / Flashcards</span>
            </button>

            {onOpenErrorAnalysis && (
              <button
                onClick={onOpenErrorAnalysis}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Banco Errores</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab View Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveView('create')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              activeView === 'create'
                ? 'bg-white text-blue-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Configurar Simulacro</span>
          </button>

          <button
            onClick={() => setActiveView('cornell_deck')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              activeView === 'cornell_deck'
                ? 'bg-white text-emerald-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mazo IA Conceptos Cornell</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono-numbers font-bold">
              {cornellKeyConceptsData.allConcepts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              activeView === 'analytics'
                ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Evolución y Precisión</span>
          </button>

          <button
            onClick={() => setActiveView('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all shrink-0 cursor-pointer ${
              activeView === 'history'
                ? 'bg-white text-slate-900 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Historial ({currentSubject?.quizzes?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* VIEW: CORNELL KEY CONCEPTS -> AUTOMATIC AI FLASHCARD DECK GENERATOR */}
      {activeView === 'cornell_deck' && currentSubject && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Generator Card */}
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-2xs overflow-hidden">
            <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white border-b border-emerald-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-sm shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Notas Cornell → Active Recall Aplicado</span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Generador Automático de Mazo de Flashcards desde Conceptos Clave Cornell
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                    Toma los <strong>conceptos clave</strong> extraídos de tus notas Cornell de{' '}
                    <strong>{currentSubject.name}</strong> y genera automáticamente con Gemini un mazo de flashcards enriquecido con{' '}
                    <span className="text-emerald-800 font-semibold">📘 Definición rigurosa</span>,{' '}
                    <span className="text-amber-700 font-semibold">💡 Ejemplo práctico</span> y{' '}
                    <span className="text-sky-700 font-semibold">🌍 Situación de uso real</span>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isGeneratingCornellDeck}
                  onClick={() => handleGenerateCornellConceptDeck()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                >
                  {isGeneratingCornellDeck ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando Mazo con IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        Generar Mazo IA ({selectedCornellConcepts.length > 0 ? selectedCornellConcepts.length : cornellDeckTargetCount} conceptos)
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsCornellExtractorOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Extractor Paso a Paso</span>
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {cornellDeckError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cornellDeckError}</span>
                </div>
              )}

              {/* Selector de Materia, Nota Cornell de origen y tamaño del mazo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    1. Asignatura
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value);
                      setSelectedCornellSourceFilter('all');
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.cornellNotes?.length || 0} notas Cornell)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    2. Fuente de Notas Cornell
                  </label>
                  <select
                    value={selectedCornellSourceFilter}
                    onChange={(e) => setSelectedCornellSourceFilter(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">
                      Todas las notas Cornell de {currentSubject.name} ({cornellKeyConceptsData.sources.length})
                    </option>
                    {cornellKeyConceptsData.sources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.title} ({src.cues.length + src.keyPoints.length} conceptos)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    3. Nº de Flashcards del Mazo
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[4, 6, 8, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCornellDeckTargetCount(num)}
                        className={`py-2 rounded-xl border text-xs font-mono-numbers font-bold transition-all cursor-pointer ${
                          cornellDeckTargetCount === num
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Panel de Conceptos Clave Extraídos de las Notas Cornell */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        Conceptos Clave Extraídos de tus Notas Cornell ({selectedCornellConcepts.length} seleccionados)
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Haz clic en los conceptos clave detectados en la columna de Cues y puntos clave Cornell para incluirlos en el mazo:
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCornellConcepts(
                          filteredCornellConcepts.map((c) => c.concept)
                        )
                      }
                      className="font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCornellConcepts([])}
                      className="font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {filteredCornellConcepts.length === 0 ? (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 text-center">
                    No se encontraron conceptos clave previos. Añade un concepto abajo o pulsa &ldquo;Generar Mazo IA&rdquo; para que Gemini los extraiga automáticamente del temario.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-1">
                    {filteredCornellConcepts.map((item, idx) => {
                      const isSelected = selectedCornellConcepts.includes(item.concept);
                      return (
                        <button
                          key={`${item.sourceId}-${idx}`}
                          type="button"
                          onClick={() => handleToggleCornellConcept(item.concept)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                          }`}
                          title={`Fuente: ${item.sourceTitle}`}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span>{item.concept}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Añadir concepto clave adicional manualmente */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customCornellConceptInput}
                    onChange={(e) => setCustomCornellConceptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCornellConcept();
                      }
                    }}
                    placeholder="Añadir otro concepto clave específico para generar su definición, ejemplo práctico y caso real..."
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCornellConcept}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    + Añadir Concepto
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mazo de Flashcards Generado (o Flashcards Cornell ya guardadas en la materia) */}
          {(() => {
            const existingCornellCards = (currentSubject.flashcards || []).filter(
              (fc) =>
                Boolean(fc.practicalExample) ||
                Boolean(fc.realWorldScenario) ||
                Boolean(fc.sourceCornellNoteId) ||
                fc.id.startsWith('fc-cornell')
            );
            const activeDeck =
              generatedCornellDeck.length > 0
                ? generatedCornellDeck
                : existingCornellCards;
            const safeIdx =
              activeDeck.length > 0
                ? Math.min(cornellDeckActiveIdx, activeDeck.length - 1)
                : 0;
            const activeCard = activeDeck[safeIdx];

            if (activeDeck.length === 0) {
              return null;
            }

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>
                        Mazo de Flashcards de Conceptos Clave Cornell ({activeDeck.length} tarjetas)
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Cada tarjeta incluye definición académica, ejemplo práctico y situación de uso real.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setCornellDeckDisplayMode('flip')}
                        className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          cornellDeckDisplayMode === 'flip'
                            ? 'bg-white text-emerald-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Entrenador Flip 3D
                      </button>
                      <button
                        type="button"
                        onClick={() => setCornellDeckDisplayMode('grid')}
                        className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          cornellDeckDisplayMode === 'grid'
                            ? 'bg-white text-emerald-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Vista Completa ({activeDeck.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveView('quickfire')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Practicar en Quickfire</span>
                    </button>
                  </div>
                </div>

                {cornellDeckDisplayMode === 'flip' && activeCard ? (
                  <div className="max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-slate-800 font-mono-numbers">
                        Tarjeta {safeIdx + 1} de {activeDeck.length}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                        {activeCard.conceptTag}
                      </span>
                    </div>

                    <div
                      onClick={() => setIsCornellCardFlipped((prev) => !prev)}
                      className={`min-h-[300px] p-6 sm:p-8 rounded-3xl border transition-all duration-300 cursor-pointer shadow-sm flex flex-col justify-between ${
                        isCornellCardFlipped
                          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border-slate-700'
                          : 'bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/40 text-slate-900 border-emerald-200 hover:border-emerald-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-4 opacity-75">
                          <span>
                            {isCornellCardFlipped
                              ? 'Reverso · Definición, Ejemplo Práctico y Uso Real'
                              : 'Anverso · Concepto Clave Cornell'}
                          </span>
                          <span className="flex items-center gap-1">
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>
                              {isCornellCardFlipped ? 'Volver al concepto' : 'Haz clic para voltear'}
                            </span>
                          </span>
                        </div>

                        {!isCornellCardFlipped ? (
                          <div className="py-10 text-center space-y-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 block">
                              Concepto Clave Extraído de Notas Cornell
                            </span>
                            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                              {activeCard.concept || activeCard.question}
                            </h3>
                            {activeCard.hint && (
                              <p className="text-xs text-slate-500 italic mt-3 inline-flex items-center gap-1.5 bg-white/80 border border-emerald-100 px-3.5 py-1.5 rounded-full">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>Pista: {activeCard.hint}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4 text-left animate-fadeIn">
                            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                                📘 1. Definición Académica
                              </span>
                              <p className="text-sm text-slate-100 leading-relaxed">
                                {activeCard.definition || activeCard.answer}
                              </p>
                            </div>

                            {activeCard.practicalExample && (
                              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/20">
                                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-1">
                                  💡 2. Ejemplo Práctico
                                </span>
                                <p className="text-xs text-slate-100 leading-relaxed">
                                  {activeCard.practicalExample}
                                </p>
                              </div>
                            )}

                            {activeCard.realWorldScenario && (
                              <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-400/20">
                                <span className="text-[11px] font-bold text-sky-300 uppercase tracking-wider block mb-1">
                                  🌍 3. Situación de Uso Real
                                </span>
                                <p className="text-xs text-slate-100 leading-relaxed">
                                  {activeCard.realWorldScenario}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 mt-4 border-t border-current/10 text-center text-[11px] opacity-65">
                        {isCornellCardFlipped
                          ? 'Haz clic en la tarjeta para regresar al concepto clave'
                          : 'Intenta recordar la definición, un ejemplo práctico y su uso real antes de voltear'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        disabled={safeIdx === 0}
                        onClick={() => {
                          setCornellDeckActiveIdx(Math.max(0, safeIdx - 1));
                          setIsCornellCardFlipped(false);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        ← Anterior
                      </button>

                      <div className="flex items-center gap-1.5">
                        {activeDeck.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCornellDeckActiveIdx(idx);
                              setIsCornellCardFlipped(false);
                            }}
                            className={`h-2 rounded-full transition-all cursor-pointer ${
                              safeIdx === idx
                                ? 'w-6 bg-emerald-600'
                                : 'w-2 bg-slate-200 hover:bg-slate-300'
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={safeIdx >= activeDeck.length - 1}
                        onClick={() => {
                          setCornellDeckActiveIdx(Math.min(activeDeck.length - 1, safeIdx + 1));
                          setIsCornellCardFlipped(false);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Vista en Cuadrícula de todas las Flashcards generadas */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeDeck.map((card, idx) => (
                      <div
                        key={card.id || idx}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              Concepto #{idx + 1} · {card.conceptTag}
                            </span>
                            <h5 className="text-sm font-extrabold text-slate-900 mt-1.5">
                              {card.concept || card.question}
                            </h5>
                          </div>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                            <span className="font-bold text-emerald-800 block text-[11px] mb-0.5">
                              📘 Definición:
                            </span>
                            <p className="text-slate-700 leading-relaxed">
                              {card.definition || card.answer}
                            </p>
                          </div>

                          {card.practicalExample && (
                            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
                              <span className="font-bold text-amber-900 block text-[11px] mb-0.5">
                                💡 Ejemplo Práctico:
                              </span>
                              <p className="text-slate-700 leading-relaxed">
                                {card.practicalExample}
                              </p>
                            </div>
                          )}

                          {card.realWorldScenario && (
                            <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-200/80">
                              <span className="font-bold text-sky-900 block text-[11px] mb-0.5">
                                🌍 Situación de Uso Real:
                              </span>
                              <p className="text-slate-700 leading-relaxed">
                                {card.realWorldScenario}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* VIEW: ANALYTICS & ACCURACY CHART */}
      {activeView === 'analytics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Panel de Precisión y Curva de Retención Spaced Repetition
                </h3>
                <p className="text-xs text-slate-500">
                  Compara la exactitud de tus simulacros y la evolución de consolidación de memoria en cada asignatura.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveView('create')}
              className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
            >
              Nuevo Simulacro
            </button>
          </div>

          <SpacedRepetitionQuizAccuracyChart
            subjects={subjects}
            onSelectSubject={(subId) => {
              setSelectedSubjectId(subId);
              setActiveView('create');
            }}
          />
        </div>
      )}

      {/* VIEW: CONFIGURATION & GENERATION */}
      {activeView === 'create' && (
        <div id="quiz-generator-section" className="space-y-6">
          {activeRecallToast && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex items-center justify-between gap-3 shadow-2xs animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold block text-indigo-900">Active Recall Activado</span>
                  <p className="text-[11px] text-indigo-700/90">{activeRecallToast}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRecallToast(null)}
                className="text-indigo-400 hover:text-indigo-700 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* BARRA DE CREACIÓN EXPRÉS 1-CLIC (AGILIZACIÓN DE CUESTIONARIOS IA) */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold tracking-wide uppercase">
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Generación IA Instantánea en 1 Clic</span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold">
                ¿Quieres practicar ya en {currentSubject?.name || 'esta asignatura'} sin configurar pasos?
              </h3>
              <p className="text-xs text-blue-100">
                Lanza un cuestionario IA al instante con los temas seleccionados ({selectedTopicIds.length === 0 ? 'temario completo' : `${selectedTopicIds.length} temas`}) o pulsa "⚡ Test 1-Clic" en cualquier tema.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => handleQuickExpressQuiz({ count: 5, type: 'test' })}
                className="px-3.5 py-2.5 rounded-xl bg-white text-indigo-900 hover:bg-blue-50 font-extrabold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                )}
                <span>Test Exprés (5 preg.)</span>
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => handleQuickExpressQuiz({ count: 10, type: 'test' })}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-900/40 hover:bg-indigo-900/60 border border-white/25 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span>Simulacro 10 preg.</span>
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => handleQuickExpressQuiz({ count: 5, type: 'preguntas_cortas' })}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-900/40 hover:bg-indigo-900/60 border border-white/25 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-300" />
                <span>5 Preg. Cortas</span>
              </button>
            </div>
          </div>

          {/* VISUAL SUBJECT SELECTOR GRID */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Paso 1: Selecciona la Asignatura
                </h3>
                <p className="text-[11px] text-slate-500">
                  Haz clic en la materia a examinar. Se mostrarán sus temas, apuntes y alertas pendientes.
                </p>
              </div>
              <span className="text-[11px] font-mono-numbers text-slate-400 font-semibold">
                {subjects.length} materias disponibles
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {subjects.map((sub) => {
                const isSelected = sub.id === selectedSubjectId;
                const subDeck = getSubjectQuickfireDeck(sub);
                const subAlert = getSubjectSpacedRepetitionAlert(sub, true);
                const subQuizzesCount = sub.quizzes?.length || 0;

                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubjectId(sub.id);
                      setSelectedTopicIds([]);
                      setSelectedNoteId('');
                      setSelectedNoteIds([]);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: sub.color || '#3b82f6' }}
                        />
                        <span className="text-[10px] font-mono-numbers font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {sub.code}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 line-clamp-1">
                        {sub.name}
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-1 pt-2 border-t border-slate-200/60 text-[10px]">
                      <span className="text-slate-500 font-mono-numbers">
                        {subQuizzesCount} {subQuizzesCount === 1 ? 'test' : 'tests'}
                      </span>
                      {subAlert.hasPendingToday ? (
                        <span className="flex items-center gap-0.5 text-indigo-700 font-bold bg-indigo-100/80 px-1.5 py-0.5 rounded">
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>{subAlert.totalPendingToday} SR</span>
                        </span>
                      ) : subDeck.pendingTodayCards.length > 0 ? (
                        <span className="flex items-center gap-0.5 text-amber-700 font-bold bg-amber-100/80 px-1.5 py-0.5 rounded">
                          <Zap className="w-2.5 h-2.5" />
                          <span>{subDeck.pendingTodayCards.length}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono-numbers">
                          {sub.topics?.length || 0} temas
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TWO-COLUMN CONFIGURATION PANEL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Source Selection (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Paso 2: Fuente de Contenido ({currentSubject.name})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Elige si Gemini formulará las preguntas desde temas oficiales o apuntes redactados.
                  </p>
                </div>
              </div>

              {/* Source Mode Switcher */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSourceMode('topics')}
                  className={`p-3.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    sourceMode === 'topics'
                      ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold shadow-2xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold">Temas Oficiales</span>
                    </div>
                    {sourceMode === 'topics' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-2">
                    Selecciona temas específicos o el temario completo de {currentSubject.code}.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSourceMode('cornell_notes');
                    if (availableNotes.length > 0 && selectedNoteIds.length === 0) {
                      setSelectedNoteIds([availableNotes[0].id]);
                      if (availableNotes[0].cornellId) {
                        setSelectedNoteId(availableNotes[0].cornellId);
                      }
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    sourceMode === 'cornell_notes'
                      ? 'border-purple-600 bg-purple-50/70 text-purple-950 font-bold shadow-2xs ring-1 ring-purple-500/20'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold">Apuntes y Documentos</span>
                    </div>
                    {sourceMode === 'cornell_notes' && (
                      <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-normal mt-2">
                    Extrae preguntas de notas Cornell, resúmenes o archivos importados ({availableNotes.length}).
                  </div>
                </button>
              </div>

              {/* Mode 1: Topics list */}
              {sourceMode === 'topics' && (
                <div className="space-y-3">
                  {currentSubjectSpacedAlert.hasPendingToday && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 via-violet-50 to-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-indigo-950">
                        <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0">
                          <RotateCcw className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold">
                            {currentSubjectSpacedAlert.totalPendingToday}{' '}
                            {currentSubjectSpacedAlert.totalPendingToday === 1
                              ? 'tema tiene repaso de Curva del Olvido pendiente hoy'
                              : 'temas tienen repaso de Curva del Olvido pendientes hoy'}
                          </span>
                          <p className="text-[11px] text-indigo-700/90 mt-0.5">
                            Realizar un simulacro ahora consolida los conceptos en memoria a largo plazo.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedTopicIds(currentSubjectSpacedAlert.pendingTopicIds)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer shadow-2xs"
                      >
                        Seleccionar {currentSubjectSpacedAlert.totalPendingToday} pendientes
                      </button>
                    </div>
                  )}

                  {/* Search and Selection Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={topicSearchQuery}
                        onChange={(e) => setTopicSearchQuery(e.target.value)}
                        placeholder="Buscar tema por palabra clave..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className="text-xs font-semibold text-slate-500">
                        {selectedTopicIds.length === 0
                          ? 'Todos los temas'
                          : `${selectedTopicIds.length} seleccionados`}
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAllTopics}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                      >
                        {selectedTopicIds.length === (currentSubject?.topics?.length || 0)
                          ? 'Deseleccionar todos'
                          : 'Seleccionar todos'}
                      </button>
                    </div>
                  </div>

                  {/* Topics Cards List */}
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {filteredTopics.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                        No se encontraron temas con el criterio de búsqueda.
                      </div>
                    ) : (
                      filteredTopics.map((topic, idx) => {
                        const isSelected = selectedTopicIds.includes(topic.id);
                        const isPendingSpacedToday = currentSubjectSpacedAlert.pendingTopicIds.includes(
                          topic.id
                        );
                        return (
                          <div
                            key={topic.id}
                            onClick={() => handleToggleTopic(topic.id)}
                            className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50/50 text-blue-950 font-medium ring-1 ring-blue-500/20'
                                : isPendingSpacedToday
                                ? 'border-indigo-300 bg-indigo-50/30 hover:bg-indigo-50/60 text-slate-800'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono-numbers font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  T{idx + 1}
                                </span>
                                <span className="font-bold text-slate-900">{topic.title}</span>
                                {isPendingSpacedToday && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                                    <RotateCcw className="w-2.5 h-2.5 text-indigo-600" />
                                    <span>Repaso hoy · R{topic.reviewLevel || 1}</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-1">
                                {topic.description || topic.subtopics.join(', ')}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                              {(topic.customQuestions?.length || 0) > 0 && (
                                <span className="text-[10px] font-mono-numbers font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded shrink-0">
                                  {topic.customQuestions?.length} propias
                                </span>
                              )}
                              {topic.pageCount && (
                                <span className="text-[10px] font-mono-numbers text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                                  {topic.pageCount} págs
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomQuestionsModalTopicId(topic.id);
                                  setIsCustomQuestionsModalOpen(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                title={`Crear o revisar tus propias preguntas Test, Verdadero/Falso y Flashcards en "${topic.title}"`}
                              >
                                <Plus className="w-3 h-3 text-indigo-600" />
                                <span>Crear Propias</span>
                              </button>
                              <button
                                type="button"
                                disabled={isGenerating}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickExpressQuiz({ topicId: topic.id, count: 5, type: 'test' });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs disabled:opacity-50"
                                title={`Crear test rápido de 5 preguntas sobre "${topic.title}" en 1 clic`}
                              >
                                <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                                <span>Test IA</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Mode 2: Multi-Select Notes list */}
              {sourceMode === 'cornell_notes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      Apuntes disponibles ({selectedNoteIds.length} seleccionados):
                    </span>
                    <div className="flex items-center gap-3">
                      {availableNotes.length > 1 && (
                        <button
                          type="button"
                          onClick={handleSelectAllNotes}
                          className="text-xs text-purple-600 hover:text-purple-800 hover:underline font-bold cursor-pointer"
                        >
                          {selectedNoteIds.length === availableNotes.length
                            ? 'Deseleccionar todos'
                            : 'Seleccionar todos'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isGeneratingCornellDeck}
                        onClick={() => handleGenerateCornellConceptDeck()}
                        className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                        title="Generar automáticamente un mazo de flashcards con definiciones, ejemplos prácticos y situaciones de uso real a partir de los conceptos clave Cornell"
                      >
                        {isGeneratingCornellDeck ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>Generar Mazo Flashcards IA (Conceptos Clave)</span>
                      </button>
                    </div>
                  </div>

                  {availableNotes.length === 0 ? (
                    <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700">Esta materia aún no tiene apuntes guardados</p>
                      <p className="text-[11px] text-slate-400">
                        Crea notas Cornell o importa PDFs en la pestaña "Materias y Temarios" para generar cuestionarios específicos sobre ellos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {availableNotes.map((noteItem) => {
                        const isSelected = selectedNoteIds.includes(noteItem.id);
                        return (
                          <div
                            key={noteItem.id}
                            onClick={() => handleToggleNoteSelection(noteItem.id, noteItem.cornellId)}
                            className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                              isSelected
                                ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-500/30'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-900 truncate">{noteItem.title}</span>
                                <span className="text-[10px] text-slate-400 font-mono-numbers shrink-0">
                                  {noteItem.createdAt}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                {noteItem.subtitle}
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-[10px] text-purple-700 font-semibold">
                                <span className="bg-purple-100/90 text-purple-800 px-2 py-0.5 rounded">
                                  {noteItem.badge}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Exam Options & Trigger (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Paso 3: Formato y Rigor del Examen</h3>
                  <p className="text-xs text-slate-500">
                    Configura la modalidad idéntica a tus exámenes oficiales universitarios.
                  </p>
                </div>

                {/* Selector de Fuente de Preguntas: IA vs Mis Preguntas Creadas vs Mixto */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800">
                      Origen de las Preguntas a Revisar
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomQuestionsModalTopicId(
                          selectedTopicIds[0] || currentSubject?.topics?.[0]?.id
                        );
                        setIsCustomQuestionsModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Crear preguntas propias</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      {
                        id: 'ai' as const,
                        label: 'Generar con IA',
                        desc: 'Automático Gemini',
                      },
                      {
                        id: 'custom' as const,
                        label: 'Mis Preguntas',
                        desc: `${(currentSubject?.topics || []).reduce(
                          (acc, t) =>
                            selectedTopicIds.length === 0 || selectedTopicIds.includes(t.id)
                              ? acc + (t.customQuestions?.length || 0)
                              : acc,
                          0
                        )} creadas`,
                      },
                      {
                        id: 'both' as const,
                        label: 'Mixto (Mías + IA)',
                        desc: 'Combinar ambas',
                      },
                    ].map((src) => {
                      const active = questionSourcePool === src.id;
                      return (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => setQuestionSourcePool(src.id)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 font-bold shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-[11px] font-bold leading-tight">{src.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            {src.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Exam Type Selector Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Tipo de Examen
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        type: 'test' as ExamType,
                        label: 'Tipo Test',
                        desc: '4 opciones + justificación',
                        icon: CheckSquare,
                        colorClass: 'text-blue-600',
                      },
                      {
                        type: 'verdadero_falso' as ExamType,
                        label: 'Verdadero / Falso',
                        desc: 'Afirmación V/F + justificación',
                        icon: CheckCircle2,
                        colorClass: 'text-indigo-600',
                      },
                      {
                        type: 'desarrollo' as ExamType,
                        label: 'Desarrollo',
                        desc: 'Respuesta abierta + rúbrica IA',
                        icon: PenTool,
                        colorClass: 'text-purple-600',
                      },
                      {
                        type: 'oral' as ExamType,
                        label: 'Examen Oral',
                        desc: 'Defensa oral y conceptos',
                        icon: Mic,
                        colorClass: 'text-rose-600',
                      },
                      {
                        type: 'preguntas_cortas' as ExamType,
                        label: 'Preguntas Cortas',
                        desc: 'Definición directa y precisa',
                        icon: Target,
                        colorClass: 'text-amber-600',
                      },
                      {
                        type: 'calculo' as ExamType,
                        label: 'Cálculo y Fórmulas',
                        desc: 'Resolución numérica paso a paso',
                        icon: Calculator,
                        colorClass: 'text-emerald-600',
                      },
                      {
                        type: 'practico' as ExamType,
                        label: 'Supuesto Práctico',
                        desc: 'Resolución de casos reales',
                        icon: Briefcase,
                        colorClass: 'text-cyan-600',
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = examType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setExamType(item.type)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold shadow-2xs ring-1 ring-blue-500/20'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-700' : item.colorClass}`} />
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                          <div className="text-xs font-bold leading-tight">{item.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5 leading-snug">
                            {item.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Difficulty Tier */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nivel de Dificultad Académica
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'basico' as const, label: 'Básico', bar: 'bg-emerald-500', desc: 'Conceptos clave' },
                      { id: 'intermedio' as const, label: 'Intermedio', bar: 'bg-amber-500', desc: 'Estándar grado' },
                      { id: 'avanzado' as const, label: 'Avanzado', bar: 'bg-rose-500', desc: 'Alta exigencia' },
                    ].map((lvl) => {
                      const isSelected = difficulty === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setDifficulty(lvl.id)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/80 font-bold shadow-2xs'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${lvl.bar}`} />
                            <span className="text-xs capitalize">{lvl.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">{lvl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Count Pills */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Número de Preguntas
                  </label>
                  <div className="flex gap-2">
                    {[3, 5, 8, 10, 15].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`flex-1 py-2 rounded-xl border text-xs font-mono-numbers font-bold transition-all cursor-pointer ${
                          questionCount === cnt
                            ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Prompt Suggestions & Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Enfoque Específico (Opcional)
                    </label>
                    <span className="text-[10px] text-slate-400">Personaliza el test</span>
                  </div>
                  <input
                    type="text"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Ej: Casos clínicos, preguntas trampa de examen oficial..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {/* Quick suggestion chips */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[
                      'Casos prácticos',
                      'Fórmulas y cálculo',
                      'Errores frecuentes',
                      'Nivel oposición',
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setCustomInstructions(chip)}
                        className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors cursor-pointer"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Launch button */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                {quizError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">{quizError}</div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleGenerateQuiz}
                  disabled={isGenerating}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer group"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Construyendo cuestionario universitario con Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                      <span>Generar y Empezar Examen ({examType.toUpperCase()})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: RUNNER / TEST TAKING */}
      {activeView === 'runner' && activeQuiz && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
          {!quizFinished ? (
            <>
              {/* Question progress header & Edit/Delete question controls */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-900 font-mono-numbers">
                    Pregunta {currentQIndex + 1} de {activeQuiz.questions.length}
                  </span>
                  <span>·</span>
                  <span className="uppercase text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {activeQuiz.examType}
                  </span>
                  <span>·</span>
                  <span className="capitalize text-[11px] text-slate-600 font-medium">
                    Nivel {activeQuiz.difficulty}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleStartEditQuestion}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Modificar el enunciado de la pregunta o las opciones de respuesta"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Editar pregunta / respuestas</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveCurrentQuestionAsFlashcard}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Guardar o actualizar esta pregunta y su respuesta como Flashcard de la materia"
                  >
                    <Layers className="w-3 h-3" />
                    <span>Guardar Flashcard</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteCurrentQuestion}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Eliminar esta pregunta del test (y su flashcard asociada si no encaja)"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Eliminar</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsEditingQuestion(false);
                      setActiveView('create');
                    }}
                    className="text-xs text-slate-400 hover:text-slate-700 font-semibold cursor-pointer ml-1"
                  >
                    Salir
                  </button>
                </div>
              </div>

              {runnerActionNotice && (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                  <span className="font-semibold">{runnerActionNotice}</span>
                  <button
                    type="button"
                    onClick={() => setRunnerActionNotice(null)}
                    className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${((currentQIndex + 1) / activeQuiz.questions.length) * 100}%`,
                  }}
                />
              </div>

              {isEditingQuestion ? (
                /* Inline Editor for Current Question & Answer Options */
                <form
                  onSubmit={handleSaveEditQuestion}
                  className="p-5 bg-blue-50/40 border-2 border-blue-400 rounded-2xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-blue-200/70 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Modificar Pregunta y Respuestas</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingQuestion(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Enunciado de la pregunta:
                    </label>
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      rows={2}
                      required
                      className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-900"
                      placeholder="Escribe el enunciado de la pregunta..."
                    />
                  </div>

                  {(activeQuiz.examType === 'test' || activeQuiz.examType === 'verdadero_falso') && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-800">
                          Opciones de respuesta (haz clic en la letra para marcar cuál es la correcta):
                        </label>
                      </div>
                      <div className="space-y-2">
                        {editOptions.map((optVal, optIdx) => {
                          const isMarkedCorrect = editCorrectOptionIndex === optIdx;
                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                                isMarkedCorrect
                                  ? 'bg-emerald-50/80 border-emerald-400'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setEditCorrectOptionIndex(optIdx)}
                                className={`px-2.5 py-1.5 rounded-lg font-mono-numbers text-xs font-bold shrink-0 cursor-pointer transition-colors flex items-center gap-1 ${
                                  isMarkedCorrect
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                                title="Haz clic para marcar esta opción como la respuesta correcta"
                              >
                                <span>{String.fromCharCode(65 + optIdx)}</span>
                                {isMarkedCorrect && <Check className="w-3 h-3" />}
                              </button>
                              <input
                                type="text"
                                value={optVal}
                                onChange={(e) => {
                                  const next = [...editOptions];
                                  next[optIdx] = e.target.value;
                                  setEditOptions(next);
                                }}
                                className="flex-1 text-xs px-3 py-1.5 bg-transparent border-0 focus:outline-none text-slate-900"
                                placeholder={`Texto de la opción ${String.fromCharCode(65 + optIdx)}...`}
                              />
                              {isMarkedCorrect && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                                  Correcta
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Explicación / Respuesta oficial:
                    </label>
                    <textarea
                      value={editExplanation}
                      onChange={(e) => setEditExplanation(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-900"
                      placeholder="Explicación o respuesta modelo..."
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-blue-200/60">
                    <button
                      type="button"
                      onClick={handleDeleteCurrentQuestion}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar esta pregunta</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingQuestion(false)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar cambios</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* Question Prompt */
                <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-2xl">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                    {activeQuiz.questions[currentQIndex].prompt}
                  </h3>
                </div>
              )}

              {/* FORMAT 1: TEST (Multiple Choice) OR VERDADERO / FALSO */}
              {(activeQuiz.examType === 'test' || activeQuiz.examType === 'verdadero_falso') && (
                <div className="space-y-3">
                  {activeQuiz.questions[currentQIndex].options?.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = idx === activeQuiz.questions[currentQIndex].correctOptionIndex;

                    let btnStyle = 'border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50 text-slate-800';
                    if (isAnswerRevealed) {
                      if (isCorrect) {
                        btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold ring-1 ring-emerald-500';
                      } else if (isSelected && !isCorrect) {
                        btnStyle = 'border-rose-500 bg-rose-50 text-rose-950 line-through ring-1 ring-rose-500';
                      } else {
                        btnStyle = 'border-slate-100 bg-slate-50 text-slate-400 opacity-60';
                      }
                    } else if (isSelected) {
                      btnStyle = 'border-blue-600 bg-blue-50 text-blue-950 font-semibold ring-2 ring-blue-500/20';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => !isAnswerRevealed && setSelectedOption(idx)}
                        className={`w-full p-4 rounded-xl border text-left text-xs transition-all flex items-center justify-between gap-3 cursor-pointer ${btnStyle}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 font-mono-numbers ${
                            isSelected && !isAnswerRevealed
                              ? 'bg-blue-600 text-white'
                              : isAnswerRevealed && isCorrect
                              ? 'bg-emerald-600 text-white'
                              : isAnswerRevealed && isSelected && !isCorrect
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="leading-relaxed">{opt}</span>
                        </div>
                        {isAnswerRevealed && isCorrect && (
                          <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                        {isAnswerRevealed && isSelected && !isCorrect && (
                          <div className="p-1 rounded-full bg-rose-100 text-rose-700 shrink-0">
                            <X className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* FORMAT 2, 3, 4, 5, 6: DESARROLLO, ORAL, PREGUNTAS CORTAS, CALCULO, PRACTICO */}
              {activeQuiz.examType !== 'test' && activeQuiz.examType !== 'verdadero_falso' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {activeQuiz.examType === 'oral'
                        ? 'Simula tu exposición oral (o transcribe tus puntos clave):'
                        : activeQuiz.examType === 'preguntas_cortas'
                        ? 'Escribe tu respuesta breve y directa:'
                        : activeQuiz.examType === 'calculo'
                        ? 'Escribe el planteamiento, fórmulas aplicadas y resultado numérico:'
                        : activeQuiz.examType === 'practico'
                        ? 'Escribe la resolución del supuesto práctico, análisis y propuesta de solución:'
                        : 'Escribe tu respuesta desarrollada para corrección universitaria:'}
                    </label>
                    <textarea
                      value={writtenAnswer}
                      onChange={(e) => setWrittenAnswer(e.target.value)}
                      placeholder={
                        activeQuiz.examType === 'oral'
                          ? 'Estructura tu exposición: saludo, definición formal, mecanismos clave y conclusiones...'
                          : activeQuiz.examType === 'preguntas_cortas'
                          ? 'Responde de forma concisa y precisa con los términos técnicos exactos...'
                          : activeQuiz.examType === 'calculo'
                          ? 'Indica los datos, la fórmula utilizada, desarrollo de los pasos y el resultado final con unidades...'
                          : activeQuiz.examType === 'practico'
                          ? 'Plantea el análisis del supuesto, pasos de resolución, justificación metodológica y conclusión práctica...'
                          : 'Desarrolla los fundamentos, etapas del proceso, ejemplos prácticos y relevancia técnica o clínica...'
                      }
                      rows={6}
                      disabled={isAnswerRevealed}
                      className="w-full text-xs p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans leading-relaxed text-slate-900"
                    />
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                      <span>{writtenAnswer.trim().split(/\s+/).filter(Boolean).length} palabras</span>
                      <span>{writtenAnswer.length} caracteres</span>
                    </div>
                  </div>

                  {!isAnswerRevealed && (
                    <button
                      onClick={handleEvaluateOpenAnswer}
                      disabled={isEvaluatingOpenAnswer || !writtenAnswer.trim()}
                      className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isEvaluatingOpenAnswer ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Evaluando con rúbrica universitaria en Gemini...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Evaluar mi Respuesta con Rúbrica IA</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* AI Open Answer Evaluation Results */}
              {isAnswerRevealed && openAnswerEvaluation && (
                <div className="p-5 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                      Evaluación Pedagógica de Gemini
                    </span>
                    <span className="px-3 py-1 bg-purple-600 text-white font-mono-numbers font-bold text-sm rounded-lg">
                      {openAnswerEvaluation.score} / 100
                    </span>
                  </div>

                  {/* Strengths */}
                  {openAnswerEvaluation.strengths.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Puntos Fuertes Identificados:
                      </span>
                      <ul className="mt-1 list-disc list-inside text-xs text-slate-700 space-y-0.5">
                        {openAnswerEvaluation.strengths.map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing Points */}
                  {openAnswerEvaluation.missingPoints.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Conceptos o Puntos Clave Omitidos:
                      </span>
                      <ul className="mt-1 list-disc list-inside text-xs text-slate-700 space-y-0.5">
                        {openAnswerEvaluation.missingPoints.map((mis, idx) => (
                          <li key={idx}>{mis}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Feedback */}
                  <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-purple-100 leading-relaxed">
                    <strong className="text-slate-900 block mb-0.5">Consejo del Profesor:</strong>
                    {openAnswerEvaluation.feedback}
                  </div>

                  {/* Model Answer */}
                  {openAnswerEvaluation.modelAnswer && (
                    <div className="text-xs text-slate-700 bg-purple-100/50 p-3 rounded-xl border border-purple-200 leading-relaxed">
                      <strong className="text-purple-900 block mb-0.5">Respuesta Modelo (10/10):</strong>
                      {openAnswerEvaluation.modelAnswer}
                    </div>
                  )}
                </div>
              )}

              {/* Revealed Explanation & Per-Option Feedback for Test & Verdadero/Falso */}
              {isAnswerRevealed && (activeQuiz.examType === 'test' || activeQuiz.examType === 'verdadero_falso') && (() => {
                const currentQ = activeQuiz.questions[currentQIndex];
                const isUserWrong =
                  selectedOption !== null && selectedOption !== currentQ.correctOptionIndex;
                const selectedWrongFeedback =
                  selectedOption !== null &&
                  currentQ.optionExplanations &&
                  currentQ.optionExplanations[selectedOption]
                    ? currentQ.optionExplanations[selectedOption]
                    : null;

                return (
                  <div className="space-y-3">
                    {/* Specific Explanatory Feedback if user selected an incorrect answer */}
                    {isUserWrong && selectedOption !== null && (
                      <div className="p-4 bg-rose-50/90 border border-rose-200 rounded-xl space-y-1.5 text-xs">
                        <div className="font-bold text-rose-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            Por qué la opción {String.fromCharCode(65 + selectedOption)} es incorrecta:
                          </span>
                        </div>
                        <p className="text-rose-950 leading-relaxed">
                          {selectedWrongFeedback ||
                            `La opción "${currentQ.options?.[selectedOption] || ''}" no es correcta. ${currentQ.explanation}`}
                        </p>
                      </div>
                    )}

                    {/* Global Explanation */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Justificación Académica de la Respuesta Correcta:</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed mt-1">
                          {currentQ.explanation}
                        </p>
                      </div>

                      {/* Per-option breakdown */}
                      {currentQ.optionExplanations && currentQ.optionExplanations.length > 0 && (
                        <div className="pt-3 border-t border-slate-200 space-y-2">
                          <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                            Análisis detallado de cada opción y distractores:
                          </div>
                          <div className="space-y-1.5">
                            {currentQ.options?.map((optText, optIdx) => {
                              const isCorrectOpt = optIdx === currentQ.correctOptionIndex;
                              const optExp = currentQ.optionExplanations?.[optIdx];
                              if (!optExp) return null;
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                                    isCorrectOpt
                                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                      : optIdx === selectedOption
                                      ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span className="font-bold mr-1.5">
                                    Opción {String.fromCharCode(65 + optIdx)} ({isCorrectOpt ? 'Correcta' : 'Incorrecta'}):
                                  </span>
                                  <span>{optExp}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Bottom navigation buttons */}
              <div className="flex justify-end pt-3">
                {!isAnswerRevealed && (activeQuiz.examType === 'test' || activeQuiz.examType === 'verdadero_falso') ? (
                  <button
                    onClick={handleConfirmAnswer}
                    disabled={selectedOption === null}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Comprobar Respuesta
                  </button>
                ) : isAnswerRevealed ? (
                  <button
                    onClick={handleNextQuestion}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>
                      {currentQIndex < activeQuiz.questions.length - 1 ? 'Siguiente Pregunta' : 'Finalizar Examen'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            /* Results Screen */
            <div className="space-y-6 text-center py-4">
              <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-3xl mx-auto flex items-center justify-center shadow-md">
                <Award className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  ¡Simulacro Finalizado con Éxito!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {activeQuiz.examTitle} · Modalidad {activeQuiz.examType.toUpperCase()}
                </p>
              </div>

              {/* Visual Score Gauge Card */}
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl max-w-sm mx-auto shadow-2xs">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Calificación Global
                </span>
                <div className="text-5xl font-black font-mono-numbers text-slate-900 mt-1">
                  {activeQuiz.overallScore}%
                </div>
                <div className={`mt-2.5 text-xs font-bold px-3 py-1 rounded-full inline-block ${
                  (activeQuiz.overallScore || 0) >= 80
                    ? 'bg-emerald-100 text-emerald-800'
                    : (activeQuiz.overallScore || 0) >= 60
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {(activeQuiz.overallScore || 0) >= 80
                    ? 'Sobresaliente · Dominio sólido'
                    : (activeQuiz.overallScore || 0) >= 60
                    ? 'Notable · Buen nivel general'
                    : 'Refuerzo recomendado · Método Cornell'}
                </div>
              </div>

              {/* Question list breakdown */}
              <div className="text-left space-y-2 max-w-lg mx-auto">
                <span className="text-xs font-bold text-slate-700">Desglose de preguntas del examen:</span>
                {activeQuiz.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex-1 truncate">
                      <span className="font-bold text-slate-900 mr-2 font-mono-numbers">P{idx + 1}.</span>
                      <span className="text-slate-700">{q.prompt}</span>
                    </div>
                    <span
                      className={`font-mono-numbers font-bold text-xs px-2 py-0.5 rounded ${
                        (q.score || 0) >= 70
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-600 border border-rose-200'
                      }`}
                    >
                      {q.score ?? 0}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setActiveView('create')}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  Nuevo Simulacro
                </button>
                <button
                  onClick={() => setActiveView('analytics')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Ver Gráficas
                </button>
                {onOpenErrorAnalysis && (
                  <button
                    onClick={onOpenErrorAnalysis}
                    className="px-5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Revisar Errores
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: QUIZ HISTORY */}
      {activeView === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Historial de Exámenes y Simulacros</h3>
              <p className="text-xs text-slate-500">
                Registro histórico de evaluaciones completadas en {currentSubject.name}.
              </p>
            </div>
            <button
              onClick={() => setActiveView('create')}
              className="px-3.5 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              Nuevo Test
            </button>
          </div>

          {(!currentSubject.quizzes || currentSubject.quizzes.length === 0) ? (
            <div className="text-center py-16 text-slate-400 text-xs space-y-2">
              <Award className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">Aún no has completado simulacros en esta materia</p>
              <p className="text-[11px] text-slate-400">
                Genera tu primer examen con IA para empezar a registrar tu precisión y evolución académica.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentSubject.quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="p-5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl space-y-3 transition-colors shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                          {quiz.examType}
                        </span>
                        <span className="text-[10px] capitalize text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded">
                          {quiz.difficulty}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1.5">{quiz.examTitle}</h4>
                    </div>
                    {quiz.overallScore !== undefined && (
                      <span className={`text-base font-mono-numbers font-black px-3 py-1 rounded-xl border ${
                        quiz.overallScore >= 80
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : quiz.overallScore >= 60
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {quiz.overallScore}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/80">
                    <span className="font-mono-numbers">{quiz.questions.length} preguntas</span>
                    <span className="font-mono-numbers text-[11px]">{quiz.takenAt || 'Reciente'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: EVITA EL OLVIDO CON ACTIVE RECALL */}
      {showActiveRecallModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowActiveRecallModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                  <RotateCcw className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Evita el Olvido con Active Recall</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Frena la Curva del Olvido de Ebbinghaus mediante recuperación activa de memoria
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowActiveRecallModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Summary Banner */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Repasos de Curva del Olvido
                </span>
                <span className="text-xs font-mono-numbers font-bold text-indigo-900 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                  {globalStats.totalSpacedTopicsPending} {globalStats.totalSpacedTopicsPending === 1 ? 'tema pendiente' : 'temas pendientes'} hoy
                </span>
              </div>
              <p className="text-xs text-indigo-900/90 leading-relaxed">
                {globalStats.totalSpacedTopicsPending > 0
                  ? 'La ciencia del aprendizaje demuestra que autoevaluarte justo cuando el concepto empieza a desvanecerse multiplica por 3 su retención en la memoria a largo plazo.'
                  : '¡Excelente trabajo! No tienes ningún tema con repaso atrasado en la Curva del Olvido hoy. Puedes seleccionar cualquier materia a continuación para practicar Active Recall preventivo.'}
              </p>
            </div>

            {/* Subjects with Pending Spaced Repetition or All Subjects */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {globalStats.totalSpacedTopicsPending > 0 ? 'Materias con Repasos Pendientes' : 'Selecciona una Materia para Practicar'}
                </h4>
                <span className="text-[11px] text-slate-400 font-mono-numbers">
                  {subjects.length} materias
                </span>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {subjects.map((sub) => {
                  const alert = getSubjectSpacedRepetitionAlert(sub, true);
                  const hasPending = alert.hasPendingToday;
                  const deck = getSubjectQuickfireDeck(sub);

                  return (
                    <div
                      key={sub.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        hasPending
                          ? 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-300'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub.color || '#3b82f6' }}
                          />
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {sub.name}
                          </span>
                          <span className="text-[10px] font-mono-numbers text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            {sub.code}
                          </span>
                        </div>

                        {hasPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full shrink-0">
                            <RotateCcw className="w-3 h-3 text-indigo-600" />
                            <span>{alert.totalPendingToday} {alert.totalPendingToday === 1 ? 'tema' : 'temas'}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">
                            ✓ Al día
                          </span>
                        )}
                      </div>

                      {/* Pending topics list */}
                      {hasPending && alert.pendingTopics && alert.pendingTopics.length > 0 && (
                        <div className="mt-2 text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-indigo-100 space-y-1">
                          <span className="font-bold text-indigo-900 block text-[10px] uppercase tracking-wider">
                            Temas a repasar hoy:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {alert.pendingTopics.map((pt) => (
                              <span
                                key={pt.id}
                                className="px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-md font-medium text-[10px] truncate max-w-[240px]"
                              >
                                {pt.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                        {deck.allCards.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubjectId(sub.id);
                              setActiveView('quickfire');
                              setShowActiveRecallModal(false);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Repasar con tarjetas de memoria rápida"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                            <span>Flashcards ({deck.allCards.length})</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubjectId(sub.id);
                            setSourceMode('topics');
                            if (alert.pendingTopicIds.length > 0) {
                              setSelectedTopicIds(alert.pendingTopicIds);
                            } else {
                              setSelectedTopicIds((sub.topics || []).map((t) => t.id));
                            }
                            setActiveView('create');
                            setShowActiveRecallModal(false);
                            setActiveRecallToast(
                              hasPending
                                ? `✓ Se han seleccionado los ${alert.totalPendingToday} temas de ${sub.name} para tu test de Active Recall.`
                                : `✓ Se ha cargado el temario de ${sub.name} para practicar Active Recall.`
                            );
                            setTimeout(() => {
                              document.getElementById('quiz-generator-section')?.scrollIntoView({ behavior: 'smooth' });
                            }, 120);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Hacer Test Active Recall</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveView('analytics');
                  setShowActiveRecallModal(false);
                }}
                className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Ver Curva de Retención</span>
              </button>

              <button
                type="button"
                onClick={() => setShowActiveRecallModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Extracción Inteligente de Flashcards desde Apuntes Cornell */}
      <CornellFlashcardExtractorModal
        isOpen={isCornellExtractorOpen}
        onClose={() => setIsCornellExtractorOpen(false)}
        subjects={subjects}
        initialSubjectId={selectedSubjectId}
        initialNoteId={selectedNoteId}
        onSaveFlashcards={(subId, flashcards) => {
          if (onSaveFlashcards) {
            onSaveFlashcards(subId, flashcards);
          }
          setIsCornellExtractorOpen(false);
          setFlashcardSuccessMsg(`¡${flashcards.length} flashcards creadas y agregadas al mazo de la asignatura con éxito!`);
          setTimeout(() => setFlashcardSuccessMsg(null), 6000);
        }}
      />

      {/* Modal para Crear y Revisar Preguntas Propias (Test, Verdadero/Falso y Flashcards) por Tema */}
      {currentSubject && (
        <CustomTopicQuestionsModal
          isOpen={isCustomQuestionsModalOpen}
          onClose={() => setIsCustomQuestionsModalOpen(false)}
          subject={currentSubject}
          initialTopicId={customQuestionsModalTopicId}
          onUpdateSubject={(updatedSub) => {
            if (onUpdateSubject) {
              onUpdateSubject(updatedSub);
            }
          }}
          onStartExternalQuiz={(quiz) => {
            setIsCustomQuestionsModalOpen(false);
            setQuizFinished(false);
            setCurrentQIndex(0);
            setIsAnswerRevealed(false);
            setSelectedOption(null);
            setWrittenAnswer('');
            setOpenAnswerEvaluation(null);
            setActiveQuiz(quiz);
            setActiveView('runner');
          }}
          onOpenAIGeneratorForTopic={(topicId) => {
            setIsCustomQuestionsModalOpen(false);
            setSelectedTopicIds([topicId]);
            setSourceMode('topics');
            setQuestionSourcePool('ai');
            handleQuickExpressQuiz({ topicId, count: 5, type: examType });
          }}
        />
      )}
    </div>
  );
};
