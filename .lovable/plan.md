# Plan

## 1. Reemplazar `configuracion_ajustes` por 6 sub-módulos

En lugar de un único módulo "Ajustes del sistema", se crean 6 módulos independientes que mapean a las pestañas actuales de la página:

| ID nuevo | Etiqueta | Grupo |
|---|---|---|
| `ajustes_general` | General | Ajustes del sistema |
| `ajustes_asignaciones` | Asignaciones | Ajustes del sistema |
| `ajustes_vida_ministerio` | Vida y Ministerio | Ajustes del sistema |
| `ajustes_reunion_publica` | Reunión Pública | Ajustes del sistema |
| `ajustes_predicacion` | Predicación | Ajustes del sistema |
| `ajustes_carritos` | Carritos | Ajustes del sistema |

Cada uno mantiene las 4 acciones: **Ver / Crear / Editar / Eliminar**.

El módulo antiguo `configuracion_ajustes` desaparece del catálogo.

## 2. Nuevo grupo "Cierre de programas"

Se agregan 3 módulos especiales cuyo único permiso útil es **Ver** (que se interpreta como "puede cerrar/reabrir"). Las otras 3 columnas (Crear/Editar/Eliminar) se ocultan o se ignoran para estos módulos:

| ID | Etiqueta | Acción |
|---|---|---|
| `cierre_vym` | Cerrar/reabrir Vida y Ministerio | Ver = permitido |
| `cierre_reunion_publica` | Cerrar/reabrir Reunión Pública | Ver = permitido |
| `cierre_asignaciones_servicio` | Cerrar/reabrir Asignaciones de Servicio | Ver = permitido |

> Alternativa que considero mejor: reusar las 4 columnas como **Ver/Cerrar/Reabrir/—**, pero rompe la consistencia visual. Propongo **una sola columna activa ("Ver")** y atenuar las otras 3 en el modal para estos 3 módulos.

## 3. Backend (migración)

- Actualizar el fallback legacy de `has_permission()`:
  - Los 6 nuevos `ajustes_*` heredan los permisos que antes tenía `configuracion_ajustes` (admin/editor).
  - Los 3 `cierre_*` se conceden por defecto a `admin` (y `super_admin` siempre). Editores NO por defecto.
- Limpiar filas existentes con `modulo = 'configuracion_ajustes'` (migrarlas a los 6 nuevos con los mismos flags), si las hay.

## 4. Frontend

**`src/lib/permisos.ts`**
- Quitar `configuracion_ajustes`.
- Agregar los 6 módulos `ajustes_*` con `grupo: "Ajustes del sistema"`.
- Agregar los 3 `cierre_*` con `grupo: "Cierre de programas"`.
- Exportar un set `MODULOS_SOLO_VER` para que el modal sepa cuáles renderizar con una sola checkbox.

**`src/components/usuarios/PermisosModal.tsx`**
- Para los módulos en `MODULOS_SOLO_VER`, deshabilitar visualmente las columnas Crear/Editar/Eliminar.
- Acciones rápidas (Solo lectura / Acceso total / Limpiar) siguen funcionando.

**`src/pages/configuracion/AjustesSistema.tsx`**
- Reemplazar el gating actual basado en `configuracion_ajustes` (o rol legacy) por: cada pestaña visible si `canView('ajustes_<tab>')`; campos de cada pestaña deshabilitados si no hay `canEdit('ajustes_<tab>')`.
- Si el usuario no tiene `canView` en ninguna pestaña → redirigir o mostrar mensaje vacío.

**Botones de cierre/reapertura**
- `src/components/programa/CierreProgramaModal.tsx`: agregar prop `canClose`/`canReopen` controladas por el padre, en vez de depender solo de `isSuperAdmin`.
- En las páginas que usan el modal (`Editor.tsx` de VyM, `ProgramaReunionPublica.tsx`, `ProgramaAsignacionesServicio.tsx`): pasar `canClose = isSuperAdmin || canView('cierre_<modulo>')` y lo mismo para `canReopen`.
- `ProtectedRoute` y menús: sin cambios (los `cierre_*` no son rutas, solo gates de botón).

## 5. Fuera de alcance

- No se tocan las RLS de `configuracion_sistema` (la sub-división es solo a nivel UI/permission table; la tabla en DB sigue siendo una sola con claves `programa_tipo`).
- No se renombra `configuracion_ajustes` en la BD si quedan filas — la migración las traduce a las 6 nuevas filas equivalentes y borra las viejas.

¿Apruebo el plan y arranco con la migración + cambios de frontend?
