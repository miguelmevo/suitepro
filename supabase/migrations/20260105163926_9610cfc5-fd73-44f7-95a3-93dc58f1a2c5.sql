-- =============================================
-- FASE 2: AGREGAR congregacion_id A TABLAS EXISTENTES
-- =============================================

-- 2.1 Agregar columna congregacion_id a cada tabla de datos
-- Por ahora nullable para permitir migración gradual de datos existentes

ALTER TABLE public.participantes 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.programa_predicacion 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.territorios 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.puntos_encuentro 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.horarios_salida 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.grupos_predicacion 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.grupos_servicio 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.miembros_grupo 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.dias_especiales 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.mensajes_adicionales 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.configuracion_sistema 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.programas_publicados 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.disponibilidad_capitanes 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.asignaciones_capitan_fijas 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

ALTER TABLE public.manzanas_territorio 
ADD COLUMN congregacion_id UUID REFERENCES public.congregaciones(id);

-- 2.2 Crear índices para mejorar rendimiento de consultas por congregación
CREATE INDEX idx_participantes_congregacion ON public.participantes(congregacion_id);
CREATE INDEX idx_programa_predicacion_congregacion ON public.programa_predicacion(congregacion_id);
CREATE INDEX idx_territorios_congregacion ON public.territorios(congregacion_id);
CREATE INDEX idx_puntos_encuentro_congregacion ON public.puntos_encuentro(congregacion_id);
CREATE INDEX idx_horarios_salida_congregacion ON public.horarios_salida(congregacion_id);
CREATE INDEX idx_grupos_predicacion_congregacion ON public.grupos_predicacion(congregacion_id);
CREATE INDEX idx_grupos_servicio_congregacion ON public.grupos_servicio(congregacion_id);
CREATE INDEX idx_miembros_grupo_congregacion ON public.miembros_grupo(congregacion_id);
CREATE INDEX idx_dias_especiales_congregacion ON public.dias_especiales(congregacion_id);
CREATE INDEX idx_mensajes_adicionales_congregacion ON public.mensajes_adicionales(congregacion_id);
CREATE INDEX idx_configuracion_sistema_congregacion ON public.configuracion_sistema(congregacion_id);
CREATE INDEX idx_programas_publicados_congregacion ON public.programas_publicados(congregacion_id);
CREATE INDEX idx_disponibilidad_capitanes_congregacion ON public.disponibilidad_capitanes(congregacion_id);
CREATE INDEX idx_asignaciones_capitan_fijas_congregacion ON public.asignaciones_capitan_fijas(congregacion_id);
CREATE INDEX idx_manzanas_territorio_congregacion ON public.manzanas_territorio(congregacion_id);