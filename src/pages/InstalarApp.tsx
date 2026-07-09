import { useState, useEffect } from "react";
import { Download, Share, MoreVertical, Plus, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstalarApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">¡App Instalada!</h1>
            <p className="text-muted-foreground">
              SuitePro ya está instalada en tu dispositivo. Búscala en tu pantalla de inicio.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden shadow-lg mb-4">
              <img src="/pwa-icon-192.png" alt="SuitePro" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Instalar SuitePro</h1>
            <p className="text-muted-foreground text-sm">
              Instala la app en tu dispositivo para acceder rápidamente desde tu pantalla de inicio.
            </p>
          </div>

          {/* Android / Desktop - botón directo */}
          {deferredPrompt && (
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="h-5 w-5 mr-2" />
              Instalar App
            </Button>
          )}

          {/* iOS instructions */}
          {isIOS && !deferredPrompt && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                Para instalar en iPhone/iPad:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <span>Toca el botón</span>
                    <Share className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Compartir</span>
                    <span>en Safari</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <span>Selecciona</span>
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Agregar a pantalla de inicio</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
                  <p className="text-sm text-muted-foreground pt-1">
                    Toca <span className="font-medium text-foreground">Agregar</span> para confirmar
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Generic fallback */}
          {!isIOS && !deferredPrompt && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                Para instalar en Android:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <span>Toca el menú</span>
                    <MoreVertical className="h-4 w-4 text-primary" />
                    <span>del navegador</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <span>Selecciona</span>
                    <Smartphone className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Instalar aplicación</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground text-center">
              La app funciona sin conexión y se actualiza automáticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstalarApp;
