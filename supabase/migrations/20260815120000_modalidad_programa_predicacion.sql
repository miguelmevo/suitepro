-- Modalidad de la salida de predicación: cómo se predica, independiente de
-- cómo se organiza la salida (general / por grupos / por grupo individual).
--
-- Hasta ahora "cartas" y "zoom" se lograban dejando campos vacíos a propósito
-- (ImpresionPrograma imprime "CARTAS" cuando no hay dirección y "ZOOM" cuando
-- no hay punto de encuentro), lo que no permitía filtrar ni reportar por
-- modalidad. Este campo lo hace explícito.
--
-- Reglas de campos según modalidad (aplicadas en la UI):
--   territorio        -> lleva territorio y punto de encuentro
--   cartas_presencial -> sin territorio; con punto de encuentro salvo cuando
--                        la salida es por grupo individual (cada grupo se
--                        pone de acuerdo dónde juntarse)
--   telefono          -> sin territorio y sin punto de encuentro

ALTER TABLE public.programa_predicacion
  ADD COLUMN modalidad text NOT NULL DEFAULT 'territorio'
    CHECK (modalidad IN ('territorio', 'cartas_presencial', 'telefono'));

COMMENT ON COLUMN public.programa_predicacion.modalidad IS
  'Cómo se predica en esta salida: territorio (casa por casa), cartas_presencial o telefono. Ortogonal a es_por_grupos / es_mensaje_especial.';
