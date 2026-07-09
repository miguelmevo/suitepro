-- Drop unused tables from previous iteration
DROP TABLE IF EXISTS public.tipos_salida_variantes CASCADE;
DROP TABLE IF EXISTS public.tipos_salida CASCADE;

-- Create grupos_predicacion_ficticios
CREATE TABLE public.grupos_predicacion_ficticios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregacion_id uuid NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  habilitado_en_formulario boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_predicacion_ficticios TO authenticated;
GRANT ALL ON public.grupos_predicacion_ficticios TO service_role;

ALTER TABLE public.grupos_predicacion_ficticios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver grupos ficticios de mi congregacion"
ON public.grupos_predicacion_ficticios
FOR SELECT
TO authenticated
USING (public.user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "crear grupos ficticios con permiso"
ON public.grupos_predicacion_ficticios
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_editor_in_congregacion(congregacion_id)
  OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_programa', 'crear')
);

CREATE POLICY "editar grupos ficticios con permiso"
ON public.grupos_predicacion_ficticios
FOR UPDATE
TO authenticated
USING (
  public.is_admin_or_editor_in_congregacion(congregacion_id)
  OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_programa', 'editar')
)
WITH CHECK (
  public.is_admin_or_editor_in_congregacion(congregacion_id)
  OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_programa', 'editar')
);

CREATE POLICY "eliminar grupos ficticios con permiso"
ON public.grupos_predicacion_ficticios
FOR DELETE
TO authenticated
USING (
  public.is_admin_or_editor_in_congregacion(congregacion_id)
  OR public.has_permission(auth.uid(), congregacion_id, 'predicacion_programa', 'eliminar')
);

CREATE INDEX idx_grupos_ficticios_congregacion ON public.grupos_predicacion_ficticios(congregacion_id);

CREATE TRIGGER update_grupos_ficticios_updated_at
BEFORE UPDATE ON public.grupos_predicacion_ficticios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();