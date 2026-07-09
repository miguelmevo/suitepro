-- Add color_primario column to congregaciones table
ALTER TABLE public.congregaciones
ADD COLUMN color_primario TEXT DEFAULT 'blue';

-- Add a comment to document the column
COMMENT ON COLUMN public.congregaciones.color_primario IS 'Primary color theme for the congregation (e.g., blue, emerald, rose, amber, violet, etc.)';