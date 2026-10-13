-- Restricción de un territorio por PUNTO DE ENCUENTRO (además de la restricción por grupo ya existente).
-- Un territorio usa un solo tipo de restricción: por grupos O por puntos de encuentro (lo controla la
-- aplicación al guardar). Sin filas en ninguna de las dos tablas = disponible para todos.

CREATE TABLE IF NOT EXISTS public.territorios_puntos_encuentro (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  territorio_id uuid NOT NULL REFERENCES public.territorios(id) ON DELETE CASCADE,
  punto_encuentro_id uuid NOT NULL REFERENCES public.puntos_encuentro(id) ON DELETE CASCADE,
  congregacion_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT territorios_puntos_unique UNIQUE (territorio_id, punto_encuentro_id)
);

CREATE INDEX IF NOT EXISTS idx_terr_puntos_territorio ON public.territorios_puntos_encuentro(territorio_id);
CREATE INDEX IF NOT EXISTS idx_terr_puntos_punto ON public.territorios_puntos_encuentro(punto_encuentro_id);
CREATE INDEX IF NOT EXISTS idx_terr_puntos_congregacion ON public.territorios_puntos_encuentro(congregacion_id);

ALTER TABLE public.territorios_puntos_encuentro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver asignaciones territorio-punto de su congregacion" ON public.territorios_puntos_encuentro;
CREATE POLICY "Usuarios pueden ver asignaciones territorio-punto de su congregacion"
ON public.territorios_puntos_encuentro FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

DROP POLICY IF EXISTS "Usuarios con permiso pueden crear asignaciones territorio-punto" ON public.territorios_puntos_encuentro;
CREATE POLICY "Usuarios con permiso pueden crear asignaciones territorio-punto"
ON public.territorios_puntos_encuentro FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));

DROP POLICY IF EXISTS "Usuarios con permiso pueden actualizar asignaciones territorio-punto" ON public.territorios_puntos_encuentro;
CREATE POLICY "Usuarios con permiso pueden actualizar asignaciones territorio-punto"
ON public.territorios_puntos_encuentro FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'))
WITH CHECK (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));

DROP POLICY IF EXISTS "Usuarios con permiso pueden eliminar asignaciones territorio-punto" ON public.territorios_puntos_encuentro;
CREATE POLICY "Usuarios con permiso pueden eliminar asignaciones territorio-punto"
ON public.territorios_puntos_encuentro FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), congregacion_id, 'predicacion_territorios', 'editar'));
