import { createContext, useContext, ReactNode } from "react";
import { useAuth, AppRole, UserProfile, UserCongregacion } from "@/hooks/useAuth";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: UserProfile | null;
  roles: AppRole[];
  userCongregaciones: UserCongregacion[];
  signUp: (
    email: string,
    password: string,
    nombre: string,
    apellido: string
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  isEditor: () => boolean;
  isAdminOrEditor: () => boolean;
  isAprobado: () => boolean;
  isPendingApproval: () => boolean;
  getRoleInCongregacion: (congregacionId: string) => AppRole | null;
  isAdminOrEditorInCongregacion: (congregacionId: string) => boolean;
  getPrimaryCongregacionId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During HMR or initial render, context might be temporarily undefined
    // Return a loading state instead of throwing to prevent crashes
    return {
      user: null,
      session: null,
      loading: true,
      profile: null,
      roles: [] as AppRole[],
      userCongregaciones: [] as UserCongregacion[],
      signUp: async () => ({ error: new Error("Auth not ready") }),
      signIn: async () => ({ error: new Error("Auth not ready") }),
      signOut: async () => ({ error: new Error("Auth not ready") }),
      hasRole: () => false,
      isAdmin: () => false,
      isSuperAdmin: () => false,
      isEditor: () => false,
      isAdminOrEditor: () => false,
      isAprobado: () => false,
      isPendingApproval: () => false,
      getRoleInCongregacion: () => null,
      isAdminOrEditorInCongregacion: () => false,
      getPrimaryCongregacionId: () => null,
    } as AuthContextType;
  }
  return context;
}
