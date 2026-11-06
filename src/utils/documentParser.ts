import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import {
  AttachedTopicFile,
  DocumentImageAsset,
  ImportedFileFormat,
} from '../types';

// Configurar el worker de PDF.js compatible con Vite y navegadores modernos
try {
  if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
} catch (workerErr) {
  console.warn('Aviso al configurar worker de PDF.js:', workerErr);
}

/**
 * Detecta el formato de un archivo importado (PDF, Word, PowerPoint, Imagen, Texto)
 */
export function detectImportedFileType(file: File): ImportedFileFormat {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    mime.includes('wordprocessingml') ||
    mime === 'application/msword' ||
    mime.includes('opendocument.text') ||
    mime === 'application/rtf' ||
    mime === 'text/rtf' ||
    name.endsWith('.docx') ||
    name.endsWith('.doc') ||
    name.endsWith('.odt') ||
    name.endsWith('.rtf')
  ) {
    return 'word';
  }
  if (
    mime.includes('presentationml') ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime.includes('opendocument.presentation') ||
    name.endsWith('.pptx') ||
    name.endsWith('.ppt') ||
    name.endsWith('.odp')
  ) {
    return 'powerpoint';
  }
  if (
    mime.startsWith('image/') ||
    /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(name)
  ) {
    return 'image';
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    name.endsWith('.csv') ||
    name.endsWith('.tsv') ||
    name.endsWith('.html') ||
    name.endsWith('.htm') ||
    name.endsWith('.json') ||
    name.endsWith('.xml')
  ) {
    return 'text';
  }
  return 'doc';
}

export function getFileFormatLabel(fileType?: ImportedFileFormat): string {
  switch (fileType) {
    case 'pdf':
      return 'PDF';
    case 'word':
      return 'WORD';
    case 'powerpoint':
      return 'PPTX';
    case 'image':
      return 'IMG';
    case 'text':
      return 'TXT';
    default:
      return 'DOC';
  }
}

/**
 * Limpia y sanea el texto extraído eliminando artefactos binarios, caracteres de control
 * o residuos técnicos, preservando acentos, eñes, símbolos matemáticos y saltos de línea.
 */
export function sanitizeExtractedText(raw: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/\uFEFF/g, '') // Quitar BOM
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Eliminar caracteres de control invisibles salvo \t y \n
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Filtrar líneas que sean puramente basura binaria de flujos PDF o cabeceras ZIP
  const lines = text.split('\n');
  const cleanedLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^%PDF-\d\.\d/i.test(trimmed)) return false;
    if (/^(?:xref|trailer|startxref|endobj|endstream|stream)$/i.test(trimmed)) return false;
    if (/^\d+\s+\d+\s+obj$/i.test(trimmed)) return false;
    if (/^<<.*\/Filter\s*\/FlateDecode.*>>$/i.test(trimmed)) return false;
    if (/^<<.*\/Type\s*\/(?:Page|Pages|Catalog|Font|XObject).*>>$/i.test(trimmed)) return false;
    return true;
  });

  return cleanedLines
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/**
 * Decodifica un ArrayBuffer de texto detectando automáticamente UTF-8, UTF-16LE/BE o Windows-1252 (ANSI español)
 * para evitar caracteres rotos () en tildes, eñes o signos de apertura (¿, ¡).
 */
export function decodeTextBufferSmart(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return '';

  // Detectar BOM UTF-16LE (FF FE) o UTF-16BE (FE FF)
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }
  }

  // Intentar UTF-8 estricto primero
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(bytes);
  } catch {
    // Si falla UTF-8 estricto (ej. archivo guardado en ANSI / Windows-1252 o ISO-8859-1 en español)
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      return new TextDecoder('iso-8859-1').decode(bytes);
    }
  }
}

/**
 * Convierte contenido RTF (Rich Text Format) a texto limpio legible en español
 */
export function extractTextFromRtf(rtfRaw: string): string {
  if (!rtfRaw || !rtfRaw.trim().startsWith('{\\rtf')) {
    return rtfRaw;
  }

  let text = rtfRaw;
  // Eliminar grupos de metadatos internos de RTF (fuentes, colores, hojas de estilo, imágenes binarias)
  text = text.replace(/\{\\\*\\[a-z]+[^}]*\}/gi, '');
  text = text.replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict|header|footer|operator)[\s\S]*?\}/gi, '');

  // Convertir saltos de párrafo y línea RTF
  text = text.replace(/\\(?:par|pard|line|sect)\b\s*/gi, '\n');
  text = text.replace(/\\tab\b\s*/gi, '\t');

  // Decodificar escapes hexadecimales \'xx (Windows-1252 común en español: á='e1, é='e9, í='ed, ó='f3, ú='fa, ñ='f1)
  const win1252Decoder = new TextDecoder('windows-1252');
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    const byte = parseInt(hex, 16);
    return win1252Decoder.decode(new Uint8Array([byte]));
  });

  // Decodificar caracteres Unicode \uN?
  text = text.replace(/\\u(-?\d+)\??/g, (_, codeStr) => {
    let code = parseInt(codeStr, 10);
    if (code < 0) code += 65536;
    return String.fromCharCode(code);
  });

  // Eliminar comandos de control restantes \palabra123
  text = text.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');
  // Limpiar llaves sobrantes
  text = text.replace(/[{}]/g, '');

  return sanitizeExtractedText(text);
}

/**
 * Extrae texto estructurado Markdown de un archivo HTML (.html / .htm)
 */
export function extractStructuredTextFromHtml(htmlRaw: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlRaw, 'text/html');
    doc.querySelectorAll('script, style, noscript, iframe, svg, head, nav, footer').forEach((el) => el.remove());
    return convertRichHtmlToPlainText(doc.body.innerHTML || htmlRaw);
  } catch {
    return htmlRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Detecta de forma precisa el número de páginas reales de un archivo PDF
 * analizando su estructura interna (/Type /Page y /Count) en el navegador.
 */
export async function detectPdfPageCountFromBuffer(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder('latin1').decode(bytes);

    // 1. Contar ocurrencias de objetos de página individuales: /Type /Page (sin /Pages)
    const pageMatches = text.match(/\/Type\s*\/Page\b(?!s)/g);
    const individualPageCount = pageMatches ? pageMatches.length : 0;

    // 2. Buscar el nodo raíz /Pages con /Count N
    const countMatches = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/gs)];
    let maxDeclaredCount = 0;
    for (const match of countMatches) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > maxDeclaredCount && val < 5000) {
        maxDeclaredCount = val;
      }
    }

    if (maxDeclaredCount === 0) {
      const reverseMatches = [...text.matchAll(/\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/gs)];
      for (const match of reverseMatches) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxDeclaredCount && val < 5000) {
          maxDeclaredCount = val;
        }
      }
    }

    if (individualPageCount > 0 && maxDeclaredCount > 0) {
      return Math.max(individualPageCount, maxDeclaredCount);
    }
    if (individualPageCount > 0) {
      return individualPageCount;
    }
    if (maxDeclaredCount > 0) {
      return maxDeclaredCount;
    }

    return Math.max(1, Math.round(file.size / 65000));
  } catch {
    return 1;
  }
}

/**
 * Extrae imágenes JPEG embebidas directamente en un flujo PDF si existen
 */
export async function extractEmbeddedJpegsFromPdfBuffer(
  file: File,
  maxImages = 8
): Promise<DocumentImageAsset[]> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const extracted: DocumentImageAsset[] = [];

    let i = 0;
    while (i < bytes.length - 4 && extracted.length < maxImages) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        let end = i + 3;
        while (end < bytes.length - 1) {
          if (bytes[end] === 0xff && bytes[end + 1] === 0xd9) {
            end += 2;
            break;
          }
          end++;
        }
        const length = end - i;
        if (length > 4096 && length < 4 * 1024 * 1024) {
          const slice = bytes.subarray(i, end);
          let binary = '';
          const chunkSize = 8192;
          for (let j = 0; j < slice.length; j += chunkSize) {
            binary += String.fromCharCode(...slice.subarray(j, j + chunkSize));
          }
          const base64 = btoa(binary);
          extracted.push({
            id: `pdf-img-${Date.now()}-${extracted.length + 1}`,
            name: `Figura ${extracted.length + 1} (${file.name})`,
            dataUrl: `data:image/jpeg;base64,${base64}`,
            caption: `Ilustración / figura extraída de ${file.name}`,
            widthPercent: 75,
          });
        }
        i = end;
      } else {
        i++;
      }
    }
    return extracted;
  } catch {
    return [];
  }
}

/**
 * Verifica si un texto extraído corresponde a lenguaje humano real y comprensible
 * y no a artefactos binarios o diccionarios internos de PDF (/FlateDecode, /Font, etc.).
 */
export function isAuthenticReadableText(text: string): boolean {
  if (!text || text.trim().length < 15) return false;

  // Si contiene operadores o directivas binarias internas de PDF crudas, rechazar
  const pdfBinaryArtifacts =
    /\b(FlateDecode|FontDescriptor|ObjStm|XObject|MediaBox|ProcSet|startxref|CIDFontType2)\b/i;
  if (pdfBinaryArtifacts.test(text)) return false;

  // Contar palabras con letras reales (español / inglés / catalán / gallego / etc.)
  const words = text.match(/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙçÇ]{2,}/g) || [];
  if (words.length < 3 && text.trim().length < 40) return false;
  if (words.length === 0) return false;

  // Comprobar proporción de caracteres legibles frente a caracteres de control o basura
  const validChars = (
    text.match(
      /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙçÇ0-9\s.,;:?¿!¡()[\]{}\-—–_+/*=<>|@#%&€$°ºª"'’“”«»`~^\\]/g
    ) || []
  ).length;
  const ratio = validChars / text.length;
  return ratio >= 0.75;
}

/**
 * Reconstruye líneas, párrafos y encabezados de una página PDF a partir de los items de PDF.js (`getTextContent()`),
 * respetando coordenadas (X, Y), tamaños de fuente y saltos de línea reales.
 */
function reconstructPageMarkdownFromPdfItems(items: any[]): string {
  if (!items || items.length === 0) return '';

  interface PositionedTextItem {
    str: string;
    x: number;
    y: number;
    height: number;
    width: number;
    hasEOL: boolean;
  }

  const validItems: PositionedTextItem[] = [];
  const heights: number[] = [];

  for (const raw of items) {
    if (typeof raw?.str !== 'string') continue;
    const str = raw.str;
    if (!str.trim() && !raw.hasEOL) continue;

    const transform = Array.isArray(raw.transform) ? raw.transform : [1, 0, 0, 12, 0, 0];
    const x = Number(transform[4]) || 0;
    const y = Number(transform[5]) || 0;
    const fontHeight = Math.abs(Number(transform[3]) || Number(raw.height) || 11);
    const width = Number(raw.width) || str.length * (fontHeight * 0.5);

    if (str.trim().length > 0 && fontHeight > 4 && fontHeight < 100) {
      heights.push(fontHeight);
    }

    validItems.push({
      str,
      x,
      y,
      height: fontHeight || 11,
      width,
      hasEOL: Boolean(raw.hasEOL),
    });
  }

  if (validItems.length === 0) return '';

  // Calcular altura mediana de fuente del cuerpo de texto para identificar títulos y subtítulos
  const sortedHeights = [...heights].sort((a, b) => a - b);
  const medianHeight =
    sortedHeights.length > 0
      ? sortedHeights[Math.floor(sortedHeights.length / 2)]
      : 11;

  // Agrupar items en líneas visuales según su coordenada Y (en PDF, Y crece hacia arriba)
  // Ordenar de arriba a abajo (Y descendente) y de izquierda a derecha (X ascendente)
  const sorted = [...validItems].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 3.5) return yDiff;
    return a.x - b.x;
  });

  interface ReconstructedLine {
    y: number;
    maxHeight: number;
    text: string;
  }

  const lines: ReconstructedLine[] = [];
  let currentLineItems: PositionedTextItem[] = [];
  let currentY = sorted[0].y;

  const flushLine = () => {
    if (currentLineItems.length === 0) return;
    currentLineItems.sort((a, b) => a.x - b.x);

    let lineText = '';
    let maxH = 0;
    let prevEndX: number | null = null;

    for (const item of currentLineItems) {
      if (item.height > maxH) maxH = item.height;
      const piece = item.str;
      if (!piece) continue;

      if (lineText === '') {
        lineText = piece;
      } else {
        const gap = prevEndX !== null ? item.x - prevEndX : 0;
        const needsSpace =
          !lineText.endsWith(' ') &&
          !piece.startsWith(' ') &&
          !/^[.,;:!?¿¡)\]}-]/.test(piece) &&
          !lineText.endsWith('-') &&
          gap > -2;
        lineText += (needsSpace ? ' ' : '') + piece;
      }
      prevEndX = item.x + item.width;
    }

    const cleaned = lineText.replace(/\s+/g, ' ').trim();
    if (cleaned) {
      lines.push({
        y: currentY,
        maxHeight: maxH || medianHeight,
        text: cleaned,
      });
    }
    currentLineItems = [];
  };

  for (const item of sorted) {
    const yDelta = Math.abs(item.y - currentY);
    const threshold = Math.max(3.5, Math.min(item.height, medianHeight) * 0.45);
    if (currentLineItems.length > 0 && yDelta > threshold) {
      flushLine();
      currentY = item.y;
    }
    if (currentLineItems.length === 0) {
      currentY = item.y;
    }
    currentLineItems.push(item);
    if (item.hasEOL) {
      flushLine();
    }
  }
  flushLine();

  if (lines.length === 0) return '';

  // Unir líneas en párrafos inteligentes, detectando títulos, listas y separaciones de párrafo
  const blocks: string[] = [];
  let currentParagraph = '';

  const flushParagraph = () => {
    if (currentParagraph.trim()) {
      blocks.push(currentParagraph.trim());
      currentParagraph = '';
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : null;
    const yGap = prevLine ? Math.abs(prevLine.y - line.y) : 0;
    const isLargeGap = prevLine ? yGap > Math.max(line.maxHeight * 1.65, 18) : false;

    const isBulletList = /^(?:[•●▪▸◦*-]|\d+[.)]|[a-zA-Z][.)])\s+/.test(line.text);
    const isHeading1 =
      line.maxHeight >= medianHeight * 1.45 &&
      line.text.length < 130 &&
      !/[.;]$/.test(line.text);
    const isHeading2 =
      !isHeading1 &&
      (line.maxHeight >= medianHeight * 1.22 ||
        /^(?:TEMA|CAP[ÍI]TULO|UNIDAD|SECCI[ÓO]N|APARTADO)\s+\d+/i.test(line.text)) &&
      line.text.length < 140;

    if (isHeading1) {
      flushParagraph();
      blocks.push(`## ${line.text}`);
    } else if (isHeading2) {
      flushParagraph();
      blocks.push(`### ${line.text}`);
    } else if (isBulletList) {
      flushParagraph();
      const normalizedBullet = line.text.replace(/^[•●▪▸◦*]\s+/, '- ');
      blocks.push(normalizedBullet.startsWith('- ') ? normalizedBullet : `- ${normalizedBullet}`);
    } else {
      if (isLargeGap) {
        flushParagraph();
      }
      if (!currentParagraph) {
        currentParagraph = line.text;
      } else if (currentParagraph.endsWith('-') && /^[a-záéíóúüñ]/.test(line.text)) {
        // Unir palabra cortada con guion al final de línea
        currentParagraph = currentParagraph.slice(0, -1) + line.text;
      } else {
        currentParagraph += ' ' + line.text;
      }
    }
  }
  flushParagraph();

  return blocks.join('\n\n');
}

/**
 * Extrae el texto digital completo y renderiza páginas escaneadas si es necesario usando Mozilla PDF.js (`pdfjs-dist`).
 */
async function extractPdfWithPdfJs(
  file: File,
  onProgress?: (msg: string) => void
): Promise<{
  text: string;
  pageCount: number;
  title: string;
  hasRealText: boolean;
  scannedPageImages: string[];
}> {
  const rawTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
  const buffer = await file.arrayBuffer();

  // Intentar abrir documento con PDF.js
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages || 1;
  let detectedTitle = rawTitle;

  try {
    const meta = await pdfDoc.getMetadata();
    const infoTitle = (meta?.info as any)?.Title;
    if (
      typeof infoTitle === 'string' &&
      infoTitle.trim().length > 2 &&
      infoTitle.trim().length < 120 &&
      !infoTitle.toLowerCase().includes('untitled') &&
      !infoTitle.toLowerCase().includes('microsoft word')
    ) {
      detectedTitle = infoTitle.trim();
    }
  } catch {
    // Ignorar si no tiene metadatos
  }

  const pageSections: string[] = [];
  const scannedPageImages: string[] = [];
  let totalExtractedChars = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (numPages > 3 && (pageNum === 1 || pageNum % 5 === 0 || pageNum === numPages)) {
      onProgress?.(`Leyendo página ${pageNum} de ${numPages} de "${file.name}"...`);
    }

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageMarkdown = reconstructPageMarkdownFromPdfItems(textContent.items || []);
    const cleanedPageText = sanitizeExtractedText(pageMarkdown);

    if (cleanedPageText.length > 0) {
      totalExtractedChars += cleanedPageText.length;
      if (numPages > 1) {
        pageSections.push(`--- Página ${pageNum} ---\n\n${cleanedPageText}`);
      } else {
        pageSections.push(cleanedPageText);
      }
    } else if (scannedPageImages.length < 6 && typeof document !== 'undefined') {
      // Si la página no tiene texto digital (ej. PDF escaneado), renderizamos a canvas para OCR con IA
      try {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(1800, Math.floor(viewport.width));
        canvas.height = Math.min(2400, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport,
            canvas,
          } as any).promise;
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          if (jpegDataUrl && jpegDataUrl.length > 200) {
            scannedPageImages.push(jpegDataUrl);
          }
        }
      } catch (renderErr) {
        console.warn(`Aviso renderizando página escaneada ${pageNum}:`, renderErr);
      }
    }
  }

  const fullText = pageSections.join('\n\n').trim();
  const hasRealText = totalExtractedChars >= 25 && isAuthenticReadableText(fullText);

  const formattedText = hasRealText
    ? fullText.startsWith('# ')
      ? fullText
      : `# ${detectedTitle}\n\n${fullText}`
    : '';

  return {
    text: formattedText,
    pageCount: numPages,
    title: detectedTitle,
    hasRealText,
    scannedPageImages,
  };
}

/**
 * Fallback secundario de extracción PDF: descomprime streams FlateDecode con DecompressionStream nativo
 * y analiza operadores BT/ET si en algún entorno aislado fallara el worker de PDF.js.
 */
async function extractPdfFallbackStreamParser(
  file: File
): Promise<{ text: string; pageCount: number; title: string; hasRealText: boolean }> {
  const rawTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const latinText = new TextDecoder('latin1').decode(bytes);
    const pageCount = await detectPdfPageCountFromBuffer(file);

    const parseBtEtFromString = (source: string): string[] => {
      const blocks: string[] = [];
      const btRegex = /BT[\r\n\s]+([\s\S]*?)[\r\n\s]+ET/g;
      let match: RegExpExecArray | null;

      while ((match = btRegex.exec(source)) !== null) {
        const blockContent = match[1];
        let blockText = '';

        // Extraer strings literales (texto) Tj
        const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g;
        let tjMatch: RegExpExecArray | null;
        while ((tjMatch = tjRegex.exec(blockContent)) !== null) {
          const clean = tjMatch[1]
            .replace(/\\([()\\])/g, '$1')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '')
            .replace(/\\t/g, ' ')
            .trim();
          if (clean && !clean.startsWith('/') && !clean.includes('<<')) {
            blockText += (blockText ? ' ' : '') + clean;
          }
        }

        // Extraer arrays [(t1) -120 (t2)] TJ
        const arrayRegex = /\[((?:[^[\]]|\((?:[^()\\]|\\.)*\))*)\]\s*TJ/g;
        let arrMatch: RegExpExecArray | null;
        while ((arrMatch = arrayRegex.exec(blockContent)) !== null) {
          const inner = arrMatch[1];
          const innerStrings = inner.match(/\((?:[^()\\]|\\.)*\)/g);
          if (innerStrings) {
            const joined = innerStrings
              .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'))
              .filter((s) => s.length > 0 && !s.startsWith('/') && !s.includes('<<'))
              .join('');
            if (joined.trim()) {
              blockText += (blockText ? ' ' : '') + joined.trim();
            }
          }
        }

        const trimmed = sanitizeExtractedText(blockText);
        if (trimmed.length > 2 && isAuthenticReadableText(trimmed)) {
          blocks.push(trimmed);
        }
      }
      return blocks;
    };

    const textBlocks = parseBtEtFromString(latinText);
    const allJoinedText = textBlocks.join('\n\n');
    const hasRealText = isAuthenticReadableText(allJoinedText) && allJoinedText.length >= 30;

    if (!hasRealText) {
      return {
        text: '',
        pageCount: Math.max(1, pageCount),
        title: rawTitle,
        hasRealText: false,
      };
    }

    return {
      text: `# ${rawTitle}\n\n${allJoinedText}`,
      pageCount: Math.max(1, pageCount),
      title: rawTitle,
      hasRealText: true,
    };
  } catch {
    return {
      text: '',
      pageCount: 1,
      title: rawTitle,
      hasRealText: false,
    };
  }
}

/**
 * Extrae texto digital de un archivo PDF usando PDF.js como motor principal
 * y el analizador de flujos como respaldo.
 */
export async function extractPdfDigitalTextClient(
  file: File,
  onProgress?: (msg: string) => void
): Promise<{
  text: string;
  pageCount: number;
  title: string;
  hasRealText: boolean;
  scannedPageImages?: string[];
}> {
  try {
    const pdfJsResult = await extractPdfWithPdfJs(file, onProgress);
    if (pdfJsResult.hasRealText || pdfJsResult.pageCount > 0) {
      return pdfJsResult;
    }
  } catch (pdfJsErr) {
    console.warn('Fallback de PDF.js a analizador directo:', pdfJsErr);
  }

  const fallback = await extractPdfFallbackStreamParser(file);
  return {
    ...fallback,
    scannedPageImages: [],
  };
}

/**
 * Calcula el número de páginas de un archivo de texto o Markdown
 */
export function detectTextPageCount(text: string): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 1;

  const explicitPageMarkers = trimmed.match(
    /(?:---\s*Página\s+\d+|Página\s+\d+\s+de\s+\d+|##\s*Diapositiva\s+\d+|\f)/gi
  );
  if (explicitPageMarkers && explicitPageMarkers.length > 0) {
    return Math.max(1, explicitPageMarkers.length);
  }

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const lines = trimmed.split(/\r?\n/).length;

  const pagesByWords = Math.ceil(words / 350);
  const pagesByLines = Math.ceil(lines / 42);

  return Math.max(1, Math.max(pagesByWords, Math.min(pagesByLines, pagesByWords + 2)));
}

/**
 * Convierte un archivo a cadena Base64
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function getMimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/png';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInlineMarkdownToHtml(line: string): string {
  let html = escapeHtml(line);
  // Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Inline code `code`
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-indigo-700">$1</code>'
  );
  return html;
}

export function buildImageFigureHtml(img: DocumentImageAsset): string {
  const widthPct = img.widthPercent || 75;
  const captionText = escapeHtml(img.caption || img.name || 'Imagen del documento');
  return `<figure data-doc-image-id="${img.id}" class="my-4 p-3 bg-slate-50/90 border border-slate-200 rounded-2xl flex flex-col items-center gap-2 select-all" style="max-width: 100%;">
    <img src="${img.dataUrl}" alt="${captionText}" data-image-id="${img.id}" style="width: ${widthPct}%; max-width: 100%; height: auto;" class="rounded-xl shadow-xs border border-slate-200/80 object-contain" />
    <figcaption class="text-xs text-slate-500 italic text-center px-2">${captionText}</figcaption>
  </figure>`;
}

/**
 * Convierte texto Markdown + imágenes extraídas en un documento HTML rico editable
 * preparado para subrayar, comentar, editar texto y gestionar imágenes.
 */
export function convertMarkdownAndImagesToRichHtml(
  markdownText: string,
  images: DocumentImageAsset[] = []
): string {
  const cleanText = sanitizeExtractedText(markdownText || '');
  const lines = cleanText.split(/\r?\n/);
  const htmlBlocks: string[] = [];
  const usedImageIds = new Set<string>();

  // Mapear imágenes por número de página/diapositiva si lo tienen
  const imagesByPage = new Map<number, DocumentImageAsset[]>();
  images.forEach((img) => {
    if (img.pageOrSlideNumber) {
      const list = imagesByPage.get(img.pageOrSlideNumber) || [];
      list.push(img);
      imagesByPage.set(img.pageOrSlideNumber, list);
    }
  });

  let inList = false;
  let currentSlideOrPage = 0;

  const flushSlideImages = (pageNum: number) => {
    const pageImgs = imagesByPage.get(pageNum);
    if (pageImgs && pageImgs.length > 0) {
      pageImgs.forEach((img) => {
        if (!usedImageIds.has(img.id)) {
          usedImageIds.add(img.id);
          htmlBlocks.push(buildImageFigureHtml(img));
        }
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check inline image placeholder [[IMAGE:id]]
    const inlineImgMatch = trimmed.match(/^\[\[IMAGE:([^\]]+)\]\]$/);
    if (inlineImgMatch) {
      if (inList) {
        htmlBlocks.push('</ul>');
        inList = false;
      }
      const targetId = inlineImgMatch[1];
      const foundImg = images.find((im) => im.id === targetId);
      if (foundImg) {
        usedImageIds.add(foundImg.id);
        htmlBlocks.push(buildImageFigureHtml(foundImg));
      }
      continue;
    }

    if (!trimmed) {
      if (inList) {
        htmlBlocks.push('</ul>');
        inList = false;
      }
      continue;
    }

    // Check page / slide header
    const slideMatch = trimmed.match(/^(?:##\s*)?(?:---\s*)?(?:Diapositiva|Página)\s+(\d+)/i);
    if (slideMatch) {
      if (currentSlideOrPage > 0) {
        flushSlideImages(currentSlideOrPage);
      }
      currentSlideOrPage = parseInt(slideMatch[1], 10) || currentSlideOrPage + 1;
    }

    if (trimmed.startsWith('# ')) {
      if (inList) {
        htmlBlocks.push('</ul>');
        inList = false;
      }
      htmlBlocks.push(
        `<h1 class="text-xl font-bold text-slate-900 mt-5 mb-2 pb-1 border-b border-slate-200">${formatInlineMarkdownToHtml(trimmed.slice(2))}</h1>`
      );
    } else if (trimmed.startsWith('## ')) {
      if (inList) {
        htmlBlocks.push('</ul>');
        inList = false;
      }
      htmlBlocks.push(
        `<h2 class="text-lg font-bold text-slate-800 mt-4 mb-2">${formatInlineMarkdownToHtml(trimmed.slice(3))}</h2>`
      );
    } else if (trimmed.startsWith('### ')) {
      if (inList) {
        htmlBlocks.push('</ul>');
        inList = false;
      }
      htmlBlocks.push(
        `<h3 class="text-base font-semibold text-slate-800 mt-3 mb-1.5">${formatInlineMarkdownToHtml(trimmed.slice(4))}</h3>`
      );
    } else if (
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('• ')
    ) {
      if (!inList) {
        htmlBlocks.push('<ul class="list-disc pl-6 my-2 space-y-1">');
        inList = true;
      }
      htmlBlocks.push(
        `<li class="text-slate-800 leading-relaxed">${formatInlineMarkdownToHtml(trimmed.slice(2))}</li>`
      );
    } else if (trimmed.startsWith('> ')) {
      if (inList) {
        htmlBlocks.push('</ul>');
        inList = false;
      }
      htmlBlocks.push(
        `<blockquote class="border-l-4 border-blue-500 bg-blue-50/50 pl-4 py-2 my-3 italic text-slate-700 rounded-r-xl">${formatInlineMarkdownToHtml(trimmed.slice(2))}</blockquote>`
      );
    } else if (/^---\s*Página\s+\d+\s*---$/i.test(trimmed) || trimmed === '---') {
      if (inList) {
        htmlBlocks.push('</ul>');
        inList = false;
      }
      htmlBlocks.push(
        `<div class="my-4 py-1 px-3 bg-slate-100 border-y border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center rounded select-none">${escapeHtml(trimmed)}</div>`
      );
    } else {
      if (inList) {
        htmlBlocks.push('</ul>');
        inList = false;
      }
      htmlBlocks.push(
        `<p class="my-2 text-slate-800 leading-relaxed">${formatInlineMarkdownToHtml(trimmed)}</p>`
      );
    }
  }

  if (inList) {
    htmlBlocks.push('</ul>');
  }

  if (currentSlideOrPage > 0) {
    flushSlideImages(currentSlideOrPage);
  }

  // Añadir cualquier imagen extraída que aún no se haya incrustado
  const remainingImages = images.filter((img) => !usedImageIds.has(img.id));
  if (remainingImages.length > 0) {
    htmlBlocks.push(
      `<h3 class="text-sm font-bold uppercase tracking-wider text-indigo-700 mt-6 mb-2">Imágenes y Figuras Extraídas del Documento (${remainingImages.length})</h3>`
    );
    remainingImages.forEach((img) => {
      htmlBlocks.push(buildImageFigureHtml(img));
    });
  }

  return htmlBlocks.join('\n');
}

/**
 * Convierte el HTML enriquecido editable de vuelta a texto plano/Markdown limpio
 * para mantener sincronizados los contadores de palabras, exportación PDF y herramientas IA.
 */
export function convertRichHtmlToPlainText(html: string): string {
  if (!html) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const lines: string[] = [];

    const walk = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'figure' || tag === 'img' || tag === 'script' || tag === 'style') {
        return '';
      }

      let inner = '';
      el.childNodes.forEach((child) => {
        inner += walk(child);
      });

      if (tag === 'h1') {
        lines.push(`\n# ${inner.trim()}\n`);
        return '';
      }
      if (tag === 'h2') {
        lines.push(`\n## ${inner.trim()}\n`);
        return '';
      }
      if (tag === 'h3' || tag === 'h4') {
        lines.push(`\n### ${inner.trim()}\n`);
        return '';
      }
      if (tag === 'li') {
        lines.push(`- ${inner.trim()}`);
        return '';
      }
      if (tag === 'blockquote') {
        lines.push(`\n> ${inner.trim()}\n`);
        return '';
      }
      if (tag === 'tr') {
        const cells: string[] = [];
        el.querySelectorAll('th, td').forEach((cell) => {
          const cText = (cell.textContent || '').trim();
          if (cText) cells.push(cText);
        });
        if (cells.length > 0) {
          lines.push(`- ${cells.join(' | ')}`);
        }
        return '';
      }
      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
        if (inner.trim()) {
          lines.push(inner.trim());
        }
        return '';
      }
      if (tag === 'br') {
        return '\n';
      }
      return inner;
    };

    doc.body.childNodes.forEach((node) => {
      const res = walk(node);
      if (res && res.trim()) {
        lines.push(res.trim());
      }
    });

    return lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/**
 * Extrae contenido de documentos OpenDocument Text (.odt)
 */
async function extractOdtDocumentContent(
  zip: JSZip,
  file: File
): Promise<{
  markdownText: string;
  richHtml: string;
  extractedImages: DocumentImageAsset[];
  pageCount: number;
  detectedTitle: string;
}> {
  const extractedImages: DocumentImageAsset[] = [];
  const mediaFiles = Object.keys(zip.files).filter(
    (path) => path.startsWith('Pictures/') && !zip.files[path].dir
  );

  for (let i = 0; i < mediaFiles.length; i++) {
    const mediaPath = mediaFiles[i];
    const base64 = await zip.files[mediaPath].async('base64');
    const shortName = mediaPath.split('/').pop() || `odt_img_${i + 1}.png`;
    const mime = getMimeFromFilename(shortName);
    extractedImages.push({
      id: `odt-img-${Date.now()}-${i + 1}`,
      name: shortName,
      dataUrl: `data:${mime};base64,${base64}`,
      caption: `Figura ${i + 1} extraída de ${file.name}`,
      widthPercent: 75,
    });
  }

  let detectedTitle = file.name.replace(/\.[^/.]+$/, '');
  const markdownLines: string[] = [];
  const contentXmlFile = zip.file('content.xml');
  if (contentXmlFile) {
    const xmlStr = await contentXmlFile.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
    const textNodes = xmlDoc.getElementsByTagNameNS('*', 'h');
    if (textNodes.length > 0 && textNodes[0].textContent?.trim()) {
      detectedTitle = textNodes[0].textContent.trim();
    }

    const walkOdt = (node: Element) => {
      const local = node.localName;
      if (local === 'h') {
        const txt = (node.textContent || '').trim();
        if (txt) markdownLines.push(`## ${txt}`);
        return;
      }
      if (local === 'p') {
        const txt = (node.textContent || '').trim();
        if (txt) markdownLines.push(txt);
        return;
      }
      for (let i = 0; i < node.children.length; i++) {
        walkOdt(node.children[i]);
      }
    };
    walkOdt(xmlDoc.documentElement);
  }

  const markdownText =
    sanitizeExtractedText(markdownLines.join('\n\n')) ||
    `# ${detectedTitle}\n\nDocumento OpenDocument importado (${file.name}).`;
  const richHtml = convertMarkdownAndImagesToRichHtml(markdownText, extractedImages);
  const pageCount = detectTextPageCount(markdownText);

  return {
    markdownText,
    richHtml,
    extractedImages,
    pageCount,
    detectedTitle,
  };
}

/**
 * Extrae todo el texto estructurado, tablas, encabezados, notas al pie y TODAS las imágenes embebidas
 * de un documento Microsoft Word (.docx / .odt / .rtf) directamente en el navegador,
 * combinando Mammoth + JSZip XML para garantizar el 100% del texto e imágenes.
 */
async function extractWordDocxContent(file: File): Promise<{
  markdownText: string;
  richHtml: string;
  extractedImages: DocumentImageAsset[];
  pageCount: number;
  detectedTitle: string;
}> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  // Si es RTF (.rtf)
  if (lowerName.endsWith('.rtf') || file.type.includes('rtf')) {
    const rawStr = decodeTextBufferSmart(buffer);
    const cleaned = extractTextFromRtf(rawStr);
    const detectedTitle = file.name.replace(/\.[^/.]+$/, '');
    const markdownText = cleaned || `# ${detectedTitle}`;
    return {
      markdownText,
      richHtml: convertMarkdownAndImagesToRichHtml(markdownText, []),
      extractedImages: [],
      pageCount: detectTextPageCount(markdownText),
      detectedTitle,
    };
  }

  const zip = await JSZip.loadAsync(buffer);

  // Si es OpenDocument (.odt)
  if (lowerName.endsWith('.odt') || zip.file('content.xml')) {
    return extractOdtDocumentContent(zip, file);
  }

  const extractedImages: DocumentImageAsset[] = [];
  const rIdToImageAsset = new Map<string, DocumentImageAsset>();

  // 1. Leer relaciones en word/_rels/document.xml.rels
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const targetToRId = new Map<string, string>();
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    const parser = new DOMParser();
    const relsDoc = parser.parseFromString(relsXml, 'application/xml');
    const relNodes = relsDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < relNodes.length; i++) {
      const id = relNodes[i].getAttribute('Id') || '';
      const target = relNodes[i].getAttribute('Target') || '';
      if (id && target) {
        const normalizedTarget = target.replace(/^\/?word\//, '').replace(/^\.\.\//, '');
        targetToRId.set(normalizedTarget, id);
      }
    }
  }

  // 2. Extraer todos los archivos de imagen en word/media/*
  const mediaFiles = Object.keys(zip.files).filter(
    (path) => path.startsWith('word/media/') && !zip.files[path].dir
  );

  for (let i = 0; i < mediaFiles.length; i++) {
    const mediaPath = mediaFiles[i];
    const zipEntry = zip.files[mediaPath];
    const base64 = await zipEntry.async('base64');
    const shortName = mediaPath.split('/').pop() || `imagen_${i + 1}.png`;
    const mime = getMimeFromFilename(shortName);
    const relativePath = mediaPath.replace(/^word\//, '');
    const asset: DocumentImageAsset = {
      id: `docx-img-${Date.now()}-${i + 1}`,
      name: shortName,
      dataUrl: `data:${mime};base64,${base64}`,
      caption: `Figura ${i + 1} extraída de ${file.name}`,
      widthPercent: 75,
    };
    extractedImages.push(asset);

    const rId = targetToRId.get(relativePath);
    if (rId) {
      rIdToImageAsset.set(rId, asset);
    }
  }

  // 3. Intentar leer el número de páginas declarado en docProps/app.xml
  let declaredPages = 0;
  const appXmlFile = zip.file('docProps/app.xml');
  if (appXmlFile) {
    const appXml = await appXmlFile.async('string');
    const pageMatch = appXml.match(/<Pages>(\d+)<\/Pages>/i);
    if (pageMatch) {
      declaredPages = parseInt(pageMatch[1], 10) || 0;
    }
  }

  // 4. Parsear word/document.xml recursivamente (incluyendo contenedores <w:sdt>, cuadros de texto y tablas)
  const docXmlFile = zip.file('word/document.xml');
  const markdownLines: string[] = [];
  let detectedTitle = file.name.replace(/\.[^/.]+$/, '');

  if (docXmlFile) {
    const docXml = await docXmlFile.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXml, 'application/xml');
    const body = xmlDoc.getElementsByTagNameNS('*', 'body')[0] || xmlDoc.documentElement;

    const processParagraph = (pNode: Element) => {
      let styleVal = '';
      const pStyle = pNode.getElementsByTagNameNS('*', 'pStyle')[0];
      if (pStyle) {
        styleVal = (
          pStyle.getAttribute('w:val') ||
          pStyle.getAttribute('val') ||
          ''
        ).toLowerCase();
      }
      const isList = pNode.getElementsByTagNameNS('*', 'numPr').length > 0;

      // Extraer texto de los runs <w:r>, incluyendo saltos <w:br/> y tabulaciones <w:tab/>
      let paraText = '';
      const runs = pNode.getElementsByTagNameNS('*', 'r');
      for (let r = 0; r < runs.length; r++) {
        const run = runs[r];
        let runText = '';
        for (let c = 0; c < run.childNodes.length; c++) {
          const child = run.childNodes[c] as Element;
          if (!child.localName) continue;
          if (child.localName === 't' || child.localName === 'delText') {
            runText += child.textContent || '';
          } else if (child.localName === 'tab') {
            runText += ' ';
          } else if (child.localName === 'br' || child.localName === 'cr') {
            runText += '\n';
          }
        }
        if (runText) {
          const isBold = run.getElementsByTagNameNS('*', 'b').length > 0;
          if (
            isBold &&
            !styleVal.includes('heading') &&
            !styleVal.includes('titulo') &&
            runText.trim().length > 0
          ) {
            paraText += `**${runText}**`;
          } else {
            paraText += runText;
          }
        }
      }

      // Detectar imágenes embebidas en este párrafo (<a:blip r:embed="rId..."/>)
      const blips = pNode.getElementsByTagNameNS('*', 'blip');
      const inlineImagePlaceholders: string[] = [];
      for (let b = 0; b < blips.length; b++) {
        const embedId =
          blips[b].getAttribute('r:embed') ||
          blips[b].getAttributeNS(
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'embed'
          );
        if (embedId && rIdToImageAsset.has(embedId)) {
          const imgAsset = rIdToImageAsset.get(embedId)!;
          inlineImagePlaceholders.push(`[[IMAGE:${imgAsset.id}]]`);
        }
      }

      const cleanText = paraText.replace(/\*\*\*\*/g, '').trim();
      if (cleanText) {
        if (
          styleVal.includes('heading1') ||
          styleVal.includes('titulo1') ||
          styleVal === 'title'
        ) {
          if (detectedTitle === file.name.replace(/\.[^/.]+$/, '')) {
            detectedTitle = cleanText.replace(/\*\*/g, '');
          }
          markdownLines.push(`# ${cleanText.replace(/\*\*/g, '')}`);
        } else if (
          styleVal.includes('heading2') ||
          styleVal.includes('titulo2') ||
          styleVal === 'subtitle'
        ) {
          markdownLines.push(`## ${cleanText.replace(/\*\*/g, '')}`);
        } else if (styleVal.includes('heading') || styleVal.includes('titulo')) {
          markdownLines.push(`### ${cleanText.replace(/\*\*/g, '')}`);
        } else if (isList) {
          markdownLines.push(`- ${cleanText}`);
        } else {
          markdownLines.push(cleanText);
        }
      }

      inlineImagePlaceholders.forEach((ph) => markdownLines.push(ph));
    };

    const walkWordNodes = (container: Element) => {
      for (let i = 0; i < container.childNodes.length; i++) {
        const child = container.childNodes[i] as Element;
        if (!child.localName) continue;
        if (child.localName === 'p') {
          processParagraph(child);
        } else if (child.localName === 'tbl') {
          const rows = child.getElementsByTagNameNS('*', 'tr');
          for (let r = 0; r < rows.length; r++) {
            const cells = rows[r].getElementsByTagNameNS('*', 'tc');
            const rowCells: string[] = [];
            for (let c = 0; c < cells.length; c++) {
              const cellText = (cells[c].textContent || '').replace(/\s+/g, ' ').trim();
              if (cellText) rowCells.push(cellText);
            }
            if (rowCells.length > 0) {
              markdownLines.push(`- ${rowCells.join(' | ')}`);
            }
          }
        } else if (
          child.localName === 'sdt' ||
          child.localName === 'sdtContent' ||
          child.localName === 'body'
        ) {
          walkWordNodes(child);
        }
      }
    };

    walkWordNodes(body);
  }

  let xmlMarkdownText = sanitizeExtractedText(
    markdownLines.filter((l) => !l.startsWith('[[IMAGE:')).join('\n\n')
  );

  // 5. Ejecutar Mammoth en paralelo como validación para asegurarnos de no perder ni una palabra en estructuras complejas
  try {
    const mammothHtmlRes = await mammoth.convertToHtml({ arrayBuffer: buffer });
    if (mammothHtmlRes?.value) {
      const mammothStructured = sanitizeExtractedText(
        convertRichHtmlToPlainText(mammothHtmlRes.value)
      );
      if (mammothStructured.length > xmlMarkdownText.length * 1.15) {
        xmlMarkdownText = mammothStructured;
      }
    }
  } catch {
    // Usar el resultado XML si mammoth falla
  }

  const markdownText =
    xmlMarkdownText || `# ${detectedTitle}\n\nDocumento Word importado (${file.name}).`;

  const markdownWithImageTags =
    markdownLines.length > 0 && xmlMarkdownText.length >= markdownLines.join('\n').length * 0.7
      ? markdownLines.join('\n\n')
      : markdownText;

  const richHtml = convertMarkdownAndImagesToRichHtml(markdownWithImageTags, extractedImages);
  const pageCount = declaredPages > 0 ? declaredPages : detectTextPageCount(markdownText);

  return {
    markdownText,
    richHtml,
    extractedImages,
    pageCount,
    detectedTitle,
  };
}

/**
 * Extrae todas las diapositivas, títulos, textos, notas del orador y TODAS las imágenes embebidas
 * de una presentación PowerPoint (.pptx / .odp) directamente en el navegador.
 */
async function extractPowerPointPptxContent(file: File): Promise<{
  markdownText: string;
  richHtml: string;
  extractedImages: DocumentImageAsset[];
  pageCount: number;
  detectedTitle: string;
}> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // Si es OpenDocument Presentation (.odp)
  if (file.name.toLowerCase().endsWith('.odp') && zip.file('content.xml')) {
    return extractOdtDocumentContent(zip, file);
  }

  // 1. Encontrar todas las diapositivas ppt/slides/slide1.xml, slide2.xml... ordenadas numéricamente
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  // 2. Extraer todas las imágenes de ppt/media/*
  const mediaFiles = Object.keys(zip.files).filter(
    (path) => path.startsWith('ppt/media/') && !zip.files[path].dir
  );
  const mediaByRelativeName = new Map<string, DocumentImageAsset>();
  const extractedImages: DocumentImageAsset[] = [];

  for (let i = 0; i < mediaFiles.length; i++) {
    const mediaPath = mediaFiles[i];
    const base64 = await zip.files[mediaPath].async('base64');
    const shortName = mediaPath.split('/').pop() || `diapositiva_img_${i + 1}.png`;
    const mime = getMimeFromFilename(shortName);
    const asset: DocumentImageAsset = {
      id: `pptx-img-${Date.now()}-${i + 1}`,
      name: shortName,
      dataUrl: `data:${mime};base64,${base64}`,
      caption: `Imagen ${i + 1} de presentación (${file.name})`,
      widthPercent: 75,
    };
    extractedImages.push(asset);
    mediaByRelativeName.set(shortName, asset);
  }

  const markdownSections: string[] = [];
  let detectedTitle = file.name.replace(/\.[^/.]+$/, '');
  const parser = new DOMParser();

  for (let sIdx = 0; sIdx < slidePaths.length; sIdx++) {
    const slidePath = slidePaths[sIdx];
    const slideNumber = sIdx + 1;

    // Comprobar relaciones de la diapositiva para vincular imágenes a su diapositiva exacta
    const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const relsFile = zip.file(relsPath);
    if (relsFile) {
      const relsXml = await relsFile.async('string');
      const relsDoc = parser.parseFromString(relsXml, 'application/xml');
      const relNodes = relsDoc.getElementsByTagName('Relationship');
      for (let r = 0; r < relNodes.length; r++) {
        const target = relNodes[r].getAttribute('Target') || '';
        const mediaName = target.split('/').pop() || '';
        const imgAsset = mediaByRelativeName.get(mediaName);
        if (imgAsset && !imgAsset.pageOrSlideNumber) {
          imgAsset.pageOrSlideNumber = slideNumber;
          imgAsset.caption = `Diapositiva ${slideNumber} · ${imgAsset.name}`;
        }
      }
    }

    // Extraer todos los párrafos <a:p> de la diapositiva
    const slideXml = await zip.files[slidePath].async('string');
    const slideDoc = parser.parseFromString(slideXml, 'application/xml');
    const pNodes = slideDoc.getElementsByTagNameNS('*', 'p');
    const slideLines: string[] = [];

    for (let p = 0; p < pNodes.length; p++) {
      const tNodes = pNodes[p].getElementsByTagNameNS('*', 't');
      let lineText = '';
      for (let t = 0; t < tNodes.length; t++) {
        lineText += tNodes[t].textContent || '';
      }
      const cleaned = lineText.replace(/\s+/g, ' ').trim();
      if (cleaned) {
        slideLines.push(cleaned);
      }
    }

    // Extraer notas del orador si existen (ppt/notesSlides/notesSlideN.xml)
    const notesPath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
    const notesFile = zip.file(notesPath);
    const speakerNotes: string[] = [];
    if (notesFile) {
      try {
        const notesXml = await notesFile.async('string');
        const notesDoc = parser.parseFromString(notesXml, 'application/xml');
        const notePNodes = notesDoc.getElementsByTagNameNS('*', 'p');
        for (let np = 0; np < notePNodes.length; np++) {
          const tNodes = notePNodes[np].getElementsByTagNameNS('*', 't');
          let nText = '';
          for (let nt = 0; nt < tNodes.length; nt++) {
            nText += tNodes[nt].textContent || '';
          }
          const cleanNote = nText.replace(/\s+/g, ' ').trim();
          if (cleanNote && !/^\d+$/.test(cleanNote)) {
            speakerNotes.push(cleanNote);
          }
        }
      } catch {
        // Ignorar errores en notas de orador
      }
    }

    const slideTitle = slideLines[0] || `Diapositiva ${slideNumber}`;
    if (sIdx === 0 && slideLines[0]) {
      detectedTitle = slideLines[0];
    }

    const bodyBullets = slideLines
      .slice(1)
      .map((line) => `- ${line}`)
      .join('\n');

    const notesBlock =
      speakerNotes.length > 0
        ? `\n> Notas de diapositiva: ${speakerNotes.join(' ')}`
        : '';

    markdownSections.push(
      `## Diapositiva ${slideNumber}: ${slideTitle}\n${bodyBullets || '_Contenido visual_'}${notesBlock}`
    );
  }

  const markdownText =
    sanitizeExtractedText(markdownSections.join('\n\n')) ||
    `# ${detectedTitle}\n\nPresentación PowerPoint importada (${file.name}).`;

  const richHtml = convertMarkdownAndImagesToRichHtml(markdownText, extractedImages);
  const pageCount = Math.max(1, slidePaths.length);

  return {
    markdownText,
    richHtml,
    extractedImages,
    pageCount,
    detectedTitle,
  };
}

export interface ImportedDocumentProcessResult {
  attachedFile: AttachedTopicFile;
  detectedTitle?: string;
  cues?: string[];
  summary?: string;
  difficulty?: string;
}

/**
 * Procesa cualquier archivo importado (PDF, Word .docx/.doc/.odt/.rtf, PowerPoint .pptx/.ppt/.odp, imagen o texto/HTML/CSV),
 * extrae todo su texto, estructura e imágenes embebidas, y construye un documento editable enriquecido.
 */
export async function processImportedDocumentFile(
  file: File,
  topicTitle: string,
  subjectName: string,
  onProgress?: (statusMsg: string) => void
): Promise<ImportedDocumentProcessResult> {
  const fileType = detectImportedFileType(file);
  const nowIso = new Date().toISOString();

  // 1. Archivos de texto, Markdown, HTML, CSV o JSON (.txt, .md, .html, .csv, .json)
  if (fileType === 'text') {
    onProgress?.(`Extrayendo texto de "${file.name}"...`);
    const buffer = await file.arrayBuffer();
    let rawText = decodeTextBufferSmart(buffer);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
      rawText = extractStructuredTextFromHtml(rawText);
    } else if (lowerName.endsWith('.rtf')) {
      rawText = extractTextFromRtf(rawText);
    } else {
      rawText = sanitizeExtractedText(rawText);
    }

    const pageCount = detectTextPageCount(rawText);
    const richHtmlContent = convertMarkdownAndImagesToRichHtml(rawText, []);

    const attachedFile: AttachedTopicFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      fileType: 'text',
      pageCount,
      includeInOrganization: true,
      content: rawText,
      richHtmlContent,
      rawExtractedText: rawText,
      extractedImages: [],
      comments: [],
      size: file.size,
      date: nowIso,
      lastEditedAt: nowIso,
    };

    return {
      attachedFile,
      detectedTitle: file.name.replace(/\.[^/.]+$/, ''),
    };
  }

  // 2. Documentos Microsoft Word (.docx/.doc/.odt/.rtf) o PowerPoint (.pptx/.ppt/.odp)
  if (fileType === 'word' || fileType === 'powerpoint') {
    try {
      onProgress?.(
        fileType === 'word'
          ? `Extrayendo texto, estructura e imágenes de "${file.name}"...`
          : `Extrayendo diapositivas, texto e imágenes de "${file.name}"...`
      );
      const extracted =
        fileType === 'word'
          ? await extractWordDocxContent(file)
          : await extractPowerPointPptxContent(file);

      let cues: string[] = [];
      let summary = '';

      // Opcionalmente enriquecer con Cues y Resumen con IA sin alterar el texto e imágenes extraídas
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('/api/gemini/structure-topic-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            rawNotes: extracted.markdownText.slice(0, 12000),
            rawText: extracted.markdownText.slice(0, 12000),
            topicTitle: extracted.detectedTitle || topicTitle,
            subjectName,
          }),
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            cues = Array.isArray(json.data.cues) ? json.data.cues : [];
            summary = json.data.summary || '';
          }
        }
      } catch {
        // Ignorar si falla la llamada secundaria a IA; el documento e imágenes ya están extraídos
      }

      const attachedFile: AttachedTopicFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        fileType,
        pageCount: extracted.pageCount,
        includeInOrganization: true,
        content: extracted.markdownText,
        richHtmlContent: extracted.richHtml,
        rawExtractedText: extracted.markdownText,
        extractedImages: extracted.extractedImages,
        comments: [],
        cues,
        summary,
        size: file.size,
        date: nowIso,
        lastEditedAt: nowIso,
      };

      return {
        attachedFile,
        detectedTitle: extracted.detectedTitle,
        cues,
        summary,
      };
    } catch (zipErr) {
      console.warn('Fallback para archivo Office antiguo (.doc/.ppt):', zipErr);
      const buffer = await file.arrayBuffer();
      const rawDecoded = decodeTextBufferSmart(buffer);
      const cleanChunks =
        rawDecoded
          .match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,;:()¿?¡!\-\s]{12,}/g)
          ?.map((s) => sanitizeExtractedText(s))
          .filter((s) => s.length > 15 && isAuthenticReadableText(s)) || [];
      const fallbackText =
        cleanChunks.join('\n\n') ||
        `# ${file.name}\n\nDocumento importado listo para editar.`;
      const pageCount = detectTextPageCount(fallbackText);
      const richHtmlContent = convertMarkdownAndImagesToRichHtml(fallbackText, []);

      const attachedFile: AttachedTopicFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        fileType,
        pageCount,
        includeInOrganization: true,
        content: fallbackText,
        richHtmlContent,
        rawExtractedText: fallbackText,
        extractedImages: [],
        comments: [],
        size: file.size,
        date: nowIso,
        lastEditedAt: nowIso,
      };
      return {
        attachedFile,
        detectedTitle: file.name.replace(/\.[^/.]+$/, ''),
      };
    }
  }

  // 3. Archivos PDF e Imágenes de apuntes
  let clientPageCountHint = 1;
  let extractedImages: DocumentImageAsset[] = [];
  let clientExtractedText = '';
  let clientDetectedTitle = file.name.replace(/\.[^/.]+$/, '');
  let hasGenuineDigitalText = false;
  let scannedPageImages: string[] = [];

  if (fileType === 'pdf') {
    onProgress?.(`Extrayendo texto y páginas de "${file.name}"...`);
    const [rawPageCount, digitalResult, embeddedJpegs] = await Promise.all([
      detectPdfPageCountFromBuffer(file),
      extractPdfDigitalTextClient(file, onProgress),
      extractEmbeddedJpegsFromPdfBuffer(file, 6),
    ]);

    clientPageCountHint = Math.max(rawPageCount, digitalResult.pageCount || 1);
    clientExtractedText = digitalResult.text || '';
    hasGenuineDigitalText = Boolean(
      digitalResult.hasRealText && isAuthenticReadableText(digitalResult.text)
    );
    scannedPageImages = digitalResult.scannedPageImages || [];
    if (digitalResult.title) {
      clientDetectedTitle = digitalResult.title;
    }
    if (embeddedJpegs.length > 0) {
      extractedImages = embeddedJpegs;
    }
  } else if (fileType === 'image') {
    try {
      const imgDataUrl = await readFileAsBase64(file);
      extractedImages.push({
        id: `img-source-${Date.now()}`,
        name: file.name,
        dataUrl: imgDataUrl,
        caption: `Imagen original importada (${file.name})`,
        widthPercent: 75,
      });
    } catch {
      // Continuar con transcripción OCR
    }
  }

  let finalExtractedText = clientExtractedText;
  let detectedTitle = clientDetectedTitle;
  let cues: string[] = [];
  let summary = '';
  let finalPageCount = clientPageCountHint;

  if (hasGenuineDigitalText && clientExtractedText.trim().length > 25) {
    // El PDF tenía texto digital y PDF.js lo ha extraído de forma íntegra y exacta
    onProgress?.(`Preparando documento editable "${file.name}" (${finalPageCount} págs.)...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/gemini/structure-topic-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          rawNotes: clientExtractedText.slice(0, 10000),
          rawText: clientExtractedText.slice(0, 10000),
          topicTitle: clientDetectedTitle || topicTitle,
          subjectName,
        }),
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          cues = Array.isArray(json.data.cues) ? json.data.cues : [];
          summary = json.data.summary || '';
        }
      }
    } catch {
      // El texto completo ya está extraído por PDF.js, no bloqueamos
    }
  } else {
    // Para imágenes o PDFs escaneados sin capa de texto digital, usamos OCR multimodal
    onProgress?.(`Transcribiendo texto con OCR inteligente de "${file.name}"...`);
    try {
      // Si es un PDF escaneado y hemos renderizado sus páginas a imágenes JPEG ligeras, enviarlas evita límites de tamaño
      const useRenderedPages = fileType === 'pdf' && scannedPageImages.length > 0;
      const base64Data = useRenderedPages
        ? scannedPageImages[0]
        : await readFileAsBase64(file);
      const mimeType = useRenderedPages
        ? 'image/jpeg'
        : file.type || (fileType === 'pdf' ? 'application/pdf' : 'image/png');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const response = await fetch('/api/gemini/ocr-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          base64Data,
          mimeType,
          pageImages: useRenderedPages ? scannedPageImages : undefined,
          clientPageCountHint,
          instructions: `El archivo pertenece al tema "${topicTitle}" de la materia "${subjectName}". Extrae e incluye EXCLUSIVAMENTE TODO EL TEXTO ESCRITO que aparece en el documento (títulos, subtítulos, párrafos, listas, definiciones y fórmulas) de forma íntegra, clara y legible, sin resumir ni omitir datos, para que el usuario pueda leerlo y editarlo directamente en sus apuntes.`,
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          finalPageCount =
            fileType === 'pdf'
              ? Math.max(clientPageCountHint, Number(data.detectedPageCount) || 1)
              : Math.max(1, Number(data.detectedPageCount) || 1);
          finalExtractedText = sanitizeExtractedText(
            data.fullWrittenText || data.notes || clientExtractedText
          );
          detectedTitle = data.title || clientDetectedTitle;
          cues = Array.isArray(data.cues) ? data.cues : [];
          summary = data.summary || '';
        }
      }
    } catch (ocrErr) {
      console.warn('Aviso en transcripción OCR:', ocrErr);
    }
  }

  if (!finalExtractedText || !finalExtractedText.trim()) {
    finalExtractedText = `# ${file.name.replace(/\.[^/.]+$/, '')}\n\n(El archivo cuenta con ${finalPageCount} ${finalPageCount === 1 ? 'página' : 'páginas'}. No se detectó capa de texto digital seleccionable; puedes escribir o pegar tus apuntes aquí directamente.)`;
  }

  const richHtmlContent = convertMarkdownAndImagesToRichHtml(
    finalExtractedText,
    extractedImages
  );

  const attachedFile: AttachedTopicFile = {
    id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    fileType,
    pageCount: finalPageCount,
    includeInOrganization: true,
    content: finalExtractedText,
    richHtmlContent,
    rawExtractedText: finalExtractedText,
    extractedImages,
    comments: [],
    cues,
    summary,
    size: file.size,
    date: nowIso,
    lastEditedAt: nowIso,
  };

  return {
    attachedFile,
    detectedTitle,
    cues,
    summary,
  };
}

/**
 * Suma el total de páginas de todos los archivos adjuntos de un tema que están marcados
 * como "includeInOrganization !== false" para tenerlos en cuenta en la organización del estudio.
 */
export function calculateOrganizedPagesFromFiles(
  files?: AttachedTopicFile[]
): number {
  if (!files || files.length === 0) return 0;
  return files
    .filter((f) => f.includeInOrganization !== false)
    .reduce((sum, f) => sum + Math.max(1, Number(f.pageCount) || 1), 0);
}
