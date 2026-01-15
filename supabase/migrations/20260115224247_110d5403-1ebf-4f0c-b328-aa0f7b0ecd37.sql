-- Fix cerrar_programa to require authorization
CREATE OR REPLACE FUNCTION public.cerrar_programa(_programa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _congregacion_id uuid;
BEGIN
  -- Get the congregation_id for this program
  SELECT congregacion_id INTO _congregacion_id
  FROM programas_publicados
  WHERE id = _programa_id;
  
  IF _congregacion_id IS NULL THEN
    RAISE EXCEPTION 'program_not_found';
  END IF;
  
  -- Check if user is admin/editor in this congregation
  IF NOT is_admin_or_editor_in_congregacion(_congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE programas_publicados
  SET cerrado = true,
      cerrado_por = auth.uid(),
      fecha_cierre = now()
  WHERE id = _programa_id;
END;
$function$;