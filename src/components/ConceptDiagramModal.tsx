import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Copy,
  Check,
  X,
  Loader2,
  BookOpen,
  ArrowRight,
  Info,
  Maximize2,
  Minimize2,
  FileText,
  Network,
  Code2,
  Share2,
} from 'lucide-react';
import mermaid from 'mermaid';
import { Topic, CornellNote } from '../types';

interface ConceptNode {
  id: string;
  label: string;
  category: string;
  description: string;
  keyTakeaway?: string;
}

interface ConceptDiagramData {
  svg: string;
  mermaid: string;
  summary: string;
  nodes: ConceptNode[];
}

interface ConceptDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  initialTopic?: Topic | null;
  topics: Topic[];
  cornellNotes?: CornellNote[];
}

export const ConceptDiagramModal: React.FC<ConceptDiagramModalProps> = ({
  isOpen,
  onClose,
  subjectName,
  initialTopic,
  topics,
  cornellNotes = [],
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    initialTopic ? initialTopic.id : topics[0]?.id || ''
  );
  const [customTopicTitle, setCustomTopicTitle] = useState<string>(
    initialTopic ? initialTopic.title : ''
  );
  const [customTopicContext, setCustomTopicContext] = useState<string>(
    initialTopic ? (initialTopic.notes || initialTopic.description || initialTopic.subtopics.join(', ')) : ''
  );

  const [activeTab, setActiveTab] = useState<'mermaid' | 'svg' | 'nodes' | 'code'>('mermaid');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [diagramData, setDiagramData] = useState<ConceptDiagramData | null>(null);
  const [renderedMermaidSvg, setRenderedMermaidSvg] = useState<string>('');
  const [mermaidRenderError, setMermaidRenderError] = useState<string | null>(null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<ConceptNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Zoom & Pan
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [copiedMermaid, setCopiedMermaid] = useState<boolean>(false);
  const [orientation, setOrientation] = useState<'TD' | 'LR'>('TD');

  const mermaidContainerRef = useRef<HTMLDivElement>(null);

  // Initialize mermaid on mount
  useEffect(() => {
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
  }, []);

  // Update initial topic selection
  useEffect(() => {
    if (initialTopic) {
      setSelectedTopicId(initialTopic.id);
      setCustomTopicTitle(initialTopic.title);
      const noteForTopic = cornellNotes.find((cn) => cn.topicId === initialTopic.id);
      const notesText = initialTopic.notes || noteForTopic?.notes || initialTopic.description || initialTopic.subtopics.join(', ');
      setCustomTopicContext(notesText);
    }
  }, [initialTopic, cornellNotes]);

  if (!isOpen) return null;

  const currentSelectedTopic = topics.find((t) => t.id === selectedTopicId);
  const matchingNote = cornellNotes.find((cn) => cn.topicId === selectedTopicId);
  const hasLoadedNotes = Boolean(
    (currentSelectedTopic?.notes && currentSelectedTopic.notes.trim().length > 0) ||
    (matchingNote?.notes && matchingNote.notes.trim().length > 0)
  );

  const handleTopicChange = (topicId: string) => {
    setSelectedTopicId(topicId);
    const found = topics.find((t) => t.id === topicId);
    if (found) {
      setCustomTopicTitle(found.title);
      const note = cornellNotes.find((cn) => cn.topicId === topicId);
      const notesText = found.notes || note?.notes || found.description || found.subtopics.join(', ');
      setCustomTopicContext(notesText);
    }
  };

  // Render Mermaid code to SVG via Mermaid.js
  const renderMermaidCode = async (mermaidCode: string, targetOrientation: 'TD' | 'LR') => {
    setMermaidRenderError(null);
    try {
      let codeToRender = mermaidCode.trim();
      // Remove any markdown fence if present
      codeToRender = codeToRender.replace(/^```(mermaid)?\n?/i, '').replace(/\n?```$/i, '').trim();

      // Ensure proper orientation
      if (targetOrientation === 'LR' && codeToRender.startsWith('graph TD')) {
        codeToRender = codeToRender.replace('graph TD', 'graph LR');
      } else if (targetOrientation === 'LR' && codeToRender.startsWith('flowchart TD')) {
        codeToRender = codeToRender.replace('flowchart TD', 'flowchart LR');
      } else if (targetOrientation === 'TD' && codeToRender.startsWith('graph LR')) {
        codeToRender = codeToRender.replace('graph LR', 'graph TD');
      } else if (targetOrientation === 'TD' && codeToRender.startsWith('flowchart LR')) {
        codeToRender = codeToRender.replace('flowchart LR', 'flowchart TD');
      }

      const id = `mermaid-canvas-${Date.now()}`;
      const { svg } = await mermaid.render(id, codeToRender);
      setRenderedMermaidSvg(svg);
    } catch (err: any) {
      console.warn('Mermaid render error:', err);
      setMermaidRenderError(
        'El mapa conceptual se generó con éxito. Si algún conector complejo no se previsualiza en vivo, puedes ver la vista SVG estilizada o el código fuente.'
      );
    }
  };

  const handleGenerateDiagram = async () => {
    const title = customTopicTitle.trim() || currentSelectedTopic?.title;
    if (!title) {
      setError('Por favor introduce o selecciona el tema a diagramar.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setZoomScale(1);
    setSelectedNodeDetails(null);

    const notesContent = currentSelectedTopic?.notes || matchingNote?.notes || '';
    const cues = currentSelectedTopic?.cues || matchingNote?.cues || [];
    const summary = currentSelectedTopic?.summary || matchingNote?.summary || '';

    try {
      const response = await fetch('/api/gemini/generate-concept-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: title,
          topicContent: customTopicContext.trim() || currentSelectedTopic?.description || '',
          notesContent,
          cues,
          summary,
          subjectName,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        // Clean svg if it has markdown code block fences
        let cleanedSvg = resData.data.svg || '';
        cleanedSvg = cleanedSvg.replace(/^```(svg|xml)?\n?/i, '').replace(/\n?```$/i, '').trim();

        // Clean mermaid code
        let cleanedMermaid = resData.data.mermaid || '';
        cleanedMermaid = cleanedMermaid.replace(/^```(mermaid)?\n?/i, '').replace(/\n?```$/i, '').trim();

        const data: ConceptDiagramData = {
          ...resData.data,
          svg: cleanedSvg,
          mermaid: cleanedMermaid,
        };

        setDiagramData(data);
        if (data.nodes.length > 0) {
          setSelectedNodeDetails(data.nodes[0]);
        }

        // Render Mermaid.js
        await renderMermaidCode(cleanedMermaid, orientation);
      } else {
        throw new Error(resData.error || 'No se pudo generar la representación visual.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de conexión al generar el diagrama con Gemini.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle layout orientation (TD vs LR)
  const handleToggleOrientation = async (newOri: 'TD' | 'LR') => {
    setOrientation(newOri);
    if (diagramData?.mermaid) {
      await renderMermaidCode(diagramData.mermaid, newOri);
    }
  };

  const handleDownloadSVG = () => {
    const content = activeTab === 'mermaid' && renderedMermaidSvg ? renderedMermaidSvg : diagramData?.svg;
    if (!content) return;
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanTitle = (customTopicTitle || 'mapa_conceptual').replace(/\s+/g, '_').toLowerCase();
    a.download = `${cleanTitle}_mapa_conceptual_mermaid.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMermaid = () => {
    if (!diagramData?.mermaid) return;
    navigator.clipboard.writeText(diagramData.mermaid);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-slate-200 w-full transition-all flex flex-col overflow-hidden animate-in fade-in duration-200 ${
          isFullScreen ? 'h-[98vh] max-w-[98vw]' : 'h-[92vh] max-w-6xl'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Mapa Conceptual Interactivo (Mermaid.js)
                </h2>
                <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Gemini Flash + Mermaid
                </span>
                {hasLoadedNotes && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <FileText className="w-3 h-3 text-emerald-600" />
                    Basado en Apuntes
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {subjectName} · Generación visual de grafos y jerarquías a partir de los apuntes y temario
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title={isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel: Topic selection and prompt controls */}
          <div className="w-full md:w-80 lg:w-88 border-b md:border-b-0 md:border-r border-slate-100 p-5 overflow-y-auto space-y-4 shrink-0 bg-slate-50/50">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tema de la Asignatura
              </label>
              <select
                value={selectedTopicId}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} {t.notes ? '📝 (Con apuntes)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Indicator of notes loaded */}
            {hasLoadedNotes ? (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Apuntes cargados detectados
                </span>
                <p className="text-[11px] text-emerald-800 leading-tight">
                  La IA estructurará el mapa Mermaid.js utilizando el contenido real de tus apuntes ({customTopicContext.length} caracteres).
                </p>
              </div>
            ) : (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  Modo Temario Oficial
                </span>
                <p className="text-[11px] text-blue-800 leading-tight">
                  Se sintetizará la estructura a partir del título y subtemas registrados en la materia.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Concepto Central o Título del Mapa
              </label>
              <input
                type="text"
                value={customTopicTitle}
                onChange={(e) => setCustomTopicTitle(e.target.value)}
                placeholder="Ej: Neurotransmisión, Termodinámica..."
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Apuntes o Texto Base a Graficar
              </label>
              <textarea
                value={customTopicContext}
                onChange={(e) => setCustomTopicContext(e.target.value)}
                placeholder="Pega o edita aquí los apuntes clave que quieras ver en el mapa conceptual..."
                rows={5}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans leading-relaxed"
              />
            </div>

            <button
              onClick={handleGenerateDiagram}
              disabled={isGenerating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Construyendo mapa con Gemini y Mermaid...</span>
                </>
              ) : (
                <>
                  <Network className="w-4 h-4" />
                  <span>{diagramData ? 'Regenerar Mapa Conceptual' : 'Generar Mapa Conceptual'}</span>
                </>
              )}
            </button>

            {/* Quick summary card if generated */}
            {diagramData?.summary && (
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2 text-xs">
                <span className="font-bold text-slate-900 block">
                  💡 Síntesis del Mapa Conceptual
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                  {diagramData.summary}
                </p>
              </div>
            )}
          </div>

          {/* Right Main Panel: Interactive Mermaid & SVG Viewer */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Control Bar: Tabs & Zoom & Orientation */}
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              {/* Tab navigation */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('mermaid')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'mermaid'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>Mermaid.js Interactivo</span>
                </button>

                <button
                  onClick={() => setActiveTab('svg')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'svg'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Diagrama SVG Estilizado</span>
                </button>

                <button
                  onClick={() => setActiveTab('nodes')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'nodes'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Conceptos ({diagramData?.nodes.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'code'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Código Fuente</span>
                </button>
              </div>

              {/* Actions & Zoom */}
              <div className="flex items-center gap-2">
                {activeTab === 'mermaid' && (
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs text-slate-700">
                    <button
                      onClick={() => handleToggleOrientation('TD')}
                      className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                        orientation === 'TD' ? 'bg-white shadow-2xs text-blue-700' : 'hover:text-slate-900'
                      }`}
                      title="Orientación Vertical (Top-Down)"
                    >
                      Vertical
                    </button>
                    <button
                      onClick={() => handleToggleOrientation('LR')}
                      className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                        orientation === 'LR' ? 'bg-white shadow-2xs text-blue-700' : 'hover:text-slate-900'
                      }`}
                      title="Orientación Horizontal (Left-to-Right)"
                    >
                      Horizontal
                    </button>
                  </div>
                )}

                {(activeTab === 'mermaid' || activeTab === 'svg') && (
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-slate-600">
                    <button
                      onClick={() => setZoomScale((prev) => Math.max(0.5, prev - 0.15))}
                      className="p-1 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Alejar"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono-numbers px-1.5 font-bold">
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomScale((prev) => Math.min(2.5, prev + 0.15))}
                      className="p-1 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Acercar"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomScale(1)}
                      className="p-1 hover:text-slate-900 transition-colors ml-1 border-l border-slate-200 cursor-pointer"
                      title="Restablecer Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {diagramData && (
                  <>
                    <button
                      onClick={handleDownloadSVG}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                      title="Descargar mapa como vector SVG"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Descargar SVG</span>
                    </button>

                    <button
                      onClick={handleCopyMermaid}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                      title="Copiar código Mermaid"
                    >
                      {copiedMermaid ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                      )}
                      <span>{copiedMermaid ? '¡Copiado!' : 'Copiar'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Diagram Display Area */}
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center relative bg-slate-50/30">
              {error && (
                <div className="absolute top-4 left-4 right-4 z-10 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {isGenerating ? (
                <div className="text-center space-y-4 py-20 animate-in fade-in">
                  <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
                    <Network className="w-7 h-7 text-blue-600 absolute" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Sintetizando apuntes y renderizando mapa Mermaid.js...
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Identificando conceptos clave, jerarquías de aprendizaje y dependencias lógicas.
                    </p>
                  </div>
                </div>
              ) : diagramData ? (
                <div className="w-full h-full flex flex-col justify-between">
                  {/* TAB 1: INTERACTIVE MERMAID.JS */}
                  {activeTab === 'mermaid' && (
                    <div className="w-full h-full flex flex-col items-center justify-center overflow-auto p-2">
                      {mermaidRenderError ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 max-w-md text-center space-y-2">
                          <p>{mermaidRenderError}</p>
                          <button
                            onClick={() => setActiveTab('svg')}
                            className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold"
                          >
                            Ver Diagrama SVG Estilizado
                          </button>
                        </div>
                      ) : renderedMermaidSvg ? (
                        <div
                          ref={mermaidContainerRef}
                          className="w-full h-full flex items-center justify-center overflow-auto cursor-grab active:cursor-grabbing p-4"
                        >
                          <div
                            className="transition-transform duration-150 ease-out max-w-full max-h-full flex items-center justify-center"
                            style={{
                              transform: `scale(${zoomScale})`,
                              transformOrigin: 'center center',
                            }}
                            dangerouslySetInnerHTML={{ __html: renderedMermaidSvg }}
                          />
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs">Preparando renderizado Mermaid...</div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: SVG DIAGRAM */}
                  {activeTab === 'svg' && (
                    <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                      <div
                        className="transition-transform duration-150 ease-out max-w-full max-h-full flex items-center justify-center"
                        style={{
                          transform: `scale(${zoomScale})`,
                          transformOrigin: 'center center',
                        }}
                        dangerouslySetInnerHTML={{ __html: diagramData.svg }}
                      />
                    </div>
                  )}

                  {/* TAB 3: NODES EXPLORER */}
                  {activeTab === 'nodes' && (
                    <div className="w-full max-w-4xl h-full overflow-y-auto space-y-3 p-4 mx-auto">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {diagramData.nodes.map((node, idx) => {
                          const isSelected = selectedNodeDetails?.id === node.id;
                          return (
                            <div
                              key={node.id || idx}
                              onClick={() => setSelectedNodeDetails(node)}
                              className={`p-4 bg-white rounded-2xl border text-xs cursor-pointer transition-all space-y-2 ${
                                isSelected
                                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                                  : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                  {node.category || 'Concepto'}
                                </span>
                                <span className="text-xs font-mono-numbers text-slate-400">
                                  #{idx + 1}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-900">{node.label}</h4>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {node.description}
                              </p>
                              {node.keyTakeaway && (
                                <div className="pt-2 border-t border-slate-100 text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                                  <ArrowRight className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span>{node.keyTakeaway}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: CODE */}
                  {activeTab === 'code' && (
                    <div className="w-full max-w-4xl h-full overflow-y-auto p-4 bg-slate-900 rounded-2xl font-mono text-xs text-emerald-400 leading-relaxed mx-auto">
                      <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2 mb-3">
                        <span>Código Mermaid.js</span>
                        <button
                          onClick={handleCopyMermaid}
                          className="text-xs text-emerald-400 hover:text-white"
                        >
                          Copiar código
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap">{diagramData.mermaid}</pre>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty state when no diagram generated yet */
                <div className="text-center py-20 space-y-4 max-w-md">
                  <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                    <Network className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Genera el Mapa Conceptual con Mermaid.js
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Transforma tus apuntes o temario de <strong>{customTopicTitle || subjectName}</strong> en un esquema visual interactivo de nodos, jerarquías y conectores.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateDiagram}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Construir Mapa Conceptual con IA</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
