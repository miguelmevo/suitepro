-- Crear bucket para almacenar los PDFs de programas
INSERT INTO storage.buckets (id, name, public)
VALUES ('programas-pdf', 'programas-pdf', true)
ON CONFLICT (id) DO NOTHING;

-- Política para que cualquiera pueda ver/descargar los PDFs
CREATE POLICY "PDFs de programas son públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'programas-pdf');

-- Política para que admin/editor puedan subir PDFs
CREATE POLICY "Admin y Editor pueden subir PDFs de programas"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'programas-pdf' AND is_admin_or_editor(auth.uid()));

-- Política para que admin/editor puedan eliminar PDFs
CREATE POLICY "Admin y Editor pueden eliminar PDFs de programas"
ON storage.objects FOR DELETE
USING (bucket_id = 'programas-pdf' AND is_admin_or_editor(auth.uid()));

-- Tabla para registrar los programas publicados
CREATE TABLE public.programas_publicados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_programa TEXT NOT NULL DEFAULT 'predicacion',
  periodo TEXT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  pdf_url TEXT NOT NULL,
  pdf_path TEXT NOT NULL,
  publicado_por UUID REFERENCES auth.users(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.programas_publicados ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver los programas publicados (público)
CREATE POLICY "Programas publicados son públicos"
ON public.programas_publicados FOR SELECT
USING (true);

-- Solo admin/editor pueden crear
CREATE POLICY "Admin y Editor pueden publicar programas"
ON public.programas_publicados FOR INSERT
WITH CHECK (is_admin_or_editor(auth.uid()));

-- Solo admin/editor pueden actualizar
CREATE POLICY "Admin y Editor pueden actualizar programas publicados"
ON public.programas_publicados FOR UPDATE
USING (is_admin_or_editor(auth.uid()));

-- Solo admin/editor pueden eliminar
CREATE POLICY "Admin y Editor pueden eliminar programas publicados"
ON public.programas_publicados FOR DELETE
USING (is_admin_or_editor(auth.uid()));