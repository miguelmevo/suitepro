CREATE TABLE public.tipos_salida_variantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_salida_id UUID NOT NULL REFERENCES public.tipos_salida(id) ON DELETE CASCADE,
  congregacion_id UUID NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tipo_salida_id, nombre)
);

CREATE INDEX idx_tsv_tipo_orden ON public.tipos_salida_variantes(tipo_salida_id, orden);
CREATE INDEX idx_tsv_congregacion ON public.tipos_salida_variantes(congregacion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_salida_variantes TO authenticated;
GRANT ALL ON public.tipos_salida_variantes TO service_role;

ALTER TABLE public.tipos_salida_variantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tsv_select" ON public.tipos_salida_variantes
  FOR SELECT TO authenticated
  USING (public.user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "tsv_insert" ON public.tipos_salida_variantes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_predicacion(congregacion_id));

CREATE POLICY "tsv_update" ON public.tipos_salida_variantes
  FOR UPDATE TO authenticated
  USING (public.can_edit_predicacion(congregacion_id))
  WITH CHECK (public.can_edit_predicacion(congregacion_id));

CREATE POLICY "tsv_delete" ON public.tipos_salida_variantes
  FOR DELETE TO authenticated
  USING (public.can_edit_predicacion(congregacion_id));

CREATE TRIGGER trg_tsv_updated_at
  BEFORE UPDATE ON public.tipos_salida_variantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();