-- Actualizar constraint para configuracion_sistema para incluir congregacion_id
-- Primero eliminar la constraint existente si existe
ALTER TABLE public.configuracion_sistema 
DROP CONSTRAINT IF EXISTS configuracion_sistema_programa_tipo_clave_key;

-- Crear nueva constraint que incluya congregacion_id
ALTER TABLE public.configuracion_sistema 
ADD CONSTRAINT configuracion_sistema_programa_tipo_clave_congregacion_key 
UNIQUE (programa_tipo, clave, congregacion_id);