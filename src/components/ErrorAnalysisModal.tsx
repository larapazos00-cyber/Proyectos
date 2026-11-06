import React, { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, RefreshCw, X, Loader2 } from 'lucide-react';
import { ErrorLogEntry } from '../types';

interface ErrorAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: ErrorLogEntry[];
  subjectName: string;
  onResolveError: (errorId: string) => void;
}

export const ErrorAnalysisModal: React.FC<ErrorAnalysisModalProps> = ({
  isOpen,
  onClose,
  errors,
  subjectName,
  onResolveError,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    weakAreas: string[];
    rootCauses: string[];
    recommendedActions: string[];
    customReinforcementQuestions: Array<{
      concept: string;
      question: string;
      correctExplanation: string;
    }>;
  } | null>(null);

  if (!isOpen) return null;

  const handleAnalyzeWithAI = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/gemini/analyze-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors,
          subjectName,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setAnalysis(resData.data);
      }
    } catch (e) {
      console.error('Error analyzing mistakes', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Análisis de Errores y Refuerzo de Áreas Débiles</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Diagnóstico pedagógico inteligente basado en tus fallos pasados · {subjectName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Top Action */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs font-semibold text-slate-700">
                {errors.filter((e) => !e.resolved).length} errores pendientes de afianzar
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                La IA analiza patrones comunes en tus fallos y genera preguntas de refuerzo específico.
              </p>
            </div>

            <button
              onClick={handleAnalyzeWithAI}
              disabled={isAnalyzing || errors.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analizando historial de fallos...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analizar con IA</span>
                </>
              )}
            </button>
          </div>

          {/* AI Analysis Diagnostic */}
          {analysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weak Areas */}
                <div className="p-4 bg-rose-50/50 border border-rose-200/60 rounded-xl">
                  <h4 className="text-xs font-bold text-rose-900 mb-2">
                    Áreas Críticas Identificadas
                  </h4>
                  <ul className="text-xs text-rose-800 space-y-1 list-disc list-inside">
                    {analysis.weakAreas.map((wa, i) => (
                      <li key={i}>{wa}</li>
                    ))}
                  </ul>
                </div>

                {/* Root Causes */}
                <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl">
                  <h4 className="text-xs font-bold text-amber-900 mb-2">
                    Patrones de Confusión
                  </h4>
                  <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                    {analysis.rootCauses.map((rc, i) => (
                      <li key={i}>{rc}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Actions */}
              <div className="p-4 bg-blue-50/50 border border-blue-200/60 rounded-xl">
                <h4 className="text-xs font-bold text-blue-900 mb-2">
                  Plan de Acción Recomendado
                </h4>
                <ul className="text-xs text-blue-800 space-y-1.5">
                  {analysis.recommendedActions.map((act, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-blue-500 font-bold">→</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Custom Reinforcement Questions */}
              {analysis.customReinforcementQuestions && analysis.customReinforcementQuestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Preguntas de Refuerzo Específico
                  </h4>
                  {analysis.customReinforcementQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs shadow-2xs"
                    >
                      <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                        Concepto: {q.concept}
                      </div>
                      <div className="font-medium text-slate-900">{q.question}</div>
                      <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 leading-relaxed border border-slate-100">
                        <span className="font-semibold text-slate-800">Clave explicativa:</span>{' '}
                        {q.correctExplanation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* List of past recorded errors */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Registro Detallado de Fallos
            </h4>

            {errors.length > 0 ? (
              <div className="space-y-2.5">
                {errors.map((err) => (
                  <div
                    key={err.id}
                    className={`p-3.5 rounded-xl border text-xs transition-all flex items-start justify-between gap-3 ${
                      err.resolved
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : 'bg-white border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{err.topicTitle}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-400 font-mono-numbers">{err.date}</span>
                      </div>
                      <div className="text-slate-700 font-medium">{err.questionPrompt}</div>
                      <div className="text-rose-600">
                        <span className="font-semibold">Respuesta fallada:</span> {err.userMistake}
                      </div>
                      <div className="text-emerald-700">
                        <span className="font-semibold">Solución correcta:</span> {err.correctAnswer}
                      </div>
                    </div>

                    <button
                      onClick={() => onResolveError(err.id)}
                      className={`shrink-0 px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                        err.resolved
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {err.resolved ? '✓ Afianzado' : 'Marcar como afianzado'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-6">
                No hay errores registrados aún. Al realizar cuestionarios, los fallos se almacenarán automáticamente aquí.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
