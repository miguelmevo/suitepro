-- El modal de permisos borraba todas las filas de permisos_usuario_congregacion
-- del usuario y luego insertaba las nuevas en 2 llamadas separadas (no
-- atómicas): si el insert fallaba (ej. por RLS), el borrado ya se había
-- aplicado, dejando al usuario sin ningún permiso explícito y, si su rol
-- legado tampoco era admin, sin acceso a nada. Esta función hace ambos pasos
-- en una sola transacción, revirtiendo todo si algo falla.
CREATE OR REPLACE FUNCTION public.guardar_permisos_usuario(
  _target_user_id uuid,
  _congregacion_id uuid,
  _rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.usuarios_congregacion uc
      WHERE uc.user_id = auth.uid()
        AND uc.congregacion_id = _congregacion_id
        AND uc.rol IN ('admin'::app_role, 'super_admin'::app_role)
        AND uc.activo = true
    )
    OR public.has_permission(auth.uid(), _congregacion_id, 'configuracion_usuarios', 'editar')
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para modificar los permisos de esta congregación';
  END IF;

  DELETE FROM public.permisos_usuario_congregacion
  WHERE user_id = _target_user_id AND congregacion_id = _congregacion_id;

  INSERT INTO public.permisos_usuario_congregacion
    (user_id, congregacion_id, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar)
  SELECT
    _target_user_id,
    _congregacion_id,
    r->>'modulo',
    COALESCE((r->>'puede_ver')::boolean, false),
    COALESCE((r->>'puede_crear')::boolean, false),
    COALESCE((r->>'puede_editar')::boolean, false),
    COALESCE((r->>'puede_eliminar')::boolean, false)
  FROM jsonb_array_elements(_rows) AS r;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.guardar_permisos_usuario(uuid, uuid, jsonb) TO authenticated;
