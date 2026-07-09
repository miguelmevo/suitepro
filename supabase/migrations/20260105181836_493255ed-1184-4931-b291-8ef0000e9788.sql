-- Agregar campo para URL oculta/encriptada en congregaciones
ALTER TABLE public.congregaciones 
ADD COLUMN url_oculta boolean NOT NULL DEFAULT false;

-- Agregar comentario explicativo
COMMENT ON COLUMN public.congregaciones.url_oculta IS 'Si es true, el slug será un identificador aleatorio en lugar del nombre de la congregación';