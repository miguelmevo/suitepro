-- Las políticas de programas_publicados (insertar/actualizar/eliminar) usaban
-- is_admin_or_editor_in_congregacion, que solo mira el rol legado, ignorando
-- tanto el permiso granular del programa (crear/editar) como el nuevo
-- permiso independiente de "Publicar/despublicar". Un usuario con permiso
-- granular en Reunión Pública (o cualquier otro programa) no podía publicar
-- ni despublicar su propio programa.
CREATE OR REPLACE FUNCTION public.can_publicar_programa(_congregacion_id uuid, _tipo_programa text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN true;
  END IF;

  IF _tipo_programa = 'predicacion' THEN
    RETURN public.can_edit_predicacion(_congregacion_id)
      OR public.has_permission(auth.uid(), _congregacion_id, 'publicacion_predicacion', 'ver');
  END IF;

  IF _tipo_programa = 'reunion_publica' THEN
    RETURN public.has_permission(auth.uid(), _congregacion_id, 'reunion_publica_programa', 'crear')
      OR public.has_permission(auth.uid(), _congregacion_id, 'reunion_publica_programa', 'editar')
      OR public.has_permission(auth.uid(), _congregacion_id, 'publicacion_reunion_publica', 'ver');
  END IF;

  IF _tipo_programa = 'vida_ministerio' THEN
    RETURN public.has_permission(auth.uid(), _congregacion_id, 'vym_programa', 'crear')
      OR public.has_permission(auth.uid(), _congregacion_id, 'vym_programa', 'editar')
      OR public.has_permission(auth.uid(), _congregacion_id, 'publicacion_vym', 'ver');
  END IF;

  IF _tipo_programa = 'asignaciones_servicio' THEN
    RETURN public.has_permission(auth.uid(), _congregacion_id, 'asignaciones_servicio', 'crear')
      OR public.has_permission(auth.uid(), _congregacion_id, 'asignaciones_servicio', 'editar')
      OR public.has_permission(auth.uid(), _congregacion_id, 'publicacion_asignaciones_servicio', 'ver');
  END IF;

  RETURN public.is_admin_or_editor_in_congregacion(_congregacion_id);
END;
$function$;

DROP POLICY IF EXISTS "Admin y Editor pueden publicar programas en su congregación" ON public.programas_publicados;
CREATE POLICY "Editores del programa pueden publicar"
  ON public.programas_publicados FOR INSERT
  WITH CHECK (public.can_publicar_programa(congregacion_id, tipo_programa));

DROP POLICY IF EXISTS "Admin y Editor pueden actualizar programas publicados de su congregación" ON public.programas_publicados;
CREATE POLICY "Editores del programa pueden actualizar publicacion"
  ON public.programas_publicados FOR UPDATE
  USING (public.can_publicar_programa(congregacion_id, tipo_programa));

DROP POLICY IF EXISTS "Admin y Editor pueden eliminar programas publicados de su congregación" ON public.programas_publicados;
CREATE POLICY "Editores del programa pueden despublicar"
  ON public.programas_publicados FOR DELETE
  USING (public.can_publicar_programa(congregacion_id, tipo_programa));
