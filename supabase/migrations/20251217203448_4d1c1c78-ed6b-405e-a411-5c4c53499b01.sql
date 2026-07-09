-- Primero quitar el default
ALTER TABLE public.participantes ALTER COLUMN responsabilidad DROP DEFAULT;

-- Cambiar responsabilidad de text a text[] para permitir múltiples valores
ALTER TABLE public.participantes 
  ALTER COLUMN responsabilidad TYPE text[] USING ARRAY[responsabilidad]::text[];

-- Establecer nuevo valor por defecto como array
ALTER TABLE public.participantes 
  ALTER COLUMN responsabilidad SET DEFAULT ARRAY['publicador']::text[];