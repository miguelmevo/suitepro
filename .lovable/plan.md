
## Objetivo

Hacer que `/?c=XXXXX` (sin sesión) muestre las mismas tarjetas semanales que `/Inicio`, en modo lectura, con header simplificado y reglas de visibilidad nuevas.

## Vista pública (sin sesión)

**Header (nuevo, sin AppLayout):**
- Nombre congregación + color del tema aplicado.
- Botón "Iniciar sesión" → `/auth?c=XXXXX`.
- Sin sidebar, sin BottomNav, sin share button.

**Tarjetas visibles públicamente:**
1. `ProgramaSemanal` (Predicación) — incluye links de direcciones (`url_maps` puntos de encuentro) y tarjetas de territorios clicables (las que abren `/territorio/:id`). Este es el ÚNICO acceso a territorios desde la vista pública.
2. `VidaMinisterioSemanal`.
3. `ReunionPublicaSemanal`.
4. Mensajes adicionales (banners ⭐) — ya están incluidos dentro de las tarjetas.

**Tarjetas ocultas públicamente:**
- `MisAsignaciones` (requiere usuario).
- `AsignacionesServicioSemanal` (ver regla nueva abajo).
- No hay link/sección "Territorios" general.

## Regla nueva (también afecta vista con sesión)

`AsignacionesServicioSemanal` solo se muestra si:
- Hay sesión activa, **Y**
- El participante vinculado al usuario tiene `genero = 'masculino'` (o el campo equivalente), **Y**
- `profiles.aprobado = true`.

Aplica en `Inicio.tsx` (envolver con condición) y se omite en `InicioPublico`.

## Backend: RPCs públicas necesarias

Todas las tablas relevantes tienen RLS que exige `user_has_access_to_congregacion`. Crear RPCs `SECURITY DEFINER` que reciben `_congregacion_id` y devuelven solo datos de lectura semanal. Una migración con:

- `get_programa_predicacion_semana_publico(_congregacion_id, _desde, _hasta)` — devuelve filas de `programa_predicacion` con joins (horario, punto_encuentro, capitan nombre, territorios con `numero`/`nombre`/`url_maps`/`imagen_url`).
- `get_programa_vida_ministerio_semana_publico(_congregacion_id, _desde, _hasta)` — devuelve `programa_vida_ministerio` resuelto con nombres completos de participantes en cada slot (presidente, oración inicial/final, tesoros, perlas, lectura, maestros[], vida_cristiana[], estudio bíblico, encargados de sala). Incluye `lectura_semana`, cánticos.
- `get_programa_reunion_publica_semana_publico(_congregacion_id, _desde, _hasta)` — devuelve reunión pública con nombres (presidente, orador local/visitante, conductor/lector atalaya).
- `get_mensajes_adicionales_publico(_congregacion_id, _desde, _hasta)` — devuelve mensajes activos (mensaje, color, fecha, módulo).
- `get_dias_especiales_publico(_congregacion_id, _desde, _hasta)` — para bloqueos visuales de slots.
- `get_configuracion_publica(_congregacion_id, _programa_tipo)` — solo claves necesarias para la vista (nombre congregación, etiquetas, etc.). Filtrar a lista blanca.
- `get_puntos_encuentro_publico(_congregacion_id)` — id, nombre, direccion, url_maps.
- `get_horarios_salida_publico(_congregacion_id)` — id, hora, nombre, orden, franja.
- `get_grupos_predicacion_publico(_congregacion_id)` — numero, superintendente/auxiliar nombre.

Todas: `STABLE SECURITY DEFINER`, sin requerir auth.

## Frontend

### `src/pages/InicioPublico.tsx` (rehacer completamente)
- Header propio con nombre + botón "Iniciar sesión".
- Aplica tema de color.
- Renderiza `<ProgramaSemanal publico />`, `<VidaMinisterioSemanal publico />`, `<ReunionPublicaSemanal publico />`.
- Layout: 1 columna (sin sidebar MisAsignaciones).

### Tarjetas: añadir prop `publico?: boolean` + `congregacionId?: string`
En cada componente:
- `ProgramaSemanal`, `VidaMinisterioSemanal`, `ReunionPublicaSemanal`: aceptar `publico` y `congregacionId`. Cuando `publico=true`, usar las RPCs públicas (vía wrappers en hooks o queries inline) en lugar de los hooks normales que dependen de RLS auth.
- Ocultar botones de edición/acciones admin cuando `publico=true`.

### `src/pages/Inicio.tsx`
- Renderizar `AsignacionesServicioSemanal` solo si: `profile.aprobado && participante?.genero === 'masculino'`. Leer del `AuthProvider` (ya expone user/participante) o consulta corta.

### Hooks/queries
Crear hooks paralelos públicos o flag `publico` en los hooks existentes:
- `useProgramaPredicacion({ publico, congregacionId })`
- `useProgramaVidaMinisterio({ publico, congregacionId })`
- `useReunionPublica({ publico, congregacionId })`
- `useMensajesAdicionales({ publico, congregacionId })`
- `useConfiguracionSistema({ publico, congregacionId })`
- `usePuntosEncuentro`, `useHorariosSalida`, `useGruposPredicacion`, `useDiasEspeciales` con misma estrategia.

## Detalles técnicos

- Las RPCs devuelven JSON estructurado idéntico al que esperan las tarjetas hoy, para minimizar cambios de render.
- Para `participantes` (nombres en VyM/Reunión Pública): la RPC resuelve los nombres en el server (joins) y devuelve cadenas, evitando exponer la tabla completa.
- No exponer `telefono`, `email`, ni datos sensibles.
- Caching: React Query con `queryKey` incluyendo `publico` + `congregacionId` para no chocar con la cache autenticada.

## Orden de ejecución

1. Migración SQL con todas las RPCs públicas.
2. Refactor de hooks con flag `publico`.
3. Refactor de cada tarjeta (`ProgramaSemanal`, `VidaMinisterioSemanal`, `ReunionPublicaSemanal`) para aceptar `publico` y ocultar acciones de edición.
4. Reescribir `InicioPublico.tsx` con header simple + 3 tarjetas.
5. Ajustar `Inicio.tsx` para condicional de `AsignacionesServicioSemanal` (varón + aprobado).
6. QA visual en preview con un código real (`?c=...`).

## Consideraciones

- Es una entrega grande (1 migración con ~9 RPCs + refactor de 3 tarjetas + 6-7 hooks + nuevo Inicio público). Se hará en varios pasos.
- Si prefieres, podemos arrancar SOLO con la migración + Predicación y dejar VyM y Reunión Pública para la siguiente iteración, así validamos el patrón antes de duplicarlo.

¿Procedo de corrido con todo, o vamos por partes (Predicación primero)?
