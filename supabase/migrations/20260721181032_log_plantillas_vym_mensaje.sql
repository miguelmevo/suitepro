-- Guarda el mensaje final (útil para ver el detalle de errores/conflictos de fecha
-- en el panel de "Actualizaciones automáticas", no solo el estado).
ALTER TABLE public.log_actualizacion_plantillas_vym
  ADD COLUMN mensaje text;
