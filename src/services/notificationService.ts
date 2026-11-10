/**
 * NotificationService
 * Gestiona el envío de alertas web (Notification API) en el navegador para:
 * - Recordatorios de exámenes próximos con días de antelación
 * - Tareas pendientes y fechas de entrega sincronizadas con el horario de estudio del usuario
 * - Sesiones de estudio programadas y avisos de repaso espaciado
 * - Descansos e intervalos del método Pomodoro
 */

import {
  Subject,
  StudyPreferences,
  Exam,
  Task,
  PomodoroLog,
  ContextualNotificationRule,
} from '../types';
import { checkSubjectProgressAlert } from '../utils/courseAlerts';

export const DEFAULT_CONTEXTUAL_RULES: ContextualNotificationRule[] = [
  {
    id: 'rule-weekly-subject-goal',
    name: 'Tiempo acumulado semanal menor a la meta de la materia',
    conditionType: 'subject_below_weekly_goal',
    subjectId: 'all',
    thresholdHours: 4,
    thresholdPercentage: 100,
    evaluationDay: 'any',
    suggestedMinutes: 25,
    enabled: true,
  },
  {
    id: 'rule-midweek-pace',
    name: 'Alerta de ritmo a mitad de semana (< 50% de la meta semanal)',
    conditionType: 'subject_below_weekly_goal',
    subjectId: 'all',
    thresholdHours: 4,
    thresholdPercentage: 50,
    evaluationDay: 'midweek',
    suggestedMinutes: 25,
    enabled: true,
  },
  {
    id: 'rule-topic-stagnation',
    name: 'Materia con temas pendientes sin sesiones Pomodoro recientes',
    conditionType: 'topic_stagnation',
    subjectId: 'all',
    suggestedMinutes: 25,
    evaluationDay: 'any',
    enabled: true,
  },
];

export const notificationService = {
  _focusModeSilenced: false,
  _swRegistration: null as ServiceWorkerRegistration | null,
  _swInitPromise: null as Promise<ServiceWorkerRegistration | null> | null,

  setFocusModeSilenced(silenced: boolean): void {
    this._focusModeSilenced = silenced;
  },

  isFocusModeSilenced(): boolean {
    return this._focusModeSilenced;
  },

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  },

  isPushServiceSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'Notification' in window
    );
  },

  async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (this._swRegistration) return this._swRegistration;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

    if (!this._swInitPromise) {
      this._swInitPromise = (async () => {
        try {
          // Register /sw.js
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          this._swRegistration = reg;
          console.log('Service Worker registrado exitosamente para notificaciones push');
          return reg;
        } catch (err) {
          console.warn('No se pudo registrar Service Worker:', err);
          return null;
        }
      })();
    }
    return this._swInitPromise;
  },

  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('La Notification API no está soportada en este navegador.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Automatically initialize Service Worker
        await this.getServiceWorkerRegistration();
      }
      return permission === 'granted';
    } catch (e) {
      console.error('Error al solicitar permiso de notificaciones', e);
      return false;
    }
  },

  /**
   * Suscribe el navegador al servicio de notificaciones push para recibir alertas
   * incluso si la aplicación no está en primer plano o la pestaña está en segundo plano.
   */
  async subscribePushService(): Promise<{ success: boolean; endpoint?: string; error?: string }> {
    if (!this.isPushServiceSupported()) {
      return { success: false, error: 'Tu navegador no soporta Service Workers o Notificaciones Push.' };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'El usuario no concedió permiso de notificaciones en el navegador.' };
      }

      const reg = await this.getServiceWorkerRegistration();
      if (!reg) {
        return { success: false, error: 'No se pudo inicializar el Service Worker para notificaciones push.' };
      }

      // Check or generate client subscription ID
      let localSubId = localStorage.getItem('studyflow_push_sub_id');
      if (!localSubId) {
        localSubId = `push-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('studyflow_push_sub_id', localSubId);
      }
      localStorage.setItem('studyflow_browser_push_active', 'true');

      // Send confirmation notification through Service Worker
      await this.sendPushTestNotification(
        '🔔 Suscripción Push Activa · StudyFlow',
        '¡Suscripción completada! Recibirás alertas del navegador cuando tus repasos espaciados estén vencidos o próximos a vencer.'
      );

      return { success: true, endpoint: localSubId };
    } catch (err: any) {
      console.error('Error al suscribir a notificaciones push:', err);
      return { success: false, error: err?.message || 'Error desconocido al suscribir a notificaciones push.' };
    }
  },

  async unsubscribePushService(): Promise<boolean> {
    try {
      localStorage.removeItem('studyflow_browser_push_active');
      return true;
    } catch (_) {
      return false;
    }
  },

  isPushSubscribed(): boolean {
    if (!this.isSupported() || Notification.permission !== 'granted') return false;
    return typeof localStorage !== 'undefined' && localStorage.getItem('studyflow_browser_push_active') === 'true';
  },

  playChime(type: 'pomodoro' | 'review' | 'task' | 'exam' = 'pomodoro'): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';

      if (type === 'exam') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(554.37, audioCtx.currentTime + 0.15); // C#5
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.3); // E5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5); // A5
      } else if (type === 'pomodoro') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.2); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.4); // G5
      } else if (type === 'review') {
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
      } else {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(554.37, audioCtx.currentTime + 0.25); // C#5
      }

      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      // Audio fallback silent if audio context is blocked
    }
  },

  /**
   * Envía una notificación. Utiliza ServiceWorkerRegistration.showNotification si está disponible
   * para asegurar que la alerta aparezca en el sistema operativo incluso si la app no está en primer plano.
   */
  send(
    title: string,
    options?: NotificationOptions & {
      soundType?: 'pomodoro' | 'review' | 'task' | 'exam';
      ignoreFocusSilence?: boolean;
      skipServiceChime?: boolean;
    }
  ): boolean {
    // Suprimir notificaciones externas mientras el Modo Enfoque está activo,
    // excepto los avisos de fin de sesión del propio Pomodoro y las pruebas manuales
    if (this._focusModeSilenced && !options?.ignoreFocusSilence) {
      return false;
    }

    if (!options?.skipServiceChime) {
      this.playChime(options?.soundType || 'pomodoro');
    }

    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    try {
      // Intentar primero a través de Service Worker (compatible con pestañas en segundo plano y móvil)
      if (this._swRegistration && 'showNotification' in this._swRegistration) {
        this._swRegistration.showNotification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: options?.tag || `studyflow-${Date.now()}`,
          ...options,
        });
        return true;
      }

      // Si aún no está listo el Service Worker en memoria, intentar con navigator.serviceWorker.ready
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          this._swRegistration = reg;
          reg.showNotification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: options?.tag || `studyflow-${Date.now()}`,
            ...options,
          });
        }).catch(() => {
          // Fallback a Notification estándar
          new Notification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: options?.tag || `studyflow-${Date.now()}`,
            ...options,
          });
        });
        return true;
      }

      // Fallback a Notification clásica
      const notif = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: options?.tag || `studyflow-${Date.now()}`,
        ...options,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      return true;
    } catch (e) {
      console.warn('Error al disparar notificación web', e);
      return false;
    }
  },

  /**
   * Envía una notificación de prueba directa mediante el Service Worker para comprobar recepción en segundo plano
   */
  async sendPushTestNotification(
    customTitle?: string,
    customBody?: string
  ): Promise<boolean> {
    const title = customTitle || '🔔 Alerta Push en Segundo Plano · StudyFlow';
    const body =
      customBody ||
      'Esta notificación se envía mediante Service Worker y llega incluso si navegas en otra ventana o tienes la app minimizada.';

    const reg = await this.getServiceWorkerRegistration();
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `push-test-${Date.now()}`,
        data: { url: '/' },
      });
      return true;
    }
    return this.send(title, { body, soundType: 'review', ignoreFocusSilence: true });
  },

  notifyPomodoro(
    mode: 'focus' | 'shortBreak' | 'longBreak',
    topicName?: string,
    options?: { skipServiceChime?: boolean }
  ): boolean {
    if (mode === 'focus') {
      return this.send('🌿 ¡Sesión de enfoque Pomodoro completada!', {
        body: topicName
          ? `Has completado el bloque de estudio de "${topicName}". Tómate un descanso para recuperar energía.`
          : 'Has terminado tu sesión de estudio. Tómate un descanso, estira y relaja la vista.',
        soundType: 'pomodoro',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    } else if (mode === 'shortBreak') {
      return this.send('⏱️ ¡Pausa corta terminada!', {
        body: topicName
          ? `Es hora de volver al foco con: ${topicName}. ¡Mantén la concentración!`
          : 'Es hora de reanudar tu bloque de estudio profundo.',
        soundType: 'pomodoro',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    } else {
      return this.send('🎉 ¡Descanso largo finalizado!', {
        body: 'Excelente rendimiento. Preparado para iniciar un nuevo ciclo de concentración.',
        soundType: 'pomodoro',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    }
  },

  notifyUpcomingExam(
    examTitle: string,
    examDate: string,
    examTime: string | undefined,
    subjectName: string,
    examType: string,
    daysLeft: number,
    allocatedHoursToday?: number
  ): void {
    const timeText = examTime ? ` a las ${examTime}` : '';
    const daysText =
      daysLeft === 0
        ? '¡ES HOY!'
        : daysLeft === 1
        ? '¡ES MAÑANA!'
        : `es en ${daysLeft} días (${examDate})`;

    const scheduleText =
      allocatedHoursToday && allocatedHoursToday > 0
        ? ` Tienes ${allocatedHoursToday}h de estudio programadas hoy en tu horario.`
        : '';

    this.send(`🎓 Recordatorio de Examen: ${subjectName}`, {
      body: `El examen "${examTitle}" (${examType.toUpperCase()}) ${daysText}${timeText}.${scheduleText} ¡Momento de repasar!`,
      soundType: 'exam',
      tag: `exam-${examTitle}-${examDate}`,
    });
  },

  notifyTaskDue(
    taskTitle: string,
    dueDate: string,
    subjectName: string,
    priority: string,
    daysLeft: number,
    allocatedHoursToday?: number
  ): void {
    const urgency =
      daysLeft < 0
        ? '¡VENCIDA!'
        : daysLeft === 0
        ? 'Vence HOY'
        : daysLeft === 1
        ? 'Vence MAÑANA'
        : `Vence el ${dueDate}`;

    const scheduleAdvice =
      allocatedHoursToday && allocatedHoursToday > 0
        ? ` Aprovecha las ${allocatedHoursToday}h de estudio asignadas hoy.`
        : '';

    this.send(`📋 Tarea Pendiente: ${taskTitle}`, {
      body: `${subjectName} · ${urgency} (Prioridad ${priority.toUpperCase()}).${scheduleAdvice}`,
      soundType: 'task',
      tag: `task-${taskTitle}-${dueDate}`,
    });
  },

  notifySpacedRepetition(topicTitle: string, subjectName: string, isOverdue?: boolean): void {
    const statusLabel = isOverdue ? 'Repaso Espaciado atrasado' : 'Repaso Espaciado para hoy';
    this.send(`🧠 ${statusLabel} · ${subjectName}`, {
      body: `Toca repasar "${topicTitle}". Aplicar Active Recall ahora consolida la memoria a largo plazo.`,
      soundType: 'review',
      tag: `spaced-review-${subjectName}-${topicTitle}`,
    });
  },

  notifyClassStart(
    classTitle: string,
    startTime: string,
    endTime: string,
    minutesUntilStart: number,
    notes?: string
  ): void {
    const timingText =
      minutesUntilStart <= 0
        ? `Comienza ahora (${startTime} - ${endTime})`
        : `Comienza en ${minutesUntilStart} min (${startTime} - ${endTime})`;
    const extraNotes = notes ? ` · ${notes}` : '';

    this.send(`🏫 Inicio de Clase: ${classTitle}`, {
      body: `${timingText}${extraNotes}. ¡Prepara tus apuntes y material de la sesión!`,
      soundType: 'task',
      tag: `class-start-${classTitle}-${startTime}`,
    });
  },

  notifyStudySession(subjectName: string, topicTitle: string, hours: number, pageCount?: number): void {
    const pagesText = pageCount ? ` (${pageCount} páginas a abarcar)` : '';
    this.send(`📚 Sesión de Estudio Programada · ${subjectName}`, {
      body: `Tienes agendado estudiar "${topicTitle}"${pagesText} durante ${hours}h hoy.`,
      soundType: 'task',
    });
  },

  notifyLowProgressSubject(
    subjectName: string,
    progressPct: number,
    weeksSinceCourseStart: number
  ): void {
    this.send(`⚠️ Aviso de ritmo de estudio: ${subjectName}`, {
      body: `Esta asignatura tiene un avance del ${progressPct}% (< 20%) tras ${weeksSinceCourseStart} semanas desde el inicio del curso escolar. Se recomienda programar repasos.`,
      soundType: 'review',
      tag: `low-progress-${subjectName}`,
    });
  },

  notifyContextualRuleAlert(
    ruleName: string,
    subjectName: string,
    accumulatedHours: number,
    targetHours: number,
    suggestedTopicTitle?: string,
    suggestedMinutes: number = 25
  ): void {
    const topicAdvice = suggestedTopicTitle
      ? ` Dedica ${suggestedMinutes} min al tema "${suggestedTopicTitle}" para recuperar el ritmo.`
      : '';
    this.send(`🎯 Alerta Contextual · ${subjectName}`, {
      body: `${ruleName}: Llevas ${accumulatedHours}h acumuladas frente a tu meta semanal de ${targetHours}h.${topicAdvice}`,
      soundType: 'review',
      tag: `contextual-rule-${subjectName}-${ruleName}`,
    });
  },

  evaluateContextualRules(
    subjects: Subject[],
    preferences: StudyPreferences,
    pomodoroLogs: PomodoroLog[] = []
  ): Array<{
    rule: ContextualNotificationRule;
    subject: Subject;
    accumulatedHours: number;
    targetHours: number;
    deficitHours: number;
    suggestedTopicTitle?: string;
    message: string;
  }> {
    const rules =
      preferences.contextualNotificationRules && preferences.contextualNotificationRules.length > 0
        ? preferences.contextualNotificationRules
        : DEFAULT_CONTEXTUAL_RULES;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 Dom .. 6 Sab
    const past7Dates = new Set(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      })
    );

    const totalWeeklyAvailable = (preferences.availableDays || [1, 2, 3, 4, 5]).reduce(
      (acc, d) => acc + (preferences.hoursPerDay?.[d] || 3),
      0
    );
    const defaultPerSubject =
      preferences.defaultSubjectWeeklyGoalHours ||
      (subjects.length > 0
        ? Math.max(2, Math.round((totalWeeklyAvailable / subjects.length) * 10) / 10)
        : 4);

    const triggered: Array<{
      rule: ContextualNotificationRule;
      subject: Subject;
      accumulatedHours: number;
      targetHours: number;
      deficitHours: number;
      suggestedTopicTitle?: string;
      message: string;
    }> = [];

    rules.forEach((rule) => {
      if (!rule.enabled) return;

      if (rule.evaluationDay === 'midweek' && ![3, 4, 5].includes(dayOfWeek)) return;
      if (rule.evaluationDay === 'weekend' && ![0, 6].includes(dayOfWeek)) return;

      const targetSubjects =
        !rule.subjectId || rule.subjectId === 'all'
          ? subjects
          : subjects.filter((s) => s.id === rule.subjectId);

      targetSubjects.forEach((sub) => {
        const subLogsMinutes = pomodoroLogs
          .filter(
            (l) =>
              (l.subjectId === sub.id || l.subjectName === sub.name) &&
              past7Dates.has(l.date)
          )
          .reduce((acc, l) => acc + l.durationMinutes, 0);

        const accumulatedHours = Math.round((subLogsMinutes / 60) * 10) / 10;
        const configuredSubjectTarget =
          preferences.subjectWeeklyGoalHours?.[sub.id] ??
          rule.thresholdHours ??
          defaultPerSubject;

        const requiredPct = (rule.thresholdPercentage ?? 100) / 100;
        const effectiveThresholdHours =
          Math.round(configuredSubjectTarget * requiredPct * 10) / 10;

        const nextPendingTopic = sub.topics.find(
          (t) => t.status === 'en_progreso' || t.status === 'pendiente'
        );

        if (rule.conditionType === 'subject_below_weekly_goal') {
          if (accumulatedHours < effectiveThresholdHours) {
            const deficit = Math.max(
              0.1,
              Math.round((configuredSubjectTarget - accumulatedHours) * 10) / 10
            );
            triggered.push({
              rule,
              subject: sub,
              accumulatedHours,
              targetHours: configuredSubjectTarget,
              deficitHours: deficit,
              suggestedTopicTitle: nextPendingTopic?.title,
              message: `${sub.name}: ${accumulatedHours}h acumuladas de ${configuredSubjectTarget}h semanales (-${deficit}h).`,
            });
          }
        } else if (rule.conditionType === 'topic_stagnation') {
          if (subLogsMinutes === 0 && nextPendingTopic) {
            triggered.push({
              rule,
              subject: sub,
              accumulatedHours: 0,
              targetHours: configuredSubjectTarget,
              deficitHours: configuredSubjectTarget,
              suggestedTopicTitle: nextPendingTopic.title,
              message: `${sub.name}: Sin sesiones Pomodoro esta semana (${nextPendingTopic.title} pendiente).`,
            });
          }
        } else if (rule.conditionType === 'exam_readiness_low') {
          const studiedCount = sub.topics.filter(
            (t) => t.status === 'estudiado' || t.status === 'repasado'
          ).length;
          const pct = sub.topics.length > 0 ? Math.round((studiedCount / sub.topics.length) * 100) : 100;
          if (pct < (rule.thresholdPercentage || 60) && accumulatedHours < configuredSubjectTarget) {
            triggered.push({
              rule,
              subject: sub,
              accumulatedHours,
              targetHours: configuredSubjectTarget,
              deficitHours: Math.max(0.5, configuredSubjectTarget - accumulatedHours),
              suggestedTopicTitle: nextPendingTopic?.title,
              message: `${sub.name}: Avance del ${pct}% y ${accumulatedHours}h/${configuredSubjectTarget}h semanales.`,
            });
          }
        }
      });
    });

    return triggered;
  },

  sendTestNotification(): boolean {
    return this.send('🔔 Notificaciones de StudyFlow Activadas', {
      body: 'Recibirás recordatorios personalizados de inicio de clase, vencimiento de tareas y repasos espaciados.',
      soundType: 'exam',
      ignoreFocusSilence: true,
    });
  },

  sendTestNotificationByType(
    eventType:
      | 'class_start'
      | 'task_deadline'
      | 'spaced_repetition'
      | 'exam'
      | 'pomodoro'
      | 'contextual_rule'
      | 'general',
    options?: { skipServiceChime?: boolean }
  ): boolean {
    if (eventType === 'class_start') {
      return this.send('🏫 Inicio de Clase: Anatomía Humana', {
        body: 'Comienza en 15 min (09:00 - 11:00) · Aula Magna. ¡Prepara tus apuntes Cornell!',
        soundType: 'task',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    }
    if (eventType === 'task_deadline') {
      return this.send('📋 Vencimiento de Tarea: Entrega de Práctica', {
        body: 'Fisiología · Vence MAÑANA (Prioridad ALTA). Aprovecha tu bloque de estudio de hoy.',
        soundType: 'task',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    }
    if (eventType === 'spaced_repetition') {
      return this.send('🧠 Recordatorio de Repaso Espaciado · Bioquímica', {
        body: 'Hoy toca repasar "Tema 2: Enzimología y Cinética". Aplicar Active Recall hoy garantiza su fijación.',
        soundType: 'review',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    }
    if (eventType === 'exam') {
      return this.send('🎓 Recordatorio de Examen: Farmacología', {
        body: 'El examen "Parcial Bloque I" (TEST) es en 3 días. ¡Momento de repasar!',
        soundType: 'exam',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    }
    if (eventType === 'pomodoro') {
      return this.send('🌿 ¡Sesión Pomodoro Completada!', {
        body: 'Has completado tu bloque de enfoque. Tómate 5 minutos de pausa corta para descansar la vista.',
        soundType: 'pomodoro',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    }
    if (eventType === 'contextual_rule') {
      return this.send('🎯 Alerta Contextual: Meta Semanal de Estudio', {
        body: 'Tiempo acumulado en Anatomía Humana (1.5h) menor a la meta semanal establecida (4.0h). Dedica 25 min al siguiente tema pendiente.',
        soundType: 'review',
        ignoreFocusSilence: true,
        skipServiceChime: options?.skipServiceChime,
      });
    }
    return this.sendTestNotification();
  },

  /**
   * Evaluador Inteligente de Horario y Alertas Push por Tipo de Evento:
   * - Inicio de clases según horario semanal fijo
   * - Vencimiento de tareas pendientes
   * - Recordatorios de repasos espaciados (Spaced Repetition)
   * - Exámenes próximos y alertas de progreso
   * Evita spam recordando como máximo una vez por elemento al día.
   */
  checkAndSendScheduledAlerts(
    subjects: Subject[],
    preferences: StudyPreferences,
    pomodoroLogs: PomodoroLog[] = []
  ): { notifiedExams: number; notifiedTasks: number; notifiedClasses?: number; notifiedReviews?: number } {
    if (
      this._focusModeSilenced ||
      !preferences.enableWebNotifications ||
      !this.isSupported() ||
      Notification.permission !== 'granted'
    ) {
      return { notifiedExams: 0, notifiedTasks: 0, notifiedClasses: 0, notifiedReviews: 0 };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

    const isStudyDay = preferences.availableDays?.includes(dayOfWeek) ?? true;
    const hoursToday = preferences.hoursPerDay?.[dayOfWeek] ?? 3;

    // Cache key for notifications sent today
    const storageKey = `studyflow_notif_log_${todayStr}`;
    let sentLog: Record<string, boolean> = {};
    try {
      sentLog = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (_) {
      sentLog = {};
    }

    let notifiedExams = 0;
    let notifiedTasks = 0;
    let notifiedClasses = 0;
    let notifiedReviews = 0;

    // 1. Eventos de Inicio de Clase (según horario fijo semanal)
    if (preferences.notifyClassStart !== false && preferences.weeklyFixedObligations) {
      const classLeadMinutes = preferences.classReminderMinutesBefore ?? 15;

      preferences.weeklyFixedObligations.forEach((ob) => {
        if (ob.category !== 'clase' || !ob.startTime) return;

        const appliesToday =
          ob.dayOfWeek === dayOfWeek ||
          (Array.isArray(ob.recurringDays) && ob.recurringDays.includes(dayOfWeek));
        if (!appliesToday) return;

        const [startH, startM] = ob.startTime.split(':').map(Number);
        if (isNaN(startH) || isNaN(startM)) return;

        const classStartMinutes = startH * 60 + startM;
        const minutesUntilStart = classStartMinutes - currentMinutesOfDay;

        // Avisar si faltan entre 0 y classLeadMinutes minutos (o si acaba de empezar hace <= 2 min)
        if (minutesUntilStart >= -2 && minutesUntilStart <= classLeadMinutes) {
          const notifKey = `class-${ob.id}-${todayStr}`;
          if (!sentLog[notifKey]) {
            this.notifyClassStart(
              ob.title,
              ob.startTime,
              ob.endTime || '',
              Math.max(0, minutesUntilStart),
              ob.notes
            );
            sentLog[notifKey] = true;
            notifiedClasses++;
          }
        }
      });
    }

    const daysAheadThreshold = preferences.examReminderDaysAhead || 7;
    const taskDaysThreshold = preferences.taskReminderDaysAhead ?? 2;
    const onlyHighPriorityTasks = preferences.taskNotifyOnlyHighPriority ?? false;
    const includeOverdueReviews = preferences.spacedRepetitionIncludeOverdue ?? true;

    // Hora configurada para recordatorios de repaso espaciado
    const reviewReminderTimeStr =
      preferences.spacedRepetitionReminderTime || preferences.customReminderTime || '09:00';
    const [revH, revM] = reviewReminderTimeStr.split(':').map(Number);
    const reviewTargetMinutes = !isNaN(revH) && !isNaN(revM) ? revH * 60 + revM : 9 * 60;
    const isPastReviewReminderTime = currentMinutesOfDay >= reviewTargetMinutes;

    subjects.forEach((subject) => {
      // 2. Check Upcoming Exams
      if (preferences.notifyUpcomingExams !== false && subject.exams) {
        subject.exams.forEach((exam) => {
          if (exam.completed || !exam.date) return;

          const examDate = new Date(`${exam.date}T00:00:00`);
          const todayDate = new Date(`${todayStr}T00:00:00`);
          const diffTime = examDate.getTime() - todayDate.getTime();
          const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (daysLeft >= 0 && daysLeft <= daysAheadThreshold) {
            const notifKey = `exam-${exam.id}-${daysLeft}`;
            if (!sentLog[notifKey]) {
              this.notifyUpcomingExam(
                exam.title,
                exam.date,
                exam.time,
                subject.name,
                exam.examType,
                daysLeft,
                isStudyDay ? hoursToday : undefined
              );
              sentLog[notifKey] = true;
              notifiedExams++;
            }
          }
        });
      }

      // 3. Check Pending Tasks based on schedule and user preferences
      if (preferences.notifyTaskDeadlines !== false && subject.tasks) {
        subject.tasks.forEach((task) => {
          if (task.completed || !task.dueDate) return;

          if (
            onlyHighPriorityTasks &&
            task.priority !== 'urgente' &&
            task.priority !== 'alta'
          ) {
            return;
          }

          const taskDueDate = new Date(`${task.dueDate}T00:00:00`);
          const todayDate = new Date(`${todayStr}T00:00:00`);
          const diffTime = taskDueDate.getTime() - todayDate.getTime();
          const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (daysLeft <= taskDaysThreshold) {
            const notifKey = `task-${task.id}-${daysLeft}`;
            if (!sentLog[notifKey]) {
              this.notifyTaskDue(
                task.title,
                task.dueDate,
                subject.name,
                task.priority,
                daysLeft,
                isStudyDay ? hoursToday : undefined
              );
              sentLog[notifKey] = true;
              notifiedTasks++;
            }
          }
        });
      }

      // 4. Recordatorios de Repasos Espaciados (Spaced Repetition)
      if (preferences.notifyDailyReviews !== false && isPastReviewReminderTime && subject.topics) {
        subject.topics.forEach((topic) => {
          if (!topic.nextReviewDate) return;

          // Respetar si la notificación automática para esta fase del ciclo está habilitada
          const currentLevel = Math.min(5, Math.max(1, topic.reviewLevel || 1));
          const phaseNotifAllowed = preferences.spacedRepetitionConfig?.phaseNotifications
            ? preferences.spacedRepetitionConfig.phaseNotifications[currentLevel - 1] !== false
            : true;
          if (!phaseNotifAllowed) return;

          const isDueToday = topic.nextReviewDate === todayStr;
          const isOverdue = topic.nextReviewDate < todayStr;

          if (isDueToday || (includeOverdueReviews && isOverdue)) {
            const notifKey = `spaced-review-${topic.id}-${todayStr}`;
            if (!sentLog[notifKey]) {
              this.notifySpacedRepetition(topic.title, subject.name, isOverdue);
              sentLog[notifKey] = true;
              notifiedReviews++;
            }
          }
        });
      }

      // 5. Comprobar alerta de ritmo bajo (< 20% tras > 2 semanas desde el inicio del curso)
      const progressAlert = checkSubjectProgressAlert(subject);
      if (progressAlert.isAlert) {
        const notifKey = `low-progress-${subject.id}-${todayStr}`;
        if (!sentLog[notifKey]) {
          this.notifyLowProgressSubject(
            subject.name,
            progressAlert.progressPct,
            progressAlert.weeksSinceCourseStart
          );
          sentLog[notifKey] = true;
        }
      }
    });

    // 6. Evaluar reglas de notificaciones contextuales (ej. tiempo acumulado < meta semanal de la materia)
    const contextualMatches = this.evaluateContextualRules(subjects, preferences, pomodoroLogs);
    contextualMatches.forEach((match) => {
      const notifKey = `contextual-${match.rule.id}-${match.subject.id}-${todayStr}`;
      if (!sentLog[notifKey]) {
        this.notifyContextualRuleAlert(
          match.rule.name,
          match.subject.name,
          match.accumulatedHours,
          match.targetHours,
          match.suggestedTopicTitle,
          match.rule.suggestedMinutes || 25
        );
        sentLog[notifKey] = true;
      }
    });

    try {
      localStorage.setItem(storageKey, JSON.stringify(sentLog));
    } catch (_) {}

    return { notifiedExams, notifiedTasks, notifiedClasses, notifiedReviews };
  },

  /**
   * Comprueba repasos espaciados vencidos o próximos a vencer (24h, 3d, 7d, 15d, 30d)
   * y envía alertas push del navegador (incluso si la app está en segundo plano).
   */
  checkAndNotifyOverdueReviews(
    subjects: Subject[],
    options?: { force?: boolean; preferences?: StudyPreferences }
  ): { overdueCount: number; dueTodayCount: number; notified: boolean } {
    if (this._focusModeSilenced) {
      return { overdueCount: 0, dueTodayCount: 0, notified: false };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const overdueTopics: { topicTitle: string; subjectName: string; nextReviewDate: string; daysOverdue: number }[] = [];
    const dueTodayTopics: { topicTitle: string; subjectName: string }[] = [];

    subjects.forEach((subject) => {
      subject.topics.forEach((topic) => {
        if (!topic.nextReviewDate) return;

        // Comprobar si la notificación automática para esta fase del ciclo está habilitada
        const currentLevel = Math.min(5, Math.max(1, topic.reviewLevel || 1));
        const phaseNotifAllowed = options?.preferences?.spacedRepetitionConfig?.phaseNotifications
          ? options.preferences.spacedRepetitionConfig.phaseNotifications[currentLevel - 1] !== false
          : true;
        if (!phaseNotifAllowed) return;

        if (topic.nextReviewDate < todayStr) {
          const diffDays = Math.max(
            1,
            Math.round(
              (new Date(todayStr).getTime() - new Date(topic.nextReviewDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          );
          overdueTopics.push({
            topicTitle: topic.title,
            subjectName: subject.name,
            nextReviewDate: topic.nextReviewDate,
            daysOverdue: diffDays,
          });
        } else if (topic.nextReviewDate === todayStr) {
          dueTodayTopics.push({
            topicTitle: topic.title,
            subjectName: subject.name,
          });
        }
      });
    });

    const overdueCount = overdueTopics.length;
    const dueTodayCount = dueTodayTopics.length;

    if (overdueCount === 0 && dueTodayCount === 0) {
      return { overdueCount: 0, dueTodayCount: 0, notified: false };
    }

    const storageKey = `studyflow_push_overdue_notified_${todayStr}`;
    const alreadyNotifiedToday = typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === 'true';

    if (alreadyNotifiedToday && !options?.force) {
      return { overdueCount, dueTodayCount, notified: false };
    }

    // Disparar alerta push
    if (overdueCount > 0) {
      const firstOverdue = overdueTopics[0];
      const extraText =
        overdueCount > 1
          ? ` y otros ${overdueCount - 1} temas tienen repasos atrasados.`
          : ' tiene su repaso atrasado.';

      this.send(`🚨 ${overdueCount} Repaso${overdueCount === 1 ? '' : 's'} Espaciado${overdueCount === 1 ? '' : 's'} Vencido${overdueCount === 1 ? '' : 's'}`, {
        body: `"${firstOverdue.topicTitle}" (${firstOverdue.subjectName})${extraText} Repasar hoy frena la curva del olvido.`,
        soundType: 'review',
        tag: `overdue-reviews-${todayStr}`,
      });
    } else if (dueTodayCount > 0) {
      const firstDue = dueTodayTopics[0];
      const extraText =
        dueTodayCount > 1
          ? ` y otros ${dueTodayCount - 1} temas programados para hoy.`
          : ' programado para consolidar hoy.';

      this.send(`🧠 ${dueTodayCount} Repaso${dueTodayCount === 1 ? '' : 's'} Espaciado${dueTodayCount === 1 ? '' : 's'} para Hoy`, {
        body: `"${firstDue.topicTitle}" (${firstDue.subjectName})${extraText}`,
        soundType: 'review',
        tag: `today-reviews-${todayStr}`,
      });
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
    }

    return { overdueCount, dueTodayCount, notified: true };
  },
};

