-- Agregar columna para marcar programas como cerrados
ALTER TABLE programas_publicados ADD COLUMN IF NOT EXISTS cerrado boolean NOT NULL DEFAULT false;
ALTER TABLE programas_publicados ADD COLUMN IF NOT EXISTS cerrado_por uuid REFERENCES auth.users(id);
ALTER TABLE programas_publicados ADD COLUMN IF NOT EXISTS fecha_cierre timestamp with time zone;

-- Función para verificar si un programa está cerrado para un mes específico
CREATE OR REPLACE FUNCTION public.programa_mes_cerrado(
  _congregacion_id uuid,
  _tipo_programa text,
  _fecha_inicio date,
  _fecha_fin date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM programas_publicados
    WHERE congregacion_id = _congregacion_id
      AND tipo_programa = _tipo_programa
      AND fecha_inicio = _fecha_inicio
      AND fecha_fin = _fecha_fin
      AND cerrado = true
      AND activo = true
  )
$$;

-- Función para cerrar un programa (solo admin/editor)
CREATE OR REPLACE FUNCTION public.cerrar_programa(
  _programa_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE programas_publicados
  SET cerrado = true,
      cerrado_por = auth.uid(),
      fecha_cierre = now()
  WHERE id = _programa_id;
END;
$$;

-- Función para reabrir un programa (solo super_admin)
CREATE OR REPLACE FUNCTION public.reabrir_programa(
  _programa_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo super_admin puede reabrir programas cerrados';
  END IF;
  
  UPDATE programas_publicados
  SET cerrado = false,
      cerrado_por = NULL,
      fecha_cierre = NULL
  WHERE id = _programa_id;
END;
$$;