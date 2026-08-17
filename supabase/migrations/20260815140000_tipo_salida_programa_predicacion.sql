-- Hace explícito el "Tipo" de la salida de predicación, que hasta ahora se
-- adivinaba en el frontend a partir de es_mensaje_especial / es_por_grupos y de
-- una heurística sobre salida_index dentro de asignaciones_grupos:
--
--   esIndividual = asignaciones.length > 0 && (todos tienen salida_index único
--                                              || ninguno tiene salida_index)
--
-- Esa heurística se rompe cuando una salida por grupo individual no tiene
-- asignaciones (p. ej. modalidad "cartas presencial", donde no se cargan datos
-- por grupo): quedaría clasificada como "por grupos". Con la columna el tipo se
-- guarda tal cual lo eligió el usuario.

ALTER TABLE public.programa_predicacion
  ADD COLUMN tipo_salida text
    CHECK (tipo_salida IN ('sin_asignar', 'dia_especial', 'por_grupos', 'por_grupo_individual'));

-- Backfill reproduciendo exactamente la derivación que hacía el frontend, para
-- que las filas existentes conserven el tipo con el que se venían mostrando.
-- El trigger de bloqueo de programas cerrados rechaza UPDATE, así que se
-- desactiva solo durante el backfill y se reactiva al final.
ALTER TABLE public.programa_predicacion DISABLE TRIGGER trg_enforce_bloqueo;

UPDATE public.programa_predicacion pp
SET tipo_salida = CASE
  WHEN pp.es_mensaje_especial THEN 'dia_especial'
  WHEN pp.es_por_grupos THEN (
    SELECT CASE
      -- sin asignaciones: la heurística previa caía en "por grupos"
      WHEN s.n = 0 THEN 'por_grupos'
      -- ninguno tiene salida_index (datos legacy) -> individual
      WHEN s.k = 0 THEN 'por_grupo_individual'
      -- todos tienen salida_index y son únicos -> individual
      WHEN s.k = s.n AND s.d = s.n THEN 'por_grupo_individual'
      ELSE 'por_grupos'
    END
    FROM (
      SELECT
        jsonb_array_length(COALESCE(pp.asignaciones_grupos, '[]'::jsonb)) AS n,
        (
          SELECT count(*)
          FROM jsonb_array_elements(COALESCE(pp.asignaciones_grupos, '[]'::jsonb)) e
          WHERE e ->> 'salida_index' IS NOT NULL
        ) AS k,
        (
          SELECT count(DISTINCT e ->> 'salida_index')
          FROM jsonb_array_elements(COALESCE(pp.asignaciones_grupos, '[]'::jsonb)) e
          WHERE e ->> 'salida_index' IS NOT NULL
        ) AS d
    ) s
  )
  ELSE 'sin_asignar'
END
WHERE pp.tipo_salida IS NULL;

ALTER TABLE public.programa_predicacion ENABLE TRIGGER trg_enforce_bloqueo;

COMMENT ON COLUMN public.programa_predicacion.tipo_salida IS
  'Cómo se organiza la salida: sin_asignar | dia_especial | por_grupos | por_grupo_individual. Reemplaza la derivación por heurística. Ortogonal a modalidad.';
