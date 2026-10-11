-- "¿Qué dirías?" (con "s") es la misma parte que "¿Qué diría?": una sola persona,
-- sólo Anciano o SM, "Análisis con el auditorio". El importador sólo reconocía
-- "¿Qué diría?", así que estas semanas quedaron como demostración (titular +
-- ayudante). Se corrigen las plantillas oficiales y los programas ya guardados.

CREATE OR REPLACE FUNCTION public._vym_es_analisis_auditorio(e jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT e->>'tipo' = 'demostracion'
    AND translate(lower(regexp_replace(coalesce(e->>'titulo', ''), '[¿?¡!.]', '', 'g')), 'áéíóú', 'aeiou') IN ('que diria', 'que dirias')
    AND (
      translate(lower(coalesce(e->>'detalle', '')), 'áéíóú', 'aeiou') LIKE 'analisis con el auditorio%'
      OR translate(lower(coalesce(e->>'detalle', '')), 'áéíóú', 'aeiou') LIKE 'participacion con el auditorio%'
    );
$$;

-- Plantillas oficiales (no son datos de ninguna congregación).
UPDATE public.plantillas_vida_ministerio_oficial p
SET maestros = (
  SELECT jsonb_agg(
           CASE WHEN public._vym_es_analisis_auditorio(t.e)
                THEN t.e || jsonb_build_object('tipo', 'analisis_con_auditorio')
                ELSE t.e END
           ORDER BY t.ord)
  FROM jsonb_array_elements(p.maestros) WITH ORDINALITY AS t(e, ord)
)
WHERE jsonb_typeof(p.maestros) = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.maestros) e WHERE public._vym_es_analisis_auditorio(e));

-- Programas ya guardados: una sola persona, sin ayudante. Fila por fila: si alguna
-- está bloqueada o falla, se omite y el editor la realinea al abrirla.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.programa_vida_ministerio
    WHERE jsonb_typeof(maestros) = 'array'
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(maestros) e WHERE public._vym_es_analisis_auditorio(e))
  LOOP
    BEGIN
      UPDATE public.programa_vida_ministerio p
      SET maestros = (
        SELECT jsonb_agg(
                 CASE WHEN public._vym_es_analisis_auditorio(t.e)
                      THEN t.e || jsonb_build_object(
                        'tipo', 'analisis_con_auditorio',
                        'ayudante_id', NULL,
                        'ayudante_sala_b_id', NULL,
                        'ayudante_sala_c_id', NULL)
                      ELSE t.e END
                 ORDER BY t.ord)
        FROM jsonb_array_elements(p.maestros) WITH ORDINALITY AS t(e, ord)
      )
      WHERE p.id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Programa % omitido: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
