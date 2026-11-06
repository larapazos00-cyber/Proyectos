# Extracción de Términos Clave de Notas Cornell y Generación de Flashcards en Cuestionarios

Permite analizar automáticamente el cuerpo íntegro de los apuntes Cornell de cualquier tema para extraer conceptos esenciales y transformarlos en flashcards estructuradas (concepto, definición rigurosa y caso práctico de aplicación) con acceso directo desde el módulo de Cuestionarios.

## Decisiones Críticas y Preferencias Confirmadas

> [!IMPORTANT]
> Decisiones confirmadas durante la fase interactiva de clarificación con el usuario:
> - **Alcance de Extracción**: Se analizará **todo el cuerpo de notas y apuntes** (notas principales, columna de ideas clave/cues y resumen final de Cornell) para garantizar cobertura exhaustiva de la terminología.
> - **Estructura Pedagógica de las Flashcards**: Formato de **Concepto con definición precisa y caso de aplicación** (anverso con término clave, reverso con definición conceptual estricta acompañada de un ejemplo clínico/práctico, pista mnemotécnica y etiqueta conceptual).
> - **Punto de Acceso Principal**: **Botón destacado en la cabecera del módulo de Cuestionarios** que abre un modal guiado de extracción y generación, además de permitir disparar la extracción al seleccionar notas de Cornell en la vista de configuración.

---

## 1. Visión General y Concepto Central

- **Propósito**: Cerrar la brecha entre la toma pasiva de notas Cornell y el repaso activo (Active Recall). El estudiante ya no necesita transcribir manualmente cada término; la IA analiza sus apuntes de clase, identifica términos técnicos y construye tarjetas listas para memorización espaciada.
- **Público Objetivo**: Estudiantes universitarios y de oposiciones que gestionan temarios densos y necesitan afianzar vocabulario técnico, mecanismos y definiciones con rapidez.
- **Valor Agregado**: Ahorro sustancial de tiempo en la preparación de material de estudio y estandarización de flashcards de alto valor formativo que combinan teoría con aplicación real.

---

## 2. Experiencia de Usuario y Diseño Visual

### A. Flujo de Usuario Paso a Paso

1. **Acceso desde Cabecera**:
   - En la cabecera de la pestaña *Cuestionarios* (`PracticeQuizModule`), junto a *Generar Nuevo Cuestionario*, se dispone el botón destacado:
     `✨ Extraer Flashcards desde Apuntes Cornell`.
2. **Selección de Fuente (Materia y Apuntes Cornell)**:
   - Se abre un modal de diseño educativo limpio donde el usuario escoge la materia y la nota Cornell específica (o selecciona "Todas las notas del tema").
   - El sistema muestra una vista previa rápida del contenido que se procesará (notas, cues y resumen).
3. **Paso 1: Extracción Automática de Términos Clave**:
   - Al pulsar *Analizar y Extraer Términos*, la IA (Gemini 3.8 Flash) escanea los apuntes y devuelve una lista categorizada de términos clave detectados.
   - El estudiante puede desmarcar términos no deseados o añadir un término adicional antes de crear las tarjetas.
4. **Paso 2: Generación de Flashcards Estructuradas**:
   - Con los términos seleccionados, se generan flashcards que incorporan:
     - **Término / Concepto**: Nombre exacto del concepto en el anverso.
     - **Definición Precisa**: Explicación teórica rigurosa de 2-3 líneas.
     - **Caso de Aplicación Práctica**: Situación real, clínica o práctica donde se aplica el concepto.
     - **Pista / Mnemotecnia**: Regla nemotécnica o dato clave para activar el recuerdo.
5. **Revisión y Guardado**:
   - Vista interactiva previa de las tarjetas con opción de voltear para comprobar anverso y reverso.
   - Botón *Guardar en Mazo de la Asignatura* que sincroniza las nuevas tarjetas directamente en `subject.flashcards` y las deja disponibles para estudio inmediato con repetición espaciada.

### B. Identidad Visual y Guía Estilística

- **Paleta de Color Educativa**:
  - Acentos en azul cobalto (`#2563EB`) y esmeralda (`#059669`) para denotar rigor académico y progreso cognitivo.
  - Fondo del modal en blanco puro y gris perla (`bg-slate-50`) con bordes sutiles sin saturación innecesaria.
- **Tipografía y Legibilidad**:
  - Jerarquía clara con títulos en negrita sans-serif, etiquetas de metadatos limpias (`Tema 1 · 14 términos · Cornell`) separadas por puntos medianos sin pastillas estáticas.
- **Micro-interacciones y Animaciones**:
  - Efecto de volteo de tarjeta suave en 3D para la previsualización.
  - Indicadores de carga con mensaje explicativo durante la extracción semántica.
  - Notificación de éxito y animación sutil al consolidar las tarjetas en la materia.

---

## 3. Decisiones de Producto y Compensaciones (Trade-offs)

- **Extracción en dos pasos vs. Generación ciega inmediata**:
  - *Decisión*: Proceso interactivo con extracción previa de términos y confirmación de generación.
  - *Justificación*: Permite al alumno tener control total sobre qué vocabulario desea incorporar a su mazo, evitando tarjetas redundantes o triviales.
- **Estructura unificada de tarjeta con caso de aplicación**:
  - *Decisión*: Enriquecer el reverso con una sección explícita de *Aplicación Práctica / Caso*.
  - *Justificación*: El Active Recall contextualizado mejora la retención a largo plazo y la transferencia de conocimiento en exámenes universitarios y simulacros.
- **Persistencia Directa**:
  - *Decisión*: Guardar las flashcards generadas directamente en la colección `subject.flashcards` de la materia activa.
  - *Justificación*: Quedan inmediatamente integradas con el algoritmo de repetición espaciada existente (`FlashcardDeck` y calendario).

---

## 4. Arquitectura Técnica y Estrategia de Datos

### Diagrama del Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Módulo de Cuestionarios                         │
│                      (PracticeQuizModule.tsx)                          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               Click "Extraer Flashcards desde Apuntes"
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CornellFlashcardExtractorModal.tsx                   │
│                                                                        │
│  ┌───────────────────────┐          ┌───────────────────────────────┐  │
│  │ 1. Selector de Apuntes│ ───────► │ 2. Extracción de Términos IA  │  │
│  │ (Notas, Cues, Resumen)│          │ (Gemini 3.8 Flash Backend)    │  │
│  └───────────────────────┘          └───────────────┬───────────────┘  │
│                                                     │                  │
│  ┌───────────────────────┐                          ▼                  │
│  │ 4. Guardado en Mazo   │ ◄─────── ┌───────────────────────────────┐  │
│  │ (subject.flashcards)  │          │ 3. Generación y Previsual     │  │
│  │ y Sincronización      │          │ (Concepto + Def + Aplicación) │  │
│  └───────────────────────┘          └───────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ POST /api/gemini/extract-cornell-flashcards
┌────────────────────────────────────────────────────────────────────────┐
│                             Servidor Express                           │
│     Endpoint con `@google/genai` (modelo: 'gemini-3.8-flash')          │
│       - Extracción semántica de términos del cuerpo Cornell            │
│       - Formulación de Definición + Caso de Aplicación + Mnemotecnia   │
│       - Esquema estructurado Type.ARRAY de Flashcards                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Endpoints y Esquema de Datos

- **Servidor (`server.ts`)**:
  - Endpoint: `POST /api/gemini/extract-cornell-flashcards`
  - Entrada: `{ topicTitle, notesContent, cues, summary, targetCount }`
  - Salida: Lista estructurada de flashcards con:
    - `question`: Nombre del término o concepto clave.
    - `answer`: Definición rigurosa y caso práctico/clínico de aplicación.
    - `hint`: Pista o regla mnemotécnica.
    - `conceptTag`: Etiqueta temática o subárea.
- **Componentes**:
  - `CornellFlashcardExtractorModal.tsx`: Componente modular para selección de apuntes, revisión de términos y previsualización de flashcards.
  - Integración en `PracticeQuizModule.tsx` con botón destacado en cabecera y callback `onSaveFlashcards`.
  - Conexión en `App.tsx` para sincronizar las nuevas tarjetas con el estado global de materias y persistencia.

---

## 5. Verificación y Criterios de Aceptación

1. **Extracción Completa**: La IA lee tanto el texto principal como las preguntas guía (cues) y el resumen de la nota Cornell seleccionada.
2. **Estructura Requerida**: Cada flashcard generada contiene definición rigurosa y un caso de aplicación práctico.
3. **Flujo Fluido**: Acceso directo y visible desde la cabecera de la sección de Cuestionarios.
4. **Persistencia y Validación**: Las tarjetas guardadas se reflejan inmediatamente en el mazo de flashcards de la asignatura y superan las pruebas de compilación y linter sin errores.
