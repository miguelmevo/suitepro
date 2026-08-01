-- Elimina el overload anterior (sin _marcado_por) para evitar ambigüedad en PostgREST
DROP FUNCTION IF EXISTS public.marcar_manzana_trabajada(uuid, uuid, uuid, date);
