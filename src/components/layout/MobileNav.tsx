import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Menu, 
  X,
  Megaphone, 
  Calendar, 
  MapPin, 
  Map, 
  History, 
  Settings, 
  Users,
  UsersRound,
  UserCog,
  SlidersHorizontal,
  ChevronDown,
  LogOut,
  CalendarDays,
  Home,
  FileText
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MobileNavProps {
  nombreCongregacion?: string;
}

const predicacionItems = [
  { title: "Gestionar Programa", url: "/predicacion/programa", icon: Calendar },
  { title: "Puntos de Encuentro", url: "/predicacion/puntos", icon: MapPin },
  { title: "Territorios", url: "/predicacion/territorios", icon: Map },
  { title: "Historial", url: "/predicacion/historial", icon: History },
];

const configuracionItems = [
  { title: "Ajustes del Sistema", url: "/configuracion/ajustes", icon: SlidersHorizontal, requiredRoles: ["admin", "editor"] },
  { title: "Grupos de Predicación", url: "/configuracion/grupos-predicacion", icon: UsersRound, requiredRoles: ["admin", "editor"] },
  { title: "Participantes", url: "/configuracion/participantes", icon: Users, requiredRoles: ["admin", "editor"] },
  { title: "Usuarios", url: "/configuracion/usuarios", icon: UserCog, requiredRoles: ["admin"] },
];

export function MobileNav({ nombreCongregacion }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { profile, signOut, isAdminOrEditorInCongregacion, getRoleInCongregacion } = useAuthContext();
  const { congregacionActual } = useCongregacion();

  // Verificar rol en la congregación actual
  const congregacionId = congregacionActual?.id || "";
  const isAdminOrEditor = congregacionId ? isAdminOrEditorInCongregacion(congregacionId) : false;
  const userRoleInCongregacion = congregacionId ? getRoleInCongregacion(congregacionId) : null;

  const isConfiguracionActive = currentPath.startsWith("/configuracion");
  const isPredicacionActive = currentPath.startsWith("/predicacion");

  const [predicacionOpen, setPredicacionOpen] = useState<boolean>(isPredicacionActive);
  const [configuracionOpen, setConfiguracionOpen] = useState<boolean>(isConfiguracionActive);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut();
    setOpen(false);
    // No navigate() here: ProtectedRoute will redirect to /auth once user becomes null.
    setIsSigningOut(false);
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    setOpen(false);
  };

  // Filtrar items de configuración según rol en la congregación
  const visibleConfigItems = configuracionItems.filter(item => {
    if (!item.requiredRoles) return true;
    if (!userRoleInCongregacion) return false;
    return item.requiredRoles.includes(userRoleInCongregacion);
  });

  return (
    <header className="h-14 flex items-center justify-between border-b bg-background px-4 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <span className="font-display font-bold text-primary">
          {nombreCongregacion || "SUITEPRO"}
        </span>
      </div>
      
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px] p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2 text-left">
              <CalendarDays className="h-5 w-5 text-primary" />
              <span>{nombreCongregacion || "SUITEPRO"}</span>
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col h-[calc(100vh-80px)]">
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {/* Inicio */}
              <button
                onClick={() => handleNavigate("/")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  currentPath === "/" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Inicio</span>
              </button>
              
              {/* Programas del Mes */}
              <button
                onClick={() => handleNavigate("/programas-del-mes")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  currentPath === "/programas-del-mes" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Programas del Mes</span>
              </button>

              {/* Predicación - Solo admin/editor */}
              {isAdminOrEditor && (
                <Collapsible open={predicacionOpen} onOpenChange={setPredicacionOpen}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-muted">
                    <div className="flex items-center gap-3">
                      <Megaphone className="h-4 w-4" />
                      <span>Predicación</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${predicacionOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 space-y-1 mt-1">
                    {predicacionItems.map((item) => (
                      <button
                        key={item.title}
                        onClick={() => handleNavigate(item.url)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          currentPath === item.url ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Configuración */}
              {visibleConfigItems.length > 0 && (
                <Collapsible open={configuracionOpen} onOpenChange={setConfiguracionOpen}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-muted">
                    <div className="flex items-center gap-3">
                      <Settings className="h-4 w-4" />
                      <span>Configuración</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${configuracionOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 space-y-1 mt-1">
                    {visibleConfigItems.map((item) => (
                      <button
                        key={item.title}
                        onClick={() => handleNavigate(item.url)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          currentPath === item.url ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </nav>

            {/* Footer con usuario */}
            <div className="border-t p-4 space-y-3">
              {profile && (
                <div className="text-sm">
                  <p className="font-medium truncate">
                    {profile.nombre} {profile.apellido}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}