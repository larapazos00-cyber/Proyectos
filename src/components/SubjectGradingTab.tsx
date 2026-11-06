import React, { useState } from 'react';
import {
  Award,
  Calculator,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Percent,
  HelpCircle,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Subject, SubjectGradingConfig, GradingComponent } from '../types';

interface SubjectGradingTabProps {
  subject: Subject;
  onUpdateSubject: (updated: Subject) => void;
}

export const SubjectGradingTab: React.FC<SubjectGradingTabProps> = ({
  subject,
  onUpdateSubject,
}) => {
  // Initialize grading config with defaults if not present
  const gradingConfig: SubjectGradingConfig = subject.gradingConfig || {
    passingGrade: 5.0,
    targetGrade: 8.0,
    components: [
      {
        id: 'comp-1',
        name: 'Exámenes Oficiales (Teoría)',
        type: 'exam',
        weight: 50,
        grade: subject.exams[0]?.finalGrade !== undefined ? subject.exams[0].finalGrade : undefined,
      },
      {
        id: 'comp-2',
        name: 'Proyectos y Trabajos Prácticos',
        type: 'project',
        weight: 30,
        grade: subject.projects?.[0]?.finalGrade !== undefined ? subject.projects[0].finalGrade : undefined,
      },
      {
        id: 'comp-3',
        name: 'Evaluación Continua y Participación',
        type: 'continuous',
        weight: 20,
        grade: undefined,
      },
    ],
  };

  const [showAddComponent, setShowAddComponent] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompType, setNewCompType] = useState<GradingComponent['type']>('activity');
  const [newCompWeight, setNewCompWeight] = useState<string>('15');
  const [newCompGrade, setNewCompGrade] = useState<string>('');
  const [scaleMode, setScaleMode] = useState<'both' | 'numeric' | 'percentage'>(
    subject.gradingScaleMode || 'both'
  );

  const handleSetScaleMode = (mode: 'both' | 'numeric' | 'percentage') => {
    setScaleMode(mode);
    onUpdateSubject({
      ...subject,
      gradingScaleMode: mode,
    });
  };

  // Helper to format any 0-10 grade into chosen display scale
  const formatGrade = (val?: number): string => {
    if (val === undefined || isNaN(val)) return '—';
    const num = val.toFixed(2);
    const pct = (val * 10).toFixed(1) + '%';
    if (scaleMode === 'numeric') return `${num} / 10`;
    if (scaleMode === 'percentage') return pct;
    return `${num} / 10 (${pct})`;
  };

  // Update whole config
  const updateConfig = (newConfig: SubjectGradingConfig) => {
    onUpdateSubject({
      ...subject,
      gradingConfig: newConfig,
    });
  };

  // Sync with exams and projects in subject
  const handleSyncWithSubjectItems = () => {
    const existingComponents = [...gradingConfig.components];
    const newComponents: GradingComponent[] = [];

    // Add exams
    subject.exams.forEach((ex, idx) => {
      const match = existingComponents.find((c) => c.linkedId === ex.id);
      if (match) {
        newComponents.push({
          ...match,
          name: ex.title || `Examen ${idx + 1}`,
          grade: ex.finalGrade !== undefined ? ex.finalGrade : match.grade,
          weight: ex.weightPercentage !== undefined ? ex.weightPercentage : match.weight,
        });
      } else {
        newComponents.push({
          id: `comp-ex-${ex.id}`,
          name: ex.title || `Examen ${idx + 1} (${ex.examType})`,
          type: 'exam',
          linkedId: ex.id,
          weight: ex.weightPercentage || Math.round(50 / Math.max(1, subject.exams.length)),
          grade: ex.finalGrade,
        });
      }
    });

    // Add projects
    (subject.projects || [])?.forEach((proj, idx) => {
      const match = existingComponents.find((c) => c.linkedId === proj.id);
      if (match) {
        newComponents.push({
          ...match,
          name: proj.title || `Proyecto ${idx + 1}`,
          grade: proj.finalGrade !== undefined ? proj.finalGrade : match.grade,
          weight: proj.weightPercentage !== undefined ? proj.weightPercentage : match.weight,
        });
      } else {
        newComponents.push({
          id: `comp-proj-${proj.id}`,
          name: proj.title || `Proyecto ${idx + 1}`,
          type: 'project',
          linkedId: proj.id,
          weight: proj.weightPercentage || Math.round(30 / Math.max(1, (subject.projects || []).length)),
          grade: proj.finalGrade,
        });
      }
    });

    // Add evaluable tasks
    (subject.tasks || [])
      .filter((t) => t.isGraded || t.score !== undefined || t.weightPercentage !== undefined)
      .forEach((t) => {
        const match = existingComponents.find((c) => c.linkedId === t.id);
        if (match) {
          newComponents.push({
            ...match,
            name: `Tarea: ${t.title}`,
            grade: t.score !== undefined ? t.score : match.grade,
            weight: t.weightPercentage !== undefined ? t.weightPercentage : match.weight,
          });
        } else {
          newComponents.push({
            id: `comp-tsk-${t.id}`,
            name: `Tarea: ${t.title}`,
            type: 'activity',
            linkedId: t.id,
            weight: t.weightPercentage || 10,
            grade: t.score,
          });
        }
      });

    // Keep continuous evaluation or custom components that don't have linkedId
    existingComponents
      .filter((c) => !c.linkedId && c.type !== 'exam' && c.type !== 'project' && c.type !== 'activity')
      .forEach((c) => newComponents.push(c));

    updateConfig({
      ...gradingConfig,
      components: newComponents.length > 0 ? newComponents : existingComponents,
    });
  };

  // Update a component's grade
  const handleUpdateComponentGrade = (compId: string, gradeStr: string) => {
    const grade = gradeStr === '' ? undefined : parseFloat(gradeStr);
    const validGrade = grade !== undefined && !isNaN(grade) ? Math.min(10, Math.max(0, grade)) : undefined;

    const updatedComponents = gradingConfig.components.map((c) => {
      if (c.id === compId) {
        return { ...c, grade: validGrade };
      }
      return c;
    });

    // If linked to an exam, project, or task, also update in subject
    let updatedExams = [...subject.exams];
    let updatedProjects = [...(subject.projects || [])];
    let updatedTasks = [...(subject.tasks || [])];

    const targetComp = gradingConfig.components.find((c) => c.id === compId);
    if (targetComp?.linkedId) {
      if (targetComp.type === 'exam') {
        updatedExams = updatedExams.map((ex) =>
          ex.id === targetComp.linkedId ? { ...ex, finalGrade: validGrade } : ex
        );
      } else if (targetComp.type === 'project') {
        updatedProjects = updatedProjects.map((p) =>
          p.id === targetComp.linkedId ? { ...p, finalGrade: validGrade } : p
        );
      } else if (targetComp.type === 'activity') {
        updatedTasks = updatedTasks.map((t) =>
          t.id === targetComp.linkedId ? { ...t, score: validGrade } : t
        );
      }
    }

    onUpdateSubject({
      ...subject,
      exams: updatedExams,
      projects: updatedProjects,
      tasks: updatedTasks,
      gradingConfig: {
        ...gradingConfig,
        components: updatedComponents,
      },
    });
  };

  // Update a component's weight
  const handleUpdateComponentWeight = (compId: string, weightStr: string) => {
    const weight = Math.max(0, parseFloat(weightStr) || 0);
    const updatedComponents = gradingConfig.components.map((c) =>
      c.id === compId ? { ...c, weight } : c
    );
    updateConfig({ ...gradingConfig, components: updatedComponents });
  };

  // Delete component
  const handleDeleteComponent = (compId: string) => {
    const updatedComponents = gradingConfig.components.filter((c) => c.id !== compId);
    updateConfig({ ...gradingConfig, components: updatedComponents });
  };

  // Add new component
  const handleAddComponent = () => {
    if (!newCompName.trim()) return;

    const newComponent: GradingComponent = {
      id: `comp-${Date.now()}`,
      name: newCompName.trim(),
      type: newCompType,
      weight: Math.max(0, parseFloat(newCompWeight) || 10),
      grade: newCompGrade !== '' ? Math.min(10, Math.max(0, parseFloat(newCompGrade))) : undefined,
    };

    updateConfig({
      ...gradingConfig,
      components: [...gradingConfig.components, newComponent],
    });

    setNewCompName('');
    setNewCompWeight('15');
    setNewCompGrade('');
    setShowAddComponent(false);
  };

  // MATHEMATICAL PROGRESSIVE CALCULATIONS
  const totalWeight = gradingConfig.components.reduce((acc, c) => acc + c.weight, 0);
  const gradedComponents = gradingConfig.components.filter((c) => c.grade !== undefined);
  const evaluatedWeight = gradedComponents.reduce((acc, c) => acc + c.weight, 0);
  const pendingWeight = Math.max(0, 100 - evaluatedWeight);

  // Progressive accumulated grade on 0-10 scale (how many points already secured out of 10)
  const currentAccumulatedGrade = gradedComponents.reduce(
    (acc, c) => acc + ((c.grade || 0) * c.weight) / 100,
    0
  );

  // Weighted average of ONLY the evaluated items so far (0-10)
  const currentAverageGraded =
    evaluatedWeight > 0
      ? gradedComponents.reduce((acc, c) => acc + (c.grade || 0) * c.weight, 0) / evaluatedWeight
      : 0;

  // Forecast: required grade in remaining components to pass (5.0)
  const passingGrade = gradingConfig.passingGrade || 5.0;
  const targetGrade = gradingConfig.targetGrade || 8.0;

  let requiredForPass: number | null = null;
  let passStatus: 'passed' | 'possible' | 'impossible' = 'possible';

  if (currentAccumulatedGrade >= passingGrade) {
    passStatus = 'passed';
  } else if (currentAccumulatedGrade + (pendingWeight * 10) / 100 < passingGrade) {
    passStatus = 'impossible';
  } else if (pendingWeight > 0) {
    requiredForPass = (passingGrade - currentAccumulatedGrade) / (pendingWeight / 100);
  }

  // Forecast for target grade
  let requiredForTarget: number | null = null;
  let targetStatus: 'reached' | 'possible' | 'impossible' = 'possible';

  if (currentAccumulatedGrade >= targetGrade) {
    targetStatus = 'reached';
  } else if (currentAccumulatedGrade + (pendingWeight * 10) / 100 < targetGrade) {
    targetStatus = 'impossible';
  } else if (pendingWeight > 0) {
    requiredForTarget = (targetGrade - currentAccumulatedGrade) / (pendingWeight / 100);
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>Cálculo Progresivo de la Nota Final</span>
          </h3>
          <p className="text-xs text-slate-500">
            Define la fórmula de ponderación y las actividades evaluables. La aplicación calculará en tiempo real tu nota acumulada en escala numérica y en porcentaje.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de escala de notas: Numérica (0-10) vs Porcentaje (0-100%) vs Ambos */}
          <div className="flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-xl shadow-2xs text-xs">
            <button
              type="button"
              onClick={() => handleSetScaleMode('numeric')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                scaleMode === 'numeric'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Mostrar notas en escala de 0 a 10"
            >
              0 a 10
            </button>
            <button
              type="button"
              onClick={() => handleSetScaleMode('percentage')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                scaleMode === 'percentage'
                  ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Mostrar notas en escala de porcentaje de 0 a 100%"
            >
              0 a 100%
            </button>
            <button
              type="button"
              onClick={() => handleSetScaleMode('both')}
              className={`px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                scaleMode === 'both'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Mostrar simultáneamente nota en número (0-10) y en porcentaje (0-100%)"
            >
              Ambos (Num y %)
            </button>
          </div>

          <button
            onClick={handleSyncWithSubjectItems}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
            title="Importar exámenes y proyectos configurados"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Sincronizar Exámenes/Proyectos</span>
          </button>

          <button
            onClick={() => setShowAddComponent(!showAddComponent)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Actividad o Criterio</span>
          </button>
        </div>
      </div>

      {/* KPI PROGRESSIVE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Nota Acumulada */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Nota Progresiva Asegurada</span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono-numbers text-slate-900 mt-1">
            {scaleMode === 'percentage'
              ? `${(currentAccumulatedGrade * 10).toFixed(1)}%`
              : scaleMode === 'numeric'
              ? `${currentAccumulatedGrade.toFixed(2)} / 10`
              : `${currentAccumulatedGrade.toFixed(2)} `}
            {scaleMode === 'both' && (
              <span className="text-xs font-semibold text-blue-600 block sm:inline sm:ml-1">
                ({(currentAccumulatedGrade * 10).toFixed(1)}%)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Basada en el {evaluatedWeight}% evaluado hasta hoy
          </div>
        </div>

        {/* 2. Media de lo calificado */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Media en Evaluaciones Hechas</span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono-numbers text-blue-600 mt-1">
            {scaleMode === 'percentage'
              ? `${(currentAverageGraded * 10).toFixed(1)}%`
              : scaleMode === 'numeric'
              ? `${currentAverageGraded.toFixed(2)} / 10`
              : `${currentAverageGraded.toFixed(2)} `}
            {scaleMode === 'both' && (
              <span className="text-xs font-semibold text-slate-500 block sm:inline sm:ml-1">
                ({(currentAverageGraded * 10).toFixed(1)}%)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Promedio ponderado de entregas calificadas
          </div>
        </div>

        {/* 3. Previsión para aprobar (5.0 / 50%) */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">
            Necesario para Aprobar ({scaleMode === 'percentage' ? '50%' : '5.0'})
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono-numbers mt-1">
            {passStatus === 'passed' ? (
              <span className="text-emerald-600 text-2xl font-bold">¡Asegurado!</span>
            ) : passStatus === 'impossible' ? (
              <span className="text-rose-600 text-2xl font-bold">No alcanza</span>
            ) : requiredForPass !== null ? (
              <span className={requiredForPass > 7 ? 'text-amber-600' : 'text-slate-900'}>
                {scaleMode === 'percentage'
                  ? `${(requiredForPass * 10).toFixed(1)}%`
                  : scaleMode === 'numeric'
                  ? `${requiredForPass.toFixed(2)} / 10`
                  : `${requiredForPass.toFixed(2)} (${(requiredForPass * 10).toFixed(1)}%)`}
              </span>
            ) : (
              '—'
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {passStatus === 'passed'
              ? 'Ya superas los 5 puntos globales'
              : `Media requerida en el ${pendingWeight}% restante`}
          </div>
        </div>

        {/* 4. Previsión para meta personal */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">
            Meta Personal ({scaleMode === 'percentage' ? `${(targetGrade * 10).toFixed(0)}%` : targetGrade.toFixed(1)})
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono-numbers mt-1">
            {targetStatus === 'reached' ? (
              <span className="text-emerald-600 text-2xl font-bold">¡Alcanzada!</span>
            ) : targetStatus === 'impossible' ? (
              <span className="text-slate-400 text-2xl font-bold">Inalcanzable</span>
            ) : requiredForTarget !== null ? (
              <span className={requiredForTarget > 9 ? 'text-rose-600' : requiredForTarget > 7 ? 'text-blue-600' : 'text-emerald-600'}>
                {scaleMode === 'percentage'
                  ? `${(requiredForTarget * 10).toFixed(1)}%`
                  : scaleMode === 'numeric'
                  ? `${requiredForTarget.toFixed(2)} / 10`
                  : `${requiredForTarget.toFixed(2)} (${(requiredForTarget * 10).toFixed(1)}%)`}
              </span>
            ) : (
              '—'
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {targetStatus === 'reached'
              ? 'Superas tu objetivo deseado'
              : `Media requerida en el ${pendingWeight}% restante`}
          </div>
        </div>
      </div>

      {/* WEIGHT WARNING IF NOT 100% */}
      {totalWeight !== 100 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              La suma de las ponderaciones actuales es del <strong>{totalWeight}%</strong>. Para un cálculo exacto se recomienda que la suma sea del <strong>100%</strong>.
            </span>
          </div>
          <span className="font-mono-numbers font-bold shrink-0">
            {totalWeight > 100 ? `+${totalWeight - 100}% de exceso` : `Falta ${100 - totalWeight}%`}
          </span>
        </div>
      )}

      {/* Target and Passing Config Inputs */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Nota de Aprobado:</span>
            <input
              type="number"
              min="1"
              max="10"
              step="0.5"
              value={gradingConfig.passingGrade}
              onChange={(e) =>
                updateConfig({
                  ...gradingConfig,
                  passingGrade: parseFloat(e.target.value) || 5.0,
                })
              }
              className="w-16 bg-white border border-slate-300 rounded-lg p-1.5 text-center font-bold font-mono-numbers text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Meta Deseada (Objetivo):</span>
            <input
              type="number"
              min="1"
              max="10"
              step="0.5"
              value={gradingConfig.targetGrade || 8.0}
              onChange={(e) =>
                updateConfig({
                  ...gradingConfig,
                  targetGrade: parseFloat(e.target.value) || 8.0,
                })
              }
              className="w-16 bg-white border border-slate-300 rounded-lg p-1.5 text-center font-bold font-mono-numbers text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Evaluado: <strong className="text-slate-800">{evaluatedWeight}%</strong> · Pendiente de realizar:{' '}
          <strong className="text-slate-800">{pendingWeight}%</strong>
        </div>
      </div>

      {/* Add Component Form */}
      {showAddComponent && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Añadir Componente o Actividad Evaluable
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-semibold">Preajustes rápidos:</span>
              <button
                type="button"
                onClick={() => {
                  setNewCompName('Actividad Evaluable Semanal');
                  setNewCompType('activity');
                  setNewCompWeight('15');
                }}
                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold cursor-pointer"
              >
                + Actividad (15%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCompName('Práctica de Laboratorio');
                  setNewCompType('activity');
                  setNewCompWeight('20');
                }}
                className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold cursor-pointer"
              >
                + Práctica Lab (20%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCompName('Examen Parcial');
                  setNewCompType('exam');
                  setNewCompWeight('40');
                }}
                className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold cursor-pointer"
              >
                + Examen (40%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Nombre / Actividad *</label>
              <input
                type="text"
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                placeholder="Ej: Actividad Evaluable 1, Práctica Redox, Seminario..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Tipo de Componente</label>
              <select
                value={newCompType}
                onChange={(e) => setNewCompType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none font-medium"
              >
                <option value="activity">📝 Actividad Evaluable</option>
                <option value="exam">🎓 Examen Oficial</option>
                <option value="project">📁 Proyecto / Trabajo</option>
                <option value="continuous">⭐ Evaluación Continua</option>
                <option value="custom">⚙️ Personalizado</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Ponderación (% de la nota)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={newCompWeight}
                onChange={(e) => setNewCompWeight(e.target.value)}
                placeholder="15"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono-numbers focus:outline-none font-bold text-blue-700"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Nota Ya Obtenida (opcional)</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={newCompGrade}
                onChange={(e) => setNewCompGrade(e.target.value)}
                placeholder="Dejar vacío si está pendiente"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono-numbers focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowAddComponent(false)}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddComponent}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer"
            >
              Guardar Componente
            </button>
          </div>
        </div>
      )}

      {/* Components Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Desglose de Ponderaciones y Calificaciones
          </h4>
          <span className="text-xs text-slate-400 font-mono-numbers">
            {gradingConfig.components.length} elementos configurados
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {gradingConfig.components.map((comp) => {
            const hasGrade = comp.grade !== undefined;
            const pointsContribution = hasGrade ? ((comp.grade || 0) * comp.weight) / 100 : 0;

            return (
              <div
                key={comp.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        comp.type === 'exam'
                          ? 'bg-purple-50 text-purple-700'
                          : comp.type === 'project'
                          ? 'bg-blue-50 text-blue-700'
                          : comp.type === 'continuous'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {comp.type === 'exam' ? 'Examen' : comp.type === 'project' ? 'Proyecto' : comp.type === 'continuous' ? 'Continua' : 'Criterio'}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{comp.name}</span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono-numbers">
                    Aporta hasta <strong>{(comp.weight / 10).toFixed(2)}</strong> puntos sobre 10 de la nota final
                  </div>
                </div>

                {/* Weight and Grade Inputs */}
                <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Peso:</span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={comp.weight}
                        onChange={(e) => handleUpdateComponentWeight(comp.id, e.target.value)}
                        className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 pr-6 text-center font-mono-numbers font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute right-2 top-1.5 text-[11px] text-slate-400 font-bold">%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Nota:</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={comp.grade !== undefined ? comp.grade : ''}
                      onChange={(e) => handleUpdateComponentGrade(comp.id, e.target.value)}
                      placeholder="—"
                      className={`w-16 rounded-lg p-1.5 text-center font-mono-numbers font-bold text-xs border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        hasGrade
                          ? comp.grade! >= 5
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-rose-50 border-rose-300 text-rose-800'
                          : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    />
                    <span className="text-slate-400 font-mono-numbers">/ 10</span>
                    {hasGrade && (scaleMode === 'percentage' || scaleMode === 'both') && (
                      <span className="text-[11px] font-bold text-slate-600 font-mono-numbers bg-slate-100 px-1.5 py-0.5 rounded">
                        {(comp.grade! * 10).toFixed(1)}%
                      </span>
                    )}
                  </div>

                  {hasGrade && (
                    <div className="text-right min-w-[70px]">
                      <div className="text-xs font-bold text-slate-800 font-mono-numbers">
                        +{pointsContribution.toFixed(2)} pts
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono-numbers">
                        {(pointsContribution * 10).toFixed(1)}% de la nota final
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => handleDeleteComponent(comp.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar este criterio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {gradingConfig.components.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No hay componentes de calificación configurados. Pulsa "Sincronizar Exámenes/Proyectos" o "+ Añadir Criterio".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
