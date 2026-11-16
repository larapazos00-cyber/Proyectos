import React, { useState } from 'react';
import {
  Settings,
  Plus,
  Bell,
  BellRing,
  LogIn,
  CloudCheck,
  LogOut,
  RefreshCw,
  Sun,
  Moon,
  SlidersHorizontal,
  PanelLeft,
  PanelTop,
  LayoutDashboard,
  BookOpen,
  Calendar,
  Sparkles,
  Timer,
  BarChart3,
  Flame,
  Award,
  CheckCircle2,
  X,
  Menu,
  HelpCircle,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { notificationService } from '../services/notificationService';
import studyflowLogo from '../assets/images/studyflow_logo_1793994920234.jpg';
import { StreakModal } from './StreakModal';
import { AppHelpGuideModal } from './AppHelpGuideModal';
import { MoodTracker } from './MoodTracker';
import { StudyAchievementsPanel } from './StudyAchievementsPanel';
import { StudyPreferences, Subject, PomodoroLog, InterfaceDesignMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

export type NavTabId =
  | 'curso'
  | 'asignaturas'
  | 'calendario'
  | 'repaso'
  | 'cuestionarios'
  | 'pomodoro'
  | 'estadisticas';

interface NavigationProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  programName: string;
  yearName: string;
  onOpenProgramManager: () => void;
  onOpenPreferences: () => void;
  streakDays: number;
  user: User | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  isSyncingCloud?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  enabledTabs?: string[];
  navigationPosition?: 'top' | 'sidebar';
  onToggleNavigationPosition?: () => void;
  onStartOnboardingTour?: () => void;
  preferences?: StudyPreferences;
  onUpdatePreferences?: (updated: StudyPreferences) => void;
  subjects?: Subject[];
  pomodoroLogs?: PomodoroLog[];
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  programName,
  yearName,
  onOpenProgramManager,
  onOpenPreferences,
  streakDays,
  user,
  onOpenAuth,
  onSignOut,
  isSyncingCloud = false,
  theme = 'light',
  onToggleTheme,
  enabledTabs,
  navigationPosition = 'top',
  onToggleNavigationPosition,
  onStartOnboardingTour,
  preferences,
  onUpdatePreferences,
  subjects = [],
  pomodoroLogs = [],
}) => {
  const [notifGranted, setNotifGranted] = useState(
    () => notificationService.getPermission() === 'granted'
  );
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  React.useEffect(() => {
    const handleOpenHelp = () => setShowHelpModal(true);
    window.addEventListener('studyflow:open-help-guide', handleOpenHelp);
    return () => window.removeEventListener('studyflow:open-help-guide', handleOpenHelp);
  }, []);

  const designMode: InterfaceDesignMode = preferences?.interfaceDesignMode || 'complete';

  const handleSelectDesignMode = (nextMode: InterfaceDesignMode) => {
    if (!preferences || !onUpdatePreferences) {
      onOpenPreferences();
      return;
    }
    const recommendedTabsByMode: Record<InterfaceDesignMode, string[]> = {
      complete: ['curso', 'asignaturas', 'calendario', 'cuestionarios', 'pomodoro', 'estadisticas'],
      intermediate: ['curso', 'asignaturas', 'calendario', 'cuestionarios', 'pomodoro'],
      minimal: ['curso', 'asignaturas', 'calendario', 'pomodoro'],
    };
    onUpdatePreferences({
      ...preferences,
      interfaceDesignMode: nextMode,
      enabledTabs: recommendedTabsByMode[nextMode],
    });
  };

  const ALL_NAV_TABS: {
    id: NavTabId;
    label: string;
    mobileLabel: string;
    icon: React.ElementType;
  }[] = [
    {
      id: 'curso',
      label: designMode === 'minimal' ? 'Inicio' : 'General',
      mobileLabel: designMode === 'minimal' ? 'Inicio' : 'General',
      icon: LayoutDashboard,
    },
    {
      id: 'asignaturas',
      label: 'Materias',
      mobileLabel: 'Materias',
      icon: BookOpen,
    },
    {
      id: 'calendario',
      label: designMode === 'minimal' ? 'Calendario' : 'Plan y Repasos',
      mobileLabel: designMode === 'minimal' ? 'Calendario' : 'Plan',
      icon: Calendar,
    },
    {
      id: 'cuestionarios',
      label: designMode === 'minimal' ? 'Flashcards' : 'Cuestionarios',
      mobileLabel: designMode === 'minimal' ? 'Flashcards' : 'Tests',
      icon: Sparkles,
    },
    { id: 'pomodoro', label: 'Pomodoro', mobileLabel: 'Pomodoro', icon: Timer },
    { id: 'estadisticas', label: 'Estadísticas', mobileLabel: 'Estadísticas', icon: BarChart3 },
  ];

  const visibleTabs = ALL_NAV_TABS.filter((t) => {
    if (designMode === 'minimal' && t.id === 'estadisticas') return false;
    if (!enabledTabs || enabledTabs.length === 0) return true;
    if (t.id === 'calendario' && (enabledTabs.includes('calendario') || enabledTabs.includes('repaso'))) {
      return true;
    }
    return enabledTabs.includes(t.id);
  });

  // Reusable Sidebar Content (Fits cleanly without needing to scroll/slide)
  const renderSidebarInner = (onClose?: () => void) => (
    <div className="flex flex-col justify-between h-full w-full space-y-2.5 select-none">
      <div className="space-y-2.5">
        {/* Brand + Switch to Top Bar / Close Drawer */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => {
              onSelectTab('curso');
              onClose?.();
            }}
            className="flex items-center gap-2 text-left group cursor-pointer focus:outline-none"
          >
            <img
              src={studyflowLogo}
              alt="StudyFlow Logo"
              className="w-7 h-7 rounded-xl object-contain shadow-2xs group-hover:scale-105 transition-transform"
            />
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              StudyFlow
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            {onToggleNavigationPosition && (
              <button
                type="button"
                onClick={() => {
                  onToggleNavigationPosition();
                  onClose?.();
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors cursor-pointer"
                title="Cambiar a menú superior"
              >
                <PanelTop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Superior</span>
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden cursor-pointer"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Active Program & Course Card */}
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
          <button
            type="button"
            onClick={() => {
              onOpenProgramManager();
              onClose?.();
            }}
            className="w-full text-left group cursor-pointer"
            title="Cambiar o activar varios cursos"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              Estudio Activo
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate block group-hover:text-blue-600">
              {programName}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
              {yearName}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenProgramManager();
              onClose?.();
            }}
            className="w-full py-1.5 px-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Gestionar Estudios</span>
          </button>
        </div>

        {/* Vertical Navigation Links */}
        <nav className="space-y-0.5">
          <div className="px-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Menú Principal
            </span>
            <button
              type="button"
              onClick={() => {
                onOpenPreferences();
                onClose?.();
              }}
              className="text-[10px] text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
              title="Personalizar pestañas"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Pestañas</span>
            </button>
          </div>

          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              activeTab === tab.id || (tab.id === 'calendario' && activeTab === 'repaso');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onSelectTab(tab.id);
                  onClose?.();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Controls: Mood Tracker, Streak, Quick Tools & User Account */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        {/* Quick Interface Design Mode Switcher in Sidebar */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            <span>Diseño de Interfaz</span>
            <button
              type="button"
              onClick={() => {
                onOpenPreferences();
                onClose?.();
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Ajustes
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {([
              { id: 'complete', label: 'Completo' },
              { id: 'intermediate', label: 'Intermedio' },
              { id: 'minimal', label: 'Minimal' },
            ] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectDesignMode(m.id)}
                className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  designMode === m.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Mood Tracker in Sidebar (hidden in minimal mode) */}
        {designMode !== 'minimal' && (
          <MoodTracker
            variant="nav-sidebar"
            preferences={preferences}
            onUpdatePreferences={onUpdatePreferences}
          />
        )}

        {/* Collapsible Achievements / Badges in Sidebar (shown in complete mode) */}
        {preferences && designMode === 'complete' && (
          <StudyAchievementsPanel
            variant="nav-sidebar"
            subjects={subjects}
            pomodoroLogs={pomodoroLogs}
            preferences={preferences}
            onOpenActiveRecall={() => {
              onSelectTab('cuestionarios');
              onClose?.();
            }}
            onOpenPomodoro={() => {
              onSelectTab('pomodoro');
              onClose?.();
            }}
          />
        )}

        {/* Streak & Cloud Sync */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => {
              setShowStreakModal(true);
              onClose?.();
            }}
            className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-bold font-mono-numbers hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            title="Cómo funciona la racha de estudio"
          >
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-600 animate-pulse" />
            <span>{streakDays} días racha</span>
          </button>

          {user && (
            <div
              className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"
              title="Sincronizado en la nube"
            >
              {isSyncingCloud ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <CloudCheck className="w-3 h-3" />
              )}
              <span>Nube</span>
            </div>
          )}
        </div>

        {/* Action Icons Bar */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/70 p-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
          <button
            onClick={async () => {
              if (!notifGranted) {
                const granted = await notificationService.requestPermission();
                setNotifGranted(granted);
                if (granted) notificationService.sendTestNotification();
              } else {
                notificationService.sendTestNotification();
              }
            }}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              notifGranted
                ? 'text-blue-600 dark:text-blue-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700'
            }`}
            title={notifGranted ? 'Notificaciones activadas' : 'Activar notificaciones'}
            aria-label="Notificaciones"
          >
            {notifGranted ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              onOpenPreferences();
              onClose?.();
            }}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            title="Preferencias"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowHelpModal(true);
              onClose?.();
            }}
            className="px-2.5 py-1.5 text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
            title="Abrir Tutorial, Guía de Ayuda y Tutorial Interactivo"
            aria-label="Ayuda"
          >
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Ayuda</span>
          </button>
        </div>

        <PWAInstallButton variant="sidebar" />

        {/* User Account / Auth Button */}
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                  {user.email ? user.email.charAt(0) : 'U'}
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user.displayName || user.email?.split('@')[0] || 'Estudiante'}
                </span>
              </div>
              <LogOut className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user.displayName || 'Estudiante'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onSignOut();
                    onClose?.();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              onOpenAuth();
              onClose?.();
            }}
            className="w-full py-2 px-3 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Acceder / Registro</span>
          </button>
        )}
      </div>
    </div>
  );

  // Render Sidebar Mode (Desktop left sidebar + mobile drawer with identical design)
  if (navigationPosition === 'sidebar') {
    return (
      <>
        {/* Desktop Vertical Left Sidebar */}
        <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 self-start bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between sticky top-0 h-screen z-40 p-4 select-none transition-colors">
          {renderSidebarInner()}
        </aside>

        {/* Mobile Header when in Sidebar Mode (with Hamburger Drawer & Direct Tabs) */}
        <header className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Hamburger Button to Open Mobile Sidebar */}
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Abrir menú lateral"
                aria-label="Abrir menú de navegación"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('curso')}
                className="flex items-center gap-2 text-left focus:outline-none cursor-pointer min-w-0"
              >
                <img
                  src={studyflowLogo}
                  alt="StudyFlow Logo"
                  className="w-7 h-7 rounded-lg object-contain shadow-2xs shrink-0"
                />
                <span className="text-base font-bold text-slate-900 dark:text-white truncate">
                  StudyFlow
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Collapsible Mood Tracker Dropdown in Mobile Sidebar Header */}
              {designMode !== 'minimal' && (
                <MoodTracker
                  variant="nav-top"
                  preferences={preferences}
                  onUpdatePreferences={onUpdatePreferences}
                />
              )}

              {/* Collapsible Achievements Dropdown in Mobile Sidebar Header */}
              {preferences && designMode === 'complete' && (
                <StudyAchievementsPanel
                  variant="nav-top"
                  subjects={subjects}
                  pomodoroLogs={pomodoroLogs}
                  preferences={preferences}
                  onOpenActiveRecall={() => onSelectTab('cuestionarios')}
                  onOpenPomodoro={() => onSelectTab('pomodoro')}
                />
              )}

              {/* Streak Counter Button */}
              <button
                type="button"
                onClick={() => setShowStreakModal(true)}
                className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-bold font-mono-numbers px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                title="Cómo funciona la racha de estudio"
              >
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-600 animate-pulse" />
                <span>{streakDays}d</span>
              </button>

              <button
                type="button"
                onClick={onToggleTheme}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                title="Cambiar tema"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg cursor-pointer"
                title="Guía y Ayuda de StudyFlow"
                aria-label="Ayuda"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onOpenProgramManager}
                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded-lg transition-all cursor-pointer whitespace-nowrap"
              >
                Estudios
              </button>
            </div>
          </div>

          {/* Mobile Direct Tabs Bar (Wraps cleanly without horizontal sliding) */}
          <div className="flex flex-wrap pt-2 gap-1 text-xs font-medium">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                activeTab === tab.id || (tab.id === 'calendario' && activeTab === 'repaso');
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`py-1 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* Mobile Slide-Out Drawer (Contains the EXACT desktop sidebar) */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden animate-fadeIn">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 p-4 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-200">
              {renderSidebarInner(() => setIsMobileDrawerOpen(false))}
            </div>
          </div>
        )}

        <StreakModal
          isOpen={showStreakModal}
          onClose={() => setShowStreakModal(false)}
          streakDays={streakDays}
          onStartStudy={() => onSelectTab('pomodoro')}
        />

        <AppHelpGuideModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
          onNavigateTab={(tabId) => onSelectTab(tabId as NavTabId)}
          onOpenPreferences={onOpenPreferences}
          onOpenProgramManager={onOpenProgramManager}
          onOpenStreakModal={() => setShowStreakModal(true)}
          onStartOnboardingTour={onStartOnboardingTour}
        />
      </>
    );
  }

  // Render Top Bar Mode (Desktop & Mobile unified design)
  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Row 1: Brand, Active Study Context & Utility Cluster + "+ Estudios" Button */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 min-h-14 py-1.5">
            {/* Zone 1: Brand logo & contextual breadcrumb */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelectTab('curso')}
                className="flex items-center gap-2 text-left group cursor-pointer focus:outline-none shrink-0"
              >
                <img
                  src={studyflowLogo}
                  alt="StudyFlow Logo"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-contain shadow-2xs group-hover:scale-105 transition-transform"
                />
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors whitespace-nowrap">
                  StudyFlow
                </span>
              </button>

              {/* Context Breadcrumb */}
              <div className="hidden xs:flex sm:flex items-center text-xs text-slate-400 dark:text-slate-500 min-w-0 overflow-hidden">
                <span className="mx-1 sm:mx-1.5 text-slate-300 dark:text-slate-700 shrink-0">/</span>
                <button
                  type="button"
                  onClick={onOpenProgramManager}
                  className="text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate cursor-pointer font-semibold max-w-[110px] sm:max-w-[180px] md:max-w-[240px]"
                  title={`${programName} · ${yearName} (Haz clic para gestionar estudios)`}
                >
                  {programName}
                </button>
                <span className="hidden lg:inline mx-1.5 text-slate-300 dark:text-slate-700 shrink-0">·</span>
                <span className="hidden lg:inline text-slate-400 dark:text-slate-500 truncate max-w-[140px]">
                  {yearName}
                </span>
              </div>
            </div>

            {/* Zone 2: Utility cluster + MoodTracker + Streak + "+ Estudios" (Always visible, shrink-0) */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Primary Action Button: + Estudios (Placed prominently so it is always visible) */}
              <button
                type="button"
                onClick={onOpenProgramManager}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-2xs shrink-0"
                title="Abrir gestor de Estudios, Cursos, Asignaturas y Objetivos SMART"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Estudios</span>
              </button>

              <PWAInstallButton variant="compact" />

              {/* Collapsible Mood Tracker Dropdown in Top Navigation Bar */}
              {designMode !== 'minimal' && (
                <MoodTracker
                  variant="nav-top"
                  preferences={preferences}
                  onUpdatePreferences={onUpdatePreferences}
                />
              )}

              {/* Collapsible Achievements / Badges Dropdown in Top Navigation Bar */}
              {preferences && designMode === 'complete' && (
                <StudyAchievementsPanel
                  variant="nav-top"
                  subjects={subjects}
                  pomodoroLogs={pomodoroLogs}
                  preferences={preferences}
                  onOpenActiveRecall={() => onSelectTab('cuestionarios')}
                  onOpenPomodoro={() => onSelectTab('pomodoro')}
                />
              )}

              {/* Streak Counter */}
              <button
                type="button"
                onClick={() => setShowStreakModal(true)}
                className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-bold font-mono-numbers hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Cómo funciona la racha de estudio"
              >
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-600 animate-pulse shrink-0" />
                <span>{streakDays}d</span>
              </button>

              {/* Utility Icons Cluster */}
              <div className="flex items-center gap-0.5">
                {onToggleNavigationPosition && (
                  <button
                    type="button"
                    onClick={onToggleNavigationPosition}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Cambiar a menú lateral izquierdo"
                    aria-label="Cambiar posición del menú a lateral"
                  >
                    <PanelLeft className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    if (!notifGranted) {
                      const granted = await notificationService.requestPermission();
                      setNotifGranted(granted);
                      if (granted) notificationService.sendTestNotification();
                    } else {
                      notificationService.sendTestNotification();
                    }
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    notifGranted
                      ? 'text-blue-600 dark:text-blue-400 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                  }`}
                  title={notifGranted ? 'Notificaciones activadas' : 'Activar notificaciones'}
                  aria-label="Notificaciones Web"
                >
                  {notifGranted ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  aria-label="Cambiar tema"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={onOpenPreferences}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer hidden sm:inline-flex"
                  title="Preferencias"
                  aria-label="Configuración"
                >
                  <Settings className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="px-2.5 py-1.5 text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-bold shrink-0"
                  title="Abrir Tutorial y Tutorial Interactivo de StudyFlow"
                  aria-label="Guía y Ayuda"
                >
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Ayuda</span>
                </button>
              </div>

              {/* User Account / Auth */}
              {user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
                    title={user.email || 'Mi Cuenta'}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase">
                      {user.email ? user.email.charAt(0) : 'U'}
                    </div>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {user.displayName || 'Estudiante'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {isSyncingCloud ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <CloudCheck className="w-3 h-3" />
                          )}
                          <span>{isSyncingCloud ? 'Sincronizando...' : 'Sincronizado en la nube'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          onSignOut();
                        }}
                        className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                  title="Iniciar sesión o registrarse"
                >
                  <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="hidden lg:inline">Cuenta</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Horizontal Navigation Tabs Bar (All tabs visible without horizontal sliding) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 py-1.5 border-t border-slate-100 dark:border-slate-800/80 text-xs font-medium">
            <nav className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive =
                  activeTab === tab.id || (tab.id === 'calendario' && activeTab === 'repaso');
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className={`py-1.5 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onOpenPreferences}
                className="py-1.5 px-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 flex items-center gap-1 text-xs font-medium cursor-pointer"
                title="Personalizar diseño de interfaz y pestañas en Ajustes"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>{designMode === 'minimal' ? 'Diseño' : 'Pestañas'}</span>
              </button>
            </nav>

            {/* Quick Interface Design Mode Switcher on Right of Tab Bar */}
            <div className="flex items-center gap-0.5 bg-slate-100/90 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              {([
                { id: 'complete', label: 'Completo' },
                { id: 'intermediate', label: 'Intermedio' },
                { id: 'minimal', label: 'Minimalista' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectDesignMode(m.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    designMode === m.id
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title={`Cambiar interfaz al modelo ${m.label} (conserva todos tus documentos y materias)`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <StreakModal
        isOpen={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        streakDays={streakDays}
        onStartStudy={() => onSelectTab('pomodoro')}
      />

      <AppHelpGuideModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onNavigateTab={(tabId) => onSelectTab(tabId as NavTabId)}
        onOpenPreferences={onOpenPreferences}
        onOpenProgramManager={onOpenProgramManager}
        onOpenStreakModal={() => setShowStreakModal(true)}
        onStartOnboardingTour={onStartOnboardingTour}
      />
    </>
  );
};
