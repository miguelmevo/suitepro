-- Reunión Pública y Asignaciones de Servicio permiten hasta 2 días especiales
-- por fecha (para acomodar nombres largos en 2 filas). El índice único que
-- impedía 2 motivos con fecha en el mismo día lo bloqueaba a nivel de
-- catálogo antes de siquiera llegar a esa lógica de slots. Se elimina.
DROP INDEX IF EXISTS public.dias_especiales_fecha_unique;
