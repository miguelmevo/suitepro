import { useState } from "react";
import { useLocation } from "react-router-dom";
import { 
  Megaphone, 
  Calendar, 
  MapPin, 
  Map, 
  Star, 
  History, 
  Settings, 
  Users,
  ChevronDown,
  Home
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
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

const predicacionItems = [
  { title: "Programa Mensual", url: "/predicacion/programa", icon: Calendar },
  { title: "Puntos de Encuentro", url: "/predicacion/puntos", icon: MapPin },
  { title: "Territorios", url: "/predicacion/territorios", icon: Map },
  { title: "Días Especiales", url: "/predicacion/especiales", icon: Star },
  { title: "Historial", url: "/predicacion/historial", icon: History },
];

const configuracionItems = [
  { title: "Participantes", url: "/configuracion/participantes", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  const isPredicacionActive = currentPath.startsWith("/predicacion");
  const isConfiguracionActive = currentPath.startsWith("/configuracion");

  const [predicacionOpen, setPredicacionOpen] = useState<boolean>(true);
  const [configuracionOpen, setConfiguracionOpen] = useState<boolean>(isConfiguracionActive);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 font-bold text-lg">
          {!collapsed && <span className="font-display">PROGRAMAS</span>}
          {collapsed && <Home className="h-5 w-5" />}
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        {/* Predicación */}
        <SidebarGroup>
          <Collapsible open={predicacionOpen} onOpenChange={setPredicacionOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  {!collapsed && <span>Predicación</span>}
                </div>
                {!collapsed && (
                  <ChevronDown className={`h-4 w-4 transition-transform ${predicacionOpen ? "rotate-180" : ""}`} />
                )}
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
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Configuración */}
        <SidebarGroup>
          <Collapsible open={configuracionOpen} onOpenChange={setConfiguracionOpen}>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {!collapsed && <span>Configuración</span>}
                </div>
                {!collapsed && (
                  <ChevronDown className={`h-4 w-4 transition-transform ${configuracionOpen ? "rotate-180" : ""}`} />
                )}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {configuracionItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={currentPath === item.url}>
                        <NavLink 
                          to={item.url} 
                          className="flex items-center gap-2"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                        >
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!collapsed && (
          <p className="text-xs text-muted-foreground text-center">
            Crea tu programa y publícalo
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}