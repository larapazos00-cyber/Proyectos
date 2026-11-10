import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Flame,
  Bell,
  BellOff,
  BellRing,
  Sliders,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Headphones,
  Volume2,
  VolumeX,
  Waves,
  Zap,
  CloudRain,
  Wind,
  Droplets,
  Shield,
  EyeOff,
  Maximize2,
  Minimize2,
  BookOpen,
  Coffee,
  Target,
  CheckCircle2,
  Clock,
  ListChecks,
} from 'lucide-react';
import { Subject, PomodoroLog, StudyPreferences } from '../types';
import { notificationService } from '../services/notificationService';
import {
  ambientAudioService,
  AMBIENT_SOUND_OPTIONS,
  AMBIENT_PRESET_MIXES,
  AmbientSoundType,
  AmbientLayerKey,
  AmbientPresetMix,
} from '../services/ambientAudioService';

interface PomodoroTimerProps {
  subjects: Subject[];
  activeSubjectId?: string;
  activeTopicId?: string;
  onSessionComplete: (log: PomodoroLog) => void;
  pomodoroConfig: StudyPreferences['pomodoroConfig'];
  onUpdatePomodoroConfig?: (newConfig: StudyPreferences['pomodoroConfig']) => void;
  onFocusModeChange?: (isActive: boolean) => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  subjects,
  activeSubjectId: defaultSubId,
  activeTopicId: defaultTopId,
  onSessionComplete,
  pomodoroConfig,
  onUpdatePomodoroConfig,
  onFocusModeChange,
}) => {
  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    defaultSubId || (subjects.length > 0 ? subjects[0].id : '')
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string>(defaultTopId || '');
  const [cycleCount, setCycleCount] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);
  const [showAdvancedAcoustic, setShowAdvancedAcoustic] = useState<boolean>(false);
  const [showSessionEndAlertsConfig, setShowSessionEndAlertsConfig] = useState<boolean>(false);
  const [sessionEndChimeEnabled, setSessionEndChimeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('studyflow_pomodoro_chime_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [sessionEndChimeVolume, setSessionEndChimeVolume] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('studyflow_pomodoro_chime_volume');
      return saved !== null ? Number(saved) : 0.85;
    } catch {
      return 0.85;
    }
  });
  const [sessionEndChimeType, setSessionEndChimeType] = useState<
    'campana_zen' | 'acorde_cristal' | 'doble_pulso'
  >(() => {
    try {
      const saved = localStorage.getItem('studyflow_pomodoro_chime_type');
      if (saved === 'campana_zen' || saved === 'acorde_cristal' || saved === 'doble_pulso') {
        return saved;
      }
      return 'campana_zen';
    } catch {
      return 'campana_zen';
    }
  });
  const [sessionEndVisualBannerEnabled, setSessionEndVisualBannerEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('studyflow_pomodoro_visual_alert');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [sessionEndBrowserNotifEnabled, setSessionEndBrowserNotifEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('studyflow_pomodoro_browser_notif');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [browserPermissionStatus, setBrowserPermissionStatus] = useState<NotificationPermission>(
    () => notificationService.getPermission()
  );
  const [sessionAlertBanner, setSessionAlertBanner] = useState<{
    title: string;
    subtitle: string;
    isTest?: boolean;
  } | null>(null);

  // Metas de Temas de la Sesión: configurar metas antes de iniciar y marcar automáticamente como estudiado al completar
  const [showTopicGoalsPanel, setShowTopicGoalsPanel] = useState<boolean>(true);
  const [autoMarkTopicStudied, setAutoMarkTopicStudied] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('studyflow_pomodoro_auto_mark_topic');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [topicGoalCustomMinutes, setTopicGoalCustomMinutes] = useState<number | null>(null);
  const [queuedGoalTopicIds, setQueuedGoalTopicIds] = useState<string[]>([]);
  const [completedGoalTopicIds, setCompletedGoalTopicIds] = useState<string[]>([]);

  // Modo Enfoque: oculta menú de navegación y silencia notificaciones del sistema mientras el temporizador corre
  const [isFocusModeEnabled, setIsFocusModeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('studyflow_pomodoro_focus_mode');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const isDistractionFreeActive = isFocusModeEnabled && isRunning;

  // Local editable draft values for quick adjustments
  const [customFocus, setCustomFocus] = useState<number>(pomodoroConfig.focusMinutes || 52);
  const [customBreak, setCustomBreak] = useState<number>(pomodoroConfig.shortBreakMinutes || 17);
  const [customLongBreak, setCustomLongBreak] = useState<number>(
    pomodoroConfig.longBreakMinutes || 25
  );

  // Ambient Audio & Multi-Layer Mixer State (persisted in localStorage)
  const savedAudioPrefs = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('studyflow_ambient_audio_prefs_v2');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>(
    savedAudioPrefs?.ambientSound || 'none'
  );
  const [ambientVolume, setAmbientVolume] = useState<number>(
    typeof savedAudioPrefs?.ambientVolume === 'number' ? savedAudioPrefs.ambientVolume : 0.55
  );
  const [ambientWarmth, setAmbientWarmth] = useState<number>(
    typeof savedAudioPrefs?.ambientWarmth === 'number' ? savedAudioPrefs.ambientWarmth : 0.75
  );
  const [ambientBassBoost, setAmbientBassBoost] = useState<number>(
    typeof savedAudioPrefs?.ambientBassBoost === 'number' ? savedAudioPrefs.ambientBassBoost : 0.45
  );
  const [layerVolumes, setLayerVolumes] = useState<Record<AmbientLayerKey, number>>(
    savedAudioPrefs?.layerVolumes || {
      rain: 0,
      forest: 0,
      fire: 0,
      binaural: 0,
    }
  );
  const [activePresetMixId, setActivePresetMixId] = useState<string | null>(
    savedAudioPrefs?.activePresetMixId || null
  );
  const [ambientCategoryFilter, setAmbientCategoryFilter] = useState<
    'all' | 'nature' | 'binaural' | 'noise'
  >('all');
  const [isAmbientPlaying, setIsAmbientPlaying] = useState<boolean>(false);
  const [autoPlayAmbientWithTimer, setAutoPlayAmbientWithTimer] = useState<boolean>(
    typeof savedAudioPrefs?.autoPlayAmbientWithTimer === 'boolean'
      ? savedAudioPrefs.autoPlayAmbientWithTimer
      : true
  );
  const [wasAmbientActiveBeforeBreak, setWasAmbientActiveBeforeBreak] = useState<boolean>(false);

  // Persistir configuración acústica en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'studyflow_ambient_audio_prefs_v2',
        JSON.stringify({
          ambientSound,
          ambientVolume,
          ambientWarmth,
          ambientBassBoost,
          layerVolumes,
          activePresetMixId,
          autoPlayAmbientWithTimer,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [
    ambientSound,
    ambientVolume,
    ambientWarmth,
    ambientBassBoost,
    layerVolumes,
    activePresetMixId,
    autoPlayAmbientWithTimer,
  ]);

  // Persistir preferencia de Modo Enfoque y Avisos de fin de sesión
  useEffect(() => {
    try {
      localStorage.setItem('studyflow_pomodoro_focus_mode', JSON.stringify(isFocusModeEnabled));
      localStorage.setItem('studyflow_pomodoro_chime_enabled', JSON.stringify(sessionEndChimeEnabled));
      localStorage.setItem('studyflow_pomodoro_chime_volume', String(sessionEndChimeVolume));
      localStorage.setItem('studyflow_pomodoro_chime_type', sessionEndChimeType);
      localStorage.setItem('studyflow_pomodoro_visual_alert', JSON.stringify(sessionEndVisualBannerEnabled));
      localStorage.setItem('studyflow_pomodoro_browser_notif', JSON.stringify(sessionEndBrowserNotifEnabled));
      localStorage.setItem('studyflow_pomodoro_auto_mark_topic', JSON.stringify(autoMarkTopicStudied));
    } catch {
      // ignore storage errors
    }
  }, [
    isFocusModeEnabled,
    sessionEndChimeEnabled,
    sessionEndChimeVolume,
    sessionEndChimeType,
    sessionEndVisualBannerEnabled,
    sessionEndBrowserNotifEnabled,
    autoMarkTopicStudied,
  ]);

  // Sincronizar estado de Modo Enfoque con App y notificaciones
  useEffect(() => {
    notificationService.setFocusModeSilenced(isDistractionFreeActive);
    onFocusModeChange?.(isDistractionFreeActive);

    if (isDistractionFreeActive) {
      setIsCustomizing(false);
    }
  }, [isDistractionFreeActive, onFocusModeChange]);

  useEffect(() => {
    return () => {
      notificationService.setFocusModeSilenced(false);
      onFocusModeChange?.(false);
    };
  }, [onFocusModeChange]);

  useEffect(() => {
    if (!isDistractionFreeActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFocusModeEnabled(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDistractionFreeActive]);

  useEffect(() => {
    setCustomFocus(pomodoroConfig.focusMinutes);
    setCustomBreak(pomodoroConfig.shortBreakMinutes);
    setCustomLongBreak(pomodoroConfig.longBreakMinutes);
  }, [pomodoroConfig]);

  const effectiveFocusMinutes = topicGoalCustomMinutes ?? pomodoroConfig.focusMinutes;

  const getDurationSeconds = (currentMode: 'focus' | 'shortBreak' | 'longBreak') => {
    if (currentMode === 'focus') return effectiveFocusMinutes * 60;
    if (currentMode === 'shortBreak') return pomodoroConfig.shortBreakMinutes * 60;
    return pomodoroConfig.longBreakMinutes * 60;
  };

  const [timeLeft, setTimeLeft] = useState<number>(getDurationSeconds('focus'));
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const playChime = (
    overrideType?: 'campana_zen' | 'acorde_cristal' | 'doble_pulso',
    forcePlay: boolean = false,
    overrideVol?: number
  ) => {
    if (!sessionEndChimeEnabled && !forcePlay) return;
    const tone = overrideType || sessionEndChimeType;
    const volScale = Math.max(0.05, Math.min(1, overrideVol ?? sessionEndChimeVolume));
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;

      if (tone === 'campana_zen') {
        // Campana tibetana armónica (fundamental + armónico de quinta)
        const freqs = [528, 792, 1056];
        freqs.forEach((f, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          const baseAmp = idx === 0 ? 0.32 : idx === 1 ? 0.14 : 0.07;
          const amp = baseAmp * volScale;
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(amp, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.2 - idx * 0.3);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 2.3);
        });
      } else if (tone === 'acorde_cristal') {
        // Arpegio ascendente cristalino (Do5 - Mi5 - Sol5 - Si5)
        const notes = [523.25, 659.25, 783.99, 987.77];
        notes.forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const start = now + idx * 0.11;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(0.25 * volScale, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(start);
          osc.stop(start + 1.15);
        });
      } else {
        // Doble pulso suave de finalización
        [0, 0.24].forEach((offset, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const start = now + offset;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(idx === 0 ? 587.33 : 880, start);
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(0.3 * volScale, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(start);
          osc.stop(start + 0.38);
        });
      }
    } catch (e) {
      console.warn('Audio chime unavailable', e);
    }
  };

  const triggerTestSessionAlert = async (
    customTone?: 'campana_zen' | 'acorde_cristal' | 'doble_pulso'
  ) => {
    if (sessionEndChimeEnabled || customTone) {
      playChime(customTone, true);
    }

    let browserNotifSent = false;
    try {
      if (sessionEndBrowserNotifEnabled && notificationService.isSupported()) {
        const currentPerm = notificationService.getPermission();
        setBrowserPermissionStatus(currentPerm);
        if (currentPerm !== 'granted') {
          const granted = await notificationService.requestPermission();
          setBrowserPermissionStatus(notificationService.getPermission());
          if (granted) {
            browserNotifSent = notificationService.sendTestNotificationByType('pomodoro', {
              skipServiceChime: true,
            });
          }
        } else {
          browserNotifSent = notificationService.sendTestNotificationByType('pomodoro', {
            skipServiceChime: true,
          });
        }
      }
    } catch {
      // Fallback visual y sonoro interno activo
    }

    if (sessionEndVisualBannerEnabled || !sessionEndChimeEnabled) {
      const activeChannels: string[] = [];
      if (sessionEndChimeEnabled || customTone) activeChannels.push('alerta sonora');
      if (sessionEndVisualBannerEnabled) activeChannels.push('alerta visual en pantalla');
      if (browserNotifSent) activeChannels.push('notificación del navegador');

      setSessionAlertBanner({
        title: '🔔 Aviso de fin de sesión comprobado',
        subtitle:
          activeChannels.length > 0
            ? `Canales activos al terminar el temporizador: ${activeChannels.join(' + ')}.`
            : 'Has silenciado los avisos. Activa el sonido o la alerta visual en el panel inferior.',
        isTest: true,
      });
    }
  };

  const handleSessionEndAlertsButtonClick = async () => {
    const nextOpen = !showSessionEndAlertsConfig;
    setShowSessionEndAlertsConfig(nextOpen);
    if (nextOpen) {
      await triggerTestSessionAlert();
    }
  };

  useEffect(() => {
    setTimeLeft(getDurationSeconds(mode));
    setIsRunning(false);
  }, [mode, pomodoroConfig, topicGoalCustomMinutes]);

  useEffect(() => {
    if (defaultSubId) setSelectedSubjectId(defaultSubId);
    if (defaultTopId) setSelectedTopicId(defaultTopId);
  }, [defaultSubId, defaultTopId]);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedTopic = selectedSubject?.topics.find((t) => t.id === selectedTopicId);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  useEffect(() => {
    return () => {
      ambientAudioService.stop();
    };
  }, []);

  const hasActiveAmbientConfig =
    ambientSound !== 'none' || Object.values(layerVolumes).some((v) => v > 0.01);

  const syncEngineParameters = () => {
    ambientAudioService.setVolume(ambientVolume);
    ambientAudioService.setWarmth(ambientWarmth);
    ambientAudioService.setBassBoost(ambientBassBoost);
    (Object.keys(layerVolumes) as AmbientLayerKey[]).forEach((k) => {
      ambientAudioService.setLayerVolume(k, layerVolumes[k]);
    });
  };

  // Auto-pause ambient sound on breaks and resume on focus
  useEffect(() => {
    if (mode !== 'focus') {
      if (isAmbientPlaying) {
        setWasAmbientActiveBeforeBreak(true);
      }
      ambientAudioService.stop(350);
      setIsAmbientPlaying(false);
      return;
    }

    if (hasActiveAmbientConfig) {
      if (isRunning && (autoPlayAmbientWithTimer || wasAmbientActiveBeforeBreak)) {
        syncEngineParameters();
        ambientAudioService.play(ambientSound);
        setIsAmbientPlaying(true);
        setWasAmbientActiveBeforeBreak(false);
      } else if (!isRunning && autoPlayAmbientWithTimer) {
        ambientAudioService.stop(250);
        setIsAmbientPlaying(false);
      }
    }
  }, [
    isRunning,
    mode,
    ambientSound,
    autoPlayAmbientWithTimer,
    hasActiveAmbientConfig,
  ]);

  const handleToggleAmbientSound = (sound: AmbientSoundType) => {
    setActivePresetMixId(null);
    if (ambientSound === sound && isAmbientPlaying) {
      ambientAudioService.stop(220);
      setIsAmbientPlaying(false);
      setWasAmbientActiveBeforeBreak(false);
      setAmbientSound('none');
    } else if (sound === 'none') {
      const zeroLayers: Record<AmbientLayerKey, number> = {
        rain: 0,
        forest: 0,
        fire: 0,
        binaural: 0,
      };
      setLayerVolumes(zeroLayers);
      (Object.keys(zeroLayers) as AmbientLayerKey[]).forEach((k) =>
        ambientAudioService.setLayerVolume(k, 0)
      );
      ambientAudioService.stop(220);
      setIsAmbientPlaying(false);
      setWasAmbientActiveBeforeBreak(false);
      setAmbientSound('none');
    } else {
      setAmbientSound(sound);
      if (mode !== 'focus') {
        ambientAudioService.stop(200);
        setIsAmbientPlaying(false);
        setWasAmbientActiveBeforeBreak(true);
      } else {
        syncEngineParameters();
        ambientAudioService.play(sound);
        setIsAmbientPlaying(true);
      }
    }
  };

  const handleApplyPresetMix = (preset: AmbientPresetMix) => {
    if (activePresetMixId === preset.id && isAmbientPlaying) {
      handleToggleAmbientSound('none');
      return;
    }
    setActivePresetMixId(preset.id);
    setAmbientSound(preset.primarySound);
    setAmbientWarmth(preset.warmth);
    setAmbientBassBoost(preset.bassBoost);
    setLayerVolumes({ ...preset.layers });

    ambientAudioService.setVolume(ambientVolume);
    ambientAudioService.setWarmth(preset.warmth);
    ambientAudioService.setBassBoost(preset.bassBoost);
    (Object.keys(preset.layers) as AmbientLayerKey[]).forEach((k) => {
      ambientAudioService.setLayerVolume(k, preset.layers[k]);
    });

    if (mode !== 'focus') {
      ambientAudioService.stop(200);
      setIsAmbientPlaying(false);
      setWasAmbientActiveBeforeBreak(true);
    } else {
      ambientAudioService.play(preset.primarySound);
      setIsAmbientPlaying(true);
    }
  };

  const handleLayerVolumeChange = (layer: AmbientLayerKey, val: number) => {
    setActivePresetMixId(null);
    const nextLayers = { ...layerVolumes, [layer]: val };
    setLayerVolumes(nextLayers);
    ambientAudioService.setLayerVolume(layer, val);

    if (mode === 'focus' && val > 0.01 && !isAmbientPlaying) {
      ambientAudioService.setVolume(ambientVolume);
      ambientAudioService.setWarmth(ambientWarmth);
      ambientAudioService.setBassBoost(ambientBassBoost);
      ambientAudioService.play(ambientSound);
      setIsAmbientPlaying(true);
    } else if (
      ambientSound === 'none' &&
      Object.values(nextLayers).every((v) => v <= 0.01) &&
      isAmbientPlaying
    ) {
      ambientAudioService.stop(200);
      setIsAmbientPlaying(false);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setAmbientVolume(newVol);
    ambientAudioService.setVolume(newVol);
  };

  const handleWarmthChange = (newWarmth: number) => {
    setAmbientWarmth(newWarmth);
    ambientAudioService.setWarmth(newWarmth);
  };

  const handleBassBoostChange = (newBass: number) => {
    setAmbientBassBoost(newBass);
    ambientAudioService.setBassBoost(newBass);
  };

  const handleComplete = () => {
    if (sessionEndChimeEnabled) {
      playChime();
    }
    setIsRunning(false);
    notificationService.setFocusModeSilenced(false);

    if (sessionEndBrowserNotifEnabled) {
      notificationService.notifyPomodoro(mode, selectedTopic?.title, {
        skipServiceChime: true,
      });
    }

    const completedMinutes = effectiveFocusMinutes;
    const willAutoMarkTopic = Boolean(
      mode === 'focus' && autoMarkTopicStudied && selectedSubject && selectedTopic
    );

    if (sessionEndVisualBannerEnabled) {
      if (mode === 'focus') {
        if (willAutoMarkTopic && selectedTopic && selectedSubject) {
          setSessionAlertBanner({
            title: '🎯 ¡Meta de tema completada y marcada como Estudiado!',
            subtitle: `Has completado los ${completedMinutes} min asignados. «${selectedTopic.title}» (${selectedSubject.name}) se ha marcado automáticamente como ESTUDIADO.`,
          });
        } else {
          setSessionAlertBanner({
            title: '🎉 ¡Sesión de enfoque completada!',
            subtitle: selectedSubject
              ? `Has registrado ${completedMinutes} min en ${selectedSubject.name}${
                  selectedTopic ? ` · ${selectedTopic.title}` : ''
                }. ¡Tómate un respiro!`
              : `Has completado ${completedMinutes} min de concentración profunda.`,
          });
        }
      } else {
        setSessionAlertBanner({
          title: '⚡ ¡Descanso terminado! Hora de volver al estudio',
          subtitle: 'Tu mente está despejada para el siguiente bloque de enfoque.',
        });
      }
    }

    if (mode === 'focus') {
      const newCycles = cycleCount + 1;
      setCycleCount(newCycles);

      if (selectedSubject) {
        onSessionComplete({
          id: `pom-${Date.now()}`,
          subjectId: selectedSubject.id,
          subjectName: selectedSubject.name,
          topicId: selectedTopic?.id,
          topicTitle: selectedTopic?.title || 'Estudio general',
          durationMinutes: completedMinutes,
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString(),
          autoMarkTopicStudied: willAutoMarkTopic,
        });
      }

      if (willAutoMarkTopic && selectedTopic) {
        const nextCompletedIds = Array.from(
          new Set([...completedGoalTopicIds, selectedTopic.id])
        );
        setCompletedGoalTopicIds(nextCompletedIds);

        // Si hay más temas configurados en la cola de metas de la sesión, avanzar al siguiente pendiente
        const nextGoalId = queuedGoalTopicIds.find(
          (id) => id !== selectedTopic.id && !nextCompletedIds.includes(id)
        );
        if (nextGoalId) {
          setSelectedTopicId(nextGoalId);
        }
      }

      if (newCycles % pomodoroConfig.longBreakInterval === 0) {
        setMode('longBreak');
        setTimeLeft(getDurationSeconds('longBreak'));
      } else {
        setMode('shortBreak');
        setTimeLeft(getDurationSeconds('shortBreak'));
      }
    } else {
      setMode('focus');
      setTimeLeft(getDurationSeconds('focus'));
    }
  };

  useEffect(() => {
    if (isRunning && timeLeft === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      handleComplete();
    }
  }, [timeLeft, isRunning]);

  const handleToggle = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(getDurationSeconds(mode));
  };

  const handleSkip = () => {
    setIsRunning(false);
    if (mode === 'focus') {
      setMode('shortBreak');
    } else {
      setMode('focus');
    }
  };

  const applyPreset = (focus: number, shortBreak: number, longBreak: number = 25) => {
    const updated = {
      ...pomodoroConfig,
      focusMinutes: focus,
      shortBreakMinutes: shortBreak,
      longBreakMinutes: longBreak,
    };
    onUpdatePomodoroConfig?.(updated);
    if (!isRunning) {
      if (mode === 'focus') setTimeLeft(focus * 60);
      else if (mode === 'shortBreak') setTimeLeft(shortBreak * 60);
      else setTimeLeft(longBreak * 60);
    }
  };

  const handleSaveCustom = (focus: number, shortBreak: number, longBreak: number) => {
    const validFocus = Math.max(1, Math.min(180, focus));
    const validBreak = Math.max(1, Math.min(60, shortBreak));
    const validLongBreak = Math.max(1, Math.min(90, longBreak));

    const updated = {
      ...pomodoroConfig,
      focusMinutes: validFocus,
      shortBreakMinutes: validBreak,
      longBreakMinutes: validLongBreak,
    };
    onUpdatePomodoroConfig?.(updated);
    if (!isRunning) {
      if (mode === 'focus') setTimeLeft(validFocus * 60);
      else if (mode === 'shortBreak') setTimeLeft(validBreak * 60);
      else setTimeLeft(validLongBreak * 60);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalDuration = getDurationSeconds(mode);
  const progressPercent =
    totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;

  const longBreakInterval = Math.max(2, pomodoroConfig.longBreakInterval || 4);
  const completedInSet = cycleCount % longBreakInterval;

  // Helper icon & visual theme per sound option
  const getSoundVisualMeta = (id: AmbientSoundType) => {
    switch (id) {
      case 'soft_rain':
        return {
          icon: <Droplets className="w-4 h-4 text-cyan-500" />,
          shortTag: 'Gotas 3D',
          activeRing: 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-950 dark:text-cyan-100',
        };
      case 'thunderstorm':
        return {
          icon: <CloudRain className="w-4 h-4 text-indigo-500" />,
          shortTag: 'Trueno lejano',
          activeRing: 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100',
        };
      case 'forest_wind':
        return {
          icon: <Wind className="w-4 h-4 text-emerald-500" />,
          shortTag: 'Brisa y aves',
          activeRing: 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100',
        };
      case 'white_noise':
        return {
          icon: <Waves className="w-4 h-4 text-blue-500" />,
          shortTag: 'Aislamiento',
          activeRing: 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100',
        };
      case 'brown_noise':
        return {
          icon: <Waves className="w-4 h-4 text-amber-600" />,
          shortTag: 'Grave cálido',
          activeRing: 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100',
        };
      case 'pink_noise':
        return {
          icon: <Wind className="w-4 h-4 text-rose-500" />,
          shortTag: 'Equilibrado',
          activeRing: 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100',
        };
      case 'fireplace':
        return {
          icon: <Flame className="w-4 h-4 text-orange-500" />,
          shortTag: 'Fuego cálido',
          activeRing: 'border-orange-500 bg-orange-50/80 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100',
        };
      case 'ocean_waves':
        return {
          icon: <Waves className="w-4 h-4 text-teal-500" />,
          shortTag: 'Marea rítmica',
          activeRing: 'border-teal-500 bg-teal-50/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100',
        };
      case 'lofi_study':
        return {
          icon: <Sparkles className="w-4 h-4 text-fuchsia-500" />,
          shortTag: 'Acordes Rhodes',
          activeRing: 'border-fuchsia-500 bg-fuchsia-50/80 dark:bg-fuchsia-950/40 text-fuchsia-950 dark:text-fuchsia-100',
        };
      case 'alpha_waves':
        return {
          icon: <Waves className="w-4 h-4 text-purple-500" />,
          shortTag: 'Enfoque 10Hz',
          activeRing: 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100',
        };
      case 'theta_waves':
        return {
          icon: <Sparkles className="w-4 h-4 text-violet-500" />,
          shortTag: 'Memoria 6Hz',
          activeRing: 'border-violet-500 bg-violet-50/80 dark:bg-violet-950/40 text-violet-950 dark:text-violet-100',
        };
      case 'beta_waves':
        return {
          icon: <Zap className="w-4 h-4 text-amber-500" />,
          shortTag: 'Cálculo 14Hz',
          activeRing: 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100',
        };
      case 'library_cafe':
        return {
          icon: <Coffee className="w-4 h-4 text-amber-700" />,
          shortTag: 'Sala lectura',
          activeRing: 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100',
        };
      case 'night_crickets':
        return {
          icon: <Wind className="w-4 h-4 text-indigo-400" />,
          shortTag: 'Noche serena',
          activeRing: 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100',
        };
      case 'zen_chime':
        return {
          icon: <Bell className="w-4 h-4 text-indigo-500" />,
          shortTag: 'Armónicos',
          activeRing: 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100',
        };
      default:
        return {
          icon: <VolumeX className="w-4 h-4 text-slate-400" />,
          shortTag: 'Sin audio',
          activeRing: 'border-slate-400 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
        };
    }
  };

  // Generate 48 subtle dial ticks for the SVG clock face
  const dialTicks = Array.from({ length: 48 }, (_, i) => {
    const angle = (i * 360) / 48;
    const isMajor = i % 4 === 0;
    const isLit = (i / 48) * 100 <= progressPercent;
    return { angle, isMajor, isLit };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Banner de Modo Enfoque Activo mientras el temporizador está corriendo */}
      {isDistractionFreeActive && (
        <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-4 border border-indigo-500/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-300 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                  Modo Enfoque Inmersivo Activo
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                  <EyeOff className="w-3 h-3 text-indigo-400" />
                  Sin distracciones
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                  <BellOff className="w-3 h-3 text-amber-400" />
                  Alertas silenciadas
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFocusModeEnabled(false)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <Minimize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Salir Modo Enfoque (Esc)</span>
          </button>
        </div>
      )}

      {/* MAIN 2-COLUMN VISUAL STUDIO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* ================================================================== */}
        {/* COLUMNA IZQUIERDA (7 COLS): RELOJ VISUAL INMERSIVO Y CONTROLES */}
        {/* ================================================================== */}
        <div
          className={`lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border p-6 sm:p-8 relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${
            isDistractionFreeActive
              ? 'border-indigo-400/60 dark:border-indigo-500/50 ring-4 ring-indigo-500/10 shadow-xl'
              : 'border-slate-200 dark:border-slate-800 shadow-sm'
          }`}
        >
          {/* Ambient Background Glow that reacts to mode */}
          <div
            className={`absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
              mode === 'focus'
                ? 'bg-blue-500/10 dark:bg-blue-500/15'
                : mode === 'shortBreak'
                ? 'bg-emerald-500/12 dark:bg-emerald-500/15'
                : 'bg-purple-500/12 dark:bg-purple-500/15'
            }`}
          />
          <div
            className={`absolute -bottom-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
              isAmbientPlaying && mode === 'focus'
                ? 'bg-indigo-500/15 dark:bg-purple-500/20'
                : 'bg-slate-400/5'
            }`}
          />

          {/* Top Bar: Mode Pills + Focus Shield & Customizer */}
          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Visual Phase Switcher */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMode('focus')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    mode === 'focus'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Enfoque ({pomodoroConfig.focusMinutes}m)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('shortBreak')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    mode === 'shortBreak'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Descanso ({pomodoroConfig.shortBreakMinutes}m)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('longBreak')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    mode === 'longBreak'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Pausa Larga ({pomodoroConfig.longBreakMinutes}m)
                </button>
              </div>

              {/* Focus Mode & Rhythm Settings */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsFocusModeEnabled((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    isFocusModeEnabled
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Ocultar menú y silenciar alertas automáticamente al iniciar sesión"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Enfoque {isFocusModeEnabled ? 'ON' : 'OFF'}</span>
                </button>

                {!isDistractionFreeActive && (
                  <button
                    type="button"
                    onClick={() => setIsCustomizing(!isCustomizing)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isCustomizing
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                    title="Personalizar minutos de enfoque y descanso"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Rhythm Preset Strip (Always accessible or expanded) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Ritmo:
                </span>
                {[
                  { f: 52, b: 17, l: 25, tag: '52/17m', desc: 'Estudio Profundo' },
                  { f: 25, b: 5, l: 15, tag: '25/5m', desc: 'Clásico' },
                  { f: 45, b: 15, l: 20, tag: '45/15m', desc: 'Académico' },
                  { f: 90, b: 20, l: 30, tag: '90/20m', desc: 'Ultradiano' },
                ].map((preset) => {
                  const isActivePreset =
                    pomodoroConfig.focusMinutes === preset.f &&
                    pomodoroConfig.shortBreakMinutes === preset.b;
                  return (
                    <button
                      key={preset.tag}
                      type="button"
                      onClick={() => applyPreset(preset.f, preset.b, preset.l)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono-numbers font-bold border transition-all cursor-pointer ${
                        isActivePreset
                          ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                      title={preset.desc}
                    >
                      {preset.tag}
                    </button>
                  );
                })}
              </div>

              {/* Cycle Progress Pills */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  Ciclos:
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: longBreakInterval }, (_, idx) => (
                    <span
                      key={idx}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        idx < completedInSet
                          ? 'bg-blue-600 scale-110'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-mono-numbers font-bold text-slate-800 dark:text-slate-200 ml-0.5">
                  {cycleCount}
                </span>
              </div>
            </div>

            {/* Collapsible Custom Minutes Drawer */}
            {isCustomizing && !isDistractionFreeActive && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl grid grid-cols-3 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Enfoque (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={customFocus}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setCustomFocus(val);
                      handleSaveCustom(val, customBreak, customLongBreak);
                    }}
                    className="w-full text-center text-xs py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono-numbers font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Descanso (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customBreak}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setCustomBreak(val);
                      handleSaveCustom(customFocus, val, customLongBreak);
                    }}
                    className="w-full text-center text-xs py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono-numbers font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Pausa Larga (min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="90"
                    value={customLongBreak}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 5;
                      setCustomLongBreak(val);
                      handleSaveCustom(customFocus, customBreak, val);
                    }}
                    className="w-full text-center text-xs py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono-numbers font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CENTERPIECE: HIGH-CRAFT SVG CIRCULAR DIAL WITH 48 TICKS */}
          <div className="relative z-10 flex flex-col items-center justify-center my-4">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="focusArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                  <linearGradient id="breakArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>

                {/* Outer 48 Watch-Face Tick Marks */}
                <g transform="translate(60, 60)">
                  {dialTicks.map((t, idx) => (
                    <line
                      key={idx}
                      x1="0"
                      y1={t.isMajor ? '-54' : '-53'}
                      x2="0"
                      y2="-50"
                      transform={`rotate(${t.angle})`}
                      strokeWidth={t.isMajor ? '1.3' : '0.8'}
                      strokeLinecap="round"
                      className={
                        t.isLit
                          ? mode === 'focus'
                            ? 'stroke-blue-500'
                            : 'stroke-emerald-500'
                          : 'stroke-slate-200 dark:stroke-slate-800'
                      }
                    />
                  ))}
                </g>

                {/* Inner Track Circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  className="stroke-slate-100 dark:stroke-slate-800/90"
                  strokeWidth="6"
                  fill="transparent"
                />

                {/* Animated Progress Arc */}
                <circle
                  cx="60"
                  cy="60"
                  r="44"
                  transform="rotate(-90 60 60)"
                  stroke={mode === 'focus' ? 'url(#focusArcGrad)' : 'url(#breakArcGrad)'}
                  strokeWidth="6"
                  strokeDasharray={276.46}
                  strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-500 ease-out"
                />
              </svg>

              {/* Dial Interior Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                {/* Active Subject Badge inside Top of Dial */}
                {selectedSubject && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 max-w-[190px] mb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: selectedSubject.color || '#3b82f6' }}
                    />
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">
                      {selectedSubject.name}
                    </span>
                  </div>
                )}

                {/* Crisp Tabular Countdown */}
                <span className="text-5xl sm:text-6xl font-extrabold font-mono-numbers text-slate-900 dark:text-white tracking-tight leading-none my-1">
                  {formattedTime}
                </span>

                {/* Phase Status & Live Audio Wave Indicator */}
                <div className="flex flex-col items-center gap-1.5 mt-1">
                  <span
                    className={`text-[11px] font-extrabold uppercase tracking-widest ${
                      mode === 'focus'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {mode === 'focus'
                      ? isRunning
                        ? 'Enfoque en Curso'
                        : 'Listo para Enfoque'
                      : mode === 'shortBreak'
                      ? 'Descanso Regenerativo'
                      : 'Pausa Larga'}
                  </span>

                  {isAmbientPlaying && mode === 'focus' && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      <span className="flex items-end gap-0.5 h-2.5">
                        <span className="w-0.5 h-1.5 bg-indigo-500 animate-pulse" />
                        <span className="w-0.5 h-2.5 bg-indigo-600 animate-bounce" />
                        <span className="w-0.5 h-2 bg-purple-500 animate-pulse" />
                        <span className="w-0.5 h-2.5 bg-indigo-500 animate-bounce" />
                      </span>
                      <span>Audio 3D Activo</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Transport Controls */}
            <div className="flex items-center justify-center gap-4 mt-2">
              <button
                type="button"
                onClick={handleReset}
                className="p-3.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-colors cursor-pointer"
                title="Reiniciar reloj"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleToggle}
                className={`px-9 py-4 rounded-2xl font-extrabold text-sm text-white shadow-md flex items-center gap-2.5 transition-all cursor-pointer ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : mode === 'focus'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5" />
                    <span>Pausar Sesión</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>Iniciar Enfoque</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="p-3.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-colors cursor-pointer"
                title="Saltar a la siguiente fase"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bottom Bar: Visual Subject & Topic Selector Cards */}
          <div className="relative z-10 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3 h-3 text-blue-500" />
                  <span>Asignatura Objetivo</span>
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedTopicId('');
                  }}
                  className="w-full text-xs font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id} className="bg-white dark:bg-slate-900">
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-indigo-500" />
                  <span>Tema en Estudio</span>
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  disabled={!selectedSubject || selectedSubject.topics.length === 0}
                  className="w-full text-xs font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="" className="bg-white dark:bg-slate-900">
                    Todo el temario / Estudio general
                  </option>
                  {selectedSubject?.topics.map((t) => (
                    <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900">
                      {t.title} {t.status === 'estudiado' || t.status === 'repasado' ? '✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Configurar Metas de Temas antes de iniciar la sesión */}
            <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/25 overflow-hidden transition-all">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowTopicGoalsPanel(!showTopicGoalsPanel)}
                  className="flex items-center gap-2 text-left cursor-pointer group"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                    <ListChecks className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        Metas de Temas de la Sesión
                      </span>
                      {autoMarkTopicStudied && selectedTopic && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                          Auto-Estudiado Activo ({effectiveFocusMinutes}m)
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Configura tus metas antes de iniciar para marcar el tema como estudiado al terminar el contador
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTopicGoalsPanel(!showTopicGoalsPanel)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer"
                  title={showTopicGoalsPanel ? 'Ocultar configuración de metas' : 'Configurar metas de temas'}
                >
                  {showTopicGoalsPanel ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {showTopicGoalsPanel && (
                <div className="px-3.5 pb-3.5 pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40 space-y-3">
                  {/* Switch de auto-marcado al completar el contador */}
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          autoMarkTopicStudied
                            ? 'text-emerald-500'
                            : 'text-slate-400'
                        }`}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          Marcar tema automáticamente como «Estudiado»
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {selectedTopic
                            ? `Al completar los ${effectiveFocusMinutes} min asignados, «${selectedTopic.title}» pasará a estado Estudiado.`
                            : 'Selecciona un tema arriba o en la lista inferior antes de iniciar el temporizador.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAutoMarkTopicStudied(!autoMarkTopicStudied)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        autoMarkTopicStudied
                          ? 'bg-emerald-500'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={autoMarkTopicStudied}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                          autoMarkTopicStudied ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Selector de tiempo asignado a la meta antes de iniciar */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      Tiempo asignado a la meta:
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        { label: `Base (${pomodoroConfig.focusMinutes}m)`, value: null },
                        { label: '15m', value: 15 },
                        { label: '25m', value: 25 },
                        { label: '45m', value: 45 },
                        { label: '60m', value: 60 },
                        ...(selectedTopic?.estimatedHours
                          ? [
                              {
                                label: `Est. Tema (${Math.max(
                                  5,
                                  Math.min(180, Math.round(selectedTopic.estimatedHours * 60))
                                )}m)`,
                                value: Math.max(
                                  5,
                                  Math.min(180, Math.round(selectedTopic.estimatedHours * 60))
                                ),
                              },
                            ]
                          : []),
                      ].map((opt, idx) => {
                        const isSelected = topicGoalCustomMinutes === opt.value;
                        return (
                          <button
                            key={`${opt.label}-${idx}`}
                            type="button"
                            disabled={isRunning}
                            onClick={() => {
                              setTopicGoalCustomMinutes(opt.value);
                              if (!isRunning && mode === 'focus') {
                                const mins = opt.value ?? pomodoroConfig.focusMinutes;
                                setTimeLeft(mins * 60);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selección rápida de temas meta de la asignatura activa */}
                  {selectedSubject && selectedSubject.topics.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Temas objetivo en {selectedSubject.name} (haz clic para fijar como meta activa):
                        </span>
                        {queuedGoalTopicIds.length > 0 && (
                          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                            {
                              queuedGoalTopicIds.filter((id) =>
                                completedGoalTopicIds.includes(id)
                              ).length
                            }
                            /{queuedGoalTopicIds.length} metas completadas
                          </span>
                        )}
                      </div>
                      <div className="max-h-28 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {selectedSubject.topics.map((topic) => {
                          const isCurrentTarget = selectedTopicId === topic.id;
                          const isQueuedGoal = queuedGoalTopicIds.includes(topic.id);
                          const isAlreadyStudied =
                            topic.status === 'estudiado' ||
                            topic.status === 'repasado' ||
                            completedGoalTopicIds.includes(topic.id);

                          return (
                            <div
                              key={topic.id}
                              onClick={() => {
                                if (!isRunning) {
                                  setSelectedTopicId(topic.id);
                                }
                                if (!queuedGoalTopicIds.includes(topic.id)) {
                                  setQueuedGoalTopicIds((prev) => [...prev, topic.id]);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                isCurrentTarget
                                  ? 'bg-indigo-600/10 dark:bg-indigo-500/20 border-indigo-500 text-indigo-950 dark:text-white'
                                  : isQueuedGoal
                                  ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-800 text-slate-800 dark:text-slate-200'
                                  : 'bg-white/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isQueuedGoal || isCurrentTarget}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (isQueuedGoal) {
                                      setQueuedGoalTopicIds((prev) =>
                                        prev.filter((id) => id !== topic.id)
                                      );
                                    } else {
                                      setQueuedGoalTopicIds((prev) => [...prev, topic.id]);
                                      if (!selectedTopicId && !isRunning) {
                                        setSelectedTopicId(topic.id);
                                      }
                                    }
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                  title="Incluir en la cola de metas de la sesión"
                                />
                                <span className="text-[11px] font-semibold truncate">
                                  {topic.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isAlreadyStudied ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                                    ✓ Estudiado
                                  </span>
                                ) : isCurrentTarget ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white">
                                    En meta
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
              <span>
                Próxima pausa larga en{' '}
                <strong className="font-mono-numbers text-slate-800 dark:text-slate-200">
                  {longBreakInterval - completedInSet}
                </strong>{' '}
                sesiones
              </span>
              <button
                type="button"
                onClick={handleSessionEndAlertsButtonClick}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  showSessionEndAlertsConfig
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/70 dark:border-blue-800/70'
                }`}
              >
                <BellRing className="w-3.5 h-3.5 animate-pulse" />
                <span>Avisos fin de sesión</span>
                {showSessionEndAlertsConfig ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>

            {/* Banner emergente de aviso de fin de sesión / prueba */}
            {sessionAlertBanner && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md flex items-start justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-xl bg-white/20 shrink-0 mt-0.5">
                    <BellRing className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold leading-snug">
                      {sessionAlertBanner.title}
                    </p>
                    <p className="text-[11px] text-blue-100 mt-0.5 leading-relaxed">
                      {sessionAlertBanner.subtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSessionAlertBanner(null)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white shrink-0 cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            )}

            {/* Panel desplegable de configuración y prueba de Avisos Fin de Sesión */}
            {showSessionEndAlertsConfig && (
              <div className="p-4 rounded-2xl bg-slate-50/95 dark:bg-slate-800/80 border border-blue-200/80 dark:border-blue-900/60 space-y-3.5 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        Configuración de Avisos de Fin de Sesión
                      </h5>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Personaliza las alertas sonoras, visuales y del sistema al terminar el temporizador
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerTestSessionAlert()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Probar aviso ahora</span>
                  </button>
                </div>

                {/* Selector de tono de fin de sesión + Volumen */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Tono acústico al finalizar
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        Volumen: {Math.round(sessionEndChimeVolume * 100)}%
                      </span>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={sessionEndChimeVolume}
                        onChange={(e) => {
                          const nextVol = parseFloat(e.target.value);
                          setSessionEndChimeVolume(nextVol);
                          setSessionEndChimeEnabled(true);
                          playChime(sessionEndChimeType, true, nextVol);
                        }}
                        className="w-20 h-1.5 accent-blue-600 cursor-pointer"
                        title="Volumen del aviso sonoro"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        id: 'campana_zen' as const,
                        label: 'Campana Zen',
                        desc: 'Cuenco armónico 528Hz',
                      },
                      {
                        id: 'acorde_cristal' as const,
                        label: 'Acorde Cristal',
                        desc: 'Arpegio ascendente suave',
                      },
                      {
                        id: 'doble_pulso' as const,
                        label: 'Doble Pulso',
                        desc: 'Timbre clásico de estudio',
                      },
                    ].map((toneOpt) => {
                      const active = sessionEndChimeType === toneOpt.id;
                      return (
                        <button
                          key={toneOpt.id}
                          type="button"
                          onClick={() => {
                            setSessionEndChimeType(toneOpt.id);
                            setSessionEndChimeEnabled(true);
                            playChime(toneOpt.id, true);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/50 text-blue-950 dark:text-blue-100 shadow-2xs'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold">{toneOpt.label}</span>
                            <Volume2
                              className={`w-3.5 h-3.5 ${
                                active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                              }`}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {toneOpt.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Interruptores de Sonido, Banner Visual y Notificación del Sistema */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !sessionEndChimeEnabled;
                      setSessionEndChimeEnabled(next);
                      if (next) playChime(sessionEndChimeType, true);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      sessionEndChimeEnabled
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {sessionEndChimeEnabled ? (
                        <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>Alerta sonora</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-800">
                      {sessionEndChimeEnabled ? 'Activa' : 'Silencio'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSessionEndVisualBannerEnabled((prev) => !prev)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      sessionEndVisualBannerEnabled
                        ? 'border-blue-300 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {sessionEndVisualBannerEnabled ? (
                        <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : (
                        <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>Alerta visual</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-800">
                      {sessionEndVisualBannerEnabled ? 'Activa' : 'Oculta'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const next = !sessionEndBrowserNotifEnabled;
                      setSessionEndBrowserNotifEnabled(next);
                      if (next && notificationService.isSupported()) {
                        const perm = notificationService.getPermission();
                        if (perm !== 'granted') {
                          const granted = await notificationService.requestPermission();
                          setBrowserPermissionStatus(notificationService.getPermission());
                          if (granted) {
                            notificationService.sendTestNotificationByType('pomodoro', {
                              skipServiceChime: true,
                            });
                          }
                        } else {
                          setBrowserPermissionStatus('granted');
                          notificationService.sendTestNotificationByType('pomodoro', {
                            skipServiceChime: true,
                          });
                        }
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      sessionEndBrowserNotifEnabled
                        ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Bell
                        className={`w-4 h-4 shrink-0 ${
                          sessionEndBrowserNotifEnabled
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400'
                        }`}
                      />
                      <span>Aviso navegador</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-800">
                      {!sessionEndBrowserNotifEnabled
                        ? 'Off'
                        : browserPermissionStatus === 'granted'
                        ? 'Push OK'
                        : 'Auto'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================== */}
        {/* COLUMNA DERECHA (5 COLS): ESTUDIO ACÚSTICO VISUAL 3D Y MEZCLADOR */}
        {/* ================================================================== */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            {/* Header + Visual Equalizer Bar */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs shrink-0">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Paisajes Sonoros 3D
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pausa automática durante los descansos
                  </p>
                </div>
              </div>

              {/* Master Volume Pill */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleVolumeChange(ambientVolume > 0 ? 0 : 0.55)}
                  className="text-slate-500 hover:text-purple-600 cursor-pointer"
                  title="Silenciar / Restaurar volumen"
                >
                  {ambientVolume === 0 ? (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={ambientVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 accent-purple-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] font-mono-numbers font-bold text-slate-700 dark:text-slate-300 w-7 text-right">
                  {Math.round(ambientVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Notice when paused on break */}
            {mode !== 'focus' && hasActiveAmbientConfig && (
              <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Pause className="w-3.5 h-3.5 shrink-0" />
                <span>En pausa durante tu descanso · Se reanudará al volver a Enfoque</span>
              </div>
            )}

            {/* 1-Click Visual Ambience Mixes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span>Mezclas Inmersivas 1-Clic</span>
                </span>
                {hasActiveAmbientConfig && (
                  <button
                    type="button"
                    onClick={() => handleToggleAmbientSound('none')}
                    className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Silenciar todo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {AMBIENT_PRESET_MIXES.map((mix) => {
                  const isMixSelected = activePresetMixId === mix.id;
                  const isMixPlaying = isMixSelected && isAmbientPlaying && mode === 'focus';
                  return (
                    <button
                      key={mix.id}
                      type="button"
                      onClick={() => handleApplyPresetMix(mix)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isMixSelected
                          ? 'bg-purple-50/90 dark:bg-purple-950/50 border-purple-500 text-purple-950 dark:text-purple-100 shadow-2xs'
                          : 'bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{mix.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {mix.subtitle}
                        </div>
                      </div>
                      {isMixPlaying && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual 4-Channel Layer Mixer (Lluvia · Bosque · Chimenea · Alfa) */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-600" />
                  <span>Mezclador Multicapa en Vivo</span>
                </span>
                {Object.values(layerVolumes).some((v) => v > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const reset = { rain: 0, forest: 0, fire: 0, binaural: 0 };
                      setLayerVolumes(reset);
                      (Object.keys(reset) as AmbientLayerKey[]).forEach((k) =>
                        ambientAudioService.setLayerVolume(k, 0)
                      );
                    }}
                    className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    Reiniciar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      key: 'rain' as AmbientLayerKey,
                      label: 'Lluvia 3D',
                      icon: <Droplets className="w-3.5 h-3.5 text-cyan-500" />,
                      accent: 'accent-cyan-600',
                    },
                    {
                      key: 'forest' as AmbientLayerKey,
                      label: 'Bosque y Aves',
                      icon: <Wind className="w-3.5 h-3.5 text-emerald-500" />,
                      accent: 'accent-emerald-600',
                    },
                    {
                      key: 'fire' as AmbientLayerKey,
                      label: 'Chimenea',
                      icon: <Flame className="w-3.5 h-3.5 text-orange-500" />,
                      accent: 'accent-orange-600',
                    },
                    {
                      key: 'binaural' as AmbientLayerKey,
                      label: 'Ondas Alfa',
                      icon: <Waves className="w-3.5 h-3.5 text-purple-500" />,
                      accent: 'accent-purple-600',
                    },
                  ] as const
                ).map((layer) => {
                  const val = layerVolumes[layer.key] || 0;
                  return (
                    <div
                      key={layer.key}
                      className={`p-2 rounded-xl border transition-colors ${
                        val > 0.01
                          ? 'bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-800 shadow-2xs'
                          : 'bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        <span className="flex items-center gap-1.5 truncate">
                          {layer.icon}
                          <span className="truncate">{layer.label}</span>
                        </span>
                        <span className="font-mono-numbers text-[10px] text-slate-500">
                          {Math.round(val * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={val}
                        onChange={(e) =>
                          handleLayerVolumeChange(layer.key, parseFloat(e.target.value))
                        }
                        className={`w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer ${layer.accent}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Pills + Visual Sound Tiles Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px]">
                {(
                  [
                    { id: 'all', label: 'Todos' },
                    { id: 'nature', label: '🌿 Naturaleza' },
                    { id: 'binaural', label: '🧠 Ondas / Lo-Fi' },
                    { id: 'noise', label: '🌊 Ruido Hi-Fi' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setAmbientCategoryFilter(cat.id)}
                    className={`flex-1 py-1 px-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      ambientCategoryFilter === cat.id
                        ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Clean Visual Sound Grid (3 columns) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                {AMBIENT_SOUND_OPTIONS.filter(
                  (opt) =>
                    ambientCategoryFilter === 'all' ||
                    opt.id === 'none' ||
                    opt.category === ambientCategoryFilter
                ).map((opt) => {
                  const isSelected = ambientSound === opt.id;
                  const isPlayingThis = isSelected && isAmbientPlaying && mode === 'focus';
                  const visual = getSoundVisualMeta(opt.id);

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleAmbientSound(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? `${visual.activeRing} ring-2 ring-purple-400/20 shadow-2xs`
                          : 'bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 shadow-2xs border border-slate-100 dark:border-slate-800">
                          {visual.icon}
                        </div>
                        {isPlayingThis ? (
                          <span className="flex items-end gap-0.5 h-2.5">
                            <span className="w-0.5 h-2 bg-emerald-500 animate-pulse" />
                            <span className="w-0.5 h-2.5 bg-emerald-500 animate-bounce" />
                            <span className="w-0.5 h-1.5 bg-emerald-500 animate-pulse" />
                          </span>
                        ) : opt.badge ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/90 dark:bg-slate-900 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800">
                            {opt.badge}
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <div className="text-xs font-bold truncate">{opt.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {visual.shortTag}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer: Auto-Start Toggle + Collapsible Psychoacoustic EQ */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={autoPlayAmbientWithTimer}
                  onChange={(e) => setAutoPlayAmbientWithTimer(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                />
                <span className="text-[11px] font-medium">
                  Auto-iniciar con el reloj y pausar en descansos
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowAdvancedAcoustic((prev) => !prev)}
                className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Ecualizador</span>
                {showAdvancedAcoustic ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>

            {showAdvancedAcoustic && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    <span>Calidez Antifatiga</span>
                    <span className="font-mono-numbers text-amber-600">
                      {Math.round(ambientWarmth * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={ambientWarmth}
                    onChange={(e) => handleWarmthChange(parseFloat(e.target.value))}
                    className="w-full accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    <span>Cuerpo Sub-Grave</span>
                    <span className="font-mono-numbers text-indigo-600">
                      {Math.round(ambientBassBoost * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientBassBoost}
                    onChange={(e) => handleBassBoostChange(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
