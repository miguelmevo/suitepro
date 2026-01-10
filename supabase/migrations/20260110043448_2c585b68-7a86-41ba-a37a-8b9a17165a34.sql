-- Crear tabla para direcciones bloqueadas (No pasar)
CREATE TABLE public.direcciones_bloqueadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  territorio_id UUID NOT NULL REFERENCES public.territorios(id) ON DELETE CASCADE,
  congregacion_id UUID NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  direccion TEXT NOT NULL,
  motivo TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para búsquedas por territorio
CREATE INDEX idx_direcciones_bloqueadas_territorio ON public.direcciones_bloqueadas(territorio_id) WHERE activo = true;

-- Habilitar RLS
ALTER TABLE public.direcciones_bloqueadas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios autenticados pueden ver direcciones bloqueadas de su congregación"
ON public.direcciones_bloqueadas FOR SELECT
USING (
  user_has_access_to_congregacion(congregacion_id)
);

CREATE POLICY "Admin/Editor pueden insertar direcciones bloqueadas"
ON public.direcciones_bloqueadas FOR INSERT
WITH CHECK (
  is_admin_or_editor_in_congregacion(congregacion_id)
);

CREATE POLICY "Admin/Editor pueden actualizar direcciones bloqueadas"
ON public.direcciones_bloqueadas FOR UPDATE
USING (
  is_admin_or_editor_in_congregacion(congregacion_id)
);

CREATE POLICY "Admin/Editor pueden eliminar direcciones bloqueadas"
ON public.direcciones_bloqueadas FOR DELETE
USING (
  is_admin_or_editor_in_congregacion(congregacion_id)
);

-- Trigger para updated_at
CREATE TRIGGER update_direcciones_bloqueadas_updated_at
BEFORE UPDATE ON public.direcciones_bloqueadas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();