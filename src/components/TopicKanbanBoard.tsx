import React, { useState } from 'react';
import {
  GripVertical,
  Clock,
  CheckCircle2,
  Flame,
  RotateCw,
  FileText,
  Sparkles,
  Brain,
  Layers,
  ArrowRight,
  BookOpen,
  Calendar,
  Play,
  Trash2,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { Topic, TopicStatus, DifficultyLevel } from '../types';
import { TopicReviewScheduleModal } from './TopicReviewScheduleModal';
import { schedulerService } from '../services/schedulerService';

export interface KanbanTopicItem extends Topic {
  subjectName?: string;
  subjectColor?: string;
  subjectId?: string;
}

interface TopicKanbanBoardProps {
  topics: KanbanTopicItem[];
  subjectName?: string;
  subjectColor?: string;
  subjectsList?: { id: string; name: string; color?: string }[];
  selectedFilterSubjectId?: string;
  onFilterSubjectChange?: (subjectId: string) => void;
  onSelectSubject?: (subjectId: string) => void;
  onUpdateTopicStatus: (topicId: string, newStatus: TopicStatus) => void;
  onUpdateTopicReviewSchedule?: (topicId: string, updatedData: any) => void;
  onOpenNotes?: (topic: Topic) => void;
  onOpenFlashcards?: (topic: Topic) => void;
  onOpenDiagram?: (topic: Topic) => void;
  onOpenFeynman?: (topicTitle: string) => void;
  onOpenReadingMode?: (topic: Topic) => void;
  onStartPomodoro?: (topicId: string) => void;
  onEditTopic?: (topic: Topic) => void;
  onDeleteTopic?: (topicId: string) => void;
}

interface ColumnConfig {
  id: TopicStatus;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  headerBg: string;
  columnBg: string;
  badgeBg: string;
  borderColor: string;
  activeDropRing: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'pendiente',
    title: 'Pendiente',
    description: 'Temas por comenzar',
    icon: Clock,
    accentColor: 'text-slate-700',
    headerBg: 'bg-slate-100',
    columnBg: 'bg-slate-50/70',
    badgeBg: 'bg-slate-200 text-slate-800',
    borderColor: 'border-slate-200',
    activeDropRing: 'ring-2 ring-slate-400 bg-slate-100/70',
  },
  {
    id: 'en_progreso',
    title: 'En Progreso',
    description: 'En lectura o elaboración',
    icon: Flame,
    accentColor: 'text-blue-700',
    headerBg: 'bg-blue-100/80',
    columnBg: 'bg-blue-50/40',
    badgeBg: 'bg-blue-200 text-blue-900',
    borderColor: 'border-blue-200',
    activeDropRing: 'ring-2 ring-blue-500 bg-blue-100/50',
  },
  {
    id: 'estudiado',
    title: 'Estudiado',
    description: 'Listo para repaso espaciado',
    icon: CheckCircle2,
    accentColor: 'text-emerald-700',
    headerBg: 'bg-emerald-100/80',
    columnBg: 'bg-emerald-50/40',
    badgeBg: 'bg-emerald-200 text-emerald-900',
    borderColor: 'border-emerald-200',
    activeDropRing: 'ring-2 ring-emerald-500 bg-emerald-100/50',
  },
  {
    id: 'repasado',
    title: 'Repasado',
    description: 'Memoria consolidada',
    icon: RotateCw,
    accentColor: 'text-purple-700',
    headerBg: 'bg-purple-100/80',
    columnBg: 'bg-purple-50/40',
    badgeBg: 'bg-purple-200 text-purple-900',
    borderColor: 'border-purple-200',
    activeDropRing: 'ring-2 ring-purple-500 bg-purple-100/50',
  },
];

export const TopicKanbanBoard: React.FC<TopicKanbanBoardProps> = ({
  topics,
  subjectName,
  subjectColor = '#3b82f6',
  subjectsList,
  selectedFilterSubjectId,
  onFilterSubjectChange,
  onSelectSubject,
  onUpdateTopicStatus,
  onUpdateTopicReviewSchedule,
  onOpenNotes,
  onOpenFlashcards,
  onOpenDiagram,
  onOpenFeynman,
  onOpenReadingMode,
  onStartPomodoro,
  onEditTopic,
  onDeleteTopic,
}) => {
  const [draggedTopicId, setDraggedTopicId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TopicStatus | null>(null);
  const [scheduleAdjustTopic, setScheduleAdjustTopic] = useState<KanbanTopicItem | null>(null);

  const filteredTopics = React.useMemo(() => {
    if (!selectedFilterSubjectId || selectedFilterSubjectId === 'all') {
      return topics;
    }
    return topics.filter((t) => t.subjectId === selectedFilterSubjectId);
  }, [topics, selectedFilterSubjectId]);

  const handleDragStart = (e: React.DragEvent, topicId: string) => {
    e.dataTransfer.setData('text/plain', topicId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTopicId(topicId);
  };

  const handleDragEnd = () => {
    setDraggedTopicId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: TopicStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: TopicStatus) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (e.currentTarget.contains(relatedTarget)) return;
    if (dragOverColumn === colId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TopicStatus) => {
    e.preventDefault();
    const topicId = e.dataTransfer.getData('text/plain') || draggedTopicId;
    if (topicId) {
      onUpdateTopicStatus(topicId, targetStatus);
    }
    setDraggedTopicId(null);
    setDragOverColumn(null);
  };

  const getDifficultyBadge = (diff: DifficultyLevel) => {
    switch (diff) {
      case 'Alta':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Media':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Baja':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Informative Guidance & Filter Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-blue-100 text-blue-700 rounded-md">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <span>
            <strong>Tablero Kanban:</strong> Arrastra cualquier tema entre columnas para gestionar su progreso de <em>Pendiente</em> a <em>Estudiado</em>.
          </span>
        </div>

        <div className="flex items-center gap-3">
          {subjectsList && subjectsList.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 text-[11px] font-medium">Materia:</span>
              <select
                value={selectedFilterSubjectId || 'all'}
                onChange={(e) => onFilterSubjectChange && onFilterSubjectChange(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">Todas ({subjectsList.length})</option>
                {subjectsList.map((s) => {
                  const subTopics = topics.filter((t) => t.subjectId === s.id);
                  const studied = subTopics.filter(
                    (t) => t.status === 'estudiado' || t.status === 'repasado'
                  ).length;
                  const pct = subTopics.length > 0 ? Math.round((studied / subTopics.length) * 100) : 0;
                  const isLow = subTopics.length > 0 && pct < 20;

                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} {isLow ? `⚠️ (< 20%)` : `(${pct}%)`}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="text-[11px] text-blue-700 font-semibold font-mono-numbers bg-white/70 px-2 py-0.5 rounded border border-blue-200">
            {filteredTopics.length} temas
          </div>
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => {
          const colTopics = filteredTopics.filter((t) => t.status === col.id);
          const totalHours = colTopics.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
          const isDragTarget = dragOverColumn === col.id;
          const Icon = col.icon;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`rounded-2xl border transition-all duration-200 flex flex-col min-h-[420px] ${
                col.borderColor
              } ${col.columnBg} ${
                isDragTarget ? `${col.activeDropRing} shadow-md scale-[1.01]` : 'shadow-2xs'
              }`}
            >
              {/* Column Header */}
              <div
                className={`p-3.5 border-b rounded-t-2xl flex items-center justify-between ${
                  col.borderColor
                } ${col.headerBg}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${col.accentColor}`} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      {col.title}
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono-numbers font-bold ${col.badgeBg}`}
                      >
                        {colTopics.length}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-500">{col.description}</p>
                  </div>
                </div>

                {totalHours > 0 && (
                  <span className="text-[11px] font-semibold text-slate-600 font-mono-numbers bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">
                    {totalHours}h
                  </span>
                )}
              </div>

              {/* Topics Container / Drop Area */}
              <div className="p-3 space-y-2.5 flex-1 flex flex-col">
                {colTopics.length === 0 ? (
                  <div
                    className={`flex-1 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-colors ${
                      isDragTarget
                        ? 'border-blue-400 bg-blue-100/40 text-blue-800'
                        : 'border-slate-200/80 text-slate-400'
                    }`}
                  >
                    <Icon className="w-6 h-6 mb-1.5 opacity-40" />
                    <p className="text-[11px] font-medium">Sin temas aquí</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {col.id === 'estudiado'
                        ? 'Arrastra aquí para marcar como estudiado'
                        : `Arrastra para mover a ${col.title}`}
                    </p>
                  </div>
                ) : (
                  colTopics.map((topic, idx) => {
                    const isDragging = draggedTopicId === topic.id;

                    return (
                      <div
                        key={topic.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, topic.id)}
                        onDragEnd={handleDragEnd}
                        className={`group bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing select-none ${
                          isDragging ? 'opacity-40 scale-95 border-dashed border-blue-400' : ''
                        }`}
                      >
                        {/* Subject Badge if multi-subject view */}
                        {topic.subjectName && (
                          <div
                            onClick={(e) => {
                              if (onSelectSubject && topic.subjectId) {
                                e.stopPropagation();
                                onSelectSubject(topic.subjectId);
                              }
                            }}
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md mb-2 transition-opacity ${
                              onSelectSubject ? 'cursor-pointer hover:opacity-80' : ''
                            }`}
                            style={{
                              backgroundColor: `${topic.subjectColor || '#3b82f6'}15`,
                              color: topic.subjectColor || '#1d4ed8',
                              border: `1px solid ${topic.subjectColor || '#3b82f6'}30`,
                            }}
                            title={`Materia: ${topic.subjectName} (Click para abrir)`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: topic.subjectColor || '#3b82f6' }}
                            />
                            <span className="truncate max-w-[150px]">{topic.subjectName}</span>
                          </div>
                        )}

                        {/* Drag Handle & Top Metadata */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                          <div className="flex items-center gap-1.5 text-slate-500 font-semibold font-mono-numbers">
                            <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                            <span>Tema {topic.id.replace('t', '') || idx + 1}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${getDifficultyBadge(
                                topic.difficulty
                              )}`}
                            >
                              {topic.difficulty}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h5 className="text-xs font-bold text-slate-900 group-hover:text-blue-900 transition-colors line-clamp-2">
                          {topic.title}
                        </h5>

                        {/* Description snippet if exists */}
                        {topic.description && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {topic.description}
                          </p>
                        )}

                        {/* Subtopics preview & quick edit trigger */}
                        {topic.subtopics && topic.subtopics.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {topic.subtopics.slice(0, 3).map((st, sIdx) => (
                              <span
                                key={sIdx}
                                className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200/80 px-1.5 py-0.5 rounded truncate max-w-[130px]"
                                title={st}
                              >
                                {st}
                              </span>
                            ))}
                            {topic.subtopics.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-mono-numbers">
                                +{topic.subtopics.length - 3}
                              </span>
                            )}
                            {onEditTopic && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditTopic(topic);
                                }}
                                className="text-[10px] text-blue-600 hover:underline font-medium ml-0.5 cursor-pointer"
                                title="Modificar subtemas y detalles del tema"
                              >
                                Editar
                              </button>
                            )}
                          </div>
                        ) : (
                          onEditTopic && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditTopic(topic);
                              }}
                              className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                              title="Añadir o modificar subtemas de este tema"
                            >
                              <span>+ Añadir subtemas</span>
                            </button>
                          )
                        )}

                        {/* Badges / Metrics */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-mono-numbers">
                          {/* Vueltas counter */}
                          <span
                            className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-indigo-200"
                            title={`Estudiado o repasado ${topic.vueltasCount !== undefined ? topic.vueltasCount : (topic.reviewsHistory?.length || 0) + (topic.status === 'estudiado' || topic.status === 'repasado' || topic.studiedAt ? 1 : 0)} veces`}
                          >
                            <RotateCw className="w-2.5 h-2.5 text-indigo-600" />
                            <span>
                              {topic.vueltasCount !== undefined
                                ? topic.vueltasCount
                                : (topic.reviewsHistory?.length || 0) +
                                  (topic.status === 'estudiado' || topic.status === 'repasado' || topic.studiedAt ? 1 : 0)}{' '}
                              vueltas
                            </span>
                          </span>

                          <span className="flex items-center gap-1 text-blue-700 font-medium">
                            ⏱ {topic.estimatedHours}h
                          </span>
                          {(() => {
                            const pageInfo = schedulerService.getTopicStudiedPages(topic);
                            return pageInfo.totalPages > 0 ? (
                              <span
                                className="flex items-center gap-1 text-indigo-700 bg-indigo-50/80 px-1.5 py-0.2 rounded border border-indigo-200 font-semibold"
                                title={`${pageInfo.studiedPages} de ${pageInfo.totalPages} páginas estudiadas (${pageInfo.studiedPct}%)`}
                              >
                                📖 {pageInfo.studiedPages}/{pageInfo.totalPages}p
                              </span>
                            ) : null;
                          })()}
                          {topic.attachedFiles && topic.attachedFiles.length > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded text-[10px] font-semibold border border-indigo-200"
                              title={`${topic.attachedFiles.length} documento(s) importado(s)`}
                            >
                              📎 {topic.attachedFiles.length} doc{topic.attachedFiles.length === 1 ? '' : 's'}
                            </span>
                          )}
                          {topic.notes && topic.notes.trim().length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[10px] font-semibold border border-emerald-200">
                              <FileText className="w-2.5 h-2.5" />
                              Apuntes
                            </span>
                          )}
                          {topic.nextReviewDate ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScheduleAdjustTopic(topic);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                              title="Ajustar fecha del próximo repaso, páginas estudiadas y autoevaluar retención"
                            >
                              <RotateCw className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              <span>
                                Repaso: {topic.nextReviewDate} (~
                                {
                                  schedulerService.calculateTopicReviewTime(
                                    topic,
                                    undefined,
                                    Math.max(1, topic.reviewLevel || 1)
                                  ).reviewMinutes
                                }
                                m)
                              </span>
                            </button>
                          ) : col.id === 'estudiado' || col.id === 'repasado' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScheduleAdjustTopic(topic);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors cursor-pointer bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border-slate-200"
                              title="Programar fecha de repaso espaciado teniendo en cuenta páginas estudiadas"
                            >
                              <Calendar className="w-2.5 h-2.5 text-slate-500" />
                              <span>+ Programar repaso</span>
                            </button>
                          ) : null}
                        </div>

                        {/* Quick AI y Study Actions */}
                        <div className="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            {onStartPomodoro && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartPomodoro(topic.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Estudiar este tema con Pomodoro"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            )}

                            {onOpenNotes && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenNotes(topic);
                                }}
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                title="Apuntes del tema"
                              >
                                <FileText className="w-3 h-3" />
                              </button>
                            )}

                            {onOpenReadingMode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenReadingMode(topic);
                                }}
                                className="p-1 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                                title="Modo Lectura a pantalla completa con panel Feynman"
                              >
                                <BookOpen className="w-3 h-3" />
                              </button>
                            )}

                            {onOpenFlashcards && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenFlashcards(topic);
                                }}
                                className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                title="Flashcards de este tema"
                              >
                                <Layers className="w-3 h-3" />
                              </button>
                            )}

                            {onOpenDiagram && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDiagram(topic);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                title="Mapa conceptual Mermaid"
                              >
                                <Sparkles className="w-3 h-3" />
                              </button>
                            )}

                            {onOpenFeynman && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenFeynman(topic.title);
                                }}
                                className="p-1 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                                title="Explicación Feynman con IA"
                              >
                                <Brain className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScheduleAdjustTopic(topic);
                              }}
                              className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                              title="Ajustar manualmente la fecha del próximo repaso y autoevaluar retención"
                            >
                              <Calendar className="w-3 h-3 text-amber-600" />
                            </button>
                            {onEditTopic && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditTopic(topic);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                title="Editar tema y modificar subtemas"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Quick mobile/click mover dropdown */}
                          <div className="flex items-center gap-0.5">
                            {col.id !== 'estudiado' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTopicStatus(topic.id, 'estudiado');
                                }}
                                className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold transition-colors"
                                title="Marcar como estudiado"
                              >
                                ✓ Estudiar
                              </button>
                            )}
                            {col.id === 'estudiado' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTopicStatus(topic.id, 'repasado');
                                }}
                                className="text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded font-semibold transition-colors"
                                title="Marcar como repasado"
                              >
                                ✓ Repasado
                              </button>
                            )}
                            {col.id !== 'pendiente' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTopicStatus(topic.id, 'pendiente');
                                }}
                                className="text-[10px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                                title="Mover a pendiente"
                              >
                                Pendiente
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal interactivo para ajustar manualmente la fecha del próximo repaso y autoevaluación de retención */}
      <TopicReviewScheduleModal
        isOpen={!!scheduleAdjustTopic}
        onClose={() => setScheduleAdjustTopic(null)}
        topic={scheduleAdjustTopic}
        subjectName={scheduleAdjustTopic?.subjectName || subjectName}
        subjectColor={scheduleAdjustTopic?.subjectColor || subjectColor}
        onSaveSchedule={(topicId, updatedData) => {
          if (onUpdateTopicReviewSchedule) {
            onUpdateTopicReviewSchedule(topicId, updatedData);
          }
        }}
      />
    </div>
  );
};
