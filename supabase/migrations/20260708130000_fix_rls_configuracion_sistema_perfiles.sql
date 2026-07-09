-- La policy de modificación de configuracion_sistema solo reconocía admin/editor legacy
-- (is_admin_or_editor_in_congregacion) y no el sistema de permisos por perfil (has_permission).
-- Esto impedía guardar ajustes a usuarios con permiso de editar por perfil (error 42501 RLS).
-- Se amplía la policy para aceptar también has_permission sobre el permiso "ajustes_*"
-- correspondiente al programa_tipo de la fila.

DROP POLICY IF EXISTS "Admin y Editor pueden modificar configuración de su congregación" ON public.configuracion_sistema;
DROP POLICY IF EXISTS "Admin y Editor pueden modificar configuracion" ON public.configuracion_sistema;

CREATE POLICY "Modificar configuración: admin/editor o permiso por perfil"
ON public.configuracion_sistema
FOR ALL
TO authenticated
USING (
  public.is_admin_or_editor_in_congregacion(congregacion_id)
  OR public.has_permission(
       auth.uid(),
       congregacion_id,
       (CASE programa_tipo
          WHEN 'general'         THEN 'ajustes_general'
          WHEN 'asignaciones'    THEN 'ajustes_asignaciones'
          WHEN 'vida_ministerio' THEN 'ajustes_vida_ministerio'
          WHEN 'reunion_publica' THEN 'ajustes_reunion_publica'
          WHEN 'predicacion'     THEN 'ajustes_predicacion'
          WHEN 'carritos'        THEN 'ajustes_carritos'
          ELSE 'ajustes_general'
        END),
       'editar'
     )
)
WITH CHECK (
  public.is_admin_or_editor_in_congregacion(congregacion_id)
  OR public.has_permission(
       auth.uid(),
       congregacion_id,
       (CASE programa_tipo
          WHEN 'general'         THEN 'ajustes_general'
          WHEN 'asignaciones'    THEN 'ajustes_asignaciones'
          WHEN 'vida_ministerio' THEN 'ajustes_vida_ministerio'
          WHEN 'reunion_publica' THEN 'ajustes_reunion_publica'
          WHEN 'predicacion'     THEN 'ajustes_predicacion'
          WHEN 'carritos'        THEN 'ajustes_carritos'
          ELSE 'ajustes_general'
        END),
       'editar'
     )
);
