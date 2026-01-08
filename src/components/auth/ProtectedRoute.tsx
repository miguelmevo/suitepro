import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
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

  useEffect(() => {
    // Si existe sesión pero no existe profile, es una cuenta inconsistente (ej: borrado parcial).
    // Cerramos sesión para evitar loops y para forzar re-registro.
    if (!loading && user && !profile) {
      setIsRepairing(true);
      void signOut().finally(() => setIsRepairing(false));
    }
  }, [loading, user, profile, signOut]);

  if (loading || isRepairing) {
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
