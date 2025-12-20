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
  Home
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthContext } from "@/contexts/AuthContext";
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

const predicacionItems = [
  { title: "Gestionar Programa de Predi", url: "/predicacion/programa", icon: Calendar },
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

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { profile, roles, signOut } = useAuthContext();

  // Verificar si el usuario es admin o editor
  const isAdminOrEditor = roles.includes("admin") || roles.includes("editor");

  const isConfiguracionActive = currentPath.startsWith("/configuracion");
  const isPredicacionActive = currentPath.startsWith("/predicacion");

  const [predicacionOpen, setPredicacionOpen] = useState<boolean>(isPredicacionActive);
  const [configuracionOpen, setConfiguracionOpen] = useState<boolean>(isConfiguracionActive);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  // Filtrar items de configuración según roles
  const visibleConfigItems = configuracionItems.filter(item => {
    if (!item.requiredRoles) return true;
    return item.requiredRoles.some(role => roles.includes(role as "admin" | "editor" | "user"));
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
              <span className="font-display truncate text-sidebar-foreground">SUITEPRO</span>
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

      <SidebarContent>
        {/* Inicio - Visible para todos */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={currentPath === "/"}>
                <NavLink 
                  to="/" 
                  className="flex items-center gap-2"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  <Home className="h-4 w-4" />
                  {!collapsed && <span>Inicio</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>


        {/* Predicación - Solo admin/editor */}
        {isAdminOrEditor && (
          <SidebarGroup>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton 
                    onClick={toggleSidebar}
                    isActive={isPredicacionActive}
                    className="cursor-pointer"
                  >
                    <Megaphone className="h-4 w-4" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Predicación
                </TooltipContent>
              </Tooltip>
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
          <SidebarGroup>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton 
                    onClick={toggleSidebar}
                    isActive={isConfiguracionActive}
                    className="cursor-pointer"
                  >
                    <Settings className="h-4 w-4" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Configuración
                </TooltipContent>
              </Tooltip>
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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && profile && (
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-medium truncate">
                {profile.nombre} {profile.apellido}
              </p>
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            </div>
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
        )}
        {collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="w-full h-8"
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
