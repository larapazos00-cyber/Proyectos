import React, { useState, useEffect } from 'react';
import {
  StudyProgram,
  AcademicYear,
  Subject,
  Task,
  Exam,
  StudyPreferences,
  PomodoroLog,
  BlockedTimeEvent,
  Quiz,
  ErrorLogEntry,
  Flashcard,
} from './types';
import { storageService } from './services/storageService';
import { schedulerService } from './services/schedulerService';
import { Navigation, NavTabId } from './components/Navigation';
import { CourseGeneralView } from './components/CourseGeneralView';
import { SubjectDetailView } from './components/SubjectDetailView';
import { PomodoroTimer } from './components/PomodoroTimer';
import { SmartCalendarModal } from './components/SmartCalendarModal';
import { SpacedRepetitionCalendarView } from './components/SpacedRepetitionCalendarView';
import { HabitsTracker } from './components/HabitsTracker';
import { PracticeQuizModule } from './components/PracticeQuizModule';
import { WeeklyStatsModal } from './components/WeeklyStatsModal';
import { ProgramManagerModal } from './components/ProgramManagerModal';
import { StudyPreferencesModal } from './components/StudyPreferencesModal';
import { ErrorAnalysisModal } from './components/ErrorAnalysisModal';
import { ExamsManagerModal } from './components/ExamsManagerModal';
import { AuthModal } from './components/AuthModal';
import { InteractiveOnboardingTour } from './components/InteractiveOnboardingTour';
import { notificationService } from './services/notificationService';
import { ArrowLeft, BookOpen, Plus, LayoutGrid, Kanban, AlertTriangle, AlertCircle, List, ChevronRight, FileText, PanelRight, Sparkles, Clock, RotateCcw, HelpCircle, ArrowRight, Brain, Zap } from 'lucide-react';
import { TopicKanbanBoard } from './components/TopicKanbanBoard';
import { SubjectDocumentsSidePanel } from './components/SubjectDocumentsSidePanel';
import { SubjectSpacedRepetitionInfoPopover } from './components/SubjectSpacedRepetitionInfoPopover';
import { SubjectQuickReviewOverlay } from './components/SubjectQuickReviewOverlay';
import { FeynmanChallenge } from './components/FeynmanChallenge';
import { checkSubjectProgressAlert, getYearSubjectsWithAlert, getSubjectSpacedRepetitionAlert } from './utils/courseAlerts';
import { User } from 'firebase/auth';
import {
  auth,
  testConnection,
  onAuthStateChanged,
  signOut,
  fetchUserStudyData,
  saveUserStudyData,
} from './services/firebase';

export default function App() {
  // Main state from storage
  const [programs, setPrograms] = useState<StudyProgram[]>(() => storageService.getPrograms());
  const [preferences, setPreferences] = useState<StudyPreferences>(() => storageService.getPreferences());
  const [pomodoroLogs, setPomodoroLogs] = useState<PomodoroLog[]>(() => storageService.getPomodoroLogs());
  const [blockedEvents, setBlockedEvents] = useState<BlockedTimeEvent[]>(() => storageService.getBlockedEvents());

  // Firebase Auth & Cloud Sync state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Active selections
  const [activeProgramId, setActiveProgramId] = useState<string>(() => {
    const sel = storageService.getActiveSelection();
    return sel.programId || (programs[0] ? programs[0].id : '');
  });

  const [activeYearId, setActiveYearId] = useState<string>(() => {
    const sel = storageService.getActiveSelection();
    const currProg = programs.find((p) => p.id === (sel.programId || (programs[0]?.id)));
    return sel.yearId || (currProg?.years[0] ? currProg.years[0].id : '');
  });

  // Estudios y cursos seleccionados para visualización simultánea (mix de carreras/cursos)
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('studyflow_selected_programs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    const allProgIds = programs.map((p) => p.id);
    return allProgIds.length > 0 ? allProgIds : [];
  });

  const [selectedYearIds, setSelectedYearIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('studyflow_selected_years');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    const allYearIds = programs.flatMap((p) => p.years.map((y) => y.id));
    return allYearIds.length > 0 ? allYearIds : [];
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // View mode in subjects section (Grid de materias vs Tablero Kanban vs Herramienta Técnica Feynman)
  const [subjectSectionViewMode, setSubjectSectionViewMode] = useState<'grid' | 'kanban' | 'feynman'>('grid');
  const [feynmanSubjectId, setFeynmanSubjectId] = useState<string>('');
  // Modo de visualización de materias: tarjetas detalladas vs lista compacta de una sola línea
  const [subjectLayoutMode, setSubjectLayoutMode] = useState<'detailed' | 'compact'>('detailed');
  const [kanbanFilterSubjectId, setKanbanFilterSubjectId] = useState<string>('all');
  const [isDocsSidePanelOpen, setIsDocsSidePanelOpen] = useState<boolean>(true);
  const [quickReviewSubjectId, setQuickReviewSubjectId] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<NavTabId>('curso');

  // Modals
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [isExamsManagerOpen, setIsExamsManagerOpen] = useState(false);
  const [examsManagerSubjectId, setExamsManagerSubjectId] = useState<string | undefined>(undefined);
  const [isOnboardingTourOpen, setIsOnboardingTourOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('studyflow_onboarding_completed_v1');
    } catch {
      return false;
    }
  });

  const handleCloseOnboardingTour = () => {
    setIsOnboardingTourOpen(false);
    try {
      localStorage.setItem('studyflow_onboarding_completed_v1', 'true');
    } catch {
      // ignore storage quota errors
    }
  };

  // Pomodoro direct focus target & Modo Enfoque (distraction-free mode)
  const [pomodoroSubjectTarget, setPomodoroSubjectTarget] = useState<string | undefined>();
  const [pomodoroTopicTarget, setPomodoroTopicTarget] = useState<string | undefined>();
  const [isPomodoroFocusMode, setIsPomodoroFocusMode] = useState<boolean>(false);

  // Target state for jumping directly from a Subject Card Spaced Repetition notification to Cuestionarios
  const [quizSubjectTargetId, setQuizSubjectTargetId] = useState<string | undefined>();
  const [quizTopicTargetIds, setQuizTopicTargetIds] = useState<string[]>([]);

  const handleJumpToSubjectQuizzes = (
    subjectId: string,
    topicIds?: string[],
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedSubjectId(subjectId);
    setQuizSubjectTargetId(subjectId);
    setQuizTopicTargetIds(topicIds || []);
    setActiveTab('cuestionarios');
  };

  // Modo Oscuro / Modo Claro con persistencia en localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('studyflow_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // fallback
    }
    return 'light';
  });

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('studyflow_theme', theme);
    } catch {
      // Ignore quota errors on theme persistence
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Ensure valid active program and year (with safe fallback so tabs always render)
  const activeProgram =
    programs.find((p) => p.id === activeProgramId) ||
    programs.find((p) => (p.years || []).length > 0) ||
    programs[0];
  const activeYear: AcademicYear =
    activeProgram?.years.find((y) => y.id === activeYearId) ||
    activeProgram?.years[0] ||
    programs.flatMap((p) => p.years || [])[0] || {
      id: 'default-year',
      name: '1º Curso',
      targetWeeklyHours: 20,
      subjects: [],
    };

  // Helper to count total attached files and topics across programs
  const countProgramAssets = (progs: StudyProgram[]) => {
    let filesCount = 0;
    let topicsCount = 0;
    for (const p of progs || []) {
      for (const y of p.years || []) {
        for (const s of y.subjects || []) {
          topicsCount += (s.topics || []).length;
          for (const t of s.topics || []) {
            filesCount += (t.attachedFiles || []).length;
          }
        }
      }
    }
    return { filesCount, topicsCount };
  };

  // Merge two program lists preserving any newly uploaded attachedFiles or topics from local state
  const mergeProgramsPreservingFiles = (
    incomingPrograms: StudyProgram[],
    localPrograms: StudyProgram[]
  ): StudyProgram[] => {
    if (!incomingPrograms || incomingPrograms.length === 0) return localPrograms;
    if (!localPrograms || localPrograms.length === 0) return incomingPrograms;

    return incomingPrograms.map((incProg) => {
      const locProg = localPrograms.find((p) => p.id === incProg.id);
      if (!locProg) return incProg;
      return {
        ...incProg,
        years: (incProg.years || []).map((incYear) => {
          const locYear = (locProg.years || []).find((y) => y.id === incYear.id);
          if (!locYear) return incYear;
          return {
            ...incYear,
            subjects: (incYear.subjects || []).map((incSub) => {
              const locSub = (locYear.subjects || []).find((s) => s.id === incSub.id);
              if (!locSub) return incSub;

              // Merge topics: keep all incoming topics, enriched with any richer attachedFiles from local, plus any local-only topics
              const incTopicIds = new Set((incSub.topics || []).map((t) => t.id));
              const localOnlyTopics = (locSub.topics || []).filter(
                (t) => !incTopicIds.has(t.id)
              );

              const mergedTopics = [
                ...(incSub.topics || []).map((incTop) => {
                  const locTop = (locSub.topics || []).find((t) => t.id === incTop.id);
                  if (!locTop) return incTop;
                  const incFiles = incTop.attachedFiles || [];
                  const locFiles = locTop.attachedFiles || [];
                  const fileMap = new Map<string, any>();
                  for (const f of incFiles) fileMap.set(f.id, f);
                  for (const f of locFiles) {
                    const existing = fileMap.get(f.id);
                    if (
                      !existing ||
                      (f.content?.length || 0) >= (existing.content?.length || 0)
                    ) {
                      fileMap.set(f.id, { ...existing, ...f });
                    }
                  }
                  const combinedFiles = Array.from(fileMap.values());
                  const useLocalNotes =
                    (locTop.notes?.length || 0) > (incTop.notes?.length || 0);
                  return {
                    ...incTop,
                    ...locTop,
                    notes: useLocalNotes ? locTop.notes : incTop.notes,
                    generalNotes: useLocalNotes
                      ? locTop.generalNotes || locTop.notes
                      : incTop.generalNotes || incTop.notes,
                    richGeneralNotes:
                      (locTop.richGeneralNotes?.length || 0) >=
                      (incTop.richGeneralNotes?.length || 0)
                        ? locTop.richGeneralNotes
                        : incTop.richGeneralNotes,
                    attachedFiles: combinedFiles,
                    pageCount: Math.max(incTop.pageCount || 0, locTop.pageCount || 0),
                  };
                }),
                ...localOnlyTopics,
              ];

              // Also merge cornellNotes by ID
              const noteMap = new Map<string, any>();
              for (const n of incSub.cornellNotes || []) noteMap.set(n.id, n);
              for (const n of locSub.cornellNotes || []) {
                const existing = noteMap.get(n.id);
                if (!existing || (n.notes?.length || 0) >= (existing.notes?.length || 0)) {
                  noteMap.set(n.id, { ...existing, ...n });
                }
              }

              return {
                ...incSub,
                ...locSub,
                topics: mergedTopics,
                cornellNotes: Array.from(noteMap.values()),
              };
            }),
          };
        }),
      };
    });
  };

  const hasHydratedIdbRef = React.useRef(false);
  const deletedBlockedIdsRef = React.useRef<Set<string>>(new Set());

  const mergeBlockedEventsPreservingPlans = (
    incoming: BlockedTimeEvent[] | null | undefined,
    local: BlockedTimeEvent[] | null | undefined
  ): BlockedTimeEvent[] => {
    const incList = Array.isArray(incoming) ? incoming : [];
    const locList = Array.isArray(local) ? local : [];
    const byId = new Map<string, BlockedTimeEvent>();

    for (const ev of incList) {
      if (ev && ev.id && !deletedBlockedIdsRef.current.has(ev.id)) {
        byId.set(ev.id, ev);
      }
    }
    for (const ev of locList) {
      if (ev && ev.id && !deletedBlockedIdsRef.current.has(ev.id)) {
        const existing = byId.get(ev.id);
        byId.set(ev.id, existing ? { ...existing, ...ev } : ev);
      }
    }
    return Array.from(byId.values());
  };

  const mergePreferencesPreservingObligations = (
    incoming: StudyPreferences | null | undefined,
    local: StudyPreferences
  ): StudyPreferences => {
    if (!incoming) return local;
    const incObs = Array.isArray(incoming.weeklyFixedObligations)
      ? incoming.weeklyFixedObligations
      : [];
    const locObs = Array.isArray(local.weeklyFixedObligations)
      ? local.weeklyFixedObligations
      : [];

    const obMap = new Map<string, any>();
    for (const ob of incObs) {
      if (ob && ob.id) obMap.set(ob.id, ob);
    }
    for (const ob of locObs) {
      if (ob && ob.id) {
        const existing = obMap.get(ob.id);
        obMap.set(ob.id, existing ? { ...existing, ...ob } : ob);
      }
    }

    return {
      ...incoming,
      ...local,
      weeklyFixedObligations: Array.from(obMap.values()),
    };
  };

  // Hydrate full uncompacted programs, blockedEvents and preferences from IndexedDB on initial mount
  useEffect(() => {
    let isCancelled = false;

    Promise.all([
      storageService.hydrateProgramsFromIndexedDB(),
      storageService.hydrateBlockedEventsFromIndexedDB(),
      storageService.hydratePreferencesFromIndexedDB(),
    ])
      .then(([idbPrograms, idbBlockedEvents, idbPreferences]) => {
        hasHydratedIdbRef.current = true;
        if (isCancelled) return;

        if (idbPrograms && idbPrograms.length > 0) {
          setPrograms((current) => {
            try {
              const currentStats = countProgramAssets(current);
              const idbStats = countProgramAssets(idbPrograms);
              const currentLen = JSON.stringify(current).length;
              const idbLen = JSON.stringify(idbPrograms).length;
              if (
                idbStats.filesCount > currentStats.filesCount ||
                idbStats.topicsCount > currentStats.topicsCount ||
                idbLen > currentLen
              ) {
                return mergeProgramsPreservingFiles(idbPrograms, current);
              }
              return mergeProgramsPreservingFiles(current, idbPrograms);
            } catch {
              return current;
            }
          });
        }

        if (idbBlockedEvents && idbBlockedEvents.length > 0) {
          setBlockedEvents((current) => {
            const merged = mergeBlockedEventsPreservingPlans(idbBlockedEvents, current);
            storageService.saveBlockedEvents(merged, { skipIndexedDB: true });
            return merged;
          });
        }

        if (idbPreferences) {
          setPreferences((current) => {
            const merged = mergePreferencesPreservingObligations(idbPreferences, current);
            storageService.savePreferences(merged, { skipIndexedDB: true });
            return merged;
          });
        }
      })
      .catch(() => {
        hasHydratedIdbRef.current = true;
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Initialize Firebase Auth listener and Cloud sync
  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsSyncingCloud(true);
        try {
          const cloudData = await fetchUserStudyData(user.uid);
          if (cloudData && cloudData.programs && cloudData.programs.length > 0) {
            setPrograms((currentLocal) =>
              mergeProgramsPreservingFiles(cloudData.programs, currentLocal)
            );
            const cloudProgIds = cloudData.programs.map((p: StudyProgram) => p.id);
            const cloudYearIds = cloudData.programs.flatMap((p: StudyProgram) =>
              p.years.map((y) => y.id)
            );
            setSelectedProgramIds((prev) => {
              const valid = prev.filter((id) => cloudProgIds.includes(id));
              return valid.length > 0 ? valid : cloudProgIds;
            });
            setSelectedYearIds((prev) => {
              const valid = prev.filter((id) => cloudYearIds.includes(id));
              return valid.length > 0 ? valid : cloudYearIds;
            });
            if (cloudData.preferences) {
              setPreferences((currentLocalPrefs) =>
                mergePreferencesPreservingObligations(cloudData.preferences, currentLocalPrefs)
              );
            }
            if (cloudData.pomodoroLogs && Array.isArray(cloudData.pomodoroLogs) && cloudData.pomodoroLogs.length > 0) {
              setPomodoroLogs((currentLogs) => {
                const byId = new Map<string, PomodoroLog>();
                for (const l of cloudData.pomodoroLogs) if (l?.id) byId.set(l.id, l);
                for (const l of currentLogs) if (l?.id) byId.set(l.id, l);
                return Array.from(byId.values());
              });
            }
            if (cloudData.blockedEvents) {
              setBlockedEvents((currentLocalBlocked) =>
                mergeBlockedEventsPreservingPlans(cloudData.blockedEvents, currentLocalBlocked)
              );
            }
          } else {
            // First time sync for new cloud account: upload current local records
            await saveUserStudyData(user.uid, {
              programs,
              preferences,
              pomodoroLogs,
              blockedEvents,
            });
          }
        } catch (e) {
          console.warn('Error synchronizing cloud data on sign-in:', e);
        } finally {
          setIsSyncingCloud(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const isInitialMountRef = React.useRef(true);
  const isInitialPrefsMountRef = React.useRef(true);
  const isInitialBlockedMountRef = React.useRef(true);

  // Save changes to local storage & IndexedDB (skipping IndexedDB write only on the very first mount render before hydration completes)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      storageService.savePrograms(programs, { skipIndexedDB: true });
      return;
    }
    storageService.savePrograms(programs, { skipIndexedDB: false });
  }, [programs]);

  useEffect(() => {
    if (isInitialPrefsMountRef.current) {
      isInitialPrefsMountRef.current = false;
      storageService.savePreferences(preferences, { skipIndexedDB: true });
      return;
    }
    storageService.savePreferences(preferences, { skipIndexedDB: false });
  }, [preferences]);

  useEffect(() => {
    if (isInitialBlockedMountRef.current) {
      isInitialBlockedMountRef.current = false;
      storageService.saveBlockedEvents(blockedEvents, { skipIndexedDB: true });
      return;
    }
    storageService.saveBlockedEvents(blockedEvents, { skipIndexedDB: false });
  }, [blockedEvents]);

  useEffect(() => {
    if (activeProgram && activeYear) {
      storageService.setActiveSelection(activeProgram.id, activeYear.id);
    }
  }, [activeProgram, activeYear]);

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_selected_programs', JSON.stringify(selectedProgramIds));
    } catch {
      // ignore
    }
  }, [selectedProgramIds]);

  useEffect(() => {
    try {
      localStorage.setItem('studyflow_selected_years', JSON.stringify(selectedYearIds));
    } catch {
      // ignore
    }
  }, [selectedYearIds]);

  const hasInitializedCloudSyncRef = React.useRef(false);

  // Synchronize changes to Firebase Firestore when user is logged in
  useEffect(() => {
    if (!currentUser) return;
    if (!hasInitializedCloudSyncRef.current) {
      hasInitializedCloudSyncRef.current = true;
      return;
    }

    const timer = setTimeout(async () => {
      setIsSyncingCloud(true);
      try {
        await saveUserStudyData(currentUser.uid, {
          programs,
          preferences,
          pomodoroLogs,
          blockedEvents,
        });
      } catch (err) {
        console.warn('Cloud Firestore sync skipped:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    }, 4500);

    return () => clearTimeout(timer);
  }, [programs, preferences, pomodoroLogs, blockedEvents, currentUser]);

  // Initialize Service Worker for browser push notifications
  useEffect(() => {
    notificationService.getServiceWorkerRegistration();
  }, []);

  // Background notification evaluator for upcoming exams, pending tasks and overdue spaced reviews
  useEffect(() => {
    if (!preferences.enableWebNotifications && !preferences.enableBrowserPushService) return;
    if (isPomodoroFocusMode) return;

    const allSubjects = programs.flatMap((p) => p.years.flatMap((y) => y.subjects));

    // Run checks immediately
    notificationService.checkAndSendScheduledAlerts(allSubjects, preferences, pomodoroLogs);
    notificationService.checkAndNotifyOverdueReviews(allSubjects, { preferences });

    // Check periodically every 60 seconds
    const interval = setInterval(() => {
      if (!notificationService.isFocusModeSilenced()) {
        notificationService.checkAndSendScheduledAlerts(allSubjects, preferences, pomodoroLogs);
        notificationService.checkAndNotifyOverdueReviews(allSubjects, { preferences });
      }
    }, 60000);

    // Also check when tab visibility changes or user minimizes/restores
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !notificationService.isFocusModeSilenced()) {
        notificationService.checkAndNotifyOverdueReviews(allSubjects, { preferences });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [programs, preferences, pomodoroLogs, isPomodoroFocusMode]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error signing out:', e);
    }
  };

  // Update a subject across any program or year
  const handleUpdateSubject = (updatedSub: Subject) => {
    const totalAttachedFiles = (updatedSub.topics || []).reduce(
      (acc, t) => acc + (t.attachedFiles?.length || 0),
      0
    );
    console.log('[App] handleUpdateSubject received updatedSub:', {
      subjectId: updatedSub.id,
      subjectName: updatedSub.name,
      topicsCount: updatedSub.topics?.length || 0,
      totalAttachedFiles,
      topicsWithFiles: (updatedSub.topics || []).map((t) => ({
        topicId: t.id,
        title: t.title,
        attachedFilesCount: t.attachedFiles?.length || 0,
        attachedFiles: t.attachedFiles,
      })),
    });

    setPrograms((prev) =>
      prev.map((p) => ({
        ...p,
        years: p.years.map((y) => ({
          ...y,
          subjects: y.subjects.map((s) => (s.id === updatedSub.id ? updatedSub : s)),
        })),
      }))
    );
  };

  // Batch update multiple subjects at once (e.g. when recalculating all topics and reviews)
  const handleBatchUpdateSubjects = (updatedSubjectsList: Subject[]) => {
    const mapById = new Map(updatedSubjectsList.map((s) => [s.id, s]));
    setPrograms((prev) =>
      prev.map((p) => ({
        ...p,
        years: p.years.map((y) => ({
          ...y,
          subjects: y.subjects.map((s) => mapById.get(s.id) || s),
        })),
      }))
    );
  };

  // Update status of any topic in active subjects from global Kanban board
  const handleUpdateTopicStatusGlobal = (topicId: string, newStatus: any) => {
    const targetSub = activeSubjects.find((s) => s.topics.some((t) => t.id === topicId));
    if (!targetSub) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const updatedTopics = targetSub.topics.map((t) => {
      if (t.id === topicId) {
        if (newStatus === 'estudiado') {
          return {
            ...t,
            status: newStatus,
            studiedAt: todayStr,
            nextReviewDate: todayStr,
            reviewLevel: 1,
            reviewsHistory: [...t.reviewsHistory, { date: todayStr, quality: 'bien' as const }],
          };
        } else if (newStatus === 'repasado') {
          return {
            ...t,
            status: newStatus,
            reviewLevel: (t.reviewLevel || 1) + 1,
            reviewsHistory: [...t.reviewsHistory, { date: todayStr, quality: 'facil' as const }],
          };
        }
        return { ...t, status: newStatus };
      }
      return t;
    });

    handleUpdateSubject({
      ...targetSub,
      topics: updatedTopics,
    });
  };

  // Update schedule for topics in a subject across any study program
  const handleUpdateTopicsSchedule = (subjectId: string, updatedTopics: any[]) => {
    setPrograms((prev) =>
      prev.map((p) => ({
        ...p,
        years: p.years.map((y) => ({
          ...y,
          subjects: y.subjects.map((s) =>
            s.id === subjectId ? { ...s, topics: updatedTopics } : s
          ),
        })),
      }))
    );
  };

  // Toggle a task completion across subjects in any study program
  const handleToggleTask = (subjectId: string, taskId: string, completed: boolean) => {
    setPrograms((prev) =>
      prev.map((p) => ({
        ...p,
        years: p.years.map((y) => ({
          ...y,
          subjects: y.subjects.map((s) => {
            if (s.id === subjectId) {
              return {
                ...s,
                tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
              };
            }
            return s;
          }),
        })),
      }))
    );
  };

  // Add task to a specific subject from General View or Calendar
  const handleAddTaskToSubject = (subjectId: string, task: Task) => {
    setPrograms((prev) =>
      prev.map((p) => ({
        ...p,
        years: p.years.map((y) => ({
          ...y,
          subjects: y.subjects.map((s) =>
            s.id === subjectId ? { ...s, tasks: [...s.tasks, task] } : s
          ),
        })),
      }))
    );
  };

  // Add exam to a specific subject from General View or Calendar
  const handleAddExamToSubject = (subjectId: string, exam: Exam) => {
    setPrograms((prev) =>
      prev.map((p) => ({
        ...p,
        years: p.years.map((y) => ({
          ...y,
          subjects: y.subjects.map((s) =>
            s.id === subjectId ? { ...s, exams: [...s.exams, exam] } : s
          ),
        })),
      }))
    );
  };

  // Add or upsert a calendar blocked event
  const handleAddBlockedEvent = (event: BlockedTimeEvent) => {
    deletedBlockedIdsRef.current.delete(event.id);
    setBlockedEvents((prev) => {
      const isCustomStudyBlock = event.id.startsWith('custom-study-');
      const existingIdx = prev.findIndex(
        (e) =>
          e.id === event.id ||
          (!isCustomStudyBlock &&
            !e.id.startsWith('custom-study-') &&
            event.linkedTopicId &&
            e.linkedTopicId === event.linkedTopicId &&
            e.linkedItemType === event.linkedItemType &&
            (!event.date || !e.date || e.date === event.date)) ||
          (!isCustomStudyBlock && event.linkedTaskId && e.linkedTaskId === event.linkedTaskId)
      );
      let next: BlockedTimeEvent[];
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...event };
      } else {
        next = [...prev, event];
      }
      storageService.saveBlockedEvents(next, { skipIndexedDB: false });
      return next;
    });
  };

  // Delete a calendar blocked event
  const handleDeleteBlockedEvent = (eventId: string) => {
    deletedBlockedIdsRef.current.add(eventId);
    setBlockedEvents((prev) => {
      const next = prev.filter((e) => e.id !== eventId);
      storageService.saveBlockedEvents(next, { skipIndexedDB: false });
      return next;
    });
  };

  // Update an existing calendar blocked event (or upsert if newly created by drag-and-drop)
  const handleUpdateBlockedEvent = (updatedEvent: BlockedTimeEvent) => {
    deletedBlockedIdsRef.current.delete(updatedEvent.id);
    setBlockedEvents((prev) => {
      const isCustomStudyBlock = updatedEvent.id.startsWith('custom-study-');
      const existingIdx = prev.findIndex(
        (e) =>
          e.id === updatedEvent.id ||
          (!isCustomStudyBlock &&
            !e.id.startsWith('custom-study-') &&
            updatedEvent.linkedTopicId &&
            e.linkedTopicId === updatedEvent.linkedTopicId &&
            e.linkedItemType === updatedEvent.linkedItemType &&
            (!updatedEvent.date || !e.date || e.date === updatedEvent.date)) ||
          (!isCustomStudyBlock &&
            updatedEvent.linkedTaskId &&
            e.linkedTaskId === updatedEvent.linkedTaskId)
      );
      let next: BlockedTimeEvent[];
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...updatedEvent };
      } else {
        next = [...prev, updatedEvent];
      }
      storageService.saveBlockedEvents(next, { skipIndexedDB: false });
      return next;
    });
  };

  // Direct Pomodoro start with prefilled subject and topic
  const handleStartPomodoroWithSubject = (subjectId: string, topicId?: string) => {
    setPomodoroSubjectTarget(subjectId);
    setPomodoroTopicTarget(topicId);
    setActiveTab('pomodoro');
  };

  // Record a completed Pomodoro session and update streak
  const handlePomodoroComplete = (log: PomodoroLog) => {
    const updatedLogs = [log, ...pomodoroLogs];
    setPomodoroLogs(updatedLogs);
    storageService.savePomodoroLogs(updatedLogs);

    // Dynamic streak calculation: increments by 1 for consecutive days studied
    const todayStr = new Date().toISOString().split('T')[0];
    const prevDateStr = preferences.lastStudyDate;
    if (prevDateStr !== todayStr) {
      let nextStreak = preferences.streakDays || 0;
      if (prevDateStr) {
        const lastDate = new Date(prevDateStr);
        const currDate = new Date(todayStr);
        const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          nextStreak += 1;
        } else {
          nextStreak = 1;
        }
      } else {
        nextStreak = 1;
      }
      const updatedPrefs: StudyPreferences = {
        ...preferences,
        streakDays: nextStreak,
        lastStudyDate: todayStr,
      };
      setPreferences(updatedPrefs);
      storageService.savePreferences(updatedPrefs);
    }

    // If linked to a topic, accumulate actual hours spent and optionally auto-mark topic as studied
    if (log.subjectId && (log.topicId || log.topicTitle)) {
      const hours = log.durationMinutes / 60;
      const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const updatedPrograms = programs.map((p) => ({
        ...p,
        years: p.years.map((y) => ({
          ...y,
          subjects: y.subjects.map((s) => {
            if (s.id === log.subjectId) {
              return {
                ...s,
                topics: s.topics.map((t) => {
                  const isTargetTopic =
                    (log.topicId && t.id === log.topicId) || t.title === log.topicTitle;
                  if (isTargetTopic) {
                    const nextHours = Math.round((t.actualHoursSpent + hours) * 10) / 10;
                    if (log.autoMarkTopicStudied) {
                      const wasPendingOrInProgress =
                        t.status === 'pendiente' || t.status === 'en_progreso';
                      return {
                        ...t,
                        actualHoursSpent: nextHours,
                        status:
                          t.status === 'repasado'
                            ? ('repasado' as const)
                            : ('estudiado' as const),
                        studiedAt: todayStr,
                        reviewLevel: Math.max(1, t.reviewLevel || 1),
                        nextReviewDate: t.nextReviewDate || tomorrowStr,
                        vueltasCount: wasPendingOrInProgress
                          ? (t.vueltasCount || 0) + 1
                          : Math.max(1, t.vueltasCount || 1),
                      };
                    }
                    return {
                      ...t,
                      actualHoursSpent: nextHours,
                    };
                  }
                  return t;
                }),
              };
            }
            return s;
          }),
        })),
      }));

      setPrograms(updatedPrograms);
      storageService.savePrograms(updatedPrograms);
    }
  };

  // Save quiz result across any study program
  const handleSaveQuizResult = (subjectId: string, quiz: Quiz) => {
    const updatedPrograms = programs.map((p) => ({
      ...p,
      years: p.years.map((y) => ({
        ...y,
        subjects: y.subjects.map((s) => {
          if (s.id === subjectId) {
            return {
              ...s,
              quizzes: [quiz, ...s.quizzes],
            };
          }
          return s;
        }),
      })),
    }));

    setPrograms(updatedPrograms);
  };

  // Guardar flashcards generadas a partir de apuntes Cornell en la asignatura
  const handleSaveFlashcardsToSubject = (subjectId: string, newCards: Flashcard[]) => {
    const updatedPrograms = programs.map((p) => ({
      ...p,
      years: p.years.map((y) => ({
        ...y,
        subjects: y.subjects.map((s) => {
          if (s.id === subjectId) {
            return {
              ...s,
              flashcards: [...(s.flashcards || []), ...newCards],
            };
          }
          return s;
        }),
      })),
    }));

    setPrograms(updatedPrograms);
  };

  // Log a mistake from quiz across any study program
  const handleLogMistake = (mistake: ErrorLogEntry) => {
    const updatedPrograms = programs.map((p) => ({
      ...p,
      years: p.years.map((y) => ({
        ...y,
        subjects: y.subjects.map((s) => {
          if (s.id === mistake.subjectId) {
            return {
              ...s,
              errorLogs: [mistake, ...s.errorLogs],
            };
          }
          return s;
        }),
      })),
    }));

    setPrograms(updatedPrograms);
  };

  // Gestión de selección de cursos (1 curso exclusivo o varios cursos de uno o varios estudios)
  const handleToggleYearSelection = (yearId: string) => {
    setSelectedYearIds((prev) => {
      let nextYears: string[];
      if (prev.includes(yearId)) {
        if (prev.length === 1) return prev; // Mantener al menos uno activo
        nextYears = prev.filter((id) => id !== yearId);
      } else {
        nextYears = [...prev, yearId];
      }

      // Sincronizar estudios activos en base a los cursos marcados
      const activeProgIds = programs
        .filter((p) => p.years.some((y) => nextYears.includes(y.id)))
        .map((p) => p.id);
      if (activeProgIds.length > 0) {
        setSelectedProgramIds(activeProgIds);
      }
      return nextYears;
    });
  };

  // Activar o desactivar un estudio completo (añade o quita sus cursos del mix)
  const handleToggleProgramSelection = (programId: string) => {
    const targetProg = programs.find((p) => p.id === programId);
    if (!targetProg) return;
    const progYearIds = targetProg.years.map((y) => y.id);
    const isCurrentlyActive =
      selectedProgramIds.includes(programId) ||
      progYearIds.some((yId) => selectedYearIds.includes(yId));

    if (isCurrentlyActive) {
      // Desactivar estudio solo si queda al menos otro curso activo
      const remainingYears = selectedYearIds.filter((yId) => !progYearIds.includes(yId));
      if (remainingYears.length === 0) return;
      setSelectedYearIds(remainingYears);
      setSelectedProgramIds((prev) => prev.filter((id) => id !== programId));
      if (activeProgramId === programId) {
        const nextProg = programs.find((p) => p.years.some((y) => remainingYears.includes(y.id)));
        if (nextProg) {
          setActiveProgramId(nextProg.id);
          setActiveYearId(nextProg.years.find((y) => remainingYears.includes(y.id))?.id || nextProg.years[0]?.id || '');
        }
      }
    } else {
      // Activar el estudio y añadir todos sus cursos al mix activo
      setSelectedYearIds((prev) => Array.from(new Set([...prev, ...progYearIds])));
      setSelectedProgramIds((prev) => (prev.includes(programId) ? prev : [...prev, programId]));
    }
  };

  // Activar todos los estudios y todos sus cursos a la vez
  const handleSelectAllProgramsAndYears = () => {
    const allProgIds = programs.map((p) => p.id);
    const allYearIds = programs.flatMap((p) => p.years.map((y) => y.id));
    setSelectedProgramIds(allProgIds);
    setSelectedYearIds(allYearIds);
  };

  const handleResetToBlank = () => {
    const blank = storageService.resetToBlank();
    setPrograms(blank);
    setActiveProgramId(blank[0].id);
    setActiveYearId(blank[0].years[0].id);
    setSelectedProgramIds([blank[0].id]);
    setSelectedYearIds([blank[0].years[0].id]);
    setSelectedSubjectId(null);
  };

  const handleLoadDemoData = () => {
    const demo = storageService.loadDemoData();
    setPrograms(demo);
    setActiveProgramId(demo[0].id);
    setActiveYearId(demo[0].years[0].id);
    setSelectedProgramIds(demo.map((p) => p.id));
    setSelectedYearIds(demo.flatMap((p) => p.years.map((y) => y.id)));
    setSelectedSubjectId(null);
  };

  // Cursos, estudios y materias activos (suma todas las asignaturas de los cursos y carreras activos)
  const activePrograms = programs.filter(
    (p) =>
      selectedProgramIds.includes(p.id) ||
      p.years.some((y) => selectedYearIds.includes(y.id))
  );

  const effectiveActivePrograms =
    activePrograms.length > 0 ? activePrograms : activeProgram ? [activeProgram] : programs;

  const activeYears = effectiveActivePrograms.flatMap((p) => {
    const explicitlySelected = p.years.filter((y) => selectedYearIds.includes(y.id));
    // Si la carrera está activa pero ninguno de sus cursos estaba marcado individualmente, incluir todos sus cursos
    return explicitlySelected.length > 0 ? explicitlySelected : p.years;
  });

  const activeSubjects: Subject[] =
     effectiveActivePrograms.flatMap((p) => {
      const yearsForProg = p.years.filter((y) =>
        activeYears.some((ay) => ay.id === y.id)
      );
      return yearsForProg.flatMap((y) =>
        y.subjects.map((s) => ({
          ...s,
          programId: p.id,
          programName: p.name,
          yearId: y.id,
          yearName: y.name,
        }))
      );
    });

  const currentSubject = activeSubjects.find((s) => s.id === selectedSubjectId);

  const combinedProgramTitle =
    activePrograms.length > 1
      ? activePrograms.map((p) => p.name).join(' + ')
      : activeProgram?.name || 'Mi Estudio';

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-hidden bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex ${
        preferences.navigationPosition === 'sidebar' ? 'flex-col md:flex-row' : 'flex-col'
      } font-sans selection:bg-blue-100 selection:text-blue-900 transition-colors`}
    >
      {/* Universal Top Bar or Left Sidebar based on user choice (hidden when Pomodoro Focus Mode is active) */}
      {!(activeTab === 'pomodoro' && isPomodoroFocusMode) && (
        <Navigation
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setSelectedSubjectId(null);
            if (tab === 'asignaturas') {
              setSubjectSectionViewMode('grid');
            }
            if (tab === 'cuestionarios') {
              setQuizTopicTargetIds([]);
            }
            setIsPreferencesModalOpen(false);
            setIsProgramModalOpen(false);
            setIsExamsManagerOpen(false);
            setIsErrorModalOpen(false);
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          programName={combinedProgramTitle}
          yearName={
            activePrograms.length > 1
              ? `Mix: ${activePrograms.length} Estudios · ${activeYears.length} Cursos`
              : activeYears.length > 1
              ? `${activeYears.length} Cursos Activos`
              : activeYear?.name || '1º Curso'
          }
          onOpenProgramManager={() => setIsProgramModalOpen(true)}
          onOpenPreferences={() => setIsPreferencesModalOpen(true)}
          streakDays={preferences.streakDays}
          user={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onSignOut={handleSignOut}
          isSyncingCloud={isSyncingCloud}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          enabledTabs={preferences.enabledTabs}
          navigationPosition={preferences.navigationPosition || 'top'}
          onToggleNavigationPosition={() =>
            setPreferences((prev) => ({
              ...prev,
              navigationPosition: prev.navigationPosition === 'sidebar' ? 'top' : 'sidebar',
            }))
          }
          onStartOnboardingTour={() => setIsOnboardingTourOpen(true)}
          preferences={preferences}
          onUpdatePreferences={(updated) => setPreferences(updated)}
        />
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 w-full max-w-6xl overflow-x-hidden mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Sección desplegable compacta de HabitsTracker en el componente principal */}
        {!isPomodoroFocusMode && activeTab !== 'calendario' && activeTab !== 'repaso' && (
          <div className="mb-5">
            <HabitsTracker
              preferences={preferences}
              onUpdatePreferences={(updated) => setPreferences(updated)}
              onScheduleHabitOneDay={(title, dateStr, startTime, endTime, category, notes) => {
                handleAddBlockedEvent({
                  id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  title,
                  date: dateStr,
                  startTime,
                  endTime,
                  category,
                  notes,
                });
              }}
              onScheduleHabitWeekly={(title, category, days, startTime, endTime, notes) => {
                handleAddBlockedEvent({
                  id: `block-weekly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  title,
                  recurringDays: days,
                  startTime,
                  endTime,
                  category: category === 'gimnasio' ? 'deporte' : category === 'domestico' ? 'personal' : (category as any),
                  notes,
                });
              }}
            />
          </div>
        )}

        {/* Tab 1: Pestaña General por Curso */}
        {activeTab === 'curso' && activeYear && (
          <div className="space-y-5">
            <CourseGeneralView
              programName={combinedProgramTitle}
              year={{
                ...activeYear,
                name:
                  activeYears.length > 1
                    ? activeYears.map((y) => y.name).join(' + ')
                    : activeYear.name,
                targetWeeklyHours:
                  activeYears.length > 0
                    ? activeYears.reduce((sum, y) => sum + (y.targetWeeklyHours || 20), 0)
                    : activeYear.targetWeeklyHours || 20,
                subjects: activeSubjects,
              }}
              activeProgramsCount={effectiveActivePrograms.length}
              activeYearsCount={activeYears.length}
              totalProgramsCount={programs.length}
              totalYearsCount={programs.reduce((acc, p) => acc + p.years.length, 0)}
              onSelectAllProgramsAndYears={handleSelectAllProgramsAndYears}
              streakDays={preferences.streakDays}
              preferences={preferences}
              onUpdatePreferences={(updated) => setPreferences(updated)}
              onOpenPreferences={() => setIsPreferencesModalOpen(true)}
              pomodoroLogs={pomodoroLogs}
              onPomodoroSessionComplete={handlePomodoroComplete}
              blockedEvents={blockedEvents}
              onAddBlockedEvent={handleAddBlockedEvent}
              onDeleteBlockedEvent={handleDeleteBlockedEvent}
              onSelectSubject={(subId) => {
                setSelectedSubjectId(subId);
                setActiveTab('asignaturas');
              }}
              onOpenNewSubject={() => setIsProgramModalOpen(true)}
              onToggleTask={handleToggleTask}
              onSelectForPomodoro={handleStartPomodoroWithSubject}
              onOpenScheduler={() => setActiveTab('calendario')}
              onAddTaskToSubject={handleAddTaskToSubject}
              onAddExamToSubject={handleAddExamToSubject}
              onUpdateTopicsSchedule={handleUpdateTopicsSchedule}
              onUpdateSubject={handleUpdateSubject}
              onOpenExamsManager={(subId?: string) => {
                setExamsManagerSubjectId(subId);
                setIsExamsManagerOpen(true);
              }}
              onOpenQuizzesForSubject={(subId: string, topicIds?: string[]) => {
                handleJumpToSubjectQuizzes(subId, topicIds);
              }}
            />
          </div>
        )}

        {/* Tab 2: Materias y Temarios + Panel lateral de PDFs/Documentos */}
        {activeTab === 'asignaturas' && activeYear && (
          <div
            className={
              isDocsSidePanelOpen
                ? preferences.navigationPosition === 'sidebar'
                  ? 'grid grid-cols-1 xl:grid-cols-12 gap-6 items-start'
                  : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
                : 'space-y-6'
            }
          >
            <div
              className={
                isDocsSidePanelOpen
                  ? preferences.navigationPosition === 'sidebar'
                    ? 'xl:col-span-8 2xl:col-span-9 min-w-0'
                    : 'lg:col-span-8 xl:col-span-9 min-w-0'
                  : 'w-full min-w-0'
              }
            >
            {currentSubject ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedSubjectId(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>
                      Volver a todas las materias{' '}
                      {activeYears.length > 1
                        ? `(${activeYears.map((y) => y.name).join(' + ')})`
                        : `de ${activeYear.name}`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDocsSidePanelOpen(!isDocsSidePanelOpen)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isDocsSidePanelOpen
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                    }`}
                    title="Mostrar u ocultar el panel lateral de PDFs y documentos importados"
                  >
                    <PanelRight className="w-3.5 h-3.5" />
                    <span>Panel PDFs y Lectura</span>
                  </button>
                </div>

                <SubjectDetailView
                  key={currentSubject.id}
                  subject={currentSubject}
                  onUpdateSubject={handleUpdateSubject}
                  onSelectForPomodoro={handleStartPomodoroWithSubject}
                  preferences={preferences}
                  onOpenPreferences={() => setIsPreferencesModalOpen(true)}
                  onOpenExamsManager={(subId?: string) => {
                    setExamsManagerSubjectId(subId || currentSubject.id);
                    setIsExamsManagerOpen(true);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <span>
                        Materias de{' '}
                        {activeYears.length > 1
                          ? activeYears.map((y) => y.name).join(' + ')
                          : activeYear.name}
                      </span>
                      {selectedYearIds.length > 1 && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                          {selectedYearIds.length} cursos seleccionados
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {subjectSectionViewMode === 'kanban'
                        ? 'Gestiona el progreso de los temas arrastrando de Pendiente a Estudiado.'
                        : subjectSectionViewMode === 'feynman'
                        ? 'Herramienta guiada de la Técnica Feynman: explica un tema con tus palabras y compáralo con el temario original para detectar lagunas.'
                        : subjectLayoutMode === 'compact'
                        ? 'Vista compacta de una línea por asignatura para examinar rápidamente todas las materias.'
                        : 'Selecciona una asignatura, usa la herramienta Técnica Feynman o activa la vista compacta.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Selector de vistas del tablero: Tarjetas detalladas vs Vista compacta vs Tablero Kanban vs Técnica Feynman */}
                    <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl border border-slate-200 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectSectionViewMode('grid');
                          setSubjectLayoutMode('detailed');
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          subjectSectionViewMode === 'grid' && subjectLayoutMode === 'detailed'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Ver tarjetas detalladas con temario y métricas completas"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Tarjetas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSubjectSectionViewMode('grid');
                          setSubjectLayoutMode('compact');
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          subjectSectionViewMode === 'grid' && subjectLayoutMode === 'compact'
                            ? 'bg-white text-blue-700 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Vista compacta: lista de una sola línea por asignatura para máxima legibilidad"
                      >
                        <List className="w-3.5 h-3.5 text-blue-600" />
                        <span>Vista Compacta</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubjectSectionViewMode('kanban')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          subjectSectionViewMode === 'kanban'
                            ? 'bg-white text-blue-700 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Tablero Kanban de todos los temas del curso"
                      >
                        <Kanban className="w-3.5 h-3.5 text-blue-600" />
                        <span>Tablero Kanban</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!feynmanSubjectId && activeSubjects[0]) {
                            setFeynmanSubjectId(activeSubjects[0].id);
                          }
                          setSubjectSectionViewMode('feynman');
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          subjectSectionViewMode === 'feynman'
                            ? 'bg-purple-600 text-white shadow-2xs font-bold'
                            : 'text-purple-700 hover:bg-purple-50'
                        }`}
                        title="Herramienta guiada de la Técnica Feynman: explica un tema y compáralo con el temario original para detectar lagunas de conocimiento"
                      >
                        <Brain className={`w-3.5 h-3.5 ${subjectSectionViewMode === 'feynman' ? 'text-white' : 'text-purple-600'}`} />
                        <span>Técnica Feynman</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDocsSidePanelOpen(!isDocsSidePanelOpen)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        isDocsSidePanelOpen
                          ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100'
                          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                      }`}
                      title="Mostrar u ocultar el panel lateral de archivos PDF y páginas restantes"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Panel PDFs</span>
                    </button>

                    <button
                      onClick={() => setIsProgramModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir Materia</span>
                    </button>
                  </div>
                </div>

                {subjectSectionViewMode === 'feynman' ? (
                  (() => {
                    const targetFeynmanSubject =
                      activeSubjects.find((s) => s.id === feynmanSubjectId) || activeSubjects[0];
                    if (!targetFeynmanSubject) {
                      return (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                          Añade primero una materia al curso para usar la herramienta guiada de la Técnica Feynman.
                        </div>
                      );
                    }
                    return (
                      <FeynmanChallenge
                        subject={targetFeynmanSubject}
                        subjects={activeSubjects}
                        onSelectSubject={(subId) => setFeynmanSubjectId(subId)}
                        onSaveSession={(session, autoFlashcards) => {
                          handleUpdateSubject({
                            ...targetFeynmanSubject,
                            feynmanSessions: [
                              session,
                              ...(targetFeynmanSubject.feynmanSessions || []),
                            ],
                            flashcards:
                              autoFlashcards && autoFlashcards.length > 0
                                ? [...(targetFeynmanSubject.flashcards || []), ...autoFlashcards]
                                : targetFeynmanSubject.flashcards,
                          });
                        }}
                        onAddFlashcards={(newCards) => {
                          handleSaveFlashcardsToSubject(targetFeynmanSubject.id, newCards);
                        }}
                        onDeleteSession={(sessionId) => {
                          handleUpdateSubject({
                            ...targetFeynmanSubject,
                            feynmanSessions: (targetFeynmanSubject.feynmanSessions || []).filter(
                              (s) => s.id !== sessionId
                            ),
                          });
                        }}
                        onLogMistake={(mistake) => {
                          handleUpdateSubject({
                            ...targetFeynmanSubject,
                            errorLogs: [mistake, ...(targetFeynmanSubject.errorLogs || [])],
                          });
                        }}
                        onMarkTopicReviewed={(topicId, retentionPct) => {
                          const updatedTopics = targetFeynmanSubject.topics.map((t) =>
                            t.id === topicId
                              ? {
                                  ...t,
                                  perceivedRetentionPct: retentionPct,
                                }
                              : t
                          );
                          handleUpdateSubject({
                            ...targetFeynmanSubject,
                            topics: updatedTopics,
                          });
                        }}
                      />
                    );
                  })()
                ) : subjectSectionViewMode === 'kanban' ? (
                  <TopicKanbanBoard
                    topics={activeSubjects.flatMap((sub) =>
                      sub.topics.map((t) => ({
                        ...t,
                        subjectName: sub.name,
                        subjectColor: sub.color || '#3b82f6',
                        subjectId: sub.id,
                      }))
                    )}
                    subjectsList={activeSubjects.map((s) => ({
                      id: s.id,
                      name: s.name,
                      color: s.color,
                    }))}
                    selectedFilterSubjectId={kanbanFilterSubjectId}
                    onFilterSubjectChange={setKanbanFilterSubjectId}
                    onSelectSubject={(subId) => setSelectedSubjectId(subId)}
                    onUpdateTopicStatus={handleUpdateTopicStatusGlobal}
                    onStartPomodoro={(topicId) => {
                      const parentSub = activeSubjects.find((s) =>
                        s.topics.some((t) => t.id === topicId)
                      );
                      handleStartPomodoroWithSubject(parentSub?.id || '', topicId);
                    }}
                  />
                ) : (
                  <div className="space-y-5">
                    {/* RESUMEN VISUAL GLOBAL DEL CURSO: ANILLO DE DOMINIO + BARRA MULTICOLOR + KPIS VISUALES */}
                    {activeSubjects.length > 0 && (() => {
                      const subjectStatsList = activeSubjects.map((sub) => {
                        const prog = schedulerService.calculateSubjectAcademicProgress(
                          sub.topics || [],
                          preferences
                        );
                        const v1Done = (sub.topics || []).filter(
                          (t) =>
                            (t.vueltasCount || 0) >= 1 ||
                            t.status === 'estudiado' ||
                            t.status === 'repasado'
                        ).length;
                        const v2Done = (sub.topics || []).filter(
                          (t) => (t.vueltasCount || 0) >= 2 || (t.reviewLevel || 0) >= 1
                        ).length;
                        const v3Done = (sub.topics || []).filter(
                          (t) => (t.vueltasCount || 0) >= 3 || (t.reviewLevel || 0) >= 2
                        ).length;
                        const spaced = getSubjectSpacedRepetitionAlert(
                          sub,
                          preferences.spacedRepetitionIncludeOverdue ?? true
                        );
                        return { sub, prog, v1Done, v2Done, v3Done, spaced };
                      });

                      const totalTopicsCourse = subjectStatsList.reduce(
                        (acc, s) => acc + s.prog.totalTopics,
                        0
                      );
                      const completedTopicsCourse = subjectStatsList.reduce(
                        (acc, s) => acc + s.prog.completedTopics,
                        0
                      );
                      const inProgressTopicsCourse = subjectStatsList.reduce(
                        (acc, s) => acc + s.prog.inProgressTopics,
                        0
                      );
                      const pendingTopicsCourse = Math.max(
                        0,
                        totalTopicsCourse - completedTopicsCourse - inProgressTopicsCourse
                      );

                      const totalPagesCourse = subjectStatsList.reduce(
                        (acc, s) => acc + s.prog.totalPages,
                        0
                      );
                      const pagesReadCourse = subjectStatsList.reduce(
                        (acc, s) => acc + s.prog.pagesRead,
                        0
                      );
                      const remainingHoursCourse =
                        Math.round(
                          subjectStatsList.reduce((acc, s) => acc + s.prog.remainingHours, 0) * 10
                        ) / 10;

                      const globalPct =
                        totalPagesCourse > 0
                          ? Math.min(100, Math.round((pagesReadCourse / totalPagesCourse) * 100))
                          : totalTopicsCourse > 0
                          ? Math.min(
                              100,
                              Math.round((completedTopicsCourse / totalTopicsCourse) * 100)
                            )
                          : 0;

                      const totalV1 = subjectStatsList.reduce((acc, s) => acc + s.v1Done, 0);
                      const totalV2 = subjectStatsList.reduce((acc, s) => acc + s.v2Done, 0);
                      const totalV3 = subjectStatsList.reduce((acc, s) => acc + s.v3Done, 0);
                      const v1Pct =
                        totalTopicsCourse > 0 ? Math.round((totalV1 / totalTopicsCourse) * 100) : 0;
                      const v2Pct =
                        totalTopicsCourse > 0 ? Math.round((totalV2 / totalTopicsCourse) * 100) : 0;
                      const v3Pct =
                        totalTopicsCourse > 0 ? Math.round((totalV3 / totalTopicsCourse) * 100) : 0;

                      const totalSpacedToday = subjectStatsList.reduce(
                        (acc, s) => acc + s.spaced.totalPendingToday,
                        0
                      );

                      const ringRadius = 34;
                      const ringCirc = 2 * Math.PI * ringRadius;
                      const ringOffset = ringCirc - (globalPct / 100) * ringCirc;

                      return (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                            {/* Anillo Global + Distribución Multicolor por Materia */}
                            <div className="lg:col-span-5 flex items-center gap-4 sm:gap-5 pr-2 lg:border-r lg:border-slate-100 dark:lg:border-slate-800">
                              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                  <circle
                                    cx="40"
                                    cy="40"
                                    r={ringRadius}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="7"
                                    className="text-slate-100 dark:text-slate-800"
                                  />
                                  <circle
                                    cx="40"
                                    cy="40"
                                    r={ringRadius}
                                    fill="none"
                                    stroke={
                                      globalPct >= 80
                                        ? '#10b981'
                                        : globalPct >= 40
                                        ? '#2563eb'
                                        : '#6366f1'
                                    }
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                    strokeDasharray={ringCirc}
                                    strokeDashoffset={ringOffset}
                                    className="transition-all duration-700"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-base font-extrabold font-mono-numbers text-slate-900 dark:text-white leading-none">
                                    {globalPct}%
                                  </span>
                                  <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                    Global
                                  </span>
                                </div>
                              </div>

                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                    Mapa Visual de {activeSubjects.length}{' '}
                                    {activeSubjects.length === 1 ? 'Materia' : 'Materias'}
                                  </span>
                                  <span className="text-[11px] font-mono-numbers text-slate-500">
                                    {pagesReadCourse}/{totalPagesCourse} págs
                                  </span>
                                </div>

                                {/* Barra segmentada por color de asignatura */}
                                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex gap-0.5 p-0.5">
                                  {subjectStatsList.map(({ sub, prog }) => {
                                    const weight = Math.max(1, prog.totalTopics || 1);
                                    return (
                                      <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() => setSelectedSubjectId(sub.id)}
                                        style={{
                                          flexGrow: weight,
                                          backgroundColor: sub.color || '#3b82f6',
                                          opacity: prog.progressPct > 0 ? 0.95 : 0.35,
                                        }}
                                        className="h-full first:rounded-l-full last:rounded-r-full transition-all hover:opacity-100 cursor-pointer"
                                        title={`${sub.name}: ${prog.progressPct}% completado (${prog.completedTopics}/${prog.totalTopics} temas)`}
                                      />
                                    );
                                  })}
                                </div>

                                {/* Leyenda interactiva rápida de asignaturas */}
                                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                  {subjectStatsList.slice(0, 6).map(({ sub, prog }) => (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => setSelectedSubjectId(sub.id)}
                                      className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                                    >
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: sub.color || '#3b82f6' }}
                                      />
                                      <span className="truncate max-w-[95px] font-medium">
                                        {sub.code || sub.name}
                                      </span>
                                      <span className="font-mono-numbers font-bold text-slate-800 dark:text-slate-200">
                                        {prog.progressPct}%
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* 3 Bloques Visuales: Estado del Temario, Control de Vueltas y Carga Horaria */}
                            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Bloque 1: Estado de Temas */}
                              <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold">Estado del Temario</span>
                                  <span className="font-mono-numbers font-bold text-slate-800 dark:text-slate-200">
                                    {completedTopicsCourse}/{totalTopicsCourse}
                                  </span>
                                </div>
                                <div className="my-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                                  {totalTopicsCourse > 0 && (
                                    <>
                                      <div
                                        className="bg-emerald-500 h-full transition-all duration-500"
                                        style={{
                                          width: `${(completedTopicsCourse / totalTopicsCourse) * 100}%`,
                                        }}
                                        title={`Estudiados: ${completedTopicsCourse}`}
                                      />
                                      <div
                                        className="bg-amber-400 h-full transition-all duration-500"
                                        style={{
                                          width: `${(inProgressTopicsCourse / totalTopicsCourse) * 100}%`,
                                        }}
                                        title={`En lectura: ${inProgressTopicsCourse}`}
                                      />
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono-numbers text-slate-500 dark:text-slate-400">
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                    {completedTopicsCourse} est.
                                  </span>
                                  <span>·</span>
                                  <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                    {inProgressTopicsCourse} lect.
                                  </span>
                                  <span>·</span>
                                  <span>{pendingTopicsCourse} pend.</span>
                                </div>
                              </div>

                              {/* Bloque 2: Dominio por Vueltas */}
                              <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold">Vueltas al Temario</span>
                                  <span className="font-mono-numbers font-bold text-blue-600 dark:text-blue-400">
                                    1V {v1Pct}%
                                  </span>
                                </div>
                                <div className="space-y-1 my-1.5">
                                  <div className="flex items-center gap-2 text-[10px] font-mono-numbers">
                                    <span className="w-5 font-bold text-blue-600">1ªV</span>
                                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-600 rounded-full"
                                        style={{ width: `${v1Pct}%` }}
                                      />
                                    </div>
                                    <span className="w-7 text-right text-slate-600 dark:text-slate-300">
                                      {v1Pct}%
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-mono-numbers">
                                    <span className="w-5 font-bold text-indigo-600">2ªV</span>
                                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-indigo-500 rounded-full"
                                        style={{ width: `${v2Pct}%` }}
                                      />
                                    </div>
                                    <span className="w-7 text-right text-slate-600 dark:text-slate-300">
                                      {v2Pct}%
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-mono-numbers">
                                    <span className="w-5 font-bold text-emerald-600">3ªV</span>
                                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full"
                                        style={{ width: `${v3Pct}%` }}
                                      />
                                    </div>
                                    <span className="w-7 text-right text-slate-600 dark:text-slate-300">
                                      {v3Pct}%
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Bloque 3: Carga Restante y Repasos Hoy */}
                              <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold">Carga Pendiente</span>
                                  <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                </div>
                                <div className="my-1 flex items-baseline justify-between gap-2">
                                  <span className="text-lg font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                                    {remainingHoursCourse}h
                                  </span>
                                  <span className="text-[11px] font-mono-numbers text-slate-500">
                                    {Math.max(0, totalPagesCourse - pagesReadCourse)} págs rest.
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Repaso SR hoy:
                                  </span>
                                  <span
                                    className={`font-mono-numbers font-bold ${
                                      totalSpacedToday > 0
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    {totalSpacedToday > 0
                                      ? `${totalSpacedToday} tema(s)`
                                      : 'Al día ✓'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Alerta global en el tablero si existen materias con ritmo inferior al 20% tras > 2 semanas */}
                    {(() => {
                      const alertedSubjects = activeSubjects.flatMap((sub) => {
                        const alert = checkSubjectProgressAlert(sub, activeYear);
                        return alert.isAlert ? [{ subject: sub, alert }] : [];
                      });
                      if (alertedSubjects.length === 0) return null;

                      return (
                        <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/90 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded-xl shrink-0">
                              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                            </div>
                            <div>
                              <h5 className="font-bold text-amber-950 dark:text-amber-100 text-sm">
                                Aviso de ritmo académico: {alertedSubjects.length}{' '}
                                {alertedSubjects.length === 1
                                  ? 'asignatura por debajo del 20%'
                                  : 'asignaturas por debajo del 20%'}
                              </h5>
                              <p className="text-amber-900/80 dark:text-amber-200/80 text-xs mt-0.5">
                                Selecciona una materia para programar sesiones de estudio o iniciar bloques Pomodoro.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            {alertedSubjects.map(({ subject, alert }) => (
                              <button
                                key={subject.id}
                                type="button"
                                onClick={() => setSelectedSubjectId(subject.id)}
                                className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-amber-100/70 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: subject.color || '#f59e0b' }}
                                />
                                <span>{subject.name}</span>
                                <span className="font-bold text-amber-700 dark:text-amber-300 font-mono-numbers">
                                  {alert.progressPct}%
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {subjectLayoutMode === 'compact' ? (
                      /* Vista compacta visual con bloques de temas y acceso rápido */
                      <div className="space-y-2.5">
                        {activeSubjects.map((sub) => {
                          const subProg = schedulerService.calculateSubjectAcademicProgress(
                            sub.topics || [],
                            preferences
                          );
                          const totalTopics = subProg.totalTopics;
                          const studiedTopics = subProg.completedTopics;
                          const pct = subProg.progressPct;
                          const progressAlert = checkSubjectProgressAlert(sub, activeYear);
                          const spacedAlert = getSubjectSpacedRepetitionAlert(
                            sub,
                            preferences.spacedRepetitionIncludeOverdue ?? true
                          );
                          const subjectColor = sub.color || '#3b82f6';
                          const currentVuelta = sub.currentVuelta || 1;

                          return (
                            <div
                              key={sub.id}
                              onClick={() => setSelectedSubjectId(sub.id)}
                              className={`px-4 py-3.5 bg-white dark:bg-slate-900 rounded-2xl border shadow-2xs hover:shadow-xs cursor-pointer transition-all flex items-center justify-between gap-3 sm:gap-4 group ${
                                progressAlert.isAlert
                                  ? 'border-amber-300 hover:border-amber-400'
                                  : spacedAlert.hasPendingToday
                                  ? 'border-indigo-300 dark:border-indigo-700 hover:border-indigo-400'
                                  : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                              }`}
                            >
                              {/* Identificador, color y nombre */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span
                                  className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg text-white shrink-0"
                                  style={{ backgroundColor: subjectColor }}
                                >
                                  {sub.code || 'ASIG'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                      {sub.name}
                                    </span>
                                    <span className="text-[11px] font-mono-numbers text-slate-400 shrink-0">
                                      · {currentVuelta}ª Vuelta
                                      {sub.credits ? ` · ${sub.credits} ECTS` : ''}
                                      <span className="sm:hidden font-semibold text-slate-500"> · {studiedTopics}/{totalTopics} temas</span>
                                    </span>
                                  </div>
                                  {/* Mini tira visual de temas */}
                                  {sub.topics.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1.5 max-w-xs">
                                      {sub.topics.slice(0, 18).map((t, idx) => {
                                        const isDone =
                                          t.status === 'estudiado' || t.status === 'repasado';
                                        const isProg = t.status === 'en_progreso';
                                        return (
                                          <span
                                            key={t.id || idx}
                                            className={`h-1.5 flex-1 rounded-xs ${
                                              isDone
                                                ? 'bg-emerald-500'
                                                : isProg
                                                ? 'bg-amber-400'
                                                : 'bg-slate-200 dark:bg-slate-700'
                                            }`}
                                            title={`${t.title} (${t.status})`}
                                          />
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Acciones rápidas y Repaso SR */}
                              <div className="flex items-center gap-2 shrink-0">
                                {spacedAlert.hasPendingToday && (
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleJumpToSubjectQuizzes(
                                        sub.id,
                                        spacedAlert.pendingTopicIds,
                                        e
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-800 hover:text-white dark:bg-indigo-950/70 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3 shrink-0" />
                                    <span className="font-mono-numbers">
                                      {spacedAlert.totalPendingToday} SR hoy
                                    </span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickReviewSubjectId(sub.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-white dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold transition-colors cursor-pointer"
                                  title="Revisión Rápida: puntos clave y conceptos Cornell de esta materia"
                                >
                                  <Zap className="w-3 h-3 text-amber-500 group-hover:text-current shrink-0" />
                                  <span className="hidden sm:inline">Revisión Rápida</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartPomodoroWithSubject(sub.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white dark:bg-slate-800 dark:text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="Iniciar sesión Pomodoro en esta materia"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span className="hidden sm:inline">Pomodoro</span>
                                </button>

                                <SubjectSpacedRepetitionInfoPopover subject={sub} compact />
                              </div>

                              {/* Métricas tabulares y anillo/barra */}
                              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0 font-mono-numbers">
                                <span>
                                  {studiedTopics}/{totalTopics} temas
                                </span>
                                <span>·</span>
                                <span>
                                  {subProg.pagesRead}/{subProg.totalPages}p
                                </span>
                                {subProg.remainingHours > 0 && (
                                  <>
                                    <span>·</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                      {subProg.remainingHours}h
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="w-20 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: progressAlert.isAlert
                                        ? '#f59e0b'
                                        : pct >= 80
                                        ? '#10b981'
                                        : subjectColor,
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-mono-numbers font-bold w-9 text-right text-slate-800 dark:text-slate-200">
                                  {pct}%
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Grid de tarjetas visuales con Anillo SVG, Mapa Segmentado de Temas y Acciones Directas */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {activeSubjects.map((sub) => {
                          const subProg = schedulerService.calculateSubjectAcademicProgress(
                            sub.topics || [],
                            preferences
                          );
                          const totalTopics = subProg.totalTopics;
                          const studiedTopics = subProg.completedTopics;
                          const inProgressTopics = subProg.inProgressTopics;
                          const pct = subProg.progressPct;
                          const progressAlert = checkSubjectProgressAlert(sub, activeYear);
                          const spacedAlert = getSubjectSpacedRepetitionAlert(
                            sub,
                            preferences.spacedRepetitionIncludeOverdue ?? true
                          );
                          const subjectColor = sub.color || '#3b82f6';
                          const currentVuelta = sub.currentVuelta || 1;

                          const totalDocs = sub.topics.reduce(
                            (acc, t) =>
                              acc +
                              (t.attachedFiles && t.attachedFiles.length > 0
                                ? t.attachedFiles.length
                                : 0),
                            0
                          );

                          // Próximo examen pendiente
                          const todayIso = new Date().toISOString().slice(0, 10);
                          const upcomingExam = (sub.exams || [])
                            .filter((ex) => !ex.completed && ex.date >= todayIso)
                            .sort((a, b) => a.date.localeCompare(b.date))[0];
                          const daysUntilExam = upcomingExam
                            ? Math.max(
                                0,
                                Math.ceil(
                                  (new Date(upcomingExam.date).getTime() - Date.now()) /
                                    (1000 * 60 * 60 * 24)
                                )
                              )
                            : null;

                          // Anillo SVG por tarjeta
                          const cardRingR = 23;
                          const cardRingC = 2 * Math.PI * cardRingR;
                          const cardRingOffset = cardRingC - (pct / 100) * cardRingC;

                          return (
                            <div
                              key={sub.id}
                              onClick={() => setSelectedSubjectId(sub.id)}
                              className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-2xs hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between group overflow-hidden ${
                                progressAlert.isAlert
                                  ? 'border-amber-300 hover:border-amber-400'
                                  : spacedAlert.hasPendingToday
                                  ? 'border-indigo-300 dark:border-indigo-700 hover:border-indigo-500'
                                  : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                              }`}
                            >
                              {/* Franja superior cromática */}
                              <div
                                className="h-1.5 w-full transition-all group-hover:h-2"
                                style={{ backgroundColor: subjectColor }}
                              />

                              <div className="p-5 pb-4 flex-1 flex flex-col justify-between space-y-4">
                                {/* Cabecera: Código + Metadatos a la izquierda, Anillo SVG de Progreso a la derecha */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                                      <span
                                        className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md text-white"
                                        style={{ backgroundColor: subjectColor }}
                                      >
                                        {sub.code || 'ASIG'}
                                      </span>
                                      {sub.credits ? (
                                        <>
                                          <span className="font-mono-numbers font-semibold">
                                            {sub.credits} ECTS
                                          </span>
                                          <span>·</span>
                                        </>
                                      ) : null}
                                      <span className="font-mono-numbers font-bold text-slate-700 dark:text-slate-300">
                                        {currentVuelta}ª Vuelta
                                      </span>
                                      <SubjectSpacedRepetitionInfoPopover subject={sub} compact />
                                    </div>

                                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                                      {sub.name}
                                    </h4>

                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                                      {sub.professor && <span>Prof. {sub.professor}</span>}
                                      {upcomingExam && daysUntilExam !== null && (
                                        <>
                                          {sub.professor && <span>·</span>}
                                          <span
                                            className={`font-mono-numbers font-semibold ${
                                              daysUntilExam <= 7
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-amber-600 dark:text-amber-400'
                                            }`}
                                          >
                                            Examen en {daysUntilExam}d
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Anillo SVG circular del progreso de la materia */}
                                  <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                                      <circle
                                        cx="28"
                                        cy="28"
                                        r={cardRingR}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="5"
                                        className="text-slate-100 dark:text-slate-800"
                                      />
                                      <circle
                                        cx="28"
                                        cy="28"
                                        r={cardRingR}
                                        fill="none"
                                        stroke={
                                          progressAlert.isAlert
                                            ? '#f59e0b'
                                            : pct >= 80
                                            ? '#10b981'
                                            : subjectColor
                                        }
                                        strokeWidth="5"
                                        strokeLinecap="round"
                                        strokeDasharray={cardRingC}
                                        strokeDashoffset={cardRingOffset}
                                        className="transition-all duration-500"
                                      />
                                    </svg>
                                    <span className="absolute text-xs font-extrabold font-mono-numbers text-slate-900 dark:text-white">
                                      {pct}%
                                    </span>
                                  </div>
                                </div>

                                {/* Mapa Visual Segmentado de los Temas de la Asignatura */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                                      Mapa de temas ({studiedTopics}/{totalTopics} completados)
                                    </span>
                                    <span className="font-mono-numbers text-slate-400">
                                      {inProgressTopics > 0
                                        ? `${inProgressTopics} en lectura`
                                        : totalDocs > 0
                                        ? `${totalDocs} PDFs`
                                        : `${sub.cornellNotes.length} apuntes`}
                                    </span>
                                  </div>

                                  {sub.topics.length > 0 ? (
                                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 pt-0.5">
                                      {sub.topics.slice(0, 16).map((t, idx) => {
                                        const isDone =
                                          t.status === 'estudiado' || t.status === 'repasado';
                                        const isProg = t.status === 'en_progreso';
                                        const vCount = t.vueltasCount || (isDone ? 1 : 0);
                                        return (
                                          <div
                                            key={t.id || idx}
                                            className={`h-5 rounded-md flex items-center justify-center text-[9px] font-mono-numbers font-bold border transition-all ${
                                              isDone
                                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                                                : isProg
                                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300'
                                                : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-400'
                                            }`}
                                            title={`Tema ${idx + 1}: ${t.title} (${t.status}${
                                              vCount > 0 ? ` · ${vCount}ª Vuelta` : ''
                                            })`}
                                          >
                                            T{idx + 1}
                                          </div>
                                        );
                                      })}
                                      {sub.topics.length > 16 && (
                                        <div className="h-5 rounded-md flex items-center justify-center text-[9px] font-mono-numbers font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                          +{sub.topics.length - 16}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-slate-400 italic py-1">
                                      Sin temas registrados todavía — haz clic para añadir
                                    </div>
                                  )}
                                </div>

                                {/* Cuadrícula visual de 3 métricas clave */}
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-center">
                                  <div className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/40">
                                    <div className="text-[10px] text-slate-400">Lectura</div>
                                    <div className="text-xs font-extrabold font-mono-numbers text-slate-800 dark:text-slate-100 mt-0.5">
                                      {subProg.pagesRead}/{subProg.totalPages}p
                                    </div>
                                  </div>
                                  <div className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/40">
                                    <div className="text-[10px] text-slate-400">Tiempo pend.</div>
                                    <div className="text-xs font-extrabold font-mono-numbers text-indigo-600 dark:text-indigo-400 mt-0.5">
                                      {subProg.remainingHours}h
                                    </div>
                                  </div>
                                  <div className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/40">
                                    <div className="text-[10px] text-slate-400">Repaso hoy</div>
                                    <div
                                      className={`text-xs font-extrabold font-mono-numbers mt-0.5 ${
                                        spacedAlert.hasPendingToday
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {spacedAlert.hasPendingToday
                                        ? `${spacedAlert.totalPendingToday} SR`
                                        : 'Al día'}
                                    </div>
                                  </div>
                                </div>

                                {/* Banner interactivo de Repaso Espaciado si tiene temas hoy */}
                                {spacedAlert.hasPendingToday && (
                                  <div
                                    onClick={(e) =>
                                      handleJumpToSubjectQuizzes(
                                        sub.id,
                                        spacedAlert.pendingTopicIds,
                                        e
                                      )
                                    }
                                    className="px-3 py-2 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-2 text-[11px] hover:border-indigo-400 transition-colors"
                                  >
                                    <span className="font-semibold text-indigo-900 dark:text-indigo-200 truncate">
                                      {spacedAlert.totalPendingToday}{' '}
                                      {spacedAlert.totalPendingToday === 1
                                        ? 'tema para repasar hoy'
                                        : 'temas para repasar hoy'}
                                    </span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0 inline-flex items-center gap-1">
                                      <span>Hacer Test</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Pie de acciones directas en 1 clic */}
                              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuickReviewSubjectId(sub.id);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-500 dark:bg-amber-950/60 dark:hover:bg-amber-600 text-amber-800 dark:text-amber-200 hover:text-white border border-amber-200 dark:border-amber-800 text-[11px] font-bold transition-colors cursor-pointer"
                                    title={`Revisión Rápida de puntos clave y apuntes Cornell (${sub.name})`}
                                  >
                                    <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span>Revisión Rápida</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartPomodoroWithSubject(sub.id);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                                    title={`Iniciar Pomodoro en ${sub.name}`}
                                  >
                                    <Clock className="w-3 h-3" />
                                    <span>Pomodoro</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFeynmanSubjectId(sub.id);
                                      setSubjectSectionViewMode('feynman');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800 text-[11px] font-semibold transition-colors cursor-pointer"
                                    title={`Abrir Técnica Feynman para ${sub.name}`}
                                  >
                                    <Brain className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                                    <span>Feynman</span>
                                  </button>
                                </div>

                                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                  <span>Abrir materia</span>
                                  <ArrowRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            {isDocsSidePanelOpen && (
              <div
                className={
                  preferences.navigationPosition === 'sidebar'
                    ? 'xl:col-span-4 2xl:col-span-3 w-full'
                    : 'lg:col-span-4 xl:col-span-3 w-full'
                }
              >
                <SubjectDocumentsSidePanel
                  subjects={activeSubjects}
                  selectedSubject={currentSubject || null}
                  onSelectSubject={(subId) => setSelectedSubjectId(subId)}
                  onUpdateSubject={handleUpdateSubject}
                  onStartPomodoro={handleStartPomodoroWithSubject}
                  onOpenProgramModal={() => setIsProgramModalOpen(true)}
                  onLoadDemoData={handleLoadDemoData}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Plan Inteligente y Calendario de Repaso Espaciado (Unificados) */}
        {(activeTab === 'calendario' || activeTab === 'repaso') && activeYear && (
          <SmartCalendarModal
            subjects={activeSubjects}
            preferences={preferences}
            onUpdatePreferences={(updated) => setPreferences(updated)}
            blockedEvents={blockedEvents}
            onAddBlockedEvent={handleAddBlockedEvent}
            onDeleteBlockedEvent={handleDeleteBlockedEvent}
            onUpdateBlockedEvent={handleUpdateBlockedEvent}
            onUpdateTopicsSchedule={handleUpdateTopicsSchedule}
            onUpdateSubject={handleUpdateSubject}
            onBatchUpdateSubjects={handleBatchUpdateSubjects}
            onAddTaskToSubject={handleAddTaskToSubject}
            pomodoroLogs={pomodoroLogs}
            onSelectSubject={(subId) => {
              setSelectedSubjectId(subId);
              setActiveTab('asignaturas');
            }}
            onToggleTask={handleToggleTask}
            onStartPomodoro={handleStartPomodoroWithSubject}
            onOpenProgramManager={() => setIsProgramModalOpen(true)}
            onOpenPreferences={() => setIsPreferencesModalOpen(true)}
          />
        )}

        {/* Tab 4: Cuestionarios y Simulacros de Examen IA */}
        {activeTab === 'cuestionarios' && activeYear && (
          <PracticeQuizModule
            subjects={activeSubjects}
            initialSubjectId={quizSubjectTargetId || selectedSubjectId || undefined}
            initialTopicIds={quizTopicTargetIds}
            initialSpacedRepetitionFocus={quizTopicTargetIds.length > 0}
            onSaveQuizResult={handleSaveQuizResult}
            onLogMistake={handleLogMistake}
            onOpenErrorAnalysis={() => setIsErrorModalOpen(true)}
            onSaveFlashcards={handleSaveFlashcardsToSubject}
            onUpdateSubject={handleUpdateSubject}
          />
        )}

        {/* Tab 5: Temporizador Pomodoro */}
        {activeTab === 'pomodoro' && activeYear && (
          <div className="space-y-6">
            {!isPomodoroFocusMode && (
              <div className="text-center max-w-lg mx-auto">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Zona de Enfoque Profundo (Pomodoro)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ajusta la duración del ciclo o utiliza el ritmo predeterminado de 52 minutos de foco y 17 minutos de descanso.
                </p>
              </div>
            )}

            <PomodoroTimer
              subjects={activeSubjects}
              activeSubjectId={pomodoroSubjectTarget}
              activeTopicId={pomodoroTopicTarget}
              onSessionComplete={handlePomodoroComplete}
              pomodoroConfig={preferences.pomodoroConfig}
              onUpdatePomodoroConfig={(newConfig) => {
                setPreferences((prev) => ({
                  ...prev,
                  pomodoroConfig: newConfig,
                }));
              }}
              onFocusModeChange={setIsPomodoroFocusMode}
            />
          </div>
        )}

        {/* Tab 6: Estadísticas de Progreso Semanal */}
        {activeTab === 'estadisticas' && (
          <WeeklyStatsModal
            subjects={activeSubjects}
            pomodoroLogs={pomodoroLogs}
            preferences={preferences}
            weeklyTargetHours={activeYear?.targetWeeklyHours || 20}
            blockedEvents={blockedEvents}
            activeSubjectId={selectedSubjectId || activeSubjects[0]?.id}
            onSelectSubject={setSelectedSubjectId}
            onOpenActiveRecall={() => setActiveTab('cuestionarios')}
            onOpenPreferences={() => setIsPreferencesModalOpen(true)}
            onOpenProgramManager={() => setIsProgramModalOpen(true)}
            onOpenExamsManager={() => {
              setExamsManagerSubjectId(undefined);
              setIsExamsManagerOpen(true);
            }}
            onUpdatePreferences={(updated) => setPreferences(updated)}
            onUpdateSubject={handleUpdateSubject}
          />
        )}
      </main>

      {/* Program Manager Modal (Jerarquía de Estudios) */}
      <ProgramManagerModal
        isOpen={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
        programs={programs}
        activeProgramId={activeProgramId}
        activeYearId={activeYearId}
        selectedYearIds={selectedYearIds}
        onToggleYearSelection={handleToggleYearSelection}
        selectedProgramIds={selectedProgramIds}
        onToggleProgramSelection={handleToggleProgramSelection}
        onSelectAllProgramsAndYears={handleSelectAllProgramsAndYears}
        onResetToBlank={handleResetToBlank}
        onLoadDemoData={handleLoadDemoData}
        onSelectProgramAndYear={(progId, yrId) => {
          setActiveProgramId(progId);
          setActiveYearId(yrId);
          setSelectedProgramIds((prev) => (prev.includes(progId) ? prev : [...prev, progId]));
          setSelectedYearIds((prev) => (prev.includes(yrId) ? prev : [...prev, yrId]));
          setSelectedSubjectId(null);
        }}
        onUpdatePrograms={(updated) => {
          const prevProgIds = new Set(programs.map((p) => p.id));
          const prevYearIds = new Set(programs.flatMap((p) => p.years.map((y) => y.id)));
          const addedProgIds = updated.filter((p) => !prevProgIds.has(p.id)).map((p) => p.id);
          const addedYearIds = updated
            .flatMap((p) => p.years)
            .filter((y) => !prevYearIds.has(y.id))
            .map((y) => y.id);
          if (addedProgIds.length > 0) {
            setSelectedProgramIds((prev) => Array.from(new Set([...prev, ...addedProgIds])));
          }
          if (addedYearIds.length > 0) {
            setSelectedYearIds((prev) => Array.from(new Set([...prev, ...addedYearIds])));
          }
          setPrograms(updated);
        }}
        onExportJSON={() => {
          const jsonStr = storageService.exportJSON();
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `StudyFlow_Backup_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
        }}
        onImportJSON={(jsonStr) => {
          if (storageService.importJSON(jsonStr)) {
            setPrograms(storageService.getPrograms());
            setPreferences(storageService.getPreferences());
            setPomodoroLogs(storageService.getPomodoroLogs());
          }
        }}
        blockedEvents={blockedEvents}
        onAddBlockedEvent={handleAddBlockedEvent}
        onDeleteBlockedEvent={handleDeleteBlockedEvent}
        onUpdateBlockedEvent={handleUpdateBlockedEvent}
        preferences={preferences}
        onUpdatePreferences={(updated) => setPreferences(updated)}
      />

      {/* Study Preferences Modal */}
      <StudyPreferencesModal
        isOpen={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
        preferences={preferences}
        onSavePreferences={(updated) => {
          setPreferences(updated);
          if (programs.length > 0) {
            const recalc = schedulerService.recalculateProgramsByReadingSpeed(programs, updated);
            setPrograms(recalc.updatedPrograms);
          }
        }}
        subjects={activeSubjects}
        pomodoroLogs={pomodoroLogs}
        programs={programs}
        onUpdatePrograms={(updated) => setPrograms(updated)}
        activeProgramId={activeProgramId}
      />

      {/* Global Error Analysis Modal */}
      {activeYear && (
        <ErrorAnalysisModal
          isOpen={isErrorModalOpen}
          onClose={() => setIsErrorModalOpen(false)}
          errors={activeYear.subjects.flatMap((s) => s.errorLogs)}
          subjectName={activeProgram?.name || 'Mis Materias'}
          onResolveError={(errId) => {
            // mark error as resolved across subjects
            const updatedPrograms = programs.map((p) => ({
              ...p,
              years: p.years.map((y) => ({
                ...y,
                subjects: y.subjects.map((s) => ({
                  ...s,
                  errorLogs: s.errorLogs.map((e) => (e.id === errId ? { ...e, resolved: true } : e)),
                })),
              })),
            }));
            setPrograms(updatedPrograms);
          }}
        />
      )}

      {/* Exams & Convocatorias Manager Modal */}
      <ExamsManagerModal
        isOpen={isExamsManagerOpen}
        onClose={() => {
          setIsExamsManagerOpen(false);
          setExamsManagerSubjectId(undefined);
        }}
        subjects={activeSubjects}
        initialSubjectId={examsManagerSubjectId}
        onUpdateSubject={handleUpdateSubject}
      />

      {/* Auth Modal for Email/Password Login & Register */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Interactive Guided Onboarding Tour (First-Time User & On-Demand) */}
      <InteractiveOnboardingTour
        isOpen={isOnboardingTourOpen}
        onClose={handleCloseOnboardingTour}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenProgramManager={() => setIsProgramModalOpen(true)}
        onOpenPreferences={() => setIsPreferencesModalOpen(true)}
        onOpenFirstSubject={() => {
          setActiveTab('asignaturas');
          if (!selectedSubjectId && activeSubjects.length > 0) {
            setSelectedSubjectId(activeSubjects[0].id);
          }
        }}
      />

      {/* Revisión Rápida Overlay (Puntos Clave y Apuntes Cornell por Materia) */}
      <SubjectQuickReviewOverlay
        subject={activeSubjects.find((s) => s.id === quickReviewSubjectId) || null}
        isOpen={Boolean(quickReviewSubjectId)}
        onClose={() => setQuickReviewSubjectId(null)}
        onStartPomodoro={(subId, topId) => handleStartPomodoroWithSubject(subId, topId)}
        onOpenSubjectDetail={(subId) => {
          setSelectedSubjectId(subId);
          setActiveTab('asignaturas');
        }}
        onOpenQuizzes={(subId, topIds) => handleJumpToSubjectQuizzes(subId, topIds)}
      />
    </div>
  );
}
