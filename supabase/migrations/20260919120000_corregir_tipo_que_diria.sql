-- "¿Qué diría?" (Análisis con el auditorio) es una sola persona y solo A o SM,
-- lo que se controla con maestros[].tipo = 'analisis_con_auditorio'. Hay
-- programas guardados antes de que existiera esa clasificación que quedaron
-- con tipo 'demostracion' (con selector de ayudante y un "—" al imprimir).
-- Se alinea el tipo con el de la plantilla oficial de esa semana y se limpia
-- el ayudante. Idempotente: no toca partes que ya tienen el tipo correcto.
UPDATE public.programa_vida_ministerio p
SET maestros = (
  SELECT jsonb_agg(
    CASE
      WHEN m.elem->>'titulo' ILIKE '%qu_ dir_a%'
       AND COALESCE(m.elem->>'tipo', 'demostracion') <> 'analisis_con_auditorio'
       AND EXISTS (
         SELECT 1
         FROM public.plantillas_vida_ministerio_oficial t,
              jsonb_array_elements(t.maestros) tm
         WHERE t.fecha_semana = p.fecha_semana
           AND tm->>'titulo' ILIKE '%qu_ dir_a%'
           AND tm->>'tipo' = 'analisis_con_auditorio'
       )
      THEN m.elem || jsonb_build_object('tipo', 'analisis_con_auditorio', 'ayudante_id', NULL)
      ELSE m.elem
    END
    ORDER BY m.ord
  )
  FROM jsonb_array_elements(p.maestros) WITH ORDINALITY AS m(elem, ord)
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(p.maestros) e
  WHERE e->>'titulo' ILIKE '%qu_ dir_a%'
    AND COALESCE(e->>'tipo', 'demostracion') <> 'analisis_con_auditorio'
)
AND EXISTS (
  SELECT 1
  FROM public.plantillas_vida_ministerio_oficial t,
       jsonb_array_elements(t.maestros) tm
  WHERE t.fecha_semana = p.fecha_semana
    AND tm->>'titulo' ILIKE '%qu_ dir_a%'
    AND tm->>'tipo' = 'analisis_con_auditorio'
);
