/**
 * Utilidades de fecha libres de desfase de zona horaria (UTC vs Local)
 * Garantiza que días de la semana (0 = Dom, 1 = Lun, 2 = Mar...) y fechas YYYY-MM-DD
 * permanezcan 100% alineados sin importar la zona horaria (GMT+1/CET, GMT+2/CEST, etc.)
 */

export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  // Se establece a las 12:00:00 (mediodía) para blindar contra cualquier cambio horario (DST)
  return new Date(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function getTodayLocalDateStr(): string {
  return toLocalDateStr(new Date());
}

/**
 * Devuelve el día de la semana (0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado)
 * estrictamente según el calendario local para la fecha YYYY-MM-DD.
 */
export function getDayOfWeekFromDateStr(dateStr: string): number {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0).getDay();
}

export function addDaysToDateStr(baseDateStr: string, daysToAdd: number): string {
  if (!baseDateStr) return getTodayLocalDateStr();
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(y || 2026, (m || 1) - 1, (d || 1) + daysToAdd, 12, 0, 0);
  return toLocalDateStr(dt);
}

export function diffDaysBetween(dateA: string, dateB: string): number {
  const dt1 = parseLocalDate(dateA).getTime();
  const dt2 = parseLocalDate(dateB).getTime();
  return Math.round((dt2 - dt1) / (1000 * 60 * 60 * 24));
}

export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
  ];
  return `${d} ${months[(m || 1) - 1]} ${y}`;
}

/**
 * Devuelve las 7 fechas de la semana (Lunes a Domingo) que contienen la fecha especificada
 * en formato YYYY-MM-DD, completamente inmunes a desfases UTC.
 */
export function getWeekDates(dateInput: Date | string): string[] {
  const base =
    typeof dateInput === 'string'
      ? parseLocalDate(dateInput)
      : new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0);

  const day = base.getDay(); // 0 = Dom, 1 = Lun, 2 = Mar, ..., 6 = Sáb
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMonday, 12, 0, 0);

  const week: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12, 0, 0);
    week.push(toLocalDateStr(d));
  }
  return week;
}

export interface MonthDayCell {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Genera la cuadrícula de días del mes empezando siempre en Lunes (Lun a Dom)
 * sin que las fechas cambien de día al serializarse en string.
 */
export function getDaysInMonthGrid(year: number, month: number, todayStr?: string): MonthDayCell[] {
  const firstDay = new Date(year, month, 1, 12, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 12, 0, 0);

  // 0 = Dom -> 6, 1 = Lun -> 0, 2 = Mar -> 1, ..., 6 = Sáb -> 5
  let startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const days: MonthDayCell[] = [];
  const effectiveToday = todayStr || getTodayLocalDateStr();

  const prevMonthLastDay = new Date(year, month, 0, 12, 0, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dNum = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, dNum, 12, 0, 0);
    const dStr = toLocalDateStr(prevDate);
    days.push({
      dateStr: dStr,
      dayNumber: dNum,
      isCurrentMonth: false,
      isToday: dStr === effectiveToday,
    });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i, 12, 0, 0);
    const dStr = toLocalDateStr(d);
    days.push({
      dateStr: dStr,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: dStr === effectiveToday,
    });
  }

  const totalCells = Math.ceil(days.length / 7) * 7;
  let nextMonthDay = 1;
  while (days.length < totalCells) {
    const nextDate = new Date(year, month + 1, nextMonthDay, 12, 0, 0);
    const dStr = toLocalDateStr(nextDate);
    days.push({
      dateStr: dStr,
      dayNumber: nextMonthDay,
      isCurrentMonth: false,
      isToday: dStr === effectiveToday,
    });
    nextMonthDay++;
  }

  return days;
}
