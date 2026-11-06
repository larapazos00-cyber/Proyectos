import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Brain,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  Loader2,
  X,
  Mic,
  MicOff,
  Square,
  Play,
  Volume2,
  RotateCcw,
  FileText,
  Radio,
  HelpCircle,
  Award,
} from 'lucide-react';
import { FeynmanSession, Topic } from '../types';

interface FeynmanExplanationResult {
  title: string;
  intuitiveExplanation: string;
  coreAnalogy: string;
  keyPrinciples: string[];
  commonPitfalls: string[];
  oneLineSummary: string;
}

interface FeynmanCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  topics: Topic[];
  initialConcept?: string;
  onSaveSession: (session: FeynmanSession) => void;
}

export const FeynmanCoachModal: React.FC<FeynmanCoachModalProps> = ({
  isOpen,
  onClose,
  subjectName,
  topics,
  initialConcept = '',
  onSaveSession,
}) => {
  const [activeTab, setActiveTab] = useState<'explain' | 'practice'>('practice');
  const [practiceMode, setPracticeMode] = useState<'written' | 'audio'>('audio');
  const [concept, setConcept] = useState(initialConcept);
  const [targetAudience, setTargetAudience] = useState('un estudiante que empieza de cero o un niño de 10 años');
  const [writtenExplanation, setWrittenExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feynmanExplanation, setFeynmanExplanation] = useState<FeynmanExplanationResult | null>(null);
  const [result, setResult] = useState<FeynmanSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const speechRecognitionRef = useRef<any>(null);

  useEffect(() => {
    if (initialConcept) {
      setConcept(initialConcept);
    }
  }, [initialConcept]);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
    }
  }, []);

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, [audioUrl]);

  if (!isOpen) return null;

  // Start audio recording
  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBase64(null);
    setLiveTranscript('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine supported mime type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      setAudioMimeType(mimeType.split(';')[0]);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);

        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string)?.split(',')[1];
          setAudioBase64(base64String);
        };
        reader.readAsDataURL(finalBlob);

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250); // Slice chunks every 250ms
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Web Speech API for live transcription
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'es-ES';

          recognition.onresult = (event: any) => {
            let currentTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
              currentTranscript += event.results[i][0].transcript + ' ';
            }
            setLiveTranscript(currentTranscript.trim());
          };

          recognition.onerror = (e: any) => {
            console.warn('Speech recognition warning:', e);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (speechErr) {
          console.warn('Could not start live speech recognition:', speechErr);
        }
      }
    } catch (err: any) {
      console.error('Microphone error:', err);
      setError(
        'No se pudo acceder al micrófono. Por favor comprueba los permisos del navegador o utiliza el modo por escrito.'
      );
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsRecording(false);
  };

  // Format seconds to mm:ss
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  // Generate explanation with Gemini using Feynman technique (Mode 1)
  const handleGenerateExplanation = async () => {
    if (!concept.trim()) {
      setError('Por favor introduce o selecciona un concepto a explicar.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini/explain-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: concept.trim(),
          context: subjectName,
          targetAudience,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setFeynmanExplanation(resData.data);
      } else {
        throw new Error(resData.error || 'No se pudo generar la explicación con IA.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de conexión con Gemini.');
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate student's own explanation (Mode 2: written or audio)
  const handleEvaluate = async () => {
    if (!concept.trim()) {
      setError('Por favor introduce el concepto que estás explicando.');
      return;
    }

    if (practiceMode === 'written' && !writtenExplanation.trim()) {
      setError('Por favor escribe tu explicación del concepto.');
      return;
    }

    if (practiceMode === 'audio' && !audioBase64 && !liveTranscript.trim()) {
      setError('Por favor graba un audio con tu explicación antes de evaluar.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (practiceMode === 'audio' && audioBase64) {
        // Audio evaluation via Gemini multimodal audio endpoint
        const response = await fetch('/api/gemini/evaluate-audio-feynman', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concept: concept.trim(),
            audioBase64,
            mimeType: audioMimeType,
            targetAudience,
          }),
        });

        const resData = await response.json();
        if (resData.success && resData.data) {
          const session: FeynmanSession = {
            id: `feyn-${Date.now()}`,
            concept: concept.trim(),
            explanation: resData.data.transcription || liveTranscript || 'Explicación por audio',
            clarityScore: resData.data.clarityScore || 80,
            identifiedJargon: resData.data.identifiedJargon || [],
            conceptualGaps: resData.data.conceptualGaps || [],
            intuitiveAnalogies: resData.data.intuitiveAnalogies || [],
            improvedDraft: resData.data.improvedDraft || '',
            feedback: resData.data.feedback || '',
            createdAt: new Date().toISOString(),
            inputMode: 'audio',
            transcription: resData.data.transcription || liveTranscript,
            oralDeliveryFeedback: resData.data.oralDeliveryFeedback || '',
          };
          setResult(session);
          onSaveSession(session);
        } else {
          throw new Error(resData.error || 'Error al procesar el audio con Gemini.');
        }
      } else {
        // Written evaluation
        const textToEvaluate =
          practiceMode === 'written' ? writtenExplanation.trim() : liveTranscript.trim();

        const response = await fetch('/api/gemini/evaluate-feynman', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concept: concept.trim(),
            explanation: textToEvaluate,
            targetAudience,
          }),
        });

        const resData = await response.json();
        if (resData.success && resData.data) {
          const matchedTopic = topics.find(
            (t) => t.title.toLowerCase() === concept.trim().toLowerCase()
          );
          const session: FeynmanSession = {
            id: `feyn-${Date.now()}`,
            topicId: matchedTopic?.id,
            concept: concept.trim(),
            explanation: textToEvaluate,
            clarityScore: resData.data.clarityScore || 75,
            accuracyScore: resData.data.accuracyScore ?? resData.data.clarityScore ?? 78,
            deepDiveSuggestions: resData.data.deepDiveSuggestions || [],
            strengths: resData.data.strengths || [],
            identifiedJargon: resData.data.identifiedJargon || [],
            conceptualGaps: resData.data.conceptualGaps || [],
            intuitiveAnalogies: resData.data.intuitiveAnalogies || [],
            improvedDraft: resData.data.improvedDraft || '',
            feedback: resData.data.feedback || '',
            createdAt: new Date().toISOString(),
            inputMode: practiceMode,
            transcription: practiceMode === 'audio' ? liveTranscript : undefined,
          };
          setResult(session);
          onSaveSession(session);
        } else {
          throw new Error(resData.error || 'Error al evaluar la explicación.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de conexión con el evaluador de Feynman.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setFeynmanExplanation(null);
    setWrittenExplanation('');
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBase64(null);
    setLiveTranscript('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Técnica de Feynman · Comprensión Intuitiva
              </h3>
              <p className="text-xs text-slate-500">
                "Si no puedes explicarlo de forma sencilla, no lo entiendes lo suficiente" · {subjectName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 mx-6 mt-4 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab('practice');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'practice'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-600" />
            <span>Evaluar Mi Explicación (Voz o Escrito)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('explain');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'explain'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Pedir Explicación Simplificada a la IA</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode 2: Student tests explanation (VOICE OR WRITTEN) */}
          {activeTab === 'practice' && !result && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. Concepto a poner a prueba
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Potencial de acción neuronal, Reacción redox, Tipos de contratos..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Quick suggestion topics from subject */}
              {topics.length > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-slate-500 mb-1.5 block">
                    O selecciona un tema de la materia:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {topics.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setConcept(t.title)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          concept === t.title
                            ? 'bg-purple-50 border-purple-400 text-purple-700 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input format toggle: Written vs Audio */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  2. ¿Cómo prefieres explicarlo?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPracticeMode('audio')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      practiceMode === 'audio'
                        ? 'border-purple-500 bg-purple-50/70 text-purple-950 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        practiceMode === 'audio' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Por Audio / Voz (Micrófono)</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Habla en voz alta. Evaluaremos claridad oral, jerga y fluidez con IA.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPracticeMode('written')}
                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      practiceMode === 'written'
                        ? 'border-purple-500 bg-purple-50/70 text-purple-950 shadow-xs'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        practiceMode === 'written' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Por Escrito</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Redacta tu explicación como si se la enseñaras a un principiante.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub-view: Audio Recording */}
              {practiceMode === 'audio' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-purple-600" />
                        Grabación Oral de la Explicación
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Imagina que tienes delante a alguien que no sabe nada del tema. Habla con naturalidad.
                      </p>
                    </div>

                    <div className="font-mono text-xs font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700">
                      {formatDuration(recordingDuration)}
                    </div>
                  </div>

                  {/* Recording status visual */}
                  <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl space-y-3">
                    {isRecording ? (
                      <>
                        <div className="relative flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-rose-400 opacity-75"></span>
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="relative z-10 w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg hover:bg-rose-700 transition-transform active:scale-95"
                          >
                            <Square className="w-6 h-6 fill-current" />
                          </button>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-rose-600 flex items-center justify-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                            Grabando tu explicación... pulsa para detener
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Habla pausado y utiliza analogías cotidianas
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={startRecording}
                          className="w-16 h-16 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md hover:bg-purple-700 transition-transform active:scale-95"
                        >
                          <Mic className="w-7 h-7" />
                        </button>
                        <div className="text-center">
                          <div className="text-xs font-bold text-slate-800">
                            {audioBlob ? 'Volver a Grabar' : 'Iniciar Grabación de Audio'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Pulsa el micrófono y explica el concepto en voz alta
                          </div>
                        </div>
                      </>
                    )}

                    {/* Audio playback when recorded */}
                    {audioUrl && !isRecording && (
                      <div className="w-full pt-3 mt-2 border-t border-slate-100 flex flex-col items-center gap-2">
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Audio grabado con éxito ({formatDuration(recordingDuration)})
                        </span>
                        <audio src={audioUrl} controls className="w-full max-w-md h-9" />
                      </div>
                    )}
                  </div>

                  {/* Live transcript or transcribed text preview */}
                  {(liveTranscript || isRecording) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">
                          Transcripción de voz {isRecording && '(en vivo)'}:
                        </span>
                        {speechSupported && (
                          <span className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                            Reconocimiento activo
                          </span>
                        )}
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 min-h-14 max-h-28 overflow-y-auto italic">
                        {liveTranscript || 'Escuchando tu voz...'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-view: Written Explanation */}
              {practiceMode === 'written' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Redacta tu explicación con tus propias palabras
                  </label>
                  <textarea
                    value={writtenExplanation}
                    onChange={(e) => setWrittenExplanation(e.target.value)}
                    placeholder="Escribe tu explicación intentando evitar tecnicismos innecesarios. Usa analogías de la vida real..."
                    rows={6}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed resize-none"
                  />
                  <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                    <span>Consejo: Evita definiciones de memoria; explícalo como tú lo entiendes.</span>
                    <span>{writtenExplanation.length} caracteres</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleEvaluate}
                  disabled={
                    isLoading ||
                    isRecording ||
                    !concept.trim() ||
                    (practiceMode === 'written' && !writtenExplanation.trim()) ||
                    (practiceMode === 'audio' && !audioBase64 && !liveTranscript.trim())
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Evaluando explicación con IA (Feynman)...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      <span>
                        Evaluar {practiceMode === 'audio' ? 'Audio Oral' : 'Explicación Escrita'} con IA
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Feedback Report from student practice */}
          {activeTab === 'practice' && result && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Score cards: Clarity & Accuracy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-purple-700 font-bold uppercase tracking-wider">
                    <Award className="w-4 h-4" />
                    Claridad Explicativa
                  </div>
                  <div className="text-3xl font-black text-purple-950 font-mono-numbers mt-1 flex items-baseline gap-1.5">
                    {result.clarityScore}
                    <span className="text-sm font-semibold text-purple-600">/ 100</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" />
                    Precisión Conceptual
                  </div>
                  <div className="text-3xl font-black text-blue-950 font-mono-numbers mt-1 flex items-baseline gap-1.5">
                    {result.accuracyScore ?? result.clarityScore}
                    <span className="text-sm font-semibold text-blue-600">/ 100</span>
                  </div>
                </div>
              </div>

              {result.feedback && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium leading-relaxed">
                  {result.feedback}
                </div>
              )}

              {/* Deep Dive Suggestions */}
              {result.deepDiveSuggestions && result.deepDiveSuggestions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Puntos donde debes profundizar:</span>
                  </span>
                  <ul className="text-xs text-indigo-950 space-y-1.5 list-disc list-inside bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200">
                    {result.deepDiveSuggestions.map((point, i) => (
                      <li key={i} className="leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Transcription if audio was evaluated */}
              {result.transcription && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-purple-600" />
                    Transcripción de tu explicación oral:
                  </span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 italic">
                    "{result.transcription}"
                  </div>
                </div>
              )}

              {/* Oral Delivery Feedback (if audio mode) */}
              {result.oralDeliveryFeedback && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                    Feedback de Expresión y Comunicación Oral:
                  </span>
                  <p className="text-xs text-blue-950 leading-relaxed">
                    {result.oralDeliveryFeedback}
                  </p>
                </div>
              )}

              {/* Jargon identified */}
              {result.identifiedJargon.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Jerga o tecnicismos que deberías simplificar:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.identifiedJargon.map((word, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg font-medium"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Conceptual gaps */}
              {result.conceptualGaps.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-rose-600" />
                    <span>Lagunas conceptuales o saltos lógicos detectados:</span>
                  </span>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside bg-rose-50/50 p-3.5 rounded-xl border border-rose-100">
                    {result.conceptualGaps.map((gap, i) => (
                      <li key={i} className="leading-relaxed">
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analogies suggested */}
              {result.intuitiveAnalogies.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-emerald-600" />
                    <span>Analogía intuitiva recomendada para fijar el concepto:</span>
                  </span>
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-950 leading-relaxed">
                    {result.intuitiveAnalogies[0]}
                  </div>
                </div>
              )}

              {/* Improved draft */}
              {result.improvedDraft && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Versión Perfeccionada (Método Feynman):</span>
                  </span>
                  <div className="p-3.5 bg-purple-50/40 border border-purple-200 rounded-xl text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                    {result.improvedDraft}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Practicar de nuevo</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800"
                >
                  Guardar y Continuar Estudiando
                </button>
              </div>
            </div>
          )}

          {/* Mode 1: Gemini Feynman Concept Explainer */}
          {activeTab === 'explain' && !feynmanExplanation && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Concepto Complejo a Explicar
                </label>
                <input
                  type="text"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Ciclo de Krebs, Potencial de Acción, Ley de Inducción de Faraday..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Quick suggestion topics from subject */}
              {topics.length > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-slate-500 mb-1.5 block">
                    O selecciona un tema de la materia:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {topics.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setConcept(t.title)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          concept === t.title
                            ? 'bg-purple-50 border-purple-400 text-purple-700 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nivel de la explicación
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="un niño de 10 años (máxima sencillez y metáforas visuales)">
                    Como para un niño de 10 años (máxima sencillez y metáforas cotidianas)
                  </option>
                  <option value="un estudiante de primer año de carrera sin conocimientos previos">
                    Para un estudiante de 1º de carrera sin conocimientos previos
                  </option>
                  <option value="un profesional de otra disciplina totalmente distinta">
                    Para un profesional de otra disciplina
                  </option>
                </select>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateExplanation}
                  disabled={isLoading || !concept.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Simplificando con Técnica Feynman...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Explicar Concepto</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Render Gemini Feynman Explanation Result */}
          {activeTab === 'explain' && feynmanExplanation && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-xl">
                <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                  Concepto Explicado
                </span>
                <h4 className="text-lg font-bold text-slate-900 mt-1">{feynmanExplanation.title}</h4>
                <p className="text-xs font-medium text-purple-900 mt-1 italic">
                  "{feynmanExplanation.oneLineSummary}"
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <span>Explicación Sencilla (Sin Jerga Rebuscada)</span>
                </h5>
                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-line">
                  {feynmanExplanation.intuitiveExplanation}
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span>Analogía de la Vida Cotidiana</span>
                </h5>
                <div className="text-xs text-slate-700 leading-relaxed bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                  {feynmanExplanation.coreAnalogy}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-emerald-800 block mb-2">
                    ✓ Principios Clave a Recordar
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                    {feynmanExplanation.keyPrinciples.map((kp, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-rose-800 block mb-2">
                    ⚠ Errores y Confusiones Comunes
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                    {feynmanExplanation.commonPitfalls.map((cp, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {cp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  ← Explicar otro concepto
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('practice');
                    setWrittenExplanation('');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Ahora quiero explicarlo yo mismo (Audio o Escrito) →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
