-- Log de auditoría genérico: quién cambió qué, en qué tabla, y con qué
-- valores antes/después. Se llena solo, vía un trigger genérico aplicado a
-- las tablas de contenido relevantes (no a tablas de sesión/caché/log que
-- ya son historial en sí mismas).

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id uuid,
  operacion text not null,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  campos_modificados text[],
  user_id uuid,
  user_email text,
  congregacion_id uuid,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tabla ON public.audit_log(tabla);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON public.audit_log(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at desc);
CREATE INDEX IF NOT EXISTS idx_audit_log_congregacion ON public.audit_log(congregacion_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin puede ver el log de auditoría"
ON public.audit_log
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Sin políticas de insert/update/delete para roles normales: el trigger
-- (SECURITY DEFINER) es el único que escribe acá.

CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
  v_congregacion uuid;
  v_campos text[];
  v_email text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  BEGIN
    v_id := COALESCE(v_new->>'id', v_old->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_id := NULL;
  END;

  BEGIN
    v_congregacion := COALESCE(v_new->>'congregacion_id', v_old->>'congregacion_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_congregacion := NULL;
  END;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(n.key) INTO v_campos
    FROM jsonb_each(v_new) n
    WHERE n.value IS DISTINCT FROM (v_old -> n.key);
  END IF;

  v_email := NULLIF(current_setting('request.jwt.claim.email', true), '');

  BEGIN
    INSERT INTO public.audit_log (
      tabla, registro_id, operacion, datos_anteriores, datos_nuevos,
      campos_modificados, user_id, user_email, congregacion_id
    ) VALUES (
      TG_TABLE_NAME, v_id, TG_OP, v_old, v_new,
      v_campos, auth.uid(), v_email, v_congregacion
    );
  EXCEPTION WHEN OTHERS THEN
    -- Nunca dejar que un fallo del log bloquee la operación real.
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'asignaciones_capitan_fijas','asignaciones_servicio_dias_especiales','carritos',
    'ciclos_territorio','conductores_atalaya','configuracion_sistema','congregaciones',
    'dias_especiales','direcciones_bloqueadas','disponibilidad_capitanes',
    'grupos_predicacion','grupos_predicacion_ficticios','grupos_servicio',
    'horarios_salida','indisponibilidad_participantes','manzanas_territorio',
    'manzanas_trabajadas','mensajes_adicionales','miembros_grupo','participantes',
    'perfiles_permisos','permisos_usuario_congregacion','plantillas_vida_ministerio_oficial',
    'profiles','programa_asignaciones_servicio','programa_predicacion',
    'programa_reunion_publica','programa_vida_ministerio','programas_publicados',
    'puntos_encuentro','reunion_publica_dias_especiales','territorios',
    'territorios_grupos_predicacion','tipos_programa','user_roles',
    'usuario_perfiles_asignados','usuarios_congregacion'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log()',
      t
    );
  END LOOP;
END $$;
