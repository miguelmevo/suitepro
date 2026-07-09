
-- Function to check if current user is a captain in a congregation
CREATE OR REPLACE FUNCTION public.is_capitan_in_congregacion(_congregacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM participantes p
    JOIN usuarios_congregacion uc ON uc.participante_id = p.id
    WHERE uc.user_id = auth.uid()
      AND p.congregacion_id = _congregacion_id
      AND p.es_capitan_grupo = true
      AND p.activo = true
      AND uc.activo = true
  )
$$;

-- Table: ciclos_territorio (territory work cycles)
CREATE TABLE public.ciclos_territorio (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  territorio_id uuid NOT NULL REFERENCES public.territorios(id) ON DELETE CASCADE,
  congregacion_id uuid NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  ciclo_numero integer NOT NULL DEFAULT 1,
  fecha_inicio date NOT NULL,
  fecha_fin date,
  completado boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ciclos_territorio ENABLE ROW LEVEL SECURITY;

-- Unique constraint: one active (non-completed) cycle per territory
CREATE UNIQUE INDEX idx_ciclo_activo_unico 
ON public.ciclos_territorio (territorio_id) 
WHERE completado = false;

CREATE POLICY "Usuarios pueden ver ciclos de su congregación"
ON public.ciclos_territorio FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden gestionar ciclos"
ON public.ciclos_territorio FOR ALL
USING (is_admin_or_editor_in_congregacion(congregacion_id))
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Capitanes pueden crear ciclos en su congregación"
ON public.ciclos_territorio FOR INSERT
WITH CHECK (is_capitan_in_congregacion(congregacion_id));

-- Table: manzanas_trabajadas (worked blocks per cycle)
CREATE TABLE public.manzanas_trabajadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ciclo_id uuid NOT NULL REFERENCES public.ciclos_territorio(id) ON DELETE CASCADE,
  manzana_id uuid NOT NULL REFERENCES public.manzanas_territorio(id) ON DELETE CASCADE,
  territorio_id uuid NOT NULL REFERENCES public.territorios(id) ON DELETE CASCADE,
  congregacion_id uuid NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  fecha_trabajada date NOT NULL DEFAULT CURRENT_DATE,
  marcado_por uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.manzanas_trabajadas ENABLE ROW LEVEL SECURITY;

-- Prevent marking same block twice in same cycle
CREATE UNIQUE INDEX idx_manzana_ciclo_unico 
ON public.manzanas_trabajadas (manzana_id, ciclo_id);

CREATE POLICY "Usuarios pueden ver manzanas trabajadas de su congregación"
ON public.manzanas_trabajadas FOR SELECT
USING (user_has_access_to_congregacion(congregacion_id));

CREATE POLICY "Admin y Editor pueden gestionar manzanas trabajadas"
ON public.manzanas_trabajadas FOR ALL
USING (is_admin_or_editor_in_congregacion(congregacion_id))
WITH CHECK (is_admin_or_editor_in_congregacion(congregacion_id));

CREATE POLICY "Capitanes pueden registrar manzanas trabajadas"
ON public.manzanas_trabajadas FOR INSERT
WITH CHECK (
  is_capitan_in_congregacion(congregacion_id) 
  AND marcado_por = auth.uid()
);

CREATE POLICY "Capitanes pueden eliminar sus propios registros"
ON public.manzanas_trabajadas FOR DELETE
USING (
  marcado_por = auth.uid() 
  AND is_capitan_in_congregacion(congregacion_id)
);

-- Function to get or create active cycle for a territory
CREATE OR REPLACE FUNCTION public.get_or_create_ciclo_activo(_territorio_id uuid, _congregacion_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _ciclo_id uuid;
  _next_numero integer;
BEGIN
  -- Try to find existing active cycle
  SELECT id INTO _ciclo_id
  FROM ciclos_territorio
  WHERE territorio_id = _territorio_id
    AND completado = false;
  
  IF _ciclo_id IS NOT NULL THEN
    RETURN _ciclo_id;
  END IF;
  
  -- Get next cycle number
  SELECT COALESCE(MAX(ciclo_numero), 0) + 1 INTO _next_numero
  FROM ciclos_territorio
  WHERE territorio_id = _territorio_id;
  
  -- Create new cycle
  INSERT INTO ciclos_territorio (territorio_id, congregacion_id, ciclo_numero, fecha_inicio)
  VALUES (_territorio_id, _congregacion_id, _next_numero, CURRENT_DATE)
  RETURNING id INTO _ciclo_id;
  
  RETURN _ciclo_id;
END;
$$;

-- Function to mark a block as worked and auto-complete cycle if all done
CREATE OR REPLACE FUNCTION public.marcar_manzana_trabajada(
  _territorio_id uuid,
  _congregacion_id uuid,
  _manzana_id uuid,
  _fecha_trabajada date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _ciclo_id uuid;
  _total_manzanas integer;
  _trabajadas integer;
  _ciclo_completado boolean := false;
BEGIN
  -- Verify caller is a captain
  IF NOT is_capitan_in_congregacion(_congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized_captain';
  END IF;

  -- Get or create active cycle
  _ciclo_id := get_or_create_ciclo_activo(_territorio_id, _congregacion_id);
  
  -- Insert worked block
  INSERT INTO manzanas_trabajadas (ciclo_id, manzana_id, territorio_id, congregacion_id, fecha_trabajada, marcado_por)
  VALUES (_ciclo_id, _manzana_id, _territorio_id, _congregacion_id, _fecha_trabajada, auth.uid())
  ON CONFLICT (manzana_id, ciclo_id) DO NOTHING;
  
  -- Count total active blocks for this territory
  SELECT COUNT(*) INTO _total_manzanas
  FROM manzanas_territorio
  WHERE territorio_id = _territorio_id
    AND congregacion_id = _congregacion_id
    AND activo = true;
  
  -- Count worked blocks in this cycle
  SELECT COUNT(*) INTO _trabajadas
  FROM manzanas_trabajadas
  WHERE ciclo_id = _ciclo_id;
  
  -- Auto-complete cycle if all blocks are done
  IF _trabajadas >= _total_manzanas AND _total_manzanas > 0 THEN
    UPDATE ciclos_territorio
    SET completado = true,
        fecha_fin = _fecha_trabajada
    WHERE id = _ciclo_id;
    _ciclo_completado := true;
  END IF;
  
  RETURN jsonb_build_object(
    'ciclo_id', _ciclo_id,
    'total_manzanas', _total_manzanas,
    'trabajadas', _trabajadas,
    'ciclo_completado', _ciclo_completado
  );
END;
$$;

-- Function to unmark a block (undo)
CREATE OR REPLACE FUNCTION public.desmarcar_manzana_trabajada(
  _manzana_trabajada_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _congregacion_id uuid;
  _ciclo_completado boolean;
BEGIN
  -- Get the congregation and check cycle status
  SELECT mt.congregacion_id, ct.completado 
  INTO _congregacion_id, _ciclo_completado
  FROM manzanas_trabajadas mt
  JOIN ciclos_territorio ct ON ct.id = mt.ciclo_id
  WHERE mt.id = _manzana_trabajada_id;
  
  IF _congregacion_id IS NULL THEN
    RAISE EXCEPTION 'record_not_found';
  END IF;
  
  -- Only captain or admin can undo
  IF NOT (is_capitan_in_congregacion(_congregacion_id) OR is_admin_or_editor_in_congregacion(_congregacion_id)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  
  -- Don't allow unmarking on completed cycles
  IF _ciclo_completado THEN
    RAISE EXCEPTION 'cycle_already_completed';
  END IF;
  
  DELETE FROM manzanas_trabajadas WHERE id = _manzana_trabajada_id;
END;
$$;
