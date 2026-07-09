-- Crear función RPC pública para obtener detalle de territorio sin autenticación
CREATE OR REPLACE FUNCTION public.get_territorio_publico(_territorio_id uuid)
RETURNS TABLE(
  id uuid,
  numero text,
  nombre text,
  imagen_url text,
  url_maps text,
  congregacion_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    t.id,
    t.numero,
    t.nombre,
    t.imagen_url,
    t.url_maps,
    t.congregacion_id
  FROM public.territorios t
  WHERE t.id = _territorio_id
    AND t.activo = true;
$$;

-- Crear función RPC pública para obtener direcciones bloqueadas
CREATE OR REPLACE FUNCTION public.get_direcciones_bloqueadas_publico(_territorio_id uuid)
RETURNS TABLE(
  id uuid,
  direccion text,
  motivo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    db.id,
    db.direccion,
    db.motivo
  FROM public.direcciones_bloqueadas db
  WHERE db.territorio_id = _territorio_id
    AND db.activo = true
  ORDER BY db.direccion;
$$;

-- Crear función RPC pública para obtener manzanas del territorio
CREATE OR REPLACE FUNCTION public.get_manzanas_territorio_publico(_territorio_id uuid)
RETURNS TABLE(
  id uuid,
  letra text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    m.id,
    m.letra
  FROM public.manzanas_territorio m
  WHERE m.territorio_id = _territorio_id
    AND m.activo = true
  ORDER BY m.letra;
$$;

-- Crear función RPC pública para obtener link de registro de manzanas
CREATE OR REPLACE FUNCTION public.get_link_registro_manzanas(_congregacion_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT (cs.valor->>'url')::text
  FROM public.configuracion_sistema cs
  WHERE cs.congregacion_id = _congregacion_id
    AND cs.programa_tipo = 'predicacion'
    AND cs.clave = 'link_registro_manzanas'
  LIMIT 1;
$$;