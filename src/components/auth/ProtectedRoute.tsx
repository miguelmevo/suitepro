import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useAuthContext } from "@/contexts/AuthProvider";
import { AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import PendingApproval from "@/pages/PendingApproval";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, loading, roles, isPendingApproval, profile, signOut } = useAuthContext();
  const location = useLocation();
  const [isRepairing, setIsRepairing] = useState(false);
  // Evitar cerrar sesión mientras el profile aún se está cargando
  const profileCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profileCheckDone, setProfileCheckDone] = useState(false);

  useEffect(() => {
    // Limpiar timer si hay profile o si no hay user
    if (profile || !user || loading) {
      if (profileCheckTimer.current) {
        clearTimeout(profileCheckTimer.current);
        profileCheckTimer.current = null;
      }
      setProfileCheckDone(false);
      return;
    }

    // Si hay user pero no profile, esperar un poco para dar tiempo a fetchUserData
    if (!profileCheckTimer.current) {
      profileCheckTimer.current = setTimeout(() => {
        setProfileCheckDone(true);
      }, 2000); // Esperar 2 segundos antes de declarar cuenta inconsistente
    }

    return () => {
      if (profileCheckTimer.current) {
        clearTimeout(profileCheckTimer.current);
        profileCheckTimer.current = null;
      }
    };
  }, [loading, user, profile]);

  useEffect(() => {
    // Solo cerrar sesión si realmente no hay profile después de esperar
    if (profileCheckDone && user && !profile && !loading && !isRepairing) {
      setIsRepairing(true);
      void signOut().finally(() => setIsRepairing(false));
    }
  }, [profileCheckDone, user, profile, loading, isRepairing, signOut]);

  if (loading || isRepairing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mientras esperamos la verificación del profile, mostrar loading
  if (user && !profile && !profileCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const params = new URLSearchParams(location.search);
    const slug = params.get("slug");
    const tenantSearch = slug ? `?slug=${encodeURIComponent(slug)}` : "";

    return <Navigate to={`/auth${tenantSearch}`} state={{ from: location }} replace />;
  }

  // Si el usuario no está aprobado, mostrar página de espera
  if (isPendingApproval()) {
    return <PendingApproval />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) => roles.includes(role));
    if (!hasRequiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
