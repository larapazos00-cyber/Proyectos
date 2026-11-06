import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import {
  PieChart as PieIcon,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
  Info,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Subject, Topic } from '../types';

interface CategoryCompletionPieChartProps {
  subjects: Subject[];
  activeSubjectId?: string;
  onSelectSubject?: (subjectId: string) => void;
}

export interface CategoryStat {
  name: string;
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  pendingTopics: number;
  completionRate: number; // Porcentaje de completitud de la categoría (0-100)
  shareOfCompleted: number; // Aportación relativa al total de completados (0-100)
  color: string;
  topics: Topic[];
}

const PALETTE = [
  '#3b82f6', // Azul
  '#10b981', // Esmeralda
  '#f59e0b', // Ámbar
  '#8b5cf6', // Violeta
  '#ec4899', // Rosa
  '#06b6d4', // Cian
  '#f97316', // Naranja
  '#6366f1', // Índigo
  '#14b8a6', // Turquesa
  '#84cc16', // Lima
];

/**
 * Infiere o normaliza la categoría / área temática de un tema
 */
export function getTopicCategory(topic: Topic): string {
  if (topic.category && topic.category.trim()) {
    return topic.category.trim();
  }
  // Inferencia inteligente por palabras clave habituales
  const lowerTitle = (topic.title + ' ' + (topic.description || '')).toLowerCase();
  if (lowerTitle.includes('esquelet') || lowerTitle.includes('hueso') || lowerTitle.includes('articulac') || lowerTitle.includes('artrolog')) {
    return 'Osteología y Artrología';
  }
  if (lowerTitle.includes('brazo') || lowerTitle.includes('hombro') || lowerTitle.includes('escapul') || lowerTitle.includes('superior') || lowerTitle.includes('mano')) {
    return 'Miembro Superior';
  }
  if (lowerTitle.includes('pierna') || lowerTitle.includes('muslo') || lowerTitle.includes('pélv') || lowerTitle.includes('coxofem') || lowerTitle.includes('pie') || lowerTitle.includes('inferior')) {
    return 'Miembro Inferior';
  }
  if (lowerTitle.includes('enzim') || lowerTitle.includes('proteín') || lowerTitle.includes('cinétic')) {
    return 'Enzimología y Cinética';
  }
  if (lowerTitle.includes('glucólisis') || lowerTitle.includes('krebs') || lowerTitle.includes('metabol') || lowerTitle.includes('glúcid')) {
    return 'Metabolismo Intermedio';
  }
  if (lowerTitle.includes('electrón') || lowerTitle.includes('mitocondr') || lowerTitle.includes('atp') || lowerTitle.includes('oxidat')) {
    return 'Bioenergética Mitocondrial';
  }
  if (lowerTitle.includes('membrana') || lowerTitle.includes('potencial') || lowerTitle.includes('neurona') || lowerTitle.includes('sinaps')) {
    return 'Neurofisiología';
  }
  if (lowerTitle.includes('cardíac') || lowerTitle.includes('corazón') || lowerTitle.includes('vascular') || lowerTitle.includes('hemodinám')) {
    return 'Cardiovascular';
  }
  if (lowerTitle.includes('respirat') || lowerTitle.includes('pulmon') || lowerTitle.includes('ventilac')) {
    return 'Respiratorio';
  }
  if (lowerTitle.includes('renal') || lowerTitle.includes('nefron') || lowerTitle.includes('riñón')) {
    return 'Fisiología Renal';
  }
  return 'General / Troncal';
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
}

const CustomPieTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data: CategoryStat = payload[0].payload;
    return (
      <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700/80 text-xs backdrop-blur-sm min-w-[210px] animate-fadeIn z-50">
        <div className="font-bold text-slate-100 border-b border-slate-700/80 pb-1.5 mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 truncate">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: data.color }}
            />
            <span className="truncate">{data.name}</span>
          </span>
          <span className="text-[11px] font-mono-numbers px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 shrink-0 font-bold">
            {data.completionRate}%
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-300">
            <span>Temas completados:</span>
            <span className="font-bold font-mono-numbers text-emerald-400">
              {data.completedTopics} de {data.totalTopics}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>Aportación al total completado:</span>
            <span className="font-bold font-mono-numbers text-blue-400">
              {data.shareOfCompleted}%
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>En progreso: {data.inProgressTopics}</span>
            <span>Pendientes: {data.pendingTopics}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const CategoryCompletionPieChart: React.FC<CategoryCompletionPieChartProps> = ({
  subjects,
  activeSubjectId,
  onSelectSubject,
}) => {
  // Asignatura activa seleccionada (por prop o por estado local inicializado)
  const [internalSubjectId, setInternalSubjectId] = useState<string>(() => {
    return activeSubjectId || (subjects[0] ? subjects[0].id : '');
  });

  // Modo de visualización: 'proporcion_completados' (peso de cada categoría sobre los completados) vs 'tasa_avance' (tasa completada de cada área)
  const [chartMode, setChartMode] = useState<'proporcion_completados' | 'tasa_avance'>('proporcion_completados');

  const currentSubjectId = activeSubjectId || internalSubjectId;
  const currentSubject = subjects.find((s) => s.id === currentSubjectId) || subjects[0];

  const handleSubjectChange = (id: string) => {
    setInternalSubjectId(id);
    if (onSelectSubject) {
      onSelectSubject(id);
    }
  };

  // Procesamiento y agrupación de temas por categoría / área de conocimiento
  const { categoryStats, totalSubjectTopics, totalCompletedSubjectTopics, overallSubjectRate } =
    useMemo(() => {
      if (!currentSubject || !currentSubject.topics || currentSubject.topics.length === 0) {
        return {
          categoryStats: [],
          totalSubjectTopics: 0,
          totalCompletedSubjectTopics: 0,
          overallSubjectRate: 0,
        };
      }

      const totalTopics = currentSubject.topics.length;
      const completedTopicsList = currentSubject.topics.filter(
        (t) => t.status === 'estudiado' || t.status === 'repasado'
      );
      const totalCompleted = completedTopicsList.length;
      const overallRate = totalTopics > 0 ? Math.round((totalCompleted / totalTopics) * 100) : 0;

      // Agrupar temas por categoría
      const groupMap: Record<string, Topic[]> = {};
      currentSubject.topics.forEach((t) => {
        const cat = getTopicCategory(t);
        if (!groupMap[cat]) {
          groupMap[cat] = [];
        }
        groupMap[cat].push(t);
      });

      const categories = Object.keys(groupMap);
      const stats: CategoryStat[] = categories.map((catName, index) => {
        const topics = groupMap[catName];
        const catTotal = topics.length;
        const catCompleted = topics.filter(
          (t) => t.status === 'estudiado' || t.status === 'repasado'
        ).length;
        const catInProgress = topics.filter((t) => t.status === 'en_progreso').length;
        const catPending = topics.filter((t) => t.status === 'pendiente').length;

        const completionRate = catTotal > 0 ? Math.round((catCompleted / catTotal) * 100) : 0;
        const shareOfCompleted =
          totalCompleted > 0 ? Math.round((catCompleted / totalCompleted) * 100) : 0;

        return {
          name: catName,
          totalTopics: catTotal,
          completedTopics: catCompleted,
          inProgressTopics: catInProgress,
          pendingTopics: catPending,
          completionRate,
          shareOfCompleted,
          color: PALETTE[index % PALETTE.length],
          topics,
        };
      });

      return {
        categoryStats: stats,
        totalSubjectTopics: totalTopics,
        totalCompletedSubjectTopics: totalCompleted,
        overallSubjectRate: overallRate,
      };
    }, [currentSubject]);

  // Datos adaptados para el Recharts PieChart según el modo activo
  const pieData = useMemo(() => {
    if (categoryStats.length === 0) return [];

    if (chartMode === 'proporcion_completados') {
      // Si hay temas completados, mostramos la distribución de los completados por área
      if (totalCompletedSubjectTopics > 0) {
        return categoryStats
          .filter((cat) => cat.completedTopics > 0)
          .map((cat) => ({
            ...cat,
            value: cat.completedTopics,
            displayPercent: cat.shareOfCompleted,
          }));
      }
      // Si aún no hay temas completados, mostramos la distribución total de temas por categoría como referencia
      return categoryStats.map((cat) => ({
        ...cat,
        value: cat.totalTopics,
        displayPercent: Math.round((cat.totalTopics / totalSubjectTopics) * 100),
      }));
    } else {
      // Modo 'tasa_avance': porcentaje completado por área
      return categoryStats.map((cat) => ({
        ...cat,
        value: Math.max(cat.completionRate, 2), // valor mínimo para no desaparecer
        actualRate: cat.completionRate,
        displayPercent: cat.completionRate,
      }));
    }
  }, [categoryStats, chartMode, totalCompletedSubjectTopics, totalSubjectTopics]);

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6 transition-colors">
      {/* Encabezado: Título + Selector de Asignatura Activa */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
              <PieIcon className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Desglose de Temas Completados por Área de Conocimiento
            </h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visualiza el avance del temario clasificado por categorías temáticas en la asignatura activa.
          </p>
        </div>

        {/* Selector de Asignatura Activa y Alternador de Modo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de materia */}
          <div className="relative">
            <select
              value={currentSubject?.id || ''}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
              title="Seleccionar asignatura para ver el desglose de categorías"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code || 'ASIG'})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Toggle de modo del gráfico */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setChartMode('proporcion_completados')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                chartMode === 'proporcion_completados'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Distribución relativa de los temas completados entre las distintas áreas"
            >
              Distribución Completados
            </button>
            <button
              type="button"
              onClick={() => setChartMode('tasa_avance')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                chartMode === 'tasa_avance'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Porcentaje de completitud específico alcanzado dentro de cada categoría"
            >
              % Avance por Área
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal: Gráfico de Pastel + Desglose Detallado */}
      {currentSubject && totalSubjectTopics > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Columna Izquierda: Gráfico de Pastel (Donut Pie Chart) con métrica central */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
            <div className="w-full h-72 sm:h-80 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={105}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || PALETTE[index % PALETTE.length]}
                        className="transition-all duration-300 hover:opacity-85 cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: '16px',
                      fontSize: '11px',
                    }}
                    formatter={(value) => {
                      const stat = categoryStats.find((c) => c.name === value);
                      if (!stat) return value;
                      return (
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {value} ({stat.completedTopics}/{stat.totalTopics})
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Métrica Central en el Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                  {overallSubjectRate}%
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Completado
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                  {totalCompletedSubjectTopics} de {totalSubjectTopics} temas
                </span>
              </div>
            </div>

            {totalCompletedSubjectTopics === 0 && (
              <div className="mt-2 text-center text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2.5 rounded-xl w-full max-w-sm">
                <span className="font-semibold">Sin temas completados aún: </span>
                <span>Se muestra el peso total del temario por área hasta registrar el primer estudio.</span>
              </div>
            )}
          </div>

          {/* Columna Derecha: Tarjetas y Barras de Desglose por Categoría */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
              <span>Área de Conocimiento</span>
              <span>Progreso y Proporción</span>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {categoryStats.map((cat) => (
                <div
                  key={cat.name}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono-numbers">
                        ({cat.totalTopics} {cat.totalTopics === 1 ? 'tema' : 'temas'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono-numbers text-slate-600 dark:text-slate-300">
                        {cat.completedTopics}/{cat.totalTopics}
                      </span>
                      <span
                        className={`text-xs font-bold font-mono-numbers px-2 py-0.5 rounded-md ${
                          cat.completionRate === 100
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : cat.completionRate > 0
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {cat.completionRate}%
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso de la categoría */}
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${cat.completionRate}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>

                  {/* Lista de temas resumidos de esta categoría */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {cat.topics.map((t) => {
                      const isDone = t.status === 'estudiado' || t.status === 'repasado';
                      return (
                        <span
                          key={t.id}
                          className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            isDone
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-medium'
                              : t.status === 'en_progreso'
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                          title={`${t.title} (${t.status})`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                          )}
                          <span className="max-w-[140px] truncate">{t.title}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Estado vacío si la materia no tiene temas aún */
        <div className="text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Sin temas registrados en esta asignatura
          </h5>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Añade temas desde la sección de Materias para comenzar a clasificar y analizar el progreso por áreas de conocimiento.
          </p>
        </div>
      )}

      {/* Pie de tarjeta con contexto pedagógico */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>
            {currentSubject?.name}: {totalCompletedSubjectTopics} de {totalSubjectTopics} temas estudiados ({overallSubjectRate}% global).
          </span>
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          Clasificación adaptativa por módulos de conocimiento.
        </span>
      </div>
    </div>
  );
};
