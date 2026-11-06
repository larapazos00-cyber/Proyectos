import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  HelpCircle,
  Eye,
  EyeOff,
  Download,
  Search,
  Layers,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { MindmapNode } from '../types';

interface D3MindMapCanvasProps {
  rootNode: MindmapNode;
  title?: string;
  summary?: string;
  subjectColor?: string;
  height?: number;
}

const BRANCH_PALETTE = [
  { main: '#2563eb', light: '#eff6ff', border: '#93c5fd', text: '#1e3a8a' }, // Blue
  { main: '#7c3aed', light: '#f5f3ff', border: '#c4b5fd', text: '#4c1d95' }, // Violet
  { main: '#059669', light: '#ecfdf5', border: '#6ee7b7', text: '#064e3b' }, // Emerald
  { main: '#d97706', light: '#fffbeb', border: '#fcd34d', text: '#78350f' }, // Amber
  { main: '#db2777', light: '#fdf2f8', border: '#f9a8d4', text: '#831843' }, // Pink
  { main: '#0891b2', light: '#ecfeff', border: '#67e8f9', text: '#164e63' }, // Cyan
];

const CORNELL_SECTION_BADGES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  core: {
    label: 'Tema Central',
    bg: 'bg-slate-900',
    text: 'text-white',
    border: 'border-slate-700',
  },
  cue: {
    label: 'Columna Cue (Pregunta Clave)',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
  },
  notes: {
    label: 'Cuerpo de Notas Cornell',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-300',
  },
  summary: {
    label: 'Resumen Cornell',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
  },
};

export const D3MindMapCanvas: React.FC<D3MindMapCanvasProps> = ({
  rootNode,
  title,
  summary,
  height = 560,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<MindmapNode | null>(rootNode);
  const [showCueAnswer, setShowCueAnswer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomPercent, setZoomPercent] = useState(100);

  // Sync selectedNode when rootNode changes
  useEffect(() => {
    setSelectedNode(rootNode);
    setCollapsedIds(new Set());
    setShowCueAnswer(false);
  }, [rootNode]);

  // Count total descendants of a raw MindmapNode
  const countDirectAndIndirectChildren = useCallback((node: MindmapNode): number => {
    if (!node.children || node.children.length === 0) return 0;
    return node.children.reduce(
      (acc, child) => acc + 1 + countDirectAndIndirectChildren(child),
      0
    );
  }, []);

  // Map each node id to its original hidden children count when collapsed
  const originalChildrenMap = useMemo(() => {
    const map = new Map<string, { direct: number; total: number; raw: MindmapNode }>();
    const traverse = (n: MindmapNode) => {
      map.set(n.id, {
        direct: n.children ? n.children.length : 0,
        total: countDirectAndIndirectChildren(n),
        raw: n,
      });
      n.children?.forEach(traverse);
    };
    if (rootNode) traverse(rootNode);
    return map;
  }, [rootNode, countDirectAndIndirectChildren]);

  // Build pruned tree respecting collapsedIds
  const visibleTreeData = useMemo(() => {
    const cloneWithCollapse = (node: MindmapNode): MindmapNode => {
      const isCollapsed = collapsedIds.has(node.id);
      return {
        ...node,
        children:
          isCollapsed || !node.children
            ? undefined
            : node.children.map((child) => cloneWithCollapse(child)),
      };
    };
    return cloneWithCollapse(rootNode);
  }, [rootNode, collapsedIds]);

  // Compute D3 Hierarchy and Tree Layout
  const { nodes, links, branchIndexMap } = useMemo(() => {
    const rootHierarchy = d3.hierarchy<MindmapNode>(visibleTreeData);

    // Assign each node a branch color index based on its depth-1 ancestor
    const bMap = new Map<string, number>();
    rootHierarchy.children?.forEach((branchChild, idx) => {
      branchChild.each((descendant) => {
        bMap.set(descendant.data.id, idx % BRANCH_PALETTE.length);
      });
    });

    const treeLayout =
      orientation === 'horizontal'
        ? d3.tree<MindmapNode>().nodeSize([88, 280])
        : d3.tree<MindmapNode>().nodeSize([240, 145]);

    const treeRoot = treeLayout(rootHierarchy);

    return {
      nodes: treeRoot.descendants(),
      links: treeRoot.links(),
      branchIndexMap: bMap,
    };
  }, [visibleTreeData, orientation]);

  // Fit tree into SVG viewport using d3.zoom
  const fitToScreen = useCallback(() => {
    const svgEl = svgRef.current;
    const gEl = gRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgEl || !gEl || !zoomBehavior) return;

    const svgRect = svgEl.getBoundingClientRect();
    const bbox = gEl.getBBox();
    if (bbox.width === 0 || bbox.height === 0) return;

    const padding = 64;
    const scaleX = (svgRect.width - padding * 2) / bbox.width;
    const scaleY = (svgRect.height - padding * 2) / bbox.height;
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.15);

    const translateX =
      svgRect.width / 2 - (bbox.x + bbox.width / 2) * scale;
    const translateY =
      svgRect.height / 2 - (bbox.y + bbox.height / 2) * scale;

    d3.select(svgEl)
      .transition()
      .duration(400)
      .call(
        zoomBehavior.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(scale)
      );
  }, []);

  // Initialize D3 Zoom behavior
  useEffect(() => {
    const svgEl = svgRef.current;
    const gEl = gRef.current;
    if (!svgEl || !gEl) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 2.5])
      .on('zoom', (event) => {
        d3.select(gEl).attr('transform', event.transform.toString());
        setZoomPercent(Math.round(event.transform.k * 100));
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svgEl).call(zoom).on('dblclick.zoom', null);

    // Initial fit
    const timer = setTimeout(() => {
      fitToScreen();
    }, 60);

    return () => clearTimeout(timer);
  }, [fitToScreen, rootNode, orientation]);

  const handleZoomBy = (factor: number) => {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgEl || !zoomBehavior) return;
    d3.select(svgEl).transition().duration(220).call(zoomBehavior.scaleBy, factor);
  };

  const toggleNodeCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeId === rootNode.id) return;
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedIds(new Set());
    setTimeout(fitToScreen, 80);
  };

  const collapseToMainBranches = () => {
    const next = new Set<string>();
    rootNode.children?.forEach((branch) => {
      if (branch.children && branch.children.length > 0) {
        next.add(branch.id);
      }
    });
    setCollapsedIds(next);
    setTimeout(fitToScreen, 80);
  };

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgRef.current);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || rootNode.label || 'mapa-mental-cornell').replace(/\s+/g, '-').toLowerCase()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate D3 cubic Bézier link path
  const renderLinkPath = (link: d3.HierarchyPointLink<MindmapNode>) => {
    if (orientation === 'horizontal') {
      const generator = d3
        .linkHorizontal<d3.HierarchyPointLink<MindmapNode>, d3.HierarchyPointNode<MindmapNode>>()
        .x((d) => d.y)
        .y((d) => d.x);
      return generator(link) || '';
    } else {
      const generator = d3
        .linkVertical<d3.HierarchyPointLink<MindmapNode>, d3.HierarchyPointNode<MindmapNode>>()
        .x((d) => d.x)
        .y((d) => d.y);
      return generator(link) || '';
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  return (
    <div className="flex flex-col lg:flex-row bg-slate-50/70 rounded-2xl border border-slate-200 overflow-hidden">
      {/* Left / Main D3 Interactive Canvas */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* D3 Toolbar */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold text-[11px]">
              <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
              <span>D3.js Hierarchy ({originalChildrenMap.size} nodos)</span>
            </span>

            {/* Orientation toggle */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setOrientation('horizontal')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  orientation === 'horizontal'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Horizontal
              </button>
              <button
                type="button"
                onClick={() => setOrientation('vertical')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  orientation === 'vertical'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vertical
              </button>
            </div>

            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium cursor-pointer transition-colors"
              title="Expandir todos los niveles jerárquicos"
            >
              Expandir todo
            </button>
            <button
              type="button"
              onClick={collapseToMainBranches}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium cursor-pointer transition-colors"
              title="Plegar subramas y mostrar solo ejes principales"
            >
              Solo ejes Cornell
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar concepto..."
                className="pl-7 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg w-36 sm:w-44 focus:outline-none focus:border-blue-500 text-slate-800"
              />
            </div>

            {/* Zoom Controls */}
            <div className="inline-flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleZoomBy(0.8)}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                title="Alejar"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] w-11 text-center text-slate-700 font-semibold">
                {zoomPercent}%
              </span>
              <button
                type="button"
                onClick={() => handleZoomBy(1.25)}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                title="Acercar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={fitToScreen}
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                title="Centrar y ajustar a pantalla"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadSvg}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold cursor-pointer"
              title="Descargar gráfico vectorial SVG"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">SVG</span>
            </button>
          </div>
        </div>

        {/* SVG Canvas with D3 Pan & Zoom */}
        <div className="relative flex-1 bg-slate-50 overflow-hidden select-none" style={{ height }}>
          {/* Subtle dot grid pattern */}
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            style={{ minHeight: height }}
          >
            <defs>
              <pattern id="d3-cornell-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#cbd5e1" opacity="0.65" />
              </pattern>
              <filter id="d3-node-shadow" x="-12%" y="-12%" width="124%" height="128%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.08" />
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#d3-cornell-grid)" />

            <g ref={gRef}>
              {/* Links (Cubic Bézier Paths) */}
              {links.map((link) => {
                const targetId = link.target.data.id;
                const branchIdx = branchIndexMap.get(targetId) ?? 0;
                const palette = BRANCH_PALETTE[branchIdx];
                return (
                  <path
                    key={`link-${link.source.data.id}-${targetId}`}
                    d={renderLinkPath(link)}
                    fill="none"
                    stroke={palette.main}
                    strokeWidth={link.source.depth === 0 ? 2.6 : 1.8}
                    strokeOpacity={0.55}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const data = node.data;
                const isRoot = node.depth === 0;
                const branchIdx = branchIndexMap.get(data.id) ?? 0;
                const palette = BRANCH_PALETTE[branchIdx];
                const isSelected = selectedNode?.id === data.id;
                const meta = originalChildrenMap.get(data.id);
                const hasChildren = (meta?.direct ?? 0) > 0;
                const isCollapsed = collapsedIds.has(data.id);

                const matchesSearch =
                  normalizedQuery.length > 0 &&
                  (data.label.toLowerCase().includes(normalizedQuery) ||
                    data.description.toLowerCase().includes(normalizedQuery) ||
                    (data.category && data.category.toLowerCase().includes(normalizedQuery)));

                // Coordinates depend on orientation
                const cx = orientation === 'horizontal' ? node.y : node.x;
                const cy = orientation === 'horizontal' ? node.x : node.y;

                const boxWidth = isRoot ? 226 : node.depth === 1 ? 210 : 196;
                const boxHeight = isRoot ? 66 : 60;

                const fillBg = isRoot
                  ? '#0f172a'
                  : matchesSearch
                  ? '#fef08a'
                  : node.depth === 1
                  ? palette.light
                  : '#ffffff';

                const strokeColor = isSelected
                  ? '#2563eb'
                  : matchesSearch
                  ? '#ca8a04'
                  : isRoot
                  ? '#1e293b'
                  : palette.border;

                const labelText =
                  data.label.length > 30 ? `${data.label.slice(0, 28)}…` : data.label;
                const subText =
                  data.category ||
                  (data.cornellSection === 'cue'
                    ? 'Pregunta Cue'
                    : data.cornellSection === 'summary'
                    ? 'Resumen Cornell'
                    : isRoot
                    ? 'Nodo Raíz'
                    : 'Apunte Cornell');

                return (
                  <g
                    key={data.id}
                    transform={`translate(${cx},${cy})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rawNode = meta?.raw || data;
                      setSelectedNode(rawNode);
                      setShowCueAnswer(false);
                    }}
                    className="cursor-pointer transition-opacity"
                  >
                    {/* Node Card */}
                    <rect
                      x={-boxWidth / 2}
                      y={-boxHeight / 2}
                      width={boxWidth}
                      height={boxHeight}
                      rx={14}
                      fill={fillBg}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 2.8 : 1.6}
                      filter="url(#d3-node-shadow)"
                    />

                    {/* Left accent bar for non-root nodes */}
                    {!isRoot && (
                      <rect
                        x={-boxWidth / 2 + 4}
                        y={-boxHeight / 2 + 8}
                        width={4.5}
                        height={boxHeight - 16}
                        rx={2.25}
                        fill={palette.main}
                      />
                    )}

                    {/* Category / Section Pill */}
                    <text
                      x={isRoot ? 0 : -boxWidth / 2 + 16}
                      y={-8}
                      textAnchor={isRoot ? 'middle' : 'start'}
                      fill={isRoot ? '#93c5fd' : palette.main}
                      fontSize={9.5}
                      fontWeight={700}
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {subText.toUpperCase()}
                    </text>

                    {/* Primary Label */}
                    <text
                      x={isRoot ? 0 : -boxWidth / 2 + 16}
                      y={11}
                      textAnchor={isRoot ? 'middle' : 'start'}
                      fill={isRoot ? '#ffffff' : '#0f172a'}
                      fontSize={isRoot ? 12.5 : 11.5}
                      fontWeight={700}
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {labelText}
                    </text>

                    {/* Collapse / Expand toggle button if node has children */}
                    {hasChildren && !isRoot && (
                      <g
                        transform={
                          orientation === 'horizontal'
                            ? `translate(${boxWidth / 2 + 2}, 0)`
                            : `translate(0, ${boxHeight / 2 + 2})`
                        }
                        onClick={(e) => toggleNodeCollapse(data.id, e)}
                      >
                        <circle
                          r={11}
                          fill={isCollapsed ? palette.main : '#ffffff'}
                          stroke={palette.main}
                          strokeWidth={1.6}
                        />
                        <text
                          textAnchor="middle"
                          dy="0.35em"
                          fontSize={9.5}
                          fontWeight={700}
                          fill={isCollapsed ? '#ffffff' : palette.main}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {isCollapsed ? `+${meta?.direct || ''}` : '−'}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Bottom-left legend overlay */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-xl px-3 py-1.5 text-[11px] text-slate-600 flex items-center gap-3 shadow-2xs pointer-events-none">
            <span>Arrastra para mover · Rueda para zoom · Clic en nodo para ver detalle Cornell</span>
          </div>
        </div>
      </div>

      {/* Right Inspector Sidebar for Selected Node */}
      <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white p-5 flex flex-col justify-between gap-4">
        {selectedNode ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                {(() => {
                  const sectionKey = selectedNode.cornellSection || 'notes';
                  const badge =
                    CORNELL_SECTION_BADGES[sectionKey] || CORNELL_SECTION_BADGES.notes;
                  return (
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border mb-1.5 ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {badge.label}
                    </span>
                  );
                })()}
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  {selectedNode.label}
                </h4>
                {selectedNode.category && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    Categoría: {selectedNode.category}
                  </span>
                )}
              </div>
            </div>

            {/* Detailed Explanation from Cornell Notes */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Desarrollo en Apuntes Cornell</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                {selectedNode.description}
              </p>
            </div>

            {/* Active Recall Cue Question */}
            {selectedNode.cueQuestion && (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Pregunta Detonadora (Cue Cornell)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCueAnswer((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded cursor-pointer"
                  >
                    {showCueAnswer ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>Comprobar</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs font-semibold text-amber-950">
                  {selectedNode.cueQuestion}
                </p>
                {showCueAnswer && (
                  <div className="pt-2 border-t border-amber-200/80 text-xs text-slate-700">
                    <strong className="text-emerald-800">Respuesta clave:</strong>{' '}
                    {selectedNode.description}
                  </div>
                )}
              </div>
            )}

            {/* Sub-concepts list */}
            {selectedNode.children && selectedNode.children.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Subramas Directas ({selectedNode.children.length})</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedNode.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => {
                        const rawChild = originalChildrenMap.get(child.id)?.raw || child;
                        setSelectedNode(rawChild);
                        setShowCueAnswer(false);
                        if (collapsedIds.has(selectedNode.id)) {
                          setCollapsedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(selectedNode.id);
                            return next;
                          });
                        }
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-300 transition-all flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {child.label}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {child.description}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400 text-center py-8">
            Haz clic en cualquier nodo del árbol D3.js para inspeccionar sus apuntes Cornell.
          </div>
        )}

        {/* Executive Summary Footer */}
        {summary && (
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            <span className="font-bold text-slate-700 block mb-0.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>Síntesis General del Tema:</span>
            </span>
            <p className="line-clamp-3">{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
};
