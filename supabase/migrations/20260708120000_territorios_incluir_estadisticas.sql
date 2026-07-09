-- Permite excluir territorios de las estadísticas de predicación sin borrarlos.
-- Por defecto todos los territorios se incluyen.
ALTER TABLE public.territorios
  ADD COLUMN IF NOT EXISTS incluir_en_estadisticas boolean NOT NULL DEFAULT true;
