-- Guarda cuánto tardó cada corrida del sync de plantillas VyM, para poder
-- mostrarlo junto a la fecha en el admin (ej: "7 agosto 2026, 14:48 (40 seg.)").

ALTER TABLE public.ejecucion_sync_plantillas_vym
  ADD COLUMN duracion_segundos integer;
