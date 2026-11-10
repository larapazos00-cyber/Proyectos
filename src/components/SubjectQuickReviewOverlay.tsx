import React, { useState, useMemo } from 'react';
import {
  X,
  Zap,
  Sparkles,
  BookOpen,
  HelpCircle,
  CheckCircle2,
  Search,
  Eye,
  EyeOff,
  Clock,
  ArrowRight,
  Layers,
  FileText,
  Brain,
} from 'lucide-react';
import { Subject, EditableKeyPoint } from '../types';

interface SubjectQuickReviewOverlayProps {
  subject: Subject | null;
  isOpen: boolean;
  onClose: () => void;
  onStartPomodoro?: (subjectId: string, topicId?: string) => void;
  onOpenSubjectDetail?: (subjectId: string) => void;
  onOpenQuizzes?: (subjectId: string, topicIds?: string[]) => void;
}

interface ExtractedCornellCueItem {
  id: string;
  question: string;
  answerHint: string;
  topicId?: string;
  topicTitle: string;
  sourceLabel: string;
}

interface ExtractedCornellSummaryItem {
  id: string;
  topicId?: string;
  topicTitle: string;
  summaryText: string;
  sourceLabel: string;
}

interface ExtractedKeyConceptItem {
  id: string;
  title: string;
  detail: string;
  importance: 'alta' | 'media' | 'baja';
  topicId?: string;
  topicTitle: string;
  category?: string;
}

export const SubjectQuickReviewOverlay: React.FC<SubjectQuickReviewOverlayProps> = ({
  subject,
  isOpen,
  onClose,
  onStartPomodoro,
  onOpenSubjectDetail,
  onOpenQuizzes,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'express' | 'cues' | 'keypoints'>('express');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [revealedCueIds, setRevealedCueIds] = useState<Record<string, boolean>>({});
  const [revealAllCues, setRevealAllCues] = useState<boolean>(false);

  // Consolidar todos los puntos clave, preguntas detonadoras (cues) y resúmenes de los apuntes Cornell de la materia
  const extractedData = useMemo(() => {
    if (!subject) {
      return {
        cues: [] as ExtractedCornellCueItem[],
        summaries: [] as ExtractedCornellSummaryItem[],
        keyConcepts: [] as ExtractedKeyConceptItem[],
      };
    }

    const cues: ExtractedCornellCueItem[] = [];
    const summaries: ExtractedCornellSummaryItem[] = [];
    const keyConcepts: ExtractedKeyConceptItem[] = [];
    const seenConceptTitles = new Set<string>();
    const seenCueQuestions = new Set<string>();

    const topicMap = new Map<string, string>();
    (subject.topics || []).forEach((t) => topicMap.set(t.id, t.title));

    // 1. Extraer de subject.cornellNotes explícitos
    (subject.cornellNotes || []).forEach((note) => {
      const topicTitle = (note.topicId && topicMap.get(note.topicId)) || note.title || 'General';

      if (note.summary && note.summary.trim()) {
        summaries.push({
          id: `cn-sum-${note.id}`,
          topicId: note.topicId,
          topicTitle,
          summaryText: note.summary.trim(),
          sourceLabel: `Ficha Cornell: ${note.title}`,
        });
      }

      const noteParagraphs = (note.notes || '')
        .split(/\n+/)
        .map((p) => p.replace(/^[#*\->\s]+/, '').trim())
        .filter((p) => p.length > 15);

      (note.cues || []).forEach((cue, idx) => {
        const cleanCue = cue.trim();
        if (!cleanCue || seenCueQuestions.has(cleanCue.toLowerCase())) return;
        seenCueQuestions.add(cleanCue.toLowerCase());

        cues.push({
          id: `cn-cue-${note.id}-${idx}`,
          question: cleanCue,
          answerHint:
            noteParagraphs[idx] ||
            note.summary ||
            noteParagraphs[0] ||
            'Revisa el bloque central de tus apuntes Cornell para verificar los detalles.',
          topicId: note.topicId,
          topicTitle,
          sourceLabel: 'Apuntes Cornell',
        });
      });

      (note.keyPoints || []).forEach((kp: EditableKeyPoint, idx: number) => {
        const key = kp.title.trim().toLowerCase();
        if (!key || seenConceptTitles.has(key)) return;
        seenConceptTitles.add(key);

        keyConcepts.push({
          id: `cn-kp-${note.id}-${idx}`,
          title: kp.title,
          detail: kp.detail,
          importance: kp.importance || 'alta',
          topicId: note.topicId,
          topicTitle,
          category: kp.category || 'Concepto Cornell',
        });
      });
    });

    // 2. Extraer de cada Tema (campos Cornell del tema + documentos adjuntos)
    (subject.topics || []).forEach((topic) => {
      if (topic.summary && topic.summary.trim()) {
        summaries.push({
          id: `top-sum-${topic.id}`,
          topicId: topic.id,
          topicTitle: topic.title,
          summaryText: topic.summary.trim(),
          sourceLabel: 'Resumen Cornell del Tema',
        });
      } else if (topic.description && topic.description.trim()) {
        summaries.push({
          id: `top-desc-${topic.id}`,
          topicId: topic.id,
          topicTitle: topic.title,
          summaryText: topic.description.trim(),
          sourceLabel: 'Síntesis del Tema',
        });
      }

      // KeyPoints guardados en el tema
      (topic.keyPoints || []).forEach((kp, idx) => {
        const key = kp.title.trim().toLowerCase();
        if (!key || seenConceptTitles.has(key)) return;
        seenConceptTitles.add(key);

        keyConcepts.push({
          id: `top-kp-${topic.id}-${idx}`,
          title: kp.title,
          detail: kp.detail,
          importance: kp.importance || 'alta',
          topicId: topic.id,
          topicTitle: topic.title,
          category: kp.category || topic.category || 'Punto Clave',
        });
      });

      // Cues guardados en el tema
      (topic.cues || []).forEach((cue, idx) => {
        const cleanCue = cue.trim();
        if (!cleanCue || seenCueQuestions.has(cleanCue.toLowerCase())) return;
        seenCueQuestions.add(cleanCue.toLowerCase());

        cues.push({
          id: `top-cue-${topic.id}-${idx}`,
          question: cleanCue,
          answerHint:
            topic.summary ||
            topic.description ||
            (topic.subtopics && topic.subtopics[idx]) ||
            'Concepto esencial del tema.',
          topicId: topic.id,
          topicTitle: topic.title,
          sourceLabel: 'Columna Cues Cornell',
        });
      });

      // Documentos importados dentro del tema
      (topic.attachedFiles || []).forEach((doc) => {
        if (doc.summary && doc.summary.trim()) {
          summaries.push({
            id: `doc-sum-${doc.id}`,
            topicId: topic.id,
            topicTitle: topic.title,
            summaryText: doc.summary.trim(),
            sourceLabel: `Documento: ${doc.name}`,
          });
        }
        (doc.keyPoints || []).forEach((kp, idx) => {
          const key = kp.title.trim().toLowerCase();
          if (!key || seenConceptTitles.has(key)) return;
          seenConceptTitles.add(key);

          keyConcepts.push({
            id: `doc-kp-${doc.id}-${idx}`,
            title: kp.title,
            detail: kp.detail,
            importance: kp.importance || 'alta',
            topicId: topic.id,
            topicTitle: topic.title,
            category: kp.category || doc.name,
          });
        });
        (doc.cues || []).forEach((cue, idx) => {
          const cleanCue = cue.trim();
          if (!cleanCue || seenCueQuestions.has(cleanCue.toLowerCase())) return;
          seenCueQuestions.add(cleanCue.toLowerCase());

          cues.push({
            id: `doc-cue-${doc.id}-${idx}`,
            question: cleanCue,
            answerHint: doc.summary || topic.description || 'Extraído del documento adjunto.',
            topicId: topic.id,
            topicTitle: topic.title,
            sourceLabel: doc.name,
          });
        });
      });

      // Subtemas y conceptos clave de respaldo para que todos los temas tengan puntos accionables de revisión rápida
      (topic.subtopics || []).forEach((subStr, idx) => {
        const cleanSub = subStr.trim();
        if (!cleanSub) return;
        const lower = cleanSub.toLowerCase();
        if (!seenConceptTitles.has(lower)) {
          seenConceptTitles.add(lower);
          keyConcepts.push({
            id: `sub-kp-${topic.id}-${idx}`,
            title: cleanSub,
            detail:
              topic.summary ||
              topic.description ||
              `Concepto nuclear perteneciente al bloque «${topic.title}» (${subject.name}).`,
            importance: topic.difficulty === 'Alta' ? 'alta' : idx === 0 ? 'alta' : 'media',
            topicId: topic.id,
            topicTitle: topic.title,
            category: `Dificultad ${topic.difficulty}`,
          });
        }

        const generatedQuestion = `¿Cuáles son los fundamentos y puntos clave de «${cleanSub}»?`;
        if (!seenCueQuestions.has(generatedQuestion.toLowerCase())) {
          seenCueQuestions.add(generatedQuestion.toLowerCase());
          cues.push({
            id: `sub-cue-${topic.id}-${idx}`,
            question: generatedQuestion,
            answerHint:
              topic.summary ||
              topic.notes ||
              topic.generalNotes ||
              topic.description ||
              `Subtema clave de ${topic.title}. Repasa su definición, estructura y aplicación en examen.`,
            topicId: topic.id,
            topicTitle: topic.title,
            sourceLabel: 'Síntesis Cornell',
          });
        }
      });
    });

    // 3. Incorporar también conceptos de Flashcards si existen
    (subject.flashcards || []).forEach((fc, idx) => {
      const title = (fc.concept || fc.conceptTag || fc.question).trim();
      const lower = title.toLowerCase();
      const topicTitle = (fc.topicId && topicMap.get(fc.topicId)) || 'Concepto de Examen';

      if (title && !seenConceptTitles.has(lower)) {
        seenConceptTitles.add(lower);
        keyConcepts.push({
          id: `fc-kp-${fc.id || idx}`,
          title,
          detail: fc.definition || fc.answer,
          importance: 'alta',
          topicId: fc.topicId,
          topicTitle,
          category: fc.conceptTag || 'Flashcard Clave',
        });
      }
    });

    return { cues, summaries, keyConcepts };
  }, [subject]);

  if (!isOpen || !subject) return null;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSummaries = extractedData.summaries.filter((item) => {
    if (selectedTopicId !== 'all' && item.topicId !== selectedTopicId) return false;
    if (!normalizedQuery) return true;
    return (
      item.topicTitle.toLowerCase().includes(normalizedQuery) ||
      item.summaryText.toLowerCase().includes(normalizedQuery)
    );
  });

  const filteredKeyConcepts = extractedData.keyConcepts.filter((item) => {
    if (selectedTopicId !== 'all' && item.topicId !== selectedTopicId) return false;
    if (!normalizedQuery) return true;
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.detail.toLowerCase().includes(normalizedQuery) ||
      item.topicTitle.toLowerCase().includes(normalizedQuery)
    );
  });

  const filteredCues = extractedData.cues.filter((item) => {
    if (selectedTopicId !== 'all' && item.topicId !== selectedTopicId) return false;
    if (!normalizedQuery) return true;
    return (
      item.question.toLowerCase().includes(normalizedQuery) ||
      item.answerHint.toLowerCase().includes(normalizedQuery) ||
      item.topicTitle.toLowerCase().includes(normalizedQuery)
    );
  });

  const toggleCueReveal = (id: string) => {
    setRevealedCueIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con el color de la asignatura */}
        <div
          className="px-6 py-4 text-white flex items-center justify-between gap-4"
          style={{
            background: `linear-gradient(135deg, ${subject.color || '#2563eb'}, #4f46e5)`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-xs shrink-0">
              <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-mono font-bold uppercase tracking-wider">
                  {subject.code || 'MATERIA'} · Revisión Rápida Pre-Examen
                </span>
                <span className="text-[11px] text-white/90 font-semibold">
                  {filteredKeyConcepts.length} conceptos · {filteredCues.length} preguntas Cornell
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-extrabold tracking-tight truncate mt-0.5">
                {subject.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer shrink-0"
            title="Cerrar Revisión Rápida"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de herramientas: Pestañas + Buscador + Filtro por tema */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Selector de modo de repaso veloz */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('express')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'express'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Hoja Express</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('keypoints')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'keypoints'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Puntos Clave ({filteredKeyConcepts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cues')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'cues'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Preguntas Cornell ({filteredCues.length})</span>
              </button>
            </div>

            {/* Buscador instantáneo */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar concepto, fórmula o pregunta..."
                className="w-full h-8 pl-8 pr-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtro horizontal de temas */}
          {subject.topics && subject.topics.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedTopicId('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                  selectedTopicId === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                Todos los temas ({subject.topics.length})
              </button>
              {subject.topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTopicId(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer truncate max-w-[200px] ${
                    selectedTopicId === t.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cuerpo principal desplazable */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* VISTA 1: HOJA EXPRESS (TODO EN UN VISTAZO) */}
          {activeTab === 'express' && (
            <div className="space-y-5">
              {/* Resúmenes Ejecutivos Cornell */}
              {filteredSummaries.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Síntesis y Resúmenes Ejecutivos Cornell ({filteredSummaries.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredSummaries.map((sum) => (
                      <div
                        key={sum.id}
                        className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-800/60 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200 truncate">
                            {sum.topicTitle}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 shrink-0">
                            {sum.sourceLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {sum.summaryText}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conceptos y Puntos Clave de Alta Prioridad */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Conceptos Clave para Examen ({filteredKeyConcepts.length})</span>
                  </h3>
                  {filteredKeyConcepts.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('keypoints')}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Ver todos ({filteredKeyConcepts.length}) →
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredKeyConcepts.slice(0, 9).map((kc) => (
                    <div
                      key={kc.id}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              kc.importance === 'alta'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                            }`}
                          >
                            {kc.importance === 'alta' ? '🔥 Esencial' : '📌 Clave'}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {kc.topicTitle}
                          </span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {kc.title}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed line-clamp-3">
                          {kc.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preguntas Detonadoras (Columna Cues Cornell) */}
              {filteredCues.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Preguntas Detonadoras Cornell · Active Recall</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setRevealAllCues(!revealAllCues)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
                    >
                      {revealAllCues ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Ocultar respuestas</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Mostrar todas las respuestas</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {filteredCues.slice(0, 6).map((cue) => {
                      const isRevealed = revealAllCues || Boolean(revealedCueIds[cue.id]);
                      return (
                        <div
                          key={cue.id}
                          onClick={() => toggleCueReveal(cue.id)}
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 hover:border-amber-400 transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[11px] font-black flex items-center justify-center shrink-0">
                                ?
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {cue.question}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                              {isRevealed ? 'Ocultar' : 'Ver respuesta'}
                            </span>
                          </div>
                          {isRevealed && (
                            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 pl-7">
                              {cue.answerHint}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: TODOS LOS PUNTOS CLAVE Y CONCEPTOS */}
          {activeTab === 'keypoints' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredKeyConcepts.map((kc) => (
                <div
                  key={kc.id}
                  className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                        kc.importance === 'alta'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                      }`}
                    >
                      Prioridad {kc.importance}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 truncate">
                      {kc.topicTitle}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {kc.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {kc.detail}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* VISTA 3: AUTOEVALUACIÓN RÁPIDA DE PREGUNTAS DETONADORAS CORNELL */}
          {activeTab === 'cues' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Intenta responder mentalmente cada pregunta detonadora de la columna izquierda de Cornell y haz clic para comprobar.
                </p>
                <button
                  type="button"
                  onClick={() => setRevealAllCues(!revealAllCues)}
                  className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                >
                  {revealAllCues ? 'Ocultar todas' : 'Revelar todas'}
                </button>
              </div>

              {filteredCues.map((cue) => {
                const isRevealed = revealAllCues || Boolean(revealedCueIds[cue.id]);
                return (
                  <div
                    key={cue.id}
                    onClick={() => toggleCueReveal(cue.id)}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {cue.topicTitle} · {cue.sourceLabel}
                        </span>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                          {cue.question}
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold shrink-0">
                        {isRevealed ? 'Ocultar' : 'Comprobar'}
                      </span>
                    </div>
                    {isRevealed && (
                      <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          Síntesis Cornell:{' '}
                        </strong>
                        {cue.answerHint}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie con acciones directas */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {onStartPomodoro && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartPomodoro(
                    subject.id,
                    selectedTopicId !== 'all' ? selectedTopicId : undefined
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Pomodoro de Repaso</span>
              </button>
            )}

            {onOpenQuizzes && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQuizzes(
                    subject.id,
                    selectedTopicId !== 'all' ? [selectedTopicId] : undefined
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-2xs transition-colors cursor-pointer"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Hacer Test Rápido</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenSubjectDetail && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSubjectDetail(subject.id);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-2xs transition-colors cursor-pointer"
              >
                <span>Abrir Apuntes de la Materia</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
