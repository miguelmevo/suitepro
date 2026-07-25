-- Permite hasta 2 días especiales por fecha en Asignaciones de Servicio, igual que
-- se hizo para Reunión Pública: columna "slot" (1 o 2) y unicidad por
-- (congregacion_id, fecha, slot) en vez de (congregacion_id, fecha).
ALTER TABLE public.asignaciones_servicio_dias_especiales
  ADD COLUMN IF NOT EXISTS slot smallint NOT NULL DEFAULT 1;

ALTER TABLE public.asignaciones_servicio_dias_especiales
  DROP CONSTRAINT IF EXISTS asig_serv_dias_esp_unique;

ALTER TABLE public.asignaciones_servicio_dias_especiales
  ADD CONSTRAINT asig_serv_dias_esp_slot_check CHECK (slot IN (1, 2));

ALTER TABLE public.asignaciones_servicio_dias_especiales
  ADD CONSTRAINT asig_serv_dias_esp_unique UNIQUE (congregacion_id, fecha, slot);
