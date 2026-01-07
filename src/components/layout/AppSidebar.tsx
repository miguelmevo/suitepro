import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
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
  PanelLeftClose,
  PanelLeft,
  Home,
  FileText,
  Building2,
  LucideIcon
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthContext } from "@/contexts/AuthContext";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  requiredRoles?: string[];
}

const predicacionItems: MenuItem[] = [
  { title: "Gestionar Programa", url: "/predicacion/programa", icon: Calendar },
  { title: "Puntos de Encuentro", url: "/predicacion/puntos", icon: MapPin },
  { title: "Territorios", url: "/predicacion/territorios", icon: Map },
  { title: "Historial", url: "/predicacion/historial", icon: History },
];

const configuracionItems: MenuItem[] = [
  { title: "Ajustes del Sistema", url: "/configuracion/ajustes", icon: SlidersHorizontal, requiredRoles: ["admin", "editor"] },
  { title: "Grupos de Predicación", url: "/configuracion/grupos-predicacion", icon: UsersRound, requiredRoles: ["admin", "editor"] },
  { title: "Participantes", url: "/configuracion/participantes", icon: Users, requiredRoles: ["admin", "editor"] },
  { title: "Usuarios", url: "/configuracion/usuarios", icon: UserCog, requiredRoles: ["admin"] },
];

const adminItems: MenuItem[] = [
  { title: "Congregaciones", url: "/admin/congregaciones", icon: Building2 },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { profile, roles, signOut, isAdminOrEditorInCongregacion, getRoleInCongregacion } = useAuthContext();
  const { configuraciones } = useConfiguracionSistema("general");
  const { congregacionActual } = useCongregacion();

  // Obtener nombre de congregación
  const nombreCongregacion = configuraciones?.find(
    (c) => c.programa_tipo === "general" && c.clave === "nombre_congregacion"
  )?.valor?.nombre || congregacionActual?.nombre || "SUITEPRO";

  // Verificar si el usuario es admin o editor en la congregación actual
  const congregacionId = congregacionActual?.id || "";
  const isSuperAdmin = roles.includes("super_admin");
  const isAdminOrEditor = isSuperAdmin || (congregacionId ? isAdminOrEditorInCongregacion(congregacionId) : false);
  const userRoleInCongregacion = isSuperAdmin ? "super_admin" : (congregacionId ? getRoleInCongregacion(congregacionId) : null);
  
  // Solo mostrar menú de Congregaciones para super_admin
  const mostrarMenuCongregaciones = isSuperAdmin;

  const isConfiguracionActive = currentPath.startsWith("/configuracion");
  const isPredicacionActive = currentPath.startsWith("/predicacion");

  const [predicacionOpen, setPredicacionOpen] = useState<boolean>(isPredicacionActive);
  const [configuracionOpen, setConfiguracionOpen] = useState<boolean>(isConfiguracionActive);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut();
    // No navigate() here: ProtectedRoute will redirect to /auth once user becomes null.
    setIsSigningOut(false);
  };

  // Filtrar items de configuración según rol en la congregación
  // super_admin tiene acceso a todo
  const visibleConfigItems = configuracionItems.filter(item => {
    if (isSuperAdmin) return true;
    if (!item.requiredRoles) return true;
    if (!userRoleInCongregacion) return false;
    return item.requiredRoles.includes(userRoleInCongregacion);
  });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center justify-between w-full">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={toggleSidebar}
                  className="flex items-center justify-center cursor-pointer"
                >
                  <CalendarDays className="h-5 w-5 text-sidebar-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Expandir menú
              </TooltipContent>
            </Tooltip>
          ) : (
            <NavLink to="/" className="flex items-center gap-2 font-bold text-lg min-w-0">
              <CalendarDays className="h-5 w-5 text-sidebar-foreground shrink-0" />
              <span className="font-display truncate text-sidebar-foreground">{nombreCongregacion}</span>
            </NavLink>
          )}
          {!collapsed && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={toggleSidebar}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Inicio - Visible para todos */}
        <SidebarGroup className="py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton asChild isActive={currentPath === "/"}>
                      <NavLink 
                        to="/" 
                        className="flex items-center gap-2"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <Home className="h-4 w-4" />
                      </NavLink>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Inicio
                  </TooltipContent>
                </Tooltip>
              ) : (
                <SidebarMenuButton asChild isActive={currentPath === "/"}>
                  <NavLink 
                    to="/" 
                    className="flex items-center gap-2"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                  >
                    <Home className="h-4 w-4" />
                    <span>Inicio</span>
                  </NavLink>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
            
            {/* Programas del Mes - Visible para todos */}
            <SidebarMenuItem>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton asChild isActive={currentPath === "/programas-del-mes"}>
                      <NavLink 
                        to="/programas-del-mes" 
                        className="flex items-center gap-2"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <FileText className="h-4 w-4" />
                      </NavLink>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Programas del Mes
                  </TooltipContent>
                </Tooltip>
              ) : (
                <SidebarMenuButton asChild isActive={currentPath === "/programas-del-mes"}>
                  <NavLink 
                    to="/programas-del-mes" 
                    className="flex items-center gap-2"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Programas del Mes</span>
                  </NavLink>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Predicación - Solo admin/editor */}
        {isAdminOrEditor && (
          <SidebarGroup className="py-1">
            {collapsed ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton 
                        isActive={isPredicacionActive}
                        className="cursor-pointer"
                        onClick={() => setPredicacionOpen(!predicacionOpen)}
                      >
                        <Megaphone className="h-4 w-4" />
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Predicación
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
                {predicacionOpen && predicacionItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild isActive={currentPath === item.url}>
                          <NavLink 
                            to={item.url} 
                            className="flex items-center justify-center"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                          >
                            <item.icon className="h-4 w-4" />
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <Collapsible open={predicacionOpen} onOpenChange={setPredicacionOpen}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4" />
                      <span>Predicación</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${predicacionOpen ? "rotate-180" : ""}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {predicacionItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={currentPath === item.url}>
                            <NavLink 
                              to={item.url} 
                              className="flex items-center gap-2"
                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        )}

        {/* Configuración - Solo mostrar si hay items visibles */}
        {visibleConfigItems.length > 0 && (
          <SidebarGroup className="py-1">
            {collapsed ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton 
                        isActive={isConfiguracionActive}
                        className="cursor-pointer"
                        onClick={() => setConfiguracionOpen(!configuracionOpen)}
                      >
                        <Settings className="h-4 w-4" />
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Configuración
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
                {configuracionOpen && visibleConfigItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild isActive={currentPath === item.url}>
                          <NavLink 
                            to={item.url} 
                            className="flex items-center justify-center"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                          >
                            <item.icon className="h-4 w-4" />
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <Collapsible open={configuracionOpen} onOpenChange={setConfiguracionOpen}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Configuración</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${configuracionOpen ? "rotate-180" : ""}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleConfigItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={currentPath === item.url}>
                            <NavLink 
                              to={item.url} 
                              className="flex items-center gap-2"
                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        )}

        {/* Administración - Congregaciones (solo para congregación principal) */}
        {mostrarMenuCongregaciones && (
          <SidebarGroup className="py-1">
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild isActive={currentPath === item.url}>
                          <NavLink 
                            to={item.url} 
                            className="flex items-center gap-2"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                          >
                            <item.icon className="h-4 w-4" />
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton asChild isActive={currentPath === item.url}>
                      <NavLink 
                        to={item.url} 
                        className="flex items-center gap-2"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && profile && (
          <div className="space-y-3">
            <div className="text-sm text-sidebar-foreground">
              <p className="font-medium truncate">
                {profile.nombre} {profile.apellido}
              </p>
              <p className="text-xs opacity-70 truncate">{profile.email}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-sidebar-foreground hover:bg-sidebar-accent border border-sidebar-border"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        )}
        {collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="w-full h-8 text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Cerrar Sesión
            </TooltipContent>
          </Tooltip>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
