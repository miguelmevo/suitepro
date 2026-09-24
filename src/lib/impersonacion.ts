import { useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "suitepro-impersonacion";

export interface EstadoImpersonacion {
  adminAccessToken: string;
  adminRefreshToken: string;
  nombre: string;
  /** Página desde la que se entró, para volver ahí. */
  volverA?: string;
}

export function leerImpersonacion(): EstadoImpersonacion | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EstadoImpersonacion) : null;
  } catch {
    return null;
  }
}

/** true mientras un administrador está viendo la app como otro usuario. */
export function estaImpersonando(): boolean {
  return leerImpersonacion() !== null;
}

// La sesión cambia con una recarga completa, así que basta leer al montar.
export function useImpersonacion(): EstadoImpersonacion | null {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
  );
  return useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as EstadoImpersonacion) : null;
    } catch {
      return null;
    }
  }, [raw]);
}

/** Entra como otro usuario, guardando antes la sesión del administrador. */
export async function iniciarImpersonacion(params: { targetUserId: string; congregacionId: string; nombre: string }) {
  const { data: sesion } = await supabase.auth.getSession();
  if (!sesion.session) throw new Error("Sesión no válida");

  const { data, error } = await supabase.functions.invoke("impersonar-usuario", {
    body: { targetUserId: params.targetUserId, congregacionId: params.congregacionId },
  });
  if (error || data?.error || !data?.tokenHash) {
    const mensajes: Record<string, string> = {
      target_is_admin: "No se puede entrar como un administrador",
      target_is_super_admin: "No se puede entrar como este usuario",
      target_inactive: "El usuario está inactivo",
      target_not_approved: "El usuario aún no está aprobado",
      not_authorized: "No tienes permiso para hacer esto",
    };
    throw new Error(mensajes[data?.error as string] ?? "No se pudo entrar como este usuario");
  }

  const previo: EstadoImpersonacion = {
    adminAccessToken: sesion.session.access_token,
    adminRefreshToken: sesion.session.refresh_token,
    nombre: params.nombre,
    volverA: window.location.pathname + window.location.search,
  };
  localStorage.setItem(KEY, JSON.stringify(previo));

  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: "magiclink" });
  if (otpError) {
    localStorage.removeItem(KEY);
    throw new Error("No se pudo entrar como este usuario");
  }
  window.location.assign("/");
}

/** Vuelve a la sesión del administrador. */
export async function volverAMiCuenta() {
  const previo = leerImpersonacion();
  localStorage.removeItem(KEY);
  if (previo) {
    const { error } = await supabase.auth.setSession({
      access_token: previo.adminAccessToken,
      refresh_token: previo.adminRefreshToken,
    });
    if (error) await supabase.auth.signOut();
  }
  window.location.assign(previo?.volverA || "/");
}
