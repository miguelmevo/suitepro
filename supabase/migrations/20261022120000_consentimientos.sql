-- Registro de consentimiento de tratamiento de datos (Ley 21.719)
CREATE TABLE IF NOT EXISTS public.consentimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  congregacion_id uuid NOT NULL REFERENCES public.congregaciones(id) ON DELETE CASCADE,
  version text NOT NULL,
  aceptado_at timestamptz NOT NULL DEFAULT now(),
  revocado_at timestamptz,
  UNIQUE (user_id, congregacion_id, version)
);

ALTER TABLE public.consentimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consentimientos_propios" ON public.consentimientos
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "consentimientos_admin_congregacion" ON public.consentimientos
  FOR SELECT TO authenticated USING (public.is_admin_in_congregacion(congregacion_id));

CREATE OR REPLACE FUNCTION public.registrar_consentimiento(_congregacion_id uuid, _version text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.user_has_access_to_congregacion(_congregacion_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  INSERT INTO public.consentimientos (user_id, congregacion_id, version)
  VALUES (auth.uid(), _congregacion_id, _version)
  ON CONFLICT (user_id, congregacion_id, version)
  DO UPDATE SET aceptado_at = now(), revocado_at = NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.revocar_consentimiento(_congregacion_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.consentimientos SET revocado_at = now()
  WHERE user_id = auth.uid() AND congregacion_id = _congregacion_id AND revocado_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_consentimiento(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revocar_consentimiento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_consentimiento(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revocar_consentimiento(uuid) TO authenticated;

-- Al eliminar la cuenta, la tabla se limpia sola (ON DELETE CASCADE).
