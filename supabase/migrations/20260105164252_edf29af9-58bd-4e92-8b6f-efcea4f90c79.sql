-- =============================================
-- FASE 3: MIGRACIÓN DE DATOS EXISTENTES
-- =============================================

-- 3.1 Crear la congregación inicial
INSERT INTO public.congregaciones (id, nombre, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Villa Real', 'villareal');

-- 3.2 Asignar todos los datos existentes a la congregación inicial
UPDATE public.participantes 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.programa_predicacion 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.territorios 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.puntos_encuentro 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.horarios_salida 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.grupos_predicacion 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.grupos_servicio 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.miembros_grupo 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.dias_especiales 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.mensajes_adicionales 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.configuracion_sistema 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.programas_publicados 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.disponibilidad_capitanes 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.asignaciones_capitan_fijas 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

UPDATE public.manzanas_territorio 
SET congregacion_id = '00000000-0000-0000-0000-000000000001'
WHERE congregacion_id IS NULL;

-- 3.3 Asignar usuarios existentes a la congregación inicial
-- Migrar desde user_roles a usuarios_congregacion
INSERT INTO public.usuarios_congregacion (user_id, congregacion_id, rol, es_principal, activo)
SELECT 
  ur.user_id,
  '00000000-0000-0000-0000-000000000001',
  ur.role,
  true,
  true
FROM public.user_roles ur
ON CONFLICT (user_id, congregacion_id) DO NOTHING;

-- 3.4 Hacer la columna NOT NULL después de migrar datos
ALTER TABLE public.participantes 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.programa_predicacion 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.territorios 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.puntos_encuentro 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.horarios_salida 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.grupos_predicacion 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.grupos_servicio 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.miembros_grupo 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.dias_especiales 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.mensajes_adicionales 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.configuracion_sistema 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.programas_publicados 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.disponibilidad_capitanes 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.asignaciones_capitan_fijas 
ALTER COLUMN congregacion_id SET NOT NULL;

ALTER TABLE public.manzanas_territorio 
ALTER COLUMN congregacion_id SET NOT NULL;