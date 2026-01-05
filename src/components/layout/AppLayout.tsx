import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { getConfigValue, isLoading } = useConfiguracionSistema("general");
  const isMobile = useIsMobile();
  
  const nombreCongregacionValue = getConfigValue("nombre_congregacion");
  const nombreCongregacion = nombreCongregacionValue && typeof nombreCongregacionValue === 'object' && nombreCongregacionValue.nombre 
    ? nombreCongregacionValue.nombre 
    : (typeof nombreCongregacionValue === 'string' ? nombreCongregacionValue : undefined);

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col w-full">
        <MobileNav nombreCongregacion={nombreCongregacion} />
        <main className="flex-1 p-4 overflow-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-12 flex items-center justify-end border-b bg-background px-4">
            {!isLoading && nombreCongregacion && (
              <span className="text-base font-bold text-primary">{nombreCongregacion}</span>
            )}
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}