import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Download,
  Upload,
  Check,
  X,
  FolderTree,
  AlertTriangle,
  Clock,
  Calendar,
  Zap,
  CheckCircle2,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Dumbbell,
  Car,
  Coffee,
  User,
  Users,
  Repeat,
  Sparkles,
  Layers,
  ShieldAlert,
  BookOpen,
  TrendingUp,
  BarChart3,
  ArrowRight,
  RotateCw,
  Search,
  ChevronDown,
  Award,
} from 'lucide-react';
import {
  StudyProgram,
  AcademicYear,
  Subject,
  BlockedTimeEvent,
  WeeklyObligation,
  BlockedCategory,
  DailyNeedsCalculation,
  StudyPreferences,
} from '../types';
import {
  schedulerService,
  BLOCKED_REASON_DEFINITIONS,
} from '../services/schedulerService';
import { storageService } from '../services/storageService';

interface ProgramManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  programs: StudyProgram[];
  activeProgramId: string;
  activeYearId: string;
  onSelectProgramAndYear: (programId: string, yearId: string) => void;
  onUpdatePrograms: (updatedPrograms: StudyProgram[]) => void;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => void;
  selectedYearIds?: string[];
  onToggleYearSelection?: (yearId: string) => void;
  selectedProgramIds?: string[];
  onToggleProgramSelection?: (programId: string) => void;
  onSelectAllProgramsAndYears?: () => void;
  onResetToBlank?: () => void;
  onLoadDemoData?: () => void;
  blockedEvents?: BlockedTimeEvent[];
  onAddBlockedEvent?: (event: BlockedTimeEvent) => void;
  onDeleteBlockedEvent?: (id: string) => void;
  onUpdateBlockedEvent?: (event: BlockedTimeEvent) => void;
  preferences?: StudyPreferences;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
}

const SUBJECT_COLOR_PALETTE = [
  { hex: '#3b82f6', label: 'Azul' },
  { hex: '#6366f1', label: 'Índigo' },
  { hex: '#8b5cf6', label: 'Violeta' },
  { hex: '#a855f7', label: 'Púrpura' },
  { hex: '#ec4899', label: 'Rosa' },
  { hex: '#f43f5e', label: 'Rojo/Cereza' },
  { hex: '#f97316', label: 'Naranja' },
  { hex: '#eab308', label: 'Ámbar' },
  { hex: '#10b981', label: 'Esmeralda' },
  { hex: '#06b6d4', label: 'Cian' },
  { hex: '#64748b', label: 'Pizarra' },
];

const WEEKDAY_OPTIONS = [
  { day: 1, label: 'Lun', fullLabel: 'Lunes' },
  { day: 2, label: 'Mar', fullLabel: 'Martes' },
  { day: 3, label: 'Mié', fullLabel: 'Miércoles' },
  { day: 4, label: 'Jue', fullLabel: 'Jueves' },
  { day: 5, label: 'Vie', fullLabel: 'Viernes' },
  { day: 6, label: 'Sáb', fullLabel: 'Sábado' },
  { day: 0, label: 'Dom', fullLabel: 'Domingo' },
];

export const ProgramManagerModal: React.FC<ProgramManagerModalProps> = ({
  isOpen,
  onClose,
  programs,
  activeProgramId,
  activeYearId,
  onSelectProgramAndYear,
  onUpdatePrograms,
  onExportJSON,
  onImportJSON,
  selectedYearIds = [],
  onToggleYearSelection,
  selectedProgramIds = [],
  onToggleProgramSelection,
  onSelectAllProgramsAndYears,
  onResetToBlank,
  onLoadDemoData,
  blockedEvents,
  onAddBlockedEvent,
  onDeleteBlockedEvent,
  onUpdateBlockedEvent,
  preferences,
  onUpdatePreferences,
}) => {
  // Modal Top Navigation: 'all' (Vista Completa · Árbol y Panorama Académico) o 'hierarchy' (Gestión de Estudios, Cursos y Materias)
  const [activeModalTab, setActiveModalTab] = useState<'all' | 'hierarchy'>('all');
  const [panoramaSearch, setPanoramaSearch] = useState('');
  const [panoramaProgramFilter, setPanoramaProgramFilter] = useState<string>('all');

  // Add Study Program State
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramInst, setNewProgramInst] = useState('');
  const [showAddProgram, setShowAddProgram] = useState(false);

  // Edit / Delete Study Program State
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editProgramName, setEditProgramName] = useState('');
  const [editProgramInst, setEditProgramInst] = useState('');
  const [confirmDeleteProgramId, setConfirmDeleteProgramId] = useState<string | null>(null);

  // Add Year State
  const [newYearName, setNewYearName] = useState('');
  const [showAddYear, setShowAddYear] = useState(false);

  // Edit / Delete Year State
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editYearName, setEditYearName] = useState('');
  const [editYearPeriod, setEditYearPeriod] = useState('');
  const [editYearStartDate, setEditYearStartDate] = useState('');
  const [editYearTargetHours, setEditYearTargetHours] = useState('20');
  const [confirmDeleteYearId, setConfirmDeleteYearId] = useState<string | null>(null);

  // Add Subject State
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubProf, setNewSubProf] = useState('');
  const [newSubCredits, setNewSubCredits] = useState('6');
  const [newSubColor, setNewSubColor] = useState('#3b82f6');
  const [showAddSub, setShowAddSub] = useState(false);

  // Edit / Delete Subject State
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubCode, setEditSubCode] = useState('');
  const [editSubProf, setEditSubProf] = useState('');
  const [editSubCredits, setEditSubCredits] = useState('6');
  const [editSubColor, setEditSubColor] = useState('#3b82f6');
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<string | null>(null);

  // Footer Reset/Demo Confirmations
  const [confirmResetBlank, setConfirmResetBlank] = useState(false);
  const [confirmLoadDemo, setConfirmLoadDemo] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Synchronized state for blocked events & preferences
  const [internalBlockedEvents, setInternalBlockedEvents] = useState<BlockedTimeEvent[]>(() =>
    blockedEvents || storageService.getBlockedEvents()
  );
  const [internalPreferences, setInternalPreferences] = useState<StudyPreferences>(() =>
    preferences || storageService.getPreferences()
  );

  useEffect(() => {
    if (blockedEvents) setInternalBlockedEvents(blockedEvents);
  }, [blockedEvents]);

  useEffect(() => {
    if (preferences) setInternalPreferences(preferences);
  }, [preferences]);

  // Scope for calculations: 'current' (current active program) or 'all' (all study programs combined)
  const [calculationScope, setCalculationScope] = useState<'current' | 'all'>('current');

  // Recurring Blocked Hours Form State
  const [blockedReason, setBlockedReason] = useState<BlockedCategory>('clase');
  const [blockedTitle, setBlockedTitle] = useState('');
  const [blockedDays, setBlockedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [blockedStartTime, setBlockedStartTime] = useState('09:00');
  const [blockedEndTime, setBlockedEndTime] = useState('13:00');
  const [blockedNotes, setBlockedNotes] = useState('');
  const [showAddBlockedForm, setShowAddBlockedForm] = useState(false);
  const [editingBlockedId, setEditingBlockedId] = useState<string | null>(null);
  const [confirmDeleteBlockedId, setConfirmDeleteBlockedId] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateFeedback, setRecalculateFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const currentProgram = programs.find((p) => p.id === activeProgramId) || programs[0];
  const currentYear =
    currentProgram?.years.find((y) => y.id === activeYearId) || currentProgram?.years[0];

  // Global Academic Panorama Metrics across all programs, courses, and subjects
  const allGlobalStats = useMemo(() => {
    const totalProgramsCount = programs.length;
    const allYears = programs.flatMap((p) => p.years || []);
    const totalYearsCount = allYears.length;
    const allSubjects = allYears.flatMap((y) => y.subjects || []);
    const totalSubjectsCount = allSubjects.length;
    const totalCreditsSum = allSubjects.reduce((acc, s) => acc + (s.credits || 0), 0);
    const allTopics = allSubjects.flatMap((s) => s.topics || []);
    const totalTopicsCount = allTopics.length;
    const completedTopicsCount = allTopics.filter(
      (t) =>
        t.status === 'estudiado' ||
        t.status === 'repasado' ||
        (typeof t.vueltasCount === 'number' && t.vueltasCount > 0)
    ).length;
    const completionPct =
      totalTopicsCount > 0 ? Math.round((completedTopicsCount / totalTopicsCount) * 100) : 0;
    const totalNotesCount = allSubjects.reduce((acc, s) => {
      const topicNotes = (s.topics || []).filter(
        (t) => Boolean(t.notes?.trim() || t.generalNotes?.trim() || (t.attachedFiles && t.attachedFiles.length > 0))
      ).length;
      return acc + topicNotes;
    }, 0);

    return {
      totalPrograms: totalProgramsCount,
      totalYears: totalYearsCount,
      totalSubjects: totalSubjectsCount,
      totalCredits: totalCreditsSum,
      totalTopics: totalTopicsCount,
      completedTopics: completedTopicsCount,
      completionPct,
      totalNotes: totalNotesCount,
    };
  }, [programs]);

  // Helper duration calculation in hours
  const computedFormDurationHours = useMemo(() => {
    const [h1, m1] = blockedStartTime.split(':').map(Number);
    const [h2, m2] = blockedEndTime.split(':').map(Number);
    const startM = (h1 || 0) * 60 + (m1 || 0);
    const endM = (h2 || 0) * 60 + (m2 || 0);
    const diff = endM - startM;
    return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
  }, [blockedStartTime, blockedEndTime]);

  // Active subjects according to selected scope
  const subjectsInScope = useMemo(() => {
    if (calculationScope === 'current') {
      if (!currentProgram) return [];
      return currentProgram.years.flatMap((y) => y.subjects);
    }
    return programs.flatMap((p) => p.years.flatMap((y) => y.subjects));
  }, [programs, currentProgram, calculationScope]);

  // Recalculate daily study & review needs
  const dailyNeeds: DailyNeedsCalculation = useMemo(() => {
    return schedulerService.calculateDailyStudyAndReviewNeeds(
      subjectsInScope,
      internalPreferences,
      internalBlockedEvents,
      internalPreferences.weeklyFixedObligations || []
    );
  }, [subjectsInScope, internalPreferences, internalBlockedEvents]);

  // Filter only recurring blocked events
  const recurringBlockedEvents = useMemo(() => {
    return internalBlockedEvents.filter(
      (b) => (b.recurringDays && b.recurringDays.length > 0) || !b.date
    );
  }, [internalBlockedEvents]);

  // Day-by-day breakdown (Lunes a Domingo) of blocked hours vs net daily study & review needs
  const weekdayBlockedAndNetBreakdown = useMemo(() => {
    return WEEKDAY_OPTIONS.map((dayOpt) => {
      let dayBlockedHours = 0;
      const reasons: string[] = [];

      recurringBlockedEvents.forEach((evt) => {
        const days =
          evt.recurringDays && evt.recurringDays.length > 0
            ? evt.recurringDays
            : [1, 2, 3, 4, 5];
        if (days.includes(dayOpt.day)) {
          let dur = evt.durationHours || 0;
          if (!dur && evt.startTime && evt.endTime) {
            const [h1, m1] = evt.startTime.split(':').map(Number);
            const [h2, m2] = evt.endTime.split(':').map(Number);
            dur = Math.max(
              0,
              ((h2 || 0) * 60 + (m2 || 0) - ((h1 || 0) * 60 + (m1 || 0))) / 60
            );
          }
          dayBlockedHours += dur;
          const rLabel =
            evt.title ||
            BLOCKED_REASON_DEFINITIONS[evt.category]?.label?.split(' / ')[0] ||
            evt.category;
          if (rLabel && !reasons.includes(rLabel)) {
            reasons.push(rLabel);
          }
        }
      });

      dayBlockedHours = Math.round(dayBlockedHours * 10) / 10;
      // Waking hours (~15.5h) minus 2h meals/routine minus blocked hours
      const freeWaking = Math.max(0, 15.5 - 2.0 - dayBlockedHours);
      const netAvailableStudyCap = Math.min(
        8.0,
        Math.max(0, Math.round(freeWaking * 0.65 * 10) / 10)
      );
      const netNeeded = dailyNeeds.totalHoursNeededDaily;
      const dayMargin = Math.round((netAvailableStudyCap - netNeeded) * 10) / 10;

      return {
        ...dayOpt,
        dayBlockedHours,
        netAvailableStudyCap,
        netNeeded,
        dayMargin,
        reasons,
      };
    });
  }, [recurringBlockedEvents, dailyNeeds]);

  const handleDirectDurationChange = (newDurationHours: number) => {
    const validHours = Math.max(0.5, Math.min(14, newDurationHours));
    const [h1, m1] = blockedStartTime.split(':').map(Number);
    const startMins = (h1 || 9) * 60 + (m1 || 0);
    const endMins = Math.min(23 * 60 + 59, Math.round(startMins + validHours * 60));
    const eh = Math.floor(endMins / 60);
    const em = endMins % 60;
    setBlockedEndTime(
      `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
    );
  };

  const toggleBlockedDay = (day: number) => {
    setBlockedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSelectDaysPreset = (preset: 'weekdays' | 'weekend' | 'all') => {
    if (preset === 'weekdays') setBlockedDays([1, 2, 3, 4, 5]);
    else if (preset === 'weekend') setBlockedDays([6, 0]);
    else if (preset === 'all') setBlockedDays([1, 2, 3, 4, 5, 6, 0]);
  };

  const handleApplyQuickPreset = (preset: {
    category: BlockedCategory;
    title: string;
    days: number[];
    startTime: string;
    endTime: string;
  }) => {
    setBlockedReason(preset.category);
    setBlockedTitle(preset.title);
    setBlockedDays(preset.days);
    setBlockedStartTime(preset.startTime);
    setBlockedEndTime(preset.endTime);
    setShowAddBlockedForm(true);
    setEditingBlockedId(null);
    setFormError(null);
  };

  const handleSaveRecurringBlocked = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (computedFormDurationHours <= 0) {
      setFormError('La hora de finalización debe ser posterior a la de inicio.');
      return;
    }
    if (blockedDays.length === 0) {
      setFormError('Selecciona al menos un día recurrente de la semana.');
      return;
    }

    const finalTitle =
      blockedTitle.trim() ||
      BLOCKED_REASON_DEFINITIONS[blockedReason]?.label ||
      'Bloqueo semanal';

    const eventId = editingBlockedId || `block-recur-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newBlockedEvent: BlockedTimeEvent = {
      id: eventId,
      title: finalTitle,
      category: blockedReason,
      startTime: blockedStartTime,
      endTime: blockedEndTime,
      durationHours: computedFormDurationHours,
      recurringDays: [...blockedDays].sort((a, b) => a - b),
      notes: blockedNotes.trim() || undefined,
    };

    let updatedList: BlockedTimeEvent[];
    if (editingBlockedId) {
      updatedList = internalBlockedEvents.map((evt) =>
        evt.id === editingBlockedId ? newBlockedEvent : evt
      );
      if (onUpdateBlockedEvent) onUpdateBlockedEvent(newBlockedEvent);
    } else {
      updatedList = [...internalBlockedEvents, newBlockedEvent];
      if (onAddBlockedEvent) onAddBlockedEvent(newBlockedEvent);
    }

    setInternalBlockedEvents(updatedList);
    storageService.saveBlockedEvents(updatedList);

    // Synchronize into weekly obligations in preferences
    const newObligations: WeeklyObligation[] = blockedDays.map((dayNum) => ({
      id: `ob-${eventId}-${dayNum}`,
      title: finalTitle,
      category: (blockedReason as any) || 'otro',
      dayOfWeek: dayNum,
      startTime: blockedStartTime,
      endTime: blockedEndTime,
      durationHours: computedFormDurationHours,
      isAutomatedWeekly: true,
      recurringDays: blockedDays,
    }));

    const cleanExisting = (internalPreferences.weeklyFixedObligations || []).filter(
      (ob) => !ob.id.startsWith(`ob-${eventId}`)
    );
    const updatedPreferences: StudyPreferences = {
      ...internalPreferences,
      weeklyFixedObligations: [...cleanExisting, ...newObligations],
    };

    setInternalPreferences(updatedPreferences);
    if (onUpdatePreferences) onUpdatePreferences(updatedPreferences);
    storageService.savePreferences(updatedPreferences);

    // Reset form
    setBlockedTitle('');
    setBlockedNotes('');
    setEditingBlockedId(null);
    setShowAddBlockedForm(false);
  };

  const handleStartEditBlocked = (evt: BlockedTimeEvent) => {
    setEditingBlockedId(evt.id);
    setBlockedReason((evt.category as BlockedCategory) || 'clase');
    setBlockedTitle(evt.title || '');
    setBlockedDays(evt.recurringDays && evt.recurringDays.length > 0 ? evt.recurringDays : [1, 2, 3, 4, 5]);
    setBlockedStartTime(evt.startTime || '09:00');
    setBlockedEndTime(evt.endTime || '13:00');
    setBlockedNotes(evt.notes || '');
    setShowAddBlockedForm(true);
    setConfirmDeleteBlockedId(null);
    setFormError(null);
  };

  const handleDeleteRecurringBlocked = (eventId: string) => {
    const updated = internalBlockedEvents.filter((e) => e.id !== eventId);
    setInternalBlockedEvents(updated);
    if (onDeleteBlockedEvent) onDeleteBlockedEvent(eventId);
    storageService.saveBlockedEvents(updated);

    const cleanObligations = (internalPreferences.weeklyFixedObligations || []).filter(
      (ob) => !ob.id.startsWith(`ob-${eventId}`)
    );
    const updatedPreferences = {
      ...internalPreferences,
      weeklyFixedObligations: cleanObligations,
    };
    setInternalPreferences(updatedPreferences);
    if (onUpdatePreferences) onUpdatePreferences(updatedPreferences);
    storageService.savePreferences(updatedPreferences);

    setConfirmDeleteBlockedId(null);
  };

  const handleRecalculateSchedule = () => {
    setIsRecalculating(true);
    setRecalculateFeedback(null);

    setTimeout(() => {
      try {
        const result = schedulerService.recalculateTopicsAccordingToBlockedHours(
          subjectsInScope,
          internalPreferences,
          internalBlockedEvents,
          internalPreferences.weeklyFixedObligations || []
        );

        const updatedSubjectMap = new Map(result.updatedSubjects.map((s) => [s.id, s]));

        const updatedPrograms = programs.map((p) => ({
          ...p,
          years: p.years.map((y) => ({
            ...y,
            subjects: y.subjects.map((s) => updatedSubjectMap.get(s.id) || s),
          })),
        }));

        onUpdatePrograms(updatedPrograms);
        setInternalPreferences(result.updatedPreferences);
        if (onUpdatePreferences) onUpdatePreferences(result.updatedPreferences);

        storageService.savePrograms(updatedPrograms);
        storageService.savePreferences(result.updatedPreferences);

        setRecalculateFeedback(
          `¡Temario y repasos recalculados con éxito! Se han reorganizado ${result.recalculatedTopicsCount} temas pendientes y programado ${result.sessionsGeneratedCount} sesiones sin colisionar con tus ${dailyNeeds.totalBlockedHoursWeekly}h bloqueadas. Necesitas ${dailyNeeds.totalHoursNeededDaily}h/día (${dailyNeeds.newStudyHoursNeededDaily}h/d temario nuevo + ${dailyNeeds.reviewHoursNeededDaily}h/d repasos programados).`
        );
      } catch (err) {
        console.error('Error recalculating schedule:', err);
      } finally {
        setIsRecalculating(false);
      }
    }, 400);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'clase':
        return GraduationCap;
      case 'trabajo':
        return Briefcase;
      case 'deporte':
        return Dumbbell;
      case 'medico':
        return HeartPulse;
      case 'transporte':
        return Car;
      case 'descanso':
        return Coffee;
      case 'social':
        return Users;
      case 'personal':
        return User;
      default:
        return Clock;
    }
  };

  if (!isOpen) return null;

  // ==========================================
  // 1. ESTUDIOS (STUDY PROGRAMS): CREATE, EDIT, DELETE
  // ==========================================
  const handleAddProgram = () => {
    if (!newProgramName.trim()) return;

    const newProg: StudyProgram = {
      id: `prog-${Date.now()}`,
      name: newProgramName.trim(),
      institution: newProgramInst.trim() || undefined,
      years: [
        {
          id: `yr-${Date.now()}-1`,
          name: '1º Curso',
          academicPeriod: '2026/2027',
          startDate: '2026-09-15',
          targetWeeklyHours: 20,
          subjects: [],
        },
      ],
    };

    const updated = [...programs, newProg];
    onUpdatePrograms(updated);
    onSelectProgramAndYear(newProg.id, newProg.years[0].id);

    setNewProgramName('');
    setNewProgramInst('');
    setShowAddProgram(false);
  };

  const handleStartEditProgram = (prog: StudyProgram, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteProgramId(null);
    setEditingProgramId(prog.id);
    setEditProgramName(prog.name);
    setEditProgramInst(prog.institution || '');
  };

  const handleSaveEditProgram = (progId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editProgramName.trim()) return;

    const updated = programs.map((p) =>
      p.id === progId
        ? {
            ...p,
            name: editProgramName.trim(),
            institution: editProgramInst.trim() || undefined,
          }
        : p
    );
    onUpdatePrograms(updated);
    setEditingProgramId(null);
  };

  const handleDeleteProgram = (progId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = programs.filter((p) => p.id !== progId);

    if (remaining.length === 0) {
      const fallbackProg: StudyProgram = {
        id: `prog-${Date.now()}`,
        name: 'Mi Estudio',
        years: [
          {
            id: `yr-${Date.now()}-1`,
            name: '1º Curso',
            academicPeriod: '2026/2027',
            startDate: '2026-09-15',
            targetWeeklyHours: 20,
            subjects: [],
          },
        ],
      };
      onUpdatePrograms([fallbackProg]);
      onSelectProgramAndYear(fallbackProg.id, fallbackProg.years[0].id);
    } else {
      onUpdatePrograms(remaining);
      if (progId === currentProgram?.id) {
        const nextProg = remaining[0];
        onSelectProgramAndYear(nextProg.id, nextProg.years[0]?.id || '');
      }
    }
    setConfirmDeleteProgramId(null);
  };

  // ==========================================
  // 2. CURSOS / AÑOS (ACADEMIC YEARS): CREATE, EDIT, DELETE
  // ==========================================
  const handleAddYear = () => {
    if (!currentProgram || !newYearName.trim()) return;

    const newYear: AcademicYear = {
      id: `yr-${Date.now()}`,
      name: newYearName.trim(),
      academicPeriod: '2026/2027',
      startDate: '2026-09-15',
      targetWeeklyHours: 20,
      subjects: [],
    };

    const updated = programs.map((p) =>
      p.id === currentProgram.id ? { ...p, years: [...p.years, newYear] } : p
    );

    onUpdatePrograms(updated);
    onSelectProgramAndYear(currentProgram.id, newYear.id);

    setNewYearName('');
    setShowAddYear(false);
  };

  const handleStartEditYear = (year: AcademicYear, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteYearId(null);
    setEditingYearId(year.id);
    setEditYearName(year.name);
    setEditYearPeriod(year.academicPeriod || '2026/2027');
    setEditYearStartDate(year.startDate || '2026-09-15');
    setEditYearTargetHours(String(year.targetWeeklyHours || 20));
  };

  const handleSaveEditYear = (yearId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editYearName.trim()) return;

    const parsedHours = Math.max(1, parseInt(editYearTargetHours, 10) || 20);
    const updated = programs.map((p) => ({
      ...p,
      years: p.years.map((y) =>
        y.id === yearId
          ? {
              ...y,
              name: editYearName.trim(),
              academicPeriod: editYearPeriod.trim() || '2026/2027',
              startDate: editYearStartDate || '2026-09-15',
              targetWeeklyHours: parsedHours,
            }
          : y
      ),
    }));

    onUpdatePrograms(updated);
    setEditingYearId(null);
  };

  const handleDeleteYear = (yearId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetProg = programs.find((p) => p.years.some((y) => y.id === yearId)) || currentProgram;
    if (!targetProg) return;

    const remainingYears = targetProg.years.filter((y) => y.id !== yearId);
    const finalYears: AcademicYear[] =
      remainingYears.length > 0
        ? remainingYears
        : [
            {
              id: `yr-${Date.now()}-1`,
              name: '1º Curso',
              academicPeriod: '2026/2027',
              startDate: '2026-09-15',
              targetWeeklyHours: 20,
              subjects: [],
            },
          ];

    const updated = programs.map((p) =>
      p.id === targetProg.id ? { ...p, years: finalYears } : p
    );

    onUpdatePrograms(updated);
    if (yearId === currentYear?.id) {
      onSelectProgramAndYear(targetProg.id, finalYears[0].id);
    }
    setConfirmDeleteYearId(null);
  };

  // ==========================================
  // 3. ASIGNATURAS (SUBJECTS): CREATE, EDIT, DELETE
  // ==========================================
  const handleAddSubject = () => {
    if (!currentProgram || !currentYear || !newSubName.trim()) return;

    const newSubject: Subject = {
      id: `sub-${Date.now()}`,
      name: newSubName.trim(),
      code: newSubCode.trim() || undefined,
      color: newSubColor || '#3b82f6',
      credits: Math.max(1, parseFloat(newSubCredits) || 6),
      professor: newSubProf.trim() || undefined,
      topics: [],
      tasks: [],
      exams: [],
      projects: [],
      cornellNotes: [],
      flashcards: [],
      quizzes: [],
      feynmanSessions: [],
      mindmaps: [],
      errorLogs: [],
    };

    const updated = programs.map((p) => {
      if (p.id === currentProgram.id) {
        return {
          ...p,
          years: p.years.map((y) =>
            y.id === currentYear.id ? { ...y, subjects: [...y.subjects, newSubject] } : y
          ),
        };
      }
      return p;
    });

    onUpdatePrograms(updated);
    setNewSubName('');
    setNewSubCode('');
    setNewSubProf('');
    setNewSubCredits('6');
    setShowAddSub(false);
  };

  const handleStartEditSubject = (sub: Subject) => {
    setConfirmDeleteSubId(null);
    setEditingSubId(sub.id);
    setEditSubName(sub.name);
    setEditSubCode(sub.code || '');
    setEditSubProf(sub.professor || '');
    setEditSubCredits(String(sub.credits ?? 6));
    setEditSubColor(sub.color || '#3b82f6');
  };

  const handleSaveEditSubject = (subId: string) => {
    if (!currentProgram || !currentYear || !editSubName.trim()) return;

    const updated = programs.map((p) => {
      if (p.id !== currentProgram.id) return p;
      return {
        ...p,
        years: p.years.map((y) => {
          if (y.id !== currentYear.id) return y;
          return {
            ...y,
            subjects: y.subjects.map((s) =>
              s.id === subId
                ? {
                    ...s,
                    name: editSubName.trim(),
                    code: editSubCode.trim() || undefined,
                    professor: editSubProf.trim() || undefined,
                    credits: Math.max(1, parseFloat(editSubCredits) || 6),
                    color: editSubColor || '#3b82f6',
                  }
                : s
            ),
          };
        }),
      };
    });

    onUpdatePrograms(updated);
    setEditingSubId(null);
  };

  const handleDeleteSubject = (subId: string) => {
    if (!currentProgram || !currentYear) return;

    const updated = programs.map((p) => {
      if (p.id !== currentProgram.id) return p;
      return {
        ...p,
        years: p.years.map((y) =>
          y.id === currentYear.id
            ? { ...y, subjects: y.subjects.filter((s) => s.id !== subId) }
            : y
        ),
      };
    });

    onUpdatePrograms(updated);
    setConfirmDeleteSubId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onImportJSON(content);
      setImportNotice('¡Datos importados con éxito!');
      setTimeout(() => setImportNotice(null), 3000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-blue-600" />
              <span>Jerarquía Académica · Gestión de Estudios, Cursos y Materias</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Crea, modifica o elimina tus estudios, cursos académicos y asignaturas en cualquier momento.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 px-6 pt-2 gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setActiveModalTab('all')}
            className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeModalTab === 'all'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Vista Completa (Árbol y Panorama Académico)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-mono-numbers">
              {allGlobalStats.totalSubjects} materias · {allGlobalStats.totalCredits} ECTS
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModalTab('hierarchy')}
            className={`pb-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeModalTab === 'hierarchy'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Gestión y Edición (Estudios, Cursos y Materias)</span>
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {importNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              {importNotice}
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 1: VISTA COMPLETA (ÁRBOL Y PANORAMA ACADÉMICO ULTRA VISUAL) */}
          {/* ========================================================== */}
          {activeModalTab === 'all' && (
            <div className="space-y-6">
              {/* Executive Academic Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 bg-gradient-to-br from-blue-50/80 to-blue-100/40 dark:from-blue-950/40 dark:to-slate-800/60 border border-blue-200/70 dark:border-blue-900/50 rounded-2xl">
                  <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Estudios</span>
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                    {allGlobalStats.totalPrograms}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {selectedProgramIds.length > 1 ? `${selectedProgramIds.length} en mix activo` : 'Programas / Carreras'}
                  </span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-indigo-50/80 to-indigo-100/40 dark:from-indigo-950/40 dark:to-slate-800/60 border border-indigo-200/70 dark:border-indigo-900/50 rounded-2xl">
                  <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Cursos</span>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                    {allGlobalStats.totalYears}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Años académicos
                  </span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-purple-50/80 to-purple-100/40 dark:from-purple-950/40 dark:to-slate-800/60 border border-purple-200/70 dark:border-purple-900/50 rounded-2xl">
                  <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Materias</span>
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                    {allGlobalStats.totalSubjects}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Asignaturas totales
                  </span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-amber-50/80 to-amber-100/40 dark:from-amber-950/40 dark:to-slate-800/60 border border-amber-200/70 dark:border-amber-900/50 rounded-2xl">
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Créditos</span>
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                    {allGlobalStats.totalCredits}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    ECTS acumulados
                  </span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-emerald-50/80 to-emerald-100/40 dark:from-emerald-950/40 dark:to-slate-800/60 border border-emerald-200/70 dark:border-emerald-900/50 rounded-2xl">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Temario</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-emerald-600 dark:text-emerald-400">
                    {allGlobalStats.completionPct}%
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${allGlobalStats.completionPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    {allGlobalStats.completedTopics}/{allGlobalStats.totalTopics} temas listos
                  </span>
                </div>

                <div className="p-3.5 bg-gradient-to-br from-cyan-50/80 to-cyan-100/40 dark:from-cyan-950/40 dark:to-slate-800/60 border border-cyan-200/70 dark:border-cyan-900/50 rounded-2xl">
                  <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Cornell</span>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                    {allGlobalStats.totalNotes}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Fichas y documentos
                  </span>
                </div>
              </div>

              {/* Panorama Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-2xl">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={panoramaSearch}
                    onChange={(e) => setPanoramaSearch(e.target.value)}
                    placeholder="Buscar materia por nombre, código, profesor..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                  />
                  {panoramaSearch && (
                    <button
                      type="button"
                      onClick={() => setPanoramaSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
                    <button
                      type="button"
                      onClick={() => setPanoramaProgramFilter('all')}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        panoramaProgramFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Todos ({programs.length})
                    </button>
                    {programs.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPanoramaProgramFilter(p.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          panoramaProgramFilter === p.id
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveModalTab('hierarchy')}
                    className="px-3 py-1 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Añadir / Editar en Jerarquía</span>
                  </button>
                </div>
              </div>

              {/* Panorama Tree: Programs -> Years -> Subjects */}
              <div className="space-y-6">
                {programs
                  .filter((p) => panoramaProgramFilter === 'all' || panoramaProgramFilter === p.id)
                  .map((program) => {
                    const isProgramActive = activeProgramId === program.id;
                    const isProgramSelected = selectedProgramIds.includes(program.id);
                    const programSubjects = program.years.flatMap((y) => y.subjects);
                    const programCredits = programSubjects.reduce((acc, s) => acc + (s.credits || 0), 0);
                    const programTopics = programSubjects.flatMap((s) => s.topics);
                    const programCompletedTopics = programTopics.filter(
                      (t) =>
                        t.status === 'estudiado' ||
                        t.status === 'repasado' ||
                        (typeof t.vueltasCount === 'number' && t.vueltasCount > 0)
                    ).length;
                    const programProgPct =
                      programTopics.length > 0
                        ? Math.round((programCompletedTopics / programTopics.length) * 100)
                        : 0;

                    const query = panoramaSearch.trim().toLowerCase();

                    return (
                      <div
                        key={program.id}
                        className={`rounded-2xl border transition-all ${
                          isProgramActive
                            ? 'bg-gradient-to-b from-blue-50/30 via-white to-white dark:from-slate-900 dark:to-slate-900 border-blue-300 dark:border-blue-800 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                        } p-5 space-y-4`}
                      >
                        {/* Program Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs shrink-0 mt-0.5">
                              <GraduationCap className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                  {program.name}
                                </h4>
                                {isProgramActive && (
                                  <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                                    Principal
                                  </span>
                                )}
                                {isProgramSelected && !isProgramActive && (
                                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-300">
                                    En Mix Activo
                                  </span>
                                )}
                              </div>
                              {program.institution && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {program.institution}
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {program.years.length} {program.years.length === 1 ? 'curso' : 'cursos'}
                                </span>
                                <span>·</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {programSubjects.length} materias
                                </span>
                                <span>·</span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  {programCredits} ECTS
                                </span>
                                <span>·</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {programProgPct}% temario listo ({programCompletedTopics}/{programTopics.length})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {!isProgramActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  const firstYearId = program.years[0]?.id || '';
                                  onSelectProgramAndYear(program.id, firstYearId);
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                              >
                                Seleccionar como Principal
                              </button>
                            )}

                            {onToggleProgramSelection && (
                              <button
                                type="button"
                                onClick={() => onToggleProgramSelection(program.id)}
                                className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                  isProgramSelected
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                }`}
                                title="Incluir o excluir este estudio del mix unificado de calendarios"
                              >
                                {isProgramSelected ? '✓ En Mix Unificado' : '+ Añadir a Mix'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setActiveModalTab('hierarchy');
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Editar este programa en la jerarquía"
                            >
                              <Pencil className="w-3 h-3 text-slate-500" />
                              <span>Editar</span>
                            </button>
                          </div>
                        </div>

                        {/* Courses / Years inside this Program */}
                        <div className="space-y-4 pt-1">
                          {program.years.map((year) => {
                            const isYearActive = activeYearId === year.id;
                            const isYearSelected = selectedYearIds.includes(year.id);

                            const matchingSubjects = year.subjects.filter((s) => {
                              if (!query) return true;
                              return (
                                s.name.toLowerCase().includes(query) ||
                                (s.code && s.code.toLowerCase().includes(query)) ||
                                (s.professor && s.professor.toLowerCase().includes(query)) ||
                                (s.topics && s.topics.some((t) => t.title.toLowerCase().includes(query)))
                              );
                            });

                            if (query && matchingSubjects.length === 0) return null;

                            return (
                              <div
                                key={year.id}
                                className="rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 p-4 space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                      {year.name}
                                    </h5>
                                    {year.academicPeriod && (
                                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                        📅 {year.academicPeriod}
                                      </span>
                                    )}
                                    {year.targetWeeklyHours && (
                                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-900">
                                        🎯 {year.targetWeeklyHours}h / semana
                                      </span>
                                    )}
                                    {isYearActive && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                        Curso Activo
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {onToggleYearSelection && (
                                      <button
                                        type="button"
                                        onClick={() => onToggleYearSelection(year.id)}
                                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                                          isYearSelected
                                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                                            : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                        }`}
                                      >
                                        {isYearSelected ? '✓ Activo en Calendarios' : 'Activar en Calendarios'}
                                      </button>
                                    )}

                                    {!isYearActive && (
                                      <button
                                        type="button"
                                        onClick={() => onSelectProgramAndYear(program.id, year.id)}
                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                                      >
                                        Cambiar a este curso
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Grid of Subject Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {matchingSubjects.map((subject) => {
                                    const totalSubTopics = subject.topics?.length || 0;
                                    const completedSubTopics = (subject.topics || []).filter(
                                      (t) =>
                                        t.status === 'estudiado' ||
                                        t.status === 'repasado' ||
                                        (typeof t.vueltasCount === 'number' && t.vueltasCount > 0)
                                    ).length;
                                    const subProgressPct =
                                      totalSubTopics > 0
                                        ? Math.round((completedSubTopics / totalSubTopics) * 100)
                                        : 0;
                                    const notesCount = (subject.topics || []).filter(
                                       (t) => Boolean(t.notes?.trim() || t.generalNotes?.trim() || (t.attachedFiles && t.attachedFiles.length > 0))
                                     ).length;

                                    return (
                                      <div
                                        key={subject.id}
                                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 p-3.5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between space-y-3 group"
                                      >
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <span
                                                className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                                                style={{ backgroundColor: subject.color || '#3b82f6' }}
                                              />
                                              {subject.code && (
                                                <span className="text-[10px] font-extrabold uppercase font-mono-numbers px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                  {subject.code}
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                                              {subject.credits || 6} ECTS
                                            </span>
                                          </div>

                                          <h6 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                                            {subject.name}
                                          </h6>

                                          {subject.professor && (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                              👨‍🏫 {subject.professor}
                                            </p>
                                          )}
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-500 dark:text-slate-400">
                                              Temario ({completedSubTopics}/{totalSubTopics})
                                            </span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono-numbers">
                                              {subProgressPct}%
                                            </span>
                                          </div>
                                          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all"
                                              style={{
                                                width: `${subProgressPct}%`,
                                                backgroundColor: subject.color || '#10b981',
                                              }}
                                            />
                                          </div>

                                          <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                                            <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                                              📝 {notesCount} {notesCount === 1 ? 'apunte' : 'apuntes'}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  onSelectProgramAndYear(program.id, year.id);
                                                  onClose();
                                                }}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                                              >
                                                Abrir
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  onSelectProgramAndYear(program.id, year.id);
                                                  setEditingSubId(subject.id);
                                                  setEditSubName(subject.name);
                                                  setEditSubCode(subject.code || '');
                                                  setEditSubProf(subject.professor || '');
                                                  setEditSubCredits(String(subject.credits || 6));
                                                  setEditSubColor(subject.color || '#3b82f6');
                                                  setActiveModalTab('hierarchy');
                                                }}
                                                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                                title="Editar datos de esta asignatura"
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                {programs.length === 0 && (
                  <div className="p-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                    <GraduationCap className="w-10 h-10 text-slate-400 mx-auto" />
                    <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      No hay estudios registrados aún
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      Crea tu primer grado universitario, oposición o máster para comenzar a estructurar tus cursos y temarios.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('hierarchy')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Crear Mi Primer Estudio</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: GESTIÓN Y JERARQUÍA (CREAR, MODIFICAR, ELIMINAR)   */}
          {/* ========================================================== */}
          {activeModalTab === 'hierarchy' && (
            <div className="space-y-6">
              {/* Level 1: Study Programs (Carreras / Estudios)              */}
              {/* ========================================================== */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Selecciona, Combina o Añade Estudios (Carreras, Grados, Oposiciones...)
              </h4>
              <div className="flex items-center gap-2">
                {programs.length > 1 && onSelectAllProgramsAndYears && (
                  <button
                    type="button"
                    onClick={onSelectAllProgramsAndYears}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                    title="Activar todos los estudios y cursos a la vez para ver un mix unificado en los calendarios"
                  >
                    Activar Mix de Todos los Estudios ({programs.length})
                  </button>
                )}
                <button
                  onClick={() => setShowAddProgram(!showAddProgram)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Estudio</span>
                </button>
              </div>
            </div>

            <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/50 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2">
              <span>
                💡 <strong>Mix de Carreras y Estudios:</strong> Marca la casilla <strong>"Combinar"</strong> en varios estudios para ver simultáneamente en el calendario tus repasos, sesiones y exámenes pendientes de ambas carreras.
              </span>
            </div>

            {showAddProgram && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Nombre del Estudio *
                    </label>
                    <input
                      type="text"
                      value={newProgramName}
                      onChange={(e) => setNewProgramName(e.target.value)}
                      placeholder="Ej: Grado en Derecho, Bachillerato Tecnológico, Oposiciones..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Centro o Universidad (opcional)
                    </label>
                    <input
                      type="text"
                      value={newProgramInst}
                      onChange={(e) => setNewProgramInst(e.target.value)}
                      placeholder="Ej: Universidad Complutense, IES Ramiro de Maeztu..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddProgram(false)}
                    className="px-3 py-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddProgram}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Crear Estudio
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {programs.map((prog) => {
                const isSelected = prog.id === currentProgram?.id;
                const isProgramMultiActive =
                  selectedProgramIds.includes(prog.id) ||
                  prog.years.some((y) => selectedYearIds.includes(y.id));
                const isEditing = editingProgramId === prog.id;
                const isConfirmingDelete = confirmDeleteProgramId === prog.id;

                return (
                  <div
                    key={prog.id}
                    onClick={() => {
                      if (!isEditing && !isConfirmingDelete && prog.years.length > 0) {
                        onSelectProgramAndYear(prog.id, prog.years[0].id);
                      }
                    }}
                    className={`p-4 rounded-xl border text-xs transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                        : isProgramMultiActive
                        ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800/80'
                    } ${!isEditing && !isConfirmingDelete ? 'cursor-pointer' : ''}`}
                  >
                    {isEditing ? (
                      <div
                        className="space-y-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Nombre del Estudio
                          </label>
                          <input
                            type="text"
                            value={editProgramName}
                            onChange={(e) => setEditProgramName(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-blue-400 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                            placeholder="Nombre del estudio"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Centro / Institución
                          </label>
                          <input
                            type="text"
                            value={editProgramInst}
                            onChange={(e) => setEditProgramInst(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                            placeholder="Universidad / Centro (opcional)"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProgramId(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleSaveEditProgram(prog.id, e)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    ) : isConfirmingDelete ? (
                      <div
                        className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 space-y-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-start gap-2 text-rose-900 dark:text-rose-200">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] font-semibold leading-snug">
                            ¿Eliminar el estudio <strong>"{prog.name}"</strong> y sus cursos?
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteProgramId(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProgram(prog.id, e)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Sí, eliminar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                              {prog.name}
                            </div>
                            {prog.institution && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {prog.institution}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isSelected ? (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
                                Principal
                              </span>
                            ) : isProgramMultiActive ? (
                              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                                En Mix
                              </span>
                            ) : null}

                            {onToggleProgramSelection && (
                              <label
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:border-indigo-400"
                                title="Activar o desactivar este estudio simultáneamente con otros en los calendarios"
                              >
                                <input
                                  type="checkbox"
                                  checked={isProgramMultiActive}
                                  onChange={() => onToggleProgramSelection(prog.id)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <span>Combinar</span>
                              </label>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between gap-2">
                          <span className="text-slate-400 font-mono-numbers">
                            {prog.years.length} {prog.years.length === 1 ? 'curso' : 'cursos'} ·{' '}
                            {prog.years.reduce((acc, y) => acc + y.subjects.length, 0)} asig.
                          </span>

                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleStartEditProgram(prog, e)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                              title="Modificar nombre o centro de este estudio"
                            >
                              <Pencil className="w-3 h-3 text-blue-600" />
                              <span>Modificar</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProgramId(null);
                                setConfirmDeleteProgramId(prog.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50 transition-colors cursor-pointer"
                              title="Eliminar este estudio"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================== */}
          {/* Level 2: Years / Academic courses across active studies    */}
          {/* ========================================================== */}
          {currentProgram && (
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  2. Años / Cursos Disponibles (Combina cursos de uno o varios estudios)
                </h4>
                <button
                  onClick={() => setShowAddYear(!showAddYear)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Año/Curso a "{currentProgram.name}"</span>
                </button>
              </div>

              {showAddYear && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
                  <input
                    type="text"
                    value={newYearName}
                    onChange={(e) => setNewYearName(e.target.value)}
                    placeholder="Ej: 2º Curso, 3º Curso..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddYear(false)}
                      className="px-3 py-1 text-slate-500 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddYear}
                      className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg cursor-pointer"
                    >
                      Añadir Año
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/50 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between gap-2">
                <span>
                  💡 <strong>Mix de Cursos entre Carreras:</strong> Marca <strong>"Ver en Calendario"</strong> en cualquier curso de cualquiera de tus estudios para unificar todas sus asignaturas, repasos y exámenes. Haz clic en el nombre de un curso para gestionar sus asignaturas abajo.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {programs
                  .flatMap((prog) =>
                    prog.years.map((year) => ({ prog, year }))
                  )
                  .map(({ prog, year }) => {
                    const isPrimary = year.id === currentYear?.id;
                    const isMultiActive = selectedYearIds.includes(year.id);
                    const isEditingYear = editingYearId === year.id;
                    const isConfirmingDeleteYear = confirmDeleteYearId === year.id;

                    return (
                      <div
                        key={year.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                          isPrimary
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 shadow-2xs'
                            : isMultiActive
                            ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50'
                        }`}
                      >
                        {isEditingYear ? (
                          <div className="space-y-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                  Nombre del Curso
                                </label>
                                <input
                                  type="text"
                                  value={editYearName}
                                  onChange={(e) => setEditYearName(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-blue-400 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                                  placeholder="Ej: 1º Curso"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                  Periodo Académico
                                </label>
                                <input
                                  type="text"
                                  value={editYearPeriod}
                                  onChange={(e) => setEditYearPeriod(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                                  placeholder="Ej: 2026/2027"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                  Fecha Inicio Curso
                                </label>
                                <input
                                  type="date"
                                  value={editYearStartDate}
                                  onChange={(e) => setEditYearStartDate(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                  Meta Horas / Semana
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={editYearTargetHours}
                                  onChange={(e) => setEditYearTargetHours(e.target.value)}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingYearId(null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSaveEditYear(year.id, e)}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Guardar</span>
                              </button>
                            </div>
                          </div>
                        ) : isConfirmingDeleteYear ? (
                          <div
                            className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-start gap-2 text-rose-900 dark:text-rose-200">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <p className="text-[11px] font-semibold leading-snug">
                                ¿Eliminar el curso <strong>"{year.name}"</strong> ({prog.name}) y sus {year.subjects.length} asignaturas?
                              </p>
                            </div>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteYearId(null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteYear(year.id, e)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Sí, eliminar</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectProgramAndYear(prog.id, year.id)}
                                className="flex-1 text-left cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {prog.name}
                                  </span>
                                  {isPrimary && (
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                      Editando asignaturas
                                    </span>
                                  )}
                                  {isMultiActive && !isPrimary && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                                      Activo en Mix
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                  <span>{year.name}</span>
                                  {year.academicPeriod && (
                                    <span className="text-[10px] font-normal text-slate-400">
                                      ({year.academicPeriod})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono-numbers mt-0.5">
                                  {year.subjects.length} asignaturas · Meta: {year.targetWeeklyHours || 20}h/sem
                                </div>
                              </button>

                              {onToggleYearSelection && (
                                <label
                                  className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer px-2 py-1 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 shrink-0"
                                  title="Marcar para visualizar simultáneamente en los calendarios y vistas junto con otros cursos/carreras"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isMultiActive}
                                    onChange={() => onToggleYearSelection(year.id)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                    Ver en Calendario
                                  </span>
                                </label>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleStartEditYear(year, e)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                                title="Modificar información de este curso"
                              >
                                <Pencil className="w-3 h-3 text-blue-600" />
                                <span>Modificar</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingYearId(null);
                                  setConfirmDeleteYearId(year.id);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50 transition-colors cursor-pointer"
                                title="Eliminar este curso"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* Level 3: Subjects in current year                          */}
          {/* ========================================================== */}
          {currentYear && (
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  3. Asignaturas de {currentYear.name}
                </h4>
                <button
                  onClick={() => setShowAddSub(!showAddSub)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Asignatura</span>
                </button>
              </div>

              {showAddSub && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                        Nombre de la Asignatura *
                      </label>
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder="Ej: Fisiología Humana, Matemáticas II..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                        Código / Siglas
                      </label>
                      <input
                        type="text"
                        value={newSubCode}
                        onChange={(e) => setNewSubCode(e.target.value)}
                        placeholder="Ej: FIS-101"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                        Créditos
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        step="0.5"
                        value={newSubCredits}
                        onChange={(e) => setNewSubCredits(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                      Color distintivo de la asignatura
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {SUBJECT_COLOR_PALETTE.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setNewSubColor(c.hex)}
                          className={`w-6 h-6 rounded-full transition-transform cursor-pointer border ${
                            newSubColor === c.hex
                              ? 'ring-2 ring-offset-2 ring-slate-800 scale-110'
                              : 'hover:scale-105 border-transparent'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Profesor / Docente (opcional)
                    </label>
                    <input
                      type="text"
                      value={newSubProf}
                      onChange={(e) => setNewSubProf(e.target.value)}
                      placeholder="Ej: Dra. García"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowAddSub(false)}
                      className="px-3 py-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddSubject}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                    >
                      Crear Asignatura
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {currentYear.subjects.map((sub) => {
                  const isEditingSub = editingSubId === sub.id;
                  const isConfirmingDeleteSub = confirmDeleteSubId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 text-xs transition-all"
                    >
                      {isEditingSub ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Nombre de la Asignatura *
                              </label>
                              <input
                                type="text"
                                value={editSubName}
                                onChange={(e) => setEditSubName(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-blue-400 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                                placeholder="Nombre de la asignatura"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Código / Siglas
                              </label>
                              <input
                                type="text"
                                value={editSubCode}
                                onChange={(e) => setEditSubCode(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                                placeholder="Ej: BIO-102"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Créditos
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={60}
                                step="0.5"
                                value={editSubCredits}
                                onChange={(e) => setEditSubCredits(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Profesor / Docente
                              </label>
                              <input
                                type="text"
                                value={editSubProf}
                                onChange={(e) => setEditSubProf(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                                placeholder="Ej: Dr. Martínez"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Color de la Asignatura
                              </label>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {SUBJECT_COLOR_PALETTE.map((c) => (
                                  <button
                                    key={c.hex}
                                    type="button"
                                    onClick={() => setEditSubColor(c.hex)}
                                    className={`w-5 h-5 rounded-full transition-transform cursor-pointer border ${
                                      editSubColor === c.hex
                                        ? 'ring-2 ring-offset-1 ring-slate-800 scale-110'
                                        : 'hover:scale-105 border-transparent'
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingSubId(null)}
                              className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditSubject(sub.id)}
                              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Guardar cambios</span>
                            </button>
                          </div>
                        </div>
                      ) : isConfirmingDeleteSub ? (
                        <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span className="text-[11px] font-semibold">
                              ¿Eliminar la asignatura <strong>"{sub.name}"</strong> y todo su contenido?
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSubId(null)}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubject(sub.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Sí, eliminar</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: sub.color || '#3b82f6' }}
                            />
                            <div className="truncate">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {sub.name}
                              </span>
                              {sub.code && (
                                <span className="text-slate-400 font-mono-numbers ml-2">
                                  ({sub.code})
                                </span>
                              )}
                              {sub.professor && (
                                <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-2">
                                  · {sub.professor}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 text-slate-400 font-mono-numbers">
                              <span>{sub.credits || 6} cr.</span>
                              <span>·</span>
                              <span>{sub.topics.length} temas</span>
                              <span>·</span>
                              <span>{sub.cornellNotes.length} apuntes</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditSubject(sub)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                                title="Modificar nombre, código, profesor, créditos o color de la asignatura"
                              >
                                <Pencil className="w-3 h-3 text-blue-600" />
                                <span>Modificar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSubId(null);
                                  setConfirmDeleteSubId(sub.id);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50 transition-colors cursor-pointer"
                                title="Eliminar esta asignatura"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {currentYear.subjects.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    No hay asignaturas en este año aún.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

          {/* Backup & Exportación/Importación de Datos */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-blue-600" />
              <span>Gestiona y edita tus programas, cursos y asignaturas con los controles de cada tarjeta.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onExportJSON}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Copia JSON</span>
              </button>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg transition-colors">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Importar JSON</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
