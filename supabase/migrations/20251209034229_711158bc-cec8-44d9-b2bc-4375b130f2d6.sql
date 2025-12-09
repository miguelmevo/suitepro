-- Tabla de puntos de encuentro
CREATE TABLE public.puntos_encuentro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  url_maps TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de territorios
CREATE TABLE public.territorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL,
  nombre TEXT,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de horarios de salida configurables
CREATE TABLE public.horarios_salida (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hora TIME NOT NULL,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla principal del programa de predicación
CREATE TABLE public.programa_predicacion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  horario_id UUID REFERENCES public.horarios_salida(id) ON DELETE SET NULL,
  punto_encuentro_id UUID REFERENCES public.puntos_encuentro(id) ON DELETE SET NULL,
  territorio_id UUID REFERENCES public.territorios(id) ON DELETE SET NULL,
  capitan_id UUID REFERENCES public.participantes(id) ON DELETE SET NULL,
  es_mensaje_especial BOOLEAN NOT NULL DEFAULT false,
  mensaje_especial TEXT,
  colspan_completo BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fecha, horario_id)
);

-- Triggers para updated_at
CREATE TRIGGER update_puntos_encuentro_updated_at
  BEFORE UPDATE ON public.puntos_encuentro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_territorios_updated_at
  BEFORE UPDATE ON public.territorios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_programa_predicacion_updated_at
  BEFORE UPDATE ON public.programa_predicacion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.puntos_encuentro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_salida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programa_predicacion ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acceso público por ahora)
CREATE POLICY "Acceso público puntos_encuentro" ON public.puntos_encuentro FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso público territorios" ON public.territorios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso público horarios_salida" ON public.horarios_salida FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso público programa_predicacion" ON public.programa_predicacion FOR ALL USING (true) WITH CHECK (true);

-- Insertar horarios por defecto
INSERT INTO public.horarios_salida (hora, nombre, orden) VALUES 
  ('09:30', 'Mañana', 1),
  ('18:30', 'Tarde', 2);