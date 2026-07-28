-- Cuando el auto-aplicado (desde Ajustes → Días Especiales) crea un día
-- especial en Reunión Pública o Asignaciones de Servicio, se guarda de qué
-- entrada del catálogo (dias_especiales) vino. Así, si esa entrada se edita
-- (cambia de fecha) o se elimina, se puede limpiar lo que ya había quedado
-- aplicado en los programas en vez de dejarlo "pegado" en la fecha vieja.
ALTER TABLE public.reunion_publica_dias_especiales
  ADD COLUMN origen_dia_especial_id uuid REFERENCES public.dias_especiales(id) ON DELETE SET NULL;

ALTER TABLE public.asignaciones_servicio_dias_especiales
  ADD COLUMN origen_dia_especial_id uuid REFERENCES public.dias_especiales(id) ON DELETE SET NULL;
