-- Add updated_at column to programas_publicados
ALTER TABLE public.programas_publicados 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Set existing rows' updated_at to created_at
UPDATE public.programas_publicados SET updated_at = created_at WHERE updated_at = now();

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_programas_publicados_updated_at
BEFORE UPDATE ON public.programas_publicados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();