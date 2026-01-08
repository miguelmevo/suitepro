import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { getConfigValue, isLoading } = useConfiguracionSistema("general");
  const { congregacionActual } = useCongregacion();
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  
  const nombreCongregacionValue = getConfigValue("nombre_congregacion");
  const nombreCongregacion = nombreCongregacionValue && typeof nombreCongregacionValue === 'object' && nombreCongregacionValue.nombre 
    ? nombreCongregacionValue.nombre 
    : (typeof nombreCongregacionValue === 'string' ? nombreCongregacionValue : undefined);

  const congregacionUrl = congregacionActual?.slug 
    ? `${window.location.origin}/auth?slug=${congregacionActual.slug}`
    : null;

  const handleCopyUrl = async () => {
    if (!congregacionUrl) return;
    try {
      await navigator.clipboard.writeText(congregacionUrl);
      setCopied(true);
      toast.success("URL copiada al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Error al copiar la URL");
    }
  };

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
          <header className="h-auto min-h-12 flex items-center justify-end border-b bg-background px-4 py-2">
            {!isLoading && (nombreCongregacion || congregacionUrl) && (
              <div className="flex flex-col items-end gap-0.5">
                {nombreCongregacion && (
                  <span className="text-base font-bold text-primary">{nombreCongregacion}</span>
                )}
                {congregacionUrl && (
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title={congregacionUrl}
                  >
                    <span>Compartir URL</span>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
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