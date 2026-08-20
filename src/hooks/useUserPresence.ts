import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCongregacion } from '@/contexts/CongregacionContext';
import { useAuthContext } from '@/contexts/AuthProvider';
import { useLocation } from 'react-router-dom';

export interface UserPresence {
  id: string;
  user_id: string;
  congregacion_id: string | null;
  email: string;
  nombre_completo: string | null;
  last_seen: string;
  is_online: boolean;
  current_page: string | null;
}

export interface HistorialSesion {
  id: string;
  user_id: string;
  congregacion_id: string | null;
  email: string;
  nombre_completo: string | null;
  fecha_login: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface Congregacion {
  id: string;
  nombre: string;
}

/**
 * Registra presencia (online/offline, última vez visto, página actual) y
 * una entrada de historial de sesión al iniciar sesión. Se monta una sola
 * vez en AppLayout para que corra en toda la app, sin depender de que
 * alguien abra la pantalla de administración de sesiones.
 */
export function useUserPresenceTracker() {
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id;
  const { user, profile } = useAuthContext();
  const location = useLocation();
  const sesionRegistradaRef = useRef<string | null>(null);

  const updatePresence = useCallback(async () => {
    if (!user || !congregacionId) return;

    const nombreCompleto = profile
      ? `${profile.nombre || ''} ${profile.apellido || ''}`.trim()
      : user.email;

    const { error } = await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        congregacion_id: congregacionId,
        email: user.email || '',
        nombre_completo: nombreCompleto,
        last_seen: new Date().toISOString(),
        is_online: true,
        current_page: location.pathname
      }, {
        onConflict: 'user_id'
      });

    if (error) console.error('Error updating presence:', error);
  }, [user, congregacionId, profile, location.pathname]);

  const setOffline = useCallback(async () => {
    if (!user) return;

    await supabase
      .from('user_presence')
      .update({ is_online: false, last_seen: new Date().toISOString() })
      .eq('user_id', user.id);
  }, [user]);

  // Registrar la sesión una sola vez por login (no en cada cambio de página).
  useEffect(() => {
    if (!user || !congregacionId) return;
    if (sesionRegistradaRef.current === user.id) return;
    sesionRegistradaRef.current = user.id;

    const nombreCompleto = profile
      ? `${profile.nombre || ''} ${profile.apellido || ''}`.trim()
      : user.email;

    supabase
      .from('historial_sesiones')
      .insert({
        user_id: user.id,
        congregacion_id: congregacionId,
        email: user.email || '',
        nombre_completo: nombreCompleto,
        user_agent: navigator.userAgent
      })
      .then(({ error }) => {
        if (error) console.error('Error registrando sesión:', error);
      });
  }, [user, congregacionId, profile]);

  // Presencia periódica cada 30 segundos + al cambiar de página.
  useEffect(() => {
    if (!user || !congregacionId) return;

    updatePresence();

    const interval = setInterval(updatePresence, 30000);

    const handleBeforeUnload = () => {
      setOffline();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOffline();
    };
  }, [user, congregacionId, updatePresence, setOffline]);

  useEffect(() => {
    updatePresence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}

/**
 * Lee los usuarios conectados y el historial de sesiones. Solo trae datos
 * si el usuario actual es super_admin (protegido también por RLS).
 */
export function useUsuariosConectados() {
  const { isSuperAdmin } = useAuthContext();
  const queryClient = useQueryClient();
  const esSuperAdmin = isSuperAdmin();

  const { data: congregaciones = [] } = useQuery({
    queryKey: ['all-congregaciones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('congregaciones')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;
      return data as Congregacion[];
    },
    enabled: esSuperAdmin
  });

  const congregacionesMap = congregaciones.reduce((acc, c) => {
    acc[c.id] = c.nombre;
    return acc;
  }, {} as Record<string, string>);

  const { data: usuariosConectados = [], isLoading: loadingPresence } = useQuery({
    queryKey: ['user-presence-all'],
    queryFn: async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('is_online', true)
        .gte('last_seen', fiveMinutesAgo)
        .order('last_seen', { ascending: false });

      if (error) throw error;
      return data as UserPresence[];
    },
    enabled: esSuperAdmin,
    refetchInterval: 30000
  });

  const { data: historialSesiones = [], isLoading: loadingHistorial } = useQuery({
    queryKey: ['historial-sesiones-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historial_sesiones')
        .select('*')
        .order('fecha_login', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as HistorialSesion[];
    },
    enabled: esSuperAdmin
  });

  useEffect(() => {
    if (!esSuperAdmin) return;

    const channel = supabase
      .channel('user-presence-changes-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['user-presence-all'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [esSuperAdmin, queryClient]);

  return {
    usuariosConectados,
    historialSesiones,
    loadingPresence,
    loadingHistorial,
    congregacionesMap
  };
}
