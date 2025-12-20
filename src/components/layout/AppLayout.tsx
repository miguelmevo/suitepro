import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { getConfigValue, isLoading } = useConfiguracionSistema("general");
  
  const nombreCongregacionValue = getConfigValue("nombre_congregacion");
  const nombreCongregacion = nombreCongregacionValue && typeof nombreCongregacionValue === 'object' && nombreCongregacionValue.nombre 
    ? nombreCongregacionValue.nombre 
    : (typeof nombreCongregacionValue === 'string' ? nombreCongregacionValue : undefined);

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