-- Eliminar columnas duplicadas de grupos_predicacion.
-- A partir de ahora, el SG y AG de cada grupo se derivan exclusivamente
-- de participantes.responsabilidad_adicional ('superintendente_grupo' / 'auxiliar_grupo')
-- combinado con participantes.grupo_predicacion_id.
ALTER TABLE public.grupos_predicacion
  DROP COLUMN IF EXISTS superintendente_id,
  DROP COLUMN IF EXISTS auxiliar_id;