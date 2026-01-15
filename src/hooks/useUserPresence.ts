import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCongregacion } from '@/contexts/CongregacionContext';
import { useAuthContext } from '@/contexts/AuthProvider';
import { useLocation } from 'react-router-dom';

interface UserPresence {
  id: string;
  user_id: string;
  congregacion_id: string | null;
  email: string;
  nombre_completo: string | null;
  last_seen: string;
  is_online: boolean;
  current_page: string | null;
}

interface HistorialSesion {
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

export function useUserPresence() {
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id;
  const { user, profile, isSuperAdmin } = useAuthContext();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Actualizar presencia
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

  // Marcar como offline
  const setOffline = useCallback(async () => {
    if (!user) return;

    await supabase
      .from('user_presence')
      .update({ is_online: false, last_seen: new Date().toISOString() })
      .eq('user_id', user.id);
  }, [user]);

  // Registrar sesión al login
  const registrarSesion = useCallback(async () => {
    if (!user || !congregacionId) return;

    const nombreCompleto = profile 
      ? `${profile.nombre || ''} ${profile.apellido || ''}`.trim() 
      : user.email;

    await supabase
      .from('historial_sesiones')
      .insert({
        user_id: user.id,
        congregacion_id: congregacionId,
        email: user.email || '',
        nombre_completo: nombreCompleto,
        user_agent: navigator.userAgent
      });
  }, [user, congregacionId, profile]);

  // Efecto para actualizar presencia periódicamente
  useEffect(() => {
    if (!user || !congregacionId) return;

    // Actualizar inmediatamente
    updatePresence();

    // Actualizar cada 30 segundos
    const interval = setInterval(updatePresence, 30000);

    // Cleanup: marcar offline al salir
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

  // Actualizar cuando cambia la página
  useEffect(() => {
    updatePresence();
  }, [location.pathname, updatePresence]);

  // Query para obtener todas las congregaciones (solo para super_admin)
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
    enabled: isSuperAdmin()
  });

  // Crear mapa de congregaciones para lookup rápido
  const congregacionesMap = congregaciones.reduce((acc, c) => {
    acc[c.id] = c.nombre;
    return acc;
  }, {} as Record<string, string>);

  // Query para usuarios conectados (super_admin ve TODAS las congregaciones)
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
    enabled: isSuperAdmin(),
    refetchInterval: 30000
  });

  // Query para historial de sesiones (super_admin ve TODAS)
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
    enabled: isSuperAdmin()
  });

  // Suscripción realtime para presencia
  useEffect(() => {
    if (!isSuperAdmin()) return;

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
  }, [isSuperAdmin, queryClient]);

  return {
    usuariosConectados,
    historialSesiones,
    loadingPresence,
    loadingHistorial,
    registrarSesion,
    updatePresence,
    congregacionesMap
  };
}
