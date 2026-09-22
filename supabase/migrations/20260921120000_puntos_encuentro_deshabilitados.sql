-- Deshabilitar un punto de encuentro en fechas puntuales (única o rango),
-- sin apagarlo para siempre (eso ya lo cubre puntos_encuentro.activo).
CREATE TABLE public.puntos_encuentro_deshabilitados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  punto_encuentro_id UUID NOT NULL REFERENCES public.puntos_encuentro(id) ON DELETE CASCADE,
  congregacion_id UUID NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE, -- NULL significa fecha única (solo fecha_inicio)
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_puntos_encuentro_deshabilitados_punto ON public.puntos_encuentro_deshabilitados(punto_encuentro_id);
CREATE INDEX idx_puntos_encuentro_deshabilitados_fechas ON public.puntos_encuentro_deshabilitados(fecha_inicio, fecha_fin);

ALTER TABLE public.puntos_encuentro_deshabilitados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven fechas deshabilitadas de su congregación"
ON public.puntos_encuentro_deshabilitados
FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear fechas deshabilitadas en su congregación"
ON public.puntos_encuentro_deshabilitados
FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar fechas deshabilitadas de su congregación"
ON public.puntos_encuentro_deshabilitados
FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));
