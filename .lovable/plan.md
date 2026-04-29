## PDF Imprimible — Vida y Ministerio (1 sala)

### Layout general
- Página tamaño carta, **2 semanas por página** (3 páginas si el mes tiene 5 semanas).
- Header global por página: nombre de congregación en MAYÚSCULAS (izq) + título "Programa para la reunión de entre semana" (der), con línea inferior.

### Por cada semana
1. **Encabezado de semana**: `12 DE MAYO | ISAÍAS 60, 61` (izq) y a la derecha dos filas: `Presidente: Nombre` y `Oración: Nombre`.
2. **Filas iniciales** (sin sección de color):
   - `19:30 • Canción XX (5 mins.)`
   - `19:35 • Palabras de introducción (1 min.)`
3. **TESOROS DE LA BIBLIA** — banner color teal/turquesa (según imagen 2), ícono diamante.
   - Primera fila muestra "Auditorio principal" en la columna derecha (label).
   - 1. Discurso tesoros (10 mins.) → participante
   - 2. Busquemos perlas escondidas (10 mins.) → participante
   - 3. Lectura de la Biblia (4 mins.) → participante
4. **SEAMOS MEJORES MAESTROS** — banner color ámbar/dorado (imagen 3), ícono trigo.
   - "Auditorio principal" label en columna derecha en la primera fila.
   - Cada parte: `Estudiante / Ayudante` o solo `Discursante` (sin `/`).
5. **NUESTRA VIDA CRISTIANA** — banner color granate/rojo oscuro (imagen 4), ícono oveja.
   - `20:15 • Canción intermedia (5 mins.)`
   - Partes Vida Cristiana (1 a 3) con asignados.
   - `20:36 10. Estudio bíblico de la congregación (30 mins.)` → `Conductor / Lector`
   - `21:07 • Palabras de conclusión (3 min.)`
   - `21:10 • Canción XX (5 mins.)` y `Oración: Nombre`

### Colores fijos (no usan tema de congregación)
- Tesoros: teal `#2A8B8C` aprox (según imagen 2)
- Seamos: ámbar `#B8860B` aprox (imagen 3)
- Vida Cristiana: granate `#A02828` aprox (imagen 4)

### Tipografía y estructura
- Tabla de 3 columnas por sección: hora | título (con número y duración) | participante(s).
- Banner de sección ocupa todo el ancho con texto blanco en mayúsculas.
- Filas con padding compacto para que entren 2 semanas por página.
- Horarios calculados automáticamente desde la hora de inicio de la reunión (configuración del sistema) y las duraciones de cada parte.

### Implementación técnica
- Nuevo componente `src/components/vida-ministerio/ImpresionVidaMinisterio.tsx` (similar a `ImpresionReunionPublica.tsx`).
- Hook `useReactToPrint` con `documentTitle` por mes.
- Botón impresora (azul, mismo estilo que Predicación) en `src/pages/vida-y-ministerio/Lista.tsx`.
- Botón "Publicar PDF" reusando `PublicarProgramaModal` con `tipoProgramaId="vida_ministerio"` (siguiendo el mismo flujo que reunión pública).
- Cálculo de horarios: función helper que, dado `hora_inicio` (string `HH:mm`) y arreglo de duraciones, devuelve etiquetas de hora por parte.
- Discursante sin ayudante → renderiza solo el nombre (sin `/`).
- Agrupar semanas en chunks de 2 con `page-break-after: always` cada 2.

### Confirmaciones aplicadas
- Colores fijos por sección (no varían por congregación).
- "Auditorio principal" se mantiene visible aunque sea 1 sola sala.
- 2 semanas por página, paginación automática.
- Mismo flujo de publicación que Reunión Pública.
- Discursante sin `/` cuando es discurso sin ayudante.
