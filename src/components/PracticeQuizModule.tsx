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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Subject, Topic, CornellNote, Quiz, QuizQuestion, ExamType, ErrorLogEntry, Flashcard } from '../types';
import { CornellFlashcardExtractorModal } from './CornellFlashcardExtractorModal';
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
  const [difficulty, setDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('intermedio');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [customInstructions, setCustomInstructions] = useState<string>('');

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

  // Active view navigation
  const [activeView, setActiveView] = useState<'create' | 'runner' | 'history' | 'quickfire' | 'analytics'>('create');

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
        const quiz: Quiz = {
          id: `quiz-${Date.now()}`,
          topicId: sourceMode === 'topics' && selectedTopicIds[0] ? selectedTopicIds[0] : undefined,
          sourceNoteIds: sourceMode === 'cornell_notes' ? selectedNoteIds : undefined,
          examTitle: payload.examTitle || examTitle,
          examType,
          difficulty,
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

  // Confirm or check answer
  const handleConfirmAnswer = () => {
    if (!activeQuiz) return;
    const currentQ = activeQuiz.questions[currentQIndex];

    if (activeQuiz.examType === 'test') {
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
    if (currentQIndex < activeQuiz.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setSelectedOption(null);
      setWrittenAnswer('');
      setIsAnswerRevealed(false);
      setOpenAnswerEvaluation(null);
    } else {
      // Complete quiz
      const totalScore = activeQuiz.questions.reduce((acc, q) => acc + (q.score || 0), 0);
      const overall = Math.round(totalScore / activeQuiz.questions.length);
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
          onClick={() => {
            setActiveView('create');
            if (currentSubjectSpacedAlert.hasPendingToday) {
              setSelectedTopicIds(currentSubjectSpacedAlert.pendingTopicIds);
            }
          }}
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
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
            <p className="text-[11px] text-indigo-700 font-medium mt-1 flex items-center gap-1">
              <span>Evita el olvido con active recall</span>
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-semibold">
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
        <div className="space-y-6">
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
                            {topic.pageCount && (
                              <span className="text-[10px] font-mono-numbers text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                                {topic.pageCount} págs
                              </span>
                            )}
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
                      {selectedNoteId && (
                        <button
                          type="button"
                          onClick={() => setIsCornellExtractorOpen(true)}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Extraer flashcards de la nota seleccionada"
                        >
                          <Layers className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Extraer flashcards</span>
                        </button>
                      )}
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
              {/* Question progress header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
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

                <button
                  onClick={() => setActiveView('create')}
                  className="text-xs text-slate-400 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Salir
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${((currentQIndex + 1) / activeQuiz.questions.length) * 100}%`,
                  }}
                />
              </div>

              {/* Question Prompt */}
              <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-2xl">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                  {activeQuiz.questions[currentQIndex].prompt}
                </h3>
              </div>

              {/* FORMAT 1: TEST (Multiple Choice) */}
              {activeQuiz.examType === 'test' && (
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
              {activeQuiz.examType !== 'test' && (
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

              {/* Revealed Explanation & Per-Option Feedback for Test */}
              {isAnswerRevealed && activeQuiz.examType === 'test' && (() => {
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
                {!isAnswerRevealed && activeQuiz.examType === 'test' ? (
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
    </div>
  );
};
