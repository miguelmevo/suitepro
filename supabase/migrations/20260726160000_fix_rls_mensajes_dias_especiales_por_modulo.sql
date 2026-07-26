-- Las políticas RLS de mensajes_adicionales (insertar/actualizar/eliminar)
-- usaban can_edit_predicacion(...) SIEMPRE, sin importar el "modulo" real del
-- mensaje (predicacion / reunion_publica / asignaciones_servicio / ambos).
-- Un usuario con permiso granular solo en Reunión Pública (sin nada de
-- Predicación) no podía crear un mensaje adicional en su propio programa de
-- Reunión Pública. Se agrega una función que valida el permiso según el
-- módulo real, y se actualizan las políticas para usarla.
CREATE OR REPLACE FUNCTION public.can_edit_mensaje_adicional(_congregacion_id uuid, _modulo text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  IF _modulo IN ('predicacion', 'ambos') AND public.can_edit_predicacion(_congregacion_id) THEN
    RETURN true;
  END IF;

  IF _modulo IN ('reunion_publica', 'ambos') AND (
    public.has_permission(auth.uid(), _congregacion_id, 'reunion_publica_programa', 'crear')
    OR public.has_permission(auth.uid(), _congregacion_id, 'reunion_publica_programa', 'editar')
  ) THEN
    RETURN true;
  END IF;

  IF _modulo IN ('asignaciones_servicio', 'ambos') AND (
    public.has_permission(auth.uid(), _congregacion_id, 'asignaciones_servicio', 'crear')
    OR public.has_permission(auth.uid(), _congregacion_id, 'asignaciones_servicio', 'editar')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

DROP POLICY IF EXISTS "Editores predicacion pueden crear mensajes" ON public.mensajes_adicionales;
CREATE POLICY "Editores del modulo pueden crear mensajes"
  ON public.mensajes_adicionales FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_mensaje_adicional(congregacion_id, modulo));

DROP POLICY IF EXISTS "Editores predicacion pueden actualizar mensajes" ON public.mensajes_adicionales;
CREATE POLICY "Editores del modulo pueden actualizar mensajes"
  ON public.mensajes_adicionales FOR UPDATE TO authenticated
  USING (public.can_edit_mensaje_adicional(congregacion_id, modulo))
  WITH CHECK (public.can_edit_mensaje_adicional(congregacion_id, modulo));

DROP POLICY IF EXISTS "Editores predicacion pueden eliminar mensajes" ON public.mensajes_adicionales;
CREATE POLICY "Editores del modulo pueden eliminar mensajes"
  ON public.mensajes_adicionales FOR DELETE TO authenticated
  USING (public.can_edit_mensaje_adicional(congregacion_id, modulo));

-- reunion_publica_dias_especiales usaba is_admin_or_editor_in_congregacion,
-- que solo mira el rol legado (admin/editor/super_admin) y no el permiso
-- granular reunion_publica_programa. Mismo problema, mismo síntoma.
DROP POLICY IF EXISTS "Admin y Editor insertan dias esp RP" ON public.reunion_publica_dias_especiales;
CREATE POLICY "Admin y Editor insertan dias esp RP"
  ON public.reunion_publica_dias_especiales
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_editor_in_congregacion(congregacion_id)
    OR public.has_permission(auth.uid(), congregacion_id, 'reunion_publica_programa', 'crear')
    OR public.has_permission(auth.uid(), congregacion_id, 'reunion_publica_programa', 'editar')
  );

DROP POLICY IF EXISTS "Admin y Editor actualizan dias esp RP" ON public.reunion_publica_dias_especiales;
CREATE POLICY "Admin y Editor actualizan dias esp RP"
  ON public.reunion_publica_dias_especiales
  FOR UPDATE
  USING (
    public.is_admin_or_editor_in_congregacion(congregacion_id)
    OR public.has_permission(auth.uid(), congregacion_id, 'reunion_publica_programa', 'crear')
    OR public.has_permission(auth.uid(), congregacion_id, 'reunion_publica_programa', 'editar')
  );

DROP POLICY IF EXISTS "Admin y Editor eliminan dias esp RP" ON public.reunion_publica_dias_especiales;
CREATE POLICY "Admin y Editor eliminan dias esp RP"
  ON public.reunion_publica_dias_especiales
  FOR DELETE
  USING (
    public.is_admin_or_editor_in_congregacion(congregacion_id)
    OR public.has_permission(auth.uid(), congregacion_id, 'reunion_publica_programa', 'eliminar')
  );

-- (asignaciones_servicio_dias_especiales usa can_edit_asignaciones_servicio,
-- que ya incluye has_permission granular desde antes; no necesita cambios.)
