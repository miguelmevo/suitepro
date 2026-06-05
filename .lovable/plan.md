# Plan: Sistema de permisos granulares por usuario

Convivirá con el sistema de roles actual. Los roles existentes siguen funcionando como fallback hasta que migres manualmente a los 5 usuarios. RLS de las tablas existentes **no se toca** en esta entrega (queda para Fase 5 futura).

## Catálogo de módulos (17)

| Módulo | Pantalla / Pestaña |
|---|---|
| `inicio` | Inicio |
| `programas_del_mes` | Programas del Mes |
| `predicacion_programa` | Predicación → Programa mensual |
| `predicacion_capitanes` | Predicación → Disponibilidad capitanes (pestaña) |
| `predicacion_puntos` | Predicación → Puntos de encuentro |
| `predicacion_carritos` | Predicación → Carritos |
| `predicacion_territorios` | Predicación → Territorios |
| `predicacion_territorios_historial` | Predicación → Historial territorios |
| `predicacion_historial` | Predicación → Historial programas |
| `reunion_publica_programa` | Reunión Pública → Programa |
| `reunion_publica_lectores` | Reunión Pública → Lectores Atalaya |
| `vym_programa` | Vida y Ministerio → Lista + editor |
| `vym_lectores_ebc` | Vida y Ministerio → Lectores EBC |
| `vym_historial` | Vida y Ministerio → Historial |
| `asignaciones_servicio` | Asignaciones de Servicio |
| `configuracion_participantes` | Configuración → Participantes |
| `configuracion_grupos` | Configuración → Grupos de predicación |
| `configuracion_dias_especiales` | Configuración → Días/Indisponibilidad |
| `configuracion_ajustes` | Configuración → Ajustes del sistema |
| `configuracion_usuarios` | Configuración → Usuarios (gestión + permisos) |

Cada módulo tiene 4 acciones: `ver`, `crear`, `editar`, `eliminar`.

**Cascada:** sin `ver` → no aparece en menú ni se entra a la ruta → los botones de crear/editar/eliminar son irrelevantes. `crear`/`editar`/`eliminar` requieren `ver`.

## Fase 1 — Backend

Tabla `permisos_usuario_congregacion`:

```
(user_id, congregacion_id, modulo) PK
puede_ver, puede_crear, puede_editar, puede_eliminar  bool default false
created_at, updated_at
```

Con RLS:
- SELECT: el propio usuario ve sus permisos, y admins de esa congregación los ven todos.
- INSERT/UPDATE/DELETE: solo admin/super_admin de la congregación.

Función `has_permission(_user_id, _congregacion_id, _modulo, _accion)`:

```
1. Si super_admin → true
2. Si existe fila en permisos_usuario_congregacion con la acción true → true
3. Fallback legacy: si el rol del usuario en la congregación tradicionalmente
   tenía acceso a ese módulo+acción → true
4. Si no → false
```

El fallback legacy replica el mapa actual de `requiredRoles` por ruta y `isAdminOrEditor()` para acciones de escritura. Así los 5 usuarios actuales siguen funcionando sin tocar nada hasta que les asignes permisos explícitos.

## Fase 2 — Frontend lectura

Hook `usePermisos()` que devuelve:

```ts
{
  loading: boolean,
  can: (modulo, accion) => boolean,
  canView: (modulo) => boolean,
  canCreate: (modulo) => boolean,
  canEdit: (modulo) => boolean,
  canDelete: (modulo) => boolean,
}
```

Internamente llama a una RPC `get_my_permissions(_congregacion_id)` que devuelve todos los módulos efectivos del usuario (combinando granular + legacy), cacheada con React Query.

`ProtectedRoute` acepta nueva prop opcional `requiredPermission={ modulo, accion: 'ver' }`. Si está presente la usa; si no, sigue usando `requiredRoles`. Migración ruta-a-ruta sin romper nada.

`AppSidebar`, `MobileNav` y `BottomNav` filtran items por `canView(modulo)`.

## Fase 3 — Frontend escritura

Reemplazar usos de `isAdminOrEditor()` (y similares) por `can(modulo, accion)` en:

- Botones "Nuevo / Crear / Agregar"
- Botones de editar (lápiz, abrir modal de edición, guardar)
- Botones de eliminar (basurero, confirm dialog)
- Inputs/Selects deshabilitados según permiso de edición

Sin cambios de layout — solo cambia de qué hook leen el booleano `disabled`/`hidden`.

## Fase 4 — Pantalla de gestión

En **Configuración → Usuarios**, agregar botón "Permisos" por usuario que abre un modal con matriz:

```
                Ver    Crear   Editar  Eliminar
Inicio          [x]    [ ]     [ ]     [ ]
Programa Pred.  [x]    [x]     [x]     [ ]
...
```

Acciones rápidas: "Solo lectura (todo)", "Acceso total (todo)", "Limpiar", "Copiar de otro usuario…".

Reglas de UI:
- Si se desmarca `ver` se desmarcan automáticamente las otras 3.
- Si se marca cualquiera de crear/editar/eliminar se marca `ver`.

Solo visible para admin y super_admin.

## Flujo de usuario nuevo

1. Usuario se registra desde "Crear Cuenta" (flujo actual).
2. Queda en `pendiente_aprobación` (sin cambios).
3. Admin lo aprueba en Configuración → Usuarios (sin cambios).
4. Admin abre "Permisos" y le asigna los módulos/acciones que necesita.
5. Mientras no le asigne nada, el fallback legacy aplica según su rol tradicional.

## Detalles técnicos

- Las RPC son `SECURITY DEFINER` con `set search_path = public` para evitar recursión RLS.
- `usePermisos()` invalida cache cuando cambia la congregación activa (super_admin) o cuando se guarda el modal de permisos.
- Sin tocar `src/integrations/supabase/client.ts` ni `types.ts` (se regeneran solos).
- Sin tocar RLS de tablas existentes en esta entrega.

## Fuera de alcance (Fase 5, futuro)

- Endurecer RLS de cada tabla para usar `has_permission()` en vez de `is_admin_or_editor_in_congregacion()`.
- Roles personalizables por congregación (plantillas de permisos).
- Auditoría de cambios de permisos.

¿Apruebo y arranco con la Fase 1 (migración de la tabla + función `has_permission` con fallback legacy)?
