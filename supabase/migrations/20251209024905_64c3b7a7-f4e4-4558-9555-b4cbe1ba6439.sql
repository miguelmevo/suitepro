-- Tabla de participantes (publicadores)
CREATE TABLE public.participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de grupos de servicio
CREATE TABLE public.grupos_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de miembros de grupo (relación muchos a muchos)
CREATE TABLE public.miembros_grupo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE CASCADE,
  grupo_id UUID NOT NULL REFERENCES public.grupos_servicio(id) ON DELETE CASCADE,
  es_capitan BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(participante_id, grupo_id)
);

-- Habilitar RLS
ALTER TABLE public.participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros_grupo ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para lectura (sin autenticación requerida)
CREATE POLICY "Cualquiera puede ver participantes" ON public.participantes FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede ver grupos" ON public.grupos_servicio FOR SELECT USING (true);
CREATE POLICY "Cualquiera puede ver miembros" ON public.miembros_grupo FOR SELECT USING (true);

-- Políticas públicas para escritura (para MVP sin auth)
CREATE POLICY "Cualquiera puede crear participantes" ON public.participantes FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar participantes" ON public.participantes FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar participantes" ON public.participantes FOR DELETE USING (true);

CREATE POLICY "Cualquiera puede crear grupos" ON public.grupos_servicio FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar grupos" ON public.grupos_servicio FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar grupos" ON public.grupos_servicio FOR DELETE USING (true);

CREATE POLICY "Cualquiera puede crear miembros" ON public.miembros_grupo FOR INSERT WITH CHECK (true);
CREATE POLICY "Cualquiera puede actualizar miembros" ON public.miembros_grupo FOR UPDATE USING (true);
CREATE POLICY "Cualquiera puede eliminar miembros" ON public.miembros_grupo FOR DELETE USING (true);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_participantes_updated_at
  BEFORE UPDATE ON public.participantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grupos_servicio_updated_at
  BEFORE UPDATE ON public.grupos_servicio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();