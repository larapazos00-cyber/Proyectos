import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pencil,
  Check,
  Sparkles,
  Layers,
  CheckSquare,
  HelpCircle,
  Play,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Subject, Topic, Flashcard, QuizQuestion, Quiz } from '../types';

export interface CustomTopicQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  initialTopicId?: string;
  initialTab?: 'flashcard' | 'test' | 'verdadero_falso' | 'review';
  onUpdateSubject: (updatedSubject: Subject) => void;
  onStartExternalQuiz?: (quiz: Quiz) => void;
  onOpenAIGeneratorForTopic?: (topicId: string) => void;
}

export const CustomTopicQuestionsModal: React.FC<CustomTopicQuestionsModalProps> = ({
  isOpen,
  onClose,
  subject,
  initialTopicId,
  initialTab = 'test',
  onUpdateSubject,
  onStartExternalQuiz,
  onOpenAIGeneratorForTopic,
}) => {
  const topics = subject.topics || [];
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    initialTopicId || topics[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'flashcard' | 'test' | 'verdadero_falso' | 'review'>(
    initialTab
  );

  // Flashcard form state
  const [fcQuestion, setFcQuestion] = useState('');
  const [fcAnswer, setFcAnswer] = useState('');
  const [fcHint, setFcHint] = useState('');
  const [editingFcId, setEditingFcId] = useState<string | null>(null);

  // Multiple-choice Test form state
  const [testPrompt, setTestPrompt] = useState('');
  const [testOptions, setTestOptions] = useState<string[]>(['', '', '', '']);
  const [testCorrectIdx, setTestCorrectIdx] = useState<number>(0);
  const [testExplanation, setTestExplanation] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // True/False form state
  const [vfPrompt, setVfPrompt] = useState('');
  const [vfIsTrue, setVfIsTrue] = useState<boolean>(true);
  const [vfExplanation, setVfExplanation] = useState('');

  // Status banner
  const [notice, setNotice] = useState<string | null>(null);

  // In-modal interactive practice runner state
  const [reviewFilterMode, setReviewFilterMode] = useState<'all_custom' | 'test' | 'verdadero_falso' | 'flashcards'>('all_custom');
  const [reviewTopicScope, setReviewTopicScope] = useState<'current_topic' | 'all_topics'>('current_topic');
  const [runnerQuestions, setRunnerQuestions] = useState<QuizQuestion[]>([]);
  const [runnerIdx, setRunnerIdx] = useState<number>(0);
  const [runnerSelectedOption, setRunnerSelectedOption] = useState<number | null>(null);
  const [runnerRevealed, setRunnerRevealed] = useState<boolean>(false);
  const [runnerFinished, setRunnerFinished] = useState<boolean>(false);

  // Flashcard runner inside review tab
  const [runnerFlashcards, setRunnerFlashcards] = useState<Flashcard[]>([]);
  const [fcRunnerIdx, setFcRunnerIdx] = useState<number>(0);
  const [fcRunnerFlipped, setFcRunnerFlipped] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTopicId) {
        setSelectedTopicId(initialTopicId);
      } else if (!selectedTopicId && topics[0]?.id) {
        setSelectedTopicId(topics[0].id);
      }
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTopicId, initialTab]);

  const currentTopic: Topic | undefined = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) || topics[0],
    [topics, selectedTopicId]
  );

  // Topic's flashcards
  const topicFlashcards = useMemo(() => {
    if (!currentTopic) return [];
    return (subject.flashcards || []).filter((fc) => fc.topicId === currentTopic.id);
  }, [subject.flashcards, currentTopic]);

  // Topic's custom questions (Test + Verdadero/Falso)
  const topicCustomQuestions = useMemo(() => {
    if (!currentTopic) return [];
    return currentTopic.customQuestions || [];
  }, [currentTopic]);

  const topicTestQuestions = useMemo(
    () => topicCustomQuestions.filter((q) => (q.questionType || 'test') === 'test'),
    [topicCustomQuestions]
  );

  const topicVfQuestions = useMemo(
    () => topicCustomQuestions.filter((q) => q.questionType === 'verdadero_falso'),
    [topicCustomQuestions]
  );

  // All custom questions across the subject
  const allSubjectCustomQuestions = useMemo(() => {
    return topics.flatMap((t) =>
      (t.customQuestions || []).map((q) => ({
        ...q,
        topicId: t.id,
      }))
    );
  }, [topics]);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3200);
  };

  // --- 1. FLASHCARDS PROPIAS HANDLERS ---
  const handleSaveFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTopic || !fcQuestion.trim() || !fcAnswer.trim()) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let updatedFlashcards: Flashcard[];

    if (editingFcId) {
      updatedFlashcards = (subject.flashcards || []).map((fc) =>
        fc.id === editingFcId
          ? {
              ...fc,
              question: fcQuestion.trim(),
              answer: fcAnswer.trim(),
              concept: fc.concept ? fcQuestion.trim() : undefined,
              definition: fc.definition ? fcAnswer.trim() : undefined,
              hint: fcHint.trim() || undefined,
              isCustom: true,
            }
          : fc
      );
      showNotice('Flashcard propia actualizada correctamente.');
    } else {
      const newCard: Flashcard = {
        id: `fc-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        topicId: currentTopic.id,
        question: fcQuestion.trim(),
        answer: fcAnswer.trim(),
        hint: fcHint.trim() || undefined,
        conceptTag: currentTopic.title,
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: todayStr,
        isCustom: true,
      };
      updatedFlashcards = [newCard, ...(subject.flashcards || [])];
      showNotice(`Flashcard propia añadida al tema "${currentTopic.title}".`);
    }

    onUpdateSubject({
      ...subject,
      flashcards: updatedFlashcards,
    });

    setFcQuestion('');
    setFcAnswer('');
    setFcHint('');
    setEditingFcId(null);
  };

  const handleStartEditFlashcard = (fc: Flashcard) => {
    setEditingFcId(fc.id);
    setFcQuestion(fc.concept || fc.question || '');
    setFcAnswer(fc.definition || fc.answer || '');
    setFcHint(fc.hint || '');
  };

  const handleDeleteFlashcard = (fcId: string) => {
    onUpdateSubject({
      ...subject,
      flashcards: (subject.flashcards || []).filter((fc) => fc.id !== fcId),
    });
    if (editingFcId === fcId) {
      setEditingFcId(null);
      setFcQuestion('');
      setFcAnswer('');
      setFcHint('');
    }
    showNotice('Flashcard eliminada.');
  };

  // --- 2. PREGUNTAS TIPO TEST PROPIAS HANDLERS ---
  const handleSaveTestQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTopic || !testPrompt.trim()) return;

    const cleanedOptions = testOptions.map(
      (opt, idx) => opt.trim() || `Opción ${String.fromCharCode(65 + idx)}`
    );
    const validCorrect = Math.min(Math.max(0, testCorrectIdx), 3);

    const newQuestion: QuizQuestion = {
      id: editingQuestionId || `q-custom-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      topicId: currentTopic.id,
      questionType: 'test',
      isCustom: true,
      prompt: testPrompt.trim(),
      options: cleanedOptions,
      correctOptionIndex: validCorrect,
      explanation:
        testExplanation.trim() ||
        `Respuesta correcta: ${String.fromCharCode(65 + validCorrect)}) ${cleanedOptions[validCorrect]}.`,
    };

    const existingList = currentTopic.customQuestions || [];
    const nextCustomQuestions = editingQuestionId
      ? existingList.map((q) => (q.id === editingQuestionId ? newQuestion : q))
      : [newQuestion, ...existingList];

    const updatedTopics = topics.map((t) =>
      t.id === currentTopic.id ? { ...t, customQuestions: nextCustomQuestions } : t
    );

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });

    setTestPrompt('');
    setTestOptions(['', '', '', '']);
    setTestCorrectIdx(0);
    setTestExplanation('');
    setEditingQuestionId(null);
    showNotice(
      editingQuestionId
        ? 'Pregunta tipo test actualizada.'
        : `Pregunta tipo test añadida a "${currentTopic.title}".`
    );
  };

  const handleStartEditQuestion = (q: QuizQuestion) => {
    if (q.questionType === 'verdadero_falso') {
      setActiveTab('verdadero_falso');
      setEditingQuestionId(q.id);
      setVfPrompt(q.prompt);
      setVfIsTrue((q.correctOptionIndex ?? 0) === 0);
      setVfExplanation(q.explanation || '');
    } else {
      setActiveTab('test');
      setEditingQuestionId(q.id);
      setTestPrompt(q.prompt);
      setTestOptions(
        Array.isArray(q.options) && q.options.length === 4
          ? [...q.options]
          : [q.options?.[0] || '', q.options?.[1] || '', q.options?.[2] || '', q.options?.[3] || '']
      );
      setTestCorrectIdx(typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0);
      setTestExplanation(q.explanation || '');
    }
  };

  const handleDeleteCustomQuestion = (qId: string) => {
    if (!currentTopic) return;
    const nextCustomQuestions = (currentTopic.customQuestions || []).filter((q) => q.id !== qId);
    const updatedTopics = topics.map((t) =>
      t.id === currentTopic.id ? { ...t, customQuestions: nextCustomQuestions } : t
    );
    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });
    if (editingQuestionId === qId) {
      setEditingQuestionId(null);
      setTestPrompt('');
      setVfPrompt('');
    }
    showNotice('Pregunta eliminada del tema.');
  };

  // --- 3. PREGUNTAS VERDADERO / FALSO PROPIAS HANDLERS ---
  const handleSaveVfQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTopic || !vfPrompt.trim()) return;

    const correctIdx = vfIsTrue ? 0 : 1;
    const newQuestion: QuizQuestion = {
      id: editingQuestionId || `q-custom-vf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      topicId: currentTopic.id,
      questionType: 'verdadero_falso',
      isCustom: true,
      prompt: vfPrompt.trim(),
      options: ['Verdadero', 'Falso'],
      correctOptionIndex: correctIdx,
      explanation:
        vfExplanation.trim() ||
        `La afirmación es ${vfIsTrue ? 'VERDADERA' : 'FALSA'} según los apuntes de ${currentTopic.title}.`,
    };

    const existingList = currentTopic.customQuestions || [];
    const nextCustomQuestions = editingQuestionId
      ? existingList.map((q) => (q.id === editingQuestionId ? newQuestion : q))
      : [newQuestion, ...existingList];

    const updatedTopics = topics.map((t) =>
      t.id === currentTopic.id ? { ...t, customQuestions: nextCustomQuestions } : t
    );

    onUpdateSubject({
      ...subject,
      topics: updatedTopics,
    });

    setVfPrompt('');
    setVfIsTrue(true);
    setVfExplanation('');
    setEditingQuestionId(null);
    showNotice(
      editingQuestionId
        ? 'Pregunta de Verdadero/Falso actualizada.'
        : `Pregunta de Verdadero/Falso añadida a "${currentTopic.title}".`
    );
  };

  // --- 4. INICIAR REPASO DE PREGUNTAS PROPIAS ---
  const startCustomPracticeSession = (
    mode: 'all_custom' | 'test' | 'verdadero_falso' | 'flashcards',
    scope: 'current_topic' | 'all_topics' = reviewTopicScope
  ) => {
    setReviewFilterMode(mode);
    setReviewTopicScope(scope);
    setActiveTab('review');

    if (mode === 'flashcards') {
      const cards =
        scope === 'current_topic' && currentTopic
          ? (subject.flashcards || []).filter((fc) => fc.topicId === currentTopic.id)
          : subject.flashcards || [];
      setRunnerFlashcards(cards);
      setFcRunnerIdx(0);
      setFcRunnerFlipped(false);
      return;
    }

    const basePool =
      scope === 'current_topic' && currentTopic
        ? currentTopic.customQuestions || []
        : allSubjectCustomQuestions;

    const filteredPool =
      mode === 'test'
        ? basePool.filter((q) => (q.questionType || 'test') === 'test')
        : mode === 'verdadero_falso'
        ? basePool.filter((q) => q.questionType === 'verdadero_falso')
        : basePool;

    const cloned = filteredPool.map((q) => ({
      ...q,
      userAnswer: undefined,
      score: undefined,
    }));

    setRunnerQuestions(cloned);
    setRunnerIdx(0);
    setRunnerSelectedOption(null);
    setRunnerRevealed(false);
    setRunnerFinished(false);
  };

  const handleLaunchInMainQuizRunner = () => {
    if (!onStartExternalQuiz) return;
    const basePool =
      reviewTopicScope === 'current_topic' && currentTopic
        ? currentTopic.customQuestions || []
        : allSubjectCustomQuestions;
    const filteredPool =
      reviewFilterMode === 'test'
        ? basePool.filter((q) => (q.questionType || 'test') === 'test')
        : reviewFilterMode === 'verdadero_falso'
        ? basePool.filter((q) => q.questionType === 'verdadero_falso')
        : basePool;

    if (filteredPool.length === 0) return;

    const customQuiz: Quiz = {
      id: `quiz-custom-${Date.now()}`,
      topicId: currentTopic?.id,
      examTitle: `Repaso de Mis Preguntas: ${
        reviewTopicScope === 'current_topic' && currentTopic ? currentTopic.title : subject.name
      }`,
      examType: reviewFilterMode === 'verdadero_falso' ? 'verdadero_falso' : 'test',
      difficulty: 'intermedio',
      questions: filteredPool.map((q) => ({
        ...q,
        userAnswer: undefined,
        score: undefined,
      })),
    };
    onStartExternalQuiz(customQuiz);
    onClose();
  };

  const currentRunnerQ = runnerQuestions[runnerIdx];

  const handleConfirmRunnerAnswer = () => {
    if (!currentRunnerQ || runnerSelectedOption === null) return;
    const isCorrect = runnerSelectedOption === (currentRunnerQ.correctOptionIndex ?? 0);
    const updated = runnerQuestions.map((q, idx) =>
      idx === runnerIdx
        ? {
            ...q,
            userAnswer: runnerSelectedOption,
            score: isCorrect ? 100 : 0,
          }
        : q
    );
    setRunnerQuestions(updated);
    setRunnerRevealed(true);
  };

  const handleNextRunnerQuestion = () => {
    if (runnerIdx < runnerQuestions.length - 1) {
      setRunnerIdx(runnerIdx + 1);
      setRunnerSelectedOption(null);
      setRunnerRevealed(false);
    } else {
      setRunnerFinished(true);
      const total = runnerQuestions.reduce((acc, q) => acc + (q.score || 0), 0);
      const avg = Math.round(total / Math.max(1, runnerQuestions.length));
      if (avg >= 70) {
        confetti({ particleCount: 70, spread: 65 });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span className="font-bold text-indigo-600">
                  Creador de Flashcards, Test y Verdadero/Falso por Tema
                </span>
                <span>·</span>
                <span className="font-semibold text-slate-700">{subject.name}</span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 truncate">
                {currentTopic ? currentTopic.title : 'Selecciona un tema'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenAIGeneratorForTopic && currentTopic && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAIGeneratorForTopic(currentTopic.id);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title="Generar también preguntas o flashcards automáticamente con la IA de la aplicación"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generar también con IA</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Topic Selector Bar & Mode Tabs */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tema activo:</span>
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => {
                setSelectedTopicId(e.target.value);
                setEditingFcId(null);
                setEditingQuestionId(null);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {topics.map((t) => {
                const fcCount = (subject.flashcards || []).filter((c) => c.topicId === t.id).length;
                const qCount = (t.customQuestions || []).length;
                return (
                  <option key={t.id} value={t.id}>
                    {t.title} ({fcCount} flashcards · {qCount} preguntas propias)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('test')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'test'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Preguntas Test ({topicTestQuestions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('verdadero_falso')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'verdadero_falso'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Verdadero / Falso ({topicVfQuestions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('flashcard')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'flashcard'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcards ({topicFlashcards.length})</span>
            </button>

            <button
              type="button"
              onClick={() => startCustomPracticeSession('all_custom', 'current_topic')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'review'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Revisar Mis Preguntas ({topicCustomQuestions.length})</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {notice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{notice}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: PREGUNTAS TIPO TEST PROPIAS */}
          {activeTab === 'test' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveTestQuestion}
                className="lg:col-span-6 bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                    <span>
                      {editingQuestionId
                        ? 'Editar Pregunta Tipo Test'
                        : 'Crear Nueva Pregunta Tipo Test'}
                    </span>
                  </h3>
                  {editingQuestionId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuestionId(null);
                        setTestPrompt('');
                        setTestOptions(['', '', '', '']);
                        setTestExplanation('');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Enunciado de la pregunta:
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Ej: ¿Cuál de los siguientes mecanismos explica principalmente...?"
                    className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Opciones de respuesta (pulsa en la letra A, B, C o D para marcar la correcta):
                  </label>
                  {testOptions.map((opt, idx) => {
                    const isCorrect = testCorrectIdx === idx;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-400'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setTestCorrectIdx(idx)}
                          className={`px-2.5 py-1.5 rounded-lg font-mono-numbers text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          title="Marcar esta opción como la respuesta correcta"
                        >
                          <span>{String.fromCharCode(65 + idx)}</span>
                          {isCorrect && <Check className="w-3 h-3" />}
                        </button>
                        <input
                          type="text"
                          required={idx < 2}
                          value={opt}
                          onChange={(e) => {
                            const next = [...testOptions];
                            next[idx] = e.target.value;
                            setTestOptions(next);
                          }}
                          placeholder={`Opción ${String.fromCharCode(65 + idx)}...`}
                          className="flex-1 text-xs bg-transparent px-2 py-1 focus:outline-none text-slate-900"
                        />
                        {isCorrect && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                            Correcta
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Explicación / Justificación al corregir (opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={testExplanation}
                    onChange={(e) => setTestExplanation(e.target.value)}
                    placeholder="Por qué es correcta esta opción según tus apuntes..."
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {editingQuestionId ? 'Guardar Cambios' : 'Guardar Pregunta Tipo Test en este Tema'}
                  </span>
                </button>
              </form>

              {/* Lista de preguntas tipo test creadas en este tema */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    Mis Preguntas Tipo Test de este Tema ({topicTestQuestions.length})
                  </h4>
                  {topicTestQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => startCustomPracticeSession('test', 'current_topic')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Practicar estas preguntas</span>
                    </button>
                  )}
                </div>

                {topicTestQuestions.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                    <CheckSquare className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      Aún no has creado preguntas tipo test propias en este tema
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Usa el formulario de la izquierda para añadir tus propias preguntas de opción múltiple y repasarlas cuando quieras.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {topicTestQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2 hover:border-blue-300 transition-colors shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 leading-snug">
                            {idx + 1}. {q.prompt}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditQuestion(q)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                              title="Editar pregunta"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomQuestion(q.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Eliminar pregunta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                          {(q.options || []).map((opt, oIdx) => {
                            const isCorrect = oIdx === (q.correctOptionIndex ?? 0);
                            return (
                              <div
                                key={oIdx}
                                className={`px-2.5 py-1 rounded-lg border truncate ${
                                  isCorrect
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                    : 'bg-slate-50 border-slate-200/80 text-slate-600'
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}) {opt}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PREGUNTAS VERDADERO / FALSO PROPIAS */}
          {activeTab === 'verdadero_falso' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveVfQuestion}
                className="lg:col-span-6 bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-emerald-600" />
                    <span>
                      {editingQuestionId
                        ? 'Editar Pregunta de Verdadero / Falso'
                        : 'Crear Nueva Pregunta de Verdadero / Falso'}
                    </span>
                  </h3>
                  {editingQuestionId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuestionId(null);
                        setVfPrompt('');
                        setVfExplanation('');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Afirmación o enunciado a evaluar:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={vfPrompt}
                    onChange={(e) => setVfPrompt(e.target.value)}
                    placeholder="Escribe una afirmación sobre el tema para decidir si es Verdadera o Falsa..."
                    className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    ¿Esta afirmación es Verdadera o Falsa?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVfIsTrue(true)}
                      className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        vfIsTrue
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Verdadero</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVfIsTrue(false)}
                      className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        !vfIsTrue
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/50'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>Falso</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Justificación / Explicación (opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={vfExplanation}
                    onChange={(e) => setVfExplanation(e.target.value)}
                    placeholder="Explica por qué es verdadera o cuál es el error si es falsa..."
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {editingQuestionId
                      ? 'Guardar Cambios'
                      : 'Guardar Pregunta Verdadero / Falso en este Tema'}
                  </span>
                </button>
              </form>

              {/* Lista de preguntas V/F del tema */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    Mis Preguntas de Verdadero / Falso ({topicVfQuestions.length})
                  </h4>
                  {topicVfQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => startCustomPracticeSession('verdadero_falso', 'current_topic')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Practicar V/F</span>
                    </button>
                  )}
                </div>

                {topicVfQuestions.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                    <HelpCircle className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      Aún no has creado preguntas de Verdadero / Falso en este tema
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Crea afirmaciones clave o trampas habituales de examen para entrenar tu rapidez de discriminación conceptual.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {topicVfQuestions.map((q, idx) => {
                      const isTrue = (q.correctOptionIndex ?? 0) === 0;
                      return (
                        <div
                          key={q.id}
                          className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2 hover:border-emerald-300 transition-colors shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 leading-snug">
                              {idx + 1}. {q.prompt}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                  isTrue
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isTrue ? 'Verdadero' : 'Falso'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEditQuestion(q)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomQuestion(q.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {q.explanation && (
                            <p className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FLASHCARDS PROPIAS */}
          {activeTab === 'flashcard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveFlashcard}
                className="lg:col-span-6 bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>
                      {editingFcId ? 'Editar Flashcard Propia' : 'Crear Nueva Flashcard Propia'}
                    </span>
                  </h3>
                  {editingFcId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFcId(null);
                        setFcQuestion('');
                        setFcAnswer('');
                        setFcHint('');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Anverso (Pregunta o Concepto):
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={fcQuestion}
                    onChange={(e) => setFcQuestion(e.target.value)}
                    placeholder="Ej: ¿Qué establece el principio de...?"
                    className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Reverso (Respuesta o Definición):
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={fcAnswer}
                    onChange={(e) => setFcAnswer(e.target.value)}
                    placeholder="Escribe la definición o respuesta concisa que quieres memorizar..."
                    className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Pista / Regla Mnemotécnica (opcional):
                  </label>
                  <input
                    type="text"
                    value={fcHint}
                    onChange={(e) => setFcHint(e.target.value)}
                    placeholder="Una pista breve por si te atascas al repasar..."
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {editingFcId ? 'Guardar Cambios' : 'Guardar Flashcard en este Tema'}
                  </span>
                </button>
              </form>

              {/* Lista de flashcards del tema */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    Flashcards de este Tema ({topicFlashcards.length})
                  </h4>
                  {topicFlashcards.length > 0 && (
                    <button
                      type="button"
                      onClick={() => startCustomPracticeSession('flashcards', 'current_topic')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Repasar Flashcards</span>
                    </button>
                  )}
                </div>

                {topicFlashcards.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
                    <Layers className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      Este tema aún no tiene flashcards
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Crea tus propias tarjetas en el formulario o pulsa "Generar también con IA" arriba.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {topicFlashcards.map((fc, idx) => (
                      <div
                        key={fc.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-1.5 hover:border-indigo-300 transition-colors shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {idx + 1}. {fc.concept || fc.question}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                fc.isCustom
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {fc.isCustom ? 'Propia' : 'IA'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditFlashcard(fc)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFlashcard(fc.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                          {fc.definition || fc.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: REVISAR / PRACTICAR MIS PREGUNTAS PROPIAS */}
          {activeTab === 'review' && (
            <div className="space-y-5">
              {/* Filter Bar for Review */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">Modalidad a revisar:</span>
                  {[
                    { id: 'all_custom' as const, label: 'Test + Verdadero/Falso' },
                    { id: 'test' as const, label: 'Solo Tipo Test' },
                    { id: 'verdadero_falso' as const, label: 'Solo Verdadero / Falso' },
                    { id: 'flashcards' as const, label: 'Flashcards del Tema' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => startCustomPracticeSession(m.id, reviewTopicScope)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        reviewFilterMode === m.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={reviewTopicScope}
                    onChange={(e) => {
                      const nextScope = e.target.value as 'current_topic' | 'all_topics';
                      startCustomPracticeSession(reviewFilterMode, nextScope);
                    }}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                  >
                    <option value="current_topic">Solo este tema ({currentTopic?.title})</option>
                    <option value="all_topics">Todos los temas de {subject.name}</option>
                  </select>

                  {onStartExternalQuiz && reviewFilterMode !== 'flashcards' && runnerQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleLaunchInMainQuizRunner}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Abrir en Pantalla Completa de Examen
                    </button>
                  )}
                </div>
              </div>

              {reviewFilterMode === 'flashcards' ? (
                runnerFlashcards.length === 0 ? (
                  <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-slate-800">
                      No hay flashcards disponibles en la selección actual
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('flashcard')}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Crear mi primera Flashcard
                    </button>
                  </div>
                ) : (
                  <div className="max-w-xl mx-auto space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-slate-800 font-mono-numbers">
                        Tarjeta {fcRunnerIdx + 1} de {runnerFlashcards.length}
                      </span>
                      <span>Haz clic en la tarjeta para voltearla</span>
                    </div>
                    <div
                      onClick={() => setFcRunnerFlipped(!fcRunnerFlipped)}
                      className="p-8 min-h-[220px] rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40 shadow-sm flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-indigo-400"
                    >
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 mb-2">
                        {fcRunnerFlipped ? 'Respuesta / Definición' : 'Pregunta / Concepto'}
                      </span>
                      <p className="text-base font-bold text-slate-900 leading-relaxed">
                        {fcRunnerFlipped
                          ? runnerFlashcards[fcRunnerIdx].definition ||
                            runnerFlashcards[fcRunnerIdx].answer
                          : runnerFlashcards[fcRunnerIdx].concept ||
                            runnerFlashcards[fcRunnerIdx].question}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        disabled={fcRunnerIdx === 0}
                        onClick={() => {
                          setFcRunnerIdx(Math.max(0, fcRunnerIdx - 1));
                          setFcRunnerFlipped(false);
                        }}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setFcRunnerFlipped(!fcRunnerFlipped)}
                        className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold cursor-pointer"
                      >
                        {fcRunnerFlipped ? 'Ver Pregunta' : 'Mostrar Respuesta'}
                      </button>
                      <button
                        type="button"
                        disabled={fcRunnerIdx >= runnerFlashcards.length - 1}
                        onClick={() => {
                          setFcRunnerIdx(Math.min(runnerFlashcards.length - 1, fcRunnerIdx + 1));
                          setFcRunnerFlipped(false);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )
              ) : runnerQuestions.length === 0 ? (
                <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
                  <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">
                    No hay preguntas propias creadas para este filtro
                  </p>
                  <p className="text-xs text-slate-500">
                    Crea tus propias preguntas Tipo Test o de Verdadero/Falso en las pestañas superiores para practicarlas aquí.
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('test')}
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      + Crear Pregunta Test
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('verdadero_falso')}
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      + Crear Verdadero / Falso
                    </button>
                  </div>
                </div>
              ) : runnerFinished ? (
                <div className="max-w-lg mx-auto p-6 bg-white border border-slate-200 rounded-2xl text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto font-extrabold text-lg font-mono-numbers">
                    {Math.round(
                      runnerQuestions.reduce((acc, q) => acc + (q.score || 0), 0) /
                        Math.max(1, runnerQuestions.length)
                    )}
                    %
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    ¡Repaso de tus preguntas completado!
                  </h3>
                  <p className="text-xs text-slate-600">
                    Has acertado{' '}
                    {runnerQuestions.filter((q) => q.score === 100).length} de{' '}
                    {runnerQuestions.length} preguntas creadas por ti.
                  </p>
                  <button
                    type="button"
                    onClick={() => startCustomPracticeSession(reviewFilterMode, reviewTopicScope)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Volver a practicar</span>
                  </button>
                </div>
              ) : (
                currentRunnerQ && (
                  <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2.5">
                      <span className="font-extrabold text-slate-900 font-mono-numbers">
                        Pregunta {runnerIdx + 1} de {runnerQuestions.length}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                          currentRunnerQ.questionType === 'verdadero_falso'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {currentRunnerQ.questionType === 'verdadero_falso'
                          ? 'Verdadero / Falso'
                          : 'Tipo Test'}
                      </span>
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                      {currentRunnerQ.prompt}
                    </h4>

                    <div className="space-y-2.5">
                      {(currentRunnerQ.options || []).map((opt, oIdx) => {
                        const isSelected = runnerSelectedOption === oIdx;
                        const isCorrect = oIdx === (currentRunnerQ.correctOptionIndex ?? 0);
                        let style =
                          'border-slate-200 bg-white hover:border-indigo-400 text-slate-800';
                        if (runnerRevealed) {
                          if (isCorrect) {
                            style =
                              'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500';
                          } else if (isSelected) {
                            style =
                              'border-rose-500 bg-rose-50 text-rose-950 line-through ring-1 ring-rose-500';
                          } else {
                            style = 'border-slate-100 bg-slate-50 text-slate-400 opacity-60';
                          }
                        } else if (isSelected) {
                          style =
                            'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold ring-2 ring-indigo-500/20';
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => !runnerRevealed && setRunnerSelectedOption(oIdx)}
                            className={`w-full p-3.5 rounded-xl border text-left text-xs flex items-center justify-between gap-3 transition-all cursor-pointer ${style}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono-numbers font-bold text-[11px] flex items-center justify-center shrink-0">
                                {currentRunnerQ.questionType === 'verdadero_falso'
                                  ? oIdx === 0
                                    ? 'V'
                                    : 'F'
                                  : String.fromCharCode(65 + oIdx)}
                              </span>
                              <span>{opt}</span>
                            </div>
                            {runnerRevealed && isCorrect && (
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                            {runnerRevealed && isSelected && !isCorrect && (
                              <X className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {runnerRevealed && currentRunnerQ.explanation && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                        <strong className="text-slate-900">Explicación:</strong>{' '}
                        {currentRunnerQ.explanation}
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      {!runnerRevealed ? (
                        <button
                          type="button"
                          disabled={runnerSelectedOption === null}
                          onClick={handleConfirmRunnerAnswer}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                        >
                          Comprobar Respuesta
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleNextRunnerQuestion}
                          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                        >
                          {runnerIdx < runnerQuestions.length - 1
                            ? 'Siguiente Pregunta'
                            : 'Ver Resultado Final'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
