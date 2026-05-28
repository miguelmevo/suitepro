## Objetivo
Mejorar el historial de Vida y Ministerio con una tabla por participante × categoría (última fecha), usar esos datos para que la IA reparta más justo, y mostrar en el selector manual la última intervención del participante.

## 1. Nueva tabla histórica (en `HistorialVidaMinisterio.tsx`)

Reemplazo de la card "Estadísticas de participación" actual por una tabla con estas columnas:

| Participante | PRESIDENTE | ORACIÓN | TESOROS | PERLAS | LECTURA BIBLIA | MEJORES MAESTROS | VIDA CRISTIANA | ESTUDIO BC | LECTOR EBC |

- Cada celda muestra la **última fecha** (formato `d MMM yyyy`) en que ese participante tuvo esa categoría dentro del rango `desde`–`hasta`. Si nunca, celda vacía con guion `—`.
- **MEJORES MAESTROS**: cualquier rol (titular o ayudante, incluyendo salas auxiliares B/C). Junto a la fecha se añade un badge pequeño:
  - **T** si fue titular (sala principal, B o C)
  - **A** si fue ayudante (sala principal, B o C)
  - Si en distintas semanas tuvo ambos, se muestra la marca del rol de la **última** fecha.
- **VIDA CRISTIANA**: cualquier parte del bloque (sin distinguir título).
- **ESTUDIO BC**: conductor o lector EBC del bloque "Estudio bíblico de la congregación".
- **LECTOR EBC**: solo cuando fue lector (subconjunto de Estudio BC, lo dejo separado porque lo pediste explícitamente).
- **ORACIÓN**: inicial o final.
- **LECTURA BIBLIA**: bloque `lectura_biblica`.

Cálculo: iterar `programasFiltrados` y, por cada participante, guardar `MAX(fecha_semana)` por categoría. Se conserva la sección "Programas en el rango" tal cual.

Orden: alfabético por apellido (con sort por columna opcional, pero no en este cambio para mantenerlo simple).

## 2. Rotación justa en la IA (`asignar-vida-ministerio-ia` edge function)

- En `Editor.tsx` (o donde se construyen los slots para el modal IA), enriquecer cada slot con su `categoria` ("presidente" | "oracion" | "tesoros" | "perlas" | "lectura_biblica" | "maestros" | "vida_cristiana" | "estudio_biblico" | "lector_ebc").
- En la edge function:
  - Calcular `ultimas_por_categoria` por participante a partir del historial existente (`programa_vida_ministerio` ya está cargado vía `historial_participacion_vym`; si esa tabla está vacía hago fallback leyendo `programa_vida_ministerio`).
  - Pasarla al prompt y reforzar la regla: "Para cada slot, prioriza el candidato cuya `ultima_en_categoria` sea más antigua (o `null`). Solo desempata por `ultima_participacion` global cuando hay empate."

## 3. Selector manual con tooltip de última intervención (`ParticipanteSelector.tsx`)

- Calcular en el componente (con `useQuery` o derivado de `programa_vida_ministerio` del año) un mapa `participante_id → { global: {fecha, categoria}, porCategoria: {presidente, oracion, ...} }`.
- En cada `SelectItem` del dropdown, junto al nombre añadir un texto secundario en `text-xs text-muted-foreground`:
  ```
  Pérez, Juan   últ: 12 mar (Vida Cristiana)
  ```
- Envolver cada item en un `HoverCard` (o `Tooltip`) que al pasar el ratón muestre el desglose por categoría:
  ```
  Presidente: 5 feb
  Oración: 22 ene
  Tesoros: —
  Perlas: 14 abr
  Lectura Biblia: —
  Mejores Maestros: 7 abr (T)
  Vida Cristiana: 12 may
  Estudio BC: —
  Lector EBC: —
  ```
- Para no degradar performance, el mapa se calcula una vez por consulta y se memoiza.

## Detalles técnicos
- No hace falta migración: se reutilizan `programa_vida_ministerio` (y opcionalmente `historial_participacion_vym`).
- Sí toco la edge function `asignar-vida-ministerio-ia` (se re-deploy automáticamente).
- Cambios concentrados en:
  - `src/components/vida-ministerio/HistorialVidaMinisterio.tsx`
  - `src/components/vida-ministerio/ParticipanteSelector.tsx`
  - `src/pages/vida-y-ministerio/Editor.tsx` (añadir `categoria` a slots IA)
  - `supabase/functions/asignar-vida-ministerio-ia/index.ts`
