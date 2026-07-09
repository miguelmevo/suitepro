-- Crear tabla para configuración general del sistema
CREATE TABLE public.configuracion_sistema (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programa_tipo text NOT NULL,
  clave text NOT NULL,
  valor jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(programa_tipo, clave)
);

-- Habilitar RLS
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;

-- Política de acceso público (solo lectura para todos, escritura para admin/editor)
CREATE POLICY "Cualquiera puede ver configuracion" 
ON public.configuracion_sistema 
FOR SELECT 
USING (true);

CREATE POLICY "Admin y Editor pueden modificar configuracion" 
ON public.configuracion_sistema 
FOR ALL 
USING (is_admin_or_editor(auth.uid()))
WITH CHECK (is_admin_or_editor(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_configuracion_sistema_updated_at
BEFORE UPDATE ON public.configuracion_sistema
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar configuraciones por defecto
INSERT INTO public.configuracion_sistema (programa_tipo, clave, valor) VALUES
('predicacion', 'numero_grupos', '{"cantidad": 10}'),
('predicacion', 'dias_reunion', '{"dia_entre_semana": "martes", "dia_fin_semana": "domingo"}'),
('asignaciones', 'dias_reunion', '{"dia_entre_semana": "martes", "dia_fin_semana": "domingo"}'),
('asignaciones', 'validacion_consecutiva', '{"habilitado": true}'),
('asignaciones', 'nota_asignaciones', '{"mostrar": true, "texto": "NOTA: Le recordamos que en caso que no pueda cumplir con su asignación, pueda buscar un reemplazo buscando en el programa algún hermano que esté asignado en su mismo privilegio o haga un cambio de fecha con algún hermano asignado en su mismo privilegio. (1 Cor. 14:33)"}');