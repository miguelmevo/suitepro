-- Homologa DEV con PRD: estas dos columnas ya existían en PRD pero ninguna
-- migración las creaba, así que get_predicacion_publico_completo fallaba en DEV
-- ("column numero_salida does not exist"). Idempotente: en PRD no cambia nada.

ALTER TABLE public.puntos_encuentro
  ADD COLUMN IF NOT EXISTS numero_salida integer;

ALTER TABLE public.dias_especiales
  ADD COLUMN IF NOT EXISTS bloquea_reuniones text[] NOT NULL DEFAULT '{}'::text[];
