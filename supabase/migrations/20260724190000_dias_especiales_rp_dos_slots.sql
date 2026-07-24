-- Permite hasta 2 días especiales por fecha en Reunión Pública (uno para la fila
-- Presidente, otro para la fila Orador de la tabla). Se agrega la columna "slot"
-- (1 o 2) y se reemplaza la restricción única de (congregacion_id, fecha) por
-- (congregacion_id, fecha, slot).
ALTER TABLE public.reunion_publica_dias_especiales
  ADD COLUMN IF NOT EXISTS slot smallint NOT NULL DEFAULT 1;

ALTER TABLE public.reunion_publica_dias_especiales
  DROP CONSTRAINT IF EXISTS rp_dias_esp_unique;

ALTER TABLE public.reunion_publica_dias_especiales
  ADD CONSTRAINT rp_dias_esp_slot_check CHECK (slot IN (1, 2));

ALTER TABLE public.reunion_publica_dias_especiales
  ADD CONSTRAINT rp_dias_esp_unique UNIQUE (congregacion_id, fecha, slot);
