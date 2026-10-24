-- Hospitalidad con varios grupos por reunión (hasta 5): "hospitalidad" es el primero.
ALTER TYPE public.tipo_asignacion_servicio ADD VALUE IF NOT EXISTS 'hospitalidad_2';
ALTER TYPE public.tipo_asignacion_servicio ADD VALUE IF NOT EXISTS 'hospitalidad_3';
ALTER TYPE public.tipo_asignacion_servicio ADD VALUE IF NOT EXISTS 'hospitalidad_4';
ALTER TYPE public.tipo_asignacion_servicio ADD VALUE IF NOT EXISTS 'hospitalidad_5';
