CREATE TABLE public.territorios_grupos_predicacion (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  territorio_id uuid NOT NULL,
  grupo_predicacion_id uuid NOT NULL,
  congregacion_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT territorios_grupos_unique UNIQUE (territorio_id, grupo_predicacion_id)
);

CREATE INDEX idx_terr_grupos_territorio ON public.territorios_grupos_predicacion(territorio_id);
CREATE INDEX idx_terr_grupos_grupo ON public.territorios_grupos_predicacion(grupo_predicacion_id);
CREATE INDEX idx_terr_grupos_congregacion ON public.territorios_grupos_predicacion(congregacion_id);

ALTER TABLE public.territorios_grupos_predicacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver asignaciones territorio-grupo de su congregacion"
ON public.territorios_grupos_predicacion FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear asignaciones territorio-grupo"
ON public.territorios_grupos_predicacion FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar asignaciones territorio-grupo"
ON public.territorios_grupos_predicacion FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar asignaciones territorio-grupo"
ON public.territorios_grupos_predicacion FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- Backfill desde la columna existente
INSERT INTO public.territorios_grupos_predicacion (territorio_id, grupo_predicacion_id, congregacion_id)
SELECT t.id, t.grupo_predicacion_id, t.congregacion_id
FROM public.territorios t
WHERE t.grupo_predicacion_id IS NOT NULL
  AND t.activo = true
ON CONFLICT (territorio_id, grupo_predicacion_id) DO NOTHING;