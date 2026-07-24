-- Permite elegir un color de fondo distinto (de la misma paleta que las notas
-- adicionales) solo para el bloque del día especial en el PDF de Asignaciones de
-- Servicio, sin afectar el color mostrado en la pantalla (UI).
ALTER TABLE public.asignaciones_servicio_dias_especiales
  ADD COLUMN IF NOT EXISTS color_pdf text;
