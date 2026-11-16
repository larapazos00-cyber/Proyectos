import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON with ample limit for image/pdf base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper for model & automatic multi-model fallback on 503/429 spikes
const GEMINI_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
const keyPointsSummaryCache = new Map<string, any>();
const quizGenerationCache = new Map<string, any>();
const cornellStructureCache = new Map<string, any>();

const waitDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientOverload(err: any): boolean {
  const status = err?.status || err?.code || err?.statusCode;
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    status === 503 ||
    status === 429 ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('high demand') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('overloaded') ||
    msg.includes('spikes in demand')
  );
}

async function generateContentWithFallback(params: any) {
  let lastError: any = null;
  const sanitizedConfig = { ...(params?.config || {}) };
  delete sanitizedConfig.temperature;
  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const modelName = FALLBACK_MODELS[i];
    try {
      return await ai.models.generateContent({
        ...params,
        model: modelName,
        config: sanitizedConfig,
      });
    } catch (err: any) {
      lastError = err;
      if (i < FALLBACK_MODELS.length - 1) {
        await waitDelay(60);
      }
    }
  }
  throw lastError;
}

// 1. OCR & Digitalización de apuntes y documentos importados (PDF o imágenes) con detección de páginas y extracción íntegra de texto
app.post('/api/gemini/ocr-notes', async (req: Request, res: Response) => {
  try {
    const { base64Data, mimeType, pageImages, instructions, clientPageCountHint } = req.body;
    const hasPageImages = Array.isArray(pageImages) && pageImages.length > 0;
    if (!hasPageImages && (!base64Data || !mimeType)) {
      res.status(400).json({ error: 'Falta base64Data, mimeType o pageImages del archivo.' });
      return;
    }

    const pageHintContext =
      clientPageCountHint && Number(clientPageCountHint) > 0
        ? `Nota técnica: El archivo parece contener aproximadamente ${clientPageCountHint} página(s). Confirma o ajusta el número real de páginas con contenido.`
        : '';

    const prompt = `Analiza minuciosamente este documento o imagen de apuntes/material académico importado.
Tu misión doble es:
A) Contar el número exacto de páginas del documento ("detectedPageCount") para la organización del estudio. ${pageHintContext}
B) Detectar y transcribir TODA la información escrita que aparece en el documento ("fullWrittenText" y "notes") de manera completa, exhaustiva y fiel (incluyendo títulos, subtítulos, párrafos completos, listas, definiciones, fórmulas, anotaciones al margen o texto manuscrito), organizada página a página o por secciones en Markdown limpio para que el estudiante pueda leer, editar y modificar libremente todo el documento dentro de la página de escritura de apuntes libre sin que se pierda ningún dato.

Devuelve en el JSON:
1. "title": Título principal detectado del documento o tema.
2. "detectedPageCount": Número entero de páginas detectadas en el archivo (mínimo 1).
3. "fullWrittenText": Transcripción completa e íntegra de toda la información escrita en el documento, lista para editar en el editor de apuntes libres (si tiene varias páginas, puedes indicar sutilmente "--- Página X ---" o sus encabezados originales).
4. "notes": El cuerpo completo de los apuntes bien formateado en Markdown con toda la información escrita.
5. "cues": Lista de 4 a 6 preguntas clave o términos detonadores para Active Recall.
6. "summary": Un resumen ejecutivo de 2-3 párrafos con lo fundamental para repasar.
7. "difficulty": Estimación de dificultad ("Baja", "Media" o "Alta").
8. "estimatedMinutes": Tiempo estimado en minutos para estudiar y dominar este documento.

${instructions ? `Instrucciones adicionales del usuario: ${instructions}` : ''}
Responde en español manteniendo toda la riqueza y detalle del texto original.`;

    const mediaParts = hasPageImages
      ? pageImages.slice(0, 12).map((img: string) => ({
          inlineData: {
            data: String(img).replace(/^data:[^;]+;base64,/, ''),
            mimeType: 'image/jpeg',
          },
        }))
      : [
          {
            inlineData: {
              data: String(base64Data).replace(/^data:[^;]+;base64,/, ''),
              mimeType,
            },
          },
        ];

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: {
        parts: [...mediaParts, { text: prompt }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            detectedPageCount: { type: Type.INTEGER },
            fullWrittenText: { type: Type.STRING },
            cues: { type: Type.ARRAY, items: { type: Type.STRING } },
            notes: { type: Type.STRING },
            summary: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            estimatedMinutes: { type: Type.INTEGER },
          },
          required: [
            'title',
            'detectedPageCount',
            'fullWrittenText',
            'cues',
            'notes',
            'summary',
            'difficulty',
            'estimatedMinutes',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    // Ensure notes and fullWrittenText are populated
    if (!parsed.fullWrittenText && parsed.notes) {
      parsed.fullWrittenText = parsed.notes;
    }
    if (!parsed.notes && parsed.fullWrittenText) {
      parsed.notes = parsed.fullWrittenText;
    }
    if (!parsed.detectedPageCount || parsed.detectedPageCount < 1) {
      parsed.detectedPageCount = clientPageCountHint && Number(clientPageCountHint) > 0 ? Number(clientPageCountHint) : 1;
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/gemini/ocr-notes:', error);
    res.status(500).json({ error: error.message || 'Error al procesar el archivo con IA.' });
  }
});

// 2. Generación automática de Flashcards basadas en apuntes o temario para Active Recall
app.post('/api/gemini/generate-flashcards', async (req: Request, res: Response) => {
  try {
    const {
      topicTitle,
      topicContent,
      notesContent,
      cues = [],
      summary = '',
      count = 6,
      difficulty = 'intermedio',
      focusArea = 'general',
      customInstructions = '',
    } = req.body;

    let focusGuidance = '';
    if (focusArea === 'definitions') {
      focusGuidance = 'Enfócate prioritariamente en definiciones exactas, terminología clave y conceptos fundamentales.';
    } else if (focusArea === 'deep_concepts') {
      focusGuidance = 'Enfócate en relaciones causa-efecto, comparaciones, mecanismos de acción y comprensión conceptual profunda.';
    } else if (focusArea === 'practical') {
      focusGuidance = 'Enfócate en aplicaciones prácticas, resolución de situaciones, fórmulas y casos de uso.';
    }

    const cuesContext = Array.isArray(cues) && cues.length > 0 ? `\nPreguntas detonadoras / Active Recall sugeridas por el alumno:\n- ${cues.join('\n- ')}` : '';
    const summaryContext = summary ? `\nResumen del estudiante:\n"""${summary}"""` : '';

    const prompt = `Actúa como un experto en neurociencia del aprendizaje y metodología Active Recall (recuperación activa con repetición espaciada).
Genera exactamente ${count} flashcards de estudio de máxima calidad sobre el contenido educativo: "${topicTitle}".
Dificultad objetivo: ${difficulty}.
${focusGuidance}
${customInstructions ? `Instrucciones adicionales del estudiante: ${customInstructions}` : ''}

Material de referencia (apuntes del estudiante o temario oficial):
"""
${notesContent || topicContent || topicTitle}
"""${summaryContext}${cuesContext}

Cada tarjeta debe cumplir rigurosamente:
1. question: Pregunta incisiva, sin ambigüedades, que obligue a recuperar el concepto de la memoria de largo plazo (evitar preguntas triviales o de simple sí/no).
2. answer: Respuesta clara, concisa y rigurosa (2-4 frases máximo) que explique el porqué esencial.
3. hint: Una pista sutil o mnemotecnia ingeniosa para activar el recuerdo si la persona se bloquea.
4. conceptTag: Subtema específico o etiqueta de concepto clave evaluado.`;

    let flashcards: any[] = [];
    try {
      const response = await generateContentWithFallback({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
                hint: { type: Type.STRING },
                conceptTag: { type: Type.STRING },
              },
              required: ['question', 'answer', 'hint', 'conceptTag'],
            },
          },
        },
      });
      flashcards = JSON.parse(response.text || '[]');
    } catch (aiErr: any) {
      console.warn('Fallback activated for /api/gemini/generate-flashcards:', aiErr?.message || aiErr);
    }

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      const rawText = String(notesContent || topicContent || topicTitle || 'Concepto académico');
      const lines = rawText
        .split(/\n+/)
        .map((l) => l.replace(/^[#*\->\d.\s]+/, '').trim())
        .filter((l) => l.length > 18);
      const total = Math.max(1, Math.min(20, Number(count) || 6));
      flashcards = Array.from({ length: total }, (_, idx) => {
        const snippet = lines[idx % Math.max(1, lines.length)] || `Fundamento esencial de ${topicTitle}`;
        const cueItem = Array.isArray(cues) && cues[idx] ? cues[idx] : `Concepto clave #${idx + 1}`;
        return {
          question:
            Array.isArray(cues) && cues[idx]
              ? `¿Cómo se define y aplica "${cues[idx]}" en el contexto de ${topicTitle}?`
              : `¿Cuál es el fundamento principal y relevancia académica de: "${snippet.slice(0, 85)}..."?`,
          answer: `${snippet}. En el estudio de ${topicTitle}, este principio permite articular la comprensión teórica y su aplicación práctica de nivel ${difficulty}.`,
          hint: `Recuerda la relación directa con ${cueItem} dentro de ${topicTitle}.`,
          conceptTag: topicTitle || 'Concepto Clave',
        };
      });
    }

    res.json({ success: true, data: flashcards });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-flashcards:', error);
    res.status(500).json({ error: error.message || 'Error al generar flashcards.' });
  }
});

// 2.1 Extracción automática de conceptos clave de apuntes Cornell y generación de mazo de flashcards con definiciones, ejemplos prácticos y situaciones de uso real
app.post('/api/gemini/extract-cornell-flashcards', async (req: Request, res: Response) => {
  try {
    const {
      subjectName = 'Asignatura Universitaria',
      topicTitle = 'Tema de Estudio',
      notesContent = '',
      cues = [],
      keyPoints = [],
      summary = '',
      selectedTerms = [],
      count = 6,
    } = req.body;

    const cuesText =
      Array.isArray(cues) && cues.length > 0
        ? `\nConceptos clave y preguntas detonadoras de la columna izquierda (Cues Cornell):\n- ${cues.join('\n- ')}`
        : '';
    const keyPointsText =
      Array.isArray(keyPoints) && keyPoints.length > 0
        ? `\nPuntos clave extraídos de los apuntes:\n- ${keyPoints
            .map((kp: any) =>
              typeof kp === 'string' ? kp : `${kp.title || ''}: ${kp.detail || ''}`
            )
            .join('\n- ')}`
        : '';
    const summaryText = summary
      ? `\nResumen inferior del método Cornell:\n"""${summary}"""`
      : '';

    const termsConstraint =
      Array.isArray(selectedTerms) && selectedTerms.length > 0
        ? `\nConceptos clave seleccionados prioritariamente para convertir en el mazo de flashcards:\n- ${selectedTerms.join('\n- ')}`
        : '';

    const prompt = `Actúa como un profesor universitario experto en pedagogía y metodología Active Recall.
Tu objetivo es tomar los conceptos clave extraídos de las notas de método Cornell sobre "${topicTitle}" (Asignatura: "${subjectName}") y generar automáticamente un mazo completo de flashcards de alto rendimiento.

Contenido de las notas Cornell del estudiante:
"""
${notesContent || topicTitle}
"""${cuesText}${keyPointsText}${summaryText}${termsConstraint}

Instrucciones pedagógicas obligatorias:
1. Toma los conceptos clave de las notas Cornell (priorizando la columna de Cues, puntos clave y términos seleccionados) y devuelve en "extractedTerms" la lista de conceptos clave detectados.
2. Genera exactamente ${count} flashcards de estudio siguiendo esta estructura obligatoria para cada concepto clave:
   - "term": Nombre exacto y claro del concepto clave extraído de las notas Cornell.
   - "definition": Definición teórica concisa, rigurosa y clara (2-3 frases) que explique qué es y cuál es su fundamento académico.
   - "practicalExample": Un ejemplo práctico concreto e ilustrativo (1-2 frases) que demuestre paso a paso cómo funciona, cómo se calcula o cómo se ejemplifica este concepto.
   - "realWorldScenario": Una situación de uso real (1-2 frases) en un contexto profesional, clínico, industrial, empresarial o de la vida real donde el estudiante vería o aplicaría este concepto.
   - "hint": Una pista nemotécnica o pregunta guía breve para activar la memoria sin revelar la respuesta completa.
   - "conceptTag": Categoría o subtema al que pertenece el concepto.
3. Redacta todo en español académico claro, directo y preciso.`;

    let parsedData: any = null;
    try {
      const response = await generateContentWithFallback({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedTerms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista de conceptos clave extraídos de las notas Cornell',
              },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    definition: { type: Type.STRING },
                    practicalExample: { type: Type.STRING },
                    realWorldScenario: { type: Type.STRING },
                    hint: { type: Type.STRING },
                    conceptTag: { type: Type.STRING },
                  },
                  required: [
                    'term',
                    'definition',
                    'practicalExample',
                    'realWorldScenario',
                    'hint',
                    'conceptTag',
                  ],
                },
              },
            },
            required: ['extractedTerms', 'flashcards'],
          },
        },
      });
      parsedData = JSON.parse(response.text || '{"extractedTerms":[],"flashcards":[]}');
    } catch (aiErr: any) {
      console.warn(
        'Fallback activated for /api/gemini/extract-cornell-flashcards:',
        aiErr?.message || aiErr
      );
    }

    if (
      !parsedData ||
      !Array.isArray(parsedData.flashcards) ||
      parsedData.flashcards.length === 0
    ) {
      const rawLines = String(notesContent || summary || topicTitle)
        .split(/\n+/)
        .map((l) => l.replace(/^[#*\->\d.\s]+/, '').trim())
        .filter((l) => l.length > 10);

      const kpTitles = Array.isArray(keyPoints)
        ? keyPoints
            .map((kp: any) => (typeof kp === 'string' ? kp : kp?.title))
            .filter(Boolean)
        : [];

      const termsSource =
        Array.isArray(selectedTerms) && selectedTerms.length > 0
          ? selectedTerms
          : Array.isArray(cues) && cues.length > 0
          ? [...cues, ...kpTitles]
          : kpTitles.length > 0
          ? kpTitles
          : rawLines
              .slice(0, Number(count) || 6)
              .map((l) => l.split(/[:.;,-]/)[0].trim().slice(0, 55));

      const total = Math.max(1, Math.min(15, Number(count) || 6));
      const fallbackCards = Array.from({ length: total }, (_, idx) => {
        const termName =
          termsSource[idx % Math.max(1, termsSource.length)] ||
          `${topicTitle} - Concepto Clave ${idx + 1}`;
        const contextSentence =
          rawLines[idx % Math.max(1, rawLines.length)] ||
          `Concepto fundamental dentro del bloque "${topicTitle}" en ${subjectName}.`;
        const practicalExample = `Ejemplo práctico: Al analizar un ejercicio de "${topicTitle}", se aplica "${termName}" para estructurar y demostrar el mecanismo principal paso a paso.`;
        const realWorldScenario = `Situación de uso real: En el ejercicio profesional de ${subjectName}, "${termName}" se emplea para diagnosticar, optimizar o resolver casos reales basados en evidencia.`;
        return {
          term: termName,
          definition: `${contextSentence}. Constituye un principio esencial de "${topicTitle}" que define su funcionamiento y relación con el resto del temario.`,
          practicalExample,
          realWorldScenario,
          practicalCase: `${practicalExample} ${realWorldScenario}`,
          hint: `Relaciona "${termName}" con el mecanismo central de ${topicTitle}.`,
          conceptTag: topicTitle,
        };
      });
      parsedData = {
        extractedTerms: fallbackCards.map((c) => c.term),
        flashcards: fallbackCards,
      };
    } else {
      parsedData.flashcards = parsedData.flashcards.map((card: any) => {
        const practicalExample =
          card.practicalExample ||
          card.practicalCase ||
          `Aplicación directa de ${card.term} en un caso práctico de ${topicTitle}.`;
        const realWorldScenario =
          card.realWorldScenario ||
          `Uso profesional de ${card.term} en escenarios reales de ${subjectName}.`;
        return {
          ...card,
          practicalExample,
          realWorldScenario,
          practicalCase:
            card.practicalCase || `${practicalExample}\n\n🌍 Situación real: ${realWorldScenario}`,
        };
      });
    }

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error in /api/gemini/extract-cornell-flashcards:', error);
    res
      .status(500)
      .json({ error: error.message || 'Error al extraer términos y generar flashcards.' });
  }
});

function buildQuizFallback(
  topicTitle: string,
  topicContent: string,
  examType: string = 'test',
  difficulty: string = 'intermedio',
  questionCount: number = 5
) {
  const cleanTitle = (topicTitle || 'Temario de la Asignatura').replace(/^Simulacro de [A-Z_]+:\s*/i, '').trim();
  const rawSource = String(topicContent || topicTitle || '').trim();

  // Extract topic blocks, subtopics, and meaningful sentences from the provided content
  const lines = rawSource
    .split(/\n+/)
    .map((l) => l.replace(/^[#*\->\s]+/, '').trim())
    .filter((l) => l.length > 0);

  const extractedTopics: { title: string; description: string; subtopics: string[]; notesSnippet: string }[] = [];
  let currentBlock: { title: string; description: string; subtopics: string[]; notesSnippet: string } | null = null;

  for (const line of lines) {
    if (/^TEMA:\s*/i.test(line)) {
      if (currentBlock) extractedTopics.push(currentBlock);
      currentBlock = {
        title: line.replace(/^TEMA:\s*/i, '').trim(),
        description: '',
        subtopics: [],
        notesSnippet: '',
      };
    } else if (currentBlock && /^Descripci[oó]n:\s*/i.test(line)) {
      currentBlock.description = line.replace(/^Descripci[oó]n:\s*/i, '').trim();
    } else if (currentBlock && /^Subtemas clave:\s*/i.test(line)) {
      currentBlock.subtopics = line
        .replace(/^Subtemas clave:\s*/i, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (currentBlock && /^Apuntes del tema:\s*/i.test(line)) {
      currentBlock.notesSnippet = line.replace(/^Apuntes del tema:\s*/i, '').trim();
    } else if (currentBlock) {
      currentBlock.notesSnippet = currentBlock.notesSnippet
        ? `${currentBlock.notesSnippet} ${line}`
        : line;
    }
  }
  if (currentBlock) extractedTopics.push(currentBlock);

  // Extract informative statements from raw text as well
  const sentences = rawSource
    .replace(/\n+/g, '. ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/^(TEMA|Descripción|Subtemas clave|Apuntes del tema):\s*/i, '').trim())
    .filter((s) => s.length >= 25 && s.length <= 260);

  const count = Math.max(1, Math.min(15, Number(questionCount) || 5));
  const questions = Array.from({ length: count }, (_, idx) => {
    const topicObj =
      extractedTopics.length > 0
        ? extractedTopics[idx % extractedTopics.length]
        : {
            title: cleanTitle,
            description: sentences[idx % Math.max(1, sentences.length)] || `Fundamentos teóricos y aplicados de ${cleanTitle}`,
            subtopics: [
              `Principios estructurales de ${cleanTitle}`,
              `Mecanismos y relaciones causales`,
              `Aplicación práctica y resolución de casos`,
            ],
            notesSnippet: sentences[(idx + 1) % Math.max(1, sentences.length)] || '',
          };

    const subtopicFocus =
      topicObj.subtopics.length > 0
        ? topicObj.subtopics[idx % topicObj.subtopics.length]
        : topicObj.title;

    const coreStatement =
      topicObj.notesSnippet && topicObj.notesSnippet.length > 30
        ? topicObj.notesSnippet.slice(0, 220)
        : topicObj.description && topicObj.description.length > 20
        ? topicObj.description
        : sentences[idx % Math.max(1, sentences.length)] ||
          `El dominio de ${subtopicFocus} dentro de ${topicObj.title} requiere integrar sus principios teóricos, condiciones de validez y criterios de aplicación sistemática.`;

    const correctIdx = idx % 4;

    if (examType === 'test') {
      const correctOptionText = `${coreStatement.replace(/\.$/, '')}, integrando rigurosamente los fundamentos de "${subtopicFocus}" en el marco de ${topicObj.title}.`;
      const distractors = [
        `Se limita exclusivamente a una descripción superficial sin relación funcional ni causal con ${subtopicFocus}, descartando las variables críticas del sistema.`,
        `Invalida los principios base de ${topicObj.title} al asumir que ${subtopicFocus} opera de forma aislada e independiente de las condiciones de contorno.`,
        `Confunde el mecanismo principal de ${subtopicFocus} con un efecto secundario transitorio que solo ocurre fuera de las condiciones normales de estudio.`,
      ];

      const options: string[] = [];
      const optionExplanations: string[] = [];
      let dPointer = 0;

      for (let optIdx = 0; optIdx < 4; optIdx++) {
        if (optIdx === correctIdx) {
          options.push(correctOptionText);
          optionExplanations.push(
            `CORRECTA: Recoge con precisión conceptual la relación entre "${subtopicFocus}" y los fundamentos de "${topicObj.title}" según el temario seleccionado.`
          );
        } else {
          const dText = distractors[dPointer++];
          options.push(dText);
          optionExplanations.push(
            `INCORRECTA: Es un distractor conceptual porque introduce una reducción o inversión errónea respecto al funcionamiento real de "${subtopicFocus}".`
          );
        }
      }

      const questionTemplates = [
        `En relación con "${topicObj.title}" y específicamente el análisis de "${subtopicFocus}", ¿cuál de las siguientes afirmaciones es académicamente correcta?`,
        `Considerando los fundamentos estudiados en "${topicObj.title}", ¿qué proposición describe con mayor rigor técnico el concepto de "${subtopicFocus}"?`,
        `Dentro del bloque temático "${topicObj.title}", al evaluar las implicaciones de "${subtopicFocus}" (nivel ${difficulty}), señale la opción verdadera:`,
        `Desde una perspectiva analítica sobre "${topicObj.title}", ¿cómo se caracteriza correctamente el elemento "${subtopicFocus}" según los apuntes de la materia?`,
        `Si se plantea un supuesto evaluativo sobre "${subtopicFocus}" en el contexto de "${topicObj.title}", ¿cuál es la conclusión válida?`,
      ];

      return {
        id: `q-${idx + 1}`,
        prompt: questionTemplates[idx % questionTemplates.length],
        options,
        correctOptionIndex: correctIdx,
        explanation: `La respuesta correcta es la ${String.fromCharCode(65 + correctIdx)}. En el estudio de "${topicObj.title}", "${subtopicFocus}" se fundamenta en que: ${coreStatement}`,
        optionExplanations,
        keyPoints: [
          `Definición y alcance de ${subtopicFocus}`,
          `Relación funcional dentro de ${topicObj.title}`,
          `Diferenciación frente a interpretaciones incompletas`,
        ],
        rubricCriteria: [
          'Identificación precisa del concepto nuclear (40%)',
          'Discriminación de distractores metodológicos (30%)',
          'Coherencia con el temario oficial (30%)',
        ],
      };
    }

    if (examType === 'verdadero_falso') {
      const isTrueStatement = idx % 2 === 0;
      const statementText = isTrueStatement
        ? `En relación con "${topicObj.title}" (${subtopicFocus}): ${coreStatement.replace(/\.$/, '')}.`
        : `En relación con "${topicObj.title}", el concepto de "${subtopicFocus}" actúa de forma completamente independiente e inversa a las condiciones principales del sistema, careciendo de vínculo funcional con el resto del tema.`;

      const correctOptionIndex = isTrueStatement ? 0 : 1;
      return {
        id: `q-vf-${idx + 1}`,
        questionType: 'verdadero_falso',
        prompt: statementText,
        options: ['Verdadero', 'Falso'],
        correctOptionIndex,
        explanation: isTrueStatement
          ? `VERDADERO: La afirmación recoge fielmente el fundamento de "${subtopicFocus}" dentro de "${topicObj.title}": ${coreStatement}`
          : `FALSO: La afirmación es incorrecta porque "${subtopicFocus}" sí está estrechamente integrado en "${topicObj.title}". En realidad: ${coreStatement}`,
        optionExplanations: [
          isTrueStatement
            ? `CORRECTA (Verdadero): Coincide con la definición y los apuntes de "${subtopicFocus}".`
            : `INCORRECTA (Verdadero): La proposición invierte el sentido real de "${subtopicFocus}".`,
          !isTrueStatement
            ? `CORRECTA (Falso): Detecta correctamente la contradicción conceptual planteada en el enunciado.`
            : `INCORRECTA (Falso): El enunciado sí era verdadero según el temario de "${topicObj.title}".`,
        ],
        keyPoints: [
          `Veracidad conceptual sobre ${subtopicFocus}`,
          `Fundamento en ${topicObj.title}`,
        ],
        rubricCriteria: [
          'Identificación correcta de Verdadero o Falso (60%)',
          'Comprensión de la justificación conceptual (40%)',
        ],
      };
    }

    if (examType === 'preguntas_cortas') {
      return {
        id: `q-${idx + 1}`,
        prompt: `Defina de forma concisa y rigurosa el concepto de "${subtopicFocus}" dentro del tema "${topicObj.title}" e indique su relevancia principal.`,
        options: [],
        correctOptionIndex: -1,
        explanation: `Respuesta modelo: "${subtopicFocus}" en el contexto de "${topicObj.title}" se define por: ${coreStatement}. Su importancia radica en estructurar la comprensión operativa de los subtemas asociados (${topicObj.subtopics.slice(0, 3).join(', ') || topicObj.title}).`,
        optionExplanations: [],
        keyPoints: [
          `Definición exacta de ${subtopicFocus}`,
          `Vínculo directo con ${topicObj.title}`,
          `Aplicación o consecuencia clave`,
        ],
        rubricCriteria: [
          'Precisión terminológica en la definición (50%)',
          'Síntesis clara y directa sin ambigüedades (30%)',
          'Mención del impacto o función principal (20%)',
        ],
      };
    }

    if (examType === 'calculo') {
      return {
        id: `q-${idx + 1}`,
        prompt: `Problema aplicado (${topicObj.title} - ${subtopicFocus}): Dado un escenario cuantitativo donde el parámetro base de referencia de "${subtopicFocus}" experimenta una variación del ${15 + idx * 5}% respecto a su valor nominal (${100 * (idx + 1)} unidades), determine el valor resultante, explicite la relación funcional aplicable y justifique el significado físico/técnico del resultado.`,
        options: [],
        correctOptionIndex: -1,
        explanation: `Resolución paso a paso:\n1) Datos iniciales: Valor nominal V₀ = ${100 * (idx + 1)} unidades; variación Δ = +${15 + idx * 5}%.\n2) Fórmula aplicable: V_f = V₀ · (1 + Δ/100).\n3) Sustitución y cálculo: V_f = ${100 * (idx + 1)} · ${(1 + (15 + idx * 5) / 100).toFixed(2)} = ${Math.round(100 * (idx + 1) * (1 + (15 + idx * 5) / 100))} unidades.\n4) Interpretación en "${subtopicFocus}": ${coreStatement}`,
        optionExplanations: [],
        keyPoints: [
          `Planteamiento explícito de datos y fórmula de variación en ${subtopicFocus}`,
          `Desarrollo aritmético intermedio sin errores de escala`,
          `Resultado final (${Math.round(100 * (idx + 1) * (1 + (15 + idx * 5) / 100))} unidades) con interpretación conceptual`,
        ],
        rubricCriteria: [
          'Identificación de variables y formulación matemática (35%)',
          'Exactitud en el desarrollo numérico (35%)',
          'Interpretación técnica aplicada al tema (30%)',
        ],
      };
    }

    if (examType === 'practico') {
      return {
        id: `q-${idx + 1}`,
        prompt: `Caso Práctico #${idx + 1} (${topicObj.title}): En un entorno profesional o de laboratorio se requiere aplicar los principios de "${subtopicFocus}" para resolver una incidencia crítica relacionada con: "${coreStatement}". Diseñe el protocolo de actuación paso a paso, justifique las decisiones técnicas y especifique los indicadores de control.`,
        options: [],
        correctOptionIndex: -1,
        explanation: `Resolución del caso práctico:\n1) Diagnóstico inicial basado en "${topicObj.title}": identificación de las variables críticas de ${subtopicFocus}.\n2) Intervención metodológica: aplicación secuencial de los fundamentos (${topicObj.subtopics.join(', ') || subtopicFocus}).\n3) Verificación y control de calidad: comprobación de resultados frente al criterio rector (${coreStatement}).`,
        optionExplanations: [],
        keyPoints: [
          `Diagnóstico riguroso del supuesto en torno a ${subtopicFocus}`,
          `Secuencia operativa de resolución fundamentada en ${topicObj.title}`,
          `Indicadores de verificación y prevención de errores`,
        ],
        rubricCriteria: [
          'Viabilidad y rigor del diagnóstico inicial (30%)',
          'Aplicación práctica de los conceptos del temario (40%)',
          'Justificación de medidas de control y conclusiones (30%)',
        ],
      };
    }

    if (examType === 'oral') {
      return {
        id: `q-${idx + 1}`,
        prompt: `Defensa Oral #${idx + 1}: Exponga en voz alta y con estructura académica rigurosa el tema "${subtopicFocus}" integrado en "${topicObj.title}", conectando su definición formal, sus mecanismos principales y un ejemplo aplicado.`,
        options: [],
        correctOptionIndex: -1,
        explanation: `Guion de excelencia para defensa oral:\n- Apertura: Contextualización de "${subtopicFocus}" dentro de "${topicObj.title}".\n- Desarrollo nuclear: ${coreStatement}\n- Cierre sintético: Conclusión sobre su importancia en el conjunto de la asignatura.`,
        optionExplanations: [],
        keyPoints: [
          `Contextualización introductoria de ${topicObj.title}`,
          `Explicación técnica de ${subtopicFocus}`,
          `Ejemplo práctico y conclusión estructurada`,
        ],
        rubricCriteria: [
          'Claridad expositiva y orden lógico del discurso (30%)',
          'Dominio de la terminología técnica (40%)',
          'Capacidad de síntesis y ejemplificación (30%)',
        ],
      };
    }

    // Default: desarrollo / mixto
    return {
      id: `q-${idx + 1}`,
      prompt: `Desarrolle de forma estructurada y exhaustiva el epígrafe "${subtopicFocus}" correspondiente al bloque "${topicObj.title}". Analice sus fundamentos teóricos, interrelaciones con (${topicObj.subtopics.slice(0, 3).join(', ') || 'los conceptos adyacentes del tema'}) y sus aplicaciones principales.`,
      options: [],
      correctOptionIndex: -1,
      explanation: `Síntesis de la respuesta de desarrollo:\n1. Introducción y marco conceptual de "${topicObj.title}".\n2. Análisis profundo de "${subtopicFocus}": ${coreStatement}\n3. Interrelación sistémica y conclusiones aplicadas de nivel ${difficulty}.`,
      optionExplanations: [],
      keyPoints: [
        `Introducción y definición marco de ${topicObj.title}`,
        `Desarrollo técnico detallado de ${subtopicFocus}`,
        `Análisis crítico, relaciones conceptuales y conclusión`,
      ],
      rubricCriteria: [
        'Estructura académica (introducción, desarrollo y conclusión) (25%)',
        'Profundidad conceptual y exactitud técnica (50%)',
        'Ejemplificación y madurez argumentativa (25%)',
      ],
    };
  });

  return {
    examTitle: topicTitle || `Simulacro de ${examType.toUpperCase()}: ${cleanTitle}`,
    examType,
    difficulty,
    questions,
  };
}

// 3. Generación de Cuestionarios Personalizados según tipo de examen (test, oral, desarrollo, preguntas_cortas, calculo, practico)
app.post('/api/gemini/generate-quiz', async (req: Request, res: Response) => {
  try {
    const {
      topicTitle,
      topicContent,
      examType = 'test',
      difficulty = 'intermedio',
      questionCount = 5,
      forceRefresh = false,
    } = req.body;

    const trimmedContent = String(topicContent || topicTitle || 'Temario general de la asignatura')
      .trim()
      .slice(0, 9000);
    const cacheKey = `${topicTitle}_${examType}_${difficulty}_${questionCount}_${trimmedContent.length}_${trimmedContent.slice(0, 180)}`;

    if (!forceRefresh && quizGenerationCache.has(cacheKey)) {
      res.json({ success: true, data: quizGenerationCache.get(cacheKey), cached: true });
      return;
    }

    let examInstructions = '';
    if (examType === 'test') {
      examInstructions = `Genera preguntas tipo test de opción múltiple (4 opciones A, B, C, D), índice correcto (0-3), "explanation" concisa (1-2 frases) y "optionExplanations" con 4 textos breves y directos (1 frase por opción indicando por qué acierta o falla).`;
    } else if (examType === 'verdadero_falso') {
      examInstructions = `Genera afirmaciones académicas rigurosas de Verdadero o Falso sobre los apuntes. Para cada pregunta, "options" DEBE ser exactamente ["Verdadero", "Falso"], "correctOptionIndex" debe ser 0 (si es Verdadero) o 1 (si es Falso), "explanation" debe justificar con precisión por qué es verdadero o falso según el temario, y "optionExplanations" debe tener 2 frases explicando la opción Verdadero y la opción Falso.`;
    } else if (examType === 'oral') {
      examInstructions = `Genera preguntas para examen oral. Incluye puntos clave indispensables ("keyPoints") y criterios breves de fluidez.`;
    } else if (examType === 'preguntas_cortas') {
      examInstructions = `Genera preguntas de respuesta corta y directa. En explanation pon la respuesta modelo concisa y en keyPoints 2-3 conceptos clave. options debe ser [].`;
    } else if (examType === 'calculo') {
      examInstructions = `Genera ejercicios prácticos de cálculo/aplicación. En explanation incluye pasos y resultado final; en keyPoints la fórmula y valor final. options debe ser [].`;
    } else if (examType === 'practico') {
      examInstructions = `Genera casos prácticos aplicados. En prompt plantea el supuesto; en explanation la resolución paso a paso; en keyPoints los criterios clave. options debe ser [].`;
    } else {
      examInstructions = `Genera preguntas de desarrollo. Incluye rúbrica concisa y puntos clave en keyPoints. options debe ser [].`;
    }

    const prompt = `Eres un profesor universitario experto. Crea un examen ágil, preciso y riguroso sobre "${topicTitle}".
Formato: ${examType} | Dificultad: ${difficulty} | Nº preguntas: ${questionCount}.
Instrucciones: ${examInstructions}
Sé directo y conciso para generar el cuestionario con máxima velocidad y rigor.

Contenido base:
"""${trimmedContent}"""`;

    let quizData: any = null;
    try {
      const response = await generateContentWithFallback({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature: 0.35,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              examTitle: { type: Type.STRING },
              examType: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctOptionIndex: {
                      type: Type.INTEGER,
                    },
                    explanation: { type: Type.STRING },
                    optionExplanations: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    keyPoints: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    rubricCriteria: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['id', 'prompt', 'explanation'],
                },
              },
            },
            required: ['examTitle', 'examType', 'difficulty', 'questions'],
          },
        },
      });

      quizData = JSON.parse(response.text || '{}');
    } catch (aiError: any) {
      console.warn('Fallback activated for /api/gemini/generate-quiz:', aiError?.message || aiError);
      quizData = buildQuizFallback(topicTitle, topicContent, examType, difficulty, questionCount);
    }

    if (!quizData || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      quizData = buildQuizFallback(topicTitle, topicContent, examType, difficulty, questionCount);
    } else {
      quizGenerationCache.set(cacheKey, quizData);
    }

    res.json({ success: true, data: quizData });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-quiz:', error);
    const fallback = buildQuizFallback(
      req.body?.topicTitle || 'Examen de Práctica',
      req.body?.topicContent || '',
      req.body?.examType || 'test',
      req.body?.difficulty || 'intermedio',
      req.body?.questionCount || 5
    );
    res.json({ success: true, data: fallback });
  }
});

// 3.1 Evaluación con IA de respuestas abiertas y orales de examen
app.post('/api/gemini/evaluate-open-answer', async (req: Request, res: Response) => {
  try {
    const { questionPrompt, userAnswer, examType = 'desarrollo', keyPoints = [], rubricCriteria = [], difficulty = 'intermedio' } = req.body;

    if (!userAnswer || !questionPrompt) {
      res.status(400).json({ error: 'Falta questionPrompt o userAnswer' });
      return;
    }

    const prompt = `Actúa como un profesor universitario y corrector exigente pero pedagógico.
Evalúa la respuesta dada por el estudiante a la siguiente pregunta de examen:

Pregunta: "${questionPrompt}"
Tipo de Examen: ${examType} (oral, desarrollo, preguntas_cortas, o calculo)
Dificultad esperada: ${difficulty}
Puntos clave de referencia: ${JSON.stringify(keyPoints)}
Rúbrica de corrección: ${JSON.stringify(rubricCriteria)}

Respuesta escrita o simulada por el estudiante:
"""${userAnswer}"""

Evalúa objetivamente:
1. score (0 a 100): Calificación porcentual según completitud, rigor técnico y adecuación a la rúbrica.
2. strengths: Lista de 2-4 puntos fuertes, aciertos conceptuales o buena estructuración en la respuesta.
3. missingPoints: Lista de conceptos clave, términos obligatorios o explicaciones que faltaron o fueron imprecisas.
4. feedback: Comentario pedagógico detallado con consejos para la defensa del examen real.
5. modelAnswer: Una respuesta modelo breve y perfecta (de 10 sobre 10) que el estudiante pueda memorizar o usar de referencia.`;

    let evaluation: any = null;
    try {
      const response = await generateContentWithFallback({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              feedback: { type: Type.STRING },
              modelAnswer: { type: Type.STRING },
            },
            required: ['score', 'strengths', 'missingPoints', 'feedback', 'modelAnswer'],
          },
        },
      });

      evaluation = JSON.parse(response.text || '{}');
    } catch (aiErr: any) {
      console.warn('Fallback activated for /api/gemini/evaluate-open-answer:', aiErr?.message || aiErr);
      const words = String(userAnswer).trim().split(/\s+/).filter(Boolean);
      const lowerAnswer = String(userAnswer).toLowerCase();
      const refPoints: string[] = Array.isArray(keyPoints) && keyPoints.length > 0
        ? keyPoints
        : ['Definición conceptual rigurosa', 'Desarrollo estructurado del mecanismo principal', 'Aplicación o ejemplo práctico'];

      const matched = refPoints.filter((kp) => {
        const tokens = String(kp)
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 4);
        return tokens.some((t) => lowerAnswer.includes(t));
      });
      const missing = refPoints.filter((kp) => !matched.includes(kp));
      const lengthScore = Math.min(45, Math.round(words.length * 1.2));
      const coverageScore = refPoints.length > 0 ? Math.round((matched.length / refPoints.length) * 55) : 45;
      const computedScore = Math.max(25, Math.min(96, lengthScore + coverageScore));

      evaluation = {
        score: computedScore,
        strengths:
          matched.length > 0
            ? matched.map((m) => `Aborda adecuadamente: ${m}`)
            : ['Presenta una aproximación inicial coherente al enunciado planteado', 'Estructura comprensible de la respuesta'],
        missingPoints:
          missing.length > 0
            ? missing.map((m) => `Profundizar con mayor precisión técnica en: ${m}`)
            : ['Añadir un ejemplo comparativo adicional para alcanzar la máxima calificación'],
        feedback: `Tu respuesta contiene ${words.length} palabras y cubre ${matched.length} de ${refPoints.length} ejes clave evaluados. Para optimizar tu puntuación en un examen universitario de nivel ${difficulty}, asegúrate de explicitar todos los términos de la rúbrica y conectar la definición con su aplicación práctica.`,
        modelAnswer: `En respuesta a "${questionPrompt}", es fundamental establecer primero el marco conceptual, desarrollar secuencialmente los puntos clave (${refPoints.join('; ')}) y concluir con su implicación práctica demostrada.`,
      };
    }

    res.json({ success: true, data: evaluation });
  } catch (error: any) {
    console.error('Error in /api/gemini/evaluate-open-answer:', error);
    res.status(500).json({ error: error.message || 'Error al evaluar la respuesta con IA.' });
  }
});

// 4. Técnica de Feynman (FeynmanChallenge): Evaluación con IA de simplicidad, precisión y correcciones de conceptos mal explicados
app.post(['/api/gemini/evaluate-feynman', '/api/gemini/feynman-challenge'], async (req: Request, res: Response) => {
  try {
    const {
      concept,
      subtopics = [],
      subjectName = '',
      explanation,
      targetAudience = 'un estudiante que empieza desde cero o un niño de 12 años',
      referenceContent = '',
    } = req.body;

    if (!concept || !explanation) {
      res.status(400).json({ error: 'Se requiere el tema/concepto y la explicación del usuario.' });
      return;
    }

    const subtopicsBlock =
      Array.isArray(subtopics) && subtopics.length > 0
        ? `\nSubtemas o puntos clave del tema: ${subtopics.join(', ')}`
        : '';

    const refBlock = referenceContent
      ? `\nMaterial de referencia oficial (apuntes/temario de la asignatura) para verificar la precisión conceptual:\n"""${String(referenceContent).slice(0, 14000)}"""`
      : '';

    const prompt = `Actúa como un mentor experto en la Técnica de Feynman y profesor universitario de "${subjectName || 'la materia'}".
El estudiante está realizando el "Reto Feynman" (FeynmanChallenge): explicar un tema con sus propias palabras de forma simple, intuitiva y rigurosamente precisa.

Tema / Concepto evaluado: "${concept}"${subtopicsBlock}
Audiencia objetivo: "${targetAudience}"${refBlock}

Explicación redactada por el estudiante con sus propias palabras:
"""${explanation}"""

Analiza minuciosamente si la explicación del estudiante es SIMPLE y PRECISA, y detecta cualquier concepto mal explicado, confuso, inexacto o que abuse de tecnicismos sin entenderlos.

Devuelve un JSON estructurado con:
1. "simplicityScore" (0 a 100): Qué tan simple, clara, directa y fácil de entender es la explicación (lenguaje natural, uso de ejemplos/analogías, ausencia de jerga vacía).
2. "clarityScore" (0 a 100): Equivalente a simplicityScore para compatibilidad (claridad expositiva).
3. "accuracyScore" (0 a 100): Qué tan precisa, rigurosa y libre de errores conceptuales es la explicación respecto al tema real.
4. "overallScore" (0 a 100): Puntuación global del Reto Feynman (promedio ponderado entre simplicidad y precisión).
5. "corrections": Lista detallada de correcciones para cada concepto mal explicado, erróneo, confuso o demasiado enrevesado que hayas detectado en el texto del usuario (si la explicación tiene fallos, imprecisiones o partes confusas, incluye entre 1 y 5 correcciones concretas). Cada objeto debe tener:
   - "concept": Nombre del concepto o idea específica que el usuario explicó mal o de forma confusa.
   - "userMistake": Qué dijo el usuario o por qué su explicación de este punto es incorrecta, incompleta o innecesariamente compleja.
   - "correction": Cómo debería explicarse este concepto de forma simple, precisa y correcta con palabras sencillas.
   - "severity": Clasificación del problema: "error_conceptual" (si el dato o mecanismo es falso/erróneo), "imprecision" (si está incompleto o ambiguo) o "exceso_jerga" (si repite palabras técnicas de memoria sin explicarlas de forma simple).
6. "strengths": Lista de 2 a 4 aciertos o ideas que el estudiante sí logró explicar con sencillez y precisión.
7. "identifiedJargon": Lista de términos técnicos o palabras complejas que usó sin explicar con lenguaje sencillo.
8. "conceptualGaps": Lista de ideas fundamentales del tema o subtemas que omitió o dejó en el aire.
9. "deepDiveSuggestions": Lista de 2 a 4 recomendaciones concretas para profundizar y dominar el tema al 100%.
10. "intuitiveAnalogies": 2 analogías cotidianas y memorables para explicar este tema de forma cristalina.
11. "improvedDraft": Una versión modelo ideal (2-3 párrafos) que explique el tema de forma simple, precisa y magistral aplicando el método Feynman.
12. "followUpQuestions": 2 o 3 preguntas socráticas breves que obliguen al estudiante a reflexionar sobre los puntos flojos detectados.
13. "feedback": Diagnóstico pedagógico directo y motivador sobre la simplicidad y precisión de su explicación.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            simplicityScore: { type: Type.INTEGER },
            clarityScore: { type: Type.INTEGER },
            accuracyScore: { type: Type.INTEGER },
            overallScore: { type: Type.INTEGER },
            corrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  concept: { type: Type.STRING },
                  userMistake: { type: Type.STRING },
                  correction: { type: Type.STRING },
                  severity: { type: Type.STRING },
                },
                required: ['concept', 'userMistake', 'correction', 'severity'],
              },
            },
            deepDiveSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            identifiedJargon: { type: Type.ARRAY, items: { type: Type.STRING } },
            conceptualGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
            intuitiveAnalogies: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvedDraft: { type: Type.STRING },
            followUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            feedback: { type: Type.STRING },
          },
          required: [
            'simplicityScore',
            'clarityScore',
            'accuracyScore',
            'overallScore',
            'corrections',
            'deepDiveSuggestions',
            'strengths',
            'identifiedJargon',
            'conceptualGaps',
            'intuitiveAnalogies',
            'improvedDraft',
            'followUpQuestions',
            'feedback',
          ],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in /api/gemini/evaluate-feynman:', error);
    res.status(500).json({ error: error.message || 'Error al evaluar la explicación con la técnica Feynman.' });
  }
});

// 4.1 Explicación Simplificada de Conceptos Complejos (Técnica Feynman)
app.post('/api/gemini/explain-concept', async (req: Request, res: Response) => {
  try {
    const { concept, context = '', targetAudience = 'un estudiante o principiante' } = req.body;
    if (!concept) {
      res.status(400).json({ error: 'Falta el concepto a explicar.' });
      return;
    }

    const prompt = `Aplica la Técnica de Feynman para explicar este concepto complejo de manera extremadamente clara, intuitiva y fácil de asimilar.
Concepto: "${concept}"
Contexto o asignatura: "${context}"
Audiencia objetivo: "${targetAudience}"

Estructura requerida:
1. title: Nombre del concepto.
2. intuitiveExplanation: Explicación en lenguaje cotidiano, directa y cautivadora (2-3 párrafos comprensibles sin tecnicismos oscuros).
3. coreAnalogy: Una analogía de la vida cotidiana inolvidable para visualizar el concepto.
4. keyPrinciples: 3 a 5 ideas o puntos clave indispensables.
5. commonPitfalls: 2 confusiones o errores habituales al entender este tema.
6. oneLineSummary: Síntesis memorable en una única frase clara.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            intuitiveExplanation: { type: Type.STRING },
            coreAnalogy: { type: Type.STRING },
            keyPrinciples: { type: Type.ARRAY, items: { type: Type.STRING } },
            commonPitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
            oneLineSummary: { type: Type.STRING },
          },
          required: ['title', 'intuitiveExplanation', 'coreAnalogy', 'keyPrinciples', 'commonPitfalls', 'oneLineSummary'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/gemini/explain-concept:', error);
    res.status(500).json({ error: error.message || 'Error al generar la explicación del concepto.' });
  }
});

// 4.2 Speech-to-Text (Transcripción de Explicaciones Orales con gemini-3.5-transcribe)
app.post('/api/gemini/speech-to-text', async (req: Request, res: Response) => {
  try {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      concept = '',
      subjectName = '',
      clientTranscriptFallback = '',
    } = req.body;

    if (!audioBase64 && !clientTranscriptFallback) {
      res.status(400).json({ error: 'Se requiere el audio grabado para transcribir.' });
      return;
    }

    if (!audioBase64 && clientTranscriptFallback) {
      res.json({
        success: true,
        data: {
          transcription: String(clientTranscriptFallback).trim(),
          modelUsed: 'web-speech-api',
        },
      });
      return;
    }

    const cleanBase64 = String(audioBase64).replace(/^data:[^;]+;base64,/, '');
    const contextHint = concept
      ? ` El audio es una explicación académica en español sobre "${concept}"${
          subjectName ? ` de la asignatura "${subjectName}"` : ''
        }.`
      : ' El audio es una explicación académica en español.';

    let transcriptionText = '';
    try {
      const transcribeResp = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: cleanBase64,
              },
            },
            {
              text: `Transcribe este audio de forma exacta, íntegra y fiel en español.${contextHint} Devuelve únicamente el texto transcrito con puntuación natural, sin comentarios adicionales.`,
            },
          ],
        },
      });
      transcriptionText = (transcribeResp.text || '').trim();
    } catch (transcribeErr) {
      // Fallback al modelo multimodal principal si gemini-3.5-transcribe no está disponible temporalmente
      const fallbackResp = await generateContentWithFallback({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: cleanBase64,
              },
            },
            {
              text: `Transcribe exactamente lo que dice el estudiante en este audio en español.${contextHint} Devuelve solo la transcripción textual.`,
            },
          ],
        },
      });
      transcriptionText = (fallbackResp.text || '').trim();
    }

    if (!transcriptionText && clientTranscriptFallback) {
      transcriptionText = String(clientTranscriptFallback).trim();
    }

    res.json({
      success: true,
      data: {
        transcription: transcriptionText,
        modelUsed: 'gemini-3.5-transcribe',
      },
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/speech-to-text:', error);
    const fallbackText = String(req.body?.clientTranscriptFallback || '').trim();
    if (fallbackText) {
      res.json({
        success: true,
        data: {
          transcription: fallbackText,
          modelUsed: 'fallback-transcript',
        },
      });
      return;
    }
    res.status(500).json({
      error: error.message || 'Error al convertir la explicación oral en texto mediante Speech-to-Text.',
    });
  }
});

// 4.2b Evaluación de Explicación Oral por Audio: Speech-to-Text + Análisis Gemini de Conceptos Mal Entendidos (Técnica Feynman)
app.post('/api/gemini/evaluate-audio-feynman', async (req: Request, res: Response) => {
  try {
    const {
      concept,
      subtopics = [],
      subjectName = '',
      audioBase64,
      mimeType = 'audio/webm',
      liveTranscript = '',
      targetAudience = 'un estudiante o principiante',
      referenceContent = '',
    } = req.body;

    if (!audioBase64 && !liveTranscript) {
      res.status(400).json({ error: 'Falta la grabación de audio o transcripción oral.' });
      return;
    }

    const cleanBase64 = audioBase64 ? String(audioBase64).replace(/^data:[^;]+;base64,/, '') : '';

    // Paso 1: Convertir la explicación oral en texto mediante gemini-3.5-transcribe (Speech-to-Text)
    let speechToTextTranscript = String(liveTranscript || '').trim();
    if (cleanBase64) {
      try {
        const sttResponse = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: cleanBase64,
                },
              },
              {
                text: `Transcribe de manera íntegra, literal y precisa esta explicación oral en español sobre "${concept}". Devuelve únicamente la transcripción.`,
              },
            ],
          },
        });
        const sttText = (sttResponse.text || '').trim();
        if (sttText.length >= speechToTextTranscript.length * 0.6) {
          speechToTextTranscript = sttText;
        }
      } catch (_) {
        // Si falla el paso dedicado de STT, el análisis multimodal inferior transcribirá directamente el audio
      }
    }

    const subtopicsBlock =
      Array.isArray(subtopics) && subtopics.length > 0
        ? `\nSubtemas del programa oficial: ${subtopics.join(', ')}`
        : '';

    const refBlock = referenceContent
      ? `\nMaterial de referencia del temario y apuntes para verificar precisión conceptual:\n"""${String(referenceContent).slice(0, 12000)}"""`
      : '';

    const sttBlock = speechToTextTranscript
      ? `\nTranscripción Speech-to-Text obtenida de la explicación oral del estudiante:\n"""${speechToTextTranscript}"""`
      : '';

    const prompt = `Actúa como un mentor experto en la Técnica de Feynman y profesor de "${subjectName || 'la asignatura'}".
El estudiante acaba de realizar una EXPLICACIÓN ORAL sobre el tema/concepto: "${concept}".${subtopicsBlock}
Audiencia objetivo a la que se dirige: "${targetAudience}".${sttBlock}${refBlock}

Tu misión es:
1. Confirmar o completar la transcripción exacta de la explicación oral ("transcription").
2. Analizar a fondo la calidad de la explicación aplicando la Técnica de Feynman (Simplicidad + Precisión).
3. Identificar AUTOMÁTICAMENTE todos los CONCEPTOS MAL ENTENDIDOS, confusiones conceptuales, relaciones causa-efecto erróneas, imprecisiones o tecnicismos mal empleados por el estudiante ("corrections").

Devuelve un JSON con:
1. "transcription": Transcripción textual completa y fiel de la explicación oral del estudiante.
2. "simplicityScore" (0 a 100): Claridad, naturalidad oral, sencillez expositiva y uso de ejemplos comprensibles.
3. "clarityScore" (0 a 100): Equivalente a simplicityScore.
4. "accuracyScore" (0 a 100): Rigor académico y ausencia de errores conceptuales frente al temario real.
5. "overallScore" (0 a 100): Puntuación global combinada del reto oral Feynman.
6. "oralDeliveryFeedback": Evaluación específica de la expresión oral (estructura del discurso hablado, ritmo, claridad al conectar ideas y seguridad conceptual).
7. "corrections": Lista detallada de CONCEPTOS MAL ENTENDIDOS o explicados de forma confusa/inexacta detectados automáticamente (incluye entre 1 y 5 elementos si hay cualquier error, confusión o idea incompleta). Cada elemento debe incluir:
   - "concept": Nombre del concepto mal entendido o explicado de forma imprecisa.
   - "userMistake": Qué dijo exactamente el estudiante en su explicación oral y por qué demuestra un malentendido, confusión o falta de claridad.
   - "correction": Explicación corregida, sencilla, intuitiva y 100% rigurosa según el método Feynman.
   - "severity": "error_conceptual" (concepto mal entendido o falso), "imprecision" (idea incompleta o ambigua) o "exceso_jerga" (repite tecnicismos sin explicar su significado real).
8. "strengths": Lista de 2 a 4 aciertos o conceptos que el estudiante explicó muy bien oralmente.
9. "identifiedJargon": Lista de términos técnicos empleados sin explicar en lenguaje llano.
10. "conceptualGaps": Lagunas de conocimiento o subtemas del temario que olvidó mencionar en su exposición oral.
11. "deepDiveSuggestions": 2 a 3 recomendaciones prácticas para corregir los conceptos mal entendidos.
12. "intuitiveAnalogies": 2 analogías cotidianas y memorables para interiorizar los conceptos corregidos.
13. "improvedDraft": Guion o explicación modelo ideal (2-3 párrafos) explicada de forma simple y magistral.
14. "followUpQuestions": 2 o 3 preguntas socráticas directas sobre los conceptos mal entendidos para verificar que el estudiante los ha corregido.
15. "feedback": Diagnóstico pedagógico global sobre su explicación oral y los conceptos mal entendidos detectados.`;

    const contentParts: any[] = [];
    if (cleanBase64) {
      contentParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'audio/webm',
        },
      });
    }
    contentParts.push({ text: prompt });

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: {
        parts: contentParts,
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING },
            simplicityScore: { type: Type.INTEGER },
            clarityScore: { type: Type.INTEGER },
            accuracyScore: { type: Type.INTEGER },
            overallScore: { type: Type.INTEGER },
            oralDeliveryFeedback: { type: Type.STRING },
            corrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  concept: { type: Type.STRING },
                  userMistake: { type: Type.STRING },
                  correction: { type: Type.STRING },
                  severity: { type: Type.STRING },
                },
                required: ['concept', 'userMistake', 'correction', 'severity'],
              },
            },
            deepDiveSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            identifiedJargon: { type: Type.ARRAY, items: { type: Type.STRING } },
            conceptualGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
            intuitiveAnalogies: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvedDraft: { type: Type.STRING },
            followUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            feedback: { type: Type.STRING },
          },
          required: [
            'transcription',
            'simplicityScore',
            'clarityScore',
            'accuracyScore',
            'overallScore',
            'oralDeliveryFeedback',
            'corrections',
            'deepDiveSuggestions',
            'strengths',
            'identifiedJargon',
            'conceptualGaps',
            'intuitiveAnalogies',
            'improvedDraft',
            'followUpQuestions',
            'feedback',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (speechToTextTranscript && (!parsed.transcription || parsed.transcription.length < speechToTextTranscript.length)) {
      parsed.transcription = speechToTextTranscript;
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/gemini/evaluate-audio-feynman:', error);
    res.status(500).json({ error: error.message || 'Error al evaluar la explicación oral de Feynman.' });
  }
});

// 4.3 Estructurar y Enriquecer Apuntes de un Tema (Espacio ilimitado + Detección profunda de Indicios y Conceptos Clave)
function extractDeepAcademicInsightsFromNotes(
  effectiveTitle: string,
  effectiveNotes: string,
  subjectName: string
): {
  keyTerms: Array<{
    term: string;
    definition: string;
    category: string;
    semanticLevel: string;
    parentConcept?: string;
    importance: 'alta' | 'media' | 'baja';
  }>;
  cues: string[];
  headings: string[];
} {
  const rawLines = effectiveNotes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const keyTerms: Array<{
    term: string;
    definition: string;
    category: string;
    semanticLevel: string;
    parentConcept?: string;
    importance: 'alta' | 'media' | 'baja';
  }> = [];
  const seenTerms = new Set<string>();
  const headings: string[] = [];
  const cues: string[] = [];
  const seenCues = new Set<string>();
  let currentMacroHeading = effectiveTitle;

  const inferSemanticLevel = (
    category: string,
    defText: string,
    isHeadingBased = false
  ): string => {
    if (isHeadingBased || /Apartado Principal|Bloque Conceptual|Macro/i.test(category)) {
      return 'Nivel 1 · Macro-concepto';
    }
    if (
      /Mecanismo|Proceso|Clasificación|Etapa|Relación|Función/i.test(category) ||
      /causa|produce|provoca|proceso|etapa|fase|regula|permite|interviene/i.test(defText)
    ) {
      return 'Nivel 2 · Mecanismo/Proceso';
    }
    return 'Nivel 3 · Micro-concepto/Detalle';
  };

  const addKeyTerm = (
    rawTerm: string,
    rawDef: string,
    category = 'Concepto Clave',
    importance: 'alta' | 'media' | 'baja' = 'alta',
    explicitSemanticLevel?: string,
    parentConcept?: string
  ) => {
    const cleanTerm = rawTerm
      .replace(/^[-•*0-9.)#>\s]+/, '')
      .replace(/\*+/g, '')
      .replace(/:$/, '')
      .trim();
    const cleanDef = rawDef
      .replace(/^[-•*:\s]+/, '')
      .replace(/\*+/g, '')
      .trim();
    if (
      cleanTerm.length < 2 ||
      cleanTerm.length > 85 ||
      cleanDef.length < 10 ||
      /^(tema|asignatura|subtemas|página|pagina|bloque|sección|seccion|resumen)$/i.test(cleanTerm)
    ) {
      return;
    }
    const keyLower = cleanTerm.toLowerCase();
    if (seenTerms.has(keyLower)) return;
    seenTerms.add(keyLower);
    const semanticLevel =
      explicitSemanticLevel || inferSemanticLevel(category, cleanDef, false);
    keyTerms.push({
      term: cleanTerm,
      definition: cleanDef,
      category,
      semanticLevel,
      parentConcept: parentConcept || currentMacroHeading,
      importance,
    });
  };

  const addCue = (question: string) => {
    const q = question.trim();
    if (!q || q.length < 12) return;
    const norm = q.toLowerCase();
    if (seenCues.has(norm)) return;
    seenCues.add(norm);
    cues.push(q);
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // 1. Detect Markdown or numbered headings (Nivel 1: Macro-conceptos)
    if (/^#{1,4}\s+/.test(line)) {
      const h = line.replace(/^#{1,4}\s+/, '').replace(/\*+/g, '').trim();
      if (h.length > 2 && h.length < 100) {
        headings.push(h);
        currentMacroHeading = h;
        const nextLine = rawLines[i + 1] || '';
        if (nextLine && !/^#{1,4}\s+/.test(nextLine) && nextLine.length > 25) {
          addKeyTerm(
            h,
            nextLine,
            'Macro-concepto / Eje',
            'alta',
            'Nivel 1 · Macro-concepto',
            effectiveTitle
          );
        }
      }
      continue;
    }

    const isShortTitleLine =
      line.length > 3 &&
      line.length < 80 &&
      !line.endsWith('.') &&
      (line.endsWith(':') || /^[0-9]+(\.[0-9]+)*[.)]\s+[A-ZÁÉÍÓÚÑ]/.test(line));

    if (isShortTitleLine) {
      const h = line.replace(/:$/, '').replace(/^[0-9]+(\.[0-9]+)*[.)]\s*/, '').replace(/\*+/g, '').trim();
      if (h.length > 2) {
        headings.push(h);
        currentMacroHeading = h;
        const nextLine = rawLines[i + 1] || '';
        if (nextLine && nextLine.length > 20 && !nextLine.endsWith(':')) {
          addKeyTerm(
            h,
            nextLine,
            'Macro-concepto / Bloque',
            'alta',
            'Nivel 1 · Macro-concepto',
            effectiveTitle
          );
        }
      }
      continue;
    }

    // 2. Detect explicit "**Término**: definición" or "Término: definición" or "Término - definición"
    const cleanLine = line.replace(/^[-•*0-9.)\s]+/, '').trim();
    const boldMatch = cleanLine.match(/^\*\*([^*]{2,65})\*\*\s*[:–—-]\s*(.+)$/);
    if (boldMatch) {
      const semLvl = inferSemanticLevel('Definición Clave', boldMatch[2], false);
      addKeyTerm(boldMatch[1], boldMatch[2], 'Definición Clave', 'alta', semLvl, currentMacroHeading);
      continue;
    }

    const colonIdx = cleanLine.indexOf(':');
    if (colonIdx > 2 && colonIdx < 65 && cleanLine.length > colonIdx + 12) {
      const candidateTerm = cleanLine.slice(0, colonIdx).trim();
      const candidateDef = cleanLine.slice(colonIdx + 1).trim();
      if (candidateTerm.split(/\s+/).length <= 8) {
        const cat =
          /fórmula|ecuación|cálculo|ley|teorema|regla/i.test(candidateTerm)
            ? 'Fórmula / Regla'
            : /tipo|clasificaci|clase|fase|etapa/i.test(candidateTerm)
            ? 'Clasificación / Etapa'
            : /función|mecanismo|proceso|efecto|causa/i.test(candidateTerm)
            ? 'Mecanismo'
            : 'Definición Clave';
        const semLvl = inferSemanticLevel(cat, candidateDef, false);
        addKeyTerm(
          candidateTerm,
          candidateDef,
          cat,
          keyTerms.length < 5 ? 'alta' : 'media',
          semLvl,
          currentMacroHeading
        );
        continue;
      }
    }

    // 3. Detect natural language definitions ("X se define como Y", "X consiste en Y", "X es el proceso...")
    const defRegex =
      /^([A-ZÁÉÍÓÚÑ][^.,:;]{2,55}?)\s+(?:se define como|consiste en|hace referencia a|es el proceso mediante el cual|es un[a]?\s+[a-záéíóúñ]+\s+que|se caracteriza por|permite|regula)\s+(.{15,})$/i;
    const defMatch = cleanLine.match(defRegex);
    if (defMatch) {
      const cat = /proceso|caracteriza|permite|regula/i.test(cleanLine)
        ? 'Mecanismo / Función'
        : 'Concepto Nuclear';
      addKeyTerm(
        defMatch[1],
        cleanLine,
        cat,
        keyTerms.length < 5 ? 'alta' : 'media',
        inferSemanticLevel(cat, cleanLine, false),
        currentMacroHeading
      );
      continue;
    }

    // 4. Detect dash definition "Concepto – explicación"
    const dashMatch = cleanLine.match(/^([A-ZÁÉÍÓÚÑ][^-–—:]{2,50})\s+[–—-]\s+(.{15,})$/);
    if (dashMatch && dashMatch[1].split(/\s+/).length <= 7) {
      addKeyTerm(
        dashMatch[1],
        dashMatch[2],
        'Concepto Clave',
        'media',
        inferSemanticLevel('Concepto Clave', dashMatch[2], false),
        currentMacroHeading
      );
    }
  }

  // If the notes are continuous prose without colons, extract meaningful sentences and their subject noun phrases
  if (keyTerms.length < 5) {
    const sentences = effectiveNotes
      .replace(/\r?\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.replace(/^[-•*#\s]+/, '').trim())
      .filter((s) => s.length > 30);

    for (const sentence of sentences) {
      if (keyTerms.length >= 10) break;
      const words = sentence.replace(/\*+/g, '').split(/\s+/);
      const shortTitle = words.slice(0, Math.min(5, words.length)).join(' ').replace(/[,:;.]$/, '');
      const semLvl =
        keyTerms.length < 2
          ? 'Nivel 1 · Macro-concepto'
          : keyTerms.length < 5
          ? 'Nivel 2 · Mecanismo/Proceso'
          : 'Nivel 3 · Micro-concepto/Detalle';
      addKeyTerm(
        shortTitle,
        sentence,
        keyTerms.length < 3 ? 'Idea Principal' : 'Desarrollo del Tema',
        keyTerms.length < 3 ? 'alta' : 'media',
        semLvl,
        currentMacroHeading
      );
    }
  }

  // Build specific, targeted Active Recall Cues directly from the extracted keyTerms and headings following semantic hierarchy
  for (const kt of keyTerms) {
    if (cues.length >= 12) break;
    const t = kt.term;
    const dLower = kt.definition.toLowerCase();
    if (kt.semanticLevel.includes('Nivel 1')) {
      addCue(`[Macro] ¿Cuál es el principio rector de "${t}" y cómo articula la estructura general de ${effectiveTitle}?`);
    } else if (dLower.includes('diferencia') || dLower.includes('frente a') || dLower.includes('mientras que')) {
      addCue(`[Meso] ¿Qué diferencia funcional clave existe en "${t}" y cómo se distingue dentro de ${effectiveTitle}?`);
    } else if (dLower.includes('fase') || dLower.includes('etapa') || dLower.includes('paso') || kt.category.includes('Clasificación')) {
      addCue(`[Meso] ¿Cuáles son las fases o etapas secuenciales de "${t}" según los apuntes?`);
    } else if (dLower.includes('causa') || dLower.includes('produce') || dLower.includes('provoca') || dLower.includes('función') || kt.category.includes('Mecanismo')) {
      addCue(`[Meso] ¿Qué mecanismo causal explica el funcionamiento de "${t}" y qué efecto produce en ${effectiveTitle}?`);
    } else if (kt.category.includes('Fórmula')) {
      addCue(`[Micro] ¿Cuál es la formulación o regla técnica exacta de "${t}" y bajo qué condiciones se aplica?`);
    } else {
      addCue(`[Micro] ¿Cómo se define con precisión técnica "${t}" y qué matiz clave aporta en tus apuntes?`);
    }
  }

  for (const h of headings) {
    if (cues.length >= 12) break;
    if (!h.toLowerCase().includes(effectiveTitle.toLowerCase())) {
      addCue(`[Macro] ¿Qué conceptos subordinados y mecanismos abarca el eje temático "${h}"?`);
    }
  }

  if (cues.length === 0) {
    addCue(`[Macro] ¿Cuáles son los macro-conceptos y tesis fundamentales de ${effectiveTitle}?`);
    addCue(`[Meso] ¿Qué mecanismos y relaciones causa-efecto estructuran ${effectiveTitle} en ${subjectName || 'la asignatura'}?`);
    addCue(`[Micro] ¿Qué definiciones técnicas, fórmulas o excepciones críticas deben dominarse en ${effectiveTitle}?`);
  }

  return {
    keyTerms: keyTerms.slice(0, 16),
    cues: cues.slice(0, 12),
    headings,
  };
}

function buildStructuredTopicNotesFallback(
  effectiveTitle: string,
  effectiveNotes: string,
  subjectName: string
) {
  const cleanLines = effectiveNotes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const paragraphs = effectiveNotes
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const { keyTerms, cues } = extractDeepAcademicInsightsFromNotes(
    effectiveTitle,
    effectiveNotes,
    subjectName
  );

  const formattedSections: string[] = [];
  const firstLineClean = (cleanLines[0] || '').replace(/^#+\s*/, '').replace(/^📚\s*/, '').trim();
  if (!firstLineClean || firstLineClean.toLowerCase() !== effectiveTitle.toLowerCase()) {
    formattedSections.push(`# 📚 ${effectiveTitle}`);
  }
  if (subjectName && !effectiveNotes.includes('**Asignatura:**')) {
    formattedSections.push(
      `> **Asignatura:** ${subjectName} · *Documento estructurado con formato académico enriquecido (100% del contenido conservado)*`
    );
  }

  if (cleanLines.length <= 2 && effectiveNotes.length < 180) {
    formattedSections.push(`## 1. Conceptos Fundamentales`);
    formattedSections.push(
      `- **Idea central de ${effectiveTitle}:** ${effectiveNotes}\n- **Relación con ${subjectName || 'la materia'}:** Comprender la definición, estructura, mecanismos principales y su aplicación en preguntas de examen.`
    );
  } else {
    let sectionIdx = 1;
    let currentList: string[] = [];

    const flushList = () => {
      if (currentList.length > 0) {
        formattedSections.push(currentList.join('\n'));
        currentList = [];
      }
    };

    for (const line of cleanLines) {
      // Skip duplicate summary/header blocks if re-formatting already structured notes
      if (/^>\s*\*\*Asignatura:\*\*/i.test(line)) {
        continue;
      }

      if (/^#{1,3}\s+/.test(line)) {
        flushList();
        formattedSections.push(line);
        continue;
      }

      const isShortHeader =
        line.length < 85 &&
        !line.endsWith('.') &&
        (line.endsWith(':') ||
          /^[0-9]+(\.[0-9]+)*[.)]\s+[A-ZÁÉÍÓÚÑ]/.test(line) ||
          (line.length > 3 && line === line.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(line)));

      if (isShortHeader) {
        flushList();
        const cleanHeader = line
          .replace(/:$/, '')
          .replace(/^[0-9]+(\.[0-9]+)*[.)]\s*/, '')
          .replace(/\*+/g, '')
          .trim();
        formattedSections.push(`## ${sectionIdx++}. ${cleanHeader}`);
      } else if (line.startsWith('>')) {
        flushList();
        formattedSections.push(line);
      } else {
        const cleanBullet = line.replace(/^[-•*]\s*/, '').trim();
        const colonIdx = cleanBullet.indexOf(':');
        if (colonIdx > 2 && colonIdx < 65 && !cleanBullet.startsWith('**')) {
          const term = cleanBullet.slice(0, colonIdx).replace(/\*+/g, '').trim();
          const rest = cleanBullet.slice(colonIdx + 1).trim();
          currentList.push(`- **${term}:** ${rest}`);
        } else if (cleanBullet.length > 130 && !cleanBullet.includes('**')) {
          const sentences = cleanBullet.split(/(?<=[.!?])\s+/);
          if (sentences.length > 1) {
            currentList.push(`- **${sentences[0]}** ${sentences.slice(1).join(' ')}`);
          } else {
            currentList.push(`- ${cleanBullet}`);
          }
        } else {
          currentList.push(`- ${cleanBullet}`);
        }
      }
    }

    flushList();
  }

  if (keyTerms.length > 0 && !effectiveNotes.includes('🔑 Conceptos y Definiciones Clave')) {
    formattedSections.push(`## 🔑 Conceptos y Definiciones Clave Detectados`);
    formattedSections.push(
      keyTerms.slice(0, 8).map((kt) => `- **${kt.term}** *(${kt.category})*: ${kt.definition}`).join('\n')
    );
  }

  // Summary preserves full context without arbitrary 280/320 char cuts
  const firstParagraph = (paragraphs[0] || effectiveNotes).replace(/^#+\s*.*\n?/, '').trim();
  const lastParagraph =
    paragraphs.length > 1 ? paragraphs[paragraphs.length - 1].replace(/^#+\s*.*\n?/, '').trim() : '';
  const summary = [
    `Síntesis de "${effectiveTitle}" (${subjectName || 'Asignatura'}): ${firstParagraph}`,
    lastParagraph && lastParagraph !== firstParagraph
      ? `Conclusiones y puntos clave: ${lastParagraph}`
      : keyTerms.length > 0
      ? `Conceptos esenciales a dominar: ${keyTerms
          .slice(0, 5)
          .map((k) => k.term)
          .join(', ')}.`
      : `Dominar los conceptos estructurados en estos apuntes permite responder con precisión tanto preguntas tipo test como de desarrollo.`,
  ].join('\n\n');

  return {
    notes: formattedSections.join('\n\n'),
    cues,
    summary,
    keyTerms,
  };
}

app.post(['/api/gemini/structure-topic-notes', '/api/gemini/structure-notes'], async (req: Request, res: Response) => {
  const { topicTitle, rawNotes, rawText, subjectName, subtopics, forceRefresh } = req.body || {};
  const effectiveTitle = (topicTitle || 'Apuntes del Tema').trim();
  const subtopicsList =
    Array.isArray(subtopics) && subtopics.length > 0
      ? `\nSubtemas del programa: ${subtopics.join(', ')}`
      : '';
  // Respect UNLIMITED space in Cornell Notes: do not truncate the student's notes to 12,000 chars
  const fullStudentNotes = String(rawNotes || rawText || effectiveTitle).trim();
  const effectiveNotes = (fullStudentNotes + subtopicsList).trim();
  const cacheKey = `${subjectName}_${effectiveTitle}_${effectiveNotes.length}_${effectiveNotes.slice(0, 200)}`;

  if (!forceRefresh && cornellStructureCache.has(cacheKey)) {
    res.json({ success: true, data: cornellStructureCache.get(cacheKey), cached: true });
    return;
  }

  // Always extract deterministic deep insights from the full notes as baseline so zero concepts are missed
  const deepLocalInsights = extractDeepAcademicInsightsFromNotes(
    effectiveTitle,
    fullStudentNotes,
    subjectName || 'General'
  );

  try {
    // UNLIMITED NOTES: pass the entire effectiveNotes without slicing or truncating characters
    const prompt = `Eres un catedrático experto en neuroeducación, lingüística computacional y el Método Cornell de la Universidad de Cornell.
Tu objetivo es estructurar los apuntes del tema "${effectiveTitle}" de la asignatura "${subjectName || 'General'}" aplicando un **Enfoque de Extracción de Jerarquía Semántica (Semantic Hierarchy Extraction)** para obtener "conceptos clave" ("keyTerms") e "indicios" ("cues") de máxima precisión.

=== 1. REGLA CRÍTICA DE ESPACIO ILIMITADO EN EL ÁREA DE NOTAS ("notes") ===
- El área de notas TIENE ESPACIO ILIMITADO (0 límites de caracteres).
- PROHIBIDO resumir, recortar, omitir o eliminar párrafos, datos, ejemplos, clasificaciones o explicaciones escritas por el estudiante.
- DEBES conservar el 100% de la información original del estudiante, aplicándole formato Markdown académico estructurado:
  * Encabezados jerárquicos claros (## 1. Macro-sección, ### 1.1 Subapartado)
  * Conceptos y términos clave resaltados en **negrita** (**Concepto:** explicación completa)
  * Listas con viñetas (-) o numeradas para clasificaciones, características y secuencias
  * Bloques destacados con citas (> 💡 **Síntesis Semántica:** ...) para conclusiones o puntos críticos de examen
- Si los apuntes de entrada son breves (solo el título o subtemas), desarrolla con rigor académico todos los apartados del tema.

=== 2. ENFOQUE DE EXTRACCIÓN DE JERARQUÍA SEMÁNTICA PARA "keyTerms" (CONCEPTOS CLAVE) E "indicios" ("cues") ===
Analiza el texto mediante un árbol semántico de 3 niveles de granularidad:
- **Nivel 1 · Macro-concepto (Tesis y Ejes Estructurales)**: Principios rectores, leyes generales, marcos teóricos o categorías paraguas que vertebran el tema.
- **Nivel 2 · Mecanismo/Proceso (Nivel Meso — Relaciones Causales y Dinámica)**: Subprocesos, secuencias paso a paso, relaciones causa-efecto, comparaciones funcionales y clasificaciones operativas subordinadas a cada Macro-concepto.
- **Nivel 3 · Micro-concepto/Detalle (Definiciones Exactas, Fórmulas, Parámetros y Excepciones)**: Términos técnicos específicos, valores críticos, casos límite, fórmulas y matices de examen.

Instrucciones para el JSON de salida:
A) En "keyTerms": Extrae entre 8 y 15 conceptos clave ordenados jerárquicamente (Nivel 1 → Nivel 2 → Nivel 3). Cada elemento DEBE incluir:
   - "term": Nombre exacto y riguroso del concepto extraído de los apuntes.
   - "definition": Definición o explicación completa extraída fielmente de los apuntes, indicando cómo se conecta dentro de la jerarquía del tema.
   - "semanticLevel": Clasificación estricta en uno de estos 3 valores: "Nivel 1 · Macro-concepto", "Nivel 2 · Mecanismo/Proceso" o "Nivel 3 · Micro-concepto/Detalle".
   - "parentConcept": El concepto superior o apartado del que depende semánticamente (ej. el nombre del Macro-concepto o título de sección).
   - "category": Etiqueta académica ("Tesis / Eje", "Mecanismo Causal", "Clasificación", "Definición Técnica", "Fórmula / Evidencia").
   - "importance": "alta", "media" o "baja".
B) En "cues" (Indicios y Preguntas Detonadoras): Genera entre 7 y 12 preguntas de Active Recall jerarquizadas que cubran los 3 niveles semánticos:
   - Antepón la etiqueta de nivel semántico a cada pregunta: "[Macro]", "[Meso]" o "[Micro]".
   - Preguntas "[Macro]": Evalúan la comprensión global y conexión entre grandes bloques del tema.
   - Preguntas "[Meso]": Evalúan el porqué, mecanismos de acción, causas-consecuencias y diferencias entre procesos.
   - Preguntas "[Micro]": Evalúan definiciones exactas, datos críticos, fórmulas y excepciones de los apuntes.
C) En "summary": Redacta una síntesis ejecutiva integradora (2-3 párrafos) que conecte los Macro-conceptos con sus Mecanismos y Micro-conceptos esenciales.

Contenido íntegro de los apuntes (extensión ilimitada):
"""${effectiveNotes}"""`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notes: { type: Type.STRING },
            cues: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
            keyTerms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  semanticLevel: { type: Type.STRING },
                  parentConcept: { type: Type.STRING },
                  category: { type: Type.STRING },
                  importance: { type: Type.STRING },
                },
                required: ['term', 'definition', 'semanticLevel'],
              },
            },
          },
          required: ['notes', 'cues', 'summary', 'keyTerms'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const localFormattedFallback = buildStructuredTopicNotesFallback(
      effectiveTitle,
      fullStudentNotes,
      subjectName || 'General'
    );

    // Ensure the AI never truncated or shortened long student notes!
    let finalNotes = String(parsed.notes || '').trim();
    if (!finalNotes || (fullStudentNotes.length > 500 && finalNotes.length < fullStudentNotes.length * 0.75)) {
      finalNotes = localFormattedFallback.notes;
    }

    // Merge AI cues with deep local cues so specific questions from the notes are always present
    const aiCues = Array.isArray(parsed.cues) ? parsed.cues.map(String).filter(Boolean) : [];
    const mergedCues = Array.from(new Set([...aiCues, ...deepLocalInsights.cues])).slice(0, 14);

    // Merge AI keyTerms with deep local keyTerms preserving semanticLevel & parentConcept
    const aiKeyTerms = Array.isArray(parsed.keyTerms)
      ? parsed.keyTerms
          .filter((kt: any) => kt && kt.term && kt.definition)
          .map((kt: any) => ({
            term: String(kt.term).trim(),
            definition: String(kt.definition).trim(),
            semanticLevel: kt.semanticLevel
              ? String(kt.semanticLevel)
              : 'Nivel 2 · Mecanismo/Proceso',
            parentConcept: kt.parentConcept ? String(kt.parentConcept) : effectiveTitle,
            category: kt.category ? String(kt.category) : 'Concepto Clave',
            importance:
              kt.importance === 'alta' || kt.importance === 'baja' ? kt.importance : 'media',
          }))
      : [];

    const seenTermNames = new Set(aiKeyTerms.map((k: any) => k.term.toLowerCase()));
    const mergedKeyTerms = [...aiKeyTerms];
    for (const localKt of deepLocalInsights.keyTerms) {
      if (!seenTermNames.has(localKt.term.toLowerCase()) && mergedKeyTerms.length < 16) {
        seenTermNames.add(localKt.term.toLowerCase());
        mergedKeyTerms.push(localKt);
      }
    }

    const finalPayload = {
      notes: finalNotes,
      cues: mergedCues.length > 0 ? mergedCues : localFormattedFallback.cues,
      summary: String(parsed.summary || localFormattedFallback.summary).trim(),
      keyTerms: mergedKeyTerms.length > 0 ? mergedKeyTerms : localFormattedFallback.keyTerms,
    };

    cornellStructureCache.set(cacheKey, finalPayload);
    res.json({ success: true, data: finalPayload });
  } catch (error: any) {
    console.warn('Fallback activated in /api/gemini/structure-topic-notes:', error?.message || error);
    const fallbackData = buildStructuredTopicNotesFallback(
      effectiveTitle,
      fullStudentNotes,
      subjectName || 'General'
    );
    res.json({ success: true, data: fallbackData, fallbackUsed: true });
  }
});

// 5. Mapas Mentales y Esquemas automáticos de ideas clave
app.post('/api/gemini/generate-mindmap', async (req: Request, res: Response) => {
  try {
    const { topics, subjectName, detailLevel = 'completo' } = req.body;

    const prompt = `Genera un mapa mental jerárquico estructurado y esquema de ideas clave para la materia "${subjectName}" (Nivel de detalle: ${detailLevel}).
Temas o contenido a sintetizar:
${JSON.stringify(topics)}

Crea una estructura de árbol jerárquica para renderizar con D3.js con un nodo raíz central (nombre del tema/materia), ramas principales (3 a 5 bloques conceptuales), subramas secundarias (2 a 4 conceptos clave por bloque) y hojas de tercer nivel (detalles técnicos, ejemplos o aplicaciones).
Cada nodo debe tener:
- id: identificador único alfanumérico (ej. "root", "b1", "b1-1", "b1-1-1")
- label: título corto y claro (máx 5 palabras)
- description: explicación rigurosa y concisa de 1 a 2 oraciones
- category: categoría del nodo (ej. "Concepto Central", "Fundamento", "Mecanismo", "Ejemplo Práctico", "Síntesis")
- cueQuestion: pregunta de autoevaluación Active Recall asociada a ese nodo
- cornellSection: origen conceptual ("core", "cue", "notes" o "summary")
- children: nodos hijos recursivos`;

    const leafNodeSchema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        cueQuestion: { type: Type.STRING },
        cornellSection: { type: Type.STRING },
      },
      required: ['id', 'label', 'description'],
    };

    const subBranchNodeSchema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        cueQuestion: { type: Type.STRING },
        cornellSection: { type: Type.STRING },
        children: {
          type: Type.ARRAY,
          items: leafNodeSchema,
        },
      },
      required: ['id', 'label', 'description'],
    };

    const branchNodeSchema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        cueQuestion: { type: Type.STRING },
        cornellSection: { type: Type.STRING },
        children: {
          type: Type.ARRAY,
          items: subBranchNodeSchema,
        },
      },
      required: ['id', 'label', 'description'],
    };

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            rootNode: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                cueQuestion: { type: Type.STRING },
                cornellSection: { type: Type.STRING },
                children: {
                  type: Type.ARRAY,
                  items: branchNodeSchema,
                },
              },
              required: ['id', 'label', 'description'],
            },
          },
          required: ['title', 'summary', 'rootNode'],
        },
      },
    });

    const mindmapData = JSON.parse(response.text || '{}');
    res.json({ success: true, data: mindmapData });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-mindmap:', error);
    res.status(500).json({ error: error.message || 'Error al generar el mapa mental.' });
  }
});

// 5.1 Generación de Mapa Mental Jerárquico (D3.js) a partir de los Apuntes Cornell de un tema seleccionado
app.post('/api/gemini/generate-cornell-mindmap', async (req: Request, res: Response) => {
  try {
    const {
      topicTitle,
      topicDescription = '',
      subtopics = [],
      subjectName = 'Asignatura',
      cornellTitle = '',
      cues = [],
      notes = '',
      summary = '',
    } = req.body;

    if (!topicTitle && !cornellTitle) {
      res.status(400).json({ error: 'Se requiere el título del tema o de los apuntes Cornell.' });
      return;
    }

    const formattedCues =
      Array.isArray(cues) && cues.length > 0
        ? cues.map((c: string, i: number) => `  ${i + 1}. ${c}`).join('\n')
        : '  (Extraer preguntas e ideas clave directamente del cuerpo de notas)';

    const formattedSubtopics =
      Array.isArray(subtopics) && subtopics.length > 0
        ? `Subtemas del programa: ${subtopics.join(', ')}`
        : '';

    const prompt = `Actúa como un experto en visualización del conocimiento, neuroeducación y el Método de Apuntes Cornell.
Tu objetivo es transformar los apuntes Cornell del estudiante sobre el tema "${topicTitle || cornellTitle}" (Asignatura: "${subjectName}") en una estructura jerárquica de mapa mental profunda, rigurosa y clara para ser renderizada interactivamente con D3.js (d3.hierarchy / d3.tree).

=== APUNTES CORNELL DEL TEMA SELECCIONADO ===
• Título del Tema: ${topicTitle}
${cornellTitle && cornellTitle !== topicTitle ? `• Título del Apunte Cornell: ${cornellTitle}\n` : ''}${topicDescription ? `• Descripción general: ${topicDescription}\n` : ''}${formattedSubtopics ? `• ${formattedSubtopics}\n` : ''}
1) COLUMNA DE IDEAS CLAVE Y PREGUNTAS DETONADORAS (CUES):
${formattedCues}

2) CUERPO CENTRAL DE APUNTES DETALLADOS (NOTES):
"""
${notes || topicDescription || topicTitle}
"""

3) RESUMEN EJECUTIVO INFERIOR (SUMMARY):
"""
${summary || '(Sintetizar a partir del cuerpo de notas)'}
"""

=== INSTRUCCIONES ESTRUCTURALES PARA EL ÁRBOL JERÁRQUICO D3.JS ===
Construye un árbol jerárquico rico de 3 a 4 niveles de profundidad:
- Nivel 0 (rootNode): El tema central ("${topicTitle || cornellTitle}") con una descripción integradora basada en el Resumen Cornell (cornellSection: "core").
- Nivel 1 (children del rootNode): Entre 3 y 6 ramas principales que correspondan a los grandes ejes conceptuales o preguntas clave (Cues) de los apuntes Cornell.
- Nivel 2 (children de nivel 1): Entre 2 y 4 subconceptos, mecanismos, clasificaciones o argumentos extraídos del cuerpo central de notas para cada rama principal.
- Nivel 3 (children de nivel 2): De 1 a 3 nodos hoja opcionales con datos específicos, fórmulas, casos prácticos, definiciones clave o síntesis del resumen Cornell.

Para CADA nodo del árbol incluye:
- "id": ID único jerárquico (ej. "root", "n1", "n1-1", "n1-1-1").
- "label": Etiqueta concisa y muy visual (2 a 6 palabras máximo) ideal para cajas de nodos en D3.js.
- "description": Explicación clara, académica y sintética (1 a 2 frases) que amplíe el nodo al seleccionarlo.
- "category": Etiqueta de categoría (ej. "Idea Clave (Cue)", "Concepto Fundamental", "Mecanismo / Proceso", "Dato / Fórmula", "Ejemplo Aplicado", "Síntesis Cornell").
- "cueQuestion": Una pregunta de Active Recall directa sobre ese nodo para que el alumno pueda ponerse a prueba al hacer clic en el nodo del mapa D3.js.
- "cornellSection": Indica de qué sección del método Cornell proviene principalmente este nodo: "cue" (columna izquierda de preguntas/ideas clave), "notes" (cuerpo central de apuntes), "summary" (resumen inferior) o "core" (raíz central).

Responde exclusivamente en español académico claro.`;

    const level3NodeSchema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        cueQuestion: { type: Type.STRING },
        cornellSection: { type: Type.STRING },
      },
      required: ['id', 'label', 'description', 'category', 'cueQuestion', 'cornellSection'],
    };

    const level2NodeSchema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        cueQuestion: { type: Type.STRING },
        cornellSection: { type: Type.STRING },
        children: {
          type: Type.ARRAY,
          items: level3NodeSchema,
        },
      },
      required: ['id', 'label', 'description', 'category', 'cueQuestion', 'cornellSection'],
    };

    const level1NodeSchema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        description: { type: Type.STRING },
        category: { type: Type.STRING },
        cueQuestion: { type: Type.STRING },
        cornellSection: { type: Type.STRING },
        children: {
          type: Type.ARRAY,
          items: level2NodeSchema,
        },
      },
      required: ['id', 'label', 'description', 'category', 'cueQuestion', 'cornellSection'],
    };

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            rootNode: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                cueQuestion: { type: Type.STRING },
                cornellSection: { type: Type.STRING },
                children: {
                  type: Type.ARRAY,
                  items: level1NodeSchema,
                },
              },
              required: ['id', 'label', 'description', 'category', 'cueQuestion', 'cornellSection', 'children'],
            },
          },
          required: ['title', 'summary', 'rootNode'],
        },
      },
    });

    const mindmapData = JSON.parse(response.text || '{}');
    res.json({ success: true, data: mindmapData });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-cornell-mindmap:', error);
    res.status(500).json({ error: error.message || 'Error al generar el mapa mental desde apuntes Cornell.' });
  }
});

// 5.2 Generación de Estructura de Mapa Mental en formato Mermaid.js a partir de los Apuntes del Tema
app.post('/api/gemini/generate-topic-mermaid-mindmap', async (req: Request, res: Response) => {
  try {
    const {
      topicTitle,
      topicDescription = '',
      subtopics = [],
      subjectName = 'Asignatura',
      cues = [],
      notes = '',
      summary = '',
    } = req.body;

    if (!topicTitle) {
      res.status(400).json({ error: 'Se requiere el título del tema (topicTitle).' });
      return;
    }

    const formattedSubtopics =
      Array.isArray(subtopics) && subtopics.length > 0
        ? `Subtemas del tema: ${subtopics.join(', ')}`
        : '';

    const formattedCues =
      Array.isArray(cues) && cues.length > 0
        ? `Preguntas clave / Cues:\n- ${cues.join('\n- ')}`
        : '';

    const prompt = `Actúa como un experto en visualización del conocimiento y profesor universitario.
Genera una estructura de mapa mental completa, clara y pedagógica en formato **Mermaid.js** basada en los apuntes del estudiante para el tema "${topicTitle}" de la asignatura "${subjectName}".

=== CONTENIDO Y APUNTES DEL TEMA ===
• Tema: ${topicTitle}
${topicDescription ? `• Descripción: ${topicDescription}\n` : ''}${formattedSubtopics ? `• ${formattedSubtopics}\n` : ''}${formattedCues ? `• ${formattedCues}\n` : ''}
• Apuntes del tema:
"""
${notes || topicDescription || topicTitle}
"""
${summary ? `• Resumen del tema:\n"""\n${summary}\n"""` : ''}

=== REGLAS ESTRICTAS PARA EL CÓDIGO MERMAID.JS ("mermaid") ===
1. Comienza exactamente con \`flowchart LR\` (o \`flowchart TD\`).
2. Crea un nodo raíz central para el tema (ej: \`root(["🧠 ${topicTitle.replace(/"/g, "'")}"])\`).
3. Del nodo \`root\` deben partir entre 3 y 6 ramas principales (\`b1\`, \`b2\`, \`b3\`, ...) correspondientes a los bloques conceptuales clave extraídos de los apuntes.
4. De cada rama principal deben partir entre 2 y 4 subnodos (\`b1_1\`, \`b1_2\`, ...) con conceptos específicos, mecanismos, definiciones, fórmulas o ejemplos presentes en los apuntes.
5. Usa identificadores estrictamente alfanuméricos simples (ej: \`root\`, \`b1\`, \`b1_1\`, \`b2_1\`).
6. Envuelve SIEMPRE el texto de cada nodo entre comillas dobles dentro de corchetes o paréntesis: ej. \`b1["Concepto Principal"]\` o \`b1_1("Detalle o definición breve")\`.
7. NUNCA uses comillas dobles internas dentro del texto de una etiqueta (usa comillas simples si hace falta) ni etiquetas HTML.
8. Añade conectores con etiquetas breves cuando aporten valor pedagógico, ej: \`root -->|"se divide en"| b1["..."]\`.
9. Incluye al final definiciones de estilo (\`classDef\`) suaves y elegantes para distinguir el nodo raíz, las ramas principales y los nodos hoja:
   \`classDef rootStyle fill:#4f46e5,stroke:#3730a3,color:#ffffff,stroke-width:2px,font-weight:bold;\`
   \`classDef branchStyle fill:#eef2ff,stroke:#6366f1,color:#1e1b4b,stroke-width:1.5px,font-weight:bold;\`
   \`classDef leafStyle fill:#ffffff,stroke:#cbd5e1,color:#334155,stroke-width:1px;\`
   Y asígnalos con \`class root rootStyle;\`, \`class b1,b2,... branchStyle;\`, etc.
10. NO envuelvas el código en bloques markdown (\`\`\`mermaid). Devuelve únicamente el código Mermaid puro en el campo \`mermaid\`.

Devuelve un JSON con:
- "mermaid": El código Mermaid.js completo y válido.
- "summary": Síntesis ejecutiva de 2 a 3 frases explicando la estructura del mapa mental generado.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mermaid: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ['mermaid', 'summary'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    let cleanMermaid = String(parsed.mermaid || '')
      .replace(/^```(mermaid)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    res.json({
      success: true,
      data: {
        mermaid: cleanMermaid,
        summary: String(parsed.summary || ''),
      },
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-topic-mermaid-mindmap:', error);
    res.status(500).json({
      error: error.message || 'Error al generar el mapa mental Mermaid con IA.',
    });
  }
});

// 6. Análisis de errores pasados para reforzar áreas débiles
app.post('/api/gemini/analyze-errors', async (req: Request, res: Response) => {
  try {
    const { errors, subjectName } = req.body;

    const prompt = `Analiza el historial de errores cometidos por un estudiante en "${subjectName}".
Historial de fallos:
${JSON.stringify(errors || [])}

Proporciona un diagnóstico pedagógico integral:
1. weakAreas: Lista de las 2 a 4 áreas o conceptos donde el estudiante tropieza sistemáticamente.
2. rootCauses: Explicación de los patrones de confusión (por ejemplo: confusión de fórmulas, lectura precipitada, falta de base conceptual).
3. recommendedActions: 3 a 5 recomendaciones concretas e inmediatas de estudio y repaso espaciado.
4. customReinforcementQuestions: 3 preguntas diseñadas específicamente para superar esos errores concretos.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weakAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
            rootCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            customReinforcementQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  concept: { type: Type.STRING },
                  question: { type: Type.STRING },
                  correctExplanation: { type: Type.STRING },
                },
                required: ['concept', 'question', 'correctExplanation'],
              },
            },
          },
          required: ['weakAreas', 'rootCauses', 'recommendedActions', 'customReinforcementQuestions'],
        },
      },
    });

    const analysis = JSON.parse(response.text || '{}');
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-errors:', error);
    res.status(500).json({ error: error.message || 'Error al analizar errores pasados.' });
  }
});

// 7. Estimación inteligente del tiempo necesario por tema
app.post('/api/gemini/estimate-topic-time', async (req: Request, res: Response) => {
  try {
    const { title, description, pagesOrComplexity, subjectName } = req.body;

    const prompt = `Estima el tiempo promedio necesario de estudio en horas y minutos para dominar el tema: "${title}".
Materia: "${subjectName || 'General'}".
Detalles/páginas/subtemas: "${description || ''} ${pagesOrComplexity || ''}".
Toma en cuenta lectura comprensiva, toma de notas Cornell, elaboración de flashcards y active recall inicial.
Devuelve:
- estimatedHours: tiempo en horas (decimal, ej. 3.5)
- difficulty: "Baja" | "Media" | "Alta"
- subtopics: lista de 3 a 6 subtemas recomendados para estudiar ordenadamente
- reasoning: breve explicación de por qué este cálculo.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedHours: { type: Type.NUMBER },
            difficulty: { type: Type.STRING },
            subtopics: { type: Type.ARRAY, items: { type: Type.STRING } },
            reasoning: { type: Type.STRING },
          },
          required: ['estimatedHours', 'difficulty', 'subtopics', 'reasoning'],
        },
      },
    });

    const estimate = JSON.parse(response.text || '{}');
    res.json({ success: true, data: estimate });
  } catch (error: any) {
    console.error('Error in /api/gemini/estimate-topic-time:', error);
    res.status(500).json({ error: error.message || 'Error al estimar tiempo de estudio.' });
  }
});

// 8. Generación de Diagramas Conceptuales Visuales (SVG y Mermaid.js interactivo)
app.post('/api/gemini/generate-concept-diagram', async (req: Request, res: Response) => {
  try {
    const { topicTitle, topicContent, notesContent, cues = [], summary = '', subjectName } = req.body;
    if (!topicTitle) {
      res.status(400).json({ error: 'Falta topicTitle' });
      return;
    }

    const notesContext = notesContent ? `\nApuntes detallados cargados por el estudiante para este tema:\n"""${notesContent}"""` : '';
    const cuesContext = Array.isArray(cues) && cues.length > 0 ? `\nPreguntas detonadoras / Cues de Active Recall:\n- ${cues.join('\n- ')}` : '';
    const summaryContext = summary ? `\nResumen del estudiante:\n"""${summary}"""` : '';

    const prompt = `Actúa como un diseñador de información visual y profesor universitario experto en técnicas de estudio visual.
Genera un mapa conceptual interactivo y representación visual de máxima calidad pedagógica para el tema: "${topicTitle}".
Asignatura / Contexto: "${subjectName || 'General'}".
${notesContext || (topicContent ? `\nContenido de referencia:\n"""${topicContent}"""` : '')}
${summaryContext}
${cuesContext}

Genera un JSON con los siguientes campos:
1. "mermaid": Código Mermaid.js 100% sintácticamente válido para renderizar directamente en el navegador.
   Reglas críticas para el código Mermaid:
   - Debe comenzar exactamente con "graph TD" o "flowchart TD".
   - Todos los identificadores de nodos deben ser alfanuméricos simples sin espacios ni caracteres especiales (ej: n1, n2, n3, sub1, sub2).
   - Todo texto o etiqueta del nodo debe estar estrictamente envuelto en comillas dobles y corchetes, ej: n1["Título del Concepto"].
   - Relaciones claras con texto descriptivo si aplica, ej: n1 -->|"se divide en"| n2["Subconcepto"].
   - No incluyas etiquetas HTML ni caracteres como <, >, o comillas dobles sin escapar dentro de los textos.
   - Organiza la jerarquía desde el concepto raíz a los subtemas, mecanismos, causas, consecuencias y aplicaciones prácticas.
   - De 6 a 12 nodos interconectados con sentido lógico pedagógico.
   - NO envuelvas el campo "mermaid" en markdown backticks (\`\`\`mermaid). Debe ser texto plano.

2. "svg": Un código SVG completo, limpio, estético y responsive (con atributos viewBox="0 0 960 620" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg").
   Instrucciones para el SVG:
   - Fondo profesional sutil: <rect width="960" height="620" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
   - Paleta de colores atractiva: azul (#2563eb), morado (#7c3aed), esmeralda (#059669), ámbar (#d97706), cian (#0891b2).
   - Cajas de conceptos con esquinas redondeadas, sombras suaves y texto legible.
   - Flechas y conectores direccionales.

3. "summary": Resumen de síntesis conceptual de 2 párrafos explicando la estructura de los apuntes y las relaciones fundamentales.
4. "nodes": Array de 5 a 8 objetos { id, label, category, description, keyTakeaway } con la información detallada de cada concepto para exploración interactiva.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            svg: { type: Type.STRING },
            mermaid: { type: Type.STRING },
            summary: { type: Type.STRING },
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  category: { type: Type.STRING },
                  description: { type: Type.STRING },
                  keyTakeaway: { type: Type.STRING },
                },
                required: ['id', 'label', 'category', 'description'],
              },
            },
          },
          required: ['svg', 'mermaid', 'summary', 'nodes'],
        },
      },
    });

    const diagramData = JSON.parse(response.text || '{}');
    res.json({ success: true, data: diagramData });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-concept-diagram:', error);
    res.status(500).json({ error: error.message || 'Error al generar el diagrama conceptual.' });
  }
});

// (Ruta unificada en /api/gemini/extract-cornell-flashcards en la sección superior)

// 10. Generación de Resumen Automático y Puntos Clave Editables para Documentos Importados
function buildDocumentKeyPointsFallback(
  documentName: string,
  sourceText: string,
  topicTitle: string,
  subjectName: string
) {
  const effectiveTopic = topicTitle || documentName || 'Tema de Estudio';
  const deepInsights = extractDeepAcademicInsightsFromNotes(
    effectiveTopic,
    sourceText,
    subjectName
  );

  const keyPoints = deepInsights.keyTerms.slice(0, 8).map((kt) => ({
    title: kt.term,
    detail: kt.definition,
    category: kt.category || 'Concepto Clave',
    importance: kt.importance || 'alta',
  }));

  while (keyPoints.length < 4) {
    const idx = keyPoints.length;
    keyPoints.push({
      title:
        idx === 0
          ? `Fundamento principal de ${effectiveTopic}`
          : idx === 1
          ? `Conceptos y terminología clave`
          : idx === 2
          ? `Relaciones y mecanismos esenciales`
          : `Aplicación práctica en ${subjectName}`,
      detail:
        idx === 0
          ? `Definición, alcance y estructura vertebral de "${effectiveTopic}" dentro de la asignatura ${subjectName}.`
          : idx === 1
          ? `Dominar los términos técnicos y distinciones conceptuales recogidos en ${documentName}.`
          : idx === 2
          ? `Comprender las relaciones causa-efecto, procesos y clasificación desarrollados en el tema.`
          : `Identificar cómo se plantean los casos prácticos y preguntas frecuentes de examen sobre este bloque.`,
      category: 'Concepto Fundamental',
      importance: idx < 2 ? 'alta' : 'media',
    });
  }

  const sentences = sourceText
    .replace(/\r?\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);

  const summarySnippet = sentences.slice(0, 4).join(' ');
  const summary = summarySnippet
    ? `Resumen ejecutivo de "${effectiveTopic}" (${subjectName}): ${summarySnippet}\n\nConceptos clave detectados: ${keyPoints
        .slice(0, 5)
        .map((k) => k.title)
        .join(', ')}.`
    : `Resumen ejecutivo de "${effectiveTopic}" (${subjectName}): abarca los conceptos nucleares, definiciones técnicas, mecanismos principales y aplicaciones prácticas desarrollados en ${documentName}.`;

  return {
    summary,
    keyPoints,
    cues: deepInsights.cues,
  };
}

app.post('/api/gemini/summarize-document-keypoints', async (req: Request, res: Response) => {
  const {
    documentName = 'Documento importado',
    documentContent = '',
    topicTitle = '',
    subjectName = 'Asignatura',
    pageCount = 1,
    forceRefresh = false,
  } = req.body || {};

  const sourceText = (documentContent || topicTitle || documentName || 'Tema académico').trim();
  const cacheKey = `${subjectName}|${topicTitle}|${documentName}|${sourceText.length}|${sourceText.slice(0, 200)}`;
  const cachedResult = keyPointsSummaryCache.get(cacheKey);
  if (!forceRefresh && cachedResult) {
    res.json({ success: true, ...cachedResult, data: cachedResult, cached: true });
    return;
  }

  const deepInsights = extractDeepAcademicInsightsFromNotes(
    topicTitle || documentName,
    sourceText,
    subjectName
  );

  try {
    const prompt = `Actúa como un experto en lingüística computacional y el Método Cornell universitario.
Analiza minuciosamente la totalidad de los apuntes/documento del estudiante aplicando un **Enfoque de Extracción de Jerarquía Semántica (Semantic Hierarchy Extraction)** en 3 niveles:
- **Nivel 1 · Macro-concepto**: Tesis centrales, principios rectores y grandes bloques estructurales del tema.
- **Nivel 2 · Mecanismo/Proceso**: Relaciones causa-efecto, secuencias operativas, mecanismos de acción y clasificaciones intermedias.
- **Nivel 3 · Micro-concepto/Detalle**: Definiciones técnicas exactas, fórmulas, parámetros críticos y excepciones de examen.

Contexto:
- Archivo / Apuntes: "${documentName}" (${pageCount} págs) | Tema: "${topicTitle || documentName}" | Materia: "${subjectName}"

Contenido íntegro de los apuntes (sin límite de caracteres):
"""
${sourceText}
"""

JSON requerido:
1. "summary": Resumen ejecutivo claro y completo (2-3 párrafos) sintetizando la jerarquía semántica del texto.
2. "keyPoints": 8 a 14 conceptos clave extraídos fielmente del texto y estructurados jerárquicamente con:
   - "title": El término, concepto o apartado exacto de los apuntes.
   - "detail": La definición, mecanismo, fórmula o explicación completa dada en los apuntes.
   - "semanticLevel": Uno de "Nivel 1 · Macro-concepto", "Nivel 2 · Mecanismo/Proceso" o "Nivel 3 · Micro-concepto/Detalle".
   - "parentConcept": El concepto paraguas o eje superior al que se subordina.
   - "category": "Tesis / Eje", "Mecanismo Causal", "Clasificación", "Definición Clave", "Fórmula / Dato".
   - "importance": "alta", "media", "baja".
3. "cues": 8 a 12 preguntas detonadoras de Active Recall ("indicios") prefijadas con su nivel semántico ("[Macro]", "[Meso]", "[Micro]") que evalúen las ideas globales, relaciones causales y definiciones específicas del texto.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  semanticLevel: { type: Type.STRING },
                  parentConcept: { type: Type.STRING },
                  category: { type: Type.STRING },
                  importance: { type: Type.STRING },
                },
                required: ['title', 'detail', 'semanticLevel', 'category', 'importance'],
              },
            },
            cues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['summary', 'keyPoints', 'cues'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const aiKeyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
    const seenTitles = new Set(aiKeyPoints.map((kp: any) => String(kp.title || '').toLowerCase()));
    const mergedKeyPoints = [...aiKeyPoints];
    for (const localKt of deepInsights.keyTerms) {
      if (!seenTitles.has(localKt.term.toLowerCase()) && mergedKeyPoints.length < 16) {
        seenTitles.add(localKt.term.toLowerCase());
        mergedKeyPoints.push({
          title: localKt.term,
          detail: localKt.definition,
          semanticLevel: localKt.semanticLevel,
          parentConcept: localKt.parentConcept,
          category: localKt.category,
          importance: localKt.importance,
        });
      }
    }

    const aiCues = Array.isArray(parsed.cues) ? parsed.cues.map(String).filter(Boolean) : [];
    const mergedCues = Array.from(new Set([...aiCues, ...deepInsights.cues])).slice(0, 14);

    const finalResult = {
      summary: parsed.summary || buildDocumentKeyPointsFallback(documentName, sourceText, topicTitle, subjectName).summary,
      keyPoints: mergedKeyPoints,
      cues: mergedCues,
    };

    keyPointsSummaryCache.set(cacheKey, finalResult);
    res.json({ success: true, ...finalResult, data: finalResult });
  } catch (error: any) {
    console.warn('Fallback activated in /api/gemini/summarize-document-keypoints:', error?.message || error);
    const fallback = buildDocumentKeyPointsFallback(
      documentName,
      sourceText,
      topicTitle,
      subjectName
    );
    res.json({ success: true, ...fallback, data: fallback, fallbackUsed: true });
  }
});

// 13. Generación automática de Flashcards estructuradas (Concepto y Definición) desde documentos/apuntes importados en el panel de documentos
app.post('/api/gemini/generate-document-flashcards', async (req: Request, res: Response) => {
  try {
    const {
      documentName = 'Documento importado',
      documentContent = '',
      topicTitle = '',
      subjectName = 'Asignatura',
      count = 6,
    } = req.body;

    const sourceText = (documentContent || '').trim();
    if (!sourceText && !topicTitle) {
      res.status(400).json({
        error: 'Se requiere el contenido de los apuntes importados para generar las flashcards.',
      });
      return;
    }

    const numCards = Math.min(15, Math.max(3, Number(count) || 6));

    const prompt = `Actúa como un catedrático universitario experto en neuroeducación y aprendizaje mediante Active Recall y Repetición Espaciada.
Analiza minuciosamente el contenido de los siguientes apuntes/documentos importados y genera un conjunto de exactamente ${numCards} flashcards estructuradas con "concept" (Concepto claro y específico) y "definition" (Definición académica rigurosa, clara y autocontenida).

Contexto académico:
- Documento / Apuntes importados: "${documentName}"
- Tema: "${topicTitle || documentName}"
- Asignatura: "${subjectName}"

Contenido de los apuntes importados:
"""
${sourceText.slice(0, 28000)}
"""

Instrucciones obligatorias para cada flashcard:
1. "concept": El término técnico, principio, ley, estructura, mecanismo o concepto fundamental extraído de los apuntes (ej. "Potencial de acción", "Teorema de Bayes", "Principio de legalidad", "Mitosis - Metafase").
2. "definition": La definición completa, concisa y estructurada (2 a 3 frases) que explica con precisión qué es el concepto, su función o su fórmula clave según los apuntes.
3. "hint": Una pista breve o regla mnemotécnica para ayudar a recordar la definición durante el estudio activo.
4. "conceptTag": Categoría o subtema al que pertenece el concepto dentro de "${topicTitle || subjectName}".
Responde íntegramente en español.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  concept: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  hint: { type: Type.STRING },
                  conceptTag: { type: Type.STRING },
                },
                required: ['concept', 'definition', 'hint', 'conceptTag'],
              },
            },
          },
          required: ['flashcards'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"flashcards":[]}');
    const list = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
    res.json({ success: true, flashcards: list, data: list });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-document-flashcards:', error);
    res.status(500).json({
      error: error.message || 'Error al analizar los apuntes y generar flashcards con IA.',
    });
  }
});

// 14. Generación de Objetivos SMART personalizados basados en la carga académica actual del estudiante
app.post('/api/gemini/generate-smart-goals', async (req: Request, res: Response) => {
  const {
    programName = 'Grado Universitario',
    yearName = 'Curso Actual',
    targetWeeklyHours = 20,
    dailyAvailableHours = 4,
    blockedWeeklyHours = 15,
    focusTimeframe = 'semanal',
    subjectsSummary = [],
  } = req.body || {};

  const buildSmartGoalsFallback = () => {
    const subs = Array.isArray(subjectsSummary) ? subjectsSummary : [];
    const totalTopics = subs.reduce((acc: number, s: any) => acc + (Number(s.totalTopics) || 0), 0);
    const completedTopics = subs.reduce(
      (acc: number, s: any) => acc + (Number(s.completedTopics) || 0),
      0
    );
    const pendingTopics = Math.max(0, totalTopics - completedTopics);
    const globalPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    const sortedByUrgency = [...subs].sort((a: any, b: any) => {
      const aPct = Number(a.progressPct) || 0;
      const bPct = Number(b.progressPct) || 0;
      return aPct - bPct;
    });

    const prioritySubjects = sortedByUrgency.slice(0, 3);
    const smartGoals = prioritySubjects.map((sub: any, idx: number) => {
      const subTotal = Number(sub.totalTopics) || 6;
      const subDone = Number(sub.completedTopics) || 0;
      const subRemaining = Math.max(1, subTotal - subDone);
      const stepTopics = Math.min(subRemaining, focusTimeframe === 'semanal' ? 2 : 5);
      const estHoursNeeded = Math.max(2, Math.round((Number(sub.remainingHours) || stepTopics * 2) * 10) / 10);

      return {
        id: `smart-goal-${Date.now()}-${idx}`,
        title: `Avanzar ${stepTopics} ${stepTopics === 1 ? 'tema clave' : 'temas clave'} en ${sub.name}`,
        subjectName: sub.name,
        priority: idx === 0 ? 'alta' : 'media',
        specific: `Completar el estudio comprensivo y síntesis Cornell de ${stepTopics} ${
          stepTopics === 1 ? 'tema pendiente' : 'temas pendientes'
        } de ${sub.name}.`,
        measurable: `Pasar de ${subDone}/${subTotal} (${sub.progressPct || 0}%) a ${Math.min(
          subTotal,
          subDone + stepTopics
        )}/${subTotal} temas estudiados.`,
        achievable: `Distribuido en bloques de ${Math.min(
          dailyAvailableHours,
          2
        )}h aprovechando tus ${dailyAvailableHours}h diarias disponibles (~${estHoursNeeded}h en total).`,
        relevant: sub.nextExamDate
          ? `Prioritario para llegar con margen al examen del ${sub.nextExamDate} (${sub.credits || 6} ECTS).`
          : `Impulsa el dominio de una asignatura de ${sub.credits || 6} ECTS y evita cuellos de botella.`,
        timeBound:
          focusTimeframe === 'semanal'
            ? 'En los próximos 7 días (cierre de semana).'
            : focusTimeframe === 'mensual'
            ? 'En las próximas 4 semanas.'
            : sub.nextExamDate
            ? `Antes del examen (${sub.nextExamDate}).`
            : 'En los próximos 14 días.',
        milestones: [
          `Completar lectura activa y apuntes Cornell del primer tema pendiente de ${sub.name}`,
          `Realizar 2 bloques Pomodoro con meta de tema activa para consolidar conceptos`,
          `Superar un cuestionario de autoevaluación con al menos 80% de acierto`,
        ],
      };
    });

    if (smartGoals.length === 0) {
      smartGoals.push({
        id: `smart-goal-${Date.now()}-general`,
        title: `Consolidar ritmo semanal de ${targetWeeklyHours}h en ${programName}`,
        subjectName: yearName,
        priority: 'alta',
        specific: `Estructurar y cumplir ${targetWeeklyHours}h semanales de estudio efectivo con método Cornell y Pomodoro.`,
        measurable: `Completar al menos 3 temas nuevos y 2 sesiones de repaso espaciado por semana.`,
        achievable: `Ajustado a tu disponibilidad real de ${dailyAvailableHours}h/día descontando ${blockedWeeklyHours}h bloqueadas.`,
        relevant: `Base indispensable para mantener la constancia académica en ${programName}.`,
        timeBound: 'Durante los próximos 7 días.',
        milestones: [
          'Bloquear las franjas de estudio principales en el calendario inteligente',
          'Completar los primeros 3 ciclos Pomodoro de la semana',
          'Registrar un repaso de puntos clave antes del domingo',
        ],
      });
    }

    return {
      workloadDiagnosis: `Actualmente acumulas un ${globalPct}% de avance global (${completedTopics}/${totalTopics} temas completados, ${pendingTopics} pendientes) en ${programName} (${yearName}). Con ${dailyAvailableHours}h libres al día y ${blockedWeeklyHours}h semanales bloqueadas, la carga es manejable si priorizas las materias con menor porcentaje de avance.`,
      recommendedWeeklyHours: Math.max(
        10,
        Math.min(45, Math.round(dailyAvailableHours * 5 * 0.85))
      ),
      smartGoals,
    };
  };

  try {
    const subjectsContext = Array.isArray(subjectsSummary)
      ? subjectsSummary
          .map(
            (s: any) =>
              `- ${s.name} (${s.code || 'ASIG'}, ${s.credits || 6} ECTS): ${s.completedTopics || 0}/${
                s.totalTopics || 0
              } temas (${s.progressPct || 0}%), horas restantes estimadas: ${
                s.remainingHours || 0
              }h, tareas pendientes: ${s.pendingTasksCount || 0}, próximo examen: ${
                s.nextExamDate || 'sin fecha'
              }`
          )
          .join('\n')
      : 'Sin asignaturas detalladas';

    const prompt = `Actúa como un mentor académico experto en planificación universitaria, neuroeducación y metodología de objetivos SMART (Specific, Measurable, Achievable, Relevant, Time-bound).
Analiza los datos académicos reales del estudiante y genera un diagnóstico ejecutivo de su carga de estudio junto con 4 objetivos SMART altamente personalizados y accionables.

Contexto académico actual del usuario:
- Estudio / Programa: "${programName}"
- Curso: "${yearName}"
- Horizonte temporal solicitado: "${focusTimeframe}" (semanal, mensual o preparación de exámenes)
- Meta semanal actual configurada: ${targetWeeklyHours}h/semana
- Disponibilidad real estimada: ${dailyAvailableHours}h libres/día (${blockedWeeklyHours}h bloqueadas/semana por clases u obligaciones)
- Estado por asignatura:
${subjectsContext}

Devuelve un objeto JSON estructurado con:
1. "workloadDiagnosis": Diagnóstico claro, motivador y analítico (2-3 frases) sobre el equilibrio entre el temario pendiente, los exámenes próximos y el tiempo disponible real del estudiante.
2. "recommendedWeeklyHours": Número entero de horas semanales recomendadas según su carga real y disponibilidad.
3. "smartGoals": Lista de 4 objetivos SMART concretos. Cada objetivo debe incluir:
   - "id": Identificador único breve
   - "title": Título directo del objetivo
   - "subjectName": Nombre de la asignatura objetivo (o "Global" si aplica a todo el curso)
   - "priority": "alta", "media" o "baja"
   - "specific": Qué debe lograr exactamente (S - Específico)
   - "measurable": Indicador numérico concreto de éxito en temas, páginas, horas o calificación (M - Medible)
   - "achievable": Por qué es realista según sus horas disponibles por día (A - Alcanzable)
   - "relevant": Qué impacto directo tiene en sus exámenes, créditos ECTS o retención (R - Relevante)
   - "timeBound": Plazo concreto para completarlo (T - Temporal)
   - "milestones": Array de 3 hitos paso a paso muy concretos y verificables para lograr este objetivo SMART.
Responde íntegramente en español.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            workloadDiagnosis: { type: Type.STRING },
            recommendedWeeklyHours: { type: Type.INTEGER },
            smartGoals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  subjectName: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  specific: { type: Type.STRING },
                  measurable: { type: Type.STRING },
                  achievable: { type: Type.STRING },
                  relevant: { type: Type.STRING },
                  timeBound: { type: Type.STRING },
                  milestones: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  'id',
                  'title',
                  'subjectName',
                  'priority',
                  'specific',
                  'measurable',
                  'achievable',
                  'relevant',
                  'timeBound',
                  'milestones',
                ],
              },
            },
          },
          required: ['workloadDiagnosis', 'recommendedWeeklyHours', 'smartGoals'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (!Array.isArray(parsed.smartGoals) || parsed.smartGoals.length === 0) {
      const fb = buildSmartGoalsFallback();
      res.json({ success: true, ...fb, data: fb, fallbackUsed: true });
      return;
    }

    res.json({ success: true, ...parsed, data: parsed });
  } catch (error: any) {
    console.warn('Fallback activated in /api/gemini/generate-smart-goals:', error?.message || error);
    const fb = buildSmartGoalsFallback();
    res.json({ success: true, ...fb, data: fb, fallbackUsed: true });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.get(['/sw.js', '/manifest.webmanifest', '/registerSW.js'], (req: Request, res: Response, next) => {
      res.sendFile(path.join(distPath, req.path), (err) => {
        if (err) next();
      });
    });
    app.get('/workbox-:hash.js', (req: Request, res: Response, next) => {
      res.sendFile(path.join(distPath, req.path), (err) => {
        if (err) next();
      });
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`StudyFlow full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
