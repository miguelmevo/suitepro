## Objetivo

Congelar los programas pasada una fecha de corte mensual configurable, y conservar los nombres de los participantes tal como estaban en el momento del cierre, de modo que cambios futuros en la ficha del participante no alteren programas ya bloqueados.

## 1. Ajuste configurable: día de cierre

En **Ajustes del Sistema → General** agregar un nuevo campo:

- **Día de cierre mensual de programas** (numérico, 1–28, default **20**).
- Aplica a todos los módulos: Predicación, Vida y Ministerio, Reunión Pública, Asignaciones de Servicio.

Se guarda en `configuracion_sistema` con `programa_tipo='general'`, `clave='dia_cierre_programas'`.

## 2. Regla de bloqueo

Un programa se considera **bloqueado** cuando:

- Su mes es **anterior** al mes en curso, **o**
- Es del mes en curso **y** hoy es **>= día de cierre**.

Quién puede editar un programa bloqueado:

- **super_admin** → sí.
- **admin / editor / cualquier otro rol** → no (toda la UI queda en modo lectura, los botones de guardar/limpiar/auto-generar/publicar se deshabilitan con tooltip "Programa cerrado a partir del día N").

La regla se aplica de forma **transversal** a los 4 módulos de programa.

## 3. Snapshot de nombres en BD

Para que renombrar / inactivar / eliminar a un participante no afecte un programa ya bloqueado, se guarda el nombre congelado **junto a cada fila** del programa.

Agregar columnas opcionales `nombres_snapshot jsonb` en:

- `programa_predicacion` (capitán + asignaciones de grupos)
- `programa_vida_ministerio` (todos los asignados de cada sección)
- `programa_reunion_publica` (orador, conductor, lector)
- `programa_asignaciones_servicio` (participante asignado)

Formato: `{ "<participante_id>": "Nombre Apellido", ... }`.

Cuando un programa se bloquea, un trigger / función pobla el snapshot con los nombres actuales de los participantes referenciados. En la UI y en los PDF, si el programa está bloqueado se usa el snapshot; si el participante ya no existe, se muestra el nombre congelado.

## 4. Cambios técnicos

**Migración SQL:**
- Función `public.programa_bloqueado(_congregacion_id uuid, _fecha date) returns boolean` que lee el día de cierre desde `configuracion_sistema` y aplica la regla.
- Añadir columna `nombres_snapshot jsonb` a las 4 tablas de programa.
- Política RLS adicional en cada tabla: `UPDATE/DELETE` solo permitido si `NOT programa_bloqueado(...)` o `is_super_admin(auth.uid())`.
- Trigger `BEFORE UPDATE/DELETE` que rechaza la operación con el mismo criterio (defensa en profundidad).
- Función `snapshot_programa(...)` que rellena `nombres_snapshot` para una fecha y módulo dados.
- Job/trigger: cuando se inserta/actualiza una fila no bloqueada, se refresca su snapshot. Cuando se cruza el día de cierre, el snapshot ya está al día.

**Frontend:**
- Nuevo hook `useProgramaBloqueado(fecha)` que consulta la regla.
- Wrapper en `ProgramaPredicacion`, `ProgramaVidaMinisterio`, `ProgramaReunionPublica`, `ProgramaAsignacionesServicio` que:
  - Deshabilita botones de edición / auto-generar / limpiar / publicar si está bloqueado y el usuario no es super_admin.
  - Muestra banner "Programa cerrado el día N. Solo super_admin puede modificar."
- Render de nombres: helper `getNombreParticipante(id, snapshot, participantes)` que prioriza snapshot cuando existe.
- Componente `AjustesSistema` → agregar input numérico para "Día de cierre mensual".

## 5. Migración de datos existentes

Para los programas ya publicados / pasados, rellenar `nombres_snapshot` una sola vez con los nombres actuales de los participantes (one-shot UPDATE en la migración).

## 6. Fuera de alcance

- No se cambia la lógica de `programas_publicados.cerrado` existente (la conservamos; el cierre automático solo afecta edición del programa de origen, no el PDF publicado).
- No se bloquea la creación de futuros programas.

---

¿Confirmas para implementar tal cual, o ajustamos algo (día default, módulos incluidos, mensaje del banner)?