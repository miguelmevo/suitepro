
CREATE TABLE public.plantillas_vida_ministerio_oficial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_semana date NOT NULL,
  idioma text NOT NULL DEFAULT 'es',
  url_origen text,
  lectura_semana text,
  cantico_inicial integer,
  cantico_intermedio integer,
  cantico_final integer,
  tesoros jsonb NOT NULL DEFAULT '{}'::jsonb,
  perlas jsonb NOT NULL DEFAULT '{}'::jsonb,
  lectura_biblica jsonb NOT NULL DEFAULT '{}'::jsonb,
  maestros jsonb NOT NULL DEFAULT '[]'::jsonb,
  vida_cristiana jsonb NOT NULL DEFAULT '[]'::jsonb,
  estudio_biblico jsonb NOT NULL DEFAULT '{}'::jsonb,
  importado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fecha_semana, idioma)
);

ALTER TABLE public.plantillas_vida_ministerio_oficial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view official VyM templates"
ON public.plantillas_vida_ministerio_oficial
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Super admins can insert official VyM templates"
ON public.plantillas_vida_ministerio_oficial
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update official VyM templates"
ON public.plantillas_vida_ministerio_oficial
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete official VyM templates"
ON public.plantillas_vida_ministerio_oficial
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_plantillas_vym_oficial_updated_at
BEFORE UPDATE ON public.plantillas_vida_ministerio_oficial
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_plantillas_vym_fecha ON public.plantillas_vida_ministerio_oficial (fecha_semana);
