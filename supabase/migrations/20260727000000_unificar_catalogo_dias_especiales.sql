-- Une el catálogo de días especiales (dias_especiales, reutilizable sin
-- fecha, usado por el selector "+" de cada programa) con las fechas
-- concretas asignadas centralmente desde Ajustes (dias_especiales_fechas):
-- cada motivo del catálogo ahora puede opcionalmente tener una fecha fija
-- y una lista de programas a los que se auto-aplica al abrir el mes, sin
-- dejar de estar disponible como opción libre en el selector de cada
-- programa (que ya lee de esta misma tabla).
ALTER TABLE public.dias_especiales
  ADD COLUMN programas text[] NOT NULL DEFAULT '{}';

-- Evita 2 motivos con auto-aplicado en la misma fecha para la misma congregación.
CREATE UNIQUE INDEX dias_especiales_fecha_unique
  ON public.dias_especiales (congregacion_id, fecha)
  WHERE fecha IS NOT NULL AND activo = true;

-- Migra las filas ya creadas en la tabla centralizada, que queda obsoleta.
INSERT INTO public.dias_especiales (congregacion_id, nombre, bloqueo_tipo, color, fecha, programas, activo)
SELECT congregacion_id, motivo, bloqueo_tipo, color, fecha, programas, true
FROM public.dias_especiales_fechas;

DROP TABLE public.dias_especiales_fechas;
