import React, { useState, useRef, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Mic,
  Square,
  FileText,
  RotateCcw,
  Award,
  ArrowRight,
  HelpCircle,
  History,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Wand2,
  MessageSquareWarning,
  ShieldCheck,
  Zap,
  Loader2,
  Volume2,
} from 'lucide-react';
import {
  Subject,
  Topic,
  FeynmanSession,
  FeynmanConceptCorrection,
  ErrorLogEntry,
} from '../types';

export interface SyllabusComparisonItem {
  id: string;
  title: string;
  sourceLabel: string;
  status: 'cubierto' | 'parcial' | 'laguna';
  matchedKeywords: string[];
  missingKeywords: string[];
  guidanceHint: string;
}

interface FeynmanChallengeProps {
  subject: Subject;
  subjects?: Subject[];
  onSelectSubject?: (subjectId: string) => void;
  initialTopicId?: string;
  initialSubtopic?: string;
  onSaveSession: (session: FeynmanSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onLogMistake?: (mistake: ErrorLogEntry) => void;
  onMarkTopicReviewed?: (topicId: string, retentionPct: number) => void;
}

export const FeynmanChallenge: React.FC<FeynmanChallengeProps> = ({
  subject,
  subjects,
  onSelectSubject,
  initialTopicId,
  initialSubtopic,
  onSaveSession,
  onDeleteSession,
  onLogMistake,
  onMarkTopicReviewed,
}) => {
  // Selected topic & subtopic state
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    initialTopicId || subject.topics[0]?.id || 'custom'
  );
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>(initialSubtopic || '');
  const [customConcept, setCustomConcept] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<string>(
    'un estudiante principiante o un niño de 12 años (lenguaje sencillo y claro)'
  );

  // Input mode & explanation text
  const [inputMode, setInputMode] = useState<'written' | 'audio'>('written');
  const [explanationText, setExplanationText] = useState<string>('');
  const [coveredSubtopics, setCoveredSubtopics] = useState<string[]>([]);
  const [showReferencePeek, setShowReferencePeek] = useState<boolean>(false);

  // Evaluation & AI state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<FeynmanSession | null>(null);
  const [syllabusComparison, setSyllabusComparison] = useState<SyllabusComparisonItem[]>([]);
  const [loggedCorrectionIndices, setLoggedCorrectionIndices] = useState<number[]>([]);
  const [appliedCorrectionIndices, setAppliedCorrectionIndices] = useState<number[]>([]);
  const [activeSubView, setActiveSubView] = useState<'challenge' | 'history'>('challenge');

  // Audio recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [liveTranscript, setLiveTranscript] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Sync when subject changes
  useEffect(() => {
    const firstTopicId = subject.topics[0]?.id || 'custom';
    if (!subject.topics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(initialTopicId || firstTopicId);
      setSelectedSubtopic('');
      setCurrentEvaluation(null);
      setSyllabusComparison([]);
    }
  }, [subject.id]);

  // Sync when initialTopicId or initialSubtopic changes from parent
  useEffect(() => {
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
      setCurrentEvaluation(null);
      setSyllabusComparison([]);
      setActiveSubView('challenge');
    }
  }, [initialTopicId]);

  useEffect(() => {
    if (initialSubtopic !== undefined) {
      setSelectedSubtopic(initialSubtopic);
    }
  }, [initialSubtopic]);

  // Clean up audio resources on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, [audioUrl]);

  const activeTopic: Topic | undefined =
    selectedTopicId !== 'custom'
      ? subject.topics.find((t) => t.id === selectedTopicId)
      : undefined;

  // Build effective concept name
  const effectiveConceptTitle = (() => {
    if (selectedTopicId === 'custom') {
      return customConcept.trim();
    }
    if (!activeTopic) return customConcept.trim();
    if (selectedSubtopic) {
      return `${activeTopic.title} — ${selectedSubtopic}`;
    }
    return activeTopic.title;
  })();

  // Build reference content from topic description, subtopics, Cornell notes, and attached files
  const getTopicReferenceContent = (): string => {
    if (!activeTopic) return '';
    const linkedCornell = subject.cornellNotes.find((n) => n.topicId === activeTopic.id);
    const parts: string[] = [];

    if (activeTopic.description) {
      parts.push(`Descripción del tema: ${activeTopic.description}`);
    }
    if (activeTopic.subtopics && activeTopic.subtopics.length > 0) {
      parts.push(`Subtemas oficiales: ${activeTopic.subtopics.join(', ')}`);
    }
    if (activeTopic.notes || activeTopic.generalNotes) {
      parts.push(`Apuntes del tema:\n${activeTopic.notes || activeTopic.generalNotes}`);
    }
    if (linkedCornell) {
      if (linkedCornell.cues.length > 0) {
        parts.push(`Preguntas clave (Cues): ${linkedCornell.cues.join(' | ')}`);
      }
      if (linkedCornell.notes) {
        parts.push(`Notas Cornell:\n${linkedCornell.notes}`);
      }
      if (linkedCornell.summary) {
        parts.push(`Resumen Cornell:\n${linkedCornell.summary}`);
      }
    }
    if (activeTopic.attachedFiles && activeTopic.attachedFiles.length > 0) {
      const filesSummary = activeTopic.attachedFiles
        .map((f) => `${f.name}: ${(f.summary || f.content || '').slice(0, 1500)}`)
        .join('\n\n');
      if (filesSummary.trim()) {
        parts.push(`Documentos adjuntos:\n${filesSummary}`);
      }
    }

    return parts.join('\n\n');
  };

  // Normalize text removing accents and punctuation for syllabus comparison
  const normalizeText = (txt: string): string =>
    txt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ');

  const STOP_WORDS = new Set([
    'para', 'como', 'este', 'esta', 'estos', 'estas', 'sobre', 'entre', 'desde',
    'hasta', 'donde', 'cuando', 'porque', 'pero', 'sino', 'tambien', 'segun',
    'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'mismo',
    'misma', 'cada', 'cual', 'cuales', 'quien', 'cuyo', 'hacia', 'ante', 'bajo',
    'contra', 'durante', 'mediante', 'tema', 'subtema', 'concepto', 'parte',
    'estudio', 'analisis', 'general', 'introduccion', 'principios', 'fundamentos',
  ]);

  const extractMeaningfulTokens = (txt: string): string[] => {
    const norm = normalizeText(txt);
    return Array.from(
      new Set(
        norm
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
      )
    );
  };

  // Compare user's explanation against the original syllabus to detect knowledge gaps
  const evaluateAgainstOriginalSyllabus = (userText: string): {
    items: SyllabusComparisonItem[];
    coveragePct: number;
    detectedGaps: string[];
    coveredStrengths: string[];
  } => {
    const normUser = normalizeText(userText);
    const rawCandidateItems: { title: string; sourceLabel: string }[] = [];

    if (activeTopic) {
      if (selectedSubtopic) {
        rawCandidateItems.push({
          title: selectedSubtopic,
          sourceLabel: 'Subtema seleccionado',
        });
      } else if (activeTopic.subtopics && activeTopic.subtopics.length > 0) {
        activeTopic.subtopics.forEach((st, idx) => {
          rawCandidateItems.push({
            title: st,
            sourceLabel: `Epígrafe ${idx + 1} del temario`,
          });
        });
      }

      if (activeTopic.description) {
        const sentences = activeTopic.description
          .split(/[.;:\n]+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 12);
        sentences.slice(0, 4).forEach((s) => {
          if (!rawCandidateItems.some((it) => normalizeText(it.title) === normalizeText(s))) {
            rawCandidateItems.push({
              title: s,
              sourceLabel: 'Descripción oficial del tema',
            });
          }
        });
      }

      const linkedCornell = subject.cornellNotes.find((n) => n.topicId === activeTopic.id);
      if (linkedCornell && linkedCornell.cues.length > 0) {
        linkedCornell.cues.slice(0, 4).forEach((cue) => {
          if (!rawCandidateItems.some((it) => normalizeText(it.title) === normalizeText(cue))) {
            rawCandidateItems.push({
              title: cue,
              sourceLabel: 'Idea clave (Cornell)',
            });
          }
        });
      }

      if (activeTopic.attachedFiles && activeTopic.attachedFiles.length > 0) {
        activeTopic.attachedFiles.forEach((file) => {
          if (Array.isArray(file.keyPoints) && file.keyPoints.length > 0) {
            file.keyPoints.slice(0, 4).forEach((kp) => {
              const kpText =
                typeof kp === 'string'
                  ? kp
                  : `${kp.title}${kp.detail ? ': ' + kp.detail : ''}`;
              if (
                kpText &&
                !rawCandidateItems.some((it) => normalizeText(it.title) === normalizeText(kpText))
              ) {
                rawCandidateItems.push({
                  title: kpText,
                  sourceLabel: `PDF: ${file.name}`,
                });
              }
            });
          }
        });
      }

      if (rawCandidateItems.length === 0) {
        rawCandidateItems.push({
          title: activeTopic.title,
          sourceLabel: 'Tema principal del programa',
        });
      }
    } else if (customConcept.trim()) {
      rawCandidateItems.push({
        title: customConcept.trim(),
        sourceLabel: 'Concepto objetivo',
      });
    }

    const items: SyllabusComparisonItem[] = rawCandidateItems.map((cand, idx) => {
      const tokens = extractMeaningfulTokens(cand.title);
      const matched: string[] = [];
      const missing: string[] = [];

      tokens.forEach((tok) => {
        const stem = tok.length >= 6 ? tok.slice(0, tok.length - 2) : tok;
        if (normUser.includes(stem)) {
          matched.push(tok);
        } else {
          missing.push(tok);
        }
      });

      const manualChecked = coveredSubtopics.includes(cand.title);
      const ratio = tokens.length > 0 ? matched.length / tokens.length : normUser.length > 30 ? 1 : 0;

      let status: 'cubierto' | 'parcial' | 'laguna' = 'laguna';
      if (ratio >= 0.6 || (manualChecked && ratio >= 0.3)) {
        status = 'cubierto';
      } else if (ratio >= 0.25 || manualChecked) {
        status = 'parcial';
      }

      const guidanceHint =
        status === 'cubierto'
          ? `Has integrado "${cand.title}" en tu explicación.`
          : status === 'parcial'
          ? `Mencionas parte de "${cand.title}", pero falta desarrollar: ${missing.slice(0, 4).join(', ') || 'su mecanismo o aplicación'}.`
          : `Laguna detectada: No has explicado "${cand.title}" (${cand.sourceLabel}). Explica con tus palabras en qué consiste y cómo se conecta con el tema.`;

      return {
        id: `syl-item-${idx}`,
        title: cand.title,
        sourceLabel: cand.sourceLabel,
        status,
        matchedKeywords: matched,
        missingKeywords: missing,
        guidanceHint,
      };
    });

    const totalWeight = items.length || 1;
    const earnedWeight = items.reduce(
      (acc, it) => acc + (it.status === 'cubierto' ? 1 : it.status === 'parcial' ? 0.5 : 0),
      0
    );
    const coveragePct = Math.round((earnedWeight / totalWeight) * 100);

    const detectedGaps = items
      .filter((it) => it.status === 'laguna' || it.status === 'parcial')
      .map((it) =>
        it.status === 'laguna'
          ? `Laguna en el temario (${it.sourceLabel}): Omitiste explicar "${it.title}".`
          : `Explicación incompleta (${it.sourceLabel}): En "${it.title}" faltó profundizar en ${it.missingKeywords.slice(0, 3).join(', ') || 'sus detalles clave'}.`
      );

    const coveredStrengths = items
      .filter((it) => it.status === 'cubierto')
      .map((it) => `Cubriste correctamente el apartado del temario: "${it.title}".`);

    return { items, coveragePct, detectedGaps, coveredStrengths };
  };

  // Word count & basic metrics for the user's explanation
  const wordCount = explanationText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  const toggleCoveredSubtopic = (subtopic: string) => {
    setCoveredSubtopics((prev) =>
      prev.includes(subtopic) ? prev.filter((item) => item !== subtopic) : [...prev, subtopic]
    );
  };

  // Insert a starter template to help the user structure their Feynman explanation
  const handleInsertStarterPrompt = (type: 'que_es' | 'analogia' | 'paso_a_paso' | 'llenar_laguna', customTopic?: string) => {
    const topicLabel = customTopic || selectedSubtopic || activeTopic?.title || customConcept || 'este concepto';
    let snippet = '';
    if (type === 'que_es') {
      snippet = `En palabras muy simples, ${topicLabel} consiste en... Sirve principalmente para... `;
    } else if (type === 'analogia') {
      snippet = `\n\nPodemos imaginarlo como si fuera... Por ejemplo, en la vida cotidiana ocurre algo parecido cuando... `;
    } else if (type === 'paso_a_paso') {
      snippet = `\n\nEl proceso funciona paso a paso así:\n1. Primero, ocurre que...\n2. Como consecuencia de esto...\n3. Finalmente, el resultado es... `;
    } else if (type === 'llenar_laguna') {
      snippet = `\n\nSobre "${topicLabel}": en términos sencillos, este punto del temario explica que... y es clave porque... `;
    }
    setExplanationText((prev) => `${prev}${snippet}`);
  };

  // Audio recording functions
  const startRecording = async () => {
    setError(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBase64(null);
    setLiveTranscript('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      setAudioMimeType(mimeType.split(';')[0]);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string)?.split(',')[1];
          setAudioBase64(base64String);
        };
        reader.readAsDataURL(finalBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'es-ES';
          recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript + ' ';
            }
            setLiveTranscript(transcript.trim());
          };
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (_) {}
      }
    } catch (err) {
      setError(
        'No se pudo acceder al micrófono. Revisa los permisos del navegador o usa la explicación por escrito.'
      );
    }
  };

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

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  // Instant local comparison against the original syllabus to detect knowledge gaps
  const handleCompareWithOriginalSyllabus = () => {
    if (!effectiveConceptTitle) {
      setError('Selecciona un tema del temario o escribe el concepto que vas a explicar.');
      return;
    }

    const textToEvaluate =
      inputMode === 'written' ? explanationText.trim() : liveTranscript.trim();

    if (textToEvaluate.length < 10) {
      setError(
        'Escribe primero tu explicación en el área de texto para poder compararla con el temario original y detectar lagunas de conocimiento.'
      );
      return;
    }

    setError(null);
    setLoggedCorrectionIndices([]);
    setAppliedCorrectionIndices([]);

    const sylResult = evaluateAgainstOriginalSyllabus(textToEvaluate);
    setSyllabusComparison(sylResult.items);

    const words = textToEvaluate.split(/\s+/).filter(Boolean);
    const avgWordLen =
      words.length > 0
        ? words.reduce((acc, w) => acc + w.length, 0) / words.length
        : 5;
    const hasExampleOrAnalogy =
      /ejemplo|imagin|como si|parecido|igual que|cotidian|supongamos|es decir/i.test(
        textToEvaluate
      );
    const simplicity = Math.min(
      96,
      Math.max(55, Math.round(82 - Math.max(0, avgWordLen - 6) * 5 + (hasExampleOrAnalogy ? 10 : 0)))
    );
    const accuracy = Math.max(35, sylResult.coveragePct);
    const overall = Math.round((simplicity + accuracy) / 2);

    const generatedCorrections: FeynmanConceptCorrection[] = sylResult.items
      .filter((it) => it.status === 'laguna' || it.status === 'parcial')
      .map((it) => ({
        concept: it.title,
        userMistake:
          it.status === 'laguna'
            ? `No mencionaste ni desarrollaste este apartado del temario original (${it.sourceLabel}).`
            : `Mencionaste superficialmente este apartado, omitiendo conceptos clave como: ${it.missingKeywords.slice(0, 4).join(', ') || 'su desarrollo principal'}.`,
        correction: `Explica con tus propias palabras qué es "${it.title}", cómo funciona dentro de ${activeTopic?.title || effectiveConceptTitle} y pon un ejemplo sencillo sin usar tecnicismos vacíos.`,
        severity: it.status === 'laguna' ? 'error_conceptual' : 'imprecision',
      }));

    const session: FeynmanSession = {
      id: `feyn-syl-${Date.now()}`,
      topicId: activeTopic?.id,
      subtopic: selectedSubtopic || undefined,
      concept: effectiveConceptTitle,
      explanation: textToEvaluate,
      clarityScore: simplicity,
      simplicityScore: simplicity,
      accuracyScore: accuracy,
      overallScore: overall,
      corrections: generatedCorrections,
      strengths:
        sylResult.coveredStrengths.length > 0
          ? sylResult.coveredStrengths
          : ['Explicación redactada con tus propias palabras lista para contrastar con el temario.'],
      identifiedJargon: [],
      conceptualGaps: sylResult.detectedGaps,
      intuitiveAnalogies: [
        `Para recordar "${effectiveConceptTitle}", conéctalo con una situación cotidiana donde cada subtema del programa cumpla una función concreta.`,
      ],
      improvedDraft: '',
      followUpQuestions: sylResult.items
        .filter((it) => it.status !== 'cubierto')
        .slice(0, 4)
        .map((it) => `¿Cómo le explicarías a un principiante el punto "${it.title}" sin mirar tus apuntes?`),
      feedback:
        sylResult.detectedGaps.length === 0
          ? `¡Excelente cobertura! Tu explicación abarca el 100% de los puntos clave del temario original de "${effectiveConceptTitle}".`
          : `Al comparar tu explicación con el temario original de "${effectiveConceptTitle}", cubriste el ${sylResult.coveragePct}% de los contenidos y se detectaron ${sylResult.detectedGaps.length} laguna(s) de conocimiento que debes completar.`,
      createdAt: new Date().toISOString(),
      inputMode: 'written',
    };

    setCurrentEvaluation(session);
    onSaveSession(session);
    if (activeTopic && onMarkTopicReviewed) {
      onMarkTopicReviewed(activeTopic.id, overall);
    }
  };

  // Run AI Evaluation + Original Syllabus Comparison for Feynman Challenge
  const handleAnalyzeExplanation = async () => {
    if (!effectiveConceptTitle) {
      setError('Selecciona un tema del temario o escribe el concepto que vas a explicar.');
      return;
    }

    if (inputMode === 'written' && explanationText.trim().length < 15) {
      setError(
        'Tu explicación es demasiado breve. Desarrolla el tema con tus propias palabras (al menos un par de frases) para comparar con el temario original y detectar lagunas de conocimiento.'
      );
      return;
    }

    if (inputMode === 'audio' && !audioBase64 && !liveTranscript.trim()) {
      setError('Graba primero tu explicación en audio antes de analizarla.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setLoggedCorrectionIndices([]);
    setAppliedCorrectionIndices([]);

    const referenceContent = getTopicReferenceContent();
    const initialText =
      inputMode === 'written' ? explanationText.trim() : liveTranscript.trim();
    const sylComparisonResult = evaluateAgainstOriginalSyllabus(initialText);
    setSyllabusComparison(sylComparisonResult.items);

    try {
      if (inputMode === 'audio' && audioBase64) {
        const response = await fetch('/api/gemini/evaluate-audio-feynman', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concept: effectiveConceptTitle,
            audioBase64,
            mimeType: audioMimeType,
            targetAudience,
            referenceContent,
          }),
        });

        const resData = await response.json();
        if (!response.ok || !resData.success || !resData.data) {
          throw new Error(resData.error || 'Error al analizar el audio con IA.');
        }

        const data = resData.data;
        const transcribedText = data.transcription || liveTranscript || 'Explicación por voz';
        const audioSylResult = evaluateAgainstOriginalSyllabus(transcribedText);
        setSyllabusComparison(audioSylResult.items);

        const simplicity = data.simplicityScore ?? data.clarityScore ?? 78;
        const accuracy = data.accuracyScore ?? audioSylResult.coveragePct ?? 78;
        const overall = data.overallScore ?? Math.round((simplicity + accuracy) / 2);

        const combinedGaps = Array.from(
          new Set([
            ...(Array.isArray(data.conceptualGaps) ? data.conceptualGaps : []),
            ...audioSylResult.detectedGaps,
          ])
        );

        const session: FeynmanSession = {
          id: `feyn-chal-${Date.now()}`,
          topicId: activeTopic?.id,
          subtopic: selectedSubtopic || undefined,
          concept: effectiveConceptTitle,
          explanation: transcribedText,
          clarityScore: simplicity,
          simplicityScore: simplicity,
          accuracyScore: accuracy,
          overallScore: overall,
          corrections: Array.isArray(data.corrections) ? data.corrections : [],
          strengths: Array.isArray(data.strengths) ? data.strengths : audioSylResult.coveredStrengths,
          identifiedJargon: Array.isArray(data.identifiedJargon) ? data.identifiedJargon : [],
          conceptualGaps: combinedGaps,
          intuitiveAnalogies: Array.isArray(data.intuitiveAnalogies) ? data.intuitiveAnalogies : [],
          improvedDraft: data.improvedDraft || '',
          followUpQuestions: Array.isArray(data.followUpQuestions) ? data.followUpQuestions : [],
          feedback: data.feedback || '',
          createdAt: new Date().toISOString(),
          inputMode: 'audio',
          transcription: transcribedText,
        };

        setCurrentEvaluation(session);
        onSaveSession(session);
        if (activeTopic && onMarkTopicReviewed) {
          onMarkTopicReviewed(activeTopic.id, overall);
        }
      } else {
        const textToEvaluate =
          inputMode === 'written' ? explanationText.trim() : liveTranscript.trim();

        const response = await fetch('/api/gemini/feynman-challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concept: effectiveConceptTitle,
            subtopics: selectedSubtopic
              ? [selectedSubtopic]
              : activeTopic?.subtopics || [],
            subjectName: subject.name,
            explanation: textToEvaluate,
            targetAudience,
            referenceContent,
          }),
        });

        const resData = await response.json();
        if (!response.ok || !resData.success || !resData.data) {
          throw new Error(resData.error || 'No se pudo analizar la explicación con IA.');
        }

        const data = resData.data;
        const simplicity = data.simplicityScore ?? data.clarityScore ?? 75;
        const accuracy = data.accuracyScore ?? sylComparisonResult.coveragePct ?? 75;
        const overall = data.overallScore ?? Math.round((simplicity + accuracy) / 2);

        const combinedGaps = Array.from(
          new Set([
            ...(Array.isArray(data.conceptualGaps) ? data.conceptualGaps : []),
            ...sylComparisonResult.detectedGaps,
          ])
        );

        const session: FeynmanSession = {
          id: `feyn-chal-${Date.now()}`,
          topicId: activeTopic?.id,
          subtopic: selectedSubtopic || undefined,
          concept: effectiveConceptTitle,
          explanation: textToEvaluate,
          clarityScore: simplicity,
          simplicityScore: simplicity,
          accuracyScore: accuracy,
          overallScore: overall,
          corrections: Array.isArray(data.corrections) ? data.corrections : [],
          deepDiveSuggestions: Array.isArray(data.deepDiveSuggestions)
            ? data.deepDiveSuggestions
            : [],
          strengths: Array.isArray(data.strengths) ? data.strengths : sylComparisonResult.coveredStrengths,
          identifiedJargon: Array.isArray(data.identifiedJargon) ? data.identifiedJargon : [],
          conceptualGaps: combinedGaps,
          intuitiveAnalogies: Array.isArray(data.intuitiveAnalogies) ? data.intuitiveAnalogies : [],
          improvedDraft: data.improvedDraft || '',
          followUpQuestions: Array.isArray(data.followUpQuestions) ? data.followUpQuestions : [],
          feedback: data.feedback || '',
          createdAt: new Date().toISOString(),
          inputMode: 'written',
        };

        setCurrentEvaluation(session);
        onSaveSession(session);
        if (activeTopic && onMarkTopicReviewed) {
          onMarkTopicReviewed(activeTopic.id, overall);
        }
      }
    } catch (err: any) {
      console.error('Error in FeynmanChallenge evaluation, falling back to syllabus comparison:', err);
      // Fallback to direct syllabus comparison if offline or API error so user always gets gap detection
      if (initialText.length >= 10) {
        handleCompareWithOriginalSyllabus();
      } else {
        setError(err.message || 'Error al analizar la explicación con IA.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply a specific AI correction into the user's draft so they can refine it
  const handleApplyCorrectionToDraft = (corr: FeynmanConceptCorrection, index: number) => {
    const addition = `\n\n[Corrección sobre ${corr.concept}]: ${corr.correction}`;
    setExplanationText((prev) =>
      prev.includes(corr.correction) ? prev : `${prev.trim()}${addition}`
    );
    setAppliedCorrectionIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));
  };

  // Log a poorly explained concept into the subject's ErrorLogEntry notebook
  const handleLogCorrectionAsError = (corr: FeynmanConceptCorrection, index: number) => {
    if (!onLogMistake || loggedCorrectionIndices.includes(index)) return;

    const newError: ErrorLogEntry = {
      id: `err-feyn-${Date.now()}-${index}`,
      subjectId: subject.id,
      topicId: activeTopic?.id,
      topicTitle: activeTopic?.title || effectiveConceptTitle,
      concept: corr.concept,
      questionPrompt: `Reto Feynman: Explicar "${corr.concept}" con sencillez y precisión`,
      userMistake: corr.userMistake,
      correctAnswer: corr.correction,
      rootCauseCategory:
        corr.severity === 'exceso_jerga' ? 'confusion_terminos' : 'falta_concepto',
      date: new Date().toISOString().split('T')[0],
      resolved: false,
    };

    onLogMistake(newError);
    setLoggedCorrectionIndices((prev) => [...prev, index]);
  };

  // Allow user to refine their draft keeping their text + corrections
  const handleRefineExplanation = () => {
    if (currentEvaluation && inputMode === 'audio' && currentEvaluation.transcription) {
      setInputMode('written');
      setExplanationText(currentEvaluation.transcription);
    }
    setCurrentEvaluation(null);
  };

  // Insert a missing syllabus point directly into the user's explanation draft and switch to editor
  const handleFillSyllabusGapInDraft = (item: SyllabusComparisonItem) => {
    const promptAddition = `\n\n• Sobre "${item.title}": en palabras sencillas, consiste en... y se relaciona con el tema porque...`;
    setExplanationText((prev) =>
      prev.includes(item.title) ? prev : `${prev.trim()}${promptAddition}`
    );
    setInputMode('written');
    setCurrentEvaluation(null);
  };

  // Reset completely for a fresh attempt
  const handleNewChallenge = () => {
    setCurrentEvaluation(null);
    setSyllabusComparison([]);
    setExplanationText('');
    setCoveredSubtopics([]);
    setLoggedCorrectionIndices([]);
    setAppliedCorrectionIndices([]);
    setError(null);
  };

  const getScoreBadgeStyle = (score: number) => {
    if (score >= 85) {
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        bar: 'bg-emerald-500',
        badge: 'bg-emerald-100 text-emerald-800',
        label: 'Excelente dominio',
      };
    }
    if (score >= 65) {
      return {
        bg: 'bg-blue-50 border-blue-200 text-blue-900',
        bar: 'bg-blue-600',
        badge: 'bg-blue-100 text-blue-800',
        label: 'Buen nivel · Mejorable',
      };
    }
    return {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      bar: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-800',
      label: 'Requiere corrección',
    };
  };

  const getSeverityBadge = (severity?: string) => {
    if (severity === 'error_conceptual') {
      return {
        label: 'Error Conceptual',
        classes: 'bg-rose-100 text-rose-800 border-rose-200',
      };
    }
    if (severity === 'exceso_jerga') {
      return {
        label: 'Exceso de Jerga / Poco Simple',
        classes: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    }
    return {
      label: 'Imprecisión o Idea Incompleta',
      classes: 'bg-orange-100 text-orange-800 border-orange-200',
    };
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm border border-purple-800/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[11px] font-bold uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5 text-purple-300" />
              <span>Herramienta Guiada · Técnica Feynman y Detección de Lagunas</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white">
              Técnica Feynman: Explica un tema y compáralo con el temario original
            </h3>
            <p className="text-xs text-purple-100/80 leading-relaxed">
              "Si no puedes explicarlo de forma sencilla, aún no lo has entendido del todo." Elige un
              tema de <strong>{subject.name}</strong>, desarróllalo en el área de texto con tus propias
              palabras y evalúa tu explicación frente al <strong>temario original</strong> para detectar{' '}
              <strong>lagunas de conocimiento</strong>, tecnicismos mal empleados o conceptos omitidos.
            </p>
          </div>

          {/* Sub-view Switcher: Nuevo Reto vs Historial */}
          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/15 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubView('challenge')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubView === 'challenge'
                  ? 'bg-white text-purple-950 shadow-xs'
                  : 'text-purple-100 hover:bg-white/10'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Guía Paso a Paso</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubView === 'history'
                  ? 'bg-white text-purple-950 shadow-xs'
                  : 'text-purple-100 hover:bg-white/10'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Historial ({subject.feynmanSessions.length})</span>
            </button>
          </div>
        </div>

        {/* 4 Steps Pill Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-purple-500/30 text-purple-200 font-mono-numbers font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span className="text-purple-100/90 text-[11px] leading-snug">
              <strong>Elige materia y tema</strong> del programa oficial
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-purple-500/30 text-purple-200 font-mono-numbers font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span className="text-purple-100/90 text-[11px] leading-snug">
              <strong>Redacta tu explicación</strong> sin mirar apuntes
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-purple-500/30 text-purple-200 font-mono-numbers font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <span className="text-purple-100/90 text-[11px] leading-snug">
              <strong>Detecta lagunas</strong> comparando con el temario
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-purple-500/30 text-purple-200 font-mono-numbers font-bold flex items-center justify-center shrink-0">
              4
            </span>
            <span className="text-purple-100/90 text-[11px] leading-snug">
              <strong>Completa lo omitido</strong> y simplifica al 100%
            </span>
          </div>
        </div>
      </div>

      {/* VIEW 1: ACTIVE FEYNMAN CHALLENGE */}
      {activeSubView === 'challenge' && (
        <div className="space-y-6">
          {/* Topic & Audience Configuration Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
            {/* Optional Subject Switcher when rendered at the Materias level */}
            {subjects && subjects.length > 1 && onSelectSubject && (
              <div className="pb-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Materia seleccionada para la Técnica Feynman:
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {subjects.map((sub) => {
                    const isSelected = sub.id === subject.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onSelectSubject(sub.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: isSelected ? '#ffffff' : sub.color || '#3b82f6',
                          }}
                        />
                        <span>{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Selector de Tema */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  1. Tema de la asignatura a explicar
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedTopicId(val);
                    setSelectedSubtopic('');
                    setCoveredSubtopics([]);
                    setCurrentEvaluation(null);
                    setSyllabusComparison([]);
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {subject.topics.map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      Tema {idx + 1}: {t.title}
                    </option>
                  ))}
                  <option value="custom">✨ Otro concepto libre de {subject.name}...</option>
                </select>
              </div>

              {/* Selector de Subtema específico o Concepto libre */}
              <div>
                {selectedTopicId === 'custom' || !activeTopic ? (
                  <>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Concepto específico a explicar
                    </label>
                    <input
                      type="text"
                      value={customConcept}
                      onChange={(e) => setCustomConcept(e.target.value)}
                      placeholder="Ej: Ciclo de Krebs, Segunda Ley de Newton..."
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      2. Alcance del reto (Tema completo o Subtema)
                    </label>
                    <select
                      value={selectedSubtopic}
                      onChange={(e) => {
                        setSelectedSubtopic(e.target.value);
                        setCurrentEvaluation(null);
                        setSyllabusComparison([]);
                      }}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">
                        Todo el tema ({activeTopic.subtopics?.length || 0} subtemas)
                      </option>
                      {(activeTopic.subtopics || []).map((st, i) => (
                        <option key={i} value={st}>
                          Subtema {i + 1}: {st}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Audiencia objetivo */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  3. ¿A quién se lo estás explicando?
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="un estudiante principiante o un niño de 12 años (lenguaje sencillo y claro)">
                    A un principiante / niño de 12 años (Máxima sencillez)
                  </option>
                  <option value="un compañero de clase que no asistió hoy (claro, directo y con ejemplos)">
                    A un compañero de clase (Claro y estructurado)
                  </option>
                  <option value="un profesor en defensa oral (explicación intuitiva pero con rigor conceptual)">
                    A un tribunal / examen oral (Simple pero muy preciso)
                  </option>
                </select>
              </div>
            </div>

            {/* Subtopics Checkpoints & Peek Reference Bar */}
            {activeTopic && (
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">
                      Epígrafes del temario original (se detectan en vivo al escribir):
                    </span>
                    {activeTopic.subtopics && activeTopic.subtopics.length > 0 ? (
                      activeTopic.subtopics.map((st, idx) => {
                        const isChecked =
                          coveredSubtopics.includes(st) ||
                          explanationText.toLowerCase().includes(st.toLowerCase().slice(0, 8));
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCoveredSubtopic(st)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Haz clic para marcar que ya has incluido este subtema en tu explicación"
                          >
                            {isChecked && <Check className="w-3 h-3 text-emerald-600" />}
                            <span>{st}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        Explica la idea principal, cómo funciona y pon un ejemplo sencillo.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowReferencePeek((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    {showReferencePeek ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ocultar temario original</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>Ver temario original de apoyo (si te bloqueas)</span>
                      </>
                    )}
                  </button>
                </div>

                {showReferencePeek && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700 space-y-1.5 max-h-48 overflow-y-auto">
                    <div className="font-bold text-amber-900 flex items-center justify-between">
                      <span>Temario original y apuntes de referencia para "{activeTopic.title}":</span>
                      <span className="text-[10px] font-normal text-amber-700">
                        Léelo, ciérralo y explícalo con tus propias palabras
                      </span>
                    </div>
                    <p className="whitespace-pre-line leading-relaxed text-[11px]">
                      {getTopicReferenceContent() ||
                        activeTopic.description ||
                        'Sin apuntes adicionales registrados para este tema.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Explanation Input Area */}
          {!currentEvaluation && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Área de Explicación Guiada (Técnica Feynman)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Explicando:{' '}
                    <strong className="text-purple-700">
                      {effectiveConceptTitle || 'Selecciona un tema'}
                    </strong>
                  </p>
                </div>

                {/* Mode switcher: Written vs Audio */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setInputMode('written')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      inputMode === 'written'
                        ? 'bg-white text-purple-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                    <span>Escribir Explicación</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('audio')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      inputMode === 'audio'
                        ? 'bg-white text-purple-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5 text-purple-600" />
                    <span>Explicar en Voz Alta</span>
                  </button>
                </div>
              </div>

              {inputMode === 'written' ? (
                <div className="space-y-3">
                  {/* Helper Starter Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium mr-1">
                      Guías de redacción Feynman:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInsertStarterPrompt('que_es')}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-medium transition-colors cursor-pointer"
                    >
                      + "1. ¿Qué es y para qué sirve?"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertStarterPrompt('analogia')}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-medium transition-colors cursor-pointer"
                    >
                      + "2. Poner una analogía cotidiana"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertStarterPrompt('paso_a_paso')}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-medium transition-colors cursor-pointer"
                    >
                      + "3. Explicar cómo funciona paso a paso"
                    </button>
                  </div>

                  <textarea
                    value={explanationText}
                    onChange={(e) => setExplanationText(e.target.value)}
                    rows={7}
                    placeholder={`Explica "${effectiveConceptTitle || 'el tema'}" como si se lo enseñaras a ${targetAudience}. Evita copiar frases textuales de los apuntes: usa tus propias palabras, explica el "porqué" de cada idea y añade algún ejemplo sencillo...`}
                    className="w-full text-xs sm:text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl p-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed resize-y"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-numbers">
                        <strong>{wordCount}</strong> palabras ·{' '}
                        <strong>{explanationText.length}</strong> caracteres
                      </span>
                      {wordCount > 0 && wordCount < 25 && (
                        <span className="text-amber-600 font-medium">
                          💡 Desarrolla un poco más tu explicación para un análisis más completo
                        </span>
                      )}
                      {wordCount >= 25 && (
                        <span className="text-emerald-600 font-medium">
                          ✓ Longitud óptima para evaluar contra el temario original
                        </span>
                      )}
                    </div>
                    {explanationText.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExplanationText('')}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        Limpiar texto
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
                  <div className="text-center max-w-md space-y-1">
                    <h5 className="text-xs font-bold text-slate-800">
                      Explica "{effectiveConceptTitle}" en voz alta
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Habla con naturalidad como si le dieras una clase particular a un compañero.
                      La IA transcribirá tu voz y analizará si tu explicación es simple y precisa.
                    </p>
                  </div>

                  <div className="font-mono-numbers text-sm font-bold px-3 py-1 bg-white border border-slate-200 rounded-xl text-slate-800">
                    {formatDuration(recordingDuration)}
                  </div>

                  {isRecording ? (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg animate-pulse cursor-pointer"
                      >
                        <Square className="w-6 h-6 fill-current" />
                      </button>
                      <span className="text-xs font-bold text-rose-600">
                        Grabando... Pulsa para terminar
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={startRecording}
                        className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
                      >
                        <Mic className="w-7 h-7" />
                      </button>
                      <span className="text-xs font-semibold text-slate-700">
                        {audioUrl ? 'Volver a grabar explicación' : 'Pulsar para empezar a hablar'}
                      </span>
                    </div>
                  )}

                  {audioUrl && !isRecording && (
                    <div className="w-full max-w-md pt-2 flex flex-col items-center gap-2">
                      <audio src={audioUrl} controls className="w-full h-9" />
                    </div>
                  )}

                  {(liveTranscript || isRecording) && (
                    <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 italic">
                      <span className="font-bold not-italic text-slate-500 block mb-1 text-[10px] uppercase">
                        Transcripción detectada:
                      </span>
                      {liveTranscript || 'Escuchando tu explicación...'}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Buttons: Instant Syllabus Comparison + Full AI Evaluation */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <p className="text-[11px] text-slate-500">
                  La evaluación contrasta tu texto con los epígrafes, apuntes y PDFs del temario original.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCompareWithOriginalSyllabus}
                    disabled={
                      isAnalyzing ||
                      isRecording ||
                      !effectiveConceptTitle ||
                      (inputMode === 'written' && !explanationText.trim())
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-900 border border-indigo-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    title="Compara al instante tu explicación con los epígrafes del temario original para detectar qué conceptos has omitido"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-700" />
                    <span>Contrastar con Temario Original (Detectar Lagunas)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAnalyzeExplanation}
                    disabled={
                      isAnalyzing ||
                      isRecording ||
                      !effectiveConceptTitle ||
                      (inputMode === 'written' && !explanationText.trim()) ||
                      (inputMode === 'audio' && !audioBase64 && !liveTranscript.trim())
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Comparando con temario original y evaluando con IA...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        <span>Evaluar Explicación y Detectar Lagunas con IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI EVALUATION RESULTS VIEW */}
          {currentEvaluation && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Score Cards: Global, Simplicidad, Precisión */}
              {(() => {
                const simplicity =
                  currentEvaluation.simplicityScore ?? currentEvaluation.clarityScore ?? 75;
                const accuracy =
                  currentEvaluation.accuracyScore ?? currentEvaluation.clarityScore ?? 75;
                const overall =
                  currentEvaluation.overallScore ?? Math.round((simplicity + accuracy) / 2);

                const overallStyle = getScoreBadgeStyle(overall);
                const simpStyle = getScoreBadgeStyle(simplicity);
                const accStyle = getScoreBadgeStyle(accuracy);

                return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                          Resultado del Análisis Feynman vs. Temario Original
                        </span>
                        <h4 className="text-lg font-bold text-slate-900 mt-0.5">
                          {currentEvaluation.concept}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRefineExplanation}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
                          <span>Corregir y Volver a Evaluar</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleNewChallenge}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Nuevo Reto</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Simplicidad Score */}
                      <div className={`p-4 rounded-2xl border ${simpStyle.bg}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            <span>Simplicidad y Claridad</span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${simpStyle.badge}`}>
                            {simplicity >= 80 ? 'Muy Simple' : simplicity >= 60 ? 'Aceptable' : 'Complejo'}
                          </span>
                        </div>
                        <div className="text-3xl font-black font-mono-numbers mt-2 flex items-baseline gap-1">
                          {simplicity}
                          <span className="text-xs font-semibold opacity-75">/ 100</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full ${simpStyle.bar}`}
                            style={{ width: `${simplicity}%` }}
                          />
                        </div>
                        <p className="text-[11px] mt-2 opacity-85">
                          Evalúa si usas tus propias palabras de forma sencilla y sin jerga vacía.
                        </p>
                      </div>

                      {/* Precisión Score */}
                      <div className={`p-4 rounded-2xl border ${accStyle.bg}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" />
                            <span>Fidelidad al Temario</span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${accStyle.badge}`}>
                            {accuracy >= 80 ? 'Riguroso' : accuracy >= 60 ? 'Parcial' : 'Lagunas'}
                          </span>
                        </div>
                        <div className="text-3xl font-black font-mono-numbers mt-2 flex items-baseline gap-1">
                          {accuracy}
                          <span className="text-xs font-semibold opacity-75">/ 100</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full ${accStyle.bar}`}
                            style={{ width: `${accuracy}%` }}
                          />
                        </div>
                        <p className="text-[11px] mt-2 opacity-85">
                          Mide la cobertura real frente al temario original y tus apuntes.
                        </p>
                      </div>

                      {/* Puntuación Global */}
                      <div className={`p-4 rounded-2xl border ${overallStyle.bg}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Award className="w-4 h-4" />
                            <span>Dominio Feynman</span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${overallStyle.badge}`}>
                            {overallStyle.label}
                          </span>
                        </div>
                        <div className="text-3xl font-black font-mono-numbers mt-2 flex items-baseline gap-1">
                          {overall}
                          <span className="text-xs font-semibold opacity-75">/ 100</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full ${overallStyle.bar}`}
                            style={{ width: `${overall}%` }}
                          />
                        </div>
                        <p className="text-[11px] mt-2 opacity-85">
                          Equilibrio entre explicar fácil y mantener total exactitud académica.
                        </p>
                      </div>
                    </div>

                    {/* General Verdict Feedback */}
                    {currentEvaluation.feedback && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed flex items-start gap-3">
                        <Brain className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-900 block mb-0.5">
                            Diagnóstico de la Evaluación:
                          </span>
                          {currentEvaluation.feedback}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* MATRIZ COMPARATIVA: EXPLICACIÓN DEL USUARIO VS TEMARIO ORIGINAL (DETECCIÓN DE LAGUNAS) */}
              {syllabusComparison.length > 0 && (
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Comparación con el Temario Original · Detección de Lagunas de Conocimiento
                        </h4>
                        <p className="text-xs text-slate-500">
                          Contraste punto por punto entre tu explicación y los epígrafes/apuntes oficiales de{' '}
                          <strong>{effectiveConceptTitle}</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono-numbers">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                        {syllabusComparison.filter((i) => i.status === 'cubierto').length} cubiertos
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                        {syllabusComparison.filter((i) => i.status === 'parcial').length} parciales
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                        {syllabusComparison.filter((i) => i.status === 'laguna').length} lagunas
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {syllabusComparison.map((item) => {
                      const isCovered = item.status === 'cubierto';
                      const isPartial = item.status === 'parcial';
                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                            isCovered
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : isPartial
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-rose-50/60 border-rose-200'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/80 text-slate-600 border border-slate-200">
                                {item.sourceLabel}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                                  isCovered
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : isPartial
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-rose-100 text-rose-900 border-rose-300'
                                }`}
                              >
                                {isCovered
                                  ? '✓ Cubierto'
                                  : isPartial
                                  ? '⚠ Parcial / Incompleto'
                                  : '✗ Laguna de Conocimiento'}
                              </span>
                            </div>

                            <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                              {item.title}
                            </h5>
                            <p className="text-xs text-slate-700 leading-relaxed">
                              {item.guidanceHint}
                            </p>
                          </div>

                          {!isCovered && (
                            <div className="pt-2 border-t border-black/5 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => handleFillSyllabusGapInDraft(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                              >
                                <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                                <span>Completar esta laguna en mi explicación</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CORRECTIONS MODULE: Conceptos mal explicados detectados y sus correcciones */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                      <MessageSquareWarning className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Correcciones de Conceptos Mal Explicados o Confusos (
                        {currentEvaluation.corrections?.length || 0})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Análisis específico de errores conceptuales, imprecisiones o explicaciones
                        demasiado enrevesadas detectadas en tu texto.
                      </p>
                    </div>
                  </div>
                </div>

                {currentEvaluation.corrections && currentEvaluation.corrections.length > 0 ? (
                  <div className="space-y-3">
                    {currentEvaluation.corrections.map((corr, idx) => {
                      const sevBadge = getSeverityBadge(corr.severity);
                      const isLogged = loggedCorrectionIndices.includes(idx);
                      const isApplied = appliedCorrectionIndices.includes(idx);

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-6 h-6 rounded-lg bg-rose-600 text-white font-mono-numbers text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                                {corr.concept}
                              </h5>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${sevBadge.classes}`}
                              >
                                {sevBadge.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleApplyCorrectionToDraft(corr, idx)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                                  isApplied
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-white hover:bg-purple-50 text-purple-800 border-purple-200'
                                }`}
                                title="Añadir esta corrección a tu borrador para volver a evaluarlo"
                              >
                                <Check className="w-3 h-3" />
                                <span>
                                  {isApplied ? 'Añadida a tu borrador' : 'Incorporar a mi borrador'}
                                </span>
                              </button>

                              {onLogMistake && (
                                <button
                                  type="button"
                                  disabled={isLogged}
                                  onClick={() => handleLogCorrectionAsError(corr, idx)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                                    isLogged
                                      ? 'bg-amber-50 text-amber-800 border-amber-200 opacity-80'
                                      : 'bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 border-slate-200'
                                  }`}
                                  title="Guardar este fallo conceptual en el Cuaderno de Errores de la asignatura"
                                >
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>
                                    {isLogged ? 'Guardado en Mis Errores' : 'Guardar en Mis Errores'}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
                                ✗ Lo que falló o resultó confuso en tu explicación:
                              </span>
                              <p className="text-rose-950 leading-relaxed">{corr.userMistake}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                                ✓ Corrección Simple y Precisa (Método Feynman):
                              </span>
                              <p className="text-emerald-950 leading-relaxed font-medium">
                                {corr.correction}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <strong className="block">
                        ¡No se detectaron conceptos mal explicados!
                      </strong>
                      <span>
                        Tu explicación mantuvo tanto la sencillez expositiva como el rigor conceptual
                        del tema.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Strengths, Jargon & Conceptual Gaps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Puntos bien explicados */}
                {currentEvaluation.strengths && currentEvaluation.strengths.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Conceptos Bien Explicados ({currentEvaluation.strengths.length})</span>
                    </h5>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {currentEvaluation.strengths.map((st, i) => (
                        <li
                          key={i}
                          className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-2 leading-relaxed"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{st}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Lagunas y Jerga */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  {currentEvaluation.identifiedJargon &&
                    currentEvaluation.identifiedJargon.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>Tecnicismos usados sin explicar de forma simple:</span>
                        </h5>
                        <div className="flex flex-wrap gap-1.5">
                          {currentEvaluation.identifiedJargon.map((jargon, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium"
                            >
                              {jargon}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {currentEvaluation.conceptualGaps &&
                    currentEvaluation.conceptualGaps.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4 text-rose-600" />
                          <span>Ideas clave omitidas en tu explicación:</span>
                        </h5>
                        <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside bg-rose-50/40 p-3 rounded-xl border border-rose-100">
                          {currentEvaluation.conceptualGaps.map((gap, i) => (
                            <li key={i} className="leading-relaxed">
                              {gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </div>

              {/* Model Explanation & Intuitive Analogies */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {currentEvaluation.improvedDraft && (
                  <div className="md:col-span-2 bg-white rounded-2xl border border-purple-200 p-5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Explicación Modelo Simple y Precisa (Referencia Feynman)</span>
                      </h5>
                      <button
                        type="button"
                        onClick={() => {
                          setExplanationText(currentEvaluation.improvedDraft);
                          setCurrentEvaluation(null);
                        }}
                        className="text-[11px] font-semibold text-purple-700 hover:text-purple-950 underline cursor-pointer"
                      >
                        Usar como base en mi editor
                      </button>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                      {currentEvaluation.improvedDraft}
                    </div>
                  </div>
                )}

                {currentEvaluation.intuitiveAnalogies &&
                  currentEvaluation.intuitiveAnalogies.length > 0 && (
                    <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-2.5 shadow-2xs">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span>Analogías para Recordarlo</span>
                      </h5>
                      <div className="space-y-2">
                        {currentEvaluation.intuitiveAnalogies.map((analogy, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 text-xs text-amber-950 leading-relaxed"
                          >
                            {analogy}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Follow-up Socratic Questions */}
              {currentEvaluation.followUpQuestions &&
                currentEvaluation.followUpQuestions.length > 0 && (
                  <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200 p-5 space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-indigo-600" />
                      <span>Preguntas de comprobación rápida (Ponte a prueba):</span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {currentEvaluation.followUpQuestions.map((q, i) => (
                        <div
                          key={i}
                          className="p-3 bg-white rounded-xl border border-indigo-100 text-xs text-slate-800 font-medium flex items-start gap-2"
                        >
                          <span className="font-mono-numbers font-bold text-indigo-600">
                            P{i + 1}.
                          </span>
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: HISTORY OF FEYNMAN SESSIONS */}
      {activeSubView === 'history' && (
        <div className="space-y-4">
          {subject.feynmanSessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <Brain className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Aún no has completado ningún Reto Feynman en {subject.name}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Explica cualquier tema con tus propias palabras para comprobar tu nivel de
                simplicidad y precisión conceptual.
              </p>
              <button
                type="button"
                onClick={() => setActiveSubView('challenge')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Iniciar Primer Reto Feynman</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {subject.feynmanSessions.map((session) => {
                const simp = session.simplicityScore ?? session.clarityScore ?? 75;
                const acc = session.accuracyScore ?? session.clarityScore ?? 75;
                const corrCount = session.corrections ? session.corrections.length : 0;

                return (
                  <div
                    key={session.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3 hover:border-purple-200 transition-all"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">
                            {session.concept}
                          </span>
                          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                            Simplicidad: {simp}/100
                          </span>
                          <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold">
                            Precisión: {acc}/100
                          </span>
                          {corrCount > 0 && (
                            <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                              {corrCount} {corrCount === 1 ? 'corrección' : 'correcciones'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-numbers mt-1">
                          {new Date(session.createdAt).toLocaleString('es-ES', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (session.topicId) setSelectedTopicId(session.topicId);
                            setExplanationText(session.explanation);
                            setCurrentEvaluation(session);
                            setActiveSubView('challenge');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Ver Análisis y Correcciones
                        </button>
                        {onDeleteSession && (
                          <button
                            type="button"
                            onClick={() => onDeleteSession(session.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Eliminar sesión del historial"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                      "{session.explanation}"
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
