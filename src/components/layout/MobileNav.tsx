import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Menu, 
  LogOut,
  CalendarDays,
  Home,
  FileText,
  Map,
  ArrowLeft,
  Megaphone,
  Calendar,
  MapPin,
  History,
  Settings,
  Users,
  UsersRound,
  UserCog,
  SlidersHorizontal,
  ChevronDown,
  BookOpen,
  BookUser,
  Building2,
  CalendarOff,
  UserCircle
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";
import { Button } from "@/components/ui/button";
import { useFontSize } from "@/hooks/useFontSize";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileNavProps {
  nombreCongregacion?: string;
}

export function MobileNav({ nombreCongregacion }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { label: fontLabel, cycle: cycleFontSize } = useFontSize();
  const [predicacionOpen, setPredicacionOpen] = useState(false);
  const [reunionOpen, setReunionOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { profile, signOut, roles, getRoleInCongregacion } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  
  const congregacionId = congregacionActual?.id || "";
  const isSuperAdmin = roles.includes("super_admin");
  const userRole = isSuperAdmin ? "super_admin" : (congregacionId ? getRoleInCongregacion(congregacionId) : null);
  
  // Permission checks
  const canViewPrograms = isSuperAdmin || userRole === "admin" || userRole === "editor" || userRole === "viewer";
  const canViewConfig = isSuperAdmin || userRole === "admin" || userRole === "editor" || userRole === "viewer";
  const canViewUsuarios = isSuperAdmin || userRole === "admin";
  const canViewTerritories = canViewPrograms;
  const canViewCongregaciones = isSuperAdmin;

  // Show back button logic
  const showBackButton = (() => {
    if (isMobile) {
      // Mobile: only on Territorios (if has access) and Programas del Mes
      if (currentPath === "/programas-del-mes") return true;
      if (currentPath === "/predicacion/territorios" && canViewTerritories) return true;
      return false;
    }
    if (isTablet) {
      if (currentPath === "/programas-del-mes") return true;
      if (currentPath === "/predicacion/territorios" && canViewTerritories) return true;
      return false;
    }
    return false;
  })();

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut();
    setOpen(false);
    setIsSigningOut(false);
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    setOpen(false);
  };

  const navButtonClass = (path: string) =>
    `w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      currentPath === path ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
    }`;

  const subNavButtonClass = (path: string) =>
    `w-full flex items-center gap-3 px-3 py-2 pl-8 rounded-md text-sm transition-colors ${
      currentPath === path ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
    }`;

  // Determine if we show expanded menus (tablet always, mobile only for privileged roles)
  const showFullMenus = isTablet && canViewPrograms;

  return (
    <header className="h-14 flex items-center justify-between border-b bg-background px-4 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -ml-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <CalendarDays className="h-5 w-5 text-primary" />
        <span className="font-display font-bold text-primary">
          {nombreCongregacion || "SUITEPRO"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-bold text-muted-foreground"
          onClick={cycleFontSize}
          title="Cambiar tamaño de letra"
        >
          {fontLabel}
        </Button>
        
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
              {/* Inicio - always visible */}
              <button onClick={() => handleNavigate("/")} className={navButtonClass("/")}>
                <Home className="h-4 w-4" />
                <span>Inicio</span>
              </button>
              
              {/* Programas del Mes - always visible */}
              <button onClick={() => handleNavigate("/programas-del-mes")} className={navButtonClass("/programas-del-mes")}>
                <FileText className="h-4 w-4" />
                <span>Programas del Mes</span>
              </button>

              {/* Mobile-only: simple Territorios link */}
              {isMobile && canViewTerritories && (
                <button onClick={() => handleNavigate("/predicacion/territorios")} className={navButtonClass("/predicacion/territorios")}>
                  <Map className="h-4 w-4" />
                  <span>Territorios</span>
                </button>
              )}

              {/* Tablet: full menu hierarchy */}
              {showFullMenus && (
                <>
                  {/* Predicación */}
                  <div>
                    <button
                      onClick={() => setPredicacionOpen(!predicacionOpen)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                        currentPath.startsWith("/predicacion") ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Megaphone className="h-4 w-4" />
                        <span>Predicación</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${predicacionOpen ? "rotate-180" : ""}`} />
                    </button>
                    {predicacionOpen && (
                      <div className="space-y-0.5 mt-0.5">
                        <button onClick={() => handleNavigate("/predicacion/programa")} className={subNavButtonClass("/predicacion/programa")}>
                          <Calendar className="h-4 w-4" />
                          <span>Gestionar Programa</span>
                        </button>
                        <button onClick={() => handleNavigate("/predicacion/puntos")} className={subNavButtonClass("/predicacion/puntos")}>
                          <MapPin className="h-4 w-4" />
                          <span>Puntos de Encuentro</span>
                        </button>
                        <button onClick={() => handleNavigate("/predicacion/territorios")} className={subNavButtonClass("/predicacion/territorios")}>
                          <Map className="h-4 w-4" />
                          <span>Territorios</span>
                        </button>
                        <button onClick={() => handleNavigate("/predicacion/carritos")} className={subNavButtonClass("/predicacion/carritos")}>
                          <ShoppingCart className="h-4 w-4" />
                          <span>Carritos</span>
                        </button>
                        <button onClick={() => handleNavigate("/predicacion/historial")} className={subNavButtonClass("/predicacion/historial")}>
                          <History className="h-4 w-4" />
                          <span>Historial</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Reunión Pública */}
                  <div>
                    <button
                      onClick={() => setReunionOpen(!reunionOpen)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                        currentPath.startsWith("/reunion-publica") ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-4 w-4" />
                        <span>Reunión Pública</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${reunionOpen ? "rotate-180" : ""}`} />
                    </button>
                    {reunionOpen && (
                      <div className="space-y-0.5 mt-0.5">
                        <button onClick={() => handleNavigate("/reunion-publica/programa")} className={subNavButtonClass("/reunion-publica/programa")}>
                          <Calendar className="h-4 w-4" />
                          <span>Programa Mensual</span>
                        </button>
                        <button onClick={() => handleNavigate("/reunion-publica/lectores")} className={subNavButtonClass("/reunion-publica/lectores")}>
                          <BookUser className="h-4 w-4" />
                          <span>Lectores de Atalaya</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Configuración */}
                  {canViewConfig && (
                    <div>
                      <button
                        onClick={() => setConfigOpen(!configOpen)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                          currentPath.startsWith("/configuracion") ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Settings className="h-4 w-4" />
                          <span>Configuración</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${configOpen ? "rotate-180" : ""}`} />
                      </button>
                      {configOpen && (
                        <div className="space-y-0.5 mt-0.5">
                          <button onClick={() => handleNavigate("/configuracion/ajustes")} className={subNavButtonClass("/configuracion/ajustes")}>
                            <SlidersHorizontal className="h-4 w-4" />
                            <span>Ajustes del Sistema</span>
                          </button>
                          <button onClick={() => handleNavigate("/configuracion/grupos-predicacion")} className={subNavButtonClass("/configuracion/grupos-predicacion")}>
                            <UsersRound className="h-4 w-4" />
                            <span>Grupos de Predicación</span>
                          </button>
                          <button onClick={() => handleNavigate("/configuracion/participantes")} className={subNavButtonClass("/configuracion/participantes")}>
                            <Users className="h-4 w-4" />
                            <span>Participantes</span>
                          </button>
                          <button onClick={() => handleNavigate("/configuracion/indisponibilidad")} className={subNavButtonClass("/configuracion/indisponibilidad")}>
                            <CalendarOff className="h-4 w-4" />
                            <span>Indisponibilidad</span>
                          </button>
                          {canViewUsuarios && (
                            <button onClick={() => handleNavigate("/configuracion/usuarios")} className={subNavButtonClass("/configuracion/usuarios")}>
                              <UserCog className="h-4 w-4" />
                              <span>Usuarios</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Congregaciones - super_admin only */}
                  {canViewCongregaciones && (
                    <button onClick={() => handleNavigate("/admin/congregaciones")} className={navButtonClass("/admin/congregaciones")}>
                      <Building2 className="h-4 w-4" />
                      <span>Congregaciones</span>
                    </button>
                  )}
                </>
              )}
            </nav>

            <div className="border-t p-4 space-y-3">
              {profile && (
                <div className="text-sm">
                  <p className="font-medium truncate">
                    {profile.nombre} {profile.apellido}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleNavigate("/configuracion/mi-cuenta")}
                >
                  <UserCircle className="h-4 w-4 mr-2" />
                  Mi Cuenta
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </header>
  );
}
