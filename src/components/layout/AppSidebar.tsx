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
  LucideIcon,
  UserCircle,
  CalendarOff,
  BookOpen,
  BookUser,
  ShoppingCart,
  ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthContext } from "@/contexts/AuthProvider";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { usePermisos } from "@/hooks/usePermisos";
import type { ModuloPermiso } from "@/lib/permisos";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  modulo: ModuloPermiso;
}

const predicacionItems: MenuItem[] = [
  { title: "Gestionar Programa", url: "/predicacion/programa", icon: Calendar, modulo: "predicacion_programa" },
  { title: "Puntos de Encuentro", url: "/predicacion/puntos", icon: MapPin, modulo: "predicacion_puntos" },
  
  { title: "Carritos", url: "/predicacion/carritos", icon: ShoppingCart, modulo: "predicacion_carritos" },
  { title: "Territorios", url: "/predicacion/territorios", icon: Map, modulo: "predicacion_territorios" },
  { title: "Historial", url: "/predicacion/historial", icon: History, modulo: "predicacion_historial" },
];

const reunionPublicaItems: MenuItem[] = [
  { title: "Programa Mensual", url: "/reunion-publica/programa", icon: Calendar, modulo: "reunion_publica_programa" },
  { title: "Lectores de Atalaya", url: "/reunion-publica/lectores", icon: BookUser, modulo: "reunion_publica_lectores" },
];

const AJUSTES_MODULES: ModuloPermiso[] = [
  "ajustes_general",
  "ajustes_asignaciones",
  "ajustes_vida_ministerio",
  "ajustes_reunion_publica",
  "ajustes_predicacion",
  "ajustes_carritos",
];

const configuracionItems: MenuItem[] = [
  { title: "Ajustes del Sistema", url: "/configuracion/ajustes", icon: SlidersHorizontal, modulo: "ajustes_general" },
  { title: "Grupos de Predicación", url: "/configuracion/grupos-predicacion", icon: UsersRound, modulo: "configuracion_grupos" },
  { title: "Participantes", url: "/configuracion/participantes", icon: Users, modulo: "configuracion_participantes" },
  { title: "Indisponibilidad", url: "/configuracion/indisponibilidad", icon: CalendarOff, modulo: "configuracion_dias_especiales" },
  { title: "Usuarios", url: "/configuracion/usuarios", icon: UserCog, modulo: "configuracion_usuarios" },
];

const adminItems = [
  { title: "Congregaciones", url: "/admin/congregaciones", icon: Building2 },
];


export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { profile, roles, signOut } = useAuthContext();
  const { configuraciones } = useConfiguracionSistema("general");
  const { congregacionActual, resetearSeleccion } = useCongregacion();
  const { canView } = usePermisos();

  // Obtener nombre de congregación
  const nombreCongregacion =
    configuraciones?.find((c) => c.programa_tipo === "general" && c.clave === "nombre_congregacion")?.valor?.nombre ||
    congregacionActual?.nombre ||
    "SUITEPRO";

  const isSuperAdmin = roles.includes("super_admin");

  const visiblePredicacionItems = predicacionItems.filter((i) => canView(i.modulo));
  const visibleReunionPublicaItems = reunionPublicaItems.filter((i) => canView(i.modulo));
  const visibleConfigItems = configuracionItems.filter((i) =>
    i.url === "/configuracion/ajustes"
      ? AJUSTES_MODULES.some((m) => canView(m))
      : canView(i.modulo)
  );

  const canViewPredicacion = visiblePredicacionItems.length > 0;
  const canViewReunionPublica = visibleReunionPublicaItems.length > 0;
  const canViewVidaMinisterio = canView("vym_programa") || canView("vym_historial") || canView("vym_lectores_ebc");
  const canViewAsignacionesServicio = canView("asignaciones_servicio");

  // Solo mostrar menú de Congregaciones para super_admin
  const mostrarMenuCongregaciones = isSuperAdmin;

  const isConfiguracionActive = currentPath.startsWith("/configuracion");
  const isPredicacionActive = currentPath.startsWith("/predicacion");
  const isReunionPublicaActive = currentPath.startsWith("/reunion-publica");
  const showPlantillasVym = isSuperAdmin && profile?.email === "miguelmevo@gmail.com";
  const vymMenuItems: MenuItem[] = [
    ...(canView("vym_programa") ? [{ title: "Programa Semanal", url: "/vida-y-ministerio", icon: Calendar, modulo: "vym_programa" as ModuloPermiso }] : []),
    ...(canView("vym_historial") ? [{ title: "Historial", url: "/vida-y-ministerio/historial", icon: History, modulo: "vym_historial" as ModuloPermiso }] : []),
    ...(canView("vym_lectores_ebc") ? [{ title: "Lectores EBC", url: "/vida-y-ministerio-lectores-ebc", icon: BookUser, modulo: "vym_lectores_ebc" as ModuloPermiso }] : []),
    ...(showPlantillasVym ? [{ title: "Plantillas VyM", url: "/admin/plantillas-vym", icon: BookOpen, modulo: "vym_programa" as ModuloPermiso }] : []),
  ];
  const isVidaMinisterioActive =
    currentPath.startsWith("/vida-y-ministerio") || currentPath.startsWith("/admin/plantillas-vym");

  const [predicacionOpen, setPredicacionOpen] = useState<boolean>(isPredicacionActive);
  const [reunionPublicaOpen, setReunionPublicaOpen] = useState<boolean>(isReunionPublicaActive);
  const [vidaMinisterioOpen, setVidaMinisterioOpen] = useState<boolean>(isVidaMinisterioActive);
  const [configuracionOpen, setConfiguracionOpen] = useState<boolean>(isConfiguracionActive);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const codigo = congregacionActual?.codigo_publico;
    await signOut();
    if (codigo) {
      navigate(`/?c=${encodeURIComponent(codigo)}`, { replace: true });
    }
    setIsSigningOut(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center justify-between w-full">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={toggleSidebar} className="flex items-center justify-center cursor-pointer">
                  <CalendarDays className="h-5 w-5 text-sidebar-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menú</TooltipContent>
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

      <SidebarContent className="gap-0 flex flex-col">
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
                  <TooltipContent side="right">Inicio</TooltipContent>
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
                  <TooltipContent side="right">Programas del Mes</TooltipContent>
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

        {/* Predicación - admin/editor/viewer */}
        {canViewPredicacion && (
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
                    <TooltipContent side="right">Predicación</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
                {predicacionOpen &&
                  visiblePredicacionItems
                    .map((item) => (
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
                          <TooltipContent side="right">{item.title}</TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    ))}
              </SidebarMenu>
            ) : (
              <Collapsible open={predicacionOpen} onOpenChange={setPredicacionOpen}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 flex items-center justify-between w-full text-sidebar-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4" />
                      <span>Predicación</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${predicacionOpen ? "rotate-180" : ""}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-4">
                      {visiblePredicacionItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={currentPath === item.url}>
                            <NavLink
                              to={item.url}
                              className="flex items-center gap-2 text-sidebar-foreground/60"
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

        {/* Reunión Pública - admin/editor/viewer */}
        {canViewReunionPublica && (
          <SidebarGroup className="py-1">
            {collapsed ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton
                        isActive={isReunionPublicaActive}
                        className="cursor-pointer"
                        onClick={() => setReunionPublicaOpen(!reunionPublicaOpen)}
                      >
                        <BookOpen className="h-4 w-4" />
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">Reunión Pública</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
                {reunionPublicaOpen &&
                  visibleReunionPublicaItems.map((item) => (
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
                        <TooltipContent side="right">{item.title}</TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            ) : (
              <Collapsible open={reunionPublicaOpen} onOpenChange={setReunionPublicaOpen}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 flex items-center justify-between w-full text-sidebar-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      <span>Reunión Pública</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${reunionPublicaOpen ? "rotate-180" : ""}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-4">
                      {visibleReunionPublicaItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={currentPath === item.url}>
                            <NavLink
                              to={item.url}
                              className="flex items-center gap-2 text-sidebar-foreground/60"
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

        {/* Vida y Ministerio - admin/editor/svministerio/viewer */}
        {canViewVidaMinisterio && (
          <SidebarGroup className="py-1">
            {vymMenuItems.length > 1 ? (
              collapsed ? (
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={isVidaMinisterioActive}
                          className="cursor-pointer"
                          onClick={() => setVidaMinisterioOpen(!vidaMinisterioOpen)}
                        >
                          <BookOpen className="h-4 w-4" />
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">Vida y Ministerio</TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                  {vidaMinisterioOpen &&
                    vymMenuItems.map((item) => (
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
                          <TooltipContent side="right">{item.title}</TooltipContent>
                        </Tooltip>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              ) : (
                <Collapsible open={vidaMinisterioOpen} onOpenChange={setVidaMinisterioOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 flex items-center justify-between w-full text-sidebar-foreground text-sm">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        <span>Vida y Ministerio</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${vidaMinisterioOpen ? "rotate-180" : ""}`} />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="pl-4">
                        {vymMenuItems.map((item) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={currentPath === item.url}>
                              <NavLink
                                to={item.url}
                                className="flex items-center gap-2 text-sidebar-foreground/60"
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
              )
            ) : collapsed ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={currentPath.startsWith("/vida-y-ministerio")}>
                        <NavLink
                          to="/vida-y-ministerio"
                          className="flex items-center justify-center"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                        >
                          <BookOpen className="h-4 w-4" />
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">Vida y Ministerio</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={currentPath.startsWith("/vida-y-ministerio")}>
                    <NavLink
                      to="/vida-y-ministerio"
                      className="flex items-center gap-2 text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Vida y Ministerio</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </SidebarGroup>
        )}

        {/* Asignaciones de Servicio - admin/editor/saservicio */}
        {canViewAsignacionesServicio && (
          <SidebarGroup className="py-1">
            {collapsed ? (
              <SidebarMenu>
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild isActive={currentPath.startsWith("/asignaciones-servicio")}>
                        <NavLink
                          to="/asignaciones-servicio"
                          className="flex items-center justify-center"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                        >
                          <ClipboardList className="h-4 w-4" />
                        </NavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right">Asignaciones de Servicio</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={currentPath.startsWith("/asignaciones-servicio")}>
                    <NavLink
                      to="/asignaciones-servicio"
                      className="flex items-center gap-2 text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <ClipboardList className="h-4 w-4" />
                      <span>Asignaciones de Servicio</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </SidebarGroup>
        )}

        {/* Spacer para empujar Configuración y Congregaciones al fondo */}
        <div className="flex-1" />

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
                    <TooltipContent side="right">Configuración</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
                {configuracionOpen &&
                  visibleConfigItems.map((item) => (
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
                        <TooltipContent side="right">{item.title}</TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            ) : (
              <Collapsible open={configuracionOpen} onOpenChange={setConfiguracionOpen}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 flex items-center justify-between w-full text-sidebar-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Configuración</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${configuracionOpen ? "rotate-180" : ""}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-4">
                      {visibleConfigItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={currentPath === item.url}>
                            <NavLink
                              to={item.url}
                              className="flex items-center gap-2 text-sidebar-foreground/60"
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
                      <TooltipContent side="right">{item.title}</TooltipContent>
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
            {/* Super admin: botón para cambiar congregación */}
            {isSuperAdmin && congregacionActual && (
              <div
                className="text-xs text-sidebar-foreground/70 bg-sidebar-accent/50 rounded-md p-2 cursor-pointer hover:bg-sidebar-accent transition-colors"
                onClick={resetearSeleccion}
                title="Clic para cambiar de congregación"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  <span className="font-medium truncate">{congregacionActual.nombre}</span>
                </div>
                <span className="text-[10px] opacity-70">Clic para cambiar</span>
              </div>
            )}
            <div className="text-sm text-sidebar-foreground">
              <p className="font-medium truncate">
                {profile.nombre} {profile.apellido}
              </p>
              <p className="text-xs opacity-70 truncate">{profile.email}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent border border-sidebar-border"
                onClick={() => navigate("/configuracion/mi-cuenta")}
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Mi Cuenta
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground hover:bg-sidebar-accent border border-sidebar-border"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="space-y-2">
            {/* Super admin collapsed: indicator of current congregation */}
            {isSuperAdmin && congregacionActual && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full h-8 text-sidebar-foreground hover:bg-sidebar-accent"
                    onClick={resetearSeleccion}
                  >
                    <Building2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{congregacionActual.nombre} - Clic para cambiar</TooltipContent>
              </Tooltip>
            )}
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
              <TooltipContent side="right">Cerrar Sesión</TooltipContent>
            </Tooltip>
          </div>
        )}
        <div
          className={`text-center text-[10px] text-sidebar-foreground/50 pt-2 border-t border-sidebar-border mt-2 ${collapsed ? "px-1" : ""}`}
        >
          {collapsed ? "v1.2" : "ver. 1.2"}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
