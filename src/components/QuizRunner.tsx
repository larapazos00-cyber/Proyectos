import React, { useState } from 'react';
import { Sparkles, HelpCircle, Check, X, ArrowRight, RotateCcw, AlertTriangle, Mic, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Quiz, QuizQuestion, ExamType, Topic, ErrorLogEntry } from '../types';

interface QuizRunnerProps {
  topics: Topic[];
  subjectId: string;
  subjectName: string;
  onSaveQuizResult: (quiz: Quiz) => void;
  onLogMistake: (mistake: ErrorLogEntry) => void;
  onOpenErrorAnalysis: () => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  topics,
  subjectId,
  subjectName,
  onSaveQuizResult,
  onLogMistake,
  onOpenErrorAnalysis,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    topics.length > 0 ? topics[0].id : ''
  );
  const [examType, setExamType] = useState<ExamType>('test');
  const [difficulty, setDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('intermedio');
  const [questionCount, setQuestionCount] = useState<number>(5);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [writtenAnswer, setWrittenAnswer] = useState<string>('');
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [quizFinished, setQuizFinished] = useState<boolean>(false);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) || topics[0];

  const [quizError, setQuizError] = useState<string | null>(null);

  const handleGenerateQuiz = async () => {
    const targetTopic = selectedTopic || topics[0];
    setQuizError(null);
    setIsGenerating(true);
    setQuizFinished(false);
    setCurrentQIndex(0);
    setIsAnswerRevealed(false);

    const topicTitle = targetTopic ? targetTopic.title : subjectName;
    const topicContent = targetTopic
      ? `TEMA: ${targetTopic.title}\nDescripción: ${targetTopic.description || targetTopic.title}\nSubtemas clave: ${(targetTopic.subtopics || []).join(', ')}${
          targetTopic.notes ? `\nApuntes del tema: ${targetTopic.notes.slice(0, 2000)}` : ''
        }${targetTopic.generalNotes ? `\nNotas adicionales: ${targetTopic.generalNotes.slice(0, 1500)}` : ''}`
      : `TEMA: ${subjectName}\nDescripción: Conceptos esenciales de ${subjectName}.`;

    try {
      const response = await fetch('/api/gemini/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle,
          topicContent,
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
          topicId: targetTopic?.id,
          examTitle: payload.examTitle || `Simulacro de ${examType.toUpperCase()}`,
          examType,
          difficulty,
          questions: payload.questions.map((q: any, i: number) => ({
            id: q.id || `q-${i}`,
            prompt: q.prompt || `Pregunta ${i + 1}`,
            options: Array.isArray(q.options) ? q.options : [],
            correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
            explanation: q.explanation || '',
            optionExplanations: Array.isArray(q.optionExplanations) ? q.optionExplanations : [],
            keyPoints: Array.isArray(q.keyPoints) ? q.keyPoints : [],
            rubricCriteria: Array.isArray(q.rubricCriteria) ? q.rubricCriteria : [],
          })),
        };

        setActiveQuiz(quiz);
      } else {
        setQuizError(resData?.error || 'No se pudo generar el examen. Inténtalo de nuevo.');
      }
    } catch (e: any) {
      console.error('Error generating quiz', e);
      setQuizError(e?.message || 'Error al generar el examen.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAnswer = () => {
    if (!activeQuiz) return;
    const currentQ = activeQuiz.questions[currentQIndex];

    if (examType === 'test') {
      if (selectedOption === null) return;
      currentQ.userAnswer = selectedOption;
      currentQ.score = selectedOption === currentQ.correctOptionIndex ? 100 : 0;

      // Log error if wrong
      if (currentQ.score === 0) {
        onLogMistake({
          id: `err-${Date.now()}`,
          subjectId,
          topicTitle: selectedTopic.title,
          questionPrompt: currentQ.prompt,
          userMistake: currentQ.options ? currentQ.options[selectedOption] : 'Opción incorrecta',
          correctAnswer: currentQ.options ? currentQ.options[currentQ.correctOptionIndex || 0] : currentQ.explanation,
          rootCauseCategory: 'falta_concepto',
          date: new Date().toISOString().split('T')[0],
          resolved: false,
        });
      }
    } else {
      currentQ.userAnswer = writtenAnswer;
      currentQ.score = 80; // Standard baseline for completion
    }

    setIsAnswerRevealed(true);
  };

  const handleNextQuestion = () => {
    if (!activeQuiz) return;
    if (currentQIndex < activeQuiz.questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setSelectedOption(null);
      setWrittenAnswer('');
      setIsAnswerRevealed(false);
    } else {
      // Calculate overall score
      const totalScore = activeQuiz.questions.reduce((acc, q) => acc + (q.score || 0), 0);
      const overall = Math.round(totalScore / activeQuiz.questions.length);
      const finishedQuiz: Quiz = {
        ...activeQuiz,
        overallScore: overall,
        takenAt: new Date().toISOString().split('T')[0],
      };
      setActiveQuiz(finishedQuiz);
      onSaveQuizResult(finishedQuiz);
      setQuizFinished(true);

      if (overall >= 70) {
        confetti({ particleCount: 70, spread: 60 });
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      {!activeQuiz || quizFinished ? (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">
              Cuestionarios Personalizados y Simulacros de Examen
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura el tipo de evaluación exacto según el examen de tu asignatura ({subjectName}).
            </p>
          </div>

          {/* Exam Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              1. Selecciona el Tipo de Examen
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { type: 'test' as ExamType, label: 'Test (4 opciones)', desc: 'Opción múltiple con justificación razonada' },
                { type: 'oral' as ExamType, label: 'Examen Oral', desc: 'Defensa hablada con rúbrica de palabras clave' },
                { type: 'desarrollo' as ExamType, label: 'Desarrollo', desc: 'Preguntas abiertas con rúbrica de corrección' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setExamType(item.type)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    examType === item.type
                      ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`text-xs font-bold ${examType === item.type ? 'text-blue-900' : 'text-slate-800'}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty and Topic Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                2. Dificultad
              </label>
              <div className="flex gap-1.5">
                {(['basico', 'intermedio', 'avanzado'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficulty(lvl)}
                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg border capitalize transition-all ${
                      difficulty === lvl
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                3. Número de preguntas
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none"
              >
                <option value={3}>3 preguntas (Rápido)</option>
                <option value={5}>5 preguntas (Estándar)</option>
                <option value={8}>8 preguntas (Intensivo)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              4. Temario a evaluar
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Results Summary if finished */}
          {quizFinished && activeQuiz && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-semibold uppercase">Resultado Final</span>
                  <div className="text-2xl font-bold font-mono-numbers text-slate-900 mt-0.5">
                    {activeQuiz.overallScore}% de Acierto
                  </div>
                </div>
                <button
                  onClick={onOpenErrorAnalysis}
                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-lg transition-colors"
                >
                  Analizar Errores y Reforzar
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 space-y-2">
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
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando examen con IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Comenzar Examen ({examType.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Active Quiz Question Runner */
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header indicator */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 font-mono-numbers">
                Pregunta {currentQIndex + 1} de {activeQuiz.questions.length}
              </span>
              <span>·</span>
              <span className="uppercase text-[11px] font-semibold text-blue-700">
                {activeQuiz.examType}
              </span>
              <span>·</span>
              <span className="capitalize text-[11px] text-slate-600">
                {activeQuiz.difficulty}
              </span>
            </div>
            <button
              onClick={() => setActiveQuiz(null)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>

          {/* Question Prompt */}
          <div>
            <h4 className="text-base font-semibold text-slate-900 leading-snug">
              {activeQuiz.questions[currentQIndex].prompt}
            </h4>
          </div>

          {/* Format: TEST */}
          {activeQuiz.examType === 'test' && (
            <div className="space-y-2.5">
              {activeQuiz.questions[currentQIndex].options?.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === activeQuiz.questions[currentQIndex].correctOptionIndex;

                let btnStyle = 'border-slate-200 bg-white hover:border-slate-300 text-slate-800';
                if (isAnswerRevealed) {
                  if (isCorrect) {
                    btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                  } else if (isSelected && !isCorrect) {
                    btnStyle = 'border-rose-500 bg-rose-50 text-rose-900 line-through';
                  } else {
                    btnStyle = 'border-slate-100 bg-slate-50 text-slate-400';
                  }
                } else if (isSelected) {
                  btnStyle = 'border-blue-600 bg-blue-50 text-blue-900 font-semibold';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => !isAnswerRevealed && setSelectedOption(idx)}
                    className={`w-full p-3.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between gap-3 ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswerRevealed && isCorrect && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    {isAnswerRevealed && isSelected && !isCorrect && (
                      <X className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Format: ORAL & DESARROLLO */}
          {(activeQuiz.examType === 'oral' || activeQuiz.examType === 'desarrollo') && (
            <div className="space-y-3">
              <textarea
                value={writtenAnswer}
                onChange={(e) => setWrittenAnswer(e.target.value)}
                placeholder={
                  activeQuiz.examType === 'oral'
                    ? 'Escribe o simula aquí tu discurso oral...'
                    : 'Desarrolla tu respuesta en profundidad respondiendo a todos los apartados...'
                }
                rows={5}
                disabled={isAnswerRevealed}
                className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans leading-relaxed"
              />
            </div>
          )}

          {/* Revealed Explanation & Key Points */}
          {isAnswerRevealed && (() => {
            const currentQ = activeQuiz.questions[currentQIndex];
            const isUserWrong =
              activeQuiz.examType === 'test' &&
              selectedOption !== null &&
              selectedOption !== currentQ.correctOptionIndex;
            const selectedWrongFeedback =
              selectedOption !== null &&
              currentQ.optionExplanations &&
              currentQ.optionExplanations[selectedOption]
                ? currentQ.optionExplanations[selectedOption]
                : null;

            return (
              <div className="space-y-3">
                {isUserWrong && selectedOption !== null && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Por qué tu respuesta es incorrecta:</span>
                    </div>
                    <p className="text-rose-950 leading-relaxed">
                      {selectedWrongFeedback || currentQ.explanation}
                    </p>
                  </div>
                )}

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-slate-900">Explicación Razonada:</div>
                  <p className="text-slate-700 leading-relaxed">
                    {currentQ.explanation}
                  </p>

                  {currentQ.optionExplanations && currentQ.optionExplanations.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <span className="font-semibold text-slate-800 block">
                        Retroalimentación por opción:
                      </span>
                      {currentQ.options?.map((_, optIdx) => {
                        const exp = currentQ.optionExplanations?.[optIdx];
                        if (!exp) return null;
                        const isCorrectOpt = optIdx === currentQ.correctOptionIndex;
                        return (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-lg border text-[11px] ${
                              isCorrectOpt
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <strong className="mr-1">
                              Opción {String.fromCharCode(65 + optIdx)}:
                            </strong>
                            <span>{exp}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {currentQ.keyPoints && currentQ.keyPoints.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="font-semibold text-slate-800">Puntos Clave Obligatorios:</span>
                      <ul className="mt-1 list-disc list-inside space-y-0.5 text-slate-600">
                        {currentQ.keyPoints.map((kp, i) => (
                          <li key={i}>{kp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Action buttons */}
          <div className="flex justify-end pt-2">
            {!isAnswerRevealed ? (
              <button
                onClick={handleConfirmAnswer}
                disabled={activeQuiz.examType === 'test' && selectedOption === null}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                Comprobar Respuesta
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <span>
                  {currentQIndex < activeQuiz.questions.length - 1 ? 'Siguiente Pregunta' : 'Ver Resultados'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
