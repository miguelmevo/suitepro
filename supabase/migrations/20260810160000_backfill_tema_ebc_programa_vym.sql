-- Backfill de estudio_biblico.tema en programa_vida_ministerio: el botón
-- "Cargar" plantilla nunca copiaba ese campo (solo la duración), así que
-- todo programa cargado antes del fix quedó con tema = null aunque la
-- plantilla oficial sí lo tuviera. Se completa desde
-- plantillas_vida_ministerio_oficial por fecha_semana, solo donde falta.

-- Programas de meses cerrados bloquean UPDATE vía trg_enforce_bloqueo; se
-- deshabilita solo para este backfill puntual y se reactiva al final.
ALTER TABLE public.programa_vida_ministerio DISABLE TRIGGER trg_enforce_bloqueo;

UPDATE public.programa_vida_ministerio pvm
SET estudio_biblico = jsonb_set(
  pvm.estudio_biblico,
  '{tema}',
  to_jsonb(p.estudio_biblico ->> 'tema')
)
FROM public.plantillas_vida_ministerio_oficial p
WHERE p.fecha_semana = pvm.fecha_semana
  AND p.idioma = 'es'
  AND (pvm.estudio_biblico ->> 'tema') IS NULL
  AND (p.estudio_biblico ->> 'tema') IS NOT NULL;

ALTER TABLE public.programa_vida_ministerio ENABLE TRIGGER trg_enforce_bloqueo;
