import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Calendar,
  Award,
  ArrowRight,
  Clock,
  Layers,
  AlertCircle,
  Percent,
} from 'lucide-react';
import { Subject, Project, ProjectPhase, Task } from '../types';

interface SubjectProjectsTabProps {
  subject: Subject;
  onUpdateSubject: (updated: Subject) => void;
}

export const SubjectProjectsTab: React.FC<SubjectProjectsTabProps> = ({
  subject,
  onUpdateSubject,
}) => {
  const projects = subject.projects || [];

  // Add Project Form State
  const [showAddProject, setShowAddProject] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newWeight, setNewWeight] = useState<string>('20');
  const [newStatus, setNewStatus] = useState<Project['status']>('planificacion');

  // Add Phase State
  const [activeProjectForPhase, setActiveProjectForPhase] = useState<string | null>(null);
  const [newPhaseTitle, setNewPhaseTitle] = useState('');
  const [newPhaseDueDate, setNewPhaseDueDate] = useState('');

  // Add Task to Project State
  const [activeProjectForTask, setActiveProjectForTask] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPhaseId, setNewTaskPhaseId] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('media');

  // Create Project
  const handleCreateProject = () => {
    if (!newTitle.trim()) return;

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      dueDate: newDueDate || undefined,
      weightPercentage: parseFloat(newWeight) || 0,
      status: newStatus,
      phases: [
        {
          id: `phase-${Date.now()}-1`,
          title: 'Planificación y Búsqueda Bibliográfica',
          completed: false,
          order: 1,
        },
        {
          id: `phase-${Date.now()}-2`,
          title: 'Desarrollo / Ejecución Principal',
          completed: false,
          order: 2,
        },
        {
          id: `phase-${Date.now()}-3`,
          title: 'Revisión Final y Memoria / Entrega',
          completed: false,
          order: 3,
        },
      ],
      tasks: [],
    };

    onUpdateSubject({
      ...subject,
      projects: [...projects, newProject],
    });

    setNewTitle('');
    setNewDescription('');
    setNewDueDate('');
    setNewWeight('20');
    setShowAddProject(false);
  };

  // Delete Project
  const handleDeleteProject = (projectId: string) => {
    onUpdateSubject({
      ...subject,
      projects: projects.filter((p) => p.id !== projectId),
    });
  };

  // Update Project Grade
  const handleUpdateGrade = (projectId: string, gradeStr: string) => {
    const grade = gradeStr === '' ? undefined : parseFloat(gradeStr);
    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          finalGrade: grade !== undefined && !isNaN(grade) ? Math.min(10, Math.max(0, grade)) : undefined,
          status: grade !== undefined ? ('calificado' as const) : p.status,
        };
      }
      return p;
    });

    onUpdateSubject({
      ...subject,
      projects: updated,
    });
  };

  // Update Project Status
  const handleUpdateStatus = (projectId: string, status: Project['status']) => {
    const updated = projects.map((p) => (p.id === projectId ? { ...p, status } : p));
    onUpdateSubject({ ...subject, projects: updated });
  };

  // Add Phase to Project
  const handleAddPhase = (projectId: string) => {
    if (!newPhaseTitle.trim()) return;
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;

    const newPhase: ProjectPhase = {
      id: `phase-${Date.now()}`,
      title: newPhaseTitle.trim(),
      dueDate: newPhaseDueDate || undefined,
      completed: false,
      order: proj.phases.length + 1,
    };

    const updated = projects.map((p) =>
      p.id === projectId ? { ...p, phases: [...p.phases, newPhase] } : p
    );

    onUpdateSubject({ ...subject, projects: updated });
    setNewPhaseTitle('');
    setNewPhaseDueDate('');
    setActiveProjectForPhase(null);
  };

  // Toggle Phase Completion
  const handleTogglePhase = (projectId: string, phaseId: string) => {
    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          phases: p.phases.map((ph) =>
            ph.id === phaseId ? { ...ph, completed: !ph.completed } : ph
          ),
        };
      }
      return p;
    });

    onUpdateSubject({ ...subject, projects: updated });
  };

  // Delete Phase
  const handleDeletePhase = (projectId: string, phaseId: string) => {
    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          phases: p.phases.filter((ph) => ph.id !== phaseId),
        };
      }
      return p;
    });

    onUpdateSubject({ ...subject, projects: updated });
  };

  // Add Task to Project
  const handleAddTaskToProject = (projectId: string) => {
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      dueDate: newTaskDueDate || new Date().toISOString().split('T')[0],
      priority: newTaskPriority,
      type: 'proyecto',
      completed: false,
      reminder: false,
      projectId,
      phaseId: newTaskPhaseId || undefined,
    };

    const updated = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          tasks: [...p.tasks, newTask],
        };
      }
      return p;
    });

    // Also sync to general subject tasks for calendar integration
    const updatedSubjectTasks = [...subject.tasks, newTask];

    onUpdateSubject({
      ...subject,
      projects: updated,
      tasks: updatedSubjectTasks,
    });

    setNewTaskTitle('');
    setNewTaskDueDate('');
    setNewTaskPhaseId('');
    setActiveProjectForTask(null);
  };

  // Toggle Task in Project
  const handleToggleProjectTask = (projectId: string, taskId: string) => {
    const updatedProjects = projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)),
        };
      }
      return p;
    });

    const updatedSubjectTasks = subject.tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );

    onUpdateSubject({
      ...subject,
      projects: updatedProjects,
      tasks: updatedSubjectTasks,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            <span>Proyectos y Fases de Trabajo</span>
          </h3>
          <p className="text-xs text-slate-500">
            Gestiona trabajos en grupo, proyectos de curso y sus fases de entrega con tareas vinculadas y calificación final.
          </p>
        </div>

        <button
          onClick={() => setShowAddProject(!showAddProject)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Proyecto</span>
        </button>
      </div>

      {/* Add Project Form Modal/Box */}
      {showAddProject && (
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-150">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Crear Proyecto para {subject.name}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Título del Proyecto *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej: Trabajo Final de Asignatura, Proyecto de Investigación..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Fecha de Entrega Final
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ponderación en la Nota Final (% del curso)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="20"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-3 pr-8 text-slate-800 font-mono-numbers focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Estado Inicial
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-semibold focus:outline-none"
              >
                <option value="planificacion">Planificación</option>
                <option value="en_progreso">En Progreso</option>
                <option value="entregado">Entregado</option>
                <option value="calificado">Calificado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Descripción y Objetivos (opcional)
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              placeholder="Detalla los requisitos de la entrega, rúbrica o enlaces útiles..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddProject(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateProject}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-2xs"
            >
              Guardar Proyecto
            </button>
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="space-y-6">
        {projects.map((proj) => {
          const completedPhases = proj.phases.filter((ph) => ph.completed).length;
          const phasesCount = proj.phases.length;
          const phasesProgress = phasesCount > 0 ? Math.round((completedPhases / phasesCount) * 100) : 0;
          const completedTasks = proj.tasks.filter((t) => t.completed).length;

          return (
            <div
              key={proj.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
            >
              {/* Project Card Header */}
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/70 to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        proj.status === 'calificado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : proj.status === 'entregado'
                          ? 'bg-blue-100 text-blue-800'
                          : proj.status === 'en_progreso'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {proj.status.replace('_', ' ')}
                    </span>

                    {proj.weightPercentage !== undefined && (
                      <span className="text-[11px] font-bold font-mono-numbers text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {proj.weightPercentage}% de la Nota Final
                      </span>
                    )}

                    {proj.dueDate && (
                      <span className="text-[11px] font-medium font-mono-numbers text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Entrega: {proj.dueDate}
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-slate-900">{proj.title}</h4>
                  {proj.description && (
                    <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      {proj.description}
                    </p>
                  )}
                </div>

                {/* Final Grade Input & Controls */}
                <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                  <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold text-slate-700">Nota Final:</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={proj.finalGrade !== undefined ? proj.finalGrade : ''}
                      onChange={(e) => handleUpdateGrade(proj.id, e.target.value)}
                      placeholder="— / 10"
                      className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold font-mono-numbers text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {proj.finalGrade !== undefined && (
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          proj.finalGrade >= 9
                            ? 'text-emerald-700 bg-emerald-50'
                            : proj.finalGrade >= 7
                            ? 'text-blue-700 bg-blue-50'
                            : proj.finalGrade >= 5
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-rose-700 bg-rose-50'
                        }`}
                      >
                        {proj.finalGrade >= 9 ? 'Sobresaliente' : proj.finalGrade >= 7 ? 'Notable' : proj.finalGrade >= 5 ? 'Aprobado' : 'Suspenso'}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteProject(proj.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar proyecto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar of Phases */}
              <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <span className="text-[11px] font-semibold text-slate-700">Progreso de Fases:</span>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${phasesProgress}%` }}
                    />
                  </div>
                  <span className="font-bold font-mono-numbers text-slate-800 text-[11px]">
                    {completedPhases}/{phasesCount} ({phasesProgress}%)
                  </span>
                </div>

                <div className="text-[11px]">
                  <strong className="text-slate-800 font-mono-numbers">{completedTasks}</strong> de {proj.tasks.length} tareas completadas
                </div>
              </div>

              {/* Two Column Layout: Phases (Left) & Tasks (Right) */}
              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Project Phases */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>Fases del Proyecto</span>
                    </h5>
                    <button
                      onClick={() => setActiveProjectForPhase(activeProjectForPhase === proj.id ? null : proj.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      + Añadir Fase
                    </button>
                  </div>

                  {/* Add Phase Inline Form */}
                  {activeProjectForPhase === proj.id && (
                    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs">
                      <input
                        type="text"
                        value={newPhaseTitle}
                        onChange={(e) => setNewPhaseTitle(e.target.value)}
                        placeholder="Nombre de la fase (ej: Redacción de borrador)"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={newPhaseDueDate}
                          onChange={(e) => setNewPhaseDueDate(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800"
                        />
                        <button
                          onClick={() => handleAddPhase(proj.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setActiveProjectForPhase(null)}
                          className="px-2 py-1.5 text-slate-500 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Phases List */}
                  <div className="space-y-2">
                    {proj.phases.map((phase, idx) => (
                      <div
                        key={phase.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                          phase.completed
                            ? 'bg-slate-50/60 border-slate-200 text-slate-400'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1">
                          <button
                            onClick={() => handleTogglePhase(proj.id, phase.id)}
                            className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                          >
                            {phase.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>
                          <div>
                            <span className={`font-semibold ${phase.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              Fase {idx + 1}: {phase.title}
                            </span>
                            {phase.dueDate && (
                              <div className="text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                                Límite: {phase.dueDate}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeletePhase(proj.id, phase.id)}
                          className="text-slate-300 hover:text-rose-500 cursor-pointer p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {proj.phases.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400 italic">
                        Sin fases configuradas aún. Pulsa "+ Añadir Fase".
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Tasks linked to Project & Phases */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tareas Vinculadas al Proyecto</span>
                    </h5>
                    <button
                      onClick={() => setActiveProjectForTask(activeProjectForTask === proj.id ? null : proj.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      + Añadir Tarea
                    </button>
                  </div>

                  {/* Add Task Inline Form */}
                  {activeProjectForTask === proj.id && (
                    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs">
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Descripción de la tarea concreta..."
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newTaskPhaseId}
                          onChange={(e) => setNewTaskPhaseId(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 text-xs"
                        >
                          <option value="">Fase vinculada (opcional)</option>
                          {proj.phases.map((ph, idx) => (
                            <option key={ph.id} value={ph.id}>
                              Fase {idx + 1}: {ph.title}
                            </option>
                          ))}
                        </select>

                        <input
                          type="date"
                          value={newTaskDueDate}
                          onChange={(e) => setNewTaskDueDate(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg p-1.5 text-slate-700 text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setActiveProjectForTask(null)}
                          className="px-2 py-1 text-slate-500 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleAddTaskToProject(proj.id)}
                          className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
                        >
                          Vincular Tarea
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tasks List */}
                  <div className="space-y-2">
                    {proj.tasks.map((task) => {
                      const linkedPhase = proj.phases.find((ph) => ph.id === task.phaseId);

                      return (
                        <div
                          key={task.id}
                          className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => handleToggleProjectTask(proj.id, task.id)}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <span className={`font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                {task.title}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                                {linkedPhase && (
                                  <span className="font-sans text-blue-700 font-medium bg-blue-50 px-1.5 py-0.2 rounded">
                                    {linkedPhase.title}
                                  </span>
                                )}
                                <span>Vence: {task.dueDate}</span>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                              task.priority === 'urgente' || task.priority === 'alta'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                      );
                    })}

                    {proj.tasks.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400 italic">
                        Sin tareas vinculadas aún. Pulsa "+ Añadir Tarea".
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {projects.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-3">
            <FolderKanban className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">No hay proyectos creados todavía</h4>
              <p className="text-slate-500 mt-1">
                Crea proyectos con fases de entrega, tareas vinculadas y asigna su peso para el cálculo de la nota final.
              </p>
            </div>
            <button
              onClick={() => setShowAddProject(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Primer Proyecto</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
