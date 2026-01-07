import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AppRole = "admin" | "editor" | "user" | "super_admin";

export interface UserProfile {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  aprobado: boolean;
  fecha_aprobacion: string | null;
  aprobado_por: string | null;
}

export interface UserCongregacion {
  congregacion_id: string;
  rol: AppRole;
  es_principal: boolean;
  activo: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userCongregaciones, setUserCongregaciones] = useState<UserCongregacion[]>([]);
  const { toast } = useToast();

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch roles from user_roles (legacy)
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      // Fetch roles from usuarios_congregacion (multi-tenant)
      const { data: congregacionData } = await supabase
        .from("usuarios_congregacion")
        .select("congregacion_id, rol, es_principal, activo")
        .eq("user_id", userId)
        .eq("activo", true);

      // Combine roles from both sources
      const allRoles: AppRole[] = [];
      
      if (rolesData) {
        rolesData.forEach((r) => allRoles.push(r.role as AppRole));
      }
      
      if (congregacionData) {
        setUserCongregaciones(congregacionData);
        congregacionData.forEach((c) => {
          if (!allRoles.includes(c.rol)) {
            allRoles.push(c.rol);
          }
        });
      }
      
      setRoles(allRoles);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setUserCongregaciones([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signUp = async (
    email: string,
    password: string,
    nombre: string,
    apellido: string
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nombre,
          apellido,
        },
      },
    });

    if (error) {
      let message = error.message;
      if (error.message.includes("already registered")) {
        message = "Este correo ya está registrado. Intenta iniciar sesión.";
      }
      toast({
        title: "Error al registrarse",
        description: message,
        variant: "destructive",
      });
      return { error };
    }

    // Notify admins about new user registration
    try {
      await supabase.functions.invoke("notify-admin-new-user", {
        body: {
          userId: email, // We don't have the user ID yet, but we can use email
          userEmail: email,
          userName: nombre,
          userApellido: apellido,
        },
      });
    } catch (notifyError) {
      console.error("Error notifying admins:", notifyError);
      // Don't fail the signup if notification fails
    }

    toast({
      title: "Registro exitoso",
      description: "Tu cuenta ha sido creada. Un administrador debe aprobar tu acceso.",
    });
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      let message = error.message;
      if (error.message.includes("Invalid login credentials")) {
        message = "Correo o contraseña incorrectos.";
      }
      toast({
        title: "Error al iniciar sesión",
        description: message,
        variant: "destructive",
      });
      return { error };
    }

    toast({
      title: "Bienvenido",
      description: "Has iniciado sesión correctamente.",
    });
    return { error: null };
  };

  const signOut = async () => {
    // Always clear local state, even if server signOut fails
    // (session might already be expired/invalid on server)
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setUserCongregaciones([]);

    const { error } = await supabase.auth.signOut();
    
    // Ignore "session_not_found" errors - session was already invalid
    if (error && !error.message.includes("session") && !error.message.includes("Auth session missing")) {
      toast({
        title: "Error al cerrar sesión",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
    
    return { error: null };
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = () => hasRole("admin") || hasRole("super_admin");
  const isSuperAdmin = () => hasRole("super_admin");
  const isEditor = () => hasRole("editor");
  const isAdminOrEditor = () => isAdmin() || isEditor();
  const isAprobado = () => profile?.aprobado === true;
  const isPendingApproval = () => user !== null && !profile?.aprobado;

  // Get role for a specific congregation
  const getRoleInCongregacion = (congregacionId: string): AppRole | null => {
    const congregacion = userCongregaciones.find(c => c.congregacion_id === congregacionId);
    return congregacion?.rol || null;
  };

  // Check if user is admin or editor in a specific congregation (super_admin also counts)
  const isAdminOrEditorInCongregacion = (congregacionId: string): boolean => {
    if (hasRole("super_admin")) return true;
    const rol = getRoleInCongregacion(congregacionId);
    return rol === "admin" || rol === "editor";
  };

  // Get user's primary congregation
  const getPrimaryCongregacionId = (): string | null => {
    const primary = userCongregaciones.find(c => c.es_principal);
    return primary?.congregacion_id || userCongregaciones[0]?.congregacion_id || null;
  };

  return {
    user,
    session,
    loading,
    profile,
    roles,
    userCongregaciones,
    signUp,
    signIn,
    signOut,
    hasRole,
    isAdmin,
    isSuperAdmin,
    isEditor,
    isAdminOrEditor,
    isAprobado,
    isPendingApproval,
    getRoleInCongregacion,
    isAdminOrEditorInCongregacion,
    getPrimaryCongregacionId,
  };
}
