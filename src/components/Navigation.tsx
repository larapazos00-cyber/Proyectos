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
  Brain,
  Sparkles,
  Timer,
  BarChart3,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { notificationService } from '../services/notificationService';
import studyflowLogo from '../assets/images/studyflow_logo_1793994920234.jpg';

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
}) => {
  const [notifGranted, setNotifGranted] = useState(
    () => notificationService.getPermission() === 'granted'
  );
  const [showUserMenu, setShowUserMenu] = useState(false);

  const ALL_NAV_TABS: {
    id: NavTabId;
    label: string;
    mobileLabel: string;
    icon: React.ElementType;
  }[] = [
    { id: 'curso', label: 'General', mobileLabel: 'General', icon: LayoutDashboard },
    { id: 'asignaturas', label: 'Materias', mobileLabel: 'Materias', icon: BookOpen },
    { id: 'calendario', label: 'Plan y Repasos', mobileLabel: 'Plan', icon: Calendar },
    { id: 'cuestionarios', label: 'Cuestionarios', mobileLabel: 'Tests', icon: Sparkles },
    { id: 'pomodoro', label: 'Pomodoro', mobileLabel: 'Pomodoro', icon: Timer },
    { id: 'estadisticas', label: 'Estadísticas', mobileLabel: 'Datos', icon: BarChart3 },
  ];

  const visibleTabs = ALL_NAV_TABS.filter((t) => {
    if (!enabledTabs || enabledTabs.length === 0) return true;
    if (t.id === 'calendario' && (enabledTabs.includes('calendario') || enabledTabs.includes('repaso'))) {
      return true;
    }
    return enabledTabs.includes(t.id);
  });

  // Render Sidebar Mode (Desktop left sidebar + compact mobile top bar)
  if (navigationPosition === 'sidebar') {
    return (
      <>
        {/* Desktop Vertical Left Sidebar */}
        <aside className="hidden md:flex md:w-64 lg:w-68 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between sticky top-0 h-screen z-40 p-4 select-none transition-colors">
          <div className="space-y-5 overflow-y-auto no-scrollbar">
            {/* Brand + Switch to Top Bar */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => onSelectTab('curso')}
                className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
              >
                <img
                  src={studyflowLogo}
                  alt="StudyFlow Logo"
                  className="w-8 h-8 rounded-xl object-contain shadow-2xs group-hover:scale-105 transition-transform"
                />
                <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  StudyFlow
                </span>
              </button>

              {onToggleNavigationPosition && (
                <button
                  type="button"
                  onClick={onToggleNavigationPosition}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors cursor-pointer"
                  title="Cambiar a menú superior"
                >
                  <PanelTop className="w-3.5 h-3.5" />
                  <span>Menú Superior</span>
                </button>
              )}
            </div>

            {/* Active Program & Course Card */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <button
                onClick={onOpenProgramManager}
                className="w-full text-left group cursor-pointer"
                title="Cambiar o activar varios cursos"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                  Estudio Activo
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block mt-0.5 group-hover:text-blue-600">
                  {programName}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  {yearName}
                </span>
              </button>

              <button
                onClick={onOpenProgramManager}
                className="w-full py-1.5 px-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Gestionar Estudios</span>
              </button>
            </div>

            {/* Vertical Navigation Links */}
            <nav className="space-y-1">
              <div className="px-2 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Menú Principal
                </span>
                <button
                  type="button"
                  onClick={onOpenPreferences}
                  className="text-[10px] text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
                  title="Personalizar pestañas"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Pestañas</span>
                </button>
              </div>

              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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

          {/* Bottom Controls: Streak, Quick Tools & User Account */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            {/* Streak & Cloud Sync */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-semibold font-mono-numbers">
                <span aria-hidden="true">🔥</span>
                <span>{streakDays} días racha</span>
              </div>

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
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
                title="Notificaciones Web"
              >
                {notifGranted ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </button>

              {onToggleNavigationPosition && (
                <button
                  type="button"
                  onClick={onToggleNavigationPosition}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Mover menú arriba (Barra superior)"
                >
                  <PanelTop className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onOpenPreferences}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Configuración y Disponibilidad"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* User Account */}
            {user ? (
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                    {user.email ? user.email.charAt(0) : 'U'}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full py-2 px-3 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Acceder / Registro</span>
              </button>
            )}
          </div>
        </aside>

        {/* Mobile Fallback Header when in Sidebar mode */}
        <header className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onSelectTab('curso')}
              className="flex items-center gap-2 text-left focus:outline-none cursor-pointer"
            >
              <img
                src={studyflowLogo}
                alt="StudyFlow Logo"
                className="w-7 h-7 rounded-lg object-contain shadow-2xs"
              />
              <span className="text-lg font-bold text-slate-900 dark:text-white">StudyFlow</span>
            </button>
            <div className="flex items-center gap-2">
              {onToggleNavigationPosition && (
                <button
                  onClick={onToggleNavigationPosition}
                  className="p-1.5 text-slate-500 rounded-lg"
                  title="Cambiar a menú superior"
                >
                  <PanelTop className="w-4 h-4" />
                </button>
              )}
              <button onClick={onOpenPreferences} className="p-1.5 text-slate-500 rounded-lg">
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenProgramManager}
                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-lg"
              >
                Estudios
              </button>
            </div>
          </div>
          <div className="flex overflow-x-auto pt-2 gap-4 text-xs font-medium no-scrollbar">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`whitespace-nowrap py-1 ${
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.mobileLabel}
              </button>
            ))}
          </div>
        </header>
      </>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 transition-colors">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onSelectTab('curso')}
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            >
              <img
                src={studyflowLogo}
                alt="StudyFlow Logo"
                className="w-8 h-8 rounded-xl object-contain shadow-2xs group-hover:scale-105 transition-transform"
              />
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors whitespace-nowrap">
                StudyFlow
              </span>
            </button>

            {/* Quiet context breadcrumb */}
            <div className="hidden sm:flex items-center text-xs text-slate-400 dark:text-slate-500">
              <span className="mx-2 text-slate-300 dark:text-slate-700">/</span>
              <button
                onClick={onOpenProgramManager}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap max-w-[180px] truncate cursor-pointer"
                title={`${programName} · ${yearName}`}
              >
                {programName}
              </button>
              <span className="mx-1.5 text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">{yearName}</span>
            </div>
          </div>

          {/* Zone 2: Minimalist single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`whitespace-nowrap transition-colors py-1 border-b-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-slate-900 dark:text-white font-semibold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenPreferences}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
              title="Personalizar, activar o quitar pestañas"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </nav>

          {/* Zone 3: Borderless utility icons + 1 primary action button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Streak counter */}
            <div
              className="hidden xl:flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-mono-numbers mr-1"
              title="Racha de días estudiados"
            >
              <span>🔥 {streakDays}d</span>
            </div>

            {/* Borderless compact icon cluster */}
            <div className="flex items-center gap-0.5">
              {onToggleNavigationPosition && (
                <button
                  type="button"
                  onClick={onToggleNavigationPosition}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Cambiar a menú lateral izquierdo"
                  aria-label="Cambiar posición del menú a lateral"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}

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
                    ? 'text-blue-600 dark:text-blue-400 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                }`}
                title={
                  notifGranted
                    ? 'Notificaciones activadas (Click para probar)'
                    : 'Activar notificaciones'
                }
                aria-label="Notificaciones Web"
              >
                {notifGranted ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={onOpenPreferences}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Preferencias, metas y horarios"
                aria-label="Configuración de preferencias"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* User Account / Auth Button */}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                title="Iniciar sesión o registrarse"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden lg:inline">Cuenta</span>
              </button>
            )}

            <button
              onClick={onOpenProgramManager}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg transition-all whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Estudios</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary navigation */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium no-scrollbar">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`whitespace-nowrap py-1 ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.mobileLabel}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenPreferences}
            className="whitespace-nowrap py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Pestañas...
          </button>
        </div>
      </div>
    </header>
  );
};
