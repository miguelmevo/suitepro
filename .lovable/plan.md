## Objetivo
Permitir asignar un territorio a **múltiples grupos de predicación** (relación N-a-N), incluyendo el caso "todos los grupos".

## Cambios

### 1. Base de datos (migración)
- Crear tabla puente `territorios_grupos_predicacion`:
  - `id`, `territorio_id` (FK lógica), `grupo_predicacion_id`, `congregacion_id`, `created_at`
  - Constraint único `(territorio_id, grupo_predicacion_id)`
  - Índices en `territorio_id` y `grupo_predicacion_id`
- RLS con los mismos patrones existentes:
  - SELECT: `user_has_access_to_congregacion(congregacion_id)`
  - INSERT/UPDATE/DELETE: `is_admin_or_editor_in_congregacion(congregacion_id)`
- Backfill: copiar registros actuales de `territorios.grupo_predicacion_id` (cuando no es NULL) a la nueva tabla.
- **Mantener** la columna `territorios.grupo_predicacion_id` por ahora (compatibilidad), pero el código nueva la ignora.

### 2. Tipos y hooks
- `Territorio` (en `types/programa-predicacion.ts`): añadir `grupos_predicacion_ids: string[]`.
- `useCatalogos`: en la query de `territorios`, después de traerlos, hacer un segundo fetch a `territorios_grupos_predicacion` filtrado por congregación y mapear los IDs a cada territorio.

### 3. UI — Formulario de territorio (`TerritorioForm.tsx`)
- Reemplazar el `<Select>` "Grupo Asignado" por una grilla de checkboxes con todos los grupos (G1, G2, …), estilo similar al selector de manzanas.
- Cambiar `grupo_predicacion_id: string` → `grupos_predicacion_ids: string[]` en el estado del formulario.
- Texto de ayuda: "Si no seleccionas ninguno, el territorio estará disponible para **todos** los grupos."

### 4. Página de territorios (`Territorios.tsx`)
- `handleSubmit`: tras crear/actualizar el territorio, sincronizar la tabla puente (insertar nuevos, eliminar los removidos), análogo al `syncManzanas` ya existente.
- Columna **Grupo** de la tabla: mostrar badges con todos los grupos asignados (`G1 G3 G5`), o badge `Todos` si la lista está vacía.
- Ajustar `useTableSort` para ordenar por la cantidad/primer grupo asignado.

### 5. Lógica de filtrado en programa
- `AsignacionGruposForm.tsx` y `AsignacionGrupoIndividualForm.tsx`:
  - Cambiar `t.grupo_predicacion_id === grupoId` por `t.grupos_predicacion_ids?.includes(grupoId)`.
  - Cambiar la unión por: `t.grupos_predicacion_ids?.some(id => grupoIds.includes(id))`.
  - Tratar `grupos_predicacion_ids` vacío como **visible para todos los grupos** (territorio común).

### 6. Sin cambios necesarios en
- RLS de `territorios` (no cambia).
- `participantes.grupo_predicacion_id` (sigue siendo 1-a-1).
- PDFs / impresión (usan los territorios ya filtrados por la lógica anterior).

## Notas técnicas
- La columna vieja `territorios.grupo_predicacion_id` queda como legacy; se podrá eliminar en una migración futura tras validar que nada la usa.
- La tabla puente respeta el patrón multi-tenant (`congregacion_id` en cada fila + RLS).
