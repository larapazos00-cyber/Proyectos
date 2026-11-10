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
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
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
  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const modelName = FALLBACK_MODELS[i];
    try {
      return await ai.models.generateContent({
        ...params,
        model: modelName,
        config: {
          ...(params?.config || {}),
        },
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

// 2.1 Extracción automática de términos clave de apuntes Cornell y generación de flashcards con caso de aplicación
app.post('/api/gemini/extract-cornell-flashcards', async (req: Request, res: Response) => {
  try {
    const {
      topicTitle = 'Tema de Estudio',
      notesContent = '',
      cues = [],
      summary = '',
      selectedTerms = [],
      count = 6,
    } = req.body;

    const cuesText = Array.isArray(cues) && cues.length > 0
      ? `\nColumna de ideas clave y preguntas (Cues):\n- ${cues.join('\n- ')}`
      : '';
    const summaryText = summary
      ? `\nResumen final del método Cornell:\n"""${summary}"""`
      : '';

    const termsConstraint = Array.isArray(selectedTerms) && selectedTerms.length > 0
      ? `\nTérminos prioritarios seleccionados por el estudiante a incluir obligatoriamente:\n- ${selectedTerms.join('\n- ')}`
      : '';

    const prompt = `Actúa como un profesor universitario experto en pedagogía y metodología Active Recall.
Tu objetivo es analizar minuciosamente todo el cuerpo de las notas de método Cornell sobre el tema "${topicTitle}" para extraer los términos técnicos y conceptos clave esenciales, y generar flashcards de estudio de alto rendimiento.

Notas de método Cornell completas del estudiante:
"""
${notesContent || topicTitle}
"""${cuesText}${summaryText}${termsConstraint}

Instrucciones pedagógicas rigurosas:
1. Extrae los términos, entidades, mecanismos y conceptos clave más importantes del texto completo.
2. Genera exactamente ${count} flashcards de estudio siguiendo esta estructura obligatoria:
   - "term": Nombre exacto y claro del concepto o término clave (ejemplo: "Potencial de reposo", "Inhibidor competitivo", "Fosfofructoquinasa-1").
   - "definition": Definición teórica concisa, precisa y rigurosa (2-3 frases) explicando su fundamento conceptual.
   - "practicalCase": Un caso de aplicación práctica, clínica o experimental breve (1-2 frases) que demuestre cómo se manifiesta o para qué se utiliza este concepto en la práctica real.
   - "hint": Una pista nemotécnica o dato activador para facilitar el Active Recall si el estudiante duda.
   - "conceptTag": Subárea o categoría temática del concepto.
3. El idioma debe ser rigurosamente en español técnico impecable.`;

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
                description: 'Lista de términos clave detectados en las notas Cornell',
              },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    definition: { type: Type.STRING },
                    practicalCase: { type: Type.STRING },
                    hint: { type: Type.STRING },
                    conceptTag: { type: Type.STRING },
                  },
                  required: ['term', 'definition', 'practicalCase', 'hint', 'conceptTag'],
                },
              },
            },
            required: ['extractedTerms', 'flashcards'],
          },
        },
      });
      parsedData = JSON.parse(response.text || '{"extractedTerms":[],"flashcards":[]}');
    } catch (aiErr: any) {
      console.warn('Fallback activated for /api/gemini/extract-cornell-flashcards:', aiErr?.message || aiErr);
    }

    if (!parsedData || !Array.isArray(parsedData.flashcards) || parsedData.flashcards.length === 0) {
      const rawLines = String(notesContent || summary || topicTitle)
        .split(/\n+/)
        .map((l) => l.replace(/^[#*\->\d.\s]+/, '').trim())
        .filter((l) => l.length > 10);
      const termsSource =
        Array.isArray(selectedTerms) && selectedTerms.length > 0
          ? selectedTerms
          : Array.isArray(cues) && cues.length > 0
          ? cues
          : rawLines.slice(0, Number(count) || 6).map((l) => l.split(/[:.;,-]/)[0].trim().slice(0, 50));

      const total = Math.max(1, Math.min(15, Number(count) || 6));
      const fallbackCards = Array.from({ length: total }, (_, idx) => {
        const termName = termsSource[idx % Math.max(1, termsSource.length)] || `${topicTitle} - Concepto ${idx + 1}`;
        const contextSentence = rawLines[idx % Math.max(1, rawLines.length)] || `Concepto fundamental dentro del estudio de ${topicTitle}.`;
        return {
          term: termName,
          definition: `${contextSentence}. Constituye un eje estructural del bloque "${topicTitle}" para el dominio técnico de la asignatura.`,
          practicalCase: `En un supuesto práctico o de examen sobre ${topicTitle}, permite identificar y justificar rigurosamente el comportamiento de "${termName}".`,
          hint: `Conecta este término con la idea central de ${topicTitle}.`,
          conceptTag: topicTitle,
        };
      });
      parsedData = {
        extractedTerms: fallbackCards.map((c) => c.term),
        flashcards: fallbackCards,
      };
    }

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error in /api/gemini/extract-cornell-flashcards:', error);
    res.status(500).json({ error: error.message || 'Error al extraer términos y generar flashcards.' });
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

// 4.2 Evaluación de Explicación Oral por Audio (Técnica Feynman)
app.post('/api/gemini/evaluate-audio-feynman', async (req: Request, res: Response) => {
  try {
    const {
      concept,
      audioBase64,
      mimeType = 'audio/webm',
      targetAudience = 'un estudiante o principiante',
      referenceContent = '',
    } = req.body;
    if (!audioBase64) {
      res.status(400).json({ error: 'Falta la grabación o archivo de audio.' });
      return;
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const refBlock = referenceContent
      ? `\nMaterial de referencia del tema para verificar precisión:\n"""${String(referenceContent).slice(0, 10000)}"""`
      : '';

    const prompt = `Escucha atentamente este audio donde un estudiante explica con sus propias palabras el concepto: "${concept}".
Aplica con rigor y empatía pedagógica la Técnica de Feynman para analizar si su explicación es SIMPLE y PRECISA, ofreciendo correcciones específicas si detectas conceptos mal explicados.
Audiencia objetivo a la que se dirige: "${targetAudience}".${refBlock}

Devuelve un JSON con:
1. "transcription": Transcripción textual exacta y completa de lo que el estudiante dijo en el audio.
2. "simplicityScore" (0 a 100): Puntuación de simplicidad, claridad y ausencia de tecnicismos oscuros.
3. "clarityScore" (0 a 100): Equivalente a simplicityScore.
4. "accuracyScore" (0 a 100): Puntuación de precisión conceptual y rigor académico.
5. "overallScore" (0 a 100): Puntuación global combinada.
6. "corrections": Lista de correcciones para cualquier concepto mal explicado, erróneo, impreciso o confuso detectado en el audio ({ concept, userMistake, correction, severity: "error_conceptual" | "imprecision" | "exceso_jerga" }).
7. "strengths": Lista de 2 a 4 puntos bien explicados por el estudiante.
8. "identifiedJargon": Lista de términos técnicos rebuscados que empleó sin explicar en términos sencillos.
9. "conceptualGaps": Lagunas conceptuales o aspectos clave que omitió.
10. "intuitiveAnalogies": 2 analogías cotidianas y visuales para redondear la comprensión.
11. "improvedDraft": Una versión modelo mejorada explicada de forma simple y precisa según el método Feynman.
12. "followUpQuestions": 2 preguntas para comprobar si ha comprendido las correcciones.
13. "feedback": Comentario constructivo sobre la simplicidad, precisión y soltura de su explicación.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          },
          { text: prompt },
        ],
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
            'corrections',
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
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/gemini/evaluate-audio-feynman:', error);
    res.status(500).json({ error: error.message || 'Error al evaluar el audio de Feynman.' });
  }
});

// 4.3 Estructurar y Enriquecer Apuntes de un Tema
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

  const formattedSections: string[] = [];
  formattedSections.push(`# 📚 ${effectiveTitle}`);
  if (subjectName) {
    formattedSections.push(`> **Asignatura:** ${subjectName} · *Apuntes estructurados para estudio activo y Método Cornell*`);
  }

  if (cleanLines.length <= 2 && effectiveNotes.length < 180) {
    formattedSections.push(`## 1. Conceptos Fundamentales`);
    formattedSections.push(
      `- **Idea central de ${effectiveTitle}:** ${effectiveNotes}\n- **Relación con ${subjectName || 'la materia'}:** Comprender la definición, estructura, mecanismos principales y su aplicación en preguntas de examen.`
    );
  } else {
    let sectionIdx = 1;
    let currentList: string[] = [];

    for (const line of cleanLines) {
      if (/^#{1,3}\s+/.test(line)) {
        if (currentList.length > 0) {
          formattedSections.push(currentList.join('\n'));
          currentList = [];
        }
        formattedSections.push(line);
        continue;
      }

      const isShortHeader =
        line.length < 75 &&
        !line.endsWith('.') &&
        (line.endsWith(':') || /^[0-9]+[.)]\s+[A-ZÁÉÍÓÚÑ]/.test(line) || line === line.toUpperCase());

      if (isShortHeader) {
        if (currentList.length > 0) {
          formattedSections.push(currentList.join('\n'));
          currentList = [];
        }
        const cleanHeader = line.replace(/:$/, '').replace(/^[0-9]+[.)]\s*/, '');
        formattedSections.push(`## ${sectionIdx++}. ${cleanHeader}`);
      } else {
        const cleanBullet = line.replace(/^[-•*]\s*/, '');
        const colonIdx = cleanBullet.indexOf(':');
        if (colonIdx > 2 && colonIdx < 55) {
          const term = cleanBullet.slice(0, colonIdx).trim();
          const rest = cleanBullet.slice(colonIdx + 1).trim();
          currentList.push(`- **${term}:** ${rest}`);
        } else if (cleanBullet.length > 140) {
          // Highlight first key phrase if sentence is long
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

    if (currentList.length > 0) {
      if (sectionIdx === 1) {
        formattedSections.push(`## 1. Desarrollo Estructurado del Tema`);
      }
      formattedSections.push(currentList.join('\n'));
    }
  }

  const keyTerms: Array<{ term: string; definition: string }> = [];
  for (const line of cleanLines) {
    const clean = line.replace(/^[-•*0-9.)\s]+/, '');
    const colonIdx = clean.indexOf(':');
    if (colonIdx > 2 && colonIdx < 50 && clean.length > colonIdx + 8) {
      keyTerms.push({
        term: clean.slice(0, colonIdx).replace(/\*+/g, '').trim(),
        definition: clean.slice(colonIdx + 1).trim(),
      });
      if (keyTerms.length >= 6) break;
    }
  }

  if (keyTerms.length > 0) {
    formattedSections.push(`## 🔑 Términos y Definiciones Clave`);
    formattedSections.push(
      keyTerms.map((kt) => `- **${kt.term}:** ${kt.definition}`).join('\n')
    );
  }

  const firstParagraph = paragraphs[0] || effectiveNotes.slice(0, 350);
  const lastParagraph =
    paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : '';
  const summary = [
    `Síntesis de "${effectiveTitle}" (${subjectName || 'Asignatura'}): ${firstParagraph.slice(0, 320)}${firstParagraph.length > 320 ? '...' : ''}`,
    lastParagraph
      ? `Conclusión y enfoque de examen: ${lastParagraph.slice(0, 280)}${lastParagraph.length > 280 ? '...' : ''}`
      : `Dominar los conceptos estructurados en estos apuntes permite responder con precisión tanto preguntas tipo test como de desarrollo.`,
  ].join('\n\n');

  formattedSections.push(`## 📌 Resumen Ejecutivo para Repaso`);
  formattedSections.push(`> ${summary.replace(/\n\n/g, '\n>\n> ')}`);

  const cues = [
    `¿Cuáles son los conceptos y definiciones fundamentales de ${effectiveTitle}?`,
    ...(keyTerms.slice(0, 3).map((kt) => `¿Qué es y cómo se define "${kt.term}"?`)),
    `¿Qué mecanismos o relaciones clave explican el funcionamiento de ${effectiveTitle}?`,
    `¿Cómo se aplica ${effectiveTitle} en un caso práctico o pregunta de examen de ${subjectName || 'la asignatura'}?`,
  ].slice(0, 6);

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
  const subtopicsList = Array.isArray(subtopics) && subtopics.length > 0 ? `\nSubtemas del programa: ${subtopics.join(', ')}` : '';
  const effectiveNotes = ((rawNotes || rawText || effectiveTitle) + subtopicsList).trim().slice(0, 12000);
  const cacheKey = `${subjectName}_${effectiveTitle}_${effectiveNotes.length}_${effectiveNotes.slice(0, 160)}`;

  if (!forceRefresh && cornellStructureCache.has(cacheKey)) {
    res.json({ success: true, data: cornellStructureCache.get(cacheKey), cached: true });
    return;
  }

  try {
    const prompt = `Eres un catedrático experto en el Método Cornell de la Universidad de Cornell.
Genera una hoja completa del Método Cornell para el tema "${effectiveTitle}" de la asignatura "${subjectName || 'General'}".
Contenido y apuntes de referencia:
"""${effectiveNotes}"""

Devuelve en JSON:
1. "notes": Cuerpo principal de apuntes Cornell en Markdown claro y estructurado (secciones con ##, viñetas explicativas, conceptos en **negrita**, ejemplos y fórmulas si aplica). Si los apuntes de entrada son breves o solo tienen el título/subtemas, desarrolla tú mismo los contenidos fundamentales del tema con rigor académico.
2. "cues": 5 a 7 preguntas detonadoras (Columna Izquierda Cornell / Active Recall) e ideas clave para autoevaluarse tapando la columna derecha.
3. "summary": Resumen ejecutivo inferior (Síntesis Cornell de 2 párrafos) con la esencia para repaso rápido antes del examen.
4. "keyTerms": 5 a 8 términos técnicos clave del tema con su definición concisa.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
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
                },
                required: ['term', 'definition'],
              },
            },
          },
          required: ['notes', 'cues', 'summary'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed && parsed.notes && Array.isArray(parsed.cues)) {
      cornellStructureCache.set(cacheKey, parsed);
    }
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.warn('Fallback activated in /api/gemini/structure-topic-notes:', error?.message || error);
    const fallbackData = buildStructuredTopicNotesFallback(
      effectiveTitle,
      effectiveNotes,
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

// 9. Extracción de Términos Clave desde Notas Cornell y Generación de Flashcards Activas
app.post('/api/gemini/extract-cornell-flashcards', async (req: Request, res: Response) => {
  try {
    const { topicTitle, notesContent, cues = [], summary = '', subjectName, count = 6, selectedTerms } = req.body;

    if (!notesContent && (!cues || cues.length === 0) && !summary) {
      res.status(400).json({ error: 'Se requiere el contenido de las notas Cornell (cuerpo, notas o resumen).' });
      return;
    }

    const cuesText = Array.isArray(cues) && cues.length > 0 ? `\nPreguntas detonadoras / Cues:\n- ${cues.join('\n- ')}` : '';
    const summaryText = summary ? `\nResumen del estudiante:\n"""${summary}"""` : '';
    const selectedTermsContext = Array.isArray(selectedTerms) && selectedTerms.length > 0
      ? `\nPrioriza especialmente los siguientes términos seleccionados por el estudiante: ${selectedTerms.join(', ')}.`
      : '';

    const prompt = `Actúa como un profesor universitario experto en métodos de aprendizaje activo y Active Recall.
Tu objetivo es analizar minuciosamente los apuntes del Método Cornell para el tema: "${topicTitle || 'Tema de Estudio'}" (Asignatura: "${subjectName || 'General'}").

Contenido de los apuntes Cornell (cuerpo y notas):
"""
${notesContent || ''}
"""
${cuesText}
${summaryText}
${selectedTermsContext}

Instrucciones pedagógicas:
1. Identifica los conceptos y términos técnicos clave fundamentales más probables de examen.
2. Devuelve una lista de términos clave identificados en "extractedTerms" (entre 4 y 12 términos).
3. Genera un set de ${count || 6} flashcards de alta eficacia para repaso espaciado. Cada flashcard debe estructurarse estrictamente con:
   - "term": El concepto o término clave (conciso, 1 a 4 palabras).
   - "definition": Definición precisa, rigurosa y directa al grano (2-4 frases que expliquen su esencia académica sin rodeos).
   - "practicalCase": Caso de aplicación práctica concreto (un escenario de aplicación real, ejemplo clínico, caso de estudio práctico o problema resuelto donde se aplica este concepto).
   - "hint": Una pista orientativa breve para ayudar al recuerdo activo sin revelar la respuesta completa.
   - "conceptTag": Etiqueta temática corta clasificatoria (ej. "Mecanismo", "Fisiología", "Principio Legal", "Diagnóstico", "Fórmula", etc.).`;

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
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  practicalCase: { type: Type.STRING },
                  hint: { type: Type.STRING },
                  conceptTag: { type: Type.STRING },
                },
                required: ['term', 'definition', 'practicalCase', 'hint', 'conceptTag'],
              },
            },
          },
          required: ['extractedTerms', 'flashcards'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/gemini/extract-cornell-flashcards:', error);
    res.status(500).json({ error: error.message || 'Error al extraer términos y generar flashcards con Gemini.' });
  }
});

// 10. Generación de Resumen Automático y Puntos Clave Editables para Documentos Importados
function buildDocumentKeyPointsFallback(
  documentName: string,
  sourceText: string,
  topicTitle: string,
  subjectName: string
) {
  const effectiveTopic = topicTitle || documentName || 'Tema de Estudio';
  const lines = sourceText
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*#\s]+/, '').trim())
    .filter((l) => l.length > 18);

  const sentences = sourceText
    .replace(/\r?\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);

  const candidateBlocks = lines.length >= 4 ? lines : sentences;
  const categories = [
    'Definición Clave',
    'Concepto Fundamental',
    'Mecanismo / Desarrollo',
    'Punto de Examen',
    'Aplicación Práctica',
    'Síntesis',
  ];

  const keyPoints = candidateBlocks.slice(0, 6).map((block, idx) => {
    const colonIdx = block.indexOf(':');
    let title = '';
    let detail = block;
    if (colonIdx > 2 && colonIdx < 60) {
      title = block.slice(0, colonIdx).replace(/\*+/g, '').trim();
      detail = block.slice(colonIdx + 1).trim();
    } else {
      const words = block.replace(/\*+/g, '').split(/\s+/);
      title = words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
      detail = block;
    }
    return {
      title: title || `Punto clave ${idx + 1}: ${effectiveTopic}`,
      detail:
        detail.length > 20
          ? detail
          : `${detail} — Concepto esencial de ${effectiveTopic} en ${subjectName}.`,
      category: categories[idx % categories.length],
      importance: idx < 3 ? 'alta' : idx < 5 ? 'media' : 'baja',
    };
  });

  while (keyPoints.length < 5) {
    const idx = keyPoints.length;
    keyPoints.push({
      title:
        idx === 0
          ? `Fundamento principal de ${effectiveTopic}`
          : idx === 1
          ? `Conceptos y terminología clave`
          : idx === 2
          ? `Relaciones y mecanismos esenciales`
          : idx === 3
          ? `Aplicación práctica y resolución`
          : `Síntesis para evaluación de ${subjectName}`,
      detail:
        idx === 0
          ? `Definición, alcance y estructura vertebral de "${effectiveTopic}" dentro de la asignatura ${subjectName}.`
          : idx === 1
          ? `Dominar los términos técnicos y distinciones conceptuales recogidos en ${documentName}.`
          : idx === 2
          ? `Comprender las relaciones causa-efecto, procesos y clasificación desarrollados en el tema.`
          : idx === 3
          ? `Identificar cómo se plantean los casos prácticos y preguntas frecuentes de examen sobre este bloque.`
          : `Repasar las conclusiones principales para consolidar la memoria a largo plazo (Active Recall).`,
      category: categories[idx % categories.length],
      importance: idx < 2 ? 'alta' : 'media',
    });
  }

  const summarySnippet = sentences.slice(0, 3).join(' ');
  const summary = summarySnippet
    ? `Resumen ejecutivo de "${effectiveTopic}" (${subjectName}): ${summarySnippet.slice(0, 480)}${summarySnippet.length > 480 ? '...' : ''}\n\nEste bloque sintetiza los ejes fundamentales de ${documentName} para facilitar el repaso activo y la preparación de exámenes.`
    : `Resumen ejecutivo de "${effectiveTopic}" (${subjectName}): abarca los conceptos nucleares, definiciones técnicas, mecanismos principales y aplicaciones prácticas desarrollados en ${documentName}.`;

  const cues = keyPoints.slice(0, 5).map(
    (kp) => `¿Cómo explicarías con precisión "${kp.title}" y su importancia en ${effectiveTopic}?`
  );

  return {
    summary,
    keyPoints,
    cues,
  };
}

app.post('/api/gemini/summarize-document-keypoints', async (req: Request, res: Response) => {
  const {
    documentName = 'Documento importado',
    documentContent = '',
    topicTitle = '',
    subjectName = 'Asignatura',
    pageCount = 1,
  } = req.body || {};

  const sourceText = (documentContent || topicTitle || documentName || 'Tema académico').trim();
  const trimmedSource = sourceText.slice(0, 10000);
  const cacheKey = `${subjectName}|${topicTitle}|${documentName}|${trimmedSource.length}|${trimmedSource.slice(0, 180)}`;
  const cachedResult = keyPointsSummaryCache.get(cacheKey);
  if (cachedResult) {
    res.json({ success: true, ...cachedResult, data: cachedResult, cached: true });
    return;
  }

  try {
    const prompt = `Extrae en español un resumen ejecutivo directo (1-2 párrafos breves) y 5 a 6 puntos clave accionables de alto valor para examen:
- Archivo: "${documentName}" (${pageCount} págs) | Tema: "${topicTitle || documentName}" | Materia: "${subjectName}"

Contenido:
"""
${trimmedSource}
"""

JSON requerido:
1. "summary": Resumen ejecutivo conciso (2-4 oraciones).
2. "keyPoints": 5 a 6 puntos clave con "title" (3-7 palabras), "detail" (1-2 oraciones claras), "category" ("Definición Clave", "Mecanismo", "Fórmula / Dato", "Pregunta de Examen") e "importance" ("alta", "media", "baja").
3. "cues": 3 a 4 preguntas de Active Recall.`;

    const response = await generateContentWithFallback({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.2,
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
                  category: { type: Type.STRING },
                  importance: { type: Type.STRING },
                },
                required: ['title', 'detail', 'category', 'importance'],
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
    keyPointsSummaryCache.set(cacheKey, parsed);
    res.json({ success: true, ...parsed, data: parsed });
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
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
