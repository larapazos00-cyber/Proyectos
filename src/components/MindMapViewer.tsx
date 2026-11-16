import React, { useState, useEffect, useRef } from 'react';
import {
  GitBranch,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Copy,
  Check,
  Code2,
  Maximize2,
  Minimize2,
  Loader2,
  Save,
  Eye,
  Move,
  Network,
  ChevronRight,
  ChevronDown,
  FileText,
} from 'lucide-react';
import mermaid from 'mermaid';
import { CornellNote, Mindmap, MindmapNode, Topic } from '../types';
import { D3MindMapCanvas } from './D3MindMapCanvas';

export interface MindMapViewerProps {
  mermaidCode?: string;
  topicTitle: string;
  subjectName?: string;
  summary?: string;
  isGenerating?: boolean;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  onSaveCode?: (updatedMermaidCode: string) => void;
  height?: number;
}

let mermaidInitialized = false;

function sanitizeMermaidMindMapCode(rawCode: string, directionOverride?: 'LR' | 'TD'): string {
  let cleaned = (rawCode || '')
    .replace(/^```(mermaid)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) return '';

  if (directionOverride) {
    if (/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)/i.test(cleaned)) {
      cleaned = cleaned.replace(
        /^(flowchart|graph)\s+(TD|TB|LR|RL|BT)/i,
        `flowchart ${directionOverride}`
      );
    }
  }

  return cleaned;
}

export const MindMapViewer: React.FC<MindMapViewerProps> = ({
  mermaidCode = '',
  topicTitle,
  subjectName,
  summary,
  isGenerating = false,
  onGenerate,
  onRegenerate,
  onSaveCode,
  height = 420,
}) => {
  const triggerGenerate = onRegenerate || onGenerate;
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'interactive' | 'code'>('interactive');
  const [direction, setDirection] = useState<'LR' | 'TD'>('LR');
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [editableCode, setEditableCode] = useState<string>(mermaidCode);
  const [selectedNodeText, setSelectedNodeText] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
        },
      });
      mermaidInitialized = true;
    }
  }, []);

  useEffect(() => {
    setEditableCode(mermaidCode || '');
    if (mermaidCode) {
      if (/^(flowchart|graph)\s+(TD|TB)/i.test(mermaidCode.trim())) {
        setDirection('TD');
      } else {
        setDirection('LR');
      }
    }
  }, [mermaidCode]);

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      if (!mermaidCode || !mermaidCode.trim()) {
        setRenderedSvg('');
        setRenderError(null);
        return;
      }

      const codeToRender = sanitizeMermaidMindMapCode(mermaidCode, direction);
      if (!codeToRender) return;

      try {
        setRenderError(null);
        const renderId = `mermaid-mm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const { svg } = await mermaid.render(renderId, codeToRender);
        if (isMounted) {
          setRenderedSvg(svg);
        }
      } catch (err: any) {
        console.warn('[MindMapViewer] Mermaid render warning, trying fallback:', err);
        try {
          // Fallback basic sanitization if a label had unescaped characters
          const fallbackTitle = topicTitle.replace(/["[\]()]/g, '');
          const fallbackCode = `flowchart ${direction}\n  root(["🧠 ${fallbackTitle}"])`;
          const renderId2 = `mermaid-mm-fb-${Date.now()}`;
          const { svg } = await mermaid.render(renderId2, fallbackCode);
          if (isMounted) {
            setRenderedSvg(svg);
            setRenderError(
              'El código Mermaid contenía algún carácter especial; puedes revisarlo o ajustarlo en la pestaña Código Mermaid.'
            );
          }
        } catch {
          if (isMounted) {
            setRenderError('No se pudo renderizar la vista gráfica. Revisa el código Mermaid.');
          }
        }
      }
    };

    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [mermaidCode, direction, topicTitle]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeMode !== 'interactive') return;
    // Detect if user clicked on a Mermaid node to inspect it
    const target = e.target as HTMLElement;
    const nodeGroup = target.closest('.node');
    if (nodeGroup) {
      const labelText = nodeGroup.textContent?.trim();
      if (labelText) {
        setSelectedNodeText(labelText);
      }
    }
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNodeText(null);
  };

  const handleCopyCode = () => {
    if (!mermaidCode) return;
    navigator.clipboard.writeText(mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!renderedSvg) return;
    const blob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (topicTitle || 'mapa_mental').replace(/\s+/g, '_').toLowerCase();
    a.download = `${slug}_mermaid_mindmap.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveManualCode = () => {
    if (!onSaveCode) return;
    onSaveCode(editableCode.trim());
    setSavedNotice(true);
    setActiveMode('interactive');
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const isFlowchart = /^(flowchart|graph)\s+/i.test((mermaidCode || '').trim());

  const viewerContent = (
    <div
      className={`bg-white rounded-2xl border border-violet-200/90 shadow-2xs overflow-hidden flex flex-col ${
        isFullScreen ? 'fixed inset-3 z-50 shadow-2xl' : ''
      }`}
    >
      {/* Top Toolbar */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-violet-50/90 via-indigo-50/50 to-white border-b border-violet-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
            <GitBranch className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900 truncate">
                Mapa Mental Mermaid.js · {topicTitle}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                IA + Mermaid
              </span>
            </div>
            {subjectName && (
              <p className="text-[10px] text-slate-500 truncate">
                {subjectName} · Arrastra el lienzo para moverte y haz clic en los nodos
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => setActiveMode('interactive')}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                activeMode === 'interactive'
                  ? 'bg-white text-violet-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Mapa Interactivo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('code')}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                activeMode === 'code'
                  ? 'bg-white text-violet-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>Código Mermaid</span>
            </button>
          </div>

          {/* Direction toggle (LR vs TD) */}
          {activeMode === 'interactive' && isFlowchart && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setDirection('LR')}
                className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  direction === 'LR'
                    ? 'bg-white text-violet-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Disposición Horizontal (Izquierda a Derecha)"
              >
                Horizontal
              </button>
              <button
                type="button"
                onClick={() => setDirection('TD')}
                className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  direction === 'TD'
                    ? 'bg-white text-violet-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Disposición Vertical (Arriba a Abajo)"
              >
                Vertical
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          {activeMode === 'interactive' && mermaidCode && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-slate-600">
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
                className="p-1 hover:text-slate-900 cursor-pointer"
                title="Alejar"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono-numbers font-bold px-1.5">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
                className="p-1 hover:text-slate-900 cursor-pointer"
                title="Acercar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="p-1 hover:text-slate-900 border-l border-slate-200 ml-0.5 cursor-pointer"
                title="Restablecer vista y zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {mermaidCode && (
            <>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                title="Descargar mapa mental como imagen vectorial SVG"
              >
                <Download className="w-3 h-3 text-violet-600" />
                <span>SVG</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                title="Copiar código Mermaid.js"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </>
          )}

          {triggerGenerate && (
            <button
              type="button"
              disabled={isGenerating}
              onClick={triggerGenerate}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>{mermaidCode ? 'Regenerar Mermaid IA' : 'Generar Mapa Mermaid IA'}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={isFullScreen ? 'Salir de pantalla completa' : 'Ver a pantalla completa'}
          >
            {isFullScreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Summary bar if available */}
      {summary && activeMode === 'interactive' && (
        <div className="px-4 py-2 bg-violet-50/40 border-b border-violet-100 text-[11px] text-slate-700 leading-relaxed">
          <strong className="text-violet-900">Síntesis del Mapa Mental:</strong> {summary}
        </div>
      )}

      {/* Main Content Area */}
      <div
        className="flex-1 relative overflow-hidden bg-slate-50/40 flex flex-col"
        style={{ minHeight: isFullScreen ? undefined : `${height}px` }}
      >
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2.5">
            <Loader2 className="w-7 h-7 text-violet-600 animate-spin" />
            <div className="text-xs font-bold text-slate-900">
              Generando estructura de mapa mental Mermaid.js con Gemini...
            </div>
            <p className="text-[11px] text-slate-500 max-w-md">
              Analizando los apuntes de &ldquo;{topicTitle}&rdquo; para construir los nodos y conexiones jerárquicas.
            </p>
          </div>
        ) : !mermaidCode ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <GitBranch className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-xs font-bold text-slate-900">
                Aún no hay un mapa mental Mermaid.js guardado en este tema
              </h4>
              <p className="text-[11px] text-slate-500">
                Pulsa el botón para que Gemini analice los apuntes de &ldquo;{topicTitle}&rdquo; y guarde el mapa mental interactivo en el tema.
              </p>
            </div>
            {triggerGenerate && (
              <button
                type="button"
                onClick={triggerGenerate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generar Mapa Mental Mermaid con IA</span>
              </button>
            )}
          </div>
        ) : activeMode === 'interactive' ? (
          <>
            {renderError && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800 flex items-center justify-between">
                <span>{renderError}</span>
                <button
                  type="button"
                  onClick={() => setActiveMode('code')}
                  className="font-bold underline ml-2 cursor-pointer"
                >
                  Editar código
                </button>
              </div>
            )}

            <div
              ref={svgContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`flex-1 flex items-center justify-center overflow-auto p-4 select-none ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {renderedSvg ? (
                <div
                  className="transition-transform duration-75 ease-out flex items-center justify-center"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                    transformOrigin: 'center center',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              ) : (
                <div className="text-xs text-slate-400">Renderizando diagrama Mermaid.js...</div>
              )}
            </div>

            {/* Interactive Footer Badge */}
            <div className="px-4 py-2 bg-white border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-violet-500" />
                {selectedNodeText ? (
                  <span>
                    Nodo seleccionado:{' '}
                    <strong className="text-violet-900 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
                      {selectedNodeText}
                    </strong>
                  </span>
                ) : (
                  <span>
                    Arrastra el mapa para desplazarte o haz clic en cualquier nodo para resaltarlo.
                  </span>
                )}
              </div>
              <span className="font-mono-numbers text-[10px] text-slate-400">
                Guardado en topic.mindMap
              </span>
            </div>
          </>
        ) : (
          /* Code Editor Mode */
          <div className="flex-1 p-4 bg-slate-900 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-mono text-[11px] text-emerald-400">
                Código fuente Mermaid.js (topic.mindMap)
              </span>
              <div className="flex items-center gap-2">
                {savedNotice && (
                  <span className="text-emerald-400 text-[11px] font-bold">
                    ✓ Guardado en el tema
                  </span>
                )}
                {onSaveCode && (
                  <button
                    type="button"
                    onClick={handleSaveManualCode}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar y Renderizar</span>
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={editableCode}
              onChange={(e) => setEditableCode(e.target.value)}
              rows={12}
              className="w-full flex-1 bg-slate-950 text-emerald-300 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-violet-500 leading-relaxed resize-y"
              placeholder="flowchart LR..."
            />
          </div>
        )}
      </div>
    </div>
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        {viewerContent}
      </div>
    );
  }

  return viewerContent;
};

export interface MindmapViewerProps {
  mindmaps: Mindmap[];
  topics: Topic[];
  cornellNotes?: CornellNote[];
  subjectName: string;
  onSaveMindmap: (mindmap: Mindmap) => void;
  onGenerateCornellMindmapForTopic?: (topicId: string) => Promise<Mindmap | null>;
}

export const MindmapViewer: React.FC<MindmapViewerProps> = ({
  mindmaps,
  topics,
  cornellNotes = [],
  subjectName,
  onSaveMindmap,
  onGenerateCornellMindmapForTopic,
}) => {
  const [activeMindmapId, setActiveMindmapId] = useState<string>(
    mindmaps.length > 0 ? mindmaps[0].id : ''
  );
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(
    topics.map((t) => t.id).slice(0, 3)
  );
  const [selectedCornellTopicId, setSelectedCornellTopicId] = useState<string>(
    topics[0]?.id || ''
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCornell, setIsGeneratingCornell] = useState(false);
  const [viewMode, setViewMode] = useState<'d3' | 'visual' | 'outline'>('d3');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [copied, setCopied] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (mindmaps.length > 0 && !mindmaps.some((m) => m.id === activeMindmapId)) {
      setActiveMindmapId(mindmaps[0].id);
    }
  }, [mindmaps, activeMindmapId]);

  const activeMindmap = mindmaps.find((m) => m.id === activeMindmapId) || mindmaps[0];

  const handleToggleTopic = (id: string) => {
    if (selectedTopicIds.includes(id)) {
      setSelectedTopicIds(selectedTopicIds.filter((tId) => tId !== id));
    } else {
      setSelectedTopicIds([...selectedTopicIds, id]);
    }
  };

  const handleGenerateCornellD3 = async () => {
    if (!selectedCornellTopicId) return;
    if (onGenerateCornellMindmapForTopic) {
      setIsGeneratingCornell(true);
      try {
        const created = await onGenerateCornellMindmapForTopic(selectedCornellTopicId);
        if (created) {
          setActiveMindmapId(created.id);
          setViewMode('d3');
        }
      } finally {
        setIsGeneratingCornell(false);
      }
      return;
    }

    const targetTopic = topics.find((t) => t.id === selectedCornellTopicId);
    if (!targetTopic) return;
    setIsGeneratingCornell(true);
    try {
      const matchingNote = cornellNotes.find((n) => n.topicId === targetTopic.id);
      const mergedCues =
        matchingNote?.cues && matchingNote.cues.length > 0
          ? matchingNote.cues
          : targetTopic.cues || [];
      const mergedNotes =
        matchingNote?.notes ||
        targetTopic.notes ||
        targetTopic.generalNotes ||
        targetTopic.description ||
        '';
      const mergedSummary = matchingNote?.summary || targetTopic.summary || '';

      const response = await fetch('/api/gemini/generate-cornell-mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: targetTopic.title,
          topicDescription: targetTopic.description,
          subtopics: targetTopic.subtopics,
          subjectName,
          cornellTitle: matchingNote?.title || targetTopic.title,
          cues: mergedCues,
          notes: mergedNotes,
          summary: mergedSummary,
        }),
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        const newMindmap: Mindmap = {
          id: `mm-cornell-${Date.now()}`,
          topicIds: [targetTopic.id],
          cornellNoteId: matchingNote?.id,
          title: resData.data.title || `Mapa Mental Cornell: ${targetTopic.title}`,
          summary: resData.data.summary || mergedSummary,
          rootNode: resData.data.rootNode,
          createdAt: new Date().toISOString(),
        };
        onSaveMindmap(newMindmap);
        setActiveMindmapId(newMindmap.id);
        setViewMode('d3');
      }
    } catch (e) {
      console.error('Error generating Cornell mindmap:', e);
    } finally {
      setIsGeneratingCornell(false);
    }
  };

  const handleGenerateMindmap = async () => {
    if (selectedTopicIds.length === 0) return;
    setIsGenerating(true);

    try {
      const selectedTopicsData = topics
        .filter((t) => selectedTopicIds.includes(t.id))
        .map((t) => ({
          title: t.title,
          description: t.description,
          subtopics: t.subtopics,
          notes: t.notes,
          cues: t.cues,
          summary: t.summary,
        }));

      const response = await fetch('/api/gemini/generate-mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: selectedTopicsData,
          subjectName,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const newMindmap: Mindmap = {
          id: `mm-${Date.now()}`,
          topicIds: selectedTopicIds,
          title: resData.data.title || `Mapa Mental de ${subjectName}`,
          summary: resData.data.summary || '',
          rootNode: resData.data.rootNode,
          createdAt: new Date().toISOString(),
        };

        onSaveMindmap(newMindmap);
        setActiveMindmapId(newMindmap.id);
        setViewMode('d3');
      }
    } catch (e) {
      console.error('Error generating mindmap', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const copyOutline = () => {
    if (!activeMindmap) return;

    const renderTextNode = (node: MindmapNode, depth = 0): string => {
      const indent = '  '.repeat(depth);
      let text = `${indent}- **${node.label}**: ${node.description}\n`;
      if (node.children) {
        node.children.forEach((c) => {
          text += renderTextNode(c, depth + 1);
        });
      }
      return text;
    };

    const outlineText = `# ${activeMindmap.title}\n\n${activeMindmap.summary}\n\n${renderTextNode(
      activeMindmap.rootNode
    )}`;
    navigator.clipboard.writeText(outlineText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-200 bg-slate-50/60 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-600" />
              <span>Mapas Mentales Jerárquicos (Gemini + D3.js)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Genera mapas mentales interactivos renderizados con D3.js a partir de los apuntes Cornell de un tema o de múltiples temas.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {mindmaps.length > 0 && (
              <select
                value={activeMindmapId}
                onChange={(e) => setActiveMindmapId(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none"
              >
                {mindmaps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleGenerateMindmap}
              disabled={isGenerating || selectedTopicIds.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Sintetizando temas...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mapa Multitema ({selectedTopicIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {topics.length > 0 && (
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-indigo-950">
                  Generar Mapa Mental D3.js desde Apuntes Cornell del Tema
                </div>
                <div className="text-[11px] text-indigo-800/80">
                  Transforma las preguntas clave (Cues), notas detalladas y resumen Cornell en un árbol D3.js interactivo.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedCornellTopicId}
                onChange={(e) => setSelectedCornellTopicId(e.target.value)}
                className="text-xs bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none max-w-xs"
              >
                {topics.map((t) => {
                  const hasCornell =
                    cornellNotes.some((n) => n.topicId === t.id) ||
                    Boolean(t.notes && t.notes.trim()) ||
                    Boolean(t.cues && t.cues.length > 0);
                  return (
                    <option key={t.id} value={t.id}>
                      {t.title} {hasCornell ? '· (Con Apuntes Cornell)' : ''}
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={handleGenerateCornellD3}
                disabled={isGeneratingCornell || !selectedCornellTopicId}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingCornell ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando árbol D3.js...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>Generar desde Cornell con Gemini</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs font-semibold text-slate-600 mr-1">Temas para síntesis global:</span>
          {topics.map((t) => {
            const isSelected = selectedTopicIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleToggleTopic(t.id)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {isSelected ? '✓ ' : '+ '}
                {t.title}
              </button>
            );
          })}
        </div>
      </div>

      {activeMindmap ? (
        <div className="flex-1 flex flex-col min-h-[540px]">
          <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('d3')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'd3'
                    ? 'bg-white font-bold text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Estructura Jerárquica D3.js</span>
              </button>
              <button
                onClick={() => setViewMode('visual')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'visual' ? 'bg-white font-medium text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Tarjetas por Ramas
              </button>
              <button
                onClick={() => setViewMode('outline')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'outline' ? 'bg-white font-medium text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Esquema en Texto
              </button>
            </div>

            <div className="flex items-center gap-2">
              {viewMode === 'visual' && (
                <div className="flex items-center gap-1 text-slate-500 mr-2">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
                    className="p-1 hover:bg-slate-100 rounded"
                    title="Reducir zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-[11px] w-10 text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
                    className="p-1 hover:bg-slate-100 rounded"
                    title="Aumentar zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-1 hover:bg-slate-100 rounded ml-1"
                    title="Restablecer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={copyOutline}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado' : 'Copiar Esquema'}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 sm:p-6 bg-slate-50/50 overflow-auto">
            {viewMode === 'd3' ? (
              <D3MindMapCanvas
                rootNode={activeMindmap.rootNode}
                title={activeMindmap.title}
                summary={activeMindmap.summary}
                height={540}
              />
            ) : viewMode === 'visual' ? (
              <div
                className="min-w-[800px] transition-transform origin-top-left"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="text-center">
                    <div className="inline-block p-4 bg-slate-900 text-white rounded-2xl shadow-md border border-slate-800 max-w-md">
                      <h4 className="text-sm font-bold tracking-tight">
                        {activeMindmap.rootNode.label}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 leading-snug">
                        {activeMindmap.rootNode.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                    {activeMindmap.rootNode.children?.map((branch) => {
                      const isCollapsed = collapsedNodes[branch.id];
                      return (
                        <div
                          key={branch.id}
                          className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col"
                        >
                          <div
                            onClick={() => toggleCollapse(branch.id)}
                            className="p-3.5 bg-blue-50/40 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-blue-50/80 transition-colors"
                          >
                            <div>
                              <span className="text-xs font-bold text-blue-900">
                                {branch.label}
                              </span>
                              <p className="text-[11px] text-slate-600 mt-0.5">
                                {branch.description}
                              </p>
                            </div>
                            <span className="text-slate-400">
                              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                          </div>

                          {!isCollapsed && branch.children && (
                            <div className="p-3 space-y-2 bg-white flex-1">
                              {branch.children.map((leaf) => (
                                <div
                                  key={leaf.id}
                                  className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-800 space-y-1.5"
                                >
                                  <div className="font-semibold text-slate-900">
                                    {leaf.label}
                                  </div>
                                  <div className="text-slate-600 leading-relaxed text-[11px]">
                                    {leaf.description}
                                  </div>
                                  {leaf.children && leaf.children.length > 0 && (
                                    <div className="pl-2.5 pt-1 border-l-2 border-blue-200 space-y-1">
                                      {leaf.children.map((subLeaf) => (
                                        <div key={subLeaf.id} className="text-[11px] text-slate-600">
                                          <strong className="text-slate-800">• {subLeaf.label}:</strong>{' '}
                                          {subLeaf.description}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-2xs font-sans text-xs space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">{activeMindmap.title}</h4>
                  <p className="text-slate-600 mt-1">{activeMindmap.summary}</p>
                </div>

                <div className="space-y-4 pl-2">
                  <div className="font-bold text-slate-900 text-sm">
                    {activeMindmap.rootNode.label}
                  </div>
                  <div className="space-y-3 pl-4 border-l-2 border-slate-200">
                    {activeMindmap.rootNode.children?.map((branch) => (
                      <div key={branch.id} className="space-y-1.5">
                        <div className="font-semibold text-blue-800">
                          {branch.label} <span className="font-normal text-slate-500">· {branch.description}</span>
                        </div>
                        <div className="pl-4 space-y-1 border-l border-slate-200">
                          {branch.children?.map((leaf) => (
                            <div key={leaf.id} className="text-slate-700 space-y-1">
                              <div>
                                <span className="font-medium text-slate-900">• {leaf.label}:</span>{' '}
                                <span className="text-slate-600">{leaf.description}</span>
                              </div>
                              {leaf.children && leaf.children.length > 0 && (
                                <div className="pl-4 space-y-0.5 border-l border-slate-100 text-[11px]">
                                  {leaf.children.map((sub) => (
                                    <div key={sub.id} className="text-slate-600">
                                      <span className="font-semibold text-slate-800">- {sub.label}:</span>{' '}
                                      {sub.description}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 text-xs">
          Selecciona un tema arriba y pulsa "Generar desde Cornell con Gemini" para renderizar la estructura jerárquica con D3.js.
        </div>
      )}
    </div>
  );
};
