-- Control de gasto: límite de usos de IA (asignación automática VyM u otros
-- programas que en el futuro usen la API de Anthropic) por congregación y mes.
CREATE TABLE IF NOT EXISTS public.ia_uso_mensual (
  congregacion_id uuid NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  periodo text NOT NULL, -- 'YYYY-MM'
  usos integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (congregacion_id, periodo)
);

ALTER TABLE public.ia_uso_mensual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros de la congregación pueden ver su uso de IA" ON public.ia_uso_mensual;
CREATE POLICY "Miembros de la congregación pueden ver su uso de IA"
ON public.ia_uso_mensual
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios_congregacion uc
    WHERE uc.user_id = auth.uid()
      AND uc.congregacion_id = ia_uso_mensual.congregacion_id
      AND uc.activo = true
  )
);

-- Incremento atómico con tope: si ya se alcanzó el límite, no incrementa y
-- devuelve NULL (evita condiciones de carrera entre solicitudes simultáneas).
CREATE OR REPLACE FUNCTION public.incrementar_ia_uso_mensual(
  _congregacion_id uuid,
  _periodo text,
  _limite integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nuevo_valor integer;
BEGIN
  INSERT INTO public.ia_uso_mensual (congregacion_id, periodo, usos)
  VALUES (_congregacion_id, _periodo, 1)
  ON CONFLICT (congregacion_id, periodo)
  DO UPDATE SET usos = ia_uso_mensual.usos + 1, updated_at = now()
  WHERE ia_uso_mensual.usos < _limite
  RETURNING usos INTO nuevo_valor;

  RETURN nuevo_valor;
END;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_ia_uso_mensual(uuid, text, integer) TO authenticated, service_role;
