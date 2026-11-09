import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Layers,
  FileText,
  RotateCw,
  CheckCircle2,
  Check,
  Plus,
  ArrowRight,
  Loader2,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Subject, CornellNote, Flashcard } from '../types';

interface GeneratedCornellCard {
  term: string;
  definition: string;
  practicalCase: string;
  hint: string;
  conceptTag: string;
  selected: boolean;
}

interface CornellFlashcardExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectId?: string;
  initialNoteId?: string;
  onSaveFlashcards: (subjectId: string, flashcards: Flashcard[]) => void;
}

export const CornellFlashcardExtractorModal: React.FC<CornellFlashcardExtractorModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubjectId,
  initialNoteId,
  onSaveFlashcards,
}) => {
  // Selection states
  const [selectedSubId, setSelectedSubId] = useState<string>(
    initialSubjectId || (subjects[0] ? subjects[0].id : '')
  );
  const currentSubject = subjects.find((s) => s.id === selectedSubId) || subjects[0];
  const notesList = currentSubject?.cornellNotes || [];

  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    initialNoteId || (notesList[0] ? notesList[0].id : '')
  );
  const currentNote: CornellNote | undefined = notesList.find((n) => n.id === selectedNoteId) || notesList[0];

  // Options
  const [targetCount, setTargetCount] = useState<number>(6);

  // Workflow states
  const [step, setStep] = useState<'configure' | 'terms' | 'preview' | 'completed'>('configure');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractedTerms, setExtractedTerms] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [newCustomTerm, setNewCustomTerm] = useState<string>('');
  const [generatedCards, setGeneratedCards] = useState<GeneratedCornellCard[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Extract terms and preliminary cards
  const handleExtractFromCornell = async () => {
    if (!currentNote && (!currentSubject.topics || currentSubject.topics.length === 0)) {
      setErrorMessage('Selecciona unos apuntes Cornell válidos para continuar.');
      return;
    }

    setIsExtracting(true);
    setErrorMessage(null);

    const topicTitle = currentNote?.title || 'Tema de Apuntes';
    const notesContent = currentNote?.notes || '';
    const cues = currentNote?.cues || [];
    const summary = currentNote?.summary || '';

    try {
      const response = await fetch('/api/gemini/extract-cornell-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: currentSubject?.name || 'General',
          topicTitle,
          notesContent,
          cues,
          summary,
          selectedTerms: selectedTerms.length > 0 ? selectedTerms : undefined,
          count: targetCount,
        }),
      });

      const resData = await response.json();
      if (!resData.success || !resData.data) {
        throw new Error(resData.error || 'No se pudieron extraer términos de las notas.');
      }

      const terms: string[] = resData.data.extractedTerms || [];
      const cards: any[] = resData.data.flashcards || [];

      setExtractedTerms(terms);
      setSelectedTerms(terms);

      const formattedCards: GeneratedCornellCard[] = cards.map((c) => ({
        term: c.term || 'Concepto',
        definition: c.definition || '',
        practicalCase: c.practicalCase || '',
        hint: c.hint || '',
        conceptTag: c.conceptTag || 'Concepto Clave',
        selected: true,
      }));

      setGeneratedCards(formattedCards);
      setPreviewIndex(0);
      setIsFlipped(false);
      setStep('terms');
    } catch (err: any) {
      console.error('Error al extraer términos Cornell:', err);
      setErrorMessage(err.message || 'Error de conexión al procesar los apuntes con Gemini.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Toggle term selection
  const handleToggleTerm = (term: string) => {
    if (selectedTerms.includes(term)) {
      setSelectedTerms(selectedTerms.filter((t) => t !== term));
    } else {
      setSelectedTerms([...selectedTerms, term]);
    }
  };

  // Add custom term
  const handleAddCustomTerm = () => {
    if (!newCustomTerm.trim()) return;
    const termClean = newCustomTerm.trim();
    if (!extractedTerms.includes(termClean)) {
      setExtractedTerms([...extractedTerms, termClean]);
    }
    if (!selectedTerms.includes(termClean)) {
      setSelectedTerms([...selectedTerms, termClean]);
    }
    setNewCustomTerm('');
  };

  // Save selected flashcards to subject
  const handleSaveToSubject = () => {
    const selectedToSave = generatedCards.filter((c) => c.selected);
    if (selectedToSave.length === 0) {
      setErrorMessage('Selecciona al menos una tarjeta para guardar.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const newFlashcards: Flashcard[] = selectedToSave.map((c, i) => {
      // Build composite answer combining exact definition and practical application
      const fullAnswer = `${c.definition}\n\n📌 Caso de aplicación práctica:\n${c.practicalCase}`;

      return {
        id: `fc-cornell-${Date.now()}-${i}`,
        topicId: currentNote?.topicId,
        question: c.term,
        answer: fullAnswer,
        hint: c.hint,
        conceptTag: c.conceptTag,
        interval: 1,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: todayStr,
      };
    });

    onSaveFlashcards(selectedSubId, newFlashcards);
    try {
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
    } catch (_) {}
    setStep('completed');
  };

  const currentPreviewCard = generatedCards[previewIndex];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Extraer Flashcards desde Apuntes Cornell
              </h3>
              <p className="text-xs text-slate-500">
                Active Recall con definiciones rigurosas y casos prácticos de aplicación
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: CONFIGURE & SELECT CORNELL NOTE */}
          {step === 'configure' && (
            <div className="space-y-5">
              {/* Subject & Note Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. Asignatura
                  </label>
                  <select
                    value={selectedSubId}
                    onChange={(e) => {
                      setSelectedSubId(e.target.value);
                      const sub = subjects.find((s) => s.id === e.target.value);
                      if (sub && sub.cornellNotes && sub.cornellNotes.length > 0) {
                        setSelectedNoteId(sub.cornellNotes[0].id);
                      } else {
                        setSelectedNoteId('');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-blue-500 cursor-pointer"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.cornellNotes?.length || 0} apuntes Cornell)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Nota de Método Cornell
                  </label>
                  {notesList.length === 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                      Esta materia no tiene apuntes Cornell guardados.
                    </div>
                  ) : (
                    <select
                      value={selectedNoteId}
                      onChange={(e) => setSelectedNoteId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-blue-500 cursor-pointer"
                    >
                      {notesList.map((note) => (
                        <option key={note.id} value={note.id}>
                          {note.title} ({note.cues?.length || 0} ideas clave)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Note Details Preview */}
              {currentNote && (
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 border-b border-slate-200/80 pb-2">
                    <span className="font-bold flex items-center gap-1.5 text-slate-800">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>{currentNote.title}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {currentNote.cues?.length || 0} ideas clave · {currentNote.summary ? 'Con resumen' : 'Sin resumen'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                    {/* Cues column */}
                    <div className="sm:col-span-5 bg-white p-3 rounded-xl border border-slate-100">
                      <span className="font-bold text-[11px] text-slate-600 uppercase tracking-wider block mb-1.5">
                        Ideas Clave & Cues
                      </span>
                      {currentNote.cues && currentNote.cues.length > 0 ? (
                        <ul className="space-y-1 text-slate-600 text-[11px]">
                          {currentNote.cues.slice(0, 3).map((cue, idx) => (
                            <li key={idx} className="line-clamp-1">
                              • {cue}
                            </li>
                          ))}
                          {currentNote.cues.length > 3 && (
                            <li className="text-slate-400 italic">
                              +{currentNote.cues.length - 3} preguntas más...
                            </li>
                          )}
                        </ul>
                      ) : (
                        <p className="text-slate-400 text-[11px] italic">Sin cues explícitos</p>
                      )}
                    </div>

                    {/* Notes preview */}
                    <div className="sm:col-span-7 bg-white p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                      <div>
                        <span className="font-bold text-[11px] text-slate-600 uppercase tracking-wider block mb-1">
                          Cuerpo de Notas
                        </span>
                        <p className="text-slate-600 text-[11px] line-clamp-3 leading-relaxed">
                          {currentNote.notes || 'Sin contenido detallado.'}
                        </p>
                      </div>
                      {currentNote.summary && (
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 line-clamp-1 italic">
                          Resumen: {currentNote.summary}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Target Count Option */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Número de Flashcards a generar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[4, 6, 8, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setTargetCount(num)}
                      className={`py-2 text-xs rounded-xl border font-bold transition-all cursor-pointer ${
                        targetCount === num
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {num} Tarjetas
                    </button>
                  ))}
                </div>
              </div>

              {/* Extraction Feature Highlights */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">
                  <strong className="font-semibold">Estructura Active Recall:</strong> La IA escaneará
                  el texto completo de tus apuntes Cornell para identificar los términos más importantes y
                  generar cada tarjeta con <span className="font-semibold text-blue-950">definición teórica rigurosa</span>, <span className="font-semibold text-blue-950">caso práctico de aplicación</span> y una <span className="font-semibold text-blue-950">pista mnemotécnica</span>.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW EXTRACTED TERMS */}
          {step === 'terms' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Términos Clave Detectados ({selectedTerms.length} seleccionados)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Marca los conceptos que quieres convertir en flashcards de estudio:
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTerms(extractedTerms)}
                    className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  >
                    Seleccionar todos
                  </button>
                </div>
              </div>

              {/* Term chips */}
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
                {extractedTerms.map((term, i) => {
                  const isSelected = selectedTerms.includes(term);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleToggleTerm(term)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{term}</span>
                    </button>
                  );
                })}
              </div>

              {/* Add custom term input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCustomTerm}
                  onChange={(e) => setNewCustomTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTerm();
                    }
                  }}
                  placeholder="Añadir otro término personalizado..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTerm}
                  className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  + Añadir
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW GENERATED FLASHCARDS */}
          {step === 'preview' && currentPreviewCard && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">
                    Tarjeta {previewIndex + 1} de {generatedCards.length}
                  </span>
                  <span className="text-slate-400 ml-2">
                    ({generatedCards.filter((c) => c.selected).length} seleccionadas para guardar)
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={currentPreviewCard.selected}
                    onChange={(e) => {
                      const updated = [...generatedCards];
                      updated[previewIndex].selected = e.target.checked;
                      setGeneratedCards(updated);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Incluir esta tarjeta</span>
                </label>
              </div>

              {/* Flip Flashcard */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className={`relative min-h-[260px] p-6 rounded-3xl border transition-all duration-300 cursor-pointer shadow-sm flex flex-col justify-between ${
                  isFlipped
                    ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border-slate-700'
                    : 'bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/40 text-slate-900 border-blue-200/80 hover:border-blue-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-4 opacity-75">
                    <span className="px-2 py-0.5 rounded bg-white/20 text-[10px]">
                      {currentPreviewCard.conceptTag}
                    </span>
                    <span className="flex items-center gap-1">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>{isFlipped ? 'Volver a término' : 'Click para ver definición'}</span>
                    </span>
                  </div>

                  {!isFlipped ? (
                    /* Anverso: Concepto / Término clave */
                    <div className="py-8 text-center space-y-2">
                      <span className="text-xs text-blue-600 font-bold uppercase tracking-wider block">
                        Concepto / Término Clave
                      </span>
                      <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
                        {currentPreviewCard.term}
                      </h3>
                      {currentPreviewCard.hint && (
                        <p className="text-xs text-slate-500 italic mt-3 inline-flex items-center gap-1.5 bg-slate-100/70 px-3 py-1 rounded-full">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                          <span>Pista: {currentPreviewCard.hint}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Reverso: Definición precisa + Caso de aplicación */
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div>
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                          Definición Precisa
                        </span>
                        <p className="text-sm text-slate-100 leading-relaxed">
                          {currentPreviewCard.definition}
                        </p>
                      </div>

                      {currentPreviewCard.practicalCase && (
                        <div className="pt-2 border-t border-slate-700/60">
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                            Caso de Aplicación Práctica
                          </span>
                          <p className="text-xs text-slate-200 leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/10">
                            {currentPreviewCard.practicalCase}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-center text-[11px] opacity-60 pt-2 border-t border-current/10">
                  {isFlipped ? 'Reverso (Definición y Caso)' : 'Anverso (Concepto Clave)'}
                </div>
              </div>

              {/* Card Switcher navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={previewIndex === 0}
                  onClick={() => {
                    setPreviewIndex(previewIndex - 1);
                    setIsFlipped(false);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
                >
                  ← Anterior
                </button>

                <div className="flex items-center gap-1">
                  {generatedCards.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPreviewIndex(i);
                        setIsFlipped(false);
                      }}
                      className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                        previewIndex === i ? 'w-5 bg-blue-600' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={previewIndex === generatedCards.length - 1}
                  onClick={() => {
                    setPreviewIndex(previewIndex + 1);
                    setIsFlipped(false);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETED */}
          {step === 'completed' && (
            <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900">
                  ¡Flashcards Guardadas con Éxito!
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
                  Se han extraído e incorporado las tarjetas con definición y casos de aplicación a la materia{' '}
                  <strong className="text-slate-900">{currentSubject.name}</strong>. Ya están disponibles en tu mazo de Active Recall con repetición espaciada.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          {step === 'configure' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isExtracting || !currentNote}
                onClick={handleExtractFromCornell}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analizando apuntes con Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Extraer Términos y Generar</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'terms' && (
            <>
              <button
                type="button"
                onClick={() => setStep('configure')}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer font-medium"
              >
                ← Cambiar Apuntes
              </button>
              <button
                type="button"
                onClick={() => setStep('preview')}
                disabled={selectedTerms.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <span>Revisar {generatedCards.length} Flashcards</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('terms')}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer font-medium"
              >
                ← Volver a Términos
              </button>
              <button
                type="button"
                onClick={handleSaveToSubject}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  Guardar {generatedCards.filter((c) => c.selected).length} Flashcards en {currentSubject.name}
                </span>
              </button>
            </>
          )}

          {step === 'completed' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Entendido y Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
