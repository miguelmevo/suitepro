
-- Migrar URLs existentes al nuevo formato con congregacion_id
-- Esto actualiza las URLs en la BD para que apunten al nuevo path
-- Las imágenes físicas necesitarán ser re-subidas por cada congregación

UPDATE territorios
SET imagen_url = REPLACE(
  imagen_url, 
  'territorios/imagenes/TERR', 
  'territorios/imagenes/' || congregacion_id || '_TERR'
)
WHERE imagen_url IS NOT NULL 
  AND imagen_url LIKE '%territorios/imagenes/TERR%'
  AND activo = true;
