import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Target, Calendar, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { PomodoroLog } from '../types';

interface DailyStudyLineChartProps {
  pomodoroLogs: PomodoroLog[];
  weeklyTargetHours: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const diff = data.diferencia;
    const isAbove = diff >= 0;

    return (
      <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700/80 text-xs backdrop-blur-sm min-w-[200px] animate-fadeIn">
        <div className="font-bold text-slate-200 border-b border-slate-700/80 pb-1.5 mb-2 flex items-center justify-between">
          <span>{data.dayLabel}</span>
          <span className="text-[10px] text-slate-400 font-mono-numbers">{data.date}</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-blue-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Tiempo estudiado:
            </span>
            <span className="font-bold font-mono-numbers text-white">
              {data.horas}h ({data.minutos} min)
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Objetivo diario:
            </span>
            <span className="font-bold font-mono-numbers text-white">
              {data.objetivo}h
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800 text-[11px]">
            <span className="text-slate-400">Diferencia:</span>
            <span className={`font-bold font-mono-numbers ${isAbove ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isAbove ? `+${diff}h` : `${diff}h`}
            </span>
          </div>

          {data.sesiones > 0 && (
            <div className="text-[10px] text-slate-400 pt-0.5">
              {data.sesiones} {data.sesiones === 1 ? 'sesión Pomodoro' : 'sesiones Pomodoro'}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const DailyStudyLineChart: React.FC<DailyStudyLineChartProps> = ({
  pomodoroLogs,
  weeklyTargetHours,
}) => {
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  // Objetivo diario correspondiente al objetivo semanal planificado
  const dailyTargetHours = useMemo(() => {
    return Math.round(((weeklyTargetHours || 20) / 7) * 10) / 10;
  }, [weeklyTargetHours]);

  // Generación de puntos de datos diarios para la gráfica
  const chartData = useMemo(() => {
    const days: {
      date: string;
      dayLabel: string;
      horas: number;
      minutos: number;
      objetivo: number;
      cumplido: boolean;
      diferencia: number;
      sesiones: number;
    }[] = [];

    const now = new Date();
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let i = period - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = dayNames[d.getDay()];
      const dayLabel = `${dayName} ${d.getDate()}`;

      // Registros correspondientes a este día
      const dayLogs = pomodoroLogs.filter((log) => log.date === dateStr);
      const totalMinutes = dayLogs.reduce((acc, log) => acc + (log.durationMinutes || 0), 0);
      const hours = Math.round((totalMinutes / 60) * 10) / 10;

      days.push({
        date: dateStr,
        dayLabel,
        horas: hours,
        minutos: totalMinutes,
        objetivo: dailyTargetHours,
        cumplido: hours >= dailyTargetHours,
        diferencia: Math.round((hours - dailyTargetHours) * 10) / 10,
        sesiones: dayLogs.length,
      });
    }

    return days;
  }, [period, pomodoroLogs, dailyTargetHours]);

  // Métricas agregadas del periodo
  const totalHoursPeriod = useMemo(() => {
    return Math.round(chartData.reduce((acc, d) => acc + d.horas, 0) * 10) / 10;
  }, [chartData]);

  const averageDailyHours = useMemo(() => {
    return Math.round((totalHoursPeriod / period) * 10) / 10;
  }, [totalHoursPeriod, period]);

  const daysGoalAchieved = useMemo(() => {
    return chartData.filter((d) => d.horas >= d.objetivo).length;
  }, [chartData]);

  const maxHours = useMemo(() => {
    const maxData = Math.max(...chartData.map((d) => d.horas), dailyTargetHours);
    return Math.ceil(maxData + 1);
  }, [chartData, dailyTargetHours]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
      {/* Encabezado y Selector de Periodo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-slate-900">
              Evolución del Tiempo de Estudio Diario vs. Objetivo Planificado
            </h4>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Compara tus horas de concentración diarias frente al objetivo de {weeklyTargetHours}h semanales ({dailyTargetHours}h/día).
          </p>
        </div>

        {/* Botones de selección de periodo */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPeriod(7)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              period === 7
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Días
          </button>
          <button
            type="button"
            onClick={() => setPeriod(14)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              period === 14
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            14 Días
          </button>
          <button
            type="button"
            onClick={() => setPeriod(30)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              period === 30
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Días
          </button>
        </div>
      </div>

      {/* Tarjetas resumen con métricas clave */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Promedio Diario Real</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono-numbers text-slate-900">
              {averageDailyHours}h
            </span>
            <span className="text-xs text-slate-500 font-mono-numbers">/ día</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block font-mono-numbers">
            Total en periodo: {totalHoursPeriod}h
          </span>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Target className="w-3.5 h-3.5 text-amber-600" />
            <span>Objetivo Diario Planificado</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono-numbers text-amber-700">
              {dailyTargetHours}h
            </span>
            <span className="text-xs text-slate-500 font-mono-numbers">/ día</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block font-mono-numbers">
            Meta semanal: {weeklyTargetHours}h
          </span>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cumplimiento del Plan</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono-numbers text-emerald-600">
              {daysGoalAchieved} de {period}
            </span>
            <span className="text-xs text-slate-500">días</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block font-mono-numbers">
            {Math.round((daysGoalAchieved / period) * 100)}% de efectividad
          </span>
        </div>
      </div>

      {/* Gráfica Lineal Recharts */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="dayLabel"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              domain={[0, maxHours]}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              unit="h"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
              iconType="circle"
              formatter={(value) => {
                if (value === 'horas') return 'Tiempo de estudio diario (h)';
                if (value === 'objetivo') return `Objetivo planificado (${dailyTargetHours}h/día)`;
                return value;
              }}
            />

            {/* Línea de referencia del objetivo diario */}
            <ReferenceLine
              y={dailyTargetHours}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />

            {/* Línea 1: Objetivo planificado */}
            <Line
              type="monotone"
              dataKey="objetivo"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
              name="objetivo"
            />

            {/* Línea 2: Horas reales de estudio */}
            <Line
              type="monotone"
              dataKey="horas"
              stroke="#2563eb"
              strokeWidth={3}
              dot={{
                r: 3.5,
                fill: '#2563eb',
                strokeWidth: 2,
                stroke: '#ffffff',
              }}
              activeDot={{
                r: 6,
                fill: '#1d4ed8',
                stroke: '#ffffff',
                strokeWidth: 2,
              }}
              name="horas"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda y notas explicativas */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 rounded-full inline-block" />
            <span className="text-slate-700 font-medium">Horas registradas con Pomodoro</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-500 border-t border-dashed border-amber-500 inline-block" />
            <span className="text-slate-700 font-medium">Ritmo ideal semanal ({weeklyTargetHours}h)</span>
          </div>
        </div>

        <span className="text-[11px] text-slate-400">
          Los datos se actualizan automáticamente al completar cada bloque de estudio.
        </span>
      </div>
    </div>
  );
};
