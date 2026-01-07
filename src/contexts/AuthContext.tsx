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
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
