## Objetivo

Permitir que el **super_admin** cargue programas oficiales de la reunión Vida y Ministerio desde URLs de **wol.jw.org** (una o varias semanas a la vez), guardándolos como **plantillas globales**. Cada congregación verá esas plantillas auto-precargadas en su editor semanal con un aviso "Datos oficiales cargados — puedes modificarlos", manteniendo libertad para editar localmente.

---

## Arquitectura (modo híbrido)

```text
┌─────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│  super_admin    │──URLs─▶│ Edge Function        │──HTML▶│ wol.jw.org           │
│  (pega 1..N)    │       │ importar-vym-wol     │       └──────────────────────┘
└─────────────────┘       │ (parsea + guarda)    │
                          └──────────┬───────────┘
                                     │ upsert
                                     ▼
                          ┌──────────────────────┐
                          │ plantillas_vida_     │  ← global (sin congregacion_id)
                          │ ministerio_oficial   │
                          └──────────┬───────────┘
                                     │ lectura
                                     ▼
                          ┌──────────────────────┐
                          │ Editor VyM por       │  → si la semana abierta tiene
                          │ congregación         │    plantilla y el registro local
                          │                      │    está vacío → auto-precarga
                          └──────────────────────┘    con aviso amarillo
```

**Híbrido** = la plantilla oficial rellena cánticos, títulos, duraciones, citas, lectura de la semana, lecciones del libro. Los **participantes locales** (presidente, oradores, ayudantes, lector, conductor, oraciones) siguen siendo manuales por congregación.

---

## Cambios

### 1. Base de datos (migración)

Nueva tabla **`plantillas_vida_ministerio_oficial`** (global, sin `congregacion_id`):
- `id`, `fecha_semana` (UNIQUE, lunes de la semana)
- `idioma` (default `'es'`)
- `url_origen` (URL de wol.jw.org)
- `lectura_semana` (ej. "ISAÍAS 58, 59")
- `cantico_inicial`, `cantico_intermedio`, `cantico_final` (int)
- `tesoros` jsonb — `{ titulo, duracion }`
- `perlas` jsonb — `{ titulo, duracion }`
- `lectura_biblica` jsonb — `{ cita, duracion }`
- `maestros` jsonb[] — `[{ titulo, tipo, duracion }, …]`
- `vida_cristiana` jsonb[] — `[{ titulo, duracion }, …]`
- `estudio_biblico` jsonb — `{ duracion }` (solo duración; el título y lecciones los pone cada congregación)
- `importado_por`, `created_at`, `updated_at`
- **RLS**: SELECT abierto a cualquier usuario autenticado (todas las congregaciones lo leen); INSERT/UPDATE/DELETE solo `is_super_admin(auth.uid())`.

### 2. Edge function `importar-vym-wol`

- Solo accesible para super_admin (valida JWT + `is_super_admin`).
- Recibe `{ urls: string[] }` (1..N).
- Por cada URL:
  1. `fetch` del HTML de wol.jw.org (sin necesidad de Firecrawl — es HTML público y estable).
  2. Parseo con **regex/cheerio-ligero** (Deno tiene `deno-dom`) usando los selectores conocidos:
     - `.cantico` o `a[href*="/lp-s/r4/lp-s/202020"]` para los 3 cánticos.
     - `#section2` (Tesoros), `#section3` (Seamos mejores maestros), `#section4` (Nuestra vida cristiana).
     - `.du-color--gold` para los puntos numerados.
     - Encabezado con fechas para derivar `fecha_semana` (lunes).
     - `bandera` superior con la lectura de la semana.
  3. Construir el JSON de la plantilla.
  4. **Upsert** en `plantillas_vida_ministerio_oficial` por `fecha_semana`.
- Devuelve `{ ok: true, resultados: [{ url, fecha_semana, estado: "creada|actualizada|error", mensaje }] }`.
- Procesa las URLs **en paralelo con `Promise.allSettled`** (máx 5 a la vez) para que pegar 10 URLs no tarde 10× una.

Si el parseo falla en alguna sección, se guarda lo que sí se pudo extraer y se devuelve aviso en el resultado (no se aborta toda la importación).

### 3. UI super_admin — nueva página `/admin/plantillas-vym`

Solo visible para `is_super_admin`. En sidebar bajo "Administración → Plantillas oficiales VyM".

- **Textarea** "Pega una o varias URLs de wol.jw.org (una por línea)".
- Botón **"Importar"** → llama a la edge function.
- Tabla de resultado con: URL, fecha de la semana detectada, estado (✅ creada / 🔄 actualizada / ⚠️ parcial / ❌ error), mensaje.
- Tabla inferior con todas las plantillas ya guardadas (fecha, lectura semana, fecha de importación, acción borrar).
- Vista previa expandible por fila para revisar el contenido parseado antes de "publicar" (toggle `activa`).

### 4. Editor de congregación — precarga híbrida

En `src/pages/vida-y-ministerio/Editor.tsx`:

- Al abrir una semana, hacer un fetch adicional a `plantillas_vida_ministerio_oficial` por `fecha_semana`.
- Si **existe plantilla** Y el registro local de esa semana está **vacío** (sin datos guardados aún):
  - Precargar campos derivados: `cantico_*`, `tesoros.titulo/duracion`, `perlas` (en `tesoros.perlas_duracion` + título dentro de un campo nuevo o reusando estructura existente), `lectura_biblica.cita/duracion`, `maestros[]` (titulos+tipo+duración, participantes vacíos), `vida_cristiana[]`, `estudio_biblico.titulo` + lecciones, `lectura_semana`.
  - Mostrar **banner amarillo** sticky arriba del formulario: *"📥 Datos oficiales cargados desde JW.org — puedes modificarlos antes de guardar."* con botón "Descartar plantilla y empezar vacío".
- Si el registro local **ya existe** con datos, NO sobrescribir nada — solo mostrar un botón sutil "Recargar desde plantilla oficial" (con confirmación) por si el editor quiere refrescar.
- Si **no hay plantilla** para esa fecha, comportamiento actual sin cambios.

### 5. Hook nuevo `usePlantillaVidaMinisterioOficial(fechaSemana)`

- Query a `plantillas_vida_ministerio_oficial` filtrada por `fecha_semana`.
- Cacheada con react-query (no cambia entre congregaciones — `staleTime: Infinity` por semana).

### 6. Sin cambios necesarios en

- `programa_vida_ministerio` (tabla por congregación se mantiene igual).
- `useProgramaVidaMinisterio*` (los datos siguen guardándose por congregación).
- Componentes de impresión, repeaters, selectores de participantes.
- Lógica de cierre/bloqueo de programa.

---

## Detalles técnicos

- **Parser**: usar `deno-dom` (`npm:deno-dom`) — es el más estable en Deno Edge para HTML real. Se mantienen selectores en constantes al inicio del archivo para que sean fáciles de ajustar si JW.org cambia el HTML.
- **Detección de fecha semana**: parsear el encabezado `<h1>` o `<h2>` tipo "1-7 de junio de 2026" → calcular el lunes ISO.
- **Idempotencia**: el `UNIQUE(fecha_semana, idioma)` permite re-importar la misma URL sin duplicar.
- **Tolerancia a fallos**: el parser nunca lanza por una sección faltante; devuelve `null` y se marca como "parcial" para revisión manual del super_admin.
- **Sin Firecrawl** para esta fase: wol.jw.org responde HTML completo a `fetch` directo (sin JS necesario) y no tiene anti-bot agresivo para una sola petición. Si en el futuro empieza a bloquear, se cambia a Firecrawl en 5 líneas dentro de la edge function.

---

## Lo que NO hace este plan

- No importa participantes (siguen siendo locales).
- No descubre automáticamente URLs del mes — el super_admin pega las URLs que quiera (puede pegar 4 de golpe para todo un mes).
- No toca la tabla `programa_vida_ministerio` ni su esquema.
- No expone la edición de plantillas a admins de congregación (solo super_admin).
