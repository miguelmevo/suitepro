-- Add es_publicador_inactivo flag to participantes table
ALTER TABLE public.participantes 
ADD COLUMN es_publicador_inactivo boolean NOT NULL DEFAULT false;