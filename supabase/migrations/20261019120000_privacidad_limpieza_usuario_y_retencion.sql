-- Protección de datos (Ley 21.719):
--  1) limpiar_datos_usuario: borra/anonimiza lo que queda de un usuario al eliminar su cuenta.
--  2) purgar_logs_antiguos: retención de 60 días para sesiones, presencia y auditoría.

CREATE OR REPLACE FUNCTION public.limpiar_datos_usuario(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Referencias que impedirían borrar al usuario: se desvinculan, el registro se conserva.
  UPDATE public.profiles SET aprobado_por = NULL WHERE aprobado_por = _user_id;
  UPDATE public.programas_publicados SET publicado_por = NULL WHERE publicado_por = _user_id;
  UPDATE public.programas_publicados SET cerrado_por = NULL WHERE cerrado_por = _user_id;
  UPDATE public.historial_participacion_vym SET created_by = NULL WHERE created_by = _user_id;

  -- Datos técnicos y de acceso del usuario: se eliminan.
  DELETE FROM public.historial_sesiones WHERE user_id = _user_id;
  DELETE FROM public.user_presence WHERE user_id = _user_id;
  DELETE FROM public.permisos_usuario_congregacion WHERE user_id = _user_id;
  DELETE FROM public.usuario_perfiles_asignados WHERE user_id = _user_id;
  DELETE FROM public.web_push_subscriptions WHERE user_id = _user_id;
  DELETE FROM public.device_tokens WHERE user_id = _user_id;
  DELETE FROM public.notificacion_preferencias WHERE user_id = _user_id;

  -- Auditoría: se conserva el hecho, se quita la identidad.
  UPDATE public.audit_log SET user_id = NULL, user_email = NULL WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.limpiar_datos_usuario(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.limpiar_datos_usuario(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.purgar_logs_antiguos(_dias integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_ses bigint; n_pres bigint; n_aud bigint;
BEGIN
  DELETE FROM public.historial_sesiones WHERE fecha_login < now() - make_interval(days => _dias);
  GET DIAGNOSTICS n_ses = ROW_COUNT;
  DELETE FROM public.user_presence WHERE last_seen < now() - make_interval(days => _dias);
  GET DIAGNOSTICS n_pres = ROW_COUNT;
  DELETE FROM public.audit_log WHERE created_at < now() - make_interval(days => _dias);
  GET DIAGNOSTICS n_aud = ROW_COUNT;
  RETURN jsonb_build_object('historial_sesiones', n_ses, 'user_presence', n_pres, 'audit_log', n_aud);
END;
$$;

REVOKE ALL ON FUNCTION public.purgar_logs_antiguos(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_logs_antiguos(integer) TO service_role;

-- Ejecución diaria 03:30 (Chile ~ 06:30 UTC)
SELECT cron.unschedule('purgar-logs-antiguos') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purgar-logs-antiguos');
SELECT cron.schedule('purgar-logs-antiguos', '30 6 * * *', $$SELECT public.purgar_logs_antiguos(60)$$);
