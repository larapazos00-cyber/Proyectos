import React, { useState } from 'react';
import { Sparkles, RotateCw, CheckCircle2, AlertCircle, Plus, Trash2, ArrowLeft, ArrowRight, Loader2, Pencil, Check, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Flashcard, Topic, ReviewQuality } from '../types';

interface FlashcardDeckProps {
  flashcards: Flashcard[];
  topics: Topic[];
  subjectName: string;
  onUpdateFlashcard: (updated: Flashcard) => void;
  onAddFlashcards: (newCards: Flashcard[]) => void;
  onDeleteFlashcard: (cardId: string) => void;
  onOpenGenerator?: () => void;
  onOpenCustomQuestionsModal?: (topicId?: string) => void;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  flashcards,
  topics,
  subjectName,
  onUpdateFlashcard,
  onAddFlashcards,
  onDeleteFlashcard,
  onOpenGenerator,
  onOpenCustomQuestionsModal,
}) => {
  const [filterTopicId, setFilterTopicId] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'custom' | 'ai'>('all');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedTopicForGen, setSelectedTopicForGen] = useState<string>(
    topics.length > 0 ? topics[0].id : ''
  );
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);

  // Create custom flashcard inline form state
  const [isCreatingCustomCard, setIsCreatingCustomCard] = useState<boolean>(false);
  const [newCardTopicId, setNewCardTopicId] = useState<string>(
    topics.length > 0 ? topics[0].id : ''
  );
  const [newCardQuestion, setNewCardQuestion] = useState<string>('');
  const [newCardAnswer, setNewCardAnswer] = useState<string>('');
  const [newCardHint, setNewCardHint] = useState<string>('');

  // Inline edit state while reviewing a flashcard
  const [isEditingCard, setIsEditingCard] = useState<boolean>(false);
  const [editQuestion, setEditQuestion] = useState<string>('');
  const [editAnswer, setEditAnswer] = useState<string>('');
  const [editHint, setEditHint] = useState<string>('');
  const [editConceptTag, setEditConceptTag] = useState<string>('');

  // Filtered flashcards by topic and source (All / Custom / AI)
  const filteredCards = flashcards.filter((c) => {
    const matchesTopic = filterTopicId === 'all' || c.topicId === filterTopicId;
    if (!matchesTopic) return false;
    if (sourceFilter === 'custom') return Boolean(c.isCustom);
    if (sourceFilter === 'ai') return !c.isCustom;
    return true;
  });

  const customCardsCount = flashcards.filter(
    (c) => (filterTopicId === 'all' || c.topicId === filterTopicId) && Boolean(c.isCustom)
  ).length;
  const aiCardsCount = flashcards.filter(
    (c) => (filterTopicId === 'all' || c.topicId === filterTopicId) && !c.isCustom
  ).length;

  const safeIndex =
    filteredCards.length > 0
      ? Math.min(currentIndex, filteredCards.length - 1)
      : 0;
  const currentCard = filteredCards[safeIndex];

  const handleCreateCustomFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    const q = newCardQuestion.trim();
    const a = newCardAnswer.trim();
    if (!q || !a) return;

    const targetTopicId =
      newCardTopicId || (filterTopicId !== 'all' ? filterTopicId : topics[0]?.id || 'general');
    const topicObj = topics.find((t) => t.id === targetTopicId);

    const createdCard: Flashcard = {
      id: `fc-custom-${Date.now()}`,
      topicId: targetTopicId,
      question: q,
      answer: a,
      hint: newCardHint.trim() || undefined,
      conceptTag: topicObj ? topicObj.title : subjectName,
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      nextReview: new Date().toISOString().split('T')[0],
      isCustom: true,
    };

    onAddFlashcards([createdCard]);
    setNewCardQuestion('');
    setNewCardAnswer('');
    setNewCardHint('');
    setIsCreatingCustomCard(false);
    setFilterTopicId(targetTopicId);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionCompleted(false);
  };

  const handleFlip = () => {
    if (isEditingCard) return;
    setIsFlipped(!isFlipped);
  };

  const handleStartEditCard = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentCard) return;
    setEditQuestion(currentCard.concept || currentCard.question || '');
    setEditAnswer(currentCard.definition || currentCard.answer || '');
    setEditHint(currentCard.hint || '');
    setEditConceptTag(currentCard.conceptTag || '');
    setIsEditingCard(true);
  };

  const handleSaveEditCard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentCard) return;
    const trimmedQ = editQuestion.trim();
    const trimmedA = editAnswer.trim();
    if (!trimmedQ || !trimmedA) return;

    const updated: Flashcard = {
      ...currentCard,
      question: trimmedQ,
      answer: trimmedA,
      concept: currentCard.concept ? trimmedQ : undefined,
      definition: currentCard.definition ? trimmedA : undefined,
      hint: editHint.trim() || undefined,
      conceptTag: editConceptTag.trim() || currentCard.conceptTag,
    };

    onUpdateFlashcard(updated);
    setIsEditingCard(false);
  };

  const handleDeleteCurrentCard = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentCard) return;
    const deletingId = currentCard.id;
    const remainingCount = filteredCards.length - 1;
    onDeleteFlashcard(deletingId);
    setIsEditingCard(false);
    setIsFlipped(false);
    setShowHint(false);
    if (remainingCount <= 0) {
      setCurrentIndex(0);
    } else if (safeIndex >= remainingCount) {
      setCurrentIndex(remainingCount - 1);
    }
  };

  const handleNext = () => {
    setIsEditingCard(false);
    if (safeIndex < filteredCards.length - 1) {
      setCurrentIndex(safeIndex + 1);
      setIsFlipped(false);
      setShowHint(false);
    } else {
      setSessionCompleted(true);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  const handlePrev = () => {
    setIsEditingCard(false);
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
      setIsFlipped(false);
      setShowHint(false);
    }
  };

  const handleRate = (quality: ReviewQuality) => {
    if (!currentCard) return;

    let nextIntervalDays = 1;
    if (quality === 'facil') nextIntervalDays = Math.max(7, currentCard.interval * 2.2);
    else if (quality === 'bien') nextIntervalDays = Math.max(3, currentCard.interval * 1.6);
    else if (quality === 'dificil') nextIntervalDays = Math.max(1, Math.round(currentCard.interval * 0.8));
    else nextIntervalDays = 1;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + Math.round(nextIntervalDays));

    const updated: Flashcard = {
      ...currentCard,
      interval: Math.round(nextIntervalDays),
      repetitions: currentCard.repetitions + 1,
      lastScore: quality,
      nextReview: nextDate.toISOString().split('T')[0],
    };

    onUpdateFlashcard(updated);
    handleNext();
  };

  const handleGenerateAI = async () => {
    const topic = topics.find((t) => t.id === selectedTopicForGen) || topics[0];
    if (!topic) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/gemini/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: topic.title,
          topicContent: `${topic.description} ${topic.subtopics.join('. ')} ${topic.notes || ''}`,
          count: 5,
          difficulty: topic.difficulty.toLowerCase(),
        }),
      });

      const resData = await response.json();
      if (resData.success && Array.isArray(resData.data)) {
        const newCards: Flashcard[] = resData.data.map((item: any, i: number) => ({
          id: `fc-${Date.now()}-${i}`,
          topicId: topic.id,
          question: item.question,
          answer: item.answer,
          hint: item.hint,
          conceptTag: item.conceptTag || topic.title,
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          nextReview: new Date().toISOString().split('T')[0],
          isCustom: false,
        }));

        onAddFlashcards(newCards);
        setFilterTopicId(topic.id);
        setCurrentIndex(0);
        setIsFlipped(false);
        setSessionCompleted(false);
      }
    } catch (e) {
      console.error('Error generating flashcards', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetSession = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setIsEditingCard(false);
    setSessionCompleted(false);
  };

  return (
    <div className="space-y-6">
      {/* Deck Header & Filter / Generator Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Tema:</span>
              <select
                value={filterTopicId}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterTopicId(val);
                  if (val !== 'all') {
                    setNewCardTopicId(val);
                    setSelectedTopicForGen(val);
                  }
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setSessionCompleted(false);
                }}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-semibold focus:outline-none"
              >
                <option value="all">Todos los temas ({flashcards.length})</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({flashcards.filter((c) => c.topicId === t.id).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de origen: Todas / Solo Propias / Solo IA */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setSourceFilter('all');
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setSessionCompleted(false);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  sourceFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({customCardsCount + aiCardsCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceFilter('custom');
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setSessionCompleted(false);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  sourceFilter === 'custom'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mis Propias ({customCardsCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceFilter('ai');
                  setCurrentIndex(0);
                  setIsFlipped(false);
                  setSessionCompleted(false);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  sourceFilter === 'ai'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                IA ({aiCardsCount})
              </button>
            </div>
          </div>

          {/* Custom Creator + AI Generator Control (Keeping both options available) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (filterTopicId !== 'all') setNewCardTopicId(filterTopicId);
                setIsCreatingCustomCard((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-700" />
              <span>Crear Flashcard Propia</span>
            </button>

            {onOpenCustomQuestionsModal && (
              <button
                type="button"
                onClick={() =>
                  onOpenCustomQuestionsModal(filterTopicId !== 'all' ? filterTopicId : undefined)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                <span>Crear Test / V-F Propios</span>
              </button>
            )}

            {onOpenGenerator ? (
              <button
                type="button"
                onClick={onOpenGenerator}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generar Flashcards con IA</span>
              </button>
            ) : (
              <>
                {topics.length > 0 && (
                  <select
                    value={selectedTopicForGen}
                    onChange={(e) => setSelectedTopicForGen(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={handleGenerateAI}
                  disabled={isGenerating || topics.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Crear Flashcards con IA</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inline Creator Form for Custom Flashcards per Topic */}
        {isCreatingCustomCard && (
          <form
            onSubmit={handleCreateCustomFlashcard}
            className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-700" />
                <span>Nueva Flashcard Propia por Tema</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingCustomCard(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Asignar al Tema:
                </label>
                <select
                  value={newCardTopicId}
                  onChange={(e) => setNewCardTopicId(e.target.value)}
                  className="w-full text-xs bg-white border border-amber-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                >
                  {topics.map((t, i) => (
                    <option key={t.id} value={t.id}>
                      Tema {i + 1}: {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pista de memoria (opcional):
                </label>
                <input
                  type="text"
                  value={newCardHint}
                  onChange={(e) => setNewCardHint(e.target.value)}
                  placeholder="Ej: Recuerda la regla nemotécnica..."
                  className="w-full text-xs bg-white border border-amber-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pregunta / Concepto (Anverso):
                </label>
                <textarea
                  value={newCardQuestion}
                  onChange={(e) => setNewCardQuestion(e.target.value)}
                  rows={2}
                  required
                  placeholder="Escribe tu pregunta o concepto a recordar..."
                  className="w-full text-xs bg-white border border-amber-200 rounded-xl p-2.5 text-slate-900 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Respuesta / Definición (Reverso):
                </label>
                <textarea
                  value={newCardAnswer}
                  onChange={(e) => setNewCardAnswer(e.target.value)}
                  rows={2}
                  required
                  placeholder="Escribe la respuesta correcta que quieres memorizar..."
                  className="w-full text-xs bg-white border border-amber-200 rounded-xl p-2.5 text-slate-900 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingCustomCard(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs cursor-pointer"
              >
                Guardar Flashcard en el Tema
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Main Flashcard Practice Area */}
      {filteredCards.length > 0 && currentCard ? (
        !sessionCompleted ? (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Progress counter & Modify/Delete quick actions */}
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span>
                  Tarjeta <span className="font-bold text-slate-900 font-mono-numbers">{safeIndex + 1}</span> de{' '}
                  <span className="font-mono-numbers">{filteredCards.length}</span>
                </span>
                {currentCard.sourceDocName && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                    Doc: {currentCard.sourceDocName}
                  </span>
                )}
                <span className="text-slate-400 font-normal">
                  Tag: {currentCard.conceptTag}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleStartEditCard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Modificar la pregunta o la respuesta de esta flashcard"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Editar pregunta / respuesta</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCurrentCard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Eliminar esta flashcard porque no encaja"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>

            {isEditingCard ? (
              /* Inline Flashcard Editor */
              <form
                onSubmit={handleSaveEditCard}
                className="p-6 rounded-2xl border-2 border-blue-400 bg-white shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Modificar Pregunta y Respuesta de la Flashcard</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingCard(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pregunta / Concepto (Anverso):
                    </label>
                    <textarea
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      rows={2}
                      required
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Escribe la pregunta o concepto..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Respuesta / Definición (Reverso):
                    </label>
                    <textarea
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      rows={3}
                      required
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Escribe la respuesta o definición correcta..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Pista opcional (Hint):
                      </label>
                      <input
                        type="text"
                        value={editHint}
                        onChange={(e) => setEditHint(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Pista breve..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Etiqueta / Concepto:
                      </label>
                      <input
                        type="text"
                        value={editConceptTag}
                        onChange={(e) => setEditConceptTag(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Etiqueta del tema..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleDeleteCurrentCard}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar tarjeta</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingCard(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
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
              /* Flashcard Box with Flip affordance */
              <div
                onClick={handleFlip}
                className={`min-h-[280px] p-8 rounded-2xl border cursor-pointer transition-all duration-300 shadow-sm flex flex-col justify-between ${
                  isFlipped
                    ? 'bg-slate-900 text-white border-slate-800'
                    : 'bg-white text-slate-900 border-slate-200 hover:border-blue-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-4 opacity-75">
                    <span>
                      {isFlipped
                        ? currentCard.definition
                          ? 'Definición y Explicación'
                          : 'Respuesta y Explicación'
                        : currentCard.concept
                        ? 'Concepto (Active Recall)'
                        : 'Pregunta (Active Recall)'}
                    </span>
                    <span className="flex items-center gap-1">
                      <RotateCw className="w-3 h-3" />
                      <span>Click para voltear</span>
                    </span>
                  </div>

                  {!isFlipped ? (
                    <div className="text-lg sm:text-xl font-medium leading-relaxed">
                      {currentCard.concept || currentCard.question}
                    </div>
                  ) : currentCard.definition &&
                    (currentCard.practicalExample || currentCard.realWorldScenario) ? (
                    <div className="space-y-3 text-left">
                      <div>
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-0.5">
                          📘 Definición
                        </span>
                        <p className="text-sm text-slate-100 leading-relaxed">
                          {currentCard.definition}
                        </p>
                      </div>
                      {currentCard.practicalExample && (
                        <div className="pt-2 border-t border-slate-700/70">
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                            💡 Ejemplo Práctico
                          </span>
                          <p className="text-xs text-slate-200 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/10">
                            {currentCard.practicalExample}
                          </p>
                        </div>
                      )}
                      {currentCard.realWorldScenario && (
                        <div className="pt-2 border-t border-slate-700/70">
                          <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block mb-0.5">
                            🌍 Situación de Uso Real
                          </span>
                          <p className="text-xs text-slate-200 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/10">
                            {currentCard.realWorldScenario}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-lg sm:text-xl font-medium leading-relaxed whitespace-pre-line">
                      {currentCard.definition || currentCard.answer}
                    </div>
                  )}
                </div>

                {/* Bottom hint or interval */}
                <div className="pt-4 border-t border-slate-100/20 text-xs flex items-center justify-between">
                  {!isFlipped ? (
                    currentCard.hint ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHint(!showHint);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium text-xs underline"
                      >
                        {showHint ? `Pista: ${currentCard.hint}` : '💡 Ver pista'}
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Intenta responder mentalmente antes de voltear</span>
                    )
                  ) : (
                    <div className="text-slate-400 text-xs">
                      Repeticiones previas: <span className="font-mono text-slate-200">{currentCard.repetitions}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleStartEditCard}
                      className="opacity-60 hover:opacity-100 p-1.5 text-blue-400 hover:text-blue-500 transition-opacity cursor-pointer"
                      title="Modificar pregunta o respuesta"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentCard}
                      className="opacity-60 hover:opacity-100 p-1.5 text-rose-400 hover:text-rose-500 transition-opacity cursor-pointer"
                      title="Eliminar tarjeta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Recall Scoring Buttons (Only shown when flipped and not editing) */}
            {!isEditingCard && (
              isFlipped ? (
                <div className="space-y-2">
                  <div className="text-center text-xs font-semibold text-slate-500">
                    ¿Cómo de bien lo recordaste? (Repetición Espaciada)
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleRate('repetir')}
                      className="py-2.5 px-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
                    >
                      Repetir (1d)
                    </button>
                    <button
                      onClick={() => handleRate('dificil')}
                      className="py-2.5 px-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold transition-colors"
                    >
                      Difícil
                    </button>
                    <button
                      onClick={() => handleRate('bien')}
                      className="py-2.5 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition-colors"
                    >
                      Bien
                    </button>
                    <button
                      onClick={() => handleRate('facil')}
                      className="py-2.5 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-colors"
                    >
                      Fácil (7d+)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePrev}
                    disabled={safeIndex === 0}
                    className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Saltar
                  </button>
                </div>
              )
            )}
          </div>
        ) : (
          /* Session Completed Celebratory View */
          <div className="max-w-md mx-auto text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              ¡Sesión de Active Recall completada!
            </h3>
            <p className="text-xs text-slate-600 mt-2 mb-6 leading-relaxed">
              Has repasado {filteredCards.length} conceptos. Tus intervalos de repetición espaciada se han actualizado para afianzar tu memoria a largo plazo.
            </p>
            <button
              onClick={resetSession}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
            >
              Repasar de nuevo
            </button>
          </div>
        )
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
          <p className="text-xs text-slate-500 mb-3">
            No hay flashcards para este tema todavía.
          </p>
          <button
            type="button"
            onClick={onOpenGenerator || handleGenerateAI}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generar flashcards automáticas con IA (Active Recall)</span>
          </button>
        </div>
      )}
    </div>
  );
};
