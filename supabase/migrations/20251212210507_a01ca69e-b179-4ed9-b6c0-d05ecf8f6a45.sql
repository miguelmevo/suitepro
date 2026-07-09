-- Agregar campo url_maps e imagen_url a territorios
ALTER TABLE public.territorios 
ADD COLUMN url_maps text,
ADD COLUMN imagen_url text;

-- Crear bucket para imágenes de territorios
INSERT INTO storage.buckets (id, name, public) 
VALUES ('territorios', 'territorios', true);

-- Políticas de storage para el bucket
CREATE POLICY "Cualquiera puede ver imágenes de territorios"
ON storage.objects FOR SELECT
USING (bucket_id = 'territorios');

CREATE POLICY "Usuarios autenticados pueden subir imágenes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'territorios');

CREATE POLICY "Usuarios autenticados pueden actualizar imágenes"
ON storage.objects FOR UPDATE
USING (bucket_id = 'territorios');

CREATE POLICY "Usuarios autenticados pueden eliminar imágenes"
ON storage.objects FOR DELETE
USING (bucket_id = 'territorios');

-- Crear tabla de manzanas/bloques
CREATE TABLE public.manzanas_territorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territorio_id uuid NOT NULL REFERENCES public.territorios(id) ON DELETE CASCADE,
  letra text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  activo boolean NOT NULL DEFAULT true,
  UNIQUE(territorio_id, letra)
);

-- Habilitar RLS
ALTER TABLE public.manzanas_territorio ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para manzanas
CREATE POLICY "Acceso público manzanas_territorio"
ON public.manzanas_territorio FOR ALL
USING (true)
WITH CHECK (true);