ALTER TABLE public.programa_vida_ministerio
  ADD COLUMN IF NOT EXISTS sin_reunion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sin_reunion_motivo text;