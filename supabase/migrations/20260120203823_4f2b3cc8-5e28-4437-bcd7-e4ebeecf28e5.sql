-- =============================================
-- MÓDULO REUNIÓN PÚBLICA - Esquema de Base de Datos
-- =============================================

-- Tabla: programa_reunion_publica
-- Almacena las asignaciones semanales de la reunión pública
CREATE TABLE public.programa_reunion_publica (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    congregacion_id UUID NOT NULL,
    fecha DATE NOT NULL,
    -- Asignaciones (referencias a participantes)
    presidente_id UUID REFERENCES public.participantes(id) ON DELETE SET NULL,
    orador_id UUID REFERENCES public.participantes(id) ON DELETE SET NULL,
    orador_suplente_id UUID REFERENCES public.participantes(id) ON DELETE SET NULL,
    orador_saliente_id UUID REFERENCES public.participantes(id) ON DELETE SET NULL,
    conductor_atalaya_id UUID REFERENCES public.participantes(id) ON DELETE SET NULL,
    lector_atalaya_id UUID REFERENCES public.participantes(id) ON DELETE SET NULL,
    -- Campos adicionales para el tema/discurso
    tema_discurso TEXT,
    notas TEXT,
    -- Metadata
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- Constraint único por fecha y congregación
    UNIQUE(congregacion_id, fecha)
);

-- Tabla: conductores_atalaya
-- Los 3 ancianos configurados para ser conductores de La Atalaya
CREATE TABLE public.conductores_atalaya (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    congregacion_id UUID NOT NULL,
    participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    -- Máximo 3 por congregación (se controla en la aplicación)
    UNIQUE(congregacion_id, participante_id)
);

-- Tabla: lectores_atalaya_elegibles
-- Participantes habilitados para ser lectores de La Atalaya
CREATE TABLE public.lectores_atalaya_elegibles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    congregacion_id UUID NOT NULL,
    participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(congregacion_id, participante_id)
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.programa_reunion_publica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conductores_atalaya ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectores_atalaya_elegibles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS RLS - programa_reunion_publica
-- =============================================
CREATE POLICY "Usuarios pueden ver programa de su congregación"
ON public.programa_reunion_publica
FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear programa en su congregación"
ON public.programa_reunion_publica
FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar programa de su congregación"
ON public.programa_reunion_publica
FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar programa de su congregación"
ON public.programa_reunion_publica
FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- =============================================
-- POLÍTICAS RLS - conductores_atalaya
-- =============================================
CREATE POLICY "Usuarios pueden ver conductores de su congregación"
ON public.conductores_atalaya
FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear conductores en su congregación"
ON public.conductores_atalaya
FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar conductores de su congregación"
ON public.conductores_atalaya
FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar conductores de su congregación"
ON public.conductores_atalaya
FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- =============================================
-- POLÍTICAS RLS - lectores_atalaya_elegibles
-- =============================================
CREATE POLICY "Usuarios pueden ver lectores elegibles de su congregación"
ON public.lectores_atalaya_elegibles
FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden crear lectores elegibles en su congregación"
ON public.lectores_atalaya_elegibles
FOR INSERT
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden actualizar lectores elegibles de su congregación"
ON public.lectores_atalaya_elegibles
FOR UPDATE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden eliminar lectores elegibles de su congregación"
ON public.lectores_atalaya_elegibles
FOR DELETE
USING (is_admin_or_editor_in_congregacion(congregacion_id));

-- =============================================
-- TRIGGER para updated_at
-- =============================================
CREATE TRIGGER update_programa_reunion_publica_updated_at
BEFORE UPDATE ON public.programa_reunion_publica
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();