import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCongregacion } from '@/contexts/CongregacionContext';
import { useAuthContext } from '@/contexts/AuthProvider';
import { useLocation } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Canal único de Supabase Realtime: cada usuario logueado hace "track" de sí
// mismo acá (websocket, sin polling); quien escuche el canal (la pantalla de
// administración) recibe join/leave al instante.
const PRESENCE_CHANNEL = 'app-presencia';

export interface PresenceEntry {
  user_id: string;
  email: string;
  nombre_completo: string | null;
  congregacion_id: string | null;
  current_page: string;
  online_at: string;
}

export interface HistorialSesion {
  id: string;
  user_id: string;
  congregacion_id: string | null;
  email: string;
  nombre_completo: string | null;
  fecha_login: string;
  fecha_logout: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

interface Congregacion {
  id: string;
  nombre: string;
}

/**
 * Se une al canal de presencia (para que la pantalla de administración lo
 * vea "en línea" al instante) y registra el login/logout en el historial de
 * sesiones. Se monta una sola vez en AppLayout para correr en toda la app.
 */
export function useUserPresenceTracker() {
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id;
  const { user, profile } = useAuthContext();
  const location = useLocation();
  const sesionRegistradaRef = useRef<string | null>(null);
  const sesionIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listoRef = useRef(false);

  const nombreCompleto = profile
    ? `${profile.nombre || ''} ${profile.apellido || ''}`.trim()
    : user?.email;

  // Registrar el login una sola vez, guardando el id de la fila: al cerrar
  // la pestaña (beforeunload) o cuando el canal detecta el "leave", se le
  // pone fecha_logout como respaldo de cierre (uno cubre al otro si falla).
  useEffect(() => {
    if (!user || !congregacionId) return;
    if (sesionRegistradaRef.current === user.id) return;
    sesionRegistradaRef.current = user.id;

    supabase
      .from('historial_sesiones')
      .insert({
        user_id: user.id,
        congregacion_id: congregacionId,
        email: user.email || '',
        nombre_completo: nombreCompleto,
        user_agent: navigator.userAgent,
      })
      .select('id')
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Error registrando sesión:', error);
        else sesionIdRef.current = data?.id ?? null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, congregacionId]);

  // Presencia en vivo: un solo canal, sin intervalos ni polling.
  useEffect(() => {
    if (!user || !congregacionId) return;

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        listoRef.current = true;
        await channel.track({
          user_id: user.id,
          email: user.email || '',
          nombre_completo: nombreCompleto,
          congregacion_id: congregacionId,
          current_page: location.pathname,
          online_at: new Date().toISOString(),
        } satisfies PresenceEntry);
      }
    });

    const registrarSalida = () => {
      const sesionId = sesionIdRef.current;
      if (!sesionId) return;
      supabase
        .from('historial_sesiones')
        .update({ fecha_logout: new Date().toISOString() })
        .eq('id', sesionId)
        .then(() => {});
    };

    window.addEventListener('beforeunload', registrarSalida);

    return () => {
      window.removeEventListener('beforeunload', registrarSalida);
      registrarSalida();
      listoRef.current = false;
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, congregacionId]);

  // Actualiza la página actual en el presence payload al navegar.
  useEffect(() => {
    if (!listoRef.current || !channelRef.current || !user || !congregacionId) return;
    channelRef.current.track({
      user_id: user.id,
      email: user.email || '',
      nombre_completo: nombreCompleto,
      congregacion_id: congregacionId,
      current_page: location.pathname,
      online_at: new Date().toISOString(),
    } satisfies PresenceEntry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}

/**
 * Escucha el mismo canal de presencia (sin polling) para la pantalla de
 * administración, y lee el historial de sesiones. Solo trae datos si el
 * usuario actual es super_admin (protegido también por RLS).
 */
export function useUsuariosConectados() {
  const { isSuperAdmin } = useAuthContext();
  const esSuperAdmin = isSuperAdmin();
  const [usuariosConectados, setUsuariosConectados] = useState<PresenceEntry[]>([]);

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

  useEffect(() => {
    if (!esSuperAdmin) return;

    const channel = supabase.channel(PRESENCE_CHANNEL, { config: { presence: {} } });

    const sincronizar = () => {
      const state = channel.presenceState<PresenceEntry>();
      setUsuariosConectados(Object.values(state).flat());
    };

    channel
      .on('presence', { event: 'sync' }, sincronizar)
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // Respaldo: si alguien se desconecta mientras esta pantalla está
        // abierta, se le cierra el historial acá también (por si su propio
        // beforeunload no llegó a dispararse, ej. se le cerró el navegador).
        (leftPresences as unknown as PresenceEntry[]).forEach((p) => {
          supabase
            .from('historial_sesiones')
            .update({ fecha_logout: new Date().toISOString() })
            .eq('user_id', p.user_id)
            .is('fecha_logout', null)
            .then(() => {});
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [esSuperAdmin]);

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

  return {
    usuariosConectados,
    historialSesiones,
    loadingHistorial,
    congregacionesMap
  };
}
