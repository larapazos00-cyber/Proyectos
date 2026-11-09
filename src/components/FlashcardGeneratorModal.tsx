import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  FileText,
  BookOpen,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { Subject, Topic, CornellNote, Flashcard } from '../types';

interface FlashcardGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  initialTopicId?: string;
  initialNoteId?: string;
  onAddFlashcards: (newCards: Flashcard[]) => void;
}

export const FlashcardGeneratorModal: React.FC<FlashcardGeneratorModalProps> = ({
  isOpen,
  onClose,
  subject,
  initialTopicId,
  initialNoteId,
  onAddFlashcards,
}) => {
  // Source selection: from notes or from topics
  const [sourceType, setSourceType] = useState<'notes' | 'topics'>(
    initialNoteId ? 'notes' : initialTopicId ? 'topics' : 'notes'
  );

  // Selected Note (if source is notes)
  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    initialNoteId || (subject.cornellNotes.length > 0 ? subject.cornellNotes[0].id : '')
  );

  // Selected Topics (if source is topics)
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(
    initialTopicId ? [initialTopicId] : subject.topics.length > 0 ? [subject.topics[0].id] : []
  );

  // Configuration
  const [count, setCount] = useState<number>(6);
  const [difficulty, setDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('intermedio');
  const [focusArea, setFocusArea] = useState<'general' | 'definitions' | 'deep_concepts' | 'practical'>('general');
  const [customInstructions, setCustomInstructions] = useState<string>('');

  // Generation & Results
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCards, setGeneratedCards] = useState<Array<Flashcard & { selected: boolean }>>([]);

  if (!isOpen) return null;

  // Check all / uncheck all
  const toggleAllTopics = () => {
    if (selectedTopicIds.length === subject.topics.length) {
      setSelectedTopicIds([]);
    } else {
      setSelectedTopicIds(subject.topics.map((t) => t.id));
    }
  };

  const handleToggleTopic = (topicId: string) => {
    if (selectedTopicIds.includes(topicId)) {
      setSelectedTopicIds(selectedTopicIds.filter((id) => id !== topicId));
    } else {
      setSelectedTopicIds([...selectedTopicIds, topicId]);
    }
  };

  // Generate Flashcards
  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);

    try {
      let topicTitle = subject.name;
      let notesContent = '';
      let topicContent = '';
      let cues: string[] = [];
      let summary = '';
      let linkedTopicId: string | undefined = undefined;

      if (sourceType === 'notes') {
        const note = subject.cornellNotes.find((n) => n.id === selectedNoteId);
        if (!note) {
          throw new Error('Selecciona un apunte válido para generar flashcards.');
        }
        topicTitle = `${subject.name} - ${note.title}`;
        notesContent = note.notes;
        cues = note.cues || [];
        summary = note.summary || '';
        linkedTopicId = note.topicId;
      } else {
        if (selectedTopicIds.length === 0) {
          throw new Error('Por favor selecciona al menos un tema.');
        }
        const topics = subject.topics.filter((t) => selectedTopicIds.includes(t.id));
        topicTitle = `${subject.name}: ${topics.map((t) => t.title).join(', ')}`;
        
        // Combine topic notes, descriptions, and cues
        topicContent = topics
          .map((t) => {
            const parts = [`Tema: ${t.title}`];
            if (t.description) parts.push(`Descripción: ${t.description}`);
            if (t.subtopics?.length) parts.push(`Subtemas: ${t.subtopics.join(', ')}`);
            if (t.notes) parts.push(`Apuntes del tema:\n${t.notes}`);
            if (t.summary) parts.push(`Resumen:\n${t.summary}`);
            return parts.join('\n');
          })
          .join('\n\n---\n\n');

        // Gather all cues
        cues = topics.flatMap((t) => t.cues || []);
        linkedTopicId = selectedTopicIds.length === 1 ? selectedTopicIds[0] : undefined;
      }

      const response = await fetch('/api/gemini/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle,
          topicContent,
          notesContent,
          cues,
          summary,
          count,
          difficulty,
          focusArea,
          customInstructions,
        }),
      });

      const resData = await response.json();
      if (resData.success && Array.isArray(resData.data)) {
        const todayStr = new Date().toISOString().split('T')[0];
        const cardsWithSelection = resData.data.map((item: any, i: number) => ({
          id: `fc-${Date.now()}-${i}`,
          topicId: linkedTopicId,
          question: item.question,
          answer: item.answer,
          hint: item.hint,
          conceptTag: item.conceptTag || subject.name,
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          nextReview: todayStr,
          selected: true,
        }));

        setGeneratedCards(cardsWithSelection);
      } else {
        throw new Error(resData.error || 'No se pudieron generar las flashcards.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al comunicarse con la IA de Gemini.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle card selection in preview
  const handleToggleCardSelected = (id: string) => {
    setGeneratedCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  // Save selected flashcards to deck
  const handleSaveToDeck = () => {
    const selected = generatedCards.filter((c) => c.selected);
    if (selected.length === 0) {
      setError('Por favor selecciona al menos una tarjeta para añadir al mazo.');
      return;
    }

    const cardsToAdd: Flashcard[] = selected.map(({ selected: _, ...card }) => card);
    onAddFlashcards(cardsToAdd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Generador de Flashcards con IA · Active Recall
              </h3>
              <p className="text-xs text-slate-500">
                Crea tarjetas de recuperación activa optimizadas para retención a largo plazo en {subject.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* If cards already generated, show interactive review */}
          {generatedCards.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Flashcards Generadas ({generatedCards.filter((c) => c.selected).length} de {generatedCards.length} seleccionadas)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Revisa las tarjetas creadas por Gemini. Puedes desmarcar las que no desees antes de guardarlas.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGeneratedCards([])}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1"
                  >
                    ← Modificar parámetros
                  </button>
                </div>
              </div>

              {/* Cards List */}
              <div className="space-y-3">
                {generatedCards.map((card, idx) => (
                  <div
                    key={card.id}
                    onClick={() => handleToggleCardSelected(card.id)}
                    className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                      card.selected
                        ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50/50 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={card.selected}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 font-mono-numbers">
                          Tarjeta #{idx + 1}
                        </span>
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {card.conceptTag}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Pregunta de Recuperación Activa:
                        </span>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5 leading-relaxed">
                          {card.question}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Respuesta Concisa:
                        </span>
                        <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                          {card.answer}
                        </p>
                      </div>

                      {card.hint && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50/70 px-2.5 py-1 rounded-md">
                          <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                          <span>Pista mnemotécnica: {card.hint}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGeneratedCards([])}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Volver a Generar
                </button>

                <button
                  type="button"
                  onClick={handleSaveToDeck}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Añadir {generatedCards.filter((c) => c.selected).length} Flashcards al Mazo
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Parameter Configuration Form */
            <div className="space-y-5">
              {/* Source Selector Tab */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  1. Fuente de Contenido para las Flashcards
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSourceType('notes')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      sourceType === 'notes'
                        ? 'border-blue-600 bg-blue-50/60 text-blue-950 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        sourceType === 'notes' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">A partir de los Apuntes</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Utiliza tus notas redactadas, OCR o método Cornell ({subject.cornellNotes.length} disponibles)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceType('topics')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      sourceType === 'topics'
                        ? 'border-blue-600 bg-blue-50/60 text-blue-950 shadow-2xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        sourceType === 'topics' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">A partir del Temario</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Selecciona uno o varios temas oficiales de la materia ({subject.topics.length} temas)
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub-view: Notes Picker */}
              {sourceType === 'notes' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Selecciona el apunte de estudio:
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono-numbers">
                      {subject.cornellNotes.length} apuntes guardados
                    </span>
                  </div>

                  {subject.cornellNotes.length === 0 ? (
                    <div className="p-4 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-500">
                      No tienes apuntes creados en esta materia todavía. Puedes cambiar a "A partir del Temario" o redactar apuntes en la pestaña Apuntes.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {subject.cornellNotes.map((note) => {
                        const isSelected = selectedNoteId === note.id;
                        return (
                          <div
                            key={note.id}
                            onClick={() => setSelectedNoteId(note.id)}
                            className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-white shadow-2xs ring-1 ring-blue-500/20'
                                : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{note.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono-numbers">
                                {note.updatedAt ? note.updatedAt.split('T')[0] : note.createdAt?.split('T')[0]}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                              {note.summary || note.notes}
                            </div>
                            {note.cues && note.cues.length > 0 && (
                              <div className="text-[10px] text-blue-700 font-medium mt-1">
                                ✓ Incluye {note.cues.length} preguntas detonadoras para Active Recall
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-view: Topics Multi-Select */}
              {sourceType === 'topics' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Temas a incluir en el mazo ({selectedTopicIds.length} seleccionados):
                    </span>
                    <button
                      type="button"
                      onClick={toggleAllTopics}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      {selectedTopicIds.length === subject.topics.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {subject.topics.map((t, idx) => {
                      const isSelected = selectedTopicIds.includes(t.id);
                      return (
                        <div
                          key={t.id}
                          onClick={() => handleToggleTopic(t.id)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-blue-500 bg-white shadow-2xs'
                              : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="font-semibold text-slate-800">
                              Tema {idx + 1}: {t.title}
                            </span>
                          </div>
                          {t.notes && (
                            <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                              Con apuntes
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Configuration options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cantidad de Tarjetas
                  </label>
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono-numbers"
                  >
                    <option value={4}>4 flashcards (Rápido)</option>
                    <option value={6}>6 flashcards (Recomendado)</option>
                    <option value={10}>10 flashcards (Profundo)</option>
                    <option value={15}>15 flashcards (Examen Completo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dificultad
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="basico">Básico (Repaso inicial)</option>
                    <option value="intermedio">Intermedio (Comprensión)</option>
                    <option value="avanzado">Avanzado (Dominio experto)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enfoque de Active Recall
                  </label>
                  <select
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general">Equilibrado (Conceptos y Aplicación)</option>
                    <option value="definitions">Definiciones y Términos Clave</option>
                    <option value="deep_concepts">Preguntas Conceptuales Profundas</option>
                    <option value="practical">Casos Prácticos y Fórmulas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Instrucciones o énfasis adicional para Gemini (opcional)
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Ej: Incidir en las excepciones, comparativas entre modelos o mnemotecnias..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    (sourceType === 'notes' && !selectedNoteId) ||
                    (sourceType === 'topics' && selectedTopicIds.length === 0)
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando flashcards con Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generar Flashcards con IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
