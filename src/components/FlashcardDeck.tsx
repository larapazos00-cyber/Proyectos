import React, { useState } from 'react';
import { Sparkles, RotateCw, CheckCircle2, AlertCircle, Plus, Trash2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
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
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  flashcards,
  topics,
  subjectName,
  onUpdateFlashcard,
  onAddFlashcards,
  onDeleteFlashcard,
  onOpenGenerator,
}) => {
  const [filterTopicId, setFilterTopicId] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedTopicForGen, setSelectedTopicForGen] = useState<string>(
    topics.length > 0 ? topics[0].id : ''
  );
  const [sessionCompleted, setSessionCompleted] = useState<boolean>(false);

  // Filtered flashcards
  const filteredCards =
    filterTopicId === 'all'
      ? flashcards
      : flashcards.filter((c) => c.topicId === filterTopicId);

  const currentCard = filteredCards[currentIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
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
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
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
          topicContent: `${topic.description} ${topic.subtopics.join('. ')}`,
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
    setSessionCompleted(false);
  };

  return (
    <div className="space-y-6">
      {/* Deck Header & Filter / Generator Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700">Filtrar por tema:</span>
          <select
            value={filterTopicId}
            onChange={(e) => {
              setFilterTopicId(e.target.value);
              setCurrentIndex(0);
              setIsFlipped(false);
              setSessionCompleted(false);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none"
          >
            <option value="all">Todos los temas ({flashcards.length})</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({flashcards.filter((c) => c.topicId === t.id).length})
              </option>
            ))}
          </select>
        </div>

        {/* AI Generator Control */}
        <div className="flex items-center gap-2">
          {onOpenGenerator ? (
            <button
              type="button"
              onClick={onOpenGenerator}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generar Flashcards con IA (Apuntes / Temario)</span>
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

      {/* Main Flashcard Practice Area */}
      {filteredCards.length > 0 ? (
        !sessionCompleted ? (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Progress counter */}
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium flex-wrap gap-2">
              <span>
                Tarjeta <span className="font-bold text-slate-900 font-mono-numbers">{currentIndex + 1}</span> de{' '}
                <span className="font-mono-numbers">{filteredCards.length}</span>
              </span>
              <div className="flex items-center gap-2">
                {currentCard.sourceDocName && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                    Doc: {currentCard.sourceDocName}
                  </span>
                )}
                <span className="text-slate-400 font-normal">
                  Tag: {currentCard.conceptTag}
                </span>
              </div>
            </div>

            {/* Flashcard Box with Flip affordance */}
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

                <div className="text-lg sm:text-xl font-medium leading-relaxed">
                  {isFlipped
                    ? currentCard.definition || currentCard.answer
                    : currentCard.concept || currentCard.question}
                </div>
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

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFlashcard(currentCard.id);
                  }}
                  className="opacity-40 hover:opacity-100 p-1 text-rose-400 hover:text-rose-500 transition-opacity"
                  title="Eliminar tarjeta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Recall Scoring Buttons (Only shown when flipped) */}
            {isFlipped ? (
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
                  disabled={currentIndex === 0}
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
