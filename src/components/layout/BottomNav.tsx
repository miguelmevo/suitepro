import { Home, FileText, Map, UserCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";
import { useAuthContext } from "@/contexts/AuthProvider";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  label: string;
  icon: typeof Home;
  path: string;
  matchPrefix?: string;
}

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { user } = useAuthContext();

  // Visibilidad: siempre en móvil; en tablet/desktop solo si NO está logueado
  const shouldShow = isMobile || (!user && (isTablet || !isMobile));
  if (!shouldShow) return null;

  // Cuenta: si está logueado → Mi Cuenta; si no → Auth
  const cuentaPath = user ? "/configuracion/mi-cuenta" : "/auth";

  const items: BottomNavItem[] = [
    { label: "Inicio", icon: Home, path: "/" },
    { label: "Programas", icon: FileText, path: "/programas-del-mes" },
    { label: "Territorios", icon: Map, path: "/territorios", matchPrefix: "/territorio" },
    { label: "Cuenta", icon: UserCircle, path: cuentaPath },
  ];

  const isActive = (item: BottomNavItem) => {
    if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true;
    return pathname === item.path;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <li key={item.label} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full h-16 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className={cn(active && "font-semibold")}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
