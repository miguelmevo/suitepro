
-- 1. Add 'genero' column to participantes
ALTER TABLE public.participantes 
ADD COLUMN genero text CHECK (genero IN ('M', 'F'));

-- 2. Create programa_vida_ministerio table
CREATE TABLE public.programa_vida_ministerio (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  congregacion_id uuid NOT NULL,
  fecha_semana date NOT NULL,
  presidente_id uuid,
  cantico_inicial smallint CHECK (cantico_inicial BETWEEN 1 AND 200),
  cantico_intermedio smallint CHECK (cantico_intermedio BETWEEN 1 AND 200),
  cantico_final smallint CHECK (cantico_final BETWEEN 1 AND 200),
  oracion_inicial_id uuid,
  oracion_final_id uuid,
  salas_auxiliares_override smallint CHECK (salas_auxiliares_override IN (0, 1, 2)),
  -- Tesoros de la Biblia
  tesoros jsonb NOT NULL DEFAULT '{"titulo": "", "participante_id": null}'::jsonb,
  perlas_id uuid,
  lectura_biblica jsonb NOT NULL DEFAULT '{"cita": "", "participante_id": null}'::jsonb,
  -- Seamos Mejores Maestros (1-4 discursos)
  maestros jsonb NOT NULL DEFAULT '[]'::jsonb,
  encargado_sala_b_id uuid,
  encargado_sala_c_id uuid,
  -- Nuestra Vida Cristiana (1-3 partes)
  vida_cristiana jsonb NOT NULL DEFAULT '[]'::jsonb,
  estudio_biblico jsonb NOT NULL DEFAULT '{"titulo": "", "conductor_id": null, "lector_id": null}'::jsonb,
  -- Meta
  notas text,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'completo')),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (congregacion_id, fecha_semana)
);

-- 3. Enable RLS
ALTER TABLE public.programa_vida_ministerio ENABLE ROW LEVEL SECURITY;

-- 4. Create helper function to check edit permission for VyM
CREATE OR REPLACE FUNCTION public.can_edit_vida_ministerio(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_congregacion 
    WHERE user_id = auth.uid() 
      AND congregacion_id = _congregacion_id 
      AND rol IN ('admin', 'editor', 'super_admin', 'svministerio')
      AND activo = true
  )
  OR is_super_admin(auth.uid())
$$;

-- 5. RLS policies
CREATE POLICY "Usuarios pueden ver programa VyM de su congregación"
ON public.programa_vida_ministerio FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin/Editor/SVMinisterio pueden crear programa VyM"
ON public.programa_vida_ministerio FOR INSERT
WITH CHECK (can_edit_vida_ministerio(congregacion_id));

CREATE POLICY "Admin/Editor/SVMinisterio pueden actualizar programa VyM"
ON public.programa_vida_ministerio FOR UPDATE
USING (can_edit_vida_ministerio(congregacion_id));

CREATE POLICY "Admin/Editor/SVMinisterio pueden eliminar programa VyM"
ON public.programa_vida_ministerio FOR DELETE
USING (can_edit_vida_ministerio(congregacion_id));

-- 6. Trigger to update updated_at
CREATE TRIGGER update_programa_vida_ministerio_updated_at
BEFORE UPDATE ON public.programa_vida_ministerio
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Update get_participantes_seguros functions to include genero
DROP FUNCTION IF EXISTS public.get_participantes_seguros();
DROP FUNCTION IF EXISTS public.get_participantes_seguros(uuid);

CREATE OR REPLACE FUNCTION public.get_participantes_seguros(_congregacion_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  id uuid, nombre text, apellido text, telefono text, estado_aprobado boolean,
  responsabilidad text[], responsabilidad_adicional text, grupo_predicacion_id uuid,
  restriccion_disponibilidad text, es_capitan_grupo boolean, es_publicador_inactivo boolean,
  activo boolean, created_at timestamptz, updated_at timestamptz, user_id uuid, genero text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    p.id, p.nombre, p.apellido,
    CASE 
      WHEN is_admin_or_editor_in_congregacion(p.congregacion_id) THEN p.telefono
      ELSE NULL
    END as telefono,
    p.estado_aprobado, p.responsabilidad, p.responsabilidad_adicional, p.grupo_predicacion_id,
    p.restriccion_disponibilidad, p.es_capitan_grupo, p.es_publicador_inactivo,
    p.activo, p.created_at, p.updated_at, p.user_id, p.genero
  FROM public.participantes p
  WHERE p.congregacion_id = COALESCE(_congregacion_id, get_user_congregacion_id())
$$;
