import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { CalendarDays } from "lucide-react";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { getConfigValue, isLoading } = useConfiguracionSistema("general");
  
  const nombreCongregacionValue = getConfigValue("nombre_congregacion");
  const nombreCongregacion = typeof nombreCongregacionValue === 'string' 
    ? nombreCongregacionValue 
    : undefined;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-12 flex items-center justify-between border-b bg-background px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-brand" />
                <span className="font-bold text-lg text-brand">SuitePro</span>
              </div>
            </div>
            {!isLoading && nombreCongregacion && (
              <span className="text-sm font-medium text-brand">{nombreCongregacion}</span>
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