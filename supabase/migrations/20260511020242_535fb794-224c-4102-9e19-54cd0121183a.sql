
ALTER TABLE public.horarios_salida
  ADD COLUMN IF NOT EXISTS franja text NOT NULL DEFAULT 'manana'
  CHECK (franja IN ('manana','tarde'));

-- Backfill según la regla histórica
UPDATE public.horarios_salida
SET franja = CASE
  WHEN hora < TIME '12:00' THEN 'manana'
  ELSE 'tarde'
END;
