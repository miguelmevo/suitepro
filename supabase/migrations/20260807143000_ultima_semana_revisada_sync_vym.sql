-- Guarda hasta qué semana llegó a revisar cada corrida del sync de plantillas
-- VyM, para poder mostrar "revisado hasta el DD/MM/AAAA" en vez de un aviso
-- genérico de "puede que hayan quedado semanas pendientes".

ALTER TABLE public.ejecucion_sync_plantillas_vym
  ADD COLUMN ultima_semana_revisada date;
